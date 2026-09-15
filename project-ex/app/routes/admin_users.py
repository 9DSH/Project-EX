from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.core.permissions import ROLE_PERMISSIONS
from pydantic import BaseModel
from app.core.rls import get_db_rls, get_db_master
from app.models.user import User
from app.models.user_balance import UserBalance
from app.models.currency import Currency
from app.models.network import Network
from app.models.currency_network import CurrencyNetwork
from app.models.order_item import OrderItem
from app.models.transaction import Transaction
from app.core.security import get_current_user, is_master, is_admin_or_above
from app.schemas.user import UserCreate
from app.constants.transaction_types import ADMIN_DEPOSIT,ADMIN_WITHDRAW, MASTER_DEPOSIT, MASTER_WITHDRAW 
from app.constants.transaction_status import COMPLETED, FAILED, FROZEN, REJECTED
import uuid
from app.core.security import hash_password
from sqlalchemy import func, or_
from app.models.messages import Conversation, Message
from typing import Optional
from app.models.user import UserWallet
from app.models.external_wallet import ExternalWallet
from app.models.user_bank_info import UserBankInfo
from app.models.wire_transfer_order import WireTransferOrder
from app.services.auth_service import reset_user_password 
from app.services.wallet_derivation_service import get_or_create_wallet_for_pair, create_default_wallets_for_user
from app.routes.admin_orders import  build_order_response
from app.routes.utilts.shared_functions import get_admin_username
from app.services.subscription_service import sync_master_grants, enroll_free_plan_on_signup

router = APIRouter(prefix="/admin/users", tags=["Admin Users"])

class ProfileResetPassword(BaseModel):
    new_password: str | None = None

class BalanceUpdate(BaseModel):
    amount: float
    action: str
    currency_id: int
    network_id: Optional[int] = None
    platform_bank_account_id: Optional[int] = None


class BalanceDeleteRequest(BaseModel):
    currency_id: int
    network_id: Optional[int] = None


class UserUpdate(BaseModel):
    username: str | None = None
    status: str | None = None
    role: str | None = None

    first_name: str | None = None
    last_name: str | None = None
    phone_number: str | None = None
    email: str | None = None

    access_points: list[str] | None = None


class InternalTransferPayload(BaseModel):
    from_user_id: int
    to_user_id: int
    currency_id: int
    network_id: Optional[int] = None
    amount: float
    note: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    new_password: Optional[str] = None


def has_access(user, permission: str):
    role = user.get("role")

    if role == "master":
        return True

    allowed = ROLE_PERMISSIONS.get(role, [])

    if allowed == "*":
        return True

    return permission in allowed
# -------------------------
# SHARED USER SERIALIZER
# -------------------------
def serialize_user(u, db):
    balance_rows = (
        db.query(
            UserBalance.currency_id,
            UserBalance.network_id,
            UserBalance.available_balance,
            UserBalance.frozen_balance,
            Currency.symbol.label("currency_symbol"),
            Network.name.label("network_name"),
            Network.chain.label("network_chain"),
        )
        .join(Currency, Currency.id == UserBalance.currency_id)
        .outerjoin(Network, Network.id == UserBalance.network_id)
        .filter(UserBalance.user_id == u.user_id)
        .all()
    )
    bank_info = db.query(UserBankInfo).filter(UserBankInfo.user_id == u.user_id).first()

    unread_messages = db.query(func.count(Message.id))\
        .join(Conversation, Conversation.id == Message.conversation_id)\
        .filter(
            Conversation.user_id == u.user_id,
            Message.sender == "user",
            Message.is_read == False
        ).scalar()

    pending_orders = db.query(func.count(OrderItem.id)).filter(
        OrderItem.user_id == u.user_id,
        OrderItem.status == "pending"
    ).scalar()

    approved_orders = db.query(func.count(OrderItem.id)).filter(
        OrderItem.user_id == u.user_id,
        OrderItem.status == "approved"
    ).scalar()

    pending_wire_transfers = db.query(func.count(WireTransferOrder.id)).filter(
        WireTransferOrder.user_id == u.user_id,
        WireTransferOrder.status == "pending"
    ).scalar()

    pending_withdrawals = db.query(func.count(Transaction.id)).filter(
        Transaction.user_id == u.user_id,
        Transaction.type == "withdraw",
        Transaction.status == "pending"
    ).scalar()

        # Batch-resolve admin usernames to avoid N+1 queries
    admin_username = get_admin_username(db, u.admin_id )


    return {
        "user_id": u.user_id,
        "username": u.username,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "phone_number": u.phone_number,
        "email": u.email,
        "invited_by": u.invited_by,
        "inviter": u.inviter,
        "telegram_id": u.telegram_id,
        "status": u.status,
        "role": u.role,
        "admin_id": u.admin_id,  
        "admin_username": admin_username,         
        "created_date": u.created_date, 
        "access_points": u.access_points,
        "bank_info": {
            "bank_holder_name": bank_info.bank_holder_name if bank_info else None,
            "bank_card_number": bank_info.bank_card_number if bank_info else None,
            "bank_name": bank_info.bank_name if bank_info else None,
            "bank_sheba": bank_info.bank_sheba if bank_info else None,
        } if bank_info else None,
        "unread_messages": unread_messages or 0,
        "pending_orders": pending_orders or 0,
        "approved_orders": approved_orders or 0,
        "pending_wire_transfers": pending_wire_transfers or 0,
        "pending_withdrawals": pending_withdrawals or 0,
        "balances": [
            {
                "currency_id": b.currency_id,
                "currency": b.currency_symbol,
                "network_id": b.network_id,
                "network": b.network_name,
                "network_chain": b.network_chain,
                "available": b.available_balance,
                "frozen": b.frozen_balance,
            }
            for b in balance_rows
        ],
    }


def create_default_balances(db: Session, user_id: int):
    """
    Creates zero balances only for pairs marked as "default" in asset
    management (is_default=True, e.g. USDT/BEP20, IRT/INTERNAL). All other
    currency/network pairs only get a balance row created on demand - the
    first time the user deposits to that pair (bot) or an admin adds/edits a
    balance for it (Balance Management) - see get_deposit_address() and
    update_balance().

    Non-crypto currencies without any network pairs at all (network_id=NULL)
    are still auto-created here, but only if they don't already have a
    default network-scoped pair (to avoid a duplicate balance row for the
    same currency).
    """
    default_pairs = (
        db.query(CurrencyNetwork)
        .join(Currency, CurrencyNetwork.currency_id == Currency.id)
        .join(Network, CurrencyNetwork.network_id == Network.id)
        .filter(
            CurrencyNetwork.is_active == True,
            CurrencyNetwork.is_default == True,
            Currency.is_active == True,
            Network.is_active == True,
        )
        .all()
    )

    default_currency_ids = set()
    for pair in default_pairs:
        default_currency_ids.add(pair.currency_id)

        exists = db.query(UserBalance).filter(
            UserBalance.user_id == user_id,
            UserBalance.currency_id == pair.currency_id,
            UserBalance.network_id == pair.network_id
        ).first()

        if exists:
            continue

        db.add(UserBalance(
            user_id=user_id,
            currency_id=pair.currency_id,
            network_id=pair.network_id,
            available_balance=0,
            frozen_balance=0
        ))
        
    """
    non_crypto = db.query(Currency).filter(
        Currency.is_active == True,
        Currency.type != "crypto"
    ).all()

    for currency in non_crypto:
        if currency.id in default_currency_ids:
            # Already covered by a default network-scoped pair above.
            continue

        has_any_pair = db.query(CurrencyNetwork).filter(
            CurrencyNetwork.currency_id == currency.id
        ).first()
        if has_any_pair:
            # This currency uses network-scoped pairs; only default pairs
            # get an auto-created balance, non-default ones are on-demand.
            continue

        exists = db.query(UserBalance).filter(
            UserBalance.user_id == user_id,
            UserBalance.currency_id == currency.id,
            UserBalance.network_id == None
        ).first()

        if exists:
            continue

        db.add(UserBalance(
            user_id=user_id,
            currency_id=currency.id,
            network_id=None,
            available_balance=0,
            frozen_balance=0
        ))  
         
           """

def create_wallet_for_user(db: Session, user: User):
    """
    Single source of truth for deposit-wallet creation.
    Creates a UserWallet row for every active, deposit-enabled currency/network
    pair (e.g. USDT/BEP20). Non-blockchain pairs (e.g. IRT/INTERNAL) are
    skipped automatically since address derivation isn't applicable to them.
    """
    return create_default_wallets_for_user(user.user_id, db)
# =========================
# GET ALL USERS
# master  → all users (role=user) + all admins
# admin   → only users they created (use /my-users for that tab)
# =========================
@router.get("/")
def get_users(
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):

    if not is_admin_or_above(user):
        raise HTTPException(403, "Not authorized")
    
    if not has_access(user, "all.users.view"):
        raise HTTPException(403, "Access denied")

    if is_master(user):
        # Masters see everyone except other masters
        users = db.query(User).filter(User.role != "master").all()
    else:
        # Admins see ALL users with role=user (all-users tab)
        users = db.query(User).filter(User.role == "user").all()

    return [serialize_user(u, db) for u in users]


# =========================
# GET ADMIN'S OWN USERS  (admin "my users" tab)
# =========================
@router.get("/my-users")
def get_my_users(
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):
    if not is_admin_or_above(user):
        raise HTTPException(403, "Not authorized")

    current_admin_id = user.get("user_id")
    users = db.query(User).filter(
        User.role == "user",
        User.admin_id == current_admin_id
    ).all()

    return [serialize_user(u, db) for u in users]


# =========================
# GET ALL ADMINS  (master only)
# =========================
@router.get("/admins")
def get_admins(
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):
    if not is_master(user):
        raise HTTPException(403, "Master access required")

    admins = db.query(User).filter(User.role == "admin").all()
    return [serialize_user(u, db) for u in admins]


# =========================
# SEARCH USERS
# =========================
@router.get("/search")
def search_users(
    q: str = "",
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user),
):
    if not is_admin_or_above(user):
        raise HTTPException(403, "Not authorized")

    query = db.query(User)

    if not is_master(user):
        # Admins can only search their own users
        query = query.filter(
            User.role == "user",
            User.admin_id == user.get("user_id")
        )

    if q:
        query = query.filter(
            or_(
                User.username.ilike(f"%{q}%"),
                User.telegram_id.ilike(f"%{q}%"),
            )
        )

    users = query.limit(20).all()
    return [
        {
            "user_id": u.user_id,
            "username": u.username,
            "telegram_id": u.telegram_id,
            "status": u.status,
            "role": u.role,
            "admin_id": u.admin_id,
        }
        for u in users
    ]

@router.post("/bootstrap-master")
def bootstrap_master(
    payload: UserCreate,
    db: Session = Depends(get_db_master),
):
    existing_users = db.query(User).count()

    if existing_users > 0:
        raise HTTPException(
            status_code=403,
            detail="Master already exists"
        )

    master = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        telegram_id=payload.telegram_id,
        account_id=str(uuid.uuid4()),
        status="active",
        role="master",
        admin_id=None,
        access_points=ROLE_PERMISSIONS["master"]
    )

    db.add(master)
    db.flush()  # 👈 important so we get user_id BEFORE balances

    # =========================
    # WALLET + SUBSCRIPTION
    # =========================
    subscription = create_wallet_for_user(db, master)

    # =========================
    # DEFAULT BALANCES (MASTER INCLUDED NOW)
    # =========================
    create_default_balances(db, master.user_id)

    db.commit()
    db.refresh(master)

    return {
        "success": True,
        "user_id": master.user_id,
        "role": master.role,
        "wallets": subscription,
    }

# =========================
# CREATE USER
# - master  can create: user, admin, master
# - admin   can create: user only
# =========================
@router.post("/create")
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):
    if not is_admin_or_above(user):
        raise HTTPException(403, "Not authorized")
    
    if not has_access(user, "users.manage"):
        raise HTTPException(403, "Access denied")
    
    access_points = []

    if user.get("role") == "master" and payload.role == "admin":
        access_points = payload.access_points or []

    requested_role = getattr(payload, "role", "user") or "user"

    creator_role = user.get("role")
    creator_admin_id = user.get("user_id")

    # role permissions
    if creator_role == "admin" and requested_role != "user":
        raise HTTPException(403, "Admins can only create users")

    if creator_role == "master" and requested_role not in (
        "user",
        "admin",
        "master"
    ):
        raise HTTPException(400, "Invalid role")

    existing = db.query(User).filter(
        User.username == payload.username
    ).first()

    if existing:
        raise HTTPException(400, "User already exists")

    try:

        # =========================
        # CREATE USER
        # =========================
        assigned_admin_id = creator_admin_id
        if is_master(user) and payload.admin_id is not None:
            assigned_admin_id = payload.admin_id

        new_user = User(
            username=payload.username,
            password_hash=hash_password(
                payload.password
            ),
            telegram_id=None,
            account_id=str(uuid.uuid4()),
            status="active",
            role=requested_role,
            admin_id=assigned_admin_id,
            access_points=[],
        )

        db.add(new_user)
        db.flush()

        if access_points:
            sync_master_grants(db, new_user.user_id, access_points)

        # =========================
        # WALLET GENERATION
        # (single source of truth: UserWallet per active pair)
        # =========================
        wallets = create_wallet_for_user(db, new_user)

        create_default_balances(db, new_user.user_id)

        # Every new admin is auto-enrolled in the default free/showcase
        # plan at zero cost. Not applicable to role=user or role=master.
        if requested_role == "admin":
            enroll_free_plan_on_signup(db, new_user.user_id)

        db.commit()
        db.refresh(new_user)

        return {
            "success": True,
            "id": new_user.user_id,
            "username": new_user.username,
            "telegram_id": new_user.telegram_id,
            "role": new_user.role,
            "admin_id": new_user.admin_id,

            "wallets": wallets,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# =========================
# Link Telergam id
# =========================
@router.post("/telegram/link")
def link_telegram(
    telegram_id: str,
    username: str,
    db: Session = Depends(get_db_rls)
):
    user = db.query(User).filter(User.username == username).first()

    if not user:
        raise HTTPException(404, "User not found")

    if user.telegram_id is not None:
        raise HTTPException(400, "Already linked")

    user.telegram_id = telegram_id
    db.commit()

    return {"success": True}

# =========================
# INTERNAL TRANSFER  (admin or master)
# =========================
@router.post("/internal-transfer")
def internal_transfer(
    payload: InternalTransferPayload,
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user),
):
    if not is_admin_or_above(user):
        raise HTTPException(403, "Not authorized")
    
    if not has_access(user, "users.internal.transfer"):
        raise HTTPException(403, "Access denied")

    if payload.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    if payload.from_user_id == payload.to_user_id:
        raise HTTPException(400, "Cannot transfer to the same user")

    currency = db.query(Currency).filter(Currency.id == payload.currency_id).first()
    if not currency:
        raise HTTPException(404, "Currency not found")

    network = None
    if payload.network_id:
        network = db.query(Network).filter(Network.id == payload.network_id).first()
        if not network:
            raise HTTPException(404, "Network not found")

    from_user = db.query(User).filter(User.user_id == payload.from_user_id).with_for_update().first()
    if not from_user:
        raise HTTPException(404, "Sender not found")

    to_user = db.query(User).filter(User.user_id == payload.to_user_id).with_for_update().first()
    if not to_user:
        raise HTTPException(404, "Recipient not found")

    from_balance_q = db.query(UserBalance).filter(
        UserBalance.user_id == payload.from_user_id,
        UserBalance.currency_id == payload.currency_id,
    )
    from_balance_q = from_balance_q.filter(
        UserBalance.network_id == payload.network_id if payload.network_id else UserBalance.network_id.is_(None)
    )
    from_balance = from_balance_q.first()

    if not from_balance or from_balance.available_balance < payload.amount:
        avail = float(from_balance.available_balance) if from_balance else 0
        raise HTTPException(400, f"Insufficient balance. Available: {avail} {currency.symbol}")

    to_balance_q = db.query(UserBalance).filter(
        UserBalance.user_id == payload.to_user_id,
        UserBalance.currency_id == payload.currency_id,
    )
    to_balance_q = to_balance_q.filter(
        UserBalance.network_id == payload.network_id if payload.network_id else UserBalance.network_id.is_(None)
    )
    to_balance = to_balance_q.first()

    if not to_balance:
        to_balance = UserBalance(
            user_id=payload.to_user_id,
            currency_id=payload.currency_id,
            network_id=payload.network_id,
            available_balance=0,
            frozen_balance=0,
        )
        db.add(to_balance)
        db.flush()

    from_balance.available_balance -= payload.amount
    to_balance.available_balance += payload.amount

    db.add(Transaction(
        user_id=payload.from_user_id, amount=-payload.amount,
        currency_id=payload.currency_id, network_id=payload.network_id,
        type="internal-sent", status="completed",
        tx_hash=f"internal→user#{payload.to_user_id}", blockchain="internal",
    ))
    tx_recv = Transaction(
        user_id=payload.to_user_id, amount=payload.amount,
        currency_id=payload.currency_id, network_id=payload.network_id,
        type="internal-received", status="completed",
        tx_hash=f"internal←user#{payload.from_user_id}", blockchain="internal",
    )
    db.add(tx_recv)
    db.commit()

    return {
        "success": True,
        "from_user_id": payload.from_user_id,
        "to_user_id": payload.to_user_id,
        "currency": currency.symbol,
        "network": network.name if network else None,
        "amount": payload.amount,
        "from_new_balance": float(from_balance.available_balance),
        "to_new_balance": float(to_balance.available_balance),
    }

# =========================
# GET USERNAME By ID
# =========================

@router.get("/username/{user_id}")
def get_username_by_id(
    user_id: int,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_current_user),
):
    """Given a user_id, return {"user_id": ..., "username": ...}."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user_id": user.user_id, "username": user.username}
# =========================
# GET SINGLE USER
# =========================
@router.get("/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db_rls), user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(403, "Not authorized")


    db_user = db.query(User).filter(User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(404, "User not found")

    # Admins can only view their own users
    if not is_master(user) and db_user.admin_id != user.get("user_id"):
        raise HTTPException(403, "Not authorized to view this user")

    return serialize_user(db_user, db)


# =========================
# GET USER ORDERS
# =========================
@router.get("/{user_id}/orders")
def get_user_orders(user_id: int, db: Session = Depends(get_db_rls), user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(403, "Not authorized")
    
        
    if not has_access(user, "orders.view"):
        raise HTTPException(403, "Access denied")

    orders = db.query(OrderItem).filter(OrderItem.user_id == user_id)\
        .order_by(OrderItem.created_at.desc()).all()

    return [build_order_response(o, db) for o in orders]


# =========================
# GET USER TRANSACTIONS
# =========================
@router.get("/{user_id}/transactions")
def get_user_transactions(
    user_id: int, 
    db: Session = Depends(get_db_rls), 
    admin=Depends(get_current_user)
    ):
    if not is_admin_or_above(admin):
        raise HTTPException(403, "Not authorized")
    
    if not has_access(admin, "transactions.view"):
        raise HTTPException(403, "Access denied")

    transactions = db.query(Transaction).filter(Transaction.user_id == user_id)\
        .order_by(Transaction.id.desc()).all()


    result = []
    for t in transactions:
        currency = db.query(Currency).filter(Currency.id == t.currency_id).first()
        network = db.query(Network).filter(Network.id == t.network_id).first() if t.network_id else None
        order = db.query(OrderItem).filter(OrderItem.id == t.order_id).first() if t.order_id else None
        product = order.product if order and order.product else None

        result.append({
            "id": t.id, "order_id": t.order_id, "user_id": t.user_id,
            "wire_transfer_order_id": t.wire_transfer_order_id,
            "type": t.type, "status": t.status,
            "amount": float(t.amount or 0), "created_at": t.created_at,
            "currency": {"id": currency.id if currency else None, "symbol": currency.symbol if currency else "N/A"},
            "network": {"id": network.id, "name": network.name, "chain": network.chain} if network else None,
            "product": {"id": product.id, "name": product.name, "type": product.product_type, "plan": product.plan} if product else None,
            "order": {"id": order.id, "price": float(order.price), "currency": order.currency} if order else None,
            "tx_hash": t.tx_hash, "wallet_address": t.wallet_address,
            "blockchain": t.blockchain, "confirmations": t.confirmations,
        })

    return result


# =========================
# UPDATE USER BALANCE
# =========================
@router.post("/{user_id}/balance")
def update_balance(
    user_id: int, 
    payload: BalanceUpdate, 
    db: Session = Depends(get_db_rls), 
    admin=Depends(get_current_user)
    ):
    if not is_admin_or_above(admin):
        raise HTTPException(403, "Not authorized")
    
    if not has_access(admin, "balance.manage"):
        raise HTTPException(403, "Access denied")

    if payload.action not in ["deposit", "withdraw"]:
        raise HTTPException(400, "Invalid action")

    currency = db.query(Currency).filter(Currency.id == payload.currency_id).first()
    if not currency:
        raise HTTPException(404, "Currency not found")

    user_obj = db.query(User).filter(User.user_id == user_id).with_for_update().first()
    if not user_obj:
        raise HTTPException(404, "User not found")

    balance_row = db.query(UserBalance).filter(
        UserBalance.user_id == user_id,
        UserBalance.currency_id == payload.currency_id,
        UserBalance.network_id == payload.network_id
    ).first()

    admin_balance_row = db.query(UserBalance).filter(
        UserBalance.user_id == admin["user_id"],
        UserBalance.currency_id == payload.currency_id,
        UserBalance.network_id == payload.network_id
    ).first()



    if not balance_row:
        balance_row = UserBalance(
            user_id=user_id, 
            currency_id=payload.currency_id,
            network_id=payload.network_id, 
            available_balance=0, 
            frozen_balance=0
        )
        db.add(balance_row)
        db.flush()

        # Admin is enabling a new (non-default) pair for this user via
        # Balance Management - make sure the user also gets a deposit
        # wallet for it, matching the same on-demand creation used by the
        # bot's deposit flow. Best-effort: skip silently for non-blockchain
        # networks (e.g. INTERNAL) where address derivation doesn't apply.
        if payload.network_id:
            try:
                get_or_create_wallet_for_pair(
                    user_id=user_id,
                    currency_id=payload.currency_id,
                    network_id=payload.network_id,
                    db=db,
                )
            except Exception:
                pass

    if not admin_balance_row:
        admin_balance_row = UserBalance(
            user_id=admin["user_id"],
            currency_id=payload.currency_id,
            network_id=payload.network_id,
            available_balance=0,
            frozen_balance=0
        )
        db.add(admin_balance_row)
        db.flush()

    amount = float(payload.amount)

    master_mode = is_master(admin)

    if payload.action == "deposit":

        if not master_mode:
            if admin_balance_row.available_balance < amount:
                raise HTTPException(400, "Insufficient Admin balance")

            admin_balance_row.available_balance -= amount
            admin_tx_amount = -amount
        else:
            admin_tx_amount = 0
            # it must trasnfer this amount from system master wallet to this user
            # # so master needs to top up their wallet first and withdraw the amount from masetr wallet to its wallet  

        balance_row.available_balance += amount
        user_tx_amount = amount

    else:  # withdraw

        if balance_row.available_balance < amount:
            raise HTTPException(400, "Insufficient User balance")

        balance_row.available_balance -= amount
        user_tx_amount = -amount

        if not master_mode:
            admin_balance_row.available_balance += amount
            admin_tx_amount = amount
        else:
            admin_tx_amount = 0


    # TX for USer
    if not master_mode:
        transaction_type = ADMIN_DEPOSIT if payload.action == "deposit" else ADMIN_WITHDRAW
    else: 
        transaction_type = MASTER_DEPOSIT if payload.action == "deposit" else MASTER_WITHDRAW


    db.add(Transaction(
        user_id=user_obj.user_id, 
        amount=user_tx_amount,
        currency_id=payload.currency_id,
        type=transaction_type,
        status=COMPLETED, 
        blockchain="internal",
        platform_bank_account_id=payload.platform_bank_account_id,
    ))

    if not master_mode:

        db.add(Transaction(
            user_id=admin["user_id"], 
            amount=admin_tx_amount,
            currency_id=payload.currency_id,
            type="deposit_to_user" if payload.action == "deposit" else "deposit_from_user",
            status=COMPLETED, 
            blockchain="internal",
            platform_bank_account_id=payload.platform_bank_account_id,
        ))

    db.commit()

    return {"success": True, "new_balance": balance_row.available_balance}


@router.delete("/{user_id}/balance")
def delete_balance(
    user_id: int,
    payload: BalanceDeleteRequest,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_current_user)
):
    if not is_admin_or_above(admin):
        raise HTTPException(403, "Not authorized")

    if not has_access(admin, "balance.manage"):
        raise HTTPException(403, "Access denied")

    user_obj = db.query(User).filter(User.user_id == user_id).first()
    if not user_obj:
        raise HTTPException(404, "User not found")

    currency = db.query(Currency).filter(Currency.id == payload.currency_id).first()
    if not currency:
        raise HTTPException(404, "Currency not found")

    balance_query = db.query(UserBalance).filter(
        UserBalance.user_id == user_id,
        UserBalance.currency_id == payload.currency_id,
    )
    if payload.network_id is None:
        balance_query = balance_query.filter(UserBalance.network_id.is_(None))
    else:
        balance_query = balance_query.filter(UserBalance.network_id == payload.network_id)
    balance_row = balance_query.first()

    if not balance_row:
        raise HTTPException(404, "Balance row not found")

    if float(balance_row.available_balance or 0) != 0 or float(balance_row.frozen_balance or 0) != 0:
        raise HTTPException(400, "Only zero balances can be deleted")

    pair = None
    if payload.network_id is not None:
        pair = db.query(CurrencyNetwork).filter(
            CurrencyNetwork.currency_id == payload.currency_id,
            CurrencyNetwork.network_id == payload.network_id,
        ).first()
        if pair and pair.is_default:
            raise HTTPException(400, "Default balances cannot be deleted")

    tx_query = db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.currency_id == payload.currency_id,
    )
    if payload.network_id is None:
        tx_query = tx_query.filter(Transaction.network_id.is_(None))
    else:
        tx_query = tx_query.filter(Transaction.network_id == payload.network_id)
    existing_tx = tx_query.first()
    if existing_tx:
        raise HTTPException(400, "This balance has transaction history and cannot be deleted")

    wallet_deleted = 0
    external_deleted = 0
    if payload.network_id is not None:
        wallet_deleted = db.query(UserWallet).filter(
            UserWallet.user_id == user_id,
            UserWallet.currency_id == payload.currency_id,
            UserWallet.network_id == payload.network_id,
        ).delete()
        external_deleted = db.query(ExternalWallet).filter(
            ExternalWallet.user_id == user_id,
            ExternalWallet.currency_id == payload.currency_id,
            ExternalWallet.network_id == payload.network_id,
        ).delete()

    db.delete(balance_row)
    db.commit()

    return {
        "success": True,
        "message": "Balance deleted successfully",
        "wallet_deleted": wallet_deleted > 0,
        "external_wallet_deleted": external_deleted > 0,
    }


# =========================
# GET WALLET PAIR DETAILS (deposit address + external wallet)
# Used by the admin dashboard Wallet tab when a currency/network row is opened.
# =========================
@router.get("/{user_id}/wallet-pair")
def get_user_wallet_pair(
    user_id: int,
    currency_id: int,
    network_id: int,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_current_user)
):
    if not is_admin_or_above(admin):
        raise HTTPException(403, "Not authorized")

    if not has_access(admin, "balance.manage"):
        raise HTTPException(403, "Access denied")

    user_obj = db.query(User).filter(User.user_id == user_id).first()
    if not user_obj:
        raise HTTPException(404, "User not found")

    pair = db.query(CurrencyNetwork).filter(
        CurrencyNetwork.currency_id == currency_id,
        CurrencyNetwork.network_id == network_id
    ).first()
    if not pair:
        raise HTTPException(404, "Currency/network pair not found")

    deposit_wallet = db.query(UserWallet).filter(
        UserWallet.user_id == user_id,
        UserWallet.currency_id == currency_id,
        UserWallet.network_id == network_id
    ).first()

    deposit_address = deposit_wallet.address if deposit_wallet else None

    # Auto-create the deposit wallet on first view if the pair supports it
    # (e.g. skips gracefully for non-blockchain/internal networks).
    if not deposit_address and pair.is_active and pair.deposit_enabled:
        try:
            deposit_address, _ = get_or_create_wallet_for_pair(
                user_id=user_id,
                currency_id=currency_id,
                network_id=network_id,
                db=db,
            )
        except Exception:
            deposit_address = None

    external_wallet = db.query(ExternalWallet).filter(
        ExternalWallet.user_id == user_id,
        ExternalWallet.currency_id == currency_id,
        ExternalWallet.network_id == network_id
    ).first()

    return {
        "currency_id": currency_id,
        "currency": pair.currency.symbol if pair.currency else None,
        "network_id": network_id,
        "network": pair.network.chain if pair.network else None,
        "deposit_address": deposit_address,
        "external_wallet_address": external_wallet.address if external_wallet else None,
        "min_deposit": float(pair.min_deposit or 0),
        "max_deposit": float(pair.max_deposit or 0),
    }


class WalletPairUpdate(BaseModel):
    currency_id: int
    network_id: int
    deposit_address: str | None = None
    external_wallet_address: str | None = None


@router.put("/{user_id}/wallet-pair")
def update_user_wallet_pair(
    user_id: int,
    payload: WalletPairUpdate,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_current_user)
):
    """
    Admin override for a user's deposit address and/or external (withdrawal
    destination) wallet address for a given currency/network pair.
    Passing null/omitting a field leaves it unchanged; if the deposit address
    doesn't exist yet it will be created (auto-derived) unless an explicit
    address override is provided.
    """
    if not is_admin_or_above(admin):
        raise HTTPException(403, "Not authorized")

    if not has_access(admin, "balance.manage"):
        raise HTTPException(403, "Access denied")

    user_obj = db.query(User).filter(User.user_id == user_id).first()
    if not user_obj:
        raise HTTPException(404, "User not found")

    pair = db.query(CurrencyNetwork).filter(
        CurrencyNetwork.currency_id == payload.currency_id,
        CurrencyNetwork.network_id == payload.network_id
    ).first()
    if not pair:
        raise HTTPException(404, "Currency/network pair not found")

    if payload.deposit_address is not None:
        deposit_address = payload.deposit_address.strip()
        if not deposit_address:
            raise HTTPException(400, "Deposit address cannot be empty")

        deposit_wallet = db.query(UserWallet).filter(
            UserWallet.user_id == user_id,
            UserWallet.currency_id == payload.currency_id,
            UserWallet.network_id == payload.network_id
        ).first()

        if deposit_wallet:
            deposit_wallet.address = deposit_address
        else:
            db.add(UserWallet(
                user_id=user_id,
                currency_id=payload.currency_id,
                network_id=payload.network_id,
                address=deposit_address,
                index=0,
            ))

    if payload.external_wallet_address is not None:
        external_address = payload.external_wallet_address.strip()
        if not external_address:
            raise HTTPException(400, "External wallet address cannot be empty")

        external_wallet = db.query(ExternalWallet).filter(
            ExternalWallet.user_id == user_id,
            ExternalWallet.currency_id == payload.currency_id,
            ExternalWallet.network_id == payload.network_id
        ).first()

        if external_wallet:
            external_wallet.address = external_address
        else:
            db.add(ExternalWallet(
                user_id=user_id,
                currency_id=payload.currency_id,
                network_id=payload.network_id,
                address=external_address,
            ))

    db.commit()

    deposit_wallet = db.query(UserWallet).filter(
        UserWallet.user_id == user_id,
        UserWallet.currency_id == payload.currency_id,
        UserWallet.network_id == payload.network_id
    ).first()

    external_wallet = db.query(ExternalWallet).filter(
        ExternalWallet.user_id == user_id,
        ExternalWallet.currency_id == payload.currency_id,
        ExternalWallet.network_id == payload.network_id
    ).first()

    return {
        "currency_id": payload.currency_id,
        "network_id": payload.network_id,
        "deposit_address": deposit_wallet.address if deposit_wallet else None,
        "external_wallet_address": external_wallet.address if external_wallet else None,
    }



# =========================
@router.post("/{user_id}/update")
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db_rls), user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(403, "Not authorized")


    if not has_access(user, "users.manage"):
        raise HTTPException(403, "Access denied")

    db_user = db.query(User).filter(User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(404, "User not found")

    # Admins can only update their own users
    if not is_master(user) and db_user.admin_id != user.get("user_id"):
        raise HTTPException(403, "Not authorized to update this user")

    # =========================
    # BASIC INFO
    # =========================
    if payload.username is not None:
        db_user.username = payload.username

    if payload.status is not None:
        db_user.status = payload.status

    if payload.role is not None and is_master(user):
        db_user.role = payload.role

    # =========================
    # PROFILE FIELDS (NEW UI SUPPORT)
    # =========================
    if payload.first_name is not None:
        db_user.first_name = payload.first_name

    if payload.last_name is not None:
        db_user.last_name = payload.last_name

    if payload.phone_number is not None:
        db_user.phone_number = payload.phone_number

    if payload.email is not None:
        db_user.email = payload.email

    # =========================
    # PERMISSIONS
    # =========================
    db.commit()

    # =========================
    # PERMISSIONS (routed through provenance layer — only master-sourced
    # grants are touched; plan/addon-sourced access points are untouched)
    # =========================
    if payload.access_points is not None:
        sync_master_grants(db, db_user.user_id, payload.access_points)

    return {"message": "User updated"}


# =========================
# DELETE USER
# =========================
@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db_rls), user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(403, "Not authorized")
    
    if not has_access(user, "users.delete"):
        raise HTTPException(403, "Access denied")

    db_user = db.query(User).filter(User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(404, "User not found")

    # Admins can only delete their own users; masters can delete anyone except other masters
    if not is_master(user) and db_user.admin_id != user.get("user_id"):
        raise HTTPException(403, "Not authorized to delete this user")

    if db_user.role == "master":
        raise HTTPException(403, "Cannot delete a master account via this endpoint")

    db.delete(db_user)
    db.commit()
    return {"message": "User deleted"}


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_current_user)
):

    if not is_admin_or_above(admin):
        raise HTTPException(403, "Not authorized")

    if not has_access(admin, "users.manage"):
        raise HTTPException(403, "Access denied")

    db_user = db.query(User).filter(User.user_id == user_id).first()

    if not db_user:
        raise HTTPException(404, "User not found")

    # Admin restriction: only own users
    if not is_master(admin) and db_user.admin_id != admin.get("user_id"):
        raise HTTPException(403, "Not allowed to reset this user")
    
    new_password = payload.new_password if payload else None

    result = reset_user_password(
        db=db,
        user=db_user,
        new_password=new_password
    )

    return {
        "success": True,
        "user_id": result["user_id"],
        "username": result["username"],
        "new_password": result["new_password"]
    }
@router.put("/{user_id}/bank-info")
def update_user_bank_info(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user),
):
    if not is_admin_or_above(user):
        raise HTTPException(403, "Not authorized")
    if not (has_access(user, "users.manage") or has_access(user, "balance.manage")):
        raise HTTPException(403, "Access denied")

    db_user = db.query(User).filter(User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(404, "User not found")

    bank_info = db.query(UserBankInfo).filter(UserBankInfo.user_id == user_id).first()
    if not bank_info:
        bank_info = UserBankInfo(user_id=user_id)
        db.add(bank_info)

    for field in ["bank_holder_name", "bank_card_number", "bank_name", "bank_sheba"]:
        if field in payload:
            setattr(bank_info, field, payload.get(field))

    db.commit()
    db.refresh(bank_info)

    return {
        "bank_holder_name": bank_info.bank_holder_name,
        "bank_card_number": bank_info.bank_card_number,
        "bank_name": bank_info.bank_name,
        "bank_sheba": bank_info.bank_sheba,
    }
