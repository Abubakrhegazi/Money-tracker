# Environment Variables

All required environment variables for the MoneyBot application.

## Required

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token from @BotFather |
| `GROQ_API_KEY` | Groq API key for AI transaction parsing |
| `DATABASE_URL` | PostgreSQL connection string (Railway auto-sets this) |
| `JWT_SECRET` | Secret key for signing JWT auth tokens (min 32 chars) |

## Optional

| Variable | Default | Description |
|---|---|---|
| `ADMIN_JWT_SECRET` | auto-generated | Separate secret for admin JWT tokens |
| `ADMIN_USERNAME` | `admin` | Admin panel login username |
| `ADMIN_PASSWORD_HASH` | _(empty)_ | bcrypt hash of admin password |
| `ADMIN_TOTP_SECRET` | _(empty)_ | TOTP secret for admin 2FA |
| `ADMIN_SESSION_EXPIRY` | `1800` | Admin session TTL in seconds |
| `INTERNAL_API_KEY` | _(empty)_ | API key for bot→API internal calls |
| `WHATSAPP_TOKEN` | _(empty)_ | WhatsApp Business API token |
| `META_VERIFY_TOKEN` | _(empty)_ | Meta webhook verification token |
| `FRONTEND_URL` | `https://aurabot.website` | Dashboard URL (used in bot links) |
| `R2_ACCOUNT_ID` | _(empty)_ | Cloudflare R2 account ID (for DB backups) |
| `R2_ACCESS_KEY_ID` | _(empty)_ | R2 API access key |
| `R2_SECRET_ACCESS_KEY` | _(empty)_ | R2 API secret key |
| `R2_BUCKET` | `wallet-backups` | R2 bucket name |
| `BACKUP_RETENTION_DAYS` | `30` | Days to keep old backups |

## Generating Secrets

```bash
# Generate a secure JWT secret
python -c "import secrets; print(secrets.token_hex(32))"

# Generate an admin password hash
python -c "import bcrypt; print(bcrypt.hashpw(b'your-password', bcrypt.gensalt()).decode())"
```
