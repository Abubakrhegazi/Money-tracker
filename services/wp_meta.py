# WAVE 2: WhatsApp — Flask-based Meta webhook handler removed for MVP.
# This file contained the full WhatsApp bot (wp_meta.py):
#   - Flask app with GET /whatsapp + POST /whatsapp webhook routes
#   - All command handlers: handle_help, handle_summary, handle_history,
#     handle_delete, handle_edit_start, handle_budget_view, handle_budget_set
#   - Meta Graph API message senders: send_message, send_buttons, send_list,
#     send_transaction_confirmation
#   - AI helpers: extract_transaction, apply_correction, transcribe_audio (Groq)
#   - Rate limiting (_rate_buckets) and message deduplication (_processed_messages)
#   - Pro plan gating for WhatsApp access
#   - create_login_token() for dashboard login via WhatsApp
# Re-add when WhatsApp integration is restored in Wave 2.
