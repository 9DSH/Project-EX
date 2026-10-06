import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ShoppingCart,
  MessageSquare,
  Banknote,
  ArrowLeftRight,
  Landmark,
  Wifi,
  WifiOff,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Menu as MenuIcon,
  X as CloseIcon,
} from "lucide-react";
import { TOPBAR_HEIGHT } from "./AdminLayout";

const WS_BASE = "ws://localhost:8000";

const INDICATOR_CONFIG = [
  { key: "orders", icon: ShoppingCart, label: "Pending orders", toastLabel: "New order", path: "/ProductsManagement?tab=orders&status=pending#orders-panel", accent: "#f59e0b" },
  { key: "messages", icon: MessageSquare, label: "Unread messages", toastLabel: "New message", path: "/messages", accent:"#22c55e"  },
  { key: "wire_transfer", icon: Landmark, label: "Pending wire transfers", toastLabel: "New wire transfer", path: "/wire_transfer", accent:"#3b82f6" },
  { key: "withdrawals", icon: Banknote, label: "Pending withdrawals", toastLabel: "New withdrawal", path: "/withdraws", accent: "#ef4444" },
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

function IndicatorDropdown({ config, data, onNavigate, isMobile }) {
  const { icon: Icon, label, path, accent } = config;
  const count = data.count || 0;
  const items = (data.items || []).slice(0, 6);
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, right: 0 });

  // Desktop: hover opens the popover. Mobile: tap toggles it open/closed
  // (there's no hover on touch), and a tap outside closes it.
  const visible = isMobile ? open : hovered;

  // Keep the popover mounted a little longer than `visible` so it can
  // play a closing animation instead of vanishing instantly, and so the
  // opening animation's own transform values (not the browser's default)
  // are what's on screen for the very first paint — no flash at the
  // trigger's edge before it "jumps" into place.
  const [renderPanel, setRenderPanel] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimeoutRef = useRef(null);

  useEffect(() => {
    if (visible) {
      clearTimeout(closeTimeoutRef.current);
      setClosing(false);
      setRenderPanel(true);
    } else if (renderPanel) {
      setClosing(true);
      closeTimeoutRef.current = setTimeout(() => {
        setRenderPanel(false);
        setClosing(false);
      }, 180);
    }
    return () => clearTimeout(closeTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // The popover is portaled to <body> with position: fixed, positioned
  // off the trigger's real screen coordinates — this keeps it visible
  // even though the topbar row itself scrolls (overflow-x: auto) on
  // narrow screens, which would otherwise clip an absolutely-positioned
  // popover right out of view. On mobile it's centered horizontally on
  // the screen (same spot for every indicator) rather than anchored to
  // the trigger's edge; coordinates are computed BEFORE the panel first
  // paints so it opens already centered, not sliding in from the side.
  useLayoutEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 10, right: Math.max(8, window.innerWidth - rect.right) });
  }, [visible]);

  useEffect(() => {
    if (!isMobile || !open) return;
    const handleOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [isMobile, open]);

  const handleTriggerClick = () => {
    if (isMobile) {
      setOpen((o) => !o);
    } else {
      onNavigate(path);
    }
  };

  const handleItemClick = () => {
    onNavigate(path);
    if (isMobile) setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className="topbar-indicator"
      style={{ position: "relative", display: "flex", alignItems: "center" }}
      onMouseEnter={() => !isMobile && setHovered(true)}
      onMouseLeave={() => !isMobile && setHovered(false)}
    >
      <button
        ref={triggerRef}
        className="topbar-indicator-btn"
        title={label}
        onClick={handleTriggerClick}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          border: `1px solid ${count > 0 ? accent + "3a" : "rgba(255,255,255,.06)"}`,
          background: visible ? (count > 0 ? accent + "1f" : "rgba(255,255,255,.05)") : "transparent",
          cursor: "pointer",
          transition: "all .15s ease",
          flexShrink: 0,
        }}
      >
        <Icon className="topbar-indicator-icon" size={16} color={count > 0 ? accent : "#475569"} />
        {count > 0 && (
          <span
            className="topbar-indicator-badge"
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              padding: "0 3px",
              borderRadius: 8,
              background: accent,
              color: "#04070d",
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

      {renderPanel &&
        createPortal(
          <div
            className="topbar-indicator-panel"
            style={{
              position: "fixed",
              top: coords.top,
              ...(isMobile
                ? { left: "50%", transformOrigin: "70% 0%" }
                : { right: coords.right, transformOrigin: "top right" }),
              zIndex: 9999,
              background: "#0d1424",
              border: "1px solid #1f2937",
              borderRadius: 14,
              boxShadow: "0 16px 40px rgba(0,0,0,.55)",
              overflow: "hidden",
              animation: isMobile
                ? `${closing ? "popoverZoomOut" : "popoverZoomIn"} .18s cubic-bezier(.34,1.56,.64,1) forwards`
                : `${closing ? "popoverZoomOutRight" : "popoverZoomInRight"} .18s cubic-bezier(.34,1.56,.64,1) forwards`,
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
                    onClick={handleItemClick}
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
              onClick={handleItemClick}
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
          </div>,
          document.body
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
      style={{ position: "relative", display: "flex", alignItems: "center", flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        className="topbar-user-btn"
        onClick={logout}
        title="Log out"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: hovered ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${hovered ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
          color: hovered ? "#ef4444" : "#94a3b8",
          borderRadius: 10,
          cursor: "pointer",
          transition: "0.15s",
        }}
      >
        <div
          className="topbar-user-avatar"
          style={{
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
        <LogOut size={13} className="topbar-user-logout-icon" />
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
      className="topbar-toast-stack"
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
            className="topbar-toast"
            style={{
              pointerEvents: "auto",
              cursor: "pointer",
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

export default function TopBar({ pinned, isMobile, mobileMenuOpen, onToggleMenu }) {
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
        @keyframes dropOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-4px); } }
        @keyframes popoverZoomIn {
          from { opacity: 0; transform: translateX(-50%) scale(0.35); }
          to { opacity: 1; transform: translateX(-50%) scale(1); }
        }
        @keyframes popoverZoomOut {
          from { opacity: 1; transform: translateX(-50%) scale(1); }
          to { opacity: 0; transform: translateX(-50%) scale(0.35); }
        }
        @keyframes popoverZoomInRight {
          from { opacity: 0; transform: scale(0.35); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes popoverZoomOutRight {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.35); }
        }
        @keyframes toastIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

        /* ---- Responsive TopBar sizing ---- */
        .topbar-root {
          padding: 0 clamp(6px, 2vw, 10px);
          gap: clamp(6px, 2vw, 18px);
        }
        .topbar-root::-webkit-scrollbar { height: 0; }

        .topbar-toggle-btn {
          width: clamp(30px, 4.5vw, 34px);
          height: clamp(30px, 4.5vw, 34px);
          border-radius: 9px;
        }

        .topbar-logo-img {
          height: clamp(18px, 4vw, 28px);
          width: auto;
        }

        .topbar-indicators-row {
          gap: clamp(2px, 1vw, 6px);
        }
        .topbar-indicator-btn {
          width: clamp(34px, 4vw, 34px);
          height: clamp(34px, 4vw, 34px);
        }
        .topbar-indicator-icon {
          width: clamp(16px, 3vw, 16px);
          height: clamp(16px, 3vw, 16px);
        }
        .topbar-indicator-badge {
          min-width: 16px;
          height: 16px;
          font-size: 10px;
        }
        .topbar-indicator-panel {
          width: min(320px, calc(100vw - 20px));
        }

        .topbar-user-btn {
          height: clamp(30px, 4.5vw, 34px);
          padding: 0 clamp(6px, 1.5vw, 10px);
        }
        .topbar-user-avatar {
          width: 20px;
          height: 20px;
        }

        .topbar-toast-stack { }
        .topbar-toast { width: min(300px, calc(100vw - 40px)); }

        @media (max-width: 900px) {
          .topbar-balances { display: none !important; }
          .topbar-divider-balances { display: none !important; }
        }

        @media (max-width: 640px) {
          .topbar-connection-label { display: none; }
          .topbar-user-logout-icon { display: none; }
        }

        @media (max-width: 420px) {
          .topbar-divider-indicators { display: none !important; }
        }
      `}</style>

      <div
        className="topbar-root"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: TOPBAR_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          background: "linear-gradient(180deg, #0d1424 0%, #0b1220 100%)",
          borderBottom: "1px solid #1a2333",
          zIndex: 10,
          boxSizing: "border-box",
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        {/* LEFT SIDE: menu toggle + logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginRight: "auto", flexShrink: 0 }}>
          <button
            className="topbar-toggle-btn"
            onClick={onToggleMenu}
            title={isMobile ? (mobileMenuOpen ? "Close menu" : "Open menu") : pinned ? "Collapse menu" : "Expand menu"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
              color: "#94a3b8",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {isMobile ? (
              mobileMenuOpen ? <CloseIcon size={16} /> : <MenuIcon size={16} />
            ) : pinned ? (
              <PanelLeftClose size={16} />
            ) : (
              <PanelLeftOpen size={16} />
            )}
          </button>

          {/* LOGO — full natural width, no deformation */}
          <div style={{
            display: "flex",
            alignItems: "center",
            height: 34,
          }}>
            <img
              className="topbar-logo-img"
              src="./WIRES-txt-LOGO.png"
              alt="Logo"
              style={{
                display: "block",
              }}
            />
          </div>
        </div>

        {/* INDICATORS */}
        <div className="topbar-indicators-row" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          {INDICATOR_CONFIG.map((config) => (
            <IndicatorDropdown
              key={config.key}
              config={config}
              data={indicators[config.key] || EMPTY_INDICATOR}
              onNavigate={navigate}
              isMobile={isMobile}
            />
          ))}
        </div>

        <div className="topbar-divider-indicators" style={{ width: 1, height: 24, background: "#1a2333", flexShrink: 0 }} />

        {/* BALANCES — hidden below ~900px to keep everything else visible */}
        <div className="topbar-balances" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {balances.length === 0 ? (
            <span style={{ fontSize: 12, color: "#3d4d68", whiteSpace: "nowrap" }}>No balances yet</span>
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

        <div className="topbar-divider-balances" style={{ width: 1, height: 24, background: "#1a2333", flexShrink: 0 }} />

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
            flexShrink: 0,
          }}
        >
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span className="topbar-connection-label">{connected ? "Live" : "Offline"}</span>
        </div>

        {/* USER / LOGOUT — very right corner */}
        <UserMenu />
      </div>

      <ToastStack toasts={toasts} onNavigate={navigate} onDismiss={dismissToast} />
    </>
  );
}