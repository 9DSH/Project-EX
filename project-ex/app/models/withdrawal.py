from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from datetime import datetime
from app.db.database import Base


class Withdrawal(Base):
    __tablename__ = "withdrawals"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)

    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=False)
    network_id = Column(Integer, ForeignKey("networks.id"), nullable=False)


    amount = Column(Float, nullable=False)

    wallet_address = Column(String, nullable=False)

    status = Column(String, default="pending")  
    # pending / approved / rejected / sent

    tx_hash = Column(String, nullable=True)


    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)