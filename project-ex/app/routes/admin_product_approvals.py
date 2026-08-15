from datetime import datetime

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from app.db.database import get_db

from app.models.product import Product

from app.core.security import get_current_user
from app.core.security import is_master

from pydantic import BaseModel
from typing import Optional
from decimal import Decimal


class ProductApprovePayload(BaseModel):
    system_commision: Decimal
    system_reward_percent: Decimal


class ProductRejectPayload(BaseModel):
    reason: Optional[str] = None


router = APIRouter(
    prefix="/admin/product-approvals",
    tags=["Product Approvals"]
)


def get_master(
    user=Depends(get_current_user)
):
    if not is_master(user):
        raise HTTPException(
            403,
            "Master access required"
        )

    return user


@router.get("/pending")
def pending_products(
    db: Session = Depends(get_db),
    master=Depends(get_master)
):
    return (
        db.query(Product)
        .filter(
            Product.approval_status == "pending"
        )
        .order_by(Product.created_at.desc())
        .all()
    )


@router.get("/approved")
def approved_products(
    db: Session = Depends(get_db),
    master=Depends(get_master)
):
    return (
        db.query(Product)
        .filter(
            Product.approval_status == "approved"
        )
        .order_by(Product.created_at.desc())
        .all()
    )


@router.get("/rejected")
def rejected_products(
    db: Session = Depends(get_db),
    master=Depends(get_master)
):
    return (
        db.query(Product)
        .filter(
            Product.approval_status == "rejected"
        )
        .order_by(Product.created_at.desc())
        .all()
    )


@router.post("/{product_id}/approve")
def approve_product(
    product_id: int,
    payload: ProductApprovePayload,
    db: Session = Depends(get_db),
    master=Depends(get_master)
):
    product = (
        db.query(Product)
        .filter(Product.id == product_id)
        .first()
    )

    if not product:
        raise HTTPException(
            404,
            "Product not found"
        )

    if product.approval_status != "pending":
        raise HTTPException(
            400,
            f"Product is already '{product.approval_status}', only pending products can be approved"
        )

    product.system_commision = payload.system_commision
    product.system_reward_percent = payload.system_reward_percent

    product.approval_status = "approved"
    product.is_active = True
    product.approved_by = master.get("sub")
    product.approved_at = datetime.utcnow()
    product.rejection_reason = None

    db.commit()
    db.refresh(product)

    return {
        "success": True,
        "product": product
    }


@router.post("/{product_id}/reject")
def reject_product(
    product_id: int,
    payload: ProductRejectPayload,
    db: Session = Depends(get_db),
    master=Depends(get_master)
):
    product = (
        db.query(Product)
        .filter(Product.id == product_id)
        .first()
    )

    if not product:
        raise HTTPException(
            404,
            "Product not found"
        )

    if product.approval_status != "pending":
        raise HTTPException(
            400,
            f"Product is already '{product.approval_status}', only pending products can be rejected"
        )

    product.approval_status = "rejected"
    product.is_active = False
    product.rejection_reason = payload.reason
    product.approved_by = master.get("sub")
    product.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(product)

    return {
        "success": True,
        "product": product
    }


@router.post("/{product_id}/resubmit")
def resubmit_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_current_user)
):
    product = (
        db.query(Product)
        .filter(Product.id == product_id)
        .first()
    )

    if not product:
        raise HTTPException(
            404,
            "Product not found"
        )

    if product.approval_status != "rejected":
        raise HTTPException(
            400,
            "Only rejected products can be resubmitted"
        )

    if not is_master(admin):
        if product.admin_id != admin.get("user_id"):
            raise HTTPException(
                403,
                "Not authorized"
            )

    product.approval_status = "pending"
    product.is_active = False
    product.approved_by = None
    product.approved_at = None
    product.rejection_reason = None

    db.commit()

    return {
        "success": True
    }


