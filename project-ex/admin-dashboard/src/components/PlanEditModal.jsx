import { useState } from "react";
import { Crown, Plus, Trash2, X } from "lucide-react";
import { S, T, fmtMoney } from "./subscriptionTheme";

const EDIT_TABS = [
  { key: "details", label: "Details" },
  { key: "pricing", label: "Pricing" },
  { key: "access", label: "Access points" },
];

/**
 * Full-control plan editor. All backend writes are delegated to the parent
 * via the callback props so this component stays a dumb, reusable form.
 */
export default function PlanEditModal({
  plan,
  accessPoints,
  pairOptions,
  onClose,
  onUpdateMeta,     // (patch) => Promise
  onSetPrice,       // (currencyId, networkId, price, discount) => Promise
  onDeletePrice,     // (priceId) => Promise
  onToggleAccessPoint, // (ap) => Promise
  onDeletePlan,      // () => Promise
}) {
  const [tab, setTab] = useState("details");
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description || "");
  const [duration, setDuration] = useState(plan.duration_days);
  const [savingMeta, setSavingMeta] = useState(false);

  const saveMeta = async (patch) => {
    setSavingMeta(true);
    try {
      await onUpdateMeta(patch);
    } finally {
      setSavingMeta(false);
    }
  };

  return (
    <div style={S.modalOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>Edit plan — {plan.name}</div>
            <div style={S.modalSubtitle}>Every value on this plan can be changed here.</div>
          </div>
          <button type="button" onClick={onClose} style={S.closeBtn}><X size={14} /></button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {EDIT_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${tab === t.key ? "#3b82f6" : "#223451"}`,
                background: tab === t.key ? "rgba(59,130,246,.16)" : "#0b1628",
                color: tab === t.key ? "#bfdbfe" : "#94a3b8",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "details" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => saveMeta({ is_default: true })}
                disabled={plan.is_default || savingMeta}
                style={{ ...S.ghostBtn, color: plan.is_default ? "#10b981" : "#cbd5e1", opacity: plan.is_default ? 0.7 : 1 }}
              >
                <Crown size={13} /> {plan.is_default ? "Is default plan" : "Make default (free) plan"}
              </button>
              <button type="button" onClick={() => saveMeta({ is_active: !plan.is_active })} disabled={savingMeta} style={S.ghostBtn}>
                {plan.is_active ? "Deactivate plan" : "Activate plan"}
              </button>
              <button type="button" onClick={onDeletePlan} style={S.dangerBtn}>
                <Trash2 size={13} /> Delete plan
              </button>
            </div>

            <div style={S.fieldStack}>
              <span style={S.label}>Plan name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== plan.name && saveMeta({ name: name.trim() })} style={S.input} />
            </div>

            <div style={S.fieldStack}>
              <span style={S.label}>Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => description !== (plan.description || "") && saveMeta({ description })}
                rows={3}
                style={{ ...S.input, resize: "vertical", fontFamily: "inherit" }}
                placeholder="Shown on the plan card, e.g. what this tier is for."
              />
            </div>

            <div style={S.fieldStack}>
              <span style={S.label}>Billing cycle (days)</span>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                onBlur={() => Number(duration) > 0 && Number(duration) !== plan.duration_days && saveMeta({ duration_days: Number(duration) })}
                disabled={plan.is_default}
                style={{ ...S.input, width: 160 }}
              />
              {plan.is_default && <span style={{ fontSize: 11, color: T.textFaint }}>Free plan never expires — duration is ignored.</span>}
            </div>
          </div>
        )}

        {tab === "pricing" && (
          <div style={{ display: "grid", gap: 12 }}>
            {plan.is_default ? (
              <div style={{ fontSize: 13, color: T.textDim }}>The default plan is always free — no pricing needed.</div>
            ) : (
              <>
                {plan.prices.length === 0 ? (
                  <div style={{ fontSize: 13, color: T.textFaint }}>No prices set yet — add one below.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {plan.prices.map((p) => (
                      <PriceRow key={p.id} price={p} onSave={(price, discount) => onSetPrice(p.currency_id, p.network_id, price, discount)} onDelete={() => onDeletePrice(p.id)} />
                    ))}
                  </div>
                )}
                <PriceAdder pairOptions={pairOptions} onSave={(cid, nid, price, discount) => onSetPrice(cid, nid, price, discount)} />
              </>
            )}
          </div>
        )}

        {tab === "access" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={S.sectionLabel}>Fixed access points (auto-granted on subscribe)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {accessPoints.map((ap) => {
                  const included = plan.access_points.some((x) => x.access_point_id === ap.id);
                  return (
                    <button key={ap.id} type="button" onClick={() => onToggleAccessPoint(ap)} style={S.chip(included, "#10b981")}>
                      {ap.label}
                    </button>
                  );
                })}
                {accessPoints.length === 0 && <span style={{ fontSize: 12, color: T.textFaint }}>No access points in the catalog yet.</span>}
              </div>
            </div>

            <div>
              <div style={S.sectionLabel}>Available add-ons</div>
              <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 4 }}>
                Controlled from each access point's "Minimum plan requirement" setting in the Access Points tab — an add-on can list this plan alongside others.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {plan.addons.length === 0 && <span style={{ fontSize: 12, color: T.textFaint }}>None yet</span>}
                {plan.addons.map((ap) => (
                  <span key={ap.id} style={{ fontSize: 11.5, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", color: "#c4b5fd", borderRadius: 999, padding: "5px 11px" }}>
                    {ap.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PriceRow({ price, onSave, onDelete }) {
  const [p, setP] = useState(price.price);
  const [d, setD] = useState(price.discount_percent);
  return (
    <div style={rowStyle}>
      <span style={{ fontWeight: 700, fontSize: 13 }}>{price.currency}/{price.network}</span>
      <input type="number" value={p} onChange={(e) => setP(e.target.value)} onBlur={() => onSave(p, d)} style={{ ...S.input, width: 90 }} />
      <input type="number" value={d} onChange={(e) => setD(e.target.value)} onBlur={() => onSave(p, d)} style={{ ...S.input, width: 80 }} />
      <span style={{ fontWeight: 800, fontSize: 13, color: "#3b82f6", minWidth: 60, textAlign: "right" }}>{fmtMoney(price.effective_price)}</span>
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
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 4 }}>
      <select value={pair} onChange={(e) => setPair(e.target.value)} style={{ ...S.input, width: 180 }}>
        <option value="">Select pair…</option>
        {pairOptions.map((p, i) => (
          <option key={i} value={`${p.currency_id}:${p.network_id}`}>{p.label}</option>
        ))}
      </select>
      <input placeholder="Price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} style={{ ...S.input, width: 100 }} />
      <input placeholder="Discount %" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} style={{ ...S.input, width: 100 }} />
      <button
        type="button"
        style={S.primaryBtn}
        onClick={() => {
          if (!pair) return;
          const [cid, nid] = pair.split(":");
          onSave(cid, nid, price, discount);
          setPair(""); setPrice(""); setDiscount("");
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