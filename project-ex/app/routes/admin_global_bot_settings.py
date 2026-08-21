from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import get_current_user, is_master
from app.models.global_bot_settings import GlobalBotSettings
from app.services.telegram_validation_service import validate_telegram_token

router = APIRouter(prefix="/admin/global-bot-settings", tags=["Global Bot Settings"])


class GlobalBotSettingsUpdate(BaseModel):
    support_bot_token: str | None = None
    main_bot_token: str | None = None


def get_master_user(user=Depends(get_current_user)):
    if not is_master(user):
        raise HTTPException(403, "Master access required")
    return user


def _get_or_create(db: Session) -> GlobalBotSettings:
    settings = db.query(GlobalBotSettings).first()
    if not settings:
        settings = GlobalBotSettings()
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


def _serialize(s: GlobalBotSettings):
    return {
        "support_bot_token_set": bool(s.support_bot_token),
        "support_bot_token_masked": _mask(s.support_bot_token),
        "support_bot_username": s.support_bot_username,
        "support_last_validated_at": s.support_last_validated_at,
        "support_last_validation_error": s.support_last_validation_error,

        "main_bot_token_set": bool(s.main_bot_token),
        "main_bot_token_masked": _mask(s.main_bot_token),
        "main_bot_username": s.main_bot_username,
        "main_last_validated_at": s.main_last_validated_at,
        "main_last_validation_error": s.main_last_validation_error,

        "updated_by": s.updated_by,
        "updated_at": s.updated_at,
    }


@router.get("/")
def get_global_bot_settings(
    db: Session = Depends(get_db),
    master=Depends(get_master_user),
):
    return _serialize(_get_or_create(db))


@router.put("/")
async def update_global_bot_settings(
    payload: GlobalBotSettingsUpdate,
    db: Session = Depends(get_db),
    master=Depends(get_master_user),
):
    settings = _get_or_create(db)

    if payload.support_bot_token is not None and payload.support_bot_token.strip():
        result = await validate_telegram_token(payload.support_bot_token)
        if not result.valid:
            settings.support_last_validation_error = result.error
            db.commit()
            raise HTTPException(400, f"Invalid support bot token: {result.error}")
        settings.support_bot_token = payload.support_bot_token.strip()
        settings.support_bot_username = result.bot_username
        settings.support_last_validated_at = datetime.utcnow()
        settings.support_last_validation_error = None

    if payload.main_bot_token is not None and payload.main_bot_token.strip():
        result = await validate_telegram_token(payload.main_bot_token)
        if not result.valid:
            settings.main_last_validation_error = result.error
            db.commit()
            raise HTTPException(400, f"Invalid main bot token: {result.error}")
        settings.main_bot_token = payload.main_bot_token.strip()
        settings.main_bot_username = result.bot_username
        settings.main_last_validated_at = datetime.utcnow()
        settings.main_last_validation_error = None

    settings.updated_by = master.get("user_id")
    db.commit()
    db.refresh(settings)
    return _serialize(settings)