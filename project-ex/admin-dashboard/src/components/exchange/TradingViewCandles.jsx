import { useEffect, useRef, useState } from "react";
import {
    createChart,
    CrosshairMode,
    CandlestickSeries,
    PriceScaleMode,
    TickMarkType,
} from "lightweight-charts";

// Adaptive precision: big rates (IRT) need 0 decimals, small rates need many.
const smartPrice = (price) => {
    const n = Number(price);
    if (!isFinite(n)) return "—";
    const a = Math.abs(n);
    const maxDigits = a >= 1000 ? 0 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
    return n.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxDigits,
    });
};

// Lightweight-charts renders the time axis in UTC by default — force local.
const tickFormatter = (time, type) => {
    const d = new Date(time * 1000);
    switch (type) {
        case TickMarkType.Year:
            return String(d.getFullYear());
        case TickMarkType.Month:
            return d.toLocaleDateString(undefined, { month: "short" });
        case TickMarkType.DayOfMonth:
            return String(d.getDate());
        default:
            return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
    }
};

const crosshairTimeFormatter = (time) =>
    new Date(time * 1000).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    });

export default function TradingViewCandles({
    invert = false,          // true when the stored rate must be shown as 1/rate (from-currency IRT)
    candles,
    timeframe,
    height = 360,
}) {
    const containerRef = useRef(null);
    const chartRef     = useRef(null);
    const seriesRef    = useRef(null);
    const fitKeyRef    = useRef(null);
    const [tooltip, setTooltip] = useState(null);

    // ─────────────────────────────────────────────
    // 1. CREATE CHART (ONLY ONCE)
    // ─────────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            width:  containerRef.current.clientWidth,
            height,
            layout: {
                background: { type: "solid", color: "transparent" },
                textColor: "#94a3b8",
            },
            grid: {
                vertLines: { color: "#18263f" },
                horzLines: { color: "#18263f" },
            },
            crosshair: { mode: CrosshairMode.Normal },
            rightPriceScale: {
                mode: PriceScaleMode.Logarithmic,
                borderColor: "#22334d",
                minimumWidth: 80,
                scaleMargins: { top: 0.2, bottom: 0.2 },
            },
            timeScale: {
                borderColor:    "#22334d",
                timeVisible:    timeframe !== "1d" && timeframe !== "1w",
                secondsVisible: false,
                rightOffset:    5,
                barSpacing:     12,
                minBarSpacing:  8,
                tickMarkFormatter: tickFormatter,
            },
            localization: {
                priceFormatter: smartPrice,
                timeFormatter:  crosshairTimeFormatter,
            },
        });

        const series = chart.addSeries(CandlestickSeries, {
            upColor:         "#26a69a",
            downColor:       "#ef5350",
            borderUpColor:   "#26a69a",
            borderDownColor: "#ef5350",
            wickUpColor:     "#26a69a",
            wickDownColor:   "#ef5350",
            priceFormat: {
                type:      "custom",
                formatter: smartPrice,
                minMove:   0.00000001,
            },
        });

        chart.subscribeCrosshairMove((param) => {
            if (
                !param ||
                !param.time ||
                param.point === undefined ||
                param.point.x < 0 ||
                param.point.y < 0
            ) {
                setTooltip(null);
                return;
            }

            const data = param.seriesData.get(series);
            if (!data) { setTooltip(null); return; }

            setTooltip({
                x:     param.point.x,
                y:     param.point.y,
                time:  param.time,
                open:  data.open,
                high:  data.high,
                low:   data.low,
                close: data.close,
            });
        });

        chartRef.current  = chart;
        seriesRef.current = series;

        const ro = new ResizeObserver((entries) => {
            const { width } = entries[0].contentRect;
            chart.applyOptions({ width });
        });
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            chart.remove();
        };
    }, []);

    // ─────────────────────────────────────────────
    // 2. UPDATE CANDLES WHEN DATA CHANGES
    //    Inverting a price flips the ordering, so the inverted high is
    //    1/low and the inverted low is 1/high.
    // ─────────────────────────────────────────────
    useEffect(() => {
        if (!seriesRef.current || !chartRef.current) return;
        if (!candles?.length) return;

        const inv = (v) => (v && invert ? 1 / v : v);

        seriesRef.current.setData(
            candles.map((c) => ({
                time:  Math.floor(c.ts / 1000),
                open:  inv(c.open),
                high:  inv(invert ? c.low  : c.high),
                low:   inv(invert ? c.high : c.low),
                close: inv(c.close),
            }))
        );

        // Only re-fit on first load / timeframe / orientation change —
        // never on periodic refreshes, so the user's zoom & scroll stay put.
        const fitKey = `${timeframe}|${invert}`;
        if (fitKeyRef.current !== fitKey) {
            chartRef.current.timeScale().fitContent();
            fitKeyRef.current = fitKey;
        }
    }, [candles, invert, timeframe]);

    // ─────────────────────────────────────────────
    // 3. UPDATE TIMEFRAME
    // ─────────────────────────────────────────────
    useEffect(() => {
        if (!chartRef.current) return;
        chartRef.current.applyOptions({
            timeScale: {
                timeVisible:    timeframe !== "1d" && timeframe !== "1w",
                secondsVisible: false,
            },
        });
    }, [timeframe]);

    const fmtTime = (unixSec) => {
        const d = new Date(unixSec * 1000);
        if (timeframe === "1d" || timeframe === "1w")
            return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    };

    const isUp = tooltip && tooltip.close >= tooltip.open;

    return (
        <div ref={containerRef} style={{ width: "100%", height, position: "relative" }}>

            {tooltip && (
                <div style={{
                    position:      "absolute",
                    top:           8,
                    left:          8,
                    pointerEvents: "none",
                    zIndex:        10,
                    background:    "rgba(7, 17, 39, 0.85)",
                    border:        `1px solid ${isUp ? "#26a69a44" : "#ef535044"}`,
                    borderRadius:  10,
                    padding:       "8px 12px",
                    fontSize:      12,
                    fontFamily:    "'JetBrains Mono', 'SF Mono', monospace",
                    color:         "#94a3b8",
                    lineHeight:    1.8,
                    backdropFilter:"blur(4px)",
                }}>
                    <div style={{ color: "#cbd5e1", fontWeight: 700, marginBottom: 4, fontSize: 11 }}>
                        {fmtTime(tooltip.time)}
                    </div>
                    <div>
                        <span style={{ color: "#64748b" }}>O </span>
                        <span style={{ color: isUp ? "#26a69a" : "#ef5350" }}>{smartPrice(tooltip.open)}</span>
                        {"  "}
                        <span style={{ color: "#64748b" }}>H </span>
                        <span style={{ color: isUp ? "#26a69a" : "#ef5350" }}>{smartPrice(tooltip.high)}</span>
                    </div>
                    <div>
                        <span style={{ color: "#64748b" }}>L </span>
                        <span style={{ color: isUp ? "#26a69a" : "#ef5350" }}>{smartPrice(tooltip.low)}</span>
                        {"  "}
                        <span style={{ color: "#64748b" }}>C </span>
                        <span style={{ color: isUp ? "#26a69a" : "#ef5350" }}>{smartPrice(tooltip.close)}</span>
                    </div>
                </div>
            )}

        </div>
    );
}