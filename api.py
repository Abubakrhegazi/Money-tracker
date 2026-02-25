from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from datetime import datetime, timedelta
import hashlib
import hmac
import os
from dotenv import load_dotenv
from database import Session, Expense, get_monthly_summary
from sqlalchemy import extract

load_dotenv()

app = FastAPI()
security = HTTPBearer()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-to-a-random-secret")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://moneybot-beta.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

def create_jwt(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.utcnow() + timedelta(days=7)
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
async def telegram_auth(data: dict):
    """Called by frontend after Telegram login widget"""
    if not verify_telegram_auth(dict(data)):
        raise HTTPException(status_code=401, detail="Invalid Telegram auth")

    token = create_jwt(str(data["id"]), data.get("username", ""))
    return {"token": token, "user": data}

@app.get("/expenses/summary")
async def monthly_summary(user=Depends(get_current_user)):
    total, breakdown, count = get_monthly_summary(user["sub"])
    return {
        "total": total,
        "count": count,
        "breakdown": breakdown,
        "month": datetime.utcnow().strftime("%B %Y")
    }

@app.get("/expenses/history")
async def expense_history(user=Depends(get_current_user)):
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
                "created_at": e.created_at.isoformat()
            }
            for e in expenses
        ]
    finally:
        session.close()

@app.get("/expenses/monthly-trend")
async def monthly_trend(user=Depends(get_current_user)):
    """Last 6 months spending totals"""
    session = Session()
    try:
        now = datetime.utcnow()
        result = []
        for i in range(5, -1, -1):
            month = (now.month - i - 1) % 12 + 1
            year = now.year - ((now.month - i - 1) // 12)
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
@app.get("/auth/test-token")
async def test_token():
    """Remove this in production!"""
    token = create_jwt("687080661", "testuser")
    return {"token": token}