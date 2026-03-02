import os
import sys
import json
import logging
import traceback
import requests
from flask import Flask, request, jsonify
from groq import Groq
from dotenv import load_dotenv
from database import (
    init_db, save_expense, get_monthly_summary_sync,
    resolve_link_token, get_primary_id, get_recent_expenses,
    delete_expense, set_budget, get_budget,
    get_category_spending_this_month, Session, Expense,
    save_pending, get_pending, delete_pending, is_new_user
)
from collections import defaultdict
from time import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

META_TOKEN = os.getenv("META_WHATSAPP_TOKEN")
PHONE_NUMBER_ID = os.getenv("META_PHONE_NUMBER_ID")
VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN")
API_URL_META = f"https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages"

# Rate limiter
_rate_buckets: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT = 10
RATE_WINDOW = 60

def is_rate_limited(user_id: str) -> bool:
    now = time()
    _rate_buckets[user_id] = [t for t in _rate_buckets[user_id] if now - t < RATE_WINDOW]
    if len(_rate_buckets[user_id]) >= RATE_LIMIT:
        return True
    _rate_buckets[user_id].append(now)
    return False

CATEGORY_EMOJI = {
    "food": "🍔", "transport": "🚗", "shopping": "🛍️",
    "bills": "📄", "entertainment": "🎬", "health": "💊", "other": "📦",
    "salary": "💵", "freelance": "💻", "gift": "🎁", "refund": "🔄",
    "investment": "📈", "other_income": "💰"
}

CATEGORIES = ["food", "transport", "shopping", "bills", "entertainment", "health", "other"]
INCOME_CATEGORIES = ["salary", "freelance", "gift", "refund", "investment", "other_income"]

import re

_GREETING_PATTERNS = re.compile(
    r'^\s*(hi|hello|hey|yo|sup|hola|morning|good\s*(morning|evening|afternoon|night)|'
    r'مرحبا|اهلا|هاي|صباح|مساء|السلام|سلام|ازيك|عامل|كيف|شكرا|thanks|thank you|bye|cool|nice|great|lol|haha|wow)\s*[!?.]*\s*$',
    re.IGNORECASE
)

_CANCEL_WORDS = {'cancel', 'nevermind', 'never mind', 'stop', 'undo', 'nope', 'nah', 'الغي', 'لا'}

def is_greeting(text: str) -> bool:
    """Fast check: is this a greeting/chitchat with no financial content?"""
    if _GREETING_PATTERNS.match(text):
        return True
    # If the message has no digits at all and is short, it's likely chitchat
    if len(text) < 30 and not re.search(r'\d', text):
        # But NOT if it's a cancel/confirm word
        lower = text.strip().lower()
        if lower in _CANCEL_WORDS or lower in {'yes', 'y', 'no', 'n', 'ok', 'okay', 'yep', 'nah'}:
            return False
        financial_kw = re.compile(
            r'(spent|paid|bought|cost|received|earned|salary|مرتب|صرفت|دفعت|اشتريت|استلمت|جالي|الف|مية)',
            re.IGNORECASE
        )
        if not financial_kw.search(text):
            return True
    return False

def is_cancel(text: str) -> bool:
    """Check if user wants to cancel."""
    return text.strip().lower() in _CANCEL_WORDS

# Message dedup — Meta sometimes sends the same webhook twice
_processed_messages: dict[str, float] = {}
MSG_DEDUP_WINDOW = 30  # seconds


def cat_emoji(category: str) -> str:
    return CATEGORY_EMOJI.get(category, "📦")

def type_emoji(entry_type: str) -> str:
    return "📥" if entry_type == "income" else "📤"


# ── Messaging ─────────────────────────────────────────────────────────────────

def send_message(to: str, body: str):
    resp = requests.post(API_URL_META, headers={
        "Authorization": f"Bearer {META_TOKEN}",
        "Content-Type": "application/json"
    }, json={
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": body}
    })
    if resp.status_code != 200:
        logger.error(f"Meta API error {resp.status_code}: {resp.text}")


def send_buttons(to: str, body: str, buttons: list):
    """Max 3 buttons. buttons = [{'id': '...', 'title': '...'}]"""
    resp = requests.post(API_URL_META, headers={
        "Authorization": f"Bearer {META_TOKEN}",
        "Content-Type": "application/json"
    }, json={
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": body},
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": b["id"], "title": b["title"]}}
                    for b in buttons
                ]
            }
        }
    })
    if resp.status_code != 200:
        logger.error(f"Meta buttons error {resp.status_code}: {resp.text}")
        # Fallback to plain text if buttons fail
        send_message(to, body + "\n\nReply *yes* to save, *no* to cancel, or tell me what to correct.")


def send_list(to: str, body: str, button_label: str, sections: list):
    resp = requests.post(API_URL_META, headers={
        "Authorization": f"Bearer {META_TOKEN}",
        "Content-Type": "application/json"
    }, json={
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "body": {"text": body},
            "action": {
                "button": button_label,
                "sections": sections
            }
        }
    })
    if resp.status_code != 200:
        logger.error(f"Meta list error {resp.status_code}: {resp.text}")


def send_transaction_confirmation(to: str, txn: dict, prefix: str = ""):
    """Send transaction summary with Save / Edit / Cancel buttons."""
    etype = txn.get("type", "expense")
    lines = []
    if prefix:
        lines.append(prefix)
        lines.append("")
    lines += [
        f"{type_emoji(etype)} {etype.upper()}",
        f"💰 {txn['amount']} {txn.get('currency', 'EGP')}",
        f"📂 {txn.get('category', 'other')}",
        f"🏪 {txn.get('merchant') or 'N/A'}",
    ]
    send_buttons(to, "\n".join(lines), [
        {"id": "txn_confirm", "title": "✅ Save"},
        {"id": "txn_edit",    "title": "✏️ Edit"},
        {"id": "txn_cancel",  "title": "❌ Cancel"},
    ])


# ── AI helpers ────────────────────────────────────────────────────────────────

def extract_transaction(transcript: str) -> dict:
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{
            "role": "system",
            "content": """You are a financial transaction parser. Your ONLY job is to extract transaction data from messages that CLEARLY describe spending or receiving money.

CRITICAL RULES:
1. The message MUST contain a specific monetary amount (a number). If there is NO number/amount, return {"error": "not_a_transaction"}
2. Greetings, questions, small talk, or vague statements are NOT transactions. Return {"error": "not_a_transaction"}
3. The merchant field should ONLY be a real business/store/person name mentioned in the text. If none is mentioned, set merchant to null. Do NOT use random words as merchant.
4. "hello", "hi", "hey", "good morning", etc. are NEVER transactions.

INCOME keywords: received, earned, got paid, salary, مرتب, استلمت, جالي, اتحوللي, refund, freelance, gift
EXPENSE keywords: spent, paid, bought, cost, صرفت, دفعت, اشتريت, على

Return ONLY this JSON:
{
  "type": "income" or "expense",
  "amount": <number — MUST be a real number, never null>,
  "currency": <"EGP" if not mentioned>,
  "category": <for expenses: food|transport|shopping|bills|entertainment|health|other>,
             <for income: salary|freelance|gift|refund|investment|other_income>,
  "merchant": <real business/person name or null>,
  "date": <"today" if not mentioned>
}
Arabic numbers: الف=1000, مية=100, combinations add together.
If NOT a clear financial transaction with a specific amount, return {"error": "not_a_transaction"}"""
        }, {"role": "user", "content": transcript}],
        response_format={"type": "json_object"}
    )
    result = json.loads(response.choices[0].message.content)
    # Post-parse validation: reject if amount is missing/invalid
    if "error" not in result:
        amount = result.get("amount")
        if amount is None or amount == 0 or not isinstance(amount, (int, float)):
            return {"error": "no_amount"}
    return result


def apply_correction(original: dict, correction: str) -> dict:
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": """Apply the user's correction to the transaction JSON and return updated JSON only.
Keep unchanged fields. Return ONLY valid JSON: type, amount, currency, category, merchant, date."""
            },
            {
                "role": "user",
                "content": f"Existing: {json.dumps(original)}\nCorrection: {correction}"
            }
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)


def transcribe_audio(audio_url: str) -> str:
    response = requests.get(audio_url, headers={"Authorization": f"Bearer {META_TOKEN}"})
    file_path = "whatsapp_audio.ogg"
    with open(file_path, "wb") as f:
        f.write(response.content)
    with open(file_path, "rb") as f:
        transcription = groq_client.audio.transcriptions.create(
            model="whisper-large-v3", file=f
        )
    os.remove(file_path)
    return transcription.text


def create_login_token(phone: str) -> str:
    api_url = os.getenv("API_URL")
    response = requests.post(f"{api_url}/auth/whatsapp-token?phone={phone}")
    data = response.json()
    if "token" not in data:
        raise Exception(f"Failed to create token: {data}")
    return data["token"]


def check_budget_alert(user_id: str, category: str, new_amount: float) -> str:
    budgets = get_budget(user_id)
    if category not in budgets:
        return ""
    budget = budgets[category]
    spent = get_category_spending_this_month(user_id, category) + new_amount
    pct = (spent / budget) * 100
    if pct >= 100:
        return (f"\n\n⚠️ Budget Alert! You've spent {spent:,.0f} EGP on {category} "
                f"({pct:.0f}% of your {budget:,.0f} EGP budget) 🔴")
    elif pct >= 80:
        return (f"\n\n⚠️ Budget Warning! {spent:,.0f}/{budget:,.0f} EGP on {category} "
                f"({pct:.0f}%). Only {budget-spent:,.0f} EGP left 🟡")
    return ""


# ── Command handlers ──────────────────────────────────────────────────────────

def handle_help(phone: str):
    send_message(phone,
        "💰 *Aura Commands*\n\n"
        "Just send a voice note or type to track expenses & income!\n\n"
        "📋 *Commands:*\n"
        "/summary — this month's spending & income\n"
        "/history — last 10 transactions\n"
        "/budget — view & set budgets\n"
        "/login — open dashboard\n"
        "/link <token> — link Telegram account\n"
        "/help — show this message\n\n"
        "💡 *Examples:*\n"
        "• 'spent 150 on lunch'\n"
        "• 'مية وخمسين على أكل'\n"
        "• 'received 5000 salary'\n"
        "• Send a voice note 🎤\n"
        "• Send a receipt photo 📷"
    )


def handle_summary(phone: str):
    user_id = get_primary_id(phone)
    result = get_monthly_summary_sync(user_id)
    if len(result) == 4:
        expense_total, breakdown, count, income_total = result
    else:
        expense_total, breakdown, count = result
        income_total = 0

    budgets = get_budget(user_id)

    if count == 0:
        send_message(phone, "No transactions this month yet!\n\nSend a voice note or type an expense to get started.")
        return

    from datetime import datetime
    net = income_total - expense_total
    net_emoji = "🟢" if net >= 0 else "🔴"

    text = f"📊 Monthly Summary — {datetime.utcnow().strftime('%B %Y')}\n\n"
    if income_total > 0:
        text += f"📥 Income: {income_total:,.0f} EGP\n"
    text += f"📤 Expenses: {expense_total:,.0f} EGP\n"
    if income_total > 0:
        text += f"{net_emoji} Net: {net:+,.0f} EGP\n"
    text += f"🧾 Transactions: {count}\n"

    if breakdown:
        text += "\nExpenses by Category:\n"
        for cat, amount in sorted(breakdown.items(), key=lambda x: x[1], reverse=True):
            pct = (amount / expense_total) * 100 if expense_total > 0 else 0
            line = f"  {cat_emoji(cat)} {cat}: {amount:,.0f} EGP ({pct:.0f}%)"
            if cat in budgets:
                budget = budgets[cat]
                spent_pct = (amount / budget) * 100
                indicator = "🟢" if spent_pct < 80 else ("🟡" if spent_pct < 100 else "🔴")
                line += f" {indicator} of {budget:,.0f}"
            text += line + "\n"

    send_message(phone, text)


def handle_history(phone: str):
    user_id = get_primary_id(phone)
    expenses = get_recent_expenses(user_id, limit=10)

    if not expenses:
        send_message(phone, "No transactions recorded yet!")
        return

    text = "🧾 Last 10 Transactions:\n\n"
    for e in expenses:
        merchant = e.merchant or "N/A"
        etype = getattr(e, "entry_type", None) or "expense"
        icon = "📥" if etype == "income" else "📤"
        text += (f"#{e.id} {icon} {cat_emoji(e.category)} {e.amount:,.0f} {e.currency} "
                 f"— {e.category} | {merchant} | {e.created_at.strftime('%d %b')}\n")

    text += "\nTo delete: /delete <id>\nTo edit: /edit <id>"
    send_message(phone, text)


def handle_delete(phone: str, args: str):
    if not args.strip().isdigit():
        send_message(phone, "Usage: /delete <id>\nExample: /delete 42\n\nUse /history to see IDs.")
        return
    user_id = get_primary_id(phone)
    expense_id = int(args.strip())
    success = delete_expense(user_id, expense_id)
    if success:
        send_message(phone, f"🗑 Transaction #{expense_id} deleted.")
    else:
        send_message(phone, f"❌ Transaction #{expense_id} not found.")


def handle_edit_start(phone: str, args: str):
    if not args.strip().isdigit():
        send_message(phone, "Usage: /edit <id>\nExample: /edit 42\n\nUse /history to see IDs.")
        return
    user_id = get_primary_id(phone)
    expense_id = int(args.strip())
    session = Session()
    expense = session.query(Expense).filter_by(id=expense_id, telegram_user_id=user_id).first()
    session.close()
    if not expense:
        send_message(phone, f"❌ Transaction #{expense_id} not found.")
        return
    exp_data = {
        "amount": expense.amount, "currency": expense.currency,
        "category": expense.category, "merchant": expense.merchant,
        "date": expense.date, "type": getattr(expense, "entry_type", None) or "expense"
    }
    save_pending(phone, exp_data, state="awaiting_edit", context={"editing_id": expense_id})
    send_message(phone,
        f"✏️ Editing #{expense_id}:\n"
        f"💰 {expense.amount:,.0f} {expense.currency} — {expense.category}\n"
        f"🏪 {expense.merchant or 'N/A'}\n\n"
        "What should I change?\n"
        "Example: 'amount is 300' or 'category is transport'"
    )


def handle_budget_view(phone: str):
    user_id = get_primary_id(phone)
    budgets = get_budget(user_id)

    if not budgets:
        send_message(phone,
            "No budgets set yet.\n\n"
            f"Categories: {', '.join(CATEGORIES)}\n\n"
            "Example: /budget food 3000"
        )
        return

    result = get_monthly_summary_sync(user_id)
    breakdown = result[1] if len(result) >= 2 else {}
    text = "🎯 Monthly Budgets:\n\n"
    for cat, budget in budgets.items():
        spent = breakdown.get(cat, 0)
        pct = (spent / budget) * 100
        indicator = "🟢" if pct < 80 else ("🟡" if pct < 100 else "🔴")
        text += f"{indicator} {cat_emoji(cat)} {cat}: {spent:,.0f} / {budget:,.0f} EGP ({pct:.0f}%)\n"
    text += "\nTo update: /budget <category> <amount>\nTo remove: /budget remove <category>"
    send_message(phone, text)


def handle_budget_interactive(phone: str):
    """Show category list for interactive budget setting."""
    send_list(phone,
        "Select a category to set or update its monthly budget:",
        "Choose Category",
        [{
            "title": "Expense Categories",
            "rows": [
                {"id": f"budget_{cat}", "title": f"{cat_emoji(cat)} {cat.capitalize()}"}
                for cat in CATEGORIES
            ]
        }]
    )


def handle_budget_set(phone: str, args: str):
    parts = args.strip().split()
    if len(parts) == 2 and parts[0].lower() == "remove":
        from database import delete_budget
        user_id = get_primary_id(phone)
        category = parts[1].lower()
        if category not in CATEGORIES:
            send_message(phone, f"❌ Unknown category. Options: {', '.join(CATEGORIES)}")
            return
        delete_budget(user_id, category)
        send_message(phone, f"🗑 Budget for {cat_emoji(category)} {category} removed.")
        return
    if len(parts) != 2:
        send_message(phone, f"Usage: /budget <category> <amount>\nExample: /budget food 3000\n\nCategories: {', '.join(CATEGORIES)}")
        return
    category, amount_str = parts[0].lower(), parts[1].replace(",", "")
    if category not in CATEGORIES:
        send_message(phone, f"❌ Unknown category. Options: {', '.join(CATEGORIES)}")
        return
    try:
        amount = float(amount_str)
    except ValueError:
        send_message(phone, "❌ Invalid amount. Example: /budget food 3000")
        return
    user_id = get_primary_id(phone)
    set_budget(user_id, category, amount)
    send_message(phone,
        f"✅ Budget set!\n\n"
        f"{cat_emoji(category)} {category}: {amount:,.0f} EGP/month\n\n"
        f"I'll warn you at 80% and alert you when you exceed it."
    )


# ── Webhook ───────────────────────────────────────────────────────────────────

@app.route("/whatsapp", methods=["GET"])
def verify_webhook():
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")
    if mode == "subscribe" and token == VERIFY_TOKEN:
        return challenge, 200
    return "Forbidden", 403


@app.route("/whatsapp", methods=["POST"])
def webhook():
    data = request.json
    try:
        entry = data["entry"][0]
        changes = entry["changes"][0]
        value = changes["value"]

        if "messages" not in value:
            return jsonify({"status": "ok"}), 200

        message = value["messages"][0]
        from_number = message["from"]
        msg_type = message["type"]

        # Rate limiting
        if is_rate_limited(from_number):
            send_message(from_number, "⏳ Slow down! Try again in a moment.")
            return jsonify({"status": "ok"}), 200

        # Dedup — Meta often fires webhook twice for same message
        msg_id = message.get("id", "")
        now_ts = time()
        if msg_id:
            # Clean old entries
            _processed_messages.update({k: v for k, v in _processed_messages.items() if now_ts - v < MSG_DEDUP_WINDOW})
            if msg_id in _processed_messages:
                return jsonify({"status": "ok"}), 200
            _processed_messages[msg_id] = now_ts

        # Onboarding
        if is_new_user(from_number):
            send_message(from_number,
                "👋 Welcome to *Aura*! Your personal finance tracker.\n\n"
                "Send me a message like:\n"
                "• 'spent 150 on lunch'\n"
                "• 'received 5000 salary'\n"
                "• A voice note 🎤\n"
                "• A receipt photo 📷\n\n"
                "Sending you commands..."
            )
            handle_help(from_number)

        # ── Interactive button/list replies ───────────────────────────
        if msg_type == "interactive":
            interactive_type = message["interactive"]["type"]

            if interactive_type == "button_reply":
                button_id = message["interactive"]["button_reply"]["id"]
                pending = get_pending(from_number)

                if button_id == "txn_confirm" and pending:
                    txn, _state, _ctx = pending
                    # Atomic: only save if WE are the one who deleted the pending
                    if delete_pending(from_number):
                        user_id = get_primary_id(from_number)
                        save_expense(user_id, txn, txn.get("_transcript", ""))
                        etype = txn.get("type", "expense")
                        alert = ""
                        if etype == "expense":
                            alert = check_budget_alert(user_id, txn.get("category", "other"), txn["amount"])
                        send_message(from_number,
                            f"💾 Saved!\n"
                            f"{type_emoji(etype)} {etype.upper()}\n"
                            f"💰 {txn['amount']} {txn.get('currency', 'EGP')} — {txn.get('category', 'other')}\n"
                            f"🏪 {txn.get('merchant') or 'N/A'}"
                            + alert
                        )

                elif button_id == "txn_edit" and pending:
                    txn, _state, _ctx = pending
                    save_pending(from_number, txn, state="awaiting_edit", context={"editing_id": None})
                    send_message(from_number,
                        "✏️ What should I correct?\n\n"
                        "Example: 'amount is 300' or 'category is transport'"
                    )

                elif button_id == "txn_cancel":
                    delete_pending(from_number)
                    send_message(from_number, "❌ Cancelled.")

            elif interactive_type == "list_reply":
                selected_id = message["interactive"]["list_reply"]["id"]
                if selected_id.startswith("budget_"):
                    category = selected_id.replace("budget_", "")
                    save_pending(from_number, {}, state="awaiting_budget_amount",
                                 context={"budget_category": category})
                    send_message(from_number,
                        f"💰 How much is your monthly budget for "
                        f"{cat_emoji(category)} *{category}*?\n\n"
                        "Just type the amount (e.g. 2000)"
                    )

            return jsonify({"status": "ok"}), 200

        # ── Image / Receipt scanning ──────────────────────────────────
        if msg_type == "image":
            send_message(from_number, "📷 Scanning receipt...")
            image_id = message["image"]["id"]
            url_resp = requests.get(
                f"https://graph.facebook.com/v18.0/{image_id}",
                headers={"Authorization": f"Bearer {META_TOKEN}"}
            )
            image_url = url_resp.json()["url"]
            img_data = requests.get(image_url, headers={"Authorization": f"Bearer {META_TOKEN}"}).content
            import base64
            img_b64 = base64.b64encode(img_data).decode()

            response = groq_client.chat.completions.create(
                model="llama-3.2-90b-vision-preview",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": """Extract transaction from this receipt.
Return ONLY JSON: {"type": "expense", "amount": <number>, "currency": "EGP", "category": <food|transport|shopping|bills|entertainment|health|other>, "merchant": <string or null>, "date": "today"}
If not a receipt, return {"error": "not_a_receipt"}"""},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                    ]
                }],
                response_format={"type": "json_object"}
            )
            txn = json.loads(response.choices[0].message.content)

            if "error" in txn:
                send_message(from_number, "📷 Couldn't extract a transaction. Try a clearer photo!")
                return jsonify({"status": "ok"}), 200

            txn["_transcript"] = "[receipt photo]"
            save_pending(from_number, txn)
            send_transaction_confirmation(from_number, txn, prefix="📷 Receipt scanned!")
            return jsonify({"status": "ok"}), 200

        # ── Voice note ────────────────────────────────────────────────
        if msg_type == "audio":
            send_message(from_number, "🎤 Transcribing...")
            audio_id = message["audio"]["id"]
            url_response = requests.get(
                f"https://graph.facebook.com/v18.0/{audio_id}",
                headers={"Authorization": f"Bearer {META_TOKEN}"}
            )
            audio_url = url_response.json()["url"]
            transcript = transcribe_audio(audio_url)

            # Check if transcript is just a greeting
            if is_greeting(transcript):
                send_message(from_number,
                    f"🎤 Heard: {transcript}\n\n"
                    "👋 Hey! I'm your finance tracker.\n\n"
                    "Log an expense: 'spent 50 on lunch'\n"
                    "Log income: 'received 5000 salary'\n\n"
                    "Or send /help for all commands."
                )
                return jsonify({"status": "ok"}), 200

            txn = extract_transaction(transcript)

            if "error" in txn:
                send_message(from_number, f"🎤 Heard: {transcript}\n\nCouldn't identify a transaction. Try again!")
                return jsonify({"status": "ok"}), 200

            txn["_transcript"] = transcript
            save_pending(from_number, txn)
            send_transaction_confirmation(from_number, txn, prefix=f"🎤 Heard: {transcript}")
            return jsonify({"status": "ok"}), 200

        # ── Text message ──────────────────────────────────────────────
        if msg_type != "text":
            return jsonify({"status": "ok"}), 200

        body = message["text"]["body"].strip()
        cmd = body.lower().split()[0] if body else ""
        args = body[len(cmd):].strip()

        # ── CANCEL INTENT ─ checked FIRST before anything else ───────
        if is_cancel(body):
            delete_pending(from_number)  # clear any pending, ignore return
            send_message(from_number, "❌ Cancelled, nothing was saved.")
            return jsonify({"status": "ok"}), 200

        pending = get_pending(from_number)

        # Awaiting budget amount from list selection
        if pending and pending[1] == "awaiting_budget_amount":
            _data, _state, ctx = pending
            try:
                amount = float(body.replace(",", ""))
            except ValueError:
                send_message(from_number, "❌ Please enter a valid number like 2000")
                return jsonify({"status": "ok"}), 200
            category = ctx["budget_category"]
            user_id = get_primary_id(from_number)
            set_budget(user_id, category, amount)
            delete_pending(from_number)
            send_message(from_number,
                f"✅ Budget set!\n\n"
                f"{cat_emoji(category)} {category}: {amount:,.0f} EGP/month\n\n"
                f"I'll warn you at 80% and alert you when you exceed it."
            )
            return jsonify({"status": "ok"}), 200

        # Awaiting edit correction
        if pending and pending[1] == "awaiting_edit":
            expense_data, _state, ctx = pending
            updated = apply_correction(expense_data, body)
            editing_id = ctx.get("editing_id")

            if editing_id:
                session = Session()
                try:
                    record = session.query(Expense).filter_by(id=editing_id).first()
                    if record:
                        record.amount = updated["amount"]
                        record.currency = updated.get("currency", "EGP")
                        record.category = updated.get("category", "other")
                        record.merchant = updated.get("merchant")
                        record.date = updated.get("date", "today")
                        session.commit()
                finally:
                    session.close()
                delete_pending(from_number)
                etype = updated.get("type", "expense")
                send_message(from_number,
                    f"✅ Entry #{editing_id} updated!\n\n"
                    f"{type_emoji(etype)} {etype.upper()}\n"
                    f"💰 {updated['amount']:,.0f} {updated.get('currency','EGP')} — {updated.get('category')}\n"
                    f"🏪 {updated.get('merchant') or 'N/A'}"
                )
            else:
                updated["_transcript"] = expense_data.get("_transcript", "")
                save_pending(from_number, updated)
                send_transaction_confirmation(from_number, updated)

            return jsonify({"status": "ok"}), 200

        # Text yes/no fallback (for users who type instead of tap buttons)
        if pending and pending[1] == "confirm":
            expense_data, _state, _ctx = pending
            if body.lower() in ["yes", "y", "يس", "اه", "آه", "ok", "اوك"]:
                # Atomic: only save if WE are the one who deleted the pending
                if delete_pending(from_number):
                    user_id = get_primary_id(from_number)
                    save_expense(user_id, expense_data, expense_data.get("_transcript", ""))
                    etype = expense_data.get("type", "expense")
                    alert = ""
                    if etype == "expense":
                        alert = check_budget_alert(user_id, expense_data.get("category", "other"), expense_data["amount"])
                    send_message(from_number,
                        f"💾 Saved!\n"
                        f"{type_emoji(etype)} {etype.upper()}\n"
                        f"💰 {expense_data['amount']} {expense_data.get('currency', 'EGP')} — {expense_data.get('category', 'other')}\n"
                        f"🏪 {expense_data.get('merchant') or 'N/A'}"
                        + alert
                    )
                return jsonify({"status": "ok"}), 200
            elif body.lower() in ["no", "n", "لا"]:
                delete_pending(from_number)
                send_message(from_number, "❌ Cancelled, nothing was saved.")
                return jsonify({"status": "ok"}), 200
            else:
                updated = apply_correction(expense_data, body)
                updated["_transcript"] = expense_data.get("_transcript", "")
                save_pending(from_number, updated)
                send_transaction_confirmation(from_number, updated)
                return jsonify({"status": "ok"}), 200

        # Commands
        if cmd == "/help":
            handle_help(from_number)
        elif cmd == "/summary":
            handle_summary(from_number)
        elif cmd == "/history":
            handle_history(from_number)
        elif cmd == "/delete":
            handle_delete(from_number, args)
        elif cmd == "/edit":
            handle_edit_start(from_number, args)
        elif cmd == "/budget":
            if not args:
                handle_budget_view(from_number)
                handle_budget_interactive(from_number)
            else:
                handle_budget_set(from_number, args)
        elif cmd == "/login":
            token = create_login_token(from_number)
            dashboard_url = os.getenv("DASHBOARD_URL", "https://moneybot-beta.vercel.app")
            send_message(from_number,
                f"🔐 Tap to open your dashboard:\n\n"
                f"{dashboard_url}/auth/whatsapp?token={token}\n\n"
                f"⏱ Link expires in 10 minutes."
            )
        elif cmd.startswith("/link"):
            if not args:
                send_message(from_number, "Usage: /link <token>\n\nGet your token by sending /link on Telegram.")
            else:
                primary_id = resolve_link_token(args.strip(), from_number)
                if primary_id:
                    send_message(from_number, "✅ Accounts linked!\n\nYour WhatsApp and Telegram expenses now appear together on the dashboard.")
                else:
                    send_message(from_number, "❌ Invalid or expired token.\nSend /link on Telegram to get a new one.")
        elif cmd.startswith("/"):
            send_message(from_number, "Unknown command. Send /help to see all commands.")
        else:
            # Pre-filter: catch greetings/chitchat without calling AI
            if is_greeting(body):
                send_message(from_number,
                    "👋 Hey! I'm your finance tracker.\n\n"
                    "Log an expense: 'spent 50 on lunch'\n"
                    "Log income: 'received 5000 salary'\n\n"
                    "Or send /help for all commands."
                )
            else:
                txn = extract_transaction(body)
                if "error" in txn:
                    send_message(from_number,
                        "I didn't recognize that as an expense or income.\n\n"
                        "Try:\n• 'spent 150 on lunch'\n• 'received 5000 salary'\n\n"
                        "Send /help for all commands."
                    )
                else:
                    txn["_transcript"] = body
                    save_pending(from_number, txn)
                    send_transaction_confirmation(from_number, txn)

    except Exception as e:
        logger.error(f"Webhook error: {e}")
        logger.error(traceback.format_exc())

    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=False)