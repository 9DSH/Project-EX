import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";

import TradingViewCandles from "./TradingViewCandles";
import { TrendingUp, TrendingDown, DollarSign, Layers, Activity, RefreshCcw, AlertTriangle } from "lucide-react";

const API = "http://127.0.0.1:8000";
const api = axios.create({ baseURL: API });

const fmt = (n, d = 4) =>
  n != null
    ? Number(n).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: d,
      })
    : "—";

const fmtDateShort = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";



const C = {
  panelBorder: "#1c2840",
  grid:        "#141f33",
  axis:        "#4b5b78",
  text:        "#e6ecf6",
  textDim:     "#3e5a82",
  blue:        "#3b82f6",
  darkBlue:     "rgba(59,130,246,.13)",
  bull:        "#26a69a",
  bear:        "#ef5350",
  amber:       "#f0b429",
  purple:      "#a78bfa",
};

const T = {
  panel: {
    background:   "linear-gradient(180deg, #0b1220 0%, rgba(13, 19, 26, 0.66) 100%)",
    border:       `1px solid ${C.panelBorder}`,
    borderRadius: 8,
    padding:      18,
  },
  filterInput: {
    background:   "#0b1220",
    border:       "1px solid #1f2937",
    borderRadius: 10,
    padding:      "7px 12px",
    color:        "white",
    minWidth:     100,
    fontSize:     12,
    fontWeight:   600,
  },
  emptyState: {
    textAlign:   "center",
    color:       "#303b4dff",
    padding:     "40px 0",
    letterSpacing: 1,
    fontSize:    14,
    fontWeight:  600,
  },
  mono: { fontFamily: "'JetBrains Mono','SF Mono','Roboto Mono',monospace" },
};

const S = {
  refreshBtn: {
    display:      "flex",
    alignItems:   "center",
    background:   "transparent",
    border:       "1px solid #313d58ff",
    borderRadius: 10,
    padding:      "8px 14px",
    color:        "#6c798dff",
    cursor:       "pointer",
    fontWeight:   600,
    fontSize:     13,
  },
};

const TIMEFRAMES = [
  { key: "30m", label: "30m" },
  { key: "1h",  label: "1H"  },
  { key: "4h",  label: "4H"  },
  { key: "1d",  label: "1D"  },
  { key: "1w",  label: "1W"  },
];

const RANGE_OPTIONS = [
  { key: "1",   label: "1D" },
  { key: "7",   label: "1W" },
  { key: "30",  label: "1M" },
  { key: "90",  label: "3M" },
  { key: "365", label: "1Y" },
];

const tooltipStyle = {
  background:   "#0a1322",
  border:       `1px solid ${C.panelBorder}`,
  borderRadius: 12,
  fontSize:     12,
  color:        C.text,
  boxShadow:    "0 8px 24px rgba(0,0,0,0.4)",
  padding:      "10px 12px",
};

// ── UI primitives ─────────────────────────────────────────────

function SegmentedControl({ options, value, onChange }) {
  return (
    <div style={{
      display:      "flex",
      background:   "#070d1c",
      border:       `1px solid ${C.panelBorder}`,
      borderRadius: 8,
      padding:      3,
      gap:          2,
    }}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              border:       active ?  `1px solid ${C.blue}` : "none",
              borderRadius: 8,
              padding:      "5px 11px",
              fontSize:     11,
              fontWeight:   700,
              cursor:       "pointer",
              letterSpacing: 0.3,
              background:   active ? C.darkBlue : "transparent",
              color:        active ? "#b7b7b7" : C.textDim,
              transition:   "all 0.15s",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent, loading }) {
  return (
    <div style={{
      ...T.panel,
      display:    "flex",
      alignItems: "center",
      gap:        14,
      padding:    "10px",
      position:   "relative",
      overflow:   "hidden",
    }}>
      <div style={{
        position:   "absolute", buttom: 30, left: -30,
        width: 90, height: 90, borderRadius: "50%",
        background: `radial-gradient(circle, ${accent}22 -50%, transparent 70%)`,
      }} />
      <div style={{
        width: 42, height: 42, borderRadius: 8,
        background: accent + "16",
        border:     `1px solid ${accent}30`,
        color:      accent,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, zIndex: 1,
      }}>
        <Icon size={19} />
      </div>
      <div style={{ minWidth: 0, zIndex: 1 }}>
        <div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: 0.8, marginBottom: 4, textTransform: "uppercase" }}>
          {label}
        </div>
        {loading
          ? <div style={{ width: 90, height: 22, borderRadius: 6, background: "#151f30" }} />
          : <div style={{ ...T.mono, fontSize: 19, fontWeight: 700, color: C.text, letterSpacing: -0.3 }}>{value ?? "—"}</div>
        }
        {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, height = 280 }) {
  return (
    <div style={T.panel}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 14, letterSpacing: -0.2 }}>{title}</div>
        {subtitle && <div style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{subtitle}</div>}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}


// ── Main export ───────────────────────────────────────────────

export default function AnalysisTab({ pairs, headers, adminFilter = "mine" }) {
  const [selectedPairId, setSelectedPairId] = useState(null);
  const [range,          setRange]          = useState("30");
  const [timeframe,      setTimeframe]      = useState("4h");
  const [baseCurrency,   setBaseCurrency]   = useState("USDT");

  const [ohlc,      setOhlc]      = useState({ candles: [], truncated: false, total: 0 });
  const [pnlSeries, setPnlSeries] = useState([]);
  const [inventory, setInventory] = useState({ positions: [], total_unrealized_pnl: 0 });
  const [volume,    setVolume]    = useState([]);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    setSelectedPairId((cur) =>
      pairs?.some((p) => p.id === cur) ? cur : (pairs?.length ? pairs[0].id : null)
    );
  }, [pairs]);

  const baseCurrencyOptions = useMemo(() => {
    const s = new Set();
    (pairs || []).forEach((p) => {
      if (p.from_currency?.symbol) s.add(p.from_currency.symbol);
      if (p.to_currency?.symbol)   s.add(p.to_currency.symbol);
    });
    if (!s.size) s.add("USDT");
    return Array.from(s);
  }, [pairs]);

  const loadAnalysis = useCallback(async () => {
    if (!selectedPairId) return;
    setLoading(true);

    // computed on every call so "to" is always NOW (never stale)
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - Number(range));
    const dateRange = { from: from.toISOString(), to: to.toISOString() };

    try {
      const [ohlcRes, pnlRes, invRes, volRes] = await Promise.all([
        api.get("/admin/exchange/analysis/rate-ohlc", {
          headers,
          params: { pair_id: selectedPairId, timeframe, from: dateRange.from, to: dateRange.to, admin_filter: adminFilter },
        }),
        api.get("/admin/exchange/analysis/pnl", {
          headers,
          params: { from: dateRange.from, to: dateRange.to, base_currency_symbol: baseCurrency, admin_filter: adminFilter },
        }),
        api.get("/admin/exchange/analysis/inventory", {
          headers,
          params: { base_currency_symbol: baseCurrency, admin_filter: adminFilter },
        }),
        api.get("/admin/exchange/analysis/volume", {
          headers,
          params: { from: dateRange.from, to: dateRange.to, admin_filter: adminFilter },
        }),
      ]);
      setOhlc(ohlcRes.data     || { candles: [], truncated: false, total: 0 });
      setPnlSeries(pnlRes.data?.series    || []);
      setInventory(invRes.data            || { positions: [], total_unrealized_pnl: 0 });
      setVolume(volRes.data?.pairs        || []);
    } catch {
      /* keep last good data on screen */
    }
    setLoading(false);
  }, [selectedPairId, timeframe, range, baseCurrency, headers?.Authorization, adminFilter]);

  useEffect(() => { loadAnalysis(); }, [loadAnalysis]);

  // live refresh every 30s
  useEffect(() => {
    const t = setInterval(loadAnalysis, 30000);
    return () => clearInterval(t);
  }, [loadAnalysis]);

  // Map candles to { index, ts, open, high, low, close, updates }
  // No padding needed — backend now sends every bucket.
  const candleData = useMemo(() =>
    (ohlc.candles || []).map((c, i) => ({
      index:   i,
      ts:      c.ts,          // already in ms from backend
      open:    c.open,
      high:    c.high,
      low:     c.low,
      close:   c.close,
      updates: c.updates,     // 0 = flat carry-forward candle
    }))
  , [ohlc]);
  
  const latestCandle = candleData.length ? candleData[candleData.length - 1] : null;
  const firstCandle  = candleData.length ? candleData[0]                      : null;
  const currentCandleChange =
    latestCandle
        ? ((latestCandle.close - latestCandle.open) /
            latestCandle.open) * 100
        : null;
  const latestFee      = pnlSeries.length ? pnlSeries[pnlSeries.length - 1].fee_revenue_cumulative  : 0;
  const latestTotalPnl = pnlSeries.length ? pnlSeries[pnlSeries.length - 1].total_pnl_cumulative    : 0;
  const totalUnrealized = inventory.total_unrealized_pnl || 0;
  const hasWarn         = (inventory.positions || []).some((p) => p.conversion_warning);
  const selectedPair    = pairs?.find((p) => p.id === selectedPairId);

  const baseNetBalance = useMemo(() => {
    const pos = (inventory.positions || []).find((p) => p.symbol === baseCurrency);
    return pos?.net_balance || 0;
  }, [inventory, baseCurrency]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Top controls ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
        <span style={{ color: C.textDim, fontSize: 11, fontWeight: 700 }}>Base Currency</span>
        <select value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)} style={T.filterInput}>
          {baseCurrencyOptions.map((sym) => <option key={sym} value={sym}>{sym}</option>)}
        </select>
        <div style={{ width: 1, height: 20, background: C.panelBorder, margin: "0 4px" }} />
        <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
        <button onClick={loadAnalysis} disabled={loading} style={S.refreshBtn}>
          <RefreshCcw size={13} style={{ marginRight: 6, opacity: loading ? 0.5 : 1 }} />
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {!pairs?.length ? (
        <div style={T.emptyState}>No pairs available for this scope yet.</div>
      ) : (
      <>

      {/* ── Truncation notice ── */}
      {ohlc.truncated && (
        <div style={{
          background:   "rgba(59,130,246,0.07)",
          border:       "1px solid rgba(59,130,246,0.2)",
          color:        "#93c5fd",
          borderRadius: 12,
          padding:      "9px 14px",
          fontSize:     12,
          fontWeight:   600,
          display:      "flex",
          alignItems:   "center",
          gap:          8,
        }}>
          <AlertTriangle size={13} />
          Showing the most recent 2,000 candles. Narrow the date range or switch to a larger timeframe to see earlier data.
        </div>
      )}

      {/* ── Conversion warning ── */}
      {hasWarn && (
        <div style={{
          background:   "rgba(240,180,41,0.08)",
          border:       `1px solid ${C.amber}33`,
          color:        C.amber,
          borderRadius: 12,
          padding:      "10px 14px",
          fontSize:     12,
          fontWeight:   600,
        }}>
          No direct exchange pair found to convert one or more currencies into {baseCurrency}. Those positions are shown unconverted.
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))", gap: 12 }}>
        <StatCard
          icon={DollarSign} label="Fee Revenue"
          value={`${fmt(latestFee, 2)}`}
          sub={`over selected range in ${baseCurrency}`}
          accent={C.bull} loading={loading}
        />
        <StatCard
          icon={totalUnrealized >= 0 ? TrendingUp : TrendingDown}
          label="Unrealized Inventory P&L"
          value={`${totalUnrealized >= 0 ? "+" : ""}${fmt(totalUnrealized, 2)}`}
          sub={`MTM vs cost basis in ${baseCurrency}`}
          accent={totalUnrealized >= 0 ? C.bull : C.bear} loading={loading}
        />
        <StatCard
          icon={Activity} label="Net P&L"
          value={`${latestTotalPnl >= 0 ? "+" : ""}${fmt(latestTotalPnl, 2)}`}
          sub={`fees + inventory in ${baseCurrency}`}
          accent={latestTotalPnl >= 0 ? C.blue : C.bear} loading={loading}
        />
        <StatCard
          icon={Layers}
          label={`Net Balance`}
          value={`${fmt(baseNetBalance, 2)}`}
          sub={`ledger balance in ${baseCurrency}`}
          accent={C.purple} loading={loading}
        />
      </div>

      {/* ── Candlestick chart ── */}
      <div style={T.panel}>
        <div style={{
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "flex-start",
          marginBottom: 14, 
          flexWrap: "wrap", 
          gap: 12,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>
                {selectedPair
                  ? `${selectedPair.from_currency?.symbol} / ${selectedPair.to_currency?.symbol}`
                  : "Rate History"}
              </span>
              <select
                value={selectedPairId || ""}
                onChange={(e) => setSelectedPairId(Number(e.target.value))}
                style={{ ...T.filterInput, padding: "4px 10px", fontSize: 11 }}
              >
                {pairs?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.from_currency?.symbol} → {p.to_currency?.symbol}{p.admin_username ? ` (${p.admin_username})` : ""}
                  </option>
                ))}
              </select>
            </div>
        {latestCandle && (() => {
          const shouldInvert = selectedPair?.from_currency?.symbol === "IRT";
          const displayClose = shouldInvert ? 1 / latestCandle.close : latestCandle.close;
          const displayOpen  = shouldInvert ? 1 / latestCandle.open  : latestCandle.open;
          const change = ((displayClose - displayOpen) / displayOpen) * 100;

          return (
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
              <span style={{ ...T.mono, fontSize: 24, fontWeight: 800, color: C.text }}>
                {fmt(displayClose, 2)}
              </span>
              {change != null && (
                <span style={{
                  ...T.mono, fontSize: 13, fontWeight: 700,
                  color:      change >= 0 ? C.bull : C.bear,
                  background: (change >= 0 ? C.bull : C.bear) + "18",
                  padding: "2px 8px", borderRadius: 6,
                }}>
                  {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                </span>
              )}
              <span style={{ fontSize: 11, color: C.textDim }}>
                {ohlc.total} candles
              </span>
            </div>
          );
        })()}
          </div>
          <SegmentedControl options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
        </div>

        {candleData.length > 0 ? (
        <TradingViewCandles
            key={selectedPairId}
            invert={selectedPair?.from_currency?.symbol === "IRT"}
            candles={candleData}
            timeframe={timeframe}
            height={360}
        />
        ) : (
          <div style={{
            ...T.emptyState, height: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {loading
              ? "Loading…"
              : "No rate history for this period. Change the pair rate at least once to start tracking."}
          </div>
        )}
      </div>

      {/* ── Inventory ── */}
      <ChartCard
        title="Net Inventory"
        subtitle={`Current value and unrealized P&L per currency, in ${baseCurrency}`}
        height={Math.max(180, (inventory.positions?.length || 1) * 70)}
      >
        <BarChart
          data={inventory.positions}
          layout="vertical"
          margin={{ top: 6, right: 24, left: 8, bottom: 0 }}
        >
          <CartesianGrid stroke={C.grid} strokeDasharray="2 6" horizontal={false} />
          <XAxis type="number" stroke={C.axis} fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v, 2)} />
          <YAxis dataKey="symbol" type="category" stroke={C.axis} fontSize={12} fontWeight={700} width={64} axisLine={false} tickLine={false} />
          <Tooltip 
          contentStyle={tooltipStyle} 
          formatter={(v, n) => [fmt(v, 4), n]} 
            wrapperStyle={{ outline: "none" }}
  cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <ReferenceLine x={0} stroke={C.panelBorder} />
          <Bar dataKey="current_value"  name="Current Value"  fill={C.blue}  radius={[0,6,6,0]} barSize={18} cursor={false} />
          <Bar dataKey="unrealized_pnl" name="Unrealized P&L" fill={C.amber} radius={[0,6,6,0]} barSize={18} cursor={false}/>
        </BarChart>
      </ChartCard>
      {!inventory.positions?.length && !loading && (
        <div style={T.emptyState}>No inventory positions yet</div>
      )}

      {/* ── P&L + Volume grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        <ChartCard
          title="Cumulative P&L"
          subtitle={`Fee revenue and inventory mark-to-market, valued in ${baseCurrency}`}
          height={300}
        >
          <AreaChart data={pnlSeries} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={C.bull}   stopOpacity={0.35} />
                <stop offset="100%" stopColor={C.bull}   stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={C.purple} stopOpacity={0.3}  />
                <stop offset="100%" stopColor={C.purple} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.grid} strokeDasharray="2 6" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDateShort} stroke={C.axis} fontSize={11} minTickGap={40} axisLine={{ stroke: C.panelBorder }} tickLine={false} />
            <YAxis stroke={C.axis} fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v, 2)} />
            <Tooltip 
            contentStyle={tooltipStyle} 
            wrapperStyle={{ outline: "none" }}
            cursor={{ fill: "rgba(255,255,255,0.04)" }} 
            labelFormatter={fmtDateShort} 
            formatter={(v, n) => [fmt(v, 4), n]} 
            />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
            <ReferenceLine y={0} stroke={C.panelBorder} />
            <Area type="monotone" dataKey="fee_revenue_cumulative"   name="Fee Revenue"   stroke={C.bull}   fill="url(#feeGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="inventory_pnl_cumulative" name="Inventory P&L" stroke={C.purple} fill="url(#invGrad)" strokeWidth={2} />
            <Line type="monotone" dataKey="total_pnl_cumulative"     name="Total P&L"     stroke={C.blue}   strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ChartCard>

        <ChartCard
          title="Volume by Pair"
          subtitle="Total traded amount and fee revenue, selected period"
          height={260}
        >
          <BarChart
            data={volume.map((v) => ({ ...v, pairLabel: `${v.from_symbol} → ${v.to_symbol}` }))}
            margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke={C.grid} strokeDasharray="2 6" vertical={false} />
            <XAxis dataKey="pairLabel" stroke={C.axis} fontSize={11} axisLine={{ stroke: C.panelBorder }} tickLine={false} />
            <YAxis stroke={C.axis} fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v, 2)} />
           <Tooltip
              contentStyle={tooltipStyle}
              wrapperStyle={{ outline: "none" }}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              formatter={(v, n) => [fmt(v, 4), n]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
            <Bar dataKey="total_from_amount" name="Volume"      fill={C.blue} radius={[6,6,0,0]} />
            <Bar dataKey="total_fee_amount"  name="Fee Revenue" fill={C.bull} radius={[6,6,0,0]} />
          </BarChart>
        </ChartCard>

        {!volume?.length && !loading && (
          <div style={T.emptyState}>No completed orders in this period</div>
        )}
      </div>
      </>
      )}

    </div>
  );
}