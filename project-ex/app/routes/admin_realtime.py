from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import func
from datetime import timedelta
from app.db.database import SessionLocal, set_session_master
from app.models.user import User
from app.models.user_balance import UserBalance
from app.models.currency import Currency
from app.models.currency_network import CurrencyNetwork
from app.models.transaction import Transaction
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.messages import Message, Conversation
from app.models.wire_transfer_order import WireTransferOrder
from app.models.wire_transfer_pair import WireTransferPair
from app.models.exchange_order import ExchangeOrder
from app.constants.transaction_status import PENDING
from app.constants.transaction_types import WITHDRAW
from app.services.wallet_monitor import get_wallet_status

import asyncio

router = APIRouter()

RECENT_LIMIT = 6


async def get_stats(admin_id: int | None = None):
    db = SessionLocal()
    set_session_master(db)
    try:
        # ── ADMIN'S DEFAULT BALANCES ──────────────────────
        admin_balances = []
        if admin_id is not None:
            rows = (
                db.query(Currency.symbol, UserBalance.available_balance, UserBalance.frozen_balance)
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
                {"currency": r.symbol, "available": float(r.available_balance or 0), "frozen": float(r.frozen_balance or 0)}
                for r in rows
            ]

        # ── PENDING PRODUCT ORDERS ─────────────────────────
        order_rows = (
            db.query(OrderItem, Product, User)
            .outerjoin(Product, Product.id == OrderItem.product_id)
            .outerjoin(User, User.user_id == OrderItem.user_id)
            .filter(OrderItem.status == "pending")
            .order_by(OrderItem.created_at.desc())
            .limit(RECENT_LIMIT)
            .all()
        )
        pending_orders_count = db.query(OrderItem).filter(OrderItem.status == "pending").count()
        order_items = [
            {
                "id": f"order-{o.id}",
                "title": f"#{o.id} · {p.name if p else 'Unknown product'}",
                "subtitle": f"by {u.username}" if u else "Unknown buyer",
                "status": o.status,
                "time": o.created_at.isoformat() if o.created_at else None,
            }
            for o, p, u in order_rows
        ]
                # who is this? needed to know whether to fold in internal-thread unread
        current_user_row = (
            db.query(User).filter(User.user_id == admin_id).first() if admin_id is not None else None
        )
        is_current_master = bool(current_user_row and current_user_row.role == "master")


        # ── UNREAD USER MESSAGES ───────────────────────────
        message_rows = (
            db.query(Message, User)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .outerjoin(User, User.user_id == Conversation.user_id)
            .filter(Message.sender == "user", Message.is_read == False)
            .order_by(Message.created_at.desc())
            .limit(RECENT_LIMIT)
            .all()
        )
        unread_messages = db.query(Message).filter(Message.sender == "user", Message.is_read == False).count()
        message_items = [
            {
                "id": f"msg-{m.id}",
                "title": u.username if u else "Unknown user",
                "subtitle": (m.content[:70] if m.content else "📎 Media message"),
                "status": None,
                "time": m.created_at.isoformat() if m.created_at else None,
            }
            for m, u in message_rows
        ]


        # Master also needs unread admin→master internal messages folded
        # into the same indicator, so the top-bar badge lights up for
        # internal replies too — not just Telegram support messages.
        internal_admin_unread = 0
        internal_admin_items = []
        if is_current_master:
            internal_rows = (
                db.query(Message, User)
                .join(Conversation, Conversation.id == Message.conversation_id)
                .outerjoin(User, User.user_id == Conversation.user_id)
                .filter(
                    Conversation.kind == "internal",
                    Message.sender == "admin",
                    Message.is_read == False,
                )
                .order_by(Message.created_at.desc())
                .limit(RECENT_LIMIT)
                .all()
            )
            internal_admin_unread = (
                db.query(func.count(Message.id))
                .join(Conversation, Conversation.id == Message.conversation_id)
                .filter(
                    Conversation.kind == "internal",
                    Message.sender == "admin",
                    Message.is_read == False,
                )
                .scalar()
            ) or 0
            internal_admin_items = [
                {
                    "id": f"imsg-{m.id}",
                    "title": u.username if u else "Unknown admin",
                    "subtitle": (m.content[:70] if m.content else "📎 Attachment"),
                    "status": None,
                    "time": m.created_at.isoformat() if m.created_at else None,
                }
                for m, u in internal_rows
            ]

        combined_messages_count = unread_messages + internal_admin_unread
        combined_message_items = (message_items + internal_admin_items)[:RECENT_LIMIT]

        # ── PENDING WITHDRAWALS ─────────────────────────────
        withdrawal_rows = (
            db.query(Transaction, User, Currency)
            .outerjoin(User, User.user_id == Transaction.user_id)
            .outerjoin(Currency, Currency.id == Transaction.currency_id)
            .filter(Transaction.type == WITHDRAW, Transaction.status == PENDING)
            .order_by(Transaction.created_at.desc())
            .limit(RECENT_LIMIT)
            .all()
        )
        pending_withdrawals_count = (
            db.query(Transaction).filter(Transaction.type == WITHDRAW, Transaction.status == PENDING).count()
        )
        withdrawal_items = [
            {
                "id": f"wd-{t.id}",
                "title": f"{float(t.amount or 0):.4f} {c.symbol if c else ''}".strip(),
                "subtitle": u.username if u else "Unknown user",
                "status": t.status,
                "time": t.created_at.isoformat() if t.created_at else None,
            }
            for t, u, c in withdrawal_rows
        ]


                # ── UNREAD MESSAGES FROM MASTER (internal admin<->master thread) ──
        master_conv_unread = 0
        master_conv_items = []
        if admin_id is not None:
            internal_conv = (
                db.query(Conversation)
                .filter(Conversation.user_id == admin_id, Conversation.kind == "internal")
                .first()
            )
            if internal_conv:
                master_conv_unread = (
                    db.query(func.count(Message.id))
                    .filter(
                        Message.conversation_id == internal_conv.id,
                        Message.sender == "master",
                        Message.is_read == False,
                    )
                    .scalar()
                ) or 0
                unread_rows = (
                    db.query(Message)
                    .filter(
                        Message.conversation_id == internal_conv.id,
                        Message.sender == "master",
                        Message.is_read == False,
                    )
                    .order_by(Message.created_at.desc())
                    .limit(RECENT_LIMIT)
                    .all()
                )
                master_conv_items = [
                    {
                        "id": f"mm-{m.id}",
                        "title": "Master",
                        "subtitle": (m.content[:70] if m.content else "📎 Attachment"),
                        "status": None,
                        "time": m.created_at.isoformat() if m.created_at else None,
                    }
                    for m in unread_rows
                ]

        # ── PENDING WIRE TRANSFER ORDERS ────────────────────
        wire_rows = (
            db.query(WireTransferOrder, User, WireTransferPair)
            .outerjoin(User, User.user_id == WireTransferOrder.user_id)
            .outerjoin(WireTransferPair, WireTransferPair.id == WireTransferOrder.pair_id)
            .filter(WireTransferOrder.status == "pending")
            .order_by(WireTransferOrder.created_at.desc())
            .limit(RECENT_LIMIT)
            .all()
        )
        pending_wire_count = db.query(WireTransferOrder).filter(WireTransferOrder.status == "pending").count()
        wire_items = []
        for o, u, p in wire_rows:
            from_sym = p.from_currency.symbol if p and p.from_currency else "?"
            to_sym = p.to_currency.symbol if p and p.to_currency else "?"
            wire_items.append({
                "id": f"wire-{o.id}",
                "title": f"{o.from_amount} {from_sym} → {o.to_amount} {to_sym}",
                "subtitle": u.username if u else "Unknown user",
                "status": o.status,
                "time": o.created_at.isoformat() if o.created_at else None,
            })

        # ── RECENT EXCHANGE ACTIVITY (auto-completes, so "recent" not "pending") ──
        recent_cutoff = __import__("datetime").datetime.utcnow() - timedelta(minutes=10)
        exchange_rows = (
            db.query(ExchangeOrder, User)
            .outerjoin(User, User.user_id == ExchangeOrder.user_id)
            .filter(ExchangeOrder.created_at >= recent_cutoff)
            .order_by(ExchangeOrder.created_at.desc())
            .limit(RECENT_LIMIT)
            .all()
        )
        exchange_items = []
        for o, u in exchange_rows:
            from_sym = o.from_currency.symbol if o.from_currency else "?"
            to_sym = o.to_currency.symbol if o.to_currency else "?"
            exchange_items.append({
                "id": f"exch-{o.id}",
                "title": f"{o.from_amount} {from_sym} → {o.to_amount} {to_sym}",
                "subtitle": u.username if u else "Unknown user",
                "status": o.status,
                "time": o.created_at.isoformat() if o.created_at else None,
            })

      #  try:
       #     wallet = get_wallet_status()
       # except Exception:
        #    wallet = None

        return {
            "admin_balances": admin_balances,
            "indicators": {
                "orders": {"count": pending_orders_count, "items": order_items},
                "messages": {"count": combined_messages_count, "items": combined_message_items},
                "master_messages": {"count": master_conv_unread, "items": master_conv_items},   # ← add this line
                "withdrawals": {"count": pending_withdrawals_count, "items": withdrawal_items},
                "exchange": {"count": len(exchange_items), "items": exchange_items},
                "wire_transfer": {"count": pending_wire_count, "items": wire_items},
            },
            # "wallet": wallet,
        }

    finally:
        db.close()


@router.websocket("/ws/admin/stats")
async def ws_admin_stats(websocket: WebSocket, admin_id: int | None = Query(default=None)):
    await websocket.accept()
    try:
        while True:
            try:
                stats = await get_stats(admin_id)
                await websocket.send_json(stats)
            except WebSocketDisconnect:
                raise
            except Exception as e:
                print(f"WebSocket stats tick failed (admin_id={admin_id}):", repr(e))
            await asyncio.sleep(3)
    except WebSocketDisconnect:
        print(f"WebSocket disconnected (admin_id={admin_id})")
    except Exception as e:
        print("WebSocket closed:", e)