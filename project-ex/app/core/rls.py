from sqlalchemy import text
from fastapi import Depends
from app.core.bot_service_auth import get_bot_service_context
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
    db = SessionLocal()
    try:
        is_master, admin_id = _resolve_scope(user)
        db.execute(text("SET LOCAL app.is_master = :v"), {"v": "true" if is_master else "false"})
        db.execute(
            text("SET LOCAL app.current_admin_id = :v"),
            {"v": str(admin_id) if admin_id is not None else ""},
        )
        db.execute(text("SET LOCAL app.is_global_bot = 'false'"))
        yield db
    finally:
        db.close()


def get_db_master():
    """
    For unauthenticated / signature-authenticated entry points (webhooks)
    that legitimately need platform-wide row visibility. Uses session-level
    SET (not SET LOCAL) because callers may commit multiple times within
    the same request (e.g. bootstrap-master does insert -> commit -> refresh),
    and SET LOCAL is wiped after the first commit.
    """
    db = SessionLocal()
    try:
        db.execute(text("SET app.is_master = 'true'"))
        db.execute(text("SET app.is_global_bot = 'false'"))
        yield db
    finally:
        db.close()

def get_db_rls_bot_context(ctx: dict = Depends(get_bot_service_context)):
    """
    DB session for /bot-context/* menu endpoints, driven by the bot
    service context instead of a user JWT.
    """
    db = SessionLocal()
    try:
        db.execute(text("SET LOCAL app.is_master = 'false'"))
        db.execute(
            text("SET LOCAL app.is_global_bot = :v"),
            {"v": "true" if ctx["is_global"] else "false"},
        )
        db.execute(
            text("SET LOCAL app.current_admin_id = :v"),
            {"v": str(ctx["admin_id"]) if ctx["admin_id"] is not None else ""},
        )
        yield db
    finally:
        db.close()