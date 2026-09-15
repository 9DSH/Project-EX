# app/routes/admin_withdrawals.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.core.rls import get_db_rls
from app.models.user import User
from app.models.transaction import Transaction
from app.models.withdrawal import Withdrawal
from app.models.user_balance import UserBalance
from app.models.currency import Currency
from app.models.network import Network

from app.services.tatum_service import (
    transfer_token,
    to_tatum_symbol,
    get_token_balance,
    get_native_tatum_symbol,
)
from app.services.key_derivation_service import derive_hot_wallet
from app.core.security import get_current_user, is_admin_or_above
from app.core.permissions import has_access
from app.services.currency_network_service import resolve_currency_network_pair

from app.constants.transaction_status import COMPLETED, PENDING, FAILED, REJECTED
from app.constants.transaction_types import WITHDRAW

router = APIRouter(
    prefix="/admin/withdrawals",
    tags=["Admin Withdrawals"]
)


def _get_admin_user(user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    if not has_access(user, "balance.manage"):
        raise HTTPException(status_code=403, detail="Access denied")
    return user


# ======================================================
# GET PENDING WITHDRAWALS
# ======================================================
@router.get("/pending")
def get_pending_withdrawals(
    db: Session = Depends(get_db_rls),
    admin=Depends(_get_admin_user)
):

    txs = (
        db.query(Transaction)
        .filter(
            Transaction.type == WITHDRAW,
            Transaction.status == PENDING
        )
        .order_by(Transaction.id.desc())
        .all()
    )

    result = []

    for tx in txs:

        user = db.query(User).filter(
            User.user_id == tx.user_id
        ).first()

        currency = db.query(Currency).filter(
            Currency.id == tx.currency_id
        ).first()

        network = db.query(Network).filter(
            Network.id == tx.network_id
        ).first()

        result.append({
            "id": tx.id,
            "user_id": tx.user_id,
            "username": user.username if user else None,

            "amount": tx.amount,

            "currency": currency.symbol if currency else None,
            "network": network.chain if network else None,

            "wallet_address": tx.wallet_address,

            "status": tx.status,
            "created_at": tx.created_at
        })

    return result


# ======================================================
# APPROVE WITHDRAWAL
# ======================================================
@router.post("/approve/{tx_id}")
def approve_withdrawal(
    tx_id: int,
    db: Session = Depends(get_db_rls),
    admin=Depends(_get_admin_user)
):

    tx = (
        db.query(Transaction)
        .filter(Transaction.id == tx_id)
        .first()
    )

    if not tx:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    if tx.status != PENDING:
        raise HTTPException(
            status_code=400,
            detail="Already processed"
        )

    user = (
        db.query(User)
        .filter(User.user_id == tx.user_id)
        .with_for_update()
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    currency = db.query(Currency).filter(
        Currency.id == tx.currency_id
    ).first()

    network = db.query(Network).filter(
        Network.id == tx.network_id
    ).first()

    if not currency or not network:
        raise HTTPException(
            status_code=400,
            detail="Currency or network not found"
        )

    balance = (
        db.query(UserBalance)
        .filter(
            UserBalance.user_id == user.user_id,
            UserBalance.currency_id == tx.currency_id,
            UserBalance.network_id == tx.network_id
        )
        .with_for_update()
        .first()
    )

    if not balance:
        raise HTTPException(
            status_code=400,
            detail="User balance not found"
        )

    if balance.frozen_balance < tx.amount:
        raise HTTPException(
            status_code=400,
            detail="Insufficient frozen balance"
        )

    is_manual_irt = (
        (currency.symbol or "").upper() == "IRT"
        or (network.chain or "").upper() == "INTERNAL"
        or (tx.blockchain or "").lower() == "irt_manual"
    )

    if is_manual_irt:
        balance.frozen_balance -= tx.amount
        tx.status = COMPLETED

        withdrawal = Withdrawal(
            user_id=user.user_id,
            amount=tx.amount,
            currency_id=tx.currency_id,
            network_id=tx.network_id,
            wallet_address=tx.wallet_address or "",
            status=COMPLETED,
            tx_hash=None,
            created_at=datetime.utcnow(),
            processed_at=datetime.utcnow()
        )

        db.add(withdrawal)
        db.commit()

        return {
            "status": "withdraw_completed",
            "tx_hash": None
        }

    resolve_currency_network_pair(
        db=db,
        currency_symbol=currency.symbol,
        action="withdraw",
        network_hint=network.chain,
    )

    tatum_symbol = to_tatum_symbol(currency.symbol, network.chain)
    native_gas_symbol = get_native_tatum_symbol(network.chain)

    hot_wallet = derive_hot_wallet()
    hot_address = hot_wallet["address"]

    hot_asset_balance = get_token_balance(hot_address, tatum_symbol)
    if hot_asset_balance < float(tx.amount):
        raise HTTPException(400, "INSUFFICIENT_HOT_WALLET_LIQUIDITY")

    gas_balance = get_token_balance(hot_address, native_gas_symbol)
    if gas_balance < 0.005:
        raise HTTPException(400, "INSUFFICIENT_GAS_BALANCE")

    try:
        result = transfer_token(
            from_private_key=hot_wallet["private_key"],
            to_address=tx.wallet_address,
            amount=float(tx.amount),
            currency=tatum_symbol,
        )
    except Exception as exc:
        balance.available_balance += tx.amount
        balance.frozen_balance -= tx.amount
        tx.status = FAILED
        db.commit()
        raise HTTPException(
            status_code=502,
            detail=f"Withdrawal failed and refunded: {str(exc)}"
        )

    tx_hash = result.get("txId")
    if not tx_hash:
        balance.available_balance += tx.amount
        balance.frozen_balance -= tx.amount
        tx.status = FAILED
        db.commit()
        raise HTTPException(status_code=502, detail="Withdrawal failed: missing blockchain tx id")

    # ======================================================
    # FINALIZE BALANCE
    # ======================================================
    balance.frozen_balance -= tx.amount

    tx.status = COMPLETED
    tx.tx_hash = tx_hash

    # ======================================================
    # CREATE WITHDRAWAL RECORD
    # ======================================================
    withdrawal = Withdrawal(
        user_id=user.user_id,
        amount=tx.amount,
        currency_id=tx.currency_id,
        network_id=tx.network_id,
        wallet_address=tx.wallet_address,
        status=COMPLETED,
        tx_hash=tx_hash,
        created_at=datetime.utcnow(),
        processed_at=datetime.utcnow()
    )

    db.add(withdrawal)
    db.commit()

    return {
        "status": "withdraw_completed",
        "tx_hash": tx_hash
    }


# ======================================================
# REJECT WITHDRAWAL
# ======================================================
@router.post("/reject/{tx_id}")
def reject_withdrawal(
    tx_id: int,
    db: Session = Depends(get_db_rls),
    admin=Depends(_get_admin_user)
):

    tx = (
        db.query(Transaction)
        .filter(Transaction.id == tx_id)
        .first()
    )

    if not tx:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )

    if tx.status != PENDING:
        return {
            "error": "Already processed"
        }

    user = (
        db.query(User)
        .filter(User.user_id == tx.user_id)
        .with_for_update()
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    balance = (
        db.query(UserBalance)
        .filter(
            UserBalance.user_id == tx.user_id,
            UserBalance.currency_id == tx.currency_id,
            UserBalance.network_id == tx.network_id
        )
        .with_for_update()
        .first()
    )

    if not balance:
        raise HTTPException(
            status_code=404,
            detail="User balance not found"
        )

    # ======================================================
    # RETURN FUNDS
    # ======================================================
    balance.available_balance += tx.amount
    balance.frozen_balance -= tx.amount

    tx.status = REJECTED

    db.commit()

    return {
        "status": "withdraw_rejected",
        "tx_id": tx.id,
        "user_id": user.user_id
    }