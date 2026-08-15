from sqlalchemy import Column, Integer, Float, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class WireTransferPair(Base):
    __tablename__ = "wire_transfer_pairs"

    id = Column(Integer, primary_key=True)

    from_currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=False)
    to_currency_id   = Column(Integer, ForeignKey("currencies.id"), nullable=False)

    rate             = Column(Float,   nullable=False, default=1)
    fee_percent      = Column(Float,   default=0)
    min_amount       = Column(Float,   default=0)
    max_amount       = Column(Float,   nullable=True)
    timeout_minutes  = Column(Integer, default=60)

    # JSON-encoded dict: { fieldKey: {label, type, required} }
    required_fields  = Column(Text, nullable=True)

    is_active        = Column(Boolean, default=True)
    created_at       = Column(DateTime, default=datetime.utcnow)

    # Owning admin. Nullable in Step 1; Step 2 enforces write + NOT NULL.
    admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, index=True)

    from_currency = relationship("Currency", foreign_keys=[from_currency_id])
    to_currency   = relationship("Currency", foreign_keys=[to_currency_id])
    orders        = relationship("WireTransferOrder", back_populates="pair")
    admin         = relationship("User", foreign_keys=[admin_id])
