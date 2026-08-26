from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from typing import Optional
from app.core.rls import get_db_rls
from app.models.user import User
from app.models.messages import Conversation, Message
from app.core.security import get_current_user, is_master, is_admin_or_above
from app.core.permissions import has_access
from app.services.telegram_service import send_telegram_message
from app.services.ws_manager import manager
import base64, uuid, os, httpx
from telegram import Bot


router = APIRouter(prefix="/admin/messages", tags=["Admin Messages"])

UPLOADS_DIR = "uploads/telegram"
SUPPORT_BOT_TOKEN = os.environ.get("SUPPORT_BOT_TOKEN")

class AdminSendMessage(BaseModel):
    conversation_id: int
    content: Optional[str] = None
    media_type: Optional[str] = None
    media_file: Optional[str] = None



def get_admin(user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    if not has_access(user, "dashboard.view"):
        raise HTTPException(status_code=403, detail="Access denied")

    return user

async def save_base64_file(base64_data: str, media_type: str) -> tuple[str, str]:
    """Save base64 data to disk. Returns (filename, media_url)."""
    # Strip the data URI prefix if present: "data:image/jpeg;base64,..."
    if "," in base64_data:
        base64_data = base64_data.split(",", 1)[1]
    
    ext_map = {"photo": "jpg", "video": "mp4", "document": "bin"}
    ext = ext_map.get(media_type, "bin")
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)
    
    with open(filepath, "wb") as f:
        f.write(base64.b64decode(base64_data))
    
    return filename, f"/uploads/telegram/{filename}"


# =========================
# ADMIN SEND MESSAGE
# =========================
@router.post("/send")
async def admin_send_message(
    payload: AdminSendMessage,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):  
    
    if not has_access(admin, "send.message"):
        raise HTTPException(403, "Access denied")

    conversation = db.query(Conversation).filter(
        Conversation.id == payload.conversation_id
    ).first()

    
    if not conversation:
        return {"error": "Conversation not found"}


    if not conversation.support_chat_id:
        print("❌ No support_chat_id — cannot forward to Telegram")
        raise HTTPException(status_code=400, detail="No support chat linked")

    
      # Save media file if present
    media_url = None
    if payload.media_file and payload.media_type:
        try:
            _, media_url = await save_base64_file(payload.media_file, payload.media_type)
        except Exception as e:
            print("❌ Failed to save media:", e)
            return {"error": "Failed to save media"}

    msg = Message(
        conversation_id=conversation.id,
        sender="admin",
        content=payload.content,
        media_type=payload.media_type,
        media_url=media_url,          # ← store the local URL
        media_file_id=None,  
        status="sent",
        is_read=False
    )

    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Telegram forward
    if conversation.support_chat_id:
        await send_telegram_message(
            chat_id=conversation.support_chat_id,
            text=payload.content,
            media_type=payload.media_type,
             media_url=media_url, 
        )

    await manager.broadcast({
        "type": "new_message",
        "conversation_id": conversation.id,
        "message": {
            "id": msg.id,
            "conversation_id": conversation.id,
            "sender": msg.sender,
            "content": msg.content,
            "media_type": msg.media_type,
            "media_url": media_url, 
            "status": msg.status,
            "username": "admin",
        }
    })

    return {"success": True, "message_id": msg.id}


# =========================
# GET CONVERSATIONS
# =========================
@router.get("/conversations")
def get_conversations(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):  
    
    if not has_access(admin, "send.message"):
        raise HTTPException(403, "Access denied")

    query = (
        db.query(Conversation)
        .join(Message, Message.conversation_id == Conversation.id)
        .join(User, User.user_id == Conversation.user_id)
    )

    # Master sees every conversation; other admins only see
    # conversations for users assigned to them.
    if not is_master(admin):
        query = query.filter(User.admin_id == admin["user_id"])

    conversations = query.group_by(Conversation.id).all()

    result = []

    for conv in conversations:

        user = db.query(User).filter(
            User.user_id == conv.user_id
        ).first()

        last_msg = db.query(Message).filter(
            Message.conversation_id == conv.id
        ).order_by(desc(Message.created_at)).first()

        unread_count = db.query(func.count(Message.id)).filter(
            Message.conversation_id == conv.id,
            Message.sender == "user",
            Message.is_read == False
        ).scalar()

        result.append({
            "conversation_id": conv.id,
            "user_id": conv.user_id,
            "username": user.username if user else "Unknown",
            "telegram_id": conv.telegram_id,
            "support_chat_id": conv.support_chat_id,
            "last_message": last_msg.content if last_msg else None,
            "last_time": last_msg.created_at if last_msg else None,
            "unread_count": unread_count or 0
        })

    result.sort(
        key=lambda x: x["last_time"].timestamp() if x["last_time"] else 0,
        reverse=True
    )
    return result


# =========================
# GET MESSAGES
# =========================
@router.get("/conversation/{conversation_id}")
async def get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):  
    
    if not has_access(admin, "send.message"):
        raise HTTPException(403, "Access denied")
    
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    if not conversation:
        return {"error": "Conversation not found"}

    user = db.query(User).filter(
        User.user_id == conversation.user_id
    ).first()

    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.asc()).all()

    db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.sender == "user",
        Message.is_read == False
    ).update({"is_read": True})

    db.commit()

    return {
        "conversation_id": conversation_id,
        "user": {
            "user_id": user.user_id if user else None,
            "username": user.username if user else "Unknown",
            "telegram_id": conversation.telegram_id,
            "support_chat_id": conversation.support_chat_id
        },
        "messages": [
            {
                "id": m.id,
                "sender": m.sender,
                "content": m.content,
                "media_type": m.media_type,
                "media_file_id": m.media_file_id,
                "media_url": m.media_url,  
                "status": m.status,
                "is_read": m.is_read,
                "created_at": m.created_at
            }
            for m in messages
        ]
    }


# =====================================================
# CREATE OR GET CONVERSATION
# =====================================================
@router.post("/start")
def start_conversation(
    user_id: int,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):  
    
    if not has_access(admin, "send.message"):
        raise HTTPException(403, "Access denied")
    
    # 1️⃣ check if conversation already exists
    conv = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.id.asc())
        .first()
    )

    if conv:
        return {
            "conversation_id": conv.id,
            "user_id": conv.user_id
        }

    # 2️⃣ create new conversation
    new_conv = Conversation(
        user_id=user_id,
        telegram_id=None  # optional
    )

    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)

    return {
        "conversation_id": new_conv.id,
        "user_id": new_conv.user_id
    }

# =====================================================
# GET USERS (FOR SEARCH)
# =====================================================
@router.get("/users")
def get_users(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):  
    
    if has_access(admin, "users.view"):
        users = (
            db.query(User)
            .filter(
                User.user_id != admin["user_id"],
                User.status == "active"
            )
            .all()
        )
    else:
        users = (
            db.query(User)
            .filter(
                User.user_id != admin["user_id"],
                User.status == "active",
                User.admin_id == admin.get("user_id")
            )
            .all()
        )

    return [
        {
            "user_id": u.user_id,
            "username": u.username,
            "admin_id": u.admin_id,
            "telegram_id" : u.telegram_id
        }
        for u in users
    ]