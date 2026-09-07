import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Upload, Plus, Layers, RefreshCcw, Edit3, Trash2, Power, PowerOff, Package,
  X, Tag, Grid3X3, Clock, CheckCircle, XCircle,ShieldCheck,
  AlertTriangle, DollarSign, Percent, ArrowUpDown, User,
  CheckCircle2, Store, Star, BarChart3, FileText, SlidersHorizontal, Wallet,
} from "lucide-react";
import { API_URL } from "../config";
import { hasPermission } from "../utils/permissions";
import API from "../api/client";
import HeroHub from "../components/HeroHub";
import OrderSidebar from "../components/OrderSidebar";
import UserSidebar from "../components/UserSidebar";
import OrderAnalysisPanel from "../components/OrderAnalysisPanel";
import "./ProductsManagement.css";

const COMMON_FIELDS = [
  { key: "username", label: "Username", type: "text", step: "before_order" },
  { key: "password", label: "Password", type: "password", step: "before_order" },
  { key: "email", label: "Email", type: "email", step: "before_order" },
  { key: "phone_number", label: "Phone Number", type: "text", step: "before_order" },
  { key: "verification_code", label: "Verification Code", type: "text", step: "after_login" },
  { key: "two_fa_code", label: "2FA Code", type: "text", step: "after_login" },
  { key: "security_question", label: "Security Question", type: "text", step: "before_order" },
  { key: "account_id", label: "Account ID", type: "text", step: "before_order" },
  { key: "character_name", label: "Character Name", type: "text", step: "before_order" },
  { key: "player_id", label: "Player ID", type: "text", step: "before_order" },
  { key: "server", label: "Server", type: "text", step: "before_order" },
  { key: "region", label: "Region", type: "text", step: "before_order" },
];

// Add these constants near the top of the file (alongside COMMON_FIELDS)
const FIELD_TYPES = [
  { value: "text",     label: "Text" },
  { value: "password", label: "Password" },
  { value: "email",    label: "Email" },
  { value: "number",   label: "Number" },
  { value: "phone",    label: "Phone" },
  { value: "textarea", label: "Textarea" },
  { value: "url",      label: "URL" },
];

const FIELD_STEPS = [
  { value: "before_order", label: "Before Order" },
  { value: "after_login",  label: "After Login" },
];

// ── TOGGLE ────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, label, color = "#3b82f6" }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
    <div
      onClick={() => onChange(!checked)}
      style={{
        position: "relative", width: 44, height: 24, borderRadius: 12,
        background: checked ? color : "#1e293b",
        border: `1px solid ${checked ? color : "#334155"}`,
        transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
        cursor: "pointer", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 2, left: checked ? 22 : 2,
        width: 18, height: 18, borderRadius: "50%",
        background: checked ? "white" : "#475569",
        transition: "left 0.25s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: checked ? "0 2px 6px rgba(0,0,0,0.4)" : "none",
      }} />
    </div>
    {label && <span style={{ color: checked ? "#e2e8f0" : "#64748b", fontSize: 13, fontWeight: 500, transition: "color 0.2s" }}>{label}</span>}
  </label>
);

// ── FIELD ─────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <label style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</label>
    {children}
  </div>
);

// ── SKELETON ──────────────────────────────────────────────────
function Sk({ w = "100%", h = 16, r = 6 }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#151f30 25%,#1e2d44 50%,#151f30 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
  );
}

// ── STAT PILL ─────────────────────────────────────────────────
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

// ── ORDERS: status config / row (merged from OrdersManagement) ─
const STATUS_CFG = {
  pending:   { color: "#fbbf24", bg: "#f59e0b22", icon: Clock,        label: "PENDING" },
  approved:  { color: "#34d399", bg: "#10b98122", icon: CheckCircle2, label: "APPROVED" },
  delivered: { color: "#60a5fa", bg: "#3b82f622", icon: CheckCircle,  label: "DELIVERED" },
  rejected:  { color: "#f87171", bg: "#ef444422", icon: XCircle,      label: "REJECTED" },
  failed:    { color: "#fb923c", bg: "#f9731622", icon: AlertTriangle,label: "FAILED" },
};

function StatusEvent({ icon: Icon, color, label, at, by, formatDate }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 90 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
        <Icon size={10} />{label}
      </span>
      <span style={{ fontSize: 11, color: "#cbd5e1aa", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        by {by || "—"}
      </span>
      {at && <span style={{ fontSize: 10, color: "#475569" }}>{formatDate(at)}</span>}
    </div>
  );
}

function OrderRow({ o, selected, onClick, formatDate }) {
  const cfg = STATUS_CFG[o.status] || STATUS_CFG.pending;
  const StatusIcon = cfg.icon;
  const hasDiscount = o.discount_percent && Number(o.discount_percent) > 0 && o.original_price;

  const statusEvents = [
    (o.approved_at || o.approved_by) && { key: "approved", icon: CheckCircle2, color: "#34d399", label: "Approved", at: o.approved_at, by: o.approved_by },
    (o.rejected_at || o.rejected_by) && { key: "rejected", icon: XCircle, color: "#f87171", label: "Rejected", at: o.rejected_at, by: o.rejected_by },
    (o.delivered_at || o.delivered_by) && { key: "delivered", icon: CheckCircle, color: "#60a5fa", label: "Delivered", at: o.delivered_at, by: o.delivered_by },
    (o.failed_at || o.failed_by) && { key: "failed", icon: AlertTriangle, color: "#fb923c", label: "Failed", at: o.failed_at, by: o.failed_by },
  ].filter(Boolean);

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "#172554" : "#0b1424",
        border: `1px solid ${selected ? "#3b82f6" : "#1e293b"}`,
        borderRadius: 10, padding: "10px 16px", cursor: "pointer",
        display: "grid",
        gridTemplateColumns: "0.3fr 0.5fr 0.5fr 0.5fr 1fr 1fr 100px 0.5fr minmax(60px,1fr)",
        alignItems: "center", gap: 18, transition: "border-color .15s, background .15s",
      }}
    >
      <span style={{ color: "#475569", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>#{o.id}</span>

      <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
        <User size={12} color="#64748b" style={{ flexShrink: 0 }} />
        <span style={{ color: "white", fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.username}</span>
      </div>

      <div style={{ minWidth: 0, display: "flex", alignItems: "center", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
          <span style={{ color: "white", fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.product_name}</span>
          {o.is_featured && <Star size={11} color="#fbbf24" style={{ flexShrink: 0 }} />}
        </div>
        <div>
          {o.plan && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, background: "#1e293b", padding: "3px 9px", borderRadius: 999, fontSize: 11, textTransform: "capitalize", color: "#cbd5e1", whiteSpace: "nowrap", marginTop: 3 }}>
              <Layers size={10} />{o.plan}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, background: "#1e293b", padding: "3px 9px", borderRadius: 999, fontSize: 11, textTransform: "capitalize", color: "#cbd5e1", whiteSpace: "nowrap" }}>
          <Tag size={10} />{o.product_type || "-"}
        </span>
      </div>

      <div style={{ textAlign: "center" }}>
        {hasDiscount && (
          <div style={{ fontSize: 11, color: "#64748b", textDecoration: "line-through" }}>
            {parseFloat(o.original_price).toFixed(2)} <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 700, marginLeft: 5 }}>-{Number(o.discount_percent)}%</span>
          </div>
        )}
        <div>
          <span style={{ fontSize: 14, fontWeight: 800, color: hasDiscount ? "#4ade80" : "#e2e8f0" }}>{parseFloat(o.price).toFixed(2)}</span>{" "}
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{o.currency}</span>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>Owner</div>
        {o.product_owner_displayName ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#a78bfa", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <Store size={11} />{o.product_owner_displayName}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "#475569" }}>—</span>
        )}
      </div>

      <span style={{
        display: "flex", alignItems: "center", gap: 5, justifyContent: "center",
        background: cfg.bg, color: cfg.color, padding: "4px 0", borderRadius: 999, fontSize: 10, fontWeight: 700,
      }}>
        <StatusIcon size={11} />{cfg.label}
      </span>

      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>Created</div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>{formatDate(o.created_at)}</div>
      </div>

      <div style={{ display: "flex", gap: 16, overflowX: "auto", justifyContent: "flex-end", minWidth: 0 }}>
        {statusEvents.length > 0
          ? statusEvents.map((ev) => <StatusEvent key={ev.key} {...ev} formatDate={formatDate} />)
          : <span style={{ fontSize: 11, color: "#334155" }}>—</span>
        }
      </div>
    </div>
  );
}

// ── APPROVE MODAL ─────────────────────────────────────────────
const ApproveModal = ({ product, onConfirm, onClose }) => {
  const [commission, setCommission] = useState(product?.system_commision ?? "");
  const [reward, setReward] = useState(product?.system_reward_percent ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (commission === "" || reward === "") { setError("Both fields are required."); return; }
    setLoading(true);
    await onConfirm(product.id, Number(commission), Number(reward));
    setLoading(false);
    onClose();
  };

  return (
    <div className="pm-modalOverlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pm-modalCard" style={{ maxWidth: 420, height: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={18} /> Approve Product
            </div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>{product?.name}</div>
          </div>
          <button className="pm-closeIconBtn" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle size={14} color="#eab308" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ color: "#a3935a", fontSize: 12, lineHeight: 1.5 }}>
            You must define the system commission and reward percent before approving. These can only be changed by master.
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="System Commission (fixed amount)">
            <div style={{ position: "relative" }}>
              <DollarSign size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
              <input
                type="number"
                className="pm-input" style={{ paddingLeft: 30 }}
                placeholder="e.g. 1.5"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
              />
            </div>
          </Field>
          <Field label="System Reward Percent (%)">
            <div style={{ position: "relative" }}>
              <Percent size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
              <input
                type="number"
                className="pm-input" style={{ paddingLeft: 30 }}
                placeholder="e.g. 5.00"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
              />
            </div>
          </Field>

          {error && <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>{error}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="pm-cancelBtn" onClick={onClose}>Cancel</button>
            <button
              className="pm-submitBtn" style={{ background: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.3)", color: "#22c55e" }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Approving…" : "✓ Confirm Approval"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── REJECT MODAL ──────────────────────────────────────────────
const RejectModal = ({ product, onConfirm, onClose }) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    await onConfirm(product.id, reason);
    setLoading(false);
    onClose();
  };

  return (
    <div className="pm-modalOverlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pm-modalCard" style={{ maxWidth: 400, height: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <XCircle size={18} /> Reject Product
            </div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>{product?.name}</div>
          </div>
          <button className="pm-closeIconBtn" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Rejection Reason (optional)">
            <textarea
              className="pm-textarea" style={{ minHeight: 90 }}
              placeholder="Explain why this product is being rejected…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pm-cancelBtn" onClick={onClose}>Cancel</button>
            <button
              className="pm-submitBtn" style={{ background: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.3)", color: "#ef4444" }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Rejecting…" : "✗ Confirm Rejection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── PRODUCT FORM ──────────────────────────────────────────────
const ProductForm = ({ 
  users = [],
  data, 
  setData, 
  onSubmit, 
  submitLabel, 
  onCancel, 
  token, 
  featureInput, 
  setFeatureInput, 
  categories, 
  currencies, 
  networks,
  isMaster  }) => {

  const [tab, setTab] = useState("basics");
  const [customField, setCustomField] = useState({
    label: "",
    key: "",
    type: "text",
    step: "before_order",
    required: true,
  });



  const selectedCurrency = currencies.find((c) => (c.symbol || c.code || c.name) === data.currency);
  const isCrypto = selectedCurrency?.type === "crypto" || !selectedCurrency;
  

  const handleCurrencyChange = (e) => {
    const val = e.target.value;
    const cur = currencies.find((c) => (c.symbol || c.code || c.name) === val);
    setData({ ...data, currency: val, network: cur?.type === "crypto" ? data.network : "" });
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_URL}/admin/products/upload-product-icon`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const json = await res.json();
    setData((prev) => ({ ...prev, icon_path: json.path }));
  };

    // helpers
  const requiredData = data.required_user_data || {};

  const hasRequiredFields = Object.keys(requiredData).length > 0;

  const updateRequiredData = (newData) => {
    setData({ ...data, required_user_data: newData });
  };

  const toggleRequiredRoot = (checked) => {
    if (!checked) {
      updateRequiredData({});
    } else {
      // Seed with a placeholder so Object.keys().length > 0 and the section reveals
      updateRequiredData({ _placeholder: { label: "", type: "text", required: true, step: "before_order" } });
    }
  };

  const toggleCommonField = (field) => {
    const updated = { ...requiredData };
    delete updated._placeholder; // remove placeholder if present

    if (updated[field.key]) {
      delete updated[field.key];
    } else {
      updated[field.key] = {
        label: field.label,
        type: field.type,
        required: true,
        step: field.step,
      };
    }
    updateRequiredData(Object.keys(updated).length ? updated : {});
  };

  const addCustomField = () => {
    if (!customField.key || !customField.label) return;
    const updated = { ...requiredData };
    delete updated._placeholder; // clean up placeholder
    updated[customField.key] = {
      label: customField.label,
      type: customField.type,
      required: customField.required,
      step: customField.step,
    };
    updateRequiredData(updated);
    setCustomField({ label: "", key: "", type: "text", step: "before_order", required: true });
  };


  const tabs = ["basics", "pricing", "details", "extra"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {["Subscription", "VPN", "Gift Cards", "Premium Account", "Service"].map((t) => (
          <button key={t} onClick={() => setData({ ...data, product_type: t })}
            style={{
              padding: "6px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: 600, border: "1px solid",
              background: data.product_type === t ? "rgba(59,130,246,0.2)" : "transparent",
              borderColor: data.product_type === t ? "#3b82f6" : "#313d58ff",
              color: data.product_type === t ? "#60a5fa" : "#5f6e83ff",
              transition: "all 0.15s",
            }}>{t}</button>
        ))}
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #313d5862", marginBottom: 20, gap: 0 }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "9px 16px", cursor: "pointer", fontSize: 12, borderRadius: "8px 8px 2px 2px",
            background: tab === t ? "rgba(59,130,246,0.2)" : "transparent",
            borderColor: tab === t ? "#3b82f6" : "#26324a",
            color: tab === t ? "#60a5fa" : "#7b86a0ff",
            borderBottom: tab === t ? "2px solid #3b82f6" : "2px solid transparent",
            fontWeight: tab === t ? 700 : 500,
            marginBottom: -1, transition: "all 0.15s", letterSpacing: "0.04em", textTransform: "capitalize",
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "basics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Product Name">
                <input className="pm-input" placeholder="Netflix Premium" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
              </Field>
              <Field label="Plan">
                <input className="pm-input" placeholder="1 Month" value={data.plan} onChange={(e) => setData({ ...data, plan: e.target.value })} />
              </Field>
            </div>
            <Field label="Description">
              <textarea className="pm-textarea" placeholder="Short description..." value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Category">
              <select className="pm-input" value={data.category_id} onChange={(e) => setData({ ...data, category_id: e.target.value })}>
                {[{ id: "__none__", name: "Select…" }, ...categories].map((c) => (
                  <option key={c.id} value={c.id === "__none__" ? "" : c.id}>{c.name}</option>
                ))}
              </select>
              </Field>
              <Field label="Stock">
                <input type="number" className="pm-input" value={data.stock} onChange={(e) => setData({ ...data, stock: e.target.value })} />
              </Field>
              <Field label="Product Owner">
            <select className="pm-input" value={data.admin_id || ""} onChange={(e) => setData({ ...data, admin_id: e.target.value ? Number(e.target.value) : null })}>
              {[{ user_id: "", username: "", display: "Select Owner" }, ...users].map((u) => (
                <option key={u.user_id || "owner-default"} value={u.user_id}>{u.display ?? u.username}</option>
              ))}
            </select>
            </Field>
            </div>
            <Field label="Product Icon">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #313d58", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#60a5fa" }}>
                  <Upload size={16} />
                  <input type="file" accept="image/*" onChange={handleIconUpload} style={{ display: "none" }} />
                </label>
                {data.icon_path && (
                  <img src={`${API_URL}${data.icon_path}`} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", border: "1px solid #313d58" }} />
                )}
              </div>
            </Field>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px", background: "#050a1405", borderRadius: 12, marginTop: 8 }}>
              <Toggle checked={data.is_active} onChange={(v) => setData({ ...data, is_active: v })} label="Active" color="#22c55e" />
              <Toggle checked={data.is_featured} onChange={(v) => setData({ ...data, is_featured: v })} label="Featured" color="#eab308" />
              <Toggle checked={data.is_recurring} onChange={(v) => setData({ ...data, is_recurring: v })} label="Recurring" color="#8b5cf6" />
            </div>
          </div>
        )}

        {tab === "pricing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Currency">
                <select className="pm-input" value={data.currency} onChange={handleCurrencyChange}>
                  {currencies.map((c) => <option key={c.id} value={c.symbol || c.code || c.name}>{c.symbol || c.code || c.name}</option>)}
                </select>
              </Field>
              {isCrypto && (
                <Field label="Network">
                  <select className="pm-input" value={data.network} onChange={(e) => setData({ ...data, network: e.target.value })}>
                    {networks.map((n) => <option key={n.id} value={n.name}>{n.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Price">
                <input type="number" className="pm-input" value={data.price} onChange={(e) => setData({ ...data, price: e.target.value })} />
              </Field>
              <Field label="Discount (%)">
                <input type="number" className="pm-input" value={data.discount_percent} onChange={(e) => setData({ ...data, discount_percent: e.target.value })} />
              </Field>

            </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: "160px" }}>           
              <Field label="System Commission">
              <input
                type="number"
                className="pm-input"
                style={{
                  opacity: isMaster ? 1 : 0.6,
                  cursor: isMaster  ? "text" : "not-allowed"
                }}
                value={data.system_commision || ""}
                disabled={!isMaster }
                placeholder="e.g. 1.5"
                onChange={(e) =>
                  setData({ ...data, system_commision: e.target.value })
                }
              />
            {!isMaster && (
              <span style={{ fontSize: 11, color: "#eab308" }}>
                Permission Required
              </span>
            )}
            </Field>


            <Field label="System Reward Percent (%)">
              <input
                type="number"
                className="pm-input"
                style={{
                  opacity: isMaster? 1 : 0.6,
                  cursor: isMaster ? "text" : "not-allowed"
                }}
                value={data.system_reward_percent || ""}
                disabled={!isMaster}
                placeholder="e.g. 5"
                onChange={(e) =>
                  setData({ ...data, system_reward_percent: e.target.value })
                }
              />
                {!isMaster && (
                <span style={{ fontSize: 11, color: "#eab308" }}>
                  Permission Required
                </span>
              )}
            </Field>
             </div>
          </div>
        )}

        {tab === "details" && (

             <div style={{ display: "flex", flexDirection: "column", gap: 14 }}> 
            <div style={{ color: "#6a747fff", fontSize: 12, fontWeight: 600, marginBottom: 20 }}>Validity inputs (can be left empty):</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="Days"><input type="number" className="pm-input" placeholder="30" value={data.validity_days} onChange={(e) => setData({ ...data, validity_days: e.target.value })} /></Field>
              <Field label="Hours"><input type="number" className="pm-input" placeholder="48" value={data.validity_hours} onChange={(e) => setData({ ...data, validity_hours: e.target.value })} /></Field>
              <Field label="Volume (GB)"><input type="number" className="pm-input" placeholder="10" value={data.data_volume_gb} onChange={(e) => setData({ ...data, data_volume_gb: e.target.value })} /></Field>
            </div>

              {/* ================= REQUIRED USER DATA (NEW) ================= */}
              <div style={{
                padding: 16,
                border: "1px solid #313d58bc",
                borderRadius: 14,
                background: "#0b1424",
                minHeight: 80,
              }}>

              <div style={{ color: "white", fontWeight: 700, fontSize: 13, marginBottom: 12, letterSpacing: "0.02em" }}>
                Required User Information
              </div>

            
            <div style={{ marginBottom: 14 }}>
              <Toggle
                checked={hasRequiredFields}
                onChange={(v) => toggleRequiredRoot(v)}
                label="This product requires customer information"
                color="#3b82f6"
              />
            </div>

              {hasRequiredFields && (
                <>
                  {/* COMMON FIELDS */}
                  <div style={{ marginBottom: 14 }}>
                  <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                    Common Fields
                  </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {COMMON_FIELDS.map((f) => {
                        const active = !!requiredData[f.key];
                        return (
                        <button
                          key={f.key}
                          onClick={() => toggleCommonField(f)}
                          className="pm-chip"
                          style={{
                            background: active ? "rgba(59,130,246,0.2)" : "#0b1525",
                            borderColor: active ? "#3b82f6" : "#313d58ff",
                            color: active ? "#60a5fa" : "#94a3b8",
                            cursor: "pointer",
                          }}
                        >
                          {active ? "☑" : "☐"} {f.label}
                        </button>
                        );
                      })}
                    </div>
                  </div>

                {/* Custom Fields */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                    Custom Fields
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input
                      placeholder="Label"
                      value={customField.label}
                      onChange={(e) => setCustomField({ ...customField, label: e.target.value })}
                      className="pm-input"
                    />
                    <input
                      placeholder="Key (no spaces)"
                      value={customField.key}
                      onChange={(e) => setCustomField({ ...customField, key: e.target.value.replace(/\s/g, "_") })}
                      className="pm-input"
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                    <select
                      value={customField.type}
                      onChange={(e) => setCustomField({ ...customField, type: e.target.value })}
                      className="pm-input"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <select
                      value={customField.step}
                      onChange={(e) => setCustomField({ ...customField, step: e.target.value })}
                      className="pm-input"
                    >
                        {FIELD_STEPS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={addCustomField}
                    className="pm-addFeatureBtn" style={{ marginTop: 10, padding: "9px 16px", borderRadius: 10 }}
                  >
                    + Add Custom Field
                  </button>
                </div>

                {/* Active fields summary (chips) */}
                {hasRequiredFields && (
                  <div>
                    <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                      Active Fields
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {Object.entries(requiredData)
                      .filter(([key]) => key !== "_placeholder")
                      .map(([key, val]) => (
                        <span key={key} className="pm-chip" onClick={() => {
                          const updated = { ...requiredData };
                          delete updated[key];
                          updateRequiredData(updated);
                        }}>
                          {val.label} <X size={10} style={{ marginLeft: 4, verticalAlign: "middle" }} />
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* JSON Preview */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                    Live Preview (JSON)
                  </div>
                  <pre style={{
                    fontSize: 11, background: "#060d1a",
                    border: "1px solid #313d58ff",
                    padding: 12, borderRadius: 10, overflowX: "auto",
                    color: "#60a5fa", margin: 0,
                  }}>
                    {JSON.stringify(
                      Object.fromEntries(Object.entries(requiredData).filter(([k]) => k !== "_placeholder")),
                      null, 2
                    )}
                  </pre>
                </div>
                </>
              )}
            </div>
          </div>
     
        )}

        {tab === "extra" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Provider"><input className="pm-input" placeholder="Netflix" value={data.extra_data?.provider || ""} onChange={(e) => setData({ ...data, extra_data: { ...data.extra_data, provider: e.target.value } })} /></Field>
              <Field label="Region"><input className="pm-input" placeholder="Worldwide" value={data.extra_data?.region || ""} onChange={(e) => setData({ ...data, extra_data: { ...data.extra_data, region: e.target.value } })} /></Field>
            </div>
            {data.id && (
              <Field label="Delivery"><input className="pm-input" placeholder="Instant" value={data.extra_data?.delivery || ""} onChange={(e) => setData({ ...data, extra_data: { ...data.extra_data, delivery: e.target.value } })} /></Field>
            )}
            <Field label="Features">
              <div style={{ display: "flex", gap: 8 }}>
                <input className="pm-input" placeholder="e.g. 4K Streaming" value={featureInput} onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && featureInput) {
                      setData({ ...data, extra_data: { ...data.extra_data, features: [...(data.extra_data?.features || []), featureInput] } });
                      setFeatureInput("");
                    }
                  }} />
                <button className="pm-addFeatureBtn" onClick={() => {
                  if (!featureInput) return;
                  setData({ ...data, extra_data: { ...data.extra_data, features: [...(data.extra_data?.features || []), featureInput] } });
                  setFeatureInput("");
                }}>Add</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
                {(data.extra_data?.features || []).map((f, i) => (
                  <span key={i} className="pm-chip" onClick={() => {
                    const updated = data.extra_data.features.filter((_, idx) => idx !== i);
                    setData({ ...data, extra_data: { ...data.extra_data, features: updated } });
                  }}>{f} <X size={10} style={{ marginLeft: 4, verticalAlign: "middle" }} /></span>
                ))}
              </div>
            </Field>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid #0f172a" }}>
        {onCancel && <button className="pm-cancelBtn" onClick={onCancel}>Cancel</button>}
        <button className="pm-submitBtn" onClick={onSubmit}>{submitLabel}</button>
      </div>
    </div>
  );
};

// ── PRODUCT CARD ──────────────────────────────────────────────
const ProductCard = ({
  p, safeExtra, user, isMaster,
  onEdit, onToggleActive, onDelete,
  onApprove, onReject, onResubmit,
  viewMode, // "all" | "my" | "pending" | "rejected"
  token,
}) => {
  const extra = safeExtra(p);

  const statusColor = {
    approved: "#22c55e",
    pending:  "#eab308",
    rejected: "#ef4444",
  }[p.approval_status] || "#64748b";

  const statusLabel = {
    approved: "APPROVED",
    pending:  "PENDING",
    rejected: "REJECTED",
  }[p.approval_status] || p.approval_status?.toUpperCase();


  return (
    <div className="pm-productCard">
      {/* Status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 25 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.is_active ? "#22c55e" : "#ef4444", boxShadow: p.is_active ? "0 0 6px #22c55e80" : "none" }} />
           {(viewMode === "all" || viewMode === "my") &&   (
          <span style={{ fontSize: 10, color: p.is_active ? "#22c55e" : "#a31919ff", fontWeight: 700, letterSpacing: "0.06em" }}>
            {p.is_active ? "ACTIVE" : "INACTIVE"}
          </span>
           )}
          {(viewMode === "pending" || viewMode === "rejected") && user.role === "master" && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: statusColor,
                background: statusColor + "18",
                border: `1px solid ${statusColor}40`,
                borderRadius: 99,
                padding: "5px 10px",
                marginLeft: 4,
              }}
            >
              {statusLabel}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {p.discount_percent && <span className="pm-discountBadge">🏷️{p.discount_percent}%</span>}
          {p.is_featured && <span className="pm-featuredBadge">★ Featured</span>}
        </div>
      </div>

      {/* Identity */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", borderBottom: "1px dotted #47556978", paddingBottom: 10 }}>
        <div style={{ width: 60, height: 60, borderRadius: 12, border: "1px solid #313d58", background: "#0b1525", display: "flex", alignItems: "center", justifyContent: "center", padding: 8, boxSizing: "border-box", overflow: "hidden", flexShrink: 0 }}>
          {p.icon_path ? (
            <img src={`${API_URL}${p.icon_path}`} alt={p.name} style={{ width: "100%", height: "100%", borderRadius: 8, objectFit: "cover" }} />
          ) : (
            <div className="pm-avatar">{p.name?.[0]?.toUpperCase() || "?"}</div>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: 18, letterSpacing: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>{p.name}</div>
          {p.discount_percent ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
              <span style={{ color: "#5f728eff", fontSize: 14, textDecoration: "line-through" }}>{p.price}</span>
              <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 16 }}>{(p.price * (1 - p.discount_percent / 100)).toFixed(2)}</span>
              <span style={{ color: "#94a3b8", fontWeight: 500, fontSize: 12 }}>{p.currency}</span>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
              <span style={{ color: "#3b82f6", fontWeight: 600, fontSize: 16 }}>{p.price}</span>
              <span style={{ color: "#94a3b8", fontWeight: 500, fontSize: 12 }}>{p.currency}</span>
            </div>
          )}
          {/* Created by (shown in all/pending/rejected views) */}
          {p.admin_id != null && (
            <div style={{ color: "#475569", fontSize: 11, marginTop: 3 }}>admin #{p.admin_id} {p.admin_username}</div>
          )}
        </div>
      </div>

      {p.description && (
        <p style={{ color: "#757d88ff", fontSize: 12, lineHeight: 1.5, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.description}</p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {p.plan && <span className="pm-planBadge">{p.plan}</span>}
        {p.product_type && <span className="pm-typeBadge">{p.product_type}</span>}
        {extra.region && <span className="pm-regionBadge">🌍 {extra.region}</span>}
        {extra.provider && <span className="pm-typeBadge">{extra.provider}</span>}
        {(extra.features || []).slice(0, 2).map((f, i) => <span key={i} className="pm-typeBadge">{f}</span>)}
      </div>

      {/* Rejection reason */}
      {viewMode === "rejected" && p.rejection_reason && (
        <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#f87171", lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700 }}>Reason: </span>{p.rejection_reason}
        </div>
      )}

      <div style={{ marginTop: "auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingBottom: 10 }}>
          <span className="pm-metaPill">📦 {p.stock ?? "∞"}</span>
          {p.network && <span className="pm-metaPill">🌐 {p.network}</span>}
          <span className="pm-metaPill">⏳ {p.validity_days || 0}d{p.validity_hours ? ` ${p.validity_hours}h` : ""}</span>
          {p.data_volume_gb && <span className="pm-metaPill">💾 {p.data_volume_gb}GB</span>}
          {p.is_recurring && <span className="pm-metaPill">🔁 Recurring</span>}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {/* Master approve/reject on pending */}
        {viewMode === "pending" && user.role === "master" && (
          <>
            {/* EDIT BUTTON (NEW) */}
            <button
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: 9,
                padding: "7px 0",
                color: "#60a5fa",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
              }}
              onClick={() => onEdit(p)}
            >
              <Edit3 size={12} /> Edit
            </button>

            {/* APPROVE */}
            <button
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 9,
                padding: "7px 0",
                color: "#22c55e",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
              }}
              onClick={() => onApprove(p)}
            >
              <CheckCircle size={12} /> Approve
            </button>

            {/* REJECT */}
            <button
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 9,
                padding: "7px 0",
                color: "#ef4444",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
              }}
              onClick={() => onReject(p)}
            >
              <XCircle size={12} /> Reject
            </button>
          </>
        )}
           
        {/* Resubmit on rejected (owner or master) */}
        {viewMode === "rejected" && (
          <div
            style={{
              display: "flex",
              gap: 8,
              width: "100%",
            }}
          >
            <button
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                background: "rgba(234,179,8,0.1)",
                border: "1px solid rgba(234,179,8,0.25)",
                borderRadius: 9,
                padding: "7px 0",
                color: "#eab308",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
              }}
              onClick={() => onResubmit(p.id)}
            >
              <RefreshCcw size={12} /> Resubmit
            </button>

            <button
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: 9,
                padding: "7px 0",
                color: "#60a5fa",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
              }}
              onClick={() => onEdit(p)}
            >
              <Edit3 size={12} /> Edit
            </button>
          </div>
        )}

          {/* Edit — always shown where applicable */}
          {(viewMode === "all" || viewMode === "my") && hasPermission(user, "products.edit") && (
            <button
              className="pm-cardBtnEdit"
              onClick={() => onEdit(p)}
            >
              <Edit3 size={12} style={{ marginRight: 5 }} /> Edit
            </button>
          )}

          {/* Toggle active */}
          {(viewMode === "all" || viewMode === "my") && hasPermission(user, "products.management") && (
            <button
              className="pm-cardBtnToggle"
              style={{
                background: p.is_active ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                borderColor: p.is_active ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)",
                color: p.is_active ? "#ef4444" : "#22c55e",
              }}
              onClick={() => onToggleActive(p.id, !p.is_active)}
            >
              <Power size={12} style={{ marginRight: 5 }} />
              {p.is_active ? "Disable" : "Enable"}
            </button>
          )}

          {/* Delete */}
          {(viewMode === "all" || viewMode === "my") && hasPermission(user, "products.delete") && (
            <button className="pm-cardBtnDelete" onClick={() => onDelete(p.id)}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── PRODUCT ROW (sidebar list, like exchange PairRow) ──────────
const ProductRow = ({ p, selected, onClick }) => {
  const hasDiscount = p.discount_percent && Number(p.discount_percent) > 0;
  const discountedPrice = hasDiscount ? (p.price * (1 - p.discount_percent / 100)).toFixed(2) : null;

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", borderRadius: 9, cursor: "pointer",
        border: `1px solid ${selected ? "rgba(59,130,246,.28)" : "transparent"}`,
        background: selected ? "rgba(59,130,246,.1)" : "transparent",
        transition: "all .15s", marginBottom: 3,
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
        background: p.is_active ? "#22c55e" : "#374151",
        boxShadow: p.is_active ? "0 0 6px rgba(34,197,94,.4)" : "none",
        display: "inline-block",
      }} />

      {/* small icon before product name */}
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        background: "#0b1525", border: "1px solid #313d58ff",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {p.icon_path ? (
          <img src={`${API_URL}${p.icon_path}`} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 11, fontWeight: 800, color: "#3b82f6" }}>{p.name?.[0]?.toUpperCase() || "?"}</span>
        )}
      </div>

      {/* left-aligned: name / plan / admin */}
      <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: selected ? "white" : "#cbd5e1",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {p.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
          <span style={{ fontSize: 11, color: "#5f728eff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.plan || "—"}
          </span>
          {p.admin_id != null && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#a78bfa",
              background: "rgba(139,92,246,.12)", border: "1px solid rgba(139,92,246,.25)",
              borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap",
              maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0,
            }}>
              {p.admin_username || `#${p.admin_id}`}
            </span>
          )}
        </div>
      </div>

      {/* right-aligned: price (with discount if any) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, textAlign: "right" }}>
        {hasDiscount ? (
          <>
            <span style={{ fontSize: 10, color: "#5f728eff", textDecoration: "line-through" }}>
              {p.price} {p.currency || ""}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: p.is_active ? "#22c55e" : "#374151", whiteSpace: "nowrap" }}>
              {discountedPrice} {p.currency || ""}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: p.is_active ? "#3b82f6" : "#374151", whiteSpace: "nowrap" }}>
            {p.price != null ? `${p.price} ${p.currency || ""}` : "—"}
          </span>
        )}
      </div>
    </div>
  );
};

// ── PRODUCT DETAIL PANEL (sidebar, like exchange PairDetail) ───
const ProductDetailPanel = ({ product, categories, safeExtra, currentUser, viewMode, onEdit, onToggleActive, onDelete, onApprove, onReject, onResubmit }) => {
  const extra = safeExtra(product);
  const category = categories.find(c => Number(c.id) === Number(product.category_id));
  const isMaster = currentUser.role === "master";

  // parse required_user_data safely (may be a JSON string or an object keyed by field name)
  const requiredFields = (() => {
    try {
      const raw = product.required_user_data;
      if (!raw) return {};
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch { return {}; }
  })();
  const requiredEntries = Object.entries(requiredFields);
  const STEP_LABELS = { before_order: "Before Order", after_login: "After Login" };
  const requiredByStep = requiredEntries.reduce((acc, [key, f]) => {
    const step = f?.step || "before_order";
    (acc[step] = acc[step] || []).push([key, f]);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* head */}
      <div style={{ padding: "12px 15px", borderBottom: "1px solid rgba(255,255,255,.05)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: product.is_active ? "#22c55e" : "#a31919ff", boxShadow: product.is_active ? "0 0 8px rgba(34,197,94,.5)" : "none", flexShrink: 0 }} />
          <span style={{ color: "white", fontWeight: 800, fontSize: 15, flex: 1, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.name}</span>
          <span style={{ background: product.is_active ? "rgba(34,197,94,.1)" : "#a31919ff", border: `1px solid ${product.is_active ? "rgba(34,197,94,.22)" : "rgba(252,253,254,.15)"}`, color: product.is_active ? "#4ade80" : "#cba3a3ff", borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 700 }}>
            {product.is_active ? "LIVE" : "OFF"}
          </span>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: "#7c8696ff" }}>{category?.name || "Uncategorized"}</div>
        {product.admin_id != null && (
          <div style={{ marginTop: 3, fontSize: 11, color: "#a78bfa", display: "flex", alignItems: "center", gap: 4 }}>
            <User size={11} /> {product.admin_username || `#${product.admin_id}`}
          </div>
        )}
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "13px 15px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* price hero */}
        <div style={{ background: "#040a14", border: "1px solid rgba(59,130,246,.15)", borderRadius: 11, padding: 12 }}>
          <div style={{ fontSize: 10, color: "#3b82f6", fontWeight: 700, letterSpacing: ".07em", marginBottom: 4 }}>PRICE</div>
          <div style={{ fontSize: 22, color: "white", fontWeight: 900, letterSpacing: "-.04em" }}>
            {product.price} <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>{product.currency}</span>
          </div>
          {product.discount_percent ? (
            <div style={{ fontSize: 13, color: "#22c55e", marginTop: 3 }}>
              Discounted: {(product.price * (1 - product.discount_percent / 100)).toFixed(2)} {product.currency} (−{product.discount_percent}%)
            </div>
          ) : null}
        </div>

        {/* stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            ["Plan", product.plan || "—"],
            ["Stock", product.stock ?? "∞"],
            ["Type", product.product_type || "—"],
            ["Product ID", `#${product.id}`],
            ["Validity", `${product.validity_days || 0}d${product.validity_hours ? ` ${product.validity_hours}h` : ""}`],
            ["Data", product.data_volume_gb ? `${product.data_volume_gb}GB` : "—"],
            ["Commission", product.system_commision != null ? product.system_commision : "—"],
            ["Reward %", product.system_reward_percent != null ? `${product.system_reward_percent}%` : "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ background: "#040a14", border: "1px solid rgba(255,255,255,.06)", borderRadius: 9, padding: "9px 10px" }}>
              <div style={{ fontSize: 12, color: "#7c8696ff", marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 14, color: "white", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div>
            </div>
          ))}
        </div>

        {product.description && (
          <div>
            <div style={{ fontSize: 10, color: "#7c8696ff", fontWeight: 700, letterSpacing: ".07em", marginBottom: 6 }}>DESCRIPTION</div>
            <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{product.description}</div>
          </div>
        )}

        {(extra.region || extra.provider || (extra.features || []).length > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {extra.region && <span className="pm-regionBadge">🌍 {extra.region}</span>}
            {extra.provider && <span className="pm-typeBadge">{extra.provider}</span>}
            {(extra.features || []).map((f, i) => <span key={i} className="pm-typeBadge">{f}</span>)}
          </div>
        )}

        {/* required user data / steps (like wire pair required-fields preview) */}
        {requiredEntries.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "#7c8696ff", fontWeight: 700, letterSpacing: ".07em", marginBottom: 6 }}>
              REQUIRED USER DATA ({requiredEntries.length})
            </div>
            {["before_order", "after_login"].map(step => {
              const items = requiredByStep[step];
              if (!items || items.length === 0) return null;
              return (
                <div key={step} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 3, height: 11, borderRadius: 3, background: step === "before_order" ? "#3b82f6" : "#a78bfa" }} />
                    <span style={{ fontSize: 11, color: step === "before_order" ? "#60a5fa" : "#a78bfa", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>
                      {STEP_LABELS[step] || step}
                    </span>
                  </div>
                  {items.map(([key, f]) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#040a14", border: "1px solid rgba(255,255,255,.06)", borderRadius: 8, padding: "6px 10px", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600 }}>{f?.label || key}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: f?.required ? "#4ade80" : "#64748b", background: f?.required ? "rgba(34,197,94,.1)" : "rgba(255,255,255,.05)", border: `1px solid ${f?.required ? "rgba(34,197,94,.25)" : "rgba(255,255,255,.08)"}`, borderRadius: 999, padding: "2px 8px" }}>
                        {f?.required ? "Required" : "Optional"}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {viewMode === "rejected" && product.rejection_reason && (
          <div style={{ background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.18)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#f87171", lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700 }}>Reason: </span>{product.rejection_reason}
          </div>
        )}
      </div>

      {/* footer actions */}
      <div style={{ padding: "11px 15px", borderTop: "1px solid rgba(255,255,255,.05)", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
        {viewMode === "pending" && isMaster ? (
          <>
            <button className="pm-actionBtn" style={{ flex: 1, background: "rgba(59,130,246,.1)", borderColor: "rgba(59,130,246,.22)", color: "#60a5fa" }} onClick={() => onEdit(product)}>
              <Edit3 size={11} style={{ marginRight: 5 }} />Edit
            </button>
            <button className="pm-actionBtn" style={{ flex: 1, background: "rgba(34,197,94,.1)", borderColor: "rgba(34,197,94,.22)", color: "#4ade80" }} onClick={() => onApprove(product)}>
              <CheckCircle size={11} style={{ marginRight: 5 }}  />Approve
            </button>
            <button className="pm-actionBtn" style={{ flex: 1, background: "rgba(239,68,68,.1)", borderColor: "rgba(239,68,68,.22)", color: "#f87171" }} onClick={() => onReject(product)}>
              <XCircle size={11} style={{ marginRight: 5 }}  />Reject
            </button>
          </>
        ) : viewMode === "rejected" ? (
          <>
            <button className="pm-actionBtn" style={{ flex: 1, background: "rgba(234,179,8,.1)", borderColor: "rgba(234,179,8,.25)", color: "#eab308" }} onClick={() => onResubmit(product.id)}>
              <RefreshCcw size={11} style={{ marginRight: 5 }} />Resubmit
            </button>
            <button className="pm-actionBtn" style={{ flex: 1, background: "rgba(59,130,246,.1)", borderColor: "rgba(59,130,246,.22)", color: "#60a5fa" }} onClick={() => onEdit(product)}>
              <Edit3 size={11} style={{ marginRight: 5 }}  />Edit
            </button>
          </>
        ) : (
          <>
            {hasPermission(currentUser, "products.edit") && (
              <button className="pm-actionBtn" style={{ flex: 1, background: "rgba(59,130,246,.1)", borderColor: "rgba(59,130,246,.22)", color: "#60a5fa" }} onClick={() => onEdit(product)}>
                <Edit3 size={11} style={{ marginRight: 5 }} />Edit
              </button>
            )}
            {hasPermission(currentUser, "products.management") && (
              <button
                className="pm-actionBtn" style={{ flex: 1, background: product.is_active ? "rgba(239,68,68,.08)" : "rgba(34,197,94,.08)", borderColor: product.is_active ? "rgba(239,68,68,.2)" : "rgba(34,197,94,.2)", color: product.is_active ? "#f87171" : "#4ade80" }}
                onClick={() => onToggleActive(product.id, !product.is_active)}
              >
                {product.is_active ? <><PowerOff size={11} style={{ marginRight: 5 }}  />Disable</> : <> <Power size={11} style={{ marginRight: 5 }} />Enable</>}
              </button>
            )}
            {hasPermission(currentUser, "products.delete") && (
              <button className="pm-actionBtn" style={{ background: "rgba(239,68,68,.07)", borderColor: "rgba(239,68,68,.15)", color: "#ef4444", padding: "8px 10px" }} onClick={() => onDelete(product.id)}>
                <Trash2 size={12} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── PRODUCTS GRID BY CATEGORY ─────────────────────────────────
const ProductGrid = ({ products, categories, safeExtra, user, isMaster, onEdit, onToggleActive, onDelete, onApprove, onReject, onResubmit, viewMode, loading, token }) => {
  // For pending/rejected we show flat list (no category grouping needed, but we'll still group if possible)
  const uncategorized = products.filter(p => !p.category_id || !categories.find(c => Number(c.id) === Number(p.category_id)));

  const cardProps = (p) => ({
    p, 
    safeExtra, 
    user, 
    isMaster,
    onEdit, 
    onToggleActive, 
    onDelete, 
    onApprove, 
    onReject, onResubmit, viewMode,
    token,
  });

  if (products.length === 0 && !loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 280, gap: 16, marginTop: 80 }}>
        <Package size={48} strokeWidth={1} color="#1e293b" />
        <div style={{ fontWeight: 700, fontSize: 18, color: "#334155" }}>No products here</div>
        <div style={{ fontSize: 13, color: "#2f3c50ff" }}>
          {viewMode === "pending" ? "No products awaiting approval." : viewMode === "rejected" ? "No rejected products." : "Add a product or adjust your search."}
        </div>
      </div>
    );
  }

  return (
    <>
      {categories.map((cat) => {
        const catProducts = products.filter(p => Number(p.category_id) === Number(cat.id));
        if (catProducts.length === 0) return null;
        return (
          <div key={cat.id} style={{ marginBottom: 44 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, borderBottom: "1px dotted #424f637f", padding: "20px 7px" }}>
              <div style={{ width: 3, height: 20, borderRadius: 4, background: "#3b82f6" }} />
              <span style={{ color: "white", fontWeight: 700, fontSize: 16 }}>{cat.name}</span>
              <span style={{ background: "#0b1525", border: "1px solid #30415cff", color: "#657b99ff", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>{catProducts.length}</span>
            </div>
            <div style={{ display: "flex", gap: 14, overflowX: "auto", scrollbarWidth: "thin", scrollbarColor: "#1e293b #060b16" }}>
              {catProducts.map((p) => <ProductCard key={p.id} {...cardProps(p)} />)}
            </div>
          </div>
        );
      })}
      {uncategorized.length > 0 && (
        <div style={{ marginBottom: 44 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, borderBottom: "1px dotted #424f637f", padding: "20px 7px" }}>
            <div style={{ width: 3, height: 20, borderRadius: 4, background: "#475569" }} />
            <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 16 }}>Uncategorized</span>
            <span style={{ background: "#0b1525", border: "1px solid #30415cff", color: "#657b99ff", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>{uncategorized.length}</span>
          </div>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", scrollbarWidth: "thin", scrollbarColor: "#1e293b #060b16" }}>
            {uncategorized.map((p) => <ProductCard key={p.id} {...cardProps(p)} />)}
          </div>
        </div>
      )}
    </>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function ProductsManagement() {
  const token = localStorage.getItem("token");

  // Data
  const [allProducts, setAllProducts]       = useState([]);
  const [users, setUsers] = useState([]);
  const [myProducts, setMyProducts]         = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [rejectedProducts, setRejectedProducts] = useState([]);
  const [categories, setCategories]         = useState([]);
  const [currencies, setCurrencies]         = useState([]);
  const [networks, setNetworks]             = useState([]);
  const [loading, setLoading]               = useState(false);

  // UI State
  const [mainView, setMainView]             = useState("products"); // "products" | "orders" | "analysis"
  const [activeTab, setActiveTab]           = useState("all"); // "all" | "my" | "pending" | "rejected" (master only)
  // single-click cyclic sort: field is "price" | "plan" | null, dir is "asc" | "desc" | null. Default: none.
  const [sortField, setSortField]           = useState(null);
  const [sortDir, setSortDir]                = useState(null);
  const toggleSort = (field) => {
    if (sortField !== field) { setSortField(field); setSortDir("asc"); }
    else if (sortDir === "asc") { setSortDir("desc"); }
    else { setSortField(null); setSortDir(null); }
  };

  // ── UNIFIED HERO FILTERS — one shared filter set, applied across Products / Orders / Analysis ──
  const [unifiedSearch, setUnifiedSearch]       = useState("");
  const [statusFilter, setStatusFilter]         = useState("all");       // order status (Orders tab)
  const [unifiedProductType, setUnifiedProductType] = useState("all");   // product_type (all tabs)
  const [unifiedCurrency, setUnifiedCurrency]   = useState("all");       // currency (all tabs)
  const [unifiedCategory, setUnifiedCategory]   = useState("all");       // category name (all tabs)
  const [unifiedAdmin, setUnifiedAdmin]         = useState("all");       // admin id / owner (all tabs, master only)
  const [unifiedDateRange, setUnifiedDateRange] = useState([null, null]);
  const [unifiedStart, unifiedEnd]              = unifiedDateRange;
  const [analysisMetric, setAnalysisMetric]     = useState("sold");      // "sold" | "income" (Analysis tab)
  const [analysisViewMode, setAnalysisViewMode] = useState("products");  // "products" | "categories" (Analysis tab)
  const [panel, setPanel]                   = useState(null);  // null | "add-product" | "add-category"
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm]                     = useState(emptyForm());
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName]     = useState("");
  const [featureInput, setFeatureInput]     = useState("");

  // ── Orders (merged from OrdersManagement) ──
  const [orders, setOrders]                 = useState([]);
  const [ordersLoading, setOrdersLoading]   = useState(false);
  const [selectedOrder, setSelectedOrder]   = useState(null);
  const [selectedUser, setSelectedUser]     = useState(null);

  // Approval modals
  const [approveTarget, setApproveTarget]   = useState(null);
  const [rejectTarget, setRejectTarget]     = useState(null);

  const currentUser = {
    role: localStorage.getItem("role"),
    username: localStorage.getItem("username") || "My",
    user_id: Number(localStorage.getItem("user_id")) || null,
    access_points: JSON.parse(localStorage.getItem("access_points") || "[]")
  };


  function emptyForm() {
    return {
      name: "", product_type: "Subscription", plan: "", price: "", discount_percent: "",
      currency: "USDT", network: "bep20", description: "",
      validity_days: "", validity_hours: "", data_volume_gb: "",
      is_recurring: false, stock: "", is_active: true, is_featured: false,
      category_id: "", 
      extra_data: { provider: "", region: "", features: []}, 
      icon_path: "",required_user_data: {},
    };
  }

  const headers = { Authorization: `Bearer ${token}` };



  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const reqs = [
        fetch(`${API_URL}/admin/products/`, { headers }),
        fetch(`${API_URL}/admin/categories/`, { headers }),
        fetch(`${API_URL}/admin/currencies/`, { headers }),
        fetch(`${API_URL}/admin/networks/`, { headers }),
        
      ];

      // Master-only approval endpoints
      if (currentUser.role === "master") {
        reqs.push(fetch(`${API_URL}/admin/product-approvals/pending`, { headers }));
        reqs.push(fetch(`${API_URL}/admin/product-approvals/rejected`, { headers }));
        reqs.push(fetch(`${API_URL}/admin/users/`, { headers }));
      
      }
      const results = await Promise.all(reqs);
      const [pRes, cRes, currRes, netRes, pendRes, rejRes, userRes ] = results;
 
      const products = await pRes.json().then(d => Array.isArray(d) ? d : d.products || []);
      console.log("products",products)
      setAllProducts(products);
      // "My products" = products created by current user
      setMyProducts(products.filter(p => Number(p.admin_id) === currentUser.user_id));
      setCategories(await cRes.json().then(d => Array.isArray(d) ? d : d.categories || []));
      setCurrencies(await currRes.json().then(d => Array.isArray(d) ? d : d.currencies || []));
      setNetworks(await netRes.json().then(d => Array.isArray(d) ? d : d.networks || []));

      if (currentUser.role === "master" && pendRes) setPendingProducts(await pendRes.json().then(d => Array.isArray(d) ? d : []));
      if (currentUser.role === "master" && rejRes) setRejectedProducts(await rejRes.json().then(d => Array.isArray(d) ? d : []));
      if (currentUser.role === "master" && userRes) setUsers(await userRes.json().then(d =>  Array.isArray(d) ? d : d.users || [] ));
    } catch (err) {
      console.error("loadData error:", err);
    } finally {
      setLoading(false);
    }
  }, [token, currentUser.role === "master"]);
  
  useEffect(() => { loadData(); }, []);

  // keep selected product in sync after reload
  useEffect(() => {
    if (!selectedProduct) return;
    const all = [...allProducts, ...myProducts, ...pendingProducts, ...rejectedProducts];
    const fresh = all.find(p => p.id === selectedProduct.id);
    setSelectedProduct(fresh || null);
  }, [allProducts, myProducts, pendingProducts, rejectedProducts]);

  // ── ORDERS: load + filter (merged from OrdersManagement) ──
  const isMaster = currentUser.role === "master";
  // Non-master admins can only ever browse their own products
  const effectiveTab = isMaster ? activeTab : "my";

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await API.get("/admin/orders/all");
      setOrders(res.data || []);
    } catch (err) {
      console.error("loadOrders error:", err);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // an item "matches" an admin/category filter if it either has no ownership/category info at all
  // (can't be excluded) or one of its known fields actually equals the selected value
  const matchesAdmin = (item, val) => {
    if (val === "all") return true;
    const selectedUser = users.find(u => String(u.user_id) === String(val));
    const idCandidates = [item.admin_id, item.product_owner_id, item.owner_admin_id, item.created_by_admin_id, item.seller_admin_id]
      .filter(v => v != null);
    const nameCandidates = [item.admin_username, item.product_owner_displayName, item.owner_username, item.seller_username]
      .filter(Boolean);
    if (idCandidates.length === 0 && nameCandidates.length === 0) return true; // no ownership info on this item — can't exclude
    const idMatch = idCandidates.some(id => String(id) === String(val));
    const nameMatch = !!selectedUser && nameCandidates.some(n => n === selectedUser.username || n === selectedUser.display);
    return idMatch || nameMatch;
  };
  const matchesCategory = (item, val) => {
    if (val === "all") return true;
    const name = item.category_name ?? categories.find(c => Number(c.id) === Number(item.category_id))?.name;
    if (name == null) return true;
    return name === val;
  };

  const applyOrderFilters = (list, { status }) => {
    let data = [...list];
    if (unifiedSearch.trim()) {
      const q = unifiedSearch.toLowerCase().trim();
      data = data.filter((o) =>
        o.id?.toString().includes(q) ||
        o.username?.toLowerCase().includes(q) ||
        o.product_name?.toLowerCase().includes(q) ||
        o.product_type?.toLowerCase().includes(q)
      );
    }
    if (status !== "all") data = data.filter((o) => o.status === status);
    if (unifiedProductType !== "all") data = data.filter((o) => o.product_type === unifiedProductType);
    if (unifiedCurrency !== "all") data = data.filter((o) => o.currency === unifiedCurrency);
    data = data.filter((o) => matchesCategory(o, unifiedCategory));
    data = data.filter((o) => matchesAdmin(o, unifiedAdmin));
    if (unifiedStart) data = data.filter((o) => new Date(o.created_at) >= unifiedStart);
    if (unifiedEnd) {
      const end = new Date(unifiedEnd);
      end.setHours(23, 59, 59, 999);
      data = data.filter((o) => new Date(o.created_at) <= end);
    }
    return data;
  };

  const filteredOrders = useMemo(
    () => applyOrderFilters(orders, { status: statusFilter }),
    [orders, unifiedSearch, statusFilter, unifiedProductType, unifiedCurrency, unifiedCategory, unifiedAdmin, unifiedStart, unifiedEnd, categories]
  );

  // currency options come strictly from what products are actually priced in —
  // the same list is then used to filter Products, Orders, and Analytics alike
  const currencyOptions = useMemo(() => {
    const set = new Set(allProducts.map((p) => p.currency).filter(Boolean));
    return [...set].sort().map((c) => ({ label: c, value: c }));
  }, [allProducts]);

  // Analytics reflects completed (delivered) sales only. This is computed straight from `orders`
  // (ignoring whatever `statusFilter` is currently set to for the Orders tab — the two must not
  // interfere) with every other shared filter still applied, so the Hero's Orders/Value pills on
  // the Analysis tab always match "Orders tab filtered to Delivered", regardless of what status
  // was last picked while browsing Orders.
  const heroPillOrders = useMemo(
    () => (mainView === "analysis" ? applyOrderFilters(orders, { status: "delivered" }) : filteredOrders),
    [mainView, orders, filteredOrders, unifiedSearch, unifiedProductType, unifiedCurrency, unifiedCategory, unifiedAdmin, unifiedStart, unifiedEnd, categories]
  );

  const filteredOrderCurrencies = [...new Set(heroPillOrders.map((o) => o.currency).filter(Boolean))];
  const totalPurchaseValue = (() => {
    if (filteredOrderCurrencies.length !== 1) return null;
    const currency = filteredOrderCurrencies[0];
    const sum = heroPillOrders.reduce((acc, o) => acc + (parseFloat(o.price) || 0), 0);
    const fractionDigits = currency === "IRT" ? 0 : 1;
    return sum.toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  })();
  const totalPurchaseCurrency = filteredOrderCurrencies.length === 1 ? filteredOrderCurrencies[0] : null;

  const openOrder = (order) => setSelectedOrder(order);
  const closeOrderSidebar = () => setSelectedOrder(null);
  const openUserSidebar = (userData) => setSelectedUser(userData);
  const closeUserSidebar = () => setSelectedUser(null);

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12;
    return `${day} ${month} ${year} ${hours}:${minutes} ${ampm}`;
  }

  // ── CATEGORY ACTIONS ──
  const addCategory = async () => {
    if (!categoryName.trim()) return;
    await fetch(`${API_URL}/admin/categories/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name: categoryName }),
    });
    setCategoryName(""); loadData();
  };

  const deleteCategory = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    await fetch(`${API_URL}/admin/categories/${id}`, { method: "DELETE", headers });
    loadData();
  };

  const updateCategory = async () => {
    if (!editingCategory) return;
    await fetch(`${API_URL}/admin/categories/${editingCategory.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name: editingCategory.name }),
    });
    setEditingCategory(null); loadData();
  };

  // ── PRODUCT ACTIONS ──
  const addProduct = async () => {
    const res = await fetch(`${API_URL}/admin/products/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(normalizeForm(form)),
    });

    const data = await res.json();

    console.log("CREATE PRODUCT RESPONSE:", res.status, data);

    if (!res.ok) {
      alert(data.detail || "Failed to create product");
      return;
    }

    setForm(emptyForm());
    setPanel(null);
    loadData();
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    const res = await fetch(`${API_URL}/admin/products/${id}`, { method: "DELETE", headers });
    const data = await res.json();
    if (data.blocked) {
      alert(`❌ Cannot delete product\n\nOrders: ${data.order_count}\nOrder IDs: ${data.order_ids.join(", ")}`);
      return;
    }
    if (selectedProduct?.id === id) setSelectedProduct(null);
    loadData();
  };

  const toggleActive = async (id) => {
    await fetch(`${API_URL}/admin/products/${id}/toggle-active`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    loadData();
  };

  const updateProduct = async () => {
    if (!editingProduct) return;
    await fetch(`${API_URL}/admin/products/${editingProduct.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(normalizeForm(editingProduct)),
    });
    console.log(editingProduct)
    setEditingProduct(null); loadData();
  };

  // ── APPROVAL ACTIONS ──
  const approveProduct = async (productId, systemCommision, systemRewardPercent) => {
    await fetch(`${API_URL}/admin/product-approvals/${productId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ system_commision: systemCommision, system_reward_percent: systemRewardPercent }),
    });
    loadData();
  };

  const rejectProduct = async (productId, reason) => {
    await fetch(`${API_URL}/admin/product-approvals/${productId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ reason }),
    });
    loadData();
  };

  const resubmitProduct = async (productId) => {
    await fetch(`${API_URL}/admin/product-approvals/${productId}/resubmit`, {
      method: "POST",
      headers,
    });
    loadData();
  };

  // ── HELPERS ──
  function normalizeForm(f) {
    const numOrNull = (v) => (v !== "" && v !== null && v !== undefined ? Number(v) : null);
    return {
      ...f,
      price: Number(f.price) || 0,           // price is required, default 0
      discount_percent: numOrNull(f.discount_percent),
      validity_days: numOrNull(f.validity_days),
      validity_hours: numOrNull(f.validity_hours),
      data_volume_gb: numOrNull(f.data_volume_gb),
      stock: numOrNull(f.stock),
      system_commision: numOrNull(f.system_commision),
      system_reward_percent: numOrNull(f.system_reward_percent),
      category_id: f.category_id ? Number(f.category_id) : null,
    };
  }

  const safeExtra = (p) => {
    try {
      const d = typeof p.extra_data === "string" ? JSON.parse(p.extra_data) : p.extra_data;
      return { provider: "", region: "", features: [], ...d };
    } catch { return { provider: "", region: "", features: [] }; }
  };

  const openEdit = (product) => setEditingProduct({
    id: product.id,
    name: product.name || "", product_type: product.product_type || "Subscription",
    plan: product.plan || "", price: product.price || "",
    discount_percent: product.discount_percent || "", currency: product.currency || "USDT",
    network: product.network || "bep20", description: product.description || "",
    validity_days: product.validity_days || "", validity_hours: product.validity_hours || "",
    data_volume_gb: product.data_volume_gb || "", is_recurring: product.is_recurring || false,
    stock: product.stock || "", is_active: product.is_active ?? true,
    is_featured: product.is_featured ?? false, category_id: product.category_id || "",
    extra_data: safeExtra(product),
    icon_path: product.icon_path || "",
    admin_id: product.admin_id || "",
    system_commision: product.system_commision ?? "",       
   system_reward_percent: product.system_reward_percent ?? "", 
    required_user_data: (() => {
      try {
        const raw = product.required_user_data;
        if (!raw) return {};
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch { return {}; }
    })(),
  });

  // ── SORTED DATA (price or plan, ascending/descending, or none) ──
  const sortProducts = (list) => {
    if (!sortField || !sortDir) return list;
    const arr = [...list];
    if (sortField === "price") {
      arr.sort((a, b) => sortDir === "asc"
        ? (Number(a.price) || 0) - (Number(b.price) || 0)
        : (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortField === "plan") {
      arr.sort((a, b) => sortDir === "asc"
        ? (a.plan || "").localeCompare(b.plan || "")
        : (b.plan || "").localeCompare(a.plan || ""));
    }
    return arr;
  };

  const currentProducts = useMemo(() => {
    const map = { all: allProducts, my: myProducts, pending: pendingProducts, rejected: rejectedProducts };
    let list = map[effectiveTab] || [];
    if (unifiedSearch.trim()) {
      const q = unifiedSearch.toLowerCase().trim();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.plan?.toLowerCase().includes(q) ||
        p.product_type?.toLowerCase().includes(q)
      );
    }
    if (unifiedProductType !== "all") list = list.filter(p => p.product_type === unifiedProductType);
    if (unifiedCurrency !== "all") list = list.filter(p => p.currency === unifiedCurrency);
    list = list.filter(p => matchesCategory(p, unifiedCategory));
    list = list.filter(p => matchesAdmin(p, unifiedAdmin));
    if (unifiedStart) list = list.filter(p => !p.created_at || new Date(p.created_at) >= unifiedStart);
    if (unifiedEnd) {
      const end = new Date(unifiedEnd);
      end.setHours(23, 59, 59, 999);
      list = list.filter(p => !p.created_at || new Date(p.created_at) <= end);
    }
    return sortProducts(list);
  }, [effectiveTab, allProducts, myProducts, pendingProducts, rejectedProducts, sortField, sortDir,
      unifiedSearch, unifiedProductType, unifiedCurrency, unifiedCategory, unifiedAdmin, unifiedStart, unifiedEnd]);

  // ── STATS ──
  const activeCount = useMemo(() => allProducts.filter(p => p.is_active).length, [allProducts]);
  const panelOpen   = panel !== null;

  // ── TABS CONFIG (product filter, moved into Hero dropdown — master only) ──
  const tabs = [
    hasPermission(currentUser, "products.view") && { id: "all", label: "Products", icon: Package, count: allProducts.length, accent: "#3b82f6" },
    { id: "my", label: "My Products", icon: ShieldCheck, count: myProducts.length, accent: "#8b5cf6" },
    currentUser.role === "master" && { id: "pending", label: "Pending Approval", icon: Clock, count: pendingProducts.length, accent: "#eab308" },
    currentUser.role === "master" && { id: "rejected", label: "Rejected", icon: XCircle, count: rejectedProducts.length, accent: "#ef4444" },
  ].filter(Boolean);

  // ── MAIN VIEW TABS (like ExchangeDashboard's right-side Orders/Sweeps/Analysis) ──
  const MAIN_TABS = [
    { key: "products", label: "Products", icon: Package,   count: currentProducts.length },
    { key: "orders",   label: "Orders",   icon: FileText,  count: filteredOrders.length },
    { key: "analysis", label: "Analysis", icon: BarChart3, count: null },
  ];

  // Permission button
  const PermButton = ({ permission, style = {}, children, ...props }) => {
    const allowed = hasPermission(currentUser, permission);
    return (
      <button {...props} disabled={!allowed} title={!allowed ? "No permission" : undefined}
        style={{ transition: "0.2s ease", cursor: allowed ? "pointer" : "not-allowed", ...style, filter: allowed ? "none" : "grayscale(0.4)", opacity: allowed ? 1 : 0.85 }}>
        {children}
      </button>
    );
  };
  
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "#060b16",
      overflow: "hidden",
      padding: "0px",
      boxSizing: "border-box",
      fontFamily: "'Inter', sans-serif" }}>

      {/* ── HERO HUB — ONE fixed filter set, shared and applied across Products / Orders / Analysis ── */}
      <div style={{ padding: "0 0 10px", flexShrink: 0 }}>
        <HeroHub
          title="Products Management"
          subtitle="Manage your catalog, products, orders and categories"
          search={{
            visible: true,
            value: unifiedSearch,
            onChange: setUnifiedSearch,
            placeholder:
              mainView === "orders" ? "Search Order ID, User or Product…" :
              mainView === "analysis" ? "Search product, plan or category…" :
              "Search products, plan, type…",
          }}
          dropdowns={[
            // slot 1 — order status (Orders) / product tab filter (Products, master only).
            // Not shown on Analysis — its "Sold vs Income" metric lives back inside the Analytics panel itself.
            (mainView === "orders" || (mainView === "products" && isMaster)) && {
              key: "status",
              label: "Status",
              visible: true,
              value: mainView === "orders" ? statusFilter : activeTab,
              onChange: mainView === "orders" ? setStatusFilter : setActiveTab,
              placeholder: mainView === "orders" ? "All" : "Products",
              options:
                mainView === "orders"
                  ? [
                      { label: "Pending", value: "pending" },
                      { label: "Approved", value: "approved" },
                      { label: "Rejected", value: "rejected" },
                      { label: "Delivered", value: "delivered" },
                    ]
                  : tabs.map(t => ({ label: t.label, value: t.id })),
            },
            // slot 2 — product type, same everywhere
            {
              key: "productType", 
              label: "Types",
              visible: true, 
              value: unifiedProductType, 
              onChange: setUnifiedProductType,
              placeholder: "All",
              options: [
                { label: "Subscription", value: "subscription" },
                { label: "VPN", value: "VPN" },
                { label: "Gift Card", value: "Gift Cards" },
                { label: "Account", value: "account" },
                { label: "Service", value: "service" },
              ],
            },
            // slot 3 — currency, same everywhere
            { key: "currency", 
              visible: true, 
              label: "Currency",
              value: unifiedCurrency, 
              onChange: setUnifiedCurrency, 
              placeholder: "All", 
              options: currencyOptions },
            // slot 4 — category, same everywhere
            {
              key: "category", 
              label: "Category",
              visible: true, 
              value: unifiedCategory, 
              onChange: setUnifiedCategory,
              placeholder: "All",
              options: categories.map(c => ({ label: c.name, value: c.name })),
            },
            // slot 5 — admin/owner, master only, "admin" role only (regular admins only ever see their own data anyway)
            isMaster && {
              key: "admin",
              label: "Admins", 
              visible: true, 
              value: unifiedAdmin, 
              onChange: setUnifiedAdmin,
              placeholder: "All",
              options: users.filter(u => u.role === "admin").map(u => ({ label: u.username, value: String(u.user_id) })),
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
            { key: "products", icon: Package, label: "Products", value: currentProducts.length, accent: "#3b82f6", loading },
            { key: "orders", icon: SlidersHorizontal, label: mainView === "analysis" ? "Delivered Orders" : "Orders", value: heroPillOrders.length, accent: "#a78bfa", loading: ordersLoading },
            { key: "value", icon: Wallet, label: "Value", value: totalPurchaseValue, meta: totalPurchaseCurrency, accent: "#22d3ee", loading: ordersLoading },
          ]}
          onRefresh={() => { loadData(); loadOrders(); }}
          refreshing={loading || ordersLoading}
          actions={[
              {
                key: "categories",
                visible: hasPermission(currentUser, "categories.manage"),
                label: "Categories",
                icon: Grid3X3,
                active: panelOpen,
                onClick: () => setPanel(panel === "add-category" ? null : "add-category"),
              },
            ]}
        />
      </div>

      {/* ── BELOW HERO: sidebar (left) + main container (right) ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

      {/* ── LEFT: PRODUCTS SIDEBAR + SLIDE-IN ADD/CATEGORY PANEL + DETAIL PANEL ── */}
      <div style={{ position: "relative", flexShrink: 0, display: "flex" }}>

        {/* product list sidebar */}
        <div style={{
          width: 380, background: "#040a14", borderRight: "1px solid rgba(255,255,255,.05)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          transition: "opacity .2s", opacity: panelOpen ? .3 : 1, paddingLeft: "10px", pointerEvents: panelOpen ? "none" : "auto",
        }}>
        {/* sidebar header */}
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid rgba(255,255,255,.05)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 7,
            }}
          >
            {/* Left: icon + title + count */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Package size={16} color="#3b82f6" />

              <span
                style={{
                  color: "white",
                  fontWeight: 700,
                  fontSize: 18,
                }}
              >
                Products
              </span>

              <span
                style={{
                  background: "rgba(59,130,246,.12)",
                  color: "#60a5fa",
                  borderRadius: 20,
                  padding: "1px 8px",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {currentProducts.length}
              </span>
            </div>

            {/* Right: Add button */}
            <PermButton
              permission="products.create"
              onClick={() =>
                setPanel(panel === "add-product" ? null : "add-product")
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(59,130,246,.14)",
                border: "1px solid rgba(59,130,246,.28)",
                color: "#93c5fd",
                borderRadius: 7,
                padding: "7px 9px",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <Plus size={12} />
              Add
            </PermButton>
          </div>
        </div>

          {/* sort (2 single-click cyclic buttons: none → asc → desc → none) */}
          <div style={{ padding: "7px 10px", borderBottom: "1px solid rgba(255,255,255,.04)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[{ field: "price", label: "Price" }, { field: "plan", label: "Plan" }].map(({ field, label }) => {
                const active = sortField === field;
                const arrow = active ? (sortDir === "asc" ? "↑" : "↓") : "";
                return (
                  <button
                    key={field}
                    onClick={() => toggleSort(field)}
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

          {/* product rows, grouped by category */}
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
            {loading && currentProducts.length === 0
              ? [...Array(5)].map((_, i) => <div key={i} style={{ padding: "9px 11px", marginBottom: 3 }}><Sk h={14} /></div>)
              : currentProducts.length === 0
                ? <div style={{ color: "#536b8cff", fontSize: 12, textAlign: "center", padding: "30px 10px", fontWeight: 600 }}>No products found</div>
                : (() => {
                    const uncategorized = currentProducts.filter(p => !p.category_id || !categories.find(c => Number(c.id) === Number(p.category_id)));
                    return (
                      <>
                        {categories.map((cat) => {
                          const catProducts = currentProducts.filter(p => Number(p.category_id) === Number(cat.id));
                          if (catProducts.length === 0) return null;
                          return (
                            <div key={cat.id} style={{ marginBottom: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px 4px" , borderBottom: "1px solid #232323cc"}}>
                                <div style={{ width: 3, height: 12, borderRadius: 4, background: "#3b82f6" }} />
                                <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>{cat.name}</span>
                                <span style={{ color: "#475569", fontSize: 10, fontWeight: 700 }}>{catProducts.length}</span>
                              </div>
                              {catProducts.map(p => (
                                <ProductRow key={p.id} p={p} selected={selectedProduct?.id === p.id}
                                  onClick={() => setSelectedProduct(prev => (prev?.id === p.id ? null : p))} />
                              ))}
                            </div>
                          );
                        })}
                        {uncategorized.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px 4px" }}>
                              <div style={{ width: 3, height: 12, borderRadius: 4, background: "#475569" }} />
                              <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>Uncategorized</span>
                              <span style={{ color: "#475569", fontSize: 10, fontWeight: 700 }}>{uncategorized.length}</span>
                            </div>
                            {uncategorized.map(p => (
                              <ProductRow key={p.id} p={p} selected={selectedProduct?.id === p.id}
                                onClick={() => setSelectedProduct(prev => (prev?.id === p.id ? null : p))} />
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()
            }
          </div>
        </div>

        {/* ADD PRODUCT / CATEGORIES SLIDE-IN — slides over sidebar from left */}
        <div style={{
          position: "absolute", top: 0, left: 0, bottom: 0, width: panelOpen ? 380 : 0,
          overflow: "hidden", zIndex: 20,
          transition: "width .32s cubic-bezier(.4,0,.2,1)",
          background: "#06101e",
          borderRight: `1px solid ${panelOpen ? "rgba(59,130,246,.22)" : "transparent"}`,
          display: "flex", flexDirection: "column",
          boxShadow: panelOpen ? "6px 0 28px rgba(0,0,0,.5)" : "none",
        }}>
          <div style={{ minWidth: 340, height: "100%", display: "flex", flexDirection: "column" }}>
            {/* header */}
            <div style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {panel === "add-product" ? <Plus size={15} color="#60a5fa" /> : <Grid3X3 size={15} color="#a5b4fc" />}
              </div>
              <span style={{ color: "white", fontWeight: 700, fontSize: 18, flex: 1, whiteSpace: "nowrap" }}>
                {panel === "add-product" ? "Add new product" : "Manage categories"}
              </span>
              <button onClick={() => setPanel(null)} className="pm-closeIconBtn"><X size={16} /></button>
            </div>

            {/* body */}
            <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
              {panel === "add-product" && (
                <ProductForm
                  users={users}
                  data={form} setData={setForm} token={token}
                  onSubmit={addProduct} submitLabel="Create Product"
                  onCancel={() => setPanel(null)}
                  featureInput={featureInput} setFeatureInput={setFeatureInput}
                  categories={categories} currencies={currencies} networks={networks} isMaster={currentUser.role === "master"}
                />
              )}

              {panel === "add-category" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%", overflow: "hidden" }}>
                  <div style={{ background: "#050a14", border: "1px solid #1d2b4bff", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                    <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>New Category</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className="pm-input" style={{ flex: 1 }} placeholder="Category name…" value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCategory()} />
                      <button className="pm-submitBtn" style={{ width: "auto", padding: "0 18px", margin: 0 }} onClick={addCategory}>Add</button>
                    </div>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Existing — {categories.length}</div>
                  <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    {categories.map((cat) => (
                      <div key={cat.id} style={{ background: "#050a14", border: "1px solid #202e4eff", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: "#0b1525", border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Layers size={14} color="#475569" />
                        </div>
                        {editingCategory?.id === cat.id ? (
                          <>
                            <input className="pm-input" style={{ flex: 1, padding: "8px 12px", fontSize: 13 }}
                              value={editingCategory.name}
                              onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                              onKeyDown={(e) => e.key === "Enter" && updateCategory()} />
                            <button className="pm-submitBtn" style={{ margin: 0, padding: "8px 12px", fontSize: 12, whiteSpace: "nowrap" }} onClick={updateCategory}>Save</button>
                            <button className="pm-closeIconBtn" onClick={() => setEditingCategory(null)}><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <span style={{ color: "#cbd5e1", fontSize: 14, fontWeight: 500, flex: 1 }}>{cat.name}</span>
                            <button className="pm-iconBtnEdit" onClick={() => setEditingCategory(cat)}><Edit3 size={13} /></button>
                            <button className="pm-iconBtnDelete" onClick={() => deleteCategory(cat.id)}><Trash2 size={13} /></button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── PRODUCT DETAIL PANEL ── */}
        <div style={{
          width: selectedProduct ? 270 : 0, overflow: "hidden", background: "#070f1d",
          borderRight: "1px solid rgba(255,255,255,.06)", flexShrink: 0,
          transition: "width .28s cubic-bezier(.4,0,.2,1)", display: "flex", flexDirection: "column",
        }}>
          {selectedProduct && (
            <div style={{ width: 270, height: "100%" }}>
              <ProductDetailPanel
                key={selectedProduct.id}
                product={selectedProduct}
                categories={categories}
                safeExtra={safeExtra}
                currentUser={currentUser}
                viewMode={effectiveTab}
                onEdit={openEdit}
                onToggleActive={toggleActive}
                onDelete={deleteProduct}
                onApprove={(p) => setApproveTarget(p)}
                onReject={(p) => setRejectTarget(p)}
                onResubmit={resubmitProduct}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Action tabs: Products / Orders / Analysis (like ExchangeDashboard) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 20px 12px 25px", flexShrink: 0 }}>
          {MAIN_TABS.map(({ key, label, icon: Icon, count }) => {
            const active = mainView === key;
            return (
              <button key={key} onClick={() => setMainView(key)}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", height: 32, boxSizing: "border-box",
                  cursor: "pointer", borderRadius: 9, fontSize: 12, fontWeight: active ? 700 : 600,
                  background: active ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,.03)",
                  border: `1px solid ${active ? "#3b82f6" : "rgba(255,255,255,.08)"}`,
                  color: active ? "white" : "#8a96ab", transition: "all 0.2s",
                }}
              >
                <Icon size={13} />{label}
                {count != null && (
                  <span style={{
                    background: active ? "rgba(96,165,250,0.2)" : "rgba(100,116,139,0.15)",
                    color: active ? "#60a5fa" : "#64748b",
                    borderRadius: 99, padding: "1px 7px", fontSize: 11, fontWeight: 700,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── PRODUCTS VIEW ── */}
        {mainView === "products" && (
          <>
            {(effectiveTab === "pending" || effectiveTab === "rejected") && (
              <div style={{
                padding: "10px 28px",
                background: effectiveTab === "pending" ? "rgba(234,179,8,0.05)" : "rgba(239,68,68,0.05)",
                borderBottom: `1px solid ${effectiveTab === "pending" ? "rgba(234,179,8,0.12)" : "rgba(239,68,68,0.12)"}`,
                display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
              }}>
                {effectiveTab === "pending"
                  ? <><Clock size={13} color="#eab308" /><span style={{ color: "#a3935a", fontSize: 12 }}>Products below are awaiting your approval. You must set <strong style={{ color: "#eab308" }}>system commission</strong> and <strong style={{ color: "#eab308" }}>reward percent</strong> before approving.</span></>
                  : <><XCircle size={13} color="#ef4444" /><span style={{ color: "#a36060", fontSize: 12 }}>These products were rejected. Admins can resubmit them after making corrections.</span></>
                }
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: "4px 32px 32px", scrollbarWidth: "thin", scrollbarColor: "#1e293b #060b16" }}>
              <ProductGrid
                products={currentProducts}
                categories={categories}
                safeExtra={safeExtra}
                user={currentUser}
                isMaster={isMaster}
                onEdit={openEdit}
                onToggleActive={toggleActive}
                onDelete={deleteProduct}
                onApprove={(p) => setApproveTarget(p)}
                onReject={(p) => setRejectTarget(p)}
                onResubmit={resubmitProduct}
                viewMode={effectiveTab}
                loading={loading}
                token={token}
              />
            </div>
          </>
        )}

        {/* ── ORDERS VIEW (merged from OrdersManagement) ── */}
        {mainView === "orders" && (
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", padding: "0 20px 20px 25px" }}>
            <div style={{ background: "#060d1a", border: "1px solid #313d58bc", borderRadius: 15, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ overflowY: "auto", flex: 1, padding: 14 }}>
                {ordersLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[...Array(8)].map((_, i) => (
                      <div key={i} style={{ background: "#0b1424", border: "1px solid #1e293b", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 18 }}>
                        <Sk h={14} w={40} />
                        <Sk h={14} w={110} />
                        <div style={{ flex: "2 1 200px" }}><Sk h={14} w="70%" /></div>
                        <Sk h={20} w={150} />
                        <Sk h={16} w={80} />
                        <Sk h={20} w={90} r={999} />
                        <Sk h={14} w={110} />
                      </div>
                    ))}
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, minHeight: 400, textAlign: "center", color: "#64748b" }}>No orders found</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filteredOrders.map((o) => (
                      <OrderRow
                        key={o.id}
                        o={o}
                        selected={selectedOrder?.id === o.id}
                        onClick={() => openOrder(o)}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYSIS VIEW ── */}
        {mainView === "analysis" && (
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", padding: "0 20px 20px 25px" }}>
            <OrderAnalysisPanel
              visible={true}
              fullWidth
              onClose={() => setMainView("products")}
              isMaster={isMaster}
              hideFilters
              search={unifiedSearch} onSearchChange={setUnifiedSearch}
              dateRange={unifiedDateRange} onDateRangeChange={setUnifiedDateRange}
              selectedAdmin={unifiedAdmin} onAdminChange={setUnifiedAdmin}
              selectedCategory={unifiedCategory} onCategoryChange={setUnifiedCategory}
              currency={unifiedCurrency} onCurrencyChange={setUnifiedCurrency}
              productType={unifiedProductType} onProductTypeChange={setUnifiedProductType}
              metric={analysisMetric} onMetricChange={setAnalysisMetric}
              viewMode={analysisViewMode} onViewModeChange={setAnalysisViewMode}
            />
          </div>
        )}
      </div>
      </div>

      {/* ── ORDER / USER SIDEBARS ── */}
      {selectedOrder && (
        <OrderSidebar
          order={selectedOrder}
          onClose={closeOrderSidebar}
          onRefresh={loadOrders}
          onOpenUser={openUserSidebar}
        />
      )}
      {selectedUser && (
        <UserSidebar
          user={selectedUser}
          onClose={closeUserSidebar}
          onRefresh={loadOrders}
        />
      )}

      {/* ── EDIT MODAL ── */}
      {editingProduct && (
        <div className="pm-modalOverlay" onClick={(e) => e.target === e.currentTarget && setEditingProduct(null)}>
          <div className="pm-modalCard">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <div style={{ color: "white", fontWeight: 700, fontSize: 18 }}>Editing Product</div>
                <div style={{ color: "#63748cff", fontSize: 14, marginTop: 3 }}>{editingProduct.name}</div>
              </div>
              <button className="pm-closeIconBtn" onClick={() => setEditingProduct(null)}><X size={16} /></button>
            </div>
            <ProductForm
              users = {users}
              data={editingProduct} setData={setEditingProduct} token={token}
              onSubmit={updateProduct} submitLabel="Save Changes"
              onCancel={() => setEditingProduct(null)}
              featureInput={featureInput} setFeatureInput={setFeatureInput}
              categories={categories} currencies={currencies} networks={networks} isMaster={currentUser.role === "master"} 
            />
          </div>
        </div>
      )}

      {/* ── APPROVE MODAL ── */}
      {approveTarget && (
        <ApproveModal
          product={approveTarget}
          onConfirm={approveProduct}
          onClose={() => setApproveTarget(null)}
        />
      )}

      {/* ── REJECT MODAL ── */}
      {rejectTarget && (
        <RejectModal
          product={rejectTarget}
          onConfirm={rejectProduct}
          onClose={() => setRejectTarget(null)}
        />
      )}

    </div>
  );
}