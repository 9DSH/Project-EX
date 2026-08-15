from fastapi import APIRouter, Request, Depends, HTTPException, Header
from sqlalchemy.orm import Session
import hmac
import hashlib
import asyncio

from app.db.database import get_db
from app.models.user import User
from app.routes.wallet import credit_user
from app.models.transaction import Transaction
from app.core.config import WEBHOOK_SECRET
from app.services.currency_network_service import (
    resolve_currency_network_pair,
    validate_amount_against_limits,
)

router = APIRouter(prefix="/webhook", tags=["Webhook"])


def _verify_signature(raw_body: bytes, signature: str | None) -> bool:
    if not signature:
        return False
    computed = hmac.new(
        WEBHOOK_SECRET.encode(),
        raw_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, signature)


def _extract_symbol_and_chain(data: dict) -> tuple[str, str | None]:
    symbol = (
        data.get("symbol")
        or data.get("asset")
        or data.get("currency")
        or ""
    )
    chain = data.get("chain") or data.get("network") or data.get("blockchain")

    symbol = str(symbol).upper()
    chain = str(chain).upper() if chain else None

    if "_" in symbol and not chain:
        base, suffix = symbol.rsplit("_", 1)
        return base.upper(), suffix.upper()

    return symbol, chain


@router.post("/bsc")
async def bsc_webhook(request: Request, 
                      db: Session = Depends(get_db),
                      x_signature: str | None = Header(default=None)):
    if not WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret is not configured")

    raw_body = await request.body()
    if not _verify_signature(raw_body, x_signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    data = await request.json()

    print("🔥 WEBHOOK RECEIVED:", data)

    tx_id = data.get("txId")
    amount = data.get("amount")
    to_address = data.get("to")
    token_symbol, chain_hint = _extract_symbol_and_chain(data)
    confirmations = int(data.get("confirmations", 0))

    # 1. validation
    if not tx_id or not amount or not to_address:
        raise HTTPException(status_code=400, detail="Invalid payload")

    existing = db.query(Transaction).filter(
        Transaction.tx_hash == tx_id
    ).first()
    if existing:
        return {"status": "duplicate_ignored"}

    # 2. Find user via UserWallet (by address) - supports multi-network wallets
    from app.models.user import UserWallet

    user_wallet = db.query(UserWallet).filter(
        UserWallet.address == to_address
    ).first()

    if not user_wallet:
        return {"status": "wallet_not_found"}

    user_id = user_wallet.user_id
    user = db.query(User).filter(User.user_id == user_id).first()

    if not user:
        return {"status": "user_not_found"}

    pair = resolve_currency_network_pair(
        db=db,
        currency_symbol=token_symbol,
        network_hint=chain_hint,
        action="deposit",
    )

    deposit_amount = float(amount)
    validate_amount_against_limits(pair, deposit_amount, "deposit")

    if confirmations < int(pair.confirmations_required or 1):
        return {"status": "pending_confirmations"}

    balance = credit_user(
        db=db,
        user_id=user_id,
        currency_id=pair.currency_id,
        network_id=pair.network_id,
        amount=deposit_amount,
        tx_hash=tx_id,
        wallet_address=to_address,
        confirmations=confirmations
    )

    # Send telegram notification to user (async, don't block webhook response)
    if user and user.telegram_id:
        try:
            from app.services.telegram_service import send_telegram_message
            asyncio.create_task(send_telegram_message(
                chat_id=int(user.telegram_id),
                text=(
                    f"✅ *Deposit Confirmed!*\n\n"
                    f"💰 Amount: +{deposit_amount} {pair.currency.symbol}\n"
                    f"🔗 Network: {pair.network.chain}\n"
                    f"💳 New Balance: {balance.available_balance} {pair.currency.symbol}\n"
                    f"⏳ Sweeping to master wallet..."
                )
            ))
        except Exception as e:
            print(f"❌ Failed to send telegram notification: {e}")

    return {
        "status": "success",
        "currency": pair.currency.symbol,
        "network": pair.network.chain,
        "amount": amount,
        "new_balance": balance.available_balance
    }