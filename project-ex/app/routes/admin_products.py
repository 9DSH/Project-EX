import os
import uuid
import shutil

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File
)
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.db.database import get_db
from app.models.product import Product
from app.models.category import Category
from app.core.security import get_current_user
from app.schemas.product import ProductCreate , ProductUpdate
from typing import Optional, Dict, Any
from app.schemas.product import ProductOut
from app.core.security import get_current_user, is_master, is_admin_or_above

from app.core.permissions import has_access

router = APIRouter(prefix="/admin/products", tags=["Admin Products"])

def get_admin(user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    if not has_access(user, "products.view"):
        raise HTTPException(status_code=403, detail="Access denied")

    return user

# GET ALL PRODUCTS (ADMIN)
@router.get("/", response_model=list[ProductOut])
def get_all_products(
    category_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    query = db.query(Product)

    # Optional active filter
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)

    # Optional category filter
    if category_id is not None:
        query = query.filter(Product.category_id == category_id)

    return query.order_by(Product.name.asc()).all()


# CREATE
@router.post("/")
def create_product(
    payload: ProductCreate, 
    db: Session = Depends(get_db), 
    admin=Depends(get_admin)
    ):

    if not has_access(admin, "products.create"):
        raise HTTPException(403, "Access denied")

    if payload.category_id:
        category = db.query(Category).filter(Category.id == payload.category_id).first()
        if not category:
            raise HTTPException(status_code=400, detail="Invalid category_id")
    
    if not payload.admin_id:
         creator_admin_id = admin.get("user_id")
    else:
         creator_admin_id = payload.admin_id


    product = Product(
        name=payload.name,
        product_type=payload.product_type,
        plan=payload.plan,
        price=payload.price,
        discount_percent=payload.discount_percent,
        currency=payload.currency,
        network=payload.network,
        description=payload.description,
        validity_days=payload.validity_days,
        validity_hours=payload.validity_hours,
        data_volume_gb=payload.data_volume_gb,
        extra_data=payload.extra_data or {},
        category_id=payload.category_id,
        is_recurring= payload.is_recurring,
        stock= payload.stock,
        is_featured=payload.is_featured,
        is_active= False,
        icon_path=payload.icon_path,
        admin_id=creator_admin_id,
        approval_status="pending",
        required_user_data=payload.required_user_data or {},
        system_reward_percent=payload.system_reward_percent,

        system_commision=payload.system_commision
        )

    db.add(product)
    db.commit()
    db.refresh(product)

    return {"success": True, "product": product}

@router.patch("/{product_id}/toggle-active")
def toggle_product_active(
    product_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    if not has_access(admin, "products.management"):
        raise HTTPException(status_code=403, detail="Access denied")

    product = db.query(Product).filter(Product.id == product_id).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # ── ownership rule ─────────────────────────────
    if not is_master(admin):
        if product.admin_id != admin.get("user_id"):
            raise HTTPException(
                status_code=403,
                detail="You can only modify your own products"
            )

    # ── toggle logic ───────────────────────────────
    product.is_active = not product.is_active

    db.commit()
    db.refresh(product)

    return {
        "success": True,
        "id": product.id,
        "is_active": product.is_active
    }


# UPDATE (Any field)
@router.put("/{product_id}")
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    if not has_access(admin, "products.edit"):
        raise HTTPException(403, "Access denied")
    
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if not is_master(admin):
        if product.admin_id != admin.get("user_id"):
            raise HTTPException(
                status_code=403,
                detail="Not authorized"
            )
        
    update_data = payload.model_dump(exclude_unset=True)  # only fields actually sent

    simple_fields = [
        "name", "product_type", "plan", "price", "discount_percent",
        "currency", "network", "description", "validity_days", "validity_hours",
        "data_volume_gb", "extra_data", "category_id", "is_recurring",
        "stock", "is_featured", "icon_path", "required_user_data",
    ]
    for field in simple_fields:
        if field in update_data:
            setattr(product, field, update_data[field])  # sets even if value is None/null

    if is_master(admin):
        for field in ["system_commision", "system_reward_percent", "admin_id"]:
            if field in update_data:
                setattr(product, field, update_data[field])
    else:
        if "system_commision" in update_data or "system_reward_percent" in update_data:
            raise HTTPException(403, "Only master can update system_commision and system_reward_percent")

    if is_master(admin):
        if "is_active" in update_data:
            product.is_active = update_data["is_active"]
    else:
        product.approval_status = "pending"
        product.approved_by = None
        product.approved_at = None
        product.rejection_reason = None
        product.is_active = False

    db.commit()
    db.refresh(product)
    return {"success": True, "product": product}


# DELETE
from app.models.order_item import OrderItem

@router.post("/upload-product-icon")
async def upload_product_icon(
    file: UploadFile = File(...),
    admin=Depends(get_admin)
      ):
    upload_dir = "uploads/products"
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1]

    filename = f"{uuid.uuid4()}{ext}"

    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "success": True,
        "path": f"/uploads/products/{filename}"
    }

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    if not has_access(admin, "products.delete"):
        raise HTTPException(403, "Access denied")
    
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()



    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    orders = db.query(OrderItem).filter(
        OrderItem.product_id == product_id
    ).all()

    if orders:
        return {
            "success": False,
            "blocked": True,
            "message": "Cannot delete product because it has order history",
            "order_count": len(orders),
            "order_ids": [o.id for o in orders]
        }
    

    # =========================
    # DELETE ICON FILE
    # =========================
    if product.icon_path:
        try:
            file_path = product.icon_path.lstrip("/")  # uploads/products/xxx.png

            if os.path.exists(file_path):
                os.remove(file_path)

        except Exception as e:
            print(f"Failed to delete product icon: {e}")

    db.delete(product)
    db.commit()

    return {
        "success": True,
        "blocked": False,
        "message": "Product deleted successfully"
    }