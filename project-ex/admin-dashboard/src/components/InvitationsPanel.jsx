import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { RefreshCcw, Plus, Ban } from "lucide-react";
import { API_URL } from "../config";

const api = axios.create({ baseURL: API_URL });
const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });
const fmtDate = (value) => (value ? new Date(value).toLocaleString() : "—");

function showToast(msg, ok = true) {
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed", bottom: "24px", right: "24px", zIndex: 99999,
    padding: "12px 20px", borderRadius: "12px", fontWeight: 600, fontSize: "13px",
    color: "white", pointerEvents: "none",
    background: ok ? "#16a34a" : "#dc2626",
    boxShadow: ok ? "0 8px 32px rgba(22,163,74,.35)" : "0 8px 32px rgba(220,38,38,.35)",
    transform: "translateY(8px)", opacity: 0, transition: "all .25s ease",
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = 1; el.style.transform = "translateY(0)"; });
  setTimeout(() => {
    el.style.opacity = 0; el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function displayUser(user) {
  if (!user) return "—";
  return user.full_name ? `${user.full_name} (@${user.username || user.user_id})` : user.username || `User #${user.user_id}`;
}

export default function InvitationsPanel({ isMaster }) {
  return isMaster ? <MasterInvitations /> : <AdminInvitations />;
}

// =========================================================
// MASTER: full pool oversight
// =========================================================
function MasterInvitations() {
  const token = localStorage.getItem("token");
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/invitations/", { headers: authHeaders(token) });
      setCodes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to load invitations.", false);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const generatePool = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/admin/invitations/generate-pool", {}, { headers: authHeaders(token) });
      showToast(`Generated ${res.data.generated} new codes`);
      await load();
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to generate pool.", false);
    } finally {
      setGenerating(false);
    }
  };

  const revoke = async (id) => {
    if (!window.confirm("Revoke this invitation code?")) return;
    try {
      await api.post(`/admin/invitations/revoke/${id}`, {}, { headers: authHeaders(token) });
      showToast("Code revoked");
      await load();
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to revoke.", false);
    }
  };

  const filtered = codes.filter((c) => (tab === "used" ? c.is_used : !c.is_used));

  return (
    <div style={styles.stack}>
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.cardTitle}>Invitation Pool</div>
            <div style={styles.subtle}>All codes across the platform. Master can revoke or top up the unassigned pool.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={load} disabled={loading} style={styles.secondaryBtn}>
              <RefreshCcw size={13} /> {loading ? "…" : "Refresh"}
            </button>
            <button type="button" onClick={generatePool} disabled={generating} style={styles.primaryBtn}>
              <Plus size={13} /> {generating ? "Generating…" : "Generate Pool"}
            </button>
          </div>
        </div>

        <div style={{ ...styles.tabRow, marginTop: 12 }}>
          <button type="button" onClick={() => setTab("active")} style={styles.pillTab(tab === "active")}>Active ({codes.filter(c => !c.is_used).length})</button>
          <button type="button" onClick={() => setTab("used")} style={styles.pillTab(tab === "used")}>Used ({codes.filter(c => c.is_used).length})</button>
        </div>

        <div style={styles.grid}>
          {filtered.map((item) => (
            <div key={item.id} style={styles.inviteCard}>
              <div style={styles.rowBetween}>
                <strong style={{ fontFamily: "monospace" }}>{item.code}</strong>
                <span style={styles.tag(item.is_used ? "#3b82f6" : item.is_active ? "#10b981" : "#ef4444")}>
                  {item.is_used ? "USED" : item.is_active ? "ACTIVE" : "REVOKED"}
                </span>
              </div>
              <div style={styles.metaList}>
                <MetaRow label="Assigned to" value={displayUser(item.created_by)} />
                <MetaRow label="Used by" value={displayUser(item.used_by)} />
                <MetaRow label="Used at" value={fmtDate(item.used_at)} />
              </div>
              {!item.is_used && item.is_active && (
                <button type="button" onClick={() => revoke(item.id)} style={{ ...styles.secondaryBtn, color: "#f87171", borderColor: "rgba(239,68,68,.3)", marginTop: 8 }}>
                  <Ban size={12} /> Revoke
                </button>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div style={styles.subtle}>No codes in this view.</div>}
        </div>
      </div>
    </div>
  );
}

// =========================================================
// ADMIN: self-serve — request a code for themselves, see usage
// =========================================================
function AdminInvitations() {
  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("user_id");
  const [data, setData] = useState({ total: 0, used: 0, active: 0, codes: [] });
  const [usernames, setUsernames] = useState({});
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const resolveUsernames = useCallback(async (codes) => {
    const ids = [...new Set(codes.map((c) => c.used_by_user_id).filter(Boolean))];
    const missing = ids.filter((id) => !(id in usernames));
    if (missing.length === 0) return;
    const results = await Promise.all(
      missing.map((id) =>
        api.get(`/admin/users/username/${id}`, { headers: authHeaders(token) })
          .then((r) => [id, r.data.username])
          .catch(() => [id, null])
      )
    );
    setUsernames((prev) => ({ ...prev, ...Object.fromEntries(results) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await api.get("/user/invitations/", { headers: authHeaders(token), params: { user_id: Number(userId) } });
      const payload = res.data || { total: 0, used: 0, active: 0, codes: [] };
      setData(payload);
      await resolveUsernames(payload.codes || []);
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to load invitations.", false);
    } finally {
      setLoading(false);
    }
  }, [token, userId, resolveUsernames]);

  useEffect(() => { load(); }, [load]);

  const requestCode = async () => {
    setRequesting(true);
    try {
      const res = await api.post("/user/invitations/request", null, { headers: authHeaders(token), params: { user_id: Number(userId) } });
      showToast(`Code assigned: ${res.data.code}`);
      await load();
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "No available codes right now.", false);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div style={styles.stack}>
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.cardTitle}>My Invitation Codes</div>
            <div style={styles.subtle}>Assign a code to yourself, share it, and track whether it's been used.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={load} disabled={loading} style={styles.secondaryBtn}>
              <RefreshCcw size={13} /> {loading ? "…" : "Refresh"}
            </button>
            <button type="button" onClick={requestCode} disabled={requesting} style={styles.primaryBtn}>
              <Plus size={13} /> {requesting ? "Assigning…" : "Get a Code"}
            </button>
          </div>
        </div>

        <div style={styles.statsRow}>
          <Stat label="Total" value={data.total} />
          <Stat label="Active" value={data.active} />
          <Stat label="Used" value={data.used} />
        </div>

        <div style={styles.grid}>
          {(data.codes || []).map((item) => (
            <div key={item.id} style={styles.inviteCard}>
              <div style={styles.rowBetween}>
                <strong style={{ fontFamily: "monospace" }}>{item.code}</strong>
                <span style={styles.tag(item.is_used ? "#3b82f6" : item.is_active ? "#10b981" : "#ef4444")}>
                  {item.is_used ? "USED" : item.is_active ? "ACTIVE" : "REVOKED"}
                </span>
              </div>
              <div style={styles.metaList}>
                <MetaRow label="Used by" value={item.used_by_user_id ? (usernames[item.used_by_user_id] || `User #${item.used_by_user_id}`) : "Not used yet"} />
                <MetaRow label="Used at" value={fmtDate(item.used_at)} />
              </div>
            </div>
          ))}
          {(data.codes || []).length === 0 && <div style={styles.subtle}>You don't have any invitation codes yet — request one above.</div>}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div style={styles.metaRow}>
      <span style={styles.metaLabel}>{label}</span>
      <span style={styles.metaValue}>{value ?? "—"}</span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value ?? "—"}</div>
    </div>
  );
}

const styles = {
  stack: { display: "flex", flexDirection: "column", gap: 16 },
  card: {
    borderRadius: 18, border: "1px solid #223451",
    background: "linear-gradient(180deg, rgba(11,22,40,.98), rgba(8,18,36,.94))",
    padding: 16, boxShadow: "0 16px 42px rgba(0,0,0,.25)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  cardTitle: { fontSize: 16, fontWeight: 800, marginBottom: 4 },
  subtle: { fontSize: 12, color: "#7c8ca8" },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  tabRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  pillTab: (active) => ({
    borderRadius: 999,
    border: `1px solid ${active ? "#3b82f6" : "#2b3b54"}`,
    background: active ? "rgba(59,130,246,.16)" : "#0b1628",
    color: active ? "#bfdbfe" : "#94a3b8",
    padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer",
  }),
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 },
  inviteCard: { borderRadius: 16, border: "1px solid #223451", background: "#091629", padding: 14, display: "flex", flexDirection: "column", gap: 10 },
  metaList: { display: "flex", flexDirection: "column", gap: 6 },
  metaRow: {
    display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 9px",
    borderRadius: 10, border: "1px solid #20314e", background: "#081224", alignItems: "center",
  },
  metaLabel: { color: "#7c8ca8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  metaValue: { color: "#dbe7fb", fontSize: 12, fontWeight: 700, wordBreak: "break-word", textAlign: "right" },
  tag: (color) => ({
    display: "inline-flex", alignItems: "center", minHeight: 24, padding: "0 9px",
    borderRadius: 999, border: `1px solid ${color}`, background: `${color}22`, color, fontSize: 10, fontWeight: 800,
  }),
  statsRow: { display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" },
  statCard: { borderRadius: 12, border: "1px solid #223451", background: "#091629", padding: "10px 16px", minWidth: 90 },
  statLabel: { color: "#7c8ca8", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8 },
  statValue: { fontSize: 20, fontWeight: 900, marginTop: 4 },
  primaryBtn: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px",
    borderRadius: 12, border: "1px solid rgba(59,130,246,.4)", background: "rgba(37,99,235,.18)", color: "#bfdbfe", fontWeight: 800, cursor: "pointer",
  },
  secondaryBtn: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px",
    borderRadius: 12, border: "1px solid #28405f", background: "#0e1a2d", color: "#cbd5e1", fontWeight: 700, cursor: "pointer",
  },
};