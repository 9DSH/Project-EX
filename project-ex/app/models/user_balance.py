from sqlalchemy import (
    Column,
    Integer,
    Float,
    ForeignKey,
    Boolean,
    UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.db.database import Base


class UserBalance(Base):
    __tablename__ = "user_balances"

    id = Column(Integer, primary_key=True)

    user_id = Column(Integer, ForeignKey("users.user_id"))

    currency_id = Column(Integer, ForeignKey("currencies.id"))

    network_id = Column(Integer, ForeignKey("networks.id"), nullable=True)

    available_balance = Column(Float, default=0.0)

    frozen_balance = Column(Float, default=0.0)

    needs_sweep = Column(Boolean, default=False) 



    currency = relationship("Currency")

    network = relationship("Network")

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "currency_id",
            "network_id",
            name="unique_user_currency_network"
        ),
    )