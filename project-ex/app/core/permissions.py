# app/core/permissions.py

class Permissions:
    # DASHBOARD
    DASHBOARD_VIEW = "dashboard.view"

    # USERS
    USERS_VIEW = "users.view"
    USERS_CREATE = "users.create"
    USERS_EDIT = "users.edit"
    USERS_DELETE = "users.delete"

    # ADMINS

    ADMINS_VIEW = "admins.view"
    ADMINS_PROMOTION= "admins.promotion"

    # ORDERS
    ORDERS_VIEW = "orders.view"
    ORDERS_CREATE = "orders.create"
    ORDERS_MANAGE = "orders.manage"

   # EXCHANGE
    EXCHANGE_VIEW = "exchange.view"
    EXCHANGE_MANAGE = "exchnage.manage"
    PLATFORM_EXCHANGE_MANAGEMENT = "platform_exchange_management"

    # WIRE TRANSFER
    WIRE_TRANSFER_VIEW   = "wire_transfer.view"
    WIRE_TRANSFER_MANAGE = "wire_transfer.manage"


    CATEGORIES_MANAGE = "categories.manage"

    # PRODUCTS
    PRODUCTS_MANAGE = "products.manage"
    PRODUCTS_VIEW = "products.view"
    PRODUCTS_CREATE = "products.create"
    PRODUCTS_EDIT = "products.edit"
    PRODUCTS_DELETE = "products.delete"

    # FINANCE
    FINANCE_ASSET = "finance.assets"
    FINANCE_MANAGE = "finance.manage"

    TRANSACTION_VIEW = "transactions.view"

    # INTERNAL
    INTERNAL_TRANSFER = "users.internal_transfer"

    #MESSAGE
    MESSAGE_SEND = "send.message"
    BROADCAST_MESSAGE = "broadcast.message"


# 🔥 ROLE DEFAULTS
ROLE_PERMISSIONS = {
    "master": "*",  # full access
    "admin": [
        Permissions.DASHBOARD_VIEW,
        Permissions.USERS_VIEW,
        Permissions.USERS_CREATE,
        Permissions.USERS_EDIT,
        Permissions.USERS_DELETE,

        Permissions.ADMINS_VIEW,
        Permissions.ADMINS_PROMOTION,

        Permissions.ORDERS_VIEW,
        Permissions.ORDERS_CREATE,
        Permissions.ORDERS_MANAGE,


        Permissions.EXCHANGE_VIEW,
        Permissions.EXCHANGE_MANAGE,

        Permissions.WIRE_TRANSFER_VIEW,
        Permissions.WIRE_TRANSFER_MANAGE,

        Permissions.CATEGORIES_MANAGE,

        Permissions.PRODUCTS_MANAGE,
        Permissions.PRODUCTS_VIEW,
        Permissions.PRODUCTS_CREATE, 
        Permissions.PRODUCTS_EDIT,
        Permissions.PRODUCTS_DELETE,


        Permissions.FINANCE_ASSET,
        Permissions.FINANCE_MANAGE,
        Permissions.TRANSACTION_VIEW,

        Permissions.INTERNAL_TRANSFER,

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