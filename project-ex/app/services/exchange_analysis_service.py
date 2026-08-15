"""
app/services/exchange_analysis_service.py

Helper used by app/services/exchange_service.py (inside execute_exchange)
to record inventory ledger rows when an order completes.
"""

from sqlalchemy.orm import Session

from app.models.exchange_analysis import ExchangeInventoryLedger
from app.models.exchange_order import ExchangeOrder
from app.models.exchange_pair import ExchangePair
from app.models.currency import Currency


BASE_CURRENCY_SYMBOL = "USDT" 


def _rate_to_base(db: Session, currency: Currency) -> float:
    """
    Looks up the active pair rate from `currency` -> BASE_CURRENCY_SYMBOL.
    Returns 1.0 if currency IS the base, or if no direct pair exists
    (in which case cost-basis/mark-to-market for that currency will be
    approximate until a direct pair is added).
    """
    if currency.symbol == BASE_CURRENCY_SYMBOL:
        return 1.0

    pair = (
        db.query(ExchangePair)
        .join(Currency, ExchangePair.from_currency_id == Currency.id)
        .filter(Currency.symbol == currency.symbol)
        .filter(ExchangePair.is_active == True)  # noqa: E712
        .first()
    )
    return pair.rate if pair else 1.0


def log_inventory_for_order(db: Session, order: ExchangeOrder) -> None:
    """
    Call this ONCE, right after an ExchangeOrder is created with
    status="completed" and has an `id` (i.e. after db.flush()).

    Since ExchangeOrder defaults to status="completed" immediately
    (per your model), this should be called right after creating the order
    row inside execute_exchange(), before the final db.commit().

    Creates two ledger rows:
      +order.from_amount of from_currency  (exchange receives this)
      -order.to_amount   of to_currency    (exchange pays this out)
    """
    from_currency = order.from_currency or db.query(Currency).filter(Currency.id == order.from_currency_id).first()
    to_currency = order.to_currency or db.query(Currency).filter(Currency.id == order.to_currency_id).first()

    db.add(ExchangeInventoryLedger(
        order_id=order.id,
        currency_id=from_currency.id,
        currency_symbol=from_currency.symbol,
        delta=float(order.from_amount),
        rate_to_base_at_trade=_rate_to_base(db, from_currency),
    ))
    db.add(ExchangeInventoryLedger(
        order_id=order.id,
        currency_id=to_currency.id,
        currency_symbol=to_currency.symbol,
        delta=-float(order.to_amount),
        rate_to_base_at_trade=_rate_to_base(db, to_currency),
    ))
    # caller is responsible for db.commit()