from sqlalchemy import (
    Column,
    Integer,
    ForeignKey,
    UniqueConstraint,
    Boolean,
    Float
)

from sqlalchemy.orm import relationship

from app.db.database import Base


class CurrencyNetwork(Base):
    __tablename__ = "currency_networks"

    id = Column(Integer, primary_key=True)

    currency_id = Column(Integer, ForeignKey("currencies.id"))

    network_id = Column(Integer, ForeignKey("networks.id"))

    # =========================
    # CONTROLS
    # =========================
    is_active = Column(Boolean, default=True)

    # Default pairs (e.g. USDT/BEP20, IRT/INTERNAL) get a wallet + balance
    # auto-created for every user at signup. Non-default pairs only get a
    # wallet/balance created on demand, the first time a user (or admin)
    # actually wants to deposit/hold that pair.
    is_default = Column(Boolean, default=False)

    deposit_enabled = Column(Boolean, default=True)

    withdraw_enabled = Column(Boolean, default=True)

    min_deposit = Column(Float, default=0)

    max_deposit = Column(Float, default=0)

    min_withdraw = Column(Float, default=0)

    withdraw_fee = Column(Float, default=0)

    confirmations_required = Column(Integer, default=1)

    # =========================
    # RELATIONSHIPS
    # =========================
    currency = relationship("Currency")

    network = relationship("Network")

    # =========================
    # UNIQUE
    # =========================
    __table_args__ = (
        UniqueConstraint(
            "currency_id",
            "network_id",
            name="unique_currency_network"
        ),
    )