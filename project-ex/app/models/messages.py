from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, UniqueConstraint
from datetime import datetime
from app.db.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)

    # IMPORTANT: internal DB user id ONLY
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)

    # "support"  -> Telegram support-bot conversation (existing behavior)
    # "internal" -> admin <-> master internal messaging (new)
    kind = Column(String(20), nullable=False, default="support", server_default="support")

    telegram_id = Column(String, nullable=True)
    support_chat_id = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "kind", name="uq_conversation_user_kind"),
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)

    sender = Column(String, nullable=False)  # "user" / "admin" / "master"

    content = Column(Text, nullable=True)

    media_type = Column(String, nullable=True)   # "photo" | "video" | "document" | "receipt"
    media_file_id = Column(String, nullable=True)
    media_url = Column(String, nullable=True)

    status = Column(String, default="sent")
    is_read = Column(Boolean, default=False)
    is_delivered = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)