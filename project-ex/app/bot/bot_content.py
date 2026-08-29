
"""
Centralized, bilingual (English / Persian) text content for the Telegram bot.

Every button label, message, warning, instruction, confirmation, and error
string that used to be hardcoded across bot.py and the feature modules lives
here as CONTENT[key][lang]. Use t(key, lang) to look a string up; dynamic
values are filled in with str.format(...) by the caller, e.g.:

    t("wallet_deposit_amount_sent", lang).format(amount=amount, currency=cur)

Missing keys never crash the bot: t() falls back to English, then to the
raw key itself.
"""

SUPPORTED_LANGUAGES = ("en", "fa")
DEFAULT_LANGUAGE = "en"

CONTENT = {
    # =====================================================
    # MAIN MENU / REPLY KEYBOARD
    # =====================================================
    "btn_wallet": {"en": "💰 Wallet", "fa": "💰 کیف پول"},
    "btn_exchange": {"en": "🔄 Exchange", "fa": "🔄 تبدیل ارز"},
    "btn_products": {"en": "📦 Products", "fa": "📦 محصولات"},
    "btn_orders": {"en": "📋 My Orders", "fa": "📋 سفارش‌های من"},
    "btn_wire": {"en": "🏦 Wire Transfer", "fa": "🏦 حواله بانکی"},
    "btn_my_account": {"en": "👤 My Account", "fa": "👤 حساب من"},
    "btn_support": {"en": "🧠 Support", "fa": "🧠 پشتیبانی"},
    "btn_logout": {"en": "🚪 Logout", "fa": "🚪 خروج"},
    "btn_language": {"en": "🌐 Language", "fa": "🌐 زبان"},

    "btn_back": {"en": "🔙 Back", "fa": "🔙 بازگشت"},
    "btn_back_arrow": {"en": "⬅️ Back", "fa": "⬅️ بازگشت"},
    "btn_main_menu": {"en": "🏠 Main Menu", "fa": "🏠 منوی اصلی"},
    "btn_cancel": {"en": "❌ Cancel", "fa": "❌ لغو"},
    "btn_confirm": {"en": "✅ Confirm", "fa": "✅ تأیید"},
    "btn_edit": {"en": "✏️ Edit", "fa": "✏️ ویرایش"},
    "btn_edit_again": {"en": "✏️ Edit Again", "fa": "✏️ ویرایش مجدد"},
    "btn_re_enter": {"en": "✏️ Re-enter", "fa": "✏️ ورود مجدد"},
    "btn_open_support": {"en": "🧠 Open Support", "fa": "🧠 باز کردن پشتیبانی"},

    "wrap_footer_tip": {"en": "💡 Tip: Use the menu below to continue.", "fa": "💡 راهنمایی: برای ادامه از منوی پایین استفاده کنید."},
    "main_menu_title": {"en": "🏠 Main Menu", "fa": "🏠 منوی اصلی"},
    "main_menu_choose": {"en": "🏠 Main Menu\n", "fa": "🏠 منوی اصلی\n"},
    "welcome_back_choose": {"en": "👋 Welcome back! Choose an option:", "fa": "👋 خوش برگشتید! یک گزینه را انتخاب کنید:"},
    "welcome_login_prompt": {"en": "👋 Welcome!\n\nPlease log in or sign up to continue.", "fa": "👋 خوش آمدید!\n\nبرای ادامه وارد شوید یا ثبت‌نام کنید."},
    "please_login_first": {"en": "❌ Please log in first.", "fa": "❌ لطفاً ابتدا وارد شوید."},
    "incomplete_profile_notice": {"en": "\n\n⚠️ Please complete your personal information for a better experience.", "fa": "\n\n⚠️ لطفاً برای تجربه بهتر، اطلاعات شخصی خود را تکمیل کنید."},
    "main_menu_use_buttons": {"en": "Use the buttons below to continue.", "fa": "برای ادامه از دکمه‌های پایین استفاده کنید."},
    # =====================================================
    # AUTH
    # =====================================================
    "btn_login": {"en": "🔑 Login", "fa": "🔑 ورود"},
    "btn_signup": {"en": "📝 Sign Up", "fa": "📝 ثبت‌نام"},
    "auth_enter_username": {"en": "👤 Enter your username:", "fa": "👤 نام کاربری خود را وارد کنید:"},
    "auth_enter_password": {"en": "🔑 Enter your password:", "fa": "🔑 رمز عبور خود را وارد کنید:"},
    "auth_choose_password": {"en": "🔑 Choose a password:", "fa": "🔑 یک رمز عبور انتخاب کنید:"},
    "auth_enter_invite_code": {"en": "🎟 Enter your invitation code:", "fa": "🎟 کد دعوت خود را وارد کنید:"},
    "auth_signup_intro": {
        "en": "📝 *Sign Up*\n\nYou'll need:\n• A username\n• A password\n• An invitation code (from admin)\n\n👤 Enter your desired username:",
        "fa": "📝 *ثبت‌نام*\n\nشما به این موارد نیاز دارید:\n• یک نام کاربری\n• یک رمز عبور\n• یک کد دعوت (از طرف مدیر)\n\n👤 نام کاربری مورد نظر خود را وارد کنید:",
    },
    "auth_invalid_server_response": {
        "en": "❌ Invalid server response\nStatus: {status}\nRaw: {raw}",
        "fa": "❌ پاسخ نامعتبر از سرور\nوضعیت: {status}\nخام: {raw}",
    },
    "auth_connection_error": {"en": "❌ Connection error:\n{error}", "fa": "❌ خطای اتصال:\n{error}"},
    "auth_login_failed": {"en": "❌ Login failed: {error}\n\nPlease try again.", "fa": "❌ ورود ناموفق بود: {error}\n\nلطفاً دوباره تلاش کنید."},
    "auth_login_no_token": {"en": "❌ Login failed — no token received.\n\nUse /start to try again.", "fa": "❌ ورود ناموفق بود — توکنی دریافت نشد.\n\nبرای تلاش دوباره از /start استفاده کنید."},
    "auth_welcome_back_title": {"en": "Welcome Back", "fa": "خوش برگشتید"},
    "auth_welcome_back_body": {
        "en": "👋 Hello {username}\n\nYou now have full access to your premium dashboard.\n\n⚡ Real-time system active",
        "fa": "👋 سلام {username}\n\nاکنون به داشبورد ویژه خود دسترسی کامل دارید.\n\n⚡ سیستم برای شما فعال است",
    },
    "auth_signup_server_error": {"en": "❌ Server error\nStatus: {status}\nRaw: {raw}", "fa": "❌ خطای سرور\nوضعیت: {status}\nخام: {raw}"},
    "auth_signup_failed": {"en": "❌ Sign up failed: {error}", "fa": "❌ ثبت‌نام ناموفق بود: {error}"},
    "auth_account_created": {
        "en": "✅ Account created!\n\n👤 Username: {username}\n🔑 Password: {password}\n🏦 Wallet: {wallet}\n\nLogging you in...",
        "fa": "✅ حساب کاربری ایجاد شد!\n\n👤 نام کاربری: {username}\n🔑 رمز عبور: {password}\n🏦 کیف پول: {wallet}\n\nدر حال ورود...",
    },
    "auth_logged_in": {"en": "✅ Logged in!", "fa": "✅ وارد شدید!"},
    "auth_signup_ok_login_failed": {
        "en": "⚠️ Account created but auto-login failed.\nUse /start to log in manually.",
        "fa": "⚠️ حساب ایجاد شد اما ورود خودکار ناموفق بود.\nبرای ورود دستی از /start استفاده کنید.",
    },
    "auth_logged_out": {"en": "🚪 Logged out successfully.\n\nUse /start to log in again.", "fa": "🚪 با موفقیت خارج شدید.\n\nبرای ورود مجدد از /start استفاده کنید."},
    "account_inactive": {"en": "❌ Your account is not active. Please contact support.", "fa": "❌ حساب شما فعال نیست. لطفاً با پشتیبانی تماس بگیرید."},
    "btn_account_logout": {"en": "🚪 Logout", "fa": "🚪 خروج"},
    # =====================================================
    # LANGUAGE
    # =====================================================
    "language_title": {"en": "Language", "fa": "زبان"},
    "language_prompt": {"en": "🌐 Choose your language:", "fa": "🌐 زبان خود را انتخاب کنید:"},
    "language_btn_en": {"en": "🇬🇧 English", "fa": "🇬🇧 انگلیسی"},
    "language_btn_fa": {"en": "🇮🇷 Persian (فارسی)", "fa": "🇮🇷 فارسی"},
    "language_updated": {"en": "✅ Language updated to English.", "fa": "✅ زبان به فارسی تغییر کرد."},

    # =====================================================
    # WALLET
    # =====================================================
    "wallet_dashboard_title": {"en": "Wallet Dashboard", "fa": "داشبورد کیف پول"},
    "wallet_dashboard_body": {
        "en": "Manage your funds securely in real-time\n\n💰 Check balance\n📜 View transactions\n➕ Deposit / ➖ Withdraw",
        "fa": "دارایی خود را به‌صورت امن و آنی مدیریت کنید\n\n💰 مشاهده موجودی\n📜 مشاهده تراکنش‌ها\n➕ واریز / ➖ برداشت",
    },
    "wallet_choose_option": {"en": "Choose an option below:", "fa": "یک گزینه را از پایین انتخاب کنید:"},
    "btn_balance": {"en": "💰 Balance", "fa": "💰 موجودی"},
    "btn_transactions": {"en": "📜 Transactions", "fa": "📜 تراکنش‌ها"},
    "btn_deposit": {"en": "➕ Deposit", "fa": "➕ واریز"},
    "btn_withdraw": {"en": "➖ Withdraw", "fa": "➖ برداشت"},
    "btn_external_wallet": {"en": "🏦 External Wallet", "fa": "🏦 کیف پول خارجی"},

    "wallet_balance_title": {"en": "Balance Overview", "fa": "نمای کلی موجودی"},
    "wallet_balance_header": {"en": "💰 *Wallet Balance*\n\n", "fa": "💰 *موجودی کیف پول*\n\n"},
    "wallet_balance_row": {
        "en": "🪙 {currency} ({network})\n   Available: {available}\n   Frozen:    {frozen}\n\n",
        "fa": "🪙 {currency} ({network})\n   موجود: {available}\n   مسدود:    {frozen}\n\n",
    },
    "wallet_balance_none": {"en": "⚠️ No wallet data found\n\n", "fa": "⚠️ داده‌ای برای کیف پول یافت نشد\n\n"},
    "wallet_balance_address": {"en": "🏦 Address:\n`{address}`", "fa": "🏦 آدرس:\n`{address}`"},

    "wallet_err_load_external": {"en": "❌ No wallet currencies available", "fa": "❌ ارزی برای کیف پول موجود نیست"},
    "wallet_err_load_pairs": {"en": "Failed to load wallet pairs", "fa": "بارگذاری جفت‌های کیف پول ناموفق بود"},
    "wallet_err_load_external_wallets": {"en": "Failed to load external wallets", "fa": "بارگذاری کیف پول‌های خارجی ناموفق بود"},
    "wallet_err_no_pairs": {"en": "❌ No wallet pairs available", "fa": "❌ جفت کیف پولی موجود نیست"},
    "wallet_select_currency_external_title": {"en": "🏦 Select Currency for External Wallet", "fa": "🏦 انتخاب ارز برای کیف پول خارجی"},
    "wallet_select_currency_external_subtitle": {
        "en": "Choose the currency whose private withdrawal wallet you want to view or update.",
        "fa": "ارزی را که می‌خواهید کیف پول برداشت خصوصی آن را مشاهده یا ویرایش کنید انتخاب نمایید.",
    },

    "wallet_select_deposit_currency_title": {"en": "💰 *Select Currency to Deposit*\n\n", "fa": "💰 *انتخاب ارز برای واریز*\n\n"},
    "wallet_select_deposit_currency_subtitle": {"en": "Choose which cryptocurrency you want to deposit:", "fa": "ارز دیجیتالی که می‌خواهید واریز کنید را انتخاب نمایید:"},
    "wallet_err_load_deposit_options": {"en": "❌ Failed to load deposit options. Try again later.", "fa": "❌ بارگذاری گزینه‌های واریز ناموفق بود. بعداً دوباره تلاش کنید."},
    "wallet_err_no_deposit_currencies": {"en": "❌ No deposit currencies available", "fa": "❌ ارزی برای واریز موجود نیست"},
    "wallet_err_load_currencies": {"en": "❌ Error: {error}", "fa": "❌ خطا: {error}"},
    "wallet_err_no_networks_for_currency": {"en": "❌ No networks available for {currency}", "fa": "❌ شبکه‌ای برای {currency} موجود نیست"},
    "wallet_select_network_title": {"en": "🌐 *Select Network for {currency}*\n\n", "fa": "🌐 *انتخاب شبکه برای {currency}*\n\n"},
    "wallet_select_network_subtitle": {"en": "Choose which blockchain network to deposit on:", "fa": "شبکه بلاکچینی که می‌خواهید در آن واریز کنید را انتخاب نمایید:"},
    "wallet_err_invalid_selection": {"en": "❌ Invalid selection", "fa": "❌ انتخاب نامعتبر"},
    "wallet_err_generate_wallet": {"en": "❌ {detail}", "fa": "❌ {detail}"},
    "wallet_deposit_address_body": {
        "en": "💰 *Deposit {currency} on {network}*\n\n📥 Send to this address:\n`{address}`\n\n📋 Requirements:\n{min_max_text}• Confirmations: {confirmations}\n• Network: {network}\n\n⏳ Waiting for deposit (3 min timeout)...",
        "fa": "💰 *واریز {currency} روی شبکه {network}*\n\n📥 به این آدرس ارسال کنید:\n`{address}`\n\n📋 الزامات:\n{min_max_text}• تأییدیه‌های لازم: {confirmations}\n• شبکه: {network}\n\n⏳ در انتظار واریز (مهلت ۳ دقیقه)...",
    },
    "wallet_deposit_min_line": {"en": "• Minimum: {amount}\n", "fa": "• حداقل: {amount}\n"},
    "wallet_deposit_max_line": {"en": "• Maximum: {amount}\n", "fa": "• حداکثر: {amount}\n"},

    "wallet_irt_confirmed_pending": {"en": "⏳ Deposit request sent. Waiting for blockchain confirmation...", "fa": "⏳ درخواست واریز ارسال شد. در انتظار تأیید بلاکچین..."},
    "wallet_deposit_failed": {"en": "❌ Deposit failed", "fa": "❌ واریز ناموفق بود"},

    "wallet_err_no_withdraw_currencies": {"en": "❌ No withdrawal currencies available", "fa": "❌ ارزی برای برداشت موجود نیست"},
    "wallet_select_withdraw_currency_title": {"en": "📤 Select Currency to Withdraw", "fa": "📤 انتخاب ارز برای برداشت"},
    "wallet_select_withdraw_currency_subtitle": {"en": "Choose which cryptocurrency you want to withdraw.", "fa": "ارز دیجیتالی که می‌خواهید برداشت کنید را انتخاب نمایید."},
    "wallet_select_withdraw_network_subtitle": {"en": "Choose the blockchain network for this withdrawal.", "fa": "شبکه بلاکچین این برداشت را انتخاب کنید."},
    "wallet_err_invalid_withdraw_selection": {"en": "❌ Invalid withdrawal selection", "fa": "❌ انتخاب برداشت نامعتبر"},
    "wallet_no_external_wallet_saved": {
        "en": "⚠️ No external wallet is saved for {currency} on {network}.\n\n{warning}\n\nPlease set your private withdrawal wallet first.",
        "fa": "⚠️ کیف پول خارجی برای {currency} روی شبکه {network} ذخیره نشده است.\n\n{warning}\n\nلطفاً ابتدا کیف پول برداشت خصوصی خود را تنظیم کنید.",
    },
    "btn_set_external_wallet": {"en": "🏦 Set External Wallet", "fa": "🏦 تنظیم کیف پول خارجی"},
    "wallet_err_session_expired_reselect": {"en": "❌ Session expired. Please select the currency and network again.", "fa": "❌ دسترسی منقضی شد. لطفاً ارز و شبکه را دوباره انتخاب کنید."},
    "wallet_withdrawal_cancelled": {"en": "❌ Withdrawal cancelled.", "fa": "❌ برداشت لغو شد."},
    "wallet_err_session_expired_try_again": {"en": "❌ Session expired. Please try again.", "fa": "❌ دسترسی منقضی شد. لطفاً دوباره تلاش کنید."},
    "wallet_processing_withdrawal": {"en": "⏳ Processing withdrawal...", "fa": "⏳ در حال پردازش برداشت..."},
    "wallet_withdraw_success": {
        "en": "✅ Withdrawal submitted successfully.\n\n💰 Amount: {amount} {currency}\n🌐 Network: {network}\n🔗 Chain: {chain}\n🏦 Destination:\n{wallet}\n\n⏳ Status: Pending approval",
        "fa": "✅ درخواست برداشت با موفقیت ثبت شد.\n\n💰 مبلغ: {amount} {currency}\n🌐 شبکه: {network}\n🔗 زنجیره: {chain}\n🏦 مقصد:\n{wallet}\n\n⏳ وضعیت: در انتظار تأیید",
    },
    "wallet_withdraw_failed": {"en": "❌ Withdrawal failed\n\n{detail}", "fa": "❌ برداشت ناموفق بود\n\n{detail}"},
    "wallet_generic_error": {"en": "❌ Error:\n{error}", "fa": "❌ خطا:\n{error}"},
    "wallet_invalid_amount_positive": {"en": "❌ Invalid amount. Enter a positive number:", "fa": "❌ مبلغ نامعتبر است. یک عدد مثبت وارد کنید:"},

    "wallet_transactions_title": {"en": "📜 *Transactions*\n\n", "fa": "📜 *تراکنش‌ها*\n\n"},
    "wallet_transactions_row": {"en": "{type} | {amount} {currency}\n", "fa": "{type} | {amount} {currency}\n"},
    "wallet_transactions_none": {"en": "_No transactions yet._", "fa": "_هنوز تراکنشی وجود ندارد._"},

    "wallet_confirm_withdrawal_title": {"en": "Confirm Withdrawal", "fa": "تأیید برداشت"},
    "wallet_confirm_withdrawal_body": {
        "en": "Please review your request:\n\n💰 Amount: {amount} {currency}\n🌐 Network: {network}\n🔗 Chain: {chain}\n🏦 Wallet: {wallet}\n\n⚠️ This action cannot be reversed.",
        "fa": "لطفاً درخواست خود را بررسی کنید:\n\n💰 مبلغ: {amount} {currency}\n🌐 شبکه: {network}\n🔗 زنجیره: {chain}\n🏦 کیف پول: {wallet}\n\n⚠️ این عملیات قابل بازگشت نیست.",
    },

    # External wallet
    "ext_wallet_warning": {
        "en": "⚠️ IMPORTANT: This must be a private wallet address that YOU control (e.g. Trust Wallet, MetaMask, Ledger).\nDo NOT use an address from an exchange or broker (Binance, etc.) — funds sent to the wrong type of address may be permanently lost.",
        "fa": "⚠️ مهم: این باید آدرس یک کیف پول خصوصی باشد که تحت کنترل خودتان است (مانند Trust Wallet، MetaMask، Ledger).\nاز آدرس صرافی یا کارگزار (مانند Binance) استفاده نکنید — وجوه ارسال‌شده به آدرس نادرست ممکن است برای همیشه از دست بروند.",
    },
    "ext_wallet_details_title": {"en": "External Wallet", "fa": "کیف پول خارجی"},
    "ext_wallet_details_body": {
        "en": "🏦 External Wallet for {currency} on {network}\n\n{warning}\n\n",
        "fa": "🏦 کیف پول خارجی برای {currency} روی شبکه {network}\n\n{warning}\n\n",
    },
    "ext_wallet_current_address": {"en": "📝 Current Address:\n{address}\n", "fa": "📝 آدرس فعلی:\n{address}\n"},
    "ext_wallet_no_address": {"en": "📝 No address saved yet.", "fa": "📝 هنوز آدرسی ذخیره نشده است."},
    "btn_set_update": {"en": "✏️ Set / Update", "fa": "✏️ تنظیم / ویرایش"},

    "ext_wallet_set_title": {"en": "Set External Wallet", "fa": "تنظیم کیف پول خارجی"},
    "ext_wallet_set_body": {
        "en": "Please send the wallet address you want to use for withdrawals.\n\n🪙 Currency: {currency}\n🌐 Network: {network}",
        "fa": "لطفاً آدرس کیف پولی که می‌خواهید برای برداشت استفاده کنید را ارسال نمایید.\n\n🪙 ارز: {currency}\n🌐 شبکه: {network}",
    },
    "ext_wallet_address_empty": {"en": "❌ Wallet address cannot be empty. Please enter it again:", "fa": "❌ آدرس کیف پول نمی‌تواند خالی باشد. لطفاً دوباره وارد کنید:"},
    "ext_wallet_confirm_title": {"en": "Confirm External Wallet", "fa": "تأیید کیف پول خارجی"},
    "ext_wallet_confirm_body": {
        "en": "You are saving a withdrawal address for:\n\n🪙 Currency: {currency}\n🌐 Network: {network}\n🔗 Chain: {chain}\n\n{warning}\n\n🏦 Address to Save:\n{address}",
        "fa": "شما در حال ذخیره آدرس برداشت برای موارد زیر هستید:\n\n🪙 ارز: {currency}\n🌐 شبکه: {network}\n🔗 زنجیره: {chain}\n\n{warning}\n\n🏦 آدرس برای ذخیره:\n{address}",
    },
    "ext_wallet_reenter_title": {
        "en": "🏦 Set External Wallet\n\n🪙 Currency: {currency}\n🌐 Network: {network}\n🔗 Chain: {chain}\n\n{warning}\n\n📥 Please send the wallet address again.",
        "fa": "🏦 تنظیم کیف پول خارجی\n\n🪙 ارز: {currency}\n🌐 شبکه: {network}\n🔗 زنجیره: {chain}\n\n{warning}\n\n📥 لطفاً آدرس کیف پول را دوباره ارسال کنید.",
    },
    "ext_wallet_update_cancelled": {"en": "❌ External wallet update cancelled.", "fa": "❌ ویرایش کیف پول خارجی لغو شد."},
    "ext_wallet_saving": {"en": "⏳ Saving external wallet...", "fa": "⏳ در حال ذخیره کیف پول خارجی..."},
    "ext_wallet_save_failed": {"en": "❌ Failed to save external wallet\n\n{detail}", "fa": "❌ ذخیره کیف پول خارجی ناموفق بود\n\n{detail}"},
    "ext_wallet_saved_success": {
        "en": "✅ External wallet saved successfully.\n\n🪙 Currency: {currency}\n🌐 Network: {network}\n🏦 Address:\n{address}",
        "fa": "✅ کیف پول خارجی با موفقیت ذخیره شد.\n\n🪙 ارز: {currency}\n🌐 شبکه: {network}\n🏦 آدرس:\n{address}",
    },
    "ext_wallet_session_expired_reselect": {"en": "❌ Session expired. Please select the wallet pair again.", "fa": "❌ دسترسی منقضی شد. لطفاً جفت کیف پول را دوباره انتخاب کنید."},

    "withdraw_amount_prompt": {
        "en": "📤 Withdraw {currency} on {network}\n\n🏦 Destination Wallet:\n{wallet}\n\n{info}💬 Enter the amount you want to withdraw:",
        "fa": "📤 برداشت {currency} روی شبکه {network}\n\n🏦 کیف پول مقصد:\n{wallet}\n\n{info}💬 مبلغی که می‌خواهید برداشت کنید را وارد نمایید:",
    },
    "withdraw_info_min": {"en": "• Minimum: {amount}\n", "fa": "• حداقل: {amount}\n"},
    "withdraw_info_max": {"en": "• Maximum: {amount}\n", "fa": "• حداکثر: {amount}\n"},
    "withdraw_info_fee": {"en": "• Withdrawal Fee: {fee} {currency}\n", "fa": "• کارمزد برداشت: {fee} {currency}\n"},
    "withdraw_info_header": {"en": "📋 Withdrawal Info:\n", "fa": "📋 اطلاعات برداشت:\n"},
    "btn_change_external_wallet": {"en": "✏️ Change External Wallet", "fa": "✏️ تغییر کیف پول خارجی"},

    # =====================================================
    # EXCHANGE
    # =====================================================
    "exchange_center_title": {"en": "Exchange Center", "fa": "مرکز تبدیل ارز"},
    "exchange_center_body": {
        "en": "Swap assets instantly with real-time rates\n\n⚡ Fast execution\n💱 Transparent fees\n🔒 Secure processing",
        "fa": "دارایی‌های خود را به‌صورت آنی و با نرخ لحظه‌ای تبدیل کنید\n\n⚡ اجرای سریع\n💱 کارمزد شفاف\n🔒 پردازش امن",
    },
    "exchange_pair_button": {"en": "{from_symbol} ➜ {to_symbol} | Rate: {rate}", "fa": "{from_symbol} ➜ {to_symbol} | نرخ: {rate}"},
    "exchange_err_load_pairs": {"en": "❌ Failed to load exchange pairs", "fa": "❌ بارگذاری جفت‌های تبدیل ناموفق بود"},
    "exchange_pair_amount_prompt": {"en": "💱 {from_currency} ➜ {to_currency}\n\n💰 Enter amount:", "fa": "💱 {from_currency} ➜ {to_currency}\n\n💰 مبلغ را وارد کنید:"},
    "exchange_invalid_amount": {"en": "❌ Invalid amount", "fa": "❌ مبلغ نامعتبر است"},
    "exchange_preview_failed": {"en": "❌ {error}", "fa": "❌ {error}"},
    "exchange_confirm_title": {"en": "Confirm Exchange", "fa": "تأیید تبدیل ارز"},
    "exchange_confirm_body": {
        "en": "Review your transaction:\n\n💱 {from_currency} → {to_currency}\n💸 You Send: {input_amount} {from_currency}\n📈 Rate: {rate}\n💰 Fee: {fee_amount} {from_currency}\n✅ You Receive: {received_amount} {to_currency}",
        "fa": "تراکنش خود را بررسی کنید:\n\n💱 {from_currency} → {to_currency}\n💸 ارسال شما: {input_amount} {from_currency}\n📈 نرخ: {rate}\n💰 کارمزد: {fee_amount} {from_currency}\n✅ دریافت شما: {received_amount} {to_currency}",
    },
    "exchange_session_expired": {"en": "❌ Session expired", "fa": "❌ دسترسی منقضی شد"},
    "exchange_failed": {"en": "❌ {error}", "fa": "❌ {error}"},
    "exchange_insufficient_balance_title": {"en": "❌ *Insufficient Balance*\n\n", "fa": "❌ *موجودی ناکافی*\n\n"},
    "exchange_insufficient_balance_body": {
        "en": "🪙 {currency}\n💰 Current: {current_balance}\n📤 Required: {required_amount}\n➕ Missing: {missing_amount}\n\nPlease top up your wallet.",
        "fa": "🪙 {currency}\n💰 موجودی فعلی: {current_balance}\n📤 مورد نیاز: {required_amount}\n➕ کسری: {missing_amount}\n\nلطفاً کیف پول خود را شارژ کنید.",
    },
    "btn_deposit_amount_currency": {"en": "➕ Deposit {amount} {currency}", "fa": "➕ واریز {amount} {currency}"},
    "exchange_completed_title": {"en": "✅ *Exchange Completed*\n\n", "fa": "✅ *تبدیل ارز انجام شد*\n\n"},
    "exchange_completed_body": {
        "en": "🔄 {from_currency} ➜ {to_currency}\n💸 Sent: {from_amount} {from_currency}\n📈 Rate: {rate}\n💰 Fee: {fee_amount} {from_currency}\n✅ Received: {received_amount} {to_currency}",
        "fa": "🔄 {from_currency} ➜ {to_currency}\n💸 ارسال‌شده: {from_amount} {from_currency}\n📈 نرخ: {rate}\n💰 کارمزد: {fee_amount} {from_currency}\n✅ دریافت‌شده: {received_amount} {to_currency}",
    },
    "exchange_cancelled": {"en": "❌ Exchange cancelled.", "fa": "❌ تبدیل ارز لغو شد."},
    "exchange_invalid_pair": {"en": "❌ Invalid pair", "fa": "❌ جفت ارز نامعتبر"},

    # =====================================================
    # PRODUCTS
    # =====================================================
    "products_marketplace_title": {"en": "Product Marketplace", "fa": "بازار محصولات"},
    "products_marketplace_body": {
        "en": "Browse premium digital services\n\n📦 Verified providers\n⚡ Instant delivery products\n🛡 Secure checkout system",
        "fa": "خدمات دیجیتال ویژه را مرور کنید\n\n📦 ارائه‌دهندگان تأییدشده\n⚡ محصولات با تحویل آنی\n🛡 سیستم پرداخت امن",
    },
    "products_select_service": {"en": "🛒 Select Service:", "fa": "🛒 انتخاب سرویس:"},
    "products_invalid_selection": {"en": "❌ Invalid selection", "fa": "❌ انتخاب نامعتبر"},
    "products_none_found": {"en": "❌ No products found", "fa": "❌ محصولی یافت نشد"},
    "products_select_plan": {"en": "📦 {name}\n\nSelect Plan:", "fa": "📦 {name}\n\nانتخاب پلن:"},
    "btn_buy_now": {"en": "💳 Buy Now", "fa": "💳 خرید"},

    "product_detail_header": {
        "en": "🛒 {name}\n\n💰 Price: {price} {currency}\n📋 Plan: {plan}\n🧩 Type: {product_type}\n",
        "fa": "🛒 {name}\n\n💰 قیمت: {price} {currency}\n📋 پلن: {plan}\n🧩 نوع: {product_type}\n",
    },
    "product_attr_region": {"en": "🌍 Region", "fa": "🌍 منطقه"},
    "product_attr_provider": {"en": "🏢 Provider", "fa": "🏢 ارائه‌دهنده"},
    "product_attr_delivery": {"en": "⚡ Delivery", "fa": "⚡ تحویل"},
    "product_attr_warranty": {"en": "🛡 Warranty", "fa": "🛡 گارانتی"},
    "product_required_before_order": {"en": "\n🧾 Required Before Order:\n", "fa": "\n🧾 مورد نیاز پیش از سفارش:\n"},
    "product_required_after_login": {"en": "\n⚠️ After Login Required:\n", "fa": "\n⚠️ مورد نیاز پس از ورود:\n"},
    "product_after_login_note": {"en": "\n💡 These steps will be handled by support after purchase.\n", "fa": "\n💡 این مراحل پس از خرید توسط پشتیبانی انجام خواهد شد.\n"},
    "product_features_title": {"en": "\n✨ Features:\n", "fa": "\n✨ ویژگی‌ها:\n"},

    "product_err_load_failed": {"en": "❌ Failed to load product", "fa": "❌ بارگذاری محصول ناموفق بود"},
    "product_enter_field": {"en": "🔑 Enter your {product} {field}:", "fa": "🔑 {field} مربوط به {product} خود را وارد کنید:"},
    "product_next_field": {"en": "🔑 {field}:", "fa": "🔑 {field}:"},
    "product_confirm_details_title": {"en": "Confirm Your Input", "fa": "تأیید اطلاعات وارد شده"},
    "product_confirm_details_header": {"en": "🧾 Please confirm your details:\n\n", "fa": "🧾 لطفاً اطلاعات خود را تأیید کنید:\n\n"},
    "product_confirm_details_footer": {"en": "\n\n⚠️ Please verify carefully before continuing.", "fa": "\n\n⚠️ لطفاً قبل از ادامه با دقت بررسی کنید."},
    "product_confirm_line": {"en": "• {label}: {value}\n", "fa": "• {label}: {value}\n"},
    "btn_reenter": {"en": "❌ Re-enter", "fa": "❌ ورود مجدد"},

    "order_receipt_title": {"en": "🧾 ORDER RECEIPT\n\n", "fa": "🧾 رسید سفارش\n\n"},
    "order_receipt_body": {
        "en": "🆔 Order ID: {order_id}\n📦 Product: {name}\n📋 Plan: {plan}\n💰 Price: {price} {currency}\n🧩 Type: {product_type}\n\n────────────────────\n⏳ Status: PROCESSING\n📡 Preparing your order...\n🧑‍💻 Support will deliver soon.",
        "fa": "🆔 شناسه سفارش: {order_id}\n📦 محصول: {name}\n📋 پلن: {plan}\n💰 قیمت: {price} {currency}\n🧩 نوع: {product_type}\n\n────────────────────\n⏳ وضعیت: در حال پردازش\n📡 در حال آماده‌سازی سفارش شما...\n🧑‍💻 پشتیبانی به‌زودی تحویل می‌دهد.",
    },
    "order_created_title": {"en": "✅ Order Created Successfully!\n\n", "fa": "✅ سفارش با موفقیت ایجاد شد!\n\n"},
    "order_created_body": {
        "en": "🆔 Order ID: {order_id}\n📦 Product: {product_name}\n📋 Plan: {product_plan}\n💰 Price: {price} {currency}\n\n\n────────────────────\n⏳ Status: PROCESSING\n📡 Preparing your order...\n🧑‍💻 Support will deliver soon.\n\n",
        "fa": "🆔 شناسه سفارش: {order_id}\n📦 محصول: {product_name}\n📋 پلن: {product_plan}\n💰 قیمت: {price} {currency}\n\n\n────────────────────\n⏳ وضعیت: در حال پردازش\n📡 در حال آماده‌سازی سفارش شما...\n🧑‍💻 پشتیبانی به‌زودی تحویل می‌دهد.\n\n",
    },
    "order_after_login_title": {"en": "\n⚠️ After Login Steps Required:\n\n", "fa": "\n⚠️ مراحل مورد نیاز پس از ورود:\n\n"},
    "order_after_login_line": {"en": "• {label} ({type})\n", "fa": "• {label} ({type})\n"},
    "order_after_login_note": {
        "en": "\n💡 Important:\nThese steps happen AFTER your account is created.\nOur support team will contact you to complete them.\n",
        "fa": "\n💡 مهم:\nاین مراحل پس از ایجاد حساب شما انجام می‌شود.\nتیم پشتیبانی برای تکمیل آن‌ها با شما تماس خواهد گرفت.\n",
    },
    "order_failed": {"en": "❌ Order failed:\n{error}", "fa": "❌ سفارش ناموفق بود:\n{error}"},
    "order_generic_error_data": {"en": "❌ {data}", "fa": "❌ {data}"},
    "product_no_required_fields": {"en": "❌ No required fields found.", "fa": "❌ فیلد موردنیازی یافت نشد."},
    "product_reenter_title": {"en": "🔄 Let's re-enter the required details.\n\n🔑 {field}:", "fa": "🔄 بیایید جزئیات مورد نیاز را دوباره وارد کنیم.\n\n🔑 {field}:"},

    # =====================================================
    # ORDERS
    # =====================================================
    "orders_title": {"en": "My Orders", "fa": "سفارش‌های من"},
    "orders_choose_history": {"en": "Choose which order history you want to review.", "fa": "تاریخچه سفارشی که می‌خواهید مرور کنید را انتخاب کنید."},
    "btn_product_orders": {"en": "🛍 Product Orders", "fa": "🛍 سفارش‌های محصول"},
    "btn_wire_orders": {"en": "💸 Wire Transfer Orders", "fa": "💸 سفارش‌های حواله بانکی"},
    "product_orders_title": {"en": "Product Orders", "fa": "سفارش‌های محصول"},
    "orders_tap_to_view": {"en": "Tap an order to view details.", "fa": "برای مشاهده جزئیات روی یک سفارش ضربه بزنید."},
    "product_orders_none": {"en": "No product orders found yet.", "fa": "هنوز سفارش محصولی یافت نشد."},
    "wire_orders_title": {"en": "Wire Transfer Orders", "fa": "سفارش‌های حواله بانکی"},
    "wire_orders_none": {"en": "No wire transfer orders found yet.", "fa": "هنوز سفارش حواله‌ای یافت نشد."},
    "product_order_not_found": {"en": "❌ Order not found.", "fa": "❌ سفارش یافت نشد."},
    "product_order_detail_title": {"en": "Product Order Detail", "fa": "جزئیات سفارش محصول"},
    "product_order_detail_body": {
        "en": "🧾 Order #{id}\n\n📦 {product_name}\n📊 Status: {status}\n💰 Price: {price} {currency}\n",
        "fa": "🧾 سفارش #{id}\n\n📦 {product_name}\n📊 وضعیت: {status}\n💰 قیمت: {price} {currency}\n",
    },
    "product_order_delivery_info": {"en": "\n📩 Delivery: {delivery_info}\n", "fa": "\n📩 تحویل: {delivery_info}\n"},
    "wire_order_not_found": {"en": "❌ Wire order not found.", "fa": "❌ سفارش حواله یافت نشد."},
    "wire_order_detail_title": {"en": "Wire Order Detail", "fa": "جزئیات سفارش حواله"},
    "wire_order_detail_body": {
        "en": "🧾 Wire Order #{id}\n\n💱 {from_currency} → {to_currency}\n📊 Status: {status}\n💸 Amount: {from_amount}\n✅ Receive: {to_amount}\n",
        "fa": "🧾 سفارش حواله #{id}\n\n💱 {from_currency} → {to_currency}\n📊 وضعیت: {status}\n💸 مبلغ: {from_amount}\n✅ دریافتی: {to_amount}\n",
    },
    "wire_order_method_line": {"en": "💳 Method: {method}\n", "fa": "💳 روش: {method}\n"},
    "wire_order_delivered_message": {"en": "\n📩 Delivered message: {message}\n", "fa": "\n📩 پیام تحویل‌شده: {message}\n"},
    "btn_track": {"en": "📍 Track", "fa": "📍 پیگیری"},

    "orders_list_title": {"en": "📋 *Your Orders*\n\n", "fa": "📋 *سفارش‌های شما*\n\n"},
    "orders_list_row": {"en": "#{order_id} | {product_name} | {status}\n", "fa": "#{order_id} | {product_name} | {status}\n"},
    "orders_list_none": {"en": "_No orders found._", "fa": "_سفارشی یافت نشد._"},

    # =====================================================
    # SUPPORT
    # =====================================================
    "support_title": {"en": "Support Center", "fa": "مرکز پشتیبانی"},
    "support_body": {
        "en": "Need assistance?\n\n💬 Our support team is available 24/7\n⚡ Instant response via Telegram bot",
        "fa": "به کمک نیاز دارید؟\n\n💬 تیم پشتیبانی ما به‌صورت ۲۴/۷ در دسترس است\n⚡ پاسخ آنی از طریق ربات تلگرام",
    },

    # =====================================================
    # MY ACCOUNT
    # =====================================================
    "account_menu_title": {"en": "My Account", "fa": "حساب من"},
    "account_load_failed": {"en": "❌ Failed to load your account details.", "fa": "❌ بارگذاری اطلاعات حساب شما ناموفق بود."},
    "account_no_bank_info": {"en": "No bank information saved yet.", "fa": "هنوز اطلاعات بانکی ذخیره نشده است."},
    "account_bank_info_lines": {
        "en": "🏦 Bank Name: {bank_name}\n👤 Holder: {bank_holder_name}\n💳 Card: {bank_card_number}\n🔢 Sheba: {bank_sheba}",
        "fa": "🏦 نام بانک: {bank_name}\n👤 دارنده حساب: {bank_holder_name}\n💳 شماره کارت: {bank_card_number}\n🔢 شبا: {bank_sheba}",
    },
    "account_menu_body": {
        "en": "👤 Profile\nFirst Name: {first_name}\nLast Name: {last_name}\nEmail: {email}\nPhone: {phone_number}\n\n🏦 Bank Info\n{bank_text}",
        "fa": "👤 پروفایل\nنام: {first_name}\nنام خانوادگی: {last_name}\nایمیل: {email}\nتلفن: {phone_number}\n\n🏦 اطلاعات بانکی\n{bank_text}",
    },
    "btn_edit_profile": {"en": "✏️ Edit Profile", "fa": "✏️ ویرایش پروفایل"},
    "btn_edit_bank_info": {"en": "🏦 Edit Bank Info", "fa": "🏦 ویرایش اطلاعات بانکی"},
    "btn_open_my_account": {"en": "👤 Open My Account", "fa": "👤 باز کردن حساب من"},
    "btn_open_my_account_bank": {"en": "🏦 Open My Account", "fa": "🏦 باز کردن حساب من"},

    "account_complete_profile_title": {"en": "Complete Your Profile", "fa": "پروفایل خود را تکمیل کنید"},
    "account_complete_profile_body": {"en": "⚠️ Please complete your personal information before depositing IRT.", "fa": "⚠️ لطفاً پیش از واریز ریال، اطلاعات شخصی خود را تکمیل کنید."},
    "account_complete_bank_title": {"en": "Complete Your Bank Info", "fa": "اطلاعات بانکی خود را تکمیل کنید"},
    "account_complete_bank_body": {"en": "⚠️ Please add your Iranian bank details before depositing IRT.", "fa": "⚠️ لطفاً پیش از واریز ریال، اطلاعات بانک ایرانی خود را وارد کنید."},
    "account_load_active_bank_failed": {"en": "❌ Failed to load the active IRT bank account. Try again later.", "fa": "❌ بارگذاری حساب بانکی ریالی فعال ناموفق بود. بعداً دوباره تلاش کنید."},
    "account_no_active_bank": {"en": "❌ No active platform IRT bank account is available right now.", "fa": "❌ در حال حاضر حساب بانکی ریالی فعالی برای پلتفرم وجود ندارد."},
    "irt_deposit_title": {"en": "IRT Deposit", "fa": "واریز ریال"},
    "irt_deposit_body": {
        "en": "🏦 *IRT Deposit Instructions*\n\nPlease send your deposit to the active platform bank account below and then upload a photo of the receipt in the support chat.\n\nBank Name: {bank_name}\nAccount Holder: {bank_holder_name}\nCard Number: {bank_card_number}\nSheba: {bank_sheba}\n\n📸 After sending the payment, open support and upload the receipt so the deposit can be reviewed manually.",
        "fa": "🏦 *راهنمای واریز ریال*\n\nلطفاً مبلغ واریزی خود را به حساب بانکی فعال پلتفرم که در پایین آمده ارسال کرده و سپس تصویر رسید را در گفتگوی پشتیبانی ارسال کنید.\n\nنام بانک: {bank_name}\nدارنده حساب: {bank_holder_name}\nشماره کارت: {bank_card_number}\nشبا: {bank_sheba}\n\n📸 پس از ارسال پرداخت، پشتیبانی را باز کرده و رسید را آپلود کنید تا واریز به‌صورت دستی بررسی شود.",
    },

    "account_edit_step_title": {"en": "✏️ Update your {section} step by step.\n\nSend a new value for {label}{current}.\nType 'skip' to keep the current value.", "fa": "✏️ {section} خود را مرحله به مرحله به‌روزرسانی کنید.\n\nمقدار جدید برای {label}{current} را ارسال کنید.\nبرای حفظ مقدار فعلی 'skip' را تایپ کنید."},
    "account_edit_bank_step_title": {"en": "🏦 Update your {section} step by step.\n\nSend a new value for {label}{current}.\nType 'skip' to keep the current value.", "fa": "🏦 {section} خود را مرحله به مرحله به‌روزرسانی کنید.\n\nمقدار جدید برای {label}{current} را ارسال کنید.\nبرای حفظ مقدار فعلی 'skip' را تایپ کنید."},
    "account_edit_current_suffix": {"en": " (current: {value})", "fa": " (فعلی: {value})"},
    "account_edit_field_prompt": {"en": "{label}{current}\n\nSend the new value, or type 'skip' to keep the current value.", "fa": "{label}{current}\n\nمقدار جدید را ارسال کنید یا برای حفظ مقدار فعلی 'skip' را تایپ کنید."},
    "account_profile_section": {"en": "Profile", "fa": "پروفایل"},
    "account_bank_section": {"en": "Bank Info", "fa": "اطلاعات بانکی"},

    "account_edit_field_first_name": {"en": "First Name", "fa": "نام"},
    "account_edit_field_last_name": {"en": "Last Name", "fa": "نام خانوادگی"},
    "account_edit_field_email": {"en": "Email", "fa": "ایمیل"},
    "account_edit_field_phone_number": {"en": "Phone", "fa": "تلفن"},
    "account_edit_field_bank_holder_name": {"en": "Bank Holder", "fa": "دارنده حساب بانکی"},
    "account_edit_field_bank_card_number": {"en": "Card Number", "fa": "شماره کارت"},
    "account_edit_field_bank_name": {"en": "Bank Name", "fa": "نام بانک"},
    "account_edit_field_bank_sheba": {"en": "Sheba", "fa": "شبا"},

    "account_edit_preview_title_profile": {"en": "Profile Preview", "fa": "پیش‌نمایش پروفایل"},
    "account_edit_preview_title_bank": {"en": "Bank Info Preview", "fa": "پیش‌نمایش اطلاعات بانکی"},
    "account_edit_preview_header": {"en": "📝 Please review your updates before saving:\n\n", "fa": "📝 لطفاً قبل از ذخیره، تغییرات خود را بررسی کنید:\n\n"},
    "account_edit_preview_line": {"en": "• {label}: {value}\n", "fa": "• {label}: {value}\n"},

    "account_no_changes": {"en": "No changes were collected.", "fa": "تغییری ثبت نشد."},
    "account_updated_success": {"en": "✅ Your {section} has been updated.", "fa": "✅ {section} شما به‌روزرسانی شد."},
    "account_update_failed": {"en": "❌ {error}", "fa": "❌ {error}"},
    "account_profile_updated": {"en": "✅ Profile updated successfully.", "fa": "✅ پروفایل با موفقیت به‌روزرسانی شد."},
    "account_profile_update_failed": {"en": "❌ Failed to update your profile.", "fa": "❌ به‌روزرسانی پروفایل شما ناموفق بود."},
    "account_bank_updated": {"en": "✅ Bank information updated successfully.", "fa": "✅ اطلاعات بانکی با موفقیت به‌روزرسانی شد."},
    "account_bank_update_failed": {"en": "❌ Failed to update bank information.", "fa": "❌ به‌روزرسانی اطلاعات بانکی ناموفق بود."},
    "account_cancelled": {"en": "Cancelled.", "fa": "لغو شد."},

    # =====================================================
    # WIRE TRANSFER
    # =====================================================
    "wire_transfer_title": {"en": "Wire Transfer", "fa": "حواله بانکی"},
    "wire_transfer_body": {
        "en": "Send funds via bank/fiat transfer\n\n🏦 Secure wire processing\n📋 Admin-verified transfers\n🔒 Rate locked at order time",
        "fa": "انتقال وجه از طریق حواله بانکی/فیات\n\n🏦 پردازش امن حواله\n📋 تراکنش‌های تأییدشده توسط مدیر\n🔒 نرخ ثابت در زمان ثبت سفارش",
    },
    "wire_no_options": {"en": "No wire transfer options are currently available.", "fa": "در حال حاضر گزینه‌ای برای حواله بانکی موجود نیست."},
    "wire_err_load_pairs": {"en": "❌ Failed to load wire transfer pairs", "fa": "❌ بارگذاری جفت‌های حواله بانکی ناموفق بود"},
    "wire_pair_button": {"en": "{from_symbol} → {to_symbol} | Rate: {rate} | Fee: {fee}", "fa": "{from_symbol} → {to_symbol} | نرخ: {rate} | کارمزد: {fee}"},

    "wire_method_selection_header": {
        "en": "💱 {from_symbol} → {to_symbol}\n📈 Pair Rate: {rate}\n\n💳 Choose a payment method to continue.\n\n💸 Method Fees:\n{fee_summary}",
        "fa": "💱 {from_symbol} → {to_symbol}\n📈 نرخ جفت ارز: {rate}\n\n💳 برای ادامه یک روش پرداخت انتخاب کنید.\n\n💸 کارمزد روش‌ها:\n{fee_summary}",
    },
    "wire_method_fee_line": {"en": "• {label}: {fee}%\n", "fa": "• {label}: {fee}٪\n"},
    "wire_amount_prompt": {
        "en": "💸 {from_symbol} → {to_symbol}\n📈 Rate: {rate}\n{method_line}💰 Fee: {fee_pct}%\n\n{info}💬 Enter the amount to transfer:",
        "fa": "💸 {from_symbol} → {to_symbol}\n📈 نرخ: {rate}\n{method_line}💰 کارمزد: {fee_pct}٪\n\n{info}💬 مبلغ حواله را وارد کنید:",
    },
    "wire_amount_method_line": {"en": "💳 Method: {method}\n", "fa": "💳 روش: {method}\n"},
    "wire_amount_limits_header": {"en": "📋 Transfer limits:\n", "fa": "📋 محدودیت‌های انتقال:\n"},
    "wire_amount_limit_min": {"en": "• Minimum: {amount}\n", "fa": "• حداقل: {amount}\n"},
    "wire_amount_limit_max": {"en": "• Maximum: {amount}\n", "fa": "• حداکثر: {amount}\n"},

    "wire_pair_not_found": {"en": "❌ Pair not found. Try again.", "fa": "❌ جفت ارز یافت نشد. دوباره تلاش کنید."},
    "wire_no_payment_method": {
        "en": "❌ No payment method is configured for this IRT source pair. Please contact support.",
        "fa": "❌ روش پرداختی برای این جفت ارز ریالی تنظیم نشده است. لطفاً با پشتیبانی تماس بگیرید.",
    },
    "wire_field_prompt": {"en": "📋 {label}{required}:", "fa": "📋 {label}{required}:"},
    "wire_field_optional_suffix": {"en": " (optional)", "fa": " (اختیاری)"},
    "wire_session_expired_reselect": {"en": "❌ Session expired. Please select the pair again.", "fa": "❌ دسترسی منقضی شد. لطفاً جفت ارز را دوباره انتخاب کنید."},
    "wire_invalid_method": {"en": "❌ Invalid method.", "fa": "❌ روش نامعتبر."},
    "wire_no_receiver_info": {"en": "• No receiver payment info configured.", "fa": "• اطلاعات پرداخت دریافت‌کننده تنظیم نشده است."},
    "wire_note_label": {"en": "📝 Note:\n{note}\n\n", "fa": "📝 یادداشت:\n{note}\n\n"},
    "wire_method_instructions": {
        "en": "💳 Payment Method: {method}\n\n📈 Pair Rate: {rate}\n💰 Method Fee: {fee}%\n\n{note}🏦 Please enter the information for the destination transfer step by step:\n",
        "fa": "💳 روش پرداخت: {method}\n\n📈 نرخ جفت ارز: {rate}\n💰 کارمزد روش: {fee}٪\n\n{note}🏦 لطفاً اطلاعات انتقال مقصد را مرحله به مرحله وارد کنید:\n",
    },
    "wire_invalid_amount": {"en": "❌ Invalid amount. Enter a positive number:", "fa": "❌ مبلغ نامعتبر است. یک عدد مثبت وارد کنید:"},
    "wire_amount_min_error": {"en": "❌ Minimum transfer amount is {amount} {currency}. Enter a valid amount:", "fa": "❌ حداقل مبلغ انتقال {amount} {currency} است. یک مبلغ معتبر وارد کنید:"},
    "wire_amount_max_error": {"en": "❌ Maximum transfer amount is {amount} {currency}. Enter a valid amount:", "fa": "❌ حداکثر مبلغ انتقال {amount} {currency} است. یک مبلغ معتبر وارد کنید:"},

    "wire_confirm_title": {"en": "Confirm Wire Transfer", "fa": "تأیید حواله بانکی"},
    "wire_confirm_body": {
        "en": "💱 {from_symbol} → {to_symbol}\n💰 You send:   {amount} {from_symbol}\n💸 Fee:        {fee_amt} {from_symbol} ({fee_pct}%)\n✅ You receive: {to_amount} {to_symbol}\n📈 Rate:       {rate_display}\n\n📋 Transfer Details:\n{summary}\n{extra_block}\n⚠️ Please verify before confirming.",
        "fa": "💱 {from_symbol} → {to_symbol}\n💰 ارسال شما:   {amount} {from_symbol}\n💸 کارمزد:        {fee_amt} {from_symbol} ({fee_pct}٪)\n✅ دریافت شما: {to_amount} {to_symbol}\n📈 نرخ:       {rate_display}\n\n📋 جزئیات انتقال:\n{summary}\n{extra_block}\n⚠️ لطفاً پیش از تأیید، بررسی کنید.",
    },
    "wire_send_to_block": {"en": "\n🏦 Send your {from_symbol} to:\n   {receiver_block}\n", "fa": "\n🏦 {from_symbol} خود را به این مقصد ارسال کنید:\n   {receiver_block}\n"},
    "wire_no_receiver_configured": {"en": "No receiver payment info configured.", "fa": "اطلاعات پرداخت دریافت‌کننده تنظیم نشده است."},
    "wire_summary_line": {"en": "   • {label}: {value}", "fa": "   • {label}: {value}"},
    "wire_summary_method_line": {"en": "   • Payment Method: {method}", "fa": "   • روش پرداخت: {method}"},

    "wire_session_expired_restart": {"en": "❌ Session expired. Please start again.", "fa": "❌ دسترسی منقضی شد. لطفاً دوباره شروع کنید."},
    "wire_order_placement_failed": {"en": "❌ {error}", "fa": "❌ {error}"},
    "wire_submitted_title": {"en": "✅ Wire Transfer Submitted!\n\n", "fa": "✅ حواله بانکی ثبت شد!\n\n"},
    "wire_submitted_body": {
        "en": "📋 Order #{order_id}\n💸 {amount} {from_symbol} → {to_amount} {to_symbol}\n📈 Rate: {rate}\n⏰ Expires: {expires_at}\n",
        "fa": "📋 سفارش #{order_id}\n💸 {amount} {from_symbol} → {to_amount} {to_symbol}\n📈 نرخ: {rate}\n⏰ انقضا: {expires_at}\n",
    },
    "wire_insufficient_balance_note": {
        "en": "\n⚠️ You need {shortfall} more IRT for this transfer.\nCurrent balance: {current_balance} IRT\nPlease send the missing amount to the active platform bank account and upload the receipt in support.",
        "fa": "\n⚠️ برای این انتقال به {shortfall} ریال بیشتر نیاز دارید.\nموجودی فعلی: {current_balance} ریال\nلطفاً مبلغ کسری را به حساب بانکی فعال پلتفرم ارسال کرده و رسید را در پشتیبانی آپلود کنید.",
    },
    "wire_topup_note": {"en": "You need to top up {shortfall} IRT to complete this wire transfer.", "fa": "برای تکمیل این حواله باید {shortfall} ریال شارژ کنید."},
    "wire_placed_footer": {"en": "\nYour wire order has been placed. Use support to upload your receipt.", "fa": "\nسفارش حواله شما ثبت شد. برای آپلود رسید از پشتیبانی استفاده کنید."},
    "wire_cancelled": {"en": "❌ Wire transfer cancelled.", "fa": "❌ حواله بانکی لغو شد."},
    "wire_cancel_failed": {"en": "❌ {error}", "fa": "❌ {error}"},
    "wire_order_cancelled": {"en": "✅ Wire order #{order_id} cancelled.", "fa": "✅ سفارش حواله #{order_id} لغو شد."},

    # =====================================================
    # GENERIC / SHARED ERRORS
    # =====================================================
    "generic_error": {"en": "❌ Error: {error}", "fa": "❌ خطا: {error}"},
    "generic_session_expired": {"en": "❌ Session expired. Please try again.", "fa": "❌ دسترسی منقضی شد. لطفاً دوباره تلاش کنید."},
    "generic_invalid_amount": {"en": "❌ Invalid amount", "fa": "❌ مبلغ نامعتبر"},

    # =====================================================
    # ADMIN — TELEGRAM BOT SETTINGS
    # =====================================================
    "admin_default_language_label": {"en": "Default Language", "fa": "زبان پیش‌فرض"},
}


def t(key: str, lang: str = DEFAULT_LANGUAGE) -> str:
    """Look up `key` in `lang`, falling back to English, then to the key itself."""
    entry = CONTENT.get(key)
    if not entry:
        return key
    return entry.get(lang) or entry.get(DEFAULT_LANGUAGE) or key
