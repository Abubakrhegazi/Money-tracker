import os
import json
import requests
from flask import Flask, request, jsonify
from groq import Groq
from dotenv import load_dotenv
from database import init_db, save_expense, get_monthly_summary_sync

load_dotenv()

app = Flask(__name__)
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

META_TOKEN = os.getenv("META_WHATSAPP_TOKEN")
PHONE_NUMBER_ID = os.getenv("META_PHONE_NUMBER_ID")
VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN")  # any string you choose

API_URL = f"https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages"

pending_expenses = {}


def send_message(to: str, body: str):
    requests.post(API_URL, headers={
        "Authorization": f"Bearer {META_TOKEN}",
        "Content-Type": "application/json"
    }, json={
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": body}
    })


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
Arabic numbers: الف=1000, مية=100, combinations add together."""
        }, {"role": "user", "content": transcript}],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)


def transcribe_audio(audio_url: str) -> str:
    # Download audio from Meta
    response = requests.get(audio_url, headers={
        "Authorization": f"Bearer {META_TOKEN}"
    })
    file_path = "whatsapp_audio.ogg"
    with open(file_path, "wb") as f:
        f.write(response.content)

    with open(file_path, "rb") as f:
        transcription = groq_client.audio.transcriptions.create(
            model="whisper-large-v3", file=f
        )
    os.remove(file_path)
    return transcription.text


@app.route("/whatsapp", methods=["GET"])
def verify_webhook():
    """Meta calls this once to verify your webhook."""
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

        # Handle text message
        if msg_type == "text":
            body = message["text"]["body"].strip()

            # Confirmation reply
            if from_number in pending_expenses:
                if body.lower() in ["yes", "y", "يس", "اه", "آه", "ok"]:
                    expense = pending_expenses.pop(from_number)
                    save_expense(from_number, expense, expense.get("_transcript", ""))
                    send_message(from_number,
                        f"💾 Saved!\n"
                        f"💰 {expense['amount']} {expense['currency']} — {expense['category']}\n"
                        f"🏪 {expense.get('merchant') or 'N/A'}"
                    )
                    return jsonify({"status": "ok"}), 200
                elif body.lower() in ["no", "n", "لا", "cancel"]:
                    pending_expenses.pop(from_number)
                    send_message(from_number, "❌ Cancelled.")
                    return jsonify({"status": "ok"}), 200

            # Summary command
            if body.lower() == "/summary":
                total, breakdown, count = get_monthly_summary_sync(from_number)
                if count == 0:
                    send_message(from_number, "No expenses this month yet!")
                else:
                    text = f"📊 Monthly Summary\n💰 Total: {total:,.0f} EGP\n🧾 {count} transactions\n\n"
                    for cat, amount in sorted(breakdown.items(), key=lambda x: x[1], reverse=True):
                        text += f"  {cat}: {amount:,.0f} EGP\n"
                    send_message(from_number, text)
                return jsonify({"status": "ok"}), 200

            # Regular expense text
            expense = extract_expense(body)
            expense["_transcript"] = body
            pending_expenses[from_number] = expense
            send_message(from_number,
                f"💰 {expense['amount']} {expense['currency']}\n"
                f"📂 {expense['category']}\n"
                f"🏪 {expense.get('merchant') or 'N/A'}\n\n"
                f"Reply *yes* to save or *no* to cancel."
            )

        # Handle voice note
        elif msg_type == "audio":
            audio_id = message["audio"]["id"]

            # Get audio URL from Meta
            url_response = requests.get(
                f"https://graph.facebook.com/v18.0/{audio_id}",
                headers={"Authorization": f"Bearer {META_TOKEN}"}
            )
            audio_url = url_response.json()["url"]
            transcript = transcribe_audio(audio_url)

            expense = extract_expense(transcript)
            expense["_transcript"] = transcript
            pending_expenses[from_number] = expense

            send_message(from_number,
                f"🎤 _{transcript}_\n\n"
                f"💰 {expense['amount']} {expense['currency']}\n"
                f"📂 {expense['category']}\n"
                f"🏪 {expense.get('merchant') or 'N/A'}\n\n"
                f"Reply *yes* to save or *no* to cancel."
            )

    except Exception as e:
        print(f"Error: {e}")

    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    init_db()
    app.run(port=5000, debug=True)