from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from fastapi import HTTPException, Header

from app.core.config import BOT_SERVICE_SECRET, BOT_GLOBAL_SHARED_SECRET, BOT_SERVICE_TOKEN_EXPIRE_MINUTES

ALGORITHM = "HS256"
SERVICE_TOKEN_TYPE = "bot_service"
ALLOWED_SCOPE = "bot_menu_context"  # read-only, menu-rendering only


def mint_bot_service_token(admin_id: Optional[int]) -> str:
    """
    Minted once per bot process at startup, using BOT_SERVICE_SECRET
    (never the user-JWT SECRET_KEY — separate secrets so a leaked bot
    token can never be replayed as a user session, or vice versa).
    admin_id=None for the Global bot's base identity. This token alone
    NEVER grants cross-admin visibility — see get_bot_service_context.
    """
    if not BOT_SERVICE_SECRET:
        raise RuntimeError("BOT_SERVICE_SECRET not configured")
    payload = {
        "typ": SERVICE_TOKEN_TYPE,
        "scope": ALLOWED_SCOPE,
        "admin_id": admin_id,
        "exp": datetime.utcnow() + timedelta(minutes=BOT_SERVICE_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, BOT_SERVICE_SECRET, algorithm=ALGORITHM)


def verify_bot_service_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, BOT_SERVICE_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Invalid or expired bot service token")

    if payload.get("typ") != SERVICE_TOKEN_TYPE or payload.get("scope") != ALLOWED_SCOPE:
        raise HTTPException(403, "Token not valid for this scope")

    return payload


def get_bot_service_context(
    x_bot_service_token: Optional[str] = Header(default=None),
    x_bot_context: Optional[str] = Header(default=None),
    x_bot_global_secret: Optional[str] = Header(default=None),
):
    """
    Dependency for /bot-context/* (menu-rendering) endpoints ONLY.
    Never mount this on any endpoint that acts on behalf of a real user
    (orders, withdrawals, balance edits) — those stay on get_current_user
    with a real end-user JWT.

    Trust boundary is deliberately split in two:
      - x_bot_service_token proves "this is a legitimate bot process" and
        carries its admin_id (or None).
      - x_bot_context/x_bot_global_secret is the SEPARATE, non-spoofable
        signal that flips cross-admin visibility on. Possessing a valid
        service token is NOT sufficient for global visibility, and a
        missing admin_id in the token is NEVER treated as "must be global."
    """
    if not x_bot_service_token:
        raise HTTPException(401, "Bot service token required")

    payload = verify_bot_service_token(x_bot_service_token)
    admin_id = payload.get("admin_id")

    is_global = False
    if x_bot_context == "global":
        if not BOT_GLOBAL_SHARED_SECRET or x_bot_global_secret != BOT_GLOBAL_SHARED_SECRET:
            raise HTTPException(403, "Invalid global bot credentials")
        is_global = True

    return {"admin_id": admin_id, "is_global": is_global}