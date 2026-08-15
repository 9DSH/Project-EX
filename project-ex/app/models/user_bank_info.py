from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime
from sqlalchemy.orm import relationship
from app.db.database import Base


class UserBankInfo(Base):
    __tablename__ = "user_bank_info"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True, unique=True)

    bank_holder_name = Column(String(255), nullable=True)
    bank_card_number = Column(String(255), nullable=True)
    bank_name = Column(String(255), nullable=True)
    bank_sheba = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="bank_info")

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_bank_info_user"),
    )
