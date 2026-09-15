"""
app/services/subscription_service.py

Core of the admin subscription/access-point monetization system.

1. ACCESS PROVENANCE — AdminAccessGrant is the source of truth for who
   granted an admin a given access point (master_granted / plan_included /
   addon_purchased). User.access_points is a derived cache, recomputed as
   the union of all grant rows for that admin. Nothing should ever write
   to User.access_points directly outside of recompute_access_points().

2. BILLING — subscribe/switch/buy-addon/cancel-addon, all funneled through
   one _charge() helper that mirrors the balance-check/deduct pattern used
   in execute_exchange() and admin_users.update_balance(). Add-on
   purchases are gated server-side by AccessPointCatalog.required_plans —
   an admin qualifies if their current plan is ANY ONE of the plans
   listed there (empty list = open to everyone).
"""

import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_balance import UserBalance
from app.models.transaction import Transaction
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

RENEWAL_PERIOD_DAYS_DEFAULT = 30   # fallback for addons / plans w/o explicit duration
GRACE_PERIOD_DAYS = 7

TX_TYPE_SUBSCRIPTION_PLAN = "subscription_plan"
TX_TYPE_SUBSCRIPTION_ADDON = "subscription_addon"

SOURCE_MASTER = "master_granted"
SOURCE_PLAN = "plan_included"
SOURCE_ADDON = "addon_purchased"

ACTIVE_LIKE_STATUSES = ("active", "grace")  # access is still considered "held" during grace


# =========================================================
# ACCESS PROVENANCE
# =========================================================
def recompute_access_points(db: Session, admin_id: int) -> list[str]:
    rows = db.query(AdminAccessGrant.access_point_key).filter(
        AdminAccessGrant.admin_id == admin_id
    ).distinct().all()

    keys = sorted({r[0] for r in rows})

    user = db.query(User).filter(User.user_id == admin_id).first()
    if user:
        user.access_points = keys
        db.commit()

    return keys


def grant_access(db: Session, admin_id: int, key: str, source: str, source_id: Optional[int] = None):
    existing = db.query(AdminAccessGrant).filter(
        AdminAccessGrant.admin_id == admin_id,
        AdminAccessGrant.access_point_key == key,
        AdminAccessGrant.source == source,
        AdminAccessGrant.source_id == source_id,
    ).first()

    if not existing:
        db.add(AdminAccessGrant(
            admin_id=admin_id,
            access_point_key=key,
            source=source,
            source_id=source_id,
        ))
        db.commit()

    recompute_access_points(db, admin_id)


def revoke_access(db: Session, admin_id: int, key: str, source: str, source_id: Optional[int] = None):
    db.query(AdminAccessGrant).filter(
        AdminAccessGrant.admin_id == admin_id,
        AdminAccessGrant.access_point_key == key,
        AdminAccessGrant.source == source,
        AdminAccessGrant.source_id == source_id,
    ).delete()
    db.commit()

    recompute_access_points(db, admin_id)


def revoke_all_for_source(db: Session, admin_id: int, source: str, source_id: Optional[int] = None):
    db.query(AdminAccessGrant).filter(
        AdminAccessGrant.admin_id == admin_id,
        AdminAccessGrant.source == source,
        AdminAccessGrant.source_id == source_id,
    ).delete()
    db.commit()

    recompute_access_points(db, admin_id)


def sync_master_grants(db: Session, admin_id: int, keys: list[str]):
    """
    Master's admin-edit screen sends the FULL desired list of
    master-granted access points. Diff against existing SOURCE_MASTER
    grants and add/remove accordingly — plan/addon-sourced grants are
    completely untouched.
    """
    existing = db.query(AdminAccessGrant).filter(
        AdminAccessGrant.admin_id == admin_id,
        AdminAccessGrant.source == SOURCE_MASTER,
    ).all()
    existing_keys = {row.access_point_key for row in existing}
    desired_keys = set(keys or [])

    to_add = desired_keys - existing_keys
    to_remove = existing_keys - desired_keys

    for key in to_add:
        db.add(AdminAccessGrant(admin_id=admin_id, access_point_key=key, source=SOURCE_MASTER, source_id=None))

    if to_remove:
        db.query(AdminAccessGrant).filter(
            AdminAccessGrant.admin_id == admin_id,
            AdminAccessGrant.source == SOURCE_MASTER,
            AdminAccessGrant.access_point_key.in_(to_remove),
        ).delete(synchronize_session=False)

    db.commit()
    recompute_access_points(db, admin_id)


# =========================================================
# HELPERS
# =========================================================
def _get_balance_row(db: Session, admin_id: int, currency_id: int, network_id: Optional[int]):
    q = db.query(UserBalance).filter(
        UserBalance.user_id == admin_id,
        UserBalance.currency_id == currency_id,
    )
    if network_id is not None:
        q = q.filter(UserBalance.network_id == network_id)
    else:
        q = q.filter(UserBalance.network_id.is_(None))
    return q.with_for_update().first()


def _charge(db: Session, admin_id: int, amount: float, currency_id: int, network_id: Optional[int], tx_type: str, description: str) -> Optional[Transaction]:
    if amount <= 0:
        return None

    balance_row = _get_balance_row(db, admin_id, currency_id, network_id)
    available = float(balance_row.available_balance or 0) if balance_row else 0.0

    if available < amount:
        raise HTTPException(400, "INSUFFICIENT_BALANCE")

    balance_row.available_balance = available - amount

    tx = Transaction(
        user_id=admin_id,
        currency_id=currency_id,
        network_id=network_id,
        amount=-amount,
        type=tx_type,
        status="completed",
        blockchain="internal",
    )
    db.add(tx)
    db.flush()

    return tx


def effective_price(price: float, discount_percent: float) -> float:
    discount_percent = max(0.0, min(100.0, float(discount_percent or 0)))
    return round(float(price or 0) * (1 - discount_percent / 100.0), 8)


def _resolve_plan_price(db: Session, plan_id: int, currency_id: int, network_id: int):
    row = db.query(PlanPrice).filter(
        PlanPrice.plan_id == plan_id,
        PlanPrice.currency_id == currency_id,
        PlanPrice.network_id == network_id,
        PlanPrice.is_active == True,  # noqa: E712
    ).first()
    if not row:
        raise HTTPException(400, "Plan is not priced for this currency/network pair")
    return effective_price(row.price, row.discount_percent), row.discount_percent


def _resolve_addon_price(db: Session, access_point_id: int, currency_id: int, network_id: int):
    row = db.query(AccessPointPrice).filter(
        AccessPointPrice.access_point_id == access_point_id,
        AccessPointPrice.currency_id == currency_id,
        AccessPointPrice.network_id == network_id,
        AccessPointPrice.is_active == True,  # noqa: E712
    ).first()
    if not row:
        raise HTTPException(400, "Access point is not priced for this currency/network pair")
    return effective_price(row.price, row.discount_percent), row.discount_percent


def _plan_access_keys(db: Session, plan_id: int, chosen_options: Optional[dict]) -> list[str]:
    rows = (
        db.query(PlanAccessPoint)
        .join(AccessPointCatalog, PlanAccessPoint.access_point_id == AccessPointCatalog.id)
        .filter(PlanAccessPoint.plan_id == plan_id, AccessPointCatalog.is_active == True)  # noqa: E712
        .all()
    )

    chosen_options = chosen_options or {}
    keys = []
    groups_seen = set()

    for row in rows:
        if row.choice_group:
            if row.choice_group in groups_seen:
                continue
            picked_id = chosen_options.get(row.choice_group)
            if picked_id is None:
                group_rows = [r for r in rows if r.choice_group == row.choice_group]
                picked_id = group_rows[0].access_point_id
            picked_row = next((r for r in rows if r.access_point_id == picked_id and r.choice_group == row.choice_group), None)
            if picked_row:
                keys.append(picked_row.access_point.key)
            groups_seen.add(row.choice_group)
        else:
            keys.append(row.access_point.key)

    return keys


def get_active_subscription(db: Session, admin_id: int) -> Optional[AdminSubscription]:
    return db.query(AdminSubscription).filter(AdminSubscription.admin_id == admin_id).first()


def _assert_required_plan(db: Session, admin_id: int, ap: AccessPointCatalog):
    """Server-side enforcement: an add-on with one or more required plans
    can only be purchased/renewed by an admin currently holding ANY ONE
    of those plans (active or in grace — grace still counts as "holding"
    it, since access isn't revoked yet). No required plans = open to
    everyone."""
    required_plans = ap.required_plans
    if not required_plans:
        return

    sub = get_active_subscription(db, admin_id)
    required_ids = {p.id for p in required_plans}
    if not sub or sub.plan_id not in required_ids or sub.status not in ACTIVE_LIKE_STATUSES:
        plan_names = ", ".join(p.name for p in required_plans)
        raise HTTPException(403, f"This add-on requires one of these plans: {plan_names}")


# =========================================================
# SIGNUP — FREE PLAN AUTO-ENROLL
# =========================================================
def enroll_free_plan_on_signup(db: Session, admin_id: int):
    plan = db.query(Plan).filter(Plan.is_default == True, Plan.is_active == True).first()  # noqa: E712
    if not plan:
        return None

    sub = AdminSubscription(
        admin_id=admin_id,
        plan_id=plan.id,
        status="active",
        currency_id=None,
        network_id=None,
        chosen_options=None,
        current_period_end=None,  # free plan never expires / never renews
    )
    db.add(sub)
    db.flush()

    db.add(SubscriptionInvoice(
        admin_id=admin_id,
        type="plan",
        plan_id=plan.id,
        amount=0,
        status="free",
        note="Auto-enrolled default plan on signup",
    ))
    db.commit()

    for key in _plan_access_keys(db, plan.id, None):
        grant_access(db, admin_id, key, source=SOURCE_PLAN, source_id=sub.id)

    return sub


# =========================================================
# SELF-SERVE BILLING
# =========================================================
def subscribe_to_plan(
    db: Session,
    admin_id: int,
    plan_id: int,
    currency_id: Optional[int],
    network_id: Optional[int],
    chosen_options: Optional[dict] = None,
):
    """Subscribe (first time) or switch to a different plan."""
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.is_active == True).first()  # noqa: E712
    if not plan:
        raise HTTPException(404, "Plan not found or inactive")

    if plan.is_default:
        price, discount = 0.0, 0.0
    else:
        if not currency_id or not network_id:
            raise HTTPException(400, "currency_id and network_id are required for a paid plan")
        price, discount = _resolve_plan_price(db, plan_id, currency_id, network_id)

    tx = _charge(
        db, admin_id, price, currency_id, network_id,
        TX_TYPE_SUBSCRIPTION_PLAN, f"Subscribe to plan #{plan_id}",
    )

    existing = db.query(AdminSubscription).filter(AdminSubscription.admin_id == admin_id).first()
    period_end = None if plan.is_default else (datetime.utcnow() + timedelta(days=plan.duration_days or RENEWAL_PERIOD_DAYS_DEFAULT))

    if existing:
        revoke_all_for_source(db, admin_id, source=SOURCE_PLAN, source_id=existing.id)
        existing.plan_id = plan.id
        existing.status = "active"
        existing.currency_id = currency_id
        existing.network_id = network_id
        existing.chosen_options = json.dumps(chosen_options) if chosen_options else None
        existing.current_period_end = period_end
        existing.grace_started_at = None
        existing.forced_by_master = False
        db.commit()
        sub = existing
    else:
        sub = AdminSubscription(
            admin_id=admin_id,
            plan_id=plan.id,
            status="active",
            currency_id=currency_id,
            network_id=network_id,
            chosen_options=json.dumps(chosen_options) if chosen_options else None,
            current_period_end=period_end,
        )
        db.add(sub)
        db.flush()
        db.commit()

    db.add(SubscriptionInvoice(
        admin_id=admin_id,
        type="plan",
        plan_id=plan.id,
        amount=price,
        discount_percent=discount,
        currency_id=currency_id,
        network_id=network_id,
        status="paid" if price > 0 else "free",
        transaction_id=tx.id if tx else None,
    ))
    db.commit()

    for key in _plan_access_keys(db, plan.id, chosen_options):
        grant_access(db, admin_id, key, source=SOURCE_PLAN, source_id=sub.id)

    return sub


def _assert_not_already_included(db: Session, admin_id: int, ap: AccessPointCatalog):
    """An access point already granted for free as a FIXED benefit of the
    admin's current plan cannot also be bought as a paid add-on."""
    already_included = db.query(AdminAccessGrant).filter(
        AdminAccessGrant.admin_id == admin_id,
        AdminAccessGrant.access_point_key == ap.key,
        AdminAccessGrant.source == SOURCE_PLAN,
    ).first()
    if already_included:
        raise HTTPException(400, "This access point is already included in your current plan and doesn't need to be purchased.")


def buy_addon(db: Session, admin_id: int, access_point_id: int, currency_id: int, network_id: int):
    ap = db.query(AccessPointCatalog).filter(
        AccessPointCatalog.id == access_point_id, AccessPointCatalog.is_active == True  # noqa: E712
    ).first()
    if not ap:
        raise HTTPException(404, "Access point not found or inactive")

    _assert_required_plan(db, admin_id, ap)
    _assert_not_already_included(db, admin_id, ap)

    price, discount = _resolve_addon_price(db, access_point_id, currency_id, network_id)

    tx = _charge(
        db, admin_id, price, currency_id, network_id,
        TX_TYPE_SUBSCRIPTION_ADDON, f"Purchase addon #{access_point_id}",
    )

    existing = db.query(AdminAddon).filter(
        AdminAddon.admin_id == admin_id,
        AdminAddon.access_point_id == access_point_id,
    ).first()

    period_end = datetime.utcnow() + timedelta(days=RENEWAL_PERIOD_DAYS_DEFAULT)

    if existing:
        existing.status = "active"
        existing.currency_id = currency_id
        existing.network_id = network_id
        existing.current_period_end = period_end
        existing.grace_started_at = None
        existing.forced_by_master = False
        db.commit()
        addon = existing
    else:
        addon = AdminAddon(
            admin_id=admin_id,
            access_point_id=access_point_id,
            status="active",
            currency_id=currency_id,
            network_id=network_id,
            current_period_end=period_end,
        )
        db.add(addon)
        db.flush()
        db.commit()

    db.add(SubscriptionInvoice(
        admin_id=admin_id,
        type="addon",
        access_point_id=access_point_id,
        amount=price,
        discount_percent=discount,
        currency_id=currency_id,
        network_id=network_id,
        status="paid",
        transaction_id=tx.id if tx else None,
    ))
    db.commit()

    grant_access(db, admin_id, ap.key, source=SOURCE_ADDON, source_id=addon.id)

    return addon


def cancel_addon(db: Session, admin_id: int, access_point_id: int):
    addon = db.query(AdminAddon).filter(
        AdminAddon.admin_id == admin_id,
        AdminAddon.access_point_id == access_point_id,
    ).first()
    if not addon:
        raise HTTPException(404, "Addon not found")

    addon.status = "expired"
    addon.current_period_end = None
    addon.grace_started_at = None
    db.commit()

    revoke_all_for_source(db, admin_id, source=SOURCE_ADDON, source_id=addon.id)

    return {"success": True}


# =========================================================
# MASTER MANUAL OVERRIDE
# =========================================================
def master_set_subscription_status(db: Session, admin_id: int, status: str):
    if status not in ("active", "grace", "expired"):
        raise HTTPException(400, "Invalid status")

    sub = db.query(AdminSubscription).filter(AdminSubscription.admin_id == admin_id).first()
    if not sub:
        raise HTTPException(404, "Subscription not found")

    sub.status = status
    sub.forced_by_master = True

    if status == "grace":
        sub.grace_started_at = datetime.utcnow()
    elif status == "active":
        sub.grace_started_at = None
    elif status == "expired":
        sub.grace_started_at = None
        revoke_all_for_source(db, admin_id, source=SOURCE_PLAN, source_id=sub.id)

    db.commit()
    return sub


def master_grant_access(db: Session, admin_id: int, key: str):
    """Master grants a single access point directly — independent of
    billing and of any required-plan gate on that access point."""
    grant_access(db, admin_id, key, source=SOURCE_MASTER, source_id=None)


def master_revoke_access(db: Session, admin_id: int, key: str):
    revoke_access(db, admin_id, key, source=SOURCE_MASTER, source_id=None)


# =========================================================
# RENEWAL ATTEMPTS (called by the background scheduler)
# =========================================================
def attempt_renew_subscription(db: Session, sub: AdminSubscription) -> bool:
    plan = db.query(Plan).filter(Plan.id == sub.plan_id).first()
    if not plan or not sub.currency_id or not sub.network_id:
        return False

    try:
        price, discount = _resolve_plan_price(db, sub.plan_id, sub.currency_id, sub.network_id)
    except HTTPException:
        return False

    try:
        tx = _charge(
            db, sub.admin_id, price, sub.currency_id, sub.network_id,
            TX_TYPE_SUBSCRIPTION_PLAN, f"Renew plan #{sub.plan_id}",
        )
    except HTTPException:
        return False

    db.add(SubscriptionInvoice(
        admin_id=sub.admin_id,
        type="plan",
        plan_id=sub.plan_id,
        amount=price,
        discount_percent=discount,
        currency_id=sub.currency_id,
        network_id=sub.network_id,
        status="paid",
        transaction_id=tx.id if tx else None,
        note="Renewal",
    ))

    sub.current_period_end = datetime.utcnow() + timedelta(days=plan.duration_days or RENEWAL_PERIOD_DAYS_DEFAULT)
    sub.status = "active"
    sub.grace_started_at = None
    db.commit()
    return True


def attempt_renew_addon(db: Session, addon: AdminAddon) -> bool:
    if not addon.currency_id or not addon.network_id:
        return False

    ap = db.query(AccessPointCatalog).filter(AccessPointCatalog.id == addon.access_point_id).first()
    if not ap:
        return False

    # If the required plan was revoked/changed since purchase, the addon
    # simply fails to renew like an insufficient-balance case — it will
    # enter grace and eventually be revoked by the scheduler, same as any
    # other failed renewal.
    try:
        _assert_required_plan(db, addon.admin_id, ap)
    except HTTPException:
        return False

    try:
        price, discount = _resolve_addon_price(db, addon.access_point_id, addon.currency_id, addon.network_id)
    except HTTPException:
        return False

    try:
        tx = _charge(
            db, addon.admin_id, price, addon.currency_id, addon.network_id,
            TX_TYPE_SUBSCRIPTION_ADDON, f"Renew addon #{addon.access_point_id}",
        )
    except HTTPException:
        return False

    db.add(SubscriptionInvoice(
        admin_id=addon.admin_id,
        type="addon",
        access_point_id=addon.access_point_id,
        amount=price,
        discount_percent=discount,
        currency_id=addon.currency_id,
        network_id=addon.network_id,
        status="paid",
        transaction_id=tx.id if tx else None,
        note="Renewal",
    ))

    addon.current_period_end = datetime.utcnow() + timedelta(days=RENEWAL_PERIOD_DAYS_DEFAULT)
    addon.status = "active"
    addon.grace_started_at = None
    db.commit()
    return True