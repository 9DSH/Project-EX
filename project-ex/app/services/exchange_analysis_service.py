"""
app/services/exchange_analysis_service.py

Helper used by app/services/exchange_service.py (inside execute_exchange)
to record inventory ledger rows when an order completes.
"""

from typing import Optional

from sqlalchemy.orm import Session

from app.models.exchange_analysis import ExchangeInventoryLedger
from app.models.exchange_order import ExchangeOrder
from app.models.exchange_pair import ExchangePair
from app.models.currency import Currency


BASE_CURRENCY_SYMBOL = "USDT"


def _rate_to_base(db: Session, currency: Currency, admin_id: Optional[int] = None) -> float:
    """
    Rate of `currency` -> BASE_CURRENCY_SYMBOL (multiplicative), using the
    active pair owned by the ORDER's admin (never another admin's rate).
    Tries the direct pair, then the reverse pair (1/rate).
    Falls back to 1.0 when no path exists (analysis flags those currencies).
    """
    if currency.symbol == BASE_CURRENCY_SYMBOL:
        return 1.0

    base = db.query(Currency).filter(Currency.symbol == BASE_CURRENCY_SYMBOL).first()
    if not base:
        return 1.0

    def find(from_id: int, to_id: int):
        q = db.query(ExchangePair).filter(
            ExchangePair.from_currency_id == from_id,
            ExchangePair.to_currency_id == to_id,
            ExchangePair.is_active == True,  # noqa: E712
        )
        if admin_id is not None:
            q = q.filter(ExchangePair.admin_id == admin_id)
        return q.order_by(ExchangePair.id).first()

    direct = find(currency.id, base.id)
    if direct and direct.rate:
        return float(direct.rate)

    reverse = find(base.id, currency.id)
    if reverse and reverse.rate:
        return 1.0 / float(reverse.rate)

    return 1.0


def log_inventory_for_order(db: Session, order: ExchangeOrder) -> None:
    """
    Call ONCE right after the ExchangeOrder has an id (after db.flush()).

    Creates two ledger rows:
      +order.from_amount of from_currency  (exchange receives this, fee included)
      -order.to_amount   of to_currency    (exchange pays this out)
    """
    from_currency = order.from_currency or db.query(Currency).filter(Currency.id == order.from_currency_id).first()
    to_currency = order.to_currency or db.query(Currency).filter(Currency.id == order.to_currency_id).first()

    db.add(ExchangeInventoryLedger(
        order_id=order.id,
        currency_id=from_currency.id,
        currency_symbol=from_currency.symbol,
        delta=float(order.from_amount),
        rate_to_base_at_trade=_rate_to_base(db, from_currency, order.admin_id),
    ))
    db.add(ExchangeInventoryLedger(
        order_id=order.id,
        currency_id=to_currency.id,
        currency_symbol=to_currency.symbol,
        delta=-float(order.to_amount),
        rate_to_base_at_trade=_rate_to_base(db, to_currency, order.admin_id),
    ))
    # caller is responsible for db.commit()