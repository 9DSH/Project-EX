import asyncio 
from datetime import datetime
from app.db.database import SessionLocal, set_session_master
from app.services.reconciliation_service import run_reconciliation
from app.services.sweep_service import (
    sweep_to_hot_wallet,
    sweep_hot_to_master,
    retry_failed_sweeps          # ← add this import
)
from app.services.wallet_health_engine import ensure_hot_wallet_gas


def expire_wire_transfer_orders(db):
    """Auto-expire pending wire transfer orders whose timeout has passed."""
    from app.models.wire_transfer_order import WireTransferOrder
    now = datetime.utcnow()
    expired = (
        db.query(WireTransferOrder)
        .filter(
            WireTransferOrder.status == "pending",
            WireTransferOrder.expires_at <= now,
        )
        .all()
    )
    count = 0
    for order in expired:
        order.status = "expired"
        count += 1
    if count:
        db.commit()
    return count


async def sweep_worker_loop():

    while True:
        db = SessionLocal()
        set_session_master(db) 
        try:
            print("🔄 Sweep cycle started")

            # =========================
            # 0. GAS HEALTH CHECK
            # =========================
            gas_status = ensure_hot_wallet_gas()

            if not gas_status or gas_status.get("status") != "ok":
                print("❌ HOT WALLET GAS NOT READY → SKIPPING SWEEP CYCLE")
                await asyncio.sleep(60)
                continue

            # =========================
            # 1. USER → HOT WALLET
            # =========================
            result1 = sweep_to_hot_wallet(db)
            print("USER → HOT:", result1)

            # =========================
            # 2. HOT → MASTER WALLET
            # =========================
            result2 = sweep_hot_to_master()
            print("HOT → MASTER:", result2)

            # =========================
            # 3. RECONCILIATION
            # =========================
            recon = run_reconciliation(db)
            print("RECONCILIATION:", recon)

            # =========================
            # 4. RETRY FAILED SWEEPS   ← new
            # =========================
            retries = retry_failed_sweeps(db)
            if retries:
                print("🔄 SWEEP RETRIES:", retries)

            # =========================
            # 5. EXPIRE WIRE ORDERS
            # =========================
            expired_count = expire_wire_transfer_orders(db)
            if expired_count:
                print(f"⏰ WIRE ORDERS EXPIRED: {expired_count}")

        except Exception as e:
            print("❌ SWEEP ERROR:", str(e))

        finally:
            db.close()

        await asyncio.sleep(60)