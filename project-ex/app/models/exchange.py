from sqlalchemy import (
    Column,
    Integer,
    Float,
    Boolean,
    ForeignKey,
    DateTime
)

from sqlalchemy.orm import relationship

from sqlalchemy.sql import func

from app.db.database import Base


class ExchangeRate(Base):

    __tablename__ = "exchange_rates"

    id = Column(Integer, primary_key=True)

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

    rate = Column(
        Float,
        nullable=False
    )

    fee_percent = Column(
        Float,
        default=0
    )  # in percent : 0.5 -> 0.5%

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
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    # Owning admin. Nullable in Step 1 so existing creates keep working;
    # Step 2 will set this on every write and then enforce NOT NULL.
    admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, index=True)

    # =========================
    # RELATIONS
    # =========================

    from_currency = relationship(
        "Currency",
        foreign_keys=[from_currency_id]
    )

    to_currency = relationship(
        "Currency",
        foreign_keys=[to_currency_id]
    )

    admin = relationship("User", foreign_keys=[admin_id])