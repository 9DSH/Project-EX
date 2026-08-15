from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import httpx
import uuid
import os
from telegram import Bot
from app.db.database import get_db
from app.models.user import User
from app.models.messages import Conversation, Message
from app.services.ws_manager import manager

router = APIRouter(prefix="/support/messages", tags=["Support Messages"])


BOT_TOKEN = "8902030905:AAGavbOWc3qXQybryUgJUsKKM5hYzLNpxaA"
UPLOADS_DIR = "uploads/telegram"

# =========================
# REQUEST SCHEMA
# =========================
class SupportIncoming(BaseModel):
    telegram_id: int
    text: str | None = None
    media_type: str | None = None
    media_file_id: str | None = None

async def download_telegram_file(file_id: str) -> str:
    """Download file from Telegram and save locally. Returns the saved filename."""
    async with Bot(token=BOT_TOKEN) as bot:
        file = await bot.get_file(file_id)
        file_url = file.file_path  # This is a full URL like https://api.telegram.org/file/bot.../photos/xxx.jpg
    
    ext = file_url.split(".")[-1] if "." in file_url else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)
    
    async with httpx.AsyncClient() as client:
        res = await client.get(file_url)
        with open(filepath, "wb") as f:
            f.write(res.content)
    
    return filename

# =========================
# INCOMING MESSAGE
# =========================
@router.post("/incoming")
async def incoming_support_message(
    data: SupportIncoming,
    db: Session = Depends(get_db)
):
    
    print("\n================ BACKEND SUPPORT MESSAGE ================")
    print("Incoming Data:", data)
    print(">>> incoming telegram_id:", data.telegram_id, type(data.telegram_id))

    telegram_id = str(data.telegram_id)

    print("Converted Telegram ID:", telegram_id)
    print("Telegram ID Type:", type(telegram_id))

    # =========================
    # FIND USER
    # =========================
    user = db.query(User).filter(
        User.telegram_id == telegram_id
    ).first()

    print(">>> user found:", user)

    if not user:
        print("❌ USER NOT FOUND")

        all_users = db.query(User).all()

        print("\nALL USERS TELEGRAM IDS:")
        for u in all_users:
            print(
                "user_id:",
                u.user_id,
                "| username:",
                u.username,
                "| telegram_id:",
                u.telegram_id,
                "| type:",
                type(u.telegram_id)
            )

        return {"error": "User not found"}

    print("✅ USER FOUND:", user.username)

    # =========================
    # FIND OR CREATE CONVERSATION
    # =========================
    conversation = db.query(Conversation).filter(
        Conversation.user_id == user.user_id
    ).first()

    print("Conversation:", conversation)

    if not conversation:
        conversation = Conversation(
            user_id=user.user_id,
            telegram_id=telegram_id,
            support_chat_id=data.telegram_id
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    else:
    # ✅ update it in case it was missing
        if not conversation.support_chat_id:
            conversation.support_chat_id = data.telegram_id
            db.commit()
            db.refresh(conversation)

        # Download and save media if present
    media_url = None
    if data.media_file_id:
        try:
            filename = await download_telegram_file(data.media_file_id)
            media_url = f"/uploads/telegram/{filename}"
        except Exception as e:
            print("❌ Failed to download media:", e)

    # =========================
    # SAVE MESSAGE
    # =========================
    msg = Message(
        conversation_id=conversation.id,
        sender="user",
        content=data.text,
        media_type=data.media_type,
        media_file_id=data.media_file_id,
        media_url=media_url,  
        status="sent",
        is_read=False
    )

    db.add(msg)
    db.commit()
    db.refresh(msg)

    # =========================
    # WEBSOCKET BROADCAST
    # =========================
    await manager.broadcast({
        "type": "new_message",
        "conversation_id": conversation.id,
        "message": {
            "id": msg.id,
            "conversation_id": conversation.id,
            "sender": msg.sender,
            "content": msg.content,
            "media_url": media_url,
            "media_type": msg.media_type,
            "media_file_id": msg.media_file_id,
            "status": msg.status,
            "created_at": str(msg.created_at),
            "username": user.username,

        }
    })

    return {
        "success": True,
        "message_id": msg.id
    }