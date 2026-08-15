#app.core.security.py
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import (
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

# -------------------------
# AUTH SCHEME (FIXED FOR SWAGGER)
# -------------------------
bearer_scheme = HTTPBearer()

# -------------------------
# PASSWORD
# -------------------------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# -------------------------
# JWT TOKEN
# -------------------------
def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt


def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


# -------------------------
# CURRENT USER DEPENDENCY
# -------------------------
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
):
    token = credentials.credentials
    payload = verify_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


# -------------------------
# ROLE HELPERS
# -------------------------

def is_master(user: dict) -> bool:
    if user.get("role") not in ["master", "admin"]:
        raise HTTPException(403, "Not authorized")
    return user.get("role") == "master"


def is_admin_or_above(user: dict) -> bool:
    """True for both admin and master roles."""
    return user.get("role") in ("admin", "master")


def get_admin_user(current_user=Depends(get_current_user)):
    if not is_admin_or_above(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def get_master_user(current_user=Depends(get_current_user)):
    if not is_master(current_user):
        raise HTTPException(status_code=403, detail="Master access required")
    return current_user