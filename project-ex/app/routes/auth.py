#app.route.auth.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid
from app.services.wallet_derivation_service import create_default_wallets_for_user
from app.routes.admin_users import create_default_balances
from app.models.user_balance import UserBalance
from app.db.database import get_db
from app.models.user import User, TelegramBotSettings
from app.core.security import hash_password
from app.services.invitation_service import (
    validate_invitation_code,
    consume_invitation_code,
    ensure_invitation_pool
)



from typing import Optional
from app.services.auth_service import login_user


router = APIRouter(prefix="/auth", tags=["Auth"])


# -------------------------
# REQUEST BODY MODEL
# -------------------------
class LoginRequest(BaseModel):
    username: str
    password: str
    telegram_id: Optional[str] = None  

# =========================
# REQUEST MODEL
# =========================
class SignupRequest(BaseModel):
    username: str
    password: str
    invitation_code: str

    first_name: str | None = None
    last_name: str | None = None
    phone_number: str | None = None
    email: str | None = None

    # "en" | "fa" — sent by the Telegram bot with whatever language the user
    # is currently on (default "en", or their own explicit choice if they
    # already tapped "🌐 Language" before signing up). If omitted, the new
    # user is seeded from the inviting admin's TelegramBotSettings instead.
    language: str | None = None



# -------------------------
# LOGIN ROUTE
# -------------------------
@router.post("/login")
def login(data: LoginRequest):
    try:
        result = login_user(
            username=data.username,
            password=data.password,
            telegram_id=data.telegram_id
        )

        if not result:
            raise HTTPException(status_code=400, detail="Invalid login")

        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])

        return result

    except Exception as e:
        print("LOGIN CRASH:", str(e))

        raise HTTPException(
            status_code=500,
            detail="Internal server error during login"
        )
    

# =========================
# SIGNUP ENDPOINT
# =========================
@router.post("/signup")
def signup(data: SignupRequest, db: Session = Depends(get_db)):

    # 1. check user exists
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(400, "Username already exists")

    # 2. validate invitation
    invitation = validate_invitation_code(db, data.invitation_code)

    if not invitation:
        raise HTTPException(400, "Invalid or used invitation code")

    # 3. find inviter (host)
    inviter_user = None
    if invitation.created_by_user_id:
        inviter_user = db.query(User).filter(
            User.user_id == invitation.created_by_user_id
        ).first()

    if inviter_user and inviter_user.status != "active":
        raise HTTPException(400, "Inviter is inactive")

    # 3b. resolve default language: explicit choice from the bot wins;
    # otherwise fall back to the inviting admin's configured default;
    # otherwise "en".
    SUPPORTED_LANGUAGES = {"en", "fa"}
    resolved_language = "en"
    if invitation.created_by_user_id:
        bot_settings = db.query(TelegramBotSettings).filter(
            TelegramBotSettings.admin_id == invitation.created_by_user_id
        ).first()
        if bot_settings:
            resolved_language = bot_settings.default_language
    if data.language in SUPPORTED_LANGUAGES:
        resolved_language = data.language

    # 4. create user
    new_user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        account_id=str(uuid.uuid4()),

        first_name=data.first_name,
        last_name=data.last_name,
        phone_number=data.phone_number,
        email=data.email,
        language=resolved_language,

        invited_by=invitation.created_by_user_id,
        admin_id=invitation.created_by_user_id,
        used_invitation_code = data.invitation_code,

        role="user",
        status="active",
    )

    db.add(new_user)
    db.flush()  # get user_id

    # Create deposit wallets for every active currency/network pair
    # (single source of truth: UserWallet table via wallet_derivation_service)
    created_wallets = create_default_wallets_for_user(new_user.user_id, db)

    # default balances
    create_default_balances(db, new_user.user_id)

    # 5. consume invitation
    consume_invitation_code(db, invitation, new_user.user_id)

    # 6. maintain pool (auto refill)
    ensure_invitation_pool(db)

    db.commit()

    return {
        "success": True,
        "user_id": new_user.user_id,
        "invited_by": new_user.invited_by,
        "wallets": created_wallets,
    }