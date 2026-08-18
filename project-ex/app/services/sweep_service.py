# sweep_service.py
from app.db.database import set_session_master
from app.services.key_derivation_service import derive_bsc_private_key, derive_hot_wallet
from app.services.tatum_service import transfer_token, get_token_balance, to_tatum_symbol
from app.services.sweep_decision_engine import should_sweep_user
from app.services.wallet_health_engine import ensure_hot_wallet_gas
from app.models.user import User, UserWallet
from app.models.transaction import Transaction
from app.models.user_balance import UserBalance
from app.models.currency import Currency
from app.models.network import Network
from app.models.failed_sweeps import FailedSweep
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
import os

MASTER_WALLET = os.getenv("MASTER_WALLET_ADDRESS")


# sweep_service.py — replace sweep_to_hot_wallet

def sweep_to_hot_wallet(db: Session, currency: str = "USDT_BSC"):

    ensure_hot_wallet_gas()

    # ✅ query balances that were flagged for sweep
    pending_balances = (
        db.query(UserBalance)
        .filter(
            UserBalance.needs_sweep == True,
            UserBalance.available_balance > 0
        )
        .all()
    )

    hot_wallet = derive_hot_wallet()
    results = []

    for balance_row in pending_balances:
        user = db.query(User).filter(
            User.user_id == balance_row.user_id
        ).first()

        if not user:
            continue

        # Deposit wallets are per (user, currency, network) pair now -
        # UserWallet.index is the single source of truth for derivation.
        user_wallet_row = db.query(UserWallet).filter(
            UserWallet.user_id == balance_row.user_id,
            UserWallet.currency_id == balance_row.currency_id,
            UserWallet.network_id == balance_row.network_id,
        ).first()

        if not user_wallet_row or user_wallet_row.index is None:
            continue

        currency_row = db.query(Currency).filter(
            Currency.id == balance_row.currency_id
        ).first()

        if not currency_row:
            continue

        network_row = db.query(Network).filter(
            Network.id == balance_row.network_id
        ).first()
        if not network_row:
            continue

        tatum_symbol = to_tatum_symbol(currency_row.symbol, network_row.chain)
        amount = float(balance_row.available_balance)

        try:
            user_wallet = derive_bsc_private_key(user_wallet_row.index)

            tx = transfer_token(
                from_private_key=user_wallet["private_key"],
                to_address=hot_wallet["address"],
                amount=amount,
                currency=tatum_symbol,
            )

            # ✅ clear the flag on success
            balance_row.needs_sweep = False

            db.add(Transaction(
                user_id=user.user_id,
                tx_hash=tx.get("txId"),
                amount=-amount,
                currency_id=balance_row.currency_id,
                network_id=balance_row.network_id,
                type="sweep",
                status="completed",
                blockchain=(network_row.chain or "UNKNOWN").lower(),
            ))

            results.append({
                "user_id": user.user_id,
                "amount": amount,
                "tatum_symbol": tatum_symbol,
                "tx": tx,
            })

        except Exception as e:
            # ✅ log to failed_sweeps, keep needs_sweep=True for retry
            db.add(FailedSweep(
                user_id=user.user_id,
                amount=amount,
                currency_symbol=currency_row.symbol,
                network=network_row.chain,
                tatum_symbol=tatum_symbol,
                reason="admin_deposit_sweep",
                error=str(e),
                retries=0,
                resolved=False,
            ))
            results.append({"user_id": user.user_id, "error": str(e)})

    db.commit()
    return results


# =========================
# STEP 2: HOT → MASTER
# =========================
# sweep_service.py — replace sweep_hot_to_master

def sweep_hot_to_master(currency: str = "USDT_BSC"):
    from app.services.tatum_service import to_tatum_symbol

    hot_wallet = derive_hot_wallet()

    try:
        hot_balance = get_token_balance(hot_wallet["address"], currency)
    except Exception as e:
        return {"status": "balance_check_failed", "error": str(e)}

    if not hot_balance or hot_balance <= 0:
        return {"status": "no_funds", "balance": 0}

    # leave a small buffer for gas on future sweeps
    MIN_RESERVE = 1.0
    sweep_amount = hot_balance - MIN_RESERVE

    if sweep_amount <= 0:
        return {"status": "below_reserve", "balance": hot_balance}

    try:
        tx = transfer_token(
            from_private_key=hot_wallet["private_key"],
            to_address=MASTER_WALLET,
            amount=sweep_amount,
            currency=currency,
        )
        return {
            "status": "swept",
            "currency": currency,
            "amount": sweep_amount,
            "tx": tx,
        }
    except Exception as e:
        return {"status": "sweep_failed", "error": str(e)}


# =========================
# CORE SWEEP EXECUTOR
# Used by both sweep_specific_amount and retry logic
# =========================
def _execute_sweep(
    user_id: int,
    amount: float,
    tatum_symbol: str,
    currency_id: int,
    network_id: int,
) -> dict:
    """
    Raw sweep — derives wallet, calls Tatum, returns result dict.
    Does NOT touch DB. Caller handles DB writes.
    """
    from app.services.key_derivation_service import derive_bsc_private_key, derive_hot_wallet

    user_wallet = derive_bsc_private_key(
        _get_wallet_index(user_id, currency_id, network_id)
    )
    hot_wallet = derive_hot_wallet()

    tx = transfer_token(
        from_private_key=user_wallet["private_key"],
        to_address=hot_wallet["address"],
        amount=amount,
        currency=tatum_symbol
    )
    return tx


def _get_wallet_index(user_id: int, currency_id: int, network_id: int):
    """Lightweight helper — avoids passing db into _execute_sweep."""
    from app.db.database import SessionLocal
    db = SessionLocal()
    set_session_master(db)
    try:
        wallet = db.query(UserWallet).filter(
            UserWallet.user_id == user_id,
            UserWallet.currency_id == currency_id,
            UserWallet.network_id == network_id,
        ).first()
        return wallet.index if wallet else None
    finally:
        db.close()


# =========================
# SWEEP SPECIFIC AMOUNT
# =========================
def sweep_specific_amount(
    db: Session,
    user_id: int,
    amount: float,
    reason: str = "exchange",
    currency_symbol: str = "USDT",
    network: str = None,
    exchange_order_id: int = None,
):
    tatum_symbol = to_tatum_symbol(currency_symbol, network)

    network_chain = (network or "BSC").upper()
    currency_row = db.query(Currency).filter(
        Currency.symbol == currency_symbol.upper()
    ).first()
    network_row = db.query(Network).filter(Network.chain == network_chain).first()

    if not currency_row or not network_row:
        raise Exception(f"Currency/network not configured: {currency_symbol}/{network_chain}")

    try:
        tx = transfer_token(
            from_private_key=_get_user_private_key(db, user_id, currency_row.id, network_row.id),
            to_address=derive_hot_wallet()["address"],
            amount=amount,
            currency=tatum_symbol
        )

        db.add(Transaction(
            user_id=user_id,
            tx_hash=tx.get("txId"),
            amount=-amount,
            currency_id=currency_row.id,
            network_id=network_row.id,
            type="sweep_exchange",
            status="completed",
            description=f"Sweep after {reason} via {tatum_symbol}"
        ))

        db.commit()

        return {"status": "success", "tatum_symbol": tatum_symbol, "tx": tx}

    except Exception as e:
        error_msg = str(e)
        print(f"Sweep failed ({tatum_symbol}): {error_msg}")

        # ❌ Failure — persist to failed_sweeps so it can be retried
        failed = FailedSweep(
            user_id=user_id,
            amount=amount,
            currency_symbol=currency_symbol.upper(),
            network=network or "BSC",
            tatum_symbol=tatum_symbol,
            reason=reason,
            error=error_msg,
            retries=0,
            resolved=False,
            exchange_order_id=exchange_order_id,
        )
        db.add(failed)
        db.commit()

        return {
            "status": "failed",
            "error": error_msg,
            "queued_for_retry": True,
            "failed_sweep_id": failed.id,
        }


def _get_user_private_key(db: Session, user_id: int, currency_id: int, network_id: int) -> str:
    wallet = db.query(UserWallet).filter(
        UserWallet.user_id == user_id,
        UserWallet.currency_id == currency_id,
        UserWallet.network_id == network_id,
    ).first()
    if not wallet or wallet.index is None:
        raise Exception(f"No wallet for user {user_id} (currency={currency_id}, network={network_id})")
    key = derive_bsc_private_key(wallet.index)
    return key["private_key"]


# =========================
# RETRY FAILED SWEEPS
# Call this from a cron job / scheduler every few minutes
# =========================
def retry_failed_sweeps(db: Session, max_retries: int = 5):
    pending = (
        db.query(FailedSweep)
        .filter(
            FailedSweep.resolved == False,
            FailedSweep.retries < max_retries
        )
        .all()
    )

    results = []

    for sweep in pending:
        try:
            currency_row = db.query(Currency).filter(
                Currency.symbol == sweep.currency_symbol.upper()
            ).first()
            network_chain = (sweep.network or "BSC").upper()
            network_row = db.query(Network).filter(Network.chain == network_chain).first()

            if not currency_row or not network_row:
                raise Exception(f"Currency/network not configured: {sweep.currency_symbol}/{network_chain}")

            private_key = _get_user_private_key(db, sweep.user_id, currency_row.id, network_row.id)
            hot_wallet = derive_hot_wallet()

            tx = transfer_token(
                from_private_key=private_key,
                to_address=hot_wallet["address"],
                amount=sweep.amount,
                currency=sweep.tatum_symbol
            )

            # ✅ Retry succeeded
            sweep.resolved = True
            sweep.resolved_at = func.now()
            sweep.last_retry_at = func.now()
            sweep.retries += 1

            db.add(Transaction(
                user_id=sweep.user_id,
                tx_hash=tx.get("txId"),
                amount=-sweep.amount,
                currency_id=currency_row.id,
                network_id=network_row.id,
                type="sweep_exchange",
                status="completed",
                description=f"Retry sweep #{sweep.id} after {sweep.reason}"
            ))


            results.append({
                "sweep_id": sweep.id,
                "status": "resolved",
                "tx": tx
            })

        except Exception as e:
            # Still failing — increment retry count
            sweep.retries += 1
            sweep.last_retry_at = func.now()
            sweep.error = str(e)

            results.append({
                "sweep_id": sweep.id,
                "status": "still_failing",
                "retries": sweep.retries,
                "error": str(e)
            })

        db.commit()

    return results