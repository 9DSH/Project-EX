import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000";

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function StatusBadge({ running, configured }) {
  if (running) {
    return (
      <span style={styles.statusBadgeRunning}>
        <span style={styles.statusDot} />
        Running
      </span>
    );
  }

  if (configured) {
    return (
      <span style={styles.statusBadgeConfigured}>
        <span style={styles.statusDot} />
        Configured
      </span>
    );
  }

  return (
    <span style={styles.statusBadgeOffline}>
      <span style={styles.statusDot} />
      Not connected
    </span>
  );
}

function BotCard({
  type,
  label,
  description,
  tokenInput,
  setTokenInput,
  tokenSet,
  tokenMasked,
  username,
  validatedAt,
  validationError,
  running,
  lastRestartAt,
  lastCrashError,
  saving,
  onConnect,
  onClearInput,
}) {
  const hasToken = tokenSet;
  const isMain = type === "main";

  return (
    <div style={styles.card}>

      {/* HEADER */}
      <div style={styles.cardHeader}>

        <div style={styles.botIdentity}>

          <div
            style={{
              ...styles.botIcon,
              ...(isMain
                ? styles.mainBotIcon
                : styles.supportBotIcon),
            }}
          >
            {isMain ? "M" : "S"}
          </div>

          <div>
            <div style={styles.botTitle}>
              {label}
            </div>

            <div style={styles.botDescription}>
              {description}
            </div>
          </div>

        </div>

        <StatusBadge
          running={running}
          configured={hasToken}
        />

      </div>

      {/* BOT USERNAME */}
      {username && (
        <div style={styles.usernameRow}>
          <span style={styles.usernameIcon}>@</span>
          <strong>{username}</strong>
        </div>
      )}

      {/* TOKEN */}
      <div style={styles.section}>

        <div style={styles.sectionLabel}>
          Bot Token
        </div>

        <div style={styles.tokenRow}>

          <input
            type="password"
            value={tokenInput}
            onChange={(e) =>
              setTokenInput(e.target.value)
            }
            placeholder={
              tokenMasked || "Enter Telegram bot token"
            }
            style={styles.input}
            disabled={saving}
          />

          {tokenInput.trim() && (
            <button
              onClick={onClearInput}
              style={styles.clearButton}
              disabled={saving}
            >
              Clear
            </button>
          )}

        </div>

        <div style={styles.tokenHint}>
          {tokenSet
            ? "Enter a new token to replace the current token."
            : "The token will be verified with Telegram before being saved."}
        </div>

      </div>

      {/* CONNECT */}
      <div style={styles.actions}>

        <button
          onClick={onConnect}
          disabled={saving || !tokenInput.trim()}
          style={{
            ...styles.connectButton,
            opacity:
              saving || !tokenInput.trim()
                ? 0.5
                : 1,
          }}
        >
          {saving
            ? "Connecting..."
            : hasToken
              ? "Reconnect Bot"
              : "Connect Bot"}
        </button>

      </div>

      {/* DETAILS */}
      <div style={styles.detailsGrid}>

        <div style={styles.detail}>
          <div style={styles.detailLabel}>
            Token status
          </div>

          <div style={styles.detailValue}>
            {hasToken ? "Configured" : "Not configured"}
          </div>
        </div>

        <div style={styles.detail}>
          <div style={styles.detailLabel}>
            Last validated
          </div>

          <div style={styles.detailValue}>
            {formatDate(validatedAt)}
          </div>
        </div>

        <div style={styles.detail}>
          <div style={styles.detailLabel}>
            Last restart
          </div>

          <div style={styles.detailValue}>
            {formatDate(lastRestartAt)}
          </div>
        </div>

        <div style={styles.detail}>
          <div style={styles.detailLabel}>
            Runtime
          </div>

          <div style={styles.detailValue}>
            {running ? "Active" : "Stopped"}
          </div>
        </div>

      </div>

      {/* VALIDATION ERROR */}
      {validationError && (
        <div style={styles.errorBox}>

          <div style={styles.errorTitle}>
            Last validation error
          </div>

          <div style={styles.errorText}>
            {validationError}
          </div>

        </div>
      )}

      {/* CRASH ERROR */}
      {lastCrashError && (
        <div style={styles.crashBox}>

          <div style={styles.crashTitle}>
            Last runtime crash
          </div>

          <div style={styles.crashText}>
            {lastCrashError}
          </div>

        </div>
      )}

    </div>
  );
}


export default function BotInfrastructure() {
  const token = localStorage.getItem("token");
  const [settings, setSettings] = useState(null);
  const [supportTokenInput, setSupportTokenInput] = useState("");
  const [mainTokenInput, setMainTokenInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingBot, setSavingBot] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/global-bot-settings/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSettings(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const connectBot = async (type) => {
    const isSupport = type === "support";

    const value = isSupport
      ? supportTokenInput.trim()
      : mainTokenInput.trim();

    if (!value) {
      setError("Please enter a bot token.");
      return;
    }

    setSavingBot(type);
    setError("");
    setSuccess("");

    try {
      const payload = isSupport
        ? {
            support_bot_token: value,
          }
        : {
            main_bot_token: value,
          };

      const res = await axios.put(
        `${API}/admin/global-bot-settings/`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSettings(res.data);

      if (isSupport) {
        setSupportTokenInput("");
      } else {
        setMainTokenInput("");
      }

      setSuccess(
        `${isSupport ? "Support" : "Main"} bot connected successfully.`
      );

    } catch (e) {

      const detail =
        e?.response?.data?.detail;

      if (typeof detail === "object") {
        setError(
          `${detail.message || "Connection failed"}${
            detail.error
              ? ` — ${detail.error}`
              : ""
          }`
        );
      } else {
        setError(
          detail ||
          "Failed to connect bot."
        );
      }

    } finally {
      setSavingBot(null);
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        Loading bot infrastructure...
      </div>
    );
  }


  return (
    <div style={{
      padding: 24,
      color: "#f8fafc",
      maxWidth: 1200,
      width: "100%",
      boxSizing: "border-box",
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Bot Infrastructure</div>
      <div style={{ color: "#64748b", marginBottom: 20 }}>Configure the platform's global bot tokens.</div>

      {error ? <div style={{ marginBottom: 12, color: "#fda4af", fontSize: 13 }}>{error}</div> : null}
      {success ? <div style={{ marginBottom: 12, color: "#86efac", fontSize: 13 }}>{success}</div> : null}
      

          {/* BOT CARDS */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 20,
        alignItems: "start",
      }}
    >
      <BotCard
        type="support"
        label="Support Bot"
        description="Handles platform support and user communication."
        tokenInput={supportTokenInput}
        setTokenInput={setSupportTokenInput}
        tokenSet={settings?.support_bot_token_set}
        tokenMasked={settings?.support_bot_token_masked}
        username={settings?.support_bot_username}
        validatedAt={settings?.support_last_validated_at}
        validationError={settings?.support_last_validation_error}
        running={settings?.is_running_support}
        lastRestartAt={settings?.support_last_restart_at}
        lastCrashError={settings?.support_last_crash_error}
        saving={savingBot === "support"}
        onConnect={() => connectBot("support")}
        onClearInput={() => setSupportTokenInput("")}
      />

      <BotCard
        type="main"
        label="Global Main Bot"
        description="Primary platform bot used for global wire operations."
        tokenInput={mainTokenInput}
        setTokenInput={setMainTokenInput}
        tokenSet={settings?.main_bot_token_set}
        tokenMasked={settings?.main_bot_token_masked}
        username={settings?.main_bot_username}
        validatedAt={settings?.main_last_validated_at}
        validationError={settings?.main_last_validation_error}
        running={settings?.is_running_main}
        lastRestartAt={settings?.main_last_restart_at}
        lastCrashError={settings?.main_last_crash_error}
        saving={savingBot === "main"}
        onConnect={() => connectBot("main")}
        onClearInput={() => setMainTokenInput("")}
      />

      </div>

      {/* SYSTEM INFO */}
      <div style={styles.systemCard}>

        <div style={styles.systemTitle}>
          Configuration
        </div>

        <div style={styles.systemGrid}>

          <div>
            <div style={styles.detailLabel}>
              Last updated
            </div>

            <div style={styles.detailValue}>
              {formatDate(settings?.updated_at)}
            </div>
          </div>

          <div>
            <div style={styles.detailLabel}>
              Updated by
            </div>

            <div style={styles.detailValue}>
              {settings?.updated_by
                ? `User #${settings.updated_by}`
                : "—"}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}


const styles = {
  page: {
    minHeight: "100%",
    padding: 32,
    color: "#e5e7eb",
    background: "#020617",
    boxSizing: "border-box",
  },

  loading: {
    padding: 32,
    color: "#94a3b8",
    background: "#020617",
    minHeight: "100%",
  },

  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 28,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.14em",
    color: "#64748b",
    marginBottom: 8,
  },

  pageTitle: {
    margin: 0,
    fontSize: 30,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: "#f8fafc",
  },

  pageSubtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  },

  refreshButton: {
    border: "1px solid rgba(148,163,184,.15)",
    background: "#0f172a",
    color: "#cbd5e1",
    borderRadius: 10,
    padding: "10px 15px",
    cursor: "pointer",
    fontWeight: 700,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: 14,
    marginBottom: 32,
  },

  summaryCard: {
    background: "#0f172a",
    border:
      "1px solid rgba(148,163,184,.10)",
    borderRadius: 16,
    padding: 18,
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },

  summaryValue: {
    fontSize: 26,
    fontWeight: 800,
    color: "#f8fafc",
  },

  sectionHeading: {
    fontSize: 18,
    fontWeight: 800,
    color: "#f8fafc",
    marginBottom: 14,
  },

  card: {
    background: "#0f172a",
    border:
      "1px solid rgba(148,163,184,.11)",
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 18,
  },

  botIdentity: {
    display: "flex",
    alignItems: "center",
    gap: 13,
  },

  botIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 17,
  },

  supportBotIcon: {
    background: "rgba(34,197,94,.12)",
    color: "#4ade80",
  },

  mainBotIcon: {
    background: "rgba(59,130,246,.12)",
    color: "#60a5fa",
  },

  botTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#f8fafc",
  },

  botDescription: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },

  statusBadgeRunning: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    background: "rgba(34,197,94,.10)",
    color: "#4ade80",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  },

  statusBadgeConfigured: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    background: "rgba(234,179,8,.10)",
    color: "#facc15",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  },

  statusBadgeOffline: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    background: "rgba(100,116,139,.10)",
    color: "#94a3b8",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "currentColor",
  },

  usernameRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#020617",
    borderRadius: 9,
    padding: "7px 10px",
    color: "#cbd5e1",
    fontSize: 13,
    marginBottom: 18,
  },

  usernameIcon: {
    color: "#64748b",
  },

  section: {
    marginTop: 8,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#94a3b8",
    marginBottom: 7,
  },

  tokenRow: {
    display: "flex",
    gap: 8,
  },

  input: {
    flex: 1,
    minWidth: 0,
    background: "#020617",
    border:
      "1px solid rgba(148,163,184,.14)",
    color: "#f8fafc",
    padding: "12px 13px",
    borderRadius: 10,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "monospace",
    fontSize: 13,
  },

  clearButton: {
    border:
      "1px solid rgba(148,163,184,.12)",
    background: "#111827",
    color: "#94a3b8",
    borderRadius: 10,
    padding: "0 13px",
    cursor: "pointer",
  },

  tokenHint: {
    marginTop: 7,
    fontSize: 11,
    color: "#475569",
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 14,
  },

  connectButton: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    borderRadius: 10,
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 800,
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 20,
    paddingTop: 18,
    borderTop:
      "1px solid rgba(148,163,184,.08)",
  },

  detail: {
    minWidth: 0,
  },

  detailLabel: {
    fontSize: 11,
    color: "#475569",
    fontWeight: 700,
    marginBottom: 5,
  },

  detailValue: {
    fontSize: 12,
    color: "#cbd5e1",
    fontWeight: 600,
  },

  errorBox: {
    marginTop: 16,
    background: "rgba(239,68,68,.06)",
    border:
      "1px solid rgba(239,68,68,.14)",
    borderRadius: 11,
    padding: 12,
  },

  errorTitle: {
    color: "#fca5a5",
    fontSize: 11,
    fontWeight: 800,
    marginBottom: 4,
  },

  errorText: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 1.5,
  },

  crashBox: {
    marginTop: 10,
    background: "rgba(245,158,11,.06)",
    border:
      "1px solid rgba(245,158,11,.14)",
    borderRadius: 11,
    padding: 12,
  },

  crashTitle: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: 800,
    marginBottom: 4,
  },

  crashText: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 1.5,
  },

  globalError: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    background: "rgba(239,68,68,.07)",
    border:
      "1px solid rgba(239,68,68,.16)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },

  globalSuccess: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    background: "rgba(34,197,94,.07)",
    border:
      "1px solid rgba(34,197,94,.16)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },

  alertIcon: {
    width: 25,
    height: 25,
    borderRadius: 8,
    background: "rgba(255,255,255,.05)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    flexShrink: 0,
  },

  alertTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "#f8fafc",
    marginBottom: 3,
  },

  alertText: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 1.5,
  },

  systemCard: {
    background: "#0f172a",
    border:
      "1px solid rgba(148,163,184,.08)",
    borderRadius: 16,
    padding: 18,
    marginTop: 28,
  },

  systemTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#cbd5e1",
    marginBottom: 14,
  },

  systemGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 20,
  },
};