export default function PlanCard({ plan, footer, highlight = false }) {
  return (
    <div style={{ ...S.card, borderColor: highlight ? "#3b82f6" : "#223451" }}>
      <div style={S.headerRow}>
        <div style={S.name}>{plan.name}</div>
        {plan.is_default && <span style={S.badgeFree}>FREE</span>}
        {!plan.is_active && <span style={S.badgeInactive}>INACTIVE</span>}
      </div>

      {plan.description && <div style={S.description}>{plan.description}</div>}

      <div style={S.metaRow}>
        <span style={S.metaChip}>⏱ {plan.duration_days} days</span>
        <span style={S.metaChip}>{plan.access_points.length} fixed access point{plan.access_points.length === 1 ? "" : "s"}</span>
      </div>

      <div style={S.section}>
        <div style={S.sectionLabel}>PRICING</div>
        {plan.is_default ? (
          <div style={S.priceLine}><strong>Free</strong></div>
        ) : plan.prices.length === 0 ? (
          <div style={S.subtle}>No pricing configured</div>
        ) : (
          plan.prices.map((p) => (
            <div key={p.id} style={S.priceLine}>
              <span>{p.currency}/{p.network}</span>
              <span>
                {p.discount_percent > 0 && <s style={S.strike}>{p.price}</s>}{" "}
                <strong>{p.effective_price}</strong>
                {p.discount_percent > 0 && <span style={S.discountTag}> -{p.discount_percent}%</span>}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={S.section}>
        <div style={S.sectionLabel}>FIXED ACCESS POINTS</div>
        {plan.access_points.length === 0 ? (
          <div style={S.subtle}>None</div>
        ) : (
          <div style={S.chipWrap}>
            {plan.access_points.map((ap) => (
              <span key={ap.id} style={S.chip}>{ap.label}{ap.choice_group ? ` (${ap.choice_group})` : ""}</span>
            ))}
          </div>
        )}
      </div>

      {plan.addons && plan.addons.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionLabel}>AVAILABLE ADD-ONS</div>
          <div style={S.chipWrap}>
            {plan.addons.map((ap) => (
              <span key={ap.id} style={S.chipAddon}>{ap.label}</span>
            ))}
          </div>
        </div>
      )}

      {footer && <div style={S.footer}>{footer}</div>}
    </div>
  );
}

const S = {
  card: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226 100%)",
    border: "1px solid #223451",
    borderRadius: 16,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  headerRow: { display: "flex", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: 800, color: "white" },
  description: { fontSize: 12, color: "#7c8ca8", marginTop: 2 },
  metaRow: { display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" },
  metaChip: { fontSize: 11, color: "#93c5fd", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 999, padding: "3px 9px" },
  badgeFree: { fontSize: 10, fontWeight: 800, color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 999, padding: "2px 8px" },
  badgeInactive: { fontSize: 10, fontWeight: 800, color: "#94a3b8", background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.25)", borderRadius: 999, padding: "2px 8px" },
  section: { marginTop: 12, borderTop: "1px solid #1e293b", paddingTop: 10 },
  sectionLabel: { fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: 0.6 },
  subtle: { fontSize: 12, color: "#64748b", marginTop: 6 },
  priceLine: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#e2e8f0", marginTop: 6 },
  strike: { color: "#64748b", marginRight: 4 },
  discountTag: { color: "#f59e0b", fontSize: 11, marginLeft: 4 },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: { fontSize: 11, background: "#0b1220", border: "1px solid #1e293b", color: "#cbd5e1", borderRadius: 999, padding: "3px 9px" },
  chipAddon: { fontSize: 11, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", color: "#c4b5fd", borderRadius: 999, padding: "3px 9px" },
  footer: { marginTop: 14 },
};