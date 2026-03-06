# Aura — AI Finance Tracker

> Track your spending with a voice note. No apps, no spreadsheets. Just message the Telegram bot and let Aura do the rest.

**[Try it on Telegram →](https://t.me/walletTrackinggBot)**

---

## What is Aura?

Aura is a personal finance tracker that lives inside Telegram. Send a voice note or a text message like *"spent 150 on lunch"* and Aura transcribes, categorizes, and saves it automatically using AI. A web dashboard gives you charts, trends, and full history.

---

## Features

- **Voice & text logging** — send a voice note or text message to log any transaction instantly
- **AI categorization** — Groq (Llama + Whisper) extracts amount, category, merchant, and type from natural language
- **Income & expenses** — tracks both spending and income in one place
- **Budget alerts** — set per-category budgets and get notified when you're close to the limit
- **Daily & weekly summaries** — automated Telegram notifications with spending breakdowns
- **Web dashboard** — charts, monthly trends, transaction history, and budget management
- **Admin panel** — user management, audit log, global stats, and CSV exports
- **Automated DB backups** — nightly pg_dump to Cloudflare R2 with 30-day retention

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Telegram Bot   │────▶│   FastAPI API    │────▶│   PostgreSQL    │
│   (main.py)     │     │    (api.py)      │     │   (Railway)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        │ Groq API               │ JWT Auth               │ Backups
        │ (Whisper + Llama)      │                        ▼
        ▼                        ▼               ┌─────────────────┐
  Voice/Text NLP          Next.js Dashboard      │  Cloudflare R2  │
                          (Vercel)               └─────────────────┘
```

| Layer | Tech |
|---|---|
| Telegram bot | `python-telegram-bot`, APScheduler |
| AI parsing | Groq — `whisper-large-v3` (voice), `llama-3.1-8b-instant` (text) |
| API | FastAPI, SQLAlchemy, `python-jose`, slowapi |
| Database | PostgreSQL (Railway) / SQLite (local dev) |
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Magic UI |
| Backups | boto3 → Cloudflare R2 |

---

## Project Structure

```
MoneyBot/
├── main.py              # Telegram bot — message handlers, commands
├── api.py               # FastAPI REST API for the dashboard
├── admin_api.py         # Admin panel endpoints (mounted at /admin)
├── database.py          # SQLAlchemy models and all DB operations
├── notifications.py     # Daily/weekly summary generator and sender
├── backup.py            # pg_dump → gzip → Cloudflare R2
├── requirements.txt
├── ENV.md               # Full env var reference
└── dashboard/           # Next.js frontend
    ├── app/
    │   ├── page.tsx         # Landing page
    │   ├── dashboard/       # Main dashboard
    │   ├── auth/            # Telegram auth callback
    │   └── admin/           # Admin panel
    └── components/
```

---

## Bot Commands

| Command | Description |
|---|---|
| Just type/speak | Log an expense or income |
| `/summary` | Monthly spending overview with category breakdown |
| `/history` | Last 10 transactions with edit/delete buttons |
| `/budget food 3000` | Set a monthly budget for a category |
| `/budget` | View all budgets with progress bars |
| `/dashboard` | Get a one-time login link to the web dashboard |
| `/notifications` | Configure daily/weekly summary timing |
| `/deleteaccount` | Permanently delete all your data |
| `/help` | Full command reference |

**Example messages the bot understands:**
- `"spent 150 on lunch"`
- `"paid 500 for Uber"`
- `"received 5000 salary"`
- Voice notes in English or Arabic

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A [Groq API key](https://console.groq.com)

### Backend

```bash
# Clone and install
git clone https://github.com/your-username/MoneyBot.git
cd MoneyBot
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your keys (see ENV.md)

# Run the bot
python main.py

# Run the API (separate terminal)
uvicorn api:app --reload --port 8000
```

### Frontend

```bash
cd dashboard
npm install
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# Open http://localhost:3000
```

---

## Environment Variables

See [ENV.md](ENV.md) for the full reference. Minimum required to run:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
GROQ_API_KEY=your_groq_key
DATABASE_URL=postgresql://...      # or omit for SQLite in dev
JWT_SECRET=your_32_char_secret
```

Generate secrets:
```bash
# JWT secret
python -c "import secrets; print(secrets.token_hex(32))"

# Admin password hash
python -c "import bcrypt; print(bcrypt.hashpw(b'your-password', bcrypt.gensalt()).decode())"
```

---

## Deployment

### Backend (Railway)

1. Connect repo to [Railway](https://railway.app)
2. Add a PostgreSQL plugin — `DATABASE_URL` is set automatically
3. Set all required env vars in Railway dashboard
4. Set start command: `python main.py` (bot) and `uvicorn api:app --host 0.0.0.0 --port $PORT` (API)

### Frontend (Vercel)

1. Import the `dashboard/` folder into [Vercel](https://vercel.com)
2. Set `NEXT_PUBLIC_API_URL` to your Railway API URL

---

## Supported Transaction Categories

**Expenses:** `food` · `transport` · `shopping` · `bills` · `entertainment` · `health` · `education` · `other`

**Income:** `salary` · `freelance` · `gift` · `refund` · `investment` · `other_income`

---

## License

MIT
