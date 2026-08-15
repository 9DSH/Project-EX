# app/routes/user_invitations.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.models.invitation_code import InvitationCode

router = APIRouter(prefix="/user/invitations", tags=["User Invitations"])


# =========================
# GET MY OWNED INVITES
# =========================
@router.get("/")
def get_my_invites(user_id: int, db: Session = Depends(get_db)):

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    invites = db.query(InvitationCode).filter(
        InvitationCode.created_by_user_id == user_id
    ).all()

    return {
        "total": len(invites),
        "used": len([i for i in invites if i.is_used]),
        "active": len([i for i in invites if i.is_active]),
        "codes": invites
    }


# =========================
# REQUEST A CODE
# =========================
@router.post("/request")
def request_invitation_code(user_id: int, db: Session = Depends(get_db)):

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    # find unowned active code
    code = db.query(InvitationCode).filter(
        InvitationCode.created_by_user_id == None,
        InvitationCode.is_active == True,
        InvitationCode.is_used == False
    ).first()


    if not code:
        raise HTTPException(400, "No available invitation codes")

    code.created_by_user_id = user_id
    code.is_used = True

    db.commit()

    return {
        "success": True,
        "code": code.code,
        "assigned_to": user_id
    }


# =========================
# OPTIONAL: RELEASE CODE BACK TO POOL
# =========================
@router.post("/release/{code_id}")
def release_code(code_id: int, user_id: int, db: Session = Depends(get_db)):

    code = db.query(InvitationCode).filter(
        InvitationCode.id == code_id,
        InvitationCode.created_by_user_id == user_id,
        InvitationCode.is_used == False
    ).first()

    if not code:
        raise HTTPException(404, "Code not found or already used")

    code.created_by_user_id = None

    db.commit()

    return {"success": True}