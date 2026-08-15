from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from app.bot.bot_content import t
from app.bot.features.common import API_URL, g, wrap, api_get, get_lang


async def _show_categories(message, token, user_id=None):
    lang = get_lang(user_id or message.chat.id)
    res = await api_get(f"{API_URL}/categories/", token)
    cats = res.json()
    keyboard = [
        [InlineKeyboardButton(g(c, "name"), callback_data=f"cat_{g(c,'id')}")]
        for c in cats
    ]
    keyboard.append([InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")])
    await message.reply_text(
        wrap(t("products_marketplace_title", lang), t("products_marketplace_body", lang), lang=lang),
        reply_markup=InlineKeyboardMarkup(keyboard),
    )
