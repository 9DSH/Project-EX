import { useEffect, useRef, useState } from "react";
import {
    createChart,
    CrosshairMode,
    CandlestickSeries,
    PriceScaleMode,
} from "lightweight-charts";

const smartPrice = (price) =>
    Number(price).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });

export default function TradingViewCandles({
    to_symbol,
    candles,
    timeframe,
    height = 360,
}) {
    const containerRef = useRef(null);
    const chartRef     = useRef(null);
    const seriesRef    = useRef(null);
    const [tooltip, setTooltip] = useState(null); // { x, y, open, high, low, close, time }

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
                scaleMargins: { top: 0.2, bottom: 0.2 },
            },
            timeScale: {
                borderColor:    "#22334d",
                timeVisible:    timeframe !== "1d" && timeframe !== "1w",
                secondsVisible: false,
                rightOffset:    5,
                barSpacing:     12,
                minBarSpacing:  8,
            },
            localization: {
                priceFormatter: smartPrice,
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
                minMove:   0.01,
            },
        });

        // ── OHLC tooltip on crosshair move ──
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
    // ─────────────────────────────────────────────
    useEffect(() => {
        if (!seriesRef.current || !chartRef.current) return;
        if (!candles?.length) return;

        const shouldInvert = to_symbol === "USDT";

        seriesRef.current.setData(
            candles.map((c) => {
                const inv = (v) => (v && shouldInvert ? 1 / v : v);
                return {
                    time:  Math.floor(c.ts / 1000),
                    open:  inv(c.open),
                    high:  inv(shouldInvert ? c.low  : c.high),
                    low:   inv(shouldInvert ? c.high : c.low),
                    close: inv(c.close),
                };
            })
        );

        chartRef.current.priceScale("right").applyOptions({ autoScale: true });
        chartRef.current.timeScale().fitContent();
    }, [candles, to_symbol]);

    // ─────────────────────────────────────────────
    // 3. UPDATE PRICE FORMAT WHEN SYMBOL CHANGES
    // ─────────────────────────────────────────────
    useEffect(() => {
        if (!chartRef.current || !seriesRef.current) return;

        seriesRef.current.applyOptions({
            priceFormat: {
                type:      "custom",
                formatter: smartPrice,
                minMove:   0.01,
            },
        });

        chartRef.current.applyOptions({
            rightPriceScale: {
                borderColor:  "#22334d",
                visible:       true,
                minimumWidth:  80,
                scaleMargins: { top: 0.2, bottom: 0.2 },
            },
            localization: {
                priceFormatter: smartPrice,
            },
        });
    }, [to_symbol]);

    // ─────────────────────────────────────────────
    // 4. UPDATE TIMEFRAME
    // ─────────────────────────────────────────────
    useEffect(() => {
        if (!chartRef.current) return;
        chartRef.current.applyOptions({
            timeScale: {
                borderColor:    "#22334d",
                timeVisible:    timeframe !== "1d" && timeframe !== "1w",
                secondsVisible: false,
            },
        });
    }, [timeframe]);

    // ── format unix timestamp for tooltip ──
    const fmtTime = (unixSec) => {
        const d = new Date(unixSec * 1000);
        if (timeframe === "1d" || timeframe === "1w")
            return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    const isUp = tooltip && tooltip.close >= tooltip.open;

    return (
        <div ref={containerRef} style={{ width: "100%", height, position: "relative" }}>

            {/* ── OHLC Tooltip ── */}
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