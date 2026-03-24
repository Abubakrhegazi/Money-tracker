"""
Paymob payment integration for Aura subscription plans.

Endpoints:
  POST /payments/paymob/initiate  — (legacy) Create a payment order, returns checkout URL
  POST /payments/paymob/webhook   — Receive Paymob transaction webhook (HMAC-verified)
  POST /payments/initiate         — (new) JWT-authenticated initiate for Pro monthly
  GET  /payments/callback         — Paymob browser redirect after payment
"""
import hashlib
import hmac
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel

from database import (
    get_primary_id, set_paymob_order_id, upgrade_user_plan,
    get_user_settings, Session, UserSettings, get_user_plan,
)
from notifications import send_telegram_message

load_dotenv()
logger = logging.getLogger("payments")

router = APIRouter(prefix="/payments", tags=["payments"])

PAYMOB_API_KEY      = os.getenv("PAYMOB_API_KEY", "")
PAYMOB_INTEGRATION_ID = os.getenv("PAYMOB_INTEGRATION_ID", "")
PAYMOB_IFRAME_ID    = os.getenv("PAYMOB_IFRAME_ID", "")
PAYMOB_HMAC_SECRET  = os.getenv("PAYMOB_HMAC_SECRET", "")
JWT_SECRET          = os.getenv("JWT_SECRET", "")
FRONTEND_URL        = os.getenv("FRONTEND_URL", "https://aurabot.website")

PRO_AMOUNT_PIASTERS = 9900  # 99 EGP

# ── Legacy pricing (kept for /paymob/initiate) ──────────────────────────────
PLAN_PRICES = {
    "pro":   {"monthly": 9900,  "annual": 99000},
    "elite": {"monthly": 19900, "annual": 199000},
}
PLAN_DAYS = {"monthly": 30, "annual": 365}

# ── JWT auth helper (mirrors api.py — avoids circular import) ───────────────
_security = HTTPBearer()

def _get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── HMAC verification ───────────────────────────────────────────────────────
_HMAC_FIELDS = [
    "amount_cents", "created_at", "currency", "error_occured",
    "has_parent_transaction", "id", "integration_id",
    "is_3d_secure", "is_auth", "is_capture", "is_refunded",
    "is_standalone_payment", "is_voided", "order",
    "owner", "pending", "source_data.pan", "source_data.sub_type",
    "source_data.type", "success",
]


def _get_nested(d: dict, key: str) -> str:
    val = d
    for k in key.split("."):
        val = val.get(k, "") if isinstance(val, dict) else ""
    return str(val).lower() if isinstance(val, bool) else str(val)


def _verify_hmac(obj: dict, received: str) -> bool:
    if not PAYMOB_HMAC_SECRET:
        logger.warning("PAYMOB_HMAC_SECRET not set — skipping HMAC verification")
        return True  # dev fallback; reject in prod if secret is missing
    concatenated = "".join(_get_nested(obj, f) for f in _HMAC_FIELDS)
    computed = hmac.new(
        PAYMOB_HMAC_SECRET.encode(),
        concatenated.encode(),
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(computed, received)


def _verify_hmac_query(params: dict) -> bool:
    """Verify HMAC from Paymob redirect query params (flat key-value map)."""
    received = params.get("hmac", "")
    return _verify_hmac(params, received)


# ── Shared upgrade logic ────────────────────────────────────────────────────
def _do_upgrade(user_id: str, plan: str = "pro", days: int = 31) -> None:
    """Idempotent upgrade: sets plan + sends Telegram confirmation."""
    upgraded = upgrade_user_plan(user_id, plan, days)
    if upgraded:
        renew_date = (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%B %d, %Y")
        plan_label = plan.capitalize()
        send_telegram_message(
            user_id,
            f"🎉 You're now on Aura {plan_label}! Your investments dashboard is unlocked.\n"
            f"It renews on {renew_date}."
        )
        logger.info(f"User {user_id} upgraded to {plan} ({days}d)")
    else:
        logger.error(f"upgrade_user_plan failed for user {user_id}")


# ── Async Paymob API calls ──────────────────────────────────────────────────
async def _paymob_auth_token(client: httpx.AsyncClient) -> str:
    r = await client.post(
        "https://accept.paymob.com/api/auth/tokens",
        json={"api_key": PAYMOB_API_KEY},
    )
    r.raise_for_status()
    return r.json()["token"]


async def _paymob_create_order(
    client: httpx.AsyncClient, auth_token: str,
    amount: int, merchant_order_id: str,
) -> str:
    r = await client.post(
        "https://accept.paymob.com/api/ecommerce/orders",
        json={
            "auth_token": auth_token,
            "delivery_needed": False,
            "amount_cents": amount,
            "currency": "EGP",
            "merchant_order_id": merchant_order_id,
            "items": [],
        },
    )
    r.raise_for_status()
    return str(r.json()["id"])


async def _paymob_payment_key(
    client: httpx.AsyncClient, auth_token: str,
    order_id: str, amount: int, billing_data: dict,
) -> str:
    r = await client.post(
        "https://accept.paymob.com/api/acceptance/payment_keys",
        json={
            "auth_token": auth_token,
            "amount_cents": amount,
            "expiration": 3600,
            "order_id": order_id,
            "billing_data": billing_data,
            "currency": "EGP",
            "integration_id": int(PAYMOB_INTEGRATION_ID),
        },
    )
    r.raise_for_status()
    return r.json()["token"]


# ══════════════════════════════════════════════════════════════════════════════
# NEW: POST /payments/initiate — JWT-authenticated, Pro monthly only
# ══════════════════════════════════════════════════════════════════════════════
@router.post("/initiate")
async def initiate_pro(user=Depends(_get_current_user)):
    """JWT-authenticated endpoint: initiates a Pro monthly subscription checkout."""
    if not PAYMOB_API_KEY:
        raise HTTPException(status_code=503, detail="Payment service not configured")

    user_id = get_primary_id(user["sub"])

    # Already Pro? Return early
    plan_info = get_user_plan(user_id)
    if plan_info["plan"] in ("pro", "elite"):
        return {"already_pro": True}

    settings = get_user_settings(user_id) or {}
    name = settings.get("name") or "Aura User"
    name_parts = name.split()
    first, last = name_parts[0], (name_parts[-1] if len(name_parts) > 1 else "User")

    billing_data = {
        "first_name": first, "last_name": last,
        "email": "NA", "phone_number": "NA",
        "apartment": "NA", "floor": "NA", "street": "NA",
        "building": "NA", "shipping_method": "NA",
        "postal_code": "NA", "city": "NA",
        "country": "EG", "state": "NA",
    }

    merchant_order_id = (
        f"aura_{user_id}_pro_monthly_{int(datetime.now(timezone.utc).timestamp())}"
    )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            auth_token = await _paymob_auth_token(client)
            order_id   = await _paymob_create_order(client, auth_token, PRO_AMOUNT_PIASTERS, merchant_order_id)
            set_paymob_order_id(user_id, order_id)
            payment_key = await _paymob_payment_key(client, auth_token, order_id, PRO_AMOUNT_PIASTERS, billing_data)
    except httpx.HTTPError as e:
        logger.error(f"Paymob API error during initiate: {e}")
        raise HTTPException(status_code=502, detail={"error": "payment_gateway_error"})

    return {"redirect_url": f"https://accept.paymob.com/invoices/payment/{payment_key}"}


# ══════════════════════════════════════════════════════════════════════════════
# NEW: GET /payments/callback — Paymob browser redirect after payment
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/callback")
async def payment_callback(request: Request):
    """
    Paymob redirects the user here after payment (success or failure).
    Validates HMAC, upgrades user if successful, then redirects to dashboard.
    """
    params = dict(request.query_params)
    success = params.get("success", "false").lower() == "true"

    if success and _verify_hmac_query(params):
        order_id = params.get("order", "")
        # Find user by stored paymob_order_id
        session = Session()
        try:
            us = session.query(UserSettings).filter_by(paymob_order_id=order_id).first()
            if us:
                _do_upgrade(us.telegram_user_id, plan="pro", days=31)
        finally:
            session.close()
        return RedirectResponse(f"{FRONTEND_URL}/dashboard/investments?payment=success")

    return RedirectResponse(f"{FRONTEND_URL}/dashboard/investments?payment=failed")


# ══════════════════════════════════════════════════════════════════════════════
# NEW: POST /payments/webhook — server-to-server Paymob webhook
# ══════════════════════════════════════════════════════════════════════════════
@router.post("/webhook")
async def payment_webhook(request: Request):
    """Server-to-server Paymob webhook (type=TRANSACTION). Always returns 200."""
    try:
        data = await request.json()
    except Exception:
        return {"received": True}

    obj = data.get("obj", data)
    received_hmac = request.query_params.get("hmac", data.get("hmac", ""))

    # For webhook, order field is nested: obj.order.id
    order_raw = obj.get("order", "")
    if isinstance(order_raw, dict):
        obj_flat = {**obj, "order": str(order_raw.get("id", ""))}
    else:
        obj_flat = {**obj, "order": str(order_raw)}

    if not _verify_hmac(obj_flat, received_hmac):
        logger.warning("Paymob webhook HMAC verification failed")
        return {"received": True}

    success = obj.get("success", False)
    if not success:
        return {"received": True}

    order_id = obj_flat["order"]
    session = Session()
    try:
        us = session.query(UserSettings).filter_by(paymob_order_id=order_id).first()
        if not us:
            # Fallback: parse merchant_order_id
            merchant_order_id = (
                order_raw.get("merchant_order_id", "") if isinstance(order_raw, dict) else ""
            )
            parts = merchant_order_id.split("_")
            if len(parts) >= 3:
                user_id = parts[1]
            else:
                logger.error(f"No user found for Paymob order {order_id}")
                return {"received": True}
        else:
            user_id = us.telegram_user_id
    finally:
        session.close()

    _do_upgrade(user_id, plan="pro", days=31)
    return {"received": True}


# ══════════════════════════════════════════════════════════════════════════════
# LEGACY: POST /payments/paymob/initiate — kept for backward compat
# ══════════════════════════════════════════════════════════════════════════════
class PaymentInitiateBody(BaseModel):
    user_id: str
    plan: str = "pro"
    billing_cycle: str = "monthly"


@router.post("/paymob/initiate")
async def initiate_payment_legacy(body: PaymentInitiateBody):
    """Legacy initiate endpoint (user_id in body). Prefer /payments/initiate."""
    if body.plan not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail="Plan must be 'pro' or 'elite'")
    if body.billing_cycle not in ("monthly", "annual"):
        raise HTTPException(status_code=400, detail="billing_cycle must be 'monthly' or 'annual'")
    if not PAYMOB_API_KEY:
        raise HTTPException(status_code=503, detail="Payment service not configured")

    amount = PLAN_PRICES[body.plan][body.billing_cycle]
    merchant_order_id = (
        f"aura_{body.user_id}_{body.plan}_{body.billing_cycle}"
        f"_{int(datetime.now(timezone.utc).timestamp())}"
    )
    settings = get_user_settings(body.user_id) or {}
    name = settings.get("name") or "Aura User"
    name_parts = name.split()
    billing_data = {
        "first_name": name_parts[0],
        "last_name": name_parts[-1] if len(name_parts) > 1 else "User",
        "email": "user@aurabot.website", "phone_number": "01000000000",
        "apartment": "NA", "floor": "NA", "street": "NA",
        "building": "NA", "shipping_method": "NA",
        "postal_code": "NA", "city": "Cairo",
        "country": "EG", "state": "Cairo",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            auth_token  = await _paymob_auth_token(client)
            order_id    = await _paymob_create_order(client, auth_token, amount, merchant_order_id)
            set_paymob_order_id(body.user_id, order_id)
            payment_key = await _paymob_payment_key(client, auth_token, order_id, amount, billing_data)
    except httpx.HTTPError as e:
        logger.error(f"Paymob API error: {e}")
        raise HTTPException(status_code=502, detail="Payment gateway error")

    return {
        "payment_url": f"https://accept.paymob.com/invoices/payment/{payment_key}",
        "order_id": order_id,
    }


# ══════════════════════════════════════════════════════════════════════════════
# LEGACY: POST /payments/paymob/webhook — kept for backward compat
# ══════════════════════════════════════════════════════════════════════════════
@router.post("/paymob/webhook")
async def paymob_webhook_legacy(request: Request):
    """Legacy webhook endpoint. Paymob always expects 200."""
    try:
        data = await request.json()
    except Exception:
        return {"status": "ok"}

    obj = data.get("obj", data)
    received_hmac = data.get("hmac", "")
    order_raw = obj.get("order", "")
    if isinstance(order_raw, dict):
        obj_flat = {**obj, "order": str(order_raw.get("id", ""))}
    else:
        obj_flat = {**obj, "order": str(order_raw)}

    if not _verify_hmac(obj_flat, received_hmac):
        logger.warning("Paymob webhook (legacy) HMAC verification failed")
        return {"status": "ok"}

    if not obj.get("success", False):
        return {"status": "ok"}

    order_id = obj_flat["order"]
    merchant_order_id = (
        order_raw.get("merchant_order_id", "") if isinstance(order_raw, dict) else ""
    )
    parts = merchant_order_id.split("_") if merchant_order_id else []

    session = Session()
    try:
        if len(parts) >= 4:
            user_id = parts[1]
            plan = parts[2] if parts[2] in ("pro", "elite") else "pro"
            days = PLAN_DAYS.get(parts[3], 30)
        else:
            us = session.query(UserSettings).filter_by(paymob_order_id=order_id).first()
            if not us:
                logger.error(f"No user found for Paymob order {order_id}")
                return {"status": "ok"}
            user_id, plan, days = us.telegram_user_id, "pro", 30
    finally:
        session.close()

    _do_upgrade(user_id, plan=plan, days=days)
    return {"status": "ok"}
