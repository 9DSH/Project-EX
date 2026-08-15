 #app/models/exchange_analysis.py.

from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class ExchangeRateHistory(Base):
    """
    Logs every change to an ExchangePair's rate/fee. One row per update.
    Source of truth for the 'Rate History' chart and for inventory P&L
    valuation over time.
    """

    __tablename__ = "exchange_rate_history"

    id = Column(Integer, primary_key=True, index=True)

    pair_id = Column(Integer, ForeignKey("exchange_pairs.id"), nullable=False, index=True)

    old_rate = Column(Float, nullable=True)
    new_rate = Column(Float, nullable=False)

    old_fee_percent = Column(Float, nullable=True)
    new_fee_percent = Column(Float, nullable=True)

    # Legacy string column (kept for audit continuity). Existing values are
    # mostly numeric user_id strings (see admin_exchange.py) or "system".
    changed_by = Column(String, nullable=True)

    # Structured actor (Step 1). Null changed_by_user_id = system-generated.
    changed_by_user_id = Column(
        Integer, ForeignKey("users.user_id"), nullable=True, index=True
    )
    changed_by_role = Column(String(20), nullable=True)  # admin | master | system

    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    pair = relationship("ExchangePair", lazy="joined")
    changed_by_user = relationship("User", foreign_keys=[changed_by_user_id])


class ExchangeInventoryLedger(Base):
    """
    One row per (currency leg) of a completed ExchangeOrder, recording the
    exchange's inventory delta for that currency.

    For an order converting from_currency -> to_currency:
      - exchange RECEIVES from_amount of from_currency  -> delta = +from_amount
      - exchange PAYS OUT  to_amount   of to_currency   -> delta = -to_amount
    """

    __tablename__ = "exchange_inventory_ledger"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(Integer, ForeignKey("exchange_orders.id"), nullable=False, index=True)

    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=False, index=True)
    currency_symbol = Column(String, nullable=False)  # denormalized for fast charting

    delta = Column(Float, nullable=False)

    # Rate of this currency vs. base currency (e.g. USDT) at trade time,
    # used for cost-basis / mark-to-market. 1.0 if currency IS the base.
    rate_to_base_at_trade = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    order = relationship("ExchangeOrder", lazy="joined")