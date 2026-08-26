# telegram_service.py

from app.db.database import SessionLocal
from telegram import Bot
import os

# Tokens now live in the DB (set via the admin panel), not env vars.
# Don't crash at import time if it's unset — fall back to DB lookup at call time.
SUPPORT_BOT_TOKEN = os.environ.get("SUPPORT_BOT_TOKEN")
BACKEND_BASE_URL = os.environ.get("API_URL", "http://127.0.0.1:8000")


def _get_support_bot_token() -> str:
    if SUPPORT_BOT_TOKEN:
        return SUPPORT_BOT_TOKEN

    from app.db.database import SessionLocal
    from app.models.user import TelegramBotSettings, User

    db = SessionLocal()
    try:
        master = db.query(User).filter(User.role == "master").order_by(User.user_id).first()
        settings = (
            db.query(TelegramBotSettings).filter(
                TelegramBotSettings.admin_id == (master.user_id if master else -1),
                TelegramBotSettings.bot_kind == "support",
            ).first()
            if master else None
        )
        if not settings or not settings.main_bot_token:
            raise RuntimeError(
                "Support bot token not configured. Set it in the admin panel "
                "(Telegram Management → Global Bots) or via SUPPORT_BOT_TOKEN env var."
            )
        return settings.main_bot_token
    finally:
        db.close()
        

async def send_telegram_message(
    chat_id: int,                        # ← now takes chat_id directly
    text: str = None,
    media_type: str = None,
    media_url: str = None,               # ← local path like /static/uploads/abc.jpg
    media_file_id: str = None,           # ← kept for user→admin direction (Telegram file IDs)
):
    token = _get_support_bot_token()
    async with Bot(token=token) as bot:
        if not media_type:
            await bot.send_message(chat_id=chat_id, text=text or "")
            return

        # Prefer file_id (faster, no re-upload) — used when forwarding user's own photos back
        if media_file_id:
            if media_type == "photo":
                await bot.send_photo(chat_id=chat_id, photo=media_file_id, caption=text or "")
            elif media_type == "video":
                await bot.send_video(chat_id=chat_id, video=media_file_id, caption=text or "")
            elif media_type == "document":
                await bot.send_document(chat_id=chat_id, document=media_file_id, caption=text or "")
            return

        # For admin uploads: send from local disk
        if media_url:
            # Strip the /static prefix to get the real filesystem path
            local_path = media_url.lstrip("/") 
            if not os.path.exists(local_path):
                print("❌ File not found:", local_path)
                return
            with open(local_path, "rb") as f:
                if media_type == "photo":
                    await bot.send_photo(chat_id=chat_id, photo=f, caption=text or "")
                elif media_type == "video":
                    await bot.send_video(chat_id=chat_id, video=f, caption=text or "")
                elif media_type == "document":
                    await bot.send_document(chat_id=chat_id, document=f, caption=text or "")