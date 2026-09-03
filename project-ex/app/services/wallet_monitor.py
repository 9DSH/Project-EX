import os
import requests
from app.services.key_derivation_service import derive_hot_wallet
from app.services.tatum_service import get_token_balance, to_tatum_symbol, get_native_tatum_symbol
from app.db.database import SessionLocal
from app.models.currency_network import CurrencyNetwork

TATUM_API_KEY = os.getenv("TATUM_API_KEY")
BASE_URL = "https://api.tatum.io/v3"

HEADERS = {
    "x-api-key": TATUM_API_KEY
}

MASTER_WALLET_ADDRESS = os.getenv("MASTER_WALLET_ADDRESS")


# =========================================================
#  GENERIC BNB BALANCE
# =========================================================
def get_bnb_balance(address: str):
    url = f"{BASE_URL}/blockchain/balance/BSC/{address}"

    res = requests.get(url, headers=HEADERS)

    if res.status_code != 200:
        return 0

    try:
        return float(res.json().get("balance", 0))
    except:
        return 0


# =========================================================
#  USDT BALANCE (BEP20)
# =========================================================
def get_usdt_balance(address: str):
    contract = "0x55d398326f99059ff775485246999027b3197955"

    url = f"{BASE_URL}/blockchain/token/balance/BSC"

    payload = {
        "contractAddress": contract,
        "address": address
    }

    res = requests.post(url, json=payload, headers=HEADERS)

    if res.status_code != 200:
        return 0

    try:
        return float(res.json().get("balance", 0))
    except:
        return 0


# =========================================================
#  HOT WALLET STATUS (OPERATIONAL LAYER)
# =========================================================
def get_hot_wallet_status():
    hot = derive_hot_wallet()
    address = hot["address"]

    balances = _get_configured_asset_balances(address)

    return {
        "address": address,
        "balances": balances,
        "usdt_balance": get_usdt_balance(address),
        "bnb_balance": get_bnb_balance(address)
    }


# =========================================================
#  MASTER WALLET STATUS (TREASURY LAYER)
# =========================================================
def get_master_wallet_status():
    if not MASTER_WALLET_ADDRESS:
        return {
            "address": None,
            "balances": [],
            "usdt_balance": 0,
            "bnb_balance": 0
        }

    balances = _get_configured_asset_balances(MASTER_WALLET_ADDRESS)

    return {
        "address": MASTER_WALLET_ADDRESS,
        "balances": balances,
        "usdt_balance": get_usdt_balance(MASTER_WALLET_ADDRESS),
        "bnb_balance": get_bnb_balance(MASTER_WALLET_ADDRESS)
    }


# =========================================================
#  FULL SYSTEM WALLET OVERVIEW (FOR DASHBOARD)
# =========================================================
def get_wallet_status():
    hot = get_hot_wallet_status()
    master = get_master_wallet_status()

    return {
        "hot_wallet": hot,
        "master_wallet": master
    }


def _get_configured_asset_balances(address: str):
    db = SessionLocal()
    try:
        pairs = (
            db.query(CurrencyNetwork)
            .filter(CurrencyNetwork.is_active == True)
            .all()
        )

        results = []
        seen = set()

        for pair in pairs:
            if not pair.currency or not pair.network:
                continue
            if not pair.currency.is_active or not pair.network.is_active:
                continue
            if pair.currency.type != "crypto":
                continue

            symbol = pair.currency.symbol.upper()
            chain = pair.network.chain.upper()
            key = (symbol, chain)
            if key in seen:
                continue
            seen.add(key)

            tatum_symbol = to_tatum_symbol(symbol, chain)
            try:
                balance = get_token_balance(address, tatum_symbol)
                balance_error = None
            except Exception as exc:
                balance = 0
                balance_error = str(exc)
            results.append({
                "currency": symbol,
                "network": chain,
                "tatum_symbol": tatum_symbol,
                "balance": balance,
                "error": balance_error,
            })

            native_symbol = get_native_tatum_symbol(chain)
            native_key = (native_symbol, chain)
            if native_key in seen:
                continue
            seen.add(native_key)

            try:
                gas_balance = get_token_balance(address, native_symbol)
                gas_error = None
            except Exception as exc:
                gas_balance = 0
                gas_error = str(exc)
            results.append({
                "currency": native_symbol,
                "network": chain,
                "tatum_symbol": native_symbol,
                "balance": gas_balance,
                "error": gas_error,
            })

        return results
    finally:
        db.close()