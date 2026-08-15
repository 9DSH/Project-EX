from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.core.security import get_current_user, is_master, is_admin_or_above
from app.core.permissions import has_access

from app.models.currency_network import CurrencyNetwork
from app.models.currency import Currency
from app.models.network import Network

from app.schemas.currency_network import CurrencyNetworkCreate

router = APIRouter(
    prefix="/admin/currency-networks",
    tags=["Admin Currency Networks"]
)



# =====================================================
# LIST ALL PAIRS
# =====================================================
@router.get("/")
def list_pairs(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    pairs = (
        db.query(CurrencyNetwork)
        .options(
            joinedload(CurrencyNetwork.currency),
            joinedload(CurrencyNetwork.network)
        )
        .order_by(CurrencyNetwork.id.desc())
        .all()
    )

    result = []
    for p in pairs:
        result.append({
            "id": p.id,
            "currency_id": p.currency_id,
            "network_id": p.network_id,
            "is_active": p.is_active,
            "is_default": p.is_default,
            "deposit_enabled": p.deposit_enabled,
            "withdraw_enabled": p.withdraw_enabled,
            "min_deposit": p.min_deposit,
            "max_deposit": p.max_deposit,
            "min_withdraw": p.min_withdraw,
            "withdraw_fee": p.withdraw_fee,
            "confirmations_required": p.confirmations_required,
            "currency": {
                "id": p.currency.id,
                "symbol": p.currency.symbol,
                "name": p.currency.name,
                "type": p.currency.type,
            },
            "network": {
                "id": p.network.id,
                "name": p.network.name,
                "chain": p.network.chain,
            }
        })
    return result


# =====================================================
# ADD PAIR
# =====================================================
@router.post("/")
def add_pair(
    payload: CurrencyNetworkCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    # =========================
    # VALIDATE CURRENCY
    # =========================
    currency = db.query(Currency).filter(
        Currency.id == payload.currency_id
    ).first()

    if not currency:
        raise HTTPException(
            status_code=404,
            detail="Currency not found"
        )

    # =========================
    # VALIDATE NETWORK
    # =========================
    network = db.query(Network).filter(
        Network.id == payload.network_id
    ).first()

    if not network:
        raise HTTPException(
            status_code=404,
            detail="Network not found"
        )

    # =========================
    # CHECK EXISTING PAIR
    # =========================
    existing = db.query(CurrencyNetwork).filter(
        CurrencyNetwork.currency_id == payload.currency_id,
        CurrencyNetwork.network_id == payload.network_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Pair already exists"
        )
    
    #=========== Check currency Type =========
    #if currency.type != "crypto":
     #   raise HTTPException(
      #      400,
       #     "Only crypto currencies can use networks"
        #)
    # =========================
    # CREATE PAIR
    # =========================
    pair = CurrencyNetwork(
        currency_id=payload.currency_id,
        network_id=payload.network_id
    )

    db.add(pair)
    db.commit()
    db.refresh(pair)

    return {
        "success": True,
        "message": "Pair created successfully",

        "pair": {
            "id": pair.id,

            "currency": {
                "id": currency.id,
                "symbol": currency.symbol,
                "name": currency.name
            },

            "network": {
                "id": network.id,
                "name": network.name,
                "chain": network.chain
            }
        }
    }

# =====================================================
# UPDATE PAIR (NEW)
# =====================================================
@router.put("/{pair_id}")
def update_pair(
    pair_id: int,
    payload: dict,   # Flexible payload for toggle or full update
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    pair = db.query(CurrencyNetwork).filter(CurrencyNetwork.id == pair_id).first()

    if not pair:
        raise HTTPException(status_code=404, detail="Pair not found")

    # Update only fields that are sent
    for key, value in payload.items():
        if hasattr(pair, key):
            setattr(pair, key, value)

    db.commit()
    db.refresh(pair)

    return {
        "success": True,
        "message": "Pair updated successfully",
        "pair": pair
    }

# =====================================================
# DELETE PAIR
# =====================================================
@router.delete("/{pair_id}")
def delete_pair(
    pair_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")

    pair = (
        db.query(CurrencyNetwork)
        .options(
            joinedload(CurrencyNetwork.currency),
            joinedload(CurrencyNetwork.network)
        )
        .filter(CurrencyNetwork.id == pair_id)
        .first()
    )

    if not pair:
        raise HTTPException(
            status_code=404,
            detail="Pair not found"
        )


    db.delete(pair)
    db.commit()

    return {
        "success": True,
        "message": "Pair deleted"
    }