import { Lock, ShieldCheck } from "lucide-react";
import { T, fmtMoney } from "./subscriptionTheme";

export default function AccessPointCard({
  ap,
  accentColor = "#8b5cf6",
  actions = [],
  footer,
  statusChip,   // optional { text, color } e.g. "ACTIVE" / "LOCKED"
  muted = false,
  width = 260,
}) {
  const cheapest = ap.prices?.length ? [...ap.prices].sort((a, b) => a.effective_price - b.effective_price)[0] : null;
  // Fixed-px width (flex scroll rows) needs a real min-width so it doesn't
  // collapse. "100%" (grid usage) must get minWidth: 0 instead — otherwise
  // the browser falls back to the card's min-content size, which blows the
  // whole row out to one column wide. This is the classic CSS Grid
  // "blowout" bug: an indefinite percentage min-width on a grid item
  // resolves to min-content, not 0.
  const minW = typeof width === "number" ? width : 0;

  return (
    <div style={{ ...S.card, width, minWidth: minW, maxWidth: "100%", boxSizing: "border-box", opacity: muted ? 0.55 : ap.is_active === false ? 0.55 : 1 }}>
      <div style={{ ...S.topStrip, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}00)` }} />
      <div style={S.body}>
        <div style={S.headerRow}>
          <div style={S.name}>{ap.label}</div>
          {actions.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {actions.map((a, i) => (
                <button key={i} type="button" title={a.label} onClick={a.onClick} style={{ ...S.iconBtn, color: a.tone === "danger" ? "#f87171" : "#94a3b8", borderColor: a.tone === "danger" ? "rgba(239,68,68,.35)" : "#243755" }}>
                  {a.icon}
                </button>
              ))}
            </div>
          )}
        </div>

        {statusChip && (
          <span style={{ ...S.badge, color: statusChip.color, borderColor: `${statusChip.color}66`, background: `${statusChip.color}22` }}>
            {statusChip.text}
          </span>
        )}

        {ap.required_plans && ap.required_plans.length > 0 ? (
          <div style={S.reqRow}><Lock size={11} /> Requires: {ap.required_plans.map((p) => p.name).join(", ")}</div>
        ) : (
          <div style={{ ...S.reqRow, color: "#6ee7b7" }}><ShieldCheck size={11} /> Open to any plan</div>
        )}

        <div style={S.priceBlock}>
          {cheapest ? (
            cheapest.effective_price === 0 ? (
              <div style={S.priceRow}>
                <span style={{ ...S.priceBig, color: "#10b981" }}>Free</span>
                <span style={S.priceUnit}>{cheapest.currency}/{cheapest.network}</span>
              </div>
            ) : (
              <div style={S.priceRow}>
                <span style={{ ...S.priceBig, color: accentColor }}>{fmtMoney(cheapest.effective_price)}</span>
                <span style={S.priceUnit}>{cheapest.currency}/{cheapest.network}</span>
                {cheapest.discount_percent > 0 && <span style={S.discountPill}>-{cheapest.discount_percent}%</span>}
              </div>
            )
          ) : (
            <div style={{ ...S.priceBig, fontSize: 14, color: T.textFaint }}>Not priced yet</div>
          )}
          {ap.prices?.length > 1 && <div style={S.morePrices}>+{ap.prices.length - 1} more price{ap.prices.length - 1 === 1 ? "" : "s"}</div>}
        </div>

        {footer && <div style={S.footer}>{footer}</div>}
      </div>
    </div>
  );
}

const S = {
  card: { borderRadius: T.radiusLg, border: "1px solid rgba(148,163,184,0.14)", background: T.cardBg, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0, scrollSnapAlign: "start" },
  topStrip: { height: 4, width: "100%" },
  body: { padding: 16, display: "flex", flexDirection: "column", gap: 9, flex: 1 },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  name: { fontSize: 15, fontWeight: 800, color: "white", lineHeight: 1.3 },
  badge: { alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, border: "1px solid", borderRadius: 999, padding: "2px 8px" },
  reqRow: { display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#94a3b8" },
  priceBlock: { paddingTop: 2 },
  priceRow: { display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" },
  priceBig: { fontSize: 22, fontWeight: 900, letterSpacing: -0.3 },
  priceUnit: { fontSize: 11.5, color: T.textDim, fontWeight: 600 },
  discountPill: { fontSize: 10, fontWeight: 800, color: "#f59e0b", background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 999, padding: "2px 7px" },
  morePrices: { fontSize: 10.5, color: T.textFaint },
  footer: { marginTop: "auto", paddingTop: 8 },
  iconBtn: { width: 28, height: 28, borderRadius: 8, border: "1px solid #243755", background: "#0e1a2d", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
};