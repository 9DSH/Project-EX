from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from app.bot.bot_content import t
from app.bot.features.common import (
    API_URL, g, wrap, api_get, get_lang,
    IS_GLOBAL_BOT, api_bot_context_get,
)


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


async def _get_products_by_category(cid, token):
    """
    Single fetch point for category product listings, used both when first
    entering a category and when re-fetching to build the per-plan keyboard
    in bot.py's cat_ / service_ handlers. Global bot pulls cross-admin
    products (attributed) via /bot-context/products; per-admin bots keep
    using the public /products/by-category endpoint (already admin-scoped
    for logged-in users via RLS on Product... note Product has no RLS
    currently — see caveat below).
    """
    if IS_GLOBAL_BOT:
        res = await api_bot_context_get("/bot-context/products", params={"category_id": cid})
        return res.json() if res.status_code == 200 else []
    res = await api_get(f"{API_URL}/products/by-category/{cid}", token)
    return res.json() if res.status_code == 200 else []