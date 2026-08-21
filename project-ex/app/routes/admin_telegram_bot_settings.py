# app/routes/admin_telegram_bot_settings.py

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import get_current_user, is_admin_or_above
from app.models.user import TelegramBotSettings
from app.services.telegram_validation_service import validate_telegram_token

router = APIRouter(prefix="/admin/telegram-bot-settings", tags=["Admin Telegram Bot Settings"])

SUPPORTED_LANGUAGES = {"en", "fa"}


class TelegramBotSettingsUpdate(BaseModel):
    default_language: str | None = None
    main_bot_token: str | None = None
    is_active: bool | None = None

    @field_validator("default_language")
    @classmethod
    def validate_default_language(cls, v):
        if v is not None and v not in SUPPORTED_LANGUAGES:
            raise ValueError(f"default_language must be one of {sorted(SUPPORTED_LANGUAGES)}")
        return v


def get_admin(user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    return user


def _get_or_create_settings(admin_id: int, db: Session) -> TelegramBotSettings:
    settings = db.query(TelegramBotSettings).filter(
        TelegramBotSettings.admin_id == admin_id
    ).first()
    if not settings:
        settings = TelegramBotSettings(admin_id=admin_id, default_language="en")
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _serialize(settings: TelegramBotSettings):
    return {
        "default_language": settings.default_language,
        "main_bot_token_set": bool(settings.main_bot_token),
        "main_bot_token_masked": _mask(settings.main_bot_token),
        "is_active": settings.is_active,
        "bot_username": settings.bot_username,
        "last_validated_at": settings.last_validated_at,
        "last_validation_error": settings.last_validation_error,
    }


def _mask(token: str | None) -> str | None:
    if not token:
        return None
    if len(token) <= 8:
        return "•" * len(token)
    return f"{token[:4]}{'•' * 8}{token[-4:]}"


@router.get("/")
def get_telegram_bot_settings(
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    settings = _get_or_create_settings(admin.get("user_id"), db)
    return _serialize(settings)


@router.put("/")
async def update_telegram_bot_settings(
    payload: TelegramBotSettingsUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin),
):
    settings = _get_or_create_settings(admin.get("user_id"), db)

    if payload.default_language is not None:
        settings.default_language = payload.default_language

    if payload.is_active is not None:
        settings.is_active = payload.is_active

    # Only re-validate if a new, non-empty token is actually being set.
    if payload.main_bot_token is not None and payload.main_bot_token.strip():
        result = await validate_telegram_token(payload.main_bot_token)

        if not result.valid:
            settings.last_validation_error = result.error
            db.commit()
            raise HTTPException(400, f"Invalid bot token: {result.error}")

        # Success — overwrite token + cached metadata. Previous good token
        # is only replaced once the new one is confirmed working.
        settings.main_bot_token = payload.main_bot_token.strip()
        settings.bot_username = result.bot_username
        settings.last_validated_at = datetime.utcnow()
        settings.last_validation_error = None

    db.commit()
    db.refresh(settings)
    return _serialize(settings)