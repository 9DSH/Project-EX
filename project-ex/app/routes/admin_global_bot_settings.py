from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import get_current_user, is_master
from app.models.global_bot_settings import GlobalBotSettings
from app.services.telegram_validation_service import validate_telegram_token


router = APIRouter(
    prefix="/admin/global-bot-settings",
    tags=["Global Bot Settings"],
)


class GlobalBotSettingsUpdate(BaseModel):
    support_bot_token: str | None = None
    main_bot_token: str | None = None


def get_master_user(user=Depends(get_current_user)):
    if not is_master(user):
        raise HTTPException(
            status_code=403,
            detail="Master access required",
        )

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
        "id": s.id,

        # --------------------------------------------------
        # SUPPORT BOT
        # --------------------------------------------------

        "support_bot_token_set": bool(s.support_bot_token),
        "support_bot_token_masked": _mask(s.support_bot_token),
        "support_bot_username": s.support_bot_username,
        "support_last_validated_at": s.support_last_validated_at,
        "support_last_validation_error": s.support_last_validation_error,

        "is_running_support": bool(s.is_running_support),
        "support_last_restart_at": s.support_last_restart_at,
        "support_last_crash_error": s.support_last_crash_error,

        # --------------------------------------------------
        # MAIN BOT
        # --------------------------------------------------

        "main_bot_token_set": bool(s.main_bot_token),
        "main_bot_token_masked": _mask(s.main_bot_token),
        "main_bot_username": s.main_bot_username,
        "main_last_validated_at": s.main_last_validated_at,
        "main_last_validation_error": s.main_last_validation_error,

        "is_running_main": bool(s.is_running_main),
        "main_last_restart_at": s.main_last_restart_at,
        "main_last_crash_error": s.main_last_crash_error,

        # --------------------------------------------------
        # META
        # --------------------------------------------------

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

    has_support = bool(
        payload.support_bot_token
        and payload.support_bot_token.strip()
    )

    has_main = bool(
        payload.main_bot_token
        and payload.main_bot_token.strip()
    )

    if not has_support and not has_main:
        raise HTTPException(
            status_code=400,
            detail="No bot token was provided.",
        )

    # ======================================================
    # SUPPORT BOT
    # ======================================================

    if has_support:
        token = payload.support_bot_token.strip()

        result = await validate_telegram_token(token)

        if not result.valid:

            settings.support_last_validation_error = result.error
            db.commit()

            if result.error_type in {
                "connection",
                "timeout",
            }:
                raise HTTPException(
                    status_code=503,
                    detail={
                        "code": "telegram_unavailable",
                        "message": (
                            "Could not connect to Telegram. "
                            "The token was NOT changed."
                        ),
                        "error": result.error,
                    },
                )

            raise HTTPException(
                status_code=400,
                detail={
                    "code": "invalid_support_token",
                    "message": (
                        "Telegram rejected the support bot token. "
                        "The token was NOT changed."
                    ),
                    "error": result.error,
                },
            )

        # Only update the token after successful validation.
        settings.support_bot_token = token
        settings.support_bot_username = result.bot_username
        settings.support_last_validated_at = datetime.utcnow()
        settings.support_last_validation_error = None

    # ======================================================
    # MAIN BOT
    # ======================================================

    if has_main:
        token = payload.main_bot_token.strip()

        result = await validate_telegram_token(token)

        if not result.valid:

            settings.main_last_validation_error = result.error
            db.commit()

            if result.error_type in {
                "connection",
                "timeout",
            }:
                raise HTTPException(
                    status_code=503,
                    detail={
                        "code": "telegram_unavailable",
                        "message": (
                            "Could not connect to Telegram. "
                            "The token was NOT changed."
                        ),
                        "error": result.error,
                    },
                )

            raise HTTPException(
                status_code=400,
                detail={
                    "code": "invalid_main_token",
                    "message": (
                        "Telegram rejected the main bot token. "
                        "The token was NOT changed."
                    ),
                    "error": result.error,
                },
            )

        # Only update after successful validation.
        settings.main_bot_token = token
        settings.main_bot_username = result.bot_username
        settings.main_last_validated_at = datetime.utcnow()
        settings.main_last_validation_error = None

    settings.updated_by = master.get("user_id")

    db.commit()
    db.refresh(settings)

    return _serialize(settings)