import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { Bot, Globe, Users, Save, RefreshCw, Search, X, CreditCard, Activity, Radio } from "lucide-react";
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
};

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

/* ── PAYMENTS CARD (inline editable, scoped to one admin_id) ───────── */
function PaymentsCard({ token, adminId, title = "Payments", canEdit = true, description }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyBankForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

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
    setError(""); setSuccess("");
    try {
      if (editingId) {
        await axios.put(`${API}/admin/platform-bank-accounts/${editingId}`, form, { headers: { Authorization: `Bearer ${token}` } });
        setSuccess("Bank account updated.");
      } else {
        await axios.post(`${API}/admin/platform-bank-accounts/`, form, { headers: { Authorization: `Bearer ${token}` } });
        setSuccess("Bank account created.");
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
  };

  const activate = async (a) => {
    try {
      await axios.put(`${API}/admin/platform-bank-accounts/${a.id}`, { is_active: true }, { headers: { Authorization: `Bearer ${token}` } });
      await load();
    } catch (e) { setError(e?.response?.data?.detail || "Failed to activate."); }
  };

  const remove = async (a) => {
    if (!confirm("Delete this bank account?")) return;
    try {
      await axios.delete(`${API}/admin/platform-bank-accounts/${a.id}`, { headers: { Authorization: `Bearer ${token}` } });
      await load();
    } catch (e) { setError(e?.response?.data?.detail || "Failed to delete."); }
  };

  return (
    <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CreditCard size={15} color="#93c5fd" />
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
        </div>
        {canEdit && (
          <button
            onClick={() => { setShowForm(v => !v); setEditingId(null); setForm(emptyBankForm()); }}
            style={{ ...S.primaryBtn, padding: "6px 10px", fontSize: 12 }}
          >
            {showForm ? "Close" : "+ Add"}
          </button>
        )}
      </div>

      {description && (
        <div style={{ color: "#64748b", fontSize: 12, marginTop: -6 }}>{description}</div>
      )}

      {error && <div style={{ color: "#fda4af", fontSize: 12 }}>{error}</div>}
      {success && <div style={{ color: "#86efac", fontSize: 12 }}>{success}</div>}

      {showForm && canEdit && (
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

      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
        {loading ? (
          <div style={{ color: "#64748b", fontSize: 12 }}>Loading…</div>
        ) : accounts.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 12 }}>No bank accounts yet.</div>
        ) : accounts.map((a) => (
          <div key={a.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: 12, background: "rgba(255,255,255,.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{a.bank_name || "Unnamed account"}</div>
              {a.is_active
                ? <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, background: "rgba(34,197,94,.14)", color: "#86efac" }}>Active</span>
                : <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, background: "rgba(255,255,255,.05)", color: "#94a3b8" }}>Inactive</span>}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
              <div><strong>Holder:</strong> {a.bank_holder_name || "—"}</div>
              <div><strong>Card:</strong> {a.bank_card_number || "—"}</div>
              <div><strong>Sheba:</strong> {a.bank_sheba || "—"}</div>
              {a.has_transactions && <div style={{ color: "#fbbf24", marginTop: 4 }}>Immutable — has transaction history.</div>}
            </div>
            {canEdit && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <button onClick={() => edit(a)} style={{ background: "rgba(59,130,246,.16)", border: "1px solid rgba(59,130,246,.25)", color: "#93c5fd", padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Edit</button>
                {!a.is_active && <button onClick={() => activate(a)} style={{ background: "rgba(34,197,94,.16)", border: "1px solid rgba(34,197,94,.24)", color: "#86efac", padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Set Active</button>}
                {!a.has_transactions && <button onClick={() => remove(a)} style={{ background: "rgba(248,113,113,.14)", border: "1px solid rgba(248,113,113,.22)", color: "#fda4af", padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Delete</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── LIVE STATUS CARD — what the bot actually shows users ──────────── */
function LiveStatusCard({
  botUsername, displayName, username, accessPoints, isFullAccess,
  defaultLanguage, isActive, editable = false, enabledServices, onToggleService,
}) {
  const permitted = isFullAccess
    ? SERVICE_CATALOG
    : SERVICE_CATALOG.filter(s => (accessPoints || []).includes(s.key));

  const isOn = (key) => enabledServices == null ? true : enabledServices.includes(key);

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
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Shown next to products/orders instead of the raw username. Edit it in Bot Configuration.</div>
      </div>

      <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
          Services Visible in Bot
        </div>
        {permitted.length === 0 ? (
          <div style={{ fontSize: 12, color: "#64748b" }}>No services enabled for this account.</div>
        ) : (
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
        )}
        {editable && (
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 10 }}>
            Turning a service off hides it from your bot's menu even though you still have access to it — turn it back on anytime.
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

/* ── CONFIG (+ optional Payments) MODAL — used by Master to edit any bot ─ */
function ConfigModal({ token, target, onClose, onSaved }) {
  // target: { scope: 'admin' | 'global', kind: 'admin'|'global_main'|'support', adminId, label }
  const [tab, setTab] = useState("config");
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokenInput, setTokenInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getUrl = () => target.scope === "global"
    ? `${API}/admin/telegram-bot-settings/global/${target.kind}`
    : `${API}/admin/telegram-bot-settings/${target.adminId}`;

  const setDisplayNameUrl = () => target.scope === "global"
    ? `${API}/admin/telegram-bot-settings/global/${target.kind}/set-display-name`
    : `${API}/admin/telegram-bot-settings/${target.adminId}/set-display-name`;

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
    setError(""); setSuccess("");
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
      setSuccess("Saved.");
      onSaved?.();
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to save.");
    } finally {
      setSaving(false);
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

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ width: "92%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto", background: "#0d1424", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{target.label}</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", color: "#94a3b8", width: 30, height: 30, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        </div>



        {error && <div style={{ color: "#fda4af", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {success && <div style={{ color: "#86efac", fontSize: 12, marginBottom: 10 }}>{success}</div>}

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

              <button onClick={save} disabled={saving} style={{ ...S.primaryBtn, justifyContent: "center", opacity: saving ? 0.7 : 1 }}>
                <Save size={14} /> {saving ? "Saving…" : "Save Settings"}
              </button>
            </div>
          )
        )}

      </div>
    </div>
  );
}

/* ── ALL ADMIN BOTS TAB (master) ────────────────────────────────────── */
function AllAdminBotsTab({ token }) {
  const [bots, setBots] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return bots;
    return bots.filter(b =>
      (b.username || "").toLowerCase().includes(q) ||
      (b.display_name || "").toLowerCase().includes(q) ||
      (b.bot_username || "").toLowerCase().includes(q) ||
      String(b.admin_id).includes(q)
    );
  }, [bots, search]);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
          <input
            placeholder="Search by admin, display name or bot username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...S.input, paddingLeft: 34 }}
          />
        </div>
        <button onClick={load} style={S.refreshBtn} disabled={loading}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14, flex: 1, minHeight: 0 }}>
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
          <div
            style={{
              ...S.card,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.5fr) minmax(360px, 1fr)",
              gap: 20,
              alignItems: "start",
            }}
          >
            {/* LEFT — Bot Details */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>
                    {selected.display_name || selected.username}
                  </div>

                  <div
                    style={{
                      color: "#64748b",
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    Admin #{selected.admin_id} · @{selected.username} · {selected.role}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => restart(selected.admin_id)}
                    style={{
                      ...S.primaryBtn,
                      padding: "8px 12px",
                      fontSize: 12,
                    }}
                  >
                    <RefreshCw size={13} />
                    {liveStatus?.running ? "Restart" : "Start"}
                  </button>

                  <button
                    onClick={() => stop(selected.admin_id)}
                    style={{
                      ...S.primaryBtn,
                      background: "rgba(239,68,68,.14)",
                      color: "#f87171",
                      padding: "8px 12px",
                      fontSize: 12,
                    }}
                  >
                    Stop
                  </button>

                  <button
                    onClick={() =>
                      setModalTarget({
                        scope: "admin",
                        kind: "admin",
                        adminId: selected.admin_id,
                        label: `${selected.display_name || selected.username}'s Bot`,
                      })
                    }
                    style={{
                      ...S.primaryBtn,
                      padding: "8px 12px",
                      fontSize: 12,
                    }}
                  >
                    Edit Config
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid rgba(255,255,255,.07)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#64748b",
                      textTransform: "uppercase",
                    }}
                  >
                    Status
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: liveStatus?.running ? "#4ade80" : "#f87171",
                      marginTop: 4,
                    }}
                  >
                    {liveStatus?.status ||
                      (selected.is_running ? "running" : "stopped")}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid rgba(255,255,255,.07)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#64748b",
                      textTransform: "uppercase",
                    }}
                  >
                    Last Restart
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "white",
                      marginTop: 4,
                    }}
                  >
                    {(liveStatus?.last_restart_at ?? selected.last_restart_at)
                      ? new Date(
                          liveStatus?.last_restart_at ?? selected.last_restart_at
                        ).toLocaleString()
                      : "—"}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid rgba(255,255,255,.07)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#64748b",
                      textTransform: "uppercase",
                    }}
                  >
                    Token Configured
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: selected.main_bot_token_set
                        ? "#4ade80"
                        : "#f87171",
                      marginTop: 4,
                    }}
                  >
                    {selected.main_bot_token_set ? "Yes" : "No"}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid rgba(255,255,255,.07)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#64748b",
                      textTransform: "uppercase",
                    }}
                  >
                    Default Language
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "white",
                      marginTop: 4,
                    }}
                  >
                    {selected.default_language === "fa"
                      ? "Persian"
                      : "English"}
                  </div>
                </div>
              </div>

              {selected.last_validation_error && (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Last Token Validation Error
                  </div>

                  <div
                    style={{
                      background: "rgba(239,68,68,.06)",
                      border: "1px solid rgba(239,68,68,.14)",
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 12,
                      color: "#fda4af",
                    }}
                  >
                    {selected.last_validation_error}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — Payments */}
            <div style={{ minWidth: 0 }}>
              <PaymentsCard
                key={`pay-${selected.admin_id}`}
                token={token}
                adminId={selected.admin_id}
                title="Payments"
                canEdit
                description="This bank account is connected to this admin's bot — their users see whichever one is marked Active."
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
  const [myTokenInput, setMyTokenInput] = useState("");
  const [myDisplayNameInput, setMyDisplayNameInput] = useState("");
  const [myBotSaving, setMyBotSaving] = useState(false);
  const [myBotError, setMyBotError] = useState("");
  const [myBotSuccess, setMyBotSuccess] = useState("");
  const [myBotActionLoading, setMyBotActionLoading] = useState(false);

  const loadMyBot = async () => {
    setMyBotLoading(true);
    setMyBotError("");
    try {
      const [settingsRes, statusRes] = await Promise.all([
        axios.get(`${API}/admin/telegram-bot-settings/`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/bot-control/status`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setMyBotSettings(settingsRes.data);
      setMyDisplayNameInput(settingsRes.data.display_name || "");
      setMyBotStatus(statusRes.data);
    } catch (e) {
      setMyBotError(e?.response?.data?.detail || "Failed to load bot settings.");
    } finally {
      setMyBotLoading(false);
    }
  };

  const saveMyBot = async () => {
    setMyBotSaving(true);
    setMyBotError(""); setMyBotSuccess("");
    try {
      const payload = { default_language: myBotSettings.default_language, is_active: myBotSettings.is_active };
      if (myTokenInput.trim()) payload.main_bot_token = myTokenInput.trim();
      let res = await axios.put(`${API}/admin/telegram-bot-settings/`, payload, { headers: { Authorization: `Bearer ${token}` } });
      if (myDisplayNameInput.trim() && myDisplayNameInput.trim() !== (myBotSettings.display_name || "")) {
        res = await axios.post(`${API}/admin/telegram-bot-settings/set-display-name`, { display_name: myDisplayNameInput.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      }
      setMyBotSettings(res.data);
      setMyTokenInput("");
      setMyBotSuccess("Settings saved.");
    } catch (e) {
      setMyBotError(e?.response?.data?.detail || "Failed to save.");
    } finally {
      setMyBotSaving(false);
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
      setMyBotError(e?.response?.data?.detail || "Failed to update services.");
    }
  };

  const restartMyBot = async () => {
    setMyBotActionLoading(true);
    try {
      await axios.post(`${API}/admin/bot-control/restart`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await loadMyBot();
    } catch (e) {
      setMyBotError(e?.response?.data?.detail || "Restart failed.");
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
      setMyBotError(e?.response?.data?.detail || "Stop failed.");
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
              {/* Column 1: Bot Card + config */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {myBotError && <div style={{ color: "#fda4af", fontSize: 12 }}>{myBotError}</div>}
                {myBotSuccess && <div style={{ color: "#86efac", fontSize: 12 }}>{myBotSuccess}</div>}

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
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Bot Configuration</div>

                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Display Name (shown to users)</div>
                  <input style={{ ...S.input, marginBottom: 12 }} placeholder="e.g. Premium Store" value={myDisplayNameInput} onChange={(e) => setMyDisplayNameInput(e.target.value)} />

                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Default Language</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {LANGUAGE_OPTIONS.map((opt) => {
                      const selected = myBotSettings?.default_language === opt.value;
                      return (
                        <button key={opt.value} onClick={() => setMyBotSettings({ ...myBotSettings, default_language: opt.value })}
                          style={{ flex: 1, padding: "10px 10px", borderRadius: 10, border: selected ? "1px solid rgba(34,197,94,.4)" : "1px solid rgba(255,255,255,.1)", background: selected ? "rgba(34,197,94,.14)" : "#0b1220", color: selected ? "#86efac" : "#e2e8f0", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Bot Token</div>
                  <input style={{ ...S.input, marginBottom: 8 }} type="password" placeholder={myBotSettings?.main_bot_token_masked || "Paste bot token"} value={myTokenInput} onChange={(e) => setMyTokenInput(e.target.value)} />
                  {myBotSettings?.last_validation_error && (
                    <div style={{ fontSize: 11, color: "#fda4af", marginBottom: 8 }}>Last error: {myBotSettings.last_validation_error}</div>
                  )}

                  <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>
                    <input type="checkbox" checked={!!myBotSettings?.is_active} onChange={(e) => setMyBotSettings({ ...myBotSettings, is_active: e.target.checked })} />
                    Bot active
                  </label>

                  <button onClick={saveMyBot} disabled={myBotSaving} style={{ ...S.primaryBtn, width: "100%", justifyContent: "center", opacity: myBotSaving ? 0.7 : 1 }}>
                    <Save size={14} /> {myBotSaving ? "Saving…" : "Save Settings"}
                  </button>
                </div>
              </div>

              {/* Column 2: Payments */}
              <PaymentsCard 
              token={token} 
              adminId={masterUserId /* not used for non-master; adminId omitted below */} 
              title="Payments" 
              canEdit   
              description="This bank account is connected to your bot — your users see whichever one is marked Active."
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
                  onEdit={() => setGlobalModalTarget({ scope: "global", kind: "global_main", label: "Global Main Bot" })}
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
                  onEdit={() => setGlobalModalTarget({ scope: "global", kind: "support", label: "Support Bot" })}
                />
              </div>

              {/* Column 2: Payments (master's own accounts) */}
              <PaymentsCard 
              token={token} 
              adminId={masterUserId} 
              title="Payments" 
              canEdit 
              description="This bank account is connected to your bot — your users see whichever one is marked Active."
              />

              {/* Column 3: Live status (main bot = what users see) */}
              <LiveStatusCard
                botUsername={globalMain?.bot_username}
                displayName={globalMain?.display_name}
                username={username}
                accessPoints={currentUser.access_points}
                isFullAccess
                defaultLanguage={globalMain?.default_language}
                isActive={globalMain?.is_active}
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── MASTER PAYMENTS TAB (all admins, grouped) ──────────────────────── */
function MasterPaymentsTab({ token }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/platform-bank-accounts/`, { headers: { Authorization: `Bearer ${token}` } });
      setAccounts(res.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q ? accounts.filter(a => String(a.admin_id).includes(q) || (a.bank_name || "").toLowerCase().includes(q)) : accounts;
    const map = {};
    for (const a of filtered) {
      const key = a.admin_id ?? "unknown";
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    return map;
  }, [accounts, search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
          <input placeholder="Search by admin ID or bank name…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...S.input, paddingLeft: 34 }} />
        </div>
        <button onClick={load} style={S.refreshBtn} disabled={loading}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div style={{ ...S.card, overflowY: "auto", flex: 1 }}>
        {loading ? (
          <div style={{ color: "#64748b" }}>Loading…</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ color: "#64748b" }}>No bank accounts found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {Object.entries(grouped).map(([adminId, list]) => (
              <div key={adminId}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>Admin #{adminId}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                  {list.map((a) => (
                    <div key={a.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: 12, background: "rgba(255,255,255,.03)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{a.bank_name || "Unnamed account"}</div>
                        {a.is_active
                          ? <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, background: "rgba(34,197,94,.14)", color: "#86efac" }}>Active</span>
                          : <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, background: "rgba(255,255,255,.05)", color: "#94a3b8" }}>Inactive</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
                        <div><strong>Holder:</strong> {a.bank_holder_name || "—"}</div>
                        <div><strong>Card:</strong> {a.bank_card_number || "—"}</div>
                        <div><strong>Sheba:</strong> {a.bank_sheba || "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}