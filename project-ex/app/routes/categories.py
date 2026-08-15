from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.category import Category
from app.schemas.category import CategoryOut
router = APIRouter(prefix="/categories", tags=["Categories"])



@router.get("/", response_model=list[CategoryOut])
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).all()
    return categories

