from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from app.bot.bot_content import t
from app.bot.features.common import API_URL, balance_inline, safe_inline, wrap, api_get, api_put, get_lang


async def _show_my_account_menu(message, token, user_id=None):
    lang = get_lang(user_id or message.chat.id)
    res = await api_get(f"{API_URL}/account/me", token)
    if res.status_code != 200:
        await message.reply_text(t("account_load_failed", lang), reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")]]))
        return

    data = res.json()
    bank = data.get("bank_info") or {}
    bank_text = t("account_no_bank_info", lang)
    if bank:
        bank_text = t("account_bank_info_lines", lang).format(
            bank_name=bank.get("bank_name") or "—",
            bank_holder_name=bank.get("bank_holder_name") or "—",
            bank_card_number=bank.get("bank_card_number") or "—",
            bank_sheba=bank.get("bank_sheba") or "—",
        )

    await message.reply_text(
        wrap(
            t("account_menu_title", lang),
            t("account_menu_body", lang).format(
                first_name=data.get("first_name") or "—",
                last_name=data.get("last_name") or "—",
                email=data.get("email") or "—",
                phone_number=data.get("phone_number") or "—",
                bank_text=bank_text,
            ),
            lang=lang,
        ),
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn_edit_profile", lang), callback_data="myaccount_edit_profile")],
            [InlineKeyboardButton(t("btn_edit_bank_info", lang), callback_data="myaccount_edit_bank")],
            [InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")],
        ])
    )


async def _show_irt_deposit_instructions(message, token, note=None, user_id=None):
    lang = get_lang(user_id or message.chat.id)
    profile_res = await api_get(f"{API_URL}/account/me", token)
    if profile_res.status_code != 200:
        await message.edit_text(t("account_load_failed", lang), reply_markup=safe_inline(balance_inline(lang), lang))
        return

    profile_data = profile_res.json()
    if not profile_data.get("personal_info_complete"):
        await message.edit_text(
            wrap(t("account_complete_profile_title", lang), t("account_complete_profile_body", lang), lang=lang),
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn_open_my_account", lang), callback_data="myaccount_edit_profile")],
                [InlineKeyboardButton(t("btn_back", lang), callback_data="wallet_deposit")],
            ])
        )
        return

    if not profile_data.get("bank_info_complete"):
        await message.edit_text(
            wrap(t("account_complete_bank_title", lang), t("account_complete_bank_body", lang), lang=lang),
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(t("btn_open_my_account_bank", lang), callback_data="myaccount_edit_bank")],
                [InlineKeyboardButton(t("btn_back", lang), callback_data="wallet_deposit")],
            ])
        )
        return

    bank_res = await api_get(f"{API_URL}/account/active-bank-account", token)
    if bank_res.status_code != 200:
        await message.edit_text(t("account_load_active_bank_failed", lang), reply_markup=safe_inline(balance_inline(lang), lang))
        return

    bank_data = bank_res.json().get("account") or {}
    if not bank_data:
        await message.edit_text(t("account_no_active_bank", lang), reply_markup=safe_inline(balance_inline(lang), lang))
        return

    text = t("irt_deposit_body", lang).format(
        bank_name=bank_data.get("bank_name") or "—",
        bank_holder_name=bank_data.get("bank_holder_name") or "—",
        bank_card_number=bank_data.get("bank_card_number") or "—",
        bank_sheba=bank_data.get("bank_sheba") or "—",
    )
    if note:
        text = f"{note}\n\n{text}"

    buttons = [
        [InlineKeyboardButton(t("btn_open_support", lang), url="https://t.me/projectexTestkarman_bot")],
    ]
    buttons.append([InlineKeyboardButton(t("btn_back", lang), callback_data="wallet_deposit")])

    await message.edit_text(
        wrap(t("irt_deposit_title", lang), text, lang=lang),
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(buttons)
    )


ACCOUNT_FIELD_LABEL_KEYS = {
    "profile": {
        "first_name": "account_edit_field_first_name",
        "last_name": "account_edit_field_last_name",
        "email": "account_edit_field_email",
        "phone_number": "account_edit_field_phone_number",
    },
    "bank": {
        "bank_holder_name": "account_edit_field_bank_holder_name",
        "bank_card_number": "account_edit_field_bank_card_number",
        "bank_name": "account_edit_field_bank_name",
        "bank_sheba": "account_edit_field_bank_sheba",
    },
}


async def _start_account_edit_flow(message, token, mode, user_id):
    lang = get_lang(user_id)
    if mode == "profile":
        fields = ["first_name", "last_name", "email", "phone_number"]
        res = await api_get(f"{API_URL}/account/me", token)
        if res.status_code != 200:
            await message.edit_text(t("account_load_failed", lang), reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")]]))
            return
        data = res.json()
        initial_values = {field: data.get(field) or "" for field in fields}
        section = t("account_profile_section", lang)
    else:
        fields = ["bank_holder_name", "bank_card_number", "bank_name", "bank_sheba"]
        res = await api_get(f"{API_URL}/account/bank-info", token)
        if res.status_code != 200:
            await message.edit_text(t("account_load_failed", lang), reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(t("btn_back", lang), callback_data="back_main")]]))
            return
        payload = res.json()
        bank_info = payload.get("bank_info") or {}
        initial_values = {field: bank_info.get(field) or "" for field in fields}
        section = t("account_bank_section", lang)

    from app.bot.features.common import user_state
    user_state[user_id] = {
        "step": "account_edit_collect",
        "account_edit_mode": mode,
        "account_edit_fields": fields,
        "account_edit_index": 0,
        "account_edit_values": {},
        "account_edit_current_values": initial_values,
    }

    first_key = fields[0]
    current_value = initial_values.get(first_key, "")
    current_text = t("account_edit_current_suffix", lang).format(value=current_value) if current_value else ""
    label = t(ACCOUNT_FIELD_LABEL_KEYS[mode][first_key], lang)
    key = "account_edit_step_title" if mode == "profile" else "account_edit_bank_step_title"
    await message.edit_text(t(key, lang).format(section=section, label=label, current=current_text))


async def _prompt_account_edit_field(message, state, user_id):
    lang = get_lang(user_id)
    mode = state.get("account_edit_mode")
    fields = state.get("account_edit_fields", [])
    index = state.get("account_edit_index", 0)
    field = fields[index]
    current_value = state.get("account_edit_current_values", {}).get(field, "")
    current_text = t("account_edit_current_suffix", lang).format(value=current_value) if current_value else ""
    label = t(ACCOUNT_FIELD_LABEL_KEYS[mode][field], lang)
    await message.reply_text(t("account_edit_field_prompt", lang).format(label=label, current=current_text))


async def _show_account_edit_preview(message, state, user_id):
    lang = get_lang(user_id)
    mode = state.get("account_edit_mode")
    values = state.get("account_edit_values", {})
    current_values = state.get("account_edit_current_values", {})
    preview_lines = []
    for field in state.get("account_edit_fields", []):
        label = t(ACCOUNT_FIELD_LABEL_KEYS[mode][field], lang)
        value = values.get(field) or current_values.get(field) or "—"
        preview_lines.append(t("account_edit_preview_line", lang).format(label=label, value=value).rstrip("\n"))

    title = t("account_edit_preview_title_profile", lang) if mode == "profile" else t("account_edit_preview_title_bank", lang)
    await message.reply_text(
        wrap(
            title,
            t("account_edit_preview_header", lang) + "\n".join(preview_lines),
            lang=lang,
        ),
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(t("btn_confirm", lang), callback_data=f"myaccount_confirm_{mode}")],
            [InlineKeyboardButton(t("btn_edit_again", lang), callback_data=f"myaccount_edit_again_{mode}")],
            [InlineKeyboardButton(t("btn_cancel", lang), callback_data="myaccount_cancel")],
        ])
    )


async def _save_account_edit(token, mode, values):
    if mode == "profile":
        payload = {key: values.get(key) for key in ["first_name", "last_name", "email", "phone_number"]}
        res = await api_put(f"{API_URL}/account/me", token=token, json=payload)
    else:
        payload = {key: values.get(key) for key in ["bank_holder_name", "bank_card_number", "bank_name", "bank_sheba"]}
        res = await api_put(f"{API_URL}/account/bank-info", token=token, json=payload)
    return res
