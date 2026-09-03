from sqlalchemy import Column, Integer,Text,  Numeric, ForeignKey, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime 
from app.db.database import Base


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    
    original_price = Column(Numeric(precision=18, scale=8), nullable=True)   # pre-discount price snapshot
    discount_percent = Column(Numeric(precision=5, scale=2), nullable=True)  # snapshot of discount applied at order time
    price = Column(Numeric(precision=18, scale=8), nullable=False)           # final price actually charged
    currency = Column(String(10), default="USDT")
    network = Column(String(20), nullable=True)
    
    status = Column(String(20), default="pending")   # pending | approved | rejected | delivered | failed
    
    delivery_info = Column(JSONB, nullable=True)     # credentials, gift code, vpn config...
    delivered_at = Column(DateTime, nullable=True)

    # ── Status-change audit trail (mirrors wire_transfer_orders convention:
    #    the admin's username is stored directly, not an FK) ────────────
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(String(255), nullable=True)

    rejected_at = Column(DateTime, nullable=True)
    rejected_by = Column(String(255), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    delivered_by = Column(String(255), nullable=True)

    failed_at = Column(DateTime, nullable=True)
    failed_by = Column(String(255), nullable=True)
    fail_reason = Column(Text, nullable=True)

    input_data = Column(
        JSONB,
        nullable=True,
        default=dict
    )
    
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="order_items")