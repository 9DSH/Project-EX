from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Boolean, Text, DateTime, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    
    name = Column(String, nullable=False, index=True)
    slug = Column(String, unique=True, nullable=True, index=True)
    
    # Core classification
    product_type = Column(String(30), nullable=False, index=True)  
    
    plan = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    
    price = Column(Numeric(precision=18, scale=8), nullable=False)
    currency = Column(String(10), default="USDT")
    network = Column(String(20), nullable=True)
    discount_percent = Column(Numeric(precision=5, scale=2),nullable=True)  # e.g. 10.00 = 10%, NULL = no discount
    
    # Validity & Usage
    validity_days = Column(Integer, nullable=True)
    validity_hours = Column(Integer, nullable=True)
    data_volume_gb = Column(Float, nullable=True)
    is_recurring = Column(Boolean, default=False)
    stock = Column(Integer, nullable=True)                    # None = unlimited
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    

    extra_data = Column(JSONB, nullable=True, default=dict)   

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)


    approval_status = Column(
                String(20),
                default="pending",
                nullable=False,
                index=True
            )

    approved_by = Column(String, nullable=True)

    approved_at = Column(DateTime, nullable=True)

    rejection_reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    # Owning admin (users.user_id)
    admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, index=True)

    system_reward_percent = Column(
        Numeric(precision=5, scale=2),
        nullable=True
    )

    system_commision = Column(
        Numeric(precision=18, scale=8),
        nullable=True
    )

    icon_path = Column(Text, nullable=True)

    required_user_data = Column(
        JSONB,
        nullable=True,
        default=dict
    )

    # Relationships
    category = relationship("Category", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")