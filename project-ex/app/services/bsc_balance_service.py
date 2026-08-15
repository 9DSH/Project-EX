import requests
from app.core.config import TATUM_API_KEY

BASE_URL = "https://api.tatum.io/v3"

headers = {
    "x-api-key": TATUM_API_KEY
}


# =========================
# GET BNB BALANCE
# =========================
def get_bnb_balance(address: str):
    url = f"{BASE_URL}/bsc/account/balance/{address}"

    res = requests.get(url, headers=headers)

    if res.status_code != 200:
        raise Exception(res.text)

    data = res.json()

    return float(data.get("balance", 0))


# =========================
# GET USDT (BEP20) BALANCE
# =========================
def get_usdt_balance(address: str):
    """
    USDT contract balance (BEP20)
    """

    url = f"{BASE_URL}/blockchain/token/balance/BSC"
    payload = {
        "contractAddress": "0x55d398326f99059ff775485246999027b3197955",
        "address": address
    }
    res = requests.post(url, json=payload, headers=headers)

    if res.status_code != 200:
        raise Exception(res.text)

    data = res.json()

    return float(data.get("balance", 0))