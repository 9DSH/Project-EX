# tatum_service.py

import requests
import os
from app.core.config import TATUM_API_KEY
from eth_account import Account

Account.enable_unaudited_hdwallet_features()

# Chains that share the same BIP44 coin type (Ethereum, coin_type=60) and can
# therefore be derived locally via eth_account from the master mnemonic.
EVM_CHAINS = {"BSC", "ETH", "BASE"}

BASE_URL = "https://api.tatum.io/v3"

headers = {
    "x-api-key": TATUM_API_KEY,
    "Content-Type": "application/json"
}

# =========================
# NETWORK CONFIG
# Each entry defines how to send on that network
# =========================
NETWORK_CONFIG = {
    "USDT_BSC": {
        "chain": "BSC",
        "type": "bep20",
        "endpoint": "/bsc/transaction",
        "native": False,
    },
    "USDC_BSC": {
        "chain": "BSC",
        "type": "bep20",
        "endpoint": "/bsc/transaction",
        "native": False,
    },
    "BUSD_BSC": {
        "chain": "BSC",
        "type": "bep20",
        "endpoint": "/bsc/transaction",
        "native": False,
    },
    "BBTC": {
        "chain": "BSC",
        "type": "bep20",
        "endpoint": "/bsc/transaction",
        "native": False,
    },
    "BETH": {
        "chain": "BSC",
        "type": "bep20",
        "endpoint": "/bsc/transaction",
        "native": False,
    },
    "WBNB": {
        "chain": "BSC",
        "type": "bep20",
        "endpoint": "/bsc/transaction",
        "native": False,
    },
    "BSC": {
        "chain": "BSC",
        "type": "native",
        "endpoint": "/bsc/transaction",
        "native": True,
    },
    # ETH/TRX keep their contract since they use different endpoints
    "USDT_ETH": {
        "chain": "ETH",
        "type": "erc20",
        "contract": "0xdac17f958d2ee523a2206206994597c13d831ec7",
        "digits": 6,
        "endpoint": "/ethereum/transaction",
        "native": False,
    },
    "USDC_BASE": {
        "chain": "BASE",
        "type": "erc20",
        "contract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "digits": 6,
        "endpoint": "/base/transaction",
        "native": False,
    },
    "USDC_ETH": {
        "chain": "ETH",
        "type": "erc20",
        "contract": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "digits": 6,
        "endpoint": "/ethereum/transaction",
        "native": False,
    },
    "BASE": {
        "chain": "BASE",
        "type": "native",
        "endpoint": "/base/transaction",
        "native": True,
    },
    "ETH": {
        "chain": "ETH",
        "type": "native",
        "endpoint": "/ethereum/transaction",
        "native": True,
    },
    "USDT_TRX": {
        "chain": "TRON",
        "type": "trc20",
        "contract": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        "digits": 6,
        "endpoint": "/tron/transaction",
        "native": False,
    },
    "TRX": {
        "chain": "TRON",
        "type": "native",
        "endpoint": "/tron/transaction",
        "native": True,
    },
}

CHAIN_ENDPOINTS = {
    "BSC": {"endpoint": "/bsc/transaction", "type": "bep20", "native_symbol": "BNB", "native_tatum": "BSC"},
    "ETH": {"endpoint": "/ethereum/transaction", "type": "erc20", "native_symbol": "ETH", "native_tatum": "ETH"},
    "BASE": {"endpoint": "/base/transaction", "type": "erc20", "native_symbol": "ETH", "native_tatum": "BASE"},
    "TRON": {"endpoint": "/tron/transaction", "type": "trc20", "native_symbol": "TRX", "native_tatum": "TRX"},
    "TRX": {"endpoint": "/tron/transaction", "type": "trc20", "native_symbol": "TRX", "native_tatum": "TRX"},
}

# =========================
# INTERNAL → TATUM SYMBOL MAP
# Maps DB symbols to Tatum currency keys above
# =========================
INTERNAL_TO_TATUM = {
    "USDT":  "USDT_BSC",   # default USDT = BSC
    "USDC":  "USDC_BSC",
    "BUSD":  "BUSD_BSC",
    "BTC":   "BBTC",
    "ETH":   "BETH",
    "BNB":   "WBNB",
    "ADA":   "BADA",
    "XRP":   "BXRP",
    "LTC":   "BLTC",
    "BCH":   "BBCH",
    "DOT":   "BDOT",
    "TRX":   "TRX",
}

def to_tatum_symbol(symbol: str, network: str = None) -> str:
    """
    Convert internal symbol to Tatum key.
    Optionally pass network to disambiguate e.g. USDT on ETH vs BSC.
    Examples:
        to_tatum_symbol("USDT")          → "USDT_BSC"
        to_tatum_symbol("USDT", "ETH")   → "USDT_ETH"
        to_tatum_symbol("USDT", "BSC")   → "USDT_BSC"
        to_tatum_symbol("USDT_BSC")      → "USDT_BSC"  (already mapped)
    """
    sym = symbol.upper()
    net = network.upper() if network else None

    if net in CHAIN_ENDPOINTS and sym == CHAIN_ENDPOINTS[net]["native_symbol"]:
        return CHAIN_ENDPOINTS[net]["native_tatum"]

    # Already a valid Tatum key
    if sym in NETWORK_CONFIG:
        return sym

    # Network-qualified lookup e.g. USDT + ETH → USDT_ETH
    if net:
        qualified = f"{sym}_{net}"
        if qualified in NETWORK_CONFIG:
            return qualified

    # Fall back to internal map
    return INTERNAL_TO_TATUM.get(sym, sym)


def get_network_config(tatum_symbol: str) -> dict:
    symbol = tatum_symbol.upper()
    cfg = NETWORK_CONFIG.get(symbol)
    if cfg:
        return cfg

    if symbol in CHAIN_ENDPOINTS:
        chain_cfg = CHAIN_ENDPOINTS[symbol]
        return {
            "chain": "TRON" if symbol == "TRX" else symbol,
            "type": "native",
            "endpoint": chain_cfg["endpoint"],
            "native": True,
        }

    if "_" in symbol:
        _, net = symbol.rsplit("_", 1)
        chain_cfg = CHAIN_ENDPOINTS.get(net)
        if chain_cfg:
            return {
                "chain": "TRON" if net in ("TRON", "TRX") else net,
                "type": chain_cfg["type"],
                "endpoint": chain_cfg["endpoint"],
                "native": False,
            }

    if not cfg:
        raise Exception(f"Unsupported currency/network: {tatum_symbol}")
    return cfg


def get_native_tatum_symbol(chain: str) -> str:
    chain_key = chain.upper()
    if chain_key not in CHAIN_ENDPOINTS:
        raise Exception(f"Unsupported chain: {chain}")
    return CHAIN_ENDPOINTS[chain_key]["native_tatum"]


# =========================
# UNIVERSAL TOKEN TRANSFER
# Works for any currency/network defined in NETWORK_CONFIG
# =========================
def transfer_token(
    from_private_key: str,
    to_address: str,
    amount: float,
    currency: str = "USDT_BSC",
):
    cfg = get_network_config(currency)
    url = f"{BASE_URL}{cfg['endpoint']}"

    if cfg["native"]:
        # Native coin (BNB, ETH, TRX) — uses currency field
        payload = {
            "to": to_address,
            "currency": cfg["chain"],
            "amount": str(amount),
            "fromPrivateKey": from_private_key,
        }
    elif cfg["type"] in ("bep20", "erc20"):
        # ✅ Tatum /bsc/transaction and /ethereum/transaction for tokens
        # uses "currency" field with the Tatum symbol, NOT contractAddress
        payload = {
            "to": to_address,
            "currency": currency.upper(),   # e.g. "USDT_BSC", "USDC_BSC"
            "amount": str(amount),
            "fromPrivateKey": from_private_key,
        }
    elif cfg["type"] == "trc20":
        # TRC20 uses /tron/transaction with contractAddress
        payload = {
            "chain": "TRON",
            "to": to_address,
            "tokenAddress": cfg["contract"],
            "amount": str(amount),
            "fromPrivateKey": from_private_key,
        }
    else:
        raise Exception(f"Unknown transfer type for {currency}")

    res = requests.post(url, json=payload, headers=headers)
    print(f"🔥 {currency} TRANSFER:", res.status_code, res.text)

    if res.status_code != 200:
        raise Exception(f"Tatum transfer error ({currency}): {res.text}")

    return res.json()


# =========================
# LEGACY ALIASES (backwards compat)
# =========================
def transfer_bep20_token(from_private_key: str, to_address: str, amount: float, currency: str = "USDT_BSC"):
    return transfer_token(from_private_key, to_address, amount, currency)

def send_bsc_usdt(to_address: str, amount: float, private_key: str = None):
    return transfer_token(
        from_private_key=private_key or os.getenv("BSC_PRIVATE_KEY"),
        to_address=to_address,
        amount=amount,
        currency="USDT_BSC"
    )

def send_bnb(to_address: str, amount: float):
    return transfer_token(
        from_private_key=os.getenv("BSC_PRIVATE_KEY"),
        to_address=to_address,
        amount=amount,
        currency="BSC"
    )

def transfer_native_bnb(from_private_key: str, to_address: str, amount: float):
    return transfer_token(from_private_key, to_address, amount, "BSC")


# =========================
# ADDRESS DERIVATION
# Derives a deposit address for a given BIP44 index from the master mnemonic.
# =========================
def derive_address(mnemonic: str, index: int, network_chain: str) -> str:
    """
    Derive a wallet address for the given index on the given chain.

    Currently supports EVM-compatible chains (BSC, ETH) which share the same
    Ethereum-style derivation path (m/44'/60'/0'/0/{index}). Other chains
    (e.g. TRON) are not yet supported for local derivation.
    """
    chain = (network_chain or "").upper()

    if chain in EVM_CHAINS:
        account = Account.from_mnemonic(
            mnemonic,
            account_path=f"m/44'/60'/0'/0/{index}"
        )
        return account.address

    raise Exception(f"Address derivation not supported for chain: {network_chain}")


# =========================
# BALANCE CHECKS
# =========================
def get_usdt_balance(address: str) -> float:
    return get_token_balance(address, "USDT_BSC")


def get_token_balance(address: str, currency: str = "USDT_BSC") -> float:
    cfg = get_network_config(currency)

    if cfg["native"]:
        # Native coin: BNB, ETH, TRX
        url = f"{BASE_URL}/blockchain/balance/{cfg['chain']}/{address}"
        res = requests.get(url, headers=headers)
        if res.status_code != 200:
            raise Exception(f"Balance check failed ({currency}): {res.text}")
        return float(res.json().get("balance", 0))

    elif cfg["type"] == "bep20":
        # Correct Tatum v3 endpoint for BEP-20 token balance
        url = f"{BASE_URL}/bsc/account/balance/{address}"
        params = {"currency": currency.upper()}
        res = requests.get(url, headers=headers, params=params)
        if res.status_code != 200:
            raise Exception(f"BEP-20 balance check failed ({currency}): {res.text}")
        data = res.json()
        # Tatum returns {"balance": "...", "trc20": [...]} style — find the right token
        if isinstance(data, list):
            for item in data:
                if item.get("currency", "").upper() == currency.upper():
                    return float(item.get("balance", 0))
            return 0.0
        return float(data.get("balance", 0))

    elif cfg["type"] in ("erc20", "trc20"):
        # ERC-20 / TRC-20 — these DO have contractAddress in your config
        if "contract" not in cfg:
            raise Exception(f"No contract address configured for {currency}")
        url = f"{BASE_URL}/blockchain/token/balance/{cfg['chain']}"
        res = requests.post(url, json={
            "contractAddress": cfg["contract"],
            "address": address
        }, headers=headers)
        if res.status_code != 200:
            raise Exception(f"Token balance check failed ({currency}): {res.text}")
        return float(res.json().get("balance", 0))

    else:
        raise Exception(f"Unknown token type for {currency}: {cfg['type']}")
    
def get_bnb_balance(address: str) -> float:
    return get_token_balance(address, "BSC")


# =========================
# SUBSCRIPTIONS (unchanged)
# =========================
def create_address_subscription(address: str, webhook_url: str, chain: str = "BSC"):
    payload = {
        "type": "ADDRESS_TRANSACTION",
        "attr": {"address": address, "chain": chain.upper(), "url": webhook_url}
    }
    res = requests.post(f"{BASE_URL}/subscription", json=payload, headers=headers)
    return res.json()

def create_bep20_subscription(contract_address: str, webhook_url: str):
    payload = {
        "type": "CONTRACT_NOTIFICATION",
        "attr": {"chain": "BSC", "contractAddress": contract_address, "url": webhook_url}
    }
    res = requests.post(f"{BASE_URL}/subscription", json=payload, headers=headers)
    return res.json()