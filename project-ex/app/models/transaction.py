from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime
from datetime import datetime
from app.db.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)

    order_id = Column(Integer, ForeignKey("order_items.id"), nullable=True)

    wire_transfer_order_id = Column(Integer, ForeignKey("wire_transfer_orders.id"), nullable=True)
    
    currency_id = Column(Integer,ForeignKey("currencies.id"),nullable=True)

    network_id = Column(Integer,ForeignKey("networks.id"),nullable=True)
    platform_bank_account_id = Column(Integer, ForeignKey("platform_bank_accounts.id"), nullable=True)
    
    amount = Column(Float, nullable=False)

    type = Column(String, nullable=False)
    
    status = Column(String, default="completed")

    created_at = Column(DateTime, default=datetime.utcnow)

    # BlackChain\

    tx_hash = Column(String, nullable=True, index=True)
    wallet_address = Column(String, nullable=True)
    blockchain = Column(String, default="bsc")
    confirmations = Column(Integer, default=0)
