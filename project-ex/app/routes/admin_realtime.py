from fastapi import APIRouter, WebSocket, Query
from sqlalchemy import func
from app.db.database import SessionLocal, set_session_master
from app.models.user import User
from app.models.user_balance import UserBalance
from app.models.currency import Currency
from app.models.currency_network import CurrencyNetwork
from app.models.transaction import Transaction
from app.models.order_item import OrderItem
from app.models.messages import Message
from app.constants.transaction_status import PENDING
from app.constants.transaction_types import WITHDRAW
from app.services.wallet_monitor import get_wallet_status

import asyncio

router = APIRouter()


# =========================
# BUILD STATS (PER-ADMIN, FOR TOPBAR)
# =========================
async def get_stats(admin_id: int | None = None):
    db = SessionLocal()
    set_session_master(db)
    try:
        # ── ADMIN'S DEFAULT BALANCES ──────────────────────
        admin_balances = []
        if admin_id is not None:
            rows = (
                db.query(
                    Currency.symbol,
                    UserBalance.available_balance,
                    UserBalance.frozen_balance,
                )
                .join(Currency, Currency.id == UserBalance.currency_id)
                .outerjoin(
                    CurrencyNetwork,
                    (CurrencyNetwork.currency_id == UserBalance.currency_id)
                    & (CurrencyNetwork.network_id == UserBalance.network_id),
                )
                .filter(
                    UserBalance.user_id == admin_id,
                    (CurrencyNetwork.is_default == True) | (UserBalance.network_id.is_(None)),
                )
                .all()
            )
            admin_balances = [
                {
                    "currency": r.symbol,
                    "available": float(r.available_balance or 0),
                    "frozen": float(r.frozen_balance or 0),
                }
                for r in rows
            ]

        RECENT_LIMIT = 5

        # ── PENDING WITHDRAWALS (platform-wide) ───────────
        withdrawal_rows = (
            db.query(Transaction)
            .filter(Transaction.type == WITHDRAW, Transaction.status == PENDING)
            .order_by(Transaction.created_at.desc())
            .all()
        )
        pending_withdrawals_count = len(withdrawal_rows)
        withdrawal_items = [
            {
                "id": t.id,
                "label": f"Withdrawal #{t.id} — {t.amount}",
                "time": t.created_at.isoformat() if t.created_at else None,
            }
            for t in withdrawal_rows[:RECENT_LIMIT]
        ]

        # ── PENDING ORDERS ─────────────────────────────────
        order_rows = (
            db.query(OrderItem)
            .filter(OrderItem.status == "pending")
            .order_by(OrderItem.created_at.desc())
            .all()
        )
        pending_orders = len(order_rows)
        order_items = [
            {
                "id": o.id,
                "label": f"Order #{o.id}",
                "time": o.created_at.isoformat() if o.created_at else None,
            }
            for o in order_rows[:RECENT_LIMIT]
        ]

        # ── UNREAD MESSAGES (platform-wide) ────────────────
        # Note: Conversation has no admin_id (conversations aren't
        # scoped per-admin), so this counts all unread across the platform.
        message_rows = (
            db.query(Message)
            .filter(Message.sender == "user", Message.is_read == False)
            .order_by(Message.created_at.desc())
            .all()
        )
        unread_messages = len(message_rows)
        message_items = [
            {
                "id": m.id,
                "label": (m.content[:40] if m.content else "[media]"),
                "time": m.created_at.isoformat() if m.created_at else None,
            }
            for m in message_rows[:RECENT_LIMIT]
        ]

        # ── EXCHANGE / WIRE TRANSFER (not implemented yet) ─
        pending_exchange = 0
        pending_wire_transfers = 0
        exchange_items = []
        wire_transfer_items = []

        # ── WALLET (best-effort, must never break the socket) ─
        try:
            wallet = get_wallet_status()
        except Exception:
            wallet = None

        return {
            "admin_balances": admin_balances,
            "indicators": {
                "orders": {"count": pending_orders, "items": order_items},
                "messages": {"count": unread_messages, "items": message_items},
                "withdrawals": {"count": pending_withdrawals_count, "items": withdrawal_items},
                "exchange": {"count": pending_exchange, "items": exchange_items},
                "wire_transfer": {"count": pending_wire_transfers, "items": wire_transfer_items},
            },
            "wallet": wallet,
        }

    finally:
        db.close()


# =========================
# WEBSOCKET ENDPOINT
# =========================
@router.websocket("/ws/admin/stats")
async def ws_admin_stats(websocket: WebSocket, admin_id: int | None = Query(default=None)):
    await websocket.accept()

    try:
        while True:
            stats = await get_stats(admin_id)
            await websocket.send_json(stats)
            await asyncio.sleep(3)

    except Exception as e:
        print("WebSocket closed:", e)