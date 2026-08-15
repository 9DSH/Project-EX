from app.db.database import SessionLocal
from app.models.system_wallet import SystemWallet
from app.services.wallet_service import generate_wallet
import os

db = SessionLocal()

existing = db.query(SystemWallet).first()
if existing:
    print("⚠️ System wallet already exists. Delete it first if resetting.")
    exit()

wallet = generate_wallet()

mnemonic = wallet.get("mnemonic")
xpub = wallet.get("xpub")

if not mnemonic or not xpub:
    raise Exception("Wallet generation failed")

# 🔥 PRINT MNEMONIC (YOU MUST SAVE IT)
print("\n==============================")
print("🔥 YOUR MNEMONIC (SAVE THIS) 🔥")
print("==============================\n")
print(mnemonic)
print("\n==============================\n")

# 🔐 OPTIONAL: auto-save to .env (if you want)
env_path = "app/.env"

with open(env_path, "a") as f:
    f.write(f"\nMASTER_MNEMONIC={mnemonic}\n")

print(f"✅ Mnemonic saved to {env_path}")

# 💾 SAVE XPUB TO DB
new_wallet = SystemWallet(
    xpub=xpub,
    next_index=0
)

db.add(new_wallet)
db.commit()

print("✅ System wallet created safely")