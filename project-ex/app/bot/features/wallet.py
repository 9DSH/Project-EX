import asyncio

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from app.bot.bot_content import t
from app.bot.features.common import (
    API_URL,
    balance_inline,
    fmt_num,
    g,
    safe_inline,
    safe_float,
    wrap,
    api_get,
    exchange_state,
    user_state,
    user_last_balance,
    user_tokens,
    get_lang,
    _back_cancel_kb
)


async def watch_deposit(user_id, token):
    await asyncio.sleep(3)
    res = await api_get(f"{API_URL}/wallet/balance", token)
    if res.status_code == 200:
        data = res.json()
        balances = data.get("balances", [])
        if balances:
            for b in balances:
                if b.get("currency") == "IRT":
                    user_last_balance[user_id] = float(b.get("available", 0) or 0)
                    break


def _wallet_state(user_id):
    exchange_state.setdefault(user_id, {})
    return exchange_state[user_id]


async def _load_wallet_pairs(user_id, token):
    res = await api_get(f"{API_URL}/wallet/currency-networks", token)
    if res.status_code != 200:
        return None, t("wallet_err_load_pairs", get_lang(user_id))
    data = res.json()
    _wallet_state(user_id)["pairs"] = data.get("pairs", [])
    _wallet_state(user_id)["currencies"] = data.get("currencies", [])
    return data, None


async def _load_external_wallets(user_id, token):
    res = await api_get(f"{API_URL}/wallet/external-wallets", token)
    if res.status_code != 200:
        return None, t("wallet_err_load_external_wallets", get_lang(user_id))
    data = res.json()
    wallets = data.get("wallets", [])
    _wallet_state(user_id)["external_wallets"] = wallets
    return wallets, None


def _find_wallet_pair(user_id, currency, network_id):
    pairs = _wallet_state(user_id).get("pairs", [])
    for p in pairs:
        if p.get("currency") == currency and p.get("network_id") == network_id:
            return p
    return None


def _find_external_wallet(user_id, currency_id, network_id):
    wallets = _wallet_state(user_id).get("external_wallets", [])
    for wallet in wallets:
        if wallet.get("currency_id") == currency_id and wallet.get("network_id") == network_id:
            return wallet
    return None


async def _show_wallet_currency_menu(message, currencies, prefix, title, subtitle, back_callback, lang=None, user_id=None):
    lang = lang or get_lang(user_id or message.chat.id)
    keyboard = []
    for currency in currencies:
        keyboard.append([InlineKeyboardButton(currency, callback_data=f"{prefix}{currency}")])
    keyboard.append([InlineKeyboardButton(t("btn_back", lang), callback_data=back_callback)])
    await message.edit_text(
        wrap(title, subtitle, lang=lang),
        reply_markup=InlineKeyboardMarkup(keyboard)
    )


async def _show_wallet_network_menu(message, user_id, currency, prefix, title, subtitle, back_callback):
    lang = get_lang(user_id)
    pairs = _wallet_state(user_id).get("pairs", [])
    if not pairs:
        await message.edit_text(t("wallet_err_no_pairs", lang), reply_markup=safe_inline(balance_inline(lang), lang))
        return
    filtered = [p for p in pairs if p.get("currency") == currency]
    if not filtered:
        await message.edit_text(t("wallet_err_no_networks_for_currency", lang).format(currency=currency), reply_markup=safe_inline(balance_inline(lang), lang))
        return
    keyboard = []
    for pair in sorted(filtered, key=lambda item: item.get("network", "")):
        keyboard.append([InlineKeyboardButton(pair.get("network", "N/A"), callback_data=f"{prefix}{currency}_{pair.get('network_id')}")])
    keyboard.append([InlineKeyboardButton(t("btn_back", lang), callback_data=back_callback)])
    await message.edit_text(wrap(title, subtitle, lang=lang), reply_markup=InlineKeyboardMarkup(keyboard))


async def _show_external_wallet_details(message, user_id, pair):
    lang = get_lang(user_id)
    wifi = _find_external_wallet(user_id, pair.get("currency_id"), pair.get("network_id")) or {}
    existing = g(wifi, "address")
    text = t("ext_wallet_details_body", lang).format(
        currency=pair.get("currency"), network=pair.get("network"), warning=t("ext_wallet_warning", lang)
    )
    if existing:
        text += t("ext_wallet_current_address", lang).format(address=existing)
    else:
        text += t("ext_wallet_no_address", lang)
    await message.edit_text(
        wrap(t("ext_wallet_details_title", lang), text, lang=lang),
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn_set_update", lang), callback_data="extwallet_set")],
            [InlineKeyboardButton(t("btn_back", lang), callback_data="wallet_external")],
        ])
    )


async def _prompt_external_wallet_input(message, user_id, pair, return_to="external"):
    lang = get_lang(user_id)
    state = user_state.setdefault(user_id, {})
    state.update({
        "step": "external_wallet_input",
        "pair": pair,
        "currency": pair.get("currency"),
        "currency_id": pair.get("currency_id"),
        "network": pair.get("network"),
        "network_id": pair.get("network_id"),
        "chain": g(pair, "chain", g(pair, "network", "N/A")),
        "return_to": return_to,
        "back_to": "withdraw_network" if return_to == "withdraw" else "external_wallet_network",
    })
    user_state[user_id] = state
    await message.edit_text(
        wrap(
            t("ext_wallet_set_title", lang),
            t("ext_wallet_set_body", lang).format(currency=pair.get("currency"), network=pair.get("network")),
            lang=lang,
        ),
        reply_markup=_back_cancel_kb(lang)
    )


async def _prompt_withdraw_amount(message, user_id, pair, wallet_address):
    lang = get_lang(user_id)
    state = user_state.setdefault(user_id, {})
    state.update({
        "step": "withdraw_amount",
        "pair": pair,
        "wallet_address": wallet_address,
        "currency": pair.get("currency"),
        "currency_id": pair.get("currency_id"),
        "network": pair.get("network"),
        "network_id": pair.get("network_id"),
        "chain": g(pair, "chain", g(pair, "network", "N/A")),
        "back_to": "withdraw_network",
    })
    user_state[user_id] = state
    min_withdraw = safe_float(g(pair, "min_withdraw", 0))
    max_withdraw = safe_float(g(pair, "max_withdraw", 0))
    withdraw_fee = safe_float(g(pair, "withdraw_fee", 0))
    info_lines = []
    if min_withdraw > 0:
        info_lines.append(t("withdraw_info_min", lang).format(amount=fmt_num(min_withdraw)).rstrip("\n"))
    if max_withdraw > 0:
        info_lines.append(t("withdraw_info_max", lang).format(amount=fmt_num(max_withdraw)).rstrip("\n"))
    if withdraw_fee > 0:
        info_lines.append(t("withdraw_info_fee", lang).format(fee=fmt_num(withdraw_fee), currency=pair["currency"]).rstrip("\n"))
    info_text = ""
    if info_lines:
        info_text = t("withdraw_info_header", lang) + "\n".join(info_lines) + "\n\n"
    await message.edit_text(
        t("withdraw_amount_prompt", lang).format(
            currency=pair["currency"], network=pair["network"], wallet=wallet_address, info=info_text
        ),
        reply_markup=_back_cancel_kb(lang, [
            [InlineKeyboardButton(t("btn_change_external_wallet", lang), callback_data="withdraw_change_wallet")],
        ])
    )