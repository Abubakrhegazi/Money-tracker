from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
import traceback
import logging
import time
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
from pydantic import BaseModel, Field
import secrets
import re
from dotenv import load_dotenv
from database import (
    Session, Expense, get_monthly_summary, consume_login_token, create_login_token,
    init_db, set_budget, get_budget, delete_expense, delete_budget,
    get_notification_settings, update_notification_settings, delete_user_data, engine,
)
from sqlalchemy import extract, text
from backup import run_backup as trigger_backup, get_last_backup_time

# ── Structured logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("api")

# ── Rate limiting ────────────────────────────────────────────────────────
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv()

@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield

app = FastAPI(lifespan=lifespan)
security = HTTPBearer()

# ── Secrets ───────────────────────────────────────────────────────────────
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
JWT_SECRET = os.getenv("JWT_SECRET", "")
if not JWT_SECRET:
    import secrets as _s
    JWT_SECRET = _s.token_hex(32)
    logger.warning("JWT_SECRET not set — using random ephemeral secret. Set JWT_SECRET env var for production!")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")

_start_time = time.time()

# ── Rate limiter setup ───────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS — tightened methods, headers, and origin regex ──────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://moneybot-beta.vercel.app",
    ],
    allow_origin_regex=r"https://moneybot[a-z0-9\-]*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Admin router ─────────────────────────────────────────────────────────
from admin_api import router as admin_router
app.include_router(admin_router, prefix="/admin", tags=["admin"])

# ── Security headers middleware ──────────────────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Remove server identity headers
        if "X-Powered-By" in response.headers:
            del response.headers["X-Powered-By"]
        if "server" in response.headers:
            del response.headers["server"]
        return response

app.add_middleware(SecurityHeadersMiddleware)

# ── Global exception handler (generic message — never leak internals) ────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    logger.error(f"{request.method} {request.url}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# ── Health check ─────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Health check — returns 200 if API + DB are OK."""
    db_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass
    uptime = int(time.time() - _start_time)
    status = "healthy" if db_ok else "degraded"
    code = 200 if db_ok else 503
    return JSONResponse(
        status_code=code,
        content={
            "status": status,
            "database": "connected" if db_ok else "unreachable",
            "uptime_seconds": uptime,
            "version": "1.0.0",
            "last_backup": get_last_backup_time(),
        }
    )

@app.post("/internal/backup")
@limiter.limit("3/hour")
async def manual_backup(request: Request):
    """Trigger a manual backup. Secured by INTERNAL_API_KEY."""
    api_key = request.headers.get("X-Internal-Api-Key", "")
    if not INTERNAL_API_KEY or api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Unauthorized")
    result = trigger_backup()
    logger.info(f"Manual backup triggered: {result}")
    return result

# ── Auth ──────────────────────────────────────────────────────────────

def verify_telegram_auth(data: dict) -> bool:
    """Verify the data actually came from Telegram"""
    check_hash = data.pop("hash", None)
    if not check_hash:
        return False

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(data.items())
    )
    secret_key = hashlib.sha256(BOT_TOKEN.encode()).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed_hash, check_hash)

def create_jwt_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ── Routes ────────────────────────────────────────────────────────────

@app.post("/auth/telegram")
@limiter.limit("5/minute")
async def telegram_auth(request: Request, data: dict):
    """Called by frontend after Telegram login widget"""
    if not verify_telegram_auth(dict(data)):
        raise HTTPException(status_code=401, detail="Invalid Telegram auth")

    token = create_jwt_token(str(data["id"]), data.get("username", ""))
    return {"token": token, "user": data}

@app.get("/expenses/summary")
@limiter.limit("60/minute")
async def monthly_summary(request: Request, user=Depends(get_current_user)):
    expense_total, breakdown, count, income_total = get_monthly_summary(user["sub"])
    # Get last month total for trend comparison
    session = Session()
    try:
        now = datetime.now(timezone.utc)
        last_month = (now.month - 2) % 12 + 1
        last_year = now.year if now.month > 1 else now.year - 1
        last_expenses = session.query(Expense).filter(
            Expense.telegram_user_id == user["sub"],
            extract('month', Expense.created_at) == last_month,
            extract('year', Expense.created_at) == last_year
        ).all()
        last_month_total = sum(e.amount for e in last_expenses if (e.entry_type or "expense") == "expense")
    finally:
        session.close()
    return {
        "total": expense_total,
        "income_total": income_total,
        "count": count,
        "breakdown": breakdown,
        "month": datetime.now(timezone.utc).strftime("%B %Y"),
        "last_month_total": last_month_total,
        "days_in_month": now.day
    }

@app.get("/expenses/history")
@limiter.limit("60/minute")
async def expense_history(request: Request, user=Depends(get_current_user)):
    session = Session()
    try:
        expenses = session.query(Expense).filter_by(
            telegram_user_id=user["sub"]
        ).order_by(Expense.created_at.desc()).limit(50).all()

        return [
            {
                "id": e.id,
                "amount": e.amount,
                "currency": e.currency,
                "category": e.category,
                "merchant": e.merchant,
                "date": e.date,
                "transcript": e.transcript,
                "entry_type": e.entry_type or "expense",
                "created_at": e.created_at.isoformat()
            }
            for e in expenses
        ]
    finally:
        session.close()

@app.delete("/expenses/{expense_id}")
@limiter.limit("30/minute")
async def delete_expense_api(request: Request, expense_id: int, user=Depends(get_current_user)):
    success = delete_expense(user["sub"], expense_id)
    if not success:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"status": "deleted", "id": expense_id}

@app.get("/expenses/monthly-trend")
@limiter.limit("60/minute")
async def monthly_trend(request: Request, user=Depends(get_current_user)):
    session = Session()
    try:
        now = datetime.now(timezone.utc)
        result = []
        for i in range(5, -1, -1):
            month = ((now.month - 1 - i) % 12) + 1
            year = now.year + ((now.month - 1 - i) // 12)
            expenses = session.query(Expense).filter(
                Expense.telegram_user_id == user["sub"],
                extract('month', Expense.created_at) == month,
                extract('year', Expense.created_at) == year
            ).all()
            total = sum(e.amount for e in expenses)
            result.append({
                "month": datetime(year, month, 1).strftime("%b %Y"),
                "total": total
            })
        return result
    finally:
        session.close()

# ── Budget ────────────────────────────────────────────────────────────

class BudgetBody(BaseModel):
    category: str
    amount: float
    currency: str = "EGP"

@app.get("/budget")
@limiter.limit("60/minute")
async def get_user_budget(request: Request, user=Depends(get_current_user)):
    result = get_budget(user["sub"])
    return result  # returns {category: amount} dict

@app.post("/budget")
@limiter.limit("30/minute")
async def set_user_budget(request: Request, body: BudgetBody, user=Depends(get_current_user)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Budget must be positive")
    set_budget(user["sub"], body.category, body.amount, body.currency)
    return {"category": body.category, "amount": body.amount, "currency": body.currency}

@app.delete("/budget/{category}")
@limiter.limit("30/minute")
async def delete_user_budget(request: Request, category: str, user=Depends(get_current_user)):
    success = delete_budget(user["sub"], category)
    if not success:
        raise HTTPException(status_code=404, detail="Budget not found")
    return {"status": "deleted", "category": category}

# ── Account Deletion ─────────────────────────────────────────────────

@app.delete("/account")
@limiter.limit("3/hour")
async def delete_account(request: Request, user=Depends(get_current_user)):
    """Delete all user data permanently (GDPR). Irreversible."""
    user_id = user["sub"]
    success = delete_user_data(user_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete account data")
    logger.info(f"Account data deleted for user {user_id}")
    return {"status": "deleted", "message": "All your data has been permanently removed"}

# ── Notification Settings ─────────────────────────────────────────────

class NotificationSettingsBody(BaseModel):
    daily_enabled: bool | None = None
    daily_time: str | None = None
    weekly_enabled: bool | None = None
    weekly_day: int | None = None
    timezone: str | None = None

@app.get("/notifications/settings")
@limiter.limit("30/minute")
async def get_notif_settings(request: Request, user=Depends(get_current_user)):
    return get_notification_settings(user["sub"])

@app.post("/notifications/settings")
@limiter.limit("10/minute")
async def update_notif_settings(request: Request, body: NotificationSettingsBody, user=Depends(get_current_user)):
    kwargs = {k: v for k, v in body.model_dump().items() if v is not None}
    if not kwargs:
        raise HTTPException(status_code=400, detail="No settings provided")
    return update_notification_settings(user["sub"], **kwargs)

# ── test-token endpoint REMOVED (was a security risk) ────────────────

class TelegramLinkAuthBody(BaseModel):
    token: str

@app.post("/auth/telegram-link")
@limiter.limit("5/minute")
async def telegram_link_auth(request: Request, body: TelegramLinkAuthBody):
    try:
        telegram_user_id = consume_login_token(body.token)
    except Exception as e:
        logger.error(f"consume_login_token failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not telegram_user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired link")

    token = create_jwt_token(str(telegram_user_id), "")
    return {"token": token}

# ── WhatsApp auth — internal-only (bot→API), gated by API key ────────

_PHONE_REGEX = re.compile(r"^\+?[1-9]\d{6,14}$")

@app.post("/auth/whatsapp-token")
@limiter.limit("5/minute")
async def create_whatsapp_login(request: Request, phone: str):
    # Gate: only the bot should call this endpoint
    api_key = request.headers.get("X-Internal-Api-Key", "")
    if INTERNAL_API_KEY and api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")
    # Validate phone format
    if not _PHONE_REGEX.match(phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    raw = create_login_token(phone, minutes=10)
    return {"token": raw}

@app.get("/auth/whatsapp")
@limiter.limit("5/minute")
async def whatsapp_login(request: Request, token: str):
    user_id = consume_login_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired link")
    jwt_token = create_jwt_token(user_id, user_id)
    return {"token": jwt_token, "user_id": user_id}