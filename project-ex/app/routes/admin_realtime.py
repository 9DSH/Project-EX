from fastapi import APIRouter, WebSocket
from app.db.database import SessionLocal
from app.models.user import User
from app.models.transaction import Transaction
from app.models.order_item import OrderItem
from app.constants.transaction_status import PENDING
from app.constants.transaction_types import WITHDRAW
from app.services.wallet_monitor import get_wallet_status

import asyncio

router = APIRouter()


# =========================
# BUILD STATS (FIXED STRUCTURE)
# =========================
async def get_stats():
    db = SessionLocal()

    try:
        users = db.query(User).all()

        pending_withdrawals = db.query(Transaction).filter(
            Transaction.type == WITHDRAW,
            Transaction.status == PENDING
        ).all()

# Pending Orders (NEW)
        pending_orders = db.query(OrderItem).filter(
            OrderItem.status == "pending"
        ).count()

        wallet = get_wallet_status()

        return {
            # ================= USERS (MATCH FRONTEND) =================
            "users": {
                "total_users": len(users),
                "total_balance": sum(u.balance for u in users),
                "total_frozen": sum(u.frozen_balance for u in users),
                "pending_withdrawals_count": len(pending_withdrawals),
                "pending_withdrawals_amount": sum(t.amount for t in pending_withdrawals)
            },

            # ================= ORDERS =================
            "orders": {
                            "pending_orders": pending_orders          # Updated name
                        },

            # ================= WALLET =================
            "wallet": wallet
        }

    finally:
        db.close()


# =========================
# WEBSOCKET ENDPOINT
# =========================
@router.websocket("/ws/admin/stats")
async def ws_admin_stats(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            stats = await get_stats()

            # IMPORTANT: send JSON dict directly (safer than string)
            await websocket.send_json(stats)

            await asyncio.sleep(3)

    except Exception as e:
        print("WebSocket closed:", e)