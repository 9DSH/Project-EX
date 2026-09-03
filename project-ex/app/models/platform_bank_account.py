from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime
from sqlalchemy.orm import relationship
from app.db.database import Base


class PlatformBankAccount(Base):
    __tablename__ = "platform_bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)

    platform_kind = Column(String(20), nullable=False, default="telegram_bot", server_default="telegram_bot")

    bank_name = Column(String(255), nullable=True)
    bank_holder_name = Column(String(255), nullable=True)
    bank_card_number = Column(String(255), nullable=True)
    bank_sheba = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    admin = relationship("User", backref="platform_bank_accounts")
