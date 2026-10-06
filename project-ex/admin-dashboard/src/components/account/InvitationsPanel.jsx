import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { RefreshCcw, Plus, Ban } from "lucide-react";
import { API_URL } from "../../config";
import { authHeaders, fmtDate, showToast } from "./accountUtils";
import { EmptyState, MetaRow, Stat, Tag } from "./AccountBits";
import "../../pages/MyAccount.css";

const api = axios.create({ baseURL: API_URL });

function displayUser(user) {
  if (!user) return "—";
  return user.full_name ? `${user.full_name} (@${user.username || user.user_id})` : user.username || `User #${user.user_id}`;
}

const codeState = (item) => (item.is_used ? { text: "USED", color: "#3b82f6" } : item.is_active ? { text: "ACTIVE", color: "#10b981" } : { text: "REVOKED", color: "#ef4444" });

function CodeCard({ item, children }) {
  const st = codeState(item);
  return (
    <div className="ma-invite">
      <div className="ma-row-between" style={{ flexWrap: "nowrap" }}>
        <strong className="ma-invite-code">{item.code}</strong>
        <Tag text={st.text} color={st.color} />
      </div>
      {children}
    </div>
  );
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

  const activeCount = codes.filter((c) => !c.is_used).length;
  const usedCount = codes.filter((c) => c.is_used).length;
  const filtered = codes.filter((c) => (tab === "used" ? c.is_used : !c.is_used));

  return (
    <div className="ma-stack">
      <section className="ma-card">
        <div className="ma-card-head">
          <div>
            <div className="ma-card-title">Invitation Pool</div>
            <div className="ma-subtle">All codes across the platform. Master can revoke or top up the unassigned pool.</div>
          </div>
          <div className="ma-row">
            <button type="button" onClick={load} disabled={loading} className="ma-btn"><RefreshCcw size={13} className={loading ? "ma-spin" : ""} /> {loading ? "…" : "Refresh"}</button>
            <button type="button" onClick={generatePool} disabled={generating} className="ma-btn ma-btn--primary"><Plus size={13} /> {generating ? "Generating…" : "Generate Pool"}</button>
          </div>
        </div>

        <div className="ma-statsRow">
          <Stat label="Total" value={codes.length} />
          <Stat label="Active" value={activeCount} />
          <Stat label="Used" value={usedCount} />
        </div>

        <div className="ma-subtabs" style={{ marginTop: 14 }}>
          <button type="button" onClick={() => setTab("active")} className={`ma-subtab${tab === "active" ? " is-active" : ""}`}>Active ({activeCount})</button>
          <button type="button" onClick={() => setTab("used")} className={`ma-subtab${tab === "used" ? " is-active" : ""}`}>Used ({usedCount})</button>
        </div>

        <div className="ma-tileGrid" style={{ marginTop: 14 }}>
          {filtered.map((item) => (
            <CodeCard key={item.id} item={item}>
              <div className="ma-metaList">
                <MetaRow label="Assigned to" value={displayUser(item.created_by)} />
                <MetaRow label="Used by" value={displayUser(item.used_by)} />
                <MetaRow label="Used at" value={fmtDate(item.used_at)} />
              </div>
              {!item.is_used && item.is_active && (
                <button type="button" onClick={() => revoke(item.id)} className="ma-btn ma-btn--danger ma-btn--sm ma-btn--block"><Ban size={12} /> Revoke</button>
              )}
            </CodeCard>
          ))}
        </div>
        {filtered.length === 0 && <EmptyState>No codes in this view.</EmptyState>}
      </section>
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
    <div className="ma-stack">
      <section className="ma-card">
        <div className="ma-card-head">
          <div>
            <div className="ma-card-title">My Invitation Codes</div>
            <div className="ma-subtle">Assign a code to yourself, share it, and track whether it's been used.</div>
          </div>
          <div className="ma-row">
            <button type="button" onClick={load} disabled={loading} className="ma-btn"><RefreshCcw size={13} className={loading ? "ma-spin" : ""} /> {loading ? "…" : "Refresh"}</button>
            <button type="button" onClick={requestCode} disabled={requesting} className="ma-btn ma-btn--primary"><Plus size={13} /> {requesting ? "Assigning…" : "Get a Code"}</button>
          </div>
        </div>

        <div className="ma-statsRow">
          <Stat label="Total" value={data.total} />
          <Stat label="Active" value={data.active} />
          <Stat label="Used" value={data.used} />
        </div>

        <div className="ma-tileGrid" style={{ marginTop: 14 }}>
          {(data.codes || []).map((item) => (
            <CodeCard key={item.id} item={item}>
              <div className="ma-metaList">
                <MetaRow label="Used by" value={item.used_by_user_id ? (usernames[item.used_by_user_id] || `User #${item.used_by_user_id}`) : "Not used yet"} />
                <MetaRow label="Used at" value={fmtDate(item.used_at)} />
              </div>
            </CodeCard>
          ))}
        </div>
        {(data.codes || []).length === 0 && <EmptyState>You don't have any invitation codes yet — request one above.</EmptyState>}
      </section>
    </div>
  );
}