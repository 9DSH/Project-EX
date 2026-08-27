from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import os
import re
from datetime import datetime, timedelta
from app.db.database import get_db
from app.core.security import get_current_user, is_admin_or_above, is_master
from app.models.user import TelegramBotSettings
from app.bot.manager.instance_manager import manager as bot_manager

router = APIRouter(prefix="/admin/bot-control", tags=["Bot Control"])

GLOBAL_KINDS = {"global_main", "support"}
LOG_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "logs", "bots"))

def get_admin(user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(403, "Not authorized")
    return user


def get_master(user=Depends(get_current_user)):
    if not is_master(user):
        raise HTTPException(403, "Master access required")
    return user


@router.get("/logs/{admin_id}")
def get_admin_bot_logs(admin_id: int, hours: int = 24, master=Depends(get_master)):
    log_path = os.path.join(LOG_DIR, f"admin_{admin_id}.log")
    if not os.path.exists(log_path):
        return {"lines": [], "message": "No log file found for this bot yet.", "has_timestamps": False}

    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
    except Exception as e:
        return {"lines": [], "message": f"Failed to read log file: {e}", "has_timestamps": False}

    cutoff = datetime.utcnow() - timedelta(hours=hours)
    date_pat = re.compile(r"(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})")

    any_dated = any(date_pat.search(l) for l in all_lines)
    recent = []

    if any_dated:
        for line in all_lines:
            m = date_pat.search(line)
            if not m:
                recent.append(line.rstrip("\n"))
                continue
            try:
                ts = datetime.strptime(f"{m.group(1)} {m.group(2)}", "%Y-%m-%d %H:%M:%S")
                if ts >= cutoff:
                    recent.append(line.rstrip("\n"))
            except Exception:
                recent.append(line.rstrip("\n"))
        recent = recent[-1000:]
    else:
        # No timestamps at all in this log — fall back to raw tail
        recent = [l.rstrip("\n") for l in all_lines[-500:]]

    return {"lines": recent, "has_timestamps": any_dated, "log_path": log_path}


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