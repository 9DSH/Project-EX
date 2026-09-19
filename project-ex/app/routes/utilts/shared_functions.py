from app.models.user import User , TelegramBotSettings
from sqlalchemy.orm import Session
from sqlalchemy import  text
from typing import Optional, Dict, Any

ADMIN_ROLES = ("admin", "master")  

def get_admin_username(db: Session, admin_id: Optional[int]) -> Optional[str]:
    """
    Resolve an admin_id (or master_id) to its username.
    Only matches users whose role is admin/master.
    Returns None if admin_id is missing or no matching admin/master is found.
    """
    if not admin_id:
        return None

    user_row = (
        db.query(User)
        .filter(User.user_id == admin_id, User.role.in_(ADMIN_ROLES))
        .first()
    )
    return user_row.username if user_row else None


def get_admin_usernames(db: Session, admin_ids: list[int]) -> Dict[int, str]:
    """
    Batch-resolve multiple admin_ids/master_ids to usernames in a single query.
    Only matches users whose role is admin/master.
    Returns a dict {user_id: username}.
    """
    ids = list({aid for aid in admin_ids if aid})
    if not ids:
        return {}

    rows = (
        db.query(User.user_id, User.username)
        .filter(User.user_id.in_(ids), User.role.in_(ADMIN_ROLES))
        .all()
    )
    return {row.user_id: row.username for row in rows}


def _admin_telegram_displayName_map(db: Session, admin_ids: set[int]):
    admin_ids = {a for a in admin_ids if a}
    if not admin_ids:
        return {}

    usernames = {u.user_id: u.username for u in db.query(User).filter(User.user_id.in_(admin_ids)).all()}

    display_rows = db.query(TelegramBotSettings).filter(
        TelegramBotSettings.admin_id.in_(admin_ids),
        TelegramBotSettings.bot_kind.in_(["admin", "global_main"]),
        TelegramBotSettings.display_name.isnot(None),
        TelegramBotSettings.display_name != "",
    ).all()
    display_map = {r.admin_id: r.display_name for r in display_rows}

    return {aid: display_map.get(aid, usernames.get(aid)) for aid in admin_ids}

def _reassert_master_rls(db: Session):
    """
    Several helper functions (sync_master_grants, get_or_create_wallet_for_pair,
    enroll_free_plan_on_signup, grant_access, etc.) call db.commit() internally.
    Since app.is_master / app.current_admin_id are SET LOCAL (transaction-scoped),
    any internal commit wipes them — and every table this touches has
    FORCE ROW LEVEL SECURITY, so subsequent writes in the same request get
    silently rejected. Call this after any such helper, before issuing more
    writes in the same request.
    """
    db.execute(text("SET LOCAL app.is_master = 'true'"))
    db.execute(text("SET LOCAL app.current_admin_id = ''"))
