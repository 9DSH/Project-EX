from sqlalchemy import Column, Integer, Float, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base


class FailedSweep(Base):
    __tablename__ = "failed_sweeps"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)

    amount = Column(Float, nullable=False)
    currency_symbol = Column(String, nullable=False)
    network = Column(String, nullable=True)
    tatum_symbol = Column(String, nullable=False)
    reason = Column(String, nullable=True)
    error = Column(String, nullable=True)
    retries = Column(Integer, default=0)
    resolved = Column(Boolean, default=False)

    created_at = Column(DateTime, server_default=func.now())
    last_retry_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    exchange_order_id = Column(Integer, nullable=True)

    # RELATIONSHIP
    user = relationship("User")