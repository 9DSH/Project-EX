import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  MessageSquare,
  Wallet,
  ArrowLeftRight,
  Landmark,
  Wifi,
  WifiOff,
} from "lucide-react";

const WS_BASE = "ws://localhost:8000";

const INDICATOR_CONFIG = [
  { key: "orders", icon: ShoppingCart, label: "New orders", path: "/OrdersManagement" },
  { key: "messages", icon: MessageSquare, label: "New messages", path: "/messages" },
  { key: "exchange", icon: ArrowLeftRight, label: "New exchange", path: "/exchange_dashboard" },
  { key: "wire_transfer", icon: Landmark, label: "New wire transfers", path: "/wire_transfer" },
  { key: "withdrawals", icon: Wallet, label: "New withdrawals", path: "/withdraws" },
];

const EMPTY_INDICATOR = { count: 0, items: [] };

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function IndicatorDropdown({ config, data, onNavigate }) {
  const { icon: Icon, label, path } = config;
  const count = data.count || 0;
  const items = data.items || [];
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ position: "relative", display: "flex", alignItems: "center" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        title={label}
        onClick={() => onNavigate(path)}
        style={{ position: "relative", display: "flex", alignItems: "center", cursor: "pointer" }}
      >
        <Icon size={17} color={count > 0 ? "#e2e8f0" : "#475569"} />
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -7,
              right: -8,
              minWidth: 15,
              height: 15,
              padding: "0 3px",
              borderRadius: 8,
              background: "#dc2626",
              color: "white",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>

      {hovered && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 260,
            background: "#0f172a",
            border: "1px solid #1f2937",
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: "#94a3b8",
              borderBottom: "1px solid #1f2937",
            }}
          >
            {label}
          </div>

          <div style={{ maxHeight: 190, overflowY: "auto" }}>
            {items.length === 0 ? (
              <div style={{ padding: "14px 12px", fontSize: 12, color: "#475569" }}>
                Nothing pending
              </div>
            ) : (
              items.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  onClick={() => onNavigate(path)}
                  style={{
                    padding: "9px 12px",
                    fontSize: 12,
                    color: "#e2e8f0",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    borderBottom: "1px solid #1a2333",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#161f33")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.label}
                  </span>
                  <span style={{ color: "#64748b", flexShrink: 0 }}>{timeAgo(item.time)}</span>
                </div>
              ))
            )}
          </div>

          <div
            onClick={() => onNavigate(path)}
            style={{
              padding: "9px 12px",
              fontSize: 12,
              fontWeight: 500,
              color: "#60a5fa",
              cursor: "pointer",
              textAlign: "center",
              borderTop: "1px solid #1f2937",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#161f33")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Show more
          </div>
        </div>
      )}
    </div>
  );
}

export default function TopBar() {
  const navigate = useNavigate();
  const [balances, setBalances] = useState([]);
  const [indicators, setIndicators] = useState({
    orders: EMPTY_INDICATOR,
    messages: EMPTY_INDICATOR,
    withdrawals: EMPTY_INDICATOR,
    exchange: EMPTY_INDICATOR,
    wire_transfer: EMPTY_INDICATOR,
  });
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const adminId = localStorage.getItem("user_id");
    if (!adminId) return;

    let cancelled = false;
    let retryTimer = null;
    let currentWs = null;

    const connect = () => {
      const ws = new WebSocket(`${WS_BASE}/ws/admin/stats?admin_id=${adminId}`);
      currentWs = ws;
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        setConnected(true);
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(event.data);
          if (data.admin_balances) setBalances(data.admin_balances);
          if (data.indicators) setIndicators(data.indicators);
        } catch (e) {
          console.error("TopBar: bad ws payload", e);
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        retryTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        if (ws.readyState === WebSocket.OPEN) ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      const ws = currentWs;
      if (!ws) return;
      // Avoid the "closed before connection established" console warning:
      // if it's still connecting, close it silently once it opens instead
      // of closing mid-handshake.
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        height: 48,
        padding: "0 16px",
        background: "#0b1220",
        borderBottom: "1px solid #1f2937",
        flexShrink: 0,
        gap: 22,
      }}
    >
      {/* BALANCES */}
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {balances.length === 0 ? (
          <span style={{ fontSize: 12, color: "#475569" }}>No balances yet</span>
        ) : (
          balances.map((b) => (
            <div
              key={b.currency}
              style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}
            >
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                {b.currency}
              </span>
              <span style={{ fontSize: 13, color: "white", fontWeight: 600 }}>
                {b.available.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            </div>
          ))
        )}
      </div>

      {/* INDICATORS */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {INDICATOR_CONFIG.map((config) => (
          <IndicatorDropdown
            key={config.key}
            config={config}
            data={indicators[config.key] || EMPTY_INDICATOR}
            onNavigate={navigate}
          />
        ))}
      </div>

      {/* CONNECTION STATE */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {connected ? <Wifi size={14} color="#22c55e" /> : <WifiOff size={14} color="#ef4444" />}
      </div>
    </div>
  );
}