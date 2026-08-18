from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.rls import get_db_rls
from app.core.security import get_current_user
from app.models.currency import Currency
from app.models.exchange_pair import ExchangePair
from app.models.exchange_order import ExchangeOrder

from app.services.exchange_service import execute_exchange, normalize_db_rate
from decimal import Decimal, getcontext

getcontext().prec = 28

router = APIRouter(prefix="/exchange", tags=["Exchange"])


# =========================
# SCHEMAS
# =========================
class ExchangeRequest(BaseModel):

    from_currency: str
    to_currency: str
    amount: float

# =========================
# GET AVAILABLE PAIRS
# =========================
@router.get("/pairs")
def get_pairs(
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):

    pairs = db.query(ExchangePair).filter(
        ExchangePair.is_active == True,
        ExchangePair.admin_id == user["admin_id"]
    ).all()

    result = []

    for p in pairs:
        exchange_rate = normalize_db_rate(p.rate, p.from_currency.symbol)
        result.append({
            "id": p.id,
            "from_currency": {
                "id":     p.from_currency.id,
                "symbol": p.from_currency.symbol,
                "name":   p.from_currency.name,
            },
            "to_currency": {
                "id":     p.to_currency.id,
                "symbol": p.to_currency.symbol,
                "name":   p.to_currency.name,
            },
            "rate":        exchange_rate,
            "fee_percent": p.fee_percent,
            "min_amount":  p.min_amount,
            "max_amount":  p.max_amount,
            "is_active":   p.is_active,
            "created_at":  p.created_at,
        })


    return result


# =========================
# PREVIEW EXCHANGE
# =========================
@router.post("/preview")
def preview_exchange(
    payload: ExchangeRequest,
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
): 
    
    amount = Decimal(str(payload.amount))
    pair = db.query(ExchangePair).filter(

        ExchangePair.is_active == True,
        ExchangePair.admin_id == user["admin_id"],
        ExchangePair.from_currency.has(
            symbol=payload.from_currency.upper()
        ),

        ExchangePair.to_currency.has(
            symbol=payload.to_currency.upper()
        )

    ).first()

    if not pair:
        raise HTTPException(
            400,
            "Exchange pair unavailable"
        )

    if pair.admin_id != user["admin_id"]:
        raise HTTPException(403, "Pair not available for this account")
    
    amount = Decimal(str(payload.amount))

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
    

   # this is only fow showing rate to user not using for calculation
    reversed_rate = normalize_db_rate(pair.rate, payload.from_currency)

    rate = Decimal(str(pair.rate))

       # fee must be calculated from from_currency
    fee_percent = Decimal(str(pair.fee_percent))
  
    fee_amount = (amount * fee_percent) / Decimal("100")

    gross_amount = amount - fee_amount

    converted_amount = gross_amount * rate



    return {

        "from_currency": payload.from_currency.upper(),

        "to_currency": payload.to_currency.upper(),

        "input_amount": amount,

        "rate": reversed_rate,

        "gross_amount": gross_amount,

        "fee_percent": fee_percent,

        "fee_amount": fee_amount,

        "received_amount": converted_amount
    }


# =========================
# EXECUTE EXCHANGE
# =========================
@router.post("/execute")
def exchange(
    payload: ExchangeRequest,
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):

    result = execute_exchange(

        db=db,
        user_id=user["user_id"],
        admin_id=user["admin_id"],
        from_currency_symbol=payload.from_currency,
        to_currency_symbol=payload.to_currency,
        amount=payload.amount
    )

    return result


# =========================
# EXCHANGE HISTORY
# =========================
@router.get("/history")
def exchange_history(db: Session = Depends(get_db_rls), user=Depends(get_current_user)):

    orders = db.query(ExchangeOrder).filter(
        ExchangeOrder.user_id == user["user_id"]
    ).order_by(ExchangeOrder.id.desc()).all()

    result = []

    for o in orders:

        from_currency = db.query(Currency).filter(
            Currency.id == o.from_currency_id
        ).first()

        to_currency = db.query(Currency).filter(
            Currency.id == o.to_currency_id
        ).first()

        result.append({
            "id": o.id,
            "from_currency": from_currency.symbol if from_currency else "N/A",
            "to_currency": to_currency.symbol if to_currency else "N/A",
            "from_amount": o.from_amount,
            "to_amount": o.to_amount,
            "rate": o.rate,
            "fee_amount": o.fee_amount,
            "fee_percent": o.fee_percent,
            "status": o.status,
            "created_at": o.created_at
        })

    return result

