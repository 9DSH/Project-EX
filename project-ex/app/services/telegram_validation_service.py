import httpx
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ValidationResult(BaseModel):
    valid: bool
    bot_username: Optional[str] = None
    error: Optional[str] = None


async def validate_telegram_token(token: str) -> ValidationResult:
    if not token or not token.strip():
        return ValidationResult(valid=False, error="Token is empty")

    token = token.strip()
    url = f"https://api.telegram.org/bot{token}/getMe"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url)
    except Exception as e:
        return ValidationResult(valid=False, error=f"Request failed: {str(e)}")

    try:
        data = res.json()
    except Exception:
        return ValidationResult(valid=False, error="Invalid response from Telegram")

    if res.status_code != 200 or not data.get("ok"):
        error_desc = data.get("description", f"HTTP {res.status_code}")
        return ValidationResult(valid=False, error=error_desc)

    result = data.get("result", {})
    username = result.get("username")

    if not username:
        return ValidationResult(valid=False, error="No username returned by Telegram")

    return ValidationResult(valid=True, bot_username=username)