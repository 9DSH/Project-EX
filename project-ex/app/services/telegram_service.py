# telegram_service.py
from telegram import Bot
import os

BOT_TOKEN = "8902030905:AAGavbOWc3qXQybryUgJUsKKM5hYzLNpxaA"
BACKEND_BASE_URL = "http://127.0.0.1:8000"  # used to build public URLs if needed

async def send_telegram_message(
    chat_id: int,                        # ← now takes chat_id directly
    text: str = None,
    media_type: str = None,
    media_url: str = None,               # ← local path like /static/uploads/abc.jpg
    media_file_id: str = None,           # ← kept for user→admin direction (Telegram file IDs)
):
    async with Bot(token=BOT_TOKEN) as bot:
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