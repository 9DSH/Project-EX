import asyncio
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.wire_transfer_order import WireTransferOrder
from app.models.user_balance import UserBalance
from app.models.transaction import Transaction
from app.constants.transaction_types import WIRE_REFUND
from app.constants.transaction_status import COMPLETED, FAILED, FROZEN, REJECTED

WIRE_ORDER_EXPIRED_REASON = "Order expired — timeout window elapsed before approval."


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def expire_pending_wire_orders(db: Session) -> int:
    expiring_orders = (
        db.query(WireTransferOrder)
        .filter(
            WireTransferOrder.status == "pending",
            WireTransferOrder.expires_at.isnot(None),
            WireTransferOrder.expires_at <= utc_now_naive(),
        )
        .all()
    )
    for order in expiring_orders:
        order.status = "expired"
        order.expired_at = utc_now_naive()
        if not order.fail_reason:
            order.fail_reason = WIRE_ORDER_EXPIRED_REASON

        # Refund frozen IRT only on the sufficient-balance path.
        # On the insufficient path no money was ever credited/frozen (approval
        # never happened), so there is nothing to return.
        is_irt = (
            order.pair
            and order.pair.from_currency
            and str(order.pair.from_currency.symbol or "").upper() == "IRT"
        )
        if is_irt and not order.balance_was_insufficient:
            balance = (
                db.query(UserBalance)
                .filter(
                    UserBalance.user_id == order.user_id,
                    UserBalance.currency_id == order.pair.from_currency.id,
                )
                .first()
            )
            if balance:
                refund = float(order.from_amount or 0)
                balance.available_balance += refund
                balance.frozen_balance = max(float(balance.frozen_balance or 0) - refund, 0)
                db.add(Transaction(
                    user_id=order.user_id,
                    currency_id=order.pair.from_currency.id,
                    amount=refund,
                    type=WIRE_REFUND,
                    status=COMPLETED,
                    wire_transfer_order_id=order.id,
                    blockchain="internal",
                ))
    return len(expiring_orders)


async def wire_order_expiry_loop(interval_seconds: int = 5):
    while True:
        db = SessionLocal()
        try:
            changed = expire_pending_wire_orders(db)
            if changed:
                db.commit()
        finally:
            db.close()
        await asyncio.sleep(interval_seconds)
