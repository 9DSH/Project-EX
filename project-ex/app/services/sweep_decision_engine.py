from app.services.bsc_balance_service import get_usdt_balance
from app.db.database import SessionLocal
from app.models.user_balance import UserBalance
import os

MIN_SWEEP_AMOUNT = float(os.getenv("MIN_SWEEP_AMOUNT", 5))

def should_sweep_user(user, wallet_address: str):
    try:
        balance = get_usdt_balance(wallet_address)
        if balance is None or balance < MIN_SWEEP_AMOUNT:
            return False

        db = SessionLocal()
        frozen = db.query(UserBalance).filter(
            UserBalance.user_id == user.user_id
        ).with_entities(UserBalance.frozen_balance).all()
        db.close()

        if any(float(r.frozen_balance or 0) > 0 for r in frozen):
            return False

        return True
    except Exception:
        return False