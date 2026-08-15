# API Architecture Reference

## Base URL
```
http://localhost:8000
```

## Authentication
All endpoints except `/webhook/*` require JWT Bearer token:
```
Authorization: Bearer {jwt_token}
```

---

## Public Endpoints (Webhook)

### POST /webhook/bsc
Receive blockchain deposits from BSC network

**Request Headers:**
```
X-Signature: {hmac_sha256_signature}
Content-Type: application/json
```

**Request Body:**
```json
{
  "txId": "0x1234...",
  "amount": "100.50",
  "to": "0xuser_wallet_address",
  "symbol": "USDT",
  "chain": "BSC",
  "confirmations": 12
}
```

**Response (Success):**
```json
{
  "status": "success",
  "currency": "USDT",
  "network": "BSC",
  "amount": "100.50",
  "new_balance": 250.75
}
```

**Response (Pending Confirmations):**
```json
{
  "status": "pending_confirmations"
}
```

**Response (Duplicate):**
```json
{
  "status": "duplicate_ignored"
}
```

---

## User Endpoints (Requires Authentication)

### GET /wallet/balance
Get all wallet balances for authenticated user

**Response:**
```json
{
  "wallet_address": "0xabc...",
  "balances": [
    {
      "currency": "USDT",
      "network": "BSC",
      "available": 250.75,
      "frozen": 0.0
    },
    {
      "currency": "IRT",
      "network": "INT",
      "available": 1500.00,
      "frozen": 100.00
    }
  ]
}
```

### POST /wallet/deposit
Manual test deposit (development only)

**Request:**
```json
{
  "amount": 50.0,
  "currency": "USDT",
  "network": "BSC"
}
```

**Response:**
```json
{
  "currency": "USDT",
  "balance": 300.75
}
```

### POST /wallet/withdraw
Initiate withdrawal to external wallet

**Request:**
```json
{
  "amount": 50.0,
  "currency": "USDT",
  "network": "BSC",
  "wallet_address": "0xexternal_wallet_address"
}
```

**Response:**
```json
{
  "withdrawal_id": 123,
  "status": "pending",
  "amount": 50.0,
  "currency": "USDT",
  "network": "BSC",
  "to_address": "0xexternal_wallet_address",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## Admin Endpoints (Requires admin role)

### GET /admin/currencies/
List all available currencies

**Query Parameters:**
- `skip` (int, default=0) - Skip first N records
- `limit` (int, default=50) - Return N records
- `active_only` (bool, default=false) - Filter active currencies

**Response:**
```json
[
  {
    "id": 1,
    "symbol": "USDT",
    "name": "Tether",
    "type": "crypto",
    "decimals": 2,
    "is_active": true,
    "min_deposit": 0.0,
    "min_withdraw": 10.0
  },
  {
    "id": 2,
    "symbol": "IRT",
    "name": "Toman",
    "type": "fiat",
    "decimals": 2,
    "is_active": true,
    "min_deposit": 0.0,
    "min_withdraw": 1000.0
  }
]
```

### GET /admin/networks/
List all available networks

**Query Parameters:**
- `skip` (int, default=0)
- `limit` (int, default=50)
- `active_only` (bool, default=false)

**Response:**
```json
[
  {
    "id": 1,
    "name": "BSC",
    "chain": "BSC",
    "is_active": true,
    "rpc_url": "https://bsc-dataseed.binance.org",
    "explorer": "https://bscscan.com"
  }
]
```

### GET /admin/currency-networks/
List all currency/network pairs with full details

**Query Parameters:**
- `skip` (int, default=0)
- `limit` (int, default=50)
- `active_only` (bool, default=true)
- `currency_id` (int, optional) - Filter by currency
- `network_id` (int, optional) - Filter by network

**Response:**
```json
{
  "pairs": [
    {
      "id": 1,
      "currency_id": 1,
      "currency_symbol": "USDT",
      "network_id": 1,
      "network_chain": "BSC",
      "is_active": true,
      "deposit_enabled": true,
      "withdraw_enabled": true,
      "min_deposit": 10.0,
      "min_withdraw": 10.0,
      "withdraw_fee": 1.0,
      "confirmations_required": 1
    }
  ],
  "total": 2
}
```

### PUT /admin/currency-networks/{pair_id}
Update currency/network pair settings

**Request:**
```json
{
  "is_active": true,
  "deposit_enabled": true,
  "withdraw_enabled": true,
  "min_deposit": 10.0,
  "min_withdraw": 10.0,
  "withdraw_fee": 1.0,
  "confirmations_required": 1
}
```

**Response:**
```json
{
  "id": 1,
  "currency_symbol": "USDT",
  "network_chain": "BSC",
  "is_active": true,
  "deposit_enabled": true,
  "withdraw_enabled": true,
  "min_deposit": 10.0,
  "min_withdraw": 10.0,
  "confirmations_required": 1,
  "message": "Pair settings updated successfully"
}
```

### GET /admin/wallet/transactions
Get transaction history (deposits, withdrawals, sweeps)

**Query Parameters:**
- `skip` (int, default=0)
- `limit` (int, default=50)
- `type_filter` (string, optional) - "deposit", "withdrawal", "sweep"
- `status_filter` (string, optional) - "pending", "completed", "failed"
- `user_id_filter` (int, optional) - Filter by specific user

**Response:**
```json
{
  "transactions": [
    {
      "id": 1,
      "timestamp": "2024-01-15T10:30:00Z",
      "type": "deposit",
      "user_id": 5,
      "username": "john_doe",
      "amount": 100.50,
      "currency": "USDT",
      "network": "BSC",
      "status": "completed",
      "from_address": "0x123...",
      "to_address": "0xabc...",
      "tx_hash": "0x789...",
      "confirmations": 12,
      "fee": 1.0
    }
  ],
  "total": 145,
  "skip": 0,
  "limit": 50
}
```

### GET /admin/wallet/status
Get hot wallet and master wallet balances for all pairs

**Response:**
```json
{
  "hot_wallet": {
    "USDT_BSC": {
      "balance": 5000.0,
      "address": "0xhot_wallet_address"
    }
  },
  "master_wallet": {
    "USDT_BSC": {
      "balance": 50000.0,
      "address": "0xmaster_wallet_address"
    }
  },
  "all_pairs": [
    {
      "currency": "USDT",
      "network": "BSC",
      "tatum_symbol": "USDT_BSC",
      "display_name": "USDT on BSC",
      "hot_wallet": {
        "balance": 5000.0,
        "address": "0xhot..."
      },
      "master_wallet": {
        "balance": 50000.0,
        "address": "0xmaster..."
      }
    }
  ],
  "summary": {
    "total_hot_usd": 5000.0,
    "total_master_usd": 50000.0,
    "total_deposits_24h": 12500.0,
    "total_deposits_all_time": 125000.0,
    "pending_deposits": 3
  }
}
```

### GET /admin/wallet/gas-status
Get network gas prices and status

**Response:**
```json
{
  "networks": [
    {
      "network": "BSC",
      "chain_id": 56,
      "status": "online",
      "gas_price_gwei": 5.5,
      "gas_price_usd": 0.165,
      "estimated_time_minutes": 2,
      "last_updated": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### GET /admin/wallet/user/{user_id}/wallets
Get all wallets for a specific user

**Response:**
```json
{
  "user_id": 5,
  "username": "john_doe",
  "wallets": [
    {
      "wallet_address": "0xuserwalletbsc",
      "currency": "USDT",
      "network": "BSC",
      "balance": 100.50,
      "created_at": "2024-01-10T08:00:00Z"
    },
    {
      "wallet_address": "0xuserwalletint",
      "currency": "IRT",
      "network": "INT",
      "balance": 2000.00,
      "created_at": "2024-01-12T14:30:00Z"
    }
  ]
}
```

### POST /admin/wallet/sweep
Manually trigger wallet sweep (user → hot → master)

**Request:**
```json
{}
```

**Response:**
```json
{
  "user_sweep": {
    "status": "success",
    "amount_swept": 2500.0,
    "users_affected": 15,
    "transaction_hash": "0x123..."
  },
  "hot_sweep": {
    "status": "success",
    "amount_swept": 50000.0,
    "transaction_hash": "0x456..."
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "detail": "MIN_DEPOSIT_USDT_BSC_10.0"
}
```

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden
```json
{
  "detail": "Admin access required"
}
```

### 404 Not Found
```json
{
  "detail": "Currency not found"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

---

## Rate Limiting
- Webhook endpoints: 100 requests/minute per IP
- User endpoints: 1000 requests/minute per user
- Admin endpoints: 500 requests/minute per admin

## Security Headers
- All responses include: `X-Content-Type-Options: nosniff`
- CORS: Configured for trusted origins only
- HTTPS: Required in production

---

## Webhook Signature Verification

### Algorithm
```
signature = HMAC-SHA256(payload, WEBHOOK_SECRET)
```

### Implementation (Python)
```python
import hmac
import hashlib

def verify_webhook(raw_body: bytes, signature: str, secret: str) -> bool:
    computed = hmac.new(
        secret.encode(),
        raw_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, signature)
```

### Implementation (JavaScript)
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const computed = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(signature)
  );
}
```

---

## Pagination
All list endpoints support pagination:
```
GET /admin/currencies/?skip=0&limit=50
```

Response includes:
```json
{
  "items": [...],
  "total": 1234,
  "skip": 0,
  "limit": 50
}
```

---

## Status Codes
- `200 OK` - Successful request
- `201 Created` - Resource created
- `400 Bad Request` - Invalid parameters or validation error
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - Authenticated but insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Database or service temporarily unavailable

---

**Last Updated:** 2024
**API Version:** 1.0
**Status:** Production Ready
