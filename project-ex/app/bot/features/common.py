import logging
import os
from urllib.parse import quote_plus
from app.core.bot_service_auth import mint_bot_service_token
import time

import httpx
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup

from app.bot.bot_content import t, DEFAULT_LANGUAGE

logger = logging.getLogger(__name__)

TOKEN = os.environ.get("BOT_TOKEN")
API_URL = os.environ.get("API_URL", "http://127.0.0.1:8000")

# None for the Global WIRES bot / support bot, an int string for every
# per-admin process. Process-local constant — safe because each process
# serves exactly one admin (or none) for its entire lifetime.
_raw_admin_id = os.environ.get("BOT_ADMIN_ID")
BOT_ADMIN_ID = int(_raw_admin_id) if _raw_admin_id and _raw_admin_id.isdigit() else None
BOT_KIND = os.environ.get("BOT_KIND", "admin")
# Informational only — never the security check. The real global-visibility
# gate is the shared-secret header pair below.
IS_GLOBAL_BOT = BOT_KIND == "main_global"

BOT_SERVICE_TOKEN = mint_bot_service_token(BOT_ADMIN_ID)
BOT_GLOBAL_SHARED_SECRET = os.environ.get("BOT_GLOBAL_SHARED_SECRET")

user_state = {}
user_tokens = {}
user_last_balance = {}
exchange_state = {}

# Per-user language preference, keyed by telegram user id. Populated from the
# account API (or the admin's default_language for new users) and updated
# immediately when the user taps "🌐 Language".
user_languages = {}

def _bot_context_headers():
    headers = {"X-Bot-Service-Token": BOT_SERVICE_TOKEN}
    if IS_GLOBAL_BOT and BOT_GLOBAL_SHARED_SECRET:
        headers["X-Bot-Context"] = "global"
        headers["X-Bot-Global-Secret"] = BOT_GLOBAL_SHARED_SECRET
    return headers


async def api_bot_context_get(path, params=None):
    """GET a /bot-context/* menu-rendering endpoint using the bot's service
    token — never a real user's JWT, and never usable for order/withdraw/
    balance endpoints since the backend only mounts get_bot_service_context
    on /bot-context/*."""
    return await httpx.AsyncClient(timeout=30.0).get(
        f"{API_URL}{path}", headers=_bot_context_headers(), params=params
    )


_access_points_cache = {"data": None, "role": None, "ts": 0.0}
ACCESS_POINTS_TTL = 30  # seconds — fresh-fetched per interaction window, not cached at process start


async def get_bot_admin_access_points():
    if IS_GLOBAL_BOT:
        # No single owning admin — menu visibility for the Global bot is
        # governed per-item by telegram_global_bot_access, not by a
        # single access_points list. Always show every top-level menu.
        return "*", "global"

    now = time.time()
    if _access_points_cache["data"] is not None and now - _access_points_cache["ts"] < ACCESS_POINTS_TTL:
        return _access_points_cache["data"], _access_points_cache["role"]
    try:
        res = await api_bot_context_get("/bot-context/access-points")
        data = res.json() if res.status_code == 200 else {"access_points": [], "role": None}
    except Exception:
        data = {"access_points": [], "role": None}
    _access_points_cache["data"] = data.get("access_points", [])
    _access_points_cache["role"] = data.get("role")
    _access_points_cache["ts"] = now
    return _access_points_cache["data"], _access_points_cache["role"]

def get_lang(user_id):
    return user_languages.get(user_id, DEFAULT_LANGUAGE)


def set_lang(user_id, lang):
    user_languages[user_id] = lang


# Menu button text is resolved per-language, so matching incoming text
# against a button must also be done in the user's current language rather
# than a single hardcoded string.
MENU_BUTTON_KEYS = [
    "btn_wallet", "btn_exchange", "btn_products", "btn_orders",
    "btn_wire", "btn_my_account", "btn_language", "btn_support", "btn_logout",
]


def main_reply_keyboard(lang=DEFAULT_LANGUAGE):
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton(t("btn_wallet", lang)), KeyboardButton(t("btn_exchange", lang))],
            [KeyboardButton(t("btn_products", lang)), KeyboardButton(t("btn_orders", lang))],
            [KeyboardButton(t("btn_wire", lang)), KeyboardButton(t("btn_my_account", lang))],
            [KeyboardButton(t("btn_language", lang)), KeyboardButton(t("btn_support", lang))],
            [KeyboardButton(t("btn_logout", lang))],
        ],
        resize_keyboard=True,
        is_persistent=False,
    )


def menu_button_action(text, lang=DEFAULT_LANGUAGE):
    """Return which menu button key `text` corresponds to (in `lang`), or None."""
    for key in MENU_BUTTON_KEYS:
        if text == t(key, lang):
            return key
    return None


def auth_inline(lang=DEFAULT_LANGUAGE):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn_login", lang), callback_data="auth_login")],
        [InlineKeyboardButton(t("btn_signup", lang), callback_data="auth_signup")],
    ])


def wallet_inline(lang=DEFAULT_LANGUAGE):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn_balance", lang), callback_data="wallet_balance")],
        [InlineKeyboardButton(t("btn_transactions", lang), callback_data="wallet_transactions")],
        [InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")],
    ])


def balance_inline(lang=DEFAULT_LANGUAGE):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t("btn_deposit", lang), callback_data="wallet_deposit")],
        [InlineKeyboardButton(t("btn_withdraw", lang), callback_data="wallet_withdraw")],
        [InlineKeyboardButton(t("btn_external_wallet", lang), callback_data="wallet_external")],
        [InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")],
    ])


def language_inline(lang=DEFAULT_LANGUAGE):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(t("language_btn_en", lang), callback_data="setlang_en")],
        [InlineKeyboardButton(t("language_btn_fa", lang), callback_data="setlang_fa")],
        [InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")],
    ])


def wrap(title, body, emoji="✨", lang=DEFAULT_LANGUAGE):
    footer = t("wrap_footer_tip", lang)
    return f"""{emoji} {title}

{body}

────────────────────
{footer}"""


def safe_inline(markup, lang=DEFAULT_LANGUAGE):
    if markup and isinstance(markup, InlineKeyboardMarkup):
        if getattr(markup, "inline_keyboard", None):
            return markup
    return InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")]])


async def safe_edit(msg, text, **kwargs):
    try:
        if msg.text != text:
            await msg.edit_text(text, **kwargs)
    except Exception:
        pass


def g(data, key, default=None):
    if isinstance(data, dict):
        return data.get(key, default)
    return getattr(data, key, default)


def currency_symbol(data, default="?"):
    if isinstance(data, dict):
        symbol = data.get("symbol") or data.get("currency")
        if symbol:
            return str(symbol)
    if data is None:
        return default
    if isinstance(data, str):
        return data
    return getattr(data, "symbol", default) or getattr(data, "currency", default) or default


def safe_float(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def normalize_name(name: str) -> str:
    return (name or "").strip().lower().replace(" ", "_")


def group_products(products):
    grouped = {}
    for p in products:
        cat_id = g(p, "category_id") or g(p, "category", {}).get("id") if isinstance(g(p, "category", {}), dict) else None
        cat_name = g(g(p, "category", {}), "name", "Other")
        grouped.setdefault(cat_name, []).append(p)
    return grouped


async def api_get(url, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return await httpx.AsyncClient(timeout=30.0).get(url, headers=headers)


async def api_post(url, token=None, json=None, params=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return await httpx.AsyncClient(timeout=30.0).post(url, headers=headers, json=json, params=params)


async def api_put(url, token=None, json=None, params=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return await httpx.AsyncClient(timeout=30.0).put(url, headers=headers, json=json, params=params)


async def send_bot_message(user_id, text):
    return None
