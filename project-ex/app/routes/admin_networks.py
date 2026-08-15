from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.models.network import Network

router = APIRouter(
    prefix="/admin/networks",
    tags=["Admin Networks"]
)


# =========================
# SCHEMAS
# =========================
class NetworkCreate(BaseModel):
    name: str
    chain: str


class NetworkUpdate(BaseModel):
    chain: str | None = None
    is_active: bool | None = None


# =========================
# LIST NETWORKS
# =========================
@router.get("/")
def get_networks(db: Session = Depends(get_db)):
    networks = db.query(Network).order_by(Network.id.desc()).all()

    return [
        {
            "id": n.id,
            "name": n.name,
            "chain": n.chain,
            "is_active": n.is_active
        }
        for n in networks
    ]
# =========================
# CREATE NETWORK
# =========================
@router.post("/")
def create_network(payload: NetworkCreate, db: Session = Depends(get_db)):

    name = payload.name.strip().upper()

    # 🔒 prevent duplicates (case-insensitive safe)
    existing = db.query(Network).filter(
        Network.name.ilike(name)
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Network already exists")

    network = Network(
        name=name,
        chain=payload.chain.strip().upper(),
        is_active=True
    )

    db.add(network)
    db.commit()
    db.refresh(network)

    return {
        "message": "Network created",
        "network": {
            "id": network.id,
            "name": network.name,
            "chain": network.chain,
            "is_active": network.is_active
        }
    }


# =========================
# UPDATE NETWORK
# =========================
@router.put("/{network_id}")
def update_network(
    network_id: int,
    payload: NetworkUpdate,
    db: Session = Depends(get_db)
):

    network = db.query(Network).filter(Network.id == network_id).first()

    if not network:
        raise HTTPException(status_code=404, detail="Network not found")

    data = payload.dict(exclude_unset=True)

    # normalize input
    if "name" in data and data["name"]:
        data["name"] = data["name"].strip().upper()

    if "chain" in data and data["chain"]:
        data["chain"] = data["chain"].strip().upper()

    for key, value in data.items():
        setattr(network, key, value)

    db.commit()
    db.refresh(network)

    return {
        "message": "Network updated",
        "network": {
            "id": network.id,
            "name": network.name,
            "chain": network.chain,
            "is_active": network.is_active
        }
    }


# =========================
# DELETE NETWORK (SAFE VERSION)
# =========================
@router.delete("/{network_id}")
def delete_network(network_id: int, db: Session = Depends(get_db)):

    network = db.query(Network).filter(Network.id == network_id).first()

    if not network:
        raise HTTPException(status_code=404, detail="Network not found")

    # 🚨 RECOMMENDED: soft delete instead of hard delete
    network.is_active = False

    db.commit()

    return {
        "message": "Network deactivated (soft delete)",
        "network_id": network_id
    }