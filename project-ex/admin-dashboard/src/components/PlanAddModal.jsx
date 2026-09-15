import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { S, T } from "./subscriptionTheme";

export default function PlanAddModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!name.trim()) { setErr("Give the plan a name."); return; }
    setSaving(true);
    setErr("");
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        duration_days: Number(duration) || 30,
        is_default: isDefault,
        is_active: isActive,
      });
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to create plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, width: "min(520px, 96vw)" }}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>New plan</div>
            <div style={S.modalSubtitle}>Set the basics now — pricing and access points open right after.</div>
          </div>
          <button type="button" onClick={onClose} style={S.closeBtn}><X size={14} /></button>
        </div>

        <div style={S.fieldStack}>
          <span style={S.label}>Plan name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} style={S.input} placeholder="e.g. Growth" />
        </div>

        <div style={S.fieldStack}>
          <span style={S.label}>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...S.input, resize: "vertical", fontFamily: "inherit" }} placeholder="What is this tier for?" />
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div style={S.fieldStack}>
            <span style={S.label}>Billing cycle (days)</span>
            <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={isDefault} style={{ ...S.input, width: 160 }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: "#cbd5e1", cursor: "pointer" }}>
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Default (free) plan
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: "#cbd5e1", cursor: "pointer" }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active immediately
          </label>
        </div>

        {err && <div style={{ fontSize: 12.5, color: "#fca5a5" }}>{err}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={submit} disabled={saving} style={S.primaryBtn}>
            <Sparkles size={13} /> {saving ? "Creating…" : "Create & configure"}
          </button>
          <button type="button" onClick={onClose} style={S.ghostBtn}>Cancel</button>
        </div>
        <div style={{ fontSize: 11, color: T.textFaint, marginTop: -8 }}>
          Every remaining value — pricing, discounts, and fixed access points — is set in the editor that opens next.
        </div>
      </div>
    </div>
  );
}