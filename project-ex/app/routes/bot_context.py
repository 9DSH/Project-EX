from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.rls import get_db_rls_bot_context
from app.core.bot_service_auth import get_bot_service_context
from app.models.exchange_pair import ExchangePair
from app.models.wire_transfer_pair import WireTransferPair
from app.models.product import Product
from app.models.user import User

router = APIRouter(prefix="/bot-context", tags=["Bot Context"])


def _admin_username_map(db: Session, admin_ids: set[int]):
    admin_ids = {a for a in admin_ids if a}
    if not admin_ids:
        return {}
    return {u.user_id: u.username for u in db.query(User).filter(User.user_id.in_(admin_ids)).all()}


@router.get("/access-points")
def get_admin_access_points(
    ctx: dict = Depends(get_bot_service_context),
    db: Session = Depends(get_db_rls_bot_context),
):
    """Fresh access_points lookup for the running bot's owning admin —
    fetched per interaction (short TTL cache lives bot-side, not here)."""
    if ctx["admin_id"] is None:
        return {"access_points": [], "role": None}
    admin = db.query(User).filter(User.user_id == ctx["admin_id"]).first()
    if not admin:
        return {"access_points": [], "role": None}
    return {"access_points": admin.access_points or [], "role": admin.role}


@router.get("/exchange-pairs")
def get_exchange_pairs(db: Session = Depends(get_db_rls_bot_context)):
    pairs = db.query(ExchangePair).filter(ExchangePair.is_active == True).all()
    admins_map = _admin_username_map(db, {p.admin_id for p in pairs})
    return [{
        "id": p.id,
        "from_currency": {"symbol": p.from_currency.symbol},
        "to_currency": {"symbol": p.to_currency.symbol},
        "rate": p.rate,
        "fee_percent": p.fee_percent,
        "admin_id": p.admin_id,
        "admin_username": admins_map.get(p.admin_id),
    } for p in pairs]


@router.get("/wire-pairs")
def get_wire_pairs(db: Session = Depends(get_db_rls_bot_context)):
    pairs = db.query(WireTransferPair).filter(WireTransferPair.is_active == True).all()
    admins_map = _admin_username_map(db, {p.admin_id for p in pairs})
    return [{
        "id": p.id,
        "from_currency": {"symbol": p.from_currency.symbol},
        "to_currency": {"symbol": p.to_currency.symbol},
        "rate": p.rate,
        "admin_id": p.admin_id,
        "admin_username": admins_map.get(p.admin_id),
    } for p in pairs]


@router.get("/products")
def get_products(
    category_id: Optional[int] = None,
    db: Session = Depends(get_db_rls_bot_context),
):
    q = db.query(Product).filter(Product.is_active == True)
    if category_id is not None:
        q = q.filter(Product.category_id == category_id)
    products = q.all()
    admins_map = _admin_username_map(db, {p.admin_id for p in products})
    return [{
        "id": p.id,
        "name": p.name,
        "plan": p.plan,
        "price": float(p.price),
        "currency": p.currency,
        "category_id": p.category_id,
        "admin_id": p.admin_id,
        "admin_username": admins_map.get(p.admin_id),
    } for p in products]