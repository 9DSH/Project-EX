from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.core.rls import get_db_rls
from app.core.security import get_current_user, is_master
from app.models.platform_wallet_config import PlatformWalletConfig
from app.models.currency import Currency
from app.models.network import Network
from app.services.wallet_monitor import get_wallet_status  # existing, read-only

router = APIRouter(prefix="/admin/platform-wallet", tags=["Admin Platform Wallet"])


def get_master(user=Depends(get_current_user)):
    if not is_master(user):
        raise HTTPException(403, "Master access required")
    return user


class WalletConfigCreate(BaseModel):
    currency_id: Optional[int] = None
    network_id: Optional[int] = None
    deposit_address: Optional[str] = None
    bank_name: Optional[str] = None
    bank_holder_name: Optional[str] = None
    bank_card_number: Optional[str] = None
    bank_sheba: Optional[str] = None
    label: Optional[str] = None
    note: Optional[str] = None
    is_active: bool = True


class WalletConfigUpdate(BaseModel):
    deposit_address: Optional[str] = None
    bank_name: Optional[str] = None
    bank_holder_name: Optional[str] = None
    bank_card_number: Optional[str] = None
    bank_sheba: Optional[str] = None
    label: Optional[str] = None
    note: Optional[str] = None
    is_active: Optional[bool] = None


def _serialize(cfg: PlatformWalletConfig):
    return {
        "id": cfg.id,
        "currency_id": cfg.currency_id,
        "currency": cfg.currency.symbol if cfg.currency else None,
        "network_id": cfg.network_id,
        "network": cfg.network.chain if cfg.network else None,
        "deposit_address": cfg.deposit_address,
        "bank_name": cfg.bank_name,
        "bank_holder_name": cfg.bank_holder_name,
        "bank_card_number": cfg.bank_card_number,
        "bank_sheba": cfg.bank_sheba,
        "label": cfg.label,
        "note": cfg.note,
        "is_active": cfg.is_active,
        "updated_at": cfg.updated_at,
    }


# =========================
# LIST (master only — this is config, not a public-facing endpoint;
# admin-facing display goes through a read-only route in Step 6)
# =========================
@router.get("/")
def list_configs(db: Session = Depends(get_db_rls), master=Depends(get_master)):
    rows = db.query(PlatformWalletConfig).order_by(PlatformWalletConfig.id.desc()).all()
    return [_serialize(r) for r in rows]


@router.post("/")
def create_config(payload: WalletConfigCreate, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    if payload.currency_id:
        if not db.query(Currency).filter(Currency.id == payload.currency_id).first():
            raise HTTPException(404, "Currency not found")
    if payload.network_id:
        if not db.query(Network).filter(Network.id == payload.network_id).first():
            raise HTTPException(404, "Network not found")

    cfg = PlatformWalletConfig(**payload.dict())
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return _serialize(cfg)


@router.put("/{config_id}")
def update_config(config_id: int, payload: WalletConfigUpdate, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    cfg = db.query(PlatformWalletConfig).filter(PlatformWalletConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(404, "Config not found")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(cfg, field, value)

    db.commit()
    db.refresh(cfg)
    return _serialize(cfg)


@router.delete("/{config_id}")
def delete_config(config_id: int, db: Session = Depends(get_db_rls), master=Depends(get_master)):
    cfg = db.query(PlatformWalletConfig).filter(PlatformWalletConfig.id == config_id).first()
    if not cfg:
        raise HTTPException(404, "Config not found")
    db.delete(cfg)
    db.commit()
    return {"success": True}


# =========================
# READ-ONLY HOT / MASTER WALLET STATUS
# Reuses the existing wallet_monitor service untouched — same function
# already powering admin_wallet.py / admin_dashboard.py. No new balance
# logic, so this can never drift from the real sweep/Tatum state.
# =========================
@router.get("/status")
def platform_wallet_status(master=Depends(get_master)):
    try:
        status = get_wallet_status()
        return {"status": status, "error": None}
    except Exception as e:
        return {"status": None, "error": str(e)}