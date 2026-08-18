#app/routes/blockchain_webhook.py
from fastapi import APIRouter, Request, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.core.rls import get_db_master
import hmac
import hashlib
import json
from app.services.sweep_service import sweep_to_hot_wallet
from app.db.database import get_db
from app.models.user import User
from app.models.transaction import Transaction
from app.models.currency import Currency
from app.models.user_balance import UserBalance
from app.models.network import Network
from app.routes.wallet import credit_user
from app.core.config import WEBHOOK_SECRET

router = APIRouter(prefix="/webhook", tags=["Secure Webhook"])

MIN_CONFIRMATIONS = 12


# -------------------------
# SIGNATURE CHECK
# -------------------------
def verify_signature(raw_body: bytes, signature: str):
    if not signature:
        return False

    computed = hmac.new(
        WEBHOOK_SECRET.encode(),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(computed, signature)


# -------------------------
# BSC WEBHOOK (SECURED)
# -------------------------
@router.post("/bsc")
async def bsc_webhook(
    request: Request,
    db: Session = Depends(get_db_master),
    x_signature: str = Header(None)
):

    raw_body = await request.body()

    # -------------------------
    # VERIFY SIGNATURE
    # -------------------------
    if not verify_signature(raw_body, x_signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    data = json.loads(raw_body)

    print("SECURE WEBHOOK RECEIVED:", data)

    tx_id = data.get("txId")
    amount = data.get("amount")
    to_address = data.get("to")
    confirmations = data.get("confirmations", 0)

    # -------------------------
    # VALIDATION
    # -------------------------
    if not tx_id or not amount or not to_address:
        raise HTTPException(status_code=400, detail="Invalid payload")

    if confirmations < MIN_CONFIRMATIONS:
        return {"status": "pending"}

    # -------------------------
    # IDENTITY CHECK (REPLAY PROTECTION)
    # -------------------------
    existing = db.query(Transaction).filter(
        Transaction.tx_hash == tx_id
    ).first()

    if existing:
        return {"status": "duplicate_ignored"}

    # -------------------------
    # FIND USER (via UserWallet - single source of truth for deposit addresses)
    # -------------------------
    from app.models.user import UserWallet

    user_wallet = db.query(UserWallet).filter(
        UserWallet.address == to_address
    ).first()

    if not user_wallet:
        return {"status": "wallet_not_found"}

    user = db.query(User).filter(User.user_id == user_wallet.user_id).first()

    if not user:
        return {"status": "wallet_not_found"}

    # -------------------------
    # CREDIT USER (SINGLE SOURCE OF TRUTH)
    # -------------------------
    currency = db.query(Currency).filter(Currency.id == user_wallet.currency_id).first()
    network  = db.query(Network).filter(Network.id == user_wallet.network_id).first()


    if not currency or not network:
        raise HTTPException(500, "USDT/BSC not configured in DB")

    crypto_balance = credit_user(
        db=db,
        user_id=user.user_id,
        currency_id=currency.id,
        network_id=network.id,
        amount=float(amount),
        tx_hash=tx_id,
        wallet_address=to_address,
        confirmations=confirmations,
    )

    # flag for sweep
    balance_row = db.query(UserBalance).filter(
        UserBalance.user_id == user.user_id,
        UserBalance.currency_id == currency.id,
        UserBalance.network_id == network.id,
    ).first()
    if balance_row:
        balance_row.needs_sweep = True
        db.commit()

    sweep_to_hot_wallet(db)

    return {
        "status": "success",
        "user_id": user.user_id,
        "amount": amount,
        "new_balance": crypto_balance,
    }