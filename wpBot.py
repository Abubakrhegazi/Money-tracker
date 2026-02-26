import os
import json
import requests
from flask import Flask, request
from twilio.twiml.messaging_response import MessagingResponse
from twilio.rest import Client
from dotenv import load_dotenv
from groq import Groq
from database import init_db, save_expense, get_monthly_summary, get_recent_expenses

load_dotenv()

app = Flask(__name__)
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
twilio_client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))

TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER")  # whatsapp:+14155238886

# Store pending expenses per user {phone_number: expense_dict}
pending_expenses = {}

def send_message(to: str, body: str):
    twilio_client.messages.create(
        from_=TWILIO_WHATSAPP_NUMBER,
        to=to,
        body=body
    )

async def extract_expense(transcript: str) -> dict:
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
}"""
        }, {"role": "user", "content": transcript}],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)

@app.route("/whatsapp", methods=["POST"])
def whatsapp_webhook():
    from_number = request.form.get("From")  # e.g. whatsapp:+201234567890
    body = request.form.get("Body", "").strip()
    media_url = request.form.get("MediaUrl0")  # voice note or image
    media_type = request.form.get("MediaContentType0", "")
    user_id = from_number  # use phone number as user ID

    resp = MessagingResponse()

    # Handle confirmation replies
    if from_number in pending_expenses:
        if body.lower() in ["yes", "y", "✅", "confirm", "ok", "يس", "اه", "آه"]:
            expense = pending_expenses.pop(from_number)
            save_expense(user_id, expense, expense.get("_transcript", ""))
            resp.message(
                f"💾 Saved!\n"
                f"💰 {expense['amount']} {expense['currency']} — {expense['category']}\n"
                f"🏪 {expense.get('merchant') or 'N/A'}"
            )
            return str(resp)
        elif body.lower() in ["no", "n", "❌", "cancel", "لا"]:
            pending_expenses.pop(from_number)
            resp.message("❌ Cancelled.")
            return str(resp)

    # Handle commands
    if body.lower() == "/summary":
        import asyncio
        total, breakdown, count = asyncio.run(get_monthly_summary_sync(user_id))
        if count == 0:
            resp.message("No expenses this month yet!")
        else:
            text = f"📊 Monthly Summary\n💰 Total: {total:,.0f} EGP\n🧾 {count} transactions\n\n"
            for cat, amount in sorted(breakdown.items(), key=lambda x: x[1], reverse=True):
                text += f"  {cat}: {amount:,.0f} EGP\n"
            resp.message(text)
        return str(resp)

    # Handle voice note
    if media_url and "audio" in media_type:
        # Download the audio file
        auth = (os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
        audio_response = requests.get(media_url, auth=auth)
        file_path = f"whatsapp_voice_{from_number.replace(':', '_').replace('+', '')}.ogg"
        with open(file_path, "wb") as f:
            f.write(audio_response.content)

        # Transcribe
        with open(file_path, "rb") as f:
            transcription = groq_client.audio.transcriptions.create(
                model="whisper-large-v3", file=f
            )
        os.remove(file_path)
        transcript = transcription.text

        # Extract
        import asyncio
        expense = asyncio.run(extract_expense_sync(transcript))
        expense["_transcript"] = transcript
        pending_expenses[from_number] = expense

        resp.message(
            f"🎤 Heard: _{transcript}_\n\n"
            f"💰 {expense['amount']} {expense['currency']}\n"
            f"📂 {expense['category']}\n"
            f"🏪 {expense.get('merchant') or 'N/A'}\n\n"
            f"Reply *yes* to save or *no* to cancel."
        )
        return str(resp)

    # Handle text expense
    if body and not body.startswith("/"):
        import asyncio
        expense = extract_expense_sync(body)
        expense["_transcript"] = body
        pending_expenses[from_number] = expense

        resp.message(
            f"💰 {expense['amount']} {expense['currency']}\n"
            f"📂 {expense['category']}\n"
            f"🏪 {expense.get('merchant') or 'N/A'}\n\n"
            f"Reply *yes* to save or *no* to cancel."
        )
        return str(resp)

    resp.message("Send a voice note or type an expense to track it! 💰\nType /summary for monthly totals.")
    return str(resp)


def extract_expense_sync(transcript: str) -> dict:
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
}"""
        }, {"role": "user", "content": transcript}],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)


def get_monthly_summary_sync(user_id: str):
    from database import Session, Expense, extract
    from datetime import datetime
    session = Session()
    now = datetime.utcnow()
    expenses = session.query(Expense).filter(
        Expense.telegram_user_id == user_id,
        extract('month', Expense.created_at) == now.month,
        extract('year', Expense.created_at) == now.year
    ).all()
    session.close()
    total = sum(e.amount for e in expenses)
    breakdown = {}
    for e in expenses:
        breakdown[e.category or "other"] = breakdown.get(e.category or "other", 0) + e.amount
    return total, breakdown, len(expenses)


if __name__ == "__main__":
    init_db()
    app.run(port=5000, debug=True)