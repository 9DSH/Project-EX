from sqlalchemy import (
    Column,
    Integer,
    Float,
    Boolean,
    ForeignKey,
    DateTime
)

from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.database import Base


class ExchangePair(Base):

    __tablename__ = "exchange_pairs"

    id = Column(Integer, primary_key=True)

    # =========================
    # PAIR
    # =========================
    from_currency_id = Column(
        Integer,
        ForeignKey("currencies.id"),
        nullable=False
    )

    to_currency_id = Column(
        Integer,
        ForeignKey("currencies.id"),
        nullable=False
    )

    # =========================
    # EXCHANGE SETTINGS
    # =========================
    rate = Column(
        Float,
        nullable=False,
        default=1
    )

    fee_percent = Column(
        Float,
        default=0
    )

    min_amount = Column(
        Float,
        default=0
    )

    max_amount = Column(
        Float,
        nullable=True
    )

    is_active = Column(
        Boolean,
        default=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # =========================
    # RELATIONSHIPS
    # =========================
    from_currency = relationship(
        "Currency",
        foreign_keys=[from_currency_id]
    )

    to_currency = relationship(
        "Currency",
        foreign_keys=[to_currency_id]
    )