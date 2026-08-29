from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.models.platform_wallet_config import PlatformWalletConfig
from app.core.rls import get_db_rls
from app.core.security import get_current_user, is_master
from app.models.user import User
from app.models.user_balance import UserBalance
from app.models.currency import Currency
from app.models.network import Network

router = APIRouter(prefix="/admin-account", tags=["Admin Account"])


def get_admin(user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "master"):
        raise HTTPException(403, "Admin access required")
    return user


# =========================
# ADMIN INFO
# =========================
@router.get("/me")
def get_my_admin_profile(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    """
    Full profile for the logged-in admin/master: every relevant column on
    the User model, plus role-derived flags the frontend needs to decide
    which extra menu sections to render (is_master -> Master Wallet menu).
    """
    row = db.query(User).filter(User.user_id == admin["user_id"]).first()
    if not row:
        raise HTTPException(404, "User not found")

    return {
        "user_id": row.user_id,
        "username": row.username,
        "first_name": row.first_name,
        "last_name": row.last_name,
        "phone_number": row.phone_number,
        "email": row.email,
        "telegram_id": row.telegram_id,
        "account_id": row.account_id,
        "status": row.status,
        "role": row.role,
        "admin_id": row.admin_id,
        "invited_by": row.invited_by,
        "language": row.language,
        "access_points": row.access_points,
        "created_at": row.created_at,
        "created_date": row.created_date,
        "is_master": row.role == "master",
    }


# =========================
# RICH PER-NETWORK BALANCES
# (mirrors the shape UserSidebar's WalletTab already consumes)
# =========================
@router.get("/balances")
def get_my_rich_balances(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    balances = (
        db.query(UserBalance)
        .join(Currency, UserBalance.currency_id == Currency.id)
        .outerjoin(Network, UserBalance.network_id == Network.id)
        .filter(UserBalance.user_id == admin["user_id"])
        .all()
    )

    result = []
    for b in balances:
        result.append({
            "currency_id": b.currency_id,
            "currency": b.currency.symbol if b.currency else "UNKNOWN",
            "network_id": b.network_id,
            "network": b.network.name if b.network else None,
            "network_chain": b.network.chain if b.network else None,
            "available": float(b.available_balance or 0),
            "frozen": float(b.frozen_balance or 0),
        })

    return {"balances": result}


# =========================
# DEPOSIT DESTINATION INFO (read-only, any admin)
# Used by UserBalanceSidebar to show "where do I send funds" for the
# selected currency/network — crypto address or IRT bank info, whichever
# master has configured and marked active. Purely informational; the
# actual deposit-credit path for crypto is still the per-user Tatum wallet
# (see /admin/users/{id}/wallet-pair), and IRT deposits are settled
# manually by master after reviewing the receipt in Messages.
# =========================
@router.get("/deposit-info")
def get_deposit_info(
    currency_id: int,
    network_id: Optional[int] = None,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    query = db.query(PlatformWalletConfig).filter(
        PlatformWalletConfig.currency_id == currency_id,
        PlatformWalletConfig.is_active == True,
    )
    if network_id is not None:
        query = query.filter(PlatformWalletConfig.network_id == network_id)
    else:
        query = query.filter(PlatformWalletConfig.network_id.is_(None))

    cfg = query.first()
    if not cfg:
        return {"found": False}

    return {
        "found": True,
        "deposit_address": cfg.deposit_address,
        "bank_name": cfg.bank_name,
        "bank_holder_name": cfg.bank_holder_name,
        "bank_card_number": cfg.bank_card_number,
        "bank_sheba": cfg.bank_sheba,
        "label": cfg.label,
        "note": cfg.note,
    }