import base64
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional

from app.core.rls import get_db_rls
from app.core.security import get_current_user, is_master
from app.models.user import User
from app.models.messages import Conversation, Message

router = APIRouter(prefix="/admin-master-messages", tags=["Admin-Master Messages"])

UPLOADS_DIR = "uploads/internal"
os.makedirs(UPLOADS_DIR, exist_ok=True)

INTERNAL_KIND = "internal"


def get_admin(user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "master"):
        raise HTTPException(403, "Admin access required")
    return user


def get_master(user=Depends(get_current_user)):
    if not is_master(user):
        raise HTTPException(403, "Master access required")
    return user


def _get_or_create_conversation(db: Session, user_id: int) -> Conversation:
    conv = db.query(Conversation).filter(
        Conversation.user_id == user_id,
    ).first()
    if conv:
        if conv.kind != INTERNAL_KIND:
            conv.kind = INTERNAL_KIND
            db.commit()
        return conv

    conv = Conversation(user_id=user_id, kind=INTERNAL_KIND)
    db.add(conv)
    try:
        db.commit()
        db.refresh(conv)
    except IntegrityError:
        db.rollback()
        conv = db.query(Conversation).filter(Conversation.user_id == user_id).first()
        if not conv:
            raise
    return conv


def _save_base64_file(base64_data: str, media_type: str) -> str:
    if "," in base64_data:
        base64_data = base64_data.split(",", 1)[1]
    ext_map = {"photo": "jpg", "receipt": "jpg", "document": "bin"}
    ext = ext_map.get(media_type, "bin")
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(base64.b64decode(base64_data))
    return f"/uploads/internal/{filename}"


class SendMessage(BaseModel):
    content: Optional[str] = None
    media_type: Optional[str] = None      # "photo" | "receipt" | "document"
    media_file: Optional[str] = None      # base64


# =========================
# ADMIN SIDE: their own conversation with master
# =========================
@router.get("/conversation")
def get_my_conversation(db: Session = Depends(get_db_rls), admin=Depends(get_admin)):
    conv = _get_or_create_conversation(db, admin["user_id"])
    return {"conversation_id": conv.id}


@router.get("/messages")
def get_my_messages(db: Session = Depends(get_db_rls), admin=Depends(get_admin)):
    conv = _get_or_create_conversation(db, admin["user_id"])
    messages = db.query(Message).filter(
        Message.conversation_id == conv.id
    ).order_by(Message.created_at.asc()).all()

    # mark master's messages as read since the admin is viewing them now
    db.query(Message).filter(
        Message.conversation_id == conv.id,
        Message.sender == "master",
        Message.is_read == False,
    ).update({"is_read": True})
    db.commit()

    return {
        "conversation_id": conv.id,
        "messages": [
            {
                "id": m.id, "sender": m.sender, "content": m.content,
                "media_type": m.media_type, "media_url": m.media_url,
                "status": m.status, "is_read": m.is_read, "created_at": m.created_at,
            }
            for m in messages
        ],
    }


@router.post("/send")
def send_as_admin(payload: SendMessage, db: Session = Depends(get_db_rls), admin=Depends(get_admin)):
    conv = _get_or_create_conversation(db, admin["user_id"])

    media_url = None
    if payload.media_file and payload.media_type:
        media_url = _save_base64_file(payload.media_file, payload.media_type)

    msg = Message(
        conversation_id=conv.id,
        sender="admin",
        content=payload.content,
        media_type=payload.media_type,
        media_url=media_url,
        status="sent",
        is_read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"success": True, "message_id": msg.id, "media_url": media_url}


# =========================
# MASTER SIDE: inbox across every admin
# =========================
@router.get("/inbox")
def master_inbox(db: Session = Depends(get_db_rls), master=Depends(get_master)):
    conversations = db.query(Conversation).filter(
        Conversation.kind == INTERNAL_KIND
    ).all()

    result = []
    for conv in conversations:
        user = db.query(User).filter(User.user_id == conv.user_id).first()
        last_msg = db.query(Message).filter(
            Message.conversation_id == conv.id
        ).order_by(desc(Message.created_at)).first()
        unread = db.query(func.count(Message.id)).filter(
            Message.conversation_id == conv.id,
            Message.sender == "admin",
            Message.is_read == False,
        ).scalar()

        result.append({
            "conversation_id": conv.id,
            "admin_id": conv.user_id,
            "username": user.username if user else "Unknown",
            "role": user.role if user else None,
            "last_message": last_msg.content if last_msg else None,
            "last_media_type": last_msg.media_type if last_msg else None,
            "last_time": last_msg.created_at if last_msg else None,
            "unread_count": unread or 0,
        })

    result.sort(key=lambda x: x["last_time"].timestamp() if x["last_time"] else 0, reverse=True)
    return result


@router.get("/inbox/{conversation_id}")
def master_view_conversation(conversation_id: int, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id, Conversation.kind == INTERNAL_KIND
    ).first()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    user = db.query(User).filter(User.user_id == conv.user_id).first()
    messages = db.query(Message).filter(
        Message.conversation_id == conv.id
    ).order_by(Message.created_at.asc()).all()

    db.query(Message).filter(
        Message.conversation_id == conv.id,
        Message.sender == "admin",
        Message.is_read == False,
    ).update({"is_read": True})
    db.commit()

    return {
        "conversation_id": conv.id,
        "admin_id": conv.user_id,
        "username": user.username if user else "Unknown",
        "messages": [
            {
                "id": m.id, "sender": m.sender, "content": m.content,
                "media_type": m.media_type, "media_url": m.media_url,
                "status": m.status, "is_read": m.is_read, "created_at": m.created_at,
            }
            for m in messages
        ],
    }


@router.post("/inbox/{conversation_id}/send")
def master_reply(conversation_id: int, payload: SendMessage, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id, Conversation.kind == INTERNAL_KIND
    ).first()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    media_url = None
    if payload.media_file and payload.media_type:
        media_url = _save_base64_file(payload.media_file, payload.media_type)

    msg = Message(
        conversation_id=conv.id,
        sender="master",
        content=payload.content,
        media_type=payload.media_type,
        media_url=media_url,
        status="sent",
        is_read=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"success": True, "message_id": msg.id, "media_url": media_url}