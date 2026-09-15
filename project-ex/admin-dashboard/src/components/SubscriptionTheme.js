// Shared design tokens for Plan / Access Point cards + modals.
// Keeps MyAccount, SubscriptionAdminPanel, PlanCard, AccessPointCard and
// their modals visually consistent.

export const ACCENTS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#22d3ee"];
export const FREE_ACCENT = "#64748b";

export function accentFor(plan, index) {
  if (plan?.is_default) return FREE_ACCENT;
  return ACCENTS[index % ACCENTS.length];
}

export const statusColor = (status) =>
  status === "active" ? "#10b981" : status === "grace" ? "#f59e0b" : "#ef4444";

export const fmtMoney = (value) => {
  if (value == null) return "—";
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

export const fmtDateShort = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export const daysRemaining = (isoDate) => {
  if (!isoDate) return null;
  const end = new Date(isoDate).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

export const T = {
  radiusLg: 20,
  radiusMd: 14,
  radiusSm: 10,
  border: "1px solid rgba(148,163,184,0.14)",
  cardBg: "linear-gradient(165deg, rgba(17,28,49,.97), rgba(8,14,27,.98))",
  panelBg: "linear-gradient(180deg, rgba(11,22,40,.98), rgba(8,18,36,.94))",
  fieldBg: "#081224",
  fieldBorder: "1px solid #223451",
  textDim: "#7c8ca8",
  textFaint: "#5b6b85",
  textBright: "#e7edf7",
};

export const S = {
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: T.radiusSm,
    border: T.fieldBorder,
    background: T.fieldBg,
    color: "white",
    fontSize: 13,
    boxSizing: "border-box",
    outline: "none",
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: T.textDim,
    letterSpacing: 0.3,
  },
  fieldStack: { display: "grid", gap: 6 },
  primaryBtn: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "10px 16px", borderRadius: T.radiusSm, border: "1px solid rgba(59,130,246,.45)",
    background: "linear-gradient(180deg, rgba(59,130,246,.28), rgba(37,99,235,.2))",
    color: "#dbeafe", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  dangerBtn: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "10px 16px", borderRadius: T.radiusSm, border: "1px solid rgba(239,68,68,.4)",
    background: "rgba(239,68,68,.12)", color: "#fca5a5", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  ghostBtn: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "9px 14px", borderRadius: T.radiusSm, border: "1px solid #28405f",
    background: "#0e1a2d", color: "#cbd5e1", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  iconBtn: {
    width: 30, height: 30, borderRadius: 9, border: "1px solid #28405f", background: "#0e1a2d",
    color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(4,8,16,.72)", zIndex: 3000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
    backdropFilter: "blur(2px)",
  },
  modal: {
    width: "min(760px, 96vw)", maxHeight: "90vh", overflowY: "auto",
    borderRadius: 22, border: T.border,
    background: "linear-gradient(180deg, #0c1729 0%, #08111f 100%)", padding: 22,
    boxShadow: "0 40px 100px rgba(0,0,0,.65)", display: "grid", gap: 18,
  },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: 800, color: "white" },
  modalSubtitle: { fontSize: 12, color: T.textDim, marginTop: 3 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10, border: "1px solid #31425f", background: "#0b1527",
    color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  divider: { height: 1, background: "rgba(148,163,184,0.12)", border: "none", margin: "2px 0" },
  sectionLabel: { fontSize: 11, fontWeight: 800, color: T.textDim, letterSpacing: 0.5, textTransform: "uppercase" },
  chip: (active, color = "#3b82f6") => ({
    padding: "7px 13px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
    border: `1px solid ${active ? color : "rgba(148,163,184,0.22)"}`,
    background: active ? `${color}22` : "#0b1220",
    color: active ? color : "#94a3b8",
    transition: "all .15s ease",
  }),
  scrollRow: {
    display: "flex", gap: 14, overflowX: "auto", paddingBottom: 10, scrollSnapType: "x proximity",
  },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14,
  },
  toolbar: {
    display: "flex", gap: 10, flexWrap: "nowrap", alignItems: "center", width: "100%",
  },
  searchInput: {
    flex: "1 1 220px", minWidth: 180, padding: "9px 12px 9px 34px", borderRadius: 12,
    border: "1px solid #223451", background: "#081224", color: "white", fontSize: 13, outline: "none",
  },
};