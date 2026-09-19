from typing import Optional, Tuple
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.security import is_master
from app.core.permissions import has_access
from app.models.user import User


def can_view_all_admins(admin: dict, service_permission: Optional[str]) -> bool:
    """Master, or any admin individually granted platform.{service}.service."""
    return is_master(admin) or has_access(admin, service_permission)


def resolve_admin_scope(
    admin: dict,
    db: Session,
    admin_filter: Optional[str],
    service_permission: Optional[str],
) -> Tuple[bool, Optional[int]]:
    """
    Resolves the requested admin_filter query param into a query scope.

    Returns (scope_all, scope_admin_id):
      - admin_filter is None or "mine" -> (False, <requester's own user_id>)
      - admin_filter == "all"          -> (True, None)   [requires cross-admin permission]
      - admin_filter == "<user_id>"    -> (False, <id>)  [requires cross-admin permission]

    Anyone can always see their own data ("mine"). Seeing "all" or another
    admin's data requires can_view_all_admins().
    """
    requester_id = admin["user_id"]

    if not admin_filter or admin_filter == "mine":
        return False, requester_id

    if not can_view_all_admins(admin, service_permission):
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