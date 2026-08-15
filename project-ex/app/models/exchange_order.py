from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    ForeignKey,
    DateTime
)

from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.database import Base


class ExchangeOrder(Base):

    __tablename__ = "exchange_orders"

    id = Column(Integer, primary_key=True)

    user_id = Column( Integer, ForeignKey("users.user_id"),nullable=False)

    from_currency_id = Column(Integer,ForeignKey("currencies.id"),nullable=False)

    to_currency_id = Column(Integer,ForeignKey("currencies.id"),nullable=False)


    from_amount = Column(Float, nullable=False)

    to_amount = Column(Float,nullable=False)

    rate = Column(Float,nullable=False)

    fee_percent = Column(Float,default=0)

    fee_amount = Column(Float, default=0 )

    status = Column( String,default="completed")

    created_at = Column(DateTime,default=datetime.utcnow)

    # Owning admin (copied from users.admin_id at order time in Step 2).
    # Nullable in Step 1 for safe backfill + zero write-path changes.
    admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, index=True)

    # =========================
    # RELATIONSHIPS
    # =========================
    user = relationship("User", foreign_keys=[user_id])

    from_currency = relationship("Currency",foreign_keys=[from_currency_id])

    to_currency = relationship("Currency",foreign_keys=[to_currency_id])

    admin = relationship("User", foreign_keys=[admin_id])