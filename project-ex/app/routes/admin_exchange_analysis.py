"""
app/routes/admin_exchange_analysis.py

Endpoints (all under /admin/exchange/analysis):

    GET /rate-history?pair_id=&from=&to=
    GET /rate-ohlc?pair_id=&timeframe=&from=&to=
    GET /pnl?from=&to=&base_currency_symbol=
    GET /inventory?base_currency_symbol=
    GET /volume?from=&to=

Scope: master may pass admin_filter (mine / all / <user_id>); every other
admin is strictly limited to their own data (resolve_own_scope).

RATE SEMANTICS
    ExchangePair.rate / ExchangeRateHistory.*_rate / ExchangeOrder.rate are all
    stored in the DB-normalized form: "units of to_currency per 1 unit of
    from_currency" (multiplicative). Every conversion below relies on that.

TIME SEMANTICS
    - exchange_rate_history.created_at  -> timestamptz (aware)
    - exchange_orders.created_at        -> timestamp WITHOUT tz, stored as UTC
    - exchange_inventory_ledger.created_at -> timestamptz
    All datetimes here are handled as UTC; naive values are only produced
    right before querying exchange_orders.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.rls import get_db_rls
from app.core.security import get_current_user, is_admin_or_above
from app.core.permissions import has_access
from app.services.admins_scope import resolve_own_scope

from app.models.exchange_pair import ExchangePair
from app.models.exchange_order import ExchangeOrder
from app.models.currency import Currency
from app.models.exchange_analysis import ExchangeRateHistory, ExchangeInventoryLedger


router = APIRouter(prefix="/admin/exchange/analysis", tags=["Admin Exchange Analysis"])

LEDGER_BASE = "USDT"  # rate_to_base_at_trade is recorded against this

TIMEFRAME_SECONDS = {
    "30m": 30 * 60,
    "1h": 60 * 60,
    "4h": 4 * 60 * 60,
    "1d": 24 * 60 * 60,
    "1w": 7 * 24 * 60 * 60,
}

MAX_CANDLES = 2000


def get_admin(
    db: Session = Depends(get_db_rls),
    user=Depends(get_current_user),
):
    if not is_admin_or_above(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    if not has_access(user, "exchange.service", db):
        raise HTTPException(status_code=403, detail="Access denied")
    return user


# ──────────────────────────────────────────────────────────────
# TIME HELPERS
# ──────────────────────────────────────────────────────────────
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value: Optional[str], default: datetime, end_of_day: bool = False) -> datetime:
    """ISO string -> aware UTC datetime. Naive input is treated as UTC.
    A bare date ("2026-09-19") as an END bound means end of that day."""
    if not value:
        return default
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, f"Invalid date: {value}")
    if len(value) == 10 and end_of_day:
        dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_date_range(date_from: Optional[str], date_to: Optional[str]):
    now = _utcnow()
    return (
        _parse_dt(date_from, now - timedelta(days=30)),
        _parse_dt(date_to, now, end_of_day=True),
    )


def _naive_utc(dt: datetime) -> datetime:
    """For comparing against `timestamp without time zone` columns (orders)."""
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _iso_utc(dt: datetime) -> str:
    """Serialize a DB datetime (aware or naive-UTC) as an explicit-UTC ISO string."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


# ──────────────────────────────────────────────────────────────
# RATE HELPERS
# ──────────────────────────────────────────────────────────────
def _rate_between_currencies(
    db: Session, from_symbol: str, to_symbol: str, admin_id: Optional[int] = None
) -> Optional[float]:
    """
    Rate to convert 1 unit of from_symbol into to_symbol, using the active
    ExchangePair (owned by admin_id when given) in either direction.
    Returns None when no direct path exists.
    """
    if from_symbol == to_symbol:
        return 1.0

    from_cur = db.query(Currency).filter(Currency.symbol == from_symbol).first()
    to_cur = db.query(Currency).filter(Currency.symbol == to_symbol).first()
    if not from_cur or not to_cur:
        return None

    def find(f_id: int, t_id: int):
        q = db.query(ExchangePair).filter(
            ExchangePair.from_currency_id == f_id,
            ExchangePair.to_currency_id == t_id,
            ExchangePair.is_active == True,  # noqa: E712
        )
        if admin_id is not None:
            q = q.filter(ExchangePair.admin_id == admin_id)
        return q.order_by(ExchangePair.id).first()

    direct = find(from_cur.id, to_cur.id)
    if direct and direct.rate:
        return float(direct.rate)

    reverse = find(to_cur.id, from_cur.id)
    if reverse and reverse.rate:
        return 1.0 / float(reverse.rate)

    return None


class _RateCache:
    """Per-request cache of (admin_id, from, to) -> rate."""

    def __init__(self, db: Session):
        self.db = db
        self._c: dict = {}

    def get(self, admin_id, from_symbol, to_symbol):
        key = (admin_id, from_symbol, to_symbol)
        if key not in self._c:
            self._c[key] = _rate_between_currencies(self.db, from_symbol, to_symbol, admin_id)
        return self._c[key]


# ──────────────────────────────────────────────────────────────
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
    pair = db.query(ExchangePair).filter(ExchangePair.id == pair_id).first()
    if not pair:
        raise HTTPException(404, "Pair not found")

    scope_all, scope_admin_id = resolve_own_scope(admin, db, admin_filter)
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
            ExchangeOrder.created_at       >= _naive_utc(dt_from),
            ExchangeOrder.created_at       <= _naive_utc(dt_to),
        )
        .order_by(ExchangeOrder.created_at.asc())
        .all()
    )

    return {
        "pair_id": pair_id,
        "rate_points": [
            {"ts": _iso_utc(h.created_at), "rate": h.new_rate, "fee_percent": h.new_fee_percent}
            for h in history_rows
        ],
        "trade_points": [
            {"ts": _iso_utc(o.created_at), "rate": o.rate,
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
    One candle per timeframe bucket, no gaps.

        open  = rate at the start of the bucket (carried forward)
        close = last rate change inside the bucket (or open if none)
        high  = max(open, every rate change in the bucket)
        low   = min(open, every rate change in the bucket)

    NOTE: the rate only exists at the moments an admin changes it, so a
    wick (high != max(open, close) / low != min(open, close)) appears only
    when the rate changed 2+ times inside the same bucket.
    """
    if timeframe not in TIMEFRAME_SECONDS:
        raise HTTPException(
            400, f"Invalid timeframe. Must be one of: {list(TIMEFRAME_SECONDS.keys())}"
        )

    pair = db.query(ExchangePair).filter(ExchangePair.id == pair_id).first()
    if not pair:
        raise HTTPException(404, "Pair not found")

    scope_all, scope_admin_id = resolve_own_scope(admin, db, admin_filter)
    if not scope_all and pair.admin_id != scope_admin_id:
        raise HTTPException(403, "Pair not available for this scope")

    dt_from, dt_to = _parse_date_range(date_from, date_to)

    # never draw candles from before the pair existed
    if pair.created_at:
        dt_from = max(dt_from, pair.created_at.replace(tzinfo=timezone.utc))

    bucket_secs = TIMEFRAME_SECONDS[timeframe]

    def bucket_start(dt: datetime) -> int:
        epoch = int(dt.timestamp())
        return epoch - (epoch % bucket_secs)

    # ── Seed: rate in force at dt_from ────────────────────────
    seed_row = (
        db.query(ExchangeRateHistory)
        .filter(
            ExchangeRateHistory.pair_id    == pair_id,
            ExchangeRateHistory.created_at <  dt_from,
        )
        .order_by(ExchangeRateHistory.created_at.desc())
        .first()
    )
    if seed_row:
        running_rate = float(seed_row.new_rate)
    else:
        # No change before dt_from: the rate in force was the one that the
        # FIRST recorded change replaced (old_rate), not today's rate.
        first_row = (
            db.query(ExchangeRateHistory)
            .filter(ExchangeRateHistory.pair_id == pair_id)
            .order_by(ExchangeRateHistory.created_at.asc())
            .first()
        )
        if first_row is not None and first_row.old_rate is not None:
            running_rate = float(first_row.old_rate)
        else:
            running_rate = float(pair.rate)

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

    buckets_updates: dict[int, list[float]] = defaultdict(list)
    for row in history_rows:
        buckets_updates[bucket_start(row.created_at)].append(float(row.new_rate))

    start_b = bucket_start(dt_from)
    now_b   = bucket_start(_utcnow())
    end_b   = min(bucket_start(dt_to), now_b)

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
            close_rate = high_rate = low_rate = open_rate

        candles.append({
            "ts":      b * 1000,
            "open":    open_rate,
            "high":    high_rate,
            "low":     low_rate,
            "close":   close_rate,
            "updates": len(updates),
        })

        running_rate = close_rate
        b += bucket_secs

    # last candle always reflects the live pair rate
    if candles:
        live_rate = float(pair.rate)
        last = candles[-1]
        last["close"] = live_rate
        last["high"]  = max(last["high"], live_rate)
        last["low"]   = min(last["low"],  live_rate)

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


# ──────────────────────────────────────────────────────────────
# SHARED LEDGER QUERY
# ──────────────────────────────────────────────────────────────
def _ledger_query(db: Session, scope_all: bool, scope_admin_id, *cols):
    q = db.query(*cols).select_from(ExchangeInventoryLedger).join(
        ExchangeOrder, ExchangeInventoryLedger.order_id == ExchangeOrder.id
    )
    if not scope_all:
        q = q.filter(ExchangeOrder.admin_id == scope_admin_id)
    return q


# ──────────────────────────────────────────────────────────────
# P&L SERIES
# ──────────────────────────────────────────────────────────────
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
    Daily series in base_currency_symbol.

    fee_revenue    = order.fee_amount (in from_currency) valued at the rate
                     recorded when the order was traded.
    inventory_pnl  = revaluation of every inventory movement of that day:
                     delta * (rate_now - rate_at_trade). Each ledger row is
                     booked on the day it was traded, so the cumulative total
                     equals /inventory total_unrealized_pnl when the range
                     covers all history.
    """
    scope_all, scope_admin_id = resolve_own_scope(admin, db, admin_filter)
    dt_from, dt_to = _parse_date_range(date_from, date_to)
    rates = _RateCache(db)

    # ---- fee revenue -------------------------------------------------
    orders = (
        db.query(ExchangeOrder)
        .filter(
            ExchangeOrder.status == "completed",
            ExchangeOrder.created_at >= _naive_utc(dt_from),
            ExchangeOrder.created_at <= _naive_utc(dt_to),
        )
    )
    if not scope_all:
        orders = orders.filter(ExchangeOrder.admin_id == scope_admin_id)
    orders = orders.order_by(ExchangeOrder.created_at.asc()).all()

    trade_rate: dict[tuple[int, int], Optional[float]] = {}
    order_ids = [o.id for o in orders]
    for i in range(0, len(order_ids), 5000):
        chunk = order_ids[i:i + 5000]
        for oid, cid, r in (
            db.query(
                ExchangeInventoryLedger.order_id,
                ExchangeInventoryLedger.currency_id,
                ExchangeInventoryLedger.rate_to_base_at_trade,
            )
            .filter(ExchangeInventoryLedger.order_id.in_(chunk))
            .all()
        ):
            trade_rate[(oid, cid)] = r

    symbols: dict[int, str] = {}

    def symbol_for(cid: int) -> str:
        if cid not in symbols:
            cur = db.query(Currency).filter(Currency.id == cid).first()
            symbols[cid] = cur.symbol if cur else "?"
        return symbols[cid]

    fee_by_day: dict[str, float] = defaultdict(float)
    for o in orders:
        day = o.created_at.date().isoformat()
        sym = symbol_for(o.from_currency_id)
        r_ledger = trade_rate.get((o.id, o.from_currency_id))
        ledger_to_base = rates.get(o.admin_id, LEDGER_BASE, base_currency_symbol)
        if r_ledger is not None and ledger_to_base is not None:
            per_unit = float(r_ledger) * ledger_to_base
        else:
            per_unit = rates.get(o.admin_id, sym, base_currency_symbol)
            if per_unit is None:
                continue  # no conversion path: skip instead of mixing currencies
        fee_by_day[day] += float(o.fee_amount or 0.0) * per_unit

    # ---- inventory revaluation per ledger row ------------------------
    ledger_rows = (
        _ledger_query(
            db, scope_all, scope_admin_id,
            ExchangeInventoryLedger.delta,
            ExchangeInventoryLedger.currency_symbol,
            ExchangeInventoryLedger.rate_to_base_at_trade,
            ExchangeInventoryLedger.created_at,
            ExchangeOrder.admin_id,
        )
        .filter(
            ExchangeInventoryLedger.created_at >= dt_from,
            ExchangeInventoryLedger.created_at <= dt_to,
        )
        .all()
    )

    inv_by_day: dict[str, float] = defaultdict(float)
    for delta, sym, r_trade, created_at, adm in ledger_rows:
        r_now = rates.get(adm, sym, base_currency_symbol)
        ledger_to_base = rates.get(adm, LEDGER_BASE, base_currency_symbol)
        if r_now is None or ledger_to_base is None:
            continue
        value_now = float(delta) * r_now
        value_then = float(delta) * float(r_trade if r_trade is not None else 1.0) * ledger_to_base
        day = created_at.astimezone(timezone.utc).date().isoformat()
        inv_by_day[day] += value_now - value_then

    all_days = sorted(set(fee_by_day) | set(inv_by_day))

    series = []
    fee_cum = 0.0
    inv_cum = 0.0
    for day in all_days:
        fee_rev = fee_by_day.get(day, 0.0)
        inv_pnl = inv_by_day.get(day, 0.0)
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
    Net inventory per currency (all-time), valued in base_currency_symbol.

        net_balance      = sum(ledger.delta)
        cost_basis_value = sum(delta * rate_to_base_at_trade) [* USDT->base]
        current_value    = net_balance * current rate to base
        unrealized_pnl   = current_value - cost_basis_value

    Each admin's rows are valued with THAT admin's pair rates (so an
    "all admins" view never mixes different admins' rates), then summed
    per currency. Currencies with no conversion path to the base are
    flagged (conversion_warning) and excluded from values and totals.
    """
    scope_all, scope_admin_id = resolve_own_scope(admin, db, admin_filter)
    rates = _RateCache(db)

    rows = (
        _ledger_query(
            db, scope_all, scope_admin_id,
            ExchangeOrder.admin_id,
            ExchangeInventoryLedger.currency_id,
            ExchangeInventoryLedger.currency_symbol,
            func.sum(ExchangeInventoryLedger.delta).label("net_balance"),
            func.sum(
                ExchangeInventoryLedger.delta *
                func.coalesce(ExchangeInventoryLedger.rate_to_base_at_trade, 1.0)
            ).label("cost_ledger"),
        )
        .group_by(
            ExchangeOrder.admin_id,
            ExchangeInventoryLedger.currency_id,
            ExchangeInventoryLedger.currency_symbol,
        )
        .all()
    )

    positions: dict[int, dict] = {}
    for adm, cid, sym, net, cost_ledger in rows:
        net = float(net or 0.0)
        cost_ledger = float(cost_ledger or 0.0)

        raw_rate = rates.get(adm, sym, base_currency_symbol)
        ledger_to_base = rates.get(adm, LEDGER_BASE, base_currency_symbol)

        p = positions.setdefault(cid, {
            "currency_id": cid, "symbol": sym,
            "net_balance": 0.0, "cost_basis_value": 0.0, "current_value": 0.0,
            "conversion_rate_used": raw_rate, "conversion_warning": False,
        })
        p["net_balance"] += net

        if raw_rate is None or ledger_to_base is None:
            p["conversion_warning"] = True
            continue

        p["cost_basis_value"] += cost_ledger * ledger_to_base
        p["current_value"] += net * raw_rate
        p["conversion_rate_used"] = raw_rate

    results = []
    for p in positions.values():
        results.append({
            "currency_id":          p["currency_id"],
            "symbol":               p["symbol"],
            "net_balance":          round(p["net_balance"], 8),
            "cost_basis_value":     round(p["cost_basis_value"], 8),
            "current_value":        round(p["current_value"], 8),
            "unrealized_pnl":       round(p["current_value"] - p["cost_basis_value"], 8),
            "conversion_rate_used": p["conversion_rate_used"],
            "conversion_warning":   p["conversion_warning"],
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
    scope_all, scope_admin_id = resolve_own_scope(admin, db, admin_filter)
    dt_from, dt_to = _parse_date_range(date_from, date_to)

    query = db.query(
        ExchangeOrder.from_currency_id,
        ExchangeOrder.to_currency_id,
        func.count(ExchangeOrder.id).label("order_count"),
        func.sum(ExchangeOrder.from_amount).label("total_from_amount"),
        func.sum(ExchangeOrder.fee_amount).label("total_fee_amount"),
    ).filter(
        ExchangeOrder.status     == "completed",
        ExchangeOrder.created_at >= _naive_utc(dt_from),
        ExchangeOrder.created_at <= _naive_utc(dt_to),
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
        pair   = pair_query.order_by(ExchangePair.id).first()
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