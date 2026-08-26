from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from app.bot.bot_content import t
from app.bot.features.common import (
    API_URL, _back_cancel_kb, exchange_state, g, safe_float, wrap, api_get, get_lang,
    IS_GLOBAL_BOT, api_bot_context_get,
)


async def _show_wire_pairs(message, token):
    user_id = message.chat.id
    lang = get_lang(user_id)

    if IS_GLOBAL_BOT:
        res = await api_bot_context_get("/bot-context/wire-pairs")
        pairs = res.json() if res.status_code == 200 else []
    else:
        res = await api_get(f"{API_URL}/wire-transfer/pairs", token)
        if res.status_code != 200:
            await message.reply_text(t("wire_err_load_pairs", lang))
            return
        pairs = res.json()

    exchange_state.setdefault(user_id, {})["wire_pairs"] = pairs

    if not pairs:
        await message.reply_text(
            wrap(t("wire_transfer_title", lang), t("wire_no_options", lang), lang=lang),
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")]]),
        )
        return

    keyboard = []
    for pair in pairs:
        from_symbol = g(g(pair, "from_currency", {}), "symbol", "?")
        to_symbol = g(g(pair, "to_currency", {}), "symbol", "?")
        rate = g(pair, "rate", 0)
        methods = pair.get("receiver_methods") or []
        method_fees = [safe_float(m.get("fee_percent", 0)) for m in methods if isinstance(m, dict)]
        fallback_fee = safe_float(g(pair, "fee_percent", 0))
        fee_text = (
            f"{min(method_fees)}%-{max(method_fees)}%" if method_fees and min(method_fees) != max(method_fees)
            else f"{(method_fees[0] if method_fees else fallback_fee)}%"
        )
        label = t("wire_pair_button", lang).format(from_symbol=from_symbol, to_symbol=to_symbol, rate=rate, fee=fee_text)

        if IS_GLOBAL_BOT:
            admin_id = g(pair, "admin_id")
            admin_label = g(pair, "admin_username") or (f"Admin #{admin_id}" if admin_id else "")
            if admin_label:
                label += f" · {admin_label}"

        keyboard.append([
            InlineKeyboardButton(label, callback_data=f"wire_pair_{pair['id']}")
        ])
    keyboard.append([InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")])
    await message.reply_text(
        wrap(t("wire_transfer_title", lang), t("wire_transfer_body", lang), lang=lang),
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def _send_wire_method_selection(send_fn, pair, methods, lang="en"):
    keyboard = [
        [InlineKeyboardButton(
            f"{m.get('label', m.get('key', 'Method'))} | Fee: {safe_float(m.get('fee_percent', 0))}%",
            callback_data=f"wire_method_{i}"
        )]
        for i, m in enumerate(methods)
    ]
    keyboard.append([InlineKeyboardButton(t("btn_cancel", lang), callback_data="wire_cancel")])
    fee_summary = "\n".join([
        t("wire_method_fee_line", lang).format(label=m.get("label", m.get("key", "Method")), fee=safe_float(m.get("fee_percent", 0))).rstrip("\n")
        for m in methods
    ])
    from_sym = g(g(pair, "from_currency", {}), "symbol", "?")
    to_sym = g(g(pair, "to_currency", {}), "symbol", "?")
    await send_fn(
        t("wire_method_selection_header", lang).format(
            from_symbol=from_sym, to_symbol=to_sym, rate=g(pair, "rate", 0), fee_summary=fee_summary
        ),
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def _prompt_wire_amount(send_fn, pair, selected_method=None, lang="en", user_id=None):
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

    kb_rows = []
    markup = _back_cancel_kb(lang, kb_rows) if user_id else InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_cancel", lang), callback_data="wire_cancel")]])
   
    await send_fn(
        t("wire_amount_prompt", lang).format(
            from_symbol=from_sym, to_symbol=to_sym, rate=g(pair, "rate", 0),
            method_line=method_line, fee_pct=fee_pct, info=info,
        ),
        reply_markup=markup,
    )


def _wire_effective_rate(pair):
    base_rate = safe_float(g(pair, "rate", 0))
    from_symbol = str(g(g(pair, "from_currency", {}), "symbol", "")).upper()
    to_symbol = str(g(g(pair, "to_currency", {}), "symbol", "")).upper()
    if base_rate <= 0:
        return 0.0
    if from_symbol == "IRT" and to_symbol != "IRT":
        return 1.0 / base_rate
    return base_rate


def _wire_receiver_field_lines(selected_method):
    receiver_fields = g(selected_method, "receiver_fields", {})
    if not receiver_fields:
        return []
    lines = []
    for key, field in receiver_fields.items():
        label = g(field, "label", key.replace("_", " ").title())
        value = g(field, "value", "")
        lines.append(f"• {label}: {value}")
    return lines