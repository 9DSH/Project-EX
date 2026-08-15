from app.services.tatum_service import (
    transfer_native_bnb,
    get_bnb_balance
)

from app.services.key_derivation_service import derive_hot_wallet
import os

MIN_BNB_THRESHOLD = float(os.getenv("MIN_BNB_THRESHOLD", 0.002))
TOPUP_AMOUNT = float(os.getenv("HOT_WALLET_TOPUP_AMOUNT", 0.01))


# =========================
# HOT WALLET GAS ENGINE
# =========================
def ensure_hot_wallet_gas():

    hot_wallet = derive_hot_wallet()
    hot_address = hot_wallet["address"]

    try:
        # =========================
        # 1. GET REAL BNB BALANCE
        # =========================
        balance = get_bnb_balance(hot_address)

        print(f"🔥 HOT WALLET BNB BALANCE: {balance}")

        # =========================
        # 2. CHECK THRESHOLD
        # =========================
        if balance >= MIN_BNB_THRESHOLD:
            return {
                "status": "ok",
                "balance": balance
            }

        # =========================
        # 3. TOP UP FROM MASTER
        # =========================
        master_private_key = os.getenv("BSC_PRIVATE_KEY")

        if not master_private_key:
            return {
                "status": "error",
                "message": "MASTER BSC_PRIVATE_KEY missing"
            }

        print("⚠️ HOT WALLET LOW GAS → TOPPING UP...")

        tx = transfer_native_bnb(
            from_private_key=master_private_key,
            to_address=hot_address,
            amount=TOPUP_AMOUNT
        )

        return {
            "status": "topped_up",
            "tx": tx
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }