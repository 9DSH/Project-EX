# app/routes/admin_telegram_bot_settings.py

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import get_current_user, is_admin_or_above, is_master
from app.models.user import TelegramBotSettings, User
from app.services.telegram_validation_service import validate_telegram_token, set_bot_display_name

router = APIRouter(prefix="/admin/telegram-bot-settings", tags=["Admin Telegram Bot Settings"])

SUPPORTED_LANGUAGES = {"en", "fa"}
GLOBAL_KINDS = {"global_main", "support"}


class TelegramBotSettingsUpdate(BaseModel):
    default_language: str | None = None
    main_bot_token: str | None = None
    is_active: bool | None = None
    enabled_services: list[str] | None = None

    @field_validator("default_language")
    @classmethod
    def validate_default_language(cls, v):
        if v is not None and v not in SUPPORTED_LANGUAGES:
            raise ValueError(f"default_language must be one of {sorted(SUPPORTED_LANGUAGES)}")
        return v


class DisplayNameUpdate(BaseModel):
    display_name: str


def get_admin(user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    return user


def get_master(user=Depends(get_current_user)):
    if not is_master(user):
        raise HTTPException(status_code=403, detail="Master access required")
    return user


def _get_or_create(admin_id: int, bot_kind: str, db: Session) -> TelegramBotSettings:
    settings = db.query(TelegramBotSettings).filter(
        TelegramBotSettings.admin_id == admin_id,
        TelegramBotSettings.bot_kind == bot_kind,
    ).first()
    if not settings:
        settings = TelegramBotSettings(admin_id=admin_id, bot_kind=bot_kind, default_language="en")
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _mask(token: str | None) -> str | None:
    if not token:
        return None
    if len(token) <= 8:
        return "•" * len(token)
    return f"{token[:4]}{'•' * 8}{token[-4:]}"


def _serialize(settings: TelegramBotSettings):
    return {
        "admin_id": settings.admin_id,
        "bot_kind": settings.bot_kind,
        "default_language": settings.default_language,
        "main_bot_token_set": bool(settings.main_bot_token),
        "main_bot_token_masked": _mask(settings.main_bot_token),
        "is_active": settings.is_active,
        "bot_username": settings.bot_username,
        "display_name": settings.display_name,
        "last_validated_at": settings.last_validated_at,
        "last_validation_error": settings.last_validation_error,
        "is_running": settings.is_running,
        "last_restart_at": settings.last_restart_at,
        "last_crash_error": settings.last_crash_error,
        "enabled_services": settings.enabled_services,
    }


async def _apply_update(settings: TelegramBotSettings, payload: TelegramBotSettingsUpdate, db: Session):
    if payload.default_language is not None:
        settings.default_language = payload.default_language
    if payload.is_active is not None:
        settings.is_active = payload.is_active

    if payload.main_bot_token is not None and payload.main_bot_token.strip():
        result = await validate_telegram_token(payload.main_bot_token)
        if not result.valid:
            settings.last_validation_error = result.error
            db.commit()
            raise HTTPException(400, f"Invalid bot token: {result.error}")
        settings.main_bot_token = payload.main_bot_token.strip()
        settings.bot_username = result.bot_username
        settings.last_validated_at = datetime.utcnow()
        settings.last_validation_error = None

    if payload.enabled_services is not None:
        settings.enabled_services = payload.enabled_services

    db.commit()
    db.refresh(settings)
    return settings


# ─────────────────────────────────────────────
# MY BOT (any admin, including master's own personal bot)
# ─────────────────────────────────────────────

@router.get("/")
def get_my_bot_settings(db: Session = Depends(get_db), admin=Depends(get_admin)):
    settings = _get_or_create(admin.get("user_id"), "admin", db)
    return _serialize(settings)


@router.put("/")
async def update_my_bot_settings(
    payload: TelegramBotSettingsUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    settings = _get_or_create(admin.get("user_id"), "admin", db)
    settings = await _apply_update(settings, payload, db)
    return _serialize(settings)


@router.post("/set-display-name")
async def set_my_display_name(
    payload: DisplayNameUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    settings = _get_or_create(admin.get("user_id"), "admin", db)
    if not settings.main_bot_token:
        raise HTTPException(400, "Connect a bot token before setting a display name")
    result = await set_bot_display_name(settings.main_bot_token, payload.display_name.strip())
    if not result.valid:
        raise HTTPException(400, result.error or "Failed to set display name")
    settings.display_name = payload.display_name.strip()
    db.commit()
    db.refresh(settings)
    return _serialize(settings)


# ─────────────────────────────────────────────
# MASTER: list every admin's personal bot (for "All Admin Bots" tab)
# ─────────────────────────────────────────────

@router.get("/all")
def list_all_admin_bot_settings(db: Session = Depends(get_db), master=Depends(get_master)):
    admins = db.query(User).filter(User.role.in_(["admin", "master"])).all()
    settings_map = {
        s.admin_id: s
        for s in db.query(TelegramBotSettings).filter(TelegramBotSettings.bot_kind == "admin").all()
    }

    result = []
    for u in admins:
        s = settings_map.get(u.user_id)
        result.append({
            "admin_id": u.user_id,
            "username": u.username,
            "role": u.role,
            "default_language": s.default_language if s else "en",
            "main_bot_token_set": bool(s.main_bot_token) if s else False,
            "bot_username": s.bot_username if s else None,
            "display_name": s.display_name if s else None,
            "is_active": s.is_active if s else False,
            "last_validated_at": s.last_validated_at if s else None,
            "last_validation_error": s.last_validation_error if s else None,
            "is_running": s.is_running if s else False,
            "last_restart_at": s.last_restart_at if s else None,
            "last_crash_error": s.last_crash_error if s else None,
        })
    return result


# ─────────────────────────────────────────────
# MASTER: edit any admin's personal bot on their behalf
# ─────────────────────────────────────────────

@router.put("/{admin_id}")
async def master_update_admin_bot_settings(
    admin_id: int,
    payload: TelegramBotSettingsUpdate,
    db: Session = Depends(get_db),
    master=Depends(get_master),
):
    target = db.query(User).filter(User.user_id == admin_id).first()
    if not target:
        raise HTTPException(404, "Admin not found")
    settings = _get_or_create(admin_id, "admin", db)
    settings = await _apply_update(settings, payload, db)
    return _serialize(settings)


@router.post("/{admin_id}/set-display-name")
async def master_set_admin_display_name(
    admin_id: int,
    payload: DisplayNameUpdate,
    db: Session = Depends(get_db),
    master=Depends(get_master),
):
    settings = _get_or_create(admin_id, "admin", db)
    if not settings.main_bot_token:
        raise HTTPException(400, "That admin has no bot token configured")
    result = await set_bot_display_name(settings.main_bot_token, payload.display_name.strip())
    if not result.valid:
        raise HTTPException(400, result.error or "Failed to set display name")
    settings.display_name = payload.display_name.strip()
    db.commit()
    db.refresh(settings)
    return _serialize(settings)


# ─────────────────────────────────────────────
# MASTER: global bots (global_main / support) — replaces GlobalBotSettings
# ─────────────────────────────────────────────

@router.get("/global/{kind}")
def get_global_bot_settings(kind: str, db: Session = Depends(get_db), master=Depends(get_master)):
    if kind not in GLOBAL_KINDS:
        raise HTTPException(400, f"kind must be one of {sorted(GLOBAL_KINDS)}")
    settings = _get_or_create(master.get("user_id"), kind, db)
    return _serialize(settings)


@router.put("/global/{kind}")
async def update_global_bot_settings(
    kind: str,
    payload: TelegramBotSettingsUpdate,
    db: Session = Depends(get_db),
    master=Depends(get_master),
):
    if kind not in GLOBAL_KINDS:
        raise HTTPException(400, f"kind must be one of {sorted(GLOBAL_KINDS)}")
    settings = _get_or_create(master.get("user_id"), kind, db)
    settings = await _apply_update(settings, payload, db)
    return _serialize(settings)


@router.post("/global/{kind}/set-display-name")
async def set_global_bot_display_name(
    kind: str,
    payload: DisplayNameUpdate,
    db: Session = Depends(get_db),
    master=Depends(get_master),
):
    if kind not in GLOBAL_KINDS:
        raise HTTPException(400, f"kind must be one of {sorted(GLOBAL_KINDS)}")
    settings = _get_or_create(master.get("user_id"), kind, db)
    if not settings.main_bot_token:
        raise HTTPException(400, "Connect a bot token before setting a display name")
    result = await set_bot_display_name(settings.main_bot_token, payload.display_name.strip())
    if not result.valid:
        raise HTTPException(400, result.error or "Failed to set display name")
    settings.display_name = payload.display_name.strip()
    db.commit()
    db.refresh(settings)
    return _serialize(settings)