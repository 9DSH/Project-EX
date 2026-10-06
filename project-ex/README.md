# Project EX

Multi-tenant crypto/fiat exchange platform with a Telegram bot front-end and a React admin dashboard.

- **Backend:** FastAPI + SQLAlchemy + PostgreSQL (Row Level Security per admin)
- **Bots:** Telegram bots (per-admin bots, a global bot, a support bot), managed as subprocesses by the API
- **Admin dashboard:** React + Vite (`admin-dashboard/`)
- **Blockchain:** Tatum API + local HD derivation (BSC / ETH / BASE), deposit sweeping, hot/master wallets

## Features

- Roles: master / admin / user, with access-point based permissions
- Subscription system (plans, add-ons, invoices, grace periods, auto-renewal)
- Crypto deposits (webhook), withdrawals (admin approval), automatic sweeps to hot → master wallet
- Currency exchange pairs with rate history, OHLC candles, P&L and inventory analysis
- Wire transfer (IRT ↔ foreign fiat) orders with approval/delivery flow
- Products marketplace with orders, approvals and commissions
- Invitation-code signup, internal admin ↔ master messaging, support chat (Telegram ↔ dashboard)
- English / Persian bot UI

## Requirements

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+ (uses JSONB and Row Level Security)
- A [Tatum](https://tatum.io) API key
- At least one Telegram bot token (configured later from the dashboard)

## Project structure

```
project-ex/
├── app/
│   ├── main.py                 # FastAPI entry point
│   ├── routes/                 # API routers
│   ├── models/                 # SQLAlchemy models
│   ├── services/               # sweeps, exchange, subscriptions, tatum, schedulers
│   ├── bot/                    # Telegram bots + instance manager
│   ├── db/                     # engine, bootstrap, schema/RLS migrations
│   ├── core/                   # config, security, permissions, rls
│   └── scripts/                # one-off scripts (init_system_wallet.py)
├── admin-dashboard/            # React admin UI
├── uploads/                    # created automatically
└── logs/bots/                  # bot logs, created automatically
```

## Setup

### 1. Backend

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment

Create `app/.env`:

```env
# Database
DATABASE_URL=postgresql://appuser:apppass@localhost:5432/project_ex
PG_SUPERUSER_URL=postgresql://postgres:postgres@localhost:5432/postgres   # auto-creates role + DB

# Tatum / blockchain
TATUM_API_KEY=your_tatum_key
WEBHOOK_SECRET=long_random_string          # HMAC secret for deposit webhooks
WEBHOOK_URL=https://your-domain/webhook/bsc
MASTER_WALLET_ADDRESS=0x...                # treasury address
BSC_PRIVATE_KEY=...                        # funds hot-wallet gas top-ups
# MASTER_MNEMONIC is generated and appended automatically on first start

# Sweeps / gas (optional)
MIN_SWEEP_AMOUNT=5
MIN_BNB_THRESHOLD=0.002
HOT_WALLET_TOPUP_AMOUNT=0.01

# Bots
API_URL=http://127.0.0.1:8000
SUPPORT_BOT_TOKEN=                         # optional, can be set from the dashboard
BOT_GLOBAL_SHARED_SECRET=long_random_string

# JWT secret etc. — whatever app/core/config.py / security.py expects
```

> **Never commit `app/.env`.** It contains the wallet mnemonic and private keys. Back up `MASTER_MNEMONIC` safely — losing it means losing access to all derived deposit wallets.

### 3. Run the backend

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

On startup the app creates tables, generates the system wallet if missing, applies schema migrations and RLS policies, and starts the background workers (sweeps, wire-order expiry, subscription billing) and the bot manager.

### 4. Create the master account (once, on an empty DB)

```bash
curl -X POST http://127.0.0.1:8000/admin/users/bootstrap-master \
  -H "Content-Type: application/json" \
  -d '{"username":"master","password":"change-me","telegram_id":""}'
```

This endpoint refuses to run if any user already exists.

### 5. Admin dashboard

```bash
cd admin-dashboard
npm install
npm run dev
```

Opens at `http://localhost:5173`. The API URL is currently hardcoded to `http://127.0.0.1:8000` (see `src/config.js`, `src/api/client.js`, and several pages) — change these for deployment. CORS origins are set in `app/main.py`.

### 6. Initial configuration (from the dashboard, as master)

1. **Asset Manager:** create currencies, networks, and currency/network pairs (mark default pairs, e.g. USDT/BEP20 and IRT/INTERNAL).
2. **Subscriptions:** create a default free plan and any paid plans / access points.
3. **Telegram Management:** set tokens for the Global Main bot and Support bot; admins with the `telegram.personal.bot` access point set their own.
4. **Invitations:** codes are generated automatically; users need one to sign up through the bot.
5. Point Tatum webhooks at `WEBHOOK_URL` (signature header `x-signature`, HMAC-SHA256 with `WEBHOOK_SECRET`).

## Bots

Bots are spawned automatically by `app/bot/manager/instance_manager.py` from tokens stored in the DB (no separate process to run). Logs: `logs/bots/`. To run one manually:

```bash
python -m app.bot.bot            # needs BOT_TOKEN, API_URL env vars
python -m app.bot.support_bot    # needs SUPPORT_BOT_TOKEN
```

## Notes

- Row Level Security is enforced per admin (`app.current_admin_id`, `app.is_master` session settings); run the app with a non-superuser DB role, otherwise RLS is bypassed.
- Deposit addresses are derived from `MASTER_MNEMONIC` at `m/44'/60'/0'/0/{index}`; the hot wallet is index `100`.
- Currently supported chains for local derivation: BSC, ETH, BASE.

## License

Private / proprietary.