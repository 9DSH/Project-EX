import { Check, Clock, Layers, Pencil, Power, Sparkles } from "lucide-react";
import { T, fmtMoney } from "./SubscriptionTheme";

/**
 * plan            — serialized plan object from the API
 * accentColor      — hex used for the top strip / price / highlight ring
 * current          — this is the viewer's active plan
 * highlight        — force the blue "selected" ring (used while a manage panel is open)
 * actions          — [{ icon, label, onClick, tone }] rendered as small icon buttons in the header
 *                     tone: "default" | "active" | "danger"
 * footer           — node rendered at the bottom (subscribe button, "Manage plan" button, etc.)
 * width            — card width when used inside a horizontal scroll row
 */
export default function PlanCard({
  plan,
  accentColor = "#3b82f6",
  current = false,
  highlight = false,
  actions = [],
  footer,
  width = 288,
}) {
  const isFree = !!plan.is_default;
  const cheapestPrice = !isFree && plan.prices?.length
    ? [...plan.prices].sort((a, b) => a.effective_price - b.effective_price)[0]
    : null;

  const ringColor = current ? "#10b981" : highlight ? accentColor : null;

  return (
    <div
      style={{
        ...S.card,
        width,
        minWidth: width,
        borderColor: ringColor ? ringColor : "rgba(148,163,184,0.14)",
        boxShadow: ringColor
          ? `0 0 0 1px ${ringColor}55, 0 18px 40px rgba(0,0,0,.35)`
          : "0 14px 34px rgba(0,0,0,.28)",
        opacity: plan.is_active === false ? 0.55 : 1,
      }}
    >
      <div style={{ ...S.topStrip, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}00)` }} />

      <div style={S.body}>
        <div style={S.headerRow}>
          <div style={{ minWidth: 0 }}>
            <div style={S.nameRow}>
              <div style={S.name}>{plan.name}</div>
              {current && (
                <span style={{ ...S.badge, color: "#10b981", borderColor: "rgba(16,185,129,.4)", background: "rgba(16,185,129,.14)" }}>
                  <Check size={10} /> Current
                </span>
              )}
            </div>
            {isFree && <span style={{ ...S.badge, color: "#94a3b8", borderColor: "rgba(148,163,184,.3)", background: "rgba(148,163,184,.1)", marginTop: 6 }}>Free plan</span>}
            {plan.is_active === false && <span style={{ ...S.badge, color: "#f87171", borderColor: "rgba(239,68,68,.35)", background: "rgba(239,68,68,.12)", marginTop: 6, marginLeft: isFree ? 6 : 0 }}>Inactive</span>}
          </div>

          {actions.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {actions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  title={a.label}
                  onClick={a.onClick}
                  style={{
                    ...S.iconBtn,
                    color: a.tone === "danger" ? "#f87171" : a.tone === "active" ? "#10b981" : "#94a3b8",
                    borderColor: a.tone === "danger" ? "rgba(239,68,68,.35)" : a.tone === "active" ? "rgba(16,185,129,.35)" : "#243755",
                  }}
                >
                  {a.icon}
                </button>
              ))}
            </div>
          )}
        </div>

        {plan.description ? (
          <div style={S.description}>{plan.description}</div>
        ) : (
          <div style={{ ...S.description, color: T.textFaint }}>No description provided.</div>
        )}

        <div style={S.priceBlock}>
          {isFree ? (
            <div style={{ ...S.priceBig, color: accentColor }}>Free</div>
          ) : cheapestPrice ? (
            <div style={S.priceRow}>
              <span style={{ ...S.priceBig, color: accentColor }}>{fmtMoney(cheapestPrice.effective_price)}</span>
              <span style={S.priceUnit}>{cheapestPrice.currency}/{cheapestPrice.network}</span>
              {cheapestPrice.discount_percent > 0 && (
                <span style={S.discountPill}>-{cheapestPrice.discount_percent}%</span>
              )}
            </div>
          ) : (
            <div style={{ ...S.priceBig, fontSize: 15, color: T.textFaint }}>No pricing set</div>
          )}
          {!isFree && plan.prices?.length > 1 && (
            <div style={S.morePrices}>+{plan.prices.length - 1} more price{plan.prices.length - 1 === 1 ? "" : "s"}</div>
          )}
        </div>

        <div style={S.metaRow}>
          <span style={S.metaChip}><Clock size={11} /> {plan.duration_days}d cycle</span>
          <span style={S.metaChip}><Layers size={11} /> {plan.access_points?.length || 0} included</span>
          {plan.addons?.length > 0 && (
            <span style={{ ...S.metaChip, color: "#c4b5fd", borderColor: "rgba(168,85,247,.28)", background: "rgba(168,85,247,.1)" }}>
              <Sparkles size={11} /> {plan.addons.length} add-on{plan.addons.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {plan.access_points?.length > 0 && (
          <div style={S.chipWrap}>
            {plan.access_points.slice(0, 4).map((ap) => (
              <span key={ap.id} style={S.apChip}>{ap.label}{ap.choice_group ? ` · ${ap.choice_group}` : ""}</span>
            ))}
            {plan.access_points.length > 4 && <span style={S.apChip}>+{plan.access_points.length - 4}</span>}
          </div>
        )}

        {footer && <div style={S.footer}>{footer}</div>}
      </div>
    </div>
  );
}

const S = {
  card: {
    borderRadius: T.radiusLg,
    border: "1px solid",
    background: T.cardBg,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    scrollSnapAlign: "start",
    flexShrink: 0,
  },
  topStrip: { height: 4, width: "100%" },
  body: { padding: 16, display: "flex", flexDirection: "column", gap: 10, flex: 1 },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  nameRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { fontSize: 16, fontWeight: 800, color: "white", lineHeight: 1.25 },
  badge: {
    display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800,
    border: "1px solid", borderRadius: 999, padding: "2px 8px",
  },
  description: { fontSize: 12.5, color: T.textDim, lineHeight: 1.5, minHeight: 18 },
  priceBlock: { paddingTop: 4 },
  priceRow: { display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" },
  priceBig: { fontSize: 26, fontWeight: 900, letterSpacing: -0.3 },
  priceUnit: { fontSize: 12, color: T.textDim, fontWeight: 600 },
  discountPill: {
    fontSize: 10, fontWeight: 800, color: "#f59e0b", background: "rgba(245,158,11,.12)",
    border: "1px solid rgba(245,158,11,.3)", borderRadius: 999, padding: "2px 7px",
  },
  morePrices: { fontSize: 11, color: T.textFaint, marginTop: 2 },
  metaRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  metaChip: {
    display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700,
    color: "#93c5fd", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)",
    borderRadius: 999, padding: "3px 9px",
  },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 5, borderTop: "1px solid rgba(148,163,184,0.1)", paddingTop: 10 },
  apChip: {
    fontSize: 10.5, background: "#0b1220", border: "1px solid rgba(148,163,184,0.16)", color: "#cbd5e1",
    borderRadius: 999, padding: "3px 9px",
  },
  footer: { marginTop: "auto", paddingTop: 6 },
  iconBtn: {
    width: 28, height: 28, borderRadius: 8, border: "1px solid #243755", background: "#0e1a2d",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
};