import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.core.rls import get_db_rls
from app.core.security import get_current_user
from app.models.wire_transfer_pair import WireTransferPair
from app.models.wire_transfer_order import WireTransferOrder
from app.models.user_balance import UserBalance
from app.models.currency import Currency
from app.models.transaction import Transaction
from app.services.wire_transfer_expiry import expire_pending_wire_orders, utc_now_naive
from app.services.exchange_service import normalize_db_rate
from app.constants.transaction_types import WIRE_TRANSFER, WIRE_REFUND
from app.constants.transaction_status import COMPLETED, FAILED, FROZEN, REJECTED

router = APIRouter(prefix="/wire-transfer", tags=["Wire Transfer"])


def _normalize_receiver_methods(value):
    if not isinstance(value, list):
        return []
    out = []
    for idx, item in enumerate(value):
        if not isinstance(item, dict):
            continue
        raw_key = str(item.get("key") or item.get("id") or f"method_{idx + 1}").strip()
        key = raw_key.replace(" ", "_").lower() or f"method_{idx + 1}"
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

    # Backward compatibility with old shape.
    sender_fields = config if isinstance(config, dict) else {}
    return sender_fields, []


def _pair_public(pair: WireTransferPair):
    sender_fields, receiver_methods = _decode_pair_config(pair)
    return {
        "id":              pair.id,
        "from_currency":   {"id": pair.from_currency.id, "symbol": pair.from_currency.symbol, "name": pair.from_currency.name},
        "to_currency":     {"id": pair.to_currency.id,   "symbol": pair.to_currency.symbol,   "name": pair.to_currency.name},
        "rate":            pair.rate,  # always the admin-entered "IRT per unit" value — never inverted for display
        "fee_percent":     pair.fee_percent,
        "min_amount":      pair.min_amount,
        "max_amount":      pair.max_amount,
        "timeout_minutes": pair.timeout_minutes,
        "required_fields": sender_fields,  # backward-compatible alias
        "sender_fields":   sender_fields,
        "receiver_methods": receiver_methods,
    }


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


class PlaceOrderRequest(BaseModel):
    pair_id:    int
    from_amount: float
    input_data: dict  # user-supplied field values


@router.get("/pairs")
def list_active_pairs(db: Session = Depends(get_db_rls)):
    """List all active wire transfer pairs (public, no auth required for display)."""
    pairs = (
        db.query(WireTransferPair)
        .options(joinedload(WireTransferPair.from_currency), joinedload(WireTransferPair.to_currency))
        .filter(WireTransferPair.is_active == True)
        .order_by(WireTransferPair.id)
        .all()
    )
    return [_pair_public(p) for p in pairs]


@router.post("/orders")
def place_order(body: PlaceOrderRequest, user=Depends(get_current_user), db: Session = Depends(get_db_rls)):
    _expire_pending_orders(db)
    pair = (
        db.query(WireTransferPair)
        .options(joinedload(WireTransferPair.from_currency), joinedload(WireTransferPair.to_currency))
        .filter(WireTransferPair.id == body.pair_id, WireTransferPair.is_active == True)
        .first()
    )
    if not pair:
        raise HTTPException(404, "Pair not found or inactive")

    # Cross-tenant guardrail: user may only place orders against their own
    # admin's pairs.
    if pair.admin_id != user.get("admin_id"):
        raise HTTPException(403, "Pair not available for this account")

    sender_fields, receiver_methods = _decode_pair_config(pair)
    from_symbol = (pair.from_currency.symbol or "").upper() if pair.from_currency else ""
    receiver_method_keys = {m.get("key") for m in receiver_methods if m.get("key")}
    selected_method_key = body.input_data.get("__payment_method")
    selected_method = next((m for m in receiver_methods if m.get("key") == selected_method_key), None)
    if receiver_method_keys and selected_method_key not in receiver_method_keys:
        raise HTTPException(400, "Selected payment method is invalid for this pair")
    if from_symbol == "IRT" and receiver_method_keys and not selected_method_key:
        raise HTTPException(400, "Payment method selection is required for IRT source transfers")

    amount = body.from_amount
    if pair.min_amount and amount < pair.min_amount:
        raise HTTPException(400, f"Minimum transfer amount is {pair.min_amount}")
    if pair.max_amount and amount > pair.max_amount:
        raise HTTPException(400, f"Maximum transfer amount is {pair.max_amount}")

    balance_row = None
    current_balance = None
    shortfall = 0.0
    if from_symbol == "IRT":
        irt_currency = db.query(Currency).filter(Currency.symbol == "IRT").first()
        if irt_currency:
            balance_row = (
                db.query(UserBalance)
                .filter(
                    UserBalance.user_id == user["user_id"],
                    UserBalance.currency_id == irt_currency.id,
                )
                .first()
            )
            current_balance = float(balance_row.available_balance or 0) if balance_row else 0.0
            if current_balance < amount:
                shortfall = round(amount - current_balance, 8)

    # pair.rate is always the human-friendly value the admin entered
    # (e.g. 190000 meaning "190,000 IRT per 1 unit of foreign currency"),
    # displayed as-is everywhere. The reciprocal is only ever used
    # transiently here to compute to_amount when the source currency is IRT.
    calc_rate = normalize_db_rate(pair.rate, from_symbol)
    method_fee_pct = selected_method.get("fee_percent") if isinstance(selected_method, dict) else None
    locked_fee_pct = float(method_fee_pct) if method_fee_pct is not None else pair.fee_percent
    fee_amount      = round(amount * locked_fee_pct / 100, 8)
    to_amount       = round((amount - fee_amount) * calc_rate, 8)

    expires_at = utc_now_naive() + timedelta(minutes=pair.timeout_minutes)

    order = WireTransferOrder(
        user_id           = user["user_id"],
        pair_id           = pair.id,
        locked_rate       = pair.rate,
        locked_fee_percent= locked_fee_pct,
        fee_amount        = fee_amount,
        from_amount       = amount,
        to_amount         = to_amount,
        input_data        = json.dumps(body.input_data),
        status            = "pending",
        expires_at        = expires_at,
        balance_was_insufficient = shortfall > 0,
        admin_id          = pair.admin_id,
    )
    if from_symbol == "IRT" and balance_row and current_balance is not None and current_balance >= amount:
        balance_row.available_balance -= amount
        balance_row.frozen_balance += amount
    db.add(order)
    db.flush()  # get order.id before adding transaction

    # Record freeze transaction when IRT balance is sufficient
    if from_symbol == "IRT" and shortfall == 0 and balance_row:
        db.add(Transaction(
            user_id=user["user_id"],
            currency_id=pair.from_currency.id,
            amount=amount,
            type=WIRE_TRANSFER,
            status=FROZEN,
            wire_transfer_order_id=order.id,
            blockchain="internal",
        ))

    db.commit()
    db.refresh(order)

    return {
        "id":          order.id,
        "status":      order.status,
        "from_amount": order.from_amount,
        "to_amount":   order.to_amount,
        "fee_amount":  order.fee_amount,
        "locked_rate": order.locked_rate,
        "expires_at":  _to_iso_utc(order.expires_at),
        "balance_status": "insufficient" if shortfall > 0 else "sufficient",
        "current_balance": current_balance,
        "shortfall": shortfall,
        "from_currency_symbol": pair.from_currency.symbol,
        "to_currency_symbol": pair.to_currency.symbol,
    }

@router.get("/orders/my")
def my_orders(user=Depends(get_current_user), db: Session = Depends(get_db_rls)):
    _expire_pending_orders(db)
    orders = (
        db.query(WireTransferOrder)
        .options(
            joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.from_currency),
            joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.to_currency),
        )
        .filter(WireTransferOrder.user_id == user["user_id"])
        .order_by(WireTransferOrder.created_at.desc())
        .all()
    )
    result = []
    for o in orders:
        raw_input_data = {}
        if o.input_data:
            try:
                raw_input_data = json.loads(o.input_data)
            except (TypeError, ValueError):
                raw_input_data = {}
        if not isinstance(raw_input_data, dict):
            raw_input_data = {}

        result.append({
            "id":          o.id,
            "from_currency": {"symbol": o.pair.from_currency.symbol, "name": o.pair.from_currency.name},
            "to_currency":   {"symbol": o.pair.to_currency.symbol, "name": o.pair.to_currency.name},
            "from_currency_symbol": o.pair.from_currency.symbol,
            "to_currency_symbol": o.pair.to_currency.symbol,
            "from_amount": o.from_amount,
            "to_amount":   o.to_amount,
            "locked_rate": o.locked_rate,
            "locked_fee_percent": o.locked_fee_percent,
            "fee_amount": o.fee_amount,
            "status":      o.status,
            "fail_reason": o.fail_reason,
            "delivery_message": o.delivery_message,
            "balance_was_insufficient": bool(o.balance_was_insufficient),
            "payment_method": raw_input_data.get("__payment_method"),
            "payment_method_label": raw_input_data.get("__payment_method_label"),
            "input_data": {k: v for k, v in raw_input_data.items() if not str(k).startswith("__")},
            "expires_at":  _to_iso_utc(o.expires_at),
            "created_at":  _to_iso_utc(o.created_at),
            "approved_at": _to_iso_utc(o.approved_at),
            "rejected_at": _to_iso_utc(o.rejected_at),
            "delivered_at": _to_iso_utc(o.delivered_at),
            "failed_at": _to_iso_utc(o.failed_at),
            "expired_at": _to_iso_utc(o.expired_at),
        })
    return result


@router.get("/orders/{order_id}")
def get_order(order_id: int, user=Depends(get_current_user), db: Session = Depends(get_db_rls)):
    _expire_pending_orders(db)
    order = (
        db.query(WireTransferOrder)
        .options(
            joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.from_currency),
            joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.to_currency),
        )
        .filter(
            WireTransferOrder.id == order_id,
            WireTransferOrder.user_id == user["user_id"],
        )
        .first()
    )
    if not order:
        raise HTTPException(404, "Order not found")

    raw_input_data = {}
    if order.input_data:
        try:
            raw_input_data = json.loads(order.input_data)
        except (TypeError, ValueError):
            raw_input_data = {}
    if not isinstance(raw_input_data, dict):
        raw_input_data = {}

    return {
        "id": order.id,
        "status": order.status,
        "from_currency": {"symbol": order.pair.from_currency.symbol, "name": order.pair.from_currency.name},
        "to_currency": {"symbol": order.pair.to_currency.symbol, "name": order.pair.to_currency.name},
        "from_currency_symbol": order.pair.from_currency.symbol,
        "to_currency_symbol": order.pair.to_currency.symbol,
        "from_amount": order.from_amount,
        "to_amount": order.to_amount,
        "locked_rate": order.locked_rate,
        "locked_fee_percent": order.locked_fee_percent,
        "fee_amount": order.fee_amount,
        "delivery_message": order.delivery_message,
        "fail_reason": order.fail_reason,
        "balance_was_insufficient": bool(order.balance_was_insufficient),
        "payment_method": raw_input_data.get("__payment_method"),
        "payment_method_label": raw_input_data.get("__payment_method_label"),
        "input_data": {k: v for k, v in raw_input_data.items() if not str(k).startswith("__")},
        "created_at": _to_iso_utc(order.created_at),
        "expires_at": _to_iso_utc(order.expires_at),
        "approved_at": _to_iso_utc(order.approved_at),
        "rejected_at": _to_iso_utc(order.rejected_at),
        "delivered_at": _to_iso_utc(order.delivered_at),
        "failed_at": _to_iso_utc(order.failed_at),
        "expired_at": _to_iso_utc(order.expired_at),
    }


class CancelOrderRequest(BaseModel):
    reason: Optional[str] = None


@router.post("/orders/{order_id}/cancel")
def cancel_order(order_id: int, body: CancelOrderRequest, user=Depends(get_current_user), db: Session = Depends(get_db_rls)):
    _expire_pending_orders(db)
    order = (
        db.query(WireTransferOrder)
        .options(joinedload(WireTransferOrder.pair).joinedload(WireTransferPair.from_currency))
        .filter(
            WireTransferOrder.id == order_id,
            WireTransferOrder.user_id == user["user_id"],
        )
        .first()
    )
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status not in ("pending", "approved"):
        raise HTTPException(400, f"Order is {order.status}, cannot cancel")

    order.status = "failed"
    order.fail_reason = body.reason.strip() if body.reason and body.reason.strip() else "cancelled by user"
    order.failed_at = utc_now_naive()
    order.failed_by = "user"

    if order.pair and order.pair.from_currency and str(order.pair.from_currency.symbol or "").upper() == "IRT":
        balance = (
            db.query(UserBalance)
            .filter(
                UserBalance.user_id == order.user_id,
                UserBalance.currency_id == order.pair.from_currency.id,
            )
            .first()
        )
        if balance and float(balance.frozen_balance or 0) > 0:
            refund_amount = min(float(order.from_amount or 0), float(balance.frozen_balance or 0))
            balance.frozen_balance = max(float(balance.frozen_balance or 0) - refund_amount, 0)
            balance.available_balance = float(balance.available_balance or 0) + refund_amount
            db.add(Transaction(
                user_id=order.user_id,
                currency_id=order.pair.from_currency.id,
                amount=refund_amount,
                type=WIRE_REFUND,
                status=COMPLETED,
                wire_transfer_order_id=order.id,
                blockchain="internal",
            ))

    db.commit()
    return {"ok": True, "status": "failed", "fail_reason": order.fail_reason}
