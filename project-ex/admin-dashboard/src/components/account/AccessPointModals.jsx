import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { S, T, fmtMoney } from "./SubscriptionTheme";
import ACCESS_OPTIONS from "../../constants/AccessPoints";

// =========================================================
// ADD — single modal: key, label, minimum-plan requirements,
// and pricing (with a Free toggle per pair) all in one place.
// =========================================================
export function AccessPointAddModal({ plans, pairOptions, onClose, onCreate }) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [requiredPlanIds, setRequiredPlanIds] = useState([]);
  const [prices, setPrices] = useState([]); // { currency_id, network_id, pairLabel, price, discount_percent }
  const [draft, setDraft] = useState({ pair: "", price: "", discount: "", free: false });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const toggleRequiredPlan = (planId) => {
    setRequiredPlanIds((prev) => (prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]));
  };

  const addPriceRow = () => {
    if (!draft.pair) return;
    const [cid, nid] = draft.pair.split(":");
    const pairLabel = pairOptions.find((p) => p.currency_id === Number(cid) && p.network_id === Number(nid))?.label || "";
    setPrices((prev) => [
      ...prev,
      { currency_id: Number(cid), network_id: Number(nid), pairLabel, price: draft.free ? 0 : Number(draft.price || 0), discount_percent: Number(draft.discount || 0) },
    ]);
    setDraft({ pair: "", price: "", discount: "", free: false });
  };

  const removePriceRow = (idx) => setPrices((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!key.trim() || !label.trim()) { setErr("Key and label are both required."); return; }
    setSaving(true);
    setErr("");
    try {
      await onCreate(
        { key: key.trim(), label: label.trim(), is_active: true, required_plan_ids: requiredPlanIds },
        prices.map(({ currency_id, network_id, price, discount_percent }) => ({ currency_id, network_id, price, discount_percent }))
      );
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to create access point.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>New access point</div>
            <div style={S.modalSubtitle}>Make an existing RBAC permission sellable — set its plan eligibility and price right away.</div>
          </div>
          <button type="button" onClick={onClose} style={S.closeBtn}><X size={14} /></button>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div style={{ ...S.fieldStack, flex: 1, minWidth: 220 }}>
            <span style={S.label}>Permission key</span>
            <input list="known-access-keys" value={key} onChange={(e) => setKey(e.target.value)} style={S.input} placeholder="e.g. exchange.manage" />
            <datalist id="known-access-keys">
              {ACCESS_OPTIONS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </datalist>
          </div>
          <div style={{ ...S.fieldStack, flex: 1, minWidth: 220 }}>
            <span style={S.label}>Display label</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} style={S.input} placeholder="Shown to admins on the card" />
          </div>
        </div>

        <div>
          <div style={S.sectionLabel}>Minimum plan requirement</div>
          <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 4 }}>
            Pick every plan that should unlock this as a purchasable add-on. Leave empty to let any admin buy it.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {plans.map((p) => (
              <button key={p.id} type="button" onClick={() => toggleRequiredPlan(p.id)} style={S.chip(requiredPlanIds.includes(p.id), "#8b5cf6")}>
                {p.name}
              </button>
            ))}
            {plans.length === 0 && <span style={{ fontSize: 12, color: T.textFaint }}>No plans created yet.</span>}
          </div>
        </div>

        <hr style={S.divider} />

        <div>
          <div style={S.sectionLabel}>Pricing</div>
          {prices.length > 0 && (
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {prices.map((p, idx) => (
                <div key={idx} style={rowStyle}>
                  <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{p.pairLabel}</span>
                  {p.price === 0 ? (
                    <span style={{ fontWeight: 800, fontSize: 13, color: "#10b981" }}>Free</span>
                  ) : (
                    <span style={{ fontWeight: 800, fontSize: 13, color: "#8b5cf6" }}>
                      {fmtMoney(p.price)} {p.discount_percent > 0 ? `(-${p.discount_percent}%)` : ""}
                    </span>
                  )}
                  <button type="button" onClick={() => removePriceRow(idx)} style={{ ...S.iconBtn, color: "#f87171", borderColor: "rgba(239,68,68,.3)" }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
          <PriceDraftRow draft={draft} setDraft={setDraft} pairOptions={pairOptions} onAdd={addPriceRow} />
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>You can add more currency/network prices later from the card's edit button too.</div>
        </div>

        {err && <div style={{ fontSize: 12.5, color: "#fca5a5" }}>{err}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={submit} disabled={saving} style={S.primaryBtn}>{saving ? "Creating…" : "Create access point"}</button>
          <button type="button" onClick={onClose} style={S.ghostBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// EDIT — label, active, minimum-plan requirements (multi),
// pricing (with Free toggle), and delete.
// =========================================================
export function AccessPointEditModal({ ap, plans, pairOptions, onClose, onUpdateMeta, onSetPrice, onDeletePrice, onDelete }) {
  const [label, setLabel] = useState(ap.label);
  const currentRequiredIds = (ap.required_plans || []).map((p) => p.id);

  const toggleRequiredPlan = (planId) => {
    const next = currentRequiredIds.includes(planId)
      ? currentRequiredIds.filter((id) => id !== planId)
      : [...currentRequiredIds, planId];
    onUpdateMeta({ required_plan_ids: next });
  };

  return (
    <div style={S.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>Edit access point — {ap.label}</div>
            <div style={S.modalSubtitle}>Key: <code style={{ color: "#93c5fd" }}>{ap.key}</code></div>
          </div>
          <button type="button" onClick={onClose} style={S.closeBtn}><X size={14} /></button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => onUpdateMeta({ is_active: !ap.is_active })} style={S.ghostBtn}>
            {ap.is_active ? "Deactivate" : "Activate"}
          </button>
          <button type="button" onClick={onDelete} style={S.dangerBtn}>
            <Trash2 size={13} /> Delete access point
          </button>
        </div>

        <div style={S.fieldStack}>
          <span style={S.label}>Display label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => label.trim() && label !== ap.label && onUpdateMeta({ label: label.trim() })} style={S.input} />
        </div>

        <div>
          <div style={S.sectionLabel}>Minimum plan requirement</div>
          <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 4 }}>
            Any plan selected here can purchase this as an add-on. None selected = open to everyone.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {plans.map((p) => (
              <button key={p.id} type="button" onClick={() => toggleRequiredPlan(p.id)} style={S.chip(currentRequiredIds.includes(p.id), "#8b5cf6")}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <hr style={S.divider} />

        <div style={S.sectionLabel}>Pricing</div>
        {ap.prices.length === 0 ? (
          <div style={{ fontSize: 13, color: T.textFaint }}>No prices set — add one below.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {ap.prices.map((p) => (
              <PriceRow key={p.id} price={p} onSave={(price, discount) => onSetPrice(p.currency_id, p.network_id, price, discount)} onDelete={() => onDeletePrice(p.id)} />
            ))}
          </div>
        )}
        <PriceAdder pairOptions={pairOptions} onSave={(cid, nid, price, discount) => onSetPrice(cid, nid, price, discount)} />
      </div>
    </div>
  );
}

// ── shared bits ─────────────────────────────────────────

function PriceDraftRow({ draft, setDraft, pairOptions, onAdd }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 10 }}>
      <select value={draft.pair} onChange={(e) => setDraft((d) => ({ ...d, pair: e.target.value }))} style={{ ...S.input, width: 180 }}>
        <option value="">Select pair…</option>
        {pairOptions.map((p, i) => <option key={i} value={`${p.currency_id}:${p.network_id}`}>{p.label}</option>)}
      </select>
      <input
        placeholder="Price"
        type="number"
        value={draft.free ? 0 : draft.price}
        disabled={draft.free}
        onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
        style={{ ...S.input, width: 90, opacity: draft.free ? 0.5 : 1 }}
      />
      <input
        placeholder="Discount %"
        type="number"
        value={draft.discount}
        disabled={draft.free}
        onChange={(e) => setDraft((d) => ({ ...d, discount: e.target.value }))}
        style={{ ...S.input, width: 100, opacity: draft.free ? 0.5 : 1 }}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#cbd5e1", cursor: "pointer" }}>
        <input type="checkbox" checked={draft.free} onChange={(e) => setDraft((d) => ({ ...d, free: e.target.checked }))} />
        Free
      </label>
      <button type="button" style={S.primaryBtn} onClick={onAdd}><Plus size={13} /> Add price</button>
    </div>
  );
}

function PriceRow({ price, onSave, onDelete }) {
  const [free, setFree] = useState(price.price === 0);
  const [p, setP] = useState(price.price);
  const [d, setD] = useState(price.discount_percent);

  const save = (nextFree, nextP, nextD) => onSave(nextFree ? 0 : nextP, nextFree ? 0 : nextD);

  return (
    <div style={rowStyle}>
      <span style={{ fontWeight: 700, fontSize: 13 }}>{price.currency}/{price.network}</span>
      <input type="number" value={free ? 0 : p} disabled={free} onChange={(e) => setP(e.target.value)} onBlur={() => save(free, p, d)} style={{ ...S.input, width: 90, opacity: free ? 0.5 : 1 }} />
      <input type="number" value={free ? 0 : d} disabled={free} onChange={(e) => setD(e.target.value)} onBlur={() => save(free, p, d)} style={{ ...S.input, width: 80, opacity: free ? 0.5 : 1 }} />
      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#cbd5e1", cursor: "pointer" }}>
        <input type="checkbox" checked={free} onChange={(e) => { setFree(e.target.checked); save(e.target.checked, p, d); }} />
        Free
      </label>
      <span style={{ fontWeight: 800, fontSize: 13, color: free ? "#10b981" : "#8b5cf6", minWidth: 60, textAlign: "right" }}>
        {free ? "Free" : fmtMoney(price.effective_price)}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, color: price.is_active ? "#22c55e" : "#94a3b8", background: price.is_active ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.08)", border: `1px solid ${price.is_active ? "rgba(34,197,94,0.25)" : "rgba(148,163,184,0.2)"}`, borderRadius: 999, padding: "3px 8px" }}>
        {price.is_active ? "ACTIVE" : "OFF"}
      </span>
      <button type="button" onClick={onDelete} style={{ ...S.iconBtn, color: "#f87171", borderColor: "rgba(239,68,68,.3)" }}><Trash2 size={13} /></button>
    </div>
  );
}

function PriceAdder({ pairOptions, onSave }) {
  const [pair, setPair] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [free, setFree] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 4 }}>
      <select value={pair} onChange={(e) => setPair(e.target.value)} style={{ ...S.input, width: 180 }}>
        <option value="">Select pair…</option>
        {pairOptions.map((p, i) => <option key={i} value={`${p.currency_id}:${p.network_id}`}>{p.label}</option>)}
      </select>
      <input placeholder="Price" type="number" value={free ? 0 : price} disabled={free} onChange={(e) => setPrice(e.target.value)} style={{ ...S.input, width: 100, opacity: free ? 0.5 : 1 }} />
      <input placeholder="Discount %" type="number" value={free ? 0 : discount} disabled={free} onChange={(e) => setDiscount(e.target.value)} style={{ ...S.input, width: 100, opacity: free ? 0.5 : 1 }} />
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#cbd5e1", cursor: "pointer" }}>
        <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} />
        Free
      </label>
      <button
        type="button"
        style={S.primaryBtn}
        onClick={() => {
          if (!pair) return;
          const [cid, nid] = pair.split(":");
          onSave(cid, nid, free ? 0 : price, free ? 0 : discount);
          setPair(""); setPrice(""); setDiscount(""); setFree(false);
        }}
      >
        <Plus size={13} /> Add price
      </button>
    </div>
  );
}

const rowStyle = {
  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
  borderRadius: T.radiusSm, border: "1px solid rgba(148,163,184,0.12)", background: "#0b1220",
};