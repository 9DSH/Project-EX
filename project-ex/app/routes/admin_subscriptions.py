from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.rls import get_db_rls
from app.core.security import get_current_user, is_master
from app.models.user import User
from app.models.currency import Currency
from app.models.network import Network
from app.models.subscription import (
    AccessPointCatalog,
    AccessPointPrice,
    Plan,
    PlanPrice,
    PlanAccessPoint,
    AdminSubscription,
    AdminAddon,
    AdminAccessGrant,
    SubscriptionInvoice,
)
from app.services.subscription_service import (
    master_set_subscription_status,
    master_grant_access,
    master_revoke_access,
    subscribe_to_plan,
    buy_addon,
    cancel_addon,
    effective_price,
)

router = APIRouter(prefix="/admin/subscriptions", tags=["Admin Subscriptions"])


def get_master(user=Depends(get_current_user)):
    if not is_master(user):
        raise HTTPException(403, "Master access required")
    return user


def get_admin_self(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


# =========================================================
# SCHEMAS
# =========================================================
class AccessPointCreate(BaseModel):
    key: str
    label: str
    is_active: bool = True
    required_plan_id: Optional[int] = None


class AccessPointUpdate(BaseModel):
    label: Optional[str] = None
    is_active: Optional[bool] = None
    required_plan_id: Optional[int] = None
    clear_required_plan: bool = False


class PriceUpsert(BaseModel):
    currency_id: int
    network_id: int
    price: float
    discount_percent: float = 0
    is_active: bool = True


class PlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True
    is_default: bool = False
    duration_days: int = 30


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    duration_days: Optional[int] = None


class PlanAccessPointItem(BaseModel):
    access_point_id: int
    choice_group: Optional[str] = None


class PlanAccessPointsSet(BaseModel):
    items: list[PlanAccessPointItem]


class ForceStatusPayload(BaseModel):
    status: str  # active | grace | expired


class GrantPayload(BaseModel):
    key: str


class SubscribePayload(BaseModel):
    plan_id: int
    currency_id: Optional[int] = None
    network_id: Optional[int] = None
    chosen_options: Optional[dict] = None


class AddonPurchasePayload(BaseModel):
    access_point_id: int
    currency_id: int
    network_id: int


# =========================================================
# SERIALIZERS
# =========================================================
def _serialize_price(p):
    return {
        "id": p.id,
        "currency_id": p.currency_id,
        "currency": p.currency.symbol if p.currency else None,
        "network_id": p.network_id,
        "network": p.network.chain if p.network else None,
        "price": p.price,
        "discount_percent": p.discount_percent,
        "effective_price": effective_price(p.price, p.discount_percent),
        "is_active": p.is_active,
    }


def _serialize_access_point(ap: AccessPointCatalog):
    return {
        "id": ap.id,
        "key": ap.key,
        "label": ap.label,
        "is_active": ap.is_active,
        "required_plan_id": ap.required_plan_id,
        "required_plan_name": ap.required_plan.name if ap.required_plan else None,
        "prices": [_serialize_price(p) for p in ap.prices],
    }


def _serialize_plan(plan: Plan, db: Session):
    addons = db.query(AccessPointCatalog).filter(AccessPointCatalog.required_plan_id == plan.id).all()
    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "is_active": plan.is_active,
        "is_default": plan.is_default,
        "duration_days": plan.duration_days,
        "prices": [_serialize_price(p) for p in plan.prices],
        "access_points": [
            {
                "id": row.id,
                "access_point_id": row.access_point_id,
                "key": row.access_point.key if row.access_point else None,
                "label": row.access_point.label if row.access_point else None,
                "choice_group": row.choice_group,
            }
            for row in plan.access_points
        ],
        "addons": [_serialize_access_point(ap) for ap in addons],
    }


def _serialize_subscription(sub: AdminSubscription):
    return {
        "id": sub.id,
        "admin_id": sub.admin_id,
        "plan_id": sub.plan_id,
        "plan_name": sub.plan.name if sub.plan else None,
        "status": sub.status,
        "currency": sub.currency.symbol if sub.currency else None,
        "network": sub.network.chain if sub.network else None,
        "duration_days": sub.plan.duration_days if sub.plan else None,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "grace_started_at": sub.grace_started_at.isoformat() if sub.grace_started_at else None,
        "forced_by_master": sub.forced_by_master,
    }


def _serialize_addon(addon: AdminAddon):
    return {
        "id": addon.id,
        "admin_id": addon.admin_id,
        "access_point_id": addon.access_point_id,
        "key": addon.access_point.key if addon.access_point else None,
        "label": addon.access_point.label if addon.access_point else None,
        "status": addon.status,
        "currency": addon.currency.symbol if addon.currency else None,
        "network": addon.network.chain if addon.network else None,
        "current_period_end": addon.current_period_end.isoformat() if addon.current_period_end else None,
        "grace_started_at": addon.grace_started_at.isoformat() if addon.grace_started_at else None,
        "forced_by_master": addon.forced_by_master,
    }


def _serialize_invoice(inv: SubscriptionInvoice):
    return {
        "id": inv.id,
        "admin_id": inv.admin_id,
        "type": inv.type,
        "plan_id": inv.plan_id,
        "plan_name": inv.plan.name if inv.plan else None,
        "access_point_id": inv.access_point_id,
        "access_point_key": inv.access_point.key if inv.access_point else None,
        "amount": inv.amount,
        "discount_percent": inv.discount_percent,
        "currency": inv.currency.symbol if inv.currency else None,
        "network": inv.network.chain if inv.network else None,
        "status": inv.status,
        "note": inv.note,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
    }


def _serialize_grant(g: AdminAccessGrant):
    return {"id": g.id, "key": g.access_point_key, "source": g.source, "source_id": g.source_id}


# =========================================================
# ACCESS POINT CATALOG
# =========================================================
@router.get("/access-points")
def list_access_points(db: Session = Depends(get_db_rls), master=Depends(get_master)):
    rows = db.query(AccessPointCatalog).order_by(AccessPointCatalog.id.asc()).all()
    return [_serialize_access_point(r) for r in rows]


@router.post("/access-points")
def create_access_point(payload: AccessPointCreate, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    existing = db.query(AccessPointCatalog).filter(AccessPointCatalog.key == payload.key).first()
    if existing:
        raise HTTPException(400, "Access point key already exists")

    if payload.required_plan_id is not None:
        if not db.query(Plan).filter(Plan.id == payload.required_plan_id).first():
            raise HTTPException(404, "Required plan not found")

    ap = AccessPointCatalog(
        key=payload.key,
        label=payload.label,
        is_active=payload.is_active,
        required_plan_id=payload.required_plan_id,
    )
    db.add(ap)
    db.commit()
    db.refresh(ap)
    return _serialize_access_point(ap)


@router.put("/access-points/{access_point_id}")
def update_access_point(access_point_id: int, payload: AccessPointUpdate, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    ap = db.query(AccessPointCatalog).filter(AccessPointCatalog.id == access_point_id).first()
    if not ap:
        raise HTTPException(404, "Access point not found")

    if payload.label is not None:
        ap.label = payload.label
    if payload.is_active is not None:
        ap.is_active = payload.is_active

    if payload.clear_required_plan:
        ap.required_plan_id = None
    elif payload.required_plan_id is not None:
        if not db.query(Plan).filter(Plan.id == payload.required_plan_id).first():
            raise HTTPException(404, "Required plan not found")
        ap.required_plan_id = payload.required_plan_id

    db.commit()
    db.refresh(ap)
    return _serialize_access_point(ap)


@router.put("/access-points/{access_point_id}/prices")
def upsert_access_point_price(access_point_id: int, payload: PriceUpsert, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    ap = db.query(AccessPointCatalog).filter(AccessPointCatalog.id == access_point_id).first()
    if not ap:
        raise HTTPException(404, "Access point not found")

    if not db.query(Currency).filter(Currency.id == payload.currency_id).first():
        raise HTTPException(404, "Currency not found")
    if not db.query(Network).filter(Network.id == payload.network_id).first():
        raise HTTPException(404, "Network not found")
    if not (0 <= payload.discount_percent <= 100):
        raise HTTPException(400, "discount_percent must be between 0 and 100")

    row = db.query(AccessPointPrice).filter(
        AccessPointPrice.access_point_id == access_point_id,
        AccessPointPrice.currency_id == payload.currency_id,
        AccessPointPrice.network_id == payload.network_id,
    ).first()

    if row:
        row.price = payload.price
        row.discount_percent = payload.discount_percent
        row.is_active = payload.is_active
        row.updated_at = datetime.utcnow()
    else:
        row = AccessPointPrice(
            access_point_id=access_point_id,
            currency_id=payload.currency_id,
            network_id=payload.network_id,
            price=payload.price,
            discount_percent=payload.discount_percent,
            is_active=payload.is_active,
        )
        db.add(row)

    db.commit()
    db.refresh(ap)
    return _serialize_access_point(ap)


@router.delete("/access-points/{access_point_id}/prices/{price_id}")
def delete_access_point_price(access_point_id: int, price_id: int, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    row = db.query(AccessPointPrice).filter(
        AccessPointPrice.id == price_id, AccessPointPrice.access_point_id == access_point_id
    ).first()
    if not row:
        raise HTTPException(404, "Price not found")
    db.delete(row)
    db.commit()
    return {"success": True}


# =========================================================
# PLANS
# =========================================================
@router.get("/plans")
def list_plans(db: Session = Depends(get_db_rls), master=Depends(get_master)):
    rows = db.query(Plan).order_by(Plan.id.asc()).all()
    return [_serialize_plan(r, db) for r in rows]


@router.post("/plans")
def create_plan(payload: PlanCreate, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    if payload.duration_days <= 0:
        raise HTTPException(400, "duration_days must be positive")

    if payload.is_default:
        db.query(Plan).filter(Plan.is_default == True).update({"is_default": False})  # noqa: E712

    plan = Plan(
        name=payload.name,
        description=payload.description,
        is_active=payload.is_active,
        is_default=payload.is_default,
        duration_days=payload.duration_days,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _serialize_plan(plan, db)


@router.put("/plans/{plan_id}")
def update_plan(plan_id: int, payload: PlanUpdate, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")

    if payload.name is not None:
        plan.name = payload.name
    if payload.description is not None:
        plan.description = payload.description
    if payload.is_active is not None:
        plan.is_active = payload.is_active
    if payload.duration_days is not None:
        if payload.duration_days <= 0:
            raise HTTPException(400, "duration_days must be positive")
        plan.duration_days = payload.duration_days
    if payload.is_default is not None:
        if payload.is_default:
            db.query(Plan).filter(Plan.id != plan_id, Plan.is_default == True).update({"is_default": False})  # noqa: E712
        plan.is_default = payload.is_default

    plan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)
    return _serialize_plan(plan, db)


@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")

    in_use = db.query(AdminSubscription).filter(AdminSubscription.plan_id == plan_id).count()
    if in_use > 0:
        raise HTTPException(400, "Plan has active subscribers and cannot be deleted. Deactivate it instead.")

    linked_addons = db.query(AccessPointCatalog).filter(AccessPointCatalog.required_plan_id == plan_id).count()
    if linked_addons > 0:
        raise HTTPException(400, "Plan is required by one or more add-ons. Unlink them first.")

    db.delete(plan)
    db.commit()
    return {"success": True}


@router.put("/plans/{plan_id}/prices")
def upsert_plan_price(plan_id: int, payload: PriceUpsert, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    if plan.is_default:
        raise HTTPException(400, "The default plan is always free and cannot be priced")

    if not db.query(Currency).filter(Currency.id == payload.currency_id).first():
        raise HTTPException(404, "Currency not found")
    if not db.query(Network).filter(Network.id == payload.network_id).first():
        raise HTTPException(404, "Network not found")
    if not (0 <= payload.discount_percent <= 100):
        raise HTTPException(400, "discount_percent must be between 0 and 100")

    row = db.query(PlanPrice).filter(
        PlanPrice.plan_id == plan_id,
        PlanPrice.currency_id == payload.currency_id,
        PlanPrice.network_id == payload.network_id,
    ).first()

    if row:
        row.price = payload.price
        row.discount_percent = payload.discount_percent
        row.is_active = payload.is_active
        row.updated_at = datetime.utcnow()
    else:
        row = PlanPrice(
            plan_id=plan_id,
            currency_id=payload.currency_id,
            network_id=payload.network_id,
            price=payload.price,
            discount_percent=payload.discount_percent,
            is_active=payload.is_active,
        )
        db.add(row)

    db.commit()
    db.refresh(plan)
    return _serialize_plan(plan, db)


@router.delete("/plans/{plan_id}/prices/{price_id}")
def delete_plan_price(plan_id: int, price_id: int, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    row = db.query(PlanPrice).filter(PlanPrice.id == price_id, PlanPrice.plan_id == plan_id).first()
    if not row:
        raise HTTPException(404, "Price not found")
    db.delete(row)
    db.commit()
    return {"success": True}


@router.put("/plans/{plan_id}/access-points")
def set_plan_access_points(plan_id: int, payload: PlanAccessPointsSet, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    """
    Full replace of a plan's FIXED/included access points (including
    choice groups). Existing admin subscriptions are NOT retroactively
    changed — this only affects future subscribe/switch/renew calls.
    """
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")

    for item in payload.items:
        if not db.query(AccessPointCatalog).filter(AccessPointCatalog.id == item.access_point_id).first():
            raise HTTPException(404, f"Access point {item.access_point_id} not found")

    db.query(PlanAccessPoint).filter(PlanAccessPoint.plan_id == plan_id).delete()

    for item in payload.items:
        db.add(PlanAccessPoint(
            plan_id=plan_id,
            access_point_id=item.access_point_id,
            choice_group=item.choice_group,
        ))

    db.commit()
    db.refresh(plan)
    return _serialize_plan(plan, db)


# =========================================================
# ADMIN OVERSIGHT & MANUAL OVERRIDE
# =========================================================
@router.get("/admins")
def list_admin_subscriptions(db: Session = Depends(get_db_rls), master=Depends(get_master)):
    admins = db.query(User).filter(User.role == "admin").all()
    subs = {s.admin_id: s for s in db.query(AdminSubscription).all()}
    addons_by_admin = {}
    for a in db.query(AdminAddon).all():
        addons_by_admin.setdefault(a.admin_id, []).append(a)

    result = []
    for u in admins:
        sub = subs.get(u.user_id)
        result.append({
            "admin_id": u.user_id,
            "username": u.username,
            "subscription": _serialize_subscription(sub) if sub else None,
            "addons": [_serialize_addon(a) for a in addons_by_admin.get(u.user_id, [])],
        })
    return result


@router.get("/admins/{admin_id}")
def get_admin_subscription_detail(admin_id: int, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    user = db.query(User).filter(User.user_id == admin_id, User.role == "admin").first()
    if not user:
        raise HTTPException(404, "Admin not found")

    sub = db.query(AdminSubscription).filter(AdminSubscription.admin_id == admin_id).first()
    addons = db.query(AdminAddon).filter(AdminAddon.admin_id == admin_id).all()
    invoices = (
        db.query(SubscriptionInvoice)
        .filter(SubscriptionInvoice.admin_id == admin_id)
        .order_by(SubscriptionInvoice.created_at.desc())
        .limit(100)
        .all()
    )
    grants = db.query(AdminAccessGrant).filter(AdminAccessGrant.admin_id == admin_id).all()

    return {
        "admin_id": admin_id,
        "username": user.username,
        "access_points": user.access_points,
        "grants": [_serialize_grant(g) for g in grants],
        "subscription": _serialize_subscription(sub) if sub else None,
        "addons": [_serialize_addon(a) for a in addons],
        "invoices": [_serialize_invoice(i) for i in invoices],
    }


@router.put("/admins/{admin_id}/status")
def force_subscription_status(admin_id: int, payload: ForceStatusPayload, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    sub = master_set_subscription_status(db, admin_id, payload.status)
    return _serialize_subscription(sub)


@router.post("/admins/{admin_id}/grant")
def grant_admin_access(admin_id: int, payload: GrantPayload, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    user = db.query(User).filter(User.user_id == admin_id, User.role == "admin").first()
    if not user:
        raise HTTPException(404, "Admin not found")
    master_grant_access(db, admin_id, payload.key)
    db.refresh(user)
    return {"access_points": user.access_points}


@router.post("/admins/{admin_id}/revoke")
def revoke_admin_access(admin_id: int, payload: GrantPayload, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    user = db.query(User).filter(User.user_id == admin_id, User.role == "admin").first()
    if not user:
        raise HTTPException(404, "Admin not found")
    master_revoke_access(db, admin_id, payload.key)
    db.refresh(user)
    return {"access_points": user.access_points}


# =========================================================
# SELF-SERVE (admin's own account)
# =========================================================
@router.get("/catalog")
def browse_catalog(db: Session = Depends(get_db_rls), admin=Depends(get_admin_self)):
    plans = db.query(Plan).filter(Plan.is_active == True).order_by(Plan.id.asc()).all()  # noqa: E712
    access_points = db.query(AccessPointCatalog).filter(AccessPointCatalog.is_active == True).order_by(AccessPointCatalog.id.asc()).all()  # noqa: E712
    return {
        "plans": [_serialize_plan(p, db) for p in plans],
        "access_points": [_serialize_access_point(a) for a in access_points],
    }


@router.get("/me")
def get_my_subscription(db: Session = Depends(get_db_rls), admin=Depends(get_admin_self)):
    admin_id = admin["user_id"]
    sub = db.query(AdminSubscription).filter(AdminSubscription.admin_id == admin_id).first()
    addons = db.query(AdminAddon).filter(AdminAddon.admin_id == admin_id).all()
    invoices = (
        db.query(SubscriptionInvoice)
        .filter(SubscriptionInvoice.admin_id == admin_id)
        .order_by(SubscriptionInvoice.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "subscription": _serialize_subscription(sub) if sub else None,
        "addons": [_serialize_addon(a) for a in addons],
        "invoices": [_serialize_invoice(i) for i in invoices],
    }


@router.post("/me/subscribe")
def subscribe(payload: SubscribePayload, db: Session = Depends(get_db_rls), admin=Depends(get_admin_self)):
    sub = subscribe_to_plan(
        db,
        admin_id=admin["user_id"],
        plan_id=payload.plan_id,
        currency_id=payload.currency_id,
        network_id=payload.network_id,
        chosen_options=payload.chosen_options,
    )
    return _serialize_subscription(sub)


@router.post("/me/addons")
def purchase_addon(payload: AddonPurchasePayload, db: Session = Depends(get_db_rls), admin=Depends(get_admin_self)):
    addon = buy_addon(
        db,
        admin_id=admin["user_id"],
        access_point_id=payload.access_point_id,
        currency_id=payload.currency_id,
        network_id=payload.network_id,
    )
    return _serialize_addon(addon)


@router.delete("/me/addons/{access_point_id}")
def remove_addon(access_point_id: int, db: Session = Depends(get_db_rls), admin=Depends(get_admin_self)):
    return cancel_addon(db, admin_id=admin["user_id"], access_point_id=access_point_id)