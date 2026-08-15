from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.models.user_balance import UserBalance
from app.db.database import get_db
from app.core.security import get_current_user, is_master, is_admin_or_above
from app.core.permissions import has_access
from app.services.exchange_service import execute_exchange, get_exchange_rate, normalize_db_rate
from app.models.currency import Currency
from app.models.failed_sweeps import FailedSweep
from app.models.exchange_pair import ExchangePair
from app.models.exchange_order import ExchangeOrder
from app.models.exchange_analysis import ExchangeRateHistory
from app.models.user import User
from sqlalchemy.orm import joinedload
from decimal import Decimal, getcontext

getcontext().prec = 28

router = APIRouter(
    prefix="/admin/exchange",
    tags=["Admin Exchange"]
)




def get_admin(user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    if not has_access(user, "exchange.view"):
        raise HTTPException(status_code=403, detail="Access denied")

    return user



# =========================
# SCHEMAS
# =========================
class ExchangePairCreate(BaseModel):
    from_currency_id: int
    to_currency_id: int
    rate: float
    fee_percent: float = 0
    min_amount: float = 0
    max_amount: float | None = None


class ExchangePairUpdate(BaseModel):
    rate: float | None = None
    fee_percent: float | None = None
    min_amount: float | None = None
    max_amount: float | None = None
    is_active: bool | None = None

class AdminExchangeExecuteRequest(BaseModel):
    user_id: int

    from_currency: str
    to_currency: str

    from_currency: str
    to_currency: str

    from_network_id: int | None = None
    to_network_id: int | None = None

    amount: float | None = None
    custom_rate: float | None = None


# =========================
# GET USER AVAILABLE BALANCE
# =========================
def get_user_available_balance(
    db: Session,
    user_id: int,
    currency_symbol: str,
    network_id: int | None = None
):

    base_query = (
        db.query(UserBalance)
        .join(Currency, UserBalance.currency_id == Currency.id)
        .filter(
            UserBalance.user_id == user_id,
            Currency.symbol == currency_symbol.upper()
        )
    )

    balance_rows = base_query.all()

    print(f"[BALANCE DEBUG] user={user_id} currency={currency_symbol} "
          f"requested_network_id={network_id} "
          f"rows={[(b.id, b.network_id, float(b.available_balance or 0)) for b in balance_rows]}")

    if network_id is not None:
        filtered = [b for b in balance_rows if b.network_id == network_id]
        if filtered:
            balance_rows = filtered
        else:
            print(f"[BALANCE DEBUG] no rows matched network_id={network_id}, "
                  f"falling back to all networks for {currency_symbol}")
            # fall back to summing all networks for this currency

    available = 0
    frozen = 0

    for b in balance_rows:
        available += float(b.available_balance or 0)
        frozen += float(b.frozen_balance or 0)

    return {
        "available": available,
        "frozen": frozen,
        "total": available + frozen
    }
# =========================
# ADMIN PREVIEW EXCHANGE
# =========================
@router.post("/preview")
def admin_preview_exchange(
    payload: AdminExchangeExecuteRequest,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):

    if not has_access(admin, "exchange.manage"):
        raise HTTPException(403, "Access denied")
    
    amount = Decimal(str(payload.amount))

    if amount is None or amount <= 0:
        raise HTTPException(400, "Invalid amount")

    from_cur = db.query(Currency).filter(
        Currency.symbol == payload.from_currency.upper()
    ).first()

    to_cur = db.query(Currency).filter(
        Currency.symbol == payload.to_currency.upper()
    ).first()

    if not from_cur or not to_cur:
        raise HTTPException(404, "Currency not found")

    pair = db.query(ExchangePair).filter(
        ExchangePair.from_currency_id == from_cur.id,
        ExchangePair.to_currency_id == to_cur.id,
        ExchangePair.is_active == True
    ).first()

    if not pair:
        raise HTTPException(
            400,
            "Exchange pair unavailable"
        )


    # =========================
    # VALIDATE CUSTOM RATE
    # =========================
    if (
        payload.custom_rate is not None
        and payload.custom_rate <= 0
    ):
        raise HTTPException(
            400,
            "Invalid custom rate"
        )

    # =========================
    # BALANCE CHECK
    # =========================

    balances = get_user_available_balance(
        db=db,
        user_id=payload.user_id,
        currency_symbol=payload.from_currency,
        network_id=payload.from_network_id
    )

    max_exchangeable = balances["available"]

    if amount > max_exchangeable:
        raise HTTPException(
            400,
            f"Maximum exchangeable amount is {max_exchangeable}"
        )

    # =========================
    # MIN/MAX VALIDATION
    # =========================

    if amount < pair.min_amount:
        raise HTTPException(
            400,
            f"Minimum amount is {pair.min_amount}"
        )

    if (
        pair.max_amount is not None
        and amount > pair.max_amount
    ):
        raise HTTPException(
            400,
            f"Maximum amount is {pair.max_amount}"
        )

    # =========================
    # SELECT RATE
    # =========================
    if payload.custom_rate is not None: 
        normalized_custom_rate = normalize_db_rate(payload.custom_rate, payload.from_currency)
        
        selected_rate = normalized_custom_rate
    else: selected_rate = pair.rate

    # =========================
    rate = Decimal(str(selected_rate))


   # fee must be calculated from from_currency
    fee_percent = Decimal(str(pair.fee_percent))
  
    fee_amount = (amount * fee_percent) / Decimal("100")

    gross_amount = amount - fee_amount

    converted_amount = gross_amount * rate

    return {

        "from_currency": payload.from_currency.upper(),

        "to_currency": payload.to_currency.upper(),

        "from_network_id": payload.from_network_id,
        "to_network_id": payload.to_network_id,

        "input_amount": amount,

        "default_rate": pair.rate,
        "selected_rate":  selected_rate,
        "using_custom_rate": payload.custom_rate is not None,

        "gross_amount": gross_amount,

        "fee_percent": pair.fee_percent,

        "fee_amount": fee_amount,

        "received_amount": converted_amount,

        # IMPORTANT FOR UI
        "available_balance": balances["available"],
        "frozen_balance": balances["frozen"],
        "max_exchangeable": max_exchangeable
    }


# =========================
# ADMIN EXECUTE EXCHANGE
# =========================
@router.post("/execute")
def admin_execute_exchange(
    payload: AdminExchangeExecuteRequest,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):

    if not has_access(admin, "exchange.manage"):
        raise HTTPException(403, "Access denied")

    if payload.amount is None or payload.amount <= 0:
        raise HTTPException(400, "Invalid amount")

    # =========================
    # VALIDATE CUSTOM RATE
    # =========================
    if (
        payload.custom_rate is not None
        and payload.custom_rate <= 0
    ):
        raise HTTPException(
            400,
            "Invalid custom rate"
        )
    
        # =========================
    # SELECT RATE
    # =========================
    if payload.custom_rate is not None: 
        exchange_rate = normalize_db_rate(payload.custom_rate, payload.from_currency)
    else : exchange_rate = payload.custom_rate
    

    # =========================
    # BALANCE CHECK (network-aware)
    # =========================
    balances = get_user_available_balance(
        db=db,
        user_id=payload.user_id,
        currency_symbol=payload.from_currency,
        network_id=payload.from_network_id
    )

    if payload.amount > balances["available"]:
        raise HTTPException(
            400,
            "INSUFFICIENT_BALANCE"
        )
  
    result = execute_exchange(

        db=db,

        user_id=payload.user_id,

        from_currency_symbol=payload.from_currency,

        to_currency_symbol=payload.to_currency,

        from_network_id=payload.from_network_id,
        to_network_id=payload.to_network_id,

        amount=payload.amount,

        custom_rate=exchange_rate
    )

    return result
# =========================
# GET Exchange Rate
# =========================
@router.post("/rate")
def get_rate_only(
    payload: AdminExchangeExecuteRequest,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    if not has_access(admin, "exchange.manage"):
        raise HTTPException(403, "Access denied")

    result = get_exchange_rate(
        db=db,
        from_currency_symbol=payload.from_currency,
        to_currency_symbol=payload.to_currency,
        custom_rate=payload.custom_rate
    )

    return result
# =========================
# GET ALL PAIRS
# =========================

@router.get("/")
def get_pairs(
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    if not has_access(admin, "exchange.manage"):
        raise HTTPException(403, "Access denied")

    pairs = db.query(ExchangePair).all()


    result = []
    for p in pairs:

        display_rate = normalize_db_rate(
                p.rate,
                p.from_currency.symbol
            )

        result.append({
            "id": p.id,
            "from_currency": {
                "id": p.from_currency.id,
                "symbol": p.from_currency.symbol,
                "name": p.from_currency.name,
            },
            "to_currency": {
                "id": p.to_currency.id,
                "symbol": p.to_currency.symbol,
                "name": p.to_currency.name,
            },
            "rate": display_rate,
            "fee_percent": p.fee_percent,
            "min_amount": p.min_amount,
            "max_amount": p.max_amount,
            "is_active": p.is_active,
        })
    return result


# =========================
# CREATE PAIR
# =========================
@router.post("/")
def create_pair(
    payload: ExchangePairCreate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    if not has_access(admin, "exchange.manage"):
        raise HTTPException(403, "Access denied")

    if payload.from_currency_id == payload.to_currency_id:
        raise HTTPException(400, "Cannot exchange same currency")

    if payload.rate <= 0:
        raise HTTPException(400, "Invalid rate")

    from_currency = db.query(Currency).filter(Currency.id == payload.from_currency_id).first()
    to_currency = db.query(Currency).filter(Currency.id == payload.to_currency_id).first()

    if not from_currency or not to_currency:
        raise HTTPException(404, "Currency not found")

    existing = db.query(ExchangePair).filter(
        ExchangePair.from_currency_id == payload.from_currency_id,
        ExchangePair.to_currency_id == payload.to_currency_id
    ).first()

    if existing:
        raise HTTPException(400, "Exchange pair already exists")
    
    calculated_rate = normalize_db_rate(
        payload.rate,
        from_currency.symbol
    )
    pair = ExchangePair(
        from_currency_id=payload.from_currency_id,
        to_currency_id=payload.to_currency_id,
        rate=calculated_rate,
        fee_percent=payload.fee_percent,
        min_amount=payload.min_amount,
        max_amount=payload.max_amount,
        is_active=True
    )

    db.add(pair)
    db.commit()
    db.refresh(pair)

    return {"success": True, "id": pair.id}


# =========================
# UPDATE PAIR
# =========================
@router.put("/{pair_id}")
def update_pair(
    pair_id: int,
    payload: ExchangePairUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    if not has_access(admin, "exchange.manage"):
        raise HTTPException(403, "Access denied")

    pair = db.query(ExchangePair).filter(ExchangePair.id == pair_id).first()
    if not pair:
        raise HTTPException(404, "Pair not found")
    
    # Get currencies
    from_currency = db.query(Currency).filter(
        Currency.id == pair.from_currency_id
    ).first()

    # =========================
    # LOG RATE/FEE CHANGE (before mutating pair)
    # =========================
    new_rate = (
        normalize_db_rate(payload.rate, from_currency.symbol)
        if payload.rate is not None
        else None
    )

    # Detect changes
    rate_changing = (
        payload.rate is not None
        and new_rate != pair.rate
    )

    fee_changing = (
        payload.fee_percent is not None
        and payload.fee_percent != pair.fee_percent
    )
    if rate_changing or fee_changing:
        history = ExchangeRateHistory(
            pair_id=pair.id,
            old_rate=pair.rate,
            new_rate=new_rate,
            old_fee_percent=pair.fee_percent,
            new_fee_percent=payload.fee_percent if fee_changing else pair.fee_percent,
            changed_by=admin["user_id"],
        )
        db.add(history)

    if payload.rate is not None:
        pair.rate = new_rate
    if payload.fee_percent is not None:
        pair.fee_percent = payload.fee_percent
    if payload.min_amount is not None:
        pair.min_amount = payload.min_amount
    if payload.max_amount is not None:
        pair.max_amount = payload.max_amount
    if payload.is_active is not None:
        pair.is_active = payload.is_active

    db.commit()
    return {"success": True}
# =========================
# DELETE PAIR
# =========================
@router.delete("/{pair_id}")
def delete_pair(
    pair_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    if not has_access(admin, "exchange.manage"):
        raise HTTPException(403, "Access denied")

    pair = db.query(ExchangePair).filter(ExchangePair.id == pair_id).first()
    if not pair:
        raise HTTPException(404, "Pair not found")

    db.delete(pair)
    db.commit()
    return {"success": True}


# =========================
# ADMIN - ALL ORDERS
# =========================
@router.get("/orders")
def admin_all_orders(
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    if not has_access(admin, "exchange.manage"):
        raise HTTPException(403, "Access denied")

    orders = (
        db.query(ExchangeOrder)
        .options(
            joinedload(ExchangeOrder.user),
            joinedload(ExchangeOrder.from_currency),
            joinedload(ExchangeOrder.to_currency),
        )
        .order_by(ExchangeOrder.id.desc())
        .all()
    )
    result = []
    for o in orders:
        from_cur = db.query(Currency).filter(Currency.id == o.from_currency_id).first()
        to_cur = db.query(Currency).filter(Currency.id == o.to_currency_id).first()

        result.append({
            "id": o.id,
            "user_id": o.user_id,
            "username": o.user.username if o.user else None,
            "from_currency": {
                "id": from_cur.id if from_cur else None,
                "symbol": from_cur.symbol if from_cur else "N/A"
            },
            "to_currency": {
                "id": to_cur.id if to_cur else None,
                "symbol": to_cur.symbol if to_cur else "N/A"
            },
            "from_amount": float(o.from_amount),
            "to_amount": float(o.to_amount),
            "rate": float(o.rate),
            "fee_percent": float(o.fee_percent or 0),
            "fee_amount": float(o.fee_amount or 0),
            "status": o.status,
            "created_at": o.created_at,
        })
    return result

# =========================
# ADMIN - USER EXCHANGE ORDERS
# =========================
@router.get("/users/{user_id}/orders")
def admin_user_exchange_orders(
    user_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    if not has_access(admin, "exchange.manage"):
        raise HTTPException(403, "Access denied")

    orders = (
        db.query(ExchangeOrder)
        .options(
            joinedload(ExchangeOrder.user),
            joinedload(ExchangeOrder.from_currency),
            joinedload(ExchangeOrder.to_currency),
        )
        .filter(ExchangeOrder.user_id == user_id)
        .order_by(ExchangeOrder.id.desc())
        .all()
    )

    result = []

    for o in orders:
        from_cur = (
            db.query(Currency)
            .filter(Currency.id == o.from_currency_id)
            .first()
        )

        to_cur = (
            db.query(Currency)
            .filter(Currency.id == o.to_currency_id)
            .first()
        )

        result.append({
            "id": o.id,
            "user_id": o.user_id,
            "username": o.user.username if o.user else None,


            "from_currency": {
                "id": from_cur.id if from_cur else None,
                "symbol": from_cur.symbol if from_cur else "N/A"
            },

            "to_currency": {
                "id": to_cur.id if to_cur else None,
                "symbol": to_cur.symbol if to_cur else "N/A"
            },

            "from_amount": float(o.from_amount),
            "to_amount": float(o.to_amount),

            "rate": float(o.rate),
            "fee_percent": float(o.fee_percent or 0),
            "fee_amount": float(o.fee_amount or 0),

            "status": o.status,
            "created_at": o.created_at,
        })

    return result



@router.get("/failed-sweeps")
def get_failed_sweeps(
    resolved: bool = False,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    if not (has_access(admin, "exchange.manage") and has_access(admin, "finance.manage")):
        raise HTTPException(403, "Access denied")

    sweeps = (
        db.query(FailedSweep)
        .options(joinedload(FailedSweep.user))
        .filter(FailedSweep.resolved == resolved)
        .order_by(FailedSweep.id.desc())
        .all()
    )

    return [{
        "id": s.id,
        "user_id": s.user_id,
        "username": s.user.username if s.user else None,
        "amount": s.amount,
        "currency": s.currency_symbol,
        "network": s.network,
        "tatum_symbol": s.tatum_symbol,
        "reason": s.reason,
        "error": s.error,
        "retries": s.retries,
        "resolved": s.resolved,
        "exchange_order_id": s.exchange_order_id,
        "created_at": s.created_at,
        "resolved_at": s.resolved_at,
        "last_retry_at": s.last_retry_at,
    } for s in sweeps]


@router.post("/failed-sweeps/{sweep_id}/retry")
def manual_retry_sweep(
    sweep_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    if not (has_access(admin, "exchange.manage") and has_access(admin, "finance.manage")):
        raise HTTPException(403, "Access denied")

    from app.services.sweep_service import retry_failed_sweeps
    results = retry_failed_sweeps(db)
    return results