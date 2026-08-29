import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../config";
import {
  Plus, Edit3, Trash2, Power, PowerOff, Coins, Network, GitCompare,
  ArrowDownCircle, ArrowUpCircle, RefreshCcw, X, Check,
} from "lucide-react";

// ── Skeleton ──────────────────────────────────────────────────
function Sk({ w = "100%", h = 16, r = 6 }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#151f30 25%,#1e2d44 50%,#151f30 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
  );
}

// ── Stat Pill ─────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, accent, loading }) {
  return (
        <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", borderRadius:12, padding:"10px 14px" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: accent + "18", color: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: 0.6, marginBottom: 3 }}>{label}</div>
        {loading ? <Sk w={56} h={22} /> : <div style={{ fontSize: 16, fontWeight: 800, color: accent, letterSpacing: -0.5 }}>{value ?? "—"}</div>}
      </div>
    </div>
  );
}

// ── Toggle Switch ─────────────────────────────────────────────
function Toggle({ checked, onChange, color = "#22c55e" }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ position: "relative", width: 40, height: 22, borderRadius: 11, background: checked ? color : "#1e293b", border: `1px solid ${checked ? color : "#334155"}`, transition: "all 0.25s", cursor: "pointer", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: checked ? 20 : 2, width: 16, height: 16, borderRadius: "50%", background: checked ? "white" : "#475569", transition: "left 0.25s" }} />
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, count, accent, onAdd, addLabel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "16px 0 14px", borderBottom: "1px dotted #424f637f" }}>
      <div style={{ width: 3, height: 20, borderRadius: 4, background: accent }} />
      <Icon size={16} color={accent} />
      <span style={{ color: "white", fontWeight: 700, fontSize: 16 }}>{title}</span>
      <span style={{ background: "#0b1525", border: "1px solid #30415cff", color: "#657b99ff", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>{count}</span>
      <button onClick={onAdd} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa", borderRadius: 10, padding: "7px 13px", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
        <Plus size={13} /> {addLabel}
      </button>
    </div>
  );
}

// ── Currency Card ─────────────────────────────────────────────
function CurrencyCard({ c, onEdit, onToggle, onDelete }) {
  return (
    <div style={S.itemCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ ...S.avatar, background: "#0f1e38", color: "#3b82f6", fontSize: 15, fontWeight: 800 }}>
            {c.icon ? <img src={c.icon} alt={c.symbol} style={{ width: 22, height: 22, borderRadius: "50%" }} onError={(e) => { e.target.style.display = "none"; }} /> : c.symbol?.[0]}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: 15, letterSpacing: 0.3 }}>{c.symbol}</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>{c.name}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.is_active ? "#22c55e" : "#ef4444", boxShadow: c.is_active ? "0 0 5px #22c55e80" : "none" }} />
          <span style={{ fontSize: 10, color: c.is_active ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{c.is_active ? "ACTIVE" : "OFF"}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
        <span style={S.pill}>{c.type}</span>
        <span style={S.pill}>{c.decimals} dec</span>
        <span style={S.pill}>↓ {c.min_deposit}</span>
        <span style={S.pill}>↑ {c.min_withdraw}</span>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 8, borderTop: "1px dotted #47556950" }}>
        <button style={S.cardBtnEdit} onClick={() => onEdit(c)}><Edit3 size={11} style={{ marginRight: 4 }} />Edit</button>
        <button style={{ ...S.cardBtnToggle, background: c.is_active ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)", borderColor: c.is_active ? "rgba(239,68,68,0.22)" : "rgba(34,197,94,0.22)", color: c.is_active ? "#ef4444" : "#22c55e" }} onClick={() => onToggle(c)}>
          {c.is_active ? <PowerOff size={11} style={{ marginRight: 4 }} /> : <Power size={11} style={{ marginRight: 4 }} />}
          {c.is_active ? "Disable" : "Enable"}
        </button>
        <button style={S.cardBtnDelete} onClick={() => onDelete(c.id)}><Trash2 size={11} /></button>
      </div>
    </div>
  );
}

// ── Network Card ──────────────────────────────────────────────
function NetworkCard({ n,onEdit, onToggle, onDelete }) {
  return (
    <div style={S.itemCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ ...S.avatar, background: "#0f2318", color: "#22c55e", fontSize: 18 }}>🌐</div>
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 15 }}>{n.name}</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 1 }}>Chain: {n.chain}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: n.is_active ? "#22c55e" : "#ef4444", boxShadow: n.is_active ? "0 0 5px #22c55e80" : "none" }} />
          <span style={{ fontSize: 10, color: n.is_active ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{n.is_active ? "ACTIVE" : "OFF"}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 8, borderTop: "1px dotted #47556950" }}>
          <button style={S.cardBtnEdit} onClick={() => onEdit(n)}><Edit3 size={11} style={{ marginRight: 4 }} />Edit</button>
        <button style={{ ...S.cardBtnToggle, flex: 1, background: n.is_active ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)", borderColor: n.is_active ? "rgba(239,68,68,0.22)" : "rgba(34,197,94,0.22)", color: n.is_active ? "#ef4444" : "#22c55e" }} onClick={() => onToggle(n)}>
          {n.is_active ? <PowerOff size={11} style={{ marginRight: 4 }} /> : <Power size={11} style={{ marginRight: 4 }} />}
          {n.is_active ? "Disable" : "Enable"}
        </button>
        <button style={S.cardBtnDelete} onClick={() => onDelete(n.id)}><Trash2 size={11} /></button>
      </div>
    </div>
  );
}

// ── Pair Card ─────────────────────────────────────────────────
function PairCard({ p, onEdit, onToggle, onToggleDeposit, onToggleWithdraw, onDelete }) {
  return (
    <div style={S.itemCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ ...S.avatar, background: "#0d1a30", color: "#3b82f6" }}>🔗</div>
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 15 }}>{p.currency?.symbol}</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 1 }}>{p.network?.name} · {p.network?.chain}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.is_active ? "#22c55e" : "#ef4444", boxShadow: p.is_active ? "0 0 5px #22c55e80" : "none" }} />
          <span style={{ fontSize: 10, color: p.is_active ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{p.is_active ? "ACTIVE" : "OFF"}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {p.is_default && <span style={{ ...S.pill, background: "rgba(168,85,247,0.12)", borderColor: "rgba(168,85,247,0.3)", color: "#a855f7" }}>★ Default</span>}
        <span style={S.pill}>↓ min {p.min_deposit}</span>
        {p.max_deposit > 0 && <span style={S.pill}>↓ max {p.max_deposit}</span>}
        <span style={S.pill}>↑ min {p.min_withdraw}</span>
        <span style={S.pill}>fee {p.withdraw_fee}</span>
        <span style={S.pill}>{p.confirmations_required} conf</span>
      </div>

      {/* Deposit / Withdraw toggles */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onToggleDeposit(p)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "6px 0", borderRadius: 8, fontSize: 11, fontWeight: 600, border: "1px solid", cursor: "pointer", background: p.deposit_enabled ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", borderColor: p.deposit_enabled ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)", color: p.deposit_enabled ? "#22c55e" : "#ef4444" }}>
          <ArrowDownCircle size={12} /> Deposit
        </button>
        <button onClick={() => onToggleWithdraw(p)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "6px 0", borderRadius: 8, fontSize: 11, fontWeight: 600, border: "1px solid", cursor: "pointer", background: p.withdraw_enabled ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", borderColor: p.withdraw_enabled ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)", color: p.withdraw_enabled ? "#22c55e" : "#ef4444" }}>
          <ArrowUpCircle size={12} /> Withdraw
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 8, borderTop: "1px dotted #47556950" }}>
        <button style={S.cardBtnEdit} onClick={() => onEdit(p)}><Edit3 size={11} style={{ marginRight: 4 }} />Edit</button>
        <button style={{ ...S.cardBtnToggle, background: p.is_active ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)", borderColor: p.is_active ? "rgba(239,68,68,0.22)" : "rgba(34,197,94,0.22)", color: p.is_active ? "#ef4444" : "#22c55e" }} onClick={() => onToggle(p)}>
          {p.is_active ? <PowerOff size={11} style={{ marginRight: 4 }} /> : <Power size={11} style={{ marginRight: 4 }} />}
          {p.is_active ? "Disable" : "Enable"}
        </button>
        <button style={S.cardBtnDelete} onClick={() => onDelete(p.id)}><Trash2 size={11} /></button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function AssetManager() {
  const [currencies, setCurrencies] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(false);

  // panel: null | "currency" | "network" | "pair"
  const [panel, setPanel] = useState(null);
  // editTarget: the object being edited, or null for "create"
  const [editTarget, setEditTarget] = useState(null);

  const [currencyForm, setCurrencyForm] = useState(emptyCurrencyForm());
  const [networkForm, setNetworkForm] = useState(emptyNetworkForm());
  const [pairForm, setPairForm] = useState(emptyPairForm());

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { "Content-Type": "application/json", ...headers };

  function emptyCurrencyForm() {
    return { symbol: "", name: "", type: "crypto", decimals: 2, icon: "", min_deposit: 0, min_withdraw: 0 };
  }
  function emptyNetworkForm() {
    return { name: "", chain: "" };
  }
  function emptyPairForm() {
    return { currency_id: "", network_id: "", is_active: true, is_default: false, deposit_enabled: true, withdraw_enabled: true, min_deposit: 0, max_deposit: 0, min_withdraw: 0, withdraw_fee: 0, confirmations_required: 1 };
  }

  const openPanel = (type, target = null) => {
      if (panel === type && !target && !editTarget) {
    closePanel();
    return;
  }
    setPanel(type);
    setEditTarget(target);
    if (type === "currency") {
      setCurrencyForm(target ? { symbol: target.symbol, name: target.name, type: target.type, decimals: target.decimals, icon: target.icon || "", min_deposit: target.min_deposit, min_withdraw: target.min_withdraw } : emptyCurrencyForm());
    } else if (type === "network") {
      setNetworkForm(target ? { name: target.name, chain: target.chain } : emptyNetworkForm());
    } else if (type === "pair") {
      setPairForm(target ? { currency_id: target.currency_id, network_id: target.network_id, is_active: target.is_active, is_default: target.is_default || false, deposit_enabled: target.deposit_enabled, withdraw_enabled: target.withdraw_enabled, min_deposit: target.min_deposit || 0, max_deposit: target.max_deposit || 0, min_withdraw: target.min_withdraw || 0, withdraw_fee: target.withdraw_fee || 0, confirmations_required: target.confirmations_required || 1 } : emptyPairForm());
    }
  };

  const closePanel = () => { setPanel(null); setEditTarget(null); };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cRes, nRes, pRes] = await Promise.all([
        fetch(`${API_URL}/admin/currencies/`, { headers }),
        fetch(`${API_URL}/admin/networks/`, { headers }),
        fetch(`${API_URL}/admin/currency-networks/`, { headers }),
      ]);
      if (cRes.status === 401) { localStorage.removeItem("token"); window.location.href = "/login"; return; }
      setCurrencies(await cRes.json().then(d => Array.isArray(d) ? d : []));
      setNetworks(await nRes.json().then(d => Array.isArray(d) ? d : []));
      setPairs(await pRes.json().then(d => Array.isArray(d) ? d : []));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  // ── Currency actions ──────────────────────────────────────
  const saveCurrency = async () => {
    if (editTarget) {
      await fetch(`${API_URL}/admin/currencies/${editTarget.id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ name: currencyForm.name, type: currencyForm.type, decimals: currencyForm.decimals, icon: currencyForm.icon || null, min_deposit: currencyForm.min_deposit, min_withdraw: currencyForm.min_withdraw }) });
    } else {
      const res = await fetch(`${API_URL}/admin/currencies/`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(currencyForm) });
      if (!res.ok) { const d = await res.json(); alert(d.detail || "Failed"); return; }
    }
    closePanel(); loadAll();
  };

  const toggleCurrency = async (c) => {
    await fetch(`${API_URL}/admin/currencies/${c.id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ is_active: !c.is_active }) });
    loadAll();
  };

  const deleteCurrency = async (id) => {
    if (!window.confirm("Delete currency?")) return;
    await fetch(`${API_URL}/admin/currencies/${id}`, { method: "DELETE", headers });
    loadAll();
  };

  // ── Network actions ───────────────────────────────────────
  const saveNetwork = async () => {
    if (editTarget) {
      await fetch(`${API_URL}/admin/networks/${editTarget.id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(networkForm) });
    } else {
      const res = await fetch(`${API_URL}/admin/networks/`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(networkForm) });
      if (!res.ok) { const d = await res.json(); alert(d.detail || "Failed"); return; }
    }
    closePanel(); loadAll();
  };

  const toggleNetwork = async (n) => {
    await fetch(`${API_URL}/admin/networks/${n.id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ is_active: !n.is_active }) });
    loadAll();
  };

  const deleteNetwork = async (id) => {
    if (!window.confirm("Delete network?")) return;
    await fetch(`${API_URL}/admin/networks/${id}`, { method: "DELETE", headers });
    loadAll();
  };

  // ── Pair actions ──────────────────────────────────────────
  const savePair = async () => {
    if (editTarget) {
      const res = await fetch(`${API_URL}/admin/currency-networks/${editTarget.id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ is_active: pairForm.is_active, is_default: pairForm.is_default, deposit_enabled: pairForm.deposit_enabled, withdraw_enabled: pairForm.withdraw_enabled, min_deposit: pairForm.min_deposit, max_deposit: pairForm.max_deposit, min_withdraw: pairForm.min_withdraw, withdraw_fee: pairForm.withdraw_fee, confirmations_required: pairForm.confirmations_required }) });
      if (!res.ok) { const d = await res.json(); alert(d.detail || "Failed"); return; }
    } else {
      if (!pairForm.currency_id || !pairForm.network_id) { alert("Select currency and network"); return; }
      const res = await fetch(`${API_URL}/admin/currency-networks/`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ currency_id: Number(pairForm.currency_id), network_id: Number(pairForm.network_id) }) });
      if (!res.ok) { const d = await res.json(); alert(d.detail || "Failed"); return; }
    }
    closePanel(); loadAll();
  };

  const togglePair = async (p) => {
    await fetch(`${API_URL}/admin/currency-networks/${p.id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ is_active: !p.is_active }) });
    loadAll();
  };

  const toggleDeposit = async (p) => {
    await fetch(`${API_URL}/admin/currency-networks/${p.id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ deposit_enabled: !p.deposit_enabled }) });
    loadAll();
  };

  const toggleWithdraw = async (p) => {
    await fetch(`${API_URL}/admin/currency-networks/${p.id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ withdraw_enabled: !p.withdraw_enabled }) });
    loadAll();
  };

  const deletePair = async (id) => {
    if (!window.confirm("Delete pair?")) return;
    await fetch(`${API_URL}/admin/currency-networks/${id}`, { method: "DELETE", headers });
    loadAll();
  };

  const stats = useMemo(() => ({
    currencies: currencies.length,
    activeCurrencies: currencies.filter(c => c.is_active).length,
    networks: networks.length,
    activeNetworks: networks.filter(n => n.is_active).length,
    pairs: pairs.length,
    activePairs: pairs.filter(p => p.is_active).length,
  }), [currencies, networks, pairs]);

  const panelOpen = panel !== null;

  // ── Panel meta ────────────────────────────────────────────
  const panelMeta = {
    currency: { title: editTarget ? "Edit Currency" : "New Currency", sub: editTarget ? `Editing ${editTarget.symbol}` : "Add a new currency to the system" },
    network: { title: editTarget ? "Edit Network" : "New Network", sub: editTarget ? `Editing ${editTarget.name}` : "Add a new blockchain network" },
    pair: { title: editTarget ? "Edit Pair" : "New Pair", sub: editTarget ? `Editing ${editTarget.currency?.symbol} · ${editTarget.network?.name}` : "Link a currency to a network" },
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#060b16", overflow: "hidden", fontFamily: "'Inter', sans-serif" }}>

      {/* ── SIDE PANEL ── */}
      <div style={{ width: panelOpen ? 390 : 0, minWidth: panelOpen ? 390 : 0, transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden", borderRight: panelOpen ? "1px solid #0f172a" : "none", background: "#080e1a", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ width: 390, height: "100%", display: "flex", flexDirection: "column", padding: 24, boxSizing: "border-box" }}>

          {/* Panel header */}
          {panel && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                  <div style={{ color: "white", fontWeight: 700, fontSize: 18 }}>{panelMeta[panel]?.title}</div>
                  <div style={{ color: "#63748dff", fontSize: 13, marginTop: 3 }}>{panelMeta[panel]?.sub}</div>
                </div>
                <button onClick={closePanel} style={S.closeIconBtn}><X size={16} /></button>
              </div>

              {/* ── CURRENCY FORM ── */}
              {panel === "currency" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, overflowY: "auto" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <Field label="Symbol">
                    <input
                      placeholder="USDT"
                      value={currencyForm.symbol}
                      disabled={!!editTarget}
                      onChange={(e) =>
                        setCurrencyForm((f) => ({
                          ...f,
                          symbol: e.target.value.toUpperCase(),
                        }))
                      }
                      style={{
                        ...S.input,
                        opacity: editTarget ? 0.6 : 1,
                      }}
                    />
                  </Field>

                  <Field label="Name">
                    <input
                      placeholder="Tether USD"
                      value={currencyForm.name}
                      onChange={(e) =>
                        setCurrencyForm((f) => ({
                          ...f,
                          name: e.target.value,
                        }))
                      }
                      style={S.input}
                    />
                  </Field>
                </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Type">
                      <select style={S.input} value={currencyForm.type} onChange={e => setCurrencyForm(f => ({ ...f, type: e.target.value }))}>
                        <option value="crypto">Crypto</option>
                        <option value="fiat">Fiat</option>
                      </select>
                    </Field>
                    <Field label="Decimals">
                      <input type="number" style={S.input} value={currencyForm.decimals} onChange={e => setCurrencyForm(f => ({ ...f, decimals: Number(e.target.value) }))} />
                    </Field>
                  </div>
                  <Field label="Icon URL">
                    <input style={S.input} placeholder="https://…" value={currencyForm.icon} onChange={e => setCurrencyForm(f => ({ ...f, icon: e.target.value }))} />
                  </Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Min Deposit">
                      <input type="number" style={S.input} value={currencyForm.min_deposit} onChange={e => setCurrencyForm(f => ({ ...f, min_deposit: Number(e.target.value) }))} />
                    </Field>
                    <Field label="Min Withdraw">
                      <input type="number" style={S.input} value={currencyForm.min_withdraw} onChange={e => setCurrencyForm(f => ({ ...f, min_withdraw: Number(e.target.value) }))} />
                    </Field>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 16, borderTop: "1px solid #0f172a" }}>
                    <button style={S.cancelBtn} onClick={closePanel}>Cancel</button>
                    <button style={S.submitBtn} onClick={saveCurrency}>{editTarget ? "Save Changes" : "Create Currency"}</button>
                  </div>
                </div>
              )}

              {/* ── NETWORK FORM ── */}
              {panel === "network" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
                  <Field label="Network Name">
                    <input style={S.input} placeholder="BEP20" value={networkForm.name} onChange={e => setNetworkForm(f => ({ ...f, name: e.target.value }))} />
                  </Field>
                  <Field label="Blockchain Chain">
                    <input style={S.input} placeholder="BSC" value={networkForm.chain} onChange={e => setNetworkForm(f => ({ ...f, chain: e.target.value }))} />
                  </Field>
                  <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 16, borderTop: "1px solid #0f172a" }}>
                    <button style={S.cancelBtn} onClick={closePanel}>Cancel</button>
                    <button style={S.submitBtn} onClick={saveNetwork}>{editTarget ? "Save Changes" : "Create Network"}</button>
                  </div>
                </div>
              )}

              {/* ── PAIR FORM ── */}
              {panel === "pair" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, overflowY: "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Currency">
                      <select style={{ ...S.input, opacity: editTarget ? 0.6 : 1 }} value={pairForm.currency_id} disabled={!!editTarget} onChange={e => setPairForm(f => ({ ...f, currency_id: e.target.value }))}>
                        <option value="">Select…</option>
                        {currencies.map(c => <option key={c.id} value={c.id}>{c.symbol} — {c.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Network">
                      <select style={{ ...S.input, opacity: editTarget ? 0.6 : 1 }} value={pairForm.network_id} disabled={!!editTarget} onChange={e => setPairForm(f => ({ ...f, network_id: e.target.value }))}>
                        <option value="">Select…</option>
                        {networks.map(n => <option key={n.id} value={n.id}>{n.name} ({n.chain})</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Min Deposit">
                      <input type="number" step="0.00000001" style={S.input} value={pairForm.min_deposit} onChange={e => setPairForm(f => ({ ...f, min_deposit: Number(e.target.value) }))} />
                    </Field>
                    <Field label="Max Deposit">
                      <input type="number" step="0.00000001" style={S.input} value={pairForm.max_deposit} onChange={e => setPairForm(f => ({ ...f, max_deposit: Number(e.target.value) }))} />
                    </Field>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Min Withdraw">
                      <input type="number" step="0.00000001" style={S.input} value={pairForm.min_withdraw} onChange={e => setPairForm(f => ({ ...f, min_withdraw: Number(e.target.value) }))} />
                    </Field>
                    <Field label="Withdraw Fee">
                      <input type="number" step="0.00000001" style={S.input} value={pairForm.withdraw_fee} onChange={e => setPairForm(f => ({ ...f, withdraw_fee: Number(e.target.value) }))} />
                    </Field>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Confirmations">
                      <input type="number" style={S.input} value={pairForm.confirmations_required} onChange={e => setPairForm(f => ({ ...f, confirmations_required: Number(e.target.value) }))} />
                    </Field>
                  </div>

                  {/* Toggle rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px", background: "#050a1405", borderRadius: 12 }}>
                    {[
                      { key: "is_active", label: "Active", color: "#22c55e" },
                      { key: "is_default", label: "Default (auto-created for every new user)", color: "#a855f7" },
                      { key: "deposit_enabled", label: "Deposit Enabled", color: "#3b82f6" },
                      { key: "withdraw_enabled", label: "Withdraw Enabled", color: "#f59e0b" },
                    ].map(({ key, label, color }) => (
                      <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                        <Toggle checked={pairForm[key]} onChange={v => setPairForm(f => ({ ...f, [key]: v }))} color={color} />
                        <span style={{ color: pairForm[key] ? "#e2e8f0" : "#64748b", fontSize: 13, fontWeight: 500 }}>{label}</span>
                      </label>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 16, borderTop: "1px solid #0f172a" }}>
                    <button style={S.cancelBtn} onClick={closePanel}>Cancel</button>
                    <button style={S.submitBtn} onClick={savePair}>{editTarget ? "Save Changes" : "Create Pair"}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
              {/* ── HEADER ── */}
      <div style={S.header}>
        <div style={S.headerLeft}>

          <div>
            <div style={S.title}>Asset Management</div>
            <div style={S.subtitle}>Manage currencies, networks and pairs</div>
          </div>
            <StatPill icon={Coins} label="Active Currencies" value={`${stats.activeCurrencies} / ${stats.currencies}`} accent="#34d399" loading={loading} />
            <StatPill icon={Network} label="Active Networks" value={`${stats.activeNetworks} / ${stats.networks}`} accent="#fbbf24" loading={loading} />
            <StatPill icon={GitCompare} label="Active Pairs" value={`${stats.activePairs} / ${stats.pairs}`} accent="#3b82f6" loading={loading} />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={loadAll} style={S.refreshBtn}>Refresh</button>
        </div>
      </div>


        {/* 3-column layout */}
        <div style={{ 
          flex: 1, 
          overflowY: "auto", 
          padding: "20px 24px 28px", 
          display: "grid", 
          gridTemplateColumns: "1fr 1fr 1fr", 
          gap: 10, 
          alignContent: "start", 
          scrollbarWidth: "thin", 
          scrollbarColor: "#1e293b #060b16" ,
              alignContent: "stretch",   // 👈 important change
    height: "100%",  
          }}
          >

          {/* ── CURRENCIES ── */}
          <div style={{ 
            display: "flex", 
            flexDirection: "column",
            paddingRight: 20,
            borderRight: "1px solid #1e293b",
            minHeight: "100%"
            }}>
            <SectionHeader icon={Coins} title="Currencies" count={currencies.length} accent="#34d399" onAdd={() => openPanel("currency")} addLabel="Add Currency" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {currencies.map(c => (
                <CurrencyCard key={c.id} c={c} onEdit={c => openPanel("currency", c)} onToggle={toggleCurrency} onDelete={deleteCurrency} />
              ))}
              {currencies.length === 0 && !loading && (
                <div style={S.emptyState}>
                  <Coins size={32} strokeWidth={1} color="#1e293b" />
                  <span style={{ color: "#334155", fontSize: 13 }}>No currencies yet</span>
                </div>
              )}
            </div>
          </div>

          {/* ── NETWORKS ── */}
          <div style={{ 
            display: "flex", 
            flexDirection: "column",
            paddingRight: 20,
             paddingLeft: 20,
            borderRight: "1px solid #1e293b",
            minHeight: "100%" }}>
            <SectionHeader icon={Network} title="Networks" count={networks.length} accent="#fbbf24" onAdd={() => openPanel("network")} addLabel="Add Network" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {networks.map(n => (
                <NetworkCard key={n.id} n={n} onEdit={n => openPanel("network", n)}  onToggle={toggleNetwork} onDelete={deleteNetwork} />
              ))}
              {networks.length === 0 && !loading && (
                <div style={S.emptyState}>
                  <Network size={32} strokeWidth={1} color="#1e293b" />
                  <span style={{ color: "#334155", fontSize: 13 }}>No networks yet</span>
                </div>
              )}
            </div>
          </div>

          {/* ── PAIRS ── */}
          <div style={{ display: "flex", flexDirection: "column" ,paddingLeft: 20}}>
            <SectionHeader icon={GitCompare} title="Currency Pairs" count={pairs.length} accent="#3b82f6" onAdd={() => openPanel("pair")} addLabel="Add Pair" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pairs.map(p => (
                <PairCard key={p.id} p={p} onEdit={p => openPanel("pair", p)} onToggle={togglePair} onToggleDeposit={toggleDeposit} onToggleWithdraw={toggleWithdraw} onDelete={deletePair} />
              ))}
              {pairs.length === 0 && !loading && (
                <div style={S.emptyState}>
                  <GitCompare size={32} strokeWidth={1} color="#1e293b" />
                  <span style={{ color: "#334155", fontSize: 13 }}>No pairs yet</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const S = {
   page: {
    padding: "5px",
    background: "#020617",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    color: "white",
    boxSizing: "border-box",
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 15,
    flexWrap: "wrap",
  },

    title: { color: "#2e7ce9af",margin: 0, fontSize: 26, fontWeight: 600, marginRight: 20 , letterSpacing: "0.1rem",   },
  subtitle: { color: "#64748b", fontSize: 13, margin: "2px 0 0" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 14,  padding :"10px 0 20px 20px",  flexWrap: "wrap"
  },
  refreshBtn: {
    display: "flex",
    alignItems: "center",
    background: "transparent",
    border: "1px solid #313d58ff",
    borderRadius: 10,
    padding: "8px 14px",
    color: "#6c798dff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  },
  input: {
    background: "#060d1a",
    border: "1px solid #313d58ff",
    color: "white",
    padding: "10px 13px",
    borderRadius: 10,
    outline: "none",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  },
  submitBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(59,130,246,0.2)",
    border: "1px solid rgba(59,130,246,0.35)",
    color: "#60a5fa",
    padding: "10px 20px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  cancelBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "1px solid #313d58ff",
    color: "#475569",
    padding: "10px 16px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  closeIconBtn: {
    background: "#0b1525",
    border: "1px solid #313d58ff",
    color: "#475569",
    width: 32,
    height: 32,
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  // Item cards
  itemCard: {
    background: "#0b1424",
    border: "1px solid #313d58bc",
    borderRadius: 16,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxSizing: "border-box",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    border: "1px solid #313d58ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: 16,
    fontWeight: 800,
    overflow: "hidden",
  },
  pill: {
    background: "#060d1a",
    border: "1px solid #313d58ff",
    borderRadius: 6,
    padding: "3px 7px",
    fontSize: 11,
    color: "#5d718dff",
  },

  // Card action buttons
  cardBtnEdit: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(59,130,246,0.1)",
    border: "1px solid rgba(59,130,246,0.2)",
    borderRadius: 8,
    padding: "6px 0",
    color: "#60a5fa",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 11,
  },
  cardBtnToggle: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid",
    borderRadius: 8,
    padding: "6px 0",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 11,
  },
  cardBtnDelete: {
    width: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 8,
    color: "#ef4444",
    cursor: "pointer",
  },

  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "40px 0",
    borderRadius: 14,
    border: "1px dashed #1e293b",
  },
};