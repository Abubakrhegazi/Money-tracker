"""
Centralized configuration — all environment variables in one place.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── Database ─────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///spending_tracker.db")

# ── Telegram ─────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

# ── JWT ──────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "")

# ── Internal API ─────────────────────────────────────────────────────────
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")

# ── Admin ────────────────────────────────────────────────────────────────
ADMIN_JWT_SECRET = os.getenv("ADMIN_JWT_SECRET", "")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")
ADMIN_SESSION_EXPIRY = int(os.getenv("ADMIN_SESSION_EXPIRY", "1800"))
ADMIN_SECRET = os.getenv("ADMIN_SECRET", "")

# ── Paymob ───────────────────────────────────────────────────────────────
PAYMOB_API_KEY = os.getenv("PAYMOB_API_KEY", "")
PAYMOB_INTEGRATION_ID = os.getenv("PAYMOB_INTEGRATION_ID", "")
PAYMOB_IFRAME_ID = os.getenv("PAYMOB_IFRAME_ID", "")
PAYMOB_HMAC_SECRET = os.getenv("PAYMOB_HMAC_SECRET", "")

# ── Frontend ─────────────────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://aurabot.website")

# ── Cloudflare R2 (backup) ──────────────────────────────────────────────
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET = os.getenv("R2_BUCKET", "wallet-backups")
BACKUP_RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))

# ── Gold API ─────────────────────────────────────────────────────────────
GOLD_API_KEY = os.getenv("GOLD_API_KEY", "")

# WAVE 2: WhatsApp — env vars removed for MVP (VERIFY_TOKEN, WHATSAPP_TOKEN,
# WHATSAPP_PHONE_NUMBER_ID, META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID, META_VERIFY_TOKEN)

# ── Groq AI ──────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# ── Admin Telegram ───────────────────────────────────────────────────────
# Your personal Telegram chat ID — receives forwarded payment screenshots
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID", "")

# ── Misc ─────────────────────────────────────────────────────────────────
API_URL = os.getenv("API_URL")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "https://moneybot-beta.vercel.app")
PORT = int(os.getenv("PORT", "5000"))
