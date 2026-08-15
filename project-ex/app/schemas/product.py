from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class ProductCreate(BaseModel):
    name: str
    product_type: str
    plan: Optional[str] = None
    price: float
    discount_percent: Optional[float] = None
    currency: str
    network: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    validity_days: Optional[int] = None
    validity_hours: Optional[int] = None
    data_volume_gb: Optional[float] = None
    extra_data: Optional[Dict[str, Any]] = None
    is_active: bool
    is_recurring: Optional[bool] = None
    stock: Optional[int] = None
    is_featured: Optional[bool] = None
    icon_path: str | None = None
    system_reward_percent: Optional[float] = None
    system_commision: Optional[float] = None
    admin_id: Optional[int] = None
    approval_status: str = None
    required_user_data: Optional[Dict[str, Any]] = {}
    approved_by: Optional[str] = None

    approved_at: Optional[datetime] = None

    rejection_reason: Optional[str] = None


class ProductOut(BaseModel):
    id: int
    name: str
    product_type: str
    plan: Optional[str]
    price: float
    discount_percent: Optional[float]
    currency: str
    network: Optional[str]
    description: Optional[str]
    validity_days: Optional[int]
    data_volume_gb: Optional[float]
    is_active: bool
    is_recurring: Optional[bool] = None
    stock: Optional[int] = None
    is_featured: Optional[bool] = None
    category_id: Optional[int]
    extra_data: Optional[Dict[str, Any]] 
    icon_path: str | None = None
    admin_id: Optional[int] = None
    required_user_data: Optional[Dict[str, Any]]
    approval_status: str

    approved_by: Optional[str]

    approved_at: Optional[datetime]

    rejection_reason: Optional[str]

    system_reward_percent: Optional[float]

    system_commision: Optional[float]

    class Config:
        from_attributes = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    product_type: Optional[str] = None
    plan: Optional[str] = None
    price: Optional[float] = None
    discount_percent: Optional[float] = None
    currency: Optional[str] = None
    network: Optional[str] = None
    description: Optional[str] = None
    validity_days: Optional[int] = None
    validity_hours: Optional[int] = None
    data_volume_gb: Optional[float] = None
    extra_data: Optional[Dict[str, Any]] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_recurring: Optional[bool] = None
    stock: Optional[int] = None
    is_featured: Optional[bool] = None
    icon_path: Optional[str] = None
    system_reward_percent: Optional[float] = None
    system_commision: Optional[float] = None
    admin_id: Optional[int] = None
    approval_status: str = None
    required_user_data: Optional[Dict[str, Any]]
    approved_by: Optional[str] = None

    approved_at: Optional[datetime] = None

    rejection_reason: Optional[str] = None

 



