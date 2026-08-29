import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { Bot, Globe, Users, Save, RefreshCw, Search, X, CreditCard, Activity, Radio, CheckCircle2, ChevronDown, ChevronUp, Settings as SettingsIcon, Trash2, Plus, Filter } from "lucide-react";
import BotCard from "../components/BotCard";
import { hasPermission } from "../utils/permissions";

const API = "http://127.0.0.1:8000";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fa", label: "Persian (فارسی)" },
];

const SERVICE_CATALOG = [
  { key: "products.view", label: "Products" },
  { key: "orders.view", label: "Orders" },
  { key: "exchange.view", label: "Exchange" },
  { key: "wire_transfer.view", label: "Wire Transfer" },
];

const emptyBankForm = () => ({
  bank_name: "", bank_holder_name: "", bank_card_number: "", bank_sheba: "", is_active: false,
});

const S = {
  input: {
    width: "100%", background: "#0b1220", border: "1px solid rgba(255,255,255,.1)",
    color: "white", padding: "10px 12px", borderRadius: 10, outline: "none", boxSizing: "border-box",
  },
  primaryBtn: {
    display: "inline-flex", alignItems: "center", gap: 8, border: "none", borderRadius: 10,
    background: "rgba(59,130,246,.18)", color: "#93c5fd", padding: "10px 14px", cursor: "pointer", fontWeight: 700,
  },
  card: { background: "#0f172a", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 16 },
  colTitle: { fontSize: 12, fontWeight: 800, letterSpacing: 0.6, color: "#64748b", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 },
  refreshBtn: {
    display: "flex", alignItems: "center", gap: 6, background: "transparent",
    border: "1px solid #313d58ff", borderRadius: 10, padding: "8px 14px", color: "#6c798dff",
    cursor: "pointer", fontWeight: 600, fontSize: 13,
  },
  statPill: {
    display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "10px 14px", minWidth: 130,
  },
};

function StatPill({ icon: Icon, label, value, accent }) {
  return (
    <div style={S.statPill}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: accent + "18", color: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} />
      </div>
      <div>
        <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: accent, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10,
      border: active ? "1px solid rgba(59,130,246,.4)" : "1px solid rgba(255,255,255,.08)",
      background: active ? "rgba(59,130,246,.16)" : "transparent",
      color: active ? "#93c5fd" : "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 700,
    }}>
      {icon}{label}
    </button>
  );
}

/* ── SHARED: editable services toggle block ─────────────────────── */
function ServiceToggleBlock({ accessPoints, isFullAccess, enabledServices, editable, onToggleService }) {
  const permitted = isFullAccess
    ? SERVICE_CATALOG
    : SERVICE_CATALOG.filter(s => (accessPoints || []).includes(s.key));

  const isOn = (key) => enabledServices == null ? true : enabledServices.includes(key);

  if (permitted.length === 0) {
    return <div style={{ fontSize: 12, color: "#64748b" }}>No services enabled for this account.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {permitted.map(s => {
        const on = isOn(s.key);
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: on ? "#e2e8f0" : "#64748b" }}>{s.label}</span>
            {editable ? (
              <div
                onClick={() => onToggleService?.(s.key)}
                style={{
                  position: "relative", width: 38, height: 21, borderRadius: 11, cursor: "pointer",
                  background: on ? "#22c55e" : "#1e293b", border: `1px solid ${on ? "#22c55e" : "#334155"}`,
                  transition: "all .2s", flexShrink: 0,
                }}
              >
                <div style={{ position: "absolute", top: 1, left: on ? 18 : 1, width: 17, height: 17, borderRadius: "50%", background: on ? "white" : "#475569", transition: "left .2s" }} />
              </div>
            ) : (
              <span style={{ fontSize: 10, fontWeight: 700, color: on ? "#86efac" : "#64748b", background: on ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.05)", border: `1px solid ${on ? "rgba(34,197,94,.22)" : "rgba(255,255,255,.08)"}`, borderRadius: 999, padding: "3px 9px" }}>
                {on ? "ON" : "OFF"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── PAYMENT ACCOUNT CARD — collapsed row -> expand -> activate only ── */
function PaymentAccountCard({ account, canActivate, onActivate }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, background: "rgba(255,255,255,.03)", overflow: "hidden" }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer" }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {account.bank_name || "Unnamed account"}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {account.bank_holder_name || "—"}
          </div>
        </div>
        {account.is_active
          ? <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, background: "rgba(34,197,94,.14)", color: "#86efac", flexShrink: 0 }}>Active</span>
          : <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, background: "rgba(255,255,255,.05)", color: "#94a3b8", flexShrink: 0 }}>Inactive</span>}
        {open ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
      </div>

      {open && (
        <div style={{ padding: "0 12px 12px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.7, marginTop: 10 }}>
            <div><strong>Holder:</strong> {account.bank_holder_name || "—"}</div>
            <div><strong>Card:</strong> {account.bank_card_number || "—"}</div>
            <div><strong>Sheba:</strong> {account.bank_sheba || "—"}</div>
            {account.has_transactions && <div style={{ color: "#fbbf24", marginTop: 4 }}>Immutable — has transaction history.</div>}
          </div>
          {canActivate && !account.is_active && (
            <button
              onClick={(e) => { e.stopPropagation(); onActivate?.(account); }}
              style={{ marginTop: 10, background: "rgba(34,197,94,.16)", border: "1px solid rgba(34,197,94,.24)", color: "#86efac", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700 }}
            >
              Set Active
            </button>
          )}
          {canActivate && account.is_active && (
            <button
              onClick={(e) => { e.stopPropagation(); onActivate?.({ ...account, __deactivate: true }); }}
              style={{ marginTop: 10, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.22)", color: "#fda4af", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700 }}
            >
              Deactivate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── PAYMENTS CARD (view + activate-only list) ──────────────────── */
function PaymentsCard({ token, adminId, title = "Payments", canEdit = true, description }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/admin/platform-bank-accounts/`, { headers: { Authorization: `Bearer ${token}` } });
      const all = res.data || [];
      setAccounts(adminId != null ? all.filter(a => a.admin_id === adminId) : all);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load bank accounts.");
    } finally {
      setLoading(false);
    }
  }, [token, adminId]);

  useEffect(() => { load(); }, [load]);

  const handleActivate = async (account) => {
    try {
      await axios.put(`${API}/admin/platform-bank-accounts/${account.id}`, { is_active: !account.__deactivate }, { headers: { Authorization: `Bearer ${token}` } });
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to update account.");
    }
  };

  return (
    <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <CreditCard size={15} color="#93c5fd" />
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
      </div>
      {description && <div style={{ color: "#64748b", fontSize: 12, marginTop: -6 }}>{description}</div>}
      {error && <div style={{ color: "#fda4af", fontSize: 12 }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
        {loading ? (
          <div style={{ color: "#64748b", fontSize: 12 }}>Loading…</div>
        ) : accounts.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 12 }}>No bank accounts yet.</div>
        ) : accounts.map((a) => (
          <PaymentAccountCard key={a.id} account={a} canActivate={canEdit} onActivate={handleActivate} />
        ))}
      </div>
    </div>
  );
}

/* ── PAYMENT SETTINGS TAB (full CRUD, lives inside ConfigModal) ──── */
function PaymentSettingsTab({ token, adminId }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyBankForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/admin/platform-bank-accounts/`, { headers: { Authorization: `Bearer ${token}` } });
      const all = res.data || [];
      setAccounts(adminId != null ? all.filter(a => a.admin_id === adminId) : all);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load bank accounts.");
    } finally {
      setLoading(false);
    }
  }, [token, adminId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await axios.put(`${API}/admin/platform-bank-accounts/${editingId}`, form, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API}/admin/platform-bank-accounts/`, form, { headers: { Authorization: `Bearer ${token}` } });
      }
      setForm(emptyBankForm());
      setEditingId(null);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to save bank account.");
    } finally {
      setSaving(false);
    }
  };

  const edit = (a) => {
    setEditingId(a.id);
    setForm({
      bank_name: a.bank_name || "", bank_holder_name: a.bank_holder_name || "",
      bank_card_number: a.bank_card_number || "", bank_sheba: a.bank_sheba || "", is_active: a.is_active || false,
    });
    setShowForm(true);
    setExpandedId(null);
  };

  const toggleActive = async (a) => {
    try {
      await axios.put(`${API}/admin/platform-bank-accounts/${a.id}`, { is_active: !a.is_active }, { headers: { Authorization: `Bearer ${token}` } });
      await load();
    } catch (e) { setError(e?.response?.data?.detail || "Failed to update."); }
  };

  const remove = async (a) => {
    if (!confirm("Delete this bank account?")) return;
    try {
      await axios.delete(`${API}/admin/platform-bank-accounts/${a.id}`, { headers: { Authorization: `Bearer ${token}` } });
      await load();
    } catch (e) { setError(e?.response?.data?.detail || "Failed to delete."); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Bank Accounts</div>
        <button
          onClick={() => { setShowForm(v => !v); setEditingId(null); setForm(emptyBankForm()); }}
          style={{ ...S.primaryBtn, padding: "6px 10px", fontSize: 12 }}
        >
          <Plus size={13} /> {showForm ? "Close" : "Add"}
        </button>
      </div>

      {error && <div style={{ color: "#fda4af", fontSize: 12 }}>{error}</div>}

      {showForm && (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: 12 }}>
          <input style={S.input} placeholder="Bank name" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} required />
          <input style={S.input} placeholder="Account holder" value={form.bank_holder_name} onChange={(e) => setForm({ ...form, bank_holder_name: e.target.value })} required />
          <input style={S.input} placeholder="Card number" value={form.bank_card_number} onChange={(e) => setForm({ ...form, bank_card_number: e.target.value })} required />
          <input style={S.input} placeholder="Sheba" value={form.bank_sheba} onChange={(e) => setForm({ ...form, bank_sheba: e.target.value })} required />
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 12 }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Mark as active account
          </label>
          <button type="submit" disabled={saving} style={{ ...S.primaryBtn, justifyContent: "center", opacity: saving ? 0.7 : 1 }}>
            <Save size={13} /> {saving ? "Saving…" : editingId ? "Save Changes" : "Create Account"}
          </button>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
        {loading ? (
          <div style={{ color: "#64748b", fontSize: 12 }}>Loading…</div>
        ) : accounts.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 12 }}>No bank accounts yet.</div>
        ) : accounts.map((a) => {
          const open = expandedId === a.id;
          return (
            <div key={a.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, background: "rgba(255,255,255,.03)", overflow: "hidden" }}>
              <div onClick={() => setExpandedId(open ? null : a.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.bank_name || "Unnamed account"}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{a.bank_holder_name || "—"}</div>
                </div>
                {a.is_active
                  ? <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, background: "rgba(34,197,94,.14)", color: "#86efac" }}>Active</span>
                  : <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, background: "rgba(255,255,255,.05)", color: "#94a3b8" }}>Inactive</span>}
                {open ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
              </div>
              {open && (
                <div style={{ padding: "0 12px 12px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.7, marginTop: 10 }}>
                    <div><strong>Card:</strong> {a.bank_card_number || "—"}</div>
                    <div><strong>Sheba:</strong> {a.bank_sheba || "—"}</div>
                    {a.has_transactions && <div style={{ color: "#fbbf24", marginTop: 4 }}>Immutable — has transaction history.</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={() => edit(a)} style={{ background: "rgba(59,130,246,.16)", border: "1px solid rgba(59,130,246,.25)", color: "#93c5fd", padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Edit</button>
                    <button onClick={() => toggleActive(a)} style={{ background: a.is_active ? "rgba(239,68,68,.12)" : "rgba(34,197,94,.16)", border: `1px solid ${a.is_active ? "rgba(239,68,68,.22)" : "rgba(34,197,94,.24)"}`, color: a.is_active ? "#fda4af" : "#86efac", padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                      {a.is_active ? "Deactivate" : "Set Active"}
                    </button>
                    {!a.has_transactions && <button onClick={() => remove(a)} style={{ background: "rgba(248,113,113,.14)", border: "1px solid rgba(248,113,113,.22)", color: "#fda4af", padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 700 }}><Trash2 size={11} /></button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── LIVE STATUS CARD — editable everywhere via onToggleService ────── */
function LiveStatusCard({
  botUsername, displayName, username, accessPoints, isFullAccess,
  defaultLanguage, isActive, editable = false, enabledServices, onToggleService,
}) {
  return (
    <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Radio size={15} color="#4ade80" />
        <div style={{ fontSize: 15, fontWeight: 700 }}>Live Bot Status</div>
      </div>
      <div style={{ color: "#64748b", fontSize: 11 }}>What users actually see when they open this bot.</div>

      <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Bot Handle</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{botUsername ? `@${botUsername}` : "Not connected yet"}</div>
      </div>

      <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Provider Name Shown to Users</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>{displayName || username || "—"}</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Shown next to products/orders instead of the raw username.</div>
      </div>

      <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
          Services Visible in Bot
        </div>
        <ServiceToggleBlock
          accessPoints={accessPoints}
          isFullAccess={isFullAccess}
          enabledServices={enabledServices}
          editable={editable}
          onToggleService={onToggleService}
        />
        {editable && (
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 10 }}>
            Turning a service off hides it from the bot's menu — turn it back on anytime.
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#64748b" }}>Default Language</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "white", marginTop: 4 }}>{defaultLanguage === "fa" ? "Persian" : "English"}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: "#64748b" }}>Bot Active</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? "#4ade80" : "#f87171", marginTop: 4 }}>{isActive ? "Yes" : "No"}</div>
        </div>
      </div>
    </div>
  );
}

/* ── CONFIG (+ Payments) MODAL — tabbed, with save confirmation ─────── */
function ConfigModal({ token, target, onClose, onSaved }) {
  // target: { scope: 'admin' | 'global', kind: 'admin'|'global_main'|'support', adminId, label }
  const [tab, setTab] = useState("config");
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokenInput, setTokenInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // scope: "self" = the logged-in admin's own bot (bare endpoint, no id
  // needed — GET/PUT only exist without an id for the caller's own record).
  // scope: "admin" = master editing a specific admin's bot by id (requires
  // the id-suffixed endpoints, GET included).
  // scope: "global" = master editing global_main/support.
  const getUrl = () => {
    if (target.scope === "global") return `${API}/admin/telegram-bot-settings/global/${target.kind}`;
    if (target.scope === "self") return `${API}/admin/telegram-bot-settings/`;
    return `${API}/admin/telegram-bot-settings/${target.adminId}`;
  };

  const putUrl = () => {
    if (target.scope === "global") return `${API}/admin/telegram-bot-settings/global/${target.kind}`;
    if (target.scope === "self") return `${API}/admin/telegram-bot-settings/`;
    return `${API}/admin/telegram-bot-settings/${target.adminId}`;
  };

  const setDisplayNameUrl = () => {
    if (target.scope === "global") return `${API}/admin/telegram-bot-settings/global/${target.kind}/set-display-name`;
    if (target.scope === "self") return `${API}/admin/telegram-bot-settings/set-display-name`;
    return `${API}/admin/telegram-bot-settings/${target.adminId}/set-display-name`;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(getUrl(), { headers: { Authorization: `Bearer ${token}` } });
      setSettings(res.data);
      setDisplayNameInput(res.data.display_name || "");
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load bot settings.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, target.scope, target.kind, target.adminId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError(""); setSaved(false);
    try {
      const payload = { default_language: settings.default_language, is_active: settings.is_active };
      if (tokenInput.trim()) payload.main_bot_token = tokenInput.trim();
      const res = await axios.put(getUrl(), payload, { headers: { Authorization: `Bearer ${token}` } });
      let updated = res.data;
      if (displayNameInput.trim() && displayNameInput.trim() !== (settings.display_name || "")) {
        const r2 = await axios.post(setDisplayNameUrl(), { display_name: displayNameInput.trim() }, { headers: { Authorization: `Bearer ${token}` } });
        updated = r2.data;
      }
      setSettings(updated);
      setTokenInput("");
      setSaved(true);
      onSaved?.();
      setTimeout(() => {
        onClose?.();
      }, 1200);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const toggleService = async (key) => {
    const permittedKeys = SERVICE_CATALOG.map(s => s.key);
    const current = settings?.enabled_services ?? permittedKeys;
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    try {
      const res = await axios.put(getUrl(), { enabled_services: next }, { headers: { Authorization: `Bearer ${token}` } });
      setSettings(res.data);
      onSaved?.();
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to update services.");
    }
  };

  const restart = async () => {
    try {
      const url = target.scope === "global"
        ? `${API}/admin/bot-control/global/${target.kind}/restart`
        : `${API}/admin/bot-control/restart/${target.adminId}`;
      await axios.post(url, {}, { headers: { Authorization: `Bearer ${token}` } });
      await load();
      onSaved?.();
    } catch (e) { setError(e?.response?.data?.detail || "Restart failed."); }
  };

  const stop = async () => {
    try {
      const url = target.scope === "global"
        ? `${API}/admin/bot-control/global/${target.kind}/stop`
        : `${API}/admin/bot-control/stop/${target.adminId}`;
      await axios.post(url, {}, { headers: { Authorization: `Bearer ${token}` } });
      await load();
      onSaved?.();
    } catch (e) { setError(e?.response?.data?.detail || "Stop failed."); }
  };

  const paymentAdminId = target.scope === "global" ? target.masterAdminId : target.adminId;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: "92%", maxWidth: 600, maxHeight: "88vh", overflowY: "auto", background: "#0d1424", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{target.label}</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", color: "#94a3b8", width: 30, height: 30, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <TabButton active={tab === "config"} onClick={() => setTab("config")} icon={<SettingsIcon size={13} />} label="Bot Config" />
          <TabButton active={tab === "payments"} onClick={() => setTab("payments")} icon={<CreditCard size={13} />} label="Payment Settings" />
        </div>

        {saved && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.28)", color: "#86efac", borderRadius: 10, padding: "9px 12px", marginBottom: 12, fontSize: 13, fontWeight: 700 }}>
            <CheckCircle2 size={15} /> Saved
          </div>
        )}
        {error && <div style={{ color: "#fda4af", fontSize: 12, marginBottom: 10 }}>{error}</div>}

        {tab === "config" && (
          loading || !settings ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <BotCard
                username={target.label}
                displayName={settings.display_name}
                botUsername={settings.bot_username}
                isActive={settings.is_active}
                tokenSet={settings.main_bot_token_set}
                running={settings.is_running}
                lastRestartAt={settings.last_restart_at}
                lastCrashError={settings.last_crash_error || settings.last_validation_error}
                showActions
                onRestart={restart}
                onDeactivate={stop}
              />

              <div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Display Name (shown to users instead of username)</div>
                <input style={S.input} placeholder="e.g. Premium Store" value={displayNameInput} onChange={(e) => setDisplayNameInput(e.target.value)} />
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Default Language</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const sel = settings.default_language === opt.value;
                    return (
                      <button key={opt.value} onClick={() => setSettings({ ...settings, default_language: opt.value })}
                        style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: sel ? "1px solid rgba(34,197,94,.4)" : "1px solid rgba(255,255,255,.1)", background: sel ? "rgba(34,197,94,.14)" : "#0b1220", color: sel ? "#86efac" : "#e2e8f0", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Bot Token</div>
                <input style={S.input} type="password" placeholder={settings.main_bot_token_masked || "Paste bot token"} value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13 }}>
                <input type="checkbox" checked={!!settings.is_active} onChange={(e) => setSettings({ ...settings, is_active: e.target.checked })} />
                Bot active
              </label>

              <div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, fontWeight: 700 }}>Services Visible in Bot</div>
                <ServiceToggleBlock
                  accessPoints="*"
                  isFullAccess
                  enabledServices={settings.enabled_services}
                  editable
                  onToggleService={toggleService}
                />
              </div>

              <button onClick={save} disabled={saving} style={{ ...S.primaryBtn, justifyContent: "center", opacity: saving ? 0.7 : 1 }}>
                <Save size={14} /> {saving ? "Saving…" : "Save Settings"}
              </button>
            </div>
          )
        )}

        {tab === "payments" && (
          <PaymentSettingsTab token={token} adminId={paymentAdminId} />
        )}
      </div>
    </div>
  );
}

/* ── ALL ADMIN BOTS TAB (master) ─────────────────────────────────── */
function AllAdminBotsTab({ token }) {
  const [bots, setBots] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [modalTarget, setModalTarget] = useState(null);
  const [logs, setLogs] = useState(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, statusRes] = await Promise.all([
        axios.get(`${API}/admin/telegram-bot-settings/all`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/bot-control/status-all`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setBots(settingsRes.data);
      setStatusMap(statusRes.data || {});
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const loadLogs = useCallback(async (adminId) => {
    setLogsLoading(true);
    try {
      const res = await axios.get(`${API}/admin/bot-control/logs/${adminId}`, { headers: { Authorization: `Bearer ${token}` }, params: { hours: 24 } });
      setLogs(res.data);
    } catch (e) {
      setLogs({ lines: [], message: e?.response?.data?.detail || "Failed to load logs." });
    } finally {
      setLogsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (selectedId != null) loadLogs(selectedId);
  }, [selectedId, loadLogs]);

  const isRunning = (b) => statusMap[String(b.admin_id)]?.running ?? b.is_running;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return bots.filter(b => {
      if (roleFilter !== "all" && b.role !== roleFilter) return false;
      if (statusFilter === "running" && !isRunning(b)) return false;
      if (statusFilter === "stopped" && isRunning(b)) return false;
      if (statusFilter === "no_token" && b.main_bot_token_set) return false;
      if (!q) return true;
      return (
        (b.username || "").toLowerCase().includes(q) ||
        (b.display_name || "").toLowerCase().includes(q) ||
        (b.bot_username || "").toLowerCase().includes(q) ||
        String(b.admin_id).includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots, search, roleFilter, statusFilter, statusMap]);

  const selected = bots.find(b => b.admin_id === selectedId) || null;
  const liveStatus = selected ? statusMap[String(selected.admin_id)] : null;

  const restart = async (adminId) => {
    try {
      await axios.post(`${API}/admin/bot-control/restart/${adminId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await load();
    } catch (e) { console.error(e); }
  };
  const stop = async (adminId) => {
    try {
      await axios.post(`${API}/admin/bot-control/stop/${adminId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await load();
    } catch (e) { console.error(e); }
  };

  const toggleService = async (key) => {
    if (!selected) return;
    const permittedKeys = SERVICE_CATALOG.map(s => s.key);
    const current = selected.enabled_services ?? permittedKeys;
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    try {
      await axios.put(`${API}/admin/telegram-bot-settings/${selected.admin_id}`, { enabled_services: next }, { headers: { Authorization: `Bearer ${token}` } });
      await load();
    } catch (e) { console.error(e); }
  };

  // ── Stat pills ──
  const stats = useMemo(() => {
    const total = bots.length;
    const running = bots.filter(isRunning).length;
    const configuredStopped = bots.filter(b => b.main_bot_token_set && !isRunning(b)).length;
    const noToken = bots.filter(b => !b.main_bot_token_set).length;
    const crashed = bots.filter(b => statusMap[String(b.admin_id)]?.status === "crashed").length;
    return { total, running, configuredStopped, noToken, crashed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots, statusMap]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      {/* STAT PILLS */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatPill icon={Bot} label="Total Bots" value={stats.total} accent="#60a5fa" />
        <StatPill icon={Radio} label="Running" value={stats.running} accent="#4ade80" />
        <StatPill icon={Activity} label="Configured / Stopped" value={stats.configuredStopped} accent="#facc15" />
        <StatPill icon={SettingsIcon} label="No Token" value={stats.noToken} accent="#94a3b8" />
        <StatPill icon={X} label="Crashed" value={stats.crashed} accent="#f87171" />
      </div>

      {/* FILTERS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 360 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
            <input
              placeholder="Search by admin, display name or bot username…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...S.input, paddingLeft: 34 }}
            />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ ...S.input, width: "auto" }}>
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="master">Master</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...S.input, width: "auto" }}>
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="stopped">Stopped</option>
            <option value="no_token">No Token</option>
          </select>
        </div>
        <button onClick={load} style={S.refreshBtn} disabled={loading}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, flex: 1, minHeight: 0 }}>
        {/* LEFT: list */}
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
          {loading ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: "#64748b" }}>No admins found.</div>
          ) : filtered.map((b) => {
            const live = statusMap[String(b.admin_id)];
            return (
              <div key={b.admin_id} onClick={() => setSelectedId(b.admin_id)} style={{ cursor: "pointer" }}>
                <BotCard
                  username={b.username}
                  displayName={b.display_name}
                  role={b.role}
                  botUsername={b.bot_username}
                  isActive={b.is_active}
                  tokenSet={b.main_bot_token_set}
                  running={live?.running ?? b.is_running}
                  lastRestartAt={live?.last_restart_at ?? b.last_restart_at}
                  lastCrashError={live?.last_error ?? b.last_crash_error}
                  selected={selectedId === b.admin_id}
                />
              </div>
            );
          })}
        </div>

        {/* RIGHT: detail / payments / logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          {!selected ? (
            <div style={{ ...S.card, flex: 1, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>
              Select a bot on the left to view its configuration, payments and logs.
            </div>
          ) : (
            <>
              <div style={{ ...S.card, display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(280px,1fr)", gap: 16, alignItems: "start" }}>
                {/* LEFT — bot detail + all fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800 }}>{selected.display_name || selected.username}</div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                        Admin #{selected.admin_id} · @{selected.username} · {selected.role}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => restart(selected.admin_id)} style={{ ...S.primaryBtn, padding: "7px 10px", fontSize: 11 }}>
                        <RefreshCw size={12} /> {liveStatus?.running ? "Restart" : "Start"}
                      </button>
                      <button onClick={() => stop(selected.admin_id)} style={{ ...S.primaryBtn, background: "rgba(239,68,68,.14)", color: "#f87171", padding: "7px 10px", fontSize: 11 }}>
                        Stop
                      </button>
                      <button
                        onClick={() => setModalTarget({ scope: "admin", kind: "admin", adminId: selected.admin_id, label: `${selected.display_name || selected.username}'s Bot` })}
                        style={{ ...S.primaryBtn, padding: "7px 10px", fontSize: 11 }}
                      >
                        <SettingsIcon size={12} /> Edit
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      ["Status", liveStatus?.status || (selected.is_running ? "running" : "stopped"), liveStatus?.running ? "#4ade80" : "#f87171"],
                      ["Last Restart", (liveStatus?.last_restart_at ?? selected.last_restart_at) ? new Date(liveStatus?.last_restart_at ?? selected.last_restart_at).toLocaleString() : "—", "white"],
                      ["Token Configured", selected.main_bot_token_set ? "Yes" : "No", selected.main_bot_token_set ? "#4ade80" : "#f87171"],
                      ["Default Language", selected.default_language === "fa" ? "Persian" : "English", "white"],
                      ["Bot Active Flag", selected.is_active ? "Active" : "Inactive", selected.is_active ? "#4ade80" : "#f87171"],
                      ["Bot Username", selected.bot_username ? `@${selected.bot_username}` : "—", "white"],
                      ["Last Validated", selected.last_validated_at ? new Date(selected.last_validated_at).toLocaleString() : "—", "white"],
                      ["Enabled Services", selected.enabled_services == null ? "All permitted" : `${selected.enabled_services.length} enabled`, "white"],
                    ].map(([label, val, color]) => (
                      <div key={label} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase" }}>{label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 3, wordBreak: "break-word" }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {(selected.last_validation_error || selected.last_crash_error) && (
                    <div style={{ background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.14)", borderRadius: 10, padding: 10, fontSize: 11, color: "#fda4af" }}>
                      {selected.last_validation_error || selected.last_crash_error}
                    </div>
                  )}

                  <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Services Visible in Bot</div>
                    <ServiceToggleBlock
                      accessPoints="*"
                      isFullAccess
                      enabledServices={selected.enabled_services}
                      editable
                      onToggleService={toggleService}
                    />
                  </div>
                </div>

                {/* RIGHT — Payments */}
                <div style={{ minWidth: 0 }}>
                  <PaymentsCard
                    key={`pay-${selected.admin_id}`}
                    token={token}
                    adminId={selected.admin_id}
                    title="Payments"
                    canEdit
                    description="Activate/deactivate accounts here. Add or edit them via Edit → Payment Settings."
                  />
                </div>
              </div>

              {/* Raw logs, last 24h */}
              <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Bot Logs (last 24h)</div>
                  <button onClick={() => loadLogs(selected.admin_id)} style={{ ...S.refreshBtn, padding: "5px 10px", fontSize: 11 }} disabled={logsLoading}>
                    <RefreshCw size={12} style={{ animation: logsLoading ? "spin 1s linear infinite" : "none" }} />
                    {logsLoading ? "Loading…" : "Refresh"}
                  </button>
                </div>
                {!logs?.has_timestamps && logs?.lines?.length > 0 && (
                  <div style={{ fontSize: 11, color: "#facc15" }}>
                    This log file has no timestamps — showing the most recent raw lines instead of a strict 24h window.
                  </div>
                )}
                <div style={{
                  background: "#060b16", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10,
                  padding: 12, fontFamily: "monospace", fontSize: 11, color: "#94a3b8",
                  maxHeight: 320, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {logsLoading ? "Loading logs…" : logs?.message || (logs?.lines?.length ? logs.lines.join("\n") : "No log entries in this window.")}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {modalTarget && (
        <ConfigModal token={token} target={modalTarget} onClose={() => setModalTarget(null)} onSaved={load} />
      )}
    </div>
  );
}

/* ── MAIN COMPONENT ─────────────────────────────────────────────────── */
export default function TelegramManagement() {
  const token = useMemo(() => localStorage.getItem("token"), []);
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("username") || "user";
  const ownAdminId = Number(localStorage.getItem("user_id")) || null;

  const currentUser = {
    role,
    access_points: JSON.parse(localStorage.getItem("access_points") || "[]"),
  };

  const isMaster = role === "master";
  const canManage = isMaster || hasPermission(currentUser, "telegram_global_bot_access");

  const availableTabs = [
    !isMaster && canManage && { key: "my_bot", label: "My Bot", icon: <Bot size={14} /> },
    isMaster && { key: "global_bots", label: "Global Bots", icon: <Globe size={14} /> },
    isMaster && { key: "all_bots", label: "All Admin Bots", icon: <Users size={14} /> },
  ].filter(Boolean);

  const [tab, setTab] = useState(availableTabs[0]?.key);

  /* ── MY BOT (admin) ── */
  const [myBotSettings, setMyBotSettings] = useState(null);
  const [myBotLoading, setMyBotLoading] = useState(true);
  const [myBotStatus, setMyBotStatus] = useState(null);
  const [myBotActionLoading, setMyBotActionLoading] = useState(false);
  const [myBotModalOpen, setMyBotModalOpen] = useState(false);

  const loadMyBot = async () => {
    setMyBotLoading(true);
    try {
      const [settingsRes, statusRes] = await Promise.all([
        axios.get(`${API}/admin/telegram-bot-settings/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/bot-control/status`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setMyBotSettings(settingsRes.data);
      setMyBotStatus(statusRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setMyBotLoading(false);
    }
  };

  const toggleMyService = async (key) => {
    const permittedKeys = SERVICE_CATALOG
      .filter(s => currentUser.access_points === "*" || currentUser.access_points.includes(s.key))
      .map(s => s.key);
    const current = myBotSettings?.enabled_services ?? permittedKeys;
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    try {
      const res = await axios.put(`${API}/admin/telegram-bot-settings/`, { enabled_services: next }, { headers: { Authorization: `Bearer ${token}` } });
      setMyBotSettings(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const restartMyBot = async () => {
    setMyBotActionLoading(true);
    try {
      await axios.post(`${API}/admin/bot-control/restart`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await loadMyBot();
    } catch (e) {
      console.error(e);
    } finally {
      setMyBotActionLoading(false);
    }
  };

  const stopMyBot = async () => {
    setMyBotActionLoading(true);
    try {
      await axios.post(`${API}/admin/bot-control/stop`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await loadMyBot();
    } catch (e) {
      console.error(e);
    } finally {
      setMyBotActionLoading(false);
    }
  };

  /* ── GLOBAL BOTS (master) ── */
  const [globalMain, setGlobalMain] = useState(null);
  const [globalSupport, setGlobalSupport] = useState(null);
  const [globalStatusMain, setGlobalStatusMain] = useState(null);
  const [globalStatusSupport, setGlobalStatusSupport] = useState(null);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [globalModalTarget, setGlobalModalTarget] = useState(null);
  const masterUserId = Number(localStorage.getItem("user_id")) || null;

  const loadGlobal = useCallback(async () => {
    setGlobalLoading(true);
    try {
      const [mainRes, supportRes, mainStatus, supportStatus] = await Promise.all([
        axios.get(`${API}/admin/telegram-bot-settings/global/global_main`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/telegram-bot-settings/global/support`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/bot-control/global/global_main/status`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/bot-control/global/support/status`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setGlobalMain(mainRes.data);
      setGlobalSupport(supportRes.data);
      setGlobalStatusMain(mainStatus.data);
      setGlobalStatusSupport(supportStatus.data);
    } catch (e) { console.error(e); } finally { setGlobalLoading(false); }
  }, [token]);

  const restartGlobal = async (kind) => {
    try {
      await axios.post(`${API}/admin/bot-control/global/${kind}/restart`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await loadGlobal();
    } catch (e) { console.error(e); }
  };
  const stopGlobal = async (kind) => {
    try {
      await axios.post(`${API}/admin/bot-control/global/${kind}/stop`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await loadGlobal();
    } catch (e) { console.error(e); }
  };

  const toggleGlobalService = async (kind) => async (key) => {
    const settings = kind === "global_main" ? globalMain : globalSupport;
    const permittedKeys = SERVICE_CATALOG.map(s => s.key);
    const current = settings?.enabled_services ?? permittedKeys;
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    try {
      const res = await axios.put(`${API}/admin/telegram-bot-settings/global/${kind}`, { enabled_services: next }, { headers: { Authorization: `Bearer ${token}` } });
      if (kind === "global_main") setGlobalMain(res.data);
      else setGlobalSupport(res.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (tab === "my_bot") loadMyBot();
    if (tab === "global_bots") loadGlobal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div style={{ padding: 24, color: "#f8fafc", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 28, fontWeight: 800 }}>Telegram Management</div>
        <div style={{ color: "#64748b", marginTop: 6 }}>
          {isMaster ? "Manage global bots, monitor every admin's bot, and oversee payment accounts." : "Manage your bot, its live status, and connected payment accounts."}
        </div>
      </div>

      {availableTabs.length > 1 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {availableTabs.map((t) => (
            <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)} icon={t.icon} label={t.label} />
          ))}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        {/* ═══════════════ MY BOT (admin) — 3 columns ═══════════════ */}
        {tab === "my_bot" && (
          myBotLoading ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, height: "100%" }}>
              {/* Column 1: Bot Card + quick actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <BotCard
                  username={username}
                  displayName={myBotSettings?.display_name}
                  botUsername={myBotSettings?.bot_username}
                  isActive={myBotSettings?.is_active}
                  tokenSet={myBotSettings?.main_bot_token_set}
                  running={myBotStatus?.running}
                  lastRestartAt={myBotStatus?.last_restart_at}
                  lastCrashError={myBotStatus?.last_error || myBotSettings?.last_validation_error}
                  showActions
                  actionLoading={myBotActionLoading}
                  onRestart={restartMyBot}
                  onDeactivate={stopMyBot}
                />

                <div style={S.card}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Bot & Payments</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14, lineHeight: 1.6 }}>
                    Edit your bot's token, display name, language, service visibility, and payment accounts.
                  </div>
                  <button onClick={() => setMyBotModalOpen(true)} style={{ ...S.primaryBtn, width: "100%", justifyContent: "center" }}>
                    <SettingsIcon size={14} /> Manage Bot &amp; Payments
                  </button>
                </div>
              </div>

              {/* Column 2: Payments (activate-only view) */}
              <PaymentsCard
                token={token}
                adminId={ownAdminId}
                title="Payments"
                canEdit
                description="This bank account is connected to your bot — your users see whichever one is marked Active. Add or edit via Manage Bot & Payments."
              />

              {/* Column 3: Live status */}
              <LiveStatusCard
                botUsername={myBotSettings?.bot_username}
                displayName={myBotSettings?.display_name}
                username={username}
                accessPoints={currentUser.access_points}
                isFullAccess={currentUser.access_points === "*" || currentUser.access_points.includes("*")}
                defaultLanguage={myBotSettings?.default_language}
                isActive={myBotSettings?.is_active}
                editable
                enabledServices={myBotSettings?.enabled_services}
                onToggleService={toggleMyService}
              />
            </div>
          )
        )}

        {/* ═══════════════ GLOBAL BOTS (master) — 3 columns, left stacked ═══ */}
        {tab === "global_bots" && (
          globalLoading ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, height: "100%" }}>
              {/* Column 1: stacked global bot cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <BotCard
                  username="Global Main Bot"
                  displayName={globalMain?.display_name}
                  botUsername={globalMain?.bot_username}
                  isActive={globalMain?.is_active}
                  tokenSet={globalMain?.main_bot_token_set}
                  running={globalStatusMain?.running}
                  lastRestartAt={globalStatusMain?.last_restart_at}
                  lastCrashError={globalStatusMain?.last_error || globalMain?.last_validation_error}
                  showActions
                  showEdit
                  onRestart={() => restartGlobal("global_main")}
                  onDeactivate={() => stopGlobal("global_main")}
                  onEdit={() => setGlobalModalTarget({ scope: "global", kind: "global_main", masterAdminId: masterUserId, label: "Global Main Bot" })}
                />
                <BotCard
                  username="Support Bot"
                  displayName={globalSupport?.display_name}
                  botUsername={globalSupport?.bot_username}
                  isActive={globalSupport?.is_active}
                  tokenSet={globalSupport?.main_bot_token_set}
                  running={globalStatusSupport?.running}
                  lastRestartAt={globalStatusSupport?.last_restart_at}
                  lastCrashError={globalStatusSupport?.last_error || globalSupport?.last_validation_error}
                  showActions
                  showEdit
                  onRestart={() => restartGlobal("support")}
                  onDeactivate={() => stopGlobal("support")}
                  onEdit={() => setGlobalModalTarget({ scope: "global", kind: "support", masterAdminId: masterUserId, label: "Support Bot" })}
                />
              </div>

              {/* Column 2: Payments (master's own accounts) */}
              <PaymentsCard
                token={token}
                adminId={masterUserId}
                title="Payments"
                canEdit
                description="This bank account is connected to your bot — your users see whichever one is marked Active. Add or edit via each bot's Edit button."
              />

              {/* Column 3: Live status (main bot = what users see) — now editable */}
              <LiveStatusCard
                botUsername={globalMain?.bot_username}
                displayName={globalMain?.display_name}
                username={username}
                accessPoints="*"
                isFullAccess
                defaultLanguage={globalMain?.default_language}
                isActive={globalMain?.is_active}
                editable
                enabledServices={globalMain?.enabled_services}
                onToggleService={toggleGlobalService("global_main")}
              />
            </div>
          )
        )}

        {/* ═══════════════ ALL ADMIN BOTS (master) ═══════════════ */}
        {tab === "all_bots" && <AllAdminBotsTab token={token} />}
      </div>

      {globalModalTarget && (
        <ConfigModal token={token} target={globalModalTarget} onClose={() => setGlobalModalTarget(null)} onSaved={loadGlobal} />
      )}

      {myBotModalOpen && (
        <ConfigModal
          token={token}
          target={{ scope: "admin", kind: "admin", adminId: ownAdminId, label: "My Bot" }}
          onClose={() => setMyBotModalOpen(false)}
          onSaved={loadMyBot}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}