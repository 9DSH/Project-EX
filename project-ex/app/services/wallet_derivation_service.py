"""
Service for deriving unique wallet addresses per currency/network pair.
Uses BIP44 derivation with different indices for each currency/network combination.
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.user import UserWallet, User
from app.models.currency_network import CurrencyNetwork
from app.routes.utilts.shared_functions import  _reassert_master_rls
from app.services.tatum_service import derive_address, create_address_subscription
import logging
import os

logger = logging.getLogger(__name__)

# Chains Tatum can watch via ADDRESS_TRANSACTION webhook subscriptions.
WEBHOOK_SUPPORTED_CHAINS = {"BSC", "BASE"}


def get_derivation_index(user_id: int, currency_id: int, network_id: int) -> int:
    """
    Generate unique derivation index for this (user, currency, network) combination.
    This ensures different indices for different pairs.
    
    Formula: (user_id * 1000000) + (currency_id * 1000) + network_id
    This allows up to 1000 currencies and 1000 networks per user.
    """
    return (user_id * 1000000) + (currency_id * 1000) + network_id


def get_or_create_wallet_for_pair(
    user_id: int,
    currency_id: int,
    network_id: int,
    db: Session
) -> tuple[str, UserWallet]:
    """
    Get existing wallet address for this pair, or create one if missing.
    
    Returns:
        tuple: (wallet_address: str, wallet_record: UserWallet)
    
    Raises:
        ValueError: If currency/network pair not found or not active
        Exception: If derivation fails
    """
    
    # Try to find existing wallet
    existing = db.query(UserWallet).filter(
        UserWallet.user_id == user_id,
        UserWallet.currency_id == currency_id,
        UserWallet.network_id == network_id
    ).first()
    
    if existing:
        logger.info(f"Found existing wallet for user {user_id}: {existing.address}")
        return existing.address, existing
    
    logger.info(f"Generating new wallet for user {user_id}, pair {currency_id}-{network_id}")
    
    # Get currency/network pair config
    pair = db.query(CurrencyNetwork).filter(
        CurrencyNetwork.currency_id == currency_id,
        CurrencyNetwork.network_id == network_id,
        CurrencyNetwork.is_active == True
    ).first()
    
    if not pair:
        raise ValueError(
            f"Currency/network pair not found or not active: {currency_id}-{network_id}"
        )
    
    if not pair.deposit_enabled:
        raise ValueError(
            f"Deposits not enabled for {pair.currency.symbol} on {pair.network.chain}"
        )

    # Only crypto currencies get a real blockchain deposit address. Fiat
    # currencies (e.g. IRT on the INTERNAL network) are handled entirely via
    # UserBalance and never need a Tatum-derived wallet - skip cleanly here
    # instead of letting derive_address() fail noisily below.
    if pair.currency.type != "crypto":
        raise ValueError(
            f"{pair.currency.symbol} is not a crypto currency - no deposit wallet needed"
        )

    # Get master mnemonic from config
    master_mnemonic = os.getenv("MASTER_MNEMONIC")
    if not master_mnemonic:
        raise ValueError("MASTER_MNEMONIC not configured in environment")
    
    # Determine derivation index (unique per currency/network/user)
    derivation_index = get_derivation_index(user_id, currency_id, network_id)
    
    # Derive address via Tatum
    try:
        logger.info(
            f"Deriving address for user {user_id}: "
            f"currency={pair.currency.symbol}, "
            f"network={pair.network.chain}, "
            f"index={derivation_index}"
        )
        
        derived_address = derive_address(
            mnemonic=master_mnemonic,
            index=derivation_index,
            network_chain=pair.network.chain
        )
        
        if not derived_address:
            raise ValueError("Tatum returned empty address")
            
    except Exception as e:
        logger.error(f"Failed to derive address: {e}")
        raise ValueError(f"Address derivation failed: {str(e)}")
    
    # Store new wallet
    wallet = UserWallet(
        user_id=user_id,
        currency_id=currency_id,
        network_id=network_id,
        address=derived_address,
        index=derivation_index
    )
    db.add(wallet)
    
    try:
        db.commit()
        _reassert_master_rls(db)
        db.refresh(wallet)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save wallet to database: {e}")
        raise ValueError(f"Failed to save wallet: {str(e)}")
    
    logger.info(
        f"✅ Created wallet for user {user_id}: {derived_address} "
        f"({pair.currency.symbol} on {pair.network.chain})"
    )

    # Register a Tatum webhook subscription so deposits to this address are
    # detected automatically. Best-effort: a subscription failure must never
    # block wallet creation (the wallet can still be swept/checked manually).
    chain = (pair.network.chain or "").upper()
    webhook_url = os.getenv("WEBHOOK_URL")
    if chain in WEBHOOK_SUPPORTED_CHAINS and webhook_url:
        try:
            sub = create_address_subscription(
                address=derived_address,
                webhook_url=webhook_url,
                chain=chain,
            )
            logger.info(f"Subscribed {derived_address} to webhook: {sub}")
        except Exception as e:
            logger.error(f"Failed to create webhook subscription for {derived_address}: {e}")
    elif chain in WEBHOOK_SUPPORTED_CHAINS and not webhook_url:
        logger.warning(
            f"WEBHOOK_URL not configured - deposit address {derived_address} "
            f"will NOT be monitored automatically by Tatum"
        )

    return derived_address, wallet


def get_wallet_for_pair(
    user_id: int,
    currency_id: int,
    network_id: int,
    db: Session
) -> tuple[str | None, UserWallet | None]:
    """
    Get wallet address for pair (does NOT create if missing).
    
    Returns:
        tuple: (wallet_address: str or None, wallet_record: UserWallet or None)
    """
    wallet = db.query(UserWallet).filter(
        UserWallet.user_id == user_id,
        UserWallet.currency_id == currency_id,
        UserWallet.network_id == network_id
    ).first()
    
    if wallet:
        return wallet.address, wallet
    return None, None


def create_default_wallets_for_user(user_id: int, db: Session) -> list[dict]:
    """
    Single source of truth for deposit-wallet creation at user creation time.

    Only iterates pairs marked as "default" (e.g. USDT/BEP20, IRT/INTERNAL) -
    admin-controlled via the is_default flag on CurrencyNetwork. All other
    pairs get their wallet created on demand, the first time a user (via the
    bot's deposit flow) or an admin (via Balance Management / the wallet-pair
    admin view) actually needs it - see get_or_create_wallet_for_pair().

    Pairs whose network isn't a supported blockchain (e.g. internal/fiat
    networks like INTERNAL) simply fail address derivation and are skipped -
    they don't need a deposit address at all.

    Best-effort: failures for individual pairs are logged and skipped so one
    unsupported/misconfigured pair never blocks user creation.
    """
    pairs = db.query(CurrencyNetwork).filter(
        CurrencyNetwork.is_active == True,
        CurrencyNetwork.deposit_enabled == True,
        CurrencyNetwork.is_default == True,
    ).all()

    results = []
    for pair in pairs:
        try:
            address, wallet = get_or_create_wallet_for_pair(
                user_id=user_id,
                currency_id=pair.currency_id,
                network_id=pair.network_id,
                db=db,
            )
            results.append({
                "currency_id": pair.currency_id,
                "network_id": pair.network_id,
                "currency": pair.currency.symbol if pair.currency else None,
                "network": pair.network.chain if pair.network else None,
                "address": address,
                "status": "created",
            })
        except Exception as e:
            logger.info(
                f"Skipping deposit wallet creation for user {user_id}, "
                f"pair {pair.currency_id}-{pair.network_id}: {e}"
            )
            results.append({
                "currency_id": pair.currency_id,
                "network_id": pair.network_id,
                "status": "skipped",
                "error": str(e),
            })

    return results


def list_user_wallets(user_id: int, db: Session) -> list[dict]:
    """Get all wallets for a user with their details"""
    
    wallets = db.query(UserWallet).filter(
        UserWallet.user_id == user_id
    ).order_by(UserWallet.created_at).all()
    
    result = []
    for wallet in wallets:
        result.append({
            "id": wallet.id,
            "currency": wallet.currency.symbol if wallet.currency else "UNKNOWN",
            "network": wallet.network.chain if wallet.network else "UNKNOWN",
            "address": wallet.address,
            "created_at": wallet.created_at.isoformat() if wallet.created_at else None,
        })
    
    return result
