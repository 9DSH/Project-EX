import { useState } from "react";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { S, T, fmtMoney } from "./SubscriptionTheme";

export default function PlanSwitchModal({ currentPlanName, plan, onClose, onConfirm }) {
  const isFree = plan.is_default;
  const [selectedPriceId, setSelectedPriceId] = useState(plan.prices?.[0]?.id ? String(plan.prices[0].id) : "");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const selectedPrice = plan.prices?.find((p) => String(p.id) === selectedPriceId) || null;

  const confirm = async () => {
    if (!isFree && !selectedPrice) { setErr("Choose a currency / network to pay with."); return; }
    setSubmitting(true);
    setErr("");
    try {
      await onConfirm(isFree ? null : selectedPrice.currency_id, isFree ? null : selectedPrice.network_id);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Switch failed.");
      setSubmitting(false);
    }
  };

  return (
    <div style={S.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, width: "min(480px, 96vw)" }}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>Switch plan</div>
            <div style={S.modalSubtitle}>{currentPlanName || "No plan"} <ArrowRight size={11} style={{ verticalAlign: -1, margin: "0 4px" }} /> {plan.name}</div>
          </div>
          <button type="button" onClick={onClose} style={S.closeBtn}><X size={14} /></button>
        </div>

        <div style={warnBox}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            Switching resets your billing cycle. Any time left on your current plan is not credited —
            {isFree ? " your new free cycle starts today." : " you'll be charged the full plan price below."}
          </div>
        </div>

        {!isFree && (
          <div style={S.fieldStack}>
            <span style={S.label}>Pay with</span>
            <select value={selectedPriceId} onChange={(e) => setSelectedPriceId(e.target.value)} style={S.input}>
              {plan.prices.map((p) => (
                <option key={p.id} value={p.id}>
                  {fmtMoney(p.effective_price)} {p.currency}/{p.network}{p.discount_percent > 0 ? ` (-${p.discount_percent}%)` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={summaryBox}>
          <span style={{ color: T.textDim, fontSize: 12.5 }}>Amount due today</span>
          <span style={{ fontWeight: 900, fontSize: 20, color: "#3b82f6" }}>
            {isFree ? "Free" : selectedPrice ? `${fmtMoney(selectedPrice.effective_price)} ${selectedPrice.currency}` : "—"}
          </span>
        </div>

        {err && <div style={{ fontSize: 12.5, color: "#fca5a5" }}>{err}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={confirm} disabled={submitting} style={S.primaryBtn}>
            {submitting ? "Switching…" : "Confirm & switch"}
          </button>
          <button type="button" onClick={onClose} style={S.ghostBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const warnBox = {
  display: "flex", gap: 10, fontSize: 12.5, lineHeight: 1.5, color: "#fde68a",
  background: "rgba(120,53,15,.18)", border: "1px solid rgba(245,158,11,.35)", borderRadius: T.radiusSm, padding: 12,
};
const summaryBox = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  border: "1px solid rgba(148,163,184,0.14)", borderRadius: T.radiusSm, padding: "12px 14px", background: "#0b1220",
};