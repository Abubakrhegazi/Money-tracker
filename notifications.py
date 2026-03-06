"""
Notification engine — generates daily/weekly spending summaries and sends them via Telegram.

Runs as hourly jobs inside APScheduler, embedded in the Telegram bot process (main.py).
"""
import os
import traceback
from datetime import datetime, timedelta
from collections import Counter

import pytz
import requests
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
CATEGORY_EMOJI = {
    "food": "🍔", "transport": "🚗", "shopping": "🛍️",
    "bills": "📄", "entertainment": "🎬", "health": "💊",
    "education": "📚", "other": "📦",
    "salary": "💵", "freelance": "💻", "gift": "🎁",
    "refund": "🔄", "investment": "📈", "other_income": "💰",
}

# ── Telegram send (standalone, no bot context) ──────────────────────────

def send_telegram_message(chat_id: str, text: str, parse_mode: str = "Markdown") -> bool:
    """Send a message via Telegram Bot API. Returns True on success."""
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        resp = requests.post(url, json={
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
        }, timeout=10)
        if resp.status_code == 200:
            return True
        print(f"[NOTIFY] Telegram send failed for {chat_id}: {resp.status_code} {resp.text}")
        return False
    except Exception as e:
        print(f"[NOTIFY] Telegram send error for {chat_id}: {e}")
        return False

# ── Summary generators ──────────────────────────────────────────────────

def generate_daily_summary(user_id: str, user_tz: pytz.BaseTzInfo) -> str | None:
    """Generate a daily spending summary message. Returns None if no transactions."""
    from database import get_daily_transactions, get_budget

    now_local = datetime.now(user_tz)
    today_utc = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    transactions = get_daily_transactions(user_id, today_utc)
    if not transactions:
        return (
            f"📊 *Daily Summary — {now_local.strftime('%A, %b %d')}*\n\n"
            "No transactions logged today 👍\n"
            "Send a message to track your spending!"
        )

    expenses = [t for t in transactions if (t.entry_type or "expense") == "expense"]
    incomes  = [t for t in transactions if (t.entry_type or "expense") == "income"]

    total_spent  = sum(e.amount for e in expenses)
    total_income = sum(e.amount for e in incomes)

    # Category breakdown (expenses only)
    by_category: dict[str, float] = {}
    for e in expenses:
        cat = e.category or "other"
        by_category[cat] = by_category.get(cat, 0) + e.amount

    msg = (
        f"📊 *Daily Summary — {now_local.strftime('%A, %b %d')}*\n\n"
        f"💸 Spent today: *{total_spent:,.0f} EGP*\n"
        f"💰 Income today: *{total_income:,.0f} EGP*\n"
        f"📂 Transactions: {len(transactions)}\n"
    )

    if by_category:
        msg += "\n📂 *By Category:*\n"
        for cat, amount in sorted(by_category.items(), key=lambda x: x[1], reverse=True):
            emoji = CATEGORY_EMOJI.get(cat, "📦")
            msg += f"  {emoji} {cat.capitalize()}: {amount:,.0f} EGP\n"

    # Budget alerts
    budgets = get_budget(user_id)
    if budgets:
        msg += "\n"
        from database import get_category_spending_this_month
        for cat, budget_limit in budgets.items():
            cat_spent = get_category_spending_this_month(user_id, cat)
            pct = (cat_spent / budget_limit * 100) if budget_limit > 0 else 0
            if pct >= 100:
                over_by = cat_spent - budget_limit
                msg += f"⚠️ {cat.capitalize()} budget exceeded by {over_by:,.0f} EGP\n"
            elif pct >= 80:
                msg += f"🔔 {cat.capitalize()}: {cat_spent:,.0f}/{budget_limit:,.0f} EGP ({pct:.0f}% used)\n"
            else:
                msg += f"✅ {cat.capitalize()}: {cat_spent:,.0f}/{budget_limit:,.0f} EGP ({pct:.0f}% used)\n"

    return msg


def generate_weekly_summary(user_id: str, user_tz: pytz.BaseTzInfo) -> str | None:
    """Generate a weekly spending summary message."""
    from database import get_weekly_transactions, get_budget

    now_local = datetime.now(user_tz)
    # Last 7 days
    end_utc   = datetime.utcnow()
    start_utc = end_utc - timedelta(days=7)
    prev_start = start_utc - timedelta(days=7)

    transactions = get_weekly_transactions(user_id, start_utc, end_utc)
    if not transactions:
        return (
            f"📊 *Weekly Summary — {(now_local - timedelta(days=7)).strftime('%b %d')} to {now_local.strftime('%b %d')}*\n\n"
            "No transactions this week 👍"
        )

    expenses = [t for t in transactions if (t.entry_type or "expense") == "expense"]
    incomes  = [t for t in transactions if (t.entry_type or "expense") == "income"]

    total_spent  = sum(e.amount for e in expenses)
    total_income = sum(e.amount for e in incomes)
    net = total_income - total_spent
    net_emoji = "✅" if net >= 0 else "🔴"

    # Category breakdown
    by_category: dict[str, float] = {}
    for e in expenses:
        cat = e.category or "other"
        by_category[cat] = by_category.get(cat, 0) + e.amount

    msg = (
        f"📊 *Weekly Summary — {(now_local - timedelta(days=7)).strftime('%b %d')} to {now_local.strftime('%b %d')}*\n\n"
        f"💸 Total spent: *{total_spent:,.0f} EGP*\n"
        f"💰 Total income: *{total_income:,.0f} EGP*\n"
        f"💵 Net: *{net:+,.0f} EGP* {net_emoji}\n"
        f"📂 Transactions: {len(transactions)}\n"
    )

    if by_category:
        msg += "\n📂 *By Category:*\n"
        for cat, amount in sorted(by_category.items(), key=lambda x: x[1], reverse=True):
            emoji = CATEGORY_EMOJI.get(cat, "📦")
            msg += f"  {emoji} {cat.capitalize()}: {amount:,.0f} EGP\n"

    # Top merchant
    merchants = [e.merchant for e in expenses if e.merchant]
    if merchants:
        top_merchant, count = Counter(merchants).most_common(1)[0]
        msg += f"\n🏪 Top merchant: {top_merchant} ({count}x)\n"

    # Biggest spending day
    day_totals: dict[str, float] = {}
    for e in expenses:
        day_key = e.created_at.strftime("%A") if e.created_at else "Unknown"
        day_totals[day_key] = day_totals.get(day_key, 0) + e.amount
    if day_totals:
        biggest_day = max(day_totals, key=day_totals.get)
        msg += f"📅 Biggest spending day: {biggest_day} ({day_totals[biggest_day]:,.0f} EGP)\n"

    # Vs last week
    prev_transactions = get_weekly_transactions(user_id, prev_start, start_utc)
    prev_expenses = [t for t in prev_transactions if (t.entry_type or "expense") == "expense"]
    prev_spent = sum(e.amount for e in prev_expenses)
    prev_incomes = [t for t in prev_transactions if (t.entry_type or "expense") == "income"]
    prev_income = sum(e.amount for e in prev_incomes)

    msg += "\n*vs Last Week:*\n"
    if prev_spent > 0:
        pct_change = ((total_spent - prev_spent) / prev_spent) * 100
        if pct_change > 5:
            msg += f"  💸 Spent: ↑ {pct_change:.0f}% more than last week\n"
        elif pct_change < -5:
            msg += f"  💸 Spent: ↓ {abs(pct_change):.0f}% less than last week\n"
        else:
            msg += "  💸 Spent: → similar to last week\n"
    else:
        msg += "  💸 No spending data from last week\n"

    if prev_income > 0:
        inc_change = ((total_income - prev_income) / prev_income) * 100
        if inc_change > 5:
            msg += f"  💰 Income: ↑ {inc_change:.0f}% more than last week\n"
        elif inc_change < -5:
            msg += f"  💰 Income: ↓ {abs(inc_change):.0f}% less than last week\n"
        else:
            msg += "  💰 Income: → same as last week\n"

    return msg


# ── Scheduler jobs ──────────────────────────────────────────────────────

def run_daily_check():
    """Hourly job: check each user's preferred time and send daily summary if due."""
    from database import get_all_notification_users, mark_notification_sent, increment_notification_failure, is_new_user

    print("[SCHEDULER] Running daily notification check...")
    users = get_all_notification_users()

    for u in users:
        if not u["daily_enabled"]:
            continue
        try:
            tz = pytz.timezone(u["timezone"])
        except pytz.UnknownTimeZoneError:
            tz = pytz.timezone("Africa/Cairo")

        now_local = datetime.now(tz)
        # Parse preferred time
        try:
            pref_hour, pref_min = map(int, u["daily_time"].split(":"))
        except (ValueError, AttributeError):
            pref_hour, pref_min = 22, 0

        # Only send if current hour matches preferred hour
        if now_local.hour != pref_hour:
            continue

        # Check if already sent today
        if u["last_sent_daily"]:
            last_local = u["last_sent_daily"].replace(tzinfo=pytz.utc).astimezone(tz)
            if last_local.date() == now_local.date():
                continue

        # Skip brand-new users (registered today)
        if is_new_user(u["user_id"]):
            continue

        # Generate and send
        try:
            summary = generate_daily_summary(u["user_id"], tz)
            if summary:
                success = send_telegram_message(u["user_id"], summary)
                if success:
                    mark_notification_sent(u["user_id"], "daily")
                    print(f"[NOTIFY] Daily summary sent to {u['user_id']}")
                else:
                    increment_notification_failure(u["user_id"])
        except Exception as e:
            print(f"[NOTIFY] Error sending daily to {u['user_id']}: {e}")
            traceback.print_exc()
            increment_notification_failure(u["user_id"])


def run_weekly_check():
    """Hourly job: check each user's preferred day/time and send weekly summary if due."""
    from database import get_all_notification_users, mark_notification_sent, increment_notification_failure, is_new_user

    print("[SCHEDULER] Running weekly notification check...")
    users = get_all_notification_users()

    for u in users:
        if not u["weekly_enabled"]:
            continue
        try:
            tz = pytz.timezone(u["timezone"])
        except pytz.UnknownTimeZoneError:
            tz = pytz.timezone("Africa/Cairo")

        now_local = datetime.now(tz)
        # Python weekday: Mon=0, Sun=6. User spec: 0=Sunday.
        # Convert: user_day 0(Sun) -> python 6, user_day 1(Mon) -> python 0
        python_weekday = (u["weekly_day"] - 1) % 7 if u["weekly_day"] > 0 else 6

        if now_local.weekday() != python_weekday:
            continue

        # Parse preferred time (reuse daily_time for weekly)
        try:
            pref_hour, _ = map(int, u["daily_time"].split(":"))
        except (ValueError, AttributeError):
            pref_hour = 22

        if now_local.hour != pref_hour:
            continue

        # Check if already sent this week
        if u["last_sent_weekly"]:
            last_local = u["last_sent_weekly"].replace(tzinfo=pytz.utc).astimezone(tz)
            days_since = (now_local.date() - last_local.date()).days
            if days_since < 6:
                continue

        if is_new_user(u["user_id"]):
            continue

        try:
            summary = generate_weekly_summary(u["user_id"], tz)
            if summary:
                success = send_telegram_message(u["user_id"], summary)
                if success:
                    mark_notification_sent(u["user_id"], "weekly")
                    print(f"[NOTIFY] Weekly summary sent to {u['user_id']}")
                else:
                    increment_notification_failure(u["user_id"])
        except Exception as e:
            print(f"[NOTIFY] Error sending weekly to {u['user_id']}: {e}")
            traceback.print_exc()
            increment_notification_failure(u["user_id"])
