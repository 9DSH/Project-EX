import { useEffect, useState, useRef } from "react";
import API from "../api/client";
import {
  BarChart3, X, Package, DollarSign, LayoutGrid,
  Search, ChevronDown, User, Trophy, TrendingUp, Calendar
} from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";
import DatePicker from "react-datepicker";

// ── Skeleton ────────────────────────────────────────────────────
function Sk({ w = "100%", h = 16, r = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#0e1a2e 25%,#1a2a40 50%,#0e1a2e 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }} />
  );
}

// ── Summary pill ─────────────────────────────────────────────────
function SummaryPill({ icon: Icon, label, value, accent }) {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", gap: 8,
      background: "#0b1424", borderRadius: 10, padding: "10px 12px",
      border: "1px solid #1a2540",
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: accent + "18", color: accent,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={14} />
      </div>
      <div>
        <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: 0.8, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: accent, letterSpacing: -0.3 }}>{value}</div>
      </div>
    </div>
  );
}

function MetaCard({ icon: Icon, label, line1, line2, line3, accent, loading }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#0a1628",
        border: `1px solid ${accent}28`,
        borderRadius: 12,
        padding: "11px 14px",
        minWidth: 0,
      }}
    >
      {/* TOP LABEL */}
      <div
        style={{
          fontSize: 9,
          color: "#808fa4ff",
          fontWeight: 700,
          letterSpacing: 0.8,
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      {/* BODY ROW */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* ICON CENTERED */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            flexShrink: 0,
            background: accent + "18",
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={15} />
        </div>

        {/* CONTENT INLINE ROW */}
        <div style={{ marginLeft:10, minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {loading ? (
            <>
              <Sk w={90} h={12} r={4} />
              <Sk w={70} h={10} r={4} />
            </>
          ) : line1 ? (
            <>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#e2e8f0",
                  whiteSpace: "nowrap",
                }}
                title={line1}
              >
                {line1}
              </span>

              {line2 && (
                <span
                  style={{
                    fontSize: 10,
                    color: "#64748b",
                    whiteSpace: "nowrap",
                  }}
                  title={line2}
                >
                  · {line2}
                </span>
              )}

              {line3 && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: accent,
                    whiteSpace: "nowrap",
                  }}
                >
                  · {line3}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: 11, color: "#334155" }}>No data</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Vertical column chart ────────────────────────────────────────
function ColumnChart({ data, metric, loading }) {
  const CHART_HEIGHT = 220;
  const TOP_PADDING = 60;
  const LABEL_AREA = 33;
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: CHART_HEIGHT + 60, padding: "0 4px" }}>
        {[...Array(7)].map((_, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <Sk w="100%" h={Math.random() * 140 + 40} r={6} />
            <Sk w="80%" h={10} r={4} />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ color: "#334155", textAlign: "center", padding: "60px 0", fontSize: 13 }}>
        No data available
      </div>
    );
  }

  const isIncome = metric === "income";
  const accent = isIncome ? "#10b981" : "#3b82f6";
  const accentGlow = isIncome ? "rgba(16,185,129,0.35)" : "rgba(59,130,246,0.35)";
  const accentDim = isIncome ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.12)";
  const maxVal = Math.max(...data.map(d => d[metric] || 0), 1);

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => ({
    val: (maxVal / ticks) * (ticks - i),
    pct: (i / ticks) * 100,
  }));

  const formatVal = (v) => {
    if (isIncome) return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`;
    return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
  };

  const formatFull = (v) =>
    isIncome
      ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : Number(v).toLocaleString();

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", overflowX: "auto", overflowY: "visible", paddingTop: 10 }}>
      <div style={{
        display: "flex",
        minWidth: Math.max(data.length * 56, 280),
        height: TOP_PADDING + CHART_HEIGHT + LABEL_AREA,
        alignItems: "flex-end",
        gap: 0,
      }}>
        {/* Y-axis */}
        <div style={{ position: "relative", width: 50, height: CHART_HEIGHT, flexShrink: 0, alignSelf: "flex-start", marginTop: TOP_PADDING }}>
          {yTicks.map((t, i) => (
            <div key={i} style={{
              position: "absolute", top: `${t.pct}%`, right: 6,
              transform: "translateY(-50%)", fontSize: 10,
              color: "#8997abff", fontWeight: 600, whiteSpace: "nowrap",
            }}>
              {formatVal(t.val)}
            </div>
          ))}
        </div>

        {/* Chart columns area */}
        <div style={{ flex: 1, position: "relative", height: TOP_PADDING + CHART_HEIGHT + LABEL_AREA }}>
          {/* Grid lines */}
          <div style={{ position: "absolute", top: TOP_PADDING, left: 0, right: 0, height: CHART_HEIGHT, pointerEvents: "none" }}>
            {yTicks.map((t, i) => (
              <div key={i} style={{
                position: "absolute", top: `${t.pct}%`, left: 0, right: 0,
                height: 1, background: i === ticks ? "#1a2540" : "#0f1a2e",
              }} />
            ))}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: TOP_PADDING + CHART_HEIGHT, height: 1, background: "#1a2540", zIndex: 1 }} />

          {/* Columns */}
          <div style={{
            position: "absolute", top: TOP_PADDING, left: 0, right: 0,
            height: CHART_HEIGHT + LABEL_AREA,
            display: "flex", alignItems: "flex-end", gap: 4,
          }}>
            {data.map((item, i) => {
              const barPct = ((item[metric] || 0) / maxVal) * 100;
              const barH = Math.max((barPct / 100) * CHART_HEIGHT, 2);
              const label = item.product_name + (item.plan ? ` · ${item.plan}` : "");
              const isHovered = tooltip?.index === i;

              return (
                <div
                  key={item.product_id != null ? `${item.product_id}-${i}` : i}
                  style={{
                    flex: 1, height: CHART_HEIGHT + LABEL_AREA,
                    display: "flex", flexDirection: "column", justifyContent: "flex-end",
                    alignItems: "center", cursor: "pointer", position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const parentRect = containerRef.current?.getBoundingClientRect();
                    setTooltip({ index: i, x: rect.left - (parentRect?.left || 0) + rect.width / 2, y: rect.top - (parentRect?.top || 0) });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    color: isHovered ? "#e2e8f0" : "#b7bdc6ff",
                    position: "absolute", bottom: barH + 8,
                    textAlign: "center", whiteSpace: "nowrap", transition: "color 0.15s",
                  }}>
                    {formatVal(item[metric] || 0)}
                  </div>

                  <div style={{
                    width: "100%", maxWidth: 44, height: barH,
                    borderRadius: "5px 5px 2px 2px",
                    background: isHovered
                      ? `linear-gradient(180deg, ${accent}, ${accent}88)`
                      : `linear-gradient(180deg, ${accentGlow}, ${accentDim})`,
                    border: `1px solid ${isHovered ? accent : accent + "44"}`,
                    transition: "background 0.15s, border-color 0.15s, height 0.4s cubic-bezier(0.4,0,0.2,1)",
                    boxShadow: isHovered ? `0 0 12px ${accent}44` : "none",
                  }} />

                  <div style={{
                    marginTop: 6, height: 28, minHeight: 28, maxHeight: 28,
                    fontSize: 10, color: isHovered ? "#adbacbff" : "#8997abab",
                    textAlign: "center", wordBreak: "break-word", lineHeight: 1.3,
                    maxWidth: 52, overflow: "hidden",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    transition: "color 0.15s", padding: "0 1px",
                  }} title={label}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && data[tooltip.index] && (
        <div style={{
          position: "absolute",
          top: Math.max(tooltip.y - 8, 50),
          left: tooltip.x,
          transform: "translate(-50%, -100%)",
          background: "#0b1830", border: "1px solid #1a2f50",
          borderRadius: 8, padding: "8px 12px",
          fontSize: 11, color: "white",
          pointerEvents: "none", whiteSpace: "nowrap",
          zIndex: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontWeight: 700, color: "#e2e8f0", marginBottom: 3 }}>
            {data[tooltip.index].product_name}
            {data[tooltip.index].plan && (
              <span style={{ color: "#8997abff", fontWeight: 500 }}> · {data[tooltip.index].plan}</span>
            )}
          </div>
          <div style={{ color: accent, fontWeight: 700 }}>
            {isIncome ? "Income: " : "Units sold: "}{formatFull(data[tooltip.index][metric] || 0)}
          </div>
          {data[tooltip.index].category_name && (
            <div style={{ color: "#8997abff", marginTop: 2, fontSize: 10 }}>
              {data[tooltip.index].category_name}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────
export default function OrderAnalysisPanel({ visible, onClose, isMaster = false }) {
  const [data, setData] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState("sold");
  const [selectedAdmin, setSelectedAdmin] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("products");
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;

  useEffect(() => {
    if (!visible) return;
    loadAnalytics();
  }, [visible, startDate, endDate]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        params.start_date = s.toISOString();
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        params.end_date = e.toISOString();
      }
      const res = await API.get("/admin/orders/analytics/products", { params });
      const rows = res.data || [];
      setData(rows);
      // Unique admins with id + username for dropdown / labels
      const byId = {};
      rows.filter((r) => r.is_admin_product && r.admin_id != null).forEach((r) => {
        if (!byId[r.admin_id]) {
          byId[r.admin_id] = {
            id: r.admin_id,
            username: r.admin_username || null,
          };
        } else if (r.admin_username && !byId[r.admin_id].username) {
          byId[r.admin_id].username = r.admin_username;
        }
      });
      setAdmins(Object.values(byId).sort((a, b) => a.id - b.id));
    } catch (err) {
      console.error("Failed to load analytics", err);
    } finally {
      setLoading(false);
    }
  };

  const allCategories = [...new Set(data.map(d => d.category_name).filter(Boolean))].sort();

  // ── Filter pipeline ──
  let filtered = [...data];
  if (selectedAdmin !== "all") filtered = filtered.filter(d => String(d.admin_id) === String(selectedAdmin));
  if (selectedCategory !== "all") filtered = filtered.filter(d => d.category_name === selectedCategory);
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(d =>
      d.product_name?.toLowerCase().includes(q) ||
      d.plan?.toLowerCase().includes(q) ||
      d.category_name?.toLowerCase().includes(q) ||
      String(d.admin_id || "").includes(q) ||
      d.admin_username?.toLowerCase().includes(q)
    );
  }

  // ── Category aggregation ──
  const categoryData = (() => {
    const map = {};
    filtered.forEach(d => {
      const key = d.category_name || "Uncategorized";
      if (!map[key]) map[key] = { product_name: key, plan: null, product_id: key, sold: 0, income: 0, category_name: key };
      map[key].sold += d.sold || 0;
      map[key].income += d.income || 0;
    });
    return Object.values(map).sort((a, b) => b[metric] - a[metric]);
  })();

  const displayData = viewMode === "categories"
    ? categoryData
    : [...filtered].sort((a, b) => b[metric] - a[metric]);

  const totalSold = filtered.reduce((s, d) => s + (d.sold || 0), 0);
  const totalIncome = filtered.reduce((s, d) => s + (d.income || 0), 0);
  const uniqueCount = viewMode === "categories" ? categoryData.length : filtered.length;

  // ── Meta helpers ──────────────────────────────────────────────
  const fmtIncome = (v) =>
    `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtUnits = (v) => `${Number(v).toLocaleString()} units`;
  const productLabel = (d) => d?.plan ? `${d.product_name} · ${d.plan}` : d?.product_name;

  // All data unfiltered by admin/category/search for cross-admin comparisons
  const allData = data;

  const adminLabel = (id, username) => {
    if (id == null) return null;
    return username ? `${username} (#${id})` : `Admin #${id}`;
  };

  // ── Compute per-admin totals from ALL data ──
  const adminTotals = (() => {
    const map = {};
    allData.filter(d => d.is_admin_product && d.admin_id != null).forEach(d => {
      if (!map[d.admin_id]) {
        map[d.admin_id] = {
          id: d.admin_id,
          name: adminLabel(d.admin_id, d.admin_username),
          sold: 0,
          income: 0,
        };
      }
      map[d.admin_id].sold += d.sold || 0;
      map[d.admin_id].income += d.income || 0;
      if (d.admin_username && !map[d.admin_id].name.includes(d.admin_username)) {
        map[d.admin_id].name = adminLabel(d.admin_id, d.admin_username);
      }
    });
    return Object.values(map);
  })();

  const selectedAdminMeta = selectedAdmin !== "all"
    ? (admins.find((a) => String(a.id) === String(selectedAdmin)) || { id: selectedAdmin, username: null })
    : null;
  const selectedAdminLabel = selectedAdminMeta
    ? adminLabel(selectedAdminMeta.id, selectedAdminMeta.username)
    : null;

  // Top admin by current metric (across ALL data)
  const topAdminObj = [...adminTotals].sort((a, b) => b[metric] - a[metric])[0] || null;

  // Top product overall (from filtered — respects category/search but not admin filter)
  const filteredNoAdmin = (() => {
    let d = [...allData];
    if (selectedCategory !== "all") d = d.filter(x => x.category_name === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(x =>
        x.product_name?.toLowerCase().includes(q) ||
        x.plan?.toLowerCase().includes(q) ||
        x.category_name?.toLowerCase().includes(q)
      );
    }
    return d;
  })();

  const topProductOverall = [...filteredNoAdmin].sort((a, b) => b[metric] - a[metric])[0] || null;

  // Best product of the top admin
  const topAdminProducts = allData.filter(d => d.admin_id === topAdminObj?.id);
  const topAdminTopProduct = [...topAdminProducts].sort((a, b) => b[metric] - a[metric])[0] || null;

  // When a specific admin is selected: their top product
  const specificAdminTopProduct = selectedAdmin !== "all"
    ? [...filtered].sort((a, b) => b[metric] - a[metric])[0] || null
    : null;

  // ── Decide what each card shows ──
  // Card 1: "All Admins" mode → top product (overall) | "Specific admin" mode → that admin's top product
  // Card 2: "All Admins" mode → top admin + their best product | "Specific admin" mode → same admin summary
  const isAllAdmins = selectedAdmin === "all";

  const card1 = isAllAdmins ? {
    icon: Trophy,
    label: metric === "income" ? "Top Earning Product (All)" : "Most Sold Product (All)",
    line1: productLabel(topProductOverall),
    line2: topProductOverall?.category_name || null,
    line3: topProductOverall
      ? metric === "income" ? fmtIncome(topProductOverall.income) : fmtUnits(topProductOverall.sold)
      : null,
    accent: "#f59e0b",
  } : {
    icon: Trophy,
    label: metric === "income" ? `Top Earner · ${selectedAdminLabel}` : `Most Sold · ${selectedAdminLabel}`,
    line1: productLabel(specificAdminTopProduct),
    line2: specificAdminTopProduct?.category_name || null,
    line3: specificAdminTopProduct
      ? metric === "income" ? fmtIncome(specificAdminTopProduct.income) : fmtUnits(specificAdminTopProduct.sold)
      : null,
    accent: "#f59e0b",
  };

  const card2 = isAllAdmins ? {
    icon: TrendingUp,
    label: metric === "income" ? "Top Earning Admin" : "Top Selling Admin",
    line1: topAdminObj?.name || null,
    line2: topAdminTopProduct ? `Best: ${productLabel(topAdminTopProduct)}` : null,
    line3: topAdminObj
      ? metric === "income"
        ? `Total ${fmtIncome(topAdminObj.income)}`
        : `Total ${fmtUnits(topAdminObj.sold)}`
      : null,
    accent: "#8b5cf6",
  } : {
    icon: TrendingUp,
    label: metric === "income" ? `${selectedAdminLabel} · Income` : `${selectedAdminLabel} · Units`,
    line1: metric === "income"
      ? fmtIncome(filtered.reduce((s, d) => s + (d.income || 0), 0))
      : fmtUnits(filtered.reduce((s, d) => s + (d.sold || 0), 0)),
    line2: specificAdminTopProduct ? `Best: ${productLabel(specificAdminTopProduct)}` : null,
    line3: `${filtered.length} product${filtered.length !== 1 ? "s" : ""}`,
    accent: "#8b5cf6",
  };

  return (
    <div style={{
      width: visible ? "50%" : "0%",
      minWidth: visible ? 320 : 0,
      overflow: "hidden",
      transition: "width 0.35s cubic-bezier(0.4,0,0.2,1), min-width 0.35s cubic-bezier(0.4,0,0.2,1)",
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      borderLeft: visible ? "1px solid #1a2540" : "none",
      background: "#060d1a",
      padding: visible ? 20 : 0,
      border: visible ? "1px solid #203f5db6" : "none",
      borderRadius: 20,
    }}>
      {visible && (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 320 }}>

          {/* ── Header: title + toggles ── */}
          <div style={{
            padding: "12px 14px 10px",
            borderBottom: "1px solid #1a2540",
            background: "#07101d",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <BarChart3 size={15} color="#3b82f6" />
              <span style={{ color: "white", fontWeight: 700, fontSize: 14, flex: 1 }}>Product Analytics</span>

              {/* Metric toggle */}
              <div style={{ display: "flex", gap: 3, background: "#0b1424", borderRadius: 8, padding: 3, border: "1px solid #1a2540" }}>
                {[
                  { key: "sold", label: "Sold", icon: Package },
                  { key: "income", label: "Income", icon: DollarSign },
                ].map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setMetric(key)} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 9px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 700,
                    background: metric === key ? "rgba(59,130,246,0.2)" : "transparent",
                    color: metric === key ? "#60a5fa" : "#475569",
                    transition: "all 0.15s",
                  }}>
                    <Icon size={11} />{label}
                  </button>
                ))}
              </div>

              {/* View mode toggle */}
              <div style={{ display: "flex", gap: 3, background: "#0b1424", borderRadius: 8, padding: 3, border: "1px solid #1a2540" }}>
                {[
                  { key: "products", label: "Products" },
                  { key: "categories", label: "Categories" },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setViewMode(key)} style={{
                    padding: "5px 9px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 700,
                    background: viewMode === key ? "rgba(139,92,246,0.2)" : "transparent",
                    color: viewMode === key ? "#a78bfa" : "#475569",
                    transition: "all 0.15s",
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Filter row ── */}
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 120 }}>
                <Search size={11} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#334155", pointerEvents: "none" }} />
                <input
                  placeholder="Search product, plan, category..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "#0b1424", border: "1px solid #1a2540",
                    color: "white", padding: "6px 10px 6px 26px",
                    borderRadius: 8, outline: "none", fontSize: 11,
                  }}
                />
              </div>

              <div style={{ position: "relative", minWidth: 140, flex: 1 }}>
                <Calendar size={11} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#334155", pointerEvents: "none", zIndex: 1 }} />
                <DatePicker
                  selectsRange
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(update) => setDateRange(update)}
                  isClearable
                  placeholderText="Select date range"
                  customInput={
                    <input
                      style={{
                        width: "100%", boxSizing: "border-box",
                        background: "#0b1424", border: "1px solid #1a2540",
                        color: startDate || endDate ? "#e2e8f0" : "#8997abff",
                        padding: "6px 28px 6px 26px",
                        borderRadius: 8, outline: "none", fontSize: 11,
                        cursor: "pointer",
                      }}
                    />
                  }
                />
              </div>

              <div style={{ position: "relative", minWidth: 120 }}>
                <User size={11} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#334155", pointerEvents: "none" }} />
                <select
                  value={selectedAdmin}
                  onChange={e => setSelectedAdmin(e.target.value)}
                  style={{
                    background: "#0b1424", border: "1px solid #1a2540",
                    color: selectedAdmin !== "all" ? "#a78bfa" : "#8997abff",
                    padding: "6px 10px 6px 26px",
                    borderRadius: 8, outline: "none", fontSize: 11,
                    appearance: "none", cursor: "pointer", minWidth: 120,
                  }}
                >
                  <option value="all">All Admins</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.username ? `${a.username} (#${a.id})` : `Admin #${a.id}`}
                    </option>
                  ))}
                </select>
                <ChevronDown size={10} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#334155", pointerEvents: "none" }} />
              </div>

              <div style={{ position: "relative", minWidth: 120 }}>
                <LayoutGrid size={11} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#334155", pointerEvents: "none" }} />
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  style={{
                    background: "#0b1424", border: "1px solid #1a2540",
                    color: selectedCategory !== "all" ? "#60a5fa" : "#8997abff",
                    padding: "6px 10px 6px 26px",
                    borderRadius: 8, outline: "none", fontSize: 11,
                    appearance: "none", cursor: "pointer", minWidth: 120,
                  }}
                >
                  <option value="all">All Categories</option>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={10} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#334155", pointerEvents: "none" }} />
              </div>
            </div>
          </div>

          {/* ── Summary pills ── */}
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #0f1a2e", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 7 }}>
              <SummaryPill icon={Package} label="TOTAL SOLD" value={totalSold.toLocaleString()} accent="#3b82f6" />
              <SummaryPill icon={DollarSign} label="TOTAL INCOME"
                value={`$${totalIncome.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                accent="#10b981" />
              <SummaryPill
                icon={viewMode === "categories" ? LayoutGrid : Package}
                label={viewMode === "categories" ? "CATEGORIES" : "PRODUCTS"}
                value={uniqueCount}
                accent="#8b5cf6"
              />
            </div>
          </div>

          {/* ── Chart area ── */}
          <div style={{
            flex: 1,
            textAlign: "center",
            overflowY: "auto", overflowX: "hidden",
            padding: "14px 16px",
            scrollbarWidth: "thin", scrollbarColor: "#1e293b #060d1a",
            marginTop: 10,
          }}>
            <div style={{ alignContent: "center", fontSize: 10, fontWeight: 700, color: "#8294aeff", letterSpacing: 1, marginBottom: 14 }}>
              {metric === "sold" ? "UNITS SOLD" : "INCOME"} BY {viewMode === "categories" ? "CATEGORY" : "PRODUCT"}
              {selectedAdmin !== "all" && (
                <span style={{ color: "#8b5cf6" }}> · {selectedAdminLabel || `ADMIN #${selectedAdmin}`}</span>
              )}
              {selectedCategory !== "all" && <span style={{ color: "#3b82f6" }}> · {selectedCategory.toUpperCase()}</span>}
              {(startDate || endDate) && (
                <span style={{ color: "#34d399" }}>
                  {" · "}
                  {startDate ? startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "…"}
                  {" – "}
                  {endDate ? endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "…"}
                </span>
              )}
            </div>
            <ColumnChart data={displayData} metric={metric} loading={loading} />

            {/* ── Meta footer ── */}
            {!loading && (
              <div style={{ marginTop: 50, display: "flex", gap: 9 }}>
                <MetaCard {...card1} loading={loading} />
                <MetaCard {...card2} loading={loading} />
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}