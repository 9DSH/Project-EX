from typing import Optional, Tuple
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.security import is_master
from app.core.permissions import has_access
from app.models.user import User


def can_view_all_admins(admin: dict, service_permission: Optional[str], db: Session = None) -> bool:
    """Master, or any admin individually granted the given platform permission."""
    return is_master(admin) or has_access(admin, service_permission, db)


def resolve_admin_scope(
    admin: dict,
    db: Session,
    admin_filter: Optional[str],
    service_permission: Optional[str],
) -> Tuple[bool, Optional[int]]:
    requester_id = admin["user_id"]

    if not admin_filter or admin_filter == "mine":
        return False, requester_id

    if not can_view_all_admins(admin, service_permission, db):
        raise HTTPException(403, "Not authorized to filter by other admins")

    if admin_filter == "all":
        return True, None

    try:
        target_id = int(admin_filter)
    except ValueError:
        raise HTTPException(400, "Invalid admin filter")

    target = db.query(User).filter(User.user_id == target_id).first()
    if not target:
        raise HTTPException(404, "Admin not found")

    return False, target_id


def resolve_own_scope(
    admin: dict,
    db: Session,
    admin_filter: Optional[str],
) -> Tuple[bool, Optional[int]]:
    """
    Orders / failed sweeps / analysis: master may filter across admins;
    every other admin is strictly limited to their own data, regardless
    of any platform.* permission.
    """
    if is_master(admin):
        return resolve_admin_scope(admin, db, admin_filter, None)
    return False, admin["user_id"]