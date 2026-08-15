from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate
from app.core.security import get_current_user, is_master, is_admin_or_above
from app.core.permissions import has_access

router = APIRouter(prefix="/admin/categories", tags=["Admin Categories"])


def get_admin(user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    if not has_access(user, "products.view"):
        raise HTTPException(status_code=403, detail="Access denied")

    return user


@router.post("/")
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    
    if not has_access(admin, "products.create"):
        raise HTTPException(403, "Access denied")
    
    existing = db.query(Category).filter(Category.name == data.name).first()

    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")

    category = Category(name=data.name)

    db.add(category)
    db.commit()
    db.refresh(category)

    return {
        "success": True,
        "category": {
            "id": category.id,
            "name": category.name
        }
    }


@router.get("/")
def list_categories(
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    categories = db.query(Category).all()

    return [
        {
            "id": c.id,
            "name": c.name
        }
        for c in categories
    ]



@router.put("/{category_id}")
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    
    if not has_access(admin, "products.edit"):
        raise HTTPException(403, "Access denied")
    
    cat = db.query(Category).filter(Category.id == category_id).first()

    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if payload.name is not None:
        cat.name = payload.name

    db.commit()
    db.refresh(cat)

    return {
        "success": True,
        "category": {
            "id": cat.id,
            "name": cat.name
        }
    }

@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin)
):
    if not has_access(admin, "products.delete"):
        raise HTTPException(403, "Access denied")
    cat = db.query(Category).filter(Category.id == category_id).first()

    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(cat)
    db.commit()

    return {
        "success": True,
        "message": "Category deleted",
        "id": category_id
    }