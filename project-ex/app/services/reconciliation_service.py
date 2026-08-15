from app.db.database import SessionLocal
from app.models.transaction import Transaction
from app.models.user import User
from app.models.user_balance import UserBalance
from app.constants.transaction_status import PENDING, COMPLETED
from app.services.tatum_service import transfer_token          # ← updated import
from app.services.key_derivation_service import derive_hot_wallet
import os

MASTER_WALLET = os.getenv("MASTER_WALLET_ADDRESS")


def run_reconciliation(db=None):

    local_db = db or SessionLocal()
    results = []

    try:
        pending_txs = local_db.query(Transaction).filter(
            Transaction.status == PENDING
        ).all()

        hot_wallet = derive_hot_wallet()

        for tx in pending_txs:

            user = local_db.query(User).filter(
                User.user_id == tx.user_id
            ).first()

            if not user:
                continue

            try:
                tx_result = transfer_token(          # ← updated call
                    from_private_key=hot_wallet["private_key"],
                    to_address=tx.wallet_address,
                    amount=tx.amount,
                    currency="USDT_BSC"              # ← explicit, uses new resilient path
                )

                tx.status = COMPLETED
                tx.tx_hash = tx_result.get("txId")

                balance_row = local_db.query(UserBalance).filter(
                    UserBalance.user_id == user.user_id,
                    UserBalance.currency_id == tx.currency_id
                ).first()

                if balance_row:
                    balance_row.frozen_balance -= tx.amount

                results.append({"tx_id": tx.id, "status": "recovered"})

            except Exception as e:
                results.append({"tx_id": tx.id, "error": str(e)})

        local_db.commit()
        return results

    finally:
        if db is None:
            local_db.close()