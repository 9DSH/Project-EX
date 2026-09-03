from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.rls import get_db_rls
from app.core.security import get_current_user, is_master
from app.models.currency import Currency
from app.models.currency_network import CurrencyNetwork
from app.models.external_wallet import ExternalWallet
from app.models.failed_sweeps import FailedSweep
from app.models.messages import Conversation, Message
from app.models.network import Network
from app.models.platform_bank_account import PlatformBankAccount
from app.models.transaction import Transaction
from app.models.user import User, UserWallet
from app.models.user_balance import UserBalance
from app.models.user_bank_info import UserBankInfo
from app.services.currency_network_service import resolve_currency_network_pair
from app.services.key_derivation_service import derive_hot_wallet
from app.services.tatum_service import get_native_tatum_symbol, get_recommended_blockchain_fee
from app.services.wallet_monitor import get_wallet_status
from app.services.wallet_derivation_service import get_or_create_wallet_for_pair

router = APIRouter(prefix="/admin-account", tags=["Admin Account"])

INTERNAL_KIND = "internal"
WITHDRAW_TYPE = "withdraw"
PENDING_STATUS = "pending"

NATIVE_SYMBOL_BY_CHAIN = {
    "BSC": "BNB",
    "ETH": "ETH",
    "BASE": "ETH",
    "TRON": "TRX",
    "TRX": "TRX",
}


class AdminProfileUpdatePayload(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None


class AdminBankInfoPayload(BaseModel):
    bank_holder_name: Optional[str] = None
    bank_card_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_sheba: Optional[str] = None


class IrtWithdrawalRequest(BaseModel):
    amount: float
    note: Optional[str] = None


def get_admin(user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "master"):
        raise HTTPException(403, "Admin access required")
    return user


def _safe_iso(value):
    return value.isoformat() if value else None


def _serialize_bank_info(bank_info: Optional[UserBankInfo]):
    if not bank_info:
        return {
            "bank_holder_name": None,
            "bank_card_number": None,
            "bank_name": None,
            "bank_sheba": None,
        }
    return {
        "bank_holder_name": bank_info.bank_holder_name,
        "bank_card_number": bank_info.bank_card_number,
        "bank_name": bank_info.bank_name,
        "bank_sheba": bank_info.bank_sheba,
    }


def _normalize_name_for_match(value: Optional[str]) -> str:
    return "".join(ch.lower() for ch in (value or "").strip() if ch.isalnum())


def _serialize_bank_info_state(user_row: User, bank_info: Optional[UserBankInfo]):
    profile_full_name = " ".join(part for part in [user_row.first_name, user_row.last_name] if part).strip()
    holder_name = bank_info.bank_holder_name if bank_info else None
    profile_normalized = _normalize_name_for_match(profile_full_name)
    holder_normalized = _normalize_name_for_match(holder_name)
    holder_name_matches_profile = True
    if profile_normalized and holder_normalized:
        holder_name_matches_profile = profile_normalized == holder_normalized

    return {
        "bank_info": _serialize_bank_info(bank_info),
        "is_complete": bool(
            bank_info
            and bank_info.bank_holder_name
            and bank_info.bank_card_number
            and bank_info.bank_name
            and bank_info.bank_sheba
        ),
        "profile_full_name": profile_full_name or None,
        "holder_name_matches_profile": holder_name_matches_profile,
        "warning": (
            "Bank account holder name does not match your profile full name."
            if profile_normalized and holder_normalized and not holder_name_matches_profile
            else None
        ),
    }


def _serialize_profile(user_row: User, bank_info: Optional[UserBankInfo]):
    return {
        "user_id": user_row.user_id,
        "username": user_row.username,
        "first_name": user_row.first_name,
        "last_name": user_row.last_name,
        "full_name": " ".join(part for part in [user_row.first_name, user_row.last_name] if part).strip() or None,
        "phone_number": user_row.phone_number,
        "email": user_row.email,
        "telegram_id": user_row.telegram_id,
        "account_id": user_row.account_id,
        "status": user_row.status,
        "role": user_row.role,
        "admin_id": user_row.admin_id,
        "invited_by": user_row.invited_by,
        "language": user_row.language,
        "access_points": user_row.access_points,
        "created_at": _safe_iso(user_row.created_at),
        "created_date": _safe_iso(user_row.created_date),
        "is_master": user_row.role == "master",
        "bank_info": _serialize_bank_info(bank_info),
        "bank_info_complete": bool(
            bank_info
            and bank_info.bank_holder_name
            and bank_info.bank_card_number
            and bank_info.bank_name
            and bank_info.bank_sheba
        ),
    }


def _serialize_balances(db: Session, user_id: int):
    rows = (
        db.query(
            UserBalance.currency_id,
            UserBalance.network_id,
            UserBalance.available_balance,
            UserBalance.frozen_balance,
            Currency.symbol.label("currency_symbol"),
            Currency.name.label("currency_name"),
            Currency.type.label("currency_type"),
            Network.name.label("network_name"),
            Network.chain.label("network_chain"),
        )
        .join(Currency, UserBalance.currency_id == Currency.id)
        .outerjoin(Network, UserBalance.network_id == Network.id)
        .filter(UserBalance.user_id == user_id)
        .order_by(Currency.symbol.asc(), Network.chain.asc().nullsfirst())
        .all()
    )

    return [{
        "currency_id": row.currency_id,
        "currency": row.currency_symbol,
        "currency_name": row.currency_name,
        "currency_type": row.currency_type,
        "network_id": row.network_id,
        "network": row.network_name,
        "network_chain": row.network_chain,
        "available": float(row.available_balance or 0),
        "frozen": float(row.frozen_balance or 0),
        "total": float((row.available_balance or 0) + (row.frozen_balance or 0)),
    } for row in rows]


def _serialize_external_wallets(db: Session, user_id: int):
    rows = (
        db.query(
            ExternalWallet.currency_id,
            ExternalWallet.network_id,
            ExternalWallet.address,
            ExternalWallet.updated_at,
            Currency.symbol.label("currency_symbol"),
            Network.name.label("network_name"),
            Network.chain.label("network_chain"),
        )
        .join(Currency, ExternalWallet.currency_id == Currency.id)
        .join(Network, ExternalWallet.network_id == Network.id)
        .filter(ExternalWallet.user_id == user_id)
        .order_by(Currency.symbol.asc(), Network.chain.asc())
        .all()
    )
    return [{
        "currency_id": row.currency_id,
        "currency": row.currency_symbol,
        "network_id": row.network_id,
        "network": row.network_name,
        "network_chain": row.network_chain,
        "address": row.address,
        "updated_at": _safe_iso(row.updated_at),
    } for row in rows]


def _serialize_available_pairs(db: Session):
    rows = (
        db.query(CurrencyNetwork, Currency, Network)
        .join(Currency, CurrencyNetwork.currency_id == Currency.id)
        .join(Network, CurrencyNetwork.network_id == Network.id)
        .filter(
            CurrencyNetwork.is_active == True,
            Currency.is_active == True,
            Network.is_active == True,
        )
        .order_by(Currency.symbol.asc(), Network.chain.asc())
        .all()
    )
    return [{
        "id": pair.id,
        "currency_id": currency.id,
        "currency": currency.symbol,
        "currency_name": currency.name,
        "currency_type": currency.type,
        "network_id": network.id,
        "network": network.name,
        "network_chain": network.chain,
        "deposit_enabled": pair.deposit_enabled,
        "withdraw_enabled": pair.withdraw_enabled,
        "min_deposit": float(pair.min_deposit or 0),
        "max_deposit": float(pair.max_deposit or 0),
        "min_withdraw": float(pair.min_withdraw or 0),
        "withdraw_fee": float(pair.withdraw_fee or 0),
        "confirmations_required": int(pair.confirmations_required or 1),
    } for pair, currency, network in rows]


def _get_active_platform_bank_account(db: Session):
    account = (
        db.query(PlatformBankAccount)
        .filter(
            PlatformBankAccount.is_active == True,
            PlatformBankAccount.platform_kind == "wires",
        )
        .order_by(PlatformBankAccount.id.desc())
        .first()
    )
    if not account:
        account = (
            db.query(PlatformBankAccount)
            .filter(PlatformBankAccount.is_active == True)
            .order_by(PlatformBankAccount.id.desc())
            .first()
        )
    if not account:
        return None
    return {
        "id": account.id,
        "admin_id": account.admin_id,
        "platform_kind": account.platform_kind or "general",
        "bank_name": account.bank_name,
        "bank_holder_name": account.bank_holder_name,
        "bank_card_number": account.bank_card_number,
        "bank_sheba": account.bank_sheba,
        "is_active": account.is_active,
        "created_at": _safe_iso(account.created_at),
        "updated_at": _safe_iso(account.updated_at),
    }


def _estimate_fee_tiers(chain: str):
    normalized_chain = "TRON" if chain.upper() in {"TRON", "TRX"} else chain.upper()
    native_symbol = NATIVE_SYMBOL_BY_CHAIN.get(normalized_chain, normalized_chain)
    try:
        response = get_recommended_blockchain_fee(normalized_chain)
    except Exception as exc:
        return {
            "chain": normalized_chain,
            "native_symbol": native_symbol,
            "available": False,
            "error": str(exc),
            "tiers": [],
        }

    raw_prices = response.get("gasPrice") if isinstance(response.get("gasPrice"), dict) else response
    tiers = []
    for label in ("slow", "medium", "fast", "baseFee"):
        raw_value = raw_prices.get(label) if isinstance(raw_prices, dict) else None
        if raw_value is None:
            continue
        try:
            numeric_value = float(raw_value)
        except (TypeError, ValueError):
            numeric_value = None

        approx_fee = None
        if numeric_value is not None and normalized_chain in {"BSC", "ETH", "BASE"}:
            approx_fee = (numeric_value * 21000) / 1_000_000_000

        tiers.append({
            "label": label,
            "amount": numeric_value,
            "unit": "gwei" if normalized_chain in {"BSC", "ETH", "BASE"} else native_symbol,
            "approx_fee": approx_fee,
            "approx_fee_symbol": native_symbol if approx_fee is not None else None,
        })

    return {
        "chain": normalized_chain,
        "native_symbol": native_symbol,
        "available": len(tiers) > 0,
        "tiers": tiers,
    }


def _build_failed_sweep_trail(db: Session, sweep: FailedSweep, hot_address: Optional[str], master_address: Optional[str]):
    currency_row = db.query(Currency).filter(Currency.symbol == sweep.currency_symbol.upper()).first()
    network_row = None
    if sweep.network:
        network_row = db.query(Network).filter(Network.chain == sweep.network.upper()).first()

    user_wallet = None
    if currency_row and network_row:
        user_wallet = (
            db.query(UserWallet)
            .filter(
                UserWallet.user_id == sweep.user_id,
                UserWallet.currency_id == currency_row.id,
                UserWallet.network_id == network_row.id,
            )
            .first()
        )

    tx_query = (
        db.query(Transaction)
        .filter(Transaction.user_id == sweep.user_id)
        .order_by(Transaction.created_at.desc())
    )
    if currency_row:
        tx_query = tx_query.filter(Transaction.currency_id == currency_row.id)
    if network_row:
        tx_query = tx_query.filter(Transaction.network_id == network_row.id)
    tx_rows = tx_query.limit(5).all()

    return {
        "source_wallet": user_wallet.address if user_wallet else None,
        "hot_wallet": hot_address,
        "master_wallet": master_address,
        "recent_transactions": [{
            "id": tx.id,
            "type": tx.type,
            "status": tx.status,
            "amount": float(tx.amount or 0),
            "tx_hash": tx.tx_hash,
            "wallet_address": tx.wallet_address,
            "created_at": _safe_iso(tx.created_at),
        } for tx in tx_rows],
    }


def _serialize_platform_transactions(db: Session, hot_address: Optional[str]):
    rows = (
        db.query(Transaction, User.username, Currency.symbol, Network.chain)
        .join(User, User.user_id == Transaction.user_id)
        .outerjoin(Currency, Currency.id == Transaction.currency_id)
        .outerjoin(Network, Network.id == Transaction.network_id)
        .filter(Transaction.type.in_(["deposit", "sweep", "sweep_exchange", "withdraw", "withdrawal"]))
        .order_by(desc(Transaction.created_at))
        .limit(80)
        .all()
    )

    items = []
    for tx, username, currency_symbol, network_chain in rows:
        inferred_from = None
        inferred_to = tx.wallet_address
        if tx.type in {"sweep", "sweep_exchange"}:
            inferred_to = hot_address
        elif tx.type == "deposit":
            inferred_to = tx.wallet_address
        elif tx.type in {"withdraw", "withdrawal"}:
            inferred_from = hot_address if tx.status != PENDING_STATUS else None

        items.append({
            "id": tx.id,
            "user_id": tx.user_id,
            "username": username,
            "currency": currency_symbol,
            "network": network_chain,
            "amount": float(tx.amount or 0),
            "type": tx.type,
            "status": tx.status,
            "tx_hash": tx.tx_hash,
            "wallet_address": tx.wallet_address,
            "from_address": inferred_from,
            "to_address": inferred_to,
            "created_at": _safe_iso(tx.created_at),
        })
    return items


def _get_or_create_internal_conversation(db: Session, user_id: int):
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == user_id,
        )
        .first()
    )
    if conversation:
        if conversation.kind != INTERNAL_KIND:
            conversation.kind = INTERNAL_KIND
            db.commit()
        return conversation

    conversation = Conversation(user_id=user_id, kind=INTERNAL_KIND)
    db.add(conversation)
    try:
        db.commit()
        db.refresh(conversation)
    except IntegrityError:
        db.rollback()
        conversation = (
            db.query(Conversation)
            .filter(Conversation.user_id == user_id)
            .first()
        )
        if not conversation:
            raise
    return conversation


@router.get("/me")
def get_my_admin_profile(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    row = db.query(User).filter(User.user_id == admin["user_id"]).first()
    if not row:
        raise HTTPException(404, "User not found")
    bank_info = db.query(UserBankInfo).filter(UserBankInfo.user_id == row.user_id).first()
    return _serialize_profile(row, bank_info)


@router.put("/me")
def update_my_admin_profile(
    payload: AdminProfileUpdatePayload,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    row = db.query(User).filter(User.user_id == admin["user_id"]).first()
    if not row:
        raise HTTPException(404, "User not found")

    for field in ("first_name", "last_name", "email", "phone_number"):
        value = getattr(payload, field)
        if value is not None:
            setattr(row, field, value)

    db.commit()
    bank_info = db.query(UserBankInfo).filter(UserBankInfo.user_id == row.user_id).first()
    return _serialize_profile(row, bank_info)


@router.get("/bank-info")
def get_my_admin_bank_info(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    row = db.query(User).filter(User.user_id == admin["user_id"]).first()
    if not row:
        raise HTTPException(404, "User not found")
    bank_info = db.query(UserBankInfo).filter(UserBankInfo.user_id == row.user_id).first()
    return _serialize_bank_info_state(row, bank_info)


@router.put("/bank-info")
def upsert_my_admin_bank_info(
    payload: AdminBankInfoPayload,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    row = db.query(User).filter(User.user_id == admin["user_id"]).first()
    if not row:
        raise HTTPException(404, "User not found")

    bank_info = db.query(UserBankInfo).filter(UserBankInfo.user_id == row.user_id).first()
    if not bank_info:
        bank_info = UserBankInfo(user_id=row.user_id)
        db.add(bank_info)

    for field in ("bank_holder_name", "bank_card_number", "bank_name", "bank_sheba"):
        value = getattr(payload, field)
        if value is not None:
            setattr(bank_info, field, value)

    db.commit()
    db.refresh(bank_info)
    return _serialize_bank_info_state(row, bank_info)


@router.get("/balances")
def get_my_rich_balances(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    return {"balances": _serialize_balances(db, admin["user_id"])}


@router.get("/deposit-info")
def get_my_deposit_info(
    currency_id: int = Query(...),
    network_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    row = db.query(User).filter(User.user_id == admin["user_id"]).first()
    if not row:
        raise HTTPException(404, "User not found")

    currency = db.query(Currency).filter(Currency.id == currency_id).first()
    if not currency:
        raise HTTPException(404, "Currency not found")

    bank_info = db.query(UserBankInfo).filter(UserBankInfo.user_id == row.user_id).first()
    bank_state = _serialize_bank_info_state(row, bank_info)

    if currency.type != "crypto":
        pair = None
        if network_id is not None:
            pair = db.query(CurrencyNetwork).filter(
                CurrencyNetwork.currency_id == currency_id,
                CurrencyNetwork.network_id == network_id,
            ).first()
        else:
            pair = (
                db.query(CurrencyNetwork)
                .filter(CurrencyNetwork.currency_id == currency_id)
                .order_by(CurrencyNetwork.id.asc())
                .first()
            )

        return {
            "method": "irt_manual",
            "currency_id": currency.id,
            "currency": currency.symbol,
            "network_id": pair.network_id if pair else network_id,
            "network": pair.network.chain if pair and pair.network else None,
            "platform_bank_account": _get_active_platform_bank_account(db),
            "user_bank_info": bank_state["bank_info"],
            "user_bank_info_complete": bank_state["is_complete"],
            "bank_info_warning": bank_state["warning"],
            "note": "Transfer the amount to the active platform account, then upload your receipt in the message thread for manual review.",
        }

    if network_id is None:
        raise HTTPException(400, "network_id is required for crypto deposit details")

    pair = (
        db.query(CurrencyNetwork)
        .filter(
            CurrencyNetwork.currency_id == currency_id,
            CurrencyNetwork.network_id == network_id,
            CurrencyNetwork.is_active == True,
        )
        .first()
    )
    if not pair:
        raise HTTPException(404, "Currency/network pair not found")
    if not pair.deposit_enabled:
        raise HTTPException(400, "Deposits are not enabled for this currency/network pair")

    try:
        deposit_address, _ = get_or_create_wallet_for_pair(
            user_id=row.user_id,
            currency_id=currency_id,
            network_id=network_id,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:
        raise HTTPException(500, f"Failed to load deposit address: {exc}")

    balance_row = (
        db.query(UserBalance)
        .filter(
            UserBalance.user_id == row.user_id,
            UserBalance.currency_id == currency_id,
            UserBalance.network_id == network_id,
        )
        .first()
    )
    external_wallet = (
        db.query(ExternalWallet)
        .filter(
            ExternalWallet.user_id == row.user_id,
            ExternalWallet.currency_id == currency_id,
            ExternalWallet.network_id == network_id,
        )
        .first()
    )

    return {
        "method": "crypto",
        "currency_id": currency.id,
        "currency": currency.symbol,
        "network_id": network_id,
        "network": pair.network.chain if pair.network else None,
        "deposit_address": deposit_address,
        "external_wallet_address": external_wallet.address if external_wallet else None,
        "min_deposit": float(pair.min_deposit or 0),
        "max_deposit": float(pair.max_deposit or 0),
        "confirmations_required": int(pair.confirmations_required or 1),
        "current_balance": float(balance_row.available_balance or 0) if balance_row else 0.0,
        "note": "Send funds only on the selected network. Your balance updates after the required on-chain confirmations are reached.",
    }


@router.get("/summary")
def get_my_account_summary(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    row = db.query(User).filter(User.user_id == admin["user_id"]).first()
    if not row:
        raise HTTPException(404, "User not found")

    bank_info = db.query(UserBankInfo).filter(UserBankInfo.user_id == row.user_id).first()
    conversation = _get_or_create_internal_conversation(db, row.user_id)
    unread_master_messages = (
        db.query(func.count(Message.id))
        .filter(
            Message.conversation_id == conversation.id,
            Message.sender == "master",
            Message.is_read == False,
        )
        .scalar()
    )

    return {
        "profile": _serialize_profile(row, bank_info),
        "balances": _serialize_balances(db, row.user_id),
        "external_wallets": _serialize_external_wallets(db, row.user_id),
        "available_pairs": _serialize_available_pairs(db),
        "active_platform_bank_account": _get_active_platform_bank_account(db),
        "message_thread": {
            "conversation_id": conversation.id,
            "unread_master_messages": unread_master_messages or 0,
        },
    }


@router.get("/platform-wallet")
def get_platform_wallet_overview(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    status_error = None
    try:
        status = get_wallet_status()
    except Exception as exc:
        status = {"hot_wallet": {}, "master_wallet": {}}
        status_error = str(exc)

    hot_wallet = status.get("hot_wallet", {}) or {}
    master_wallet = status.get("master_wallet", {}) or {}
    hot_address = hot_wallet.get("address")
    master_address = master_wallet.get("address")

    pair_rows = (
        db.query(CurrencyNetwork, Currency, Network)
        .join(Currency, CurrencyNetwork.currency_id == Currency.id)
        .join(Network, CurrencyNetwork.network_id == Network.id)
        .filter(
            CurrencyNetwork.is_active == True,
            Currency.is_active == True,
            Network.is_active == True,
        )
        .order_by(Currency.symbol.asc(), Network.chain.asc())
        .all()
    )

    def balance_map(items):
        out = {}
        for item in items or []:
            key = (
                str(item.get("currency") or "").upper(),
                str(item.get("network") or "").upper(),
            )
            out[key] = float(item.get("balance") or 0)
        return out

    hot_balances = balance_map(hot_wallet.get("balances"))
    master_balances = balance_map(master_wallet.get("balances"))

    wallet_rows = []
    seen_chains = set()
    for pair, currency, network in pair_rows:
        key = (currency.symbol.upper(), network.chain.upper())
        wallet_rows.append({
            "pair_id": pair.id,
            "currency_id": currency.id,
            "currency": currency.symbol,
            "currency_name": currency.name,
            "currency_type": currency.type,
            "network_id": network.id,
            "network": network.name,
            "network_chain": network.chain,
            "deposit_enabled": pair.deposit_enabled,
            "withdraw_enabled": pair.withdraw_enabled,
            "hot_wallet": {
                "address": hot_address,
                "balance": hot_balances.get(key, 0.0),
            },
            "master_wallet": {
                "address": master_address,
                "balance": master_balances.get(key, 0.0),
            },
        })
        seen_chains.add(network.chain.upper())

    failed_rows = (
        db.query(FailedSweep)
        .order_by(desc(FailedSweep.created_at))
        .limit(40)
        .all()
    )

    return {
        "wallets": wallet_rows,
        "wallet_summary": {
            "hot_wallet_address": hot_address,
            "master_wallet_address": master_address,
            "hot_wallet_native_symbol": NATIVE_SYMBOL_BY_CHAIN.get("BSC"),
            "master_wallet_native_symbol": NATIVE_SYMBOL_BY_CHAIN.get("BSC"),
        },
        "gas_fees": [_estimate_fee_tiers(chain) for chain in sorted(seen_chains)],
        "failed_sweeps": [{
            "id": sweep.id,
            "user_id": sweep.user_id,
            "username": (db.query(User.username).filter(User.user_id == sweep.user_id).scalar() or "—"),
            "amount": float(sweep.amount or 0),
            "currency": sweep.currency_symbol,
            "network": sweep.network,
            "tatum_symbol": sweep.tatum_symbol,
            "reason": sweep.reason,
            "error": sweep.error,
            "retries": sweep.retries,
            "resolved": sweep.resolved,
            "created_at": _safe_iso(sweep.created_at),
            "last_retry_at": _safe_iso(sweep.last_retry_at),
            "resolved_at": _safe_iso(sweep.resolved_at),
            "trail": _build_failed_sweep_trail(db, sweep, hot_address, master_address),
        } for sweep in failed_rows],
        "transactions": _serialize_platform_transactions(db, hot_address),
        "status_error": status_error,
    }


@router.post("/platform-wallet/retry-all-sweeps")
def retry_all_failed_sweeps(
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    """Master-only: retry every unresolved failed sweep."""
    if not isRoleMaster_py(admin.get("role")):
        raise HTTPException(403, "Master access required")
    from app.services.sweep_service import retry_failed_sweeps
    results = retry_failed_sweeps(db)
    return {"results": results}


def isRoleMaster_py(role: Optional[str]) -> bool:
    return str(role or "").lower() in ("master", "superadmin")


@router.post("/withdraw/irt")
def create_irt_withdrawal_request(
    payload: IrtWithdrawalRequest,
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    if payload.amount <= 0:
        raise HTTPException(400, "Amount must be greater than zero")

    row = db.query(User).filter(User.user_id == admin["user_id"]).first()
    if not row:
        raise HTTPException(404, "User not found")

    bank_info = db.query(UserBankInfo).filter(UserBankInfo.user_id == row.user_id).first()
    if not bank_info or not bank_info.bank_holder_name or not bank_info.bank_card_number or not bank_info.bank_name or not bank_info.bank_sheba:
        raise HTTPException(400, "Complete your bank info before requesting an IRT withdrawal")

    irt_currency = db.query(Currency).filter(Currency.symbol == "IRT").first()
    if not irt_currency:
        raise HTTPException(404, "IRT currency not configured")

    balance_row = (
        db.query(UserBalance)
        .filter(
            UserBalance.user_id == row.user_id,
            UserBalance.currency_id == irt_currency.id,
        )
        .order_by(UserBalance.id.asc())
        .with_for_update()
        .first()
    )
    if not balance_row:
        raise HTTPException(400, "IRT balance not found")
    if float(balance_row.available_balance or 0) < float(payload.amount):
        raise HTTPException(400, "INSUFFICIENT_BALANCE")

    try:
        pair = resolve_currency_network_pair(
            db=db,
            currency_symbol="IRT",
            action="withdraw",
        )
        network_id = pair.network_id
        network_label = pair.network.chain if pair.network else "INTERNAL"
    except Exception:
        network_id = balance_row.network_id
        network_row = db.query(Network).filter(Network.id == balance_row.network_id).first() if balance_row.network_id else None
        network_label = network_row.chain if network_row else "INTERNAL"

    balance_row.available_balance -= payload.amount
    balance_row.frozen_balance += payload.amount

    tx = Transaction(
        user_id=row.user_id,
        currency_id=irt_currency.id,
        network_id=network_id,
        amount=payload.amount,
        type=WITHDRAW_TYPE,
        status=PENDING_STATUS,
        wallet_address=bank_info.bank_sheba or bank_info.bank_card_number,
        blockchain="irt_manual",
        confirmations=0,
        created_at=datetime.utcnow(),
    )
    db.add(tx)
    db.flush()

    conversation = _get_or_create_internal_conversation(db, row.user_id)
    db.add(Message(
        conversation_id=conversation.id,
        sender="admin",
        content=(
            f"IRT withdrawal request\n"
            f"Amount: {payload.amount}\n"
            f"Network: {network_label}\n"
            f"Bank: {bank_info.bank_name or '—'}\n"
            f"Holder: {bank_info.bank_holder_name or '—'}\n"
            f"Card: {bank_info.bank_card_number or '—'}\n"
            f"Sheba: {bank_info.bank_sheba or '—'}"
            + (f"\nNote: {payload.note}" if payload.note else "")
            + f"\nTransaction ID: {tx.id}"
        ),
        media_type=None,
        media_url=None,
        status="sent",
        is_read=False,
    ))
    db.commit()

    return {
        "status": "withdraw_pending",
        "transaction_id": tx.id,
        "amount": payload.amount,
        "currency": "IRT",
        "network": network_label,
    }
