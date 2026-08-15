from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.models.currency import Currency
router = APIRouter(
    prefix="/admin/currencies",
    tags=["Admin Currencies"]
)


# =========================
# SCHEMAS
# =========================
class CurrencyCreate(BaseModel):
    symbol: str
    name: str
    type: str = "crypto"
    decimals: int = 2
    icon: str | None = None
    min_deposit: float = 0
    min_withdraw: float = 0


class CurrencyUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    decimals: int | None = None
    is_active: bool | None = None
    icon: str | None = None
    min_deposit: float | None = None
    min_withdraw: float | None = None


# =========================
# LIST
# =========================
@router.get("/")
def get_currencies(db: Session = Depends(get_db)):
    return db.query(Currency).order_by(Currency.id.desc()).all()


# =========================
# CREATE
# =========================
@router.post("/")
def create_currency(payload: CurrencyCreate, db: Session = Depends(get_db)):

    existing = db.query(Currency).filter(
        Currency.symbol == payload.symbol.upper()
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Currency already exists")

    currency = Currency(
        symbol=payload.symbol.upper(),
        name=payload.name,
        type=payload.type,
        decimals=payload.decimals,
        icon=payload.icon,
        min_deposit=payload.min_deposit,
        min_withdraw=payload.min_withdraw
    )

    db.add(currency)
    db.commit()
    db.refresh(currency)

    return currency


# =========================
# UPDATE
# =========================
@router.put("/{currency_id}")
def update_currency(
    currency_id: int,
    payload: CurrencyUpdate,
    db: Session = Depends(get_db)
):

    currency = db.query(Currency).filter(
        Currency.id == currency_id
    ).first()

    if not currency:
        raise HTTPException(status_code=404, detail="Currency not found")

    data = payload.dict(exclude_unset=True)

    for key, value in data.items():
        setattr(currency, key, value)

    db.commit()
    db.refresh(currency)

    return currency


# =========================
# DELETE
# =========================
@router.delete("/{currency_id}")
def delete_currency(currency_id: int, db: Session = Depends(get_db)):

    currency = db.query(Currency).filter(
        Currency.id == currency_id
    ).first()

    if not currency:
        raise HTTPException(status_code=404, detail="Currency not found")

    db.delete(currency)
    db.commit()

    return {"status": "deleted"}