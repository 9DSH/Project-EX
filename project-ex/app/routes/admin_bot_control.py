from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import get_current_user, is_admin_or_above, is_master
from app.models.user import TelegramBotSettings
from app.bot.manager.instance_manager import manager as bot_manager

router = APIRouter(prefix="/admin/bot-control", tags=["Bot Control"])

GLOBAL_KINDS = {"global_main", "support"}


def get_admin(user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(403, "Not authorized")
    return user


def get_master(user=Depends(get_current_user)):
    if not is_master(user):
        raise HTTPException(403, "Master access required")
    return user


def _get_settings(admin_id: int, bot_kind: str, db: Session):
    return db.query(TelegramBotSettings).filter(
        TelegramBotSettings.admin_id == admin_id,
        TelegramBotSettings.bot_kind == bot_kind,
    ).first()


# ─────────────────────────────────────────────
# ADMIN'S OWN PERSONAL BOT
# ─────────────────────────────────────────────

@router.get("/status")
def get_my_bot_status(admin=Depends(get_admin)):
    return bot_manager.get_status(admin_id=admin["user_id"])


@router.post("/start")
def start_my_bot(db: Session = Depends(get_db), admin=Depends(get_admin)):
    settings = _get_settings(admin["user_id"], "admin", db)
    if not settings or not settings.main_bot_token:
        raise HTTPException(400, "No bot token configured. Save a token first.")

    if not settings.is_active:
        settings.is_active = True
        db.commit()

    result = bot_manager.start_admin_bot(admin["user_id"], settings.main_bot_token)
    if not result.get("ok"):
        raise HTTPException(502, result.get("error") or "Failed to start bot")
    return result


@router.post("/stop")
def stop_my_bot(db: Session = Depends(get_db), admin=Depends(get_admin)):
    settings = _get_settings(admin["user_id"], "admin", db)
    if settings:
        settings.is_active = False
        db.commit()
    return bot_manager.stop_admin_bot(admin["user_id"])


@router.post("/restart")
def restart_my_bot(db: Session = Depends(get_db), admin=Depends(get_admin)):
    settings = _get_settings(admin["user_id"], "admin", db)
    if not settings or not settings.main_bot_token:
        raise HTTPException(400, "No bot token configured.")

    result = bot_manager.restart_admin_bot(admin["user_id"], token=settings.main_bot_token)
    if not result.get("ok"):
        raise HTTPException(502, result.get("error") or "Failed to restart bot")
    return result


# ─────────────────────────────────────────────
# MASTER: control any admin's personal bot
# ─────────────────────────────────────────────

@router.get("/status/{admin_id}")
def get_admin_bot_status(admin_id: int, master=Depends(get_master)):
    return bot_manager.get_status(admin_id=admin_id)


@router.get("/status-all")
def get_all_bot_status(master=Depends(get_master)):
    return bot_manager.get_status()


@router.post("/restart/{admin_id}")
def master_restart_admin_bot(admin_id: int, db: Session = Depends(get_db), master=Depends(get_master)):
    settings = _get_settings(admin_id, "admin", db)
    if not settings or not settings.main_bot_token:
        raise HTTPException(400, "That admin has no bot token configured.")

    result = bot_manager.restart_admin_bot(admin_id, token=settings.main_bot_token)
    if not result.get("ok"):
        raise HTTPException(502, result.get("error") or "Failed to restart bot")
    return result


@router.post("/stop/{admin_id}")
def master_stop_admin_bot(admin_id: int, db: Session = Depends(get_db), master=Depends(get_master)):
    settings = _get_settings(admin_id, "admin", db)
    if settings:
        settings.is_active = False
        db.commit()
    return bot_manager.stop_admin_bot(admin_id)


# ─────────────────────────────────────────────
# MASTER: global bots (global_main / support) — master's own rows
# ─────────────────────────────────────────────

@router.get("/global/{kind}/status")
def get_global_bot_status(kind: str, master=Depends(get_master)):
    if kind not in GLOBAL_KINDS:
        raise HTTPException(400, "Invalid kind")
    return bot_manager.get_global_status(kind)


@router.post("/global/{kind}/restart")
def restart_global_bot(kind: str, db: Session = Depends(get_db), master=Depends(get_master)):
    if kind not in GLOBAL_KINDS:
        raise HTTPException(400, "Invalid kind")

    settings = _get_settings(master["user_id"], kind, db)
    if not settings or not settings.main_bot_token:
        raise HTTPException(400, "No bot token configured for this global bot.")

    if not settings.is_active:
        settings.is_active = True
        db.commit()

    result = bot_manager.restart_global_bot(kind, settings.main_bot_token, master["user_id"])
    if not result.get("ok"):
        raise HTTPException(502, result.get("error") or "Failed to restart bot")
    return result


@router.post("/global/{kind}/stop")
def stop_global_bot(kind: str, db: Session = Depends(get_db), master=Depends(get_master)):
    if kind not in GLOBAL_KINDS:
        raise HTTPException(400, "Invalid kind")

    settings = _get_settings(master["user_id"], kind, db)
    if settings:
        settings.is_active = False
        db.commit()

    return bot_manager.stop_global_bot(kind)