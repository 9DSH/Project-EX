import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Building2, Plus, Save, Trash2, ToggleLeft, ToggleRight, Globe, Settings } from "lucide-react";

const API = "http://127.0.0.1:8000";

const emptyForm = () => ({
  bank_name: "",
  bank_holder_name: "",
  bank_card_number: "",
  bank_sheba: "",
  is_active: false,
});

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fa", label: "Persian (فارسی)" },
];

export default function AdminProfile() {
  const [activeTab, setActiveTab] = useState("bank"); // "bank" | "bot_settings"

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Telegram Bot Settings
  const [botSettings, setBotSettings] = useState({ default_language: "en" });
  const [botSettingsLoading, setBotSettingsLoading] = useState(true);
  const [botSettingsSaving, setBotSettingsSaving] = useState(false);
  const [botSettingsError, setBotSettingsError] = useState("");
  const [botSettingsSuccess, setBotSettingsSuccess] = useState("");

  const token = useMemo(() => localStorage.getItem("token"), []);

  const loadAccounts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/admin/platform-bank-accounts/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAccounts(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load bank accounts.");
    } finally {
      setLoading(false);
    }
  };

  const loadBotSettings = async () => {
    setBotSettingsLoading(true);
    setBotSettingsError("");
    try {
      const res = await axios.get(`${API}/admin/telegram-bot-settings/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBotSettings({ default_language: res.data?.default_language || "en" });
    } catch (e) {
      // If the endpoint / row doesn't exist yet, fall back to English rather
      // than blocking the tab.
      setBotSettings({ default_language: "en" });
      setBotSettingsError(e?.response?.data?.detail || "");
    } finally {
      setBotSettingsLoading(false);
    }
  };

  const saveBotSettings = async () => {
    setBotSettingsSaving(true);
    setBotSettingsError("");
    setBotSettingsSuccess("");
    try {
      await axios.put(
        `${API}/admin/telegram-bot-settings/`,
        { default_language: botSettings.default_language },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBotSettingsSuccess("Default language updated.");
    } catch (e) {
      setBotSettingsError(e?.response?.data?.detail || "Failed to save bot settings.");
    } finally {
      setBotSettingsSaving(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    loadBotSettings();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (editingId) {
        await axios.put(`${API}/admin/platform-bank-accounts/${editingId}`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSuccess("Bank account updated.");
      } else {
        await axios.post(`${API}/admin/platform-bank-accounts/`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSuccess("Bank account created.");
      }
      setForm(emptyForm());
      setEditingId(null);
      await loadAccounts();
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to save bank account.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (account) => {
    setEditingId(account.id);
    setForm({
      bank_name: account.bank_name || "",
      bank_holder_name: account.bank_holder_name || "",
      bank_card_number: account.bank_card_number || "",
      bank_sheba: account.bank_sheba || "",
      is_active: account.is_active || false,
    });
  };

  const handleActivate = async (account) => {
    try {
      await axios.put(`${API}/admin/platform-bank-accounts/${account.id}`, { is_active: true }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadAccounts();
      setSuccess("Active bank account updated.");
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to activate bank account.");
    }
  };

  const handleDelete = async (account) => {
    if (!window.confirm("Delete this bank account?")) return;
    try {
      await axios.delete(`${API}/admin/platform-bank-accounts/${account.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadAccounts();
      setSuccess("Bank account removed.");
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to delete bank account.");
    }
  };

  const TabButton = ({ id, icon, label }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderRadius: 10,
          border: isActive ? "1px solid rgba(59,130,246,.4)" : "1px solid rgba(255,255,255,.08)",
          background: isActive ? "rgba(59,130,246,.16)" : "transparent",
          color: isActive ? "#93c5fd" : "#94a3b8",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div style={{ padding: 24, color: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>Admin Profile</div>
          <div style={{ color: "#64748b", marginTop: 6 }}>Manage your bank accounts and Telegram bot configuration.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.24)" }}>
          <Building2 size={16} color="#93c5fd" />
          <span style={{ fontSize: 13, fontWeight: 700 }}>IRT Bank Account</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <TabButton id="bank" icon={<Building2 size={14} />} label="Bank Accounts" />
        <TabButton id="bot_settings" icon={<Settings size={14} />} label="Telegram Bot Settings" />
      </div>

      {activeTab === "bank" ? (
        <>
      {error ? <div style={{ marginBottom: 12, color: "#fda4af", fontSize: 13 }}>{error}</div> : null}
      {success ? <div style={{ marginBottom: 12, color: "#86efac", fontSize: 13 }}>{success}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20, alignItems: "start" }}>
        <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Configured Accounts</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{accounts.length} total</div>
          </div>

          {loading ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : accounts.length === 0 ? (
            <div style={{ color: "#64748b" }}>No bank accounts yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {accounts.map((account) => (
                <div key={account.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: 12, background: "rgba(255,255,255,.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{account.bank_name || "Unnamed account"}</div>
                    {account.is_active ? <span style={{ padding: "4px 8px", borderRadius: 999, fontSize: 11, background: "rgba(34,197,94,.14)", color: "#86efac" }}>Active</span> : <span style={{ padding: "4px 8px", borderRadius: 999, fontSize: 11, background: "rgba(255,255,255,.05)", color: "#94a3b8" }}>Inactive</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                    <div><strong>Created by:</strong> {account.admin_id || "—"}</div>
                    <div><strong>Holder:</strong> {account.bank_holder_name || "—"}</div>
                    <div><strong>Card:</strong> {account.bank_card_number || "—"}</div>
                    <div><strong>Sheba:</strong> {account.bank_sheba || "—"}</div>
                    {account.has_transactions ? <div style={{ color: "#fbbf24", marginTop: 4 }}>Immutable due to transaction history.</div> : null}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={() => handleEdit(account)} style={{ background: "rgba(59,130,246,.16)", border: "1px solid rgba(59,130,246,.25)", color: "#93c5fd", padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Edit</button>
                    {!account.is_active ? <button onClick={() => handleActivate(account)} style={{ background: "rgba(34,197,94,.16)", border: "1px solid rgba(34,197,94,.24)", color: "#86efac", padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Set Active</button> : null}
                    {!account.has_transactions ? <button onClick={() => handleDelete(account)} style={{ background: "rgba(248,113,113,.14)", border: "1px solid rgba(248,113,113,.22)", color: "#fda4af", padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Delete</button> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Edit Bank Account" : "Add Bank Account"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input style={{ ...styles.input }} placeholder="Bank name" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} required />
            <input style={{ ...styles.input }} placeholder="Account holder" value={form.bank_holder_name} onChange={(e) => setForm({ ...form, bank_holder_name: e.target.value })} required />
            <input style={{ ...styles.input }} placeholder="Card number" value={form.bank_card_number} onChange={(e) => setForm({ ...form, bank_card_number: e.target.value })} required />
            <input style={{ ...styles.input }} placeholder="Sheba" value={form.bank_sheba} onChange={(e) => setForm({ ...form, bank_sheba: e.target.value })} required />
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13 }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Mark as active account
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button type="submit" disabled={saving} style={{ ...styles.primaryBtn, opacity: saving ? 0.7 : 1 }}>
              <Save size={14} /> {saving ? "Saving…" : editingId ? "Save Changes" : "Create Account"}
            </button>
          </div>
        </form>
      </div>
        </>
      ) : (
        <div style={{ maxWidth: 560 }}>
          {botSettingsError ? <div style={{ marginBottom: 12, color: "#fda4af", fontSize: 13 }}>{botSettingsError}</div> : null}
          {botSettingsSuccess ? <div style={{ marginBottom: 12, color: "#86efac", fontSize: 13 }}>{botSettingsSuccess}</div> : null}

          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Globe size={16} color="#93c5fd" />
              <div style={{ fontSize: 16, fontWeight: 700 }}>Default Language</div>
            </div>
            <div style={{ color: "#64748b", fontSize: 13, marginBottom: 14 }}>
              New users who message your Telegram bot will see it in this language until they change it
              themselves with the bot's "🌐 Language" button.
            </div>

            {botSettingsLoading ? (
              <div style={{ color: "#64748b" }}>Loading…</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const isSelected = botSettings.default_language === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setBotSettings({ ...botSettings, default_language: opt.value })}
                        style={{
                          flex: 1,
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: isSelected ? "1px solid rgba(34,197,94,.4)" : "1px solid rgba(255,255,255,.1)",
                          background: isSelected ? "rgba(34,197,94,.14)" : "#0b1220",
                          color: isSelected ? "#86efac" : "#e2e8f0",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={saveBotSettings}
                  disabled={botSettingsSaving}
                  style={{ ...styles.primaryBtn, opacity: botSettingsSaving ? 0.7 : 1 }}
                >
                  <Save size={14} /> {botSettingsSaving ? "Saving…" : "Save Settings"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  input: {
    width: "100%",
    background: "#0b1220",
    border: "1px solid rgba(255,255,255,.1)",
    color: "white",
    padding: "10px 12px",
    borderRadius: 10,
    outline: "none",
    boxSizing: "border-box",
  },
  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "none",
    borderRadius: 10,
    background: "rgba(59,130,246,.18)",
    color: "#93c5fd",
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 700,
  },
  secondaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 10,
    background: "transparent",
    color: "#94a3b8",
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 700,
  },
};