import requests
from app.core.config import TATUM_API_KEY

BASE_URL = "https://api.tatum.io/v3"

headers = {
    "x-api-key": TATUM_API_KEY,
    "Content-Type": "application/json"
}


# =========================
# GENERATE MASTER WALLET
# =========================
def generate_wallet():
    res = requests.get(
        f"{BASE_URL}/bsc/wallet",
        headers=headers
    )

    print("WALLET RESPONSE:", res.status_code, res.text)
    return res.json()


# =========================
# GENERATE ADDRESS FROM XPUB
# =========================
def generate_address(xpub, index=0):
    url = f"{BASE_URL}/bsc/address/{xpub}/{index}"

    res = requests.get(url, headers=headers)

    print("ADDRESS RESPONSE:", res.status_code, res.text)

    return res.json()