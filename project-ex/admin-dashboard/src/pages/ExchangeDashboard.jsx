import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  ArrowLeftRight, FileText, AlertTriangle, Plus, Edit3, Trash2,
  Power, PowerOff, X, Save, RotateCw, GitCompare, BarChart3,
  CheckCircle2, XCircle, Clock, ArrowUpDown, Wallet,
} from "lucide-react";
import AnalysisTab from "../components/exchange/AnalysisTab";
import HeroHub from "../components/HeroHub";
import "./ExchangeDashboard.css";

const API = "http://127.0.0.1:8000";
const api = axios.create({ baseURL: API });

const RIGHT_TABS = { ORDERS: "orders", FAILED_SWEEPS: "failed_sweeps", ANALYSIS: "analysis", PAIRS: "pairs" };

const fmt = (n, d = 4) =>
  n != null ? Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d }) : "—";
const fmtDate = (d) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const STATUS = {
  completed: { color: "#4ade80", bg: "rgba(34,197,94,.1)",  border: "rgba(34,197,94,.22)",  icon: CheckCircle2, label: "Done" },
  pending:   { color: "#fbbf24", bg: "rgba(245,158,11,.1)", border: "rgba(245,158,11,.22)", icon: Clock,        label: "Pending" },
  failed:    { color: "#f87171", bg: "rgba(239,68,68,.1)",  border: "rgba(239,68,68,.22)",  icon: XCircle,      label: "Failed" },
};

/* ─── TOAST ─── */
const showToast = (msg, ok = true) => {
  const el = document.createElement("div");
  el.textContent = msg;
  el.className = `ex-toast ${ok ? "is-ok" : "is-err"}`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-show"));
  setTimeout(() => {
    el.classList.remove("is-show");
    setTimeout(() => el.remove(), 300);
  }, 3000);
};

/* ─── SKELETON ─── */
const Sk = ({ h = 14 }) => <div className="ex-sk" style={{ height: h }} />;

/* ─── STATUS BADGE (colors come from STATUS config → stay inline) ─── */
function StatusBadge({ status }) {
  const s = STATUS[status?.toLowerCase()] || STATUS.completed;
  const Icon = s.icon;
  return (
    <span className="ex-badge" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      <Icon size={11} />{s.label}
    </span>
  );
}

/* ─── FIELD ─── */
const Field = ({ label, children }) => (
  <div className="ex-field">
    <label className="ex-field-label">{label}</label>
    {children}
  </div>
);

/* ─── PAIR FORM (add / edit) ─── */
function PairForm({ data, setData, onSubmit, submitLabel, onCancel, currencies }) {
  const [err, setErr] = useState("");
  const set = (k, v) => setData(f => ({ ...f, [k]: v }));
  const submit = () => {
    if (!data.from_currency_id || !data.to_currency_id || !data.rate) { setErr("From, To and Rate are required."); return; }
    setErr(""); onSubmit();
  };
  return (
    <div className="ex-form">
      {err && <div className="ex-error">{err}</div>}
      <div className="ex-form-body">
        <div className="ex-grid2">
          <Field label="From">
            <select className="ex-input" value={data.from_currency_id} onChange={e => set("from_currency_id", e.target.value)}>
              <option value="">Select…</option>
              {currencies.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
            </select>
          </Field>
          <Field label="To">
            <select className="ex-input" value={data.to_currency_id} onChange={e => set("to_currency_id", e.target.value)}>
              <option value="">Select…</option>
              {currencies.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
            </select>
          </Field>
        </div>
        <div className="ex-grid2">
          <Field label="Rate"><input type="number" className="ex-input" placeholder="0.00" value={data.rate} onChange={e => set("rate", e.target.value)} /></Field>
          <Field label="Fee %"><input type="number" className="ex-input" placeholder="0" value={data.fee_percent} onChange={e => set("fee_percent", e.target.value)} /></Field>
        </div>
        <div className="ex-grid2">
          <Field label="Min amount"><input type="number" className="ex-input" placeholder="0" value={data.min_amount} onChange={e => set("min_amount", e.target.value)} /></Field>
          <Field label="Max amount"><input type="number" className="ex-input" placeholder="∞" value={data.max_amount} onChange={e => set("max_amount", e.target.value)} /></Field>
        </div>
        <button type="button" className={`ex-toggle${data.is_active ? " is-on" : ""}`} onClick={() => set("is_active", !data.is_active)}>
          <div className="ex-toggle-track"><div className="ex-toggle-thumb" /></div>
          <span className="ex-toggle-label">{data.is_active ? "Active" : "Inactive"}</span>
        </button>
      </div>
      <div className="ex-form-footer">
        {onCancel && <button className="ex-cancelBtn" onClick={onCancel}>Cancel</button>}
        <button className="ex-primaryBtn" onClick={submit}>{submitLabel}</button>
      </div>
    </div>
  );
}

/* ─── EDIT MODAL ─── */
function PairEditModal({ editPair, currencies, onSave, onClose, boundsStyle }) {
  const [form, setForm] = useState({
    from_currency_id: editPair?.from_currency?.id || "",
    to_currency_id: editPair?.to_currency?.id || "",
    rate: editPair?.rate || "",
    fee_percent: editPair?.fee_percent ?? 0,
    min_amount: editPair?.min_amount ?? 0,
    max_amount: editPair?.max_amount || "",
    is_active: editPair?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => { setSaving(true); await onSave(form); setSaving(false); };

  // The parent unmounts this component the instant `onClose` runs (editPair
  // becomes null), so there's no "is-open" class to reverse-transition off
  // of. Instead: play the reverse animation first, THEN call the real
  // onClose once it's finished, so the component is still mounted while it
  // plays.
  const [closing, setClosing] = useState(false);
  const requestClose = () => {
    setClosing(true);
    setTimeout(onClose, 300); // matches exSlideDown's .3s duration
  };

  return createPortal(
    <div
      className={`ex-scope ex-modal-overlay${closing ? " is-closing" : ""}`}
      style={boundsStyle}
      onClick={e => e.target === e.currentTarget && requestClose()}
    >
      <div className={`ex-modal-card${closing ? " is-closing" : ""}`}>
        <div className="ex-modal-head">
          <div>
            <div className="ex-modal-title">Edit pair</div>
            <div className="ex-modal-sub">{editPair?.from_currency?.symbol} → {editPair?.to_currency?.symbol}</div>
          </div>
          <button className="ex-iconBtn" onClick={requestClose}><X size={14} /></button>
        </div>
        <PairForm data={form} setData={setForm} onSubmit={submit} submitLabel={saving ? "Saving…" : "Save changes"} onCancel={requestClose} currencies={currencies} />
      </div>
    </div>,
    document.body
  );
}

/* ─── MOBILE OVERLAY, scoped to the tab's content area (Add + Detail
      share this). Rendered inline — NOT portaled — so it stays inside
      ex-content and never covers the hero, tabbar or other tabs. ─── */
function MobileOverlay({ open, icon: Icon, iconBg, iconColor, title, onClose, children, boundsStyle }) {
  return (
    <div className={`ex-mobileOverlay${open ? " is-open" : ""}`} style={boundsStyle}>
      <div className="ex-mobileOverlay-backdrop" onClick={onClose} />
      <div className="ex-mobileOverlay-panel">
        <div className="ex-mobileOverlay-head">
          <div className="ex-mobileOverlay-icon" style={{ background: iconBg }}>
            <Icon size={15} color={iconColor} />
          </div>
          <span className="ex-mobileOverlay-title">{title}</span>
          <button className="ex-closeIconBtn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="ex-mobileOverlay-body">{children}</div>
      </div>
    </div>
  );
}

/* ─── PAIR ROW ─── */
function PairRow({ p, selected, onClick, showOwner }) {
  return (
    <div className={`ex-pair${selected ? " is-selected" : ""}`} onClick={onClick}>
      <span className={`ex-dot${p.is_active ? " is-on" : ""}`} />
      <div className="ex-pair-main">
        <div className="ex-pair-name">{p.from_currency?.symbol}→{p.to_currency?.symbol}</div>
        {showOwner && p.admin_id != null && (
          <span className="ex-owner">{p.admin_username || `#${p.admin_id}`}</span>
        )}
      </div>
      <div className="ex-pair-side">
        <span className={`ex-pair-rate${p.is_active ? " is-on" : ""}`}>{p.is_active ? fmt(p.rate, 4) : "—"}</span>
        <span className="ex-pair-fee">Fee {fmt(p.fee_percent, 2)}%</span>
      </div>
    </div>
  );
}

/* ─── PAIR DETAIL PANEL ─── */
function PairDetail({ pair, readOnly, onEdit, onToggle, onDelete, onRateUpdate }) {
  const [localRate, setLocalRate] = useState(pair.rate ?? "");
  useEffect(() => setLocalRate(pair.rate ?? ""), [pair.id]);
  const isIrt = pair?.from_currency?.symbol === "IRT";
  const pairRate = isIrt && Number(pair?.rate) > 0 ? 1 / Number(pair.rate) : Number(pair.rate);

  return (
    <div className="ex-pd">
      <div className="ex-pd-head">
        <div className="ex-pd-headrow">
          <div className={`ex-pd-dot${pair.is_active ? " is-on" : ""}`} />
          <span className="ex-pd-name">{pair.from_currency?.symbol} → {pair.to_currency?.symbol}</span>
          <span className={`ex-pd-live${pair.is_active ? " is-on" : ""}`}>{pair.is_active ? "LIVE" : "OFF"}</span>
        </div>
        {pair.admin_username && <div className="ex-pd-owner">Owner: {pair.admin_username} (#{pair.admin_id})</div>}
      </div>

      <div className="ex-pd-body">
        {/* DOM order stays rate → stats → quick-update, exactly as on desktop.
            On mobile only, CSS Grid (grid-area, see .css) visually places
            quick-update beside the rate box — this element order is untouched. */}
        <div className="ex-pd-rate">
          <div className="ex-pd-rate-label">RATE</div>
          <div className="ex-pd-rate-val">{fmt(pair.rate, 6)}</div>
          {isIrt && Number(pair?.rate) > 0 && <div className="ex-pd-inverse">Inverse: {fmt(pairRate, 6)}</div>}
        </div>

        <div className="ex-pd-stats">
          {[
            ["Fee", `${pair.fee_percent}%`],
            ["Min Exchange", fmt(pair.min_amount)],
            ["Max", pair.max_amount ? fmt(pair.max_amount) : "∞"],
            ["Pair ID", `#${pair.id}`],
          ].map(([k, v]) => (
            <div key={k} className="ex-pd-stat">
              <div className="ex-pd-stat-k">{k}</div>
              <div className="ex-pd-stat-v">{v}</div>
            </div>
          ))}
        </div>

        {!readOnly && (
          <div className="ex-pd-quick">
            <div className="ex-pd-quick-label">QUICK RATE UPDATE</div>
            <div className="ex-pd-quick-row1">
              <input
                type="number"
                className="ex-input ex-input-sm no-spinner"
                value={localRate}
                onChange={(e) => setLocalRate(e.target.value)}
                placeholder="New rate..."
              />
              <div className="ex-stepGroup">
                <button className="ex-stepBtn" onClick={() => setLocalRate(v => Number(v || 0) - 100)}>−</button>
                <button className="ex-stepBtn" onClick={() => setLocalRate(v => Number(v || 0) + 100)}>+</button>
              </div>
            </div>
            <div className="ex-pd-quick-row2">
              <button className="ex-saveRateBtn" onClick={() => onRateUpdate(pair.id, localRate)}>
                <Save size={13} />Save
              </button>
            </div>
          </div>
        )}
      </div>

      {!readOnly ? (
        <div className="ex-pd-foot">
          <button className="ex-actionBtn is-blue" onClick={() => onEdit(pair)}>
            <Edit3 size={11} />Edit
          </button>
          <button className={`ex-actionBtn ${pair.is_active ? "is-red-soft" : "is-green-soft"}`} onClick={() => onToggle(pair)}>
            {pair.is_active ? <><PowerOff size={11} />Disable</> : <><Power size={11} />Enable</>}
          </button>
          <button className="ex-actionBtn is-delete" onClick={() => onDelete(pair.id)}>
            <Trash2 size={12} />
          </button>
        </div>
      ) : (
        <div className="ex-pd-readonly">View only — owned by another admin</div>
      )}
    </div>
  );
}

/* ─── ORDER ROW ─── */
function OrderRow({ item, showOwner }) {
  const fromSym = item.from_currency?.symbol || "—";
  const toSym = item.to_currency?.symbol || "—";
  const displayRate = fromSym === "IRT" && Number(item.rate) > 0 ? 1 / Number(item.rate) : Number(item.rate);

  return (
    <div className="ex-order">
      <div className="ex-order-user">
        <div className="ex-order-ico"><ArrowLeftRight size={12} color="#60a5fa" /></div>
        <div style={{ minWidth: 0 }}>
          <div className="ex-order-name">{item.username ? item.username.toUpperCase() : "—"}</div>
          <div className="ex-order-sub">User #{item.user_id}</div>
        </div>
      </div>

      <div className="ex-order-c ex-order-pairAmt">
        <div className="ex-order-pair">{fromSym} → {toSym}</div>
        <div className="ex-order-amt">{fmt(item.from_amount, 2)} → {fmt(item.to_amount, 2)}</div>
        <div className="ex-order-id">ORDER ID #{item.id}</div>
      </div>

      <div className="ex-order-c ex-order-rateBlock">
        <div className="ex-order-rate">
          <span className="ex-order-rate-l">Rate</span>
          <span className="ex-order-rate-v">{fmt(displayRate, 6)}</span>
          {showOwner && item.admin_id != null && (
            <span className="ex-owner-sm">{item.admin_username} {`#${item.admin_id}`}</span>
          )}
        </div>
        <div className="ex-order-fee">Fee {fmt(item.fee_amount, 2)} {fromSym} ({item.fee_percent}%)</div>
      </div>

      <div className="ex-order-status">
        <StatusBadge status={item.status} />
        <div className="ex-order-date">{fmtDate(item.created_at)}</div>
      </div>
    </div>
  );
}

/* ─── SWEEP ROW ─── */
/* Same 2-row × 2-column grid at every breakpoint:
     "title  status"
     "meta   actions"
     "err    err"      (only rendered when there's an error)
   Only proportions/font-size change between desktop and mobile (see .css) —
   the shape itself is identical, same responsive logic as OrderRow. */
function SweepRow({ sweep, onRetry, retrying, showOwner }) {
  return (
    <div className={`ex-sweep${sweep.resolved ? " is-resolved" : ""}`}>
      <div className="ex-sweep-titleCell">
        <div className="ex-sweep-ico">
          <AlertTriangle size={13} color={sweep.resolved ? "#4ade80" : "#f87171"} />
        </div>
        <div className="ex-sweep-titleText">
          <div className="ex-sweep-title">
            {sweep.currency} <small>{fmt(sweep.amount)} · {sweep.network || "N/A"}</small>
          </div>
          {showOwner && sweep.admin_id != null && (
            <span
              title={sweep.admin_linked ? "Attributed via the pair's owning admin" : "Fallback: attributed via the buyer's admin (older sweep, no linked order)"}
              className={`ex-owner-sm${sweep.admin_linked ? "" : " ex-owner-warn"}`}
            >
              {sweep.admin_username || `#${sweep.admin_id}`}{!sweep.admin_linked && " ~"}
            </span>
          )}
        </div>
      </div>

      <div className="ex-sweep-statusCell">
        <span className="ex-sweep-state">{sweep.resolved ? "Resolved" : "Failed"}</span>
        <div className="ex-sweep-date">{fmtDate(sweep.created_at)}</div>
      </div>

      <div className="ex-sweep-metaCell">
        User #{sweep.user_id} · {sweep.username?.toUpperCase()} · Order #{sweep.exchange_order_id || "—"} · {sweep.retries} retries
      </div>

      <div className="ex-sweep-actionsCell">
        {!sweep.resolved && (
          <button className="ex-retryBtn" onClick={() => onRetry(sweep.id)} disabled={retrying === sweep.id}>
            <RotateCw size={11} className={retrying === sweep.id ? "ex-spin" : ""} />
            {retrying === sweep.id ? "Retrying…" : "Retry"}
          </button>
        )}
      </div>

      {sweep.error && <div className="ex-sweep-err">{sweep.error}</div>}
    </div>
  );
}

/* ─── EMPTY STATE ─── */
function EmptyState({ icon: Icon, title, sub, action }) {
  return (
    <div className="ex-empty">
      <div className="ex-empty-icon"><Icon size={24} color="#314766ab" strokeWidth={1.5} /></div>
      <div className="ex-empty-title">{title}</div>
      {sub && <div className="ex-empty-sub">{sub}</div>}
      {action}
    </div>
  );
}

/* ══════════════════════════════
   MAIN DASHBOARD
══════════════════════════════ */
function emptyForm() {
  return { from_currency_id: "", to_currency_id: "", rate: "", fee_percent: 0, min_amount: 0, max_amount: "", is_active: true };
}

export default function ExchangeDashboard() {
  const [rightTab, setRightTab] = useState(RIGHT_TABS.ORDERS);

  // ── mobile sheet bounds ──
  // Measures ex-main's real on-screen box (top/left/right/bottom distances
  // from the viewport edges) so the Add/Detail/Edit sheets can be pinned
  // with position:fixed to THIS container's true edges — never the raw
  // viewport (which can sit under a menu) and never a CSS height:100%
  // assumption that breaks if a parent layout doesn't size this component.
  const mainRef = useRef(null);
  const [mainBounds, setMainBounds] = useState(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange));
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      // Horizontal bounds come from the real measured box (so the sheet
      // never sits under the app's left menu). Vertical bounds are the
      // true viewport edges (top:0 / bottom:0) rather than ex-main's own
      // rect — ex-main can end up shorter than the screen depending on
      // the outer app layout, which is what left a black gap underneath.
      setMainBounds({ left: r.left, right: window.innerWidth - r.right });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, []);

  const sheetBoundsStyle = isMobile && mainBounds
    ? { position: "fixed", top: 0, bottom: 0, left: mainBounds.left, right: mainBounds.right }
    : undefined;

  // The Pairs tab (and its Add/Detail sheets) only exist on mobile — desktop
  // keeps the original sidebar + detail-panel workflow. If the viewport
  // grows past the mobile breakpoint while that tab/sheet happens to be
  // open (window resize, rotating a tablet, etc.), fall back cleanly.
  useEffect(() => {
    if (!isMobile) {
      if (rightTab === RIGHT_TABS.PAIRS) setRightTab(RIGHT_TABS.ORDERS);
      setMobilePanel(null);
    }
  }, [isMobile, rightTab]);
  const [pairs, setPairs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editPair, setEditPair] = useState(null);
  const [selectedPair, setSelectedPair] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm());

  // mobile-only: 'add' | 'detail' | null — same overlay mechanism for both
  const [mobilePanel, setMobilePanel] = useState(null);

  const [failedSweeps, setFailedSweeps] = useState([]);
  const [retryingSweep, setRetryingSweep] = useState(null);

  const [adminFilter, setAdminFilter] = useState("mine");
  const [filterAdmins, setFilterAdmins] = useState([]);
  const [canFilterAdmins, setCanFilterAdmins] = useState(false);

  const [unifiedSearch, setUnifiedSearch] = useState("");
  const [unifiedStatus, setUnifiedStatus] = useState("all");
  const [unifiedFromCurrency, setUnifiedFromCurrency] = useState("all");
  const [unifiedDateRange, setUnifiedDateRange] = useState([null, null]);
  const [unifiedStart, unifiedEnd] = unifiedDateRange;

  const [pairSortField, setPairSortField] = useState(null);
  const [pairSortDir, setPairSortDir] = useState(null);
  const togglePairSort = (field) => {
    if (pairSortField !== field) { setPairSortField(field); setPairSortDir("asc"); }
    else if (pairSortDir === "asc") { setPairSortDir("desc"); }
    else { setPairSortField(null); setPairSortDir(null); }
  };

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };
  const currentUsername = localStorage.getItem("username") || "Me";
  const myId = String(localStorage.getItem("user_id") || "");
  const isMaster = localStorage.getItem("role") === "master";
  const canEditPair = (p) => isMaster || String(p.admin_id) === myId;
  const showPairOwner = canFilterAdmins && adminFilter !== "mine";
  const showOwnerColumns = isMaster && adminFilter !== "mine";

  const loadFilterAdmins = useCallback(async () => {
    try {
      const r = await api.get("/admin/exchange/filter-admins", { headers });
      setFilterAdmins((r.data || []).filter(a => a.username !== currentUsername));
      setCanFilterAdmins(true);
    } catch {
      setCanFilterAdmins(false);
      setFilterAdmins([]);
    }
  }, []);

  useEffect(() => { loadFilterAdmins(); }, [loadFilterAdmins]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const params = { admin_filter: adminFilter };
    const ownParams = { admin_filter: isMaster ? adminFilter : "mine" };
    const [pR, oR, cR, sR] = await Promise.allSettled([
      api.get("/admin/exchange/", { headers, params }),
      api.get("/admin/exchange/orders", { headers, params: ownParams }),
      api.get("/admin/currencies/", { headers }),
      api.get("/admin/exchange/failed-sweeps", { headers, params: { ...ownParams, resolved: false } }),
    ]);
    const val = (r) => (r.status === "fulfilled" ? r.value.data || [] : []);
    setPairs(val(pR));
    setOrders(val(oR));
    setCurrencies(val(cR));
    setFailedSweeps(val(sR));
    if ([pR, oR, cR, sR].some(r => r.status === "rejected")) showToast("Some data failed to load", false);
    setLoading(false);
  }, [adminFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (selectedPair) {
      const fresh = pairs.find(p => p.id === selectedPair.id);
      if (fresh) setSelectedPair(fresh);
      else setSelectedPair(null);
    }
  }, [pairs]);

  /* ── ACTIONS ── */
  const updateRate = async (pairId, newRate) => {
    if (!newRate || isNaN(newRate) || Number(newRate) <= 0) return;
    try { await api.put(`/admin/exchange/${pairId}`, { rate: Number(newRate) }, { headers }); showToast("Rate updated"); loadAll(); }
    catch { showToast("Failed to update rate", false); }
  };

  const pairPayload = (f) => ({
    from_currency_id: Number(f.from_currency_id),
    to_currency_id: Number(f.to_currency_id),
    rate: Number(f.rate),
    fee_percent: Number(f.fee_percent) || 0,
    min_amount: Number(f.min_amount) || 0,
    max_amount: f.max_amount ? Number(f.max_amount) : null,
    is_active: f.is_active,
  });

  const addPair = async () => {
    try {
      await api.post("/admin/exchange/", pairPayload(addForm), { headers });
      showToast("Pair created");
      setAddForm(emptyForm());
      setAddOpen(false);
      loadAll();
    } catch { showToast("Create failed", false); }
  };

  const savePair = async (form) => {
    try {
      await api.put(`/admin/exchange/${editPair.id}`, pairPayload(form), { headers });
      showToast("Pair updated");
      setEditPair(null);
      loadAll();
    } catch { showToast("Update failed", false); }
  };

  const togglePair = async (pair) => {
    try {
      await api.put(`/admin/exchange/${pair.id}`, { is_active: !pair.is_active }, { headers });
      showToast(`Pair ${pair.is_active ? "disabled" : "enabled"}`);
      loadAll();
    } catch { showToast("Toggle failed", false); }
  };

  const deletePair = async (id) => {
    if (!window.confirm("Delete this pair permanently?")) return;
    try { await api.delete(`/admin/exchange/${id}`, { headers }); showToast("Pair deleted"); if (selectedPair?.id === id) setSelectedPair(null); loadAll(); }
    catch { showToast("Delete failed", false); }
  };

  const retrySweep = async (sweepId) => {
    try {
      setRetryingSweep(sweepId);
      await api.post(`/admin/exchange/failed-sweeps/${sweepId}/retry`, {}, { headers });
      showToast("Sweep retry started");
      await loadAll();
    } catch { showToast("Retry failed", false); }
    setRetryingSweep(null);
  };

  /* ── DERIVED ── */
  const currencyOptions = useMemo(() => {
    const seen = new Map();
    pairs.forEach(p => {
      const sym = p.from_currency?.symbol;
      if (sym && !seen.has(sym)) seen.set(sym, p.from_currency.id);
    });
    return [...seen.keys()].sort().map(sym => ({ label: sym, value: sym }));
  }, [pairs]);

  const inDateRange = (dateStr) => {
    if (!dateStr) return true;
    if (unifiedStart && new Date(dateStr) < new Date(unifiedStart)) return false;
    if (unifiedEnd) {
      const end = new Date(unifiedEnd);
      end.setHours(23, 59, 59, 999);
      if (new Date(dateStr) > end) return false;
    }
    return true;
  };

  const filteredPairs = useMemo(() => {
    const q = unifiedSearch.toLowerCase().trim();
    let list = pairs.filter(p => {
      if (q) {
        const hit =
          p.from_currency?.symbol?.toLowerCase().includes(q) ||
          p.to_currency?.symbol?.toLowerCase().includes(q) ||
          (showPairOwner && (p.admin_username?.toLowerCase().includes(q) || String(p.admin_id).includes(q)));
        if (!hit) return false;
      }
      if (unifiedFromCurrency !== "all" && p.from_currency?.symbol !== unifiedFromCurrency) return false;
      return inDateRange(p.created_at);
    });

    if (pairSortField && pairSortDir) {
      list = [...list].sort((a, b) => {
        const av = pairSortField === "price" ? (Number(a.rate) || 0) : (Number(a.fee_percent) || 0);
        const bv = pairSortField === "price" ? (Number(b.rate) || 0) : (Number(b.fee_percent) || 0);
        return pairSortDir === "asc" ? av - bv : bv - av;
      });
    }
    return list;
  }, [pairs, unifiedSearch, unifiedFromCurrency, unifiedStart, unifiedEnd, showPairOwner, pairSortField, pairSortDir]);

  const filteredOrders = useMemo(() => {
    const q = unifiedSearch.toLowerCase().trim();
    return orders.filter(o => {
      if (unifiedStatus !== "all" && o.status?.toLowerCase() !== unifiedStatus) return false;
      if (unifiedFromCurrency !== "all" && o.from_currency?.symbol !== unifiedFromCurrency) return false;
      if (!inDateRange(o.created_at)) return false;
      if (q) {
        const hit =
          `${o.from_currency?.symbol}-${o.to_currency?.symbol}`.toLowerCase().includes(q) ||
          (o.username || "").toLowerCase().includes(q) ||
          String(o.user_id || "").includes(q) ||
          String(o.id || "").includes(q) ||
          (showOwnerColumns && ((o.admin_username || "").toLowerCase().includes(q) || String(o.admin_id || "").includes(q)));
        if (!hit) return false;
      }
      return true;
    });
  }, [orders, unifiedSearch, unifiedStatus, unifiedFromCurrency, unifiedStart, unifiedEnd, showOwnerColumns]);

  const filteredSweeps = useMemo(() => {
    const q = unifiedSearch.toLowerCase().trim();
    return failedSweeps.filter(s => {
      if (unifiedFromCurrency !== "all" && (s.currency || "").toLowerCase() !== unifiedFromCurrency.toLowerCase()) return false;
      if (!inDateRange(s.created_at)) return false;
      if (q) {
        const hit =
          String(s.user_id || "").includes(q) ||
          (s.username || "").toLowerCase().includes(q) ||
          (s.currency || "").toLowerCase().includes(q) ||
          (s.network || "").toLowerCase().includes(q) ||
          String(s.exchange_order_id || "").includes(q) ||
          (showOwnerColumns && ((s.admin_username || "").toLowerCase().includes(q) || String(s.admin_id || "").includes(q)));
        if (!hit) return false;
      }
      return true;
    });
  }, [failedSweeps, unifiedSearch, unifiedFromCurrency, unifiedStart, unifiedEnd, showOwnerColumns]);

  const unresolvedSweeps = failedSweeps.filter(s => !s.resolved).length;

  const { totalValue, totalValueCurrency } = useMemo(() => {
    const formatSum = (sum, currency) => {
      const d = currency === "IRT" ? 0 : 1;
      return sum.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
    };
    const sumOf = () => filteredOrders.reduce((s, o) => s + (parseFloat(o.from_amount) || 0), 0);

    if (unifiedFromCurrency !== "all") {
      return { totalValue: formatSum(sumOf(), unifiedFromCurrency), totalValueCurrency: unifiedFromCurrency };
    }
    const distinct = [...new Set(filteredOrders.map(o => o.from_currency?.symbol).filter(Boolean))];
    if (distinct.length === 1) {
      return { totalValue: formatSum(sumOf(), distinct[0]), totalValueCurrency: distinct[0] };
    }
    return { totalValue: null, totalValueCurrency: null };
  }, [filteredOrders, unifiedFromCurrency]);

  const TABS = [
    // Pairs tab is mobile-only — desktop/tablet use the left sidebar + detail
    // panel instead, so this entry is left out of the tab bar entirely there.
    isMobile && { key: RIGHT_TABS.PAIRS, label: "Pairs", icon: GitCompare, count: filteredPairs.length, mobileOnly: true },
    { key: RIGHT_TABS.ORDERS, label: "Orders", icon: FileText, count: filteredOrders.length },
    { key: RIGHT_TABS.FAILED_SWEEPS, label: "Sweeps", icon: AlertTriangle, count: unresolvedSweeps, warn: unresolvedSweeps > 0 },
    { key: RIGHT_TABS.ANALYSIS, label: "Analysis", icon: BarChart3, count: null },
  ].filter(Boolean);

  /* ── RENDER ── */
  return (
    <div className="ex-scope ex-page">
      <div className="ex-hero">
        <HeroHub
          title="Exchange Management"
          subtitle="Manage exchange pairs, orders and transactions"
          search={{
            visible: true,
            value: unifiedSearch,
            onChange: setUnifiedSearch,
            placeholder: showOwnerColumns ? "Search pair, user, ID or admin…" : "Search pair, user or ID…",
          }}
          dropdowns={[
            {
              key: "fromCurrency", visible: true, label: "Currency",
              value: unifiedFromCurrency, onChange: setUnifiedFromCurrency,
              placeholder: "All", options: currencyOptions,
            },
            {
              key: "status", label: "Status", visible: true,
              value: unifiedStatus, onChange: setUnifiedStatus,
              placeholder: "All",
              options: [
                { label: "Completed", value: "completed" },
                { label: "Pending", value: "pending" },
                { label: "Failed", value: "failed" },
              ],
            },
            canFilterAdmins && {
              key: "admin", visible: true, label: "Admins",
              value: adminFilter, onChange: setAdminFilter,
              options: [
                { label: "All", value: "all" },
                { label: `${currentUsername}`, value: "mine" },
                ...filterAdmins.map(a => ({ label: a.username, value: String(a.user_id) })),
              ],
            },
          ].filter(Boolean)}
          datePicker={{
            visible: true, selectsRange: true,
            startDate: unifiedStart, endDate: unifiedEnd,
            onChange: (update) => setUnifiedDateRange(update),
            placeholderText: "Select date range",
          }}
          statPills={[
            { key: "pairs", icon: GitCompare, label: "Total Pairs", value: filteredPairs.length, accent: "#3b82f6", loading },
            { key: "orders", icon: FileText, label: "Total Orders", value: filteredOrders.length, accent: "#10b981", loading },
            { key: "value", icon: Wallet, label: "Total Value", value: totalValue, meta: totalValueCurrency, accent: "#22d3ee", loading },
          ]}
          onRefresh={loadAll}
          refreshing={loading}
        />
      </div>

      <div className="ex-body">
        {/* ── LEFT: pairs sidebar + add slide-in ── */}
        <div className="ex-left">
          <div className={`ex-sidebar${addOpen ? " is-dimmed" : ""}`}>
            <div className="ex-sidebar-head">
              <div className="ex-sidebar-title">
                <GitCompare size={16} color="#3b82f6" />
                <span className="t">Pairs</span>
                <span className="ex-count">{filteredPairs.length}</span>
              </div>
              <button className="ex-addBtn" onClick={() => setAddOpen(true)}><Plus size={12} />Add</button>
            </div>

            <div className="ex-sort-row">
              {[{ field: "price", label: "Price" }, { field: "fee", label: "Fee" }].map(({ field, label }) => {
                const active = pairSortField === field;
                const arrow = active ? (pairSortDir === "asc" ? "↑" : "↓") : "";
                return (
                  <button key={field} className={`ex-sortBtn${active ? " is-active" : ""}`} onClick={() => togglePairSort(field)}>
                    <ArrowUpDown size={11} />{label}{arrow && <span style={{ fontSize: 12 }}>{arrow}</span>}
                  </button>
                );
              })}
            </div>

            <div className="ex-pair-list">
              {loading && pairs.length === 0
                ? [...Array(5)].map((_, i) => <div key={i} className="ex-sk-wrap"><Sk /></div>)
                : filteredPairs.length === 0
                  ? <div className="ex-pair-empty">No pairs found</div>
                  : filteredPairs.map(p => (
                    <PairRow
                      key={p.id} p={p}
                      selected={selectedPair?.id === p.id}
                      showOwner={showPairOwner}
                      onClick={() => setSelectedPair(prev => (prev?.id === p.id ? null : p))}
                    />
                  ))}
            </div>
          </div>

          <div className={`ex-addPanel${addOpen ? " is-open" : ""}`}>
            <div className="ex-addPanel-inner">
              <div className="ex-addPanel-head">
                <div className="ex-addPanel-icon"><Plus size={15} color="#60a5fa" /></div>
                <span className="ex-addPanel-title">Add new pair</span>
                <button className="ex-closeIconBtn" onClick={() => setAddOpen(false)}><X size={16} /></button>
              </div>
              <div className="ex-addPanel-body">
                <PairForm
                  data={addForm} setData={setAddForm}
                  onSubmit={addPair} submitLabel="Create pair"
                  onCancel={() => setAddOpen(false)}
                  currencies={currencies}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── PAIR DETAIL ── */}
        <div className={`ex-detail${selectedPair ? " is-open" : ""}`}>
          {selectedPair && (
            <div className="ex-detail-inner">
              <PairDetail
                key={selectedPair.id}
                pair={selectedPair}
                readOnly={!canEditPair(selectedPair)}
                onEdit={setEditPair}
                onToggle={togglePair}
                onDelete={deletePair}
                onRateUpdate={updateRate}
              />
            </div>
          )}
        </div>

        {/* ── RIGHT: tabs + content ── */}
        <div className="ex-main" ref={mainRef}>
          <div className="ex-tabbar">
            {TABS.map(({ key, label, icon: Icon, count, warn, mobileOnly }) => (
              <button
                key={key}
                className={`ex-tab${rightTab === key ? " is-active" : ""}${mobileOnly ? " ex-mobileTab" : ""}`}
                onClick={() => setRightTab(key)}
              >
                <Icon size={13} />
                {label}
                {count != null && <span className={`ex-tab-count${warn ? " is-warn" : ""}`}>{count}</span>}
              </button>
            ))}
          </div>

          <div className="ex-content">
            {rightTab === RIGHT_TABS.PAIRS && isMobile && (
              <div>
                <div className="ex-mobilePairs-head">
                  <div className="ex-mobilePairs-title">
                    <GitCompare size={16} color="#3b82f6" />
                    <span className="t">Pairs</span>
                    <span className="ex-count">{filteredPairs.length}</span>
                  </div>
                  <button
                    className="ex-addBtn"
                    onClick={() => { setAddForm(emptyForm()); setMobilePanel("add"); }}
                  >
                    <Plus size={12} />Add
                  </button>
                </div>

                {/* same sort-by-Rate/Fee row as the desktop sidebar */}
                <div className="ex-mobilePairs-sortRow">
                  {[{ field: "price", label: "Price" }, { field: "fee", label: "Fee" }].map(({ field, label }) => {
                    const active = pairSortField === field;
                    const arrow = active ? (pairSortDir === "asc" ? "↑" : "↓") : "";
                    return (
                      <button key={field} className={`ex-sortBtn${active ? " is-active" : ""}`} onClick={() => togglePairSort(field)}>
                        <ArrowUpDown size={11} />{label}{arrow && <span style={{ fontSize: 12 }}>{arrow}</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="ex-list">
                  {loading && pairs.length === 0
                    ? [...Array(5)].map((_, i) => <div key={i} className="ex-sk-wrap"><Sk /></div>)
                    : filteredPairs.length === 0
                      ? <EmptyState icon={GitCompare} title="No pairs found" sub="Try adjusting your filters" />
                      : filteredPairs.map(p => (
                        <PairRow
                          key={p.id} p={p}
                          selected={false}
                          showOwner={showPairOwner}
                          onClick={() => { setSelectedPair(p); setMobilePanel("detail"); }}
                        />
                      ))}
                </div>
              </div>
            )}

            {rightTab === RIGHT_TABS.ORDERS && (
              <div className="ex-list">
                {filteredOrders.length === 0
                  ? <EmptyState icon={FileText} title="No orders found" sub="Try adjusting your filters" />
                  : filteredOrders.map(o => <OrderRow key={o.id} item={o} showOwner={showOwnerColumns} />)}
              </div>
            )}

            {rightTab === RIGHT_TABS.FAILED_SWEEPS && (
              <div className="ex-list">
                {filteredSweeps.length === 0
                  ? <EmptyState icon={AlertTriangle} title="No sweeps found" sub="All clear — no failed sweeps matching your filter" />
                  : filteredSweeps.map(s => <SweepRow key={s.id} sweep={s} onRetry={retrySweep} retrying={retryingSweep} showOwner={showOwnerColumns} />)}
              </div>
            )}

            {rightTab === RIGHT_TABS.ANALYSIS && (
              <div key={`${RIGHT_TABS.ANALYSIS}-${isMaster ? adminFilter : "mine"}`} className="ex-full">
                <AnalysisTab
                  pairs={isMaster ? pairs : pairs.filter(p => String(p.admin_id) === myId)}
                  headers={headers}
                  adminFilter={isMaster ? adminFilter : "mine"}
                />
              </div>
            )}
          </div>

          {/* mobile-only: Add and Detail share the same slide-in overlay.
              Scoped to ex-main (the Pairs tab's own container: tabbar + content),
              so it's bounded exactly to this page's main content area — never
              clipped by, or drawn over, the app's left menu. */}
          <MobileOverlay
            open={isMobile && mobilePanel === "add"}
            icon={Plus} iconBg="rgba(59,130,246,.15)" iconColor="#60a5fa"
            title="Add new pair"
            onClose={() => setMobilePanel(null)}
            boundsStyle={sheetBoundsStyle}
          >
            <PairForm
              data={addForm} setData={setAddForm}
              onSubmit={async () => { await addPair(); setMobilePanel(null); }}
              submitLabel="Create pair"
              onCancel={() => setMobilePanel(null)}
              currencies={currencies}
            />
          </MobileOverlay>

          <MobileOverlay
            open={isMobile && mobilePanel === "detail" && !!selectedPair}
            icon={GitCompare} iconBg="rgba(59,130,246,.15)" iconColor="#60a5fa"
            title={selectedPair ? `${selectedPair.from_currency?.symbol} → ${selectedPair.to_currency?.symbol}` : "Pair"}
            onClose={() => { setMobilePanel(null); setSelectedPair(null); }}
            boundsStyle={sheetBoundsStyle}
          >
            {selectedPair && (
              <PairDetail
                key={selectedPair.id}
                pair={selectedPair}
                readOnly={!canEditPair(selectedPair)}
                onEdit={setEditPair}
                onToggle={togglePair}
                onDelete={(id) => { deletePair(id); setMobilePanel(null); }}
                onRateUpdate={updateRate}
              />
            )}
          </MobileOverlay>
        </div>
      </div>

      {editPair && (
        <PairEditModal
          editPair={editPair} currencies={currencies} onSave={savePair} onClose={() => setEditPair(null)}
          boundsStyle={sheetBoundsStyle}
        />
      )}
    </div>
  );
}