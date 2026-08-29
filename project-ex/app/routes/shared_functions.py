
from sqlalchemy.orm import Session
from app.models.user import User , TelegramBotSettings


def _admin_username_map(db: Session, admin_ids: set[int]):
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
