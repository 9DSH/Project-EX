from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class WireTransferOrder(Base):
    __tablename__ = "wire_transfer_orders"

    id = Column(Integer, primary_key=True)

    user_id  = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    pair_id  = Column(Integer, ForeignKey("wire_transfer_pairs.id"), nullable=False)

    # True when the user's IRT balance was insufficient at order-placement time.
    # In that case the user must wire money to the platform and upload a receipt.
    # On admin approval the platform credits the user's IRT balance (wire_deposit
    # transaction) and immediately freezes it (wire_freeze transaction) so the
    # normal deliver/fail/reject flow can proceed identically for both paths.
    balance_was_insufficient = Column(Boolean, default=False, nullable=False)

    # Rate/fee locked at order creation — never changes
    locked_rate        = Column(Float, nullable=False)
    locked_fee_percent = Column(Float, default=0)
    fee_amount         = Column(Float, default=0)

    from_amount = Column(Float, nullable=False)  # amount user sends (from_currency)
    to_amount   = Column(Float, nullable=False)  # amount user receives after fee (to_currency)

    # JSON-encoded user-provided field values, e.g. {"iban": "IR...", "bank_name": "..."}
    input_data = Column(Text, nullable=True)

    # pending → approved → delivered
    # pending → rejected
    # approved → failed
    # pending → expired (auto)
    status = Column(String, default="pending", nullable=False)

    fail_reason = Column(Text, nullable=True)
    delivery_message = Column(Text, nullable=True)
    expires_at  = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    expired_at = Column(DateTime, nullable=True)
    approved_by = Column(String(255), nullable=True)
    rejected_by = Column(String(255), nullable=True)
    delivered_by = Column(String(255), nullable=True)
    failed_by = Column(String(255), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    # Owning admin (copied from users.admin_id at order time in Step 2).
    # Nullable in Step 1 for safe backfill + zero write-path changes.
    admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, index=True)

    user = relationship("User", foreign_keys=[user_id])
    pair = relationship("WireTransferPair", back_populates="orders")
    admin = relationship("User", foreign_keys=[admin_id])
