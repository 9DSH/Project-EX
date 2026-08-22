from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import os
from fastapi.staticfiles import StaticFiles
from app.db.database import engine, Base, ensure_schema, ensure_rls_policies
from app.services.ws_manager import manager
from app.services.sweep_scheduler import sweep_worker_loop
from app.services.wire_transfer_expiry import wire_order_expiry_loop

# =========================
# IMPORT ROUTERS CORRECTLY
# =========================
from app.routes.auth import router as auth_router
from app.routes.categories import router as categories_router
from app.routes.wallet import router as wallet_router
from app.routes.user_invitations import router as user_invitations_router
from app.bot.manager.instance_manager import manager as bot_manager

# New Product & Order Routers
from app.routes.products import router as products_router          # Public products
from app.routes.admin_products import router as admin_products_router
from app.routes.order_items import router as orders_router         # User orders
from app.routes.admin_orders import router as admin_orders_router

# Admin & Other Routers
from app.routes.admin_users import router as admin_users_router
from app.routes.admin_wallet import router as admin_wallet_router
from app.routes.admin_categories import router as admin_categories_router
from app.routes.admin_dashboard import router as admin_dashboard_router
from app.routes.admin_realtime import router as admin_realtime_router
from app.routes.admin_messages import router as admin_messages_router
from app.routes.webhook import router as webhook_router
from app.routes.support_message import router as support_messages_router
from app.routes.admin_product_approvals import router as product_approvals_router
from app.routes.admin_withdrawals import router as admin_withdrawals_router
from app.routes.admin_currencies import router as admin_currencies_router
from app.routes.account import router as account_router
from app.routes.admin_telegram_bot_settings import router as admin_telegram_bot_settings_router
from app.routes.admin_global_bot_settings import router as admin_global_bot_settings_router
from app.routes.admin_platform_bank import router as admin_platform_bank_router
from app.routes.admin_networks import router as admin_networks_router
from app.routes.admin_currency_networks import router as admin_currency_networks_router
from app.routes.admin_exchange import router as admin_exchange_router
from app.routes.admin_exchange_analysis import router as admin_exchange_analysis_router
from app.routes.admin_wire_transfer import router as admin_wire_transfer_router
from app.routes.wire_transfer import router as wire_transfer_router
from app.routes.admin_bot_control import router as admin_bot_control_router
from app.routes.bot_context import router as bot_context_router    
from app.routes.exchange import router as exchange_router
from app.routes.admin_invitations import router as admin_invitations_router

app = FastAPI(title="Project EX API", version="1.0.0")
os.makedirs("uploads/products", exist_ok=True)
os.makedirs("uploads/telegram", exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads"
)


# =========================
# CORS
# =========================
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",        "http://localhost:3000",      # in case you switch port
        "http://127.0.0.1:3000",],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# =========================
# STARTUP
# =========================
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    ensure_rls_policies()
    asyncio.create_task(sweep_worker_loop())
    asyncio.create_task(wire_order_expiry_loop())
    asyncio.create_task(bot_manager.start())


@app.on_event("shutdown")
async def shutdown():
    await bot_manager.shutdown()
# =========================
# WEBSOCKET
# =========================
@app.websocket("/ws/messages")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# =========================
# INCLUDE ROUTERS
# =========================

app.include_router(auth_router)

# Public Routes
app.include_router(products_router)
app.include_router(categories_router)
app.include_router(exchange_router)


# User Routes
app.include_router(orders_router)
app.include_router(wallet_router)
app.include_router(user_invitations_router)

# Admin Routes
app.include_router(admin_dashboard_router)
app.include_router(admin_users_router)
app.include_router(admin_products_router)
app.include_router(admin_orders_router)
app.include_router(admin_categories_router)
app.include_router(admin_wallet_router)
app.include_router(admin_withdrawals_router)
app.include_router(admin_currencies_router)
app.include_router(admin_networks_router)
app.include_router(admin_currency_networks_router)
app.include_router(admin_exchange_router)
app.include_router(admin_exchange_analysis_router)
app.include_router(admin_wire_transfer_router)
app.include_router(wire_transfer_router)
app.include_router(admin_realtime_router)
app.include_router(admin_messages_router)
app.include_router(support_messages_router)
app.include_router(webhook_router)
app.include_router(product_approvals_router)
app.include_router(admin_invitations_router)
app.include_router(account_router)
app.include_router(admin_telegram_bot_settings_router)
app.include_router(admin_global_bot_settings_router)
app.include_router(admin_platform_bank_router)
app.include_router(admin_bot_control_router)
app.include_router(bot_context_router)


# =========================
# ROOT
# =========================
@app.get("/")
def root():
    return {
        "message": "Project EX API is Running Successfully ✅",
        "version": "1.0.0"
    }