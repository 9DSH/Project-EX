import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  Landmark, Plus, Edit3, Trash2, Power, PowerOff, X, Save,
  CheckCircle2, XCircle, Clock, AlertTriangle, ChevronDown,
  ChevronUp, Send, Ban, RefreshCw, Timer, GitCompare, FileText, Search, Users,
  ArrowUpDown, Wallet,
} from "lucide-react";
import HeroHub from "../components/HeroHub";

const API = "http://127.0.0.1:8000";
const token = () => localStorage.getItem("token");
const auth  = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const fmt = (n, d = 4) =>
  n != null ? Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d }) : "—";

const parseUtcDate = (value) => {
  if (!value) return null;
  if (typeof value === "string" && !value.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value}Z`);
  }
  return new Date(value);
};

const fmtDate = (d) =>
  d ? parseUtcDate(d)?.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

// ─── FIAT-ONLY FILTER ─────────────────────────────────────────
// Wire Transfer pairs can only be built from fiat currencies (never crypto).
// Adjust the field name(s) here if your currency model uses something
// other than `type` / `is_crypto` / `is_fiat` / `category`.
const isFiat = (c) => {
  if (!c) return false;
  if (c.type != null) return String(c.type).toLowerCase() === "fiat";
  if (c.category != null) return String(c.category).toLowerCase() === "fiat";
  if (typeof c.is_crypto === "boolean") return !c.is_crypto;
  if (typeof c.is_fiat === "boolean") return c.is_fiat;
  return true; // unknown shape — don't silently hide currencies
};

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

// ─── TOAST ────────────────────────────────────────────────────
const showToast = (msg, ok = true) => {
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
  setTimeout(() => { el.style.opacity = 0; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 300); }, 3000);
};

// ─── STATUS CONFIG ────────────────────────────────────────────
const STATUS_CFG = {
  pending  : { color: "#fbbf24", bg: "rgba(245,158,11,.1)",  border: "rgba(245,158,11,.22)", icon: Clock,         label: "Pending"   },
  approved : { color: "#60a5fa", bg: "rgba(59,130,246,.1)",  border: "rgba(59,130,246,.22)", icon: CheckCircle2,  label: "Approved"  },
  delivered: { color: "#4ade80", bg: "rgba(34,197,94,.1)",   border: "rgba(34,197,94,.22)",  icon: CheckCircle2,  label: "Delivered" },
  rejected : { color: "#f87171", bg: "rgba(239,68,68,.1)",   border: "rgba(239,68,68,.22)",  icon: XCircle,       label: "Rejected"  },
  failed   : { color: "#fb923c", bg: "rgba(249,115,22,.1)",  border: "rgba(249,115,22,.22)", icon: AlertTriangle, label: "Failed"    },
  expired  : { color: "#94a3b8", bg: "rgba(100,116,139,.1)", border: "rgba(100,116,139,.22)",icon: XCircle,       label: "Expired"   },
};

function StatusBadge({ status }) {
  const s = STATUS_CFG[status] || STATUS_CFG.pending;
  const Icon = s.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: "3px 10px 3px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
      <Icon size={11} />{s.label}
    </span>
  );
}

// ─── COUNTDOWN ────────────────────────────────────────────────
function Countdown({ expiresAt }) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const calc = () => {
      const expiresAtDate = parseUtcDate(expiresAt);
      if (!expiresAtDate || Number.isNaN(expiresAtDate.getTime())) {
        setLeft("—");
        return;
      }
      const diff = expiresAtDate.getTime() - Date.now();
      if (diff <= 0) { setLeft("Expired"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLeft(`${m}m ${s}s`);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const isUrgent = () => {
    const expiresAtDate = parseUtcDate(expiresAt);
    if (!expiresAtDate || Number.isNaN(expiresAtDate.getTime())) return false;
    const diff = expiresAtDate.getTime() - Date.now();
    return diff > 0 && diff < 5 * 60 * 1000;
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: isUrgent() ? "#f87171" : "#94a3b8" }}>
      <Timer size={11} />{left}
    </span>
  );
}

// ─── WIRE TRANSFER FIELDS (common for bank/fiat) ──────────────
const WIRE_COMMON_FIELDS = [
  { key: "iban",          label: "IBAN",         type: "text" },
  { key: "account_number",label: "Account Number",type: "text" },
  { key: "account_name",  label: "Account Name", type: "text" },
  { key: "bank_name",     label: "Bank Name",    type: "text" },
  { key: "bank_code",     label: "Bank Code",    type: "text" },
  { key: "bank_card_number",label: "Bank Card Number",type: "text" },
  { key: "bank_Sheba",label: "Bank Sheba",type: "text" },
  { key: "swift_code",    label: "SWIFT / BIC",  type: "text" },
  { key: "routing_number",label: "Routing Number",type: "text" },
  { key: "reference",     label: "Reference / Note", type: "text" },
  { key: "full_name",     label: "Full Name",    type: "text" },
  { key: "Melli_Number",     label: "Melli Code",    type: "text" },
  { key: "phone_number",  label: "Phone Number", type: "text" },
];

const FIELD_TYPES = [
  { value: "text",   label: "Text"   },
  { value: "number", label: "Number" },
  { value: "email",  label: "Email"  },
  { value: "phone",  label: "Phone"  },
];

const PAYMENT_METHOD_PRESETS = [
  { key: "paypal", label: "PayPal" },
  { key: "credit_card", label: "Credit Card" },
  { key: "bank_transfer", label: "Bank Transfer" },
  { key: "swift", label: "SWIFT" },
  { key: "wise", label: "Wise" },
];

// ─── SHARED PRIMITIVES ────────────────────────────────────────
const S = {
  input: { width: "100%", background: "#0d1829", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, padding: "8px 11px", color: "white", fontSize: 13, outline: "none", boxSizing: "border-box" },
  primaryBtn: { background: "rgba(59,130,246,.18)", border: "1px solid rgba(59,130,246,.35)", borderRadius: 10, padding: "10px 16px", color: "#93c5fd", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  cancelBtn:  { background: "transparent", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 16px", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  actionBtn:  { display: "flex", alignItems: "center", gap: 5, border: "1px solid", borderRadius: 8, padding: "8px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  iconBtn:    { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#94a3b8" },
  closeIconBtn: {
    background: "#0b1525", border: "1px solid #313d58ff", color: "#475569",
    width: 32, height: 32, borderRadius: 8, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  stepBtn: {
    width: 25, background: "#0f172a", color: "#94a3b8", fontSize: 12, fontWeight: 700,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s ease",
  },
    title: { color: "#2e7ce9af",margin: 0, fontSize: 26, fontWeight: 600, marginRight: 20 , letterSpacing: "0.1rem",   },
  subtitle: { color: "#64748b", fontSize: 13, margin: "2px 0 0" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 14,  padding :"10px 0 20px 20px",  flexWrap: "wrap"
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap"},
};

const Field = ({ label, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <label style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" }}>{label}</label>
    {children}
  </div>
);

// ─── ADMIN FILTER DROPDOWN ─────────────────────────────────────
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
    value === "mine" ? `${currentUsername}` :
    adminList.find(a => String(a.user_id) === String(value))?.username
      ? `Admin: ${adminList.find(a => String(a.user_id) === String(value)).username}`
      : "My Rates";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: open ? "rgba(139,92,246,.16)" : "rgba(139,92,246,.1)",
          border: `1px solid ${open ? "#8b5cf6" : "rgba(139,92,246,.28)"}`,
          color: "#c4b5fd", borderRadius: 7, padding: "7px 9px",
          fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        <Users size={12} />
        {currentLabel}
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, minWidth: 220,
          background: "#0d1424", border: "1px solid rgba(139,92,246,.25)", borderRadius: 10,
          zIndex: 50, boxShadow: "0 12px 32px rgba(0,0,0,.5)", overflow: "hidden",
        }}>
          <div
            onClick={() => { onChange("mine"); setOpen(false); }}
            style={{ padding: "9px 12px", cursor: "pointer", fontSize: 12, fontWeight: value === "mine" ? 700 : 500, color: value === "mine" ? "#a78bfa" : "#94a3b8", background: value === "mine" ? "rgba(139,92,246,.1)" : "transparent" }}
          >
            My Rates ({currentUsername})
          </div>
          <div
            onClick={() => { onChange("all"); setOpen(false); }}
            style={{ padding: "9px 12px", cursor: "pointer", fontSize: 12, fontWeight: value === "all" ? 700 : 500, color: value === "all" ? "#a78bfa" : "#94a3b8", background: value === "all" ? "rgba(139,92,246,.1)" : "transparent", borderTop: "1px solid rgba(255,255,255,.05)" }}
          >
            All Admins (Platform)
          </div>
          {adminList.length > 0 && (
            <div style={{ maxHeight: 220, overflowY: "auto", borderTop: "1px solid rgba(255,255,255,.05)" }}>
              {adminList.map(a => (
                <div
                  key={a.user_id}
                  onClick={() => { onChange(String(a.user_id)); setOpen(false); }}
                  style={{ padding: "9px 12px", cursor: "pointer", fontSize: 12, fontWeight: String(value) === String(a.user_id) ? 700 : 500, color: String(value) === String(a.user_id) ? "#a78bfa" : "#94a3b8", background: String(value) === String(a.user_id) ? "rgba(139,92,246,.1)" : "transparent", display: "flex", justifyContent: "space-between", gap: 8 }}
                >
                  <span>{a.username}</span>
                  <span style={{ color: "#4b5563", fontSize: 10 }}>{a.role === "master" ? "MASTER" : `#${a.user_id}`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── STEP BUILDER ─────────────────────────────────────────────
function StepBuilder({ fields, onChange }) {
  // fields: { key: {label, type, required} }
  const [customKey,   setCustomKey]   = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customType,  setCustomType]  = useState("text");
  const [customReq,   setCustomReq]   = useState(true);

  const addCommon = (f) => {
    if (fields[f.key]) return;
    onChange({ ...fields, [f.key]: { label: f.label, type: f.type, required: true } });
  };

  const addCustom = () => {
    const k = customKey.trim().replace(/\s+/g, "_").toLowerCase();
    const l = customLabel.trim();
    if (!k || !l) return;
    onChange({ ...fields, [k]: { label: l, type: customType, required: customReq } });
    setCustomKey(""); setCustomLabel("");
  };

  const remove = (k) => {
    const next = { ...fields };
    delete next[k];
    onChange(next);
  };

  const toggleReq = (k) => {
    onChange({ ...fields, [k]: { ...fields[k], required: !fields[k].required } });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* common chips */}
      <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" }}>Quick Add</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {WIRE_COMMON_FIELDS.map(f => (
          <button key={f.key} onClick={() => addCommon(f)}
            style={{ background: fields[f.key] ? "rgba(59,130,246,.2)" : "rgba(255,255,255,.04)", border: `1px solid ${fields[f.key] ? "rgba(59,130,246,.4)" : "rgba(255,255,255,.1)"}`, borderRadius: 20, padding: "4px 11px", color: fields[f.key] ? "#93c5fd" : "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* custom field */}
      <div style={{ background: "rgba(207, 196, 196, 0.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" }}>Custom Field</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          <input style={S.input} placeholder="Field key (e.g. branch_code)" value={customKey} onChange={e => setCustomKey(e.target.value)} />
          <input style={S.input} placeholder="Display label"               value={customLabel} onChange={e => setCustomLabel(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <select style={{ ...S.input, flex: 1 }} value={customType} onChange={e => setCustomType(e.target.value)}>
            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>
            <input type="checkbox" checked={customReq} onChange={e => setCustomReq(e.target.checked)} /> Required
          </label>
          <button onClick={addCustom} style={{ ...S.primaryBtn, padding: "7px 12px", whiteSpace: "nowrap", fontSize: 11 }}>+ Add</button>
        </div>
      </div>

      {/* current fields list */}
      {Object.keys(fields).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" }}>Active Fields</div>
          {Object.entries(fields).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 8, padding: "7px 10px" }}>
              <span style={{ flex: 1, fontSize: 13, color: "white", fontWeight: 600 }}>{v.label}</span>
              <span style={{ fontSize: 10, color: "#475569", background: "rgba(255,255,255,.05)", borderRadius: 4, padding: "2px 6px" }}>{k}</span>
              <span style={{ fontSize: 10, color: "#475569" }}>{v.type}</span>
              <button onClick={() => toggleReq(k)}
                style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, border: `1px solid ${v.required ? "rgba(34,197,94,.3)" : "rgba(255,255,255,.1)"}`, background: v.required ? "rgba(34,197,94,.1)" : "transparent", color: v.required ? "#4ade80" : "#94a3b8", cursor: "pointer" }}>
                {v.required ? "Required" : "Optional"}
              </button>
              <button onClick={() => remove(k)} style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MethodSummaryLine({ method, isIrtSource }) {
  const receiverCount = Object.keys(method.receiver_fields || method.fields || {}).length;
  const senderCount = Object.keys(method.sender_fields || {}).length;
  const parts = [`Fee: ${Number(method.fee_percent || 0)}%`, `${receiverCount} receiver field${receiverCount === 1 ? "" : "s"}`];
  if (isIrtSource) parts.push(`${senderCount} customer field${senderCount === 1 ? "" : "s"}`);
  return <span style={{ fontSize: 11, color: "#64748b" }}>{parts.join(" · ")}</span>;
}

function ReceiverMethodsBuilder({ methods, onChange, isIrtSource }) {
  const [customLabel, setCustomLabel] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());

  const normalizeKey = (value) => value.trim().replace(/\s+/g, "_").toLowerCase();

  const toggleExpanded = (i) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const addMethod = (method) => {
    const key = normalizeKey(method.key || method.label || "");
    if (!key || methods.some(m => m.key === key)) return;
    onChange([...methods, { key, label: method.label || key, fee_percent: 0, note: "", receiver_fields: {}, sender_fields: {} }]);
    setExpanded(prev => new Set(prev).add(methods.length)); // auto-expand the newly added card
  };

  const addCustomMethod = () => {
    const label = customLabel.trim();
    if (!label) return;
    addMethod({ key: label, label });
    setCustomLabel("");
  };

  const updateMethod = (index, updates) => {
    onChange(methods.map((m, i) => i === index ? { ...m, ...updates } : m));
  };

  const removeMethod = (index) => {
    onChange(methods.filter((_, i) => i !== index));
    setExpanded(prev => {
      const next = new Set();
      prev.forEach(i => { if (i < index) next.add(i); else if (i > index) next.add(i - 1); });
      return next;
    });
  };

  const updateMethodFieldValue = (methodIndex, fieldKey, value) => {
    const method = methods[methodIndex] || {};
    const fields = method.receiver_fields || method.fields || {};
    const currentField = fields[fieldKey] || {};
    updateMethod(methodIndex, {
      receiver_fields: {
        ...fields,
        [fieldKey]: {
          ...currentField,
          value,
        },
      },
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" }}>Add a Payment Method</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {PAYMENT_METHOD_PRESETS.map(m => {
          const enabled = methods.some(x => x.key === m.key);
          return (
            <button key={m.key} onClick={() => !enabled && addMethod(m)} disabled={enabled}
              style={{ background: enabled ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.04)", border: `1px solid ${enabled ? "rgba(34,197,94,.3)" : "rgba(255,255,255,.1)"}`, borderRadius: 20, padding: "4px 11px", color: enabled ? "#86efac" : "#94a3b8", fontSize: 11, fontWeight: 600, cursor: enabled ? "default" : "pointer" }}>
              {enabled ? "✓ " : "+ "}{m.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 7 }}>
        <input style={{ ...S.input, flex: 1 }} placeholder="Custom method (e.g. Revolut)" value={customLabel} onChange={e => setCustomLabel(e.target.value)} />
        <button onClick={addCustomMethod} style={{ ...S.primaryBtn, padding: "7px 12px", fontSize: 11 }}>+ Add</button>
      </div>

      {methods.length > 0 && (
        <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", marginTop: 4 }}>
          Configured Methods ({methods.length})
        </div>
      )}

      {methods.length === 0 ? (
        <div style={{ fontSize: 12, color: "#64748b", padding: "4px 1px" }}>No payment method selected.</div>
      ) : methods.map((method, i) => {
        const isOpen = expanded.has(i);
        return (
          <div key={method.key} style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, background: "rgba(255,255,255,.02)", overflow: "hidden" }}>
            {/* card header — click to expand/collapse */}
            <div
              onClick={() => toggleExpanded(i)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "white", fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{method.label || "Untitled method"}</div>
                <MethodSummaryLine method={method} isIrtSource={isIrtSource} />
              </div>
              <button onClick={e => { e.stopPropagation(); removeMethod(i); }} style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                <Trash2 size={14} />
              </button>
              {isOpen ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
            </div>

            {/* expanded editor */}
            {isOpen && (
              <div style={{ padding: "0 12px 12px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ marginTop: 11 }}>
                  <Field label="Method label">
                    <input
                      style={S.input}
                      value={method.label}
                      onChange={e => updateMethod(i, { label: e.target.value })}
                      placeholder="Method label"
                    />
                  </Field>
                </div>

                <Field label="Method Fee %">
                  <input
                    type="number"
                    style={S.input}
                    placeholder="0"
                    value={method.fee_percent ?? 0}
                    onChange={e => updateMethod(i, { fee_percent: e.target.value })}
                  />
                </Field>

                <Field label="Instruction Note">
                  <textarea
                    rows={3}
                    style={{ ...S.input, resize: "vertical" }}
                    placeholder="Instruction shown to user before they send funds for this method."
                    value={method.note || ""}
                    onChange={e => updateMethod(i, { note: e.target.value })}
                  />
                </Field>

                <div style={{ marginTop: 9 }}>
                  <div style={{ color: "white", fontWeight: 700, fontSize: 12, marginBottom: 3 }}>
                    {isIrtSource ? "Your Receiving Account (where the user must send IRT)" : "Your Payment Account for this Method (e.g. Wise/SWIFT)"}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8 }}>
                    {isIrtSource
                      ? "Shown to the user as the platform's IRT bank account instructions after they pick this method."
                      : "Shown to the user as your account details so they know where to send the foreign currency."}
                  </div>
                  <StepBuilder
                    fields={method.receiver_fields || method.fields || {}}
                    onChange={receiver_fields => updateMethod(i, { receiver_fields })}
                  />
                  {Object.entries(method.receiver_fields || method.fields || {}).length > 0 && (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {Object.entries(method.receiver_fields || method.fields || {}).map(([fieldKey, cfg]) => (
                        <Field key={fieldKey} label={cfg?.label || fieldKey.replace(/_/g, " ")}>
                          <input
                            style={S.input}
                            type={cfg?.type === "number" ? "number" : cfg?.type === "email" ? "email" : "text"}
                            value={cfg?.value || ""}
                            onChange={e => updateMethodFieldValue(i, fieldKey, e.target.value)}
                            placeholder="Receiver payment info shown in bot"
                          />
                        </Field>
                      ))}
                    </div>
                  )}
                </div>

                {isIrtSource && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ color: "white", fontWeight: 700, fontSize: 12, marginBottom: 3 }}>Customer's Destination Account</div>
                    <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8 }}>
                      Fields the bot asks the user to fill in for this method — e.g. their Wise account email/IBAN — since the platform doesn't know it in advance.
                    </div>
                    <StepBuilder
                      fields={method.sender_fields || {}}
                      onChange={sender_fields => updateMethod(i, { sender_fields })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── WIRE PAIR FORM (shared body — used in the Add slide-in AND the Edit modal) ──
// `currencies` passed in here should already be pre-filtered to fiat-only by the caller.
function WirePairForm({ data, setData, onSubmit, submitLabel, onCancel, currencies }) {
  const [err, setErr] = useState("");
  const [configTab, setConfigTab] = useState("sender");
  const set = (k, v) => setData(f => ({ ...f, [k]: v }));

  const fromCurrency = currencies.find(c => String(c.id) === String(data.from_currency_id));
  const isIrtSource = String(fromCurrency?.symbol || "").toUpperCase() === "IRT";

  const submit = () => {
    if (!data.from_currency_id || !data.to_currency_id || !data.rate) { setErr("From, To and Rate are required."); return; }
    setErr(""); onSubmit();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {err && (
        <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", color: "#f87171", padding: "9px 13px", borderRadius: 9, fontSize: 12, marginBottom: 12 }}>{err}</div>
      )}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <Field label="From Currency (fiat)">
            <select style={S.input} value={data.from_currency_id} onChange={e => set("from_currency_id", e.target.value)}>
              <option value="">Select…</option>
              {currencies.map(c => <option key={c.id} value={c.id}>{c.symbol} — {c.name}</option>)}
            </select>
          </Field>
          <Field label="To Currency (fiat)">
            <select style={S.input} value={data.to_currency_id} onChange={e => set("to_currency_id", e.target.value)}>
              <option value="">Select…</option>
              {currencies.map(c => <option key={c.id} value={c.id}>{c.symbol} — {c.name}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <Field label="Rate">
            <input type="number" style={S.input} placeholder="0.00" value={data.rate} onChange={e => set("rate", e.target.value)} />
          </Field>
          <Field label="Timeout (min)">
            <input type="number" style={S.input} placeholder="60" value={data.timeout_minutes} onChange={e => set("timeout_minutes", e.target.value)} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <Field label="Min Amount">
            <input type="number" style={S.input} placeholder="0" value={data.min_amount} onChange={e => set("min_amount", e.target.value)} />
          </Field>
          <Field label="Max Amount">
            <input type="number" style={S.input} placeholder="∞" value={data.max_amount} onChange={e => set("max_amount", e.target.value)} />
          </Field>
        </div>

        {/* Active toggle */}
        <button type="button" onClick={() => set("is_active", !data.is_active)}
          style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: `1px solid ${data.is_active ? "rgba(34,197,94,.25)" : "rgba(255,255,255,.08)"}`, borderRadius: 10, padding: "10px 13px", cursor: "pointer", textAlign: "left" }}>
          <div style={{ width: 38, height: 22, borderRadius: 11, background: data.is_active ? "#22c55e" : "#1f2937", position: "relative", flexShrink: 0, transition: "all .25s" }}>
            <div style={{ position: "absolute", top: 2, left: data.is_active ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: data.is_active ? "white" : "#4b5563", transition: "left .25s" }} />
          </div>
          <span style={{ color: data.is_active ? "#d1fae5" : "#6b7280", fontSize: 13, fontWeight: 600 }}>{data.is_active ? "Active" : "Inactive"}</span>
        </button>

        {/* Sender/Receiver Config */}
        <div style={{ border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: 14 }}>
          {isIrtSource ? (
            // IRT-source pairs skip pair-level Customer Input entirely — the bot
            // collects destination details per payment method instead, so only
            // the Payment Methods builder is shown (no tab switcher needed).
            <>
              <div style={{ color: "white", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Payment Methods</div>
              <div style={{ color: "#64748b", fontSize: 11, marginBottom: 12 }}>
                These are the ways the user can receive the destination currency (e.g. SWIFT, Wise). Each method also collects the user's own destination account details.
              </div>
              <ReceiverMethodsBuilder
                methods={data.receiver_methods || []}
                onChange={v => set("receiver_methods", v)}
                isIrtSource={true}
              />
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setConfigTab("sender")}
                  style={{
                    ...S.actionBtn,
                    background: configTab === "sender" ? "rgba(59,130,246,.15)" : "rgba(255,255,255,.02)",
                    borderColor: configTab === "sender" ? "rgba(59,130,246,.3)" : "rgba(255,255,255,.1)",
                    color: configTab === "sender" ? "#93c5fd" : "#94a3b8",
                    fontSize: 12,
                  }}
                >
                  Customer Input
                </button>
                <button
                  type="button"
                  onClick={() => setConfigTab("receiver")}
                  style={{
                    ...S.actionBtn,
                    background: configTab === "receiver" ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.02)",
                    borderColor: configTab === "receiver" ? "rgba(34,197,94,.3)" : "rgba(255,255,255,.1)",
                    color: configTab === "receiver" ? "#86efac" : "#94a3b8",
                    fontSize: 12,
                  }}
                >
                  Payment Methods
                </button>
              </div>

              {configTab === "sender" ? (
                <>
                  <div style={{ color: "white", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Required Information Fields</div>
                  <div style={{ color: "#64748b", fontSize: 11, marginBottom: 12 }}>
                    Collected first, before payment methods. For this direction, this should always be the user's IRT bank account/Sheba number where they want to receive Rial.
                  </div>
                  <StepBuilder fields={data.sender_fields || data.required_fields || {}} onChange={v => { set("sender_fields", v); set("required_fields", v); }} />
                </>
              ) : (
                <>
                  <div style={{ color: "#64748b", fontSize: 11, marginBottom: 12 }}>
                    These are the ways the user can pay in the foreign currency (e.g. SWIFT, Wise, bank transfer). Configure your receiving account for each.
                  </div>
                  <ReceiverMethodsBuilder
                    methods={data.receiver_methods || []}
                    onChange={v => set("receiver_methods", v)}
                    isIrtSource={false}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 7, marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.05)" }}>
        {onCancel && <button style={S.cancelBtn} onClick={onCancel}>Cancel</button>}
        <button style={{ ...S.primaryBtn, flex: 1 }} onClick={submit}>{submitLabel}</button>
      </div>
    </div>
  );
}

// ─── EDIT MODAL (still a centered modal — only "Add" slides in) ──────────
function PairEditModal({ editPair, currencies, onSave, onClose }) {
  const [form, setForm] = useState({
    from_currency_id: editPair?.from_currency?.id || "",
    to_currency_id:   editPair?.to_currency?.id   || "",
    rate:             editPair?.rate              || "",
    min_amount:       editPair?.min_amount        ?? 0,
    max_amount:       editPair?.max_amount        || "",
    timeout_minutes:  editPair?.timeout_minutes   ?? 60,
    required_fields:  editPair?.sender_fields     || editPair?.required_fields || {},
    sender_fields:    editPair?.sender_fields     || editPair?.required_fields || {},
    receiver_methods: editPair?.receiver_methods  || [],
    is_active:        editPair?.is_active         ?? true,
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "92%", maxWidth: 560, background: "#0d1424", borderRadius: 22, padding: "26px 28px", border: "1px solid rgba(255,255,255,.08)", display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "auto", boxShadow: "0 32px 80px rgba(0,0,0,.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 17 }}>Edit pair</div>
            <div style={{ color: "#4b5563", fontSize: 13, marginTop: 3 }}>{editPair?.from_currency?.symbol} → {editPair?.to_currency?.symbol}</div>
          </div>
          <button style={S.iconBtn} onClick={onClose}><X size={14} /></button>
        </div>
        <WirePairForm data={form} setData={setForm} onSubmit={submit} submitLabel={saving ? "Saving…" : "Save changes"} onCancel={onClose} currencies={currencies} />
      </div>
    </div>,
    document.body
  );
}

// ─── FAIL REASON MODAL ────────────────────────────────────────
function FailModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 420, background: "#0d1424", borderRadius: 18, padding: "24px 26px", border: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ color: "white", fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Mark as Failed</div>
        <Field label="Reason">
          <textarea rows={3} style={{ ...S.input, resize: "vertical" }} placeholder="e.g. Bank rejected the transfer — wrong IBAN" value={reason} onChange={e => setReason(e.target.value)} />
        </Field>
        <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={{ ...S.primaryBtn, flex: 1, background: "rgba(249,115,22,.18)", borderColor: "rgba(249,115,22,.35)", color: "#fb923c" }} onClick={() => reason.trim() && onConfirm(reason.trim())}>Confirm Failure</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── DELIVER MESSAGE MODAL ─────────────────────────────────────
function DeliverModal({ onConfirm, onClose }) {
  const [message, setMessage] = useState("");
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 420, background: "#0d1424", borderRadius: 18, padding: "24px 26px", border: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ color: "white", fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Mark as Delivered</div>
        <Field label="Delivery message (optional, shown to user)">
          <textarea rows={3} style={{ ...S.input, resize: "vertical" }} placeholder="e.g. Funds sent via SWIFT, ref #4821 — allow 1–2 business days to arrive" value={message} onChange={e => setMessage(e.target.value)} />
        </Field>
        <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={{ ...S.primaryBtn, flex: 1, background: "rgba(34,197,94,.18)", borderColor: "rgba(34,197,94,.35)", color: "#4ade80" }} onClick={() => { onConfirm(message.trim()); }}>Confirm Delivery</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── STATUS TIMELINE ────────────────────────────────────────────
// Shows the full lifecycle of an order: when it was placed, when it was
// approved (and by whom), and when it was delivered/rejected/failed (and by whom).
// Steps are only rendered once they've actually happened — "Ordered" always shows.
function StatusTimeline({ order }) {
  const steps = [
    { key: "created",   label: "Ordered",    at: order.created_at,   by: order.username,                 icon: Clock,        color: "#94a3b8" },
    { key: "approved",  label: "Approved",   at: order.approved_at,  by: order.approved_by,               icon: CheckCircle2, color: "#60a5fa" },
    { key: "rejected",  label: "Rejected",   at: order.rejected_at,  by: order.rejected_by,               icon: Ban,          color: "#f87171" },
    { key: "delivered", label: "Delivered",  at: order.delivered_at, by: order.delivered_by,              icon: Send,         color: "#4ade80" },
    { key: "failed",    label: "Failed",     at: order.failed_at,    by: order.failed_by || "system",     icon: AlertTriangle,color: "#fb923c" },
  ].filter(s => s.key === "created" || !!s.at);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {steps.map((s, i) => {
        const Icon = s.icon;
        const isLast = i === steps.length - 1;
        return (
          <div key={s.key} style={{ display: "flex", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${s.color}18`, border: `1px solid ${s.color}40`, display: "flex", alignItems: "center", justifyContent: "center", color: s.color, flexShrink: 0 }}>
                <Icon size={11} />
              </div>
              {!isLast && <div style={{ width: 1, flex: 1, minHeight: 14, background: "rgba(255,255,255,.09)", margin: "3px 0" }} />}
            </div>
            <div style={{ paddingBottom: isLast ? 2 : 14 }}>
              <div style={{ color: "white", fontSize: 12, fontWeight: 700 }}>{s.label}</div>
              <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
                {fmtDate(s.at)}{s.by ? ` · by ${s.by}` : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ORDER SIDEBAR ────────────────────────────────────────────
function WireSidebar({ order, onAction, onClose, showOwner }) {
  const [showFail, setShowFail] = useState(false);
  const [showDeliver, setShowDeliver] = useState(false);
  if (!order) return null;

  const inputData = order.input_data || {};

  return createPortal(
    <>
      {showFail && (
        <FailModal onClose={() => setShowFail(false)} onConfirm={reason => { setShowFail(false); onAction(order.id, "fail", { reason }); }} />
      )}
      {showDeliver && (
        <DeliverModal onClose={() => setShowDeliver(false)} onConfirm={message => { setShowDeliver(false); onAction(order.id, "deliver", { message }); }} />
      )}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 800 }} onClick={onClose} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 440, background: "#0b1220", borderLeft: "1px solid rgba(255,255,255,.08)", zIndex: 801, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 16 }}>Order #{order.id}</div>
            <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>Wire Transfer Detail</div>
          </div>
          <button style={S.iconBtn} onClick={onClose}><X size={14} /></button>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* status + timer */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusBadge status={order.status} />
            {order.status === "pending" && order.expires_at && <Countdown expiresAt={order.expires_at} />}
          </div>

          {showOwner && order.admin_id != null && (
            <div style={{ fontSize: 12, color: "#a78bfa" }}>Pair owner: {order.admin_username || `#${order.admin_id}`}</div>
          )}

          {/* status timeline — ordered / approved (by who) / delivered (by who) / rejected / failed */}
          <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 10 }}>Status Timeline</div>
            <StatusTimeline order={order} />
          </div>

          {/* pair + amounts */}
          <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <Row k="Pair"       v={`${order.from_currency?.symbol} → ${order.to_currency?.symbol}`} />
            {order.payment_method_label && <Row k="Method" v={order.payment_method_label} />}
            <Row k="Amount"     v={`${fmt(order.from_amount)} ${order.from_currency?.symbol}`} accent="#60a5fa" />
            <Row k="Receives"   v={`${fmt(order.to_amount)} ${order.to_currency?.symbol}`} accent="#4ade80" />
            <Row k="Rate"       v={fmt(order.locked_rate, 4)} />
            <Row k="Fee"        v={`${order.locked_fee_percent}% = ${fmt(order.fee_amount)} ${order.from_currency?.symbol}`} />
          </div>

          {/* user */}
          <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <Row k="User"       v={order.username} />
            <Row k="Created"    v={fmtDate(order.created_at)} />
            <Row k="Expires"    v={fmtDate(order.expires_at)} />
          </div>

          {/* input data */}
          {Object.keys(inputData).length > 0 && (
            <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 4 }}>Transfer Details</div>
              {Object.entries(inputData).map(([k, v]) => <Row key={k} k={k.replace(/_/g, " ")} v={v} />)}
            </div>
          )}

          {/* delivery message */}
          {order.delivery_message && (
            <div style={{ background: "rgba(34,197,94,.07)", border: "1px solid rgba(34,197,94,.2)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 700, marginBottom: 4 }}>DELIVERY MESSAGE</div>
              <div style={{ color: "#bbf7d0", fontSize: 13 }}>{order.delivery_message}</div>
            </div>
          )}

          {/* fail reason */}
          {order.fail_reason && (
            <div style={{ background: "rgba(249,115,22,.07)", border: "1px solid rgba(249,115,22,.2)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#fb923c", fontWeight: 700, marginBottom: 4 }}>FAILURE REASON</div>
              <div style={{ color: "#fdba74", fontSize: 13 }}>{order.fail_reason}</div>
            </div>
          )}
        </div>

        {/* actions footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,.07)", display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
          {order.status === "pending" && (
            <div style={{ display: "flex", gap: 7 }}>
              <button style={{ flex: 1, ...S.actionBtn, background: "rgba(59,130,246,.1)", borderColor: "rgba(59,130,246,.25)", color: "#60a5fa", justifyContent: "center", fontSize: 13, padding: "10px" }}
                onClick={() => onAction(order.id, "approve")}>
                <CheckCircle2 size={14} /> Approve
              </button>
              <button style={{ flex: 1, ...S.actionBtn, background: "rgba(239,68,68,.07)", borderColor: "rgba(239,68,68,.2)", color: "#f87171", justifyContent: "center", fontSize: 13, padding: "10px" }}
                onClick={() => onAction(order.id, "reject")}>
                <Ban size={14} /> Reject
              </button>
            </div>
          )}
          {order.status === "approved" && (
            <div style={{ display: "flex", gap: 7 }}>
              <button style={{ flex: 1, ...S.actionBtn, background: "rgba(34,197,94,.1)", borderColor: "rgba(34,197,94,.25)", color: "#4ade80", justifyContent: "center", fontSize: 13, padding: "10px" }}
                onClick={() => setShowDeliver(true)}>
                <Send size={14} /> Deliver
              </button>
              <button style={{ flex: 1, ...S.actionBtn, background: "rgba(249,115,22,.07)", borderColor: "rgba(249,115,22,.2)", color: "#fb923c", justifyContent: "center", fontSize: 13, padding: "10px" }}
                onClick={() => setShowFail(true)}>
                <AlertTriangle size={14} /> Mark Failed
              </button>
            </div>
          )}
          {["delivered", "rejected", "failed", "expired"].includes(order.status) && (
            <div style={{ textAlign: "center", color: "#475569", fontSize: 12 }}>No actions available for this order.</div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

function Row({ k, v, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>{k}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: accent || "white" }}>{v}</span>
    </div>
  );
}

// ─── PAIR ROW ─────────────────────────────────────────────────
const pairFee = (p) => {
  const methods = p.receiver_methods || [];
  if (!methods.length) return null;
  const sum = methods.reduce((s, m) => s + (Number(m.fee_percent) || 0), 0);
  return sum / methods.length;
};

function PairRow({ p, selected, onClick, showOwner }) {
  const fee = pairFee(p);
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 16px", borderRadius: 9, cursor: "pointer",
        border: `1px solid ${selected ? "rgba(59,130,246,.3)" : "transparent"}`,
        background: selected ? "rgba(59,130,246,.08)" : "transparent",
        transition: "all .15s", marginBottom: 3,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.is_active ? "#22c55e" : "#374151", flexShrink: 0, boxShadow: p.is_active ? "0 0 6px rgba(34,197,94,.4)" : "none" }} />

      {/* left: pair + admin */}
      <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: selected ? "white" : "#94a3b8",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {p.from_currency?.symbol} → {p.to_currency?.symbol}
        </div>
        {showOwner && p.admin_id != null && (
          <span style={{
            display: "inline-block", marginTop: 2,
            fontSize: 10, fontWeight: 700, color: "#a78bfa",
            background: "rgba(139,92,246,.12)", border: "1px solid rgba(139,92,246,.25)",
            borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap",
            maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {p.admin_username || `#${p.admin_id}`}
          </span>
        )}
      </div>

      {/* right: rate + fee */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, textAlign: "right" }}>
        <span style={{ fontSize: 14, color: p.is_active ? "#3b82f6" : "#374151", fontWeight: 700, whiteSpace: "nowrap" }}>
          {p.is_active ? fmt(p.rate, 4) : "—"}
        </span>
        <span style={{ fontSize: 11, color: "#5f728eff", whiteSpace: "nowrap", marginTop: 1 }}>
          Fee {fee != null ? fmt(fee, 2) : "—"}%
        </span>
      </div>
    </div>
  );
}

// ─── PAIR DETAIL PANEL ────────────────────────────────────────
function PairDetail({ pair, readOnly, onEdit, onToggle, onDelete, onRateUpdate }) {
  const [localRate, setLocalRate] = useState(pair.rate ?? "");
  useEffect(() => setLocalRate(pair.rate ?? ""), [pair.id]);

  const reqFields = pair.sender_fields || pair.required_fields || {};
  const receiverMethods = pair.receiver_methods || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px 15px", borderBottom: "1px solid rgba(255,255,255,.05)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: pair.is_active ? "#22c55e" : "#ef4444" }} />
          <span style={{ color: "white", fontWeight: 800, fontSize: 15, flex: 1 }}>{pair.from_currency?.symbol} → {pair.to_currency?.symbol}</span>
          <span style={{ background: pair.is_active ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", border: `1px solid ${pair.is_active ? "rgba(34,197,94,.22)" : "rgba(239,68,68,.22)"}`, color: pair.is_active ? "#4ade80" : "#f87171", borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 700 }}>
            {pair.is_active ? "LIVE" : "OFF"}
          </span>
        </div>
        {pair.admin_username && (
          <div style={{ marginTop: 6, fontSize: 11, color: "#a78bfa" }}>Owner: {pair.admin_username} (#{pair.admin_id})</div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "13px 15px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* rate hero */}
        <div style={{ background: "#040a14", border: "1px solid rgba(59,130,246,.15)", borderRadius: 11, padding: 12 }}>
          <div style={{ fontSize: 10, color: "#3b82f6", fontWeight: 700, letterSpacing: ".07em", marginBottom: 4 }}>RATE</div>
          <div style={{ fontSize: 22, color: "white", fontWeight: 900 }}>{fmt(pair.rate, 6)}</div>
        </div>

        {/* stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            ["Min",     fmt(pair.min_amount)],
            ["Max",     pair.max_amount ? fmt(pair.max_amount) : "∞"],
            ["Timeout", `${pair.timeout_minutes}m`],
          ].map(([k, v]) => (
            <div key={k} style={{ background: "#040a14", border: "1px solid rgba(255,255,255,.06)", borderRadius: 9, padding: "9px 10px" }}>
              <div style={{ fontSize: 12, color: "#7c8696ff", marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 14, color: "white", fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* quick rate */}
        {!readOnly && (
          <div>
            <div style={{ fontSize: 10, color: "#7c8696ff", fontWeight: 700, letterSpacing: ".07em", margin: "10px 0 8px 0" }}>QUICK RATE UPDATE</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" value={localRate} onChange={e => setLocalRate(e.target.value)} style={{ ...S.input, flex: 1, padding: "7px 10px", fontSize: 12 }} placeholder="New rate..." />
              <button onClick={() => onRateUpdate(pair.id, localRate)} style={{ background: "rgba(59,130,246,.18)", border: "1px solid rgba(59,130,246,.35)", borderRadius: 8, padding: "7px 12px", color: "#93c5fd", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Save size={13} />Save
              </button>
            </div>
          </div>
        )}

        {/* required fields preview */}
        {Object.keys(reqFields).length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "#7c8696ff", fontWeight: 700, letterSpacing: ".07em", margin: "10px 0 6px 0" }}>REQUIRED FIELDS ({Object.keys(reqFields).length})</div>
            {Object.entries(reqFields).map(([k, v]) => (
              <div key={k} style={{ fontSize: 12, color: "#94a3b8", padding: "3px 0" }}>• {v.label} ({v.required ? "required" : "optional"})</div>
            ))}
          </div>
        )}

        {receiverMethods.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "#7c8696ff", fontWeight: 700, letterSpacing: ".07em", margin: "10px 0 6px 0" }}>PAYMENT METHODS ({receiverMethods.length})</div>
            {receiverMethods.map((m) => (
              <div key={m.key} style={{ fontSize: 12, color: "#94a3b8", padding: "3px 0" }}>
                • {m.label} · Fee {Number(m.fee_percent || 0)}%{m.note ? " — has instruction note" : ""}
              </div>
            ))}
          </div>
        )}
      </div>

      {!readOnly ? (
        <div style={{ padding: "11px 15px", borderTop: "1px solid rgba(255,255,255,.05)", display: "flex", gap: 6, flexShrink: 0 }}>
          <button style={{ flex: 1, ...S.actionBtn, background: "rgba(59,130,246,.1)", borderColor: "rgba(59,130,246,.22)", color: "#60a5fa" }} onClick={() => onEdit(pair)}>
            <Edit3 size={11} />Edit
          </button>
          <button style={{ flex: 1, ...S.actionBtn, background: pair.is_active ? "rgba(239,68,68,.08)" : "rgba(34,197,94,.08)", borderColor: pair.is_active ? "rgba(239,68,68,.2)" : "rgba(34,197,94,.2)", color: pair.is_active ? "#f87171" : "#4ade80" }} onClick={() => onToggle(pair)}>
            {pair.is_active ? <><PowerOff size={11} />Disable</> : <><Power size={11} />Enable</>}
          </button>
          <button style={{ ...S.actionBtn, background: "rgba(239,68,68,.07)", borderColor: "rgba(239,68,68,.15)", color: "#ef4444", padding: "8px 10px" }} onClick={() => onDelete(pair.id)}>
            <Trash2 size={12} />
          </button>
        </div>
      ) : (
        <div style={{ padding: "11px 15px", borderTop: "1px solid rgba(255,255,255,.05)", fontSize: 11, color: "#64748b", textAlign: "center", flexShrink: 0 }}>
          View only — owned by another admin
        </div>
      )}
    </div>
  );
}

// ─── ORDERS TABLE ─────────────────────────────────────────────
function OrdersTable({ orders, onSelectOrder, loading, showOwner }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
        {loading ? (
          <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>Loading…</div>
        ) : orders.length === 0 ? (
          <div style={{ color: "#475569", textAlign: "center", paddingTop: 40 }}>No orders found.</div>
        ) : orders.map(o => {
          const inputData = o.input_data || {};
          const fieldEntries = Object.entries(inputData);
          return (
          <div key={o.id} onClick={() => onSelectOrder(o)}
            style={{ background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.055)", borderRadius: 11, padding: "12px 14px", marginBottom: 7, cursor: "pointer", transition: "all .15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(59,130,246,.3)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,.055)"}>
            {/* header: id/user — status */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: "#475569", fontSize: 11 }}>#{o.id}</span>
                <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{o.username}</span>
                {o.payment_method_label && (
                  <span style={{ fontSize: 10, color: "#86efac", background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.25)", borderRadius: 999, padding: "2px 7px" }}>
                    {o.payment_method_label}
                  </span>
                )}
                {showOwner && o.admin_id != null && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", background: "rgba(139,92,246,.12)", border: "1px solid rgba(139,92,246,.22)", borderRadius: 999, padding: "2px 7px" }}>
                    {o.admin_username || `#${o.admin_id}`}
                  </span>
                )}
              </div>
              <StatusBadge status={o.status} />
            </div>

            {/* price row: amount conversion — rate & fee */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: fieldEntries.length ? 8 : 0 }}>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>
                {fmt(o.from_amount)} {o.from_currency?.symbol} → {fmt(o.to_amount)} {o.to_currency?.symbol}
              </span>
              <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>
                Rate {fmt(o.locked_rate, 4)} · Fee {o.locked_fee_percent ?? "—"}%
              </span>
            </div>

            {/* middle: user-submitted required fields */}
            {fieldEntries.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                {fieldEntries.slice(0, 4).map(([k, v]) => {
                  const val = String(v ?? "");
                  return (
                    <span key={k} style={{ fontSize: 10, color: "#94a3b8", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 6, padding: "2px 7px" }}>
                      <span style={{ color: "#475569", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}: </span>
                      {val.length > 18 ? `${val.slice(0, 18)}…` : val}
                    </span>
                  );
                })}
                {fieldEntries.length > 4 && (
                  <span style={{ fontSize: 10, color: "#475569", padding: "2px 4px" }}>+{fieldEntries.length - 4} more</span>
                )}
              </div>
            )}

            {/* footer: countdown / created date */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
              {o.status === "pending" && o.expires_at && <Countdown expiresAt={o.expires_at} />}
              <span style={{ color: "#475569", fontSize: 11 }}>{fmtDate(o.created_at)}</span>
            </div>
          </div>
        );})}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────
const emptyWireForm = () => ({
  from_currency_id: "", to_currency_id: "", rate: "",
  min_amount: 0, max_amount: "", timeout_minutes: 60,
  required_fields: {}, sender_fields: {}, receiver_methods: [],
  is_active: true,
});

export default function WireTransferDashboard() {
  const [pairs,       setPairs]       = useState([]);
  const [orders,      setOrders]      = useState([]);
  const [currencies,  setCurrencies]  = useState([]);
  const [selectedPair,setSelectedPair]= useState(null);
  const [selectedOrder,setSelectedOrder] = useState(null);
  const [pairsLoading, setPairsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // add-pair slide-in (mirrors Exchange Management)
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyWireForm());
  const [editPair, setEditPair] = useState(null);

  // pairs search
  const [pairSearch, setPairSearch] = useState("");

  // pair sort — single-click cyclic: none → asc → desc → none
  const [pairSortField, setPairSortField] = useState(null); // "rate" | "fee" | null
  const [pairSortDir,   setPairSortDir]   = useState(null); // "asc" | "desc" | null
  const togglePairSort = (field) => {
    if (pairSortField !== field) { setPairSortField(field); setPairSortDir("asc"); }
    else if (pairSortDir === "asc") { setPairSortDir("desc"); }
    else { setPairSortField(null); setPairSortDir(null); }
  };

  // cross-admin filter
  const [adminFilter, setAdminFilter] = useState("mine"); // "mine" | "all" | "<user_id>"
  const [filterAdmins, setFilterAdmins] = useState([]);
  const [canFilterAdmins, setCanFilterAdmins] = useState(false);

  /* ── UNIFIED HERO FILTERS — applied to Orders ── */
  const [unifiedSearch,       setUnifiedSearch]       = useState("");
  const [unifiedStatus,       setUnifiedStatus]       = useState("all");    // pending/approved/delivered/rejected/failed/expired
  const [unifiedFromCurrency, setUnifiedFromCurrency] = useState("all");    // from_currency symbol
  const [unifiedDateRange,    setUnifiedDateRange]    = useState([null, null]);
  const [unifiedStart, unifiedEnd] = unifiedDateRange;

  const currentUsername = localStorage.getItem("username") || "Me";
  const myId = String(localStorage.getItem("user_id") || "");
  const isMaster = localStorage.getItem("role") === "master";
  const canEditPair = (p) => isMaster || String(p.admin_id) === myId;

  // Pairs list: any admin with platform.transfer.service can browse other
  // admins' pairs (read-only). Orders/sweeps/analysis stay admin-own-only,
  // so their "owner" column/badges only make sense for master.
  const showPairOwner    = canFilterAdmins && adminFilter !== "mine";
  const showOwnerColumns = isMaster && adminFilter !== "mine";

  // fiat-only currencies for the pair selects
  const fiatCurrencies = useMemo(() => currencies.filter(isFiat), [currencies]);

  // ── fetch filter-admins (once) ──────────────────────────────
  const fetchFilterAdmins = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/admin/wire-transfer/filter-admins`, auth());
      setFilterAdmins((r.data || []).filter(a => a.username !== currentUsername));
      setCanFilterAdmins(true);
    } catch {
      setCanFilterAdmins(false);
      setFilterAdmins([]);
    }
  }, []);

  useEffect(() => { fetchFilterAdmins(); }, [fetchFilterAdmins]);

  // ── fetch ──────────────────────────────────────────────────
  const fetchPairs = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/admin/wire-transfer/pairs`, { ...auth(), params: { admin_filter: adminFilter } });
      setPairs(r.data);
      setPairsLoading(false);
    } catch { setPairsLoading(false); }
  }, [adminFilter]);

  const fetchOrders = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/admin/wire-transfer/orders`, { ...auth(), params: { admin_filter: isMaster ? adminFilter : "mine" } });
      setOrders(r.data);
      setOrdersLoading(false);
    } catch { setOrdersLoading(false); }
  }, [adminFilter, isMaster]);

  const fetchCurrencies = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/admin/currencies/`, auth());
      setCurrencies(r.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchPairs();
    fetchOrders();
    fetchCurrencies();
    // auto-refresh orders every 15s for countdown accuracy
    const id = setInterval(fetchOrders, 15000);
    return () => clearInterval(id);
  }, [fetchPairs, fetchOrders, fetchCurrencies]);

  useEffect(() => {
    if (selectedPair) {
      const fresh = pairs.find(p => p.id === selectedPair.id);
      if (fresh) setSelectedPair(fresh);
      else setSelectedPair(null);
    }
  }, [pairs]);

  // ── pair actions ───────────────────────────────────────────
  const savePair = async (form) => {
    try {
      const payload = {
        from_currency_id: Number(form.from_currency_id),
        to_currency_id:   Number(form.to_currency_id),
        rate:             Number(form.rate),
        min_amount:       Number(form.min_amount) || 0,
        max_amount:       form.max_amount ? Number(form.max_amount) : null,
        timeout_minutes:  Number(form.timeout_minutes) || 60,
        sender_fields:    form.sender_fields || form.required_fields || {},
        required_fields:  form.sender_fields || form.required_fields || {},
        receiver_methods: (form.receiver_methods || []).map((m) => ({
          key: m.key,
          label: m.label,
          fee_percent: Number(m.fee_percent) || 0,
          note: m.note || "",
          receiver_fields: m.receiver_fields || m.fields || {},
          fields: m.receiver_fields || m.fields || {},
          sender_fields: m.sender_fields || {},
        })),
        is_active:        form.is_active,
      };
      if (editPair) {
        await axios.put(`${API}/admin/wire-transfer/pairs/${editPair.id}`, payload, auth());
        showToast("Pair updated");
      } else {
        await axios.post(`${API}/admin/wire-transfer/pairs`, payload, auth());
        showToast("Pair created");
      }
      setAddForm(emptyWireForm());
      setAddOpen(false);
      setEditPair(null);
      await fetchPairs();
    } catch (e) {
      showToast(e?.response?.data?.detail || "Save failed", false);
    }
  };

  const togglePair = async (pair) => {
    try {
      await axios.put(`${API}/admin/wire-transfer/pairs/${pair.id}`, { is_active: !pair.is_active }, auth());
      showToast(pair.is_active ? "Pair disabled" : "Pair enabled");
      await fetchPairs();
      if (selectedPair?.id === pair.id) setSelectedPair(prev => ({ ...prev, is_active: !prev.is_active }));
    } catch { showToast("Toggle failed", false); }
  };

  const deletePair = async (pairId) => {
    if (!confirm("Delete this wire transfer pair?")) return;
    try {
      await axios.delete(`${API}/admin/wire-transfer/pairs/${pairId}`, auth());
      showToast("Pair deleted");
      if (selectedPair?.id === pairId) setSelectedPair(null);
      await fetchPairs();
    } catch { showToast("Delete failed", false); }
  };

  const updateRate = async (pairId, newRate) => {
    try {
      await axios.put(`${API}/admin/wire-transfer/pairs/${pairId}`, { rate: Number(newRate) }, auth());
      showToast("Rate updated");
      await fetchPairs();
      setSelectedPair(prev => prev?.id === pairId ? { ...prev, rate: Number(newRate) } : prev);
    } catch { showToast("Rate update failed", false); }
  };

  // ── order actions ──────────────────────────────────────────
  const handleOrderAction = async (orderId, action, extra = {}) => {
    try {
      const url = `${API}/admin/wire-transfer/orders/${orderId}/${action}`;
      // "fail" carries the admin-typed failure reason (also used for auto-expiry).
      // "deliver" carries the optional admin-typed delivery message.
      const payload =
        action === "fail"    ? { reason: extra.reason || "" } :
        action === "deliver" ? { message: extra.message || "" } :
        {};
      await axios.post(url, payload, auth());
      showToast(`Order ${action}ed`);
      await fetchOrders();
      // only close the sidebar if the order currently open is the one that was just actioned
      setSelectedOrder(prev => (prev && prev.id === orderId ? null : prev));
    } catch (e) {
      showToast(e?.response?.data?.detail || `${action} failed`, false);
    }
  };

  // ── select pair + refresh selected order data ──────────────
  const selectOrder = async (o) => {
    try {
      const r = await axios.get(`${API}/admin/wire-transfer/orders/${o.id}`, auth());
      setSelectedOrder(r.data);
    } catch {
      setSelectedOrder(o);
    }
  };

  const filteredPairs = useMemo(() => {
    const q = pairSearch.toLowerCase();
    let list = !q ? pairs : pairs.filter(p =>
      p.from_currency?.symbol?.toLowerCase().includes(q) ||
      p.to_currency?.symbol?.toLowerCase().includes(q) ||
      (showPairOwner && (p.admin_username?.toLowerCase().includes(q) || String(p.admin_id).includes(q)))
    );

    if (pairSortField && pairSortDir) {
      list = [...list].sort((a, b) => {
        const av = pairSortField === "rate" ? (Number(a.rate) || 0) : (pairFee(a) ?? 0);
        const bv = pairSortField === "rate" ? (Number(b.rate) || 0) : (pairFee(b) ?? 0);
        return pairSortDir === "asc" ? av - bv : bv - av;
      });
    }
    return list;
  }, [pairs, pairSearch, showPairOwner, pairSortField, pairSortDir]);

  // "From Currency" options — restricted to currencies that actually exist as a from_currency on a pair
  const currencyOptions = useMemo(() => {
    const seen = new Set();
    pairs.forEach(p => { const sym = p.from_currency?.symbol; if (sym) seen.add(sym); });
    return [...seen].sort().map(sym => ({ label: sym, value: sym }));
  }, [pairs]);

  const filteredOrders = useMemo(() => {
    const q = unifiedSearch.toLowerCase().trim();
    return orders.filter(o => {
      if (unifiedStatus !== "all" && o.status !== unifiedStatus) return false;
      if (unifiedFromCurrency !== "all" && o.from_currency?.symbol !== unifiedFromCurrency) return false;

      if (unifiedStart && new Date(o.created_at) < new Date(unifiedStart)) return false;
      if (unifiedEnd) {
        const end = new Date(unifiedEnd);
        end.setHours(23, 59, 59, 999);
        if (new Date(o.created_at) > end) return false;
      }

      if (q) {
        const hit =
          (o.username || "").toLowerCase().includes(q) ||
          String(o.id).includes(q) ||
          (showOwnerColumns && ((o.admin_username || "").toLowerCase().includes(q) || String(o.admin_id || "").includes(q)));
        if (!hit) return false;
      }
      return true;
    });
  }, [orders, unifiedSearch, unifiedStatus, unifiedFromCurrency, unifiedStart, unifiedEnd, showOwnerColumns]);

  const filteredActivePairs = useMemo(
    () => filteredPairs.filter(p => p.is_active).length,
    [filteredPairs]
  );

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

  // ── header stats (scoped to the filtered set) ─────────
  const activePairs = pairs.filter(p => p.is_active).length;
  
  // ── layout ─────────────────────────────────────────────────
  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100vh", 
      background: "#060d18", 
      color: "white", 
      fontFamily: "'Inter', sans-serif", 
      overflow: "hidden" }}>
      {/* edit modal only — Add now slides in from the sidebar */}
      {editPair && (
        <PairEditModal
          editPair={editPair}
          currencies={fiatCurrencies}
          onSave={savePair}
          onClose={() => setEditPair(null)}
        />
      )}

      {/* ── HERO HUB ── */}
      <div style={{ padding: "0 0 10px", flexShrink: 0 }}>
        <HeroHub
          title="Transfer Management"
          subtitle="Manage wire transfer pairs, rates and orders"
          search={{
            visible: true,
            value: unifiedSearch,
            onChange: setUnifiedSearch,
            placeholder: (showOwnerColumns || showPairOwner) ? "Search user, order ID or admin…" : "Search user or order ID…",
          }}
          dropdowns={[
            {
              key: "fromCurrency",
              label: "Currecny", 
              visible: true, 
              value: unifiedFromCurrency, onChange: setUnifiedFromCurrency,
              placeholder: "All",
              options: currencyOptions,
            },
            {
              key: "status",label: "Status", 
               visible: true, value: unifiedStatus, onChange: setUnifiedStatus,
              placeholder: "All",
              options: Object.entries(STATUS_CFG).map(([k, v]) => ({ label: v.label, value: k })),
            },
            canFilterAdmins && {
              key: "admin", label: "Admins", visible: true, value: adminFilter, onChange: setAdminFilter,
              placeholder: "My Rates",
              options: [
                { label: `${currentUsername}`, value: "mine" },
                { label: "All", value: "all" },
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
            { key: "pairs",  icon: GitCompare, label: "Total Pairs",  value: filteredActivePairs, accent: "#3b82f6", loading: pairsLoading },
            { key: "orders", icon: FileText,   label: "Total Orders", value: filteredOrders.length, accent: "#10b981", loading: ordersLoading },
            { key: "value",  icon: Wallet,     label: "Total Value",  value: totalValue, meta: totalValueCurrency, accent: "#22d3ee", loading: ordersLoading },
          ]}
          onRefresh={() => { fetchPairs(); fetchOrders(); }}
          refreshing={pairsLoading || ordersLoading}
        />
      </div>

      {/* ══ BODY ══ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── LEFT: Pairs sidebar + slide-in Add panel ── */}
        <div style={{ position: "relative", flexShrink: 0, display: "flex" }}>

          {/* pair list sidebar */}
          <div style={{
            width:380, 
              background:"#040a14",  borderRight: "1px solid rgba(255,255,255,.07)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            transition: "opacity .2s", opacity: addOpen ? .3 : 1, pointerEvents: addOpen ? "none" : "auto",
          }}>
            {/* sidebar header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px 10px", borderBottom: "1px solid rgba(255,255,255,.06)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Landmark size={16} color="#3b82f6" />
                <span style={{ color: "white", fontWeight: 700, fontSize: 16 }}>Pairs</span>
                <span style={{ background: "rgba(59,130,246,.12)", color: "#60a5fa", borderRadius: 20, padding: "1px 8px", fontSize: 12, fontWeight: 700 }}>{filteredPairs.length}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => setAddOpen(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(59,130,246,.14)", border: "1px solid rgba(59,130,246,.28)", color: "#93c5fd", borderRadius: 7, padding: "7px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  <Plus size={12} />Add
                </button>
              </div>
            </div>

            {/* sort (2 single-click cyclic buttons: none → asc → desc → none) */}
            <div style={{ padding: "7px 10px", borderBottom: "1px solid rgba(255,255,255,.04)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ field: "rate", label: "Rate" }, { field: "fee", label: "Fee" }].map(({ field, label }) => {
                  const active = pairSortField === field;
                  const arrow = active ? (pairSortDir === "asc" ? "↑" : "↓") : "";
                  return (
                    <button
                      key={field}
                      onClick={() => togglePairSort(field)}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                        background: active ? "rgba(59,130,246,.16)" : "#060c18",
                        border: `1px solid ${active ? "rgba(59,130,246,.4)" : "rgba(255,255,255,.07)"}`,
                        color: active ? "#60a5fa" : "#94a3b8",
                        borderRadius: 7, padding: "6px 0", fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      <ArrowUpDown size={11} />{label}{arrow && <span style={{ fontSize: 12 }}>{arrow}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
              {pairsLoading ? (
                [...Array(5)].map((_, i) => <div key={i} style={{ padding: "9px 11px", marginBottom: 3 }}><Sk h={14} /></div>)
              ) : filteredPairs.length === 0 ? (
                <div style={{ color: "#475569", textAlign: "center", paddingTop: 30, fontSize: 12 }}>No pairs found.</div>
              ) : filteredPairs.map(p => (
                <PairRow key={p.id} p={p} selected={selectedPair?.id === p.id} showOwner={showPairOwner} onClick={() => setSelectedPair(prev => (prev?.id === p.id ? null : p))} />
              ))}
            </div>
          </div>

          {/* ADD PAIR SLIDE-IN — slides over sidebar from the left */}
          <div style={{
            position: "absolute", top: 0, left: 0, bottom: 0, width: addOpen ? 380 : 0,
            overflow: "hidden", zIndex: 20,
            transition: "width .32s cubic-bezier(.4,0,.2,1)",
            background: "#06101e",
            borderRight: `1px solid ${addOpen ? "rgba(59,130,246,.22)" : "transparent"}`,
            display: "flex", flexDirection: "column",
            boxShadow: addOpen ? "6px 0 28px rgba(0,0,0,.5)" : "none",
          }}>
            <div style={{ minWidth: 300, height: "100%", display: "flex", flexDirection: "column" }}>
              {/* add header */}
              <div style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Plus size={15} color="#60a5fa" />
                </div>
                <span style={{ color: "white", fontWeight: 700, fontSize: 18, flex: 1, whiteSpace: "nowrap" }}>Add new pair</span>
                <button onClick={() => setAddOpen(false)} style={S.closeIconBtn}><X size={16} /></button>
              </div>

              {/* form */}
              <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
                <WirePairForm
                  data={addForm} setData={setAddForm}
                  onSubmit={() => savePair(addForm)}
                  submitLabel="Create pair"
                  onCancel={() => setAddOpen(false)}
                  currencies={fiatCurrencies}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── MIDDLE: Pair Detail ── */}
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
            <PairDetail
              pair={selectedPair}
              readOnly={!canEditPair(selectedPair)}
              onEdit={p => setEditPair(p)}
              onToggle={togglePair}
              onDelete={deletePair}
              onRateUpdate={updateRate}
            />
          ) }
        </div>

        {/* ── RIGHT: Orders Table ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.28)",
                color: "#93c5fd", borderRadius: 9, padding: "7px 14px", fontWeight: 700, fontSize: 12.5,
              }}>
                <FileText size={13} />Orders
                <span style={{ background: "rgba(59,130,246,.18)", borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>
                  {filteredOrders.length}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#475569" }}>click any row to view & action</div>
            </div>
           
          </div>
          <OrdersTable orders={filteredOrders} onSelectOrder={selectOrder} loading={ordersLoading} showOwner={showOwnerColumns} />
        </div>

        {/* ── ORDER SIDEBAR ── */}
        {selectedOrder && (
          <WireSidebar
            order={selectedOrder}
            onAction={handleOrderAction}
            onClose={() => setSelectedOrder(null)}
            showOwner={showOwnerColumns}
          />
        )}
      </div>

      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes skpulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        @keyframes spin { to{transform:rotate(360deg)} }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 4px; }
        select option { background: #0d1424; color: white; }
      `}</style>
    </div>
  );
}