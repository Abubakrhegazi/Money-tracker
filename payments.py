"""
Paymob payment integration for Aura subscription plans.

Endpoints:
  POST /payments/paymob/initiate  — Create a payment order and return checkout URL
  POST /payments/paymob/webhook   — Receive Paymob transaction callback (HMAC-verified)
"""
import hashlib
import hmac
import logging
import os
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from database import (
    get_primary_id, set_paymob_order_id, upgrade_user_plan,
    get_user_settings, Session, UserSettings,
)
from notifications import send_telegram_message

load_dotenv()
logger = logging.getLogger("payments")

router = APIRouter(prefix="/payments", tags=["payments"])

PAYMOB_API_KEY = os.getenv("PAYMOB_API_KEY", "")
PAYMOB_INTEGRATION_ID = os.getenv("PAYMOB_INTEGRATION_ID", "")
PAYMOB_IFRAME_ID = os.getenv("PAYMOB_IFRAME_ID", "")
PAYMOB_HMAC_SECRET = os.getenv("PAYMOB_HMAC_SECRET", "")

# Pricing in EGP piasters (Paymob uses piasters — 1 EGP = 100 piasters)
PLAN_PRICES = {
    "pro": {"monthly": 99_00, "annual": 990_00},     # 99 EGP/mo, 990 EGP/yr (2 months free)
    "elite": {"monthly": 199_00, "annual": 1990_00},  # 199 EGP/mo, 1990 EGP/yr
}

PLAN_DAYS = {
    "monthly": 30,
    "annual": 365,
}


class PaymentInitiateBody(BaseModel):
    user_id: str
    plan: str  # "pro" | "elite"
    billing_cycle: str = "monthly"  # "monthly" | "annual"


class PaymobWebhookBody(BaseModel):
    """Flexible model — Paymob sends a large JSON payload."""
    class Config:
        extra = "allow"


def _get_paymob_auth_token() -> str:
    """Authenticate with Paymob API and return auth token."""
    resp = requests.post(
        "https://accept.paymob.com/api/auth/tokens",
        json={"api_key": PAYMOB_API_KEY},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["token"]


def _create_paymob_order(auth_token: str, amount_piasters: int, merchant_order_id: str) -> str:
    """Create an order on Paymob and return order ID."""
    resp = requests.post(
        "https://accept.paymob.com/api/ecommerce/orders",
        json={
            "auth_token": auth_token,
            "delivery_needed": False,
            "amount_cents": amount_piasters,
            "currency": "EGP",
            "merchant_order_id": merchant_order_id,
            "items": [],
        },
        timeout=15,
    )
    resp.raise_for_status()
    return str(resp.json()["id"])


def _get_payment_key(auth_token: str, order_id: str, amount_piasters: int,
                     billing_data: dict) -> str:
    """Generate a payment key (token) for the iframe/checkout."""
    resp = requests.post(
        "https://accept.paymob.com/api/acceptance/payment_keys",
        json={
            "auth_token": auth_token,
            "amount_cents": amount_piasters,
            "expiration": 3600,
            "order_id": order_id,
            "billing_data": billing_data,
            "currency": "EGP",
            "integration_id": int(PAYMOB_INTEGRATION_ID),
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["token"]


def _verify_hmac(data: dict) -> bool:
    """Verify the Paymob HMAC signature on a webhook callback."""
    if not PAYMOB_HMAC_SECRET:
        logger.warning("PAYMOB_HMAC_SECRET not set — skipping verification")
        return False

    # Paymob specifies these fields in this exact order for HMAC computation
    hmac_fields = [
        "amount_cents", "created_at", "currency", "error_occured",
        "has_parent_transaction", "id", "integration_id",
        "is_3d_secure", "is_auth", "is_capture", "is_refunded",
        "is_standalone_payment", "is_voided", "order",
        "owner", "pending", "source_data.pan", "source_data.sub_type",
        "source_data.type", "success",
    ]

    obj = data.get("obj", data)

    def _get_nested(d, key):
        keys = key.split(".")
        val = d
        for k in keys:
            if isinstance(val, dict):
                val = val.get(k, "")
            else:
                return ""
        return str(val).lower() if isinstance(val, bool) else str(val)

    concatenated = "".join(_get_nested(obj, field) for field in hmac_fields)
    computed = hmac.new(
        PAYMOB_HMAC_SECRET.encode(),
        concatenated.encode(),
        hashlib.sha512,
    ).hexdigest()

    received_hmac = data.get("hmac", "")
    return hmac.compare_digest(computed, received_hmac)


@router.post("/paymob/initiate")
async def initiate_payment(body: PaymentInitiateBody):
    """Create a Paymob payment order and return the checkout URL."""
    if body.plan not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail="Plan must be 'pro' or 'elite'")
    if body.billing_cycle not in ("monthly", "annual"):
        raise HTTPException(status_code=400, detail="billing_cycle must be 'monthly' or 'annual'")
    if not PAYMOB_API_KEY:
        raise HTTPException(status_code=503, detail="Payment service not configured")

    amount = PLAN_PRICES[body.plan][body.billing_cycle]
    merchant_order_id = f"aura_{body.user_id}_{body.plan}_{body.billing_cycle}_{int(datetime.now(timezone.utc).timestamp())}"

    try:
        auth_token = _get_paymob_auth_token()
        order_id = _create_paymob_order(auth_token, amount, merchant_order_id)

        # Store order ID for reconciliation
        set_paymob_order_id(body.user_id, order_id)

        # Get user info for billing data
        settings = get_user_settings(body.user_id)
        name = (settings or {}).get("name", "Aura User") or "Aura User"

        billing_data = {
            "first_name": name.split()[0] if name else "Aura",
            "last_name": name.split()[-1] if name and len(name.split()) > 1 else "User",
            "email": "user@aurabot.website",
            "phone_number": "01000000000",
            "apartment": "NA", "floor": "NA", "street": "NA",
            "building": "NA", "shipping_method": "NA",
            "postal_code": "NA", "city": "Cairo",
            "country": "EG", "state": "Cairo",
        }

        payment_key = _get_payment_key(auth_token, order_id, amount, billing_data)
        payment_url = f"https://accept.paymob.com/api/acceptance/iframes/{PAYMOB_IFRAME_ID}?payment_token={payment_key}"

        return {"payment_url": payment_url, "order_id": order_id}

    except requests.RequestException as e:
        logger.error(f"Paymob API error: {e}")
        raise HTTPException(status_code=502, detail="Payment gateway error")


@router.post("/paymob/webhook")
async def paymob_webhook(request: Request):
    """
    Receive Paymob transaction callback.
    Paymob always expects a 200 response.
    """
    try:
        data = await request.json()
    except Exception:
        return {"status": "ok"}

    # Verify HMAC signature
    if not _verify_hmac(data):
        logger.warning("Paymob webhook HMAC verification failed")
        return {"status": "ok"}

    obj = data.get("obj", data)
    success = obj.get("success", False)
    order_id = str(obj.get("order", {}).get("id", "") if isinstance(obj.get("order"), dict) else obj.get("order", ""))

    if not success:
        logger.info(f"Paymob payment failed for order {order_id}")
        return {"status": "ok"}

    # Find user by paymob_order_id
    merchant_order_id = obj.get("order", {}).get("merchant_order_id", "") if isinstance(obj.get("order"), dict) else ""

    # Parse plan and billing cycle from merchant_order_id: aura_{user_id}_{plan}_{cycle}_{ts}
    parts = merchant_order_id.split("_") if merchant_order_id else []
    if len(parts) >= 4:
        user_id = parts[1]
        plan = parts[2]
        billing_cycle = parts[3]
    else:
        # Fallback: find user by order_id in DB
        logger.warning(f"Could not parse merchant_order_id: {merchant_order_id}")
        session = Session()
        try:
            us = session.query(UserSettings).filter_by(paymob_order_id=order_id).first()
            if us:
                user_id = us.telegram_user_id
                plan = "pro"  # default assumption
                billing_cycle = "monthly"
            else:
                logger.error(f"No user found for Paymob order {order_id}")
                return {"status": "ok"}
        finally:
            session.close()

    if plan not in ("pro", "elite"):
        plan = "pro"

    days = PLAN_DAYS.get(billing_cycle, 30)

    # Upgrade user
    upgraded = upgrade_user_plan(user_id, plan, days)
    if upgraded:
        plan_label = "Pro" if plan == "pro" else "Elite"
        renew_date = (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%B %d, %Y")
        send_telegram_message(
            user_id,
            f"✅ You're now on Aura {plan_label}! All features unlocked.\n"
            f"Your subscription renews on {renew_date}."
        )
        logger.info(f"User {user_id} upgraded to {plan} ({billing_cycle})")
    else:
        logger.error(f"Failed to upgrade user {user_id} to {plan}")

    return {"status": "ok"}
