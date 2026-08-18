# app/routes/admin_telegram_bot_settings.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from app.core.rls import get_db_rls
from app.core.security import get_current_user, is_admin_or_above
from app.models.user import TelegramBotSettings

router = APIRouter(prefix="/admin/telegram-bot-settings", tags=["Admin Telegram Bot Settings"])

SUPPORTED_LANGUAGES = {"en", "fa"}


class TelegramBotSettingsUpdate(BaseModel):
    default_language: str

    @field_validator("default_language")
    @classmethod
    def validate_default_language(cls, v):
        if v not in SUPPORTED_LANGUAGES:
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


@router.get("/")
def get_telegram_bot_settings(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    settings = _get_or_create_settings(admin.get("user_id"), db)
    return {"default_language": settings.default_language}


@router.put("/")
def update_telegram_bot_settings(
    payload: TelegramBotSettingsUpdate,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    settings = _get_or_create_settings(admin.get("user_id"), db)
    settings.default_language = payload.default_language
    db.commit()
    db.refresh(settings)
    return {"default_language": settings.default_language}