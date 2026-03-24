"""
WhatsApp bot entry point — mirrors main.py for Telegram.
Railway start command: python whatsapp.py
"""
from core.database import init_db
from core.config import PORT
from services.wp_meta import app

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=PORT, debug=False)
