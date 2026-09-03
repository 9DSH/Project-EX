from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.rls import get_db_rls
from app.core.security import get_current_user, is_master
from app.models.user import User
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

    codes = db.query(InvitationCode).order_by(InvitationCode.id.desc()).all()
    user_ids = {code.created_by_user_id for code in codes if code.created_by_user_id}
    user_ids.update({code.used_by_user_id for code in codes if code.used_by_user_id})
    users = {
        row.user_id: row
        for row in db.query(User).filter(User.user_id.in_(user_ids)).all()
    } if user_ids else {}

    def serialize_user(row):
        if not row:
            return None
        full_name = " ".join(part for part in [row.first_name, row.last_name] if part).strip() or None
        return {
            "user_id": row.user_id,
            "username": row.username,
            "full_name": full_name,
            "role": row.role,
            "admin_id": row.admin_id,
            "invited_by": row.invited_by,
        }

    return [{
        "id": code.id,
        "code": code.code,
        "created_by_user_id": code.created_by_user_id,
        "created_by": serialize_user(users.get(code.created_by_user_id)),
        "used_by_user_id": code.used_by_user_id,
        "used_by": serialize_user(users.get(code.used_by_user_id)),
        "is_used": code.is_used,
        "is_active": code.is_active,
        "created_at": code.created_at,
        "used_at": code.used_at,
    } for code in codes]


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