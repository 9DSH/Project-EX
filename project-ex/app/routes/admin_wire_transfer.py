import json
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.core.rls import get_db_rls
from app.core.security import get_current_user, is_master
from app.core.permissions import has_access, ROLE_PERMISSIONS
from app.models.wire_transfer_pair import WireTransferPair
from app.models.wire_transfer_order import WireTransferOrder
from app.models.user import User
from app.routes.shared_functions import _admin_username_map
from app.models.user_balance import UserBalance
from app.models.currency import Currency
from app.models.transaction import Transaction
from app.services.telegram_service import send_telegram_message
from app.services.wire_transfer_expiry import expire_pending_wire_orders
from app.services.exchange_scope import can_view_all_admins, resolve_admin_scope
from app.constants.transaction_types import WIRE_TRANSFER, WIRE_REFUND
from app.constants.transaction_status import COMPLETED, FAILED, FROZEN, REJECTED

router = APIRouter(prefix="/admin/wire-transfer", tags=["Admin Wire Transfer"])


def get_admin(user=Depends(get_current_user)):
    role = user.get("role")
    if role not in ("master", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    if not has_access(user, "wire_transfer.view"):
        raise HTTPException(status_code=403, detail="Wire Transfer permission required")
    return user


# ─────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────

class WirePairCreate(BaseModel):
    from_currency_id: int
    to_currency_id:   int
    rate:             float
    fee_percent:      float = 0
    min_amount:       float = 0
    max_amount:       Optional[float] = None
    timeout_minutes:  int = 60
    required_fields:  Optional[dict] = None  # backward-compatible alias for sender_fields
    sender_fields:    Optional[dict] = None  # {key: {label, type, required}}
    receiver_methods: Optional[List[dict]] = None  # [{key, label, note, fields}]


class WirePairUpdate(BaseModel):
    rate:            Optional[float] = None
    fee_percent:     Optional[float] = None
    min_amount:      Optional[float] = None
    max_amount:      Optional[float] = None
    timeout_minutes: Optional[int]   = None
    required_fields: Optional[dict]  = None
    sender_fields:   Optional[dict]  = None
    receiver_methods: Optional[List[dict]] = None
    is_active:       Optional[bool]  = None


class OrderFailRequest(BaseModel):
    reason: str


class OrderDeliverRequest(BaseModel):
    message: Optional[str] = None


# ─────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────

def _normalize_receiver_methods(value) -> List[dict]:
    if not isinstance(value, list):
        return []
    out = []
    for idx, item in enumerate(value):
        if not isinstance(item, dict):
            continue
        raw_key = str(item.get("key") or item.get("id") or f"method_{idx + 1}").strip()
        key = raw_key.replace(" ", "_").lower()
        if not key:
            key = f"method_{idx + 1}"
        label = str(item.get("label") or item.get("name") or key.replace("_", " ").title()).strip()
        note = str(item.get("note") or "").strip()
        receiver_fields = item.get("receiver_fields")
        if not isinstance(receiver_fields, dict):
            receiver_fields = item.get("fields") if isinstance(item.get("fields"), dict) else {}
        sender_fields = item.get("sender_fields") if isinstance(item.get("sender_fields"), dict) else {}
        fee_percent = item.get("fee_percent")
        try:
            fee_percent = float(fee_percent) if fee_percent is not None else 0.0
        except (TypeError, ValueError):
            fee_percent = 0.0
        out.append({
            "key": key,
            "label": label or key.replace("_", " ").title(),
            "fee_percent": fee_percent,
            "note": note,
            "receiver_fields": receiver_fields,
            "fields": receiver_fields,  # backward-compatible alias
            "sender_fields": sender_fields,
        })
    return out


def _decode_pair_config(pair: WireTransferPair):
    config = {}
    if pair.required_fields:
        try:
            config = json.loads(pair.required_fields)
        except (TypeError, ValueError):
            config = {}

    if isinstance(config, dict) and ("sender_fields" in config or "receiver_methods" in config):
        sender_fields = config.get("sender_fields") if isinstance(config.get("sender_fields"), dict) else {}
        receiver_methods = _normalize_receiver_methods(config.get("receiver_methods"))
        return sender_fields, receiver_methods

    # Backward compatibility: old shape was direct sender required fields.
    sender_fields = config if isinstance(config, dict) else {}
    return sender_fields, []


def _encode_pair_config(sender_fields: Optional[dict], receiver_methods: Optional[List[dict]]) -> str:
    return json.dumps({
        "sender_fields": sender_fields if isinstance(sender_fields, dict) else {},
        "receiver_methods": _normalize_receiver_methods(receiver_methods or []),
    })


def _to_iso_utc(value: Optional[datetime]) -> Optional[str]:
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _expire_pending_orders(db: Session):
    changed = expire_pending_wire_orders(db)
    if changed > 0:
        db.commit()


def _get_irt_balance(db: Session, user_id: int, currency_id: int):
    return (
        db.query(UserBalance)
        .filter(
            UserBalance.user_id == user_id,
            UserBalance.currency_id == currency_id,
        )
        .first()
    )


def _apply_irt_lock_delta(db: Session, order: WireTransferOrder, available_delta: float = 0, frozen_delta: float = 0):
    if not order or not order.pair or not order.pair.from_currency:
        return
    if str(order.pair.from_currency.symbol or "").upper() != "IRT":
        return
    balance = _get_irt_balance(db, order.user_id, order.pair.from_currency.id)
    if not balance:
        return
    balance.available_balance += available_delta
    balance.frozen_balance += frozen_delta


def _pair_out(pair: WireTransferPair, admins_map: dict | None = None):
    sender_fields, receiver_methods = _decode_pair_config(pair)
    admins_map = admins_map or {}
    return {
        "id":               pair.id,
        "from_currency":    {"id": pair.from_currency.id, "symbol": pair.from_currency.symbol, "name": pair.from_currency.name},
        "to_currency":      {"id": pair.to_currency.id,   "symbol": pair.to_currency.symbol,   "name": pair.to_currency.name},
        "rate":             pair.rate,  # always the admin-entered "IRT per unit" value — never inverted for display
        "fee_percent":      pair.fee_percent,
        "min_amount":       pair.min_amount,
        "max_amount":       pair.max_amount,
        "timeout_minutes":  pair.timeout_minutes,
        "required_fields":  sender_fields,  # backward-compatible alias
        "sender_fields":    sender_fields,
        "receiver_methods": receiver_methods,
        "is_active":        pair.is_active,
        "created_at":       _to_iso_utc(pair.created_at),
        "admin_id":         pair.admin_id,
        "admin_username":   admins_map.get(pair.admin_id),
    }


def _order_out(order: WireTransferOrder, admins_map: dict | None = None):
    raw_input_data = {}
    if order.input_data:
        try:
            raw_input_data = json.loads(order.input_data)
        except (TypeError, ValueError):
            raw_input_data = {}
    if not isinstance(raw_input_data, dict):
        raw_input_data = {}

    payment_method = raw_input_data.get("__payment_method")
    payment_method_label = raw_input_data.get("__payment_method_label")
    input_data = {
        k: v for k, v in raw_input_data.items()
        if not str(k).startswith("__")
    }

    admins_map = admins_map or {}
    pair = order.pair
    user = order.user
    return {
        "id":                order.id,
        "user_id":           order.user_id,
        "username":          user.username if user else None,
        "telegram_id":       user.telegram_id if user else None,
        "pair_id":           order.pair_id,
        "from_currency":     {"id": pair.from_currency.id, "symbol": pair.from_currency.symbol},
        "to_currency":       {"id": pair.to_currency.id,   "symbol": pair.to_currency.symbol},
        "from_amount":       order.from_amount,
        "to_amount":         order.to_amount,
        "locked_rate":       order.locked_rate,
        "locked_fee_percent": order.locked_fee_percent,
        "fee_amount":        order.fee_amount,
        "input_data":        input_data,
        "payment_method":    payment_method,
        "payment_method_label": payment_method_label,
        "status":            order.status,
        "fail_reason":       order.fail_reason,
        "delivery_message":  order.delivery_message,
        "balance_was_insufficient": bool(order.balance_was_insufficient),
        "expires_at":        _to_iso_utc(order.expires_at),
        "created_at":        _to_iso_utc(order.created_at),
        "approved_at":       _to_iso_utc(order.approved_at),
        "rejected_at":       _to_iso_utc(order.rejected_at),
        "delivered_at":      _to_iso_utc(order.delivered_at),
        "failed_at":         _to_iso_utc(order.failed_at),
        "expired_at":        _to_iso_utc(order.expired_at),
        "approved_by":       order.approved_by,
        "rejected_by":       order.rejected_by,
        "delivered_by":      order.delivered_by,
        "failed_by":         order.failed_by,
        "admin_id":          order.admin_id,
        "admin_username":    admins_map.get(order.admin_id),
    }


# ─────────────────────────────────────────
# CROSS-ADMIN FILTER SUPPORT
# ─────────────────────────────────────────

@router.get("/filter-admins")
def list_filterable_admins(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    if not can_view_all_admins(admin):
        raise HTTPException(403, "Access denied")

    candidates = db.query(User).filter(User.role.in_(["admin", "master"])).all()

    result = []
    for u in candidates:
        access_points = u.access_points or []
        role_default = ROLE_PERMISSIONS.get(u.role, [])
        eligible = (
            u.role == "master"
            or role_default == "*"
            or "wire_transfer.manage" in role_default
            or "wire_transfer.manage" in access_points
        )
        if eligible:
            result.append({
                "user_id": u.user_id,
                "username": u.username,
                "role": u.role,
            })

    result.sort(key=lambda x: (x["username"] or "").lower())
    return result


# ─────────────────────────────────────────
# PAIR ENDPOINTS
# ─────────────────────────────────────────

@router.get("/pairs")
def list_pairs(
    admin_filter: Optional[str] = Query(None),
    admin=Depends(get_admin),
    db: Session = Depends(get_db_rls),
):
    scope_all, scope_admin_id = resolve_admin_scope(admin, db, admin_filter)

    query = (
        db.query(WireTransferPair)
        .options(joinedload(WireTransferPair.from_currency), joinedload(WireTransferPair.to_currency))
    )
    if not scope_all:
        query = query.filter(WireTransferPair.admin_id == scope_admin_id)

    pairs = query.order_by(WireTransferPair.id).all()

    admins_map = _admin_username_map(db, {p.admin_id for p in pairs})
    return [_pair_out(p, admins_map) for p in pairs]


@router.post("/pairs")
def create_pair(body: WirePairCreate, admin=Depends(get_admin), db: Session = Depends(get_db_rls)):
    if not has_access(admin, "wire_transfer.manage"):
        raise HTTPException(403, "Manage permission required")

    if body.rate <= 0:
        raise HTTPException(400, "Invalid rate")

    from_currency = db.query(Currency).filter(Currency.id == body.from_currency_id).first()
    if not from_currency:
        raise HTTPException(404, "From currency not found")

    sender_fields = body.sender_fields if body.sender_fields is not None else (body.required_fields or {})
    receiver_methods = body.receiver_methods or []

    owner_admin_id = admin["user_id"]

    pair = WireTransferPair(
        from_currency_id=body.from_currency_id,
        to_currency_id=body.to_currency_id,
        rate=body.rate,  # stored exactly as the admin entered it — never inverted
        fee_percent=body.fee_percent,
        min_amount=body.min_amount,
        max_amount=body.max_amount,
        timeout_minutes=body.timeout_minutes,
        required_fields=_encode_pair_config(sender_fields, receiver_methods),
        admin_id=owner_admin_id,
    )
    db.add(pair)
    db.commit()
    db.refresh(pair)
    # reload relationships
    pair = db.query(WireTransferPair).options(
        joinedload(WireTransferPair.from_currency),
        joinedload(WireTransferPair.to_currency)
    ).filter(WireTransferPair.id == pair.id).first()
    admins_map = _admin_username_map(db, {pair.admin_id})
    return _pair_out(pair, admins_map)


@router.put("/pairs/{pair_id}")
def update_pair(pair_id: int, body: WirePairUpdate, admin=Depends(get_admin), db: Session = Depends(get_db_rls)):
    if not has_access(admin, "wire_transfer.manage"):
        raise HTTPException(403, "Manage permission required")

    pair = db.query(WireTransferPair).options(
        joinedload(WireTransferPair.from_currency),
        joinedload(WireTransferPair.to_currency)
    ).filter(WireTransferPair.id == pair_id).first()
    if not pair:
        raise HTTPException(404, "Pair not found")

    if not is_master(admin) and pair.admin_id != admin["user_id"]:
        raise HTTPException(403, "Not authorized to modify this pair")

    if body.rate is not None:
        if body.rate <= 0:
            raise HTTPException(400, "Invalid rate")
        pair.rate = body.rate  # stored exactly as the admin entered it — never inverted
    if body.fee_percent    is not None: pair.fee_percent      = body.fee_percent
    if body.min_amount     is not None: pair.min_amount       = body.min_amount
    if body.max_amount     is not None: pair.max_amount       = body.max_amount
    if body.timeout_minutes is not None: pair.timeout_minutes = body.timeout_minutes
    if body.is_active      is not None: pair.is_active        = body.is_active
    if body.required_fields is not None or body.sender_fields is not None or body.receiver_methods is not None:
        sender_fields, receiver_methods = _decode_pair_config(pair)
        if body.required_fields is not None:
            sender_fields = body.required_fields
        if body.sender_fields is not None:
            sender_fields = body.sender_fields
        if body.receiver_methods is not None:
            receiver_methods = body.receiver_methods
        pair.required_fields = _encode_pair_config(sender_fields, receiver_methods)

    db.commit()
    db.refresh(pair)
    pair = db.query(WireTransferPair).options(
        joinedload(WireTransferPair.from_currency),
        joinedload(WireTransferPair.to_currency)
    ).filter(WireTransferPair.id == pair_id).first()
    admins_map = _admin_username_map(db, {pair.admin_id})
    return _pair_out(pair, admins_map)


@router.delete("/pairs/{pair_id}")
def delete_pair(pair_id: int, admin=Depends(get_admin), db: Session = Depends(get_db_rls)):
    if not has_access(admin, "wire_transfer.manage"):
        raise HTTPException(403, "Manage permission required")
    pair = db.query(WireTransferPair).filter(WireTransferPair.id == pair_id).first()
    if not pair:
        raise HTTPException(404, "Pair not found")

    if not is_master(admin) and pair.admin_id != admin["user_id"]:
        raise HTTPException(403, "Not authorized to delete this pair")

    db.delete(pair)
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────
# ORDER ENDPOINTS
# ─────────────────────────────────────────

@router.get("/orders")
def list_orders(
    admin_filter: Optional[str] = Query(None),
    admin=Depends(get_admin),
    db: Session = Depends(get_db_rls),
):
    _expire_pending_orders(db)

    scope_all, scope_admin_id = resolve_admin_scope(admin, db, admin_filter)

    query = (
        db.query(WireTransferOrder)
        .options(
            joinedload(WireTransferOrder.user),
            joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.from_currency),
            joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.to_currency),
        )
    )
    if not scope_all:
        query = query.filter(WireTransferOrder.admin_id == scope_admin_id)

    orders = query.order_by(WireTransferOrder.created_at.desc()).all()

    admins_map = _admin_username_map(db, {o.admin_id for o in orders})
    return [_order_out(o, admins_map) for o in orders]


@router.get("/orders/{order_id}")
def get_order(order_id: int, admin=Depends(get_admin), db: Session = Depends(get_db_rls)):
    _expire_pending_orders(db)
    order = (
        db.query(WireTransferOrder)
        .options(
            joinedload(WireTransferOrder.user),
            joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.from_currency),
            joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.to_currency),
        )
        .filter(WireTransferOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(404, "Order not found")

    if not is_master(admin) and order.admin_id != admin["user_id"] and not can_view_all_admins(admin):
        raise HTTPException(403, "Not authorized to view this order")

    admins_map = _admin_username_map(db, {order.admin_id})
    return _order_out(order, admins_map)


async def _notify(user: User, text: str):
    if user and user.telegram_id:
        try:
            await send_telegram_message(chat_id=int(user.telegram_id), text=text)
        except Exception:
            pass  # notification failure must not block admin action


def _assert_order_owner(admin: dict, order: WireTransferOrder):
    if is_master(admin):
        return
    if order.admin_id != admin["user_id"]:
        raise HTTPException(403, "Not authorized to act on this order")


@router.post("/orders/{order_id}/approve")
async def approve_order(order_id: int, admin=Depends(get_admin), db: Session = Depends(get_db_rls)):
    if not has_access(admin, "wire_transfer.manage"):
        raise HTTPException(403, "Manage permission required")
    _expire_pending_orders(db)
    order = db.query(WireTransferOrder).options(
        joinedload(WireTransferOrder.user),
        joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.from_currency),
        joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.to_currency),
    ).filter(WireTransferOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    _assert_order_owner(admin, order)

    if order.status != "pending":
        raise HTTPException(400, f"Order is {order.status}, cannot approve")

    order.status = "approved"
    order.approved_at = datetime.utcnow()
    order.approved_by = admin.get("sub") or "admin"

    # IRT money flow on approval
    is_irt = (
        order.pair
        and order.pair.from_currency
        and str(order.pair.from_currency.symbol or "").upper() == "IRT"
    )
    if is_irt:
        currency_id = order.pair.from_currency.id
        amount = float(order.from_amount or 0)
        balance = _get_irt_balance(db, order.user_id, currency_id)
        if order.balance_was_insufficient:
            # User wired money to the platform — credit it now and freeze it.
            
            if not balance:
                balance = UserBalance(
                    user_id=order.user_id,
                    currency_id=currency_id,
                    network_id=None,
                    available_balance=0,
                    frozen_balance=0,
                )
                db.add(balance)
                db.flush()
            balance.frozen_balance += amount

            db.add(Transaction(
                user_id=order.user_id,
                currency_id=currency_id,
                amount=amount,
                type=WIRE_TRANSFER,
                status=FROZEN,
                wire_transfer_order_id=order.id,
                blockchain="internal",
            ))
        
       # If balance was sufficient, IRT was already frozen at order placement.
    

    db.commit()
    await _notify(order.user, (
        f"✅ Wire Transfer Approved\n\n"
        f"📋 Order #{order.id}\n"
        f"💸 {order.from_amount} {order.pair.from_currency.symbol} → {order.to_amount} {order.pair.to_currency.symbol}\n\n"
        "Your transfer has been approved and will be processed shortly."
    ))
    return {"ok": True, "status": "approved"}


@router.post("/orders/{order_id}/reject")
async def reject_order(order_id: int, admin=Depends(get_admin), db: Session = Depends(get_db_rls)):
    if not has_access(admin, "wire_transfer.manage"):
        raise HTTPException(403, "Manage permission required")
    _expire_pending_orders(db)
    order = db.query(WireTransferOrder).options(
        joinedload(WireTransferOrder.user),
        joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.from_currency),
        joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.to_currency),
    ).filter(WireTransferOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    _assert_order_owner(admin, order)

    if order.status != "pending":
        raise HTTPException(400, f"Order is {order.status}, cannot reject")
    order.status = "rejected"
    order.rejected_at = datetime.utcnow()
    order.rejected_by = admin.get("sub") or "admin"

    is_irt = (
        order.pair
        and order.pair.from_currency
        and str(order.pair.from_currency.symbol or "").upper() == "IRT"
    )
    if is_irt and not order.balance_was_insufficient:
        # Refund frozen IRT back to available (sufficient-balance path)
        _apply_irt_lock_delta(db, order, available_delta=order.from_amount, frozen_delta=-order.from_amount)
        db.add(Transaction(
            user_id=order.user_id,
            currency_id=order.pair.from_currency.id,
            amount=float(order.from_amount or 0),
            type=WIRE_REFUND,
            status=COMPLETED,
            wire_transfer_order_id=order.id,
            blockchain="internal",
        ))
    # If balance_was_insufficient and still pending (never approved), no money was ever
    # credited or frozen, so no refund transaction is needed.

    db.commit()
    await _notify(order.user, (
        f"❌ Wire Transfer Rejected\n\n"
        f"📋 Order #{order.id}\n"
        f"💸 {order.from_amount} {order.pair.from_currency.symbol}\n\n"
        "Your transfer order has been rejected by the admin."
    ))
    return {"ok": True, "status": "rejected"}


@router.post("/orders/{order_id}/deliver")
async def deliver_order(order_id: int, body: OrderDeliverRequest, admin=Depends(get_admin), db: Session = Depends(get_db_rls)):
    if not has_access(admin, "wire_transfer.manage"):
        raise HTTPException(403, "Manage permission required")
    _expire_pending_orders(db)
    order = db.query(WireTransferOrder).options(
        joinedload(WireTransferOrder.user),
        joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.from_currency),
        joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.to_currency),
    ).filter(WireTransferOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    _assert_order_owner(admin, order)

    if order.status != "approved":
        raise HTTPException(400, f"Order is {order.status}, cannot deliver (must be approved first)")
    order.status = "delivered"
    order.delivered_at = datetime.utcnow()
    order.delivered_by = admin.get("sub") or  "admin"
    if body.message is not None:
        order.delivery_message = body.message.strip() or None

    is_irt = (
        order.pair
        and order.pair.from_currency
        and str(order.pair.from_currency.symbol or "").upper() == "IRT"
    )
    if is_irt:
        # Deduct the frozen amount — the IRT has been spent (converted to foreign currency)
        _apply_irt_lock_delta(db, order, frozen_delta=-order.from_amount)
        db.add(Transaction(
            user_id=order.user_id,
            currency_id=order.pair.from_currency.id,
            amount=float(order.from_amount or 0),
            type=WIRE_TRANSFER,
            status=COMPLETED,
            wire_transfer_order_id=order.id,
            blockchain="internal",
        ))

    db.commit()
    message_text = body.message.strip() if body.message else "Your transfer has been successfully delivered."
    await _notify(order.user, (
        f"🎉 Wire Transfer Delivered!\n\n"
        f"📋 Order #{order.id}\n"
        f"💸 {order.from_amount} {order.pair.from_currency.symbol} → {order.to_amount} {order.pair.to_currency.symbol}\n\n"
        f"{message_text}"
    ))
    return {"ok": True, "status": "delivered", "delivery_message": order.delivery_message}


@router.post("/orders/{order_id}/fail")
async def fail_order(order_id: int, body: OrderFailRequest, admin=Depends(get_admin), db: Session = Depends(get_db_rls)):
    if not has_access(admin, "wire_transfer.manage"):
        raise HTTPException(403, "Manage permission required")
    order = db.query(WireTransferOrder).options(
        joinedload(WireTransferOrder.user),
        joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.from_currency),
        joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.to_currency),
    ).filter(WireTransferOrder.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    _assert_order_owner(admin, order)

    if order.status != "approved":
        raise HTTPException(400, f"Order is {order.status}, cannot mark failed (must be approved first)")
    order.status      = "failed"
    order.failed_at = datetime.utcnow()
    order.failed_by = admin.get("sub") or "admin"
    order.fail_reason = body.reason

    is_irt = (
        order.pair
        and order.pair.from_currency
        and str(order.pair.from_currency.symbol or "").upper() == "IRT"
    )
    if is_irt:
        # Refund frozen IRT back to available (order was approved so IRT is always frozen here)
        _apply_irt_lock_delta(db, order, available_delta=order.from_amount, frozen_delta=-order.from_amount)
        db.add(Transaction(
            user_id=order.user_id,
            currency_id=order.pair.from_currency.id,
            amount=float(order.from_amount or 0),
            type=WIRE_REFUND,
            status=COMPLETED,
            wire_transfer_order_id=order.id,
            blockchain="internal",
        ))

    db.commit()
    await _notify(order.user, (
        f"⚠️ Wire Transfer Failed\n\n"
        f"📋 Order #{order.id}\n"
        f"💸 {order.from_amount} {order.pair.from_currency.symbol}\n\n"
        f"❗ Reason: {body.reason}"
        f" The money refounded to your wallet, contact support or try again"
    ))
    return {"ok": True, "status": "failed"}