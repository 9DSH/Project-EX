from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.core.rls import get_db_rls
from app.models.user import User
from app.models.user_balance import UserBalance
from app.models.currency import Currency
from app.models.network import Network

from app.models.transaction import Transaction
from app.core.security import get_current_user
from app.models.withdrawal import Withdrawal
from app.models.currency_network import CurrencyNetwork
from app.models.external_wallet import ExternalWallet
from app.schemas.wallet import WithdrawRequest, ExternalWalletRequest
from app.constants.transaction_status import PENDING , COMPLETED
from app.constants.transaction_types import WITHDRAW, DEPOSIT
from app.services.currency_network_service import (
    resolve_currency_network_pair,
    validate_amount_against_limits,
)

router = APIRouter(prefix="/wallet", tags=["Wallet"])


# =========================
# CORE LEDGER FUNCTION
# =========================
def credit_user(
                db: Session,
                user_id: int,
                currency_id: int,
                network_id: int,
                amount: float,
                tx_hash: str = None,
                wallet_address: str = None,
                confirmations: int = 0
            ):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="INVALID_AMOUNT")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # prevent double deposit
    if tx_hash:
        existing = db.query(Transaction).filter(Transaction.tx_hash == tx_hash).first()
        if existing:
            existing_balance = db.query(UserBalance).filter(
                UserBalance.user_id == user_id,
                UserBalance.currency_id == currency_id,
                UserBalance.network_id == network_id
            ).first()
            return float(existing_balance.available_balance or 0) if existing_balance else 0.0

    network = db.query(Network).filter(Network.id == network_id).first()
    if not network:
        raise HTTPException(status_code=404, detail="Network not found")

    balance_row = db.query(UserBalance).filter(
        UserBalance.user_id == user_id,
        UserBalance.currency_id == currency_id,
        UserBalance.network_id == network_id
    ).first()

    if not balance_row:

        balance_row = UserBalance(
            user_id=user_id,
            currency_id=currency_id,
            network_id=network_id,
            available_balance=0,
            frozen_balance=0
        )

        db.add(balance_row)
        db.flush()

    balance_row.available_balance += amount

    tx = Transaction(
        user_id=user.user_id,
        currency_id=currency_id,
        network_id=network_id,
        amount=amount,
        type=DEPOSIT,
        status=COMPLETED,
        tx_hash=tx_hash,
        wallet_address=wallet_address,
        confirmations=confirmations,
        blockchain=(network.chain or "UNKNOWN").lower(),
        created_at=datetime.utcnow()
    )

    db.add(tx)

    db.commit()

    return balance_row.available_balance

# -------------------------
# GET BALANCE
# -------------------------
@router.get("/balance")
def get_balance(
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):

    db_user = db.query(User).filter(
        User.user_id == user["user_id"]
    ).first()

    if not db_user:
        raise HTTPException(404, "User not found")

    balances = (
        db.query(UserBalance)
        .join(Currency, UserBalance.currency_id == Currency.id)
        .outerjoin(Network, UserBalance.network_id == Network.id)
        .filter(UserBalance.user_id == user["user_id"])
        .all()
    )


    result_balances = []

    for b in balances:

        currency_symbol = None
        network_name = "MAIN"

        # SAFE CURRENCY
        if b.currency:
            currency_symbol = b.currency.symbol
        else:
            currency_symbol = "UNKNOWN"

        # SAFE NETWORK
        if b.network:
            network_name = b.network.name
        else:
            network_name = "MAIN"

        result_balances.append({
            "currency": currency_symbol,
            "network": network_name,
            "available": float(b.available_balance or 0),
            "frozen": float(b.frozen_balance or 0)
        })



    return {
        "balances": result_balances
    }

# =========================
# MANUAL DEPOSIT (TEST ONLY)
# =========================
@router.post("/deposit")
def deposit(
    amount: float,
    currency: str,
    network: str | None = None,
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):

    currency_obj = db.query(Currency).filter(
        Currency.symbol == currency.upper()
    ).first()

    if not currency_obj:
        raise HTTPException(404, "Currency not found")

    pair = resolve_currency_network_pair(
        db=db,
        currency_symbol=currency_obj.symbol,
        network_hint=network,
        action="deposit",
    )
    validate_amount_against_limits(pair, amount, "deposit")

    # must sweep specific amount to the user's wallet address
    # get confirmations from API
    # then credit user balance in database

    balance = credit_user(
        db=db,
        user_id=user["user_id"],
        currency_id=currency_obj.id,
        network_id=pair.network_id,
        amount=amount,
       #tx_hash= None,
       #wallet_address= None,
       #confirmations=
    )

    

    return {
        "currency": currency,
        "balance": balance
    }

# =====================================================
# WITHDRAW
# =====================================================
@router.post("/withdraw")
def withdraw(
    req: WithdrawRequest,
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):

    amount = req.amount
    currency_symbol = req.currency
    network_hint = req.network
    external_wallet = req.wallet_address

    currency = db.query(Currency).filter(
        Currency.symbol == currency_symbol.upper()
    ).first()

    if not currency:
        raise HTTPException(404, "Currency not found")

    pair = resolve_currency_network_pair(
        db=db,
        currency_symbol=currency.symbol,
        network_hint=network_hint,
        action="withdraw",
    )

    # Fall back to the user's saved external wallet address for this pair
    if not external_wallet:
        saved = db.query(ExternalWallet).filter(
            ExternalWallet.user_id == user["user_id"],
            ExternalWallet.currency_id == currency.id,
            ExternalWallet.network_id == pair.network_id
        ).first()
        if saved:
            external_wallet = saved.address

    if not external_wallet:
        raise HTTPException(400, "No withdrawal wallet address set. Please set your external wallet first.")

    validate_amount_against_limits(pair, amount, "withdraw")

    balance_row = db.query(UserBalance).filter(
        UserBalance.user_id == user["user_id"],
        UserBalance.currency_id == currency.id,
        UserBalance.network_id == pair.network_id
    ).with_for_update().first()

    if not balance_row:
        raise HTTPException(400, "Balance not found")

    if balance_row.available_balance  < amount:
        raise HTTPException(400, "INSUFFICIENT_BALANCE")
    
    # must sweep withdrawal amount from master wallet then sending to the external user's wallet address that user inputs 
    # get confirmations from API
    # then deduct user balance in database

    balance_row.available_balance  -= amount
    balance_row.frozen_balance += amount

    tx = Transaction(
        user_id=user["user_id"],
        currency_id=currency.id,
        network_id=pair.network_id,
        amount=amount,
        type=WITHDRAW,
        status=PENDING,
        wallet_address=external_wallet,
        tx_hash=None,
        confirmations=0,
        created_at=datetime.utcnow()
    )

    db.add(tx)

    db.commit()

    return {
        "status": "withdraw_pending",
        "currency": currency.symbol,
        "network": pair.network.chain,
        "amount": amount
    }


# =====================================================
# TRANSACTIONS
# =====================================================
@router.get("/transactions")
def get_transactions(
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):

    transactions = (
        db.query(Transaction, Currency.symbol, Network.chain)
        .outerjoin(Currency, Transaction.currency_id == Currency.id)
        .outerjoin(Network, Transaction.network_id == Network.id)
        .filter(Transaction.user_id == user["user_id"])
        .order_by(Transaction.id.desc())
        .all()
    )

    result = []

    for t, currency_symbol, network_chain in transactions:

        result.append({
            "id": t.id,
            "user_id": t.user_id,
            "amount": t.amount,
            "currency": currency_symbol,
            "network": network_chain,
            "type": t.type,
            "status": t.status,
            "tx_hash": t.tx_hash,
            "wire_transfer_order_id": t.wire_transfer_order_id,
            "created_at": t.created_at
        })

    return result


# =====================================================
# ACTIVE CURRENCY/NETWORK PAIRS (FOR BOT MENU)
# =====================================================
@router.get("/currency-networks", tags=["wallet"])
def get_active_currency_networks(
    db: Session = Depends(get_db_rls),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of active currency/network pairs for user deposit/withdraw.
    Used by Telegram bot to show dynamic menus.
    """
    from app.models.currency_network import CurrencyNetwork
    
    # Get all active pairs where deposit is enabled
    pairs = db.query(CurrencyNetwork).filter(
        CurrencyNetwork.is_active == True,
        CurrencyNetwork.deposit_enabled == True
    ).all()
    
    result = []
    grouped = {}
    
    for pair in pairs:
        currency_symbol = pair.currency.symbol if pair.currency else "UNKNOWN"
        network_chain = pair.network.chain if pair.network else "UNKNOWN"
        
        # Build pair info
        pair_info = {
            "id": pair.id,
            "currency": currency_symbol,
            "currency_id": pair.currency_id,
            "network": network_chain,
            "network_id": pair.network_id,
            "chain": network_chain,
            "min_deposit": float(pair.min_deposit) if pair.min_deposit else 0,
            "max_deposit": float(pair.max_deposit) if pair.max_deposit else 0,
            "display_name": f"{currency_symbol} on {network_chain}",
            "confirmations_required": int(pair.confirmations_required or 1),
            "withdraw_fee": float(pair.withdraw_fee) if pair.withdraw_fee else 0,
        }
        
        result.append(pair_info)
        
        # Group by currency
        if currency_symbol not in grouped:
            grouped[currency_symbol] = []
        grouped[currency_symbol].append(pair_info)
    
    return {
        "pairs": result,
        "grouped": grouped,
        "currencies": sorted(list(grouped.keys()))
    }


# =====================================================
# GET OR CREATE DEPOSIT ADDRESS
# =====================================================
@router.post("/get-deposit-address", tags=["wallet"])
def get_deposit_address(
    request: dict,
    db: Session = Depends(get_db_rls),
    current_user: User = Depends(get_current_user)
):
    """
    Get or create wallet address for user on specific currency/network pair.
    Called by Telegram bot after user selects currency and network.
    """
    from app.models.currency_network import CurrencyNetwork
    from app.services.wallet_derivation_service import get_or_create_wallet_for_pair
    
    currency_id = request.get("currency_id")
    network_id = request.get("network_id")
    
    if not currency_id or not network_id:
        raise HTTPException(status_code=400, detail="currency_id and network_id required")
    
    # Verify pair exists and is active with deposit enabled
    pair = db.query(CurrencyNetwork).filter(
        CurrencyNetwork.currency_id == currency_id,
        CurrencyNetwork.network_id == network_id,
        CurrencyNetwork.is_active == True,
        CurrencyNetwork.deposit_enabled == True
    ).first()
    
    if not pair:
        raise HTTPException(status_code=404, detail="Currency/network pair not found or deposits not enabled")
    
    # Get or create wallet
    try:
        address, wallet_record = get_or_create_wallet_for_pair(
            user_id=current_user["user_id"],
            currency_id=currency_id,
            network_id=network_id,
            db=db
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate wallet: {str(e)}")
    
    # Ensure default balance exists for this pair
    balance = db.query(UserBalance).filter(
        UserBalance.user_id == current_user["user_id"],
        UserBalance.currency_id == currency_id,
        UserBalance.network_id == network_id
    ).first()
    
    if not balance:
        balance = UserBalance(
            user_id=current_user["user_id"],
            currency_id=currency_id,
            network_id=network_id,
            available_balance=0,
            frozen_balance=0
        )
        db.add(balance)
        db.commit()
    
    return {
        "address": address,
        "currency": pair.currency.symbol if pair.currency else "UNKNOWN",
        "network": pair.network.chain if pair.network else "UNKNOWN",
        "min_deposit": float(pair.min_deposit) if pair.min_deposit else 0,
        "max_deposit": float(pair.max_deposit) if pair.max_deposit else 0,
        "confirmations_required": int(pair.confirmations_required or 1),
        "current_balance": float(balance.available_balance if balance else 0)
    }


# =====================================================
# EXTERNAL WALLETS (WITHDRAWAL DESTINATION ADDRESSES)
# The user's own private wallet address per currency/network that the
# platform sends withdrawals TO. Must NOT be an exchange/broker address.
# =====================================================
@router.get("/external-wallets", tags=["wallet"])
def list_external_wallets(
    db: Session = Depends(get_db_rls),
    current_user: User = Depends(get_current_user)
):
    """
    List the current user's saved external wallet addresses for every
    active currency/network pair (address is null if not yet set).
    """
    pairs = db.query(CurrencyNetwork).filter(
        CurrencyNetwork.is_active == True
    ).all()

    saved = {
        (w.currency_id, w.network_id): w
        for w in db.query(ExternalWallet).filter(
            ExternalWallet.user_id == current_user["user_id"]
        ).all()
    }

    result = []
    for pair in pairs:
        wallet = saved.get((pair.currency_id, pair.network_id))
        result.append({
            "currency_id": pair.currency_id,
            "currency": pair.currency.symbol if pair.currency else "UNKNOWN",
            "network_id": pair.network_id,
            "network": pair.network.chain if pair.network else "UNKNOWN",
            "address": wallet.address if wallet else None,
            "updated_at": wallet.updated_at.isoformat() if wallet and wallet.updated_at else None,
        })

    return {"wallets": result}


@router.post("/external-wallet", tags=["wallet"])
def set_external_wallet(
    payload: ExternalWalletRequest,
    db: Session = Depends(get_db_rls),
    current_user: User = Depends(get_current_user)
):
    """
    Create or update the current user's external wallet address for a
    currency/network pair. This is the address withdrawals will be sent to.
    """
    address = (payload.address or "").strip()
    if not address:
        raise HTTPException(status_code=400, detail="Wallet address is required")

    pair = db.query(CurrencyNetwork).filter(
        CurrencyNetwork.currency_id == payload.currency_id,
        CurrencyNetwork.network_id == payload.network_id,
        CurrencyNetwork.is_active == True
    ).first()

    if not pair:
        raise HTTPException(status_code=404, detail="Currency/network pair not found or inactive")

    existing = db.query(ExternalWallet).filter(
        ExternalWallet.user_id == current_user["user_id"],
        ExternalWallet.currency_id == payload.currency_id,
        ExternalWallet.network_id == payload.network_id
    ).first()

    if existing:
        existing.address = address
        existing.updated_at = datetime.utcnow()
    else:
        existing = ExternalWallet(
            user_id=current_user["user_id"],
            currency_id=payload.currency_id,
            network_id=payload.network_id,
            address=address
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)

    return {
        "currency_id": pair.currency_id,
        "currency": pair.currency.symbol if pair.currency else "UNKNOWN",
        "network_id": pair.network_id,
        "network": pair.network.chain if pair.network else "UNKNOWN",
        "address": existing.address,
        "updated_at": existing.updated_at.isoformat() if existing.updated_at else None,
    }


# =====================================================
# LIST USER WALLETS (ALL ADDRESSES)
# =====================================================
@router.get("/my-wallets", tags=["wallet"])
def list_my_wallets(
    db: Session = Depends(get_db_rls),
    current_user: User = Depends(get_current_user)
):
    """Get all wallet addresses for this user"""
    from app.services.wallet_derivation_service import list_user_wallets
    
    wallets = list_user_wallets(
        user_id=current_user["user_id"],
        db=db
    )
    
    return {
        "wallets": wallets,
        "total": len(wallets)
    }