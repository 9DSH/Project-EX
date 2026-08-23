import os
import sys
from telegram.request import HTTPXRequest
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters
import httpx
import logging

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

logger = logging.getLogger(__name__)


TOKEN = os.environ.get("SUPPORT_BOT_TOKEN")
API_URL = os.environ.get("API_URL", "http://127.0.0.1:8000")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("✅ Support bot ready. Send your message.")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):

    message = update.message
    if not message:
        return
    
        # ❌ BLOCK UNSUPPORTED TYPES
    is_text = bool(message.text or message.caption)
    is_photo = bool(message.photo)

    if not is_text and not is_photo:
        await message.reply_text(
            "⚠️ Unsupported message type.\n"
            "Please send only text or photo."
        )
        return

    telegram_id = update.effective_chat.id

    text = message.text or message.caption or ""


    media_type = None
    media_file_id = None

    if message.photo:
        media_type = "photo"
        media_file_id = message.photo[-1].file_id

    elif message.video:
        media_type = "video"
        media_file_id = message.video.file_id

    elif message.document:
        media_type = "document"
        media_file_id = message.document.file_id


    payload = {
        "telegram_id": telegram_id,
        "text": text,
        "media_type": media_type,
        "media_file_id": media_file_id
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                f"{API_URL}/support/messages/incoming",
                json=payload
            )

            print("📥 Backend Response Text:", res.text)

            if res.status_code != 200:
                print("Backend error:", res.text)

    except Exception as e:
        print("Request failed:", str(e))

async def error_handler(update, context):
    logger.error("Unhandled exception while processing update", exc_info=context.error)


def main():
    request = HTTPXRequest(
        connect_timeout=20.0,
        read_timeout=30.0,
        write_timeout=20.0,
        pool_timeout=20.0,
    )
    app = Application.builder().token(TOKEN).request(request).build()
    app.add_error_handler(error_handler)
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.ALL, handle_message))

    print("Support bot running...") 
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()