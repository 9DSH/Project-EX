import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Upload, Plus, Layers, RefreshCcw, Edit3, Trash2, Power, Package,
  X, Tag, Search, Grid3X3, Clock, CheckCircle, XCircle, ShieldCheck,
  AlertTriangle, ChevronDown, DollarSign, Percent
} from "lucide-react";
import { API_URL } from "../config";
import { hasPermission } from "../utils/permissions";

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
    <div style={S.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modalCard, maxWidth: 420, height: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={18} /> Approve Product
            </div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>{product?.name}</div>
          </div>
          <button style={S.closeIconBtn} onClick={onClose}><X size={16} /></button>
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
                style={{ ...S.input, paddingLeft: 30 }}
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
                style={{ ...S.input, paddingLeft: 30 }}
                placeholder="e.g. 5.00"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
              />
            </div>
          </Field>

          {error && <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>{error}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              style={{ ...S.submitBtn, background: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.3)", color: "#22c55e" }}
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
    <div style={S.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modalCard, maxWidth: 400, height: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <XCircle size={18} /> Reject Product
            </div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>{product?.name}</div>
          </div>
          <button style={S.closeIconBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Rejection Reason (optional)">
            <textarea
              style={{ ...S.textarea, minHeight: 90 }}
              placeholder="Explain why this product is being rejected…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              style={{ ...S.submitBtn, background: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.3)", color: "#ef4444" }}
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
                <input style={S.input} placeholder="Netflix Premium" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
              </Field>
              <Field label="Plan">
                <input style={S.input} placeholder="1 Month" value={data.plan} onChange={(e) => setData({ ...data, plan: e.target.value })} />
              </Field>
            </div>
            <Field label="Description">
              <textarea style={S.textarea} placeholder="Short description..." value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Category">
              <select style={S.input} value={data.category_id} onChange={(e) => setData({ ...data, category_id: e.target.value })}>
                {[{ id: "__none__", name: "Select…" }, ...categories].map((c) => (
                  <option key={c.id} value={c.id === "__none__" ? "" : c.id}>{c.name}</option>
                ))}
              </select>
              </Field>
              <Field label="Stock">
                <input type="number" style={S.input} value={data.stock} onChange={(e) => setData({ ...data, stock: e.target.value })} />
              </Field>
              <Field label="Product Owner">
            <select style={S.input} value={data.admin_id || ""} onChange={(e) => setData({ ...data, admin_id: e.target.value ? Number(e.target.value) : null })}>
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
                <select style={S.input} value={data.currency} onChange={handleCurrencyChange}>
                  {currencies.map((c) => <option key={c.id} value={c.symbol || c.code || c.name}>{c.symbol || c.code || c.name}</option>)}
                </select>
              </Field>
              {isCrypto && (
                <Field label="Network">
                  <select style={S.input} value={data.network} onChange={(e) => setData({ ...data, network: e.target.value })}>
                    {networks.map((n) => <option key={n.id} value={n.name}>{n.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Price">
                <input type="number" style={S.input} value={data.price} onChange={(e) => setData({ ...data, price: e.target.value })} />
              </Field>
              <Field label="Discount (%)">
                <input type="number" style={S.input} value={data.discount_percent} onChange={(e) => setData({ ...data, discount_percent: e.target.value })} />
              </Field>

            </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: "160px" }}>           
              <Field label="System Commission">
              <input
                type="number"
                style={{
                  ...S.input,
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
                style={{
                  ...S.input,
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
              <Field label="Days"><input type="number" style={S.input} placeholder="30" value={data.validity_days} onChange={(e) => setData({ ...data, validity_days: e.target.value })} /></Field>
              <Field label="Hours"><input type="number" style={S.input} placeholder="48" value={data.validity_hours} onChange={(e) => setData({ ...data, validity_hours: e.target.value })} /></Field>
              <Field label="Volume (GB)"><input type="number" style={S.input} placeholder="10" value={data.data_volume_gb} onChange={(e) => setData({ ...data, data_volume_gb: e.target.value })} /></Field>
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
                          style={{
                            ...S.chip,
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
                      style={S.input}
                    />
                    <input
                      placeholder="Key (no spaces)"
                      value={customField.key}
                      onChange={(e) => setCustomField({ ...customField, key: e.target.value.replace(/\s/g, "_") })}
                      style={S.input}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                    <select
                      value={customField.type}
                      onChange={(e) => setCustomField({ ...customField, type: e.target.value })}
                      style={S.input}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <select
                      value={customField.step}
                      onChange={(e) => setCustomField({ ...customField, step: e.target.value })}
                      style={S.input}
                    >
                        {FIELD_STEPS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={addCustomField}
                    style={{ ...S.addFeatureBtn, marginTop: 10, padding: "9px 16px", borderRadius: 10 }}
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
                        <span key={key} style={S.chip} onClick={() => {
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
              <Field label="Provider"><input style={S.input} placeholder="Netflix" value={data.extra_data?.provider || ""} onChange={(e) => setData({ ...data, extra_data: { ...data.extra_data, provider: e.target.value } })} /></Field>
              <Field label="Region"><input style={S.input} placeholder="Worldwide" value={data.extra_data?.region || ""} onChange={(e) => setData({ ...data, extra_data: { ...data.extra_data, region: e.target.value } })} /></Field>
            </div>
            {data.id && (
              <Field label="Delivery"><input style={S.input} placeholder="Instant" value={data.extra_data?.delivery || ""} onChange={(e) => setData({ ...data, extra_data: { ...data.extra_data, delivery: e.target.value } })} /></Field>
            )}
            <Field label="Features">
              <div style={{ display: "flex", gap: 8 }}>
                <input style={S.input} placeholder="e.g. 4K Streaming" value={featureInput} onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && featureInput) {
                      setData({ ...data, extra_data: { ...data.extra_data, features: [...(data.extra_data?.features || []), featureInput] } });
                      setFeatureInput("");
                    }
                  }} />
                <button style={S.addFeatureBtn} onClick={() => {
                  if (!featureInput) return;
                  setData({ ...data, extra_data: { ...data.extra_data, features: [...(data.extra_data?.features || []), featureInput] } });
                  setFeatureInput("");
                }}>Add</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
                {(data.extra_data?.features || []).map((f, i) => (
                  <span key={i} style={S.chip} onClick={() => {
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
        {onCancel && <button style={S.cancelBtn} onClick={onCancel}>Cancel</button>}
        <button style={S.submitBtn} onClick={onSubmit}>{submitLabel}</button>
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
    <div style={S.productCard}>
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
          {p.discount_percent && <span style={S.discountBadge}>🏷️{p.discount_percent}%</span>}
          {p.is_featured && <span style={S.featuredBadge}>★ Featured</span>}
        </div>
      </div>

      {/* Identity */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", borderBottom: "1px dotted #47556978", paddingBottom: 10 }}>
        <div style={{ width: 60, height: 60, borderRadius: 12, border: "1px solid #313d58", background: "#0b1525", display: "flex", alignItems: "center", justifyContent: "center", padding: 8, boxSizing: "border-box", overflow: "hidden", flexShrink: 0 }}>
          {p.icon_path ? (
            <img src={`${API_URL}${p.icon_path}`} alt={p.name} style={{ width: "100%", height: "100%", borderRadius: 8, objectFit: "cover" }} />
          ) : (
            <div style={S.avatar}>{p.name?.[0]?.toUpperCase() || "?"}</div>
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
        {p.plan && <span style={S.planBadge}>{p.plan}</span>}
        {p.product_type && <span style={S.typeBadge}>{p.product_type}</span>}
        {extra.region && <span style={S.regionBadge}>🌍 {extra.region}</span>}
        {extra.provider && <span style={S.typeBadge}>{extra.provider}</span>}
        {(extra.features || []).slice(0, 2).map((f, i) => <span key={i} style={S.typeBadge}>{f}</span>)}
      </div>

      {/* Rejection reason */}
      {viewMode === "rejected" && p.rejection_reason && (
        <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#f87171", lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700 }}>Reason: </span>{p.rejection_reason}
        </div>
      )}

      <div style={{ marginTop: "auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingBottom: 10 }}>
          <span style={S.metaPill}>📦 {p.stock ?? "∞"}</span>
          {p.network && <span style={S.metaPill}>🌐 {p.network}</span>}
          <span style={S.metaPill}>⏳ {p.validity_days || 0}d{p.validity_hours ? ` ${p.validity_hours}h` : ""}</span>
          {p.data_volume_gb && <span style={S.metaPill}>💾 {p.data_volume_gb}GB</span>}
          {p.is_recurring && <span style={S.metaPill}>🔁 Recurring</span>}
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
              style={{ ...S.cardBtnEdit }}
              onClick={() => onEdit(p)}
            >
              <Edit3 size={12} style={{ marginRight: 5 }} /> Edit
            </button>
          )}

          {/* Toggle active */}
          {(viewMode === "all" || viewMode === "my") && hasPermission(user, "products.management") && (
            <button
              style={{
                ...S.cardBtnToggle,
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
            <button style={S.cardBtnDelete} onClick={() => onDelete(p.id)}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
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
  const [activeTab, setActiveTab]           = useState("all"); // "all" | "my" | "pending" | "rejected"
  const [search, setSearch]                 = useState("");
  const [panel, setPanel]                   = useState(null);  // null | "add-product" | "add-category"
  const [form, setForm]                     = useState(emptyForm());
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName]     = useState("");
  const [featureInput, setFeatureInput]     = useState("");

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

  // ── FILTERED DATA ──
  const filterProducts = (list) => {
    const q = search.toLowerCase();
    return list.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.plan?.toLowerCase().includes(q) ||
      p.product_type?.toLowerCase().includes(q) ||
      String(p.admin_id || "").includes(q)
    );
  };

  const currentProducts = useMemo(() => {
    const map = { all: allProducts, my: myProducts, pending: pendingProducts, rejected: rejectedProducts };
    return filterProducts(map[activeTab] || []);
  }, [activeTab, allProducts, myProducts, pendingProducts, rejectedProducts, search]);

  // ── STATS ──
  const activeCount = useMemo(() => allProducts.filter(p => p.is_active).length, [allProducts]);
  const panelOpen   = panel !== null;

  // ── TABS CONFIG ──
  const tabs = [
    hasPermission(currentUser, "products.view") && { id: "all", label: "All Products", icon: Package, count: allProducts.length, accent: "#3b82f6" },
    { id: "my", label: "My Products", icon: ShieldCheck, count: myProducts.length, accent: "#8b5cf6" },
    currentUser.role === "master" && { id: "pending", label: "Pending Approval", icon: Clock, count: pendingProducts.length, accent: "#eab308" },
    currentUser.role === "master" && { id: "rejected", label: "Rejected", icon: XCircle, count: rejectedProducts.length, accent: "#ef4444" },
  ].filter(Boolean);

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
      height: "100vh", 
      background: "#060b16", 
      overflow: "hidden", 
      padding:"5px ",
      fontFamily: "'Inter', sans-serif" }}>
       

      {/* ── LEFT SIDEBAR PANEL ── */}
      <div style={{
        width: panelOpen ? 380 : 0, minWidth: panelOpen ? 380 : 0,
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
        borderRight: panelOpen ? "1px solid #0f172a" : "none",
        background: "#080e1a", display: "flex", flexDirection: "column",
      }}>
        <div style={{ width: 380, height: "100%", display: "flex", flexDirection: "column", padding: 24, boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <div style={{ color: "white", fontWeight: 700, fontSize: 18 }}>
                {panel === "add-product" ? "New Product" : "Manage Categories"}
              </div>
              <div style={{ color: "#63748dff", fontSize: 14, marginTop: 3 }}>
                {panel === "add-product" ? "Fill in the details below" : "Add or edit categories"}
              </div>
            </div>
            <button onClick={() => setPanel(null)} style={S.closeIconBtn}><X size={16} /></button>
          </div>

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
            <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, overflow: "hidden" }}>
              <div style={{ background: "#050a14", border: "1px solid #1d2b4bff", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>New Category</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...S.input, flex: 1 }} placeholder="Category name…" value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCategory()} />
                  <button style={{ ...S.submitBtn, width: "auto", padding: "0 18px", margin: 0 }} onClick={addCategory}>Add</button>
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
                        <input style={{ ...S.input, flex: 1, padding: "8px 12px", fontSize: 13 }}
                          value={editingCategory.name}
                          onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && updateCategory()} />
                        <button style={{ ...S.submitBtn, margin: 0, padding: "8px 12px", fontSize: 12, whiteSpace: "nowrap" }} onClick={updateCategory}>Save</button>
                        <button style={S.closeIconBtn} onClick={() => setEditingCategory(null)}><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <span style={{ color: "#cbd5e1", fontSize: 14, fontWeight: 500, flex: 1 }}>{cat.name}</span>
                        <button style={S.iconBtnEdit} onClick={() => setEditingCategory(cat)}><Edit3 size={13} /></button>
                        <button style={S.iconBtnDelete} onClick={() => deleteCategory(cat.id)}><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={S.topBar}>
          <div style={S.header}>
          <div>
            <div style={S.title}>Products Management</div>
            <div style={S.subtitle}>Manage your catalog, products and categories</div>
          </div>
            <StatPill icon={Package} label="Active Products" value={`${activeCount} / ${allProducts.length}`} accent="#10b981" loading={loading} />
            <StatPill icon={Tag} label="Categories" value={categories.length} accent="#dab822ff" loading={loading} />
            {currentUser.role === "master" && <StatPill icon={Clock} label="Pending" value={pendingProducts.length} accent="#eab308" loading={loading} />}
          </div>
        </div>

        {/* Tab nav + toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", borderBottom: "1px solid #0d1829", background: "#060b16", flexShrink: 0 }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 7 }}>
            {tabs.map(({ id, label, icon: Icon, count, accent }) => {
              const active = activeTab === id;
              return (
                <button key={id} onClick={() => setActiveTab(id)}
                  style={{
                    display: "flex", 
                    alignItems: "center", 
                    gap: 7,
                    padding: "6px 10px",
                    cursor: "pointer",
                     borderRadius: 8,
                    fontSize: 12, 
                    fontWeight: active ? 700 : 500,
                    background: active   ? accent + "22"
                      : "rgba(59,130,246,0.12)",
                    border: `1px solid ${ active 
                      ? accent
                      : "rgba(59,130,246,0.3)"
                  }`,
                    color: active ? "white" : "#64748b",
                    transition: "all 0.15s",
                    marginBottom: -1,
                  }}
                >
                  {label}
                  {count > 0 && (
                    <span style={{
                      background: active ? accent + "22" : "#02050aff",
                      border: `1px solid ${active ? accent + "44" : "#1e293b"}`,
                      color: active ? "white" : "#778ca8ff",
                      fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
                    }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#334155" }} />
              <input
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...S.input, width: 220, paddingLeft: 34, height: 38, fontSize: 13 }}
              />
            </div>
            <button onClick={loadData} disabled={loading} style={S.refreshBtn}>
              <RefreshCcw size={13} style={{ marginRight: 6, opacity: loading ? 0.5 : 1 }} />
              {loading ? "…" : "Refresh"}
            </button>
            <PermButton permission="categories.manage"
              onClick={() => setPanel(panel === "add-category" ? null : "add-category")}
              style={{
                ...S.actionBtn,
                background: panel === "add-category" ? "rgba(99,102,241,0.2)" : "transparent",
                borderColor: panel === "add-category" ? "#6366f1" : "#1e293b",
                color: panel === "add-category" ? "#a5b4fc" : "#64748b",
              }}
            >
              <Grid3X3 size={14} style={{ marginRight: 7 }} />
              Categories
            </PermButton>
            <PermButton permission="products.create"
              onClick={() => setPanel(panel === "add-product" ? null : "add-product")}
              style={{
                ...S.actionBtn,
                background: panel === "add-product" ? "rgba(59,130,246,0.25)" : "rgba(59,130,246,0.12)",
                borderColor: panel === "add-product" ? "#3b82f6" : "rgba(59,130,246,0.3)",
                color: panel === "add-product" ? "white" : "#60a5fa",
              }}
            >
              <Plus size={14} style={{ marginRight: 7 }} />
              Add Product
            </PermButton>
          </div>
        </div>

        {/* Tab description strip for pending/rejected */}
        {(activeTab === "pending" || activeTab === "rejected") && (
          <div style={{
            padding: "10px 28px",
            background: activeTab === "pending" ? "rgba(234,179,8,0.05)" : "rgba(239,68,68,0.05)",
            borderBottom: `1px solid ${activeTab === "pending" ? "rgba(234,179,8,0.12)" : "rgba(239,68,68,0.12)"}`,
            display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          }}>
            {activeTab === "pending"
              ? <><Clock size={13} color="#eab308" /><span style={{ color: "#a3935a", fontSize: 12 }}>Products below are awaiting your approval. You must set <strong style={{ color: "#eab308" }}>system commission</strong> and <strong style={{ color: "#eab308" }}>reward percent</strong> before approving.</span></>
              : <><XCircle size={13} color="#ef4444" /><span style={{ color: "#a36060", fontSize: 12 }}>These products were rejected. Admins can resubmit them after making corrections.</span></>
            }
          </div>
        )}

        {/* Products scrollable area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 32px 32px", scrollbarWidth: "thin", scrollbarColor: "#1e293b #060b16" }}>
          <ProductGrid
            products={currentProducts}
            categories={categories}
            safeExtra={safeExtra}
            user={currentUser}
            isMaster={currentUser.role === "master"}
            onEdit={openEdit}
            onToggleActive={toggleActive}
            onDelete={deleteProduct}
            onApprove={(p) => setApproveTarget(p)}
            onReject={(p) => setRejectTarget(p)}
            onResubmit={resubmitProduct}
            viewMode={activeTab}
            loading={loading}
            token={token}
          />
        </div>
      </div>

      {/* ── EDIT MODAL ── */}
      {editingProduct && (
        <div style={S.modalOverlay} onClick={(e) => e.target === e.currentTarget && setEditingProduct(null)}>
          <div style={S.modalCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <div style={{ color: "white", fontWeight: 700, fontSize: 18 }}>Editing Product</div>
                <div style={{ color: "#63748cff", fontSize: 14, marginTop: 3 }}>{editingProduct.name}</div>
              </div>
              <button style={S.closeIconBtn} onClick={() => setEditingProduct(null)}><X size={16} /></button>
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

      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────
const S = {
  topBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
     borderBottom: "1px solid #0a1120",
    background: "#060b16", flexShrink: 0, flexWrap: "wrap", gap: 12,
  },
  refreshBtn: {
    display: "flex", alignItems: "center",
    background: "transparent", border: "1px solid #313d58ff",
    borderRadius: 10, padding: "8px 14px", color: "#6c798dff",
    cursor: "pointer", fontWeight: 600, fontSize: 13,
  },
  actionBtn: {
    display: "flex", alignItems: "center",
    border: "1px solid", borderRadius: 10,
    padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13,
    transition: "all 0.2s",
  },
  input: {
    background: "#060d1a", border: "1px solid #313d58ff", color: "white",
    padding: "10px 13px", borderRadius: 10, outline: "none", fontSize: 13,
    width: "100%", boxSizing: "border-box", transition: "border-color 0.15s",
  },
  textarea: {
    width: "100%", minHeight: 80, background: "#060d1a",
    border: "1px solid #313d58ff", color: "white", padding: 12,
    borderRadius: 10, resize: "vertical", fontSize: 13,
    lineHeight: 1.6, boxSizing: "border-box", outline: "none",
  },
  submitBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    flex: 1, background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.35)",
    color: "#60a5fa", padding: "10px 20px", borderRadius: 10,
    cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.15s",
  },
  cancelBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "transparent", border: "1px solid #313d58ff",
    color: "#475569", padding: "10px 16px", borderRadius: 10,
    cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap",
  },
  addFeatureBtn: {
    background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)",
    padding: "0 16px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13, flexShrink: 0,
  },
  chip: {
    background: "#0b1525", border: "1px solid #313d58ff", color: "#94a3b8",
    padding: "5px 11px", borderRadius: 99, fontSize: 12, cursor: "pointer",
    display: "inline-flex", alignItems: "center",
  },
  closeIconBtn: {
    background: "#0b1525", border: "1px solid #313d58ff", color: "#475569",
    width: 32, height: 32, borderRadius: 8, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  iconBtnEdit: {
    background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
    color: "#60a5fa", width: 30, height: 30, borderRadius: 8,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  iconBtnDelete: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
    color: "#ef4444", width: 30, height: 30, borderRadius: 8,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  productCard: {
    flexShrink: 0, width: 278, minHeight: 300,
    background: "#0b1424", border: "1px solid #313d58bc",
    borderRadius: 18, padding: 16, display: "flex",
    flexDirection: "column", gap: 11, boxSizing: "border-box", alignSelf: "stretch",
  },
  avatar: {
    width: 40, height: 40, borderRadius: 12, background: "#0b1525",
    border: "1px solid #313d58ff", display: "flex", alignItems: "center",
    justifyContent: "center", fontSize: 17, fontWeight: 800, color: "#3b82f6", flexShrink: 0,
  },
  planBadge: { background: "#0d1e3a", border: "1px solid #313d58ff", padding: "3px 9px", borderRadius: 99, fontSize: 12, color: "#60a5fa", fontWeight: 600 },
  typeBadge: { background: "#0b1525", border: "1px solid #313d58ff", padding: "3px 9px", borderRadius: 99, fontSize: 12, color: "#5e6d82ff" },
  regionBadge: { background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", padding: "3px 9px", borderRadius: 99, fontSize: 12, color: "#f97316" },
  discountBadge: { background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.25)", padding: "3px 8px", borderRadius: 99, fontSize: 12, color: "#eab308", fontWeight: 700 },
  featuredBadge: { background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.25)", padding: "4px 8px", borderRadius: 99, fontSize: 12, color: "#eab308" },
  metaPill: { background: "#060d1a", border: "1px solid #313d58ff", borderRadius: 7, padding: "3px 8px", fontSize: 12, color: "#5d718dff" },
  cardBtnEdit: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
    borderRadius: 9, padding: "7px 0", color: "#60a5fa", cursor: "pointer", fontWeight: 600, fontSize: 12,
  },
  cardBtnToggle: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
    border: "1px solid", borderRadius: 9, padding: "7px 0", cursor: "pointer", fontWeight: 600, fontSize: 12,
  },
  cardBtnDelete: {
    width: 32, display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 9, color: "#ef4444", cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
    display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999,
    backdropFilter: "blur(4px)",
  },
  modalCard: {
    width: "92%", maxWidth: 820, height: "80vh",
    background: "#080e1a", borderRadius: 24, padding: 28,
    border: "1px solid #0f172a", overflow: "auto",
    scrollbarWidth: "thin", scrollbarColor: "#1e293b #080e1a",
    display: "flex", flexDirection: "column",
  },
  
    title: { color: "#2e7ce9af",margin: 0, fontSize: 26, fontWeight: 600, marginRight: 20 , letterSpacing: "0.1rem",   },
  subtitle: { color: "#64748b", fontSize: 13, margin: "2px 0 0" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 14, marginLeft: 20, padding :"10px 0 20px 20px",  flexWrap: "wrap"
  },
};