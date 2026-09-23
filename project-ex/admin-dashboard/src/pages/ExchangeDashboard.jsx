import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  ArrowLeftRight, FileText, AlertTriangle, Plus, Edit3, Trash2,
  Power, PowerOff, X, Save, RotateCw, GitCompare, Search, BarChart3,
  Activity, RefreshCw, CheckCircle2, XCircle, Clock, Filter, ChevronDown, Users,
  ArrowUpDown, Wallet,
} from "lucide-react";
import AnalysisTab from "../components/exchange/AnalysisTab";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import HeroHub from "../components/HeroHub";

const API = "http://127.0.0.1:8000";
const api = axios.create({ baseURL: API });

const RIGHT_TABS = { ORDERS: "orders", FAILED_SWEEPS: "failed_sweeps", ANALYSIS: "analysis" };


const fmt = (n, d = 4) =>
  n != null ? Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d }) : "—";
const fmtDate = (d) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const STATUS = {
  completed : { color: "#4ade80", bg: "rgba(34,197,94,.1)",   border: "rgba(34,197,94,.22)",  icon: CheckCircle2, label: "Done"    },
  pending   : { color: "#fbbf24", bg: "rgba(245,158,11,.1)",  border: "rgba(245,158,11,.22)", icon: Clock,        label: "Pending" },
  failed    : { color: "#f87171", bg: "rgba(239,68,68,.1)",   border: "rgba(239,68,68,.22)",  icon: XCircle,      label: "Failed"  },
};

/* ─── TOAST ─── */
const showToast = (msg, ok = true) => {
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position:"fixed", bottom:"24px", right:"24px", zIndex:99999,
    padding:"12px 20px", borderRadius:"12px", fontWeight:600, fontSize:"13px",
    color:"white", pointerEvents:"none",
    background: ok ? "#16a34a" : "#dc2626",
    boxShadow: ok ? "0 8px 32px rgba(22,163,74,.35)" : "0 8px 32px rgba(220,38,38,.35)",
    transform:"translateY(8px)", opacity:0, transition:"all .25s ease",
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = 1; el.style.transform = "translateY(0)"; });
  setTimeout(() => { el.style.opacity = 0; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 300); }, 3000);
};

/* ─── SKELETON ─── */
const Sk = ({ w = "100%", h = 16, r = 6 }) => (
  <div style={{ width: w, height: h, borderRadius: r, background: "#111827", animation: "skpulse 1.5s ease infinite" }} />
);

/* ─── STATUS BADGE ─── */
function StatusBadge({ status }) {
  const s = STATUS[status?.toLowerCase()] || STATUS.completed;
  const Icon = s.icon;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:s.bg, color:s.color, border:`1px solid ${s.border}`, padding:"3px 10px 3px 7px", borderRadius:999, fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
      <Icon size={11} />{s.label}
    </span>
  );
}

/* ─── STAT PILL (original style) ─── */
function StatPill({ icon: Icon, label, value, accent, loading }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", borderRadius:12, padding:"10px 14px" }}>
      <div style={{ width:36, height:36, borderRadius:10, background:`${accent}18`, border:`1px solid ${accent}28`, color:accent, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <Icon size={17} />
      </div>
      <div>
        <div style={{ fontSize:10, color:"#475569", fontWeight:700, letterSpacing:.6, marginBottom:3, textTransform:"uppercase" }}>{label}</div>
        {loading ? <Sk w={56} h={22} /> : (
          <div style={{ fontSize:16, fontWeight:800, color:accent, letterSpacing:-0.5 }}>{value ?? "—"}</div>
        )}
      </div>
    </div>
  );
}

/* ─── FIELD ─── */
const Field = ({ label, children }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
    <label style={{ color:"#6b7280", fontSize:10, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase" }}>{label}</label>
    {children}
  </div>
);

/* ─── ADMIN FILTER DROPDOWN ─── */
function AdminFilterDropdown({ value, onChange, adminList, currentUsername }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const currentLabel =
    value === "all" ? "All Admins" :
    value === "mine" ? `My Rates (${currentUsername})` :
    adminList.find(a => String(a.user_id) === String(value))?.username
      ? `Admin: ${adminList.find(a => String(a.user_id) === String(value)).username}`
      : "My Rates";

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display:"flex", alignItems:"center", gap:6,
          background: open ? "rgba(139,92,246,.16)" : "rgba(139,92,246,.1)",
          border:`1px solid ${open ? "#8b5cf6" : "rgba(139,92,246,.28)"}`,
          color:"#c4b5fd", borderRadius:7, padding:"7px 9px",
          fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap",
        }}
      >
        <Users size={12} />
        {currentLabel}
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition:"transform .15s" }} />
      </button>

      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", left:0, minWidth:220,
          background:"#0d1424", border:"1px solid rgba(139,92,246,.25)", borderRadius:10,
          zIndex:50, boxShadow:"0 12px 32px rgba(0,0,0,.5)", overflow:"hidden",
        }}>
          <div
            onClick={() => { onChange("mine"); setOpen(false); }}
            style={{ padding:"9px 12px", cursor:"pointer", fontSize:12, fontWeight: value === "mine" ? 700 : 500, color: value === "mine" ? "#a78bfa" : "#94a3b8", background: value === "mine" ? "rgba(139,92,246,.1)" : "transparent" }}
          >
            My Rates ({currentUsername})
          </div>
          <div
            onClick={() => { onChange("all"); setOpen(false); }}
            style={{ padding:"9px 12px", cursor:"pointer", fontSize:12, fontWeight: value === "all" ? 700 : 500, color: value === "all" ? "#a78bfa" : "#94a3b8", background: value === "all" ? "rgba(139,92,246,.1)" : "transparent", borderTop:"1px solid rgba(255,255,255,.05)" }}
          >
            All Admins (Platform)
          </div>
          {adminList.length > 0 && (
            <div style={{ maxHeight:220, overflowY:"auto", borderTop:"1px solid rgba(255,255,255,.05)" }}>
              {adminList.map(a => (
                <div
                  key={a.user_id}
                  onClick={() => { onChange(String(a.user_id)); setOpen(false); }}
                  style={{ padding:"9px 12px", cursor:"pointer", fontSize:12, fontWeight: String(value) === String(a.user_id) ? 700 : 500, color: String(value) === String(a.user_id) ? "#a78bfa" : "#94a3b8", background: String(value) === String(a.user_id) ? "rgba(139,92,246,.1)" : "transparent", display:"flex", justifyContent:"space-between", gap:8 }}
                >
                  <span>{a.username}</span>
                  <span style={{ color:"#4b5563", fontSize:10 }}>{a.role === "master" ? "MASTER" : `#${a.user_id}`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── PAIR FORM (add / edit) ─── */
function PairForm({ data, setData, onSubmit, submitLabel, onCancel, currencies }) {
  const [err, setErr] = useState("");
  const set = (k, v) => setData(f => ({ ...f, [k]: v }));
  const submit = () => {
    if (!data.from_currency_id || !data.to_currency_id || !data.rate) { setErr("From, To and Rate are required."); return; }
    setErr(""); onSubmit();
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {err && (
        <div style={{ background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.25)", color:"#f87171", padding:"9px 13px", borderRadius:9, fontSize:12, marginBottom:12 }}>{err}</div>
      )}
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
          <Field label="From">
            <select style={S.input} value={data.from_currency_id} onChange={e => set("from_currency_id", e.target.value)}>
              <option value="">Select…</option>
              {currencies.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
            </select>
          </Field>
          <Field label="To">
            <select style={S.input} value={data.to_currency_id} onChange={e => set("to_currency_id", e.target.value)}>
              <option value="">Select…</option>
              {currencies.map(c => <option key={c.id} value={c.id}>{c.symbol}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
          <Field label="Rate"><input type="number" style={S.input} placeholder="0.00" value={data.rate} onChange={e => set("rate", e.target.value)} /></Field>
          <Field label="Fee %"><input type="number" style={S.input} placeholder="0" value={data.fee_percent} onChange={e => set("fee_percent", e.target.value)} /></Field>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
          <Field label="Min amount"><input type="number" style={S.input} placeholder="0" value={data.min_amount} onChange={e => set("min_amount", e.target.value)} /></Field>
          <Field label="Max amount"><input type="number" style={S.input} placeholder="∞" value={data.max_amount} onChange={e => set("max_amount", e.target.value)} /></Field>
        </div>
        <button
          type="button"
          onClick={() => set("is_active", !data.is_active)}
          style={{ display:"flex", alignItems:"center", gap:10, background:"transparent", border:`1px solid ${data.is_active ? "rgba(34,197,94,.25)" : "rgba(255,255,255,.08)"}`, borderRadius:10, padding:"10px 13px", cursor:"pointer", textAlign:"left", transition:"all .2s" }}
        >
          <div style={{ width:38, height:22, borderRadius:11, background:data.is_active ? "#22c55e" : "#1f2937", border:`1px solid ${data.is_active ? "#22c55e" : "#374151"}`, position:"relative", flexShrink:0, transition:"all .25s" }}>
            <div style={{ position:"absolute", top:2, left:data.is_active ? 18 : 2, width:16, height:16, borderRadius:"50%", background:data.is_active ? "white" : "#4b5563", transition:"left .25s" }} />
          </div>
          <span style={{ color:data.is_active ? "#d1fae5" : "#6b7280", fontSize:13, fontWeight:600 }}>{data.is_active ? "Active" : "Inactive"}</span>
        </button>
      </div>
      <div style={{ display:"flex", gap:7, marginTop:16, paddingTop:14, borderTop:"1px solid rgba(255,255,255,.05)" }}>
        {onCancel && <button style={S.cancelBtn} onClick={onCancel}>Cancel</button>}
        <button style={S.primaryBtn} onClick={submit}>{submitLabel}</button>
      </div>
    </div>
  );
}

/* ─── EDIT MODAL ─── */
function PairEditModal({ editPair, currencies, onSave, onClose }) {
  const [form, setForm] = useState({
    from_currency_id: editPair?.from_currency?.id || "",
    to_currency_id  : editPair?.to_currency?.id   || "",
    rate        : editPair?.rate        || "",
    fee_percent : editPair?.fee_percent ?? 0,
    min_amount  : editPair?.min_amount  ?? 0,
    max_amount  : editPair?.max_amount  || "",
    is_active   : editPair?.is_active   ?? true,
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return createPortal(
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.72)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:9999, backdropFilter:"blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:"92%", maxWidth:460, background:"#0d1424", borderRadius:22, padding:"26px 28px", border:"1px solid rgba(255,255,255,.08)", display:"flex", flexDirection:"column", maxHeight:"85vh", overflow:"auto", boxShadow:"0 32px 80px rgba(0,0,0,.6)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
          <div>
            <div style={{ color:"white", fontWeight:700, fontSize:17 }}>Edit pair</div>
            <div style={{ color:"#4b5563", fontSize:13, marginTop:3 }}>{editPair?.from_currency?.symbol} → {editPair?.to_currency?.symbol}</div>
          </div>
          <button style={S.iconBtn} onClick={onClose}><X size={14} /></button>
        </div>
        <PairForm data={form} setData={setForm} onSubmit={submit} submitLabel={saving ? "Saving…" : "Save changes"} onCancel={onClose} currencies={currencies} />
      </div>
    </div>,
    document.body
  );
}

/* ─── PAIR ROW in sidebar — pair/admin left, price/fee right ─── */
function PairRow({ p, selected, onClick, showOwner }) {
  return (
    <div
      onClick={onClick}
      style={{
        display:"flex",
        alignItems:"center",
        gap:10,
        padding:"9px 20px",
        borderRadius:9,
        cursor:"pointer",
        border:`1px solid ${selected ? "rgba(59,130,246,.28)" : "transparent"}`,
        background: selected ? "rgba(59,130,246,.1)" : "transparent",
        transition:"all .15s", marginBottom:3,
      }}
    >
      <span style={{
        width:6,
        height:6,
        borderRadius:"50%",
        background:p.is_active ? "#22c55e" : "#374151",
        flexShrink:0,
        boxShadow:p.is_active ? "0 0 6px rgba(34,197,94,.4)" : "none",
        display:"inline-block" }} />

      {/* left: pair + admin */}
      <div style={{ minWidth:0, flex:1, textAlign:"left" }}>
        <div style={{
          fontSize:14,
          fontWeight:700,
          color:selected ? "white" : "#94a3b8",
          whiteSpace:"nowrap",
          overflow:"hidden",
          textOverflow:"ellipsis" }}>
          {p.from_currency?.symbol}→{p.to_currency?.symbol}
        </div>
        {showOwner && p.admin_id != null && (
          <span style={{
            display:"inline-block", marginTop:2,
            fontSize:10, fontWeight:700, color:"#a78bfa",
            background:"rgba(139,92,246,.12)", border:"1px solid rgba(139,92,246,.25)",
            borderRadius:999, padding:"2px 7px", whiteSpace:"nowrap",
            maxWidth:120, overflow:"hidden", textOverflow:"ellipsis",
          }}>
            {p.admin_username || `#${p.admin_id}`}
          </span>
        )}
      </div>

      {/* right: price + fee */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", flexShrink:0, textAlign:"right" }}>
        <span style={{
          fontSize:14,
          color:p.is_active ? "#3b82f6" : "#374151",
          fontWeight:700,
          whiteSpace:"nowrap"
          }}>
          {p.is_active ? fmt(p.rate, 4) : "—"}
        </span>
        <span style={{ fontSize:11, color:"#5f728eff", whiteSpace:"nowrap", marginTop:1 }}>
          Fee {fmt(p.fee_percent, 2)}%
        </span>
      </div>
    </div>
  );
}

/* ─── PAIR DETAIL PANEL ─── */
function PairDetail({ pair, readOnly, onEdit, onToggle, onDelete, onRateUpdate }) {
  const [localRate, setLocalRate] = useState(pair.rate ?? "");
  useEffect(() => setLocalRate(pair.rate ?? ""), [pair.id]);
  const pairRate = pair?.from_currency?.symbol === "IRT" && Number(pair?.rate) > 0 ? 1 / Number(pair.rate) : Number(pair.rate);

  return (
    <div style={{
      display:"flex", 
      width:"100%", 
      display:"flex", 
      flexDirection:"column", 
      height:"100%",}}>
      {/* head */}
      <div style={{ padding:"12px 15px", borderBottom:"1px solid rgba(255,255,255,.05)", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:pair.is_active ? "#22c55e" : "#a31919ff", boxShadow:pair.is_active ? "0 0 8px rgba(34,197,94,.5)" : "none", flexShrink:0 }} />
          <span style={{ color:"white", fontWeight:800, fontSize:15, flex:1, letterSpacing:"-.02em" }}>{pair.from_currency?.symbol} → {pair.to_currency?.symbol}</span>
          <span style={{ background:pair.is_active ? "rgba(34,197,94,.1)" : "#a31919ff", border:`1px solid ${pair.is_active ? "rgba(34,197,94,.22)" : "rgba(252, 253, 254, 0.15)"}`, color:pair.is_active ? "#4ade80" : "#cba3a3ff", borderRadius:20, padding:"2px 9px", fontSize:10, fontWeight:700 }}>
            {pair.is_active ? "LIVE" : "OFF"}
          </span>
        </div>
        {pair.admin_username && (
          <div style={{ marginTop:6, fontSize:11, color:"#a78bfa" }}>Owner: {pair.admin_username} (#{pair.admin_id})</div>
        )}
      </div>

      {/* body */}
      <div style={{ flex:1, overflowY:"auto", padding:"13px 15px", display:"flex", flexDirection:"column", gap:10 }}>
        {/* rate hero */}
        <div style={{ background:"#040a14", border:"1px solid rgba(59,130,246,.15)", borderRadius:11, padding:12 }}>
          <div style={{ fontSize:10, color:"#3b82f6", fontWeight:700, letterSpacing:".07em", marginBottom:4 }}>RATE</div>
          <div style={{ fontSize:22, color:"white", fontWeight:900, letterSpacing:"-.04em" }}>{fmt(pair.rate, 6)}</div>
          {pair?.from_currency?.symbol === "IRT" && Number(pair?.rate) > 0 && (
            <div style={{ fontSize:13, color:"#7b8695ff", marginTop:3 }}>Inverse: {fmt(pairRate, 6)}</div>
          )}
        </div>

        {/* stats grid */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {[
            ["Fee",    `${pair.fee_percent}%`],
            ["Min Exchange",    fmt(pair.min_amount)],
            ["Max",    pair.max_amount ? fmt(pair.max_amount) : "∞"],
            ["Pair ID", `#${pair.id}`],
          ].map(([k, v]) => (
            <div key={k} style={{ background:"#040a14", border:"1px solid rgba(255,255,255,.06)", borderRadius:9, padding:"9px 10px" }}>
              <div style={{ fontSize:12, color:"#7c8696ff", marginBottom:3 }}>{k}</div>
              <div style={{ fontSize:14, color:"white", fontWeight:700 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* quick rate */}
        {!readOnly && ( <div>
          <div style={{ fontSize:10, color:"#7c8696ff", fontWeight:700, letterSpacing:".07em", margin: "15px 0 10px 0" }}>QUICK RATE UPDATE</div>
          <div style={{ display:"flex", gap:6 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number"
                className="no-spinner"
                value={localRate}
                onChange={(e) => setLocalRate(e.target.value)}
                style={{ ...S.input, flex: 1, padding: "7px 10px", fontSize: 12 }}
                placeholder="New rate..."
              />

              <div
                style={{
                  display: "flex",
                  overflow: "hidden",
                  borderRadius:8,
                  border: "1px solid rgba(252, 243, 243, 0.12)",
                }}
              >
                <button
                  onClick={() => setLocalRate(v => Number(v || 0) - 100)}
                  style={S.stepBtn}
                >
                  −
                </button>

                <button
                  onClick={() => setLocalRate(v => Number(v || 0) + 100)}
                  style={S.stepBtn}
                >
                  +
                </button>
              </div>
            </div>
            <button onClick={() => onRateUpdate(pair.id, localRate)} style={{ background:"rgba(59,130,246,.18)", border:"1px solid rgba(59,130,246,.35)", borderRadius:8, padding:"7px 12px", color:"#93c5fd", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5 }}>
              <Save size={13} />Save
            </button>
          </div>
        </div>
        )}
      </div>

      {/* footer actions */}
      {!readOnly ? ( <div style={{ padding:"11px 15px", borderTop:"1px solid rgba(255,255,255,.05)", display:"flex", gap:6, flexShrink:0 }}>
        <button style={{ flex:1, ...S.actionBtn, background:"rgba(59,130,246,.1)", borderColor:"rgba(59,130,246,.22)", color:"#60a5fa" }} onClick={() => onEdit(pair)}>
          <Edit3 size={11} />Edit
        </button>
        <button
          style={{ flex:1, ...S.actionBtn, background:pair.is_active ? "rgba(239,68,68,.08)" : "rgba(34,197,94,.08)", borderColor:pair.is_active ? "rgba(239,68,68,.2)" : "rgba(34,197,94,.2)", color:pair.is_active ? "#f87171" : "#4ade80" }}
          onClick={() => onToggle(pair)}
        >
          {pair.is_active ? <><PowerOff size={11} />Disable</> : <><Power size={11} />Enable</>}
        </button>
        <button style={{ ...S.actionBtn, background:"rgba(239,68,68,.07)", borderColor:"rgba(239,68,68,.15)", color:"#ef4444", padding:"8px 10px" }} onClick={() => onDelete(pair.id)}>
          <Trash2 size={12} />
        </button>
      </div>
      ) : (
                <div style={{ padding:"11px 15px", borderTop:"1px solid rgba(255,255,255,.05)", fontSize:11, color:"#64748b", textAlign:"center" }}>
          View only — owned by another admin
        </div>
      )}
    </div>
  );
}


/* ─── ORDER ROW ─── */
function OrderRow({ item, showOwner }) {
  const fromSym = item.from_currency?.symbol || "—";
  const toSym = item.to_currency?.symbol || "—";
  console.log(item)
  const displayRate =
    fromSym === "IRT" && Number(item.rate) > 0
      ? 1 / Number(item.rate)
      : Number(item.rate);

  return (
    <div
      style={{
        background: "rgba(255,255,255,.025)",
        border: "1px solid rgba(255,255,255,.055)",
        borderRadius: 11,
        padding: "10px 12px",
        display: "grid",
        gridTemplateColumns: "1.3fr 1.6fr 1fr 1fr 1fr",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* ================= COLUMN 1: ICON + PAIR ================= */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 28,
            height: 28,
            background: "rgba(59,130,246,.1)",
            border: "1px solid rgba(59,130,246,.15)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <ArrowLeftRight size={12} color="#60a5fa" />
        </div>

        <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "white" }}>
          {item.username ? item.username.toUpperCase() : "—"}
        </div>
        
          
        <div style={{ fontSize: 11, color: "#9ca3af8c", fontWeight: 600 }}>
          User #{item.user_id}
        </div>
        </div>
      </div>

      
      {/* ================= COLUMN 2: Symbol & Price INFO ================= */}
      <div style={{ minWidth: 0 }}>
           
          <div style={{ fontSize: 14, fontWeight: 700, color: "#9098a7ff" }}>
                      
            {fromSym} → {toSym}
          </div>
          <div style={{ fontSize: 14, color: "white", fontWeight: 600 }}>
          {fmt(item.from_amount, 2)} → {fmt(item.to_amount, 2)}
        </div>
        

 
      </div>

      {/* ================= COLUMN 3: Rate ================= */}
      <div style={{ minWidth: 0 }}>
           
  
        <div style={{ display: "flex", flexDirection: "row", gap: "2px" }}>
            
            <div style={{ fontSize: 12, color: "#9098a7ff", marginTop: 3 }}>
            Rate  
          </div>
            
            <div style={{ 
              fontSize: 14, 
              color: "white", 
              fontWeight: 600 ,
              marginLeft:"3px"}}>
            {fmt(displayRate, 6)}
                      
            {showOwner && item.admin_id != null && (
                <span style={{ 
                  fontSize:10, 
                  fontWeight:700, 
                  color:"#a78bfa", 
                  background:"rgba(139,92,246,.12)", 
                  border:"1px solid rgba(139,92,246,.22)", 
                  borderRadius:999, 
                  padding:"1px 6px" }}>
                  {item.admin_username}  {`#${item.admin_id}`}
                </span>

                
                
              )}
          </div>
        </div>

 
      </div>

      {/* ================= COLUMN 3: AMOUNT + RATE + FEE ================= */}
      <div style={{ minWidth: 0 }}>
         
          <div style={{ fontSize: 12, color: "#475569" , marginTop:3, display:"flex", alignItems:"center", gap:6}}>
            ORDER ID #{item.id}

          </div>

          
          <div style={{ fontSize: 12, color: "#9098a7ff", marginTop: 3 }}>
          Fee {fmt(item.fee_amount, 2)} {fromSym} ({item.fee_percent}%)
        </div>


      </div>

      {/* ================= COLUMN 4: STATUS + TIME ================= */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
          minWidth: 0,
        }}
      >
        <StatusBadge status={item.status} />

        <div style={{ fontSize: 10, color: "#7c8694ff" }}>
          {fmtDate(item.created_at)}
        </div>
      </div>
    </div>
  );
}
/* ─── SWEEP ROW ─── */
function SweepRow({ sweep, onRetry, retrying, showOwner }) {
  return (
    <div style={{ background:"rgba(255,255,255,.025)", border:`1px solid ${sweep.resolved ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)"}`, borderRadius:11, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10, flex:1, minWidth:0 }}>
        <div style={{ width:32, height:32, background:sweep.resolved ? "rgba(34,197,94,.08)" : "rgba(239,68,68,.08)", border:`1px solid ${sweep.resolved ? "rgba(34,197,94,.2)" : "rgba(239,68,68,.2)"}`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <AlertTriangle size={13} color={sweep.resolved ? "#4ade80" : "#f87171"} />
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:12, color:"white", display:"flex", alignItems:"center", gap:6 }}>
            {sweep.currency} <span style={{ color:"#6b7280", fontWeight:400 }}>{fmt(sweep.amount)} · {sweep.network || "N/A"}</span>
            {showOwner && sweep.admin_id != null && (
              <span
                title={sweep.admin_linked ? "Attributed via the pair's owning admin" : "Fallback: attributed via the buyer's admin (older sweep, no linked order)"}
                style={{
                  fontSize:10, fontWeight:700,
                  color: sweep.admin_linked ? "#a78bfa" : "#fbbf24",
                  background: sweep.admin_linked ? "rgba(139,92,246,.12)" : "rgba(245,158,11,.12)",
                  border: `1px solid ${sweep.admin_linked ? "rgba(139,92,246,.22)" : "rgba(245,158,11,.22)"}`,
                  borderRadius:999, padding:"1px 6px",
                }}
              >
                {sweep.admin_username || `#${sweep.admin_id}`}{!sweep.admin_linked && " ~"}
              </span>
            )}
          </div>
          <div style={{ fontSize:10, color:"#4b5563", marginTop:3 }}>User #{sweep.user_id} · {sweep.username?.toUpperCase()} · Order #{sweep.exchange_order_id || "—"} · {sweep.retries} retries</div>
          {sweep.error && (
            <div style={{ fontSize:10, color:"#fca5a5", fontFamily:"monospace", marginTop:6, background:"rgba(239,68,68,.05)", padding:"4px 8px", borderRadius:6, border:"1px solid rgba(239,68,68,.12)", whiteSpace:"pre-wrap", wordBreak:"break-all" }}>
              {sweep.error}
            </div>
          )}
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
        <span style={{ background:sweep.resolved ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", border:`1px solid ${sweep.resolved ? "rgba(34,197,94,.2)" : "rgba(239,68,68,.2)"}`, color:sweep.resolved ? "#4ade80" : "#f87171", fontSize:10, fontWeight:700, borderRadius:999, padding:"2px 9px" }}>
          {sweep.resolved ? "Resolved" : "Failed"}
        </span>
        <div style={{ fontSize:10, color:"#4b5563" }}>{fmtDate(sweep.created_at)}</div>
        {!sweep.resolved && (
          <button
            onClick={() => onRetry(sweep.id)}
            disabled={retrying === sweep.id}
            style={{ background:"#1d4ed8", border:"none", color:"white", borderRadius:7, padding:"5px 10px", fontWeight:700, fontSize:11, cursor:"pointer", display:"flex", gap:4, alignItems:"center", opacity:retrying === sweep.id ? .6 : 1 }}
          >
            <RotateCw size={11} style={{ animation:retrying === sweep.id ? "spin .8s linear infinite" : "none" }} />
            {retrying === sweep.id ? "Retrying…" : "Retry"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── EMPTY STATE ─── */
function EmptyState({ icon: Icon, title, sub, action }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 20px", gap:10, textAlign:"center" }}>
      <div style={{ width:52, height:52, borderRadius:14, background:"rgba(255,255,255,.03)", border:"1px solid #314766a7", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:4 }}>
        <Icon size={24} color="#314766ab" strokeWidth={1.5} />
      </div>
      <div style={{ color:"#314766ff", fontWeight:700, fontSize:15 }}>{title}</div>
      {sub && <div style={{ color:"#41597aff", fontSize:13 }}>{sub}</div>}
      {action}
    </div>
  );
}

/* ══════════════════════════════
   MAIN DASHBOARD
══════════════════════════════ */
import React from "react";

export default function ExchangeDashboard() {
  const [rightTab,      setRightTab]      = useState(RIGHT_TABS.ORDERS);
  const [pairs,         setPairs]         = useState([]);
  const [orders,        setOrders]        = useState([]);
  const [currencies,    setCurrencies]    = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [editPair,      setEditPair]      = useState(null);
  const [selectedPair,  setSelectedPair]  = useState(null);

  /* add-pair slide-in */
  const [addOpen,       setAddOpen]       = useState(false);
  const [addForm,       setAddForm]       = useState(emptyForm());

  const [failedSweeps,  setFailedSweeps]  = useState([]);
  const [retryingSweep, setRetryingSweep] = useState(null);

  /* cross-admin filter (master only) — drives backend load AND is the Hero "admin" dropdown */
  const [adminFilter,   setAdminFilter]   = useState("mine"); // "mine" | "all" | "<user_id>"
  const [filterAdmins,  setFilterAdmins]  = useState([]);
  const [canFilterAdmins, setCanFilterAdmins] = useState(false);

  /* ── UNIFIED HERO FILTERS — shared across Pairs / Orders / Sweeps ── */
  const [unifiedSearch,       setUnifiedSearch]       = useState("");
  const [unifiedStatus,       setUnifiedStatus]       = useState("all");       // order status (completed/pending/failed)
  const [unifiedFromCurrency, setUnifiedFromCurrency] = useState("all");     // from_currency symbol
  const [unifiedDateRange,    setUnifiedDateRange]    = useState([null, null]);
  const [unifiedStart, unifiedEnd] = unifiedDateRange;

  /* pair sort — single-click cyclic: none → asc → desc → none */
  const [pairSortField, setPairSortField] = useState(null); // "price" | "fee" | null
  const [pairSortDir,   setPairSortDir]   = useState(null); // "asc" | "desc" | null
  const togglePairSort = (field) => {
    if (pairSortField !== field) { setPairSortField(field); setPairSortDir("asc"); }
    else if (pairSortDir === "asc") { setPairSortDir("desc"); }
    else { setPairSortField(null); setPairSortDir(null); }
  };

  const token   = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };
  const currentUsername = localStorage.getItem("username") || "Me";
  const myId = String(localStorage.getItem("user_id") || "");
  const isMaster = localStorage.getItem("role") === "master";
  const canEditPair = (p) => isMaster || String(p.admin_id) === myId;
  const showPairOwner = canFilterAdmins && adminFilter !== "mine";   // pairs list only
  const showOwnerColumns = isMaster && adminFilter !== "mine";       // orders / sweeps
  function emptyForm() {
    return { from_currency_id:"", to_currency_id:"", rate:"", fee_percent:0, min_amount:0, max_amount:"", is_active:true };
  }

  /* ── LOAD FILTER-ADMINS (once) ── */
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

  /* ── LOAD ── */
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

  /* keep selected pair in sync after reload */
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

  const addPair = async () => {
    try {
      await api.post("/admin/exchange/", {
        from_currency_id: Number(addForm.from_currency_id),
        to_currency_id  : Number(addForm.to_currency_id),
        rate            : Number(addForm.rate),
        fee_percent     : Number(addForm.fee_percent) || 0,
        min_amount      : Number(addForm.min_amount)  || 0,
        max_amount      : addForm.max_amount ? Number(addForm.max_amount) : null,
        is_active       : addForm.is_active,
      }, { headers });
      showToast("Pair created");
      setAddForm(emptyForm());
      setAddOpen(false);
      loadAll();
    } catch { showToast("Create failed", false); }
  };

  const savePair = async (form) => {
    try {
      await api.put(`/admin/exchange/${editPair.id}`, {
        from_currency_id: Number(form.from_currency_id),
        to_currency_id  : Number(form.to_currency_id),
        rate            : Number(form.rate),
        fee_percent     : Number(form.fee_percent) || 0,
        min_amount      : Number(form.min_amount)  || 0,
        max_amount      : form.max_amount ? Number(form.max_amount) : null,
        is_active       : form.is_active,
      }, { headers });
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
  const activePairs = pairs.filter(p => p.is_active).length;

  // "From Currency" options — restricted to currencies that actually exist as a from_currency on a pair
  const currencyOptions = useMemo(() => {
    const seen = new Map();
    pairs.forEach(p => {
      const sym = p.from_currency?.symbol;
      if (sym && !seen.has(sym)) seen.set(sym, p.from_currency.id);
    });
    return [...seen.keys()].sort().map(sym => ({ label: sym, value: sym }));
  }, [pairs]);

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
      if (unifiedStart && p.created_at && new Date(p.created_at) < new Date(unifiedStart)) return false;
      if (unifiedEnd && p.created_at) {
        const end = new Date(unifiedEnd);
        end.setHours(23, 59, 59, 999);
        if (new Date(p.created_at) > end) return false;
      }
      return true;
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

      // DATE RANGE
      if (unifiedStart && new Date(o.created_at) < new Date(unifiedStart)) return false;

      if (unifiedEnd) {
        const end = new Date(unifiedEnd);
        end.setHours(23, 59, 59, 999);
        if (new Date(o.created_at) > end) return false;
      }

      // SEARCH
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
      if (unifiedStart && s.created_at && new Date(s.created_at) < new Date(unifiedStart)) return false;
      if (unifiedEnd && s.created_at) {
        const end = new Date(unifiedEnd);
        end.setHours(23, 59, 59, 999);
        if (new Date(s.created_at) > end) return false;
      }
      if (q) {
        const hit =
          String(s.user_id || "").includes(q) ||
          (s.username || "").toLowerCase().includes(q) ||
          (s.currency || "").toLowerCase().includes(q) ||
          (s.network  || "").toLowerCase().includes(q) ||
          String(s.exchange_order_id || "").includes(q) ||
          (showOwnerColumns && ((s.admin_username || "").toLowerCase().includes(q) || String(s.admin_id || "").includes(q)));
        if (!hit) return false;
      }
      return true;
    });
  }, [failedSweeps, unifiedSearch, unifiedFromCurrency, unifiedStart, unifiedEnd, showOwnerColumns]);

  const unresolvedSweeps = failedSweeps.filter(s => !s.resolved).length;

  // total value — sum of filtered orders' from_amount, scoped to a single from-currency
  const { totalValue, totalValueCurrency } = useMemo(() => {
    const formatSum = (sum, currency) => {
      const fractionDigits = currency === "IRT" ? 0 : 1;
      return sum.toLocaleString("en-US", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      });
    };

    if (unifiedFromCurrency !== "all") {
      const sum = filteredOrders.reduce((s, o) => s + (parseFloat(o.from_amount) || 0), 0);
      return { totalValue: formatSum(sum, unifiedFromCurrency), totalValueCurrency: unifiedFromCurrency };
    }

    const distinctCurrencies = [...new Set(filteredOrders.map(o => o.from_currency?.symbol).filter(Boolean))];
    if (distinctCurrencies.length === 1) {
      const sum = filteredOrders.reduce((s, o) => s + (parseFloat(o.from_amount) || 0), 0);
      return { totalValue: formatSum(sum, distinctCurrencies[0]), totalValueCurrency: distinctCurrencies[0] };
    }

    return { totalValue: null, totalValueCurrency: null };
  }, [filteredOrders, unifiedFromCurrency]);

  /* ── TAB CONFIG ── */
  const TABS = [
    { key: RIGHT_TABS.ORDERS,        label:"Orders",   icon:FileText,      count:filteredOrders.length },
    { key: RIGHT_TABS.FAILED_SWEEPS, label:"Sweeps",   icon:AlertTriangle, count:unresolvedSweeps, warn: unresolvedSweeps > 0 },
    { key: RIGHT_TABS.ANALYSIS,      label:"Analysis", icon:BarChart3,     count:null },
  ];

  /* ── RENDER ── */
  return (
    <div style={S.page}>
      <style>{`
        @keyframes skpulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes slideInTab {
          from { transform:translateX(60px); opacity:0; }
          to   { transform:translateX(0);    opacity:1; }
        }
        @keyframes slideInPanel {
          from { transform:translateX(-100%); opacity:0; }
          to   { transform:translateX(0);     opacity:1; }
        }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#1f2937; border-radius:4px; }
        select option { background:#0d1424; color:white; }
        input[type=number]::-webkit-inner-spin-button { opacity:.4; }
      `}</style>

      <div style={{ 
        display:"flex", 
        flexDirection:"column", 
        height:"100vh", 
        background:"#060c18", 
        overflow:"hidden", 
        fontFamily:"'Inter',system-ui,sans-serif", 
        color:"white" }}>

      {/* ── HERO HUB — ONE fixed filter set, shared and applied across Pairs / Orders / Sweeps ── */}
      <div style={{ padding: "0 0 10px", flexShrink: 0 }}>
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
            // from currency — filters pairs, orders and sweeps, and drives the "Total Value" stat
            {
              key: "fromCurrency", 
              visible: true, 
              label: "Currency",
              value: unifiedFromCurrency, 
              onChange: setUnifiedFromCurrency,
              placeholder: "All",
              options: currencyOptions,
            },
            // status — applies to orders (completed / pending / failed)
            {
              key: "status",
              label: "Status",
              visible: true, 
              value: unifiedStatus, 
              onChange: setUnifiedStatus,
              placeholder: "All",
              options: [
                { label: "Completed", value: "completed" },
                { label: "Pending",   value: "pending" },
                { label: "Failed",    value: "failed" },
              ],
            },
            // admin/owner — master only
            canFilterAdmins && {
              key: "admin", 
              visible: true, 
              label: "Admins",
              value: adminFilter, 
              onChange: setAdminFilter,
              options: [
                { label: "All", value: "all" },
                { label: `${currentUsername}`, value: "mine" },
                ...filterAdmins.map(a => ({ label: a.username, value: String(a.user_id) })),
              ],
            },
          ].filter(Boolean)}
          datePicker={{
            visible: true,
            selectsRange: true,
            startDate: unifiedStart,
            endDate: unifiedEnd,
            onChange: (update) => setUnifiedDateRange(update),
            placeholderText: "Select date range",
          }}
          statPills={[
            { key: "pairs",  icon: GitCompare, label: "Total Pairs",  value: filteredPairs.length, accent: "#3b82f6", loading },
            { key: "orders", icon: FileText,   label: "Total Orders", value: filteredOrders.length, accent: "#10b981", loading },
            { key: "value",  icon: Wallet,     label: "Total Value",  value: totalValue, meta: totalValueCurrency, accent: "#22d3ee", loading },
          ]}
          onRefresh={loadAll}
          refreshing={loading}
        />
      </div>

        {/* ══ BODY ══ */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* ── LEFT: PAIRS SIDEBAR + SLIDE-IN ADD FORM ── */}
          <div style={{ position:"relative", flexShrink:0, display:"flex" }}>

            {/* pair list sidebar */}
            <div style={{ 
              width:380, 
              background:"#040a14", 
              borderRight:"1px solid rgba(255,255,255,.05)", 
              display:"flex", 
              flexDirection:"column", 
              overflow:"hidden", 
              transition:"opacity .2s", 
              opacity:addOpen ? .3 : 1, 
              pointerEvents:addOpen ? "none" : "auto" 
              }}>
              {/* sidebar header */}
              <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 5,
                  marginRight: 13
                }}>
              <div style={{ 
                padding:"10px 12px", 
                borderBottom:"1px solid rgba(255,255,255,.05)", 
                display:"flex", 
                alignItems:"center", 
                gap:7, 
                flexShrink:0, 
                 flexWrap: "wrap",
                 }}>
                <GitCompare size={16} color="#3b82f6" />
                <span style={{ 
                  color:"white", 
                  fontWeight:700, 
                  fontSize:18,
                  flex:1 }}>
                    Pairs
                  </span>
                <span style={{ 
                  background:"rgba(59,130,246,.12)", 
                  color:"#60a5fa", 
                  borderRadius:20, 
                  padding:"1px 8px", 
                  fontSize:13, 
                  fontWeight:700 
                  }}>{filteredPairs.length}
                  </span>
                 </div> 
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={() => setAddOpen(true)}
                  style={{ 
                    display:"flex", 
                    alignItems:"center", 
                    gap:6, 
                    background:"rgba(59,130,246,.14)", 
                    border:"1px solid rgba(59,130,246,.28)", 
                    color:"#93c5fd", 
                    borderRadius:7,
                     padding:"7px 9px", 
                     fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}
                >
                  <Plus size={12} />Add
                </button>
                </div>
             </div>

              {/* sort (2 single-click cyclic buttons: none → asc → desc → none) */}
              <div style={{ padding:"7px 10px", borderBottom:"1px solid rgba(255,255,255,.04)", flexShrink:0 }}>
                <div style={{ display:"flex", gap:6 }}>
                  {[{ field: "price", label: "Price" }, { field: "fee", label: "Fee" }].map(({ field, label }) => {
                    const active = pairSortField === field;
                    const arrow = active ? (pairSortDir === "asc" ? "↑" : "↓") : "";
                    return (
                      <button
                        key={field}
                        onClick={() => togglePairSort(field)}
                        style={{
                          flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                          background: active ? "rgba(59,130,246,.16)" : "#060c18",
                          border:`1px solid ${active ? "rgba(59,130,246,.4)" : "rgba(255,255,255,.07)"}`,
                          color: active ? "#60a5fa" : "#94a3b8",
                          borderRadius:7, padding:"6px 0", fontSize:11, fontWeight:700, cursor:"pointer",
                        }}
                      >
                        <ArrowUpDown size={11} />{label}{arrow && <span style={{ fontSize:12 }}>{arrow}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* pair rows */}
              <div style={{ flex:1, overflowY:"auto", padding:"6px 8px" }}>
                {loading && pairs.length === 0
                  ? [...Array(5)].map((_, i) => <div key={i} style={{ padding:"9px 11px", marginBottom:3 }}><Sk h={14} /></div>)
                  : filteredPairs.length === 0
                    ? <div style={{ color:"#536b8cff", fontSize:12, textAlign:"center", padding:"30px 10px", fontWeight:600 }}>No pairs found</div>
                    : filteredPairs.map(p => (
                    <PairRow
                        key={p.id}
                        p={p}
                        selected={selectedPair?.id === p.id}
                        showOwner={showPairOwner}
                        onClick={() =>
                          setSelectedPair(prev => (prev?.id === p.id ? null : p))
                        }
                      />
                      ))
                }
              </div>
            </div>

            {/* ADD PAIR SLIDE-IN — slides over sidebar from left */}
            <div style={{
              position:"absolute", top:0, left:0, bottom:0, width:addOpen ? 380 : 0,
              overflow:"hidden", zIndex:20,
              transition:"width .32s cubic-bezier(.4,0,.2,1)",
              background:"#06101e",
              borderRight:`1px solid ${addOpen ? "rgba(59,130,246,.22)" : "transparent"}`,
              display:"flex", flexDirection:"column",
              boxShadow:addOpen ? "6px 0 28px rgba(0,0,0,.5)" : "none",
            }}>
              <div style={{ 
                minWidth:280, 
                height:"100%", 
                display:"flex", 
                flexDirection:"column" }}>
                {/* add header */}
                <div style={{ 
                  padding:"11px 14px", 
                  borderBottom:"1px solid rgba(255, 255, 255, 0.08)", 
                  display:"flex", 
                  alignItems:"center",
                   gap:8, 
                   flexShrink:0 }}>
                  <div style={{ 
                              width:28, 
                              height:28, 
                              borderRadius:8, 
                              display:"flex", 
                              alignItems:"center", 
                              justifyContent:"center", 
                              flexShrink:0 }}>
                              <Plus size={15} color="#60a5fa" />
                            </div>
                            <span style={{ 
                              color:"white", 
                              fontWeight:700, 
                              fontSize:18, 
                              flex:1, 
                              whiteSpace:"nowrap" }}>Add new pair</span>
                            <button onClick={() => setAddOpen(false)} style={S.closeIconBtn}><X size={16} /></button>
                          </div>

                          {/* form */}
                          <div style={{ flex:1, overflowY:"auto", padding:"14px" }}>
                            <PairForm
                              data={addForm} setData={setAddForm}
                              onSubmit={addPair}
                              submitLabel="Create pair"
                              onCancel={() => setAddOpen(false)}
                              currencies={currencies}
                            />
                          </div>
                   </div>
            </div>
          </div>

          {/* ── PAIR DETAIL PANEL ── */}
          <div style={{
            width: selectedPair ? 258 : 0,
            overflow:"hidden",
            background:"#070f1d",
            borderRight:"1px solid rgba(255,255,255,.06)",
            flexShrink:0,
            transition:"width .28s cubic-bezier(.4,0,.2,1)",
            display:"flex", 
            flexDirection:"column",
          }}>
            {selectedPair && (
              <div style={{ width:258, height:"100%" }}>
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

          {/* ── RIGHT: TABS + CONTENT ── */}
          <div style={{ 
            flex:1, 
            display:"flex", 
            flexDirection:"column", 
            overflow:"hidden", 
            minWidth:0 }}>

            {/* tab bar */}
            <div style={{ 
              padding:"10px 16px", 
              borderBottom:"1px solid rgba(255, 255, 255, 0.08)", 
              display:"flex", 
              gap:6, 
              alignItems:"center", 
              flexShrink:0, 
              background:"#060c18" 
              }}
              >
              {TABS.map(({ key, label, icon: Icon, count, warn }) => {
                const active = rightTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setRightTab(key)}
                    style={{
                      display:"flex", 
                      alignItems:"center", 
                      gap:7,
                      background: active ? "rgba(59,130,246,.13)" : "rgba(59,130,246,0.12)",
                      border:`1px solid ${active ? "#3b82f6" : "rgba(59,130,246,0.3)"}`,
                      borderRadius:8, 
                      padding:"6px 10px",
                      color: active ? "white" : "#64748b",
                      cursor:"pointer", 
                      fontWeight: active ? 700 : 500, 
                      fontSize:12,
                      transition:"all .18s",
                    }}
                  >
                    <Icon size={13} />
                    {label}
                    {count != null && (
                      <span style={{
                        background: active ? "rgba(96,165,250,.18)" : warn ? "rgba(245,158,11,.12)" : "rgba(255, 255, 255, 0.12)",
                        color: active ? "#60a5fa" : warn ? "#fbbf24" : "#a2a8b1ff",
                        borderRadius:99, padding:"2px 7px", fontSize:10, fontWeight:700,
                      }}>{count}</span>
                    )}
                  </button>
                );
              })}

            </div>

            {/* ── ANIMATED TAB CONTENT ── */}
            <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "14px 16px",
                }}
              >

              {/* ORDERS */}
              {rightTab === RIGHT_TABS.ORDERS && (
              <div style={{ display:"flex", flexDirection:"column", gap:10, height:"100%" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {filteredOrders.length === 0
                    ? <EmptyState icon={FileText} title="No orders found" sub="Try adjusting your filters" />
                    : filteredOrders.map(o => <OrderRow key={o.id} item={o} showOwner={showOwnerColumns} />)
                  }
                </div>
              </div>
              )}





              {/* SWEEPS */}
               {rightTab === RIGHT_TABS.FAILED_SWEEPS && (
                
              <div style={{ display:"flex", flexDirection:"column", gap:10, height:"100%" }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {filteredSweeps.length === 0
                      ? <EmptyState icon={AlertTriangle} title="No sweeps found" sub="All clear — no failed sweeps matching your filter" />
                      : filteredSweeps.map(s => <SweepRow key={s.id} sweep={s} onRetry={retrySweep} retrying={retryingSweep} showOwner={showOwnerColumns} />)
                    }
                  </div>
                
               </div>
                )}


              {/* ANALYSIS */}
               {rightTab === RIGHT_TABS.ANALYSIS && (
              <div key={`${RIGHT_TABS.ANALYSIS}-${isMaster ? adminFilter : "mine"}`} style={{ height:"100%" }}>
                <AnalysisTab
                  pairs={isMaster ? pairs : pairs.filter(p => String(p.admin_id) === myId)}
                  headers={headers}
                  adminFilter={isMaster ? adminFilter : "mine"}
                />
              </div>
               )}

           </div>
          </div>
        </div>
      </div>

      {/* ── EDIT MODAL ── */}
      {editPair && (
        <PairEditModal editPair={editPair} currencies={currencies} onSave={savePair} onClose={() => setEditPair(null)} />
      )}
    </div>
  );
}

/* ─── STYLES ─── */
const S = {
    page: {
    background: "#020617",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    color: "white",
    boxSizing: "border-box",
  },
  closeIconBtn: {
    background: "#0b1525", border: "1px solid #313d58ff", color: "#475569",
    width: 32, height: 32, borderRadius: 8, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  input: {
    background:"#060c18", border:"1px solid rgba(255,255,255,.1)", color:"white",
    padding:"9px 11px", borderRadius:9, outline:"none", fontSize:13, width:"100%", transition:"border-color .15s",
  },
  filterInput: {
    background:"#0a1020", border:"1px solid rgba(255,255,255,.07)", color:"white",
    borderRadius:8, padding:"6px 10px", fontSize:11, outline:"none", minWidth:80,
  },
  primaryBtn: {
    display:"flex", alignItems:"center", justifyContent:"center", flex:1,
    background:"rgba(37,99,235,.22)", border:"1px solid rgba(59,130,246,.38)", color:"#93c5fd",
    padding:"10px 18px", borderRadius:10, cursor:"pointer", fontWeight:700, fontSize:13,
  },
  stepBtn: {
      width: 25,
      background: "#0f172a",
      color: "#94a3b8",
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all .15s ease",
    },
  cancelBtn: {
    display:"flex", alignItems:"center", justifyContent:"center",
    background:"transparent", border:"1px solid rgba(255,255,255,.08)", color:"#4b5563",
    padding:"10px 14px", borderRadius:10, cursor:"pointer", fontWeight:600, fontSize:13, whiteSpace:"nowrap",
  },
  iconBtn: {
    background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.09)", color:"#6b7280",
    width:30, height:30, borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
  },
  ghostBtn: {
    background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", color:"#4b5563",
    borderRadius:8, padding:"6px 9px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
  },
  actionBtn: {
    display:"flex", alignItems:"center", justifyContent:"center", gap:5,
    border:"1px solid", borderRadius:8, padding:"8px 0", cursor:"pointer", fontWeight:600, fontSize:11,
  },
    title: { color: "#2e7ce9af",margin: 0, fontSize: 26, fontWeight: 600, marginRight: 20 , letterSpacing: "0.1rem",   },
  subtitle: { color: "#64748b", fontSize: 13, margin: "2px 0 0" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 14,  padding :"10px 0 20px 20px",  flexWrap: "wrap"
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 15,
    flexWrap: "wrap",
    
  },
   filtersContainer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 14,
    marginBottom: 5,
    flexWrap: "wrap",
  },

};