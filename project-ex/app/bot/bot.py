from telegram.request import HTTPXRequest
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardRemove,
    KeyboardButton,
    ReplyKeyboardMarkup
)

from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
)
from telegram.error import BadRequest
import asyncio
import logging
import os
import sys
from urllib.parse import quote_plus

# Allow running as "python app/bot/bot.py" by ensuring project root is importable.
if __package__ is None or __package__ == "":
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from app.bot.bot_content import t, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES
from app.bot.features.account import (
    _prompt_account_edit_field as account_prompt_account_edit_field,
    _save_account_edit as account_save_account_edit,
    _show_account_edit_preview as account_show_account_edit_preview,
    _show_irt_deposit_instructions as account_show_irt_deposit_instructions,
    _show_my_account_menu as account_show_my_account_menu,
    _start_account_edit_flow as account_start_account_edit_flow,
    ACCOUNT_FIELD_LABEL_KEYS,
)
from app.bot.features.exchange import _show_exchange_pairs as exchange_show_pairs
from app.bot.features.orders import (
    _show_orders as orders_show_orders,
    _show_product_order_detail as orders_show_product_order_detail,
    _show_product_orders as orders_show_product_orders,
    _show_wire_order_detail as orders_show_wire_order_detail,
    _show_wire_orders as orders_show_wire_orders,
)
from app.bot.features.products import _get_products_by_category, _show_categories as products_show_categories
from app.bot.features.wallet import (
    _find_external_wallet as wallet_find_external_wallet,
    _find_wallet_pair as wallet_find_wallet_pair,
    _load_external_wallets as wallet_load_external_wallets,
    _load_wallet_pairs as wallet_load_wallet_pairs,
    _prompt_external_wallet_input as wallet_prompt_external_wallet_input,
    _prompt_withdraw_amount as wallet_prompt_withdraw_amount,
    _show_external_wallet_details as wallet_show_external_wallet_details,
    _show_wallet_currency_menu as wallet_show_wallet_currency_menu,
    _show_wallet_network_menu as wallet_show_wallet_network_menu,
    watch_deposit as wallet_watch_deposit,
)
from app.bot.features.wire_transfer import (
    _prompt_wire_amount as wire_prompt_amount,
    _send_wire_method_selection as wire_send_method_selection,
    _show_wire_pairs as wire_show_pairs,
    _wire_effective_rate as wire_effective_rate,
    _wire_receiver_field_lines as wire_receiver_field_lines,_wire_receiver_field_lines,
    _wire_effective_rate
)
from app.bot.features import common as shared_common
from app.bot.features.common import (
    IS_GLOBAL_BOT,
    g,
    currency_symbol,
    safe_float,
    normalize_name,
    group_products,
    api_get,
    api_post,
    api_put,
    main_reply_keyboard,
    menu_button_action,
    auth_inline,
    wallet_inline,
    balance_inline,
    language_inline,
    wrap,
    safe_inline,
    get_lang,
    set_lang,
    get_bot_admin_access_points
)

logger = logging.getLogger(__name__)


TOKEN = shared_common.TOKEN
API_URL = shared_common.API_URL

# Shared runtime state used across split feature modules and main dispatcher.
user_state = shared_common.user_state
user_tokens = shared_common.user_tokens
user_last_balance = shared_common.user_last_balance
exchange_state = shared_common.exchange_state

EXTERNAL_WALLET_WARNING_KEY = "ext_wallet_warning"


async def _sync_lang_from_profile(user_id, token):
    """Best-effort: pull the user's saved `language` from /account/me and
    keep the in-memory language cache in sync with it."""
    try:
        res = await api_get(f"{API_URL}/account/me", token)
        if res.status_code == 200:
            lang = (res.json() or {}).get("language")
            if lang in SUPPORTED_LANGUAGES:
                set_lang(user_id, lang)
    except Exception:
        pass


# =====================================================
# HELPERS: send the main menu message
# =====================================================

async def show_main_menu(update_or_message, text=None, user_id=None):
    msg = update_or_message if hasattr(update_or_message, "reply_text") else update_or_message.message
    uid = user_id or (getattr(msg, "chat", None).id if getattr(msg, "chat", None) else None)
    lang = get_lang(uid) if uid is not None else DEFAULT_LANGUAGE
    if text is None:
        text = t("main_menu_title", lang)

    access_points, role = await get_bot_admin_access_points()
    is_full_access = role == "master" or role == "global" or access_points == "*"

    def allowed(*keys):
        return is_full_access or any(k in access_points for k in keys)

    keyboard_rows = [
        [KeyboardButton(t("btn_wallet", lang)), KeyboardButton(t("btn_exchange", lang))],
    ]
    if allowed("products.view"):
        keyboard_rows.append([KeyboardButton(t("btn_products", lang)), KeyboardButton(t("btn_orders", lang))])
    else:
        keyboard_rows.append([KeyboardButton(t("btn_orders", lang))])
    if allowed("wire_transfer.manage", "wire_transfer.view"):
        keyboard_rows.append([KeyboardButton(t("btn_wire", lang)), KeyboardButton(t("btn_my_account", lang))])
    else:
        keyboard_rows.append([KeyboardButton(t("btn_my_account", lang))])
    keyboard_rows.append([KeyboardButton(t("btn_language", lang)), KeyboardButton(t("btn_support", lang))])
    keyboard_rows.append([KeyboardButton(t("btn_logout", lang))])

    reply_markup = ReplyKeyboardMarkup(keyboard_rows, resize_keyboard=True, is_persistent=False)

    token = user_tokens.get(uid) if uid is not None else None
    notice = ""
    if token:
        try:
            res = await api_get(f"{API_URL}/account/me", token)
            if res.status_code == 200 and not res.json().get("personal_info_complete", False):
                notice = t("incomplete_profile_notice", lang)
        except Exception:
            notice = ""
    await msg.reply_text(f"{text}{notice}", reply_markup=reply_markup)

# =====================================================
# /start
# =====================================================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_chat.id
    token   = user_tokens.get(user_id)

    if token:
        await _sync_lang_from_profile(user_id, token)
        lang = get_lang(user_id)
        await show_main_menu(update.message, t("welcome_back_choose", lang), user_id=user_id)
        return

    # New/unauthenticated users start on the bot-admin's configured default
    # language (see admin_default_language below) until they explicitly
    # change it with the "🌐 Language" button.
    lang = get_lang(user_id)
    user_state[user_id] = {}
    await update.message.reply_text(
        t("welcome_login_prompt", lang),
        reply_markup=auth_inline(lang),
    )


async def set_admin_default_language(default_language):
    """Called once at bot startup (see main()) to seed the language new,
    not-yet-known users see before their own preference is known. Individual
    users still default to DEFAULT_LANGUAGE in get_lang() until this or their
    own choice sets user_languages[user_id] explicitly; this only affects the
    module-level DEFAULT_LANGUAGE fallback used for brand-new chats.
    """
    global DEFAULT_LANGUAGE  # noqa: PLW0603 - intentional process-wide default
    if default_language in SUPPORTED_LANGUAGES:
        import app.bot.bot_content as bot_content
        bot_content.DEFAULT_LANGUAGE = default_language


# =====================================================
# MESSAGE HANDLER — routes reply-keyboard taps + free text
# =====================================================
async def message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_chat.id
    text    = update.message.text.strip()
    state   = user_state.get(user_id, {})
    token   = user_tokens.get(user_id)
    lang    = get_lang(user_id)

    action = menu_button_action(text, lang)

    # ── GUARD: only logged-in users may use the main menu buttons ──
    if action and not token:
        await update.message.reply_text(
            t("please_login_first", lang),
            reply_markup=auth_inline(lang),
        )
        return

    # ==============================================================
    # MAIN MENU BUTTON TAPS
    # ==============================================================

    # ── 💰 WALLET ─────────────────────────────────────────────────
    if action == "btn_wallet":
        await update.message.reply_text(
            wrap(t("wallet_dashboard_title", lang), t("wallet_dashboard_body", lang), lang=lang),
            reply_markup=safe_inline(wallet_inline(lang), lang)
        )
        return

    # ── 🔄 EXCHANGE ───────────────────────────────────────────────
    if action == "btn_exchange":
        await _show_exchange_pairs(update.message, token, user_id)
        return

    # ── 📦 PRODUCTS ───────────────────────────────────────────────
    if action == "btn_products":
        await _show_categories(update.message, token, user_id)
        return

    # ── 📋 MY ORDERS ──────────────────────────────────────────────
    if action == "btn_orders":
        await _show_orders(update.message, token, user_id)
        return

    # ── 🏦 WIRE TRANSFER ──────────────────────────────────────────
    if action == "btn_wire":
        await _show_wire_pairs(update.message, token)
        return

    # ── 👤 MY ACCOUNT ─────────────────────────────────────────────
    if action == "btn_my_account":
        await _show_my_account_menu(update.message, token, user_id)
        return

    # ── 🌐 LANGUAGE ───────────────────────────────────────────────
    if action == "btn_language":
        await update.message.reply_text(
            wrap(t("language_title", lang), t("language_prompt", lang), lang=lang),
            reply_markup=language_inline(lang),
        )
        return

    # ── 🧠 SUPPORT ────────────────────────────────────────────────
    if action == "btn_support":
        await update.message.reply_text(
            wrap(t("support_title", lang), t("support_body", lang), lang=lang),
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn_open_support", lang), url="https://t.me/projectexTestkarman_bot")],
                [InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")]
            ]),
        )
        return

    # ── 🚪 LOGOUT ─────────────────────────────────────────────────
    if action == "btn_logout":
        user_tokens.pop(user_id, None)
        user_state.pop(user_id, None)
        user_last_balance.pop(user_id, None)
        exchange_state.pop(user_id, None)
        await update.message.reply_text(
            t("auth_logged_out", lang),
            reply_markup=ReplyKeyboardRemove(),
        )
        return

    # ==============================================================
    # FLOW STEPS (free-text input)
    # ==============================================================

    # ── LOGIN: USERNAME ───────────────────────────────────────────
    if state.get("step") == "login_username":
        state["username"] = text
        state["step"]     = "login_password"
        user_state[user_id] = state
        await update.message.reply_text(t("auth_enter_password", lang))
        return

    # ── LOGIN: PASSWORD ───────────────────────────────────────────
    if state.get("step") == "login_password":
        try:
            res = await api_post(
                f"{API_URL}/auth/login",
                json={"username": state["username"], "password": text, "telegram_id": str(user_id)},
            )
            try:
                data = res.json()
            except Exception:
                await update.message.reply_text(
                    t("auth_invalid_server_response", lang).format(status=res.status_code, raw=res.text)
                )
                return
        except Exception as e:
            await update.message.reply_text(t("auth_connection_error", lang).format(error=str(e)))
            return

        if res.status_code != 200:
            error_msg = data.get("detail", "Invalid username or password")
            user_state[user_id] = {}
            await update.message.reply_text(
                t("auth_login_failed", lang).format(error=error_msg),
                reply_markup=auth_inline(lang),
            )
            return

        token = data.get("access_token")
        if not token:
            user_state[user_id] = {}
            await update.message.reply_text(
                t("auth_login_no_token", lang),
                reply_markup=auth_inline(lang),
            )
            return

        user_tokens[user_id] = token
        if IS_GLOBAL_BOT:
            elig_res = await api_get(f"{API_URL}/account/global-bot-eligibility", token)
            eligible = elig_res.status_code == 200 and elig_res.json().get("eligible")
            if not eligible:
                user_tokens.pop(user_id, None)
                user_state[user_id] = {}
                await update.message.reply_text(
                    "❌ This account is not available on this bot.",
                    reply_markup=ReplyKeyboardRemove(),
                )
                return
        user_state[user_id]  = {}
        username = data.get("username", "user")
        if data.get("language") in SUPPORTED_LANGUAGES:
            set_lang(user_id, data.get("language"))
        else:
            await _sync_lang_from_profile(user_id, token)
        lang = get_lang(user_id)

        await show_main_menu(
            update.message,
            wrap(
                t("auth_welcome_back_title", lang),
                t("auth_welcome_back_body", lang).format(username=username),
                lang=lang,
            ),
            user_id=user_id,
        )
        return

    # ── SIGNUP: USERNAME ──────────────────────────────────────────
    if state.get("step") == "signup_username":
        state["username"] = text
        state["step"]     = "signup_password"
        user_state[user_id] = state
        await update.message.reply_text(t("auth_choose_password", lang))
        return

    # ── SIGNUP: PASSWORD ──────────────────────────────────────────
    if state.get("step") == "signup_password":
        state["password"] = text
        state["step"]     = "signup_invite"
        user_state[user_id] = state
        await update.message.reply_text(t("auth_enter_invite_code", lang))
        return

    # ── SIGNUP: INVITATION CODE ───────────────────────────────────
    if state.get("step") == "signup_invite":
        payload = {
            "username":        state["username"],
            "password":        state["password"],
            "invitation_code": text,
            "language":        lang,
        }
        try:
            res = await api_post(f"{API_URL}/auth/signup", json=payload)
            try:
                data = res.json()
            except Exception:
                await update.message.reply_text(
                    t("auth_signup_server_error", lang).format(status=res.status_code, raw=res.text)
                )
                return
        except Exception as e:
            await update.message.reply_text(t("auth_connection_error", lang).format(error=str(e)))
            return

        if res.status_code != 200:
            error_msg = data.get("detail", "Sign up failed")
            user_state[user_id] = {}
            await update.message.reply_text(
                t("auth_signup_failed", lang).format(error=error_msg),
                reply_markup=auth_inline(lang),
            )
            return

        saved_username = state["username"]
        saved_password = state["password"]
        user_state[user_id] = {}

        await update.message.reply_text(
            t("auth_account_created", lang).format(
                username=saved_username,
                password=saved_password,
                wallet=data.get("wallet_address", "Pending"),
            )
        )

        # Auto-login
        try:
            login_res  = await api_post(
                f"{API_URL}/auth/login",
                json={"username": saved_username, "password": saved_password, "telegram_id": str(user_id)},
            )
            login_data = login_res.json()
            auto_token = login_data.get("access_token")
        except Exception:
            auto_token = None

        if auto_token:
            user_tokens[user_id] = auto_token
            if IS_GLOBAL_BOT:
                elig_res = await api_get(f"{API_URL}/account/global-bot-eligibility", auto_token)
                eligible = elig_res.status_code == 200 and elig_res.json().get("eligible")
                if not eligible:
                    user_tokens.pop(user_id, None)
                    user_state[user_id] = {}
                    await update.message.reply_text(
                        "❌ This account is not available on this bot.",
                        reply_markup=ReplyKeyboardRemove(),
                    )
                    return
            await show_main_menu(update.message, t("auth_logged_in", lang), user_id=user_id)
        else:
            await update.message.reply_text(t("auth_signup_ok_login_failed", lang))
        return

    # ── ACCOUNT EDIT: COLLECT VALUES ─────────────────────────────
    if state.get("step") == "account_edit_collect":
        mode = state.get("account_edit_mode")
        fields = state.get("account_edit_fields", [])
        index = state.get("account_edit_index", 0)
        field = fields[index]
        current_values = state.get("account_edit_current_values", {})
        raw_value = (text or "").strip()

        if raw_value.lower() in {"skip", "/skip"}:
            value = current_values.get(field, "")
        elif raw_value:
            value = raw_value
        else:
            value = current_values.get(field, "")

        state.setdefault("account_edit_values", {})[field] = value
        next_index = index + 1

        if next_index < len(fields):
            state["account_edit_index"] = next_index
            user_state[user_id] = state
            await _prompt_account_edit_field(update.message, state, user_id)
            return

        state["step"] = "account_edit_preview"
        user_state[user_id] = state
        await _show_account_edit_preview(update.message, state, user_id)
        return

    # ── DEPOSIT AMOUNT ────────────────────────────────────────────
    if state.get("step") == "deposit_amount":
        amount = safe_float(text)
        res    = await api_post(
            f"{API_URL}/wallet/deposit",
            token=token,
            params={"amount": amount},
        )
        user_state[user_id] = {}
        if res.status_code == 200:
            await update.message.reply_text(t("wallet_irt_confirmed_pending", lang))
        else:
            await update.message.reply_text(t("wallet_deposit_failed", lang))
        return

    # ── WITHDRAW: AMOUNT ──────────────────────────────────────────
    if state.get("step") == "withdraw_amount":
        amount = safe_float(text)
        if amount <= 0:
            await update.message.reply_text(t("wallet_invalid_amount_positive", lang))
            return
        wallet_address = state.get("wallet_address")
        pair = state.get("pair")
        currency = state.get("currency")
        network = state.get("network")
        chain = state.get("chain") or network

        if not wallet_address or not pair or not currency or not network:
            user_state[user_id] = {}
            await update.message.reply_text(t("wallet_err_session_expired_reselect", lang))
            return
        user_state[user_id] = {
            "step": "withdraw_confirm",
            "amount": amount,
            "wallet_address": wallet_address,
            "pair": pair,
            "currency": currency,
            "network": network,
            "chain": chain,
        }
        await update.message.reply_text(
            wrap(
                t("wallet_confirm_withdrawal_title", lang),
                t("wallet_confirm_withdrawal_body", lang).format(
                    amount=amount, currency=currency, network=network, chain=chain, wallet=wallet_address
                ),
                lang=lang,
            ),
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn_confirm", lang), callback_data="withdraw_confirm"),
                InlineKeyboardButton(t("btn_cancel", lang), callback_data="withdraw_cancel")],
                [InlineKeyboardButton(t("btn_back", lang), callback_data="wallet_back")]
            ]),
        )
        return

    # ── EXTERNAL WALLET: ADDRESS INPUT ────────────────────────────
    if state.get("step") == "external_wallet_input":
        wallet_address = text.strip()
        if not wallet_address:
            await update.message.reply_text(t("ext_wallet_address_empty", lang))
            return

        state["pending_address"] = wallet_address
        state["step"] = "external_wallet_confirm"
        user_state[user_id] = state

        await update.message.reply_text(
            wrap(
                t("ext_wallet_confirm_title", lang),
                t("ext_wallet_confirm_body", lang).format(
                    currency=state.get("currency"),
                    network=state.get("network"),
                    chain=state.get("chain"),
                    warning=t(EXTERNAL_WALLET_WARNING_KEY, lang),
                    address=wallet_address,
                ),
                lang=lang,
            ),
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn_confirm", lang), callback_data="extwallet_confirm")],
                [InlineKeyboardButton(t("btn_re_enter", lang), callback_data="extwallet_reenter")],
                [InlineKeyboardButton(t("btn_cancel", lang), callback_data="extwallet_cancel")],
            ])
        )
        return

    # ── WIRE TRANSFER: COLLECT FIELDS ────────────────────────────
    # `wire_collect_purpose` tells us which batch of fields is being collected:
    #  • "pair_fields"   → Case B (from != IRT): the pair-level sender_fields,
    #                       always the user's IRT receiving bank account.
    #  • "method_fields" → Case A (from == IRT): the SELECTED method's own
    #                       sender_fields — the user's destination account
    #                       for the foreign currency (e.g. their Wise account).
    if state.get("step") == "wire_collect_fields":
        pair          = state["wire_pair"]
        fields        = state["wire_fields"]
        queue         = state["wire_field_queue"]
        collected     = state["wire_collected"]
        purpose       = state.get("wire_collect_purpose", "method_fields")
        current_key   = queue[0]
        field_def     = fields[current_key]
        collected[current_key] = text.strip()
        queue.pop(0)

        if queue:
            next_key   = queue[0]
            next_field = fields[next_key]
            state["wire_field_queue"] = queue
            state["wire_collected"]   = collected
            user_state[user_id]       = state
            req_label = "" if next_field.get("required") else t("wire_field_optional_suffix", lang)
            await update.message.reply_text(t("wire_field_prompt", lang).format(label=next_field.get("label", next_key), required=req_label))
            return

        # this batch is complete
        methods = state.get("wire_receiver_methods") or []
        state.pop("wire_field_queue", None)
        state.pop("wire_fields", None)
        state.pop("wire_collected", None)
        state.pop("wire_collect_purpose", None)

        if purpose == "pair_fields":
            # Case B: IRT receiving account captured. Move on to method selection
            # (how the user will pay in the foreign currency), or straight to
            # amount if this pair has no methods configured.
            state["wire_pair_collected"] = collected
            if methods:
                state["step"] = "wire_select_method"
                user_state[user_id] = state
                await _send_wire_method_selection(update.message.reply_text, pair, methods, lang)
            else:
                state["step"] = "wire_amount"
                user_state[user_id] = state
                await _prompt_wire_amount(update.message.reply_text, pair, lang=lang)
            return

        # purpose == "method_fields" (Case A): destination account captured → amount
        state["wire_method_collected"] = collected
        state["step"] = "wire_amount"
        user_state[user_id] = state
        await _prompt_wire_amount(update.message.reply_text, pair, selected_method=state.get("wire_selected_method"), lang=lang)
        return

    # ── WIRE TRANSFER: AMOUNT ─────────────────────────────────────
    if state.get("step") == "wire_amount":
        amount = safe_float(text)
        if amount <= 0:
            await update.message.reply_text(t("wire_invalid_amount", lang))
            return

        pair            = state["wire_pair"]
        is_irt_source   = state.get("wire_is_irt_source", False)
        selected_method = state.get("wire_selected_method") or {}
        pair_collected  = state.get("wire_pair_collected") or {}
        method_collected = state.get("wire_method_collected") or {}
        from_sym  = g(g(pair, "from_currency", {}), "symbol", "?")
        to_sym    = g(g(pair, "to_currency", {}), "symbol", "?")

        # Enforce pair min/max limits — re-prompt for a valid amount (or cancel)
        # rather than silently rejecting or letting the backend reject it later.
        min_a = safe_float(g(pair, "min_amount", 0))
        max_a_raw = g(pair, "max_amount", None)
        max_a = safe_float(max_a_raw) if max_a_raw not in (None, "") else None
        cancel_markup = InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_cancel", lang), callback_data="wire_cancel")]])
        if min_a > 0 and amount < min_a:
            await update.message.reply_text(
                t("wire_amount_min_error", lang).format(amount=min_a, currency=from_sym),
                reply_markup=cancel_markup
            )
            return
        if max_a is not None and max_a > 0 and amount > max_a:
            await update.message.reply_text(
                t("wire_amount_max_error", lang).format(amount=max_a, currency=from_sym),
                reply_markup=cancel_markup
            )
            return

        rate_display = safe_float(g(pair, "rate", 0))
        rate         = _wire_effective_rate(pair)  # calculation multiplier (inverted for IRT-source pairs)
        fee_pct   = safe_float(selected_method.get("fee_percent", 0)) if selected_method else safe_float(g(pair, "fee_percent", 0))
        fee_amt   = round(amount * fee_pct / 100, 4)
        to_amount = round((amount - fee_amt) * rate, 4)

        state.update({"step": "wire_confirm", "wire_amount": amount, "wire_fee": fee_amt, "wire_to_amount": to_amount})
        user_state[user_id] = state

        summary_lines = []
        if selected_method:
            summary_lines.append(t("wire_summary_method_line", lang).format(method=selected_method.get("label", selected_method.get("key", ""))))

        if is_irt_source:
            # Case A: show the destination account the user just entered
            # (the method's own sender_fields — e.g. their Wise account).
            method_sender_defs = selected_method.get("sender_fields") or {}
            for k, v in method_collected.items():
                label = (method_sender_defs.get(k, {}) or {}).get("label", k.replace("_", " ").title())
                summary_lines.append(t("wire_summary_line", lang).format(label=label, value=v))
        else:
            # Case B: show the IRT receiving account collected at step 1
            # (pair-level sender_fields).
            pair_field_defs = pair.get("sender_fields") or pair.get("required_fields", {})
            for k, v in pair_collected.items():
                label = (pair_field_defs.get(k, {}) or {}).get("label", k.replace("_", " ").title())
                summary_lines.append(t("wire_summary_line", lang).format(label=label, value=v))

        summary = "\n".join(summary_lines)

        # Admin-configured receiver info — always "where to send your {from_sym}":
        # the platform's IRT bank account (Case A) or the platform's foreign
        # account for that method, e.g. Wise/SWIFT (Case B).
        receiver_block = t("wire_no_receiver_configured", lang)
        if selected_method:
            receiver_lines = _wire_receiver_field_lines(selected_method)
            if receiver_lines:
                receiver_block = "\n   ".join(receiver_lines)
        extra_block = t("wire_send_to_block", lang).format(from_symbol=from_sym, receiver_block=receiver_block) if selected_method else ""

        await update.message.reply_text(
            wrap(
                t("wire_confirm_title", lang),
                t("wire_confirm_body", lang).format(
                    from_symbol=from_sym, to_symbol=to_sym, amount=amount, fee_amt=fee_amt, fee_pct=fee_pct,
                    to_amount=to_amount, rate_display=rate_display, summary=summary, extra_block=extra_block,
                ),
                lang=lang,
            ),
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn_confirm", lang), callback_data="wire_confirm"),
                 InlineKeyboardButton(t("btn_cancel", lang), callback_data="wire_cancel")],
            ])
        )
        return

    # ── EXCHANGE: AMOUNT ──────────────────────────────────────────
    if state.get("step") == "exchange_amount":
        amount = safe_float(text)
        if amount <= 0:
            await update.message.reply_text(t("exchange_invalid_amount", lang))
            return

        from_currency = state.get("from_currency")
        to_currency   = state.get("to_currency")

        preview_res = await api_post(
            f"{API_URL}/exchange/preview",
            token=token,
            json={"from_currency": from_currency, "to_currency": to_currency, "amount": amount},
        )
        if preview_res.status_code != 200:
            try:
                err = preview_res.json().get("detail", "Preview failed")
            except Exception:
                err = "Preview failed"
            await update.message.reply_text(t("exchange_preview_failed", lang).format(error=err))
            return

        preview = preview_res.json()
        state.update({"amount": amount, "preview": preview, "step": "exchange_confirm"})
        user_state[user_id] = state

        await update.message.reply_text(
            wrap(
                t("exchange_confirm_title", lang),
                t("exchange_confirm_body", lang).format(
                    from_currency=preview["from_currency"], to_currency=preview["to_currency"],
                    input_amount=preview["input_amount"], rate=preview["rate"],
                    fee_amount=preview["fee_amount"], received_amount=preview["received_amount"],
                ),
                lang=lang,
            ),
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn_confirm", lang), callback_data="exchange_confirm"),
                InlineKeyboardButton(t("btn_cancel", lang), callback_data="exchange_cancel")],
                [InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")]
            ]),
        )
        return
    # =====================================================
    # DYNAMIC PRODUCT INPUT ENGINE (STEP 2)
    # =====================================================
    if state.get("step") == "collect_product_inputs":
        product_id   = state["product_id"]
        fields       = state["fields"]
        queue        = state["field_queue"]
        input_data   = state["input_data"]

        # current field
        current_key   = queue[0]
        current_field = fields[current_key]

        # save user input
        input_data[current_key] = text

        # move to next field
        queue.pop(0)

        # -------------------------
        # MORE FIELDS LEFT
        # -------------------------
        if queue:
            next_key = queue[0]
            next_field = fields[next_key]

            state["field_queue"] = queue
            state["input_data"] = input_data
            user_state[user_id] = state

            await update.message.reply_text(t("product_next_field", lang).format(field=next_field.get("label", next_key)))
            return

        # =====================================================
        # NEW STEP: CONFIRM INPUTS (IMPORTANT CHANGE)
        # =====================================================

        state["step"] = "confirm_product_inputs"
        state["input_data"] = input_data
        user_state[user_id] = state

        # build summary
        summary = t("product_confirm_details_header", lang)
        for k, v in input_data.items():
            label = fields[k].get("label", k)
            summary += t("product_confirm_line", lang).format(label=label, value=v)

        await update.message.reply_text(
            wrap(
                t("product_confirm_details_title", lang),
                summary + t("product_confirm_details_footer", lang),
                lang=lang,
            ),
            reply_markup=InlineKeyboardMarkup([
                [
                    InlineKeyboardButton(t("btn_confirm", lang), callback_data="confirm_input"),
                    InlineKeyboardButton(t("btn_reenter", lang), callback_data="reenter_input")
                ]
            ])
        )
        return


# =====================================================
# INLINE BUTTON HANDLER
# =====================================================
async def button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    try:
        await q.answer()
    except BadRequest as exc:
        msg = str(exc)
        if "Query is too old" not in msg and "query id is invalid" not in msg:
            raise
    user_id = q.message.chat.id
    token   = user_tokens.get(user_id)
    state   = user_state.get(user_id, {})
    lang    = get_lang(user_id)

    if q.data == "back_main":
        await q.message.delete()
        await show_main_menu(q.message, t("main_menu_choose", lang), user_id=user_id)
        return

    # ── LANGUAGE SELECTION ──────────────────────────────────────────
    if q.data in ("setlang_en", "setlang_fa"):
        new_lang = "en" if q.data == "setlang_en" else "fa"
        set_lang(user_id, new_lang)
        if token:
            try:
                await api_put(f"{API_URL}/account/me", token=token, json={"language": new_lang})
            except Exception:
                pass
        await q.message.edit_text(t("language_updated", new_lang))
        await show_main_menu(q.message, t("main_menu_title", new_lang), user_id=user_id)
        return

    if q.data == "myaccount_cancel":
        user_state[user_id] = {}
        await q.message.edit_text(
            t("account_cancelled", lang),
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")]])
        )
        return

    if q.data == "myaccount_edit_profile":
        user_state[user_id] = {}
        await _start_account_edit_flow(q.message, token, "profile", user_id)
        return

    if q.data == "myaccount_edit_bank":
        user_state[user_id] = {}
        await _start_account_edit_flow(q.message, token, "bank", user_id)
        return

    if q.data.startswith("myaccount_confirm_"):
        mode = "profile" if q.data.endswith("profile") else "bank"
        state = user_state.get(user_id, {})
        values = state.get("account_edit_values", {})

        if not values:
            await q.message.edit_text(t("account_no_changes", lang), reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")]]))
            return

        res = await _save_account_edit(token, mode, values)
        if res.status_code in {200, 201, 204}:
            user_state[user_id] = {}
            section = t("account_profile_section", lang) if mode == "profile" else t("account_bank_section", lang)
            await q.message.edit_text(
                t("account_updated_success", lang).format(section=section),
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")]])
            )
        else:
            try:
                err = res.json().get("detail", "Update failed")
            except Exception:
                err = "Update failed"
            await q.message.edit_text(t("account_update_failed", lang).format(error=err), reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")]]))
        return

    if q.data.startswith("myaccount_edit_again_"):
        mode = q.data.replace("myaccount_edit_again_", "")
        current_state = user_state.get(user_id, {})
        draft_values = current_state.get("account_edit_values", {}) or {}
        fields = ["first_name", "last_name", "email", "phone_number"] if mode == "profile" else ["bank_holder_name", "bank_card_number", "bank_name", "bank_sheba"]
        user_state[user_id] = {
            "step": "account_edit_collect",
            "account_edit_mode": mode,
            "account_edit_fields": fields,
            "account_edit_index": 0,
            "account_edit_values": {},
            "account_edit_current_values": draft_values,
        }
        await _prompt_account_edit_field(q.message, user_state[user_id], user_id)
        return

    # ── AUTH ──────────────────────────────────────────────────────
    if q.data == "auth_login":
        user_state[user_id] = {"step": "login_username"}
        await q.message.edit_text(t("auth_enter_username", lang))
        return

    if q.data == "auth_signup":
        user_state[user_id] = {"step": "signup_username"}
        await q.message.edit_text(
            t("auth_signup_intro", lang),
            parse_mode="Markdown",
        )
        return

    # ── WALLET SUBMENU ────────────────────────────────────────────
    if q.data == "wallet_balance":
        res  = await api_get(f"{API_URL}/wallet/balance", token)
        data = res.json()

        balances = g(data, "balances", [])
        address  = g(data, "wallet_address", "N/A")
        text     = t("wallet_balance_header", lang)

        if balances:
            for b in balances:
                currency  = g(b, "currency",  "UNKNOWN")
                network   = g(b, "network",   "UNKNOWN")
                available = safe_float(g(b, "available", 0))
                frozen    = safe_float(g(b, "frozen",    0))
                text += t("wallet_balance_row", lang).format(currency=currency, network=network, available=available, frozen=frozen)
        else:
            text += t("wallet_balance_none", lang)

        text += t("wallet_balance_address", lang).format(address=address)

        await q.message.edit_text(wrap(t("wallet_balance_title", lang), text, lang=lang),
                                  parse_mode="Markdown",
                                  reply_markup=balance_inline(lang))
        return

    if q.data == "wallet_external":
        try:
            user_state[user_id] = {}
            data, error = await _load_wallet_pairs(user_id, token)
            if error:
                await q.message.edit_text(
                    f"❌ {error}",
                    reply_markup=safe_inline(balance_inline(lang), lang)
                )
                return

            wallets, wallet_error = await _load_external_wallets(user_id, token)
            if wallet_error:
                await q.message.edit_text(
                    f"❌ {wallet_error}",
                    reply_markup=safe_inline(balance_inline(lang), lang)
                )
                return

            _wallet_state(user_id)["external_wallets"] = wallets
            currencies = data.get("currencies", [])
            if not currencies:
                await q.message.edit_text(
                    t("wallet_err_load_external", lang),
                    reply_markup=safe_inline(balance_inline(lang), lang)
                )
                return

            await _show_wallet_currency_menu(
                q.message,
                currencies,
                "extwallet_currency_",
                t("wallet_select_currency_external_title", lang),
                t("wallet_select_currency_external_subtitle", lang),
                "wallet_balance",
                lang=lang,
            )
            return
        except Exception as e:
            logger.error(f"Error loading external wallets: {e}")
            await q.message.edit_text(
                t("wallet_generic_error", lang).format(error=str(e)),
                reply_markup=safe_inline(balance_inline(lang), lang)
            )
            return

    if q.data == "wallet_deposit":
        # Fetch available currency/network pairs
        try:
            res = await api_get(
                f"{API_URL}/wallet/currency-networks",
                token
            )
            if res.status_code != 200:
                await q.message.edit_text(
                    t("wallet_err_load_deposit_options", lang),
                    reply_markup=safe_inline(wallet_inline(lang), lang)
                )
                return

            data = res.json()
            currencies = data.get("currencies", [])

            if not currencies:
                await q.message.edit_text(
                    t("wallet_err_no_deposit_currencies", lang),
                    reply_markup=safe_inline(wallet_inline(lang), lang)
                )
                return

            # Store currencies for later retrieval in network selection
            exchange_state[user_id] = {"currencies": currencies, "pairs": data.get("pairs", [])}

            # Build currency selection menu
            keyboard = []
            for currency in sorted(currencies):
                keyboard.append([
                    InlineKeyboardButton(currency, callback_data=f"deposit_currency_{currency}")
                ])
            keyboard.append([InlineKeyboardButton(t("btn_back", lang), callback_data="wallet_back")])

            await q.message.edit_text(
                t("wallet_select_deposit_currency_title", lang) + t("wallet_select_deposit_currency_subtitle", lang),
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            return
        except Exception as e:
            logger.error(f"Error loading currencies: {e}")
            await q.message.edit_text(
                t("wallet_err_load_currencies", lang).format(error=str(e)),
                reply_markup=safe_inline(wallet_inline(lang), lang)
            )
            return

    # ── DEPOSIT: CURRENCY SELECTION ────────────────────────────────────
    if q.data.startswith("deposit_currency_"):
        currency = q.data.replace("deposit_currency_", "")

        if currency.upper() == "IRT":
            await _show_irt_deposit_instructions(q.message, token, user_id=user_id)
            return

        # Store currency in state
        exchange_state[user_id] = exchange_state.get(user_id, {})
        exchange_state[user_id]["deposit_currency"] = currency

        # Get pairs from state or fetch again
        pairs = exchange_state[user_id].get("pairs", [])
        if not pairs:
            res = await api_get(
                f"{API_URL}/wallet/currency-networks",
                token
            )
            if res.status_code != 200:
                await q.message.edit_text(
                    t("wallet_err_load_currencies", lang).format(error="—"),
                    reply_markup=safe_inline(wallet_inline(lang), lang)
                )
                return
            pairs = res.json().get("pairs", [])
            exchange_state[user_id]["pairs"] = pairs

        # Filter to only this currency
        networks = [p for p in pairs if p["currency"] == currency]

        if not networks:
            await q.message.edit_text(
                t("wallet_err_no_networks_for_currency", lang).format(currency=currency),
                reply_markup=safe_inline(wallet_inline(lang), lang)
            )
            return

        # Build network selection menu
        keyboard = []
        for net in sorted(networks, key=lambda x: x["network"]):
            btn_text = f"{net['network']}"
            keyboard.append([
                InlineKeyboardButton(
                    btn_text,
                    callback_data=f"deposit_network_{currency}_{net['network_id']}"
                )
            ])
        keyboard.append([
            InlineKeyboardButton(t("btn_back", lang), callback_data="wallet_deposit")
        ])

        await q.message.edit_text(
            t("wallet_select_network_title", lang).format(currency=currency) + t("wallet_select_network_subtitle", lang),
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return

    # ── DEPOSIT: NETWORK SELECTION & ADDRESS DISPLAY ────────────────────
    if q.data.startswith("deposit_network_"):
        parts = q.data.replace("deposit_network_", "").split("_")
        currency = parts[0]
        network_id = int(parts[1])

        # Get currency_id from pairs
        state_pairs = exchange_state.get(user_id, {}).get("pairs", [])
        matching = [p for p in state_pairs if p["currency"] == currency and p["network_id"] == network_id]

        if not matching:
            await q.message.edit_text(t("wallet_err_invalid_selection", lang), reply_markup=safe_inline(wallet_inline(lang), lang))
            return

        pair = matching[0]
        currency_id = pair["currency_id"]

        exchange_state[user_id] = {
            "deposit_currency": currency,
            "deposit_network_id": network_id,
            "deposit_currency_id": currency_id
        }

        # Get or create wallet address
        try:
            wallet_res = await api_post(
                f"{API_URL}/wallet/get-deposit-address",
                token=token,
                json={"currency_id": currency_id, "network_id": network_id}
            )

            if wallet_res.status_code != 200:
                error_detail = wallet_res.json().get("detail", "Failed to generate wallet")
                await q.message.edit_text(
                    t("wallet_err_generate_wallet", lang).format(detail=error_detail),
                    reply_markup=safe_inline(wallet_inline(lang), lang)
                )
                return
            wallet_data = wallet_res.json()
            address = wallet_data.get("address")
            min_amount = pair.get("min_deposit", 0)
            max_amount = pair.get("max_deposit", 0)
            confirmations = pair.get("confirmations_required", 1)

            # Show wallet with info
            min_max_text = ""
            if min_amount > 0:
                min_max_text += t("wallet_deposit_min_line", lang).format(amount=min_amount)
            if max_amount > 0:
                min_max_text += t("wallet_deposit_max_line", lang).format(amount=max_amount)

            await q.message.edit_text(
                t("wallet_deposit_address_body", lang).format(
                    currency=currency, network=pair["network"], address=address,
                    min_max_text=min_max_text, confirmations=confirmations,
                ),
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton(t("btn_back", lang), callback_data="wallet_back")]
                ])
            )

            # Start watching for deposit
            asyncio.create_task(watch_deposit(user_id, token))

        except Exception as e:
            logger.error(f"Error getting deposit address: {e}")
            await q.message.edit_text(
                t("wallet_generic_error", lang).format(error=str(e)),
                reply_markup=safe_inline(wallet_inline(lang), lang)
            )
            return

    if q.data.startswith("extwallet_currency_"):
        currency = q.data.replace("extwallet_currency_", "")
        user_state[user_id] = {}

        if not exchange_state.get(user_id, {}).get("pairs"):
            data, error = await _load_wallet_pairs(user_id, token)
            if error:
                await q.message.edit_text(
                    f"❌ {error}",
                    reply_markup=safe_inline(balance_inline(lang), lang)
                )
                return
            _wallet_state(user_id)["currencies"] = data.get("currencies", [])

        if "external_wallets" not in exchange_state.get(user_id, {}):
            wallets, wallet_error = await _load_external_wallets(user_id, token)
            if wallet_error:
                await q.message.edit_text(
                    f"❌ {wallet_error}",
                    reply_markup=safe_inline(balance_inline(lang), lang)
                )
                return
            _wallet_state(user_id)["external_wallets"] = wallets

        await _show_wallet_network_menu(
            q.message,
            user_id,
            currency,
            "extwallet_network_",
            t("wallet_select_network_title", lang).format(currency=currency).replace("\n\n", ""),
            t("wallet_select_currency_external_subtitle", lang),
            "wallet_external"
        )
        return

    if q.data.startswith("extwallet_network_"):
        parts = q.data.replace("extwallet_network_", "").split("_")
        currency = parts[0]
        network_id = int(parts[1])
        user_state[user_id] = {}
        pair = _find_wallet_pair(user_id, currency, network_id)

        if not pair:
            await q.message.edit_text(
                t("wallet_err_invalid_selection", lang),
                reply_markup=safe_inline(balance_inline(lang), lang)
            )
            return

        if "external_wallets" not in exchange_state.get(user_id, {}):
            wallets, wallet_error = await _load_external_wallets(user_id, token)
            if wallet_error:
                await q.message.edit_text(
                    f"❌ {wallet_error}",
                    reply_markup=safe_inline(balance_inline(lang), lang)
                )
                return
            _wallet_state(user_id)["external_wallets"] = wallets

        await _show_external_wallet_details(q.message, user_id, pair)
        return

    if q.data == "extwallet_set":
        pair = exchange_state.get(user_id, {}).get("selected_external_pair")
        if not pair:
            await q.message.edit_text(
                t("ext_wallet_session_expired_reselect", lang),
                reply_markup=safe_inline(balance_inline(lang), lang)
            )
            return

        await _prompt_external_wallet_input(q.message, user_id, pair)
        return

    if q.data == "extwallet_reenter":
        state = user_state.get(user_id, {})
        pair = state.get("pair")
        if not pair:
            await q.message.edit_text(
                t("ext_wallet_session_expired_reselect", lang),
                reply_markup=safe_inline(balance_inline(lang), lang)
            )
            return

        state["step"] = "external_wallet_input"
        state.pop("pending_address", None)
        user_state[user_id] = state
        await q.message.edit_text(
            t("ext_wallet_reenter_title", lang).format(
                currency=state.get("currency"), network=state.get("network"), chain=state.get("chain"),
                warning=t(EXTERNAL_WALLET_WARNING_KEY, lang),
            ),
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn_cancel", lang), callback_data="extwallet_cancel")]
            ])
        )
        return

    if q.data == "extwallet_cancel":
        state = user_state.get(user_id, {})
        return_to = state.get("return_to")
        user_state[user_id] = {}
        back_callback = "wallet_withdraw" if return_to == "withdraw" else "wallet_external"
        await q.message.edit_text(
            t("ext_wallet_update_cancelled", lang),
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn_back", lang), callback_data=back_callback)]
            ])
        )
        return

    if q.data == "extwallet_confirm":
        state = user_state.get(user_id, {})
        pair = state.get("pair")
        wallet_address = state.get("pending_address")

        if not pair or not wallet_address:
            user_state[user_id] = {}
            await q.message.edit_text(
                t("wallet_err_session_expired_try_again", lang),
                reply_markup=safe_inline(balance_inline(lang), lang)
            )
            return

        await q.message.edit_text(t("ext_wallet_saving", lang))
        try:
            res = await api_post(
                f"{API_URL}/wallet/external-wallet",
                token=token,
                json={
                    "currency_id": pair["currency_id"],
                    "network_id": pair["network_id"],
                    "address": wallet_address,
                }
            )
            try:
                data = res.json()
            except Exception:
                data = {}

            if res.status_code != 200:
                detail = data.get("detail", res.text)
                await q.message.edit_text(
                    t("ext_wallet_save_failed", lang).format(detail=detail),
                    reply_markup=InlineKeyboardMarkup([
                        [InlineKeyboardButton(t("btn_re_enter", lang), callback_data="extwallet_reenter")],
                        [InlineKeyboardButton(t("btn_cancel", lang), callback_data="extwallet_cancel")],
                    ])
                )
                return

            wallets, wallet_error = await _load_external_wallets(user_id, token)
            if not wallet_error:
                _wallet_state(user_id)["external_wallets"] = wallets

            return_to = state.get("return_to")
            user_state[user_id] = {}

            if return_to == "withdraw":
                await _prompt_withdraw_amount(q.message, user_id, pair, data.get("address", wallet_address))
                return

            await q.message.edit_text(
                t("ext_wallet_saved_success", lang).format(
                    currency=data.get("currency", pair["currency"]),
                    network=data.get("network", pair["network"]),
                    address=data.get("address", wallet_address),
                ),
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton(t("btn_edit_again", lang), callback_data="extwallet_set")],
                    [InlineKeyboardButton(t("btn_back", lang), callback_data=f"extwallet_network_{pair['currency']}_{pair['network_id']}")],
                ])
            )
        except Exception as e:
            await q.message.edit_text(
                t("wallet_generic_error", lang).format(error=str(e)),
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton(t("btn_re_enter", lang), callback_data="extwallet_reenter")],
                    [InlineKeyboardButton(t("btn_cancel", lang), callback_data="extwallet_cancel")],
                ])
            )
        return

    if q.data == "wallet_back":
        await q.message.delete()
        await q.message.reply_text(
            wrap(t("wallet_dashboard_title", lang), t("wallet_choose_option", lang), lang=lang),
            reply_markup=wallet_inline(lang)
        )
        return

    if q.data == "wallet_withdraw":
        try:
            user_state[user_id] = {}
            data, error = await _load_wallet_pairs(user_id, token)
            if error:
                await q.message.edit_text(
                    f"❌ {error}",
                    reply_markup=safe_inline(balance_inline(lang), lang)
                )
                return

            currencies = data.get("currencies", [])
            if not currencies:
                await q.message.edit_text(
                    t("wallet_err_no_withdraw_currencies", lang),
                    reply_markup=safe_inline(balance_inline(lang), lang)
                )
                return

            await _show_wallet_currency_menu(
                q.message,
                currencies,
                "withdraw_currency_",
                t("wallet_select_withdraw_currency_title", lang),
                t("wallet_select_withdraw_currency_subtitle", lang),
                "wallet_balance",
                lang=lang,
            )
        except Exception as e:
            logger.error(f"Error loading withdraw currencies: {e}")
            await q.message.edit_text(
                t("wallet_generic_error", lang).format(error=str(e)),
                reply_markup=safe_inline(balance_inline(lang), lang)
            )
        return

    if q.data.startswith("withdraw_currency_"):
        currency = q.data.replace("withdraw_currency_", "")
        user_state[user_id] = {}

        if not exchange_state.get(user_id, {}).get("pairs"):
            data, error = await _load_wallet_pairs(user_id, token)
            if error:
                await q.message.edit_text(
                    f"❌ {error}",
                    reply_markup=safe_inline(balance_inline(lang), lang)
                )
                return
            _wallet_state(user_id)["currencies"] = data.get("currencies", [])

        await _show_wallet_network_menu(
            q.message,
            user_id,
            currency,
            "withdraw_network_",
            t("wallet_select_network_title", lang).format(currency=currency).replace("\n\n", ""),
            t("wallet_select_withdraw_network_subtitle", lang),
            "wallet_withdraw"
        )
        return

    if q.data.startswith("withdraw_network_"):
        parts = q.data.replace("withdraw_network_", "").split("_")
        currency = parts[0]
        network_id = int(parts[1])
        pair = _find_wallet_pair(user_id, currency, network_id)

        if not pair:
            await q.message.edit_text(
                t("wallet_err_invalid_withdraw_selection", lang),
                reply_markup=safe_inline(balance_inline(lang), lang)
            )
            return

        wallets, wallet_error = await _load_external_wallets(user_id, token)
        if wallet_error:
            await q.message.edit_text(
                f"❌ {wallet_error}",
                reply_markup=safe_inline(balance_inline(lang), lang)
            )
            return
        _wallet_state(user_id)["external_wallets"] = wallets

        wallet = _find_external_wallet(user_id, pair["currency_id"], pair["network_id"]) or {}
        wallet_address = g(wallet, "address")

        if not wallet_address:
            await q.message.edit_text(
                t("wallet_no_external_wallet_saved", lang).format(
                    currency=pair["currency"], network=pair["network"], warning=t(EXTERNAL_WALLET_WARNING_KEY, lang)
                ),
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton(t("btn_set_external_wallet", lang), callback_data="withdraw_change_wallet")],
                    [InlineKeyboardButton(t("btn_back", lang), callback_data=f"withdraw_currency_{currency}")],
                ])
            )
            user_state[user_id] = {
                "step": "withdraw_needs_wallet",
                "pair": pair,
                "currency": pair["currency"],
                "currency_id": pair["currency_id"],
                "network": pair["network"],
                "network_id": pair["network_id"],
                "chain": g(pair, "chain", g(pair, "network", "N/A")),
            }
            return

        await _prompt_withdraw_amount(q.message, user_id, pair, wallet_address)
        return

    if q.data == "withdraw_change_wallet":
        state = user_state.get(user_id, {})
        pair = state.get("pair") or exchange_state.get(user_id, {}).get("selected_external_pair")
        if not pair:
            await q.message.edit_text(
                t("wallet_err_session_expired_reselect", lang),
                reply_markup=safe_inline(balance_inline(lang), lang)
            )
            return

        await _prompt_external_wallet_input(q.message, user_id, pair, return_to="withdraw")
        return

    if q.data == "withdraw_cancel":
        user_state[user_id] = {}
        await q.message.edit_text(t("wallet_withdrawal_cancelled", lang))
        return

    if q.data == "withdraw_confirm":
        state = user_state.get(user_id, {})
        amount = state.get("amount")
        wallet = state.get("wallet_address")
        currency = state.get("currency")
        network = state.get("network")
        chain = state.get("chain") or network

        if not amount or not wallet or not currency or not network:
            user_state[user_id] = {}
            await q.message.edit_text(t("wallet_err_session_expired_try_again", lang))
            return

        user_state[user_id] = {}
        await q.message.edit_text(t("wallet_processing_withdrawal", lang))

        try:
            res = await api_post(
                f"{API_URL}/wallet/withdraw",
                token=token,
                json={
                    "amount": amount,
                    "wallet_address": wallet,
                    "currency": currency,
                    "network": chain,
                },
            )
            try:
                data = res.json()
            except Exception:
                data = {}

            if res.status_code == 200:
                await q.message.edit_text(
                    t("wallet_withdraw_success", lang).format(amount=amount, currency=currency, network=network, chain=chain, wallet=wallet),
                )
            else:
                detail = data.get("detail", res.text)
                await q.message.edit_text(t("wallet_withdraw_failed", lang).format(detail=detail))
        except Exception as e:
            await q.message.edit_text(t("wallet_generic_error", lang).format(error=str(e)))
        return

    if q.data == "wallet_transactions":
        res  = await api_get(f"{API_URL}/wallet/transactions", token)
        data = res.json()
        text = t("wallet_transactions_title", lang)
        for tx in data:
            text += t("wallet_transactions_row", lang).format(type=g(tx, "type"), amount=g(tx, "amount"), currency=g(tx, "currency", ""))
        if not data:
            text += t("wallet_transactions_none", lang)
        await q.message.edit_text(text, parse_mode="Markdown")
        return

    if q.data == "myorders_root":
        await _show_orders(q.message, token, user_id)
        return

    if q.data == "myorders_products":
        await _show_product_orders(q.message, token, user_id)
        return

    if q.data == "myorders_wire":
        await _show_wire_orders(q.message, token, user_id)
        return

    if q.data.startswith("myorder_product_"):
        order_id = int(q.data.replace("myorder_product_", ""))
        await _show_product_order_detail(q.message, token, order_id, user_id)
        return

    if q.data.startswith("myorder_wire_"):
        order_id = int(q.data.replace("myorder_wire_", ""))
        await _show_wire_order_detail(q.message, token, order_id, user_id)
        return

    # ── PRODUCTS / CATEGORIES ─────────────────────────────────────
    if q.data.startswith("cat_"):
        cid      = q.data.replace("cat_", "")
        products = await _get_products_by_category(cid, token)
        grouped  = group_products(products)
        keyboard = []
        product_map = []

        for key, pdata in grouped.items():
            keyboard.append([
                InlineKeyboardButton(pdata["display_name"], callback_data=f"service_{cid}_{len(product_map)}")
            ])
            product_map.append(key)

        exchange_state[user_id] = {"cid": cid, "product_map": product_map}
        await q.message.edit_text(t("products_select_service", lang), reply_markup=InlineKeyboardMarkup(keyboard))
        return

    if q.data.startswith("service_"):
        parts         = q.data.split("_")
        cid           = parts[1]
        service_index = int(parts[2])
        state         = exchange_state.get(user_id, {})
        product_map   = state.get("product_map", [])

        if service_index >= len(product_map):
            await q.message.edit_text(t("products_invalid_selection", lang))
            return

        service_key = product_map[service_index]
        products = await _get_products_by_category(cid, token)   # ← keep only this
        matched = [p for p in products if normalize_name(g(p, "name")) == service_key]

        if not matched:
            await q.message.edit_text(t("products_none_found", lang))
            return

        display_name = matched[0]["name"]
        keyboard     = []

        for p in matched:
            pid      = g(p, "id")
            plan     = g(p, "plan",     "")
            price    = g(p, "price",    "")
            currency = g(p, "currency", "USDT")
            extra    = g(p, "extra_data", {})
            region   = g(extra, "region", "")
            btn_text = f"{plan}"
            if region:
                btn_text += f" | {region}"
            btn_text += f" | {price} {currency}"
            if IS_GLOBAL_BOT:
                admin_id = g(p, "admin_id")
                admin_label = g(p, "admin_username") or (f"Admin #{admin_id}" if admin_id else "")
                if admin_label:
                    btn_text += f" | {admin_label}"
            keyboard.append([InlineKeyboardButton(btn_text, callback_data=f"product_{cid}_{service_index}_{pid}")])

        keyboard.append([InlineKeyboardButton(t("btn_back_arrow", lang), callback_data=f"cat_{cid}")])
        await q.message.edit_text(t("products_select_plan", lang).format(name=display_name), reply_markup=InlineKeyboardMarkup(keyboard))
        return


#------------CLICKING on Each Product Button-----------------

    if q.data.startswith("product_"):
        _, cid, service_index, pid = q.data.split("_")
        res     = await api_get(f"{API_URL}/products/{pid}", token)
        product = res.json()
        extra   = g(product, "extra_data", {})
        required_user_data = g(product, "required_user_data", {})

        # ----------------------------
        # BUILD REQUIRED INPUT INFO
        # ----------------------------
        before_order_fields = []
        after_login_fields = []

        for key, field in required_user_data.items():
            step = field.get("step", "before_order")
            label = field.get("label", key)

            if step == "before_order":
                before_order_fields.append(f"• {label}")
            else:
                after_login_fields.append(f"• {label}")

        # ----------------------------
        # PRODUCT TEXT
        # ----------------------------

        text = t("product_detail_header", lang).format(
            name=g(product, "name"), price=g(product, "price"), currency=g(product, "currency"),
            plan=g(product, "plan", "N/A"), product_type=g(product, "product_type", "N/A"),
        )

        for label_key, key in [
            ("product_attr_region", "region"),
            ("product_attr_provider", "provider"),
            ("product_attr_delivery", "delivery"),
            ("product_attr_warranty", "warranty"),
            ]:

            val = g(extra, key)
            if val:
                text += f"{t(label_key, lang)}: {val}\n"

        # ----------------------------
        # REQUIRED INPUT SECTION ⭐
        # ----------------------------
        if before_order_fields:
            text += t("product_required_before_order", lang)
            text += "\n".join(before_order_fields) + "\n"

        if after_login_fields:
            text += t("product_required_after_login", lang)
            text += "\n".join(after_login_fields) + "\n"
            text += t("product_after_login_note", lang)

        # ----------------------------
        # FEATURES
        # ----------------------------
        features = g(extra, "features", [])
        if features:
            text += t("product_features_title", lang) + "".join(f"• {f}\n" for f in features)

        keyboard = [
            [InlineKeyboardButton(t("btn_buy_now", lang),   callback_data=f"buy_{pid}")],
            [InlineKeyboardButton(t("btn_back_arrow", lang),      callback_data=f"service_{cid}_{service_index}")],
        ]
        await q.message.edit_text(text, reply_markup=InlineKeyboardMarkup(keyboard))
        return

#----------------CONFIRM Product Required inputs ---------------------------

    if q.data == "confirm_input":
        state = user_state.get(user_id, {})
        token = user_tokens.get(user_id)

        product_id = state.get("product_id")

        # values entered by the user
        entered_values = state.get("input_data", {})

        # full product schema
        fields = state.get("fields", {})

        # build payload expected by backend
        input_data = {}

        for key, field in fields.items():
            input_data[key] = {
                "label": field.get("label", key),
                "type": field.get("type", "text"),
                "required": field.get("required", False),
                "step": field.get("step", "before_order"),
                "value": entered_values.get(key, "")
            }

        # -------------------------
        # ALL INPUT COLLECTED → CREATE ORDER
        # -------------------------
        try:
            res = await api_post(
                f"{API_URL}/orders/",
                token=token,
                params={"product_id": product_id},
                json=input_data
            )

            data = res.json()

            # -------------------------
            # FETCH PRODUCT AGAIN FOR AFTER_LOGIN INFO
            # -------------------------
            product_res = await api_get(f"{API_URL}/products/{product_id}", token)
            product = product_res.json()

            required = g(product, "required_user_data", {})

            after_login_fields = [
                v for v in required.values()
                if v.get("step") == "after_login"
            ]

        except Exception as e:
            await update.message.reply_text(t("order_failed", lang).format(error=str(e)))
            user_state[user_id] = {}
            return

        user_state[user_id] = {}

        # -------------------------
        # RESPONSE HANDLING
        # -------------------------
        if not data.get("success"):
            await q.message.edit_text(t("order_generic_error_data", lang).format(data=data))
            return

        msg = t("order_created_title", lang) + t("order_created_body", lang).format(
            order_id=data.get("order_id"), product_name=data.get("product_name"),
            product_plan=data.get("product_plan"), price=data.get("price"), currency=data.get("currency"),
        )
        # -------------------------
        # AFTER LOGIN STEPS DISPLAY
        # -------------------------
        if after_login_fields:
            msg += t("order_after_login_title", lang)

            for field in after_login_fields:
                label = field.get("label")
                ftype = field.get("type")

                msg += t("order_after_login_line", lang).format(label=label, type=ftype)

            msg += t("order_after_login_note", lang)

        await q.message.edit_text(msg)
        return


#----------------REJECT Product Required inputs ---------------------------

    if q.data == "reenter_input":
        state = user_state.get(user_id, {})
        fields = state.get("fields", {})

        # Only before_order fields
        field_queue = [
            key
            for key, field in fields.items()
            if field.get("step", "before_order") == "before_order"
        ]

        if not field_queue:
            await q.message.edit_text(t("product_no_required_fields", lang))
            return

        first_key = field_queue[0]

        state["step"] = "collect_product_inputs"
        state["field_queue"] = field_queue
        state["input_data"] = {}

        user_state[user_id] = state

        first_field = fields[first_key]

        await q.message.edit_text(
            t("product_reenter_title", lang).format(field=first_field.get("label", first_key))
        )
        return

#---------------------- Product Buy Button -------------------------

    if q.data.startswith("buy_"):
        pid = q.data.replace("buy_", "")

        # fetch product
        res = await api_get(f"{API_URL}/products/{pid}", token)
        if res.status_code != 200:
            await q.message.edit_text(t("product_err_load_failed", lang))
            return

        product = res.json()

        required = g(product, "required_user_data", {})

        # -------------------------
        # BUILD BEFORE-ORDER QUEUE
        # -------------------------
        field_queue = [
            k for k, v in required.items()
            if v.get("step", "before_order") == "before_order"
        ]

        # if no input needed → go directly to order
        if not field_queue:
            res = await api_post(
                f"{API_URL}/orders/",
                token=token,
                params={"product_id": pid},
                json={}
            )

            data = res.json()
            order_id    = data.get("order_id", "N/A")
            await q.message.edit_text(
                t("order_receipt_title", lang) + t("order_receipt_body", lang).format(
                    order_id=order_id, name=product.get("name"), plan=product.get("plan"),
                    price=product.get("price"), currency=product.get("currency"),
                    product_type=product.get("product_type"),
                )
            )
            return

        # -------------------------
        # INIT STATE MACHINE
        # -------------------------
        user_state[user_id] = {
            "step": "collect_product_inputs",
            "product_id": pid,
            "fields": required,
            "field_queue": field_queue,
            "input_data": {}
        }

        # ask first field
        first_key = field_queue[0]
        first_field = required[first_key]

        await q.message.edit_text(
            t("product_enter_field", lang).format(product=product.get("name"), field=first_field.get("label", first_key))
        )
        return

  # ── SHOW ORDERS ──────────────────────────────────────────────────

    if q.data == "show_orders":
        res    = await api_get(f"{API_URL}/orders/my", token)
        orders = res.json()
        text   = t("orders_list_title", lang)
        for o in orders:
            text += t("orders_list_row", lang).format(order_id=g(o, "order_id"), product_name=g(o, "product_name"), status=g(o, "status"))
        if not orders:
            text += t("orders_list_none", lang)
        await q.message.reply_text(text, parse_mode="Markdown")
        return

    # ── EXCHANGE ──────────────────────────────────────────────────
    if q.data.startswith("ex_pair_"):
        parts = q.data.split("_")
        if len(parts) < 4:
            await q.message.edit_text(t("exchange_invalid_pair", lang))
            return
        from_currency = parts[2]
        to_currency   = parts[3]
        user_state[user_id] = {
            "step":          "exchange_amount",
            "from_currency": from_currency,
            "to_currency":   to_currency,
        }
        await q.message.edit_text(t("exchange_pair_amount_prompt", lang).format(from_currency=from_currency, to_currency=to_currency))
        return

    if q.data == "exchange_confirm":
        state = user_state.get(user_id)
        if not state:
            await q.message.edit_text(t("exchange_session_expired", lang))
            return

        res = await api_post(
            f"{API_URL}/exchange/execute",
            token=token,
            json={
                "from_currency": state.get("from_currency"),
                "to_currency":   state.get("to_currency"),
                "amount":        state.get("amount"),
            },
        )
        if res.status_code != 200:
            try:
                err = res.json().get("detail", "Exchange failed")
            except Exception:
                err = "Exchange failed"
            await q.message.edit_text(t("exchange_failed", lang).format(error=err))
            return

        data = res.json()

        if data.get("success") is False and data.get("error") == "INSUFFICIENT_BALANCE":
            currency        = data.get("currency")
            missing_amount  = data.get("missing_amount")
            await q.message.edit_text(
                t("exchange_insufficient_balance_title", lang) + t("exchange_insufficient_balance_body", lang).format(
                    currency=currency, current_balance=data.get("current_balance"),
                    required_amount=data.get("required_amount"), missing_amount=missing_amount,
                ),
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton(t("btn_deposit_amount_currency", lang).format(amount=missing_amount, currency=currency), callback_data="wallet_deposit")],
                ]),
            )
            return

        user_state[user_id] = {}
        await q.message.edit_text(
            t("exchange_completed_title", lang) + t("exchange_completed_body", lang).format(
                from_currency=data["from_currency"], to_currency=data["to_currency"],
                from_amount=data["from_amount"], rate=data["rate"],
                fee_amount=data["fee_amount"], received_amount=data["received_amount"],
            ),
            parse_mode="Markdown",
        )
        return

    if q.data == "exchange_cancel":
        user_state[user_id] = {}
        await q.message.edit_text(t("exchange_cancelled", lang))
        return

    # ── MY ACCOUNT EDIT FLOW ─────────────────────────────────────
    if state.get("step") == "account_edit_field":
        field = state.get("account_edit_field")
        if not field:
            user_state[user_id] = {}
            await update.message.reply_text(t("wallet_err_session_expired_try_again", lang))
            return
        payload = {field: text.strip()}
        res = await api_put(f"{API_URL}/account/me", token=token, json=payload)
        if res.status_code != 200:
            await update.message.reply_text(t("account_profile_update_failed", lang))
            user_state[user_id] = {}
            return
        user_state[user_id] = {}
        await update.message.reply_text(t("account_profile_updated", lang))
        return

    if state.get("step") == "account_edit_bank_info":
        field = state.get("account_edit_bank_field")
        if not field:
            user_state[user_id] = {}
            await update.message.reply_text(t("wallet_err_session_expired_try_again", lang))
            return
        payload = {field: text.strip()}
        res = await api_put(f"{API_URL}/account/bank-info", token=token, json=payload)
        if res.status_code != 200:
            await update.message.reply_text(t("account_bank_update_failed", lang))
            user_state[user_id] = {}
            return
        user_state[user_id] = {}
        await update.message.reply_text(t("account_bank_updated", lang))
        return

    # ── WIRE TRANSFER ─────────────────────────────────────────────
    # Branch determination happens ONCE here, from from_currency.symbol only,
    # and is carried in wire_is_irt_source for the rest of the flow:
    #  • Case A (from == IRT): user sends IRT, receives foreign currency.
    #    Show receiver_methods immediately; on pick, collect the METHOD's own
    #    sender_fields (destination account, e.g. Wise email/IBAN).
    #  • Case B (from != IRT): user sends foreign currency, receives IRT.
    #    Collect pair-level sender_fields first (always the IRT receiving
    #    account), THEN show receiver_methods for how to pay in.
    if q.data.startswith("wire_pair_"):
        pair_id = int(q.data.split("_")[2])
        state   = exchange_state.get(user_id, {})
        pairs   = state.get("wire_pairs", [])
        pair    = next((p for p in pairs if p["id"] == pair_id), None)
        if not pair:
            await q.message.edit_text(t("wire_pair_not_found", lang))
            return

        from_symbol   = str(g(g(pair, "from_currency", {}), "symbol", "")).upper()
        is_irt_source = from_symbol == "IRT"
        methods       = pair.get("receiver_methods") or []

        base_state = {
            "wire_pair": pair,
            "wire_is_irt_source": is_irt_source,
            "wire_receiver_methods": methods,
            "wire_pair_collected": {},
            "wire_method_collected": {},
            "wire_selected_method": None,
        }

        if is_irt_source:
            # Case A: hard-block if no methods configured — no silent fallback
            # to pair-level sender_fields for IRT-source pairs.
            if not methods:
                user_state[user_id] = {}
                await q.message.edit_text(
                    t("wire_no_payment_method", lang),
                    reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")]])
                )
                return
            base_state["step"] = "wire_select_method"
            user_state[user_id] = base_state
            await _send_wire_method_selection(q.message.edit_text, pair, methods, lang)
            return

        # Case B: collect the pair-level sender_fields first (IRT receiving account).
        required    = pair.get("sender_fields") or pair.get("required_fields", {})
        field_queue = list(required.keys())

        if field_queue:
            base_state.update({
                "step": "wire_collect_fields",
                "wire_fields": required,
                "wire_field_queue": field_queue,
                "wire_collected": {},
                "wire_collect_purpose": "pair_fields",
            })
            user_state[user_id] = base_state
            first_field = required[field_queue[0]]
            req_label = "" if first_field.get("required") else t("wire_field_optional_suffix", lang)
            await q.message.edit_text(t("wire_field_prompt", lang).format(label=first_field.get("label", field_queue[0]), required=req_label))
            return

        # No pair-level fields configured → go straight to method selection
        # (soft fallback for backward compatibility) or amount if no methods.
        if methods:
            base_state["step"] = "wire_select_method"
            user_state[user_id] = base_state
            await _send_wire_method_selection(q.message.edit_text, pair, methods, lang)
        else:
            base_state["step"] = "wire_amount"
            user_state[user_id] = base_state
            await _prompt_wire_amount(q.message.edit_text, pair, lang=lang)
        return

    if q.data.startswith("wire_method_"):
        state         = user_state.get(user_id, {})
        methods       = state.get("wire_receiver_methods", [])
        pair          = state.get("wire_pair")
        is_irt_source = state.get("wire_is_irt_source", False)
        if not pair or not methods:
            await q.message.edit_text(t("wire_session_expired_reselect", lang))
            return

        try:
            idx = int(q.data.split("_")[2])
        except (TypeError, ValueError, IndexError):
            await q.message.edit_text(t("wire_invalid_method", lang))
            return
        if idx < 0 or idx >= len(methods):
            await q.message.edit_text(t("wire_invalid_method", lang))
            return

        selected_method = methods[idx]
        state["wire_selected_method"] = selected_method

        # Admin-configured info describing where to send the from_currency
        # funds — the platform's IRT account (Case A) or its foreign
        # Wise/SWIFT account for this method (Case B).
        receiver_lines = _wire_receiver_field_lines(selected_method)
        receiver_block = "\n".join(receiver_lines) if receiver_lines else t("wire_no_receiver_info", lang)
        note = (selected_method.get("note") or "").strip()
        instruction_text = t("wire_method_instructions", lang).format(
            method=selected_method.get("label", selected_method.get("key", "Method")),
            rate=g(pair, "rate", 0),
            fee=safe_float(selected_method.get("fee_percent", 0)),
            note=(t("wire_note_label", lang).format(note=note) if note else ""),
        )

        if is_irt_source:
            # Case A: collect the METHOD's own sender_fields — the user's
            # destination account (e.g. Wise email/IBAN/name) since we don't
            # know the receiver's account in advance.
            sender_fields = selected_method.get("sender_fields") or {}
            field_queue = list(sender_fields.keys())
            if field_queue:
                state.update({
                    "step": "wire_collect_fields",
                    "wire_fields": sender_fields,
                    "wire_field_queue": field_queue,
                    "wire_collected": {},
                    "wire_collect_purpose": "method_fields",
                })
                user_state[user_id] = state
                first_field = sender_fields[field_queue[0]]
                req_label = "" if first_field.get("required") else t("wire_field_optional_suffix", lang)
                await q.message.edit_text(
                    f"{instruction_text}\n" + t("wire_field_prompt", lang).format(label=first_field.get("label", field_queue[0]), required=req_label),
                    reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_cancel", lang), callback_data="wire_cancel")]])
                )
                return

            # no method-level sender fields configured → straight to amount
            state["step"] = "wire_amount"
            user_state[user_id] = state
            await q.message.edit_text(
                f"{instruction_text}\n{_wire_amount_prompt_text(pair, selected_method=selected_method, lang=lang)}",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_cancel", lang), callback_data="wire_cancel")]])
            )
            return

        # Case B: the destination (IRT account) was already captured in step 1
        # — no separate per-method sender_fields collection needed here.
        state["step"] = "wire_amount"
        user_state[user_id] = state
        await q.message.edit_text(
            f"{instruction_text}\n{_wire_amount_prompt_text(pair, selected_method=selected_method, lang=lang)}",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_cancel", lang), callback_data="wire_cancel")]])
        )
        return

    if q.data == "wire_confirm":
        state = user_state.get(user_id, {})
        if not state or state.get("step") != "wire_confirm":
            await q.message.edit_text(t("wire_session_expired_restart", lang))
            return

        pair             = state["wire_pair"]
        amount           = state.get("wire_amount", 0)
        selected_method  = state.get("wire_selected_method") or {}
        pair_collected   = state.get("wire_pair_collected") or {}
        method_collected = state.get("wire_method_collected") or {}

        # Backend still stores one flat input_data dict — merge both buckets.
        payload_input = {}
        payload_input.update(pair_collected)
        payload_input.update(method_collected)
        if selected_method:
            payload_input["__payment_method"] = selected_method.get("key")
            payload_input["__payment_method_label"] = selected_method.get("label")

        res = await api_post(
            f"{API_URL}/wire-transfer/orders",
            token=token,
            json={"pair_id": pair["id"], "from_amount": amount, "input_data": payload_input},
        )

        if res.status_code != 200:
            try:
                err = res.json().get("detail", "Order placement failed")
            except Exception:
                err = "Order placement failed"
            await q.message.edit_text(t("wire_order_placement_failed", lang).format(error=err))
            return

        user_state[user_id] = {}
        data     = res.json()
        from_sym = g(g(pair, "from_currency", {}), "symbol", "?")
        to_sym   = g(g(pair, "to_currency", {}), "symbol", "?")
        support_url = "https://t.me/projectexTestkarman_bot"
        buttons = [
            [InlineKeyboardButton(t("btn_open_support", lang), url=support_url)],
            [InlineKeyboardButton(t("btn_cancel", lang) + " Order", callback_data=f"wire_order_cancel_{data['id']}")],
            [InlineKeyboardButton(t("btn_main_menu", lang), callback_data="back_main")],
        ]

        message_text = t("wire_submitted_title", lang) + t("wire_submitted_body", lang).format(
            order_id=data["id"], amount=amount, from_symbol=from_sym, to_amount=data["to_amount"],
            to_symbol=to_sym, rate=data["locked_rate"], expires_at=data["expires_at"][:16].replace("T", " "),
        )
        if data.get("balance_status") == "insufficient":
            shortfall = safe_float(data.get("shortfall", 0))
            current_balance = safe_float(data.get("current_balance", 0))
            message_text += t("wire_insufficient_balance_note", lang).format(shortfall=shortfall, current_balance=current_balance)
            await _show_irt_deposit_instructions(
                q.message,
                token,
                note=t("wire_topup_note", lang).format(shortfall=shortfall),
                user_id=user_id,
            )
            await q.message.edit_reply_markup(reply_markup=InlineKeyboardMarkup(buttons))
        else:
            message_text += t("wire_placed_footer", lang)
            await q.message.edit_text(
                message_text,
                reply_markup=InlineKeyboardMarkup(buttons),
            )
        return

    if q.data == "wire_cancel":
        user_state[user_id] = {}
        await q.message.edit_text(t("wire_cancelled", lang), reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")]]))
        return

    if q.data.startswith("wire_order_cancel_"):
        order_id = int(q.data.replace("wire_order_cancel_", ""))
        res = await api_post(
            f"{API_URL}/wire-transfer/orders/{order_id}/cancel",
            token=token,
            json={"reason": "cancelled by user"},
        )
        if res.status_code != 200:
            try:
                err = res.json().get("detail", "Cancel failed")
            except Exception:
                err = "Cancel failed"
            await q.message.edit_text(t("wire_cancel_failed", lang).format(error=err))
            return
        await q.message.edit_text(
            t("wire_order_cancelled", lang).format(order_id=order_id),
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="myorders_wire")]])
        )
        return


# =====================================================
# WIRE TRANSFER HELPERS (branch-aware: IRT-source vs foreign-source)
# =====================================================
def _wire_amount_prompt_text(pair, selected_method=None, lang=DEFAULT_LANGUAGE):
    min_a = g(pair, "min_amount", 0)
    max_a = g(pair, "max_amount", None)
    hints = []
    if safe_float(min_a) > 0:
        hints.append(t("wire_amount_limit_min", lang).format(amount=min_a).rstrip("\n"))
    if max_a and safe_float(max_a) > 0:
        hints.append(t("wire_amount_limit_max", lang).format(amount=max_a).rstrip("\n"))
    info = (t("wire_amount_limits_header", lang) + "\n".join(hints) + "\n\n") if hints else ""

    from_sym = g(g(pair, "from_currency", {}), "symbol", "?")
    to_sym = g(g(pair, "to_currency", {}), "symbol", "?")
    fee_pct = safe_float(selected_method.get("fee_percent", 0)) if selected_method else safe_float(g(pair, "fee_percent", 0))
    method_label = selected_method.get("label", selected_method.get("key", "")) if selected_method else None
    method_line = t("wire_amount_method_line", lang).format(method=method_label) if method_label else ""

    return t("wire_amount_prompt", lang).format(
        from_symbol=from_sym, to_symbol=to_sym, rate=g(pair, "rate", 0),
        method_line=method_line, fee_pct=fee_pct, info=info,
    )


# =====================================================
# SHARED HELPERS (called from both command and message handler)
# =====================================================
async def _show_my_account_menu(message, token, user_id=None):
    await account_show_my_account_menu(message, token, user_id=user_id)


async def _show_irt_deposit_instructions(message, token, note=None, user_id=None):
    await account_show_irt_deposit_instructions(message, token, note=note, user_id=user_id)


async def _start_account_edit_flow(message, token, mode, user_id):
    await account_start_account_edit_flow(message, token, mode, user_id)


async def _prompt_account_edit_field(message, state, user_id):
    await account_prompt_account_edit_field(message, state, user_id)


async def _show_account_edit_preview(message, state, user_id):
    await account_show_account_edit_preview(message, state, user_id)


async def _save_account_edit(token, mode, values):
    return await account_save_account_edit(token, mode, values)


async def watch_deposit(user_id, token):
    await wallet_watch_deposit(user_id, token)


def _wallet_state(user_id):
    return exchange_state.setdefault(user_id, {})


async def _load_wallet_pairs(user_id, token):
    return await wallet_load_wallet_pairs(user_id, token)


async def _load_external_wallets(user_id, token):
    return await wallet_load_external_wallets(user_id, token)


def _find_wallet_pair(user_id, currency, network_id):
    return wallet_find_wallet_pair(user_id, currency, network_id)


def _find_external_wallet(user_id, currency_id, network_id):
    return wallet_find_external_wallet(user_id, currency_id, network_id)


async def _show_wallet_currency_menu(message, currencies, prefix, title, subtitle, back_callback, lang=DEFAULT_LANGUAGE):
    await wallet_show_wallet_currency_menu(message, currencies, prefix, title, subtitle, back_callback, lang=lang)


async def _show_wallet_network_menu(message, user_id, currency, prefix, title, subtitle, back_callback):
    await wallet_show_wallet_network_menu(message, user_id, currency, prefix, title, subtitle, back_callback)


async def _show_external_wallet_details(message, user_id, pair):
    await wallet_show_external_wallet_details(message, user_id, pair)


async def _prompt_external_wallet_input(message, user_id, pair, return_to="external"):
    await wallet_prompt_external_wallet_input(message, user_id, pair, return_to=return_to)


async def _prompt_withdraw_amount(message, user_id, pair, wallet_address):
    await wallet_prompt_withdraw_amount(message, user_id, pair, wallet_address)


async def _send_wire_method_selection(send_fn, pair, methods, lang=DEFAULT_LANGUAGE):
    await wire_send_method_selection(send_fn, pair, methods, lang=lang)


async def _prompt_wire_amount(send_fn, pair, selected_method=None, lang=DEFAULT_LANGUAGE):
    await wire_prompt_amount(send_fn, pair, selected_method=selected_method, lang=lang)


async def _show_wire_pairs(message, token):
    await wire_show_pairs(message, token)


async def _show_exchange_pairs(message, token, user_id=None):
    await exchange_show_pairs(message, token, user_id=user_id)


async def _show_categories(message, token, user_id=None):
    await products_show_categories(message, token, user_id=user_id)


async def _show_orders(message, token, user_id=None):
    await orders_show_orders(message, token, user_id=user_id)


async def _show_product_orders(message, token, user_id=None):
    await orders_show_product_orders(message, token, user_id=user_id)


async def _show_wire_orders(message, token, user_id=None):
    await orders_show_wire_orders(message, token, user_id=user_id)


async def _show_product_order_detail(message, token, order_id, user_id=None):
    await orders_show_product_order_detail(message, token, order_id, user_id=user_id)


async def _show_wire_order_detail(message, token, order_id, user_id=None):
    await orders_show_wire_order_detail(message, token, order_id, user_id=user_id)

async def error_handler(update, context):
    logger.error("Unhandled exception while processing update", exc_info=context.error)

# =====================================================
# MAIN
# =====================================================
def main():
    request = HTTPXRequest(
        connect_timeout=20.0,
        read_timeout=30.0,
        write_timeout=20.0,
        pool_timeout=20.0,
    )
    app = Application.builder().token(TOKEN).request(request).build()
    app.add_error_handler(error_handler)
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(button))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, message_handler))

    print("Bot running...")
    app.run_polling()


if __name__ == "__main__":
    main()
