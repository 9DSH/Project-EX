from sqlalchemy import Column, Integer, String, Boolean, Float
from app.db.database import Base


class Currency(Base):
    __tablename__ = "currencies"

    id = Column(Integer, primary_key=True)

    symbol = Column(String, unique=True, nullable=False)   # USDT
    name = Column(String, nullable=False)                  # Tether

    type = Column(String, default="crypto")
    # crypto / fiat

    decimals = Column(Integer, default=2)

    is_active = Column(Boolean, default=True)

    icon = Column(String, nullable=True)

    min_deposit = Column(Float, default=0)
    min_withdraw = Column(Float, default=0)