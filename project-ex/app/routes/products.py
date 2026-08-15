from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.models.product import Product
from app.schemas.product import ProductOut

router = APIRouter(prefix="/products", tags=["Products"])


# =========================
# GET ALL PRODUCTS (Public)
# =========================
@router.get("/", response_model=list[ProductOut])
def get_products(
    category_id: Optional[int] = None,
    is_active: bool = True,
    db: Session = Depends(get_db)
):
    query = db.query(Product).filter(Product.is_active == is_active)

    if category_id is not None:
        query = query.filter(Product.category_id == category_id)

    return query.order_by(Product.name.asc()).all()


# =========================
# GET PRODUCTS BY CATEGORY (Public)
# =========================
@router.get("/by-category/{category_id}", response_model=list[ProductOut])
def get_products_by_category(
    category_id: int,
    is_active: bool = True,
    db: Session = Depends(get_db)
):
    products = db.query(Product).filter(
        Product.category_id == category_id,
        Product.is_active == is_active
    ).order_by(Product.name.asc()).all()

    if not products:
        # Optional: You can return empty list instead of 404
        return []

    return products


# =========================
# GET SINGLE PRODUCT (Optional but very useful)
# =========================
@router.get("/{product_id}", response_model=ProductOut)
def get_product_detail(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.is_active == True
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return product