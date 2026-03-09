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
    save_investment, get_investments, update_investment_value, delete_investment,
    get_investment_summary, get_primary_id, get_price_history,
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
        "https://aurabot.website",
    ],
    allow_origin_regex=r"https://aurabot\.website",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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

class UpdateExpenseBody(BaseModel):
    amount: float | None = None
    currency: str | None = None
    category: str | None = None
    merchant: str | None = None
    entry_type: str | None = None

_VALID_CATEGORIES = {
    "food", "transport", "shopping", "bills", "entertainment",
    "health", "education", "other",
    "salary", "freelance", "gift", "refund", "investment", "other_income",
}
_VALID_ENTRY_TYPES = {"expense", "income"}

@app.patch("/expenses/{expense_id}")
@limiter.limit("30/minute")
async def update_expense_api(request: Request, expense_id: int, body: UpdateExpenseBody, user=Depends(get_current_user)):
    if body.amount is not None and body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if body.category is not None and body.category not in _VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category")
    if body.entry_type is not None and body.entry_type not in _VALID_ENTRY_TYPES:
        raise HTTPException(status_code=400, detail="entry_type must be 'expense' or 'income'")

    session = Session()
    try:
        expense = session.query(Expense).filter_by(
            id=expense_id, telegram_user_id=user["sub"]
        ).filter(Expense.is_deleted != True).first()
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
        if body.amount is not None:
            expense.amount = body.amount
        if body.currency is not None:
            expense.currency = body.currency
        if body.category is not None:
            expense.category = body.category
        if body.merchant is not None:
            expense.merchant = body.merchant or None
        if body.entry_type is not None:
            expense.entry_type = body.entry_type
        session.commit()
        return {
            "id": expense.id,
            "amount": expense.amount,
            "currency": expense.currency,
            "category": expense.category,
            "merchant": expense.merchant,
            "entry_type": expense.entry_type,
        }
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise e
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

# ── Investments ────────────────────────────────────────────────────────

_VALID_ASSET_TYPES = {"stocks", "crypto", "gold", "real_estate", "currency", "other"}

class InvestmentBody(BaseModel):
    asset_name: str
    asset_type: str
    amount_invested: float
    current_value: float | None = None
    currency: str = "EGP"
    notes: str | None = None
    date: str | None = None
    grams: float | None = None
    ticker_symbol: str | None = None
    coin_id: str | None = None
    forex_pair: str | None = None
    karat: int | None = None
    price_per_unit: float | None = None

class UpdateInvestmentBody(BaseModel):
    current_value: float | None = None
    notes: str | None = None

@app.get("/investments/check-ticker")
@limiter.limit("20/minute")
async def check_ticker(request: Request, symbol: str, user=Depends(get_current_user)):
    """Validate a stock ticker and return its current price in EGP."""
    from price_fetcher import get_stock_price_egp
    symbol = symbol.strip().upper()
    if not symbol or len(symbol) > 15:
        raise HTTPException(status_code=400, detail="Invalid symbol")
    try:
        price_egp, _ = get_stock_price_egp(symbol)
        return {"valid": True, "symbol": symbol, "price_egp": round(price_egp, 4)}
    except Exception:
        return {"valid": False, "symbol": symbol, "price_egp": 0}

@app.get("/investments")
@limiter.limit("60/minute")
async def get_user_investments(request: Request, user=Depends(get_current_user)):
    user_id = get_primary_id(user["sub"])
    investments = get_investments(user_id)
    summary = get_investment_summary(user_id)

    inv_list = []
    for i in investments:
        identifier = i.coin_id or i.ticker_symbol or ("gold" if i.asset_type == "gold" else None) or i.forex_pair
        history = get_price_history(identifier) if identifier else []
        inv_list.append({
            "id": i.id,
            "asset_name": i.asset_name,
            "asset_type": i.asset_type,
            "amount_invested": i.amount_invested,
            "current_value": i.current_value,
            "currency": i.currency,
            "notes": i.notes,
            "date": i.date,
            "grams": i.grams,
            "ticker_symbol": i.ticker_symbol,
            "coin_id": i.coin_id,
            "forex_pair": i.forex_pair,
            "karat": i.karat,
            "price_per_unit": i.price_per_unit,
            "current_price": i.current_price,
            "last_price_update": i.last_price_update.isoformat() if i.last_price_update else None,
            "created_at": i.created_at.isoformat() if i.created_at else None,
            "price_history": history,
        })

    return {"summary": summary, "investments": inv_list}

@app.post("/investments")
@limiter.limit("30/minute")
async def create_investment(request: Request, body: InvestmentBody, user=Depends(get_current_user)):
    if body.amount_invested <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if body.asset_type not in _VALID_ASSET_TYPES:
        raise HTTPException(status_code=400, detail=f"asset_type must be one of: {', '.join(_VALID_ASSET_TYPES)}")
    from datetime import date as _date
    inv_date = body.date or _date.today().isoformat()
    inv_id = save_investment(user["sub"], {
        "asset_name": body.asset_name,
        "asset_type": body.asset_type,
        "amount_invested": body.amount_invested,
        "current_value": body.current_value,
        "currency": body.currency,
        "notes": body.notes,
        "date": inv_date,
        "grams": body.grams,
        "ticker_symbol": body.ticker_symbol.upper() if body.ticker_symbol else None,
        "coin_id": body.coin_id,
        "forex_pair": body.forex_pair.upper() if body.forex_pair else None,
        "karat": body.karat,
        "price_per_unit": body.price_per_unit,
    })
    return {"id": inv_id, "status": "created"}

@app.patch("/investments/{investment_id}")
@limiter.limit("30/minute")
async def update_investment(request: Request, investment_id: str, body: UpdateInvestmentBody, user=Depends(get_current_user)):
    if body.current_value is not None and body.current_value < 0:
        raise HTTPException(status_code=400, detail="current_value cannot be negative")
    if body.current_value is None and body.notes is None:
        raise HTTPException(status_code=400, detail="Nothing to update")
    success = update_investment_value(user["sub"], investment_id, body.current_value, body.notes)
    if not success:
        raise HTTPException(status_code=404, detail="Investment not found")
    return {"id": investment_id, "status": "updated"}

@app.delete("/investments/{investment_id}")
@limiter.limit("30/minute")
async def delete_investment_api(request: Request, investment_id: str, user=Depends(get_current_user)):
    success = delete_investment(user["sub"], investment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Investment not found")
    return {"id": investment_id, "status": "deleted"}

@app.post("/investments/refresh")
@limiter.limit("10/minute")
async def refresh_investment_prices(request: Request, user=Depends(get_current_user)):
    """Trigger an immediate price refresh for the authenticated user's portfolio."""
    try:
        from price_fetcher import refresh_user_investment_prices
        result = refresh_user_investment_prices(user["sub"])
        return {"status": "ok", **result}
    except Exception as e:
        logger.error(f"Investment price refresh failed: {e}")
        raise HTTPException(status_code=500, detail="Price refresh failed")