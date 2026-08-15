# app/routes/admin_dashboard.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db

from app.models.user import User
from app.models.user_balance import UserBalance
from app.models.currency import Currency
from app.models.network import Network
from app.core.security import get_current_user, is_master, is_admin_or_above
from app.core.permissions import has_access
from app.models.transaction import Transaction
from app.models.order_item import OrderItem
from app.models.product import Product
from app.constants.transaction_status import PENDING
from app.constants.transaction_types import WITHDRAW

from app.services.wallet_monitor import get_wallet_status

router = APIRouter(prefix="/admin/dashboard", tags=["Admin Dashboard"])


# ─────────────────────────────────────────────

def get_admin(user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    if not has_access(user, "dashboard.view"):
        raise HTTPException(status_code=403, detail="Access denied")

    return user


# ─────────────────────────────────────────────
@router.get("/overview")
def get_overview(
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    # -------------------------
    # ADMIN CHECK
    # -------------------------
    if not has_access(admin, "dashboard.view"):
        raise HTTPException(403, "Access denied")
    

    admin_id = admin.get("user_id")

    # ══════════════════════════════════════════
    # USERS
    # ══════════════════════════════════════════
    total_users = db.query(User).count()

    admin_row = db.query(User).filter(
        User.user_id == admin_id
    ).first()

    admin_users = db.query(User).filter(
        User.role == "user",
        User.admin_id == admin_id
    ).count()


    admin_txs = db.query(Transaction).filter(Transaction.user_id == admin_row.user_id)\
        .order_by(Transaction.id.desc()).all()

   

    # ══════════════════════════════════════════
    # PLATFORM BALANCES  (aggregated per currency)
    # ══════════════════════════════════════════
    balance_rows = (
        db.query(
            Currency.symbol,
            func.sum(UserBalance.available_balance).label("total_available"),
            func.sum(UserBalance.frozen_balance).label("total_frozen"),
        )
        .join(Currency, Currency.id == UserBalance.currency_id)
        .join(User, User.user_id == UserBalance.user_id)
        .filter(User.role != "master")
        .group_by(Currency.symbol)
        .all()
    )

    balance_result = [
        {
            "currency":        row.symbol,
            "total_available": float(row.total_available or 0),
            "total_frozen":    float(row.total_frozen    or 0),
        }
        for row in balance_rows
    ]


    admin_balances_rows = (
        db.query(
            Currency.symbol,
            UserBalance.available_balance,
            UserBalance.frozen_balance,
        )
        .join(Currency, Currency.id == UserBalance.currency_id)
        .filter(UserBalance.user_id == admin["user_id"])   
        .all()
    )

    admin_balances = [
        {
            "currency": row.symbol,
            "available": float(row.available_balance or 0),
            "frozen": float(row.frozen_balance or 0),
            "total": float((row.available_balance or 0) + (row.frozen_balance or 0)),
        }
        for row in admin_balances_rows
    ]

    # ══════════════════════════════════════════
    # PENDING WITHDRAWALS
    # ══════════════════════════════════════════
    pending_withdrawals = (
        db.query(Transaction)
        .filter(
            Transaction.type   == WITHDRAW,
            Transaction.status == PENDING,
        )
        .order_by(Transaction.id.desc())
        .all()
    )

    # bulk-fetch currencies to avoid N+1
    currency_ids  = {tx.currency_id for tx in pending_withdrawals if tx.currency_id}
    currencies_map = {
        c.id: c
        for c in db.query(Currency).filter(Currency.id.in_(currency_ids)).all()
    }

    pending_result = [
        {
            "transaction_id": tx.id,
            "user_id":        tx.user_id,
            "currency":       currencies_map[tx.currency_id].symbol
                              if tx.currency_id in currencies_map else None,
            "amount":         float(tx.amount),
            "wallet_address": tx.wallet_address,
            "created_at":     tx.created_at.isoformat() if tx.created_at else None,
        }
        for tx in pending_withdrawals
    ]

    # ══════════════════════════════════════════
    # ORDERS
    # ══════════════════════════════════════════
    order_counts = (
        db.query(
            OrderItem.status,
            func.count(OrderItem.id).label("cnt"),
        )
        .group_by(OrderItem.status)
        .all()
    )
    order_map = {row.status: row.cnt for row in order_counts}



    admin_order_counts = (
        db.query(
            OrderItem.status,
            func.count(OrderItem.id).label("cnt")
        )
        .join(Product, Product.id == OrderItem.product_id)
        .filter(Product.admin_id == admin_id)
        .group_by(OrderItem.status)
        .all()
    )

    admin_order_map = {row.status: row.cnt for row in  admin_order_counts }

      

    # ══════════════════════════════════════════
    # PRODUCTS
    # ══════════════════════════════════════════
    total_products    = db.query(Product).count()
    active_products   = db.query(Product).filter(Product.is_active   == True).count()
    admin_products = db.query(Product).filter(Product.admin_id == admin_id).count()
    admin_active_products = db.query(Product).filter(Product.admin_id == admin_id, Product.is_active == True).count()
    # ══════════════════════════════════════════
    # WALLET  
    # ══════════════════════════════════════════
    wallet_data = {
        "hot_wallet": {
            "address":      None,
            "balances":     [],
            "usdt_balance": 0,
            "bnb_balance":  0,
        },
        "master_wallet": {
            "address":      None,
            "balances":     [],
            "usdt_balance": 0,
            "bnb_balance":  0,
        },
        "error": None,
    }

    try:
        status = get_wallet_status()

        hot    = status.get("hot_wallet",    {}) or {}
        master = status.get("master_wallet", {}) or {}

        wallet_data["hot_wallet"] = {
            "address":      hot.get("address"),
            "balances":     hot.get("balances", []),
            "usdt_balance": float(hot.get("usdt_balance") or 0),
            "bnb_balance":  float(hot.get("bnb_balance")  or 0),
        }
        wallet_data["master_wallet"] = {
            "address":      master.get("address"),
            "balances":     master.get("balances", []),
            "usdt_balance": float(master.get("usdt_balance") or 0),
            "bnb_balance":  float(master.get("bnb_balance")  or 0),
        }

    except Exception as exc:
        # RPC timeout or Tatum error must never break the dashboard
        wallet_data["error"] = str(exc)

    # ══════════════════════════════════════════
    # RESPONSE
    # ══════════════════════════════════════════

    return {
        "users": {
            "total_users": total_users,
        },

        "balances": balance_result,

        "withdrawals": {
            "pending_count": len(pending_result),
            "pending":       pending_result,
        },

        "orders": {
            "pending":           order_map.get("pending",   0),
            "approved":          order_map.get("approved",  0),
            "delivered":         order_map.get("delivered", 0),
            "failed":            order_map.get("failed",    0),
            "total_products":    total_products,
            "active_products":   active_products,
        },

        "wallet": wallet_data,
        "admin": {
            "username": admin_row.username,
            "role" : admin_row.role,
            "balances": admin_balances,
            "access_points": admin_row.access_points,
            "admin_users_count" : admin_users,
            
             "admin_transactions": admin_txs,

        "admin_orders": {
            "pending":           admin_order_map.get("pending",   0),
            "approved":          admin_order_map.get("approved",  0),
            "delivered":         admin_order_map.get("delivered", 0),
            "failed":            admin_order_map.get("failed",    0),
            "admin_total_products": admin_products,
            "admin_active_products": admin_active_products,
        },
        },
    }