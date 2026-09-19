from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from app.core.rls import get_db_rls
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.user import User
from app.models.user_balance import UserBalance
from app.models.transaction import Transaction
from app.models.currency import Currency
from app.models.network import Network
from app.core.security import get_current_user, is_master, is_admin_or_above
from app.core.permissions import has_access
from sqlalchemy import func
from app.services.telegram_service import send_telegram_message
from decimal import Decimal
from typing import Optional, Dict, Any
from app.routes.utilts.shared_functions import get_admin_username, get_admin_usernames , _admin_telegram_displayName_map

router = APIRouter(prefix="/admin/orders", tags=["Admin Orders"])
#
#  -------------------------
# SCHEMAS
# -------------------------
class AdminCreateOrderRequest(BaseModel):
    user_id: int
    product_id: int
    bonus_percent: Optional[float] = None 
    input_data: Optional[Dict[str, Any]] = None


def get_admin(
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user),
    ):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    if not has_access(user, "orders.view", db):
        raise HTTPException(status_code=403, detail="Access denied")

    return user


def _resolve_admin_username(admin, db: Session) -> Optional[str]:
    """
    admin (from get_current_user) reliably carries "user_id" / "role"
    (see the /transactions endpoint below), but not always "username" —
    so look it up from the users table when it isn't already present.
    """
    username = admin.get("username") if isinstance(admin, dict) else getattr(admin, "username", None)
    if username:
        return username

    admin_user_id = admin.get("user_id") if isinstance(admin, dict) else getattr(admin, "user_id", None)
    if not admin_user_id:
        return None

    row = db.query(User).filter(User.user_id == admin_user_id).first()
    return row.username if row else None

# -------------------------
# HELPER: SPLIT ORDER FUNDS
# Called only at approval time
# -------------------------
def split_order_funds(order_item: OrderItem, db: Session):
    product = db.query(Product).filter(Product.id == order_item.product_id).first()
    if not product:
        raise HTTPException(500, "Product not found during fund split")

    currency_symbol = order_item.currency or "USDT"
    currency = db.query(Currency).filter(Currency.symbol == currency_symbol).first()
    if not currency:
        raise HTTPException(500, f"Currency '{currency_symbol}' not configured")

    # ── Amounts ────────────────────────────────────────────
    final_price = Decimal(str(order_item.price or 0))
    original_price = Decimal(str(product.price or 0))

    commission_amount = Decimal("0")
    if product.system_commision and final_price > 0:
        commission_amount = final_price * Decimal(str(product.system_commision)) / Decimal("100")

    # ── Ownership ──────────────────────────────────────────
    buyer = db.query(User).filter(User.user_id == order_item.user_id).first()

    user_owner_id = buyer.admin_id if buyer else None

    product_owner_id = product.admin_id
    if not product_owner_id:
        raise HTTPException(500, "Product owner (admin_id) not set")
    product_owner = db.query(User).filter(User.user_id == product_owner_id).first()
    if not product_owner:
        raise HTTPException(500, f"Product owner admin_id={product_owner_id} not found")

    apply_reward = (
        product.system_reward_percent is not None
        and user_owner_id is not None
        and user_owner_id != product_owner_id
    )

    reward_amount = Decimal("0")
    if apply_reward:
        reward_amount = original_price * Decimal(str(product.system_reward_percent)) / Decimal("100")

    seller_revenue = final_price - reward_amount - commission_amount

    # ── Credit product owner ───────────────────────────────
    product_owner_balance = db.query(UserBalance).filter(
        UserBalance.user_id == product_owner_id,
        UserBalance.currency_id == currency.id
    ).with_for_update().first()

    if not product_owner_balance:
        product_owner_balance = UserBalance(
            user_id=product_owner_id,
            currency_id=currency.id,
            available_balance=0,
            frozen_balance=0
        )
        db.add(product_owner_balance)
        db.flush()

    product_owner_balance.available_balance = float(
        Decimal(str(product_owner_balance.available_balance or 0)) + seller_revenue
    )

    db.add(Transaction(
        user_id=product_owner_id,
        order_id=order_item.id,
        currency_id=currency.id,
        amount=float(seller_revenue),
        type="income",
        status="completed"
    ))

    # ── Credit referrer reward ─────────────────────────────
    if apply_reward and reward_amount > 0:
        ref_balance = db.query(UserBalance).filter(
            UserBalance.user_id == user_owner_id,
            UserBalance.currency_id == currency.id
        ).with_for_update().first()

        if not ref_balance:
            ref_balance = UserBalance(
                user_id=user_owner_id,
                currency_id=currency.id,
                available_balance=0,
                frozen_balance=0
            )
            db.add(ref_balance)
            db.flush()

        ref_balance.available_balance = float(
            Decimal(str(ref_balance.available_balance or 0)) + reward_amount
        )

        db.add(Transaction(
            user_id=user_owner_id,
            order_id=order_item.id,
            currency_id=currency.id,
            amount=float(reward_amount),
            type="reward",
            status="completed"
        ))

    # ── Credit master commission ───────────────────────────
    if commission_amount > 0:
        master_user = db.query(User).filter(User.role == "master").first()
        if master_user:
            master_balance = db.query(UserBalance).filter(
                UserBalance.user_id == master_user.user_id,
                UserBalance.currency_id == currency.id
            ).with_for_update().first()

            if not master_balance:
                master_balance = UserBalance(
                    user_id=master_user.user_id,
                    currency_id=currency.id,
                    available_balance=0,
                    frozen_balance=0
                )
                db.add(master_balance)
                db.flush()

            master_balance.available_balance = float(
                Decimal(str(master_balance.available_balance or 0)) + commission_amount
            )

            db.add(Transaction(
                user_id=master_user.user_id,
                order_id=order_item.id,
                currency_id=currency.id,
                amount=float(commission_amount),
                type="order_commission",
                status="completed"
            ))

# -------------------------
# CREATE ORDER FOR USER
# -------------------------
@router.post("/create")
def create_order_for_user(
    payload: AdminCreateOrderRequest,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):
    
    # -------------------------
    # ADMIN CHECK
    # -------------------------
    if not has_access(admin, "orders.create", db):
        raise HTTPException(403, "Access denied")

    # -------------------------
    # USER CHECK
    # -------------------------
    db_user = db.query(User).filter(
        User.user_id == payload.user_id
    ).with_for_update().first()

    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # -------------------------
    # PRODUCT CHECK
    # -------------------------
    product = db.query(Product).filter(
        Product.id == payload.product_id,
        Product.is_active == True
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    # -------------------------
    # CURRENCY CHECK
    # -------------------------
    product_currency_symbol = product.currency or "USDT"

    currency = db.query(Currency).filter(
        Currency.symbol == product_currency_symbol
    ).first()

    if not currency:
        raise HTTPException(
            status_code=500,
            detail=f"Currency '{product_currency_symbol}' not configured"
        )
    

    # ── Price calculation ──────────────────────────────────
    original_price = Decimal(str(product.price or 0))
    discounted = original_price

    if product.discount_percent:
        discounted -= discounted * Decimal(str(product.discount_percent)) / Decimal("100")

    if payload.bonus_percent:
        discounted -= discounted * Decimal(str(payload.bonus_percent)) / Decimal("100")

    final_price = discounted

    # ── Validate required fields ───────────────────────────
    required_fields = product.required_user_data or {}
    if required_fields:
        missing = [
            key for key, field in required_fields.items()
            if field.get("step", "before_order") == "before_order"
            and field.get("required", True)
            and (not payload.input_data or payload.input_data.get(key) in [None, ""])
        ]
        if missing:
            raise HTTPException(400, {"error": "MISSING_REQUIRED_DATA", "missing": missing})

    # ── Freeze user balance (only action at create time) ───
    user_balance = db.query(UserBalance).filter(
        UserBalance.user_id == payload.user_id,
        UserBalance.currency_id == currency.id
    ).with_for_update().first()

    if not user_balance:
        user_balance = UserBalance(
            user_id=payload.user_id,
            currency_id=currency.id,
            available_balance=0,
            frozen_balance=0
        )
        db.add(user_balance)
        db.flush()

    available = Decimal(str(user_balance.available_balance or 0))
    if available < final_price:
        raise HTTPException(400, "INSUFFICIENT_BALANCE")

    user_balance.available_balance = float(available - final_price)
    user_balance.frozen_balance = float(
        Decimal(str(user_balance.frozen_balance or 0)) + final_price
    )

    # ── Create order ───────────────────────────────────────
    order_item = OrderItem(
        user_id=payload.user_id,
        product_id=product.id,
        price=final_price,
        currency=product.currency,
        network=product.network,
        input_data=payload.input_data,
        status="pending"
    )
    db.add(order_item)
    db.flush()

    # ── Freeze transaction log ─────────────────────────────
    db.add(Transaction(
        user_id=payload.user_id,
        order_id=order_item.id,
        currency_id=currency.id,
        amount=final_price,
        type="purchase",
        status="frozen"
    ))

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Order creation failed: {str(e)}")

    db.refresh(order_item)
    return {"success": True, "message": "Order created successfully", "order": build_order_response(order_item, db)}

# -------------------------
# GET PENDING ORDERS
# -------------------------
@router.get("/pending")
def get_pending_orders(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):
    # -------------------------
    # ADMIN CHECK
    # -------------------------
    if not has_access(admin, "orders.manage", db):
        raise HTTPException(403, "Access denied")
    include_buyer_detail = has_access(admin, "all.users.view") 
    orders = db.query(OrderItem).filter(OrderItem.status == "pending").order_by(OrderItem.created_at.desc()).all()
    return [build_order_response(o, db, include_buyer_detail) for o in orders]


# -------------------------
# GET ALL ORDERS
# -------------------------
@router.get("/all")
def get_all_orders(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):
    
    include_buyer_detail = has_access(admin, "all.users.view", db) 
    orders = db.query(OrderItem).order_by(OrderItem.created_at.desc()).all()
    return [build_order_response(o, db, include_buyer_detail) for o in orders]


# -------------------------
# APPROVE ORDER
# -------------------------

@router.post("/{order_id}/approve")
def approve_order(
    order_id: int,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):
    if not has_access(admin, "orders.manage", db):
        raise HTTPException(403, "Access denied")

    order_item = db.query(OrderItem).filter(OrderItem.id == order_id).first()
    if not order_item:
        raise HTTPException(404, "Order not found")
    if order_item.status != "pending":
        raise HTTPException(400, "Only pending orders can be approved")

    currency_symbol = order_item.currency or "USDT"
    currency = db.query(Currency).filter(Currency.symbol == currency_symbol).first()
    if not currency:
        raise HTTPException(500, f"Currency '{currency_symbol}' not configured")

    # ── Unfreeze buyer balance ─────────────────────────────
    balance_row = db.query(UserBalance).filter(
        UserBalance.user_id == order_item.user_id,
        UserBalance.currency_id == currency.id
    ).with_for_update().first()

    if not balance_row:
        raise HTTPException(400, "Balance row not found")

    frozen = Decimal(str(balance_row.frozen_balance or 0))
    price = Decimal(str(order_item.price or 0))

    if frozen < price:
        raise HTTPException(400, "Insufficient frozen balance")

    balance_row.frozen_balance = float(frozen - price)

    # ── Complete purchase transaction ──────────────────────
    db.add(Transaction(
        user_id=order_item.user_id,
        order_id=order_item.id,
        currency_id=currency.id,
        amount=-float(price),
        type="purchase",
        status="completed"
    ))

    order_item.status = "approved"
    order_item.approved_at = datetime.utcnow()
    order_item.approved_by = _resolve_admin_username(admin, db)

    # ── Split funds to owner / referrer / master ───────────
    split_order_funds(order_item, db)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Approval failed: {str(e)}")

    db.refresh(order_item)
    return {
        "success": True,
        "message": "Order approved successfully",
        "order_id": order_item.id,
        "currency": currency.symbol
    }

# -------------------------
# REJECT ORDER (REFUND)
# -------------------------
@router.post("/{order_id}/reject")
def reject_order(
    order_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):
    # -------------------------
    # ADMIN CHECK
    # -------------------------
    if not has_access(admin, "orders.manage", db):
        raise HTTPException(403, "Access denied")
    # -------------------------
    # ORDER CHECK
    # -------------------------
    order_item = db.query(OrderItem).filter(
        OrderItem.id == order_id
    ).first()

    if not order_item:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    if order_item.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Only pending orders can be rejected"
        )

    # -------------------------
    # DYNAMIC CURRENCY
    # -------------------------
    currency_symbol = order_item.currency or "USDT"

    currency = db.query(Currency).filter(
        Currency.symbol == currency_symbol
    ).first()

    if not currency:
        raise HTTPException(
            status_code=500,
            detail=f"Currency '{currency_symbol}' not configured"
        )

    # -------------------------
    # USER BALANCE
    # -------------------------
    balance_row = db.query(UserBalance).filter(
        UserBalance.user_id == order_item.user_id,
        UserBalance.currency_id == currency.id
    ).with_for_update().first()

    if not balance_row:
        raise HTTPException(
            status_code=400,
            detail="Balance row not found"
        )

    frozen = float(balance_row.frozen_balance or 0)
    available = float(balance_row.available_balance or 0)
    price = float(order_item.price or 0)

    if frozen < price:
        raise HTTPException(
            status_code=400,
            detail="Insufficient frozen balance"
        )

    # -------------------------
    # REFUND USER
    # -------------------------
    balance_row.frozen_balance = frozen - price
    balance_row.available_balance = available + price

    order_item.status = "rejected"
    order_item.rejected_at = datetime.utcnow()
    order_item.rejected_by = _resolve_admin_username(admin, db)
    order_item.rejection_reason = reason

    # -------------------------
    # REFUND TRANSACTION
    # -------------------------
    tx = Transaction(
        user_id=order_item.user_id,
        order_id=order_item.id,
        currency_id=currency.id,
        amount=price,
        type="refund",
        status="completed"
    )

    db.add(tx)

    try:
        db.commit()
    except Exception as e:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Reject failed: {str(e)}"
        )

    db.refresh(order_item)

    return {
        "success": True,
        "message": "Order rejected and refunded",
        "order_id": order_item.id,
        "currency": currency.symbol
    }

# -------------------------
# DELIVER ORDER
# -------------------------
@router.post("/{order_id}/deliver")
async def deliver_order(
    order_id: int,
    delivery_info: Optional[dict] = None,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):
    if not has_access(admin, "orders.manage", db):
        raise HTTPException(403, "Access denied")
    
    order_item = db.query(OrderItem).filter(
        OrderItem.id == order_id
    ).first()

    if not order_item:
        raise HTTPException(404, "Order not found")

    if order_item.status != "approved":
        raise HTTPException(400, "Only approved orders can be delivered")

    user = db.query(User).filter(
        User.user_id == order_item.user_id
    ).first()

    product = db.query(Product).filter(
        Product.id == order_item.product_id
    ).first()

    if not user or not user.telegram_id:
        raise HTTPException(
            400,
            "User has no Telegram connected, cannot deliver order"
        )

    # -------------------------
    # BUILD MESSAGE FIRST
    # -------------------------
    if delivery_info and "delivery_info" in delivery_info:
        delivery_info = delivery_info["delivery_info"]

    delivery_text = f"""🎉 Your Order Has Been Delivered!

    📦 Order #{order_item.id}
    🛍 Product: {product.name if product else "Unknown"}
    📋 Plan: {product.plan if product else "Unknown"}
    ━━━━━━━━━━━━━━━

    {delivery_info.get("message") if delivery_info else "Your order has been delivered successfully."}

    ━━━━━━━━━━━━━━━"""

    # -------------------------
    # SEND TELEGRAM FIRST (CRITICAL STEP)
    # -------------------------
    try:
        await send_telegram_message(
            chat_id=user.telegram_id,
            text=delivery_text
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Telegram notification failed, order NOT delivered: {str(e)}"
        )

    # -------------------------
    # ONLY AFTER SUCCESS → UPDATE ORDER
    # -------------------------
    order_item.status = "delivered"
    order_item.delivery_info = delivery_info or {
        "message": "Order delivered successfully"
    }
    order_item.delivered_at = datetime.utcnow()
    order_item.delivered_by = _resolve_admin_username(admin, db)
   
    try:
        db.commit()
        db.refresh(order_item)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Order saved but DB update failed: {str(e)}"
        )
    
        # -------------------------
    # SPLIT FUNDS FOR REWARD, COMMISSIONS, PRODUCT OWNER
    # -------------------------

    return {
        "success": True,
        "message": "Order delivered successfully",
        "order_id": order_item.id,
        "status": order_item.status,
        "delivery_info": order_item.delivery_info,
        "delivered_at": order_item.delivered_at
    }

# -------------------------
# UPDATE ORDER PRICE (Admin)
# -------------------------
@router.put("/{order_id}/price")
def update_order_price(
    order_id: int,
    new_price: float,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):
    # -------------------------
    # ADMIN CHECK
    # -------------------------
    if not has_access(admin, "orders.manage", db):
        raise HTTPException(403, "Access denied")

    order_item = db.query(OrderItem).filter(OrderItem.id == order_id).first()
    if not order_item:
        raise HTTPException(status_code=404, detail="Order not found")

    if order_item.status not in ["pending"]:
        raise HTTPException(status_code=400, detail="Can only update price of pending orders")

    order_item.price = new_price
    db.commit()

    return {"success": True, "message": "Order price updated", "new_price": float(new_price)}


# -------------------------
# GET ALL TRANSACTIONS (Enriched)
# -------------------------
@router.get("/transactions")
def get_all_transactions(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):
    # -------------------------
    # ADMIN CHECK
    # -------------------------
    if not has_access(admin, "transactions.view", db):
        raise HTTPException(403, "Access denied")

    if admin["role"] == "master":
        transactions = (
            db.query(Transaction)
            .join(User, User.user_id == Transaction.user_id)
            .filter(Transaction.user_id != admin["user_id"])
            .order_by(Transaction.id.desc())
            .all()
        )

    else:  # admin
        transactions = (
            db.query(Transaction)
            .join(User, User.user_id == Transaction.user_id)
            .filter(
                Transaction.user_id != admin["user_id"],
                User.role != "master"
            )
            .order_by(Transaction.id.desc())
            .all()
        )

    result = []

    for t in transactions:

        u = db.query(User).filter(User.user_id == t.user_id).first()

        currency = db.query(Currency).filter(
            Currency.id == t.currency_id
        ).first()

        network = None
        if t.network_id:
            network = db.query(Network).filter(
                Network.id == t.network_id
            ).first()

        order = None
        product = None

        if t.order_id:
            order = db.query(OrderItem).filter(
                OrderItem.id == t.order_id
            ).first()

            if order and order.product:
                product = order.product

        category_name = None
        if product and product.category_id:
            from app.models.category import Category
            cat = db.query(Category).filter(Category.id == product.category_id).first()
            category_name = cat.name if cat else None

        result.append({

            # ================= CORE =================
            "id": t.id,
            "order_id": t.order_id,
            "user_id": t.user_id,
            "username": u.username if u else "unknown",
            "role": u.role if u else "unknown",

            "type": t.type,
            "status": t.status,
            "amount": float(t.amount or 0),
            "created_at": t.created_at,

            # ================= COMPAT (FLAT FIELDS FOR OLD UI) =================
            "product_name": product.name if product else None,
            "category_name": category_name,

            # ================= CURRENCY =================
            "currency": {
                "id": currency.id if currency else None,
                "symbol": currency.symbol if currency else "N/A",
                "name": currency.name if currency else None
            },

            # ================= NETWORK =================
            "network": {
                "id": network.id if network else None,
                "name": network.name if network else None,
                "chain": network.chain if network else None
            } if network else None,

            # ================= PRODUCT =================
            "product": {
                "id": product.id if product else None,
                "name": product.name if product else None,
                "type": product.product_type if product else None,
                "plan": product.plan if product else None,
                "category_name": category_name
            } if product else None,

            # ================= ORDER =================
            "order": {
                "id": order.id if order else None,
                "price": float(order.price) if order else None,
                "currency": order.currency if order else None,
                "network": order.network if order else None,
                "status": order.status if order else None
            } if order else None,

            # ================= BLOCKCHAIN =================
            "tx_hash": t.tx_hash,
            "wallet_address": t.wallet_address,
            "blockchain": t.blockchain,
            "confirmations": t.confirmations,
        })

    return result

# -------------------------
# SHARED RESPONSE BUILDER (FULL PRODUCT INFO)
# -------------------------
def build_order_response(order_item: OrderItem, db: Session, include_buyer_detail: bool = True):

    user = db.query(User).filter(
        User.user_id == order_item.user_id
    ).first()

    product = db.query(Product).filter(
        Product.id == order_item.product_id
    ).first()

    balances = db.query(UserBalance).filter(
        UserBalance.user_id == order_item.user_id).all()

    # -------------------------
    # CATEGORY
    # -------------------------
    category_name = None

    if product and product.category_id:

        from app.models.category import Category

        cat = db.query(Category).filter(
            Category.id == product.category_id
        ).first()

        category_name = cat.name if cat else None

    # -------------------------
    # EXTRA DATA
    # -------------------------
    extra_data = {}

    if product and product.extra_data:
        extra_data = product.extra_data

    # -------------------------
    # PRODUCT OWNER USERNAME
    # -------------------------
    product_owner_displayName = None
    product_owner_username = None
    if product and product.admin_id:
        owner_map = _admin_telegram_displayName_map(db, {product.admin_id})
        owner_username= get_admin_username(db, product.admin_id)
        product_owner_displayName = owner_map.get(product.admin_id)
        product_owner_username = owner_username

    # -------------------------
    # ORIGINAL PRICE (pre-discount)
    # -------------------------
    original_price = float(order_item.original_price) if getattr(order_item, "original_price", None) is not None else None
    if original_price is None and product and product.discount_percent:
        try:
            dp = float(product.discount_percent)
            if dp < 100:
                original_price = round(float(order_item.price) / (1 - dp / 100), 8)
        except (TypeError, ZeroDivisionError):
            original_price = None

    # -------------------------
    # RESPONSE
    # -------------------------
    return {

        # ORDER
        "id": order_item.id,
        "status": order_item.status,
        "created_at": order_item.created_at,
        "delivered_at": order_item.delivered_at,
        "delivered_by": order_item.delivered_by,
        "approved_at": order_item.approved_at,
        "approved_by": order_item.approved_by,
        "rejected_at": order_item.rejected_at,
        "rejected_by": order_item.rejected_by,
        "rejection_reason": order_item.rejection_reason,
        "failed_at": getattr(order_item, "failed_at", None),
        "failed_by": getattr(order_item, "failed_by", None),
        "fail_reason": getattr(order_item, "fail_reason", None),
        "delivery_info": order_item.delivery_info,

        # USER
        "user_id": order_item.user_id,
        "username": user.username if user and include_buyer_detail else None,
        "user_admin_id": user.admin_id if user and include_buyer_detail else None,

        "telegram_id" : user.telegram_id if user and include_buyer_detail else None,
        "user_status" : user.status if user and include_buyer_detail else None,
        "balances": [
                     {
                "currency": b.currency.symbol if b.currency else None,
                "network": b.network.name if b.network else None,
                "available": b.available_balance,
                "frozen": b.frozen_balance,
                      }
                   for b in balances
                  ] if include_buyer_detail else [],

        "created_date": user.created_date if include_buyer_detail else None,
        "access_points": user.access_points if include_buyer_detail else None,


        # PRODUCT
        "product_id": product.id if product else None,
        "product_admin_id": product.admin_id if product else None,
        "product_owner_displayName": product_owner_displayName,
        "product_owner_username": product_owner_username,
        "product_name": product.name if product else "unknown",
        "slug": product.slug if product else None,
        "product_reward": product.system_reward_percent if product else None,
        "product_commision": product.system_commision if product else None,
        
        # CLASSIFICATION
        "product_type": product.product_type if product else None,
        "category_id": product.category_id if product else None,
        "category_name": category_name,

        # PRODUCT DETAILS
        "plan": product.plan if product else None,
        "description": product.description if product else None,

        # PRICE
        "price": float(order_item.price),
        "original_price": original_price,
        "discount_percent": float(product.discount_percent) if product and product.discount_percent else None,
        "currency": order_item.currency,
        "network": order_item.network,

        # VALIDITY
        "validity_days": product.validity_days if product else None,
        "validity_hours": product.validity_hours if product else None,
        "data_volume_gb": product.data_volume_gb if product else None,

        # FLAGS
        "is_recurring": product.is_recurring if product else False,
        "is_active": product.is_active if product else False,
        "is_featured": product.is_featured if product else False,

        # STOCK
        "stock": product.stock if product else None,

        # EXTRA JSON DATA
        "extra_data": extra_data,

        # PRODUCT TIMESTAMPS
        "product_created_at": product.created_at if product else None,
        "product_updated_at": product.updated_at if product else None,

        "input_data": order_item.input_data,
        "icon_path": product.icon_path if product else None,
    }




@router.get("/analytics/products")
def get_product_analytics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    """
    Returns per-product order analytics for delivered orders.
    Response fields:
      - product_id, product_name, plan, product_type
      - category_name
      - sold         : count of delivered orders
      - income       : sum of order prices for delivered orders
      - admin_id     : user_id of product owning admin
      - is_admin_product : True when creator has role admin or master
    """

 
    # Aggregate delivered orders per product
    q = (
        db.query(
            OrderItem.product_id,
            func.count(OrderItem.id).label("sold"),
            func.sum(OrderItem.price).label("income"),
        )
        .filter(OrderItem.status == "delivered")
    )
    if start_date is not None:
        q = q.filter(OrderItem.created_at >= start_date)
    if end_date is not None:
        q = q.filter(OrderItem.created_at <= end_date)

    rows = q.group_by(OrderItem.product_id).all()
 
    result = []
    admin_ids = set()
    for row in rows:
        product = db.query(Product).filter(Product.id == row.product_id).first()
        if not product:
            continue
 
        # Category name
        category_name = None
        if product.category_id:
            from app.models.category import Category
            cat = db.query(Category).filter(Category.id == product.category_id).first()
            category_name = cat.name if cat else None
 
        # Determine if this is an admin/master product and get creator
        is_admin_product = False
        admin_id = product.admin_id or None
        if product.admin_id:
            admin_ids.add(product.admin_id)
            creator = (
                db.query(User)
                .filter(User.user_id == product.admin_id)
                .first()
            )
            if creator and creator.role in ("admin", "master"):
                is_admin_product = True
 
        result.append({
            "product_id":       product.id,
            "product_name":     product.name,
            "plan":             product.plan,          # <-- included for label disambiguation
            "product_type":     product.product_type,
            "category_name":    category_name,
            "sold":             int(row.sold or 0),
            "income":           float(row.income or 0),
            "admin_id":         admin_id,              # <-- used for admin filter dropdown
            "is_admin_product": is_admin_product,
        })
            # Resolve admin display names / usernames in one pass
    username_map = get_admin_usernames(db, admin_ids)
    for item in result:
        if item["admin_id"] is not None:
            item["admin_username"] = username_map.get(item["admin_id"])
 
    result.sort(key=lambda x: x["sold"], reverse=True)
    return result