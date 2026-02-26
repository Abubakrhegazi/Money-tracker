import os
import json
from groq import Groq
from database import init_db, save_expense, get_monthly_summary, get_recent_expenses, delete_expense, create_login_token, Session, Expense, set_budget, get_budget
from datetime import datetime

FRONTEND_URL = "https://moneybot-beta.vercel.app"

from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, MessageHandler, CallbackQueryHandler,
    filters, ContextTypes, ConversationHandler, CommandHandler
)

load_dotenv()
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Conversation states
WAITING_FOR_EDIT = 1

def format_expense_message(expense, transcript):
    return (
        f"✅ Got it!\n\n"
        f"💰 Amount: {expense['amount']} {expense['currency']}\n"
        f"📂 Category: {expense['category']}\n"
        f"🏪 Merchant: {expense.get('merchant') or 'N/A'}\n"
        f"📅 Date: {expense.get('date', 'today')}\n\n"
        f"_Heard: {transcript}_"
    )

def confirm_keyboard():
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Confirm", callback_data="confirm"),
            InlineKeyboardButton("✏️ Edit", callback_data="edit"),
            InlineKeyboardButton("❌ Cancel", callback_data="cancel"),
        ]
    ])

async def extract_expense(transcript: str) -> dict:
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": """Extract expense data from Arabic or English text.
                Return ONLY this exact JSON structure, no variations:
                {
                "amount": <number only, no text>,
                "currency": <"EGP" if not mentioned>,
                "category": <food|transport|shopping|bills|entertainment|health|other>,
                "merchant": <string or null>,
                "date": <"today" if not mentioned>
                }

                CRITICAL - Arabic number words mapping:
                - الف / ألف = 1000
                - الفين / ألفين = 2000  
                - تلاتالاف / ثلاثة آلاف = 3000
                - مية / مائة = 100
                - میتين / مئتين = 200
                - تلاتمية / ثلاثمائة = 300
                - اربعمية = 400
                - خمسمية / خمسمائة = 500
                - ستمية = 600
                - سبعمية = 700
                - تمانمية = 800
                - تسعمية = 900

                COMBINATIONS work by ADDING:
                - الف وثلاثمية = 1000 + 300 = 1300
                - الف وخمسمية = 1000 + 500 = 1500
                - الفين وخمسمية = 2000 + 500 = 2500
                - ألف وثلاثمائة وخمسة وعشرين = 1000 + 300 + 25 = 1325

                Always add the parts together, never ignore the thousands part."""
            },
            {"role": "user", "content": transcript}
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Ignore commands
    if update.message.text.startswith("/"):
        return
    
    # If we're waiting for an edit correction, don't treat it as a new expense
    if context.user_data.get("pending_expense") or context.user_data.get("editing_expense_id"):
        await handle_edit_message(update, context)
        return

    transcript = update.message.text

    # Extract expense using same function as voice
    expense = await extract_expense(transcript)
    context.user_data["pending_expense"] = expense
    context.user_data["transcript"] = transcript

    await update.message.reply_text(
        format_expense_message(expense, transcript),
        parse_mode="Markdown",
        reply_markup=confirm_keyboard()
    )
async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Download voice note
    voice = update.message.voice
    file = await context.bot.get_file(voice.file_id)
    file_path = f"voice_{update.message.message_id}.ogg"
    await file.download_to_drive(file_path)

    # Transcribe
    with open(file_path, "rb") as f:
        transcription = groq_client.audio.transcriptions.create(
            model="whisper-large-v3",
            file=f,
        )
    transcript = transcription.text
    os.remove(file_path)

    # Extract
    expense = await extract_expense(transcript)

    # Store in context for later use (confirm/edit)
    context.user_data["pending_expense"] = expense
    context.user_data["transcript"] = transcript

    # Reply with confirmation buttons
    await update.message.reply_text(
        format_expense_message(expense, transcript),
        parse_mode="Markdown",
        reply_markup=confirm_keyboard()
    )

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    action = query.data

    if action == "confirm":
        expense = context.user_data.get("pending_expense")
        transcript = context.user_data.get("transcript", "")
        user_id = str(query.from_user.id)
        
        save_expense(user_id, expense, transcript)  # 👈 this line

        await query.edit_message_text(
            f"💾 Saved!\n\n"
            f"💰 {expense['amount']} {expense['currency']} — {expense['category']}\n"
            f"🏪 {expense.get('merchant') or 'N/A'} | 📅 {expense.get('date', 'today')}"
        )

    elif action == "edit":
        await query.edit_message_text(
            "✏️ What would you like to correct? Tell me what's wrong.\n\n"
            "Example: _'amount should be 300'_ or _'category is transport not food'_",
            parse_mode="Markdown"
        )
        return WAITING_FOR_EDIT

    elif action == "cancel":
        context.user_data.pop("pending_expense", None)
        context.user_data.pop("transcript", None)
        await query.edit_message_text("❌ Cancelled. Expense discarded.")

async def handle_edit_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    correction = update.message.text
    original_expense = context.user_data.get("pending_expense", {})
    editing_id = context.user_data.get("editing_expense_id")

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": """You are correcting an expense entry.
                Apply the user's correction to the existing expense JSON and return the updated JSON only.
                Keep all fields that aren't being corrected unchanged.
                Return ONLY valid JSON with fields: amount, currency, category, merchant, date."""
            },
            {
                "role": "user",
                "content": f"Existing expense: {json.dumps(original_expense)}\nCorrection: {correction}"
            }
        ],
        response_format={"type": "json_object"}
    )

    updated_expense = json.loads(response.choices[0].message.content)
    context.user_data["pending_expense"] = updated_expense
    transcript = context.user_data.get("transcript", "")

    # If editing an existing DB record, update it directly
    if editing_id:
        session = Session()
        try:
            record = session.query(Expense).filter_by(id=editing_id).first()
            if record:
                record.amount = updated_expense["amount"]
                record.currency = updated_expense.get("currency", "EGP")
                record.category = updated_expense.get("category", "other")
                record.merchant = updated_expense.get("merchant")
                record.date = updated_expense.get("date", "today")
                session.commit()
        finally:
            session.close()

        context.user_data.pop("editing_expense_id", None)
        await update.message.reply_text(
            f"✅ Expense #{editing_id} updated!\n\n"
            f"💰 {updated_expense['amount']:,.0f} {updated_expense.get('currency', 'EGP')} — {updated_expense.get('category')}\n"
            f"🏪 {updated_expense.get('merchant') or 'N/A'}"
        )
    else:
        # New expense pending confirmation
        await update.message.reply_text(
            "Here's the updated expense:\n\n" +
            format_expense_message(updated_expense, transcript),
            parse_mode="Markdown",
            reply_markup=confirm_keyboard()
        )
    correction = update.message.text
    original_expense = context.user_data.get("pending_expense", {})

    # Ask LLM to apply the correction
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": """You are correcting an expense entry. 
Apply the user's correction to the existing expense JSON and return the updated JSON only.
Keep all fields that aren't being corrected unchanged.
Return ONLY valid JSON with fields: amount, currency, category, merchant, date."""
            },
            {
                "role": "user",
                "content": f"Existing expense: {json.dumps(original_expense)}\nCorrection: {correction}"
            }
        ],
        response_format={"type": "json_object"}
    )

    updated_expense = json.loads(response.choices[0].message.content)
    context.user_data["pending_expense"] = updated_expense
    transcript = context.user_data.get("transcript", "")

    await update.message.reply_text(
        "Here's the updated expense:\n\n" +
        format_expense_message(updated_expense, transcript),
        parse_mode="Markdown",
        reply_markup=confirm_keyboard()
    )

async def summary_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    total, breakdown, count = get_monthly_summary(user_id)

    if count == 0:
        await update.message.reply_text("No expenses recorded this month yet!")
        return

    # build category breakdown text
    breakdown_text = ""
    for category, amount in sorted(breakdown.items(), key=lambda x: x[1], reverse=True):
        percentage = (amount / total) * 100
        breakdown_text += f"  {category_emoji(category)} {category}: {amount:,.0f} EGP ({percentage:.0f}%)\n"

    reply = (
        f"📊 *Monthly Summary — {datetime.utcnow().strftime('%B %Y')}*\n\n"
        f"💰 Total Spent: *{total:,.0f} EGP*\n"
        f"🧾 Transactions: {count}\n\n"
        f"*By Category:*\n{breakdown_text}"
    )

    # Add budget info if set
    budget_info = get_budget(user_id)
    if budget_info:
        budget_amount, currency = budget_info
        remaining = budget_amount - total
        pct_used = min(total / budget_amount * 100, 100) if budget_amount > 0 else 0
        filled = int(pct_used / 10)
        bar = "█" * filled + "░" * (10 - filled)

        if remaining >= 0:
            reply += f"\n🎯 *Budget:* {budget_amount:,.0f} {currency}\n"
            reply += f"{bar} {pct_used:.0f}%\n"
            reply += f"✅ Remaining: *{remaining:,.0f} {currency}*"
        else:
            reply += f"\n🎯 *Budget:* {budget_amount:,.0f} {currency}\n"
            reply += f"{bar} {pct_used:.0f}%\n"
            reply += f"🚨 Over budget by: *{abs(remaining):,.0f} {currency}*"

    await update.message.reply_text(reply, parse_mode="Markdown")

def category_emoji(category: str) -> str:
    emojis = {
        "food": "🍔",
        "transport": "🚗",
        "shopping": "🛍️",
        "bills": "📄",
        "entertainment": "🎬",
        "health": "💊",
        "other": "📦"
    }
    return emojis.get(category, "📦")
from database import init_db, save_expense, get_monthly_summary, get_recent_expenses, delete_expense
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

async def history_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    expenses = get_recent_expenses(user_id, limit=10)

    if not expenses:
        await update.message.reply_text("No expenses recorded yet!")
        return

    # Build message with delete buttons
    text = "🧾 *Recent Expenses:*\n\n"
    keyboard = []

    for e in expenses:
        merchant = e.merchant or e.category
        text += f"`#{e.id}` {category_emoji(e.category)} *{e.amount:,.0f} {e.currency}* — {merchant} _{e.created_at.strftime('%d %b')}_\n"
        keyboard.append([
            InlineKeyboardButton(
                f"✏️ Edit #{e.id}",
                callback_data=f"edit_{e.id}"
            ),
            InlineKeyboardButton(
                f"🗑 Delete #{e.id}",
                callback_data=f"delete_{e.id}"
            )
        ])

    await update.message.reply_text(
        text,
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    action = query.data

    if action == "confirm":
        expense = context.user_data.get("pending_expense")
        transcript = context.user_data.get("transcript", "")
        user_id = str(query.from_user.id)
        save_expense(user_id, expense, transcript)
        await query.edit_message_text(
            f"💾 Saved!\n\n"
            f"💰 {expense['amount']} {expense['currency']} — {expense['category']}\n"
            f"🏪 {expense.get('merchant') or 'N/A'} | 📅 {expense.get('date', 'today')}"
        )

    elif action == "edit":
        await query.edit_message_text(
            "✏️ What would you like to correct? Tell me what's wrong.\n\n"
            "Example: _'amount should be 300'_ or _'category is transport not food'_",
            parse_mode="Markdown"
        )
        return WAITING_FOR_EDIT

    elif action == "cancel":
        context.user_data.pop("pending_expense", None)
        context.user_data.pop("transcript", None)
        await query.edit_message_text("❌ Cancelled. Expense discarded.")

    elif action.startswith("delete_"):
        expense_id = int(action.split("_")[1])
        user_id = str(query.from_user.id)
        success = delete_expense(user_id, expense_id)
        if success:
            await query.edit_message_text(f"🗑 Expense #{expense_id} deleted successfully.")
        else:
            await query.edit_message_text(f"❌ Couldn't find expense #{expense_id}.")
    elif action.startswith("edit_"):
        expense_id = int(action.split("_")[1])
        user_id = str(query.from_user.id)

        # Load the expense from DB
        session = Session()
        expense = session.query(Expense).filter_by(id=expense_id, telegram_user_id=user_id).first()
        session.close()

        if not expense:
            await query.edit_message_text("❌ Expense not found.")
            return

        # Store in context so edit handler knows what to update
        context.user_data["pending_expense"] = {
            "amount": expense.amount,
            "currency": expense.currency,
            "category": expense.category,
            "merchant": expense.merchant,
            "date": expense.date,
        }
        context.user_data["editing_expense_id"] = expense_id
        context.user_data["transcript"] = expense.transcript or ""

        await query.edit_message_text(
            f"✏️ Editing expense #{expense_id}:\n\n"
            f"💰 {expense.amount:,.0f} {expense.currency} — {expense.category}\n"
            f"🏪 {expense.merchant or 'N/A'}\n\n"
            "Tell me what to correct:\n"
            "_Example: 'amount should be 300' or 'merchant is Carrefour'_",
            parse_mode="Markdown"
        )
        return WAITING_FOR_EDIT
async def dashboard_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    raw = create_login_token(user_id, minutes=10)
    link = f"{FRONTEND_URL}/auth/telegram?t={raw}"
    await update.message.reply_text(f"📊 Open your dashboard:\n{link}")

async def budget_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)

    # If no arguments, show current budget
    if not context.args:
        budget_info = get_budget(user_id)
        if budget_info:
            amount, currency = budget_info
            total, _, _ = get_monthly_summary(user_id)
            remaining = amount - total
            pct_used = min(total / amount * 100, 100) if amount > 0 else 0
            filled = int(pct_used / 10)
            bar = "█" * filled + "░" * (10 - filled)

            status = f"✅ Remaining: *{remaining:,.0f} {currency}*" if remaining >= 0 else f"🚨 Over budget by: *{abs(remaining):,.0f} {currency}*"

            await update.message.reply_text(
                f"🎯 *Monthly Budget*\n\n"
                f"Budget: *{amount:,.0f} {currency}*\n"
                f"Spent: *{total:,.0f} {currency}*\n"
                f"{bar} {pct_used:.0f}%\n\n"
                f"{status}\n\n"
                f"_To change: /budget <amount>_",
                parse_mode="Markdown"
            )
        else:
            await update.message.reply_text(
                "No budget set yet!\n\n"
                "Set one with: `/budget 5000`",
                parse_mode="MarkdownV2"
            )
        return

    # Parse the amount
    try:
        amount = float(context.args[0].replace(",", ""))
        if amount <= 0:
            raise ValueError("Must be positive")
    except ValueError:
        await update.message.reply_text("❌ Please provide a valid amount, e.g. `/budget 5000`", parse_mode="Markdown")
        return

    currency = context.args[1].upper() if len(context.args) > 1 else "EGP"
    set_budget(user_id, amount, currency)

    await update.message.reply_text(
        f"✅ Monthly budget set to *{amount:,.0f} {currency}*\n\n"
        f"I'll show your budget status in /summary",
        parse_mode="Markdown"
    )
async def link_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    token = get_link_token(user_id)
    
    await update.message.reply_text(
        f"📱 *Link your WhatsApp account*\n\n"
        f"Send this message to your WhatsApp bot:\n\n"
        f"`/link {token}`\n\n"
        f"Token expires in 10 minutes.",
        parse_mode="Markdown"
    )

# Register in main():
def main():
    init_db()  # creates the DB file and tables if they don't exist
    app = Application.builder().token(os.getenv("TELEGRAM_BOT_TOKEN")).build()

    app.add_handler(CommandHandler("link", link_command))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))
    app.add_handler(CommandHandler("summary", summary_command)) 
    app.add_handler(CommandHandler("history", history_command))
    app.add_handler(CommandHandler("dashboard", dashboard_command))
    app.add_handler(CommandHandler("budget", budget_command))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND,
        handle_edit_message
    ))

    print("Bot is running...")
    app.run_polling()

if __name__ == "__main__":
    
    main()