from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from datetime import datetime
from sqlalchemy.orm import relationship
from app.db.database import Base


class ExternalWallet(Base):
    """
    Stores the user's own (external) wallet address per currency/network pair —
    i.e. the address the platform sends withdrawals TO. This must be a private
    wallet address owned by the user, not an exchange/broker deposit address.
    """
    __tablename__ = "external_wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=False)
    network_id = Column(Integer, ForeignKey("networks.id"), nullable=False)

    address = Column(String(255), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="external_wallets")
    currency = relationship("Currency")
    network = relationship("Network")

    __table_args__ = (
        UniqueConstraint(
            "user_id", "currency_id", "network_id",
            name="uq_external_wallet_pair"
        ),
    )
