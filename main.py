import os
import json
import re
import signal
import logging
from groq import Groq
from database import (
    init_db, save_expense, get_monthly_summary, get_recent_expenses,
    delete_expense, create_login_token, Session, Expense, set_budget, get_budget,
    get_notification_settings, update_notification_settings, delete_user_data,
    get_link_token, save_investment, get_investments, get_investment_summary,
)
from datetime import datetime

FRONTEND_URL = "https://aurabot.website"

from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, MessageHandler, CallbackQueryHandler,
    filters, ContextTypes, ConversationHandler, CommandHandler
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("bot")

load_dotenv()
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Conversation states
WAITING_FOR_EDIT = 1

def format_expense_message(expense, transcript):
    etype = expense.get('type', 'expense')
    icon = "📥" if etype == "income" else "📤"
    return (
        f"✅ Got it!\n\n"
        f"{icon} Type: {etype.upper()}\n"
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

_GREETING_PATTERNS = re.compile(
    r'^\s*(hi|hello|hey|yo|sup|hola|morning|good\s*(morning|evening|afternoon|night)|'
    r'مرحبا|اهلا|هاي|صباح|مساء|السلام|سلام|ازيك|عامل|كيف|شكرا|thanks|thank you|ok|okay|bye|cool|nice|great|lol|haha|wow|yes|no|yep|nah|mhm)\s*[!?.]*\s*$',
    re.IGNORECASE
)

def is_greeting(text: str) -> bool:
    if _GREETING_PATTERNS.match(text):
        return True
    if len(text) < 30 and not re.search(r'\d', text):
        financial_kw = re.compile(
            r'(spent|paid|bought|cost|received|earned|salary|مرتب|صرفت|دفعت|اشتريت|استلمت|جالي|معايا|معي|عندي|جيبي|الف|مية)',
            re.IGNORECASE
        )
        if not financial_kw.search(text):
            return True
    return False

_INVESTMENT_KEYWORDS = re.compile(
    r'\b(invested?|bought\s+stock|crypto|bitcoin|ethereum|gold|استثمرت|شريت\s+(سهم|عمله|ذهب)|put\s+into)\b',
    re.IGNORECASE
)

def is_investment(text: str) -> bool:
    return bool(_INVESTMENT_KEYWORDS.search(text))

_ASSET_TYPE_MAP = {
    "stock": "stocks", "stocks": "stocks", "share": "stocks", "shares": "stocks",
    "crypto": "crypto", "bitcoin": "crypto", "ethereum": "crypto", "btc": "crypto", "eth": "crypto",
    "gold": "gold", "ذهب": "gold",
    "real estate": "real_estate", "property": "real_estate", "عقار": "real_estate",
}

async def extract_investment(transcript: str) -> dict:
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": """You are an investment parser. Extract investment details from the message.

Return ONLY this JSON:
{
  "entry_type": "investment",
  "asset_name": <specific name like "Tesla", "Bitcoin", "Gold" — never null>,
  "asset_type": <one of: stocks|crypto|gold|real_estate|other>,
  "amount": <number — the EGP/cash amount invested, or null if only quantity given>,
  "quantity": <number — grams for gold, units for crypto, shares for stocks, or null if not mentioned>,
  "ticker_symbol": <stock ticker like "TSLA", "AAPL", or null>,
  "coin_id": <coin name like "bitcoin", "ethereum", "solana", or null>,
  "currency": <"EGP" if not mentioned>,
  "date": <"today" if not mentioned>
}

asset_type mapping:
- stocks: shares, stock, سهم, بورصة — set ticker_symbol if mentioned
- crypto: bitcoin, ethereum, BTC, ETH, عمله رقمية — set coin_id to lowercase coin name
- gold: gold, ذهب — quantity is grams
- real_estate: property, apartment, عقار, شقه
- other: anything else

Examples:
"bought 10 grams of gold" → asset_type=gold, quantity=10, amount=null, ticker_symbol=null, coin_id=null
"invested 5000 in Tesla" → asset_type=stocks, amount=5000, ticker_symbol=TSLA, coin_id=null
"bought 0.1 bitcoin" → asset_type=crypto, quantity=0.1, amount=null, coin_id=bitcoin
"invested 50000 in bitcoin" → asset_type=crypto, amount=50000, coin_id=bitcoin

Arabic numbers: الف=1000, الفين=2000, مية=100.
If NOT a clear investment message, return {"error": "not_an_investment"}"""
            },
            {"role": "user", "content": transcript}
        ],
        response_format={"type": "json_object"}
    )
    result = json.loads(response.choices[0].message.content)
    if "error" not in result:
        if not result.get("currency"):
            result["currency"] = "EGP"
        # Must have either amount or quantity
        has_amount = result.get("amount") and result["amount"] > 0
        has_quantity = result.get("quantity") and result["quantity"] > 0
        if not has_amount and not has_quantity:
            return {"error": "no_amount"}
    return result


async def extract_expense(transcript: str) -> dict:
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": """You are a financial transaction parser. Your ONLY job is to extract transaction data from messages that CLEARLY describe spending or receiving money.

CRITICAL RULES:
1. The message MUST contain a specific monetary amount (a number). If there is NO number/amount, return {"error": "not_a_transaction"}
2. Greetings, questions, small talk, or vague statements are NOT transactions. Return {"error": "not_a_transaction"}
3. The merchant field should ONLY be a real business/store/person name. If none mentioned, set merchant to null. Do NOT use random words as merchant.
4. "hello", "hi", "hey", "good morning", etc. are NEVER transactions.
5. The category MUST be one of the exact values listed below. Never use any other category.

INCOME keywords: received, earned, got paid, salary, مرتب, استلمت, جالي, اتحوللي, refund, freelance, gift, معايا (Egyptian: "I have/got"), معي, عندي, جيبي, حصلت على, اتصرفلي
EXPENSE keywords: spent, paid, bought, cost, صرفت, دفعت, اشتريت, على

Return ONLY this JSON:
{
  "type": "income" or "expense",
  "amount": <number — MUST be a real number, never null>,
  "currency": <"EGP" if not mentioned>,
  "category": <for expenses: food|transport|shopping|bills|entertainment|health|education|investment|other>,
             <for income: salary|freelance|gift|refund|investment|other_income>,
  "merchant": <real business/person name or null>,
  "date": <"today" if not mentioned>
}
Arabic numbers: الف=1000, الفين=2000, تلاتالاف=3000, مية=100.
Always add parts together, never ignore the thousands part.
If NOT a clear financial transaction with a specific amount, return {"error": "not_a_transaction"}"""
            },
            {"role": "user", "content": transcript}
        ],
        response_format={"type": "json_object"}
    )
    result = json.loads(response.choices[0].message.content)
    # Post-parse validation
    if "error" not in result:
        amount = result.get("amount")
        if amount is None or amount == 0 or not isinstance(amount, (int, float)):
            return {"error": "no_amount"}
        if not result.get("currency"):
            result["currency"] = "EGP"
    return result

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Ignore commands
    if update.message.text.startswith("/"):
        return
    
    # If we're waiting for an edit correction, don't treat it as a new expense
    if context.user_data.get("pending_expense") or context.user_data.get("editing_expense_id"):
        await handle_edit_message(update, context)
        return

    transcript = update.message.text

    # Catch greetings without calling AI
    if is_greeting(transcript):
        await update.message.reply_text(
            "👋 Hey! I'm your finance tracker.\n\n"
            "Log an expense: 'spent 50 on lunch'\n"
            "Log income: 'received 5000 salary'\n\n"
            "Or send /help for all commands."
        )
        return

    # Check for investment intent before transaction parsing
    if is_investment(transcript):
        investment = await extract_investment(transcript)
        if "error" not in investment:
            user_id = str(update.effective_user.id)
            from datetime import date as _date
            inv_date = investment.get("date", "today")
            if inv_date == "today":
                inv_date = _date.today().isoformat()

            asset_type = investment.get("asset_type", "other")
            asset_name = investment["asset_name"]
            quantity = investment.get("quantity")
            amount = investment.get("amount")
            ticker = investment.get("ticker_symbol")
            coin_id = investment.get("coin_id")
            currency = investment.get("currency", "EGP")

            # Attempt live price fetch to fill in amount or enrich data
            price_per_unit = None
            live_price_note = ""
            try:
                from price_fetcher import (
                    get_gold_price_per_gram_egp, get_stock_price_egp,
                    get_crypto_price_egp, normalize_coin_id
                )
                if asset_type == "gold" and quantity:
                    price_per_unit = get_gold_price_per_gram_egp()
                    amount = quantity * price_per_unit
                    live_price_note = f"_{price_per_unit:,.0f} EGP/gram_"
                elif asset_type == "stocks" and ticker and not amount:
                    price_egp, _ = get_stock_price_egp(ticker)
                    price_per_unit = price_egp
                    if quantity:
                        amount = quantity * price_egp
                    live_price_note = f"_{price_egp:,.2f} EGP/share_"
                elif asset_type == "stocks" and ticker and amount:
                    price_egp, _ = get_stock_price_egp(ticker)
                    price_per_unit = price_egp
                    live_price_note = f"_{price_egp:,.2f} EGP/share_"
                elif asset_type == "crypto" and coin_id:
                    norm_id = normalize_coin_id(coin_id)
                    price_egp = get_crypto_price_egp(norm_id)
                    price_per_unit = price_egp
                    if quantity and not amount:
                        amount = quantity * price_egp
                    live_price_note = f"_{price_egp:,.2f} EGP/{coin_id}_"
            except Exception as e:
                logger.warning(f"Live price fetch failed during bot parse: {e}")

            if not amount or amount <= 0:
                await update.message.reply_text(
                    f"⚠️ Couldn't determine investment amount. Please specify a value, e.g.:\n"
                    f"_\"invested 5000 EGP in {asset_name}\"_",
                    parse_mode="Markdown"
                )
                return

            save_investment(user_id, {
                "asset_name": asset_name,
                "asset_type": asset_type,
                "amount_invested": amount,
                "currency": currency,
                "date": inv_date,
                "grams": quantity if asset_type == "gold" else None,
                "ticker_symbol": ticker,
                "coin_id": normalize_coin_id(coin_id) if coin_id else None,
                "price_per_unit": price_per_unit,
            })

            type_labels = {"stocks": "📈 Stocks", "crypto": "₿ Crypto", "gold": "🥇 Gold", "real_estate": "🏠 Real Estate", "other": "💼 Other"}
            asset_type_label = type_labels.get(asset_type, "💼 Other")

            # Build confirmation
            if asset_type == "gold" and quantity:
                confirm = (
                    f"💹 *Investment Logged!*\n\n"
                    f"🥇 *{quantity:g}g Gold*\n"
                    f"💰 Value: *{amount:,.0f} EGP*\n"
                    f"{live_price_note}\n"
                    f"📅 Date: {inv_date}"
                )
            else:
                confirm = (
                    f"💹 *Investment Logged!*\n\n"
                    f"📦 Asset: *{asset_name}*\n"
                    f"🏷 Type: {asset_type_label}\n"
                    f"💰 Amount: *{amount:,.0f} {currency}*\n"
                )
                if live_price_note:
                    confirm += f"{live_price_note}\n"
                confirm += f"📅 Date: {inv_date}"

            confirm += "\n\n_Use /investments to see your portfolio._"
            await update.message.reply_text(confirm, parse_mode="Markdown")
            return

    expense = await extract_expense(transcript)

    if "error" in expense:
        await update.message.reply_text(
            "I didn't recognize that as a transaction.\n\n"
            "Try: 'spent 150 on lunch' or 'received 5000 salary'"
        )
        return

    context.user_data["pending_expense"] = expense
    context.user_data["transcript"] = transcript

    await update.message.reply_text(
        format_expense_message(expense, transcript),
        parse_mode="Markdown",
        reply_markup=confirm_keyboard()
    )
async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE):
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

    # Catch greetings
    if is_greeting(transcript):
        await update.message.reply_text(
            f"🎤 Heard: {transcript}\n\n"
            "👋 Hey! I'm your finance tracker.\n\n"
            "Log an expense: 'spent 50 on lunch'\n"
            "Log income: 'received 5000 salary'"
        )
        return

    expense = await extract_expense(transcript)

    if "error" in expense:
        await update.message.reply_text(
            f"🎤 Heard: {transcript}\n\nCouldn't identify a transaction. Try again!"
        )
        return

    context.user_data["pending_expense"] = expense
    context.user_data["transcript"] = transcript

    await update.message.reply_text(
        format_expense_message(expense, transcript),
        parse_mode="Markdown",
        reply_markup=confirm_keyboard()
    )

async def handle_edit_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    correction = update.message.text
    original_expense = context.user_data.get("pending_expense", {})
    editing_id = context.user_data.get("editing_expense_id")

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": """You are correcting a financial entry (expense or income).
                Apply the user's correction to the existing JSON and return the updated JSON only.
                Keep all fields that aren't being corrected unchanged.
                Return ONLY valid JSON with fields: type, amount, currency, category, merchant, date."""
            },
            {
                "role": "user",
                "content": f"Existing entry: {json.dumps(original_expense)}\nCorrection: {correction}"
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
                record.entry_type = updated_expense.get("type", record.entry_type or "expense")
                session.commit()
        finally:
            session.close()

        context.user_data.pop("editing_expense_id", None)
        etype = updated_expense.get("type", "expense")
        icon = "📥" if etype == "income" else "📤"
        await update.message.reply_text(
            f"✅ Entry #{editing_id} updated!\n\n"
            f"{icon} {etype.upper()}\n"
            f"💰 {updated_expense['amount']:,.0f} {updated_expense.get('currency', 'EGP')} — {updated_expense.get('category')}\n"
            f"🏪 {updated_expense.get('merchant') or 'N/A'}"
        )
    else:
        # New entry pending confirmation
        await update.message.reply_text(
            "Here's the updated entry:\n\n" +
            format_expense_message(updated_expense, transcript),
            parse_mode="Markdown",
            reply_markup=confirm_keyboard()
        )

async def summary_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    expense_total, breakdown, count, income_total = get_monthly_summary(user_id)

    if count == 0:
        await update.message.reply_text("No transactions recorded this month yet!")
        return

    net = income_total - expense_total
    net_emoji = "🟢" if net >= 0 else "🔴"

    # build category breakdown text
    breakdown_text = ""
    for category, amount in sorted(breakdown.items(), key=lambda x: x[1], reverse=True):
        percentage = (amount / expense_total) * 100 if expense_total > 0 else 0
        breakdown_text += f"  {category_emoji(category)} {category}: {amount:,.0f} EGP ({percentage:.0f}%)\n"

    reply = (
        f"📊 *Monthly Summary — {datetime.utcnow().strftime('%B %Y')}*\n\n"
        f"📥 Income: *{income_total:,.0f} EGP*\n"
        f"📤 Expenses: *{expense_total:,.0f} EGP*\n"
        f"{net_emoji} Net: *{net:+,.0f} EGP*\n"
        f"🧳 Transactions: {count}\n"
    )

    if breakdown_text:
        reply += f"\n*Expenses by Category:*\n{breakdown_text}"

    # Add budget info if set
    budgets = get_budget(user_id)
    if budgets:
        reply += "\n🎯 *Budgets:*\n"
        for cat, budget_amount in budgets.items():
            cat_spent = breakdown.get(cat, 0)
            remaining = budget_amount - cat_spent
            pct_used = min(cat_spent / budget_amount * 100, 100) if budget_amount > 0 else 0
            filled = int(pct_used / 10)
            bar = "█" * filled + "░" * (10 - filled)
            indicator = "🟢" if pct_used < 80 else ("🟡" if pct_used < 100 else "🔴")
            reply += f"{indicator} {cat}: {cat_spent:,.0f}/{budget_amount:,.0f} EGP {bar} {pct_used:.0f}%\n"

    await update.message.reply_text(reply, parse_mode="Markdown")

def category_emoji(category: str) -> str:
    emojis = {
        "food": "🍔", "transport": "🚗", "shopping": "🛍️",
        "bills": "📄", "entertainment": "🎬", "health": "💊",
        "education": "📚", "other": "📦",
        "salary": "💵", "freelance": "💻", "gift": "🎁",
        "refund": "🔄", "investment": "📈", "other_income": "💰"
    }
    return emojis.get(category, "📦")
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
        context.user_data.pop("pending_expense", None)
        context.user_data.pop("transcript", None)
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

    elif action == "deleteaccount_confirm":
        user_id = str(query.from_user.id)
        success = delete_user_data(user_id)
        if success:
            await query.edit_message_text(
                "🗑 *Account Deleted*\n\n"
                "All your data has been permanently removed.\n"
                "Send /start if you'd like to begin fresh.",
                parse_mode="Markdown"
            )
            logger.info(f"User {user_id} deleted their account")
        else:
            await query.edit_message_text("❌ Something went wrong. Please try again later.")

    elif action == "deleteaccount_cancel":
        await query.edit_message_text("✅ Account deletion cancelled. Your data is safe.")

async def dashboard_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    raw = create_login_token(user_id, minutes=10)
    link = f"{FRONTEND_URL}/auth/telegram?t={raw}"
    await update.message.reply_text(f"📊 Open your dashboard:\n{link}")

async def budget_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)

    # If no arguments, show current budgets
    if not context.args:
        budgets = get_budget(user_id)
        if budgets:
            total, breakdown, *_ = get_monthly_summary(user_id)
            reply = "🎯 *Monthly Budgets*\n\n"
            for cat, amount in budgets.items():
                spent = breakdown.get(cat, 0)
                remaining = amount - spent
                pct_used = min(spent / amount * 100, 100) if amount > 0 else 0
                filled = int(pct_used / 10)
                bar = "█" * filled + "░" * (10 - filled)
                status = f"✅ {remaining:,.0f} left" if remaining >= 0 else f"🚨 Over by {abs(remaining):,.0f}"
                reply += f"{cat}: *{amount:,.0f} EGP*\n{bar} {pct_used:.0f}% | {status}\n\n"
            reply += "_To change: /budget <category> <amount>_"
            await update.message.reply_text(reply, parse_mode="Markdown")
        else:
            await update.message.reply_text(
                "No budgets set yet!\n\n"
                "Set one with: `/budget food 5000`",
                parse_mode="Markdown"
            )
        return

    if len(context.args) < 2:
        await update.message.reply_text(
            "Usage: `/budget <category> <amount>`\nExample: `/budget food 3000`",
            parse_mode="Markdown"
        )
        return

    category = context.args[0].lower()
    try:
        amount = float(context.args[1].replace(",", ""))
        if amount <= 0:
            raise ValueError("Must be positive")
    except ValueError:
        await update.message.reply_text("❌ Please provide a valid amount, e.g. `/budget food 5000`", parse_mode="Markdown")
        return

    set_budget(user_id, category, amount)

    await update.message.reply_text(
        f"✅ Budget for *{category}* set to *{amount:,.0f} EGP*\n\n"
        f"I'll show your budget status in /summary",
        parse_mode="Markdown"
    )
async def investments_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    investments = get_investments(user_id)
    summary = get_investment_summary(user_id)

    if not investments:
        await update.message.reply_text(
            "📊 *No investments recorded yet!*\n\n"
            "Just tell me what you invested:\n"
            "_\"invested 10000 in Bitcoin\"_\n"
            "_\"bought Tesla stock for 500 USD\"_\n"
            "_\"استثمرت 50000 في ذهب\"_",
            parse_mode="Markdown"
        )
        return

    total_invested = summary["total_invested"]
    current_value = summary["current_value"]
    total_gain = summary["total_gain"]
    gain_pct = summary["gain_percentage"]

    reply = f"💹 *Investment Portfolio*\n\n"
    reply += f"💰 Total Invested: *{total_invested:,.0f} EGP*\n"
    if current_value is not None:
        gain_emoji = "📈" if (total_gain or 0) >= 0 else "📉"
        reply += f"📊 Current Value: *{current_value:,.0f} EGP*\n"
        reply += f"{gain_emoji} Gain/Loss: *{total_gain:+,.0f} EGP* ({gain_pct:+.1f}%)\n"
    reply += f"📦 Holdings: {len(investments)}\n"

    if summary["breakdown"]:
        reply += "\n*By Type:*\n"
        type_icons = {"stocks": "📈", "crypto": "₿", "gold": "🥇", "real_estate": "🏠", "other": "💼"}
        for atype, amt in sorted(summary["breakdown"].items(), key=lambda x: x[1], reverse=True):
            icon = type_icons.get(atype, "💼")
            reply += f"  {icon} {atype.replace('_', ' ').title()}: {amt:,.0f} EGP\n"

    reply += "\n*Recent:*\n"
    for inv in investments[:5]:
        reply += f"  • {inv.asset_name} — {inv.amount_invested:,.0f} {inv.currency} _{inv.date}_\n"

    reply += "\n_Open /dashboard for full portfolio view._"
    await update.message.reply_text(reply, parse_mode="Markdown")


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

# ── /notifications command ─────────────────────────────────────────────

DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

async def notifications_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = str(update.effective_user.id)
    args = context.args

    settings = get_notification_settings(user_id)

    if not args:
        # Show current settings
        daily_status = "✅ ON" if settings["daily_enabled"] else "❌ OFF"
        weekly_status = "✅ ON" if settings["weekly_enabled"] else "❌ OFF"
        day_name = DAY_NAMES[settings["weekly_day"]] if 0 <= settings["weekly_day"] < 7 else "Sunday"
        reply = (
            "🔔 *Notification Settings*\n\n"
            f"📅 Daily summary: {daily_status}\n"
            f"    Time: {settings['daily_time']} ({settings['timezone']})\n\n"
            f"📊 Weekly summary: {weekly_status}\n"
            f"    Day: {day_name}\n\n"
            "*Commands:*\n"
            "`/notifications daily` — toggle daily\n"
            "`/notifications weekly` — toggle weekly\n"
            "`/notifications time 9pm` — set time\n"
            "`/notifications off` — disable all"
        )
        await update.message.reply_text(reply, parse_mode="Markdown")
        return

    subcmd = args[0].lower()

    if subcmd == "off":
        update_notification_settings(user_id, daily_enabled=False, weekly_enabled=False)
        await update.message.reply_text("🔕 All notifications disabled.\n\nUse `/notifications daily` or `/notifications weekly` to re-enable.", parse_mode="Markdown")

    elif subcmd == "daily":
        new_val = not settings["daily_enabled"]
        update_notification_settings(user_id, daily_enabled=new_val)
        status = "✅ ON" if new_val else "❌ OFF"
        await update.message.reply_text(f"📅 Daily summary: {status}")

    elif subcmd == "weekly":
        new_val = not settings["weekly_enabled"]
        update_notification_settings(user_id, weekly_enabled=new_val)
        status = "✅ ON" if new_val else "❌ OFF"
        await update.message.reply_text(f"📊 Weekly summary: {status}")

    elif subcmd == "time":
        if len(args) < 2:
            await update.message.reply_text("Usage: `/notifications time 9pm`", parse_mode="Markdown")
            return
        raw = args[1].lower().strip()
        # Parse: "9pm", "10pm", "22:00", "21", etc.
        hour = None
        m = re.match(r'^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$', raw)
        if m:
            h = int(m.group(1))
            period = m.group(3)
            if period == "pm" and h < 12:
                h += 12
            elif period == "am" and h == 12:
                h = 0
            if 0 <= h <= 23:
                hour = h
        if hour is None:
            await update.message.reply_text("❌ Invalid time. Try: `9pm`, `22:00`, or `21`", parse_mode="Markdown")
            return
        time_str = f"{hour:02d}:00"
        update_notification_settings(user_id, daily_time=time_str)
        period_label = "AM" if hour < 12 else "PM"
        h12 = hour % 12 or 12
        await update.message.reply_text(f"⏰ Daily summary time set to *{h12}:00 {period_label}*", parse_mode="Markdown")

    else:
        await update.message.reply_text(
            "Unknown option. Try:\n"
            "`/notifications daily`\n"
            "`/notifications weekly`\n"
            "`/notifications time 9pm`\n"
            "`/notifications off`",
            parse_mode="Markdown"
        )
# ── /start onboarding ──────────────────────────────────────────────

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 *Welcome to Aura — your personal finance tracker!*\n\n"
        "🎯 *Here's what I can do:*\n\n"
        "💸 *Track spending* — just tell me what you spent:\n"
        "   _\"spent 150 on lunch\"_ or _\"paid 500 for uber\"_\n\n"
        "💰 *Track income* — log what you earned:\n"
        "   _\"received 5000 salary\"_ or _\"got 200 freelance\"_\n\n"
        "🎙 *Voice messages* — send a voice note and I'll transcribe it!\n\n"
        "📊 *Commands:*\n"
        "/summary — monthly overview\n"
        "/history — recent transactions\n"
        "/investments — investment portfolio\n"
        "/budget food 3000 — set a budget\n"
        "/dashboard — open web dashboard\n"
        "/notifications — configure daily/weekly summaries\n"
        "/help — all commands\n\n"
        "✨ _Try sending your first expense now!_",
        parse_mode="Markdown"
    )

# ── /help command ─────────────────────────────────────────────────

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📖 *All Commands*\n\n"
        "💸 *Tracking*\n"
        "  Just type: _\"spent 50 on coffee\"_\n"
        "  Or send a voice message!\n\n"
        "📊 *Reports*\n"
        "  /summary — monthly spending overview\n"
        "  /history — last 10 transactions (edit/delete)\n"
        "  /investments — investment portfolio\n\n"
        "🎯 *Budgets*\n"
        "  /budget — view all budgets\n"
        "  /budget food 3000 — set budget for a category\n\n"
        "🔔 *Notifications*\n"
        "  /notifications — view settings\n"
        "  /notifications daily — toggle daily summary\n"
        "  /notifications weekly — toggle weekly summary\n"
        "  /notifications time 9pm — set summary time\n"
        "  /notifications off — disable all\n\n"
        "📱 *Other*\n"
        "  /dashboard — open web dashboard\n"
        "  /link — link WhatsApp account\n"
        "  /deleteaccount — delete all your data\n\n"
        "🔒 *Categories:*\n"
        "  food | transport | shopping | bills\n"
        "  entertainment | health | education | other",
        parse_mode="Markdown"
    )

# ── /deleteaccount command ────────────────────────────────────────

async def deleteaccount_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("⚠️ Yes, delete everything", callback_data="deleteaccount_confirm"),
            InlineKeyboardButton("❌ Cancel", callback_data="deleteaccount_cancel"),
        ]
    ])
    await update.message.reply_text(
        "⚠️ *Delete Account*\n\n"
        "This will *permanently* delete ALL your data:\n"
        "• All transactions\n"
        "• All budgets\n"
        "• Notification settings\n"
        "• Linked accounts\n\n"
        "_This action cannot be undone._\n\n"
        "Are you sure?",
        parse_mode="Markdown",
        reply_markup=keyboard
    )

# ── Global error handler ──────────────────────────────────────────

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE):
    """Global error handler — logs error, sends friendly fallback to user."""
    logger.error(f"Unhandled exception: {context.error}", exc_info=context.error)
    if update and isinstance(update, Update) and update.effective_message:
        try:
            await update.effective_message.reply_text(
                "❌ Something went wrong. Please try again.\n"
                "If this keeps happening, send /help."
            )
        except Exception:
            pass  # can't even send error message, ignore


def main():
    init_db()
    app = Application.builder().token(os.getenv("TELEGRAM_BOT_TOKEN")).build()

    # ── Start APScheduler ─────────────────────────────────────────
    from apscheduler.schedulers.background import BackgroundScheduler
    from notifications import run_daily_check, run_weekly_check
    from apscheduler.triggers.cron import CronTrigger
    from backup import run_backup

    scheduler = BackgroundScheduler()
    scheduler.add_job(run_daily_check, "interval", hours=1, id="daily_check",
                      next_run_time=datetime.now())
    scheduler.add_job(run_weekly_check, "interval", hours=1, id="weekly_check")
    scheduler.add_job(
        run_backup,
        trigger=CronTrigger(hour=3, minute=0, timezone="Africa/Cairo"),
        id="daily_backup",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    # Price refresh every 6 hours
    try:
        from price_fetcher import refresh_all_investment_prices
        scheduler.add_job(
            refresh_all_investment_prices,
            "interval", hours=6,
            id="investment_price_refresh",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        logger.info("Investment price refresh job scheduled (every 6h)")
    except Exception as e:
        logger.warning(f"Could not schedule price refresh: {e}")
    scheduler.start()
    logger.info("APScheduler started (notifications hourly, backup at 3am Cairo)")

    # ── Handlers ──────────────────────────────────────────────────
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("link", link_command))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))
    app.add_handler(CommandHandler("summary", summary_command))
    app.add_handler(CommandHandler("history", history_command))
    app.add_handler(CommandHandler("dashboard", dashboard_command))
    app.add_handler(CommandHandler("budget", budget_command))
    app.add_handler(CommandHandler("notifications", notifications_command))
    app.add_handler(CommandHandler("investments", investments_command))
    app.add_handler(CommandHandler("deleteaccount", deleteaccount_command))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    # ── Error handler ─────────────────────────────────────────────
    app.add_error_handler(error_handler)

    # ── Graceful shutdown ─────────────────────────────────────────
    def shutdown(signum, frame):
        logger.info(f"Received signal {signum}, shutting down...")
        scheduler.shutdown(wait=False)
    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    logger.info("Bot is running...")
    app.run_polling()

if __name__ == "__main__":
    main()