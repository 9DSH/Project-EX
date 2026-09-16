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

# =========================
# ENSURE SYSTEM WALLET EXISTS
# Called on app startup. If no SystemWallet row exists (fresh DB), generates
# one via Tatum, persists the mnemonic into .env + this process's environment,
# and stores the xpub. Without this, MASTER_MNEMONIC is never set and every
# user's wallet derivation silently no-ops (caught/logged, never raised).
# =========================
def ensure_system_wallet():
    import os
    from pathlib import Path
    from app.db.database import SessionLocal
    from app.models.system_wallet import SystemWallet

    db = SessionLocal()
    try:
        existing = db.query(SystemWallet).first()

        if existing:
            if not os.getenv("MASTER_MNEMONIC"):
                print(
                    "⚠️  SystemWallet row exists but MASTER_MNEMONIC is missing "
                    "from environment — wallet derivation, sweeps and withdrawals "
                    "will fail until it's restored in app/.env."
                )
            return

        print("🔧 No system wallet found — generating one now...")
        wallet = generate_wallet()
        mnemonic = wallet.get("mnemonic")
        xpub = wallet.get("xpub")

        if not mnemonic or not xpub:
            print("❌ System wallet auto-init failed — check TATUM_API_KEY. "
                  "Wallet generation will keep failing silently until fixed.")
            return

        env_path = Path(__file__).resolve().parent.parent / ".env"
        with open(env_path, "a") as f:
            f.write(f"\nMASTER_MNEMONIC={mnemonic}\n")

        # Make it available to this running process immediately — .env is
        # only re-read on next process start otherwise.
        os.environ["MASTER_MNEMONIC"] = mnemonic

        db.add(SystemWallet(xpub=xpub, next_index=0))
        db.commit()

        print("✅ System wallet auto-initialized on startup")
        print("🔥 SAVE THIS MNEMONIC SOMEWHERE SAFE 🔥")
        print(mnemonic)

    except Exception as e:
        print(f"❌ ensure_system_wallet failed: {e}")
    finally:
        db.close()