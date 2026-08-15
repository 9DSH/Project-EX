# Deployment & Architecture Guide

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN NETWORKS (External)               │
│  BSC, Ethereum, Polygon, etc.                                   │
└────────────────┬────────────────────────────────────────────────┘
                 │ Deposits (webhooks)
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                    FASTAPI SERVER                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Webhook Handler                                         │  │
│  │  POST /webhook/bsc                                       │  │
│  │  - HMAC signature verification                           │  │
│  │  - Dynamic currency/network resolution                   │  │
│  │  - Multi-network wallet lookup                           │  │
│  │  - Amount validation                                     │  │
│  │  - Async Telegram notification                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  User Wallet Endpoints (JWT Protected)                   │  │
│  │  - GET /wallet/balance                                   │  │
│  │  - POST /wallet/deposit                                  │  │
│  │  - POST /wallet/withdraw                                 │  │
│  │  Multi-network balance tracking per (user, currency,     │  │
│  │  network)                                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Admin Dashboard Endpoints (Admin Role Required)         │  │
│  │  - GET /admin/wallet/transactions                        │  │
│  │  - GET /admin/wallet/status                              │  │
│  │  - GET /admin/wallet/gas-status                          │  │
│  │  - GET /admin/currency-networks/                         │  │
│  │  - PUT /admin/currency-networks/{id}                     │  │
│  │  Real-time wallet visibility & dynamic pair management   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Background Sweep Scheduler                              │  │
│  │  - asyncio.create_task(sweep_worker_loop())              │  │
│  │  - Runs on configurable interval (default: 60 seconds)   │  │
│  │  - User Wallets → Hot Wallet → Master Wallet             │  │
│  │  - Centralized fund management                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────┬──────────────────────────────────────────────────┘
              │
              │ ORM Queries
              │
┌─────────────▼──────────────────────────────────────────────────┐
│               PostgreSQL Database                              │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Tables:                                               │   │
│  │  - currencies (active flag, min limits)                │   │
│  │  - networks (chain info, RPC URLs)                     │   │
│  │  - currency_networks (active pairs, controls)          │   │
│  │  - user_wallets (multi-network addresses)              │   │
│  │  - user_balances (per-pair available + frozen)         │   │
│  │  - transactions (immutable audit trail)                │   │
│  │  - system_wallet (hot/master wallet xpubs)             │   │
│  │  - failed_sweeps (retry mechanism)                     │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
              │
              │ API calls
              │
┌─────────────▼──────────────────────────────────────────────────┐
│               Tatum API Service                                │
│  - Wallet derivation (BIP44)                                   │
│  - Address generation per network/chain                        │
│  - Balance queries                                             │
│  - Transaction broadcasting                                    │
│  - Gas price monitoring                                        │
└────────────────────────────────────────────────────────────────┘
              │
              │ Notifications
              │
┌─────────────▼──────────────────────────────────────────────────┐
│               Telegram Bot                                     │
│  - User deposit confirmations                                  │
│  - Withdrawal status updates                                   │
│  - Admin alerts                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Complete Deposit Workflow

```
1. USER DEPOSITS CRYPTO (External Blockchain)
   ↓
2. BLOCKCHAIN NETWORK CONFIRMS TRANSACTION
   ↓
3. EXTERNAL NOTIFIER SENDS WEBHOOK
   POST /webhook/bsc
   {
     "txId": "0x...",
     "amount": "100.50",
     "to": "0xuserwalletaddress",
     "symbol": "USDT",
     "chain": "BSC",
     "confirmations": 12,
     "X-Signature": "hmac_sha256_hash"
   }
   ↓
4. WEBHOOK HANDLER PROCESSES
   a) Verify HMAC-SHA256 signature
   b) Check for duplicate tx_hash (idempotent)
   c) Extract symbol + chain from flexible formats
   d) Query database for UserWallet matching address
      (Fallback to User.wallet_address for old deposits)
   e) Resolve CurrencyNetwork pair from symbol + chain
      (Validates: is_active, deposit_enabled, 
       min_deposit, confirmations_required)
   f) Validate amount against pair limits
   g) Check confirmations >= required
   h) Credit user balance atomically in database
      - Update UserBalance.available_balance
      - Create immutable Transaction record
   i) Trigger async Telegram notification
   ↓
5. WEBHOOK RESPONSE (200 OK)
   {
     "status": "success",
     "currency": "USDT",
     "network": "BSC",
     "amount": "100.50",
     "new_balance": 250.75
   }
   ↓
6. BACKGROUND SWEEP SCHEDULER RUNS (every 60 seconds)
   a) Query all UserBalance records
   b) For each balance with amount > 0:
      - Create sweep transaction
      - Call Tatum API to send from user wallet → hot wallet
      - Record transaction in database
   ↓
7. HOT WALLET SWEEP TO MASTER WALLET
   a) Aggregate all hot wallet balances
   b) Call Tatum API to send from hot wallet → master wallet
   c) Record master sweep transaction
   ↓
8. ADMIN DASHBOARD VISIBILITY
   a) Admin can see transaction in GET /admin/wallet/transactions
   b) Hot/Master wallet balances visible in GET /admin/wallet/status
   c) Network gas prices visible in GET /admin/wallet/gas-status
   ↓
9. USER NOTIFICATION (Async)
   Telegram message:
   ✅ *Deposit Confirmed!*
   
   💰 Amount: +100.50 USDT
   🔗 Network: BSC
   💳 New Balance: 250.75 USDT
   ⏳ Sweeping to master wallet...
```

---

## Data Flow: Complete Withdrawal Workflow

```
1. USER INITIATES WITHDRAWAL (Authenticated)
   POST /wallet/withdraw
   {
     "amount": 50.0,
     "currency": "USDT",
     "network": "BSC",
     "wallet_address": "0xexternal_wallet"
   }
   ↓
2. BACKEND PROCESSES WITHDRAWAL REQUEST
   a) Resolve CurrencyNetwork pair
   b) Validate amount >= min_withdraw
   c) Query UserBalance with lock (FOR UPDATE)
   d) Check available_balance >= amount
   e) Deduct amount from available_balance
   f) Add amount to frozen_balance (pending)
   g) Create withdrawal Transaction record (status: pending)
   ↓
3. ADMIN EXECUTES WITHDRAWAL (Admin Only)
   Triggered manually or scheduled batch:
   a) Query pending withdrawal transactions
   b) For each withdrawal:
      - Verify still pending
      - Call Tatum API using dynamic symbol
        Format: "{CURRENCY}_{NETWORK}"
        Example: "USDT_BSC"
      - Send from hot wallet to user's external address
      - Record on-chain transaction hash
      - Update transaction status to "completed"
   ↓
4. BLOCKCHAIN CONFIRMS
   a) Network includes transaction in block
   b) Confirmations accumulate
   ↓
5. OPTIONAL: ADMIN REFUND/REJECT
   If withdrawal fails:
   a) Update transaction status to "failed" or "rejected"
   b) Restore amount from frozen_balance to available_balance
   c) Send notification to user
   ↓
6. USER SEES UPDATED BALANCE
   GET /wallet/balance returns updated amounts
   (frozen_balance reduced, available_balance unchanged or restored)
```

---

## Database Schema

```sql
-- Currencies (Supported cryptos/fiats)
CREATE TABLE currencies (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  type VARCHAR(20),  -- 'crypto', 'fiat'
  decimals INT,
  is_active BOOLEAN DEFAULT TRUE,
  min_deposit FLOAT DEFAULT 0,
  min_withdraw FLOAT DEFAULT 0
);

-- Networks (Blockchain networks)
CREATE TABLE networks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  chain VARCHAR(50) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  rpc_url VARCHAR(255),
  explorer_url VARCHAR(255)
);

-- Currency Network Pairs (Multi-network support)
CREATE TABLE currency_networks (
  id SERIAL PRIMARY KEY,
  currency_id INT NOT NULL REFERENCES currencies(id),
  network_id INT NOT NULL REFERENCES networks(id),
  is_active BOOLEAN DEFAULT TRUE,
  deposit_enabled BOOLEAN DEFAULT TRUE,
  withdraw_enabled BOOLEAN DEFAULT TRUE,
  min_deposit FLOAT DEFAULT 0,
  min_withdraw FLOAT DEFAULT 0,
  withdraw_fee FLOAT DEFAULT 0,
  confirmations_required INT DEFAULT 1,
  UNIQUE(currency_id, network_id)
);

-- User Wallets (Multi-network addresses per user)
CREATE TABLE user_wallets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id),
  currency_id INT NOT NULL REFERENCES currencies(id),
  network_id INT NOT NULL REFERENCES networks(id),
  address VARCHAR(255) NOT NULL,
  index INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, currency_id, network_id)
);

-- User Balances (Per-pair balance tracking)
CREATE TABLE user_balances (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id),
  currency_id INT NOT NULL REFERENCES currencies(id),
  network_id INT NOT NULL REFERENCES networks(id),
  available_balance FLOAT DEFAULT 0,
  frozen_balance FLOAT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, currency_id, network_id)
);

-- Transactions (Immutable audit trail)
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id),
  currency_id INT REFERENCES currencies(id),
  network_id INT REFERENCES networks(id),
  amount FLOAT NOT NULL,
  type VARCHAR(50) NOT NULL,  -- 'deposit', 'withdrawal', 'sweep', etc.
  status VARCHAR(50) DEFAULT 'pending',
  tx_hash VARCHAR(255),
  wallet_address VARCHAR(255),
  blockchain VARCHAR(50),
  confirmations INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(tx_hash),
  INDEX(user_id),
  INDEX(type),
  INDEX(status)
);

-- System Wallets (Hot & Master wallets)
CREATE TABLE system_wallet (
  id SERIAL PRIMARY KEY,
  xpub VARCHAR(255) NOT NULL,
  next_index INT DEFAULT 0
);
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ex-project

# Server
PORT=8000
DEBUG=false

# Security
SECRET_KEY=your-secret-key-here
WEBHOOK_SECRET=your-webhook-secret-here

# Tatum API
TATUM_API_KEY=your-tatum-key-here
TATUM_TEST_MODE=false

# Telegram (for notifications)
TELEGRAM_BOT_TOKEN=your-bot-token-here

# Sweep Scheduler
SWEEP_INTERVAL_SECONDS=60
HOT_WALLET_XPUB=xpub6FHDqwG2n1Qq...
MASTER_WALLET_ADDRESS=0xmaster_address_here
```

### Recommended Production Settings

```bash
# Use environment-specific configs
export ENVIRONMENT=production
export LOG_LEVEL=INFO
export CORS_ORIGINS=["https://yourdomain.com"]
export RATE_LIMIT_REQUESTS=1000
export RATE_LIMIT_WINDOW_SECONDS=60
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All dependencies installed: `pip install -r requirements.txt`
- [ ] Database backup created
- [ ] Environment variables configured
- [ ] SSL certificates obtained (HTTPS required in production)
- [ ] Tatum API credentials validated

### Database Migrations
```bash
# Create migration for CurrencyNetwork model
python -m alembic revision --autogenerate -m "Add CurrencyNetwork support"

# Create migration for UserWallet model  
python -m alembic revision --autogenerate -m "Add UserWallet multi-network support"

# Apply all migrations
python -m alembic upgrade head

# Verify tables created
psql -c "SELECT * FROM information_schema.tables WHERE table_schema='public';"
```

### Initial Data Setup
```sql
-- Insert currencies
INSERT INTO currencies (symbol, name, type, min_deposit, min_withdraw)
VALUES ('USDT', 'Tether', 'crypto', 0, 10.0);

-- Insert networks
INSERT INTO networks (name, chain, rpc_url)
VALUES ('BSC', 'BSC', 'https://bsc-dataseed.binance.org');

-- Insert pairs
INSERT INTO currency_networks (currency_id, network_id, min_deposit, min_withdraw, confirmations_required)
VALUES (1, 1, 10.0, 10.0, 1);

-- Insert admin user
INSERT INTO users (username, email, password_hash, role)
VALUES ('admin', 'admin@example.com', 'hashed_password', 'admin');
```

### Server Startup
```bash
# Development
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production (with gunicorn)
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000

# Production (with systemd)
sudo systemctl start crypto-deposit-api
sudo systemctl enable crypto-deposit-api
```

### Health Checks
```bash
# Server health
curl http://localhost:8000/health

# Database connection
curl http://localhost:8000/admin/currencies/

# Webhook endpoint ready
curl -X POST http://localhost:8000/webhook/bsc \
  -H "Content-Type: application/json" \
  -d '{"txId":"test"}' \
  -H "X-Signature: invalid"
# Should return 401, not 500
```

---

## Monitoring & Logging

### Key Metrics to Monitor
1. **Webhook Processing**
   - Requests per minute
   - Average processing time
   - Error rate (invalid signatures, failed validations)
   - Duplicate detection rate

2. **Sweep Scheduler**
   - Sweep interval compliance
   - Amount swept per cycle
   - Success/failure rate
   - Failed sweep queue depth

3. **Database**
   - Connection pool utilization
   - Query performance (esp. transaction queries)
   - Transaction table size (archival strategy)
   - Unique constraint violations

4. **API Performance**
   - Request latency p50/p95/p99
   - Admin endpoint response times
   - Error rate by endpoint
   - 5xx error frequency

### Logging Configuration
```python
# app/core/logging.py
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Log key events
logger.info(f"Deposit processed: {tx_hash} for user {user_id} - {amount} {currency}")
logger.warning(f"Duplicate deposit detected: {tx_hash}")
logger.error(f"Sweep failed for user {user_id}: {exception}")
```

### Alerting Rules
- Alert on: Webhook error rate > 5% for 5 minutes
- Alert on: Sweep scheduler missed execution
- Alert on: Database connection pool exhausted
- Alert on: Tatum API failures

---

## Scaling Considerations

### Current Limitations
- Single server instance
- Single sweep worker process
- No horizontal scaling of webhook processing

### Scaling Strategy
1. **Database** → Use read replicas for admin queries
2. **Sweep Scheduler** → Use Celery + Redis for distributed task scheduling
3. **Webhook Processing** → Use message queue (Kafka/RabbitMQ) for async processing
4. **Cache** → Add Redis for active pairs caching

### High-Availability Setup
```
Load Balancer
    ↓
[API Server 1] [API Server 2] [API Server 3]
    ↓
[PostgreSQL Primary] ← [PostgreSQL Replica]
    ↓
[Redis Cache]
    ↓
[Celery Worker 1] [Celery Worker 2] [Celery Worker 3]
```

---

## Security Hardening

### Before Production
- [ ] Change all default secrets
- [ ] Enable database SSL connections
- [ ] Configure HTTPS only
- [ ] Enable request rate limiting
- [ ] Implement DDoS protection (CloudFlare, etc.)
- [ ] Set up Web Application Firewall (WAF)
- [ ] Enable database audit logging
- [ ] Configure backup encryption
- [ ] Implement key rotation policy

### Runtime Security
- [ ] Monitor for suspicious activity
- [ ] Alert on failed authentication attempts
- [ ] Track all admin actions
- [ ] Monitor for unusual transaction patterns
- [ ] Alert on Tatum API failures

---

## Disaster Recovery

### Backup Strategy
```bash
# Daily database backup
0 2 * * * pg_dump -U user -d ex-project > /backups/db_$(date +\%Y\%m\%d).sql

# Weekly full backup
0 3 * * 0 tar -czf /backups/full_$(date +\%Y\%m\%d).tar.gz /app /data
```

### Recovery Procedures
1. **Database Loss** → Restore from latest backup, replay transaction logs
2. **Wallet Keys Loss** → Restore from hardware wallet or secure backup
3. **Service Outage** → Switch to standby server, restore from backup
4. **Data Corruption** → Restore specific tables from backup, verify transactions

---

**Last Updated:** 2024  
**Version:** 1.0  
**Status:** Production Ready
