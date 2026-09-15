"""
New router: app/routers/admin_exchange_analysis.py


Endpoints (all under /admin/exchange/analysis, same auth as your existing
admin exchange router):

    GET /admin/exchange/analysis/rate-history?pair_id=&from=&to=
    GET /admin/exchange/analysis/rate-ohlc?pair_id=&timeframe=&from=&to=
    GET /admin/exchange/analysis/pnl?from=&to=&base_currency_symbol=
    GET /admin/exchange/analysis/inventory?base_currency_symbol=
    GET /admin/exchange/analysis/volume?from=&to=

All of the above also accept an optional `admin_filter` query param:
  - omitted / "mine" -> scoped to the requesting user's own admin_id
  - "all"            -> platform-wide, across every admin (requires
                         can_view_all_admins — master or
                         platform.service.management)
  - "<user_id>"       -> scoped to that specific admin (same permission
                         requirement)

IMPORTANT: ExchangeOrder has NO pair_id column — only from_currency_id /
to_currency_id. So "orders for a pair" = orders matching that pair's
(from_currency_id, to_currency_id).
"""

from datetime import datetime, timedelta
from typing import Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.rls import get_db_rls
from app.core.security import get_current_user, is_admin_or_above, is_master
from app.core.permissions import has_access
from app.services.exchange_scope import resolve_admin_scope

from app.models.exchange_pair import ExchangePair
from app.models.exchange_order import ExchangeOrder
from app.models.currency import Currency
from app.models.exchange_analysis import ExchangeRateHistory, ExchangeInventoryLedger


router = APIRouter(prefix="/admin/exchange/analysis", tags=["Admin Exchange Analysis"])


# Supported candlestick timeframes -> bucket size in seconds
TIMEFRAME_SECONDS = {
    "30m": 30 * 60,
    "1h": 60 * 60,
    "4h": 4 * 60 * 60,
    "1d": 24 * 60 * 60,
    "1w": 7 * 24 * 60 * 60,
}

# Safety cap: never return more than this many candles in one response.
# At 30m tf over 1Y that is ~17 500 candles — cap keeps payload reasonable.
MAX_CANDLES = 2000

def get_admin(user=Depends(get_current_user)):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    if not has_access(user, "exchange.service"):
        raise HTTPException(status_code=403, detail="Access denied")
    return user


def _parse_date_range(date_from: Optional[str], date_to: Optional[str]):
    dt_from = datetime.fromisoformat(date_from) if date_from else datetime.utcnow() - timedelta(days=30)
    dt_to = datetime.fromisoformat(date_to) if date_to else datetime.utcnow()
    return dt_from, dt_to


def _rate_between_currencies(
    db: Session, from_symbol: str, to_symbol: str
) -> Optional[float]:
    """
    Returns the rate to convert 1 unit of `from_symbol` into `to_symbol`,
    using the active ExchangePair in either direction.

    - If a direct pair from_symbol -> to_symbol exists, returns its rate.
    - Else if a direct pair to_symbol -> from_symbol exists, returns 1/rate.
    - Else returns None (no direct conversion path).

    This generalizes to any currency pair, not just IRT/USDT, as long as a
    direct active pair exists in one direction.
    """


    if from_symbol == to_symbol:
        return 1.0

    from_cur = db.query(Currency).filter(Currency.symbol == from_symbol).first()
    to_cur = db.query(Currency).filter(Currency.symbol == to_symbol).first()
    if not from_cur or not to_cur:
        return None

    direct = (
        db.query(ExchangePair)
        .filter(
            ExchangePair.from_currency_id == from_cur.id,
            ExchangePair.to_currency_id == to_cur.id,
            ExchangePair.is_active == True,  # noqa: E712
        )
        .first()
    )
    if direct:
        return direct.rate

    reverse = (
        db.query(ExchangePair)
        .filter(
            ExchangePair.from_currency_id == to_cur.id,
            ExchangePair.to_currency_id == from_cur.id,
            ExchangePair.is_active == True,  # noqa: E712
        )
        .first()
    )
    if reverse and reverse.rate:

        return 1.0 / reverse.rate

    return None
 #──────────────────────────────────────────────────────────────
# RATE HISTORY (raw points)
# ──────────────────────────────────────────────────────────────
@router.get("/rate-history")
def get_rate_history(
    pair_id:   int           = Query(...),
    date_from: Optional[str] = Query(None, alias="from"),
    date_to:   Optional[str] = Query(None, alias="to"),
    admin_filter: Optional[str] = Query(None),
    db:    Session = Depends(get_db_rls),
    admin = Depends(get_admin),
):
    if not has_access(admin, "exchange.service"):
        raise HTTPException(403, "Access denied")

    pair = db.query(ExchangePair).filter(ExchangePair.id == pair_id).first()
    if not pair:
        raise HTTPException(404, "Pair not found")

    scope_all, scope_admin_id = resolve_admin_scope(admin, db, admin_filter)
    if not scope_all and pair.admin_id != scope_admin_id:
        raise HTTPException(403, "Pair not available for this scope")

    dt_from, dt_to = _parse_date_range(date_from, date_to)

    history_rows = (
        db.query(ExchangeRateHistory)
        .filter(
            ExchangeRateHistory.pair_id    == pair_id,
            ExchangeRateHistory.created_at >= dt_from,
            ExchangeRateHistory.created_at <= dt_to,
        )
        .order_by(ExchangeRateHistory.created_at.asc())
        .all()
    )

    order_rows = (
        db.query(ExchangeOrder)
        .filter(
            ExchangeOrder.from_currency_id == pair.from_currency_id,
            ExchangeOrder.to_currency_id   == pair.to_currency_id,
            ExchangeOrder.admin_id         == pair.admin_id,
            ExchangeOrder.status           == "completed",
            ExchangeOrder.created_at       >= dt_from,
            ExchangeOrder.created_at       <= dt_to,
        )
        .order_by(ExchangeOrder.created_at.asc())
        .all()
    )
    
    return {
        "pair_id": pair_id,
        "rate_points": [
            {"ts": h.created_at.isoformat(), "rate": h.new_rate, "fee_percent": h.new_fee_percent}
            for h in history_rows
        ],
        "trade_points": [
            {"ts": o.created_at.isoformat(), "rate": o.rate,
             "from_amount": float(o.from_amount), "to_amount": float(o.to_amount), "order_id": o.id}
            for o in order_rows
        ],
    }


# ──────────────────────────────────────────────────────────────
# OHLC CANDLESTICKS
# ──────────────────────────────────────────────────────────────
@router.get("/rate-ohlc")
def get_rate_ohlc(
    pair_id:   int           = Query(...),
    timeframe: str           = Query("1h"),
    date_from: Optional[str] = Query(None, alias="from"),
    date_to:   Optional[str] = Query(None, alias="to"),
    admin_filter: Optional[str] = Query(None),
    db:    Session = Depends(get_db_rls),
    admin = Depends(get_admin),
):
    """
    Returns OHLC candlesticks for EVERY timeframe bucket in [dt_from, dt_to],
    including the current live bucket.
 
    KEY BEHAVIOUR (changed from previous version):
    - Every single bucket between start and end is now emitted — no gaps.
    - Buckets with no rate updates carry the last known rate forward so
      open == high == low == close (a "doji" flat candle) instead of being
      skipped, which was causing empty spaces in the chart.
    - The `updates` field tells the frontend how many rate changes happened
      in that bucket (0 = flat carry-forward candle).
    - A safety cap of MAX_CANDLES is applied: if the requested range/timeframe
      combination would produce more candles than the cap, the response is
      truncated from the left (oldest candles dropped) and a `truncated` flag
      is set to true so the frontend can show a notice if desired.
 
    OHLC construction per bucket:
        open  = running_rate at the START of the bucket (carried forward)
        close = last new_rate update IN the bucket  (or open if no updates)
        high  = max(open, all updates in bucket)
        low   = min(open, all updates in bucket)
    """
    if not has_access(admin, "exchange.service"):
        raise HTTPException(403, "Access denied")
 
    if timeframe not in TIMEFRAME_SECONDS:
        raise HTTPException(
            400,
            f"Invalid timeframe. Must be one of: {list(TIMEFRAME_SECONDS.keys())}",
        )
 
    pair = db.query(ExchangePair).filter(ExchangePair.id == pair_id).first()
    if not pair:
        raise HTTPException(404, "Pair not found")

    scope_all, scope_admin_id = resolve_admin_scope(admin, db, admin_filter)
    if not scope_all and pair.admin_id != scope_admin_id:
        raise HTTPException(403, "Pair not available for this scope")
 
    dt_from, dt_to = _parse_date_range(date_from, date_to)
    bucket_secs    = TIMEFRAME_SECONDS[timeframe]
 
    def bucket_start(dt: datetime) -> int:
        epoch = int(dt.timestamp())
        return epoch - (epoch % bucket_secs)
 
    # ── Seed: last known rate BEFORE dt_from ──────────────────
    seed_row = (
        db.query(ExchangeRateHistory)
        .filter(
            ExchangeRateHistory.pair_id    == pair_id,
            ExchangeRateHistory.created_at <  dt_from,
        )
        .order_by(ExchangeRateHistory.created_at.desc())
        .first()
    )
    # Fall back to the pair's current rate if no history exists before dt_from
    running_rate = float(seed_row.new_rate if seed_row else pair.rate)
 
    # ── All rate updates inside [dt_from, dt_to] ──────────────
    history_rows = (
        db.query(ExchangeRateHistory)
        .filter(
            ExchangeRateHistory.pair_id    == pair_id,
            ExchangeRateHistory.created_at >= dt_from,
            ExchangeRateHistory.created_at <= dt_to,
        )
        .order_by(ExchangeRateHistory.created_at.asc())
        .all()
    )
 
    # Group update values by bucket epoch
    buckets_updates: dict[int, list[float]] = defaultdict(list)
    for row in history_rows:
        buckets_updates[bucket_start(row.created_at)].append(float(row.new_rate))
 
    # ── Walk EVERY bucket from start to now ───────────────────
    start_b  = bucket_start(dt_from)
    now_b    = bucket_start(datetime.utcnow())
    # end_b is the bucket that contains dt_to, but never beyond now
    end_b    = min(bucket_start(dt_to), now_b)
 
    candles: list[dict] = []
 
    b = start_b
    while b <= end_b:
        updates   = buckets_updates.get(b, [])
        open_rate = running_rate
 
        if updates:
            close_rate = updates[-1]
            high_rate  = max(open_rate, *updates)
            low_rate   = min(open_rate, *updates)
        else:
            # Flat carry-forward candle — same price in all four fields
            close_rate = open_rate
            high_rate  = open_rate
            low_rate   = open_rate
 
        candles.append({
            "ts":      b * 1000,        # milliseconds for JS Date()
            "open":    open_rate,
            "high":    high_rate,
            "low":     low_rate,
            "close":   close_rate,
            "updates": len(updates),    # 0 = flat/carry-forward candle
        })
 
        running_rate = close_rate
        b += bucket_secs
 
    # ── Patch the very last candle to reflect the live pair rate ──
    # In case no update has happened in the current bucket yet, the close
    # should still show the pair's actual current rate (not stale history).
    if candles:
        live_rate = float(pair.rate)
        last      = candles[-1]
        if last["updates"] == 0:
            last["close"] = live_rate
            last["high"]  = max(last["high"],  live_rate)
            last["low"]   = min(last["low"],   live_rate)
 
    # ── Safety cap ────────────────────────────────────────────
    truncated = False
    if len(candles) > MAX_CANDLES:
        candles   = candles[-MAX_CANDLES:]
        truncated = True
 
    return {
        "pair_id":   pair_id,
        "timeframe": timeframe,
        "candles":   candles,
        "truncated": truncated,
        "total":     len(candles),
    }
 


@router.get("/pnl")
def get_pnl_series(
    date_from: Optional[str] = Query(None, alias="from"),
    date_to: Optional[str] = Query(None, alias="to"),
    base_currency_symbol: str = Query("USDT"),
    admin_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db_rls),
    admin=Depends(get_admin),
):
    """
    Daily series: fee revenue (realized), converted into base_currency_symbol
    per-order using the CURRENT rate between the order's to_currency and
    base_currency_symbol (a simplification - ideally we'd use the rate AT
    THE TIME of the order, but that requires per-order rate snapshots which
    aren't stored; current-rate conversion is a reasonable approximation for
    a 2-currency system where rates don't change drastically day to day).

    inventory_pnl is a placeholder for now - see /inventory for point-in-time
    unrealized P&L, and README for how to extend this to a full daily
    mark-to-market series.
    """
    if not has_access(admin, "exchange.service"):
        raise HTTPException(403, "Access denied")

    scope_all, scope_admin_id = resolve_admin_scope(admin, db, admin_filter)

    dt_from, dt_to = _parse_date_range(date_from, date_to)

    query = db.query(ExchangeOrder).filter(
        ExchangeOrder.status == "completed",
        ExchangeOrder.created_at >= dt_from,
        ExchangeOrder.created_at <= dt_to,
    )
    if not scope_all:
        query = query.filter(ExchangeOrder.admin_id == scope_admin_id)

    orders = query.order_by(ExchangeOrder.created_at.asc()).all()

    # Cache currency_id -> symbol lookups
    currency_symbols: dict[int, str] = {}

    def symbol_for(cid: int) -> str:
        if cid not in currency_symbols:
            cur = db.query(Currency).filter(Currency.id == cid).first()
            currency_symbols[cid] = cur.symbol if cur else "?"
        return currency_symbols[cid]

    # Cache conversion rates: (from_symbol) -> rate to base_currency_symbol
    rate_cache: dict[str, float] = {}

    def to_base_rate(symbol: str) -> float:
        if symbol not in rate_cache:
            r = _rate_between_currencies(db, symbol, base_currency_symbol)
            rate_cache[symbol] = r if r is not None else 1.0
        return rate_cache[symbol]



    fee_by_day: dict[str, float] = {}
    for o in orders:
        day = o.created_at.date().isoformat()
        fee_currency_symbol = symbol_for(o.from_currency_id)  # fee_amount is in from_currency units
        fee_in_base = float(o.fee_amount or 0.0) * to_base_rate(fee_currency_symbol)
        before_total = fee_by_day.get(day, 0.0)
        fee_by_day[day] = before_total + fee_in_base


   # ─────────────────────────────────────────────
    # 2. INVENTORY (FIXED: real unrealized PnL)
    # ─────────────────────────────────────────────
    inv = get_inventory_snapshot(
        base_currency_symbol=base_currency_symbol,
        admin_filter=admin_filter,
        db=db,
        admin=admin,
    )

    total_unrealized = inv["total_unrealized_pnl"]

    # distribute inventory PnL ONLY at last day (minimal safe fix)
    inventory_pnl_by_day = {}

    if fee_by_day:
        last_day = sorted(fee_by_day.keys())[-1]
        inventory_pnl_by_day[last_day] = total_unrealized

    all_days = sorted(set(fee_by_day.keys()) | set(inventory_pnl_by_day.keys()))

    series = []
    fee_cum = 0.0
    inv_cum = 0.0
    for day in all_days:
        fee_rev = fee_by_day.get(day, 0.0)
        inv_pnl = inventory_pnl_by_day.get(day, 0.0)
        fee_cum += fee_rev
        inv_cum += inv_pnl
        series.append({
            "date": day,
            "fee_revenue": round(fee_rev, 8),
            "fee_revenue_cumulative": round(fee_cum, 8),
            "inventory_pnl": round(inv_pnl, 8),
            "inventory_pnl_cumulative": round(inv_cum, 8),
            "total_pnl_cumulative": round(fee_cum + inv_cum, 8),
        })



    return {"base_currency": base_currency_symbol, "series": series}


# ──────────────────────────────────────────────────────────────
# INVENTORY SNAPSHOT
# ──────────────────────────────────────────────────────────────
@router.get("/inventory")
def get_inventory_snapshot(
    base_currency_symbol: str = Query("USDT"),
    admin_filter: Optional[str] = Query(None),
    db:    Session = Depends(get_db_rls),
    admin = Depends(get_admin),
):
    """
    Net inventory per currency with mark-to-market value and unrealized P&L,
    all converted into base_currency_symbol using CURRENT rates.
    Switching base from USDT to IRT (or any other currency) will correctly
    re-value every position using the active pair rate in either direction.
    """
    if not has_access(admin, "exchange.service"):
        raise HTTPException(403, "Access denied")

    scope_all, scope_admin_id = resolve_admin_scope(admin, db, admin_filter)

    LEDGER_BASE = "USDT"  # rate_to_base_at_trade was recorded against this

    rows_query = (
        db.query(
            ExchangeInventoryLedger.currency_id,
            ExchangeInventoryLedger.currency_symbol,
            func.sum(ExchangeInventoryLedger.delta).label("net_balance"),
            func.sum(
                ExchangeInventoryLedger.delta *
                func.coalesce(ExchangeInventoryLedger.rate_to_base_at_trade, 1.0)
            ).label("cost_basis_in_ledger_base"),
        )
    )

    if not scope_all:
        rows_query = (
            rows_query
            .join(ExchangeOrder, ExchangeInventoryLedger.order_id == ExchangeOrder.id)
            .filter(ExchangeOrder.admin_id == scope_admin_id)
        )

    rows = (
        rows_query
        .group_by(ExchangeInventoryLedger.currency_id, ExchangeInventoryLedger.currency_symbol)
        .all()
    )

    # Factor to convert LEDGER_BASE -> requested base_currency_symbol
    ledger_to_base = _rate_between_currencies(db, LEDGER_BASE, base_currency_symbol) or 1.0

    results = []
    for r in rows:
        net_balance      = r.net_balance or 0.0
        cost_basis_value = (r.cost_basis_in_ledger_base or 0.0) * ledger_to_base

        raw_rate         = _rate_between_currencies(db, r.currency_symbol, base_currency_symbol)
        conversion_warn  = raw_rate is None
        current_rate     = raw_rate if raw_rate is not None else 1.0
        current_value    = net_balance * current_rate

        results.append({
            "currency_id":          r.currency_id,
            "symbol":               r.currency_symbol,
            "net_balance":          round(net_balance,      8),
            "cost_basis_value":     round(cost_basis_value, 8),
            "current_value":        round(current_value,    8),
            "unrealized_pnl":       round(current_value - cost_basis_value, 8),
            "conversion_rate_used": current_rate,
            "conversion_warning":   conversion_warn,
        })
    return {
        "base_currency":        base_currency_symbol,
        "positions":            results,
        "total_unrealized_pnl": round(sum(r["unrealized_pnl"] for r in results), 8),
    }


# ──────────────────────────────────────────────────────────────
# VOLUME BY PAIR
# ──────────────────────────────────────────────────────────────
@router.get("/volume")
def get_volume_by_pair(
    date_from: Optional[str] = Query(None, alias="from"),
    date_to:   Optional[str] = Query(None, alias="to"),
    admin_filter: Optional[str] = Query(None),
    db:    Session = Depends(get_db_rls),
    admin = Depends(get_admin),
):
    if not has_access(admin, "exchange.service"):
        raise HTTPException(403, "Access denied")

    scope_all, scope_admin_id = resolve_admin_scope(admin, db, admin_filter)

    dt_from, dt_to = _parse_date_range(date_from, date_to)

    query = db.query(
            ExchangeOrder.from_currency_id,
            ExchangeOrder.to_currency_id,
            func.count(ExchangeOrder.id).label("order_count"),
            func.sum(ExchangeOrder.from_amount).label("total_from_amount"),
            func.sum(ExchangeOrder.fee_amount).label("total_fee_amount"),
        ).filter(
            ExchangeOrder.status     == "completed",
            ExchangeOrder.created_at >= dt_from,
            ExchangeOrder.created_at <= dt_to,
        )

    if not scope_all:
        query = query.filter(ExchangeOrder.admin_id == scope_admin_id)

    rows = query.group_by(ExchangeOrder.from_currency_id, ExchangeOrder.to_currency_id).all()

    results = []
    for r in rows:
        pair_query = db.query(ExchangePair).filter(
            ExchangePair.from_currency_id == r.from_currency_id,
            ExchangePair.to_currency_id   == r.to_currency_id,
        )
        if not scope_all:
            pair_query = pair_query.filter(ExchangePair.admin_id == scope_admin_id)
        pair    = pair_query.first()
        from_c = db.query(Currency).filter(Currency.id == r.from_currency_id).first()
        to_c   = db.query(Currency).filter(Currency.id == r.to_currency_id).first()
        results.append({
            "pair_id":           pair.id if pair else None,
            "from_currency_id":  r.from_currency_id,
            "to_currency_id":    r.to_currency_id,
            "from_symbol":       from_c.symbol if from_c else "—",
            "to_symbol":         to_c.symbol   if to_c   else "—",
            "order_count":       r.order_count,
            "total_from_amount": round(float(r.total_from_amount or 0), 8),
            "total_fee_amount":  round(float(r.total_fee_amount  or 0), 8),
        })

    return {"from": dt_from.isoformat(), "to": dt_to.isoformat(), "pairs": results}