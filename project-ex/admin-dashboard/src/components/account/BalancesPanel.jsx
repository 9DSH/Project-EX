import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowRightLeft, Edit2, Plus, Power, RefreshCcw, Save, Search, Trash2, X, Zap,
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { API_URL } from "../../config";
import UserBalanceSidebar from "./UserBalanceSidebar";
import { authHeaders, fmt, fmtDate, showToast } from "./accountUtils";
import { EmptyState, MetaRow, Tag, TxRow } from "./AccountBits";
import "../../pages/MyAccount.css";

const api = axios.create({ baseURL: API_URL });

function balanceKey(item) {
  return `${item.currency_id ?? item.currency}-${item.network_id ?? item.network}`;
}

export default function BalancesPanel({ isMaster }) {
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState([]);
  const [walletHistory, setWalletHistory] = useState([]);
  const [platformWallet, setPlatformWallet] = useState(null);
  const [platformBanks, setPlatformBanks] = useState([]);

  const [balanceSubTab, setBalanceSubTab] = useState("my-balance");
  const [selectedBalance, setSelectedBalance] = useState(null);

  const [txSearch, setTxSearch] = useState("");
  const [txCurrency, setTxCurrency] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [txDateRange, setTxDateRange] = useState([null, null]);

  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankEditTarget, setBankEditTarget] = useState(null);
  const [bankDraftForm, setBankDraftForm] = useState({ bank_name: "", bank_holder_name: "", bank_card_number: "", bank_sheba: "", is_active: false });
  const [savingBank, setSavingBank] = useState(false);

  const [retryingSweepId, setRetryingSweepId] = useState(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [expandedSweepId, setExpandedSweepId] = useState(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = authHeaders(token);
      const [balancesRes, historyRes] = await Promise.allSettled([
        api.get("/admin-account/balances", { headers }),
        api.get("/wallet/transactions", { headers, params: { limit: 500 } }),
      ]);

      if (balancesRes.status === "fulfilled") {
        setBalances(Array.isArray(balancesRes.value.data?.balances) ? balancesRes.value.data.balances : []);
      } else {
        showToast("Failed to load balances.", false);
      }

      if (historyRes.status === "fulfilled") {
        const raw = historyRes.value.data;
        setWalletHistory(Array.isArray(raw) ? raw : Array.isArray(raw?.transactions) ? raw.transactions : []);
      }

      if (isMaster) {
        const [walletRes, banksRes] = await Promise.allSettled([
          api.get("/admin-account/platform-wallet", { headers }),
          api.get("/admin/platform-bank-accounts/", { headers, params: { platform_kind: "wires" } }),
        ]);

        if (walletRes.status === "fulfilled") {
          setPlatformWallet(walletRes.value.data || null);
          if (walletRes.value.data?.status_error) {
            showToast("Platform wallet balances are partially unavailable.", false);
          }
        } else {
          showToast("Failed to load platform wallet.", false);
        }

        if (banksRes.status === "fulfilled") {
          setPlatformBanks(Array.isArray(banksRes.value.data) ? banksRes.value.data : []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isMaster, token]);

  useEffect(() => { loadData(); }, [loadData]);

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


  const hasFilters = !!(txSearch || txCurrency || txStatus || txDateRange[0]);
  const clearFilters = () => { setTxSearch(""); setTxCurrency(""); setTxStatus(""); setTxDateRange([null, null]); };
  const emptyBank = { bank_name: "", bank_holder_name: "", bank_card_number: "", bank_sheba: "", is_active: false };

  return (
    <div className="ma-stack">
      <div className="ma-row-between">
        {isMaster ? (
          <div className="ma-subtabs">
            <button type="button" onClick={() => setBalanceSubTab("my-balance")} className={`ma-subtab${balanceSubTab === "my-balance" ? " is-active" : ""}`}>My Balance</button>
            <button type="button" onClick={() => setBalanceSubTab("platform-wallet")} className={`ma-subtab${balanceSubTab === "platform-wallet" ? " is-active" : ""}`}>Platform Wallets</button>
          </div>
        ) : <span />}
      </div>

      {(!isMaster || balanceSubTab === "my-balance") && (
        <div className="ma-split">
          {/* LEFT — balances, one card per row */}
          <section className="ma-card">
            <div className="ma-card-title">My Balance</div>
            <div className="ma-subtle">Tap a balance to deposit, withdraw, or see its activity.</div>
            <div className="ma-balList">
              {balances.map((item) => (
                <BalanceCard key={balanceKey(item)} item={item} onClick={() => setSelectedBalance(item)} />
              ))}
              {balances.length === 0 && <EmptyState>No balances found.</EmptyState>}
            </div>
          </section>

          {/* RIGHT — transactions */}
          <section className="ma-card">
            <div className="ma-card-title">Transactions</div>
            <div className="ma-subtle">{filteredTxs.length} of {walletHistory.length} transactions</div>

            <div className="ma-filters">
              <div className="ma-searchWrap">
                <Search size={13} />
                <input className="ma-input ma-input--sm" value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Search hash, user, type…" />
              </div>
              <select className="ma-select ma-select--sm" value={txCurrency} onChange={(e) => setTxCurrency(e.target.value)}>
                <option value="">All Currencies</option>
                {txCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="ma-select ma-select--sm" value={txStatus} onChange={(e) => setTxStatus(e.target.value)}>
                <option value="">All Statuses</option>
                {["pending", "completed", "failed", "confirmed"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <DatePicker
                selectsRange
                startDate={txDateRange[0]}
                endDate={txDateRange[1]}
                onChange={setTxDateRange}
                placeholderText="Date range"
                isClearable
                customInput={<input className="ma-input ma-input--sm" style={{ cursor: "pointer" }} />}
              />
              {hasFilters && (
                <button type="button" onClick={clearFilters} className="ma-btn ma-btn--ghost ma-btn--sm"><X size={12} /> Clear</button>
              )}
            </div>

            <div className="ma-scrollY">
              <div className="ma-txList">
                {filteredTxs.slice(0, 200).map((tx) => <TxRow key={tx.id} tx={tx} />)}
              </div>
              {filteredTxs.length === 0 && <EmptyState>No transactions match the filters.</EmptyState>}
            </div>
          </section>
        </div>
      )}

      {isMaster && balanceSubTab === "platform-wallet" && (
        <PlatformWalletsTab
          platformWallet={platformWallet}
          platformBanks={platformBanks}
          retryingAll={retryingAll}
          retryAllSweeps={retryAllSweeps}
          onAddBank={() => { setBankEditTarget(null); setBankDraftForm(emptyBank); setBankModalOpen(true); }}
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

function BalanceCard({ item, onClick }) {
  const total = Number(item.available || 0) + Number(item.frozen || 0);
  return (
    <button type="button" onClick={onClick} className="ma-bal">
      <div className="ma-bal-top">
        <div className="ma-bal-coin">{String(item.currency || "?").slice(0, 3)}</div>
        <div className="ma-bal-id">
          <div className="ma-bal-cur">{item.currency}</div>
          <div className="ma-bal-net">{item.network_chain || item.network || "Wallet pair"}</div>
        </div>
        <div className="ma-bal-total">
          <div className="ma-bal-value">{fmt(total)}</div>
          <div className="ma-bal-cap">Total</div>
        </div>
        <ArrowRightLeft size={14} color="#64748b" />
      </div>
      <div className="ma-bal-parts">
        <div className="ma-bal-part"><small>Available</small><strong style={{ color: "#10b981" }}>{fmt(item.available)}</strong></div>
        <div className="ma-bal-part"><small>Frozen</small><strong style={{ color: "#f59e0b" }}>{fmt(item.frozen)}</strong></div>
      </div>
    </button>
  );
}

function WalletCurrencyCard({ row, walletKey, gasFees }) {
  const gas = gasFees?.find((g) => g.chain?.toUpperCase() === (row.network_chain || "").toUpperCase());
  const wallet = row[walletKey] || {};
  return (
    <div className="ma-gasBox" style={{ gap: 10, padding: 12 }}>
      <div className="ma-row-between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 15 }}>{row.currency}</div>
          <div style={{ fontSize: 11, color: "#60a5fa", marginTop: 2 }}>{row.network_chain}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{fmt(wallet.balance)}</div>
          <div className="ma-subtle" style={{ fontSize: 10 }}>{row.currency}</div>
        </div>
      </div>
      {wallet.address && <div className="ma-addr" style={{ padding: "6px 8px", background: "#060e1c", borderRadius: 8, border: "1px solid var(--ma-line)" }}>{wallet.address}</div>}
      {gas && gas.available && gas.tiers?.length > 0 && (
        <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 10, padding: "8px 10px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#fbbf24", marginBottom: 4 }}>GAS FEES ({gas.native_symbol})</div>
          <div className="ma-row">
            {gas.tiers.map((tier) => (
              <div key={tier.label} style={{ fontSize: 10.5, color: "#fde68a" }}>
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
  const myTxs = transactions?.filter((tx) => {
    if (walletKey === "hot_wallet") return tx.type === "sweep" || tx.type === "sweep_exchange" || tx.type === "withdraw";
    if (walletKey === "master_wallet") return tx.type === "sweep" || tx.type === "sweep_exchange";
    return false;
  }) || [];

  return (
    <>
      <div className="ma-pwTitle">{title}</div>
      <div className="ma-activity">
        {rows.map((row) => <WalletCurrencyCard key={`${row.currency_id}-${row.network_id}`} row={row} walletKey={walletKey} gasFees={gasFees} />)}
        {rows.length === 0 && <EmptyState>No wallets available.</EmptyState>}
      </div>
      {myTxs.length > 0 && (
        <div>
          <div className="ma-sectionLabel">Related transactions</div>
          <div className="ma-txList ma-scrollY" style={{ maxHeight: 420 }}>
            {myTxs.slice(0, 30).map((tx) => <TxRow key={tx.id} tx={tx} showHash={false} showNetwork={false} />)}
          </div>
        </div>
      )}
    </>
  );
}

function IrtBankSection({ platformBanks, onAdd, onEdit, onDelete, onToggle, transactions }) {
  const irtTxs = (transactions || []).filter((tx) => (tx.currency || "").toUpperCase() === "IRT" || tx.type === "wire" || tx.type === "deposit_wire");
  return (
    <>
      <div className="ma-row-between">
        <div className="ma-pwTitle">IRT Platform Wallet</div>
        <button type="button" onClick={onAdd} className="ma-btn ma-btn--primary ma-btn--sm"><Plus size={13} /> Add New Bank</button>
      </div>

      {platformBanks.length === 0 && <EmptyState>No platform bank accounts (wires) configured yet.</EmptyState>}

      <div className="ma-activity">
        {platformBanks.map((bank) => (
          <div key={bank.id} className="ma-gasBox" style={{ gap: 10, padding: 12, borderColor: bank.is_active ? "rgba(16,185,129,.35)" : undefined, background: bank.is_active ? "rgba(16,185,129,.05)" : undefined }}>
            <div className="ma-metaList">
              <MetaRow label="Bank Name" value={bank.bank_name} />
              <MetaRow label="Holder" value={bank.bank_holder_name} />
              <MetaRow label="Card" value={bank.bank_card_number} />
              <MetaRow label="Sheba" value={bank.bank_sheba} />
            </div>
            <div className="ma-row-between">
              <Tag text={bank.is_active ? "ACTIVE" : "INACTIVE"} color={bank.is_active ? "#34d399" : "#94a3b8"} />
              <div className="ma-row">
                <button type="button" onClick={() => onToggle(bank)} className="ma-btn ma-btn--ghost ma-btn--sm"><Power size={11} /> {bank.is_active ? "Deactivate" : "Activate"}</button>
                {!bank.has_transactions && (
                  <>
                    <button type="button" onClick={() => onEdit(bank)} className="ma-btn ma-btn--sm"><Edit2 size={11} /> Edit</button>
                    <button type="button" onClick={() => onDelete(bank.id)} className="ma-btn ma-btn--danger ma-btn--sm" aria-label="Delete bank"><Trash2 size={11} /></button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {irtTxs.length > 0 && (
        <div>
          <div className="ma-sectionLabel">Platform bank transactions (IRT / wire)</div>
          <div className="ma-txList ma-scrollY" style={{ maxHeight: 420 }}>
            {irtTxs.slice(0, 30).map((tx) => <TxRow key={tx.id} tx={tx} showHash={false} showNetwork={false} forceCurrency="IRT" />)}
          </div>
        </div>
      )}
    </>
  );
}

function PlatformWalletsTab({
  platformWallet, platformBanks, onAddBank, onEditBank, onDeleteBank, onToggleBank,
  retryingAll, retryAllSweeps, loadData, retrySweep, retryingSweepId, expandedSweepId, setExpandedSweepId,
}) {
  const allRows = Array.isArray(platformWallet?.wallets) ? platformWallet.wallets : [];
  const cryptoRows = allRows.filter((r) => r.currency_type === "crypto");
  const gasFees = platformWallet?.gas_fees || [];
  const transactions = platformWallet?.transactions || [];
  const failedSweeps = Array.isArray(platformWallet?.failed_sweeps) ? platformWallet.failed_sweeps : [];

  const [view, setView] = useState("wallets");
  const showingSweeps = view === "sweeps";

  return (
    <section className="ma-card">
      <div className="ma-card-head">
        <div>
          <div className="ma-card-title">{showingSweeps ? "Failed Sweeps" : "Platform Wallets"}</div>
          <div className="ma-subtle">
            {showingSweeps ? "Retry each failed sweep individually or all at once." : "Hot Wallet · Master Wallet · IRT Platform Wallet"}
          </div>
        </div>
        {showingSweeps ? (
          <button type="button" onClick={() => setView("wallets")} className="ma-btn"><ArrowRightLeft size={13} /> Back to Wallets</button>
        ) : (
          <button type="button" onClick={() => setView("sweeps")} className="ma-btn">
            <ArrowRightLeft size={13} /> Sweeps
            {failedSweeps.length > 0 && <Tag text={failedSweeps.length} color="#f87171" />}
          </button>
        )}
      </div>

      {!showingSweeps && (
        <div className="ma-pwGrid">
          <div className="ma-pwCol"><PlatformWalletColumn title="Hot Wallet" walletKey="hot_wallet" rows={cryptoRows} gasFees={gasFees} transactions={transactions} /></div>
          <div className="ma-pwCol"><PlatformWalletColumn title="Master Wallet" walletKey="master_wallet" rows={cryptoRows} gasFees={gasFees} transactions={transactions} /></div>
          <div className="ma-pwCol"><IrtBankSection platformBanks={platformBanks} onAdd={onAddBank} onEdit={onEditBank} onDelete={onDeleteBank} onToggle={onToggleBank} transactions={transactions} /></div>
        </div>
      )}

      {showingSweeps && (
        <div style={{ marginTop: 14 }}>
          <div className="ma-row" style={{ marginBottom: 12 }}>
            <button type="button" onClick={retryAllSweeps} disabled={retryingAll} className="ma-btn ma-btn--danger"><Zap size={13} /> {retryingAll ? "Retrying all..." : "Retry All Failed"}</button>
            <button type="button" onClick={loadData} className="ma-btn"><RefreshCcw size={13} /> Reload</button>
          </div>
          <FailedSweepsList rows={failedSweeps} onRetry={retrySweep} retryingId={retryingSweepId} expandedId={expandedSweepId} onExpandToggle={setExpandedSweepId} />
        </div>
      )}
    </section>
  );
}

function FailedSweepsList({ rows, onRetry, retryingId, expandedId, onExpandToggle }) {
  if (!rows.length) return <EmptyState>No failed sweeps recorded.</EmptyState>;
  return (
    <div className="ma-tileGrid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))" }}>
      {rows.map((row) => {
        const isExpanded = expandedId === row.id;
        return (
          <div key={row.id} className="ma-sweepCard">
            <button type="button" onClick={() => onExpandToggle(isExpanded ? null : row.id)} style={{ background: "none", border: "none", color: "inherit", textAlign: "left", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
              <div style={{ fontWeight: 800, fontSize: 13.5 }}>
                {row.currency}/{row.network || "N/A"} · {fmt(row.amount)}
              </div>
              {(row.user_id || row.username) && (
                <div className="ma-subtle" style={{ marginTop: 2 }}>User #{row.user_id}{row.username ? ` · ${row.username}` : ""}</div>
              )}
              <div className="ma-subtle" style={{ marginTop: 4 }}>{row.reason || row.error || "Unknown failure"}</div>
            </button>
            <button type="button" onClick={() => onRetry(row.id)} disabled={retryingId === row.id} className="ma-btn ma-btn--sm ma-btn--block">
              <Zap size={13} /> {retryingId === row.id ? "Retrying..." : "Retry"}
            </button>
            {isExpanded && (
              <div className="ma-metaList">
                <MetaRow label="User ID" value={row.user_id} />
                <MetaRow label="Username" value={row.username} />
                <MetaRow label="Created" value={fmtDate(row.created_at)} />
                <MetaRow label="Retries" value={row.retries} />
                <MetaRow label="Resolved" value={row.resolved ? "Yes" : "No"} />
                <MetaRow label="Source wallet" value={row.trail?.source_wallet} />
                <MetaRow label="Hot wallet" value={row.trail?.hot_wallet} />
                <MetaRow label="Master wallet" value={row.trail?.master_wallet} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BankModal({ draft, setDraft, isEdit, onClose, onSave, saving }) {
  const set = (k, v) => setDraft((prev) => ({ ...prev, [k]: v }));
  const field = (label, key, placeholder) => (
    <label className="ma-field">
      <span className="ma-label">{label}</span>
      <input className="ma-input" value={draft[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} />
    </label>
  );
  return (
    <div className="ma-modalOverlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ma-modal ma-modal--md">
        <div className="ma-modalHeader">
          <div>
            <div className="ma-modalTitle">{isEdit ? "Edit" : "Add"} Platform Bank Account</div>
            <div className="ma-modalSub">This is a platform-kind "wires" bank account.</div>
          </div>
          <button type="button" onClick={onClose} className="ma-closeBtn"><X size={14} /></button>
        </div>
        <div className="ma-formGrid">
          {field("Bank Name", "bank_name", "e.g., Bank Mellat")}
          {field("Holder Name", "bank_holder_name", "Account holder name")}
          {field("Card Number", "bank_card_number", "16-digit card number")}
          {field("SHEBA", "bank_sheba", "IR...")}
        </div>
        <button type="button" onClick={() => set("is_active", !draft.is_active)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: 0 }}>
          <div style={{ width: 38, height: 22, borderRadius: 11, background: draft.is_active ? "#10b981" : "#1f2937", border: `1px solid ${draft.is_active ? "#10b981" : "#374151"}`, position: "relative", transition: "all .25s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: draft.is_active ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: draft.is_active ? "white" : "#4b5563", transition: "left .25s" }} />
          </div>
          <span style={{ color: draft.is_active ? "#34d399" : "#6b7280", fontSize: 13, fontWeight: 600 }}>Set as Active</span>
        </button>
        <div className="ma-modalActions">
          <button type="button" onClick={onSave} disabled={saving} className="ma-btn ma-btn--primary"><Save size={13} /> {saving ? "Saving..." : "Save"}</button>
          <button type="button" onClick={onClose} className="ma-btn ma-btn--ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}