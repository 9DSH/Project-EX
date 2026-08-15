from app.db.database import SessionLocal

from app.models.user import User
from app.models.user_balance import UserBalance
from app.models.currency import Currency

from app.core.security import hash_password, verify_password

import uuid


# =========================
# CREATE USER
# =========================
def create_user(
    username: str,
    password: str,
    telegram_id: str = None,
    role: str = "user"
):
    db = SessionLocal()

    try:
        existing = db.query(User).filter(
            User.username == username
        ).first()

        if existing:
            return {"error": "User already exists"}

        # =========================
        # CREATE USER
        # =========================
        new_user = User(
            username=username,
            password_hash=hash_password(password),
            telegram_id=telegram_id,
            account_id=str(uuid.uuid4()),
            status="active",
            role=role
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # =========================
        # OPTIONAL DEFAULT BALANCES
        # =========================

        default_assets = db.query(Currency).filter(
            Currency.symbol.in_(["USDT", "IRT"])
        ).all()

        for asset in default_assets:
            balance = UserBalance(
                user_id=new_user.user_id,
                currency_id=asset.id,
                available_balance=0.0,
                frozen_balance=0.0
            )

            db.add(balance)

        db.commit()

        return {
            "success": True,
            "id": new_user.user_id,
            "username": new_user.username,
            "role": new_user.role
        }

    except Exception as e:
        db.rollback()

        return {
            "error": str(e)
        }

    finally:
        db.close()


# =========================
# LOGIN USER
# =========================
def login_user(db, username: str, password: str):

    user = db.query(User).filter(
        User.username == username
    ).first()

    if not user:
        return {
            "success": False,
            "message": "User not found"
        }

    if not verify_password(password, user.password_hash):
        return {
            "success": False,
            "message": "Wrong password"
        }

    # =========================
    # GET USER BALANCES
    # =========================
    balances = db.query(UserBalance).filter(
        UserBalance.user_id == user.user_id
    ).all()

    balance_data = []

    for b in balances:

        currency = db.query(Currency).filter(
            Currency.id == b.currency_id
        ).first()

        balance_data.append({
            "currency": currency.symbol if currency else "UNKNOWN",
            "available": b.available_balance,
            "frozen": b.frozen_balance
        })

    return {
        "success": True,
        "username": user.username,
        "balances": balance_data
    }