from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.currency_network import CurrencyNetwork
from app.models.currency import Currency
from app.models.network import Network


def _normalize_network_hint(network_hint: str | None) -> str | None:
    if network_hint is None:
        return None
    hint = network_hint.strip()
    if not hint:
        return None
    return hint.upper()


def get_currency_by_symbol(db: Session, currency_symbol: str) -> Currency:
    currency = db.query(Currency).filter(
        Currency.symbol == currency_symbol.upper()
    ).first()
    if not currency:
        raise HTTPException(status_code=404, detail="Currency not found")
    if not currency.is_active:
        raise HTTPException(status_code=400, detail="Currency is inactive")
    return currency


def resolve_currency_network_pair(
    db: Session,
    currency_symbol: str,
    action: str,
    network_hint: str | None = None,
) -> CurrencyNetwork:
    currency = get_currency_by_symbol(db, currency_symbol)
    hint = _normalize_network_hint(network_hint)

    query = (
        db.query(CurrencyNetwork)
        .join(Network, CurrencyNetwork.network_id == Network.id)
        .options(
            joinedload(CurrencyNetwork.currency),
            joinedload(CurrencyNetwork.network),
        )
        .filter(
            CurrencyNetwork.currency_id == currency.id,
            CurrencyNetwork.is_active == True,
            Network.is_active == True,
        )
    )

    if action == "deposit":
        query = query.filter(CurrencyNetwork.deposit_enabled == True)
    elif action == "withdraw":
        query = query.filter(CurrencyNetwork.withdraw_enabled == True)
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    if hint:
        if hint.isdigit():
            query = query.filter(Network.id == int(hint))
        else:
            query = query.filter(
                or_(
                    Network.name == hint,
                    Network.chain == hint,
                )
            )

    pairs = query.all()

    if not pairs:
        if hint:
            raise HTTPException(
                status_code=400,
                detail=f"{action.capitalize()} not enabled for {currency.symbol} on requested network",
            )
        raise HTTPException(
            status_code=400,
            detail=f"No enabled {action} network for {currency.symbol}",
        )

    if len(pairs) > 1 and not hint:
        raise HTTPException(
            status_code=400,
            detail=f"Multiple networks available for {currency.symbol}. Network selection is required.",
        )

    return pairs[0]


def validate_amount_against_limits(pair: CurrencyNetwork, amount: float, action: str):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="INVALID_AMOUNT")

    if action == "deposit":
        minimum = max(float(pair.min_deposit or 0), float(pair.currency.min_deposit or 0))
        if amount < minimum:
            raise HTTPException(
                status_code=400,
                detail=f"MIN_DEPOSIT_{pair.currency.symbol}_{pair.network.chain}_{minimum}",
            )
        return

    if action == "withdraw":
        minimum = max(float(pair.min_withdraw or 0), float(pair.currency.min_withdraw or 0))
        if amount < minimum:
            raise HTTPException(
                status_code=400,
                detail=f"MIN_WITHDRAW_{pair.currency.symbol}_{pair.network.chain}_{minimum}",
            )
        return

    raise HTTPException(status_code=400, detail="Invalid action")
