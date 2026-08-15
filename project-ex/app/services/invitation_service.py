import random
import string
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.invitation_code import InvitationCode




# =========================
# CONFIG
# =========================
DEFAULT_POOL_SIZE = 20

# =========================
# CODE GENERATOR
# =========================
def generate_code(length: int = 12) -> str:
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))

# =========================
# AVAILABLE CODE QUERY (IMPORTANT)
# =========================
def get_available_codes_query(db: Session):
    return db.query(InvitationCode).filter(
        InvitationCode.is_used == False,
        InvitationCode.is_active == True
    )

# =========================
# ENSURE POOL (AUTO HEAL)
# =========================
def ensure_invitation_pool(db: Session, target_pool: int = DEFAULT_POOL_SIZE):

    active_count = get_available_codes_query(db).count()

    missing = target_pool - active_count

    if missing <= 0:
        return False  # nothing generated

    new_codes = []

    for _ in range(missing):
        code = generate_code()

        while db.query(InvitationCode).filter(
            InvitationCode.code == code
        ).first():
            code = generate_code()

        new_codes.append(
            InvitationCode(
                code=code,
                created_by_user_id=None,
                is_used=False,
                is_active=True
            )
        )

    db.add_all(new_codes)
    db.commit()

    return True  # pool was refilled

# =========================
# VALIDATE CODE
# =========================
def validate_invitation_code(db: Session, code: str) -> InvitationCode:
    invitation = db.query(InvitationCode).filter(
        InvitationCode.code == code,
        InvitationCode.is_active == True,
    ).first()

    return invitation


# =========================
# CONSUME CODE
# =========================
def consume_invitation_code(db: Session, invitation: InvitationCode, user_id: int):
    invitation.is_used = True
    invitation.used_by_user_id = user_id
    invitation.used_at = datetime.utcnow()
    invitation.is_active = False

    db.add(invitation)
    db.flush()