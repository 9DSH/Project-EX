from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.rls import get_db_rls_bot_context
from app.core.bot_service_auth import get_bot_service_context
from app.models.exchange_pair import ExchangePair
from app.services.exchange_service import normalize_db_rate
from app.models.wire_transfer_pair import WireTransferPair
from app.models.product import Product
from app.models.user import User , TelegramBotSettings
from app.routes.shared_functions import _admin_username_map

router = APIRouter(prefix="/bot-context", tags=["Bot Context"])


@router.get("/access-points")
def get_admin_access_points(
    ctx: dict = Depends(get_bot_service_context),
    db: Session = Depends(get_db_rls_bot_context),
):
    if ctx["admin_id"] is None:
        return {"access_points": [], "role": None, "enabled_services": None}
    admin = db.query(User).filter(User.user_id == ctx["admin_id"]).first()
    if not admin:
        return {"access_points": [], "role": None, "enabled_services": None}
    settings = db.query(TelegramBotSettings).filter(
        TelegramBotSettings.admin_id == ctx["admin_id"],
        TelegramBotSettings.bot_kind == "admin",
    ).first()
    return {
        "access_points": admin.access_points or [],
        "role": admin.role,
        "enabled_services": settings.enabled_services if settings else None,
    }

@router.get("/exchange-pairs")
def get_exchange_pairs(db: Session = Depends(get_db_rls_bot_context)):
    pairs = db.query(ExchangePair).filter(ExchangePair.is_active == True).all()
    admins_map = _admin_username_map(db, {p.admin_id for p in pairs})
    return [{
        "id": p.id,
        "from_currency": {"symbol": p.from_currency.symbol},
        "to_currency": {"symbol": p.to_currency.symbol},
        "rate": normalize_db_rate(p.rate, p.from_currency.symbol),
        "fee_percent": p.fee_percent,
        "admin_id": p.admin_id,
        "admin_username": admins_map.get(p.admin_id),
    } for p in pairs]


@router.get("/wire-pairs")
def get_wire_pairs(db: Session = Depends(get_db_rls_bot_context)):
    pairs = db.query(WireTransferPair).filter(WireTransferPair.is_active == True).all()
    admins_map = _admin_username_map(db, {p.admin_id for p in pairs})
    print(admins_map)
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