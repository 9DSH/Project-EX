from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from app.bot.bot_content import t 
from app.bot.features.common import (
    API_URL, g, wrap, api_get, get_lang,
    IS_GLOBAL_BOT, api_bot_context_get,
)


async def _show_exchange_pairs(message, token, user_id=None):
    lang = get_lang(user_id or message.chat.id)

    if IS_GLOBAL_BOT:
        res = await api_bot_context_get("/bot-context/exchange-pairs")
        pairs = res.json() if res.status_code == 200 else []
    else:
        res = await api_get(f"{API_URL}/exchange/pairs", token)
        if res.status_code != 200:
            await message.reply_text(t("exchange_err_load_pairs", lang))
            return
        pairs = res.json()

    keyboard = []
    for p in pairs:
        from_symbol = g(g(p, "from_currency", {}), "symbol", "?")
        to_symbol = g(g(p, "to_currency", {}), "symbol", "?")
        rate = g(p, "rate", 0)
        label = t("exchange_pair_button", lang).format(from_symbol=from_symbol, to_symbol=to_symbol, rate=rate)
        admin_id = g(p, "admin_id")
        if IS_GLOBAL_BOT:
            admin_label = g(p, "admin_username") or (f"Exchange #{admin_id}" if admin_id else "")
            if admin_label:
                label += f" · {admin_label}"
        callback_data = f"ex_pair_{from_symbol}_{to_symbol}" + (f"_{admin_id}" if IS_GLOBAL_BOT else "")
        keyboard.append([InlineKeyboardButton(label, callback_data=callback_data)])

    keyboard.append([InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")])
    await message.reply_text(
        wrap(t("exchange_center_title", lang), t("exchange_center_body", lang), lang=lang),
        reply_markup=InlineKeyboardMarkup(keyboard),
    )