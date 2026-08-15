from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.user_bank_info import UserBankInfo
from app.models.platform_bank_account import PlatformBankAccount
from app.models.transaction import Transaction

router = APIRouter(prefix="/account", tags=["Account"])


class ProfileUpdatePayload(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    language: Optional[str] = None

    @field_validator("language")
    @classmethod
    def validate_language(cls, v):
        if v is not None and v not in {"en", "fa"}:
            raise ValueError("language must be one of ['en', 'fa']")
        return v


class BankInfoPayload(BaseModel):
    bank_holder_name: Optional[str] = None
    bank_card_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_sheba: Optional[str] = None


def _is_profile_complete(user: User) -> bool:
    return bool(user.first_name and user.last_name and user.email and user.phone_number)


def _serialize_bank_info(bank_info: Optional[UserBankInfo]):
    if not bank_info:
        return None
    return {
        "bank_holder_name": bank_info.bank_holder_name,
        "bank_card_number": bank_info.bank_card_number,
        "bank_name": bank_info.bank_name,
        "bank_sheba": bank_info.bank_sheba,
    }


@router.get("/me")
def get_my_account(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user = db.query(User).filter(User.user_id == current_user.get("user_id")).first()
    if not user:
        raise HTTPException(404, "User not found")

    bank_info = db.query(UserBankInfo).filter(UserBankInfo.user_id == user.user_id).first()
    return {
        "user_id": user.user_id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "phone_number": user.phone_number,
        "language": user.language,
        "personal_info_complete": _is_profile_complete(user),
        "bank_info_complete": bool(bank_info and bank_info.bank_holder_name and bank_info.bank_card_number and bank_info.bank_name and bank_info.bank_sheba),
        "bank_info": _serialize_bank_info(bank_info),
    }


@router.put("/me")
def update_my_account(
    payload: ProfileUpdatePayload,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user = db.query(User).filter(User.user_id == current_user.get("user_id")).first()
    if not user:
        raise HTTPException(404, "User not found")

    for field in ["first_name", "last_name", "email", "phone_number", "language"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(user, field, value)

    db.commit()
    return get_my_account(db=db, current_user=current_user)


@router.get("/bank-info")
def get_bank_info(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user = db.query(User).filter(User.user_id == current_user.get("user_id")).first()
    if not user:
        raise HTTPException(404, "User not found")

    bank_info = db.query(UserBankInfo).filter(UserBankInfo.user_id == user.user_id).first()
    return {
        "bank_info": _serialize_bank_info(bank_info),
        "is_complete": bool(bank_info and bank_info.bank_holder_name and bank_info.bank_card_number and bank_info.bank_name and bank_info.bank_sheba),
    }


@router.put("/bank-info")
def upsert_bank_info(
    payload: BankInfoPayload,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user = db.query(User).filter(User.user_id == current_user.get("user_id")).first()
    if not user:
        raise HTTPException(404, "User not found")

    bank_info = db.query(UserBankInfo).filter(UserBankInfo.user_id == user.user_id).first()
    if not bank_info:
        bank_info = UserBankInfo(user_id=user.user_id)
        db.add(bank_info)

    for field in ["bank_holder_name", "bank_card_number", "bank_name", "bank_sheba"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(bank_info, field, value)

    db.commit()
    db.refresh(bank_info)
    return get_bank_info(db=db, current_user=current_user)


@router.get("/active-bank-account")
def get_active_bank_account(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    account = db.query(PlatformBankAccount).filter(PlatformBankAccount.is_active == True).order_by(PlatformBankAccount.id.desc()).first()
    if not account:
        return {"account": None}

    return {
        "account": {
            "id": account.id,
            "bank_name": account.bank_name,
            "bank_holder_name": account.bank_holder_name,
            "bank_card_number": account.bank_card_number,
            "bank_sheba": account.bank_sheba,
        }
    }
