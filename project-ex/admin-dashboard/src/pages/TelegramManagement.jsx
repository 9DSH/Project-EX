import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Bot, Building2, Globe, Save, Users, RefreshCw } from "lucide-react";
import BotCard from "../components/BotCard";
import { hasPermission } from "../utils/permissions";

const API = "http://127.0.0.1:8000";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fa", label: "Persian (فارسی)" },
];

const emptyBankForm = () => ({
  bank_name: "",
  bank_holder_name: "",
  bank_card_number: "",
  bank_sheba: "",
  is_active: false,
});

const S = {
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
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
  card: {
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 16,
    padding: 16,
  },
  refreshBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "1px solid #313d58ff",
    borderRadius: 10,
    padding: "8px 14px",
    color: "#6c798dff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  },
};

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 10,
        border: active ? "1px solid rgba(59,130,246,.4)" : "1px solid rgba(255,255,255,.08)",
        background: active ? "rgba(59,130,246,.16)" : "transparent",
        color: active ? "#93c5fd" : "#94a3b8",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export default function TelegramManagement() {
  const token = useMemo(() => localStorage.getItem("token"), []);
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("username") || "user";
  const currentUserId = Number(localStorage.getItem("user_id")) || null;

  const currentUser = {
    role,
    access_points: JSON.parse(localStorage.getItem("access_points") || "[]"),
  };

  const isMaster = role === "master";
  const canSeeGlobalBots = isMaster; // global bot config is master-only
  const canSeeAllBots = isMaster;
  const canSeeOwnBot = hasPermission(currentUser, "telegram_global_bot_access") || true; // every admin has their own bot tab
  const canSeeAllPayments = isMaster;

  const availableTabs = [
    !isMaster && { key: "my_bot", label: "My Bot", icon: <Bot size={14} /> },
    isMaster && { key: "global_bots", label: "Global Bots", icon: <Globe size={14} /> },
    isMaster && { key: "all_bots", label: "All Admin Bots", icon: <Users size={14} /> },
    { key: "payments", label: "Payments", icon: <Building2 size={14} /> },
  ].filter(Boolean);

  const [tab, setTab] = useState(availableTabs[0]?.key);

  // ── MY BOT (admin) ──
  const [myBotSettings, setMyBotSettings] = useState(null);
  const [myBotLoading, setMyBotLoading] = useState(true);
  const [myBotStatus, setMyBotStatus] = useState(null);
  const [myTokenInput, setMyTokenInput] = useState("");
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
      setMyBotStatus(statusRes.data);
    } catch (e) {
      setMyBotError(e?.response?.data?.detail || "Failed to load bot settings.");
    } finally {
      setMyBotLoading(false);
    }
  };

  const saveMyBot = async () => {
    setMyBotSaving(true);
    setMyBotError("");
    setMyBotSuccess("");
    try {
      const payload = {
        default_language: myBotSettings.default_language,
        is_active: myBotSettings.is_active,
      };
      if (myTokenInput.trim()) payload.main_bot_token = myTokenInput.trim();
      const res = await axios.put(`${API}/admin/telegram-bot-settings/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyBotSettings(res.data);
      setMyTokenInput("");
      setMyBotSuccess("Settings saved.");
    } catch (e) {
      setMyBotError(e?.response?.data?.detail || "Failed to save.");
    } finally {
      setMyBotSaving(false);
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

  // ── GLOBAL BOTS (master) ──
  const [globalSettings, setGlobalSettings] = useState(null);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [supportTokenInput, setSupportTokenInput] = useState("");
  const [mainTokenInput, setMainTokenInput] = useState("");
  const [globalSavingBot, setGlobalSavingBot] = useState(null);
  const [globalError, setGlobalError] = useState("");
  const [globalSuccess, setGlobalSuccess] = useState("");

  const loadGlobalSettings = async () => {
    setGlobalLoading(true);
    try {
      const res = await axios.get(`${API}/admin/global-bot-settings/`, { headers: { Authorization: `Bearer ${token}` } });
      setGlobalSettings(res.data);
    } catch (e) {
      setGlobalError(e?.response?.data?.detail || "Failed to load");
    } finally {
      setGlobalLoading(false);
    }
  };

  const connectGlobalBot = async (type) => {
    const isSupport = type === "support";
    const value = isSupport ? supportTokenInput.trim() : mainTokenInput.trim();
    if (!value) { setGlobalError("Please enter a bot token."); return; }

    setGlobalSavingBot(type);
    setGlobalError("");
    setGlobalSuccess("");
    try {
      const payload = isSupport ? { support_bot_token: value } : { main_bot_token: value };
      const res = await axios.put(`${API}/admin/global-bot-settings/`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setGlobalSettings(res.data);
      if (isSupport) setSupportTokenInput(""); else setMainTokenInput("");
      setGlobalSuccess(`${isSupport ? "Support" : "Main"} bot connected successfully.`);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setGlobalError(typeof detail === "object" ? `${detail.message || "Connection failed"}${detail.error ? ` — ${detail.error}` : ""}` : detail || "Failed to connect bot.");
    } finally {
      setGlobalSavingBot(null);
    }
  };

  // ── ALL ADMIN BOTS (master) ──
  const [allBots, setAllBots] = useState([]);
  const [allBotsStatus, setAllBotsStatus] = useState({});
  const [allBotsLoading, setAllBotsLoading] = useState(true);
  const [allBotsActionLoading, setAllBotsActionLoading] = useState(null);

  const loadAllBots = async () => {
    setAllBotsLoading(true);
    try {
      const [settingsRes, statusRes] = await Promise.all([
        axios.get(`${API}/admin/telegram-bot-settings/all`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/bot-control/status-all`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setAllBots(settingsRes.data);
      setAllBotsStatus(statusRes.data || {});
    } catch (e) {
      console.error(e);
    } finally {
      setAllBotsLoading(false);
    }
  };

  const restartAdminBot = async (adminId) => {
    setAllBotsActionLoading(adminId);
    try {
      await axios.post(`${API}/admin/bot-control/restart/${adminId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await loadAllBots();
    } catch (e) {
      console.error(e);
    } finally {
      setAllBotsActionLoading(null);
    }
  };

  // ── PAYMENTS (bank accounts) ──
  const [accounts, setAccounts] = useState([]);
  const [bankLoading, setBankLoading] = useState(true);
  const [bankForm, setBankForm] = useState(emptyBankForm());
  const [editingId, setEditingId] = useState(null);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState("");
  const [bankSuccess, setBankSuccess] = useState("");

  const loadAccounts = async () => {
    setBankLoading(true);
    setBankError("");
    try {
      const res = await axios.get(`${API}/admin/platform-bank-accounts/`, { headers: { Authorization: `Bearer ${token}` } });
      setAccounts(res.data || []);
    } catch (e) {
      setBankError(e?.response?.data?.detail || "Failed to load bank accounts.");
    } finally {
      setBankLoading(false);
    }
  };

  const submitBank = async (e) => {
    e.preventDefault();
    setBankSaving(true);
    setBankError("");
    setBankSuccess("");
    try {
      if (editingId) {
        await axios.put(`${API}/admin/platform-bank-accounts/${editingId}`, bankForm, { headers: { Authorization: `Bearer ${token}` } });
        setBankSuccess("Bank account updated.");
      } else {
        await axios.post(`${API}/admin/platform-bank-accounts/`, bankForm, { headers: { Authorization: `Bearer ${token}` } });
        setBankSuccess("Bank account created.");
      }
      setBankForm(emptyBankForm());
      setEditingId(null);
      await loadAccounts();
    } catch (e) {
      setBankError(e?.response?.data?.detail || "Failed to save bank account.");
    } finally {
      setBankSaving(false);
    }
  };

  const editBank = (account) => {
    setEditingId(account.id);
    setBankForm({
      bank_name: account.bank_name || "",
      bank_holder_name: account.bank_holder_name || "",
      bank_card_number: account.bank_card_number || "",
      bank_sheba: account.bank_sheba || "",
      is_active: account.is_active || false,
    });
  };

  const activateBank = async (account) => {
    try {
      await axios.put(`${API}/admin/platform-bank-accounts/${account.id}`, { is_active: true }, { headers: { Authorization: `Bearer ${token}` } });
      await loadAccounts();
      setBankSuccess("Active bank account updated.");
    } catch (e) {
      setBankError(e?.response?.data?.detail || "Failed to activate bank account.");
    }
  };

  const deleteBank = async (account) => {
    if (!window.confirm("Delete this bank account?")) return;
    try {
      await axios.delete(`${API}/admin/platform-bank-accounts/${account.id}`, { headers: { Authorization: `Bearer ${token}` } });
      await loadAccounts();
      setBankSuccess("Bank account removed.");
    } catch (e) {
      setBankError(e?.response?.data?.detail || "Failed to delete bank account.");
    }
  };

  useEffect(() => {
    if (tab === "my_bot") loadMyBot();
    if (tab === "global_bots") loadGlobalSettings();
    if (tab === "all_bots") loadAllBots();
    if (tab === "payments") loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // group accounts by admin for master's payments view
  const accountsByAdmin = useMemo(() => {
    if (!isMaster) return null;
    const map = {};
    for (const a of accounts) {
      const key = a.admin_id ?? "unknown";
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    return map;
  }, [accounts, isMaster]);

  return (
    <div style={{ padding: 24, color: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>Telegram Management</div>
          <div style={{ color: "#64748b", marginTop: 6 }}>
            {isMaster ? "Manage global bots, monitor every admin's bot, and oversee payment accounts." : "Manage your bot connection and payment accounts."}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {availableTabs.map((t) => (
          <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)} icon={t.icon} label={t.label} />
        ))}
      </div>

      {/* ═══════════════ MY BOT (admin) ═══════════════ */}
      {tab === "my_bot" && (
        <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 16 }}>
          {myBotError && <div style={{ color: "#fda4af", fontSize: 13 }}>{myBotError}</div>}
          {myBotSuccess && <div style={{ color: "#86efac", fontSize: 13 }}>{myBotSuccess}</div>}

          {myBotLoading ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : (
            <>
              <BotCard
                username={username}
                botUsername={myBotSettings?.bot_username}
                isActive={myBotSettings?.is_active}
                tokenSet={myBotSettings?.main_bot_token_set}
                running={myBotStatus?.running}
                lastRestartAt={myBotStatus?.last_restart_at}
                lastCrashError={myBotStatus?.last_error}
                showActions
                actionLoading={myBotActionLoading}
                onRestart={restartMyBot}
                onDeactivate={stopMyBot}
              />

              <div style={S.card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Globe size={16} color="#93c5fd" />
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Default Language</div>
                </div>
                <div style={{ color: "#64748b", fontSize: 13, marginBottom: 14 }}>
                  New users on your bot see it in this language until they change it themselves.
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const selected = myBotSettings?.default_language === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setMyBotSettings({ ...myBotSettings, default_language: opt.value })}
                        style={{
                          flex: 1, padding: "12px 14px", borderRadius: 10,
                          border: selected ? "1px solid rgba(34,197,94,.4)" : "1px solid rgba(255,255,255,.1)",
                          background: selected ? "rgba(34,197,94,.14)" : "#0b1220",
                          color: selected ? "#86efac" : "#e2e8f0", cursor: "pointer", fontWeight: 700, fontSize: 13,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Bot Token</div>
                <div style={{ color: "#64748b", fontSize: 12, marginBottom: 10 }}>Paste your bot token from @BotFather to connect or replace it.</div>
                <input
                  style={S.input}
                  type="password"
                  placeholder={myBotSettings?.main_bot_token_masked || "Paste bot token"}
                  value={myTokenInput}
                  onChange={(e) => setMyTokenInput(e.target.value)}
                />

                {myBotSettings?.last_validation_error && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#fda4af" }}>
                    Last error: {myBotSettings.last_validation_error}
                  </div>
                )}

                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13, marginTop: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!myBotSettings?.is_active}
                    onChange={(e) => setMyBotSettings({ ...myBotSettings, is_active: e.target.checked })}
                  />
                  Bot active
                </label>

                <button onClick={saveMyBot} disabled={myBotSaving} style={{ ...S.primaryBtn, opacity: myBotSaving ? 0.7 : 1, marginTop: 14 }}>
                  <Save size={14} /> {myBotSaving ? "Saving…" : "Save Settings"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════ GLOBAL BOTS (master) ═══════════════ */}
      {tab === "global_bots" && (
        <div style={{ maxWidth: 900 }}>
          {globalError && <div style={{ marginBottom: 12, color: "#fda4af", fontSize: 13 }}>{globalError}</div>}
          {globalSuccess && <div style={{ marginBottom: 12, color: "#86efac", fontSize: 13 }}>{globalSuccess}</div>}

          {globalLoading ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16 }}>
              {[
                { type: "support", label: "Support Bot", desc: "Handles platform support and user communication." },
                { type: "main", label: "Global Main Bot", desc: "Primary platform bot used for global wire operations." },
              ].map(({ type, label, desc }) => {
                const isSupport = type === "support";
                const tokenSet = isSupport ? globalSettings?.support_bot_token_set : globalSettings?.main_bot_token_set;
                const tokenMasked = isSupport ? globalSettings?.support_bot_token_masked : globalSettings?.main_bot_token_masked;
                const botUsername = isSupport ? globalSettings?.support_bot_username : globalSettings?.main_bot_username;
                const running = isSupport ? globalSettings?.is_running_support : globalSettings?.is_running_main;
                const lastRestartAt = isSupport ? globalSettings?.support_last_restart_at : globalSettings?.main_last_restart_at;
                const lastCrashError = isSupport ? globalSettings?.support_last_crash_error : globalSettings?.main_last_crash_error;
                const validationError = isSupport ? globalSettings?.support_last_validation_error : globalSettings?.main_last_validation_error;
                const inputValue = isSupport ? supportTokenInput : mainTokenInput;
                const setInputValue = isSupport ? setSupportTokenInput : setMainTokenInput;

                return (
                  <div key={type} style={S.card}>
                    <BotCard
                      username={label}
                      botUsername={botUsername}
                      tokenSet={tokenSet}
                      running={running}
                      lastRestartAt={lastRestartAt}
                      lastCrashError={lastCrashError}
                    />
                    <div style={{ color: "#64748b", fontSize: 12, margin: "10px 0" }}>{desc}</div>
                    <input
                      style={S.input}
                      type="password"
                      placeholder={tokenMasked || "Enter Telegram bot token"}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      disabled={globalSavingBot === type}
                    />
                    {validationError && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#fda4af" }}>Last error: {validationError}</div>
                    )}
                    <button
                      onClick={() => connectGlobalBot(type)}
                      disabled={globalSavingBot === type || !inputValue.trim()}
                      style={{ ...S.primaryBtn, marginTop: 12, opacity: (globalSavingBot === type || !inputValue.trim()) ? 0.5 : 1 }}
                    >
                      {globalSavingBot === type ? "Connecting…" : tokenSet ? "Reconnect Bot" : "Connect Bot"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ ALL ADMIN BOTS (master) ═══════════════ */}
      {tab === "all_bots" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button onClick={loadAllBots} style={S.refreshBtn} disabled={allBotsLoading}>
              <RefreshCw size={13} style={{ animation: allBotsLoading ? "spin 1s linear infinite" : "none" }} />
              {allBotsLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {allBotsLoading ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : allBots.length === 0 ? (
            <div style={{ color: "#64748b" }}>No admins found.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {allBots.map((a) => {
                const liveStatus = allBotsStatus?.[String(a.admin_id)];
                return (
                  <BotCard
                    key={a.admin_id}
                    username={a.username}
                    role={a.role}
                    botUsername={a.bot_username}
                    isActive={a.is_active}
                    tokenSet={a.main_bot_token_set}
                    running={liveStatus?.running ?? a.is_running}
                    lastRestartAt={liveStatus?.last_restart_at ?? a.last_restart_at}
                    lastCrashError={liveStatus?.last_error ?? a.last_crash_error}
                    showActions
                    actionLoading={allBotsActionLoading === a.admin_id}
                    onRestart={() => restartAdminBot(a.admin_id)}
                    onDeactivate={() => restartAdminBot(a.admin_id) /* stop-all not exposed per-admin; restart is the safe control here */}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ PAYMENTS ═══════════════ */}
      {tab === "payments" && (
        <div>
          {bankError && <div style={{ marginBottom: 12, color: "#fda4af", fontSize: 13 }}>{bankError}</div>}
          {bankSuccess && <div style={{ marginBottom: 12, color: "#86efac", fontSize: 13 }}>{bankSuccess}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20, alignItems: "start" }}>
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  {isMaster ? "All Bank Accounts" : "Configured Accounts"}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{accounts.length} total</div>
              </div>

              {bankLoading ? (
                <div style={{ color: "#64748b" }}>Loading…</div>
              ) : accounts.length === 0 ? (
                <div style={{ color: "#64748b" }}>No bank accounts yet.</div>
              ) : isMaster ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {Object.entries(accountsByAdmin).map(([adminId, list]) => (
                    <div key={adminId}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>
                        Admin #{adminId}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {list.map((account) => (
                          <BankAccountRow
                            key={account.id}
                            account={account}
                            onEdit={editBank}
                            onActivate={activateBank}
                            onDelete={deleteBank}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {accounts.map((account) => (
                    <BankAccountRow
                      key={account.id}
                      account={account}
                      onEdit={editBank}
                      onActivate={activateBank}
                      onDelete={deleteBank}
                    />
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={submitBank} style={S.card}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{editingId ? "Edit Bank Account" : "Add Bank Account"}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input style={S.input} placeholder="Bank name" value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} required />
                <input style={S.input} placeholder="Account holder" value={bankForm.bank_holder_name} onChange={(e) => setBankForm({ ...bankForm, bank_holder_name: e.target.value })} required />
                <input style={S.input} placeholder="Card number" value={bankForm.bank_card_number} onChange={(e) => setBankForm({ ...bankForm, bank_card_number: e.target.value })} required />
                <input style={S.input} placeholder="Sheba" value={bankForm.bank_sheba} onChange={(e) => setBankForm({ ...bankForm, bank_sheba: e.target.value })} required />
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13 }}>
                  <input type="checkbox" checked={bankForm.is_active} onChange={(e) => setBankForm({ ...bankForm, is_active: e.target.checked })} />
                  Mark as active account
                </label>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button type="submit" disabled={bankSaving} style={{ ...S.primaryBtn, opacity: bankSaving ? 0.7 : 1 }}>
                  <Save size={14} /> {bankSaving ? "Saving…" : editingId ? "Save Changes" : "Create Account"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setBankForm(emptyBankForm()); }}
                    style={{ ...S.primaryBtn, background: "transparent", border: "1px solid rgba(255,255,255,.1)", color: "#94a3b8" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function BankAccountRow({ account, onEdit, onActivate, onDelete }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: 12, background: "rgba(255,255,255,.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{account.bank_name || "Unnamed account"}</div>
        {account.is_active
          ? <span style={{ padding: "4px 8px", borderRadius: 999, fontSize: 11, background: "rgba(34,197,94,.14)", color: "#86efac" }}>Active</span>
          : <span style={{ padding: "4px 8px", borderRadius: 999, fontSize: 11, background: "rgba(255,255,255,.05)", color: "#94a3b8" }}>Inactive</span>}
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
        <div><strong>Holder:</strong> {account.bank_holder_name || "—"}</div>
        <div><strong>Card:</strong> {account.bank_card_number || "—"}</div>
        <div><strong>Sheba:</strong> {account.bank_sheba || "—"}</div>
        {account.has_transactions && <div style={{ color: "#fbbf24", marginTop: 4 }}>Immutable due to transaction history.</div>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button onClick={() => onEdit(account)} style={{ background: "rgba(59,130,246,.16)", border: "1px solid rgba(59,130,246,.25)", color: "#93c5fd", padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Edit</button>
        {!account.is_active && <button onClick={() => onActivate(account)} style={{ background: "rgba(34,197,94,.16)", border: "1px solid rgba(34,197,94,.24)", color: "#86efac", padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Set Active</button>}
        {!account.has_transactions && <button onClick={() => onDelete(account)} style={{ background: "rgba(248,113,113,.14)", border: "1px solid rgba(248,113,113,.22)", color: "#fda4af", padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Delete</button>}
      </div>
    </div>
  );
}