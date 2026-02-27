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
    delete_expense, set_budget, get_budgets,
    get_category_spending_this_month, Session, Expense
)

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

# In-memory stores
pending_expenses = {}      # {phone: expense_dict}
user_states = {}           # {phone: "awaiting_budget_category"|"awaiting_budget_amount"|"awaiting_edit"}
user_context = {}          # {phone: {extra data}}

CATEGORY_EMOJI = {
    "food": "🍔", "transport": "🚗", "shopping": "🛍️",
    "bills": "📄", "entertainment": "🎬", "health": "💊", "other": "📦"
}

CATEGORIES = list(CATEGORY_EMOJI.keys())


def cat_emoji(category: str) -> str:
    return CATEGORY_EMOJI.get(category, "📦")


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

def extract_expense(transcript: str) -> dict:
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{
            "role": "system",
            "content": """Extract expense data from Arabic or English text.
Return ONLY this exact JSON:
{
  "amount": <number only>,
  "currency": <"EGP" if not mentioned>,
  "category": <food|transport|shopping|bills|entertainment|health|other>,
  "merchant": <string or null>,
  "date": <"today" if not mentioned>
}
Arabic numbers: الف=1000, مية=100, combinations add together.
If the text does not describe an expense, return {"error": "not_an_expense"}"""
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
                "content": """Apply the user's correction to the expense JSON and return updated JSON only.
Keep unchanged fields. Return ONLY valid JSON: amount, currency, category, merchant, date."""
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
    budgets = get_budgets(user_id)
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
        "Just send a voice note or type an expense to track it!\n\n"
        "📋 *Commands:*\n"
        "/summary — this month's spending\n"
        "/history — last 10 expenses\n"
        "/budget — view & set budgets\n"
        "/login — open dashboard\n"
        "/link <token> — link Telegram account\n"
        "/help — show this message\n\n"
        "💡 *Examples:*\n"
        "• 'spent 150 on lunch'\n"
        "• 'مية وخمسين على أكل'\n"
        "• Send a voice note 🎤"
    )


def handle_summary(phone: str):
    user_id = get_primary_id(phone)
    total, breakdown, count = get_monthly_summary_sync(user_id)
    budgets = get_budgets(user_id)

    if count == 0:
        send_message(phone, "No expenses recorded this month yet!\n\nSend a voice note or type an expense to get started.")
        return

    from datetime import datetime
    text = f"📊 Monthly Summary — {datetime.utcnow().strftime('%B %Y')}\n"
    text += f"💰 Total: {total:,.0f} EGP\n"
    text += f"🧾 Transactions: {count}\n\n"
    text += "By Category:\n"

    for cat, amount in sorted(breakdown.items(), key=lambda x: x[1], reverse=True):
        pct = (amount / total) * 100
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
        send_message(phone, "No expenses recorded yet!")
        return

    text = "🧾 Last 10 Expenses:\n\n"
    for e in expenses:
        merchant = e.merchant or "N/A"
        text += (f"#{e.id} {cat_emoji(e.category)} {e.amount:,.0f} {e.currency} "
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

    user_context[phone] = {
        "editing_id": expense_id,
        "expense": {
            "amount": expense.amount, "currency": expense.currency,
            "category": expense.category, "merchant": expense.merchant, "date": expense.date
        }
    }
    user_states[phone] = "awaiting_edit"

    send_message(phone,
        f"✏️ Editing #{expense_id}:\n"
        f"💰 {expense.amount:,.0f} {expense.currency} — {expense.category}\n"
        f"🏪 {expense.merchant or 'N/A'}\n\n"
        "What should I change?\n"
        "Example: 'amount is 300' or 'category is transport'"
    )


def handle_budget_view(phone: str):
    user_id = get_primary_id(phone)
    budgets = get_budgets(user_id)

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

        # ── Voice note ────────────────────────────────────────────────────────
        if msg_type == "audio":
            send_message(from_number, "🎤 Transcribing...")
            audio_id = message["audio"]["id"]
            url_response = requests.get(
                f"https://graph.facebook.com/v18.0/{audio_id}",
                headers={"Authorization": f"Bearer {META_TOKEN}"}
            )
            audio_url = url_response.json()["url"]
            transcript = transcribe_audio(audio_url)
            expense = extract_expense(transcript)

            if "error" in expense:
                send_message(from_number, f"🎤 Heard: {transcript}\n\nI couldn't identify an expense. Try again!")
                return jsonify({"status": "ok"}), 200

            expense["_transcript"] = transcript
            pending_expenses[from_number] = expense
            send_message(from_number,
                f"🎤 Heard: {transcript}\n\n"
                f"💰 {expense['amount']} {expense['currency']}\n"
                f"📂 {expense['category']}\n"
                f"🏪 {expense.get('merchant') or 'N/A'}\n\n"
                f"Reply yes to save, no to cancel, or tell me what to correct."
            )
            return jsonify({"status": "ok"}), 200

        # ── Text message ──────────────────────────────────────────────────────
        if msg_type != "text":
            return jsonify({"status": "ok"}), 200

        body = message["text"]["body"].strip()
        cmd = body.lower().split()[0] if body else ""
        args = body[len(cmd):].strip()

        # Handle stateful flows first
        state = user_states.get(from_number)

        # Awaiting edit correction
        if state == "awaiting_edit":
            ctx = user_context.get(from_number, {})
            updated = apply_correction(ctx["expense"], body)
            editing_id = ctx["editing_id"]
            user_id = get_primary_id(from_number)

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

            user_states.pop(from_number, None)
            user_context.pop(from_number, None)
            send_message(from_number,
                f"✅ Expense #{editing_id} updated!\n\n"
                f"💰 {updated['amount']:,.0f} {updated.get('currency','EGP')} — {updated.get('category')}\n"
                f"🏪 {updated.get('merchant') or 'N/A'}"
            )
            return jsonify({"status": "ok"}), 200

        # Awaiting confirmation or correction
        if from_number in pending_expenses:
            if body.lower() in ["yes", "y", "يس", "اه", "آه", "ok", "اوك"]:
                expense = pending_expenses.pop(from_number)
                user_id = get_primary_id(from_number)
                save_expense(user_id, expense, expense.get("_transcript", ""))
                alert = check_budget_alert(user_id, expense.get("category", "other"), expense["amount"])
                send_message(from_number,
                    f"💾 Saved!\n"
                    f"💰 {expense['amount']} {expense['currency']} — {expense['category']}\n"
                    f"🏪 {expense.get('merchant') or 'N/A'}"
                    + alert
                )
                return jsonify({"status": "ok"}), 200
            elif body.lower() in ["no", "n", "لا", "cancel"]:
                pending_expenses.pop(from_number)
                send_message(from_number, "❌ Cancelled.")
                return jsonify({"status": "ok"}), 200
            else:
                # Treat as correction
                original = pending_expenses[from_number]
                updated = apply_correction(original, body)
                pending_expenses[from_number] = {**updated, "_transcript": original.get("_transcript", "")}
                send_message(from_number,
                    f"Updated!\n\n"
                    f"💰 {updated['amount']} {updated['currency']}\n"
                    f"📂 {updated['category']}\n"
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
            # Regular text — try to parse as expense
            expense = extract_expense(body)
            if "error" in expense:
                send_message(from_number,
                    "I didn't recognize that as an expense.\n\n"
                    "Try: 'spent 150 on lunch' or send a voice note 🎤\n"
                    "Send /help for all commands."
                )
            else:
                expense["_transcript"] = body
                pending_expenses[from_number] = expense
                send_message(from_number,
                    f"💰 {expense['amount']} {expense['currency']}\n"
                    f"📂 {expense['category']}\n"
                    f"🏪 {expense.get('merchant') or 'N/A'}\n\n"
                    f"Reply yes to save, no to cancel, or tell me what to correct."
                )

    except Exception as e:
        logger.error(f"Webhook error: {e}")
        logger.error(traceback.format_exc())

    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=False)