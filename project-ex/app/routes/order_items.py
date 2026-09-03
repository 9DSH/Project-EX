from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.rls import get_db_rls
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.user import User
from app.models.user_balance import UserBalance
from app.models.currency import Currency
from app.models.transaction import Transaction
from app.core.security import get_current_user
from app.constants.transaction_types import PURCHASE
from app.constants.transaction_status import PENDING, FROZEN
from typing import Optional, Dict, Any
from decimal import Decimal

router = APIRouter(prefix="/orders", tags=["Orders"])


# =========================
# CREATE ORDER (FIXED + SAFE)
# =========================
@router.post("/")
def create_order(
    product_id: int,
    input_data: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):
    # -------------------------
    # USER ID SAFE EXTRACTION
    # -------------------------
    user_id = user.get("user_id") or user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user")

    # -------------------------
    # LOCK USER ROW (SAFE)
    # -------------------------
    db_user = db.query(User).filter(User.user_id == user_id).with_for_update().first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # -------------------------
    # PRODUCT CHECK
    # -------------------------
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.is_active == True
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # -------------------------
    # CURRENCY CHECK (USDT default)
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


    final_price = discounted


     # ── Validate required fields ───────────────────────────
    required_fields = product.required_user_data or {}
    if required_fields:
        missing = [
            key for key, field in required_fields.items()
            if field.get("step", "before_order") == "before_order"
            and field.get("required", True)
            and (not input_data or input_data.get(key) in [None, ""])
        ]
        if missing:
            raise HTTPException(400, {"error": "MISSING_REQUIRED_DATA", "missing": missing})
    

    after_login_fields = {
                k: v for k, v in required_fields.items()
                if v.get("step") == "after_login"
            }
    # ── Freeze user balance (only action at create time) ───
    user_balance = db.query(UserBalance).filter(
        UserBalance.user_id == user_id,
        UserBalance.currency_id == currency.id
    ).with_for_update().first()

    if not user_balance:
        user_balance = UserBalance(
            user_id=user_id,
            currency_id=currency.id,
            available_balance=0,
            frozen_balance=0
        )
        db.add(user_balance)
        db.flush()

    available = Decimal(str(user_balance.available_balance or 0))
    if available < final_price:
        missing = final_price - available
        return {
            "success": False,
            "error": "INSUFFICIENT_BALANCE",
            "currency": currency.symbol,
            "current_balance": float(available),
            "required_amount": float(final_price),
            "missing_amount": float(missing),
        }

    user_balance.available_balance = float(available - final_price)
    user_balance.frozen_balance = float(
        Decimal(str(user_balance.frozen_balance or 0)) + final_price
    )
        
    # -------------------------
    # CREATE ORDER
    # -------------------------
    order_item = OrderItem(
        user_id=user_id,
        product_id=product.id,
        original_price=original_price,
        discount_percent=product.discount_percent,
        price=final_price,
        currency=product.currency,
        network=product.network,
        input_data = input_data,
        status=PENDING
    )

    db.add(order_item)
    db.flush()  # ensures order_id exists for transaction

    # -------------------------
    # TRANSACTION LOG
    # -------------------------
    user_tx = Transaction(
        user_id=user_id,
        order_id=order_item.id,
        currency_id=currency.id,
        amount=final_price,
        type=PURCHASE,
        status=FROZEN
    )

    

    db.add(user_tx)

    # -------------------------
    # COMMIT SAFELY
    # -------------------------
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Order creation failed: {str(e)}"
        )

    db.refresh(order_item)

    # -------------------------
    # RESPONSE
    # -------------------------
    return {
        "success": True,
        "message": "Order created successfully",
        "order_id": order_item.id,
        "status": order_item.status,
        "product_name": product.name,
        "product_plan": product.plan,
        "price": final_price,
        "currency": product.currency,
        "after_login_required": after_login_fields
    }

# =========================
# GET MY ORDERS (Important for Telegram Bot)
# =========================
@router.get("/my")
def get_my_orders(
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):
    user_id = user.get("user_id") or user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user")

    orders = db.query(OrderItem).filter(
        OrderItem.user_id == user_id
    ).order_by(OrderItem.created_at.desc()).all()

    result = []
    for order in orders:
        product = db.query(Product).filter(Product.id == order.product_id).first()
        
        result.append({
            "order_id": order.id,
            "product_id": order.product_id,
            "product_name": product.name if product else "Unknown",
            "product_type": product.product_type if product else None,
            "product_owner": getattr(product, "owner_username", None) if product else None,
            "extra_features": getattr(product, "extra_features", None) if product else None,
            "original_price": float(order.original_price) if order.original_price is not None else None,
            "discount_percent": float(order.discount_percent) if order.discount_percent is not None else None,
            "price": float(order.price),
            "currency": order.currency,
            "status": order.status,
            "created_at": order.created_at,
            "approved_at": order.approved_at,
            "approved_by": order.approved_by,
            "rejected_at": order.rejected_at,
            "rejected_by": order.rejected_by,
            "rejection_reason": order.rejection_reason,
            "delivered_at": order.delivered_at,
            "delivered_by": order.delivered_by,
            "failed_at": order.failed_at,
            "failed_by": order.failed_by,
            "fail_reason": order.fail_reason,
            "delivery_info": order.delivery_info
        })

    return result


# =========================
# GET SINGLE ORDER (Optional but useful)
# =========================
@router.get("/{order_id}")
def get_order_detail(
    order_id: int,
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):
    user_id = user.get("user_id") or user.get("id")

    order = db.query(OrderItem).filter(
        OrderItem.id == order_id,
        OrderItem.user_id == user_id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    product = db.query(Product).filter(Product.id == order.product_id).first()

    return {
        "order_id": order.id,
        "product_id": order.product_id,
        "product_name": product.name if product else None,
        "product_owner": getattr(product, "owner_username", None) if product else None,
        "extra_features": getattr(product, "extra_features", None) if product else None,
        "original_price": float(order.original_price) if order.original_price is not None else None,
        "discount_percent": float(order.discount_percent) if order.discount_percent is not None else None,
        "price": float(order.price),
        "status": order.status,
        "created_at": order.created_at,
        "approved_at": order.approved_at,
        "approved_by": order.approved_by,
        "rejected_at": order.rejected_at,
        "rejected_by": order.rejected_by,
        "rejection_reason": order.rejection_reason,
        "delivered_at": order.delivered_at,
        "delivered_by": order.delivered_by,
        "failed_at": order.failed_at,
        "failed_by": order.failed_by,
        "fail_reason": order.fail_reason,
        "delivery_info": order.delivery_info
    }