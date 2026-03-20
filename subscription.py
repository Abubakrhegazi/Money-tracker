"""
Subscription plan enforcement for FastAPI endpoints and Telegram bot handlers.

Usage (FastAPI):
    @app.get("/investments")
    async def get_investments(user=Depends(get_current_user), _=Depends(require_plan("pro"))):
        ...

Usage (Telegram bot):
    if not check_plan(user_id, "pro"):
        await send_upgrade_message(update, "pro")
        return
"""
import logging
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import user_has_plan, PLAN_HIERARCHY

logger = logging.getLogger(__name__)

PLAN_NAMES = {"free": "Free", "pro": "Pro", "elite": "Elite"}
UPGRADE_URL = "https://aurabot.website/upgrade"


def require_plan(min_plan: str):
    """
    FastAPI dependency that enforces a minimum subscription plan.

    Usage: Depends(require_plan("pro"))

    Raises HTTP 403 with a structured JSON response if the user doesn't meet
    the plan requirement. The response includes upgrade info for the frontend.
    """
    from api import get_current_user

    async def _check(request: Request, user=Depends(get_current_user)):
        user_id = user["sub"]
        if not user_has_plan(user_id, min_plan):
            plan_label = PLAN_NAMES.get(min_plan, min_plan.title())
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "plan_required",
                    "required_plan": min_plan,
                    "message": f"This feature requires Aura {plan_label}.",
                    "upgrade_url": UPGRADE_URL,
                },
            )
    return _check


def check_plan(user_id: str, min_plan: str) -> bool:
    """
    Simple boolean check for Telegram bot handlers.
    Returns True if the user meets the minimum plan requirement.
    """
    return user_has_plan(user_id, min_plan)


async def send_upgrade_message(update, min_plan: str = "pro"):
    """Send a Telegram upgrade prompt when a Free user tries a gated feature."""
    plan_label = PLAN_NAMES.get(min_plan, min_plan.title())
    await update.message.reply_text(
        f"⭐ This feature is available on Aura {plan_label}.\n"
        f"Upgrade at {UPGRADE_URL} — first 7 days free!"
    )


def send_upgrade_message_sync(chat_id: str, min_plan: str = "pro") -> bool:
    """Send upgrade prompt via Telegram Bot API (for use outside async context)."""
    from notifications import send_telegram_message
    plan_label = PLAN_NAMES.get(min_plan, min_plan.title())
    return send_telegram_message(
        chat_id,
        f"⭐ This feature is available on Aura {plan_label}.\n"
        f"Upgrade at {UPGRADE_URL} — first 7 days free!"
    )
