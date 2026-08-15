from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from app.bot.bot_content import t
from app.bot.features.common import API_URL, currency_symbol, g, quote_plus, wrap, api_get, get_lang


async def _show_orders(message, token, user_id=None):
    lang = get_lang(user_id or message.chat.id)
    await message.reply_text(
        wrap(t("orders_title", lang), t("orders_choose_history", lang), lang=lang),
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn_product_orders", lang), callback_data="myorders_products")],
            [InlineKeyboardButton(t("btn_wire_orders", lang), callback_data="myorders_wire")],
            [InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")],
        ]),
    )


async def _show_product_orders(message, token, user_id=None):
    lang = get_lang(user_id or message.chat.id)
    res = await api_get(f"{API_URL}/orders/my", token)
    orders = res.json() if res.status_code == 200 else []
    keyboard = []
    for o in orders:
        label = f"#{g(o, 'order_id', g(o, 'id'))} · {g(o, 'product_name', 'Product')} · {g(o, 'status', '—')}"
        keyboard.append([InlineKeyboardButton(label[:60], callback_data=f"myorder_product_{g(o, 'order_id', g(o, 'id'))}")])
    keyboard.append([InlineKeyboardButton(t("btn_back", lang), callback_data="myorders_root")])
    body = t("orders_tap_to_view", lang) if orders else t("product_orders_none", lang)
    await message.edit_text(
        wrap(t("product_orders_title", lang), body, lang=lang),
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def _show_wire_orders(message, token, user_id=None):
    lang = get_lang(user_id or message.chat.id)
    res = await api_get(f"{API_URL}/wire-transfer/orders/my", token)
    orders = res.json() if res.status_code == 200 else []
    keyboard = []
    for o in orders:
        oid = g(o, "id")
        label = f"#{oid} · {currency_symbol(o.get('from_currency') or o.get('from_currency_symbol'))}→{currency_symbol(o.get('to_currency') or o.get('to_currency_symbol'))} · {g(o, 'status', '—')}"
        keyboard.append([InlineKeyboardButton(label[:60], callback_data=f"myorder_wire_{oid}")])
    keyboard.append([InlineKeyboardButton(t("btn_back", lang), callback_data="myorders_root")])
    body = t("orders_tap_to_view", lang) if orders else t("wire_orders_none", lang)
    await message.edit_text(
        wrap(t("wire_orders_title", lang), body, lang=lang),
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def _show_product_order_detail(message, token, order_id, user_id=None):
    lang = get_lang(user_id or message.chat.id)
    res = await api_get(f"{API_URL}/orders/{order_id}", token)
    if res.status_code != 200:
        await message.edit_text(
            t("product_order_not_found", lang),
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="myorders_products")]]),
        )
        return

    order = res.json()
    text = t("product_order_detail_body", lang).format(
        id=g(order, "id", order_id),
        product_name=g(g(order, "product", {}), "name", "Product"),
        status=g(order, "status", "—"),
        price=g(order, "price", "—"),
        currency=g(order, "currency", ""),
    )
    if g(order, "delivery_info"):
        text += t("product_order_delivery_info", lang).format(delivery_info=g(order, "delivery_info"))
    track_text = quote_plus(f"I want to track this order status: {g(order, 'id', order_id)} (product)")
    await message.edit_text(
        wrap(t("product_order_detail_title", lang), text, lang=lang),
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn_track", lang), url=f"https://t.me/share/url?url=https://t.me/projectexTestkarman_bot&text={track_text}")],
            [InlineKeyboardButton(t("btn_back", lang), callback_data="myorders_products")],
            [InlineKeyboardButton(t("btn_main_menu", lang), callback_data="back_main")],
        ]),
    )


async def _show_wire_order_detail(message, token, order_id, user_id=None):
    lang = get_lang(user_id or message.chat.id)
    res = await api_get(f"{API_URL}/wire-transfer/orders/{order_id}", token)
    if res.status_code != 200:
        await message.edit_text(
            t("wire_order_not_found", lang),
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="myorders_wire")]]),
        )
        return

    order = res.json()
    text = t("wire_order_detail_body", lang).format(
        id=g(order, "id", order_id),
        from_currency=currency_symbol(order.get("from_currency") or order.get("from_currency_symbol")),
        to_currency=currency_symbol(order.get("to_currency") or order.get("to_currency_symbol")),
        status=g(order, "status", "—"),
        from_amount=g(order, "from_amount", "—"),
        to_amount=g(order, "to_amount", "—"),
    )
    if g(order, "payment_method_label"):
        text += t("wire_order_method_line", lang).format(method=g(order, "payment_method_label"))
    if g(order, "delivery_message"):
        text += t("wire_order_delivered_message", lang).format(message=g(order, "delivery_message"))
    track_text = quote_plus(f"I want to track this order status: {g(order, 'id', order_id)} (wire)")
    await message.edit_text(
        wrap(t("wire_order_detail_title", lang), text, lang=lang),
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn_track", lang), url=f"https://t.me/share/url?url=https://t.me/projectexTestkarman_bot&text={track_text}")],
            [InlineKeyboardButton(t("btn_back", lang), callback_data="myorders_wire")],
            [InlineKeyboardButton(t("btn_main_menu", lang), callback_data="back_main")],
        ]),
    )
