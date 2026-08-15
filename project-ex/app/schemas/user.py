from pydantic import BaseModel
from typing import Optional, List

class UserCreate(BaseModel):
    username: str
    password: str

    telegram_id: Optional[str] = None

    role: str = "user"

    access_points: List[str] = []

    # Optional override (master only). Defaults to the creating admin's user_id.
    admin_id: Optional[int] = None


class UserOut(BaseModel):
    user_id: int
    username: str
    role: Optional[str] = None
    status: Optional[str] = None
    admin_id: Optional[int] = None

    class Config:
        from_attributes = True
