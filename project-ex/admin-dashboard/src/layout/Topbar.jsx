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
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { TOPBAR_HEIGHT } from "./AdminLayout";

const WS_BASE = "ws://localhost:8000";

const INDICATOR_CONFIG = [
  { key: "orders", icon: ShoppingCart, label: "Pending orders", toastLabel: "New order", path: "/OrdersManagement", accent: "#f59e0b" },
  { key: "messages", icon: MessageSquare, label: "Unread messages", toastLabel: "New message", path: "/messages", accent: "#3b82f6" },
  { key: "wire_transfer", icon: Landmark, label: "Pending wire transfers", toastLabel: "New wire transfer", path: "/wire_transfer", accent: "#22c55e" },
  { key: "withdrawals", icon: Wallet, label: "Pending withdrawals", toastLabel: "New withdrawal", path: "/withdraws", accent: "#ef4444" },
  { key: "exchange", icon: ArrowLeftRight, label: "Recent exchanges", toastLabel: "New exchange", path: "/exchange_dashboard", accent: "#a78bfa" },
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

function StatusChip({ status, accent }) {
  if (!status) return null;
  const colorMap = {
    pending: "#fbbf24",
    completed: "#4ade80",
    delivered: "#4ade80",
    approved: "#60a5fa",
    failed: "#f87171",
    rejected: "#f87171",
  };
  const color = colorMap[status?.toLowerCase()] || accent;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color,
        background: color + "1f",
        border: `1px solid ${color}40`,
        borderRadius: 999,
        padding: "1px 7px",
        textTransform: "uppercase",
        letterSpacing: 0.3,
        flexShrink: 0,
      }}
    >
      {status}
    </span>
  );
}

function IndicatorDropdown({ config, data, onNavigate }) {
  const { icon: Icon, label, path, accent } = config;
  const count = data.count || 0;
  const items = data.items || [];
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ position: "relative", display: "flex", alignItems: "center" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        title={label}
        onClick={() => onNavigate(path)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: 10,
          border: `1px solid ${count > 0 ? accent + "3a" : "rgba(255,255,255,.06)"}`,
          background: hovered ? (count > 0 ? accent + "1f" : "rgba(255,255,255,.05)") : "transparent",
          cursor: "pointer",
          transition: "all .15s ease",
        }}
      >
        <Icon size={16} color={count > 0 ? accent : "#475569"} />
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 16,
              height: 16,
              padding: "0 3px",
              borderRadius: 8,
              background: accent,
              color: "#04070d",
              fontSize: 10,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              boxShadow: `0 0 0 2px #0b1220`,
              animation: "pulseBadge 1.8s ease infinite",
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {hovered && (
        <div style={{ position: "absolute", top: "100%", paddingTop: 10, right: 0, zIndex: 60 }}>
          <div
            style={{
              width: 320,
              background: "#0d1424",
              border: "1px solid #1f2937",
              borderRadius: 14,
              boxShadow: "0 16px 40px rgba(0,0,0,.55)",
              overflow: "hidden",
              animation: "dropIn .14s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 14px",
                borderBottom: "1px solid #1a2333",
                background: accent + "0d",
              }}
            >
              <Icon size={13} color={accent} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{label}</span>
              {count > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: accent }}>{count} total</span>
              )}
            </div>

            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {items.length === 0 ? (
                <div style={{ padding: "22px 14px", fontSize: 12, color: "#475569", textAlign: "center" }}>
                  Nothing here right now
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onNavigate(path)}
                    style={{
                      padding: "10px 14px",
                      cursor: "pointer",
                      borderBottom: "1px solid #141d30",
                      transition: "background .12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#131c30")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: "#e2e8f0",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {item.title}
                      </span>
                      <StatusChip status={item.status} accent={accent} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.subtitle}
                      </span>
                      <span style={{ fontSize: 10.5, color: "#3d4d68", flexShrink: 0 }}>{timeAgo(item.time)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div
              onClick={() => onNavigate(path)}
              style={{
                padding: "9px 12px",
                fontSize: 11.5,
                fontWeight: 700,
                color: accent,
                cursor: "pointer",
                textAlign: "center",
                borderTop: "1px solid #1a2333",
                background: "#0a0f1c",
              }}
            >
              View all →
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const [hovered, setHovered] = useState(false);
  const rawUsername = localStorage.getItem("username") || "user";
  const role = localStorage.getItem("role") || "user";
  const username = rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1);
  const roleLabel = { master: "Master Admin", admin: "Administrator", user: "User" }[role] || role;
  const roleColor = { master: "#f59e0b", admin: "#3b82f6", user: "#64748b" }[role] || "#3b82f6";

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    localStorage.removeItem("access_points");
    localStorage.removeItem("user_id");
    window.location.reload();
  };

  return (
    <div
      style={{ position: "relative", display: "flex", alignItems: "center" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={logout}
        title="Log out"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: hovered ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${hovered ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
          color: hovered ? "#ef4444" : "#94a3b8",
          height: 34,
          padding: "0 10px",
          borderRadius: 10,
          cursor: "pointer",
          transition: "0.15s",
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            background: roleColor + "22",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <User size={11} color={roleColor} />
        </div>
        <LogOut size={13} />
      </button>

      {hovered && (
        <div style={{ position: "absolute", top: "100%", paddingTop: 10, right: 0, zIndex: 60 }}>
          <div
            style={{
              background: "#0d1424",
              border: "1px solid #1f2937",
              borderRadius: 12,
              boxShadow: "0 16px 40px rgba(0,0,0,.55)",
              padding: "12px 16px",
              minWidth: 190,
              display: "flex",
              alignItems: "center",
              gap: 12,
              whiteSpace: "nowrap",
              animation: "dropIn .14s ease",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: roleColor + "22",
                border: `1px solid ${roleColor}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <User size={16} color={roleColor} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "white" }}>{username}</div>
              <div style={{ fontSize: 11, color: roleColor, fontWeight: 700, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>
                {roleLabel}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToastStack({ toasts, onNavigate, onDismiss }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const Icon = t.icon;
        return (
          <div
            key={t.id}
            onClick={() => {
              onNavigate(t.path);
              onDismiss(t.id);
            }}
            style={{
              pointerEvents: "auto",
              cursor: "pointer",
              width: 300,
              background: "#0d1424",
              border: `1px solid ${t.accent}40`,
              borderLeft: `3px solid ${t.accent}`,
              borderRadius: 12,
              boxShadow: "0 14px 34px rgba(0,0,0,.5)",
              padding: "12px 14px",
              display: "flex",
              gap: 11,
              alignItems: "flex-start",
              animation: "toastIn .25s cubic-bezier(.4,0,.2,1)",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: t.accent + "1f",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={14} color={t.accent} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#e2e8f0" }}>{t.title}</div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "#94a3b8",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.message}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TopBar({ pinned, onToggleMenu }) {
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
  const [toasts, setToasts] = useState([]);
  const wsRef = useRef(null);
  const seenIdsRef = useRef({});
  
  const pushToast = (toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5500);
  };

  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const processIndicators = (newIndicators) => {
    INDICATOR_CONFIG.forEach((cfg) => {
      const val = newIndicators[cfg.key] || EMPTY_INDICATOR;
      const currentIds = new Set((val.items || []).map((i) => i.id));
      const prevIds = seenIdsRef.current[cfg.key];

      if (prevIds) {
        const newOnes = [...currentIds].filter((id) => !prevIds.has(id));
        if (newOnes.length === 1) {
          const item = (val.items || []).find((i) => i.id === newOnes[0]);
          pushToast({
            icon: cfg.icon,
            accent: cfg.accent,
            title: cfg.toastLabel,
            message: item ? `${item.title} — ${item.subtitle}` : "",
            path: cfg.path,
          });
        } else if (newOnes.length > 1) {
          pushToast({
            icon: cfg.icon,
            accent: cfg.accent,
            title: cfg.toastLabel,
            message: `${newOnes.length} new items`,
            path: cfg.path,
          });
        }
      }
      seenIdsRef.current[cfg.key] = currentIds;
    });
  };

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
          if (data.indicators) {
            setIndicators(data.indicators);
            processIndicators(data.indicators);
          }
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
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes pulseBadge { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        @keyframes dropIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: TOPBAR_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "0 10px",
          background: "linear-gradient(180deg, #0d1424 0%, #0b1220 100%)",
          borderBottom: "1px solid #1a2333",
          zIndex: 5,
          gap: 18,
          boxSizing: "border-box",
        }}
      >
        {/* LEFT SIDE: menu toggle + logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginRight: "auto", flexShrink: 0 }}>
          <button
            onClick={onToggleMenu}
            title={pinned ? "Collapse menu" : "Expand menu"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
              color: "#94a3b8",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {pinned ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>

          {/* LOGO — full natural width, no deformation */}
          <div style={{
            display: "flex",
            alignItems: "center",
            height: 34,          // keeps it vertically centered with the button
          }}>
            <img
              src="./WIRES-txt-LOGO.png"
              alt="Logo"
              style={{
                height: 28,       // fits nicely inside the 34px topbar height
                width: "auto",    // keeps original aspect ratio → no deformation
                display: "block",
              }}
            />
          </div>
        </div>

        {/* INDICATORS */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {INDICATOR_CONFIG.map((config) => (
            <IndicatorDropdown
              key={config.key}
              config={config}
              data={indicators[config.key] || EMPTY_INDICATOR}
              onNavigate={navigate}
            />
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: "#1a2333" }} />

        {/* BALANCES — now on the right, after indicators */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {balances.length === 0 ? (
            <span style={{ fontSize: 12, color: "#3d4d68" }}>No balances yet</span>
          ) : (
            balances.map((b, idx) => (
              <div
                key={`${b.currency}-${idx}`}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  whiteSpace: "nowrap",
                  background: "rgba(255,255,255,.03)",
                  border: "1px solid rgba(255,255,255,.06)",
                  borderRadius: 8,
                  padding: "5px 10px",
                }}
              >
                <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700 }}>{b.currency}</span>
                <span style={{ fontSize: 13, color: "white", fontWeight: 700 }}>
                  {b.available.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              </div>
            ))
          )}
        </div>

        <div style={{ width: 1, height: 24, background: "#1a2333" }} />

        {/* CONNECTION STATE */}
        <div
          title={connected ? "Live" : "Disconnected"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            color: connected ? "#22c55e" : "#ef4444",
          }}
        >
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
        </div>

        {/* USER / LOGOUT — very right corner */}
        <UserMenu />
      </div>

      <ToastStack toasts={toasts} onNavigate={navigate} onDismiss={dismissToast} />
    </>
  );
}