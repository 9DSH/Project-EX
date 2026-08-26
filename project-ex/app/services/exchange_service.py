# exchange_service.py

from sqlalchemy.orm import Session
from sqlalchemy import and_
from fastapi import HTTPException

from app.models.user_balance import UserBalance
from app.models.currency import Currency
from app.models.network import Network
from app.models.currency_network import CurrencyNetwork
from app.models.exchange_pair import ExchangePair
from app.models.exchange_order import ExchangeOrder
from app.models.transaction import Transaction
from app.services.sweep_service import sweep_specific_amount
from app.services.exchange_analysis_service import log_inventory_for_order
from app.models.user import User
from decimal import Decimal, getcontext
from app.constants.transaction_types import EXCHANGE_COMMISSION, EXCHANGE_IN,EXCHANGE_OUT
from app.constants.transaction_status import COMPLETED, FAILED, FROZEN, REJECTED

getcontext().prec = 28

def normalize_db_rate(rate: float, from_symbol: str) -> float:
    if from_symbol == "IRT" and rate > 0:
        return 1 / rate
    return rate



def execute_exchange(
    db: Session,
    user_id: int,
    from_currency_symbol: str,
    to_currency_symbol: str,
    amount: float,
    admin_id: int | None = None,
    from_network_id: int = None,
    to_network_id: int = None,
    custom_rate: float | None = None
):
    # =========================
    # VALIDATION
    # =========================

    amount = Decimal(str(amount))
    if amount <= 0:
        raise HTTPException(400, "Invalid amount")

    if from_currency_symbol.upper() == to_currency_symbol.upper():
        raise HTTPException(400, "Cannot exchange same currency")

    # =========================
    # GET CURRENCIES
    # =========================
    from_currency = db.query(Currency).filter(
        Currency.symbol == from_currency_symbol.upper()
    ).first()

    to_currency = db.query(Currency).filter(
        Currency.symbol == to_currency_symbol.upper()
    ).first()

    if not from_currency or not to_currency:
        raise HTTPException(404, "Currency not found")

    # =========================
    # GET NETWORKS
    # =========================
    # =========================
    # GET DEFAULT NETWORK IF NOT PROVIDED
    # =========================

    def get_default_network(currency_id: int):
        cn = db.query(CurrencyNetwork).filter(
            CurrencyNetwork.currency_id == currency_id,
            CurrencyNetwork.is_active == True
        ).first()

        if not cn:
            return None
        return cn.network


    # from_network fallback
    from_network = None
    if from_network_id:
        from_network = db.query(Network).filter(Network.id == from_network_id).first()

    if not from_network:
        from_network = get_default_network(from_currency.id)

    if not from_network:
        raise HTTPException(404, f"No network available for {from_currency.symbol}")


    # to_network fallback
    to_network = None
    if to_network_id:
        to_network = db.query(Network).filter(Network.id == to_network_id).first()

    if not to_network:
        to_network = get_default_network(to_currency.id)

    if not to_network:
        raise HTTPException(404, f"No network available for {to_currency.symbol}")

    # =========================
    # GET ACTIVE PAIR
    # =========================
    pair_query = db.query(ExchangePair).filter(
        and_(
            ExchangePair.from_currency_id == from_currency.id,
            ExchangePair.to_currency_id == to_currency.id,
            ExchangePair.is_active == True
        )
    )

    if admin_id is not None:
        pair_query = pair_query.filter(ExchangePair.admin_id == admin_id)

    pair = pair_query.first()

    if not pair:
        raise HTTPException(400, "Exchange pair not available")

    # Cross-tenant guardrail: the acting admin_id (if given) must own the pair.
    if admin_id is not None and pair.admin_id != admin_id:
        raise HTTPException(403, "Pair not available for this account")

    # =========================
    # GET USER FROM BALANCE
    # =========================
    from_balance = db.query(UserBalance).filter(
        and_(
            UserBalance.user_id == user_id,
            UserBalance.currency_id == from_currency.id,
            UserBalance.network_id == from_network.id
        )
    ).with_for_update().first()

    if not from_balance:
        raise HTTPException(400, f"No {from_currency.symbol} balance")

    if from_balance.available_balance < amount:
        missing = amount - Decimal(str(from_balance.available_balance))
        return {
            "success": False,
            "error": "INSUFFICIENT_BALANCE",
            "currency": from_currency.symbol,
            "current_balance": float(from_balance.available_balance),
            "required_amount": float(amount),
            "missing_amount": float(missing),
        }

    # =========================
    # SELECT RATE
    # =========================
    if custom_rate is not None: 
        normalized_custom_rate = normalize_db_rate(custom_rate, from_currency.symbol)
        
        selected_rate = normalized_custom_rate
    else: selected_rate = pair.rate

    
    if selected_rate <= 0:
        raise HTTPException(400, "Invalid exchange rate")

    # =========================
    # CALCULATIONS
    # =========================
    rate = Decimal(str(selected_rate))

    fee_percent = Decimal(str(pair.fee_percent))
  
    fee_amount = (amount * fee_percent) / Decimal("100")

    gross_amount = amount - fee_amount

    converted_amount = gross_amount * rate


    # =========================
    # GET / CREATE TARGET BALANCE (USER)
    # =========================
    to_balance = db.query(UserBalance).filter(
        and_(
            UserBalance.user_id == user_id,
            UserBalance.currency_id == to_currency.id,
            UserBalance.network_id == to_network.id
        )
    ).with_for_update().first()

    if not to_balance:
        to_balance = UserBalance(
            user_id=user_id,
            currency_id=to_currency.id,
            network_id=to_network.id,
            available_balance=0,
            frozen_balance=0
        )
        db.add(to_balance)
        db.flush()

    # -------------------------
    # MASTER BALANCE FETCH (for fee, in TO currency + TO network)
    # -------------------------
    master_user = db.query(User).filter(User.role == "master").first()

    if not master_user:
        raise HTTPException(500, "Master user not found")

    from_master_balance = db.query(UserBalance).filter(
        and_(
            UserBalance.user_id == master_user.user_id,
            UserBalance.currency_id == from_currency.id,
            UserBalance.network_id == from_network.id
        )
    ).with_for_update().first()

    if not from_master_balance:
        from_master_balance = UserBalance(
            user_id=master_user.user_id,
            currency_id=from_currency.id,
            network_id=from_network.id,
            available_balance=0,
            frozen_balance=0
        )
        db.add(from_master_balance)
        db.flush()

    # =========================
    # MOVE BALANCES
    # =========================
    from_balance.available_balance = (
        Decimal(str(from_balance.available_balance)) - amount
            )

    to_balance.available_balance = (
            Decimal(str(to_balance.available_balance)) + converted_amount
        )
    
     # =========================
    # MOVE Commission to Master balance
    # =========================

    from_master_balance.available_balance = (
            Decimal(str(from_master_balance.available_balance)) + fee_amount
        )



    # =========================
    # CREATE EXCHANGE ORDER
    # =========================
    exchange_order = ExchangeOrder(
        user_id=user_id,
        from_currency_id=from_currency.id,
        to_currency_id=to_currency.id,
        from_amount=amount,
        to_amount=converted_amount ,
        rate=selected_rate,
        fee_percent=pair.fee_percent,
        fee_amount=fee_amount,
        admin_id=pair.admin_id,
        status="completed"
    )
    db.add(exchange_order)
    db.flush()

    # =========================
    # ANALYSIS: RECORD INVENTORY LEDGER
    # =========================
    exchange_order.from_currency = from_currency
    exchange_order.to_currency = to_currency
    log_inventory_for_order(db, exchange_order)

    # =========================
    # CREATE LEDGER TRANSACTIONS FOR USER
    # =========================
    db.add(Transaction(
        user_id=user_id,
        currency_id=from_currency.id,
        network_id=from_network.id,
        amount=-amount,
        type=EXCHANGE_OUT,
        status=COMPLETED
    ))
    db.add(Transaction(
        user_id=user_id,
        currency_id=to_currency.id,
        network_id=to_network.id,
        amount=converted_amount ,
        type=EXCHANGE_IN,
        status=COMPLETED
    ))

    # =========================
    # CREATE LEDGER TRANSACTION FOR MASTER (fee, TO currency + TO network)
    # =========================
    db.add(Transaction(
        user_id=master_user.user_id,
        currency_id=to_currency.id,
        network_id=to_network.id,
        amount=fee_amount,
        type=EXCHANGE_COMMISSION,
        status=COMPLETED
    ))

    # =========================
    # COMMIT FIRST — sweep is non-blocking
    # =========================
    db.commit()
    db.refresh(exchange_order)

    # =========================
    # ON-CHAIN SWEEP (post-commit, never blocks the exchange)
    # =========================
    sweep_result = sweep_specific_amount(
        db=db,
        user_id=user_id,
        amount=float(amount),
        currency_symbol=from_currency_symbol,
        network=from_network.chain,
        reason=f"exchange_{from_currency_symbol.lower()}_to_{to_currency_symbol.lower()}",
        exchange_order_id=exchange_order.id,
    )

    sweep_ok = sweep_result.get("status") == "success"

    if not sweep_ok:
        print(f"⚠️ Sweep failed post-exchange order #{exchange_order.id}: "
              f"{sweep_result.get('error')}")

    return {
        "success": True,
        "order_id": exchange_order.id,
        "from_currency": from_currency.symbol,
        "to_currency": to_currency.symbol,
        "from_network": from_network.chain,
        "to_network": to_network.chain,
        "from_amount": amount,
        "rate": selected_rate,
        "fee_amount": fee_amount,
        "received_amount": converted_amount ,
        "sweep_status": "ok" if sweep_ok else "failed",
        "sweep_error": None if sweep_ok else sweep_result.get("error"),
    }

#============================================
# Exchange Rate
#================================================
def get_exchange_rate(
    db: Session,
    from_currency_symbol: str,
    to_currency_symbol: str,
    admin_id: int | None = None,
    custom_rate: float | None = None,
    amount: float | None = None  
):
    from_currency = db.query(Currency).filter(
        Currency.symbol == from_currency_symbol.upper()
    ).first()

    to_currency = db.query(Currency).filter(
        Currency.symbol == to_currency_symbol.upper()
    ).first()

    if not from_currency or not to_currency:
        raise HTTPException(404, "Currency not found")

    pair_query = db.query(ExchangePair).filter(
        ExchangePair.from_currency_id == from_currency.id,
        ExchangePair.to_currency_id == to_currency.id,
        ExchangePair.is_active == True
    )

    if admin_id is not None:
        pair_query = pair_query.filter(ExchangePair.admin_id == admin_id)

    pair = pair_query.first()

    if not pair:
        raise HTTPException(400, "Pair not available")

    if admin_id is not None and pair.admin_id != admin_id:
        raise HTTPException(403, "Pair not available for this account")

    selected_rate = custom_rate if custom_rate is not None else pair.rate

    if not selected_rate or selected_rate <= 0:
        raise HTTPException(400, "Invalid rate")

    exchange_rate = normalize_db_rate(
            selected_rate,
            from_currency.symbol
        )

    return {
        "from_currency": from_currency.symbol,
        "to_currency": to_currency.symbol,
        "rate": exchange_rate,
        "base_rate": pair.rate,
        "using_custom_rate": custom_rate is not None,
        "fee_percent": pair.fee_percent,
    }