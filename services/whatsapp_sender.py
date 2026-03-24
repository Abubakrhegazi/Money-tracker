"""
WhatsApp message sender — async helper using httpx.
"""
import logging

import httpx

from core.config import WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID

logger = logging.getLogger("whatsapp_sender")


async def send_whatsapp_message(to: str, text: str) -> dict:
    """Send a text message via the WhatsApp Business API."""
    url = f"https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"
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
