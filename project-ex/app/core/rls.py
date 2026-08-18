from sqlalchemy import text
from fastapi import Depends

from app.db.database import SessionLocal
from app.core.security import get_current_user


def _resolve_scope(user: dict) -> tuple[bool, int | None]:
    """
    Returns (is_master, current_admin_id) for the authenticated caller.
      - master        -> (True, None)
      - admin         -> (False, their own user_id)
      - end-user      -> (False, their owning admin's user_id, i.e. users.admin_id)
    """
    role = user.get("role")
    is_master = role == "master"
    if is_master:
        return True, None
    if role == "user":
        return False, user.get("admin_id")
    # admin acting on their own tenant
    return False, user.get("user_id")


def get_db_rls(user: dict = Depends(get_current_user)):
    """
    Drop-in replacement for `get_db` on any route that also depends on
    get_current_user. Sets the Postgres session variables RLS policies read,
    scoped to the current transaction (SET LOCAL), then yields the session.
    """
    db = SessionLocal()
    try:
        is_master, admin_id = _resolve_scope(user)
        db.execute(text("SET LOCAL app.is_master = :v"), {"v": "true" if is_master else "false"})
        db.execute(
            text("SET LOCAL app.current_admin_id = :v"),
            {"v": str(admin_id) if admin_id is not None else ""},
        )
        yield db
    finally:
        db.close()


def get_db_master():
    """
    For unauthenticated / signature-authenticated entry points (webhooks)
    that legitimately need platform-wide row visibility. SET LOCAL is fine
    here since these are single-transaction request-scoped sessions.
    """
    db = SessionLocal()
    try:
        db.execute(text("SET LOCAL app.is_master = 'true'"))
        yield db
    finally:
        db.close()