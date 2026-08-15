# admin_wallet.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.sweep_service import sweep_to_hot_wallet, sweep_hot_to_master
from app.core.security import get_current_user
from app.models.transaction import Transaction
from app.models.user import User
from app.models.user_balance import UserBalance
from app.models.currency_network import CurrencyNetwork
from datetime import datetime, timedelta

router = APIRouter(prefix="/admin/wallet", tags=["Admin Wallet"])


def verify_admin(user):
    """Verify user is admin"""
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.post("/sweep")
def sweep(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    verify_admin(user)

    user_sweep_result = sweep_to_hot_wallet(db)
    hot_sweep_result  = sweep_hot_to_master()

    return {
        "user_sweep": user_sweep_result,
        "hot_sweep":  hot_sweep_result,
    }


# =====================================================
# WALLET STATUS & TRANSACTIONS
# =====================================================
@router.get("/transactions", tags=["Admin Wallet"])
def get_wallet_transactions(
    skip: int = 0,
    limit: int = 50,
    type_filter: str = None,  # deposit, sweep, withdrawal
    status_filter: str = None,
    user_id_filter: int = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Get deposit/sweep/withdrawal transaction history for master dashboard"""
    verify_admin(user)
    
    query = db.query(Transaction).filter(
        Transaction.type.in_(["deposit", "sweep", "withdrawal"])
    )
    
    # Apply filters
    if type_filter:
        query = query.filter(Transaction.type == type_filter)
    if status_filter:
        query = query.filter(Transaction.status == status_filter)
    if user_id_filter:
        query = query.filter(Transaction.user_id == user_id_filter)
    
    transactions = query.order_by(
        Transaction.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    result = []
    for t in transactions:
        user_obj = db.query(User).filter(User.user_id == t.user_id).first()
        result.append({
            "id": t.id,
            "timestamp": t.created_at.isoformat() if t.created_at else None,
            "type": t.type,
            "user_id": t.user_id,
            "username": user_obj.username if user_obj else "System",
            "amount": float(t.amount),
            "currency": t.currency.symbol if t.currency else "N/A",
            "network": t.network.chain if t.network else "N/A",
            "status": t.status,
            "from_address": t.from_address,
            "to_address": t.to_address or t.wallet_address,
            "tx_hash": t.tx_hash,
            "confirmations": t.confirmations,
            "fee": float(t.fee) if hasattr(t, 'fee') and t.fee else None
        })
    
    total = db.query(Transaction).filter(
        Transaction.type.in_(["deposit", "sweep", "withdrawal"])
    ).count()
    
    return {
        "transactions": result,
        "total": total,
        "skip": skip,
        "limit": limit
    }


# =====================================================
# WALLET STATUS - HOT & MASTER WALLET
# =====================================================
@router.get("/status", tags=["Admin Wallet"])
def get_wallet_status(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Get hot wallet and master wallet status with all pair balances"""
    verify_admin(user)
    
    from app.services.tatum_service import tatum_service
    
    result = {
        "hot_wallet": {},
        "master_wallet": {},
        "all_pairs": [],
        "summary": {
            "total_hot_usd": 0,
            "total_master_usd": 0,
            "total_deposits_24h": 0,
            "total_deposits_all_time": 0,
            "pending_deposits": 0
        }
    }
    
    try:
        # Get active pairs
        pairs = db.query(CurrencyNetwork).filter(
            CurrencyNetwork.is_active == True
        ).all()
        
        for pair in pairs:
            currency_symbol = pair.currency.symbol if pair.currency else "UNKNOWN"
            network_chain = pair.network.chain if pair.network else "UNKNOWN"
            tatum_symbol = f"{currency_symbol}_{network_chain}"
            
            pair_info = {
                "currency": currency_symbol,
                "network": network_chain,
                "tatum_symbol": tatum_symbol,
                "display_name": f"{currency_symbol} on {network_chain}",
                "hot_wallet": {
                    "balance": 0,
                    "address": "N/A"
                },
                "master_wallet": {
                    "balance": 0,
                    "address": "N/A"
                },
                "deposit_enabled": pair.deposit_enabled,
                "withdraw_enabled": pair.withdraw_enabled
            }
            
            # Try to get balances from Tatum
            try:
                hot_balance = tatum_service.get_balance(tatum_symbol)
                pair_info["hot_wallet"]["balance"] = float(hot_balance) if hot_balance else 0
            except:
                pair_info["hot_wallet"]["balance"] = 0
            
            try:
                master_balance = tatum_service.get_master_wallet_balance(tatum_symbol)
                pair_info["master_wallet"]["balance"] = float(master_balance) if master_balance else 0
            except:
                pair_info["master_wallet"]["balance"] = 0
            
            result["all_pairs"].append(pair_info)
        
        # Summary statistics
        deposits_24h = db.query(Transaction).filter(
            Transaction.type == "deposit",
            Transaction.created_at >= datetime.utcnow() - timedelta(hours=24)
        ).all()
        
        result["summary"]["total_deposits_24h"] = len(deposits_24h)
        result["summary"]["total_deposits_all_time"] = db.query(Transaction).filter(
            Transaction.type == "deposit"
        ).count()
        result["summary"]["pending_deposits"] = db.query(Transaction).filter(
            Transaction.type == "deposit",
            Transaction.status == "pending"
        ).count()
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


# =====================================================
# GAS STATUS & NETWORK FEES
# =====================================================
@router.get("/gas-status", tags=["Admin Wallet"])
def get_gas_status(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Get gas status and transaction fees for all networks"""
    verify_admin(user)
    
    from app.services.tatum_service import tatum_service
    
    result = {
        "networks": [],
        "timestamp": datetime.utcnow().isoformat()
    }
    
    try:
        # Get all networks
        from app.models.network import Network
        networks = db.query(Network).filter(Network.is_active == True).all()
        
        for network in networks:
            network_info = {
                "chain": network.chain,
                "name": network.name,
                "gas_price": "N/A",
                "gas_limit": "N/A",
                "estimated_fee": "N/A",
                "status": "online"
            }
            
            # Try to get gas status from Tatum
            try:
                # This would depend on Tatum API for gas prices
                # For now, we'll mock it or skip if not available
                gas_data = tatum_service.get_gas_price(network.chain)
                if gas_data:
                    network_info["gas_price"] = gas_data.get("gasPrice")
                    network_info["gas_limit"] = gas_data.get("gasLimit")
                    network_info["estimated_fee"] = gas_data.get("estimatedFee")
            except:
                pass
            
            result["networks"].append(network_info)
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


# =====================================================
# CURRENCY/NETWORK PAIR MANAGEMENT
# =====================================================
@router.get("/pairs", tags=["Admin Wallet"])
def list_all_pairs(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    include_inactive: bool = False
):
    """List all configured currency/network pairs"""
    verify_admin(user)
    
    query = db.query(CurrencyNetwork)
    
    if not include_inactive:
        query = query.filter(CurrencyNetwork.is_active == True)
    
    pairs = query.all()
    
    result = []
    for pair in pairs:
        result.append({
            "id": pair.id,
            "currency": pair.currency.symbol if pair.currency else "N/A",
            "network": pair.network.chain if pair.network else "N/A",
            "is_active": pair.is_active,
            "is_default": pair.is_default,
            "deposit_enabled": pair.deposit_enabled,
            "withdraw_enabled": pair.withdraw_enabled,
            "min_deposit": float(pair.min_deposit) if pair.min_deposit else 0,
            "max_deposit": float(pair.max_deposit) if pair.max_deposit else 0,
            "min_withdraw": float(pair.min_withdraw) if pair.min_withdraw else 0,
            "confirmations_required": int(pair.confirmations_required or 1),
            "withdraw_fee": float(pair.withdraw_fee) if pair.withdraw_fee else 0,
            "created_at": pair.created_at.isoformat() if pair.created_at else None
        })
    
    return {
        "pairs": result,
        "total": len(result)
    }


@router.put("/pairs/{pair_id}", tags=["Admin Wallet"])
def update_pair_settings(
    pair_id: int,
    settings: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """Update pair settings (enable/disable deposits/withdrawals, fees, etc)"""
    verify_admin(user)
    
    pair = db.query(CurrencyNetwork).filter(
        CurrencyNetwork.id == pair_id
    ).first()
    
    if not pair:
        raise HTTPException(status_code=404, detail="Pair not found")
    
    # Update allowed fields
    if "is_active" in settings:
        pair.is_active = settings["is_active"]
    if "deposit_enabled" in settings:
        pair.deposit_enabled = settings["deposit_enabled"]
    if "withdraw_enabled" in settings:
        pair.withdraw_enabled = settings["withdraw_enabled"]
    if "min_deposit" in settings:
        pair.min_deposit = float(settings["min_deposit"])
    if "max_deposit" in settings:
        pair.max_deposit = float(settings["max_deposit"])
    if "min_withdraw" in settings:
        pair.min_withdraw = float(settings["min_withdraw"])
    if "withdraw_fee" in settings:
        pair.withdraw_fee = float(settings["withdraw_fee"])
    if "confirmations_required" in settings:
        pair.confirmations_required = int(settings["confirmations_required"])
    
    db.commit()
    db.refresh(pair)
    
    return {
        "status": "updated",
        "pair_id": pair_id,
        "currency": pair.currency.symbol if pair.currency else "N/A",
        "network": pair.network.chain if pair.network else "N/A"
    }


# =====================================================
# USER WALLET ADDRESSES
# =====================================================
@router.get("/user/{user_id}/wallets", tags=["Admin Wallet"])
def get_user_wallets(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(get_current_user)
):
    """Get all wallet addresses for a specific user"""
    verify_admin(admin_user)
    
    from app.services.wallet_derivation_service import list_user_wallets
    
    wallets = list_user_wallets(user_id, db)
    
    # Get user info
    user = db.query(User).filter(User.user_id == user_id).first()
    
    return {
        "user_id": user_id,
        "username": user.username if user else "Unknown",
        "wallets": wallets,
        "total_wallets": len(wallets)
    }