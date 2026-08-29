import { useEffect, useState } from "react";
import API from "../api/client";
import OrderSidebar from "../components/OrderSidebar";
import UserSidebar from "../components/UserSidebar";
import OrderAnalysisPanel from "../components/OrderAnalysisPanel";
import { CheckCircle, Clock, CheckCircle2, BarChart3, Pointer } from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";
import DatePicker from "react-datepicker";

// ── Skeleton ───────────────────────────────────────────────────
function Sk({ w = "100%", h = 16, r = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#151f30 25%,#1e2d44 50%,#151f30 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }} />
  );
}

// ── Stat pill ──────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, accent, loading }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", borderRadius:12, padding:"10px 14px" }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: accent + "18", color: accent,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={17} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: 0.6, marginBottom: 3 }}>{label}</div>
        {loading
          ? <Sk w={56} h={22} />
          : <div style={{ fontSize: 16, fontWeight: 800, color: accent, letterSpacing: -0.5 }}>{value ?? "—"}</div>}
      </div>
    </div>
  );
}

export default function OrdersManagement() {
  const [orders, setOrders] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;

  // =========================
  // LOAD ORDERS
  // =========================
  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await API.get("/admin/orders/all");
      const data = res.data || [];
      setOrders(data);
      setFiltered(data);
    } catch (err) {
      console.error(err);
      alert("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // FILTERING
  // =========================
  useEffect(() => {
    let data = [...orders];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      data = data.filter((o) =>
        o.id?.toString().includes(q) ||
        o.username?.toLowerCase().includes(q) ||
        o.product_name?.toLowerCase().includes(q) ||
        o.product_type?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") data = data.filter((o) => o.status === statusFilter);
    if (productTypeFilter !== "all") data = data.filter((o) => o.product_type === productTypeFilter);

    if (startDate) {
      data = data.filter((o) => new Date(o.created_at) >= startDate);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      data = data.filter((o) => new Date(o.created_at) <= end);
    }
    setFiltered(data);
  }, [search, statusFilter, productTypeFilter, orders, startDate, endDate ]);

  const openOrder = (order) => setSelectedOrder(order);
  const closeSidebar = () => setSelectedOrder(null);
  const openUserSidebar = (userData) => setSelectedUser(userData);
  const closeUserSidebar = () => setSelectedUser(null);

  const completedOrders = orders.filter((o) => o.status === "delivered").length;
  const pendingApproval = orders.filter((o) => o.status === "pending").length;
  const pendingDelivery = orders.filter((o) => o.status === "approved").length;
  

  function formatDate(dateStr) {
    const d = new Date(dateStr);

    const day = d.getDate();
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");

    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12;

    return `${day} ${month} ${year} ${hours}:${minutes} ${ampm}`;
  }
  return (
    <div style={styles.page}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* ── HEADER ── */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
              <div>
            <div style={styles.title}>Orders Management</div>
            <div style={styles.subtitle}>Manage your orders, approve and deliver</div>
          </div>
          <StatPill icon={CheckCircle} label="Completed Orders" value={completedOrders} accent="#34d399" loading={loading} />
          <StatPill icon={Clock} label="Pending Approval" value={pendingApproval} accent="#fbbf24" loading={loading} />
          <StatPill icon={CheckCircle2} label="Pending Delivery" value={pendingDelivery} accent="#60a5fa" loading={loading} />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={loadOrders} style={styles.refreshBtn}>Refresh</button>
        </div>
      </div>

      {/* ── FILTERS + ANALYZE TAB ROW ── */}
      <div style={styles.tabRow}>
        <div style={styles.filtersContainer}>
          <input
            placeholder="Search Order ID, User or Product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.select}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="delivered">Delivered</option>
          </select>
          <select value={productTypeFilter} onChange={(e) => setProductTypeFilter(e.target.value)} style={styles.select}>
            <option value="all">All Product Types</option>
            <option value="subscription">Subscription</option>
            <option value="vpn">VPN</option>
            <option value="gift_card">Gift Card</option>
            <option value="account">Account</option>
            <option value="service">Service</option>
          </select>
          <DatePicker
            selectsRange
            startDate={startDate}
            endDate={endDate}
            onChange={(update) => setDateRange(update)}
            isClearable
            placeholderText="Select date range"
            customInput={<input style={styles.searchInput} />}
          />
        </div>

        {/* Analyze toggle button — mirrors ExchangeDashboard tab style */}
        <button
          onClick={() => setAnalyzeOpen((v) => !v)}
          style={analyzeOpen ? styles.analyzeTabActive : styles.analyzeTab}
        >
          <BarChart3 size={13} style={{ marginRight: 6 }} />
          Analysis
          <span style={{
            marginLeft: 7,
            background: analyzeOpen ? "rgba(96,165,250,0.2)" : "rgba(100,116,139,0.15)",
            color: analyzeOpen ? "#60a5fa" : "#64748b",
            borderRadius: 99, padding: "1px 7px", fontSize: 11, fontWeight: 700,
          }}>
            {orders.length}
          </span>
        </button>
      </div>

      {/* ── SPLIT CONTENT AREA ── */}
      <div style={styles.splitArea}>

        {/* Orders table */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={styles.tableContainer}>
            <div style={{ overflowY: "auto", flex: 1 }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Price</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Delivered</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => openOrder(o)}
                    style={{
                      ...styles.row,
                      background: selectedOrder?.id === o.id ? "#172554" : "transparent",
                    }}
                  >
                    <td style={tdStyle}><strong>#{o.id}</strong></td>
                    <td style={tdStyle}><div style={{ fontWeight: 600 }}>{o.username}</div></td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{o.product_name}</div>
                      {o.category_name && <small style={{ color: "#94a3b8" }}>{o.category_name}</small>}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ background: "#1e293b", padding: "6px 12px", borderRadius: 999, fontSize: 12, textTransform: "capitalize" }}>
                        {o.plan || "-"}
                      </span>
                    </td>
                    <td style={tdStyle}><span style={styles.typeBadge}>{o.product_type}</span></td>
                    <td style={tdStyle}>
                      <strong>{parseFloat(o.price).toFixed(2)}</strong> {o.currency}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        ...styles.statusBadge,
                        background: o.status === "pending" ? "#f59e0b22" : o.status === "approved" ? "#10b98122" : o.status === "delivered" ? "#3b82f622" : "#ef444422",
                        color: o.status === "pending" ? "#fbbf24" : o.status === "approved" ? "#34d399" : o.status === "delivered" ? "#60a5fa" : "#f87171",
                      }}>
                        {o.status?.toUpperCase()}
                      </span>
                    </td>
                    <td style={tdStyle}><small>{formatDate(o.created_at)}</small></td>
                    <td style={tdStyle}>
                <small>
                  {o.delivered_at ? formatDate(o.delivered_at) : "-"}
                </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div style={styles.empty}>No orders found</div>
            )}
          </div>
          </div>
        </div>

        {/* Sliding analysis panel */}
        <OrderAnalysisPanel
          visible={analyzeOpen}
          onClose={() => setAnalyzeOpen(false)}
        />
      </div>

      {/* SIDEBARS */}
      {selectedOrder && (
        <OrderSidebar
          order={selectedOrder}
          onClose={closeSidebar}
          onRefresh={loadOrders}
          onOpenUser={openUserSidebar}
        />
      )}
      {selectedUser && (
        <UserSidebar
          user={selectedUser}
          onClose={closeUserSidebar}
          onRefresh={loadOrders}
        />
      )}
    </div>
  );
}

// =========================
// STYLES
// =========================
const styles = {
  page: {
    padding: "5px",
    background: "#020617",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    color: "white",
    boxSizing: "border-box",
  },


  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 15,
    flexWrap: "wrap",
  },
  
    title: { color: "#2e7ce9af",margin: 0, fontSize: 26, fontWeight: 600, marginRight: 20 , letterSpacing: "0.1rem",   },
  subtitle: { color: "#64748b", fontSize: 13, margin: "2px 0 0" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 14,  padding :"10px 0 20px 20px",  flexWrap: "wrap"
  },
  refreshBtn: {
    display: "flex",
    alignItems: "center",
    background: "transparent",
    border: "1px solid #313d58ff",
    borderRadius: 10,
    padding: "8px 14px",
    color: "#6c798dff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  },

  // Tab row: filters + analyze button on same line
  tabRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap",
    borderBottom: "1px dotted #1a2540",
    paddingBottom: 14,
    
    marginLeft: "5px"
  },

  filtersContainer: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    flex: 1,
  },

  searchInput: {
    flex: 1,
    minWidth: 260,
    maxWidth: 320,
    background: "#0f172a1f",
    border: "1px solid #1e293b",
    color: "white",
    padding: "10px 14px",
    borderRadius: 12,
    outline: "none",
  },

  select: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    color: "white",
    padding: "10px 14px",
    borderRadius: 12,
    outline: "none",
    cursor: "pointer"
  },

  // Analyze tab button — inactive (mirrors ExchangeDashboard tabBtn)
  analyzeTab: {
    display: "flex",
    alignItems: "center",
    background: "#080e1a",
    border: "1px solid #1e293b",
    borderRadius: 10,
    padding: "7px 14px",
    color: "#64748b",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },

  // Analyze tab button — active
  analyzeTabActive: {
    display: "flex",
    alignItems: "center",
    background: "rgba(59,130,246,0.15)",
    border: "1px solid rgba(59,130,246,0.4)",
    borderRadius: 10,
    padding: "7px 14px",
    color: "#60a5fa",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
    transition: "all 0.2s",
    whiteSpace: "nowrap",
  },

  // ── Split area wraps table + sliding panel ──
  splitArea: {
    display: "flex",
    flex: 1,
    gap: 15,
    overflow: "hidden",
    minHeight: 0,
    height: "100%",
  },

  tableContainer: {
    background: "#0b1424",
    border: "1px solid #313d58bc",
    borderRadius: 15,
    overflow: "hidden",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    
    marginLeft: "5px"
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  tableHeader: {
    background: "#111827",
  },

  row: {
    borderBottom: "1px solid #1e293b",
    cursor: "pointer",
    transition: "0.2s",
  },

  statusBadge: {
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },

  typeBadge: {
    background: "#1e293b",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    textTransform: "capitalize",
  },

  empty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    minHeight: "400px",
    textAlign: "center",
    color: "#64748b",
  },
};

const thStyle = {
  textAlign: "left",
  padding: "16px 14px",
  color: "#94a3b8",
  fontSize: 13,
  fontWeight: 600,
};

const tdStyle = {
  padding: "14px 14px",
};