from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from datetime import datetime
from sqlalchemy.orm import relationship
from app.db.database import Base


class PlatformWalletConfig(Base):
    """
    Master-configured deposit destinations shown to admins (and, transitively,
    their end users) for crypto, plus IRT bank info used for admins' own
    manual IRT deposits into their admin balance.

    Purely a *display/config* table — it never drives Tatum derivation, the
    sweep pipeline, or the existing UserWallet flow. Crypto deposits for an
    admin's own balance still go through get_or_create_wallet_for_pair()
    exactly like a telegram user's deposit; this table only supplies the
    informational "send it to X" address admins/users are shown for a given
    currency/network when no per-user wallet applies (e.g. for reference,
    manual OTC-style flows, or the destination shown in the Master Wallet
    admin screen).
    """
    __tablename__ = "platform_wallet_configs"

    id = Column(Integer, primary_key=True, index=True)

    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    network_id = Column(Integer, ForeignKey("networks.id"), nullable=True)

    # For crypto entries: the address to display.
    deposit_address = Column(String(255), nullable=True)

    # For IRT / fiat entries: bank info shown to admins depositing IRT into
    # their own admin balance (separate concept from PlatformBankAccount,
    # which is per-admin and used for END-USER wire transfers).
    bank_name = Column(String(255), nullable=True)
    bank_holder_name = Column(String(255), nullable=True)
    bank_card_number = Column(String(255), nullable=True)
    bank_sheba = Column(String(255), nullable=True)

    label = Column(String(255), nullable=True)
    note = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    currency = relationship("Currency")
    network = relationship("Network")