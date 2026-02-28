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

# Rate limiter: {user_id: [timestamp, ...]}
_rate_buckets: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT = 10       # max messages
RATE_WINDOW = 60      # per N seconds

def is_rate_limited(user_id: str) -> bool:
    now = time()
    bucket = _rate_buckets[user_id]
    # prune old entries
    _rate_buckets[user_id] = [t for t in bucket if now - t < RATE_WINDOW]
    if len(_rate_buckets[user_id]) >= RATE_LIMIT:
        return True
    _rate_buckets[user_id].append(now)
    return False

CATEGORY_EMOJI = {
    "food": "🍔", "transport": "🚗", "shopping": "🛍️",
    "bills": "📄", "entertainment": "🎬", "health": "💊", "other": "📦",
    # Income categories
    "salary": "💵", "freelance": "💻", "gift": "🎁", "refund": "🔄", "investment": "📈", "other_income": "💰"
}

CATEGORIES = ["food", "transport", "shopping", "bills", "entertainment", "health", "other"]
INCOME_CATEGORIES = ["salary", "freelance", "gift", "refund", "investment", "other_income"]


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


# ── AI helpers ────────────────────────────────────────────────────────────────

def extract_transaction(transcript: str) -> dict:
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{
            "role": "system",
            "content": """Extract financial transaction data from Arabic or English text.
Determine if this is an INCOME or EXPENSE.

INCOME keywords: received, earned, got paid, salary, مرتب, استلمت, جالي, اتحوللي, refund, freelance, gift
EXPENSE keywords: spent, paid, bought, cost, صرفت, دفعت, اشتريت, على

Return ONLY this exact JSON:
{
  "type": "income" or "expense",
  "amount": <number only>,
  "currency": <"EGP" if not mentioned>,
  "category": <for expenses: food|transport|shopping|bills|entertainment|health|other>,
             <for income: salary|freelance|gift|refund|investment|other_income>,
  "merchant": <string or null (for income, this is the source e.g. "company name")>,
  "date": <"today" if not mentioned>
}
Arabic numbers: الف=1000, مية=100, combinations add together.
If the text does not describe a financial transaction, return {"error": "not_a_transaction"}"""
        }, {"role": "user", "content": transcript}],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)


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
        "💰 *MoneyBot Commands*\n\n"
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
        "• 'استلمت مرتبي 8000'\n"
        "• Send a voice note 🎤"
    )


def handle_summary(phone: str):
    user_id = get_primary_id(phone)
    expense_total, breakdown, count, income_total = get_monthly_summary_sync(user_id)
    budgets = get_budget(user_id)

    if count == 0:
        send_message(phone, "No transactions recorded this month yet!\n\nSend a voice note or type an expense/income to get started.")
        return

    from datetime import datetime
    net = income_total - expense_total
    net_emoji = "🟢" if net >= 0 else "�"

    text = f"�📊 Monthly Summary — {datetime.utcnow().strftime('%B %Y')}\n\n"
    text += f"� Income: {income_total:,.0f} EGP\n"
    text += f"📤 Expenses: {expense_total:,.0f} EGP\n"
    text += f"{net_emoji} Net: {net:+,.0f} EGP\n"
    text += f"� Transactions: {count}\n"

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

    text = "� Last 10 Transactions:\n\n"
    for e in expenses:
        merchant = e.merchant or "N/A"
        etype = e.entry_type or "expense"
        icon = "📥" if etype == "income" else "📤"
        text += (f"#{e.id} {icon} {cat_emoji(e.category)} {e.amount:,.0f} {e.currency} "
                 f"— {e.category} | {merchant} | {e.created_at.strftime('%d %b')}\n")

    text += "\nTo delete: /delete <id>  (e.g. /delete 42)\n"
    text += "To edit: /edit <id>  (e.g. /edit 42)"
    send_message(phone, text)


def handle_delete(phone: str, args: str):
    if not args.strip().isdigit():
        send_message(phone, "Usage: /delete <id>\nExample: /delete 42\n\nUse /history to see expense IDs.")
        return

    user_id = get_primary_id(phone)
    expense_id = int(args.strip())
    success = delete_expense(user_id, expense_id)

    if success:
        send_message(phone, f"🗑 Expense #{expense_id} deleted.")
    else:
        send_message(phone, f"❌ Expense #{expense_id} not found.")


def handle_edit_start(phone: str, args: str):
    if not args.strip().isdigit():
        send_message(phone, "Usage: /edit <id>\nExample: /edit 42\n\nUse /history to see expense IDs.")
        return

    user_id = get_primary_id(phone)
    expense_id = int(args.strip())

    session = Session()
    expense = session.query(Expense).filter_by(id=expense_id, telegram_user_id=user_id).first()
    session.close()

    if not expense:
        send_message(phone, f"❌ Expense #{expense_id} not found.")
        return

    exp_data = {
        "amount": expense.amount, "currency": expense.currency,
        "category": expense.category, "merchant": expense.merchant,
        "date": expense.date, "type": expense.entry_type or "expense"
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
            "Set one with:\n/budget <category> <amount>\n\n"
            "Categories: food, transport, shopping, bills, entertainment, health, other\n\n"
            "Example: /budget food 3000"
        )
        return

    _, breakdown, _ = get_monthly_summary_sync(user_id)
    text = "🎯 Monthly Budgets:\n\n"

    for cat, budget in budgets.items():
        spent = breakdown.get(cat, 0)
        pct = (spent / budget) * 100
        indicator = "🟢" if pct < 80 else ("🟡" if pct < 100 else "🔴")
        text += f"{indicator} {cat_emoji(cat)} {cat}: {spent:,.0f} / {budget:,.0f} EGP ({pct:.0f}%)\n"

    text += "\nTo update: /budget <category> <amount>\nTo remove: /budget remove <category>"
    send_message(phone, text)


def handle_budget_set(phone: str, args: str):
    parts = args.strip().split()

    # /budget remove <category>
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

    # /budget <category> <amount>
    if len(parts) != 2:
        send_message(phone,
            "Usage: /budget <category> <amount>\n\n"
            "Example: /budget food 3000\n\n"
            f"Categories: {', '.join(CATEGORIES)}"
        )
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

        # ── Rate limiting ───────────────────────────────────────────────
        if is_rate_limited(from_number):
            send_message(from_number, "⏳ Slow down! Try again in a moment.")
            return jsonify({"status": "ok"}), 200

        # ── Onboarding for new users ────────────────────────────────────
        if is_new_user(from_number):
            send_message(from_number,
                "👋 Welcome to *Aura*! I'm your personal finance tracker.\n\n"
                "Just send me a message like 'spent 150 on lunch' or "
                "'received 5000 salary' and I'll track it for you!\n\n"
                "🎤 You can also send voice notes or 📷 photos of receipts.\n\n"
                "Here are your commands:"
            )
            handle_help(from_number)

        # ── Image / Receipt scanning ────────────────────────────────────
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
                        {"type": "text", "text": """Extract financial transaction data from this receipt/image.
Return ONLY JSON: {"type": "income" or "expense", "amount": <number>, "currency": "EGP", "category": <food|transport|shopping|bills|entertainment|health|other>, "merchant": <string or null>, "date": "today"}
If not a receipt, return {"error": "not_a_receipt"}"""},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                    ]
                }],
                response_format={"type": "json_object"}
            )
            txn = json.loads(response.choices[0].message.content)

            if "error" in txn:
                send_message(from_number, "📷 Couldn't extract a transaction from that image. Try a clearer photo!")
                return jsonify({"status": "ok"}), 200

            txn["_transcript"] = "[receipt photo]"
            save_pending(from_number, txn)
            etype = txn.get("type", "expense")
            send_message(from_number,
                f"📷 Receipt scanned!\n\n"
                f"{type_emoji(etype)} {etype.upper()}\n"
                f"💰 {txn['amount']} {txn.get('currency', 'EGP')}\n"
                f"📂 {txn.get('category', 'other')}\n"
                f"🏪 {txn.get('merchant') or 'N/A'}\n\n"
                f"Reply yes to save, no to cancel, or tell me what to correct."
            )
            return jsonify({"status": "ok"}), 200

        # ── Voice note ──────────────────────────────────────────────────
        if msg_type == "audio":
            send_message(from_number, "🎤 Transcribing...")
            audio_id = message["audio"]["id"]
            url_response = requests.get(
                f"https://graph.facebook.com/v18.0/{audio_id}",
                headers={"Authorization": f"Bearer {META_TOKEN}"}
            )
            audio_url = url_response.json()["url"]
            transcript = transcribe_audio(audio_url)
            txn = extract_transaction(transcript)

            if "error" in txn:
                send_message(from_number, f"🎤 Heard: {transcript}\n\nI couldn't identify a transaction. Try again!")
                return jsonify({"status": "ok"}), 200

            txn["_transcript"] = transcript
            save_pending(from_number, txn)
            etype = txn.get("type", "expense")
            send_message(from_number,
                f"🎤 Heard: {transcript}\n\n"
                f"{type_emoji(etype)} {etype.upper()}\n"
                f"💰 {txn['amount']} {txn['currency']}\n"
                f"📂 {txn['category']}\n"
                f"🏪 {txn.get('merchant') or 'N/A'}\n\n"
                f"Reply yes to save, no to cancel, or tell me what to correct."
            )
            return jsonify({"status": "ok"}), 200

        # ── Text message ────────────────────────────────────────────────
        if msg_type != "text":
            return jsonify({"status": "ok"}), 200

        body = message["text"]["body"].strip()
        cmd = body.lower().split()[0] if body else ""
        args = body[len(cmd):].strip()

        # Check DB for pending transaction
        pending = get_pending(from_number)

        # Awaiting edit correction
        if pending and pending[1] == "awaiting_edit":
            expense_data, _state, ctx = pending
            updated = apply_correction(expense_data, body)
            editing_id = ctx["editing_id"]

            session = Session()
            try:
                record = session.query(Expense).filter_by(id=editing_id).first()
                if record:
                    record.amount = updated["amount"]
                    record.currency = updated.get("currency", "EGP")
                    record.category = updated.get("category", "other")
                    record.merchant = updated.get("merchant")
                    record.date = updated.get("date", "today")
                    record.entry_type = updated.get("type", record.entry_type or "expense")
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
            return jsonify({"status": "ok"}), 200

        # Awaiting confirmation or correction
        if pending and pending[1] == "confirm":
            expense_data, _state, _ctx = pending
            if body.lower() in ["yes", "y", "يس", "اه", "آه", "ok", "اوك"]:
                delete_pending(from_number)
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
            elif body.lower() in ["no", "n", "لا", "cancel"]:
                delete_pending(from_number)
                send_message(from_number, "❌ Cancelled.")
                return jsonify({"status": "ok"}), 200
            else:
                # Treat as correction
                updated = apply_correction(expense_data, body)
                updated["_transcript"] = expense_data.get("_transcript", "")
                save_pending(from_number, updated)
                etype = updated.get("type", "expense")
                send_message(from_number,
                    f"Updated!\n\n"
                    f"{type_emoji(etype)} {etype.upper()}\n"
                    f"💰 {updated['amount']} {updated.get('currency', 'EGP')}\n"
                    f"📂 {updated.get('category', 'other')}\n"
                    f"🏪 {updated.get('merchant') or 'N/A'}\n\n"
                    f"Reply yes to save or no to cancel."
                )
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
                    send_message(from_number,
                        "✅ Accounts linked!\n\n"
                        "Your WhatsApp and Telegram expenses now appear together on the dashboard."
                    )
                else:
                    send_message(from_number,
                        "❌ Invalid or expired token.\nSend /link on Telegram to get a new one."
                    )

        elif cmd.startswith("/"):
            send_message(from_number, "Unknown command. Send /help to see all commands.")

        else:
            # Regular text — try to parse as transaction
            txn = extract_transaction(body)
            if "error" in txn:
                send_message(from_number,
                    "I didn't recognize that as an expense or income.\n\n"
                    "Try: 'spent 150 on lunch' or 'received 5000 salary'\n"
                    "Send /help for all commands."
                )
            else:
                txn["_transcript"] = body
                save_pending(from_number, txn)
                etype = txn.get("type", "expense")
                send_message(from_number,
                    f"{type_emoji(etype)} {etype.upper()}\n"
                    f"💰 {txn['amount']} {txn.get('currency', 'EGP')}\n"
                    f"📂 {txn.get('category', 'other')}\n"
                    f"🏪 {txn.get('merchant') or 'N/A'}\n\n"
                    f"Reply yes to save, no to cancel, or tell me what to correct."
                )

    except Exception as e:
        logger.error(f"Webhook error: {e}")
        logger.error(traceback.format_exc())

    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=False)