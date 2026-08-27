import { RefreshCw, Power, AlertTriangle, Settings } from "lucide-react";

function formatDate(value) {
  if (!value) return "—";
  try { return new Date(value).toLocaleString(); } catch { return "—"; }
}

function StatusDot({ running, configured }) {
  const color = running ? "#22c55e" : configured ? "#f59e0b" : "#64748b";
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", boxShadow: running ? `0 0 6px ${color}` : "none" }} />;
}

export default function BotCard({
  username,
  displayName,
  botUsername,
  role,
  isActive,
  tokenSet,
  running,
  lastRestartAt,
  lastCrashError,
  onRestart,
  onDeactivate,
  onEdit,
  showActions = false,
  showEdit = false,
  actionLoading = false,
  selected = false,
}) {
  return (
    <div style={{
      background: "#0b1424",
      border: selected ? "1px solid rgba(59,130,246,.5)" : "1px solid #313d58bc",
      borderRadius: 16,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      boxShadow: selected ? "0 0 0 1px rgba(59,130,246,.2)" : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusDot running={running} configured={tokenSet} />
            <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{displayName || username}</span>
            {role && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", background: "rgba(139,92,246,.12)", border: "1px solid rgba(139,92,246,.25)", borderRadius: 999, padding: "1px 7px" }}>
                {role.toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>
            {displayName && username && displayName !== username ? `@${username} · ` : ""}
            {botUsername ? `@${botUsername}` : tokenSet ? "Token set, not validated" : "No bot connected"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {showEdit && (
            <button
              onClick={onEdit}
              title="Edit bot & payments"
              style={{
                width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,255,255,.1)",
                background: "rgba(255,255,255,.04)", color: "#94a3b8", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Settings size={13} />
            </button>
          )}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
            background: running ? "rgba(34,197,94,.1)" : tokenSet ? "rgba(245,158,11,.1)" : "rgba(100,116,139,.1)",
            color: running ? "#4ade80" : tokenSet ? "#facc15" : "#94a3b8",
            whiteSpace: "nowrap",
          }}>
            {running ? "RUNNING" : tokenSet ? (isActive ? "CONFIGURED" : "INACTIVE") : "NOT CONNECTED"}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, color: "#64748b" }}>
        <div>Last restart<div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 2 }}>{formatDate(lastRestartAt)}</div></div>
        <div>Runtime<div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 2 }}>{running ? "Active" : "Stopped"}</div></div>
      </div>

      {lastCrashError && (
        <div style={{ background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.14)", borderRadius: 10, padding: 10, display: "flex", gap: 8 }}>
          <AlertTriangle size={13} color="#facc15" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>{lastCrashError}</span>
        </div>
      )}

      {showActions && (
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button
            onClick={onRestart}
            disabled={actionLoading || !tokenSet}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.22)",
              color: "#60a5fa", borderRadius: 8, padding: "7px 0", cursor: "pointer",
              fontWeight: 600, fontSize: 11, opacity: (!tokenSet) ? 0.5 : 1,
            }}
          >
            <RefreshCw size={12} /> {running ? "Restart" : "Start"}
          </button>
          <button
            onClick={onDeactivate}
            disabled={actionLoading || !running}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)",
              color: "#ef4444", borderRadius: 8, padding: "7px 0", cursor: "pointer",
              fontWeight: 600, fontSize: 11, opacity: (!running) ? 0.5 : 1,
            }}
          >
            <Power size={12} /> Stop
          </button>
        </div>
      )}
    </div>
  );
}