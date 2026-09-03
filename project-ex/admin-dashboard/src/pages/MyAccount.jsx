import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Ban,
  Building2,
  Check,
  CircleUserRound,
  Clock,
  CreditCard,
  Edit2,
  Filter,
  Globe,
  Hash,
  KeyRound,
  Layers3,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Power,
  RefreshCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Wallet,
  ShoppingCart,
  Users,
  User,
  X,
  Zap,
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { API_URL } from "../config";
import ACCESS_OPTIONS, { ACCESS_GROUPS } from "../constants/AccessPoints";
import UserBalanceSidebar from "../components/UserBalanceSidebar";

const api = axios.create({ baseURL: API_URL });


// ─── SKELETON ─────────────────────────────────────────────────
const Sk = ({ w = "100%", h = 16, r = 6 }) => (
  <div style={{ width: w, height: h, borderRadius: r, background: "#111827", animation: "skpulse 1.5s ease infinite" }} />
);

// ─── STAT PILL (header) ───────────────────────────────────────
function StatPill({ icon: Icon, label, value, accent, loading }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "10px 14px" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}28`, color: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: .6, marginBottom: 3, textTransform: "uppercase" }}>{label}</div>
        {loading ? <Sk w={56} h={22} /> : (
          <div style={{ fontSize: 16, fontWeight: 800, color: accent, letterSpacing: -0.5 }}>{value ?? "—"}</div>
        )}
      </div>
    </div>
  );
}

const fmt = (value, digits = 6) =>
  value != null
    ? Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
      })
    : "—";

const fmtDate = (value) => (value ? new Date(value).toLocaleString() : "—");
const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

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

const sectionsBase = [
  { key: "admin-info", label: "Admin Info", masterLabel: "Master Info", icon: CircleUserRound },
  { key: "balances", label: "Balances", icon: Wallet },
  { key: "messages", label: "Messages", icon: MessageSquare },
];

const emptyProfileDraft = {
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
};

export default function MyAccount() {
  const token = localStorage.getItem("token");
  const messagesBottomRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [balances, setBalances] = useState([]);
  const [walletHistory, setWalletHistory] = useState([]);
  const [platformWallet, setPlatformWallet] = useState(null);
  const [invites, setInvites] = useState([]);

  // IRT platform banks (wires kind)
  const [platformBanks, setPlatformBanks] = useState([]);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankEditTarget, setBankEditTarget] = useState(null);
  const [bankDraftForm, setBankDraftForm] = useState({ bank_name: "", bank_holder_name: "", bank_card_number: "", bank_sheba: "", is_active: false });
  const [savingBank, setSavingBank] = useState(false);

  const [activeSection, setActiveSection] = useState("admin-info");
  const [balanceSubTab, setBalanceSubTab] = useState("my-balance");
  const [inviteTab, setInviteTab] = useState("active");
  const [hoveredBalanceKey, setHoveredBalanceKey] = useState(null);
  const [selectedBalance, setSelectedBalance] = useState(null);

  // Transaction filters
  const [txSearch, setTxSearch] = useState("");
  const [txCurrency, setTxCurrency] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [txDateRange, setTxDateRange] = useState([null, null]);

  const [profileDraft, setProfileDraft] = useState(emptyProfileDraft);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageFile, setMessageFile] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [retryingSweepId, setRetryingSweepId] = useState(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [expandedSweepId, setExpandedSweepId] = useState(null);

  const role = (profile?.role || "").toLowerCase();
  const isMaster = role === "master" || role === "superadmin";
  const sections = useMemo(
    () =>
      sectionsBase
        .map((s) => ({
          ...s,
          label: isMaster && s.masterLabel ? s.masterLabel : s.label,
        }))
        .filter((s) => (isMaster ? s.key !== "messages" : true)),
    [isMaster]
  );

  const loadData = useCallback(async () => {
    if (!token) {
      setError("Missing authentication token.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const headers = authHeaders(token);
      const [summaryRes, balancesRes, historyRes] = await Promise.allSettled([
        api.get("/admin-account/summary", { headers }),
        api.get("/admin-account/balances", { headers }),
        api.get("/wallet/transactions", { headers, params: { limit: 500 } }),
      ]);

      if (summaryRes.status === "fulfilled") {
        const payload = summaryRes.value.data || {};
        setSummary(payload);
        setProfile(payload.profile || null);
      } else {
        setError(summaryRes.reason?.response?.data?.detail || summaryRes.reason?.message || "Failed to load account summary.");
      }

      if (balancesRes.status === "fulfilled") {
        setBalances(Array.isArray(balancesRes.value.data?.balances) ? balancesRes.value.data.balances : []);
      } else {
        showToast("Failed to load balances.", false);
      }

      if (historyRes.status === "fulfilled") {
        const raw = historyRes.value.data;
        setWalletHistory(Array.isArray(raw) ? raw : Array.isArray(raw?.transactions) ? raw.transactions : []);
      }


      if (summaryRes.status === "fulfilled" && isRoleMaster(summaryRes.value.data?.profile?.role)) {
        const [walletRes, invitesRes, banksRes] = await Promise.allSettled([
          api.get("/admin-account/platform-wallet", { headers }),
          api.get("/admin/invitations/", { headers }),
          api.get("/admin/platform-bank-accounts/", { headers, params: { platform_kind: "wires" } }),
        ]);

        if (walletRes.status === "fulfilled") {
          setPlatformWallet(walletRes.value.data || null);
          if (walletRes.value.data?.status_error) {
            showToast("Platform wallet balances are partially unavailable.", false);
          }
        } else {
          showToast("Failed to load platform wallet invitations.", false);
        }

        if (invitesRes.status === "fulfilled") {
          setInvites(Array.isArray(invitesRes.value.data) ? invitesRes.value.data : []);
        }

        if (banksRes.status === "fulfilled") {
          setPlatformBanks(Array.isArray(banksRes.value.data) ? banksRes.value.data : []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadMessages = useCallback(async () => {
    if (!token || isMaster) return;
    setMessagesLoading(true);
    try {
      const res = await api.get("/admin-master-messages/messages", { headers: authHeaders(token) });
      setMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to load messages.", false);
    } finally {
      setMessagesLoading(false);
    }
  }, [isMaster, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setProfileDraft({
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
      email: profile?.email || "",
      phone_number: profile?.phone_number || "",
    });
  }, [profile]);

  useEffect(() => {
    if (activeSection === "messages" && !isMaster) {
      void loadMessages();
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [activeSection, isMaster, loadMessages]);

  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);



  const inviteRows = useMemo(() => {
    const rows = Array.isArray(invites) ? invites : [];
    const filtered = inviteTab === "used" ? rows.filter((item) => item.is_used) : rows.filter((item) => !item.is_used);
    return filtered.slice(0, 5);
  }, [inviteTab, invites]);

  const accessPoints = useMemo(() => {
    const raw = profile?.access_points ?? profile?.access ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [profile]);

  const hasFullControl = isMaster || accessPoints.includes("*");

  const groupedAccess = useMemo(
    () =>
      Object.entries(ACCESS_GROUPS)
        .map(([group, items]) => ({
          group,
          items: items.filter((item) => accessPoints.includes(item.key)),
        }))
        .filter(({ items }) => items.length > 0),
    [accessPoints]
  );

  const selectedBalanceWithHistory = useMemo(() => {
    if (!selectedBalance) return null;
    const recentActivity = walletHistory
      .filter(
        (item) =>
          item.currency === selectedBalance.currency &&
          String(item.network || "") === String(selectedBalance.network_chain || selectedBalance.network || "")
      )
      .slice(0, 12);
    return { ...selectedBalance, recentActivity };
  }, [selectedBalance, walletHistory]);
  const saveProfile = async () => {
    if (!token) return;
    setSavingProfile(true);
    try {
      await api.put("/admin-account/me", profileDraft, { headers: authHeaders(token) });
      setProfileModalOpen(false);
      showToast("Profile saved");
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to save profile.", false);
    } finally {
      setSavingProfile(false);
    }
  };

  const retrySweep = async (sweepId) => {
    if (!token) return;
    setRetryingSweepId(sweepId);
    try {
      await api.post(`/admin/exchange/failed-sweeps/${sweepId}/retry`, {}, { headers: authHeaders(token) });
      showToast("Sweep retry started");
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to retry sweep.", false);
    } finally {
      setRetryingSweepId(null);
    }
  };

  const retryAllSweeps = async () => {
    if (!token) return;
    setRetryingAll(true);
    try {
      await api.post("/admin-account/platform-wallet/retry-all-sweeps", {}, { headers: authHeaders(token) });
      showToast("All failed sweeps retried");
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to retry all sweeps.", false);
    } finally {
      setRetryingAll(false);
    }
  };

  const savePlatformBank = async () => {
    if (!token) return;
    setSavingBank(true);
    try {
      if (bankEditTarget) {
        await api.put(`/admin/platform-bank-accounts/${bankEditTarget.id}`, { ...bankDraftForm, platform_kind: "wires" }, { headers: authHeaders(token) });
        showToast("Bank account updated");
      } else {
        await api.post("/admin/platform-bank-accounts/", { ...bankDraftForm, platform_kind: "wires" }, { headers: authHeaders(token) });
        showToast("Bank account added");
      }
      setBankModalOpen(false);
      setBankEditTarget(null);
      setBankDraftForm({ bank_name: "", bank_holder_name: "", bank_card_number: "", bank_sheba: "", is_active: false });
      const res = await api.get("/admin/platform-bank-accounts/", { headers: authHeaders(token), params: { platform_kind: "wires" } });
      setPlatformBanks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to save bank.", false);
    } finally {
      setSavingBank(false);
    }
  };

  const deletePlatformBank = async (id) => {
    if (!token || !window.confirm("Delete this bank account?")) return;
    try {
      await api.delete(`/admin/platform-bank-accounts/${id}`, { headers: authHeaders(token) });
      showToast("Bank account deleted");
      setPlatformBanks(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Cannot delete.", false);
    }
  };

  const togglePlatformBank = async (bank) => {
    if (!token) return;
    try {
      await api.put(`/admin/platform-bank-accounts/${bank.id}`, { is_active: !bank.is_active }, { headers: authHeaders(token) });
      showToast(bank.is_active ? "Bank deactivated" : "Bank activated");
      const res = await api.get("/admin/platform-bank-accounts/", { headers: authHeaders(token), params: { platform_kind: "wires" } });
      setPlatformBanks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to toggle bank.", false);
    }
  };

  const sendMessageToMaster = async () => {
    if (!token || isMaster) return;
    if (!messageText.trim() && !messageFile) return;

    setSendingMessage(true);
    try {
      let mediaPayload = null;
      let mediaType = null;
      if (messageFile) {
        mediaPayload = await fileToDataUrl(messageFile);
        mediaType = messageFile.type.startsWith("image/") ? "photo" : "document";
      }
      await api.post(
        "/admin-master-messages/send",
        {
          content: messageText.trim() || null,
          media_type: mediaType,
          media_file: mediaPayload,
        },
        { headers: authHeaders(token) }
      );
      setMessageText("");
      setMessageFile(null);
      await loadMessages();
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to send message.", false);
    } finally {
      setSendingMessage(false);
    }
  };

  const profileTitle = isMaster ? "Master Info" : "Admin Info";


  const filteredTxs = useMemo(() => {
    const [dateFrom, dateTo] = txDateRange;
    return walletHistory.filter(tx => {
      if (txCurrency && (tx.currency || "").toUpperCase() !== txCurrency.toUpperCase()) return false;
      if (txStatus && (tx.status || "").toLowerCase() !== txStatus.toLowerCase()) return false;
      if (dateFrom && new Date(tx.created_at || tx.timestamp) < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        if (new Date(tx.created_at || tx.timestamp) > end) return false;
      }
      if (txSearch.trim()) {
        const q = txSearch.trim().toLowerCase();
        const hit = (tx.currency || "").toLowerCase().includes(q)
          || (tx.status || "").toLowerCase().includes(q)
          || (tx.type || "").toLowerCase().includes(q)
          || String(tx.user_id || "").includes(q)
          || (tx.username || "").toLowerCase().includes(q)
          || (tx.tx_hash || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [walletHistory, txSearch, txCurrency, txStatus, txDateRange]);

  const txCurrencies = useMemo(() => [...new Set(walletHistory.map(t => t.currency).filter(Boolean))].sort(), [walletHistory]);

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <aside style={styles.sidebar}>
          <div style={styles.title}>My Account</div>
          <div style={styles.subtitle}>{profile?.username || "Admin Panel"}</div>
          <div style={styles.sectionNav}>
            {sections.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.key;
              return (
                <button key={section.key} type="button" onClick={() => setActiveSection(section.key)} style={styles.navItem(active)}>
                  <span style={styles.navItemInner}>
                    <Icon size={14} />
                    {section.label}
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={loadData} disabled={loading} style={styles.refreshBtn}>
            <RefreshCcw size={13} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </aside>

        <main style={styles.main}>
          {/* Main content sections go here */}

    
          {activeSection === "admin-info" && (
            <div style={styles.stack}>
              <ProfileHero 
              profile={profile} 
              isMaster={isMaster} 
              onEdit={() => setProfileModalOpen(true)} 
              />

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.cardTitle}>Access Points</div>
                    <div style={styles.subtle}>
                      {hasFullControl ? "Full platform access." : "Grouped by feature area for clearer review."}
                    </div>
                  </div>
                  {!hasFullControl && (
                    <div style={styles.subtle}>
                      {groupedAccess.reduce((n, g) => n + g.items.length, 0)} total
                    </div>
                  )}
                </div>

                {hasFullControl ? (
                  <div style={styles.fullControlBanner}>
                    <ShieldCheck size={16} />
                    <span>You have full control</span>
                  </div>
                ) : (
                  <div style={styles.accessGroupGrid}>
                    {groupedAccess.map(({ group, items }) => (
                      <div key={group} style={styles.accessGroupCard}>
                        <div style={styles.groupLabelRow}>
                          <span style={styles.groupIconDot} />
                          <span style={styles.groupLabel}>{group.toUpperCase()}</span>
                          <span style={styles.groupCount}>{items.length}</span>
                        </div>
                        <div style={styles.tagWrap}>
                          {items.map((item) => (
                            <span key={item.key} style={styles.accessChip}>
                              <Check size={11} style={{ flexShrink: 0 }} />
                              {item.label}
                            </span>
                          ))}
                          {items.length === 0 && <span style={styles.subtle}>No access points.</span>}
                        </div>
                      </div>
                    ))}
                    {groupedAccess.length === 0 && <div style={styles.subtle}>No access points configured.</div>}
                  </div>
                )}
              </div>


                            <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.cardTitle}>Invitation Codes</div>
                    <div style={styles.subtle}>See who received each code and who used it.</div>
                  </div>
                  <div style={styles.tabRow}>
                    <button type="button" onClick={() => setInviteTab("active")} style={styles.pillTab(inviteTab === "active")}>
                      Active
                    </button>
                    <button type="button" onClick={() => setInviteTab("used")} style={styles.pillTab(inviteTab === "used")}>
                      Used
                    </button>
                  </div>
                </div>
                <div style={styles.inviteGrid}>
                  {inviteRows.map((item) => (
                    <div key={item.id} style={styles.inviteCard}>
                      <div style={styles.rowBetween}>
                        <strong>{item.code}</strong>
                        <Tag text={item.is_used ? "USED" : "ACTIVE"} color={item.is_used ? "#3b82f6" : "#10b981"} />
                      </div>
                      <div style={styles.metaList}>
                        <MetaRow label="Created by" value={displayUser(item.created_by)} />
                        <MetaRow label="Used by" value={displayUser(item.used_by)} />
                        <MetaRow label="Invited by" value={item.used_by?.invited_by ? `User #${item.used_by.invited_by}` : "—"} />
                        <MetaRow label="Used at" value={fmtDate(item.used_at)} />
                      </div>
                    </div>
                  ))}
                  {inviteRows.length === 0 && <div style={styles.subtle}>No invitations in this view.</div>}
                </div>
              </div>
            </div>

            
          )}

          {activeSection === "balances" && (
            <div style={styles.stack}>

              {isMaster && (
                <div style={styles.tabRow}>
                  <button type="button" onClick={() => setBalanceSubTab("my-balance")} style={styles.pillTab(balanceSubTab === "my-balance")}>
                    My Balance
                  </button>
                  <button type="button" onClick={() => setBalanceSubTab("platform-wallet")} style={styles.pillTab(balanceSubTab === "platform-wallet")}>
                    Platform Wallets
                  </button>
                </div>
              )}

              {(!isMaster || balanceSubTab === "my-balance") && (
                <>
                  <div style={styles.card}>
                    <div style={styles.cardTitle}>My Balance</div>
                    <div style={styles.balanceGrid}>
                      {balances.map((item) => (
                        <BalanceCard
                          key={balanceKey(item)}
                          item={item}
                          onClick={() => setSelectedBalance(item)}
                          hovered={hoveredBalanceKey === balanceKey(item)}
                          onHover={setHoveredBalanceKey}
                        />
                      ))}
                      {balances.length === 0 && <div style={styles.subtle}>No balances found.</div>}
                    </div>
                  </div>

                  {/* Transactions with filters */}
                  <div style={styles.card}>
                    <div style={{ ...styles.cardHeader, flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                      <div>
                        <div style={styles.cardTitle}>Transactions</div>
                        <div style={styles.subtle}>{filteredTxs.length} of {walletHistory.length} transactions</div>
                      </div>
                    </div>
                    {/* Filter bar */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#081224", border: "1px solid #29405e", borderRadius: 10, padding: "6px 10px", flex: 1, minWidth: 180 }}>
                        <Search size={12} color="#7c8ca8" />
                        <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search hash, user, type…" style={{ background: "transparent", border: "none", outline: "none", color: "white", fontSize: 12, width: "100%" }} />
                      </div>
                      <select value={txCurrency} onChange={e => setTxCurrency(e.target.value)} style={{ ...styles.input, width: 110, fontSize: 12, padding: "6px 10px" }}>
                        <option value="">All Currencies</option>
                        {txCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={txStatus} onChange={e => setTxStatus(e.target.value)} style={{ ...styles.input, width: 120, fontSize: 12, padding: "6px 10px" }}>
                        <option value="">All Statuses</option>
                        {["pending", "completed", "failed", "confirmed"].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <DatePicker
                          selectsRange
                          startDate={txDateRange[0]}
                          endDate={txDateRange[1]}
                          onChange={setTxDateRange}
                          placeholderText="Date range"
                          isClearable
                          customInput={<input style={{ ...styles.input, width: 180, fontSize: 12, padding: "6px 10px", cursor: "pointer" }} />}
                        />
                      </div>
                      {(txSearch || txCurrency || txStatus || txDateRange[0]) && (
                        <button type="button" onClick={() => { setTxSearch(""); setTxCurrency(""); setTxStatus(""); setTxDateRange([null, null]); }} style={styles.ghostBtn}>
                          <X size={12} /> Clear
                        </button>
                      )}
                    </div>
                    <div style={styles.tableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>ID</th>
                            <th style={styles.th}>Time</th>
                            <th style={styles.th}>User</th>
                            <th style={styles.th}>Type</th>
                            <th style={styles.th}>Currency</th>
                            <th style={styles.th}>Network</th>
                            <th style={styles.th}>Amount</th>
                            <th style={styles.th}>Status</th>
                            <th style={styles.th}>Tx Hash</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTxs.slice(0, 200).map((tx) => (
                            <tr key={tx.id} style={styles.tr}>
                              <td style={styles.td}>{tx.id|| "—"}</td>
                              <td style={styles.td}>{fmtDate(tx.created_at || tx.timestamp)}</td>
                              <td style={styles.td}><span style={{ fontWeight: 700 }}>{tx.username || "—"}</span><br /><span style={styles.tableSub}>#{tx.user_id}</span></td>
                              <td style={styles.td}><span style={styles.typeBadge}>{tx.type}</span></td>
                              <td style={styles.td}>{tx.currency || "—"}</td>
                              <td style={styles.td}>{tx.network || "—"}</td>
                              <td style={styles.td}>{fmt(tx.amount)}</td>
                              <td style={styles.td}><StatusBadgeTx status={tx.status} /></td>
                              <td style={styles.td}><span style={{ fontFamily: "monospace", fontSize: 11, color: "#60a5fa" }} title={tx.tx_hash}>{shortAddress(tx.tx_hash || tx.wallet_address)}</span></td>
                            </tr>
                          ))}
                          {filteredTxs.length === 0 && <tr><td colSpan={8} style={{ ...styles.td, textAlign: "center", color: "#7c8ca8", padding: "24px 0" }}>No transactions match the filters.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {isMaster && balanceSubTab === "platform-wallet" && (
                <PlatformWalletsTab
                  platformWallet={platformWallet}
                  platformBanks={platformBanks}
                  retryingAll={retryingAll}
                  retryAllSweeps={retryAllSweeps}
                  onAddBank={() => { setBankEditTarget(null); setBankDraftForm({ bank_name: "", bank_holder_name: "", bank_card_number: "", bank_sheba: "", is_active: false }); setBankModalOpen(true); }}
                  onEditBank={(b) => { setBankEditTarget(b); setBankDraftForm({ bank_name: b.bank_name || "", bank_holder_name: b.bank_holder_name || "", bank_card_number: b.bank_card_number || "", bank_sheba: b.bank_sheba || "", is_active: b.is_active }); setBankModalOpen(true); }}
                  onDeleteBank={deletePlatformBank}
                  onToggleBank={togglePlatformBank}
                  loadData={loadData}
                  retrySweep={retrySweep}
                  retryingSweepId={retryingSweepId}
                  expandedSweepId={expandedSweepId}
                  setExpandedSweepId={setExpandedSweepId}
                />
              )}
            </div>
          )}

          {activeSection === "messages" && !isMaster && (
            <div style={styles.stack}>
              <div style={styles.card}>
                <div style={styles.cardTitle}>Message to Master</div>
                <div style={styles.subtle}>Use this thread for admin ↔ master communication and receipt uploads.</div>
                <div style={styles.messageLayout}>
                  <div style={styles.messageThread}>
                    {(messagesLoading && messages.length === 0) ? (
                      <div style={styles.subtle}>Loading messages...</div>
                    ) : (
                      messages.map((message) => (
                        <div key={message.id} style={styles.messageBubble(message.sender === "admin")}>
                          <div style={styles.messageMeta}>{message.sender} · {fmtDate(message.created_at)}</div>
                          {message.content && <div>{message.content}</div>}
                          {message.media_url && (
                            <a href={`${API_URL}${message.media_url}`} target="_blank" rel="noreferrer" style={styles.messageLink}>
                              Open attachment
                            </a>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={messagesBottomRef} />
                  </div>
                  <div style={styles.composeCard}>
                    <textarea
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      rows={6}
                      placeholder="Write to master..."
                      style={styles.textarea}
                    />
                    <input type="file" onChange={(event) => setMessageFile(event.target.files?.[0] || null)} style={styles.input} />
                    {messageFile && <div style={styles.subtle}>{messageFile.name}</div>}
                    <button type="button" onClick={sendMessageToMaster} disabled={sendingMessage} style={styles.primaryBtn}>
                      <Mail size={13} /> {sendingMessage ? "Sending..." : "Send"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

       {/* Load error inline — shown only if profile couldn't be loaded at all */}
       {error && (
         <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9000, maxWidth: 420, background: "rgba(127,29,29,.95)", border: "1px solid rgba(239,68,68,.5)", borderRadius: 14, padding: "12px 16px", color: "#fecaca", fontSize: 13, display: "flex", gap: 10, alignItems: "flex-start", boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
           <span style={{ flex: 1 }}><strong>Error:</strong> {error}</span>
           <button type="button" onClick={() => setError("")} style={{ background: "none", border: "none", color: "#fecaca", cursor: "pointer", padding: 0, lineHeight: 1 }}><X size={14} /></button>
         </div>
       )}
      </div>

      {profileModalOpen && (
        <ProfileModal
          title={profileTitle}
          draft={profileDraft}
          setDraft={setProfileDraft}
          onClose={() => setProfileModalOpen(false)}
          onSave={saveProfile}
          saving={savingProfile}
        />
      )}

      {selectedBalanceWithHistory && (
        <UserBalanceSidebar
          balance={selectedBalanceWithHistory}
          token={token}
          onClose={() => setSelectedBalance(null)}
          onRefresh={loadData}
        />
      )}

      {bankModalOpen && (
        <BankModal
          draft={bankDraftForm}
          setDraft={setBankDraftForm}
          isEdit={!!bankEditTarget}
          onClose={() => { setBankModalOpen(false); setBankEditTarget(null); }}
          onSave={savePlatformBank}
          saving={savingBank}
        />
      )}
    </div>
  );
}

function isRoleMaster(role) {
  const normalized = String(role || "").toLowerCase();
  return normalized === "master" || normalized === "superadmin";
}

function displayUser(user) {
  if (!user) return "—";
  return user.full_name ? `${user.full_name} (@${user.username || user.user_id})` : user.username || `User #${user.user_id}`;
}

function balanceKey(item) {
  return `${item.currency_id ?? item.currency}-${item.network_id ?? item.network}`;
}

function shortAddress(value) {
  if (!value) return "—";
  if (String(value).length <= 18) return value;
  return `${String(value).slice(0, 8)}...${String(value).slice(-8)}`;
}

function Tag({ text, color }) {
  return <span style={styles.tag(color)}>{text}</span>;
}

function Stat({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value ?? "—"}</div>
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

function SectionCard({ title, children }) {
  return (
    <div style={styles.sectionCard}>
      <div style={styles.sectionCardTitle}>{title}</div>
      <div style={styles.metaStack}>{children}</div>
    </div>
  );
}

function ProfileHero({ profile, isMaster, onEdit }) {
  const initials = (profile?.first_name || profile?.username || "?").slice(0, 1).toUpperCase();
  const isActive = String(profile?.status || "").toLowerCase() === "active";
  return (
    <div style={styles.profileHero}>
      <div style={styles.profileHeroTop}>
        <div style={styles.profileAvatarWrap}>
          <div style={styles.profileAvatar}>{initials}</div>
          <span style={styles.profileStatusDot(isActive)} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.profileHeroTitleRow}>
            <div style={styles.h2}>{profile?.full_name || profile?.username || "—"}</div>
            <Tag text={String(profile?.status || "unknown").toUpperCase()} color={isActive ? "#10b981" : "#f87171"} />
          </div>
          <div style={styles.subtle}>@{profile?.username}</div>
        </div>
        <button type="button" onClick={onEdit} style={styles.primaryBtn}>
          <Pencil size={13} /> Edit Profile
        </button>
      </div>

      <div style={styles.profileHeroChips}>
        {profile?.role && (
          <span style={styles.profileChip}>
            <ShieldCheck size={12} /> {String(profile.role).toUpperCase()}
          </span>
        )}
        
        {profile?.user_id && (
          <span style={styles.profileChip}><CircleUserRound size={12} /> User #{profile.user_id}</span>
        )}
        {profile?.email && (
          <span style={styles.profileChip}><Mail size={12} /> {profile.email}</span>
        )}
        {profile?.phone_number && (
          <span style={styles.profileChip}><Phone size={12} /> {profile.phone_number}</span>
        )}
        {profile?.telegram_id && (
          <span style={styles.profileChip}><Send size={12} /> {profile.telegram_id}</span>
        )}
        {profile?.account_id && (
          <span style={styles.profileChip}><KeyRound size={12} /> Account #{profile.account_id}</span>
        )}
      </div>
    </div>
  );
}

function BalanceCard({ item, onClick, hovered, onHover }) {
  const key = balanceKey(item);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => onHover(key)}
      onMouseLeave={() => onHover(null)}
      style={styles.balanceCard(hovered)}
    >
      <div style={styles.rowBetween}>
        <strong>{item.currency}</strong>
        <ArrowRightLeft size={13} />
      </div>
      <div style={styles.balanceSub}>{item.network_chain || item.network || "Wallet pair"}</div>
      <div style={styles.balanceValue}>{fmt(Number(item.available || 0) + Number(item.frozen || 0))}</div>
      <div style={styles.balanceMiniRow}>
        <span>Available</span>
        <strong style={{ color: "#10b981" }}>{fmt(item.available)}</strong>
      </div>
      <div style={styles.balanceMiniRow}>
        <span>Frozen</span>
        <strong style={{ color: "#f59e0b" }}>{fmt(item.frozen)}</strong>
      </div>
    </button>
  );
}


function FailedSweepsList({ rows, onRetry, retryingId, expandedId, onExpandToggle }) {
  if (!rows.length) return <div style={styles.subtle}>No failed sweeps recorded.</div>;
  return (
    <div style={styles.sweepContainer}>
      {rows.map((row) => {
        const isExpanded = expandedId === row.id;
        return (
          <div key={row.id} style={styles.failedSweepCard}>
            <div style={styles.rowBetween}>
              <button
                type="button"
                onClick={() => onExpandToggle(isExpanded ? null : row.id)}
                style={styles.expandBtn}
              >
                <div>
                  <div style={styles.failedSweepTitle}>
                    {row.currency}/{row.network || "N/A"} · {fmt(row.amount)}
                    {(row.user_id || row.username) && (
                      <span style={{ marginLeft: 8, color: "#7c8ca8", fontWeight: 400, fontSize: 11 }}>
                        User #{row.user_id}{row.username ? ` · ${row.username}` : ""}
                      </span>
                    )}
                  </div>
                  <div style={styles.subtle}>{row.reason || row.error || "Unknown failure"}</div>
                </div>
              </button>
              <div style={styles.rowGap}>
                <button type="button" onClick={() => onRetry(row.id)} disabled={retryingId === row.id} style={styles.secondaryBtn}>
                  <Zap size={13} /> {retryingId === row.id ? "Retrying..." : "Retry"}
                </button>
              </div>
            </div>
            {isExpanded && (
              <div style={styles.sweepDetails}>
                <div style={styles.failedSweepMeta}>
                  <MetaRow label="User ID" value={row.user_id} />
                  <MetaRow label="Username" value={row.username} />
                  <MetaRow label="Created" value={fmtDate(row.created_at)} />
                  <MetaRow label="Retries" value={row.retries} />
                  <MetaRow label="Resolved" value={row.resolved ? "Yes" : "No"} />
                </div>
                <div style={styles.failedSweepTrail}>
                  <MetaRow label="Source wallet" value={row.trail?.source_wallet} />
                  <MetaRow label="Hot wallet" value={row.trail?.hot_wallet} />
                  <MetaRow label="Master wallet" value={row.trail?.master_wallet} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadgeTx({ status }) {
  const s = status?.toLowerCase();
  const map = {
    completed: { bg: "rgba(34,197,94,.1)", color: "#4ade80", border: "rgba(34,197,94,.25)" },
    confirmed: { bg: "rgba(34,197,94,.1)", color: "#4ade80", border: "rgba(34,197,94,.25)" },
    pending: { bg: "rgba(245,158,11,.1)", color: "#fbbf24", border: "rgba(245,158,11,.25)" },
    failed: { bg: "rgba(239,68,68,.1)", color: "#f87171", border: "rgba(239,68,68,.25)" },
  };
  const c = map[s] || { bg: "rgba(100,116,139,.1)", color: "#94a3b8", border: "rgba(100,116,139,.25)" };
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{status || "—"}</span>;
}

function WalletCurrencyCard({ row, walletKey, gasFees }) {
  const gas = gasFees?.find(g => g.chain?.toUpperCase() === (row.network_chain || "").toUpperCase());
  const wallet = row[walletKey] || {};
  return (
    <div style={{ borderRadius: 16, border: "1px solid #223451", background: "linear-gradient(160deg,#091629 0%,#0d1830 100%)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 15 }}>{row.currency}</div>
          <div style={{ fontSize: 11, color: "#60a5fa", marginTop: 2 }}>{row.network_chain}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{fmt(wallet.balance)}</div>
          <div style={{ fontSize: 10, color: "#7c8ca8" }}>{row.currency}</div>
        </div>
      </div>
      {wallet.address && (
        <div style={{ fontSize: 10, color: "#7c8ca8", fontFamily: "monospace", wordBreak: "break-all", padding: "6px 8px", background: "#081224", borderRadius: 8, border: "1px solid #20314e" }}>
          {wallet.address}
        </div>
      )}
      {gas && gas.available && gas.tiers?.length > 0 && (
        <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 10, padding: "8px 10px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#fbbf24", marginBottom: 4 }}>GAS FEES ({gas.native_symbol})</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {gas.tiers.map(tier => (
              <div key={tier.label} style={{ fontSize: 10, color: "#fde68a" }}>
                <span style={{ color: "#9ca3af" }}>{tier.label}: </span>
                {tier.approx_fee ? `≈${fmt(tier.approx_fee, 6)} ${gas.native_symbol}` : `${tier.amount} ${tier.unit}`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformWalletColumn({ title, walletKey, rows, gasFees, transactions }) {
  const myTxs = transactions?.filter(tx => {
    if (walletKey === "hot_wallet") return tx.type === "sweep" || tx.type === "sweep_exchange" || tx.type === "withdraw";
    if (walletKey === "master_wallet") return tx.type === "sweep" || tx.type === "sweep_exchange";
    return false;
  }) || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#cdd8eb", textTransform: "uppercase", letterSpacing: 1 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(row => (
          <WalletCurrencyCard key={`${row.currency_id}-${row.network_id}`} row={row} walletKey={walletKey} gasFees={gasFees} />
        ))}
        {rows.length === 0 && <div style={styles.subtle}>No wallets available.</div>}
      </div>
      {myTxs.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7c8ca8", marginBottom: 8 }}>RELATED TRANSACTIONS</div>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Time</th>
                  <th style={styles.th}>User</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Currency</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {myTxs.slice(0, 30).map(tx => (
                  <tr key={tx.id} style={styles.tr}>
                    <td style={styles.td}>{fmtDate(tx.created_at)}</td>
                    <td style={styles.td}>{tx.username || "—"}<br /><span style={styles.tableSub}>#{tx.user_id}</span></td>
                    <td style={styles.td}><span style={styles.typeBadge}>{tx.type}</span></td>
                    <td style={styles.td}>{tx.currency || "—"}</td>
                    <td style={styles.td}>{fmt(tx.amount)}</td>
                    <td style={styles.td}><StatusBadgeTx status={tx.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function IrtBankSection({ platformBanks, onAdd, onEdit, onDelete, onToggle, transactions }) {
  const irtTxs = (transactions || []).filter(tx => (tx.currency || "").toUpperCase() === "IRT" || tx.type === "wire" || tx.type === "deposit_wire");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#cdd8eb", textTransform: "uppercase", letterSpacing: 1 }}>IRT Platform Wallet</div>
        <button type="button" onClick={onAdd} style={styles.primaryBtn}>
          <Plus size={13} /> Add New Bank
        </button>
      </div>

      {platformBanks.length === 0 && (
        <div style={{ ...styles.subtle, padding: "20px 0", textAlign: "center" }}>No platform bank accounts (wires) configured yet.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {platformBanks.map(bank => (
          <div key={bank.id} style={{ borderRadius: 16, border: `1px solid ${bank.is_active ? "rgba(16,185,129,.3)" : "#223451"}`, background: bank.is_active ? "rgba(16,185,129,.05)" : "#091629", padding: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 8 }}>
              <MetaRow label="Bank Name" value={bank.bank_name} />
              <MetaRow label="Holder" value={bank.bank_holder_name} />
              <MetaRow label="Card" value={bank.bank_card_number} />
              <MetaRow label="Sheba" value={bank.bank_sheba} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, alignItems: "flex-end" }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: bank.is_active ? "rgba(16,185,129,.12)" : "rgba(100,116,139,.1)", color: bank.is_active ? "#34d399" : "#94a3b8", border: `1px solid ${bank.is_active ? "rgba(16,185,129,.3)" : "rgba(100,116,139,.2)"}` }}>
                {bank.is_active ? "ACTIVE" : "INACTIVE"}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => onToggle(bank)} style={{ ...styles.ghostBtn, padding: "5px 8px", fontSize: 11 }}>
                  <Power size={11} /> {bank.is_active ? "Deactivate" : "Activate"}
                </button>
                {!bank.has_transactions && (
                  <>
                    <button type="button" onClick={() => onEdit(bank)} style={{ ...styles.secondaryBtn, padding: "5px 8px", fontSize: 11 }}>
                      <Edit2 size={11} /> Edit
                    </button>
                    <button type="button" onClick={() => onDelete(bank.id)} style={{ ...styles.secondaryBtn, padding: "5px 8px", fontSize: 11, color: "#f87171", borderColor: "rgba(239,68,68,.3)" }}>
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {irtTxs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7c8ca8", marginBottom: 8 }}>PLATFORM BANK TRANSACTIONS (IRT / WIRE)</div>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Time</th>
                  <th style={styles.th}>User</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {irtTxs.slice(0, 30).map(tx => (
                  <tr key={tx.id} style={styles.tr}>
                    <td style={styles.td}>{fmtDate(tx.created_at)}</td>
                    <td style={styles.td}>{tx.username || "—"}<br /><span style={styles.tableSub}>#{tx.user_id}</span></td>
                    <td style={styles.td}><span style={styles.typeBadge}>{tx.type}</span></td>
                    <td style={styles.td}>{fmt(tx.amount)} IRT</td>
                    <td style={styles.td}><StatusBadgeTx status={tx.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformWalletsTab({ 
  platformWallet, 
  platformBanks, 
  onAddBank, 
  onEditBank, 
  onDeleteBank, 
  onToggleBank, 
  retryingAll, 
  retryAllSweeps , 
  loadData, 
  retrySweep, 
  retryingSweepId, 
  expandedSweepId, 
  setExpandedSweepId
}) {
  const allRows = Array.isArray(platformWallet?.wallets) ? platformWallet.wallets : [];
  const cryptoRows = allRows.filter(r => r.currency_type === "crypto");
  const gasFees = platformWallet?.gas_fees || [];
  const transactions = platformWallet?.transactions || [];
  const failedSweeps = Array.isArray(platformWallet?.failed_sweeps) ? platformWallet.failed_sweeps : [];

  const [view, setView] = useState("wallets"); // "wallets" | "sweeps"
  const showingSweeps = view === "sweeps";

  return (
    <div style={styles.card}>
      <div style={{ ...styles.cardHeader, marginBottom: 16 }}>
        <div>
          <div style={styles.cardTitle}>{showingSweeps ? "Failed Sweeps" : "Platform Wallets"}</div>
          <div style={styles.subtle}>
            {showingSweeps ? "Retry each failed sweep individually or all at once." : "Hot Wallet · Master Wallet · IRT Platform Wallet"}
          </div>
        </div>
        <div style={styles.rowGap}>
          {showingSweeps ? (
            <button type="button" onClick={() => setView("wallets")} style={styles.secondaryBtn}>
              <ArrowRightLeft size={13} /> Back to Wallets
            </button>
          ) : (
            <button type="button" onClick={() => setView("sweeps")} style={styles.secondaryBtn}>
              <ArrowRightLeft size={13} /> Sweeps
              {failedSweeps.length > 0 && (
                <span style={{ ...styles.tag("#f87171"), minHeight: 18, padding: "0 7px", fontSize: 10, marginLeft: 4 }}>{failedSweeps.length}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {!showingSweeps && (
        <div style={styles.platformWalletGrid}>
          <div style={styles.platformWalletCol}>
            <PlatformWalletColumn title="Hot Wallet" walletKey="hot_wallet" rows={cryptoRows} gasFees={gasFees} transactions={transactions} />
          </div>
          <div style={styles.platformWalletCol}>
            <PlatformWalletColumn title="Master Wallet" walletKey="master_wallet" rows={cryptoRows} gasFees={gasFees} transactions={transactions} />
          </div>
          <div style={styles.platformWalletCol}>
            <IrtBankSection platformBanks={platformBanks} onAdd={onAddBank} onEdit={onEditBank} onDelete={onDeleteBank} onToggle={onToggleBank} transactions={transactions} />
          </div>
        </div>
      )}

      {showingSweeps && (
        <>
          <div style={{ ...styles.rowGap, marginBottom: 12 }}>
            <button type="button" onClick={retryAllSweeps} disabled={retryingAll} style={{ ...styles.primaryBtn, background: "rgba(239,68,68,.16)", borderColor: "rgba(239,68,68,.4)", color: "#fca5a5" }}>
              <Zap size={13} /> {retryingAll ? "Retrying all..." : "Retry All Failed"}
            </button>
            <button type="button" onClick={loadData} style={styles.secondaryBtn}>
              <RefreshCcw size={13} /> Reload
            </button>
          </div>
          <FailedSweepsList
            rows={failedSweeps}
            onRetry={retrySweep}
            retryingId={retryingSweepId}
            expandedId={expandedSweepId}
            onExpandToggle={setExpandedSweepId}
          />
        </>
      )}
    </div>
  );
}

function BankModal({ draft, setDraft, isEdit, onClose, onSave, saving }) {
  const set = (k, v) => setDraft(prev => ({ ...prev, [k]: v }));
  return (
    <div style={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.cardTitle}>{isEdit ? "Edit" : "Add"} Platform Bank Account</div>
            <div style={styles.subtle}>This is a platform-kind "wires" bank account.</div>
          </div>
          <button type="button" onClick={onClose} style={styles.closeBtn}><X size={14} /></button>
        </div>
        <div style={styles.formGrid}>
          <label style={styles.inputWrap}>
            <span style={styles.metaLabel}>Bank Name</span>
            <input value={draft.bank_name} onChange={e => set("bank_name", e.target.value)} style={styles.input} placeholder="e.g., Bank Mellat" />
          </label>
          <label style={styles.inputWrap}>
            <span style={styles.metaLabel}>Holder Name</span>
            <input value={draft.bank_holder_name} onChange={e => set("bank_holder_name", e.target.value)} style={styles.input} placeholder="Account holder name" />
          </label>
          <label style={styles.inputWrap}>
            <span style={styles.metaLabel}>Card Number</span>
            <input value={draft.bank_card_number} onChange={e => set("bank_card_number", e.target.value)} style={styles.input} placeholder="16-digit card number" />
          </label>
          <label style={styles.inputWrap}>
            <span style={styles.metaLabel}>SHEBA</span>
            <input value={draft.bank_sheba} onChange={e => set("bank_sheba", e.target.value)} style={styles.input} placeholder="IR..." />
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={() => set("is_active", !draft.is_active)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 38, height: 22, borderRadius: 11, background: draft.is_active ? "#10b981" : "#1f2937", border: `1px solid ${draft.is_active ? "#10b981" : "#374151"}`, position: "relative", transition: "all .25s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: draft.is_active ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: draft.is_active ? "white" : "#4b5563", transition: "left .25s" }} />
            </div>
            <span style={{ color: draft.is_active ? "#34d399" : "#6b7280", fontSize: 13, fontWeight: 600 }}>Set as Active</span>
          </button>
        </div>
        <div style={styles.rowGap}>
          <button type="button" onClick={onSave} disabled={saving} style={styles.primaryBtn}>
            <Save size={13} /> {saving ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={onClose} style={styles.ghostBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ProfileModal({ title, draft, setDraft, onClose, onSave, saving }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.cardTitle}>Edit {title}</div>
            <div style={styles.subtle}>Update one field at a time without leaving the page.</div>
          </div>
          <button type="button" onClick={onClose} style={styles.closeBtn}>
            <X size={14} />
          </button>
        </div>
        <div style={styles.formGrid}>
          <Field label="First name" value={draft.first_name} onChange={(value) => setDraft((prev) => ({ ...prev, first_name: value }))} />
          <Field label="Last name" value={draft.last_name} onChange={(value) => setDraft((prev) => ({ ...prev, last_name: value }))} />
          <Field label="Email" value={draft.email} onChange={(value) => setDraft((prev) => ({ ...prev, email: value }))} />
          <Field
            label="Phone"
            value={draft.phone_number}
            onChange={(value) => setDraft((prev) => ({ ...prev, phone_number: value }))}
          />
        </div>
        <div style={styles.rowGap}>
          <button type="button" onClick={onSave} style={styles.primaryBtn} disabled={saving}>
            <Save size={13} /> {saving ? "Saving..." : "Save changes"}
          </button>
          <button type="button" onClick={onClose} style={styles.ghostBtn}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label style={styles.inputWrap}>
      <span style={styles.metaLabel}>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} style={styles.input} />
    </label>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#060b16", color: "white" },
  wrapper: { display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh" },
  sidebar: {
    position: "sticky",
    top: 0,
    height: "100vh",
    padding: 18,
    background: "#040a14",
    borderRight: "1px solid #15243c",
  },

  title: { color: "#2e7ce9af",margin: 0, fontSize: 20, fontWeight: 600, marginRight: 20 , letterSpacing: "0.1rem",   },
  subtitle: { color: "#64748b", fontSize: 13, margin: "2px 0 0" },
  brand: { fontSize: 20, fontWeight: 900 },
  brandSub: { color: "#7c8ca8", marginBottom: 16, fontSize: 12 },
  sectionNav: { display: "flex", flexDirection: "column", gap: 8,marginTop: 16 },
  navItem: (active) => ({
    border: `1px solid ${active ? "#3b82f6" : "#223451"}`,
    background: active ? "rgba(59,130,246,.18)" : "#0b1628",
    color: active ? "#bfdbfe" : "#94a3b8",
    borderRadius: 12,
    minHeight: 42,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
  }),
  navItemInner: { display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 },
  refreshBtn: {
    marginTop: 16,
    width: "100%",
    height: 40,
    borderRadius: 12,
    border: "1px solid #243957",
    background: "#0f1b2f",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
  },
  main: { padding: 20, paddingBottom: 60, overflowY: "auto", height: "100vh" },
  stack: { display: "flex", flexDirection: "column", gap: 16 },
  h2: { fontSize: 28, fontWeight: 900, margin: 0 },
  alertError: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    background: "rgba(127,29,29,.18)",
    border: "1px solid rgba(239,68,68,.35)",
    color: "#fecaca",
  },
  alertWarn: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    background: "rgba(120,53,15,.18)",
    border: "1px solid rgba(245,158,11,.35)",
    color: "#fde68a",
  },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 },
  statCard: {
    borderRadius: 16,
    border: "1px solid #223451",
    background: "linear-gradient(180deg, rgba(11,22,40,.95), rgba(8,18,36,.9))",
    padding: 14,
  },
  statLabel: { color: "#7c8ca8", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  statValue: { fontSize: 24, fontWeight: 900, marginTop: 6 },
  card: {
    borderRadius: 18,
    border: "1px solid #223451",
    background: "linear-gradient(180deg, rgba(11,22,40,.98), rgba(8,18,36,.94))",
    padding: 16,
    boxShadow: "0 16px 42px rgba(0,0,0,.25)",
  },
  panelCard: {
    borderRadius: 16,
    border: "1px solid #223451",
    background: "#091629",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: 800, marginBottom: 4 },
  section: { display: "flex", flexDirection: "column", gap: 12, padding: 12, background: "rgba(2,6,23,.45)", border: "1px solid #24344f", borderRadius: 12 },
  sectionTitle: { fontSize: 12, fontWeight: 800, color: "#cdd8eb", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  formStack: { display: "flex", flexDirection: "column", gap: 10 },
  subtle: { fontSize: 12, color: "#7c8ca8" },
  walletSummaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 },
  balanceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 },
  platformWalletGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(280px, 1fr))",
    gap: 16,
    alignItems: "start",
  },
  platformWalletCol: {
    borderRadius: 16,
    border: "1px solid #1c2c48",
    background: "#0a1526",
    padding: 14,
    minWidth: 0,
  },
  balanceCard: (hovered) => ({
    borderRadius: 16,
    border: `1px solid ${hovered ? "#60a5fa" : "#223451"}`,
    background: hovered ? "rgba(30,41,59,.95)" : "linear-gradient(170deg,#091629 0%,#0d1830 100%)",
    color: "white",
    padding: 14,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: hovered ? "0 0 0 1px rgba(96,165,250,.35) inset" : "none",
    transition: "all 120ms ease",
  }),
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  rowGap: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  balanceSub: { fontSize: 11, color: "#7c8ca8", marginTop: 4 },
  balanceValue: { fontSize: 24, fontWeight: 900, margin: "12px 0" },
  balanceMiniRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 12, color: "#cbd5e1" },
  sectionCard: { borderRadius: 16, border: "1px solid #223451", padding: 14, background: "#091629" },
  sectionCardTitle: { fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#cdd8eb", marginBottom: 12 },
  iconSectionTitleRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  iconSectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(59,130,246,.14)",
    border: "1px solid rgba(59,130,246,.3)",
    color: "#93c5fd",
    flexShrink: 0,
  },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat( minmax(250px, 1fr))", gap: 12 },
  metaStack: { display: "flex", flexDirection: "column", gap: 8 },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "9px 10px",
    borderRadius: 12,
    border: "1px solid #20314e",
    background: "#081224",
    alignItems: "center",
  },
  metaLabel: { color: "#7c8ca8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7 },
  metaValue: { color: "#dbe7fb", fontSize: 12, fontWeight: 700, wordBreak: "break-word" },
  iconMetaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid #20314e",
    background: "#081224",
  },
  iconMetaLeft: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  iconMetaIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0d1c33",
    border: "1px solid #223451",
    color: "#7c8ca8",
    flexShrink: 0,
  },
  iconMetaRight: { display: "flex", alignItems: "center", gap: 6, textAlign: "right", justifyContent: "flex-end", minWidth: 0 },
  copyBtn: {
    width: 22,
    height: 22,
    borderRadius: 7,
    border: "1px solid #223451",
    background: "#0d1c33",
    color: "#7c8ca8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  profileHero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 20,
    border: "1px solid #223451",
    background: "linear-gradient(160deg, rgba(15,27,48,.98), rgba(8,15,29,.96))",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  profileHeroTop: { display: "flex", alignItems: "center", gap: 16, position: "relative", zIndex: 1 },
  profileHeroTitleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  profileAvatarWrap: { position: "relative", flexShrink: 0 },
  profileAvatar: {
    width: 62,
    height: 62,
    borderRadius: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 24,
    background: "linear-gradient(160deg, rgba(59,130,246,.28), rgba(139,92,246,.2))",
    border: "1px solid rgba(96,165,250,.45)",
    color: "#dbeafe",
    boxShadow: "0 8px 24px rgba(59,130,246,.18)",
  },
  profileStatusDot: (active) => ({
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: active ? "#10b981" : "#f87171",
    border: "3px solid #0b1628",
  }),
  profileHeroChips: { display: "flex", flexWrap: "wrap", gap: 8, position: "relative", zIndex: 1 },
  profileChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 999,
    background: "#0d1c33",
    border: "1px solid #223451",
    color: "#b6c4dc",
    fontSize: 12,
    fontWeight: 600,
  },
  fullControlBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid rgba(167,139,250,.35)",
    background: "linear-gradient(135deg, rgba(167,139,250,.14), rgba(59,130,246,.1))",
    color: "#e9e2ff",
    fontSize: 13,
    fontWeight: 800,
  },
  accessGroupGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 },
  accessGroupCard: { borderRadius: 16, border: "1px solid #223451", background: "#091629", padding: 14 },
  groupLabel: { color: "#7c8ca8", fontSize: 11, fontWeight: 800, letterSpacing: 1 },
  groupLabelRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  groupIconDot: { width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 },
  groupCount: {
    marginLeft: "auto",
    fontSize: 10,
    fontWeight: 800,
    color: "#7c8ca8",
    background: "#0d1c33",
    border: "1px solid #223451",
    borderRadius: 999,
    padding: "1px 7px",
  },
  tagWrap: { display: "flex", flexWrap: "wrap", gap: 8 },
  accessChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    minHeight: 26,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid rgba(16,185,129,.3)",
    background: "rgba(16,185,129,.08)",
    color: "#6ee7b7",
    fontSize: 11,
    fontWeight: 700,
  },
  tag: (color) => ({
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    border: `1px solid ${color}`,
    background: `${color}22`,
    color,
    fontSize: 11,
    fontWeight: 800,
  }),
  tabRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  pillTab: (active) => ({
    borderRadius: 999,
    border: `1px solid ${active ? "#3b82f6" : "#2b3b54"}`,
    background: active ? "rgba(59,130,246,.16)" : "#0b1628",
    color: active ? "#bfdbfe" : "#94a3b8",
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  }),
  inviteGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 },
  inviteCard: { borderRadius: 16, border: "1px solid #223451", background: "#091629", padding: 14, display: "flex", flexDirection: "column", gap: 10 },
  listStack: { display: "flex", flexDirection: "column", gap: 10, marginTop: 12 },
  sweepContainer: { display: "flex", flexDirection: "column", gap: 10, marginTop: 12, maxHeight: 400, overflowY: "auto", paddingRight: 8 },
  expandBtn: { background: "none", border: "none", color: "white", textAlign: "left", cursor: "pointer", flex: 1, padding: 0 },
  sweepDetails: { paddingTop: 12, borderTop: "1px solid #20314e", display: "flex", flexDirection: "column", gap: 10 },
  failedSweepCard: { borderRadius: 16, border: "1px solid #223451", background: "#091629", padding: 14, display: "flex", flexDirection: "column", gap: 10 },
  failedSweepTitle: { fontWeight: 800 },
  failedSweepMeta: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 },
  failedSweepTrail: { display: "grid", gap: 8 },
  walletLine: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "9px 10px", borderRadius: 12, border: "1px solid #20314e", background: "#081224" },
  walletLineTitle: { fontWeight: 800 },
  walletLineSub: { color: "#60a5fa", fontSize: 11, marginLeft: 4 },
  walletLineAddress: { color: "#7c8ca8", fontSize: 11, marginTop: 4, wordBreak: "break-all" },
  tableWrap: { overflowX: "auto", marginTop: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  tableSub: { color: "#7c8ca8", fontSize: 11, marginTop: 4, wordBreak: "break-all" },
  messageLayout: { display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(260px, .9fr)", gap: 12, marginTop: 14 },
  messageThread: { minHeight: 280, maxHeight: 540, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 },
  composeCard: { display: "grid", gap: 10, alignContent: "start" },
  textarea: {
    width: "100%",
    minHeight: 140,
    padding: 12,
    borderRadius: 14,
    border: "1px solid #29405e",
    background: "#081224",
    color: "white",
    resize: "vertical",
    boxSizing: "border-box",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #29405e",
    background: "#081224",
    color: "white",
    boxSizing: "border-box",
  },
  inputWrap: { display: "grid", gap: 6 },
  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,.4)",
    background: "rgba(37,99,235,.18)",
    color: "#bfdbfe",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "9px 12px",
    borderRadius: 12,
    border: "1px solid #28405f",
    background: "#0e1a2d",
    color: "#cbd5e1",
    fontWeight: 700,
    cursor: "pointer",
  },
  ghostBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "9px 12px",
    borderRadius: 12,
    border: "1px solid #2d3a52",
    background: "transparent",
    color: "#94a3b8",
    fontWeight: 700,
    cursor: "pointer",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    border: "1px solid #31425f",
    background: "#0b1527",
    color: "#94a3b8",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtn: {
    width: "100%",
    height: 40,
    borderRadius: 12,
    border: "1px solid #243957",
    background: "#0f1b2f",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    marginTop: 16,
  },
  alertError: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    background: "rgba(127,29,29,.18)",
    border: "1px solid rgba(239,68,68,.35)",
    color: "#fecaca",
  },
  alertWarn: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    background: "rgba(120,53,15,.18)",
    border: "1px solid rgba(245,158,11,.35)",
    color: "#fde68a",
  },
  messageBubble: (mine) => ({
    alignSelf: mine ? "flex-end" : "flex-start",
    maxWidth: "78%",
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${mine ? "rgba(59,130,246,.32)" : "#27364e"}`,
    background: mine ? "rgba(37,99,235,.18)" : "#091629",
  }),
  messageMeta: { fontSize: 10, color: "#94a3b8", marginBottom: 6 },
  messageLink: { color: "#93c5fd", display: "inline-block", marginTop: 8 },
  cardTitleSmall: { fontSize: 12 },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.55)",
    zIndex: 2500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modal: {
    width: "min(680px, 96vw)",
    borderRadius: 20,
    border: "1px solid #223451",
    background: "linear-gradient(180deg, #0b1628 0%, #091629 100%)",
    padding: 18,
    boxShadow: "0 30px 90px rgba(0,0,0,.6)",
    display: "grid",
    gap: 16,
  },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  inputWrap: { display: "grid", gap: 6 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #29405e",
    background: "#081224",
    color: "white",
    boxSizing: "border-box",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    color: "#7c8ca8",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    borderBottom: "1px solid #223451",
    whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid rgba(34,51,75,.45)" },
  td: {
    padding: "10px 12px",
    fontSize: 12,
    color: "#dbe7fb",
    verticalAlign: "top",
  },
  typeBadge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 24,
    padding: "0 8px",
    borderRadius: 999,
    border: "1px solid #28405f",
    background: "#0e1a2d",
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  metaLabel: { color: "#7c8ca8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7 },
header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 14,  padding :"10px 0 20px 20px",  flexWrap: "wrap"
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap"},


};