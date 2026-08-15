#app.services.auth_service.py
import secrets
import string
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.user import User
import json
from app.models.user_balance import UserBalance
from app.core.security import verify_password, create_access_token, hash_password



def login_user(username: str, password: str, telegram_id: str = None):
    db = SessionLocal()

    try:
        user = db.query(User).filter(User.username == username).first()

        if not user:
            return {"error": "User not found"}

        if not verify_password(password, user.password_hash):
            return {"error": "Wrong password"}
        

        # =========================
        # ✅ TELEGRAM AUTO LINK (CRITICAL)
        # =========================
        if telegram_id:
            # avoid duplicate linking
            existing = db.query(User).filter(User.telegram_id == telegram_id).first()

            if not existing or existing.user_id == user.user_id:
                user.telegram_id = telegram_id
                db.commit()
    
            # =========================
        # LOAD BALANCES (NEW STRUCTURE)
        # =========================

        balances = db.query(UserBalance).filter(
            UserBalance.user_id == user.user_id
        ).all()

        access_points = user.access_points

        if isinstance(access_points, str):
            try:
                access_points = json.loads(access_points)
            except:
                access_points = []

        if access_points is None:
            access_points = []

        # =========================
        # TOKEN
        # =========================
        token = create_access_token({
            "sub": user.username,
            "role": user.role,
            "user_id": user.user_id,
            "access_points": access_points
        })
        # =========================
        # RESPONSE
        # =========================


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