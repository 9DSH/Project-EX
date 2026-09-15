# app/core/permissions.py

class Permissions:
    # TOP Layer
    DASHBOARD_VIEW = "dashboard.view"
    PERSONAL_BOT_ACCESS_POINT = "telegram.personal.bot"
    GLOBAL_BOT_ACCESS_POINT = "telegram.global.bot"       
    PLATFORM_SERVICE_MANAGEMENT = "platform.service.management"
    CATEGORIES_MANAGE = "categories.manage"
    
    # USERS
    ALL_USERS_VIEW = "all.users.view"
    USERS_MANAGE = "users.manage"  # Create and Edit users
    USERS_DELETE = "users.delete"

    # ADMINS

    ADMINS_VIEW = "admins.view"
    ADMINS_PROMOTION= "admins.promotion"

   # EXCHANGE
    EXCHANGE_SERVICE = "exchange.service"   # Full access to exchange management (add/edit exchange pairs)
    EXCHANGE_VIEW = "exchange.view"         # see users exchange history
    EXCHANGE_CREATE = "exchange.create"     # create exchange on behalf of users (userSideBar)
 

    # WIRE TRANSFER
    TRANSFER_SERVICE = "transfer.service"


    # PRODUCTS &  ORDERS
    PRODUCTS_SERVICE = "products.service"
    PRODUCTS_EDIT = "products.edit"
    ORDERS_VIEW = "orders.view"        # see users products order history
    ORDERS_CREATE = "orders.create"    # create product orders on behalf of users (userSideBar)
    ORDERS_MANAGE = "orders.manage"    

    # FINANCE
    PLATFORM_ASSETS = "platform.assets"
    BALANCE_MANAGE = "balance.manage"

    TRANSACTION_VIEW = "transactions.view"

    # INTERNAL
    INTERNAL_TRANSFER = "users.internal.transfer"

    #MESSAGE
    MESSAGE_SEND = "send.message"
    BROADCAST_MESSAGE = "broadcast.message"

    # PAYMENTS
    CRYPTO_PAYMENT = "crypto.payment",
    IRT_PAYMENT = "irt.payment",


# 🔥 ROLE DEFAULTS
ROLE_PERMISSIONS = {
    "master": "*",  # full access
    "admin": [
        Permissions.PERSONAL_BOT_ACCESS_POINT,
        Permissions.GLOBAL_BOT_ACCESS_POINT,
        Permissions.PLATFORM_SERVICE_MANAGEMENT,
        Permissions.DASHBOARD_VIEW,
        Permissions.CATEGORIES_MANAGE,
        Permissions.ADMINS_VIEW,
        Permissions.ADMINS_PROMOTION,

        Permissions.ALL_USERS_VIEW,
        Permissions.USERS_MANAGE,
        Permissions.USERS_DELETE,

        Permissions.EXCHANGE_VIEW,
        Permissions.EXCHANGE_SERVICE,
        Permissions.EXCHANGE_CREATE,

        Permissions.PRODUCTS_SERVICE,
        Permissions.PRODUCTS_EDIT,
        Permissions.ORDERS_VIEW,
        Permissions.ORDERS_CREATE,
        Permissions.ORDERS_MANAGE,

        Permissions.PLATFORM_ASSETS,
        Permissions.BALANCE_MANAGE,
        Permissions.TRANSACTION_VIEW,
        Permissions.TRANSFER_SERVICE,
        Permissions.INTERNAL_TRANSFER,
        Permissions.CRYPTO_PAYMENT,
        Permissions.IRT_PAYMENT,

        Permissions.MESSAGE_SEND,
        Permissions.BROADCAST_MESSAGE,

  
    
    ],
    "user": []
}


def has_access(user, permission: str):
    role = user.get("role")

    if role == "master":
        return True

    allowed = ROLE_PERMISSIONS.get(role, [])

    if allowed == "*":
        return True

    if permission in allowed:
        return True

    access_points = user.get("access_points") or []
    return permission in access_points