from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.core.security import get_current_user, is_admin_or_above, is_master
from app.models.platform_bank_account import PlatformBankAccount
from app.models.transaction import Transaction

router = APIRouter(prefix="/admin/platform-bank-accounts", tags=["Admin Platform Bank Accounts"])


class PlatformBankAccountCreate(BaseModel):
    bank_name: Optional[str] = None
    bank_holder_name: Optional[str] = None
    bank_card_number: Optional[str] = None
    bank_sheba: Optional[str] = None
    is_active: bool = False


class PlatformBankAccountUpdate(BaseModel):
    bank_name: Optional[str] = None
    bank_holder_name: Optional[str] = None
    bank_card_number: Optional[str] = None
    bank_sheba: Optional[str] = None
    is_active: Optional[bool] = None


def _serialize(account: PlatformBankAccount, db: Session):
    tx_count = db.query(Transaction).filter(Transaction.platform_bank_account_id == account.id).count()
    return {
        "id": account.id,
        "admin_id": account.admin_id,
        "bank_name": account.bank_name,
        "bank_holder_name": account.bank_holder_name,
        "bank_card_number": account.bank_card_number,
        "bank_sheba": account.bank_sheba,
        "is_active": account.is_active,
        "has_transactions": tx_count > 0,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
    }


def _ensure_admin_access(current_user: dict):
    if not is_admin_or_above(current_user):
        raise HTTPException(403, "Admin access required")


def _set_single_active_account(db: Session, account_id: Optional[int]):
    if account_id is None:
        return
    accounts = db.query(PlatformBankAccount).all()
    for account in accounts:
        if account.id == account_id:
            account.is_active = True
        else:
            account.is_active = False


def _can_edit(account: PlatformBankAccount, db: Session):
    tx_count = db.query(Transaction).filter(Transaction.platform_bank_account_id == account.id).count()
    return tx_count == 0


@router.get("/")
def list_accounts(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _ensure_admin_access(current_user)
    if is_master(current_user):
        accounts = db.query(PlatformBankAccount).order_by(PlatformBankAccount.created_at.desc()).all()
    else:
        accounts = db.query(PlatformBankAccount).filter(PlatformBankAccount.admin_id == current_user.get("user_id")).order_by(PlatformBankAccount.created_at.desc()).all()
    return [_serialize(account, db) for account in accounts]


@router.post("/")
def create_account(
    payload: PlatformBankAccountCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _ensure_admin_access(current_user)
    account = PlatformBankAccount(
        admin_id=current_user.get("user_id"),
        bank_name=payload.bank_name,
        bank_holder_name=payload.bank_holder_name,
        bank_card_number=payload.bank_card_number,
        bank_sheba=payload.bank_sheba,
        is_active=False,
    )
    db.add(account)
    db.flush()

    if payload.is_active:
        _set_single_active_account(db, account.id)

    db.commit()
    db.refresh(account)
    return _serialize(account, db)


@router.put("/{account_id}")
def update_account(
    account_id: int,
    payload: PlatformBankAccountUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _ensure_admin_access(current_user)
    account = db.query(PlatformBankAccount).filter(PlatformBankAccount.id == account_id).first()
    if not account:
        raise HTTPException(404, "Account not found")

    if not is_master(current_user) and account.admin_id != current_user.get("user_id"):
        raise HTTPException(403, "Not authorized to edit this account")

    if not _can_edit(account, db):
        if payload.is_active is not None and payload.is_active is False:
            account.is_active = False
            db.commit()
            return _serialize(account, db)
        raise HTTPException(400, "This bank account has transaction history and cannot be edited")

    if payload.bank_name is not None:
        account.bank_name = payload.bank_name
    if payload.bank_holder_name is not None:
        account.bank_holder_name = payload.bank_holder_name
    if payload.bank_card_number is not None:
        account.bank_card_number = payload.bank_card_number
    if payload.bank_sheba is not None:
        account.bank_sheba = payload.bank_sheba
    if payload.is_active is not None:
        if payload.is_active:
            _set_single_active_account(db, account.id)
        else:
            account.is_active = False

    db.commit()
    db.refresh(account)
    return _serialize(account, db)


@router.delete("/{account_id}")
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _ensure_admin_access(current_user)
    account = db.query(PlatformBankAccount).filter(PlatformBankAccount.id == account_id).first()
    if not account:
        raise HTTPException(404, "Account not found")

    if not is_master(current_user) and account.admin_id != current_user.get("user_id"):
        raise HTTPException(403, "Not authorized to delete this account")

    if not _can_edit(account, db):
        raise HTTPException(400, "This bank account has transaction history and cannot be deleted")

    db.delete(account)
    db.commit()
    return {"success": True}
