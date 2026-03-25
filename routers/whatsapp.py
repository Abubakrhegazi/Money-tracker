"""
WhatsApp webhook router — processes messages the same way Telegram does.
"""
import logging
import json
import os
import tempfile

import httpx
from fastapi import APIRouter, Request, Query
from fastapi.responses import PlainTextResponse, JSONResponse

from core.config import VERIFY_TOKEN, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
from core.database import save_expense, save_investment, get_link_token
from main import (
    is_greeting, is_investment, extract_investment, extract_expense,
    groq_client,
)

logger = logging.getLogger("whatsapp")

router = APIRouter(prefix="/webhook", tags=["whatsapp"])

GRAPH_API = "https://graph.facebook.com/v18.0"


# ── Send reply helper ────────────────────────────────────────────────────

async def send_whatsapp_message(to: str, text: str) -> dict:
    """Send a text message via the WhatsApp Business API."""
    url = f"{GRAPH_API}/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    body = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=body)
        resp.raise_for_status()
        return resp.json()


# ── Audio download + transcription ───────────────────────────────────────

async def _download_whatsapp_audio(media_id: str) -> bytes:
    """Fetch audio bytes from WhatsApp media API (two-step: get URL, then download)."""
    headers = {"Authorization": f"Bearer {WHATSAPP_TOKEN}"}
    async with httpx.AsyncClient(timeout=30) as client:
        # Step 1: get the download URL
        meta = await client.get(f"{GRAPH_API}/{media_id}", headers=headers)
        meta.raise_for_status()
        download_url = meta.json()["url"]
        # Step 2: download the actual file
        audio = await client.get(download_url, headers=headers)
        audio.raise_for_status()
        return audio.content


async def _transcribe_audio(audio_bytes: bytes) -> str:
    """Save audio to a temp file and transcribe with Groq Whisper."""
    with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        with open(tmp_path, "rb") as f:
            transcription = groq_client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=f,
            )
        return transcription.text
    finally:
        os.remove(tmp_path)


# ── Message processing (mirrors main.py Telegram flow) ──────────────────

async def _process_text(sender: str, text: str):
    """Process a text message: greeting → investment → expense → error."""

    # /link command
    if text.strip().lower() == "/link":
        try:
            token = get_link_token(sender)
            await send_whatsapp_message(
                sender,
                f"🔗 Your link token: {token}\n\n"
                "Go to aurabot.website and enter this token to link your WhatsApp account.",
            )
        except Exception:
            logger.exception("Link token generation failed for %s", sender)
            await send_whatsapp_message(sender, "❌ Something went wrong, try again.")
        return

    # Greeting check
    if is_greeting(text):
        await send_whatsapp_message(
            sender,
            "👋 Hey! I'm Aura, your finance tracker.\n\n"
            "Log an expense: 'spent 200 on food'\n"
            "Log income: 'received 5000 salary'",
        )
        return

    # Investment check (no plan gate for WhatsApp)
    if is_investment(text):
        try:
            investment = await extract_investment(text)
            if "error" not in investment:
                await _save_and_reply_investment(sender, investment)
                return
        except Exception:
            logger.exception("Investment extraction failed for %s", sender)
        # Fall through to expense if investment extraction fails or returns error

    # Expense / income parse
    try:
        expense = await extract_expense(text)
    except Exception:
        logger.exception("Expense extraction failed for %s", sender)
        await send_whatsapp_message(sender, "❌ Something went wrong, try again.")
        return

    if "error" in expense:
        await send_whatsapp_message(
            sender,
            "مش فاهم، جرب تاني 🤔\n\n"
            "Try: 'spent 150 on lunch' or 'صرفت ٢٠٠ على أكل'",
        )
        return

    # Save expense immediately (no confirm/edit flow)
    try:
        save_expense(sender, expense, text)
    except Exception:
        logger.exception("save_expense failed for %s", sender)
        await send_whatsapp_message(sender, "❌ Something went wrong, try again.")
        return

    # Reply
    etype = expense.get("type", "expense")
    amount = expense.get("amount", 0)
    currency = expense.get("currency", "EGP")
    category = expense.get("category", "other")
    merchant = expense.get("merchant") or "N/A"
    date = expense.get("date", "today")

    if etype == "income":
        reply = (
            f"✅ Saved!\n\n"
            f"📥 Income: {amount:,.0f} {currency}\n"
            f"📂 Category: {category}\n"
            f"📅 Date: {date}"
        )
    else:
        reply = (
            f"✅ Saved!\n\n"
            f"💰 Amount: {amount:,.0f} {currency}\n"
            f"📂 Category: {category}\n"
            f"🏪 Merchant: {merchant}\n"
            f"📅 Date: {date}"
        )
    await send_whatsapp_message(sender, reply)


async def _save_and_reply_investment(sender: str, investment: dict):
    """Price-fetch, save investment, and reply — mirrors main.py logic."""
    from datetime import date as _date

    inv_date = investment.get("date", "today")
    if inv_date == "today":
        inv_date = _date.today().isoformat()

    asset_type = investment.get("asset_type", "other")
    raw_name = investment.get("asset_name", "Investment").strip()
    asset_name = " ".join(w.capitalize() for w in raw_name.split()) if raw_name else "Investment"
    quantity = investment.get("quantity")
    amount = investment.get("amount")
    ticker = investment.get("ticker_symbol")
    coin_id = investment.get("coin_id")
    forex_pair = investment.get("forex_pair")
    currency = investment.get("currency", "EGP")

    # Live price fetch
    price_per_unit = None
    try:
        from services.price_fetcher import (
            get_gold_price_per_gram_egp, get_stock_price_egp,
            get_crypto_price_egp, normalize_coin_id, get_egp_rate,
        )

        if asset_type == "gold" and quantity:
            price_per_unit = get_gold_price_per_gram_egp()
            amount = quantity * price_per_unit
        elif asset_type == "stocks" and ticker and not amount:
            price_egp, _ = get_stock_price_egp(ticker)
            price_per_unit = price_egp
            if quantity:
                amount = quantity * price_egp
        elif asset_type == "stocks" and ticker and amount:
            price_egp, _ = get_stock_price_egp(ticker)
            price_per_unit = price_egp
            if currency and currency.upper() != "EGP":
                rate = get_egp_rate(currency.upper())
                amount = amount * rate
        elif asset_type == "crypto" and coin_id:
            norm_id = normalize_coin_id(coin_id)
            price_egp = get_crypto_price_egp(norm_id)
            price_per_unit = price_egp
            if quantity and not amount:
                amount = quantity * price_egp
            elif amount and currency and currency.upper() != "EGP":
                rate = get_egp_rate(currency.upper())
                amount = amount * rate
        elif asset_type == "currency" and forex_pair:
            rate = get_egp_rate(forex_pair.upper())
            price_per_unit = rate
            if quantity and not amount:
                amount = quantity * rate
            elif amount:
                quantity = amount
                amount = amount * rate
        else:
            if amount and currency and currency.upper() != "EGP":
                rate = get_egp_rate(currency.upper())
                amount = amount * rate
    except Exception as e:
        logger.warning("Live price fetch failed: %s", e)

    if not amount or amount <= 0:
        await send_whatsapp_message(
            sender,
            f"⚠️ Couldn't determine investment amount. Please specify a value, e.g.:\n"
            f"\"invested 5000 EGP in {asset_name}\"",
        )
        return

    # Normalize coin_id for DB storage
    try:
        from services.price_fetcher import normalize_coin_id
        norm_coin = normalize_coin_id(coin_id) if coin_id else None
    except Exception:
        norm_coin = coin_id

    save_investment(sender, {
        "asset_name": asset_name,
        "asset_type": asset_type,
        "amount_invested": amount,
        "currency": "EGP",
        "date": inv_date,
        "grams": quantity if asset_type == "gold" else None,
        "ticker_symbol": ticker,
        "coin_id": norm_coin,
        "forex_pair": forex_pair.upper() if forex_pair else None,
        "price_per_unit": price_per_unit,
    })

    # Plain text confirmation
    if asset_type == "gold" and quantity:
        reply = (
            f"💹 Investment Saved!\n\n"
            f"🥇 {quantity:g}g Gold\n"
            f"💰 Value: {amount:,.0f} EGP\n"
            f"📅 {inv_date}"
        )
    else:
        reply = (
            f"💹 Investment Saved!\n\n"
            f"📦 {asset_name}\n"
            f"💰 {amount:,.0f} EGP\n"
            f"📅 {inv_date}"
        )
    await send_whatsapp_message(sender, reply)


# ── Webhook verification (Meta sends GET on setup) ─────────────────────

@router.get("/whatsapp")
async def verify_webhook(
    request: Request,
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
        logger.info("Webhook verified successfully")
        return PlainTextResponse(hub_challenge)
    logger.warning("Webhook verification failed (bad token or mode)")
    return PlainTextResponse("Forbidden", status_code=403)


# ── Incoming messages (Meta sends POST) ─────────────────────────────────

@router.post("/whatsapp")
async def receive_message(request: Request):
    payload = await request.json()
    logger.info("Raw WhatsApp payload: %s", json.dumps(payload, indent=2))

    try:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})

                # Ignore status updates (delivered, read, sent)
                if "statuses" in value:
                    continue

                for message in value.get("messages", []):
                    sender = message.get("from")
                    msg_id = message.get("id")
                    msg_type = message.get("type")

                    if msg_type == "text":
                        text = message["text"]["body"]
                        logger.info("Text from %s (id=%s): %s", sender, msg_id, text)
                        await _process_text(sender, text)

                    elif msg_type == "audio":
                        logger.info("Audio from %s (id=%s)", sender, msg_id)
                        try:
                            media_id = message["audio"]["id"]
                            audio_bytes = await _download_whatsapp_audio(media_id)
                            transcript = await _transcribe_audio(audio_bytes)
                            logger.info("Transcription for %s: %s", sender, transcript)
                            await _process_text(sender, transcript)
                        except Exception:
                            logger.exception("Audio processing failed for %s", sender)
                            await send_whatsapp_message(
                                sender, "❌ Couldn't process your voice message, try again."
                            )

                    else:
                        logger.info(
                            "Unsupported type '%s' from %s (id=%s)",
                            msg_type, sender, msg_id,
                        )
    except Exception:
        logger.exception("Error processing WhatsApp payload")

    # Always return 200 quickly so Meta doesn't retry
    return JSONResponse({"status": "ok"})
