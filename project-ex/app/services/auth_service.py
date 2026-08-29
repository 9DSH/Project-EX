#app.services.auth_service.py
import secrets
import string
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, set_session_master
from app.models.user import User
import json
from app.models.user_balance import UserBalance
from app.core.security import verify_password, create_access_token, hash_password


def login_user(username: str, password: str, telegram_id: str = None):
    db = SessionLocal()
    set_session_master(db)
    try:
        user = db.query(User).filter(User.username == username).first()

        if not user:
            return {"error": "User not found"}

        if not verify_password(password, user.password_hash):
            return {"error": "Wrong password"}

        if user.status != "active":
            return {"error": "Your account is not active. Please contact support."}

        # =========================
        # ✅ TELEGRAM AUTO LINK (CRITICAL)
        # =========================
        if telegram_id:
            existing = db.query(User).filter(User.telegram_id == telegram_id).first()
            if not existing or existing.user_id == user.user_id:
                user.telegram_id = telegram_id
                db.commit()

        return _build_login_response(db, user)
    finally:
        db.close()


def login_by_telegram_id(telegram_id: str):
    """
    Session re-entry for a Telegram user who already linked their account
    once (user.telegram_id is set). No password required — possession of
    that Telegram chat is treated as proof of identity, same trust level
    Telegram itself already gave us to reach the bot in the first place.
    """
    db = SessionLocal()
    set_session_master(db)
    try:
        user = db.query(User).filter(User.telegram_id == str(telegram_id)).first()

        if not user:
            return {"error": "No linked account for this Telegram user"}

        if user.status != "active":
            return {"error": "Your account is not active. Please contact support."}

        return _build_login_response(db, user)
    finally:
        db.close()


def _build_login_response(db, user):
    balances = db.query(UserBalance).filter(
        UserBalance.user_id == user.user_id
    ).all()

    access_points = user.access_points
    if isinstance(access_points, str):
        try:
            access_points = json.loads(access_points)
        except Exception:
            access_points = []
    if access_points is None:
        access_points = []

    token = create_access_token({
        "sub": user.username,
        "role": user.role,
        "user_id": user.user_id,
        "admin_id": user.admin_id,
        "access_points": access_points
    })

    personal_info_complete = bool(user.first_name and user.last_name and user.email and user.phone_number)

    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role,
        "telegram_id": user.telegram_id,
        "user_id": user.user_id,
        "access_points": user.access_points,
        "language": user.language,
        "profile_complete": personal_info_complete,
        "personal_info_complete": personal_info_complete,
        "balances": [
            {
                "currency": b.currency.symbol if b.currency else "UNKNOWN",
                "network": b.network.name if b.network else "MAIN",
                "available": float(b.available_balance),
                "frozen": float(b.frozen_balance)
            }
            for b in balances
        ]
    }

def logout_by_telegram_id(telegram_id: str):
    """Break the auto-login link. User will need username/password next time,
    which re-links telegram_id on successful login (see login_user)."""
    db = SessionLocal()
    set_session_master(db)
    try:
        user = db.query(User).filter(User.telegram_id == str(telegram_id)).first()
        if user:
            user.telegram_id = None
            db.commit()
        return {"success": True}
    finally:
        db.close()

# =========================
# RESET PASSWORD CORE
# =========================
def reset_user_password(
    db: Session,
    user: User,
    new_password: str | None = None,
):
   

    user.password_hash = hash_password(new_password)

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "user_id": user.user_id,
        "username": user.username,
        "new_password": new_password
    }