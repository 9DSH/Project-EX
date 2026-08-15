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
    
    price = Column(Numeric(precision=18, scale=8), nullable=False)
    currency = Column(String(10), default="USDT")
    network = Column(String(20), nullable=True)
    
    status = Column(String(20), default="pending")   # pending | approved | rejected | delivered | failed
    
    delivery_info = Column(JSONB, nullable=True)     # credentials, gift code, vpn config...
    delivered_at = Column(DateTime, nullable=True)

    input_data = Column(
        JSONB,
        nullable=True,
        default=dict
    )
    
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="order_items")