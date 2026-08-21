from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import get_current_user, is_admin_or_above, is_master
from app.models.user import TelegramBotSettings
from app.bot.manager.instance_manager import manager as bot_manager

router = APIRouter(prefix="/admin/bot-control", tags=["Bot Control"])


def get_admin(user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(403, "Not authorized")
    return user


@router.get("/status")
def get_my_bot_status(
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    return bot_manager.get_status(admin_id=admin["user_id"])


@router.post("/start")
def start_my_bot(
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    settings = db.query(TelegramBotSettings).filter(
        TelegramBotSettings.admin_id == admin["user_id"]
    ).first()

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
def stop_my_bot(
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    settings = db.query(TelegramBotSettings).filter(
        TelegramBotSettings.admin_id == admin["user_id"]
    ).first()
    if settings:
        settings.is_active = False
        db.commit()

    return bot_manager.stop_admin_bot(admin["user_id"])


@router.post("/restart")
def restart_my_bot(
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    settings = db.query(TelegramBotSettings).filter(
        TelegramBotSettings.admin_id == admin["user_id"]
    ).first()
    if not settings or not settings.main_bot_token:
        raise HTTPException(400, "No bot token configured.")

    result = bot_manager.restart_admin_bot(admin["user_id"], token=settings.main_bot_token)
    if not result.get("ok"):
        raise HTTPException(502, result.get("error") or "Failed to restart bot")
    return result


# ── MASTER: control/inspect any admin's bot ──

@router.get("/status/{admin_id}")
def get_admin_bot_status(
    admin_id: int,
    admin=Depends(get_admin),
):
    if not is_master(admin):
        raise HTTPException(403, "Master access required")
    return bot_manager.get_status(admin_id=admin_id)


@router.get("/status-all")
def get_all_bot_status(
    admin=Depends(get_admin),
):
    if not is_master(admin):
        raise HTTPException(403, "Master access required")
    return bot_manager.get_status()


@router.post("/restart/{admin_id}")
def master_restart_admin_bot(
    admin_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    if not is_master(admin):
        raise HTTPException(403, "Master access required")

    settings = db.query(TelegramBotSettings).filter(
        TelegramBotSettings.admin_id == admin_id
    ).first()
    if not settings or not settings.main_bot_token:
        raise HTTPException(400, "That admin has no bot token configured.")

    result = bot_manager.restart_admin_bot(admin_id, token=settings.main_bot_token)
    if not result.get("ok"):
        raise HTTPException(502, result.get("error") or "Failed to restart bot")
    return result