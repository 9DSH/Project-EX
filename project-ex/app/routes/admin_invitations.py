from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.rls import get_db_rls
from app.core.security import get_current_user, is_master
from app.models.invitation_code import InvitationCode
from app.services.invitation_service import (
    ensure_invitation_pool,
    get_available_codes_query,
    DEFAULT_POOL_SIZE
)

router = APIRouter(prefix="/admin/invitations", tags=["Invitations"])



# =========================
# GET ALL CODES
# =========================
@router.get("/")
def get_all_codes(db: Session = Depends(get_db_rls), user=Depends(get_current_user)):

    if not is_master(user):
        raise HTTPException(403, "Master only")
    
        # 🔥 AUTO-HEAL POOL ON EVERY FETCH
    ensure_invitation_pool(db, DEFAULT_POOL_SIZE)

    return db.query(InvitationCode).order_by(InvitationCode.id.desc()).all()


# =========================
# MANUAL GENERATE (ONLY IF EMPTY)
# =========================
@router.post("/generate-pool")
def generate_pool(
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):

    if not is_master(user):
        raise HTTPException(403, "Master only")

    available_count = get_available_codes_query(db).count()

    # 🚨 only allow manual trigger if empty
    if available_count > 0:
        raise HTTPException(
            400,
            f"Pool already has {available_count} active codes"
        )

    ensure_invitation_pool(db, DEFAULT_POOL_SIZE)

    return {
        "success": True,
        "generated": DEFAULT_POOL_SIZE
    }


# =========================
# REVOKE CODE
# =========================
@router.post("/revoke/{code_id}")
def revoke_code(
    code_id: int,
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user)
):

    if not is_master(user):
        raise HTTPException(403, "Master only")

    code = db.query(InvitationCode).filter(InvitationCode.id == code_id).first()

    if not code:
        raise HTTPException(404, "Code not found")

    code.is_active = False

    db.commit()

    return {"success": True}