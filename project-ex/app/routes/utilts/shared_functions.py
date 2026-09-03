from app.models.user import User , TelegramBotSettings
from sqlalchemy.orm import Session
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
