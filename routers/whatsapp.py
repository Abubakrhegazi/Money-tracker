import logging
import json

from fastapi import APIRouter, Request, Query
from fastapi.responses import PlainTextResponse, JSONResponse

from core.config import VERIFY_TOKEN

logger = logging.getLogger("whatsapp")

router = APIRouter(prefix="/webhook", tags=["whatsapp"])


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
                    sender = message.get("from")  # phone number
                    msg_id = message.get("id")
                    msg_type = message.get("type")

                    if msg_type == "text":
                        text = message["text"]["body"]
                        logger.info(
                            "Text message from %s (id=%s): %s",
                            sender, msg_id, text,
                        )
                        # TODO: process message and send reply

                    elif msg_type == "audio":
                        logger.info(
                            "Audio message from %s (id=%s) — skipping for now",
                            sender, msg_id,
                        )

                    else:
                        logger.info(
                            "Unsupported message type '%s' from %s (id=%s)",
                            msg_type, sender, msg_id,
                        )
    except Exception:
        logger.exception("Error processing WhatsApp payload")

    # Always return 200 quickly so Meta doesn't retry
    return JSONResponse({"status": "ok"})
