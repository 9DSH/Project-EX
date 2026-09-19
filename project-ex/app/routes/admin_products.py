import os
import uuid
import shutil
from datetime import datetime
from decimal import Decimal 
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Query,
)
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from sqlalchemy.exc import SQLAlchemyError
from app.core.rls import get_db_rls
from app.models.product import Product
from app.models.category import Category
from app.core.security import get_current_user
from app.schemas.product import ProductCreate , ProductUpdate
from typing import Optional, Dict, Any
from app.schemas.product import ProductOut
from app.core.security import get_current_user, is_master, is_admin_or_above
from app.routes.utilts.shared_functions import get_admin_usernames, _reassert_master_rls
from app.core.permissions import has_access

router = APIRouter(prefix="/admin/products", tags=["Admin Products"])

def get_admin(
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user),
):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    if not has_access(user, "products.service", db):
        raise HTTPException(status_code=403, detail="Access denied")

    return user


def _serialize_products(db: Session, products: list[Product]) -> list[ProductOut]:
    admin_usernames = get_admin_usernames(db, [p.admin_id for p in products])
    results = []
    for product in products:
        product_out = ProductOut.model_validate(product)
        product_out.admin_username = admin_usernames.get(product.admin_id) if product.admin_id else ""
        results.append(product_out)
    return results


# GET ALL PRODUCTS (ADMIN)
# `view` controls both the admin-scope and the status filter in one control:
#   "mine"      -> caller's own products, any status (default)
#   "pending"   -> master: every admin's pending products.
#                  non-master: only the caller's own pending products.
#   "rejected"  -> same as "pending" but for rejected products.
#   "all"       -> requires master OR platform.products.service.
#                  master: literally everything, every admin, every status.
#                  platform.products.service (non-master): the caller's own
#                  products at ANY status, plus every other admin's products
#                  that are approved + active (never their pending/rejected).
@router.get("/", response_model=list[ProductOut])
def get_all_products(
    category_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    view: str = Query("mine"),
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):
    if view not in ("mine", "pending", "rejected", "all"):
        raise HTTPException(400, "Invalid view")

    master = is_master(admin)
    my_id = admin.get("user_id")
    can_see_all = master or has_access(admin, "platform.products.service", db)

    if view == "all":
        if not can_see_all:
            raise HTTPException(403, "Not authorized to view all admins' products")
        if not master:
            # This admin has platform.products.service but isn't master.
            # get_db_rls set app.is_master='false' for their session, and
            # the RLS policy on products keys off that flag — so without
            # this, the database silently strips out every row that isn't
            # this admin's own BEFORE our WHERE clause below ever runs,
            # regardless of what we filter for in Python. Elevate RLS
            # visibility for this one read (SET LOCAL resets automatically
            # at the end of the request's transaction); the actual business
            # rule (own products at any status, everyone else's only if
            # approved + active) is still enforced by the filter below.
            db.execute(text("SET LOCAL app.is_master = 'true'"))
        query = db.query(Product)
        if not master:
            # platform.products.service, not master: own products at any status,
            # everyone else's only if approved + active.
            query = query.filter(
                or_(
                    Product.admin_id == my_id,
                    and_(Product.approval_status == "approved", Product.is_active == True),
                )
            )
    elif view in ("pending", "rejected"):
        query = db.query(Product).filter(Product.approval_status == view)
        if not master:
            # Non-master (with or without platform.products.service) only ever
            # sees their own pending/rejected products — never another admin's.
            query = query.filter(Product.admin_id == my_id)
    else:  # "mine"
        query = db.query(Product).filter(Product.admin_id == my_id)

    if is_active is not None:
        query = query.filter(Product.is_active == is_active)

    if category_id is not None:
        query = query.filter(Product.category_id == category_id)

    products = query.order_by(Product.name.asc()).all()
    return _serialize_products(db, products)


# GET PRODUCTS BY CATEGORY (ADMIN — used by UserSidebar/OrdersTab when creating an order)
# Only active + approved products are orderable, so this always uses the "all"
# visibility rule for admins with platform.products.service (own products would
# already be active+approved to be orderable anyway) and "mine" otherwise.
@router.get("/by-category/{category_id}", response_model=list[ProductOut])
def get_products_by_category_admin(
    category_id: int,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):
    master = is_master(admin)
    my_id = admin.get("user_id")
    can_see_all = master or has_access(admin, "platform.products.service", db)

    query = db.query(Product).filter(
        Product.category_id == category_id,
        Product.is_active == True,
        Product.approval_status == "approved",
    )
    if not can_see_all:
        query = query.filter(Product.admin_id == my_id)

    products = query.order_by(Product.name.asc()).all()
    return _serialize_products(db, products)


# CREATE
@router.post("/")
def create_product(
    payload: ProductCreate, 
    db: Session = Depends(get_db_rls), 
    admin=Depends(get_admin)
    ):

    if payload.category_id:
        category = db.query(Category).filter(Category.id == payload.category_id).first()
        if not category:
            raise HTTPException(status_code=400, detail="Invalid category_id")
    
    if not payload.admin_id:
         creator_admin_id = admin.get("user_id")
    else:
         creator_admin_id = payload.admin_id

    creator_is_master = is_master(admin) and creator_admin_id == admin.get("user_id")

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
        # Master's own products bypass approval entirely and go live immediately.
        is_active= creator_is_master,
        icon_path=payload.icon_path,
        admin_id=creator_admin_id,
        approval_status="approved" if creator_is_master else "pending",
        required_user_data=payload.required_user_data or {},
        system_reward_percent=payload.system_reward_percent,

        system_commision=payload.system_commision
        )

    if creator_is_master:
        product.approved_by = admin.get("sub")
        product.approved_at = datetime.utcnow()

    db.add(product)
    db.commit()
    _reassert_master_rls(db)
    db.refresh(product)

    return {"success": True, "product": product}

@router.patch("/{product_id}/toggle-active")
def toggle_product_active(
    product_id: int,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):

    product = db.query(Product).filter(Product.id == product_id).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # ── ownership rule ─────────────────────────────
    # Note: even admins with platform.products.service (who can *see* everyone's
    # products) are NOT master, so this still blocks them from toggling a
    # product they don't own.
    if not is_master(admin):
        if product.admin_id != admin.get("user_id"):
            raise HTTPException(
                status_code=403,
                detail="You can only modify your own products"
            )

    # ── approval rule ───────────────────────────────
    # A product can only be made active once master has approved it.
    if not is_master(admin) and product.approval_status != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"Product is '{product.approval_status}'; it can only be activated after master approval"
        )

    # ── toggle logic ───────────────────────────────
    product.is_active = not product.is_active

    db.commit()
    _reassert_master_rls(db)
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
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):
    if not has_access(admin, "products.edit", db):
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
        for field in ["system_commision", "system_reward_percent"]:
            if field not in update_data:
                continue
            new_val = update_data[field]
            current_val = getattr(product, field)

            def _to_decimal(v):
                if v is None or v == "":
                    return None
                try:
                    return Decimal(str(v))
                except Exception:
                    return None

            new_dec = _to_decimal(new_val)
            current_dec = _to_decimal(current_val)
            changed = new_dec is not None and new_dec != current_dec

            if changed:
                raise HTTPException(403, "Only master can update system_commision and system_reward_percent")
            # unchanged / unparsable -> silently ignore, don't touch the field

        if "admin_id" in update_data and update_data["admin_id"] not in (None, product.admin_id):
            raise HTTPException(403, "Only master can reassign product owner")
        
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
    _reassert_master_rls(db)
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
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin)
):
    if not has_access(admin, "products.edit", db):
        raise HTTPException(403, "Access denied")
    
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    if not is_master(admin):
        if product.admin_id != admin.get("user_id"):
            raise HTTPException(
                status_code=403,
                detail="Not authorized"
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