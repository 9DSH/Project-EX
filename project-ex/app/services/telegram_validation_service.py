import httpx
from typing import Optional
from pydantic import BaseModel


class ValidationResult(BaseModel):
    valid: bool
    bot_username: Optional[str] = None
    error: Optional[str] = None
    error_type: Optional[str] = None


async def validate_telegram_token(token: str) -> ValidationResult:
    if not token or not token.strip():
        return ValidationResult(
            valid=False,
            error="Token is empty.",
            error_type="invalid_input",
        )

    token = token.strip()
    url = f"https://api.telegram.org/bot{token}/getMe"

    try:
        timeout = httpx.Timeout(
            connect=10.0,
            read=15.0,
            write=15.0,
            pool=10.0,
        )

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)

    except httpx.ConnectTimeout:
        return ValidationResult(
            valid=False,
            error="Could not connect to Telegram API: connection timed out.",
            error_type="connection",
        )

    except httpx.ConnectError as exc:
        return ValidationResult(
            valid=False,
            error=f"Could not connect to Telegram API: {exc}",
            error_type="connection",
        )

    except httpx.ReadTimeout:
        return ValidationResult(
            valid=False,
            error="Telegram API did not respond within the timeout.",
            error_type="timeout",
        )

    except httpx.RequestError as exc:
        return ValidationResult(
            valid=False,
            error=f"Telegram API request failed: {exc}",
            error_type="connection",
        )

    try:
        data = response.json()
    except ValueError:
        return ValidationResult(
            valid=False,
            error=f"Telegram returned an invalid response (HTTP {response.status_code}).",
            error_type="telegram",
        )

    # Telegram itself responded.
    # Therefore this is an API/token problem rather than a network problem.
    if response.status_code != 200 or not data.get("ok"):
        error_description = data.get(
            "description",
            f"Telegram returned HTTP {response.status_code}.",
        )

        return ValidationResult(
            valid=False,
            error=error_description,
            error_type="invalid_token",
        )

    result = data.get("result", {})
    username = result.get("username")

    if not username:
        return ValidationResult(
            valid=False,
            error="Telegram returned a valid response but no bot username.",
            error_type="telegram",
        )

    return ValidationResult(
        valid=True,
        bot_username=username,
    )