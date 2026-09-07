import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../config";
import UserSidebar from "../components/UserSidebar";
import OrderSidebar from "../components/OrderSidebar";
import HeroHub from "../components/HeroHub";
import { SlidersHorizontal, Wallet, Clock, CheckCircle2 } from "lucide-react";

  // ── Skeleton ─────────────────────────────────────────────────────
function Sk({ w = "100%", h = 16, r = 6 }) {
    return (
      <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#151f30 25%,#1e2d44 50%,#151f30 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
    );
  }

const fmt = (n, d = 2) =>
  n != null ? Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d }) : "—";



export default function Transactions() {
  const [transactions, setTransactions] = useState([]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [actorFilter, setActorFilter] = useState("all");
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;



  const token = localStorage.getItem("token");

  // =========================
  // LOAD TRANSACTIONS
  // =========================
  const loadTransactions = async () => {
    setLoading(true);

    try {
      const res = await fetch(
        `${API_URL}/admin/orders/transactions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error(data);
        return;
      }
      const normalized = (data || []).map((t) => ({
        ...t,

        // FLATTEN FOR UI COMPATIBILITY
        currency_symbol: t.currency?.symbol,
        currency_name: t.currency?.name,

        network_name: t.network?.name,
        network_chain: t.network?.chain,

        product_name: t.product?.name || t.product_name,
        product_type: t.product?.type,
        plan: t.product?.plan,

      }));

    setTransactions(normalized);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  // =========================
  // OPEN USER
  // =========================
  const openUser = async (t) => {
    const userId = t.user_id;

    if (!userId) return;

    setLoadingUser(true);

    try {
      const res = await fetch(
        `${API_URL}/admin/users/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("USER LOAD FAILED:", data);
        return;
      }

      setSelectedOrder(null);

      // 🔥 FULL USER OBJECT ONLY
      setSelectedUser(data);

    } catch (err) {
      console.error(err);
    }

    setLoadingUser(false);
  };

  // =========================
  // OPEN ORDER
  // =========================
  const openOrder = async (t) => {
    if (!t.user_id || !t.order_id) return;

    setLoadingOrder(true);

    try {
      const res = await fetch(
        `${API_URL}/admin/users/${t.user_id}/orders`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("ORDER LOAD FAILED:", data);
        return;
      }

      const order = data.find((o) => o.id === t.order_id);

      if (!order) {
        console.error("Order not found in user orders");
        return;
      }

      setSelectedUser(null);

      // IMPORTANT: normalize for OrderSidebar
      setSelectedOrder({
        id: order.order_id,
        ...order,
      });
    } catch (err) {
      console.error(err);
    }

    setLoadingOrder(false);
  };


  // =========================
  // FILTER ENGINE
  // =========================
  const filteredTx = useMemo(() => {
    let data = [...transactions];
    const q = search.toLowerCase();
    // SEARCH
    if (q) {
      data = data.filter((t) =>
        [
          t.id,
          t.order_id,
          t.user_id,
          t.username,
          t.product_name,
          t.wallet_address,
          t.tx_hash,
          t.network_name,
          t.network_chain,
          t.currency_symbol,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    // TYPE
    if (typeFilter !== "all") {
      data = data.filter((t) => t.type === typeFilter);
    }

    // STATUS
    if (statusFilter !== "all") {
      data = data.filter((t) => t.status === statusFilter);
    }

    // CURRENCY
    if (currencyFilter !== "all") {
      data = data.filter((t) => t.currency_symbol === currencyFilter);
    }

    // NETWORK
    if (networkFilter !== "all") {
      data = data.filter((t) => t.network_name === networkFilter);
    }

    // ACTOR FILTER (NEW)
    if (actorFilter !== "all") {
      data = data.filter((t) => t.role === actorFilter);
    }

    // DATE RANGE (NEW)
    if (startDate) {
      data = data.filter((t) =>
        new Date(t.created_at) >= startDate
      );
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      data = data.filter((t) =>
        new Date(t.created_at) <= end
      );
    }

    return data;
  }, [
    transactions,
    search,
    typeFilter,
    statusFilter,
    currencyFilter,
    networkFilter,
    actorFilter,
    startDate,
    endDate,
  ]);

  const formatDate = (date) => {
    if (!date) return "-";

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  // =========================
  // FILTER OPTIONS
  // =========================
  const currencies = useMemo(() => {
    return [
      ...new Set(
        transactions
          .map((t) => t.currency_symbol)
          .filter(Boolean)
      ),
    ];
  }, [transactions]);

  const networks = useMemo(() => {
    return [
      ...new Set(
        transactions
          .map((t) => t.network_name)
          .filter(Boolean)
      ),
    ];
  }, [transactions]);

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setCurrencyFilter("all");
    setNetworkFilter("all");
    setActorFilter("all");
    setDateRange([null, null]);
  };

  // Stat pill values — computed from the currently filtered set
  const filteredTxCount = filteredTx.length;

  // Total volume — only meaningful when the filtered set spans a single currency
  const filteredTxCurrencies = [...new Set(filteredTx.map((t) => t.currency_symbol).filter(Boolean))];
  const totalVolume =
    filteredTxCurrencies.length === 1
      ? fmt(filteredTx.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0))
      : null;
  const totalVolumeCurrency = filteredTxCurrencies.length === 1 ? filteredTxCurrencies[0] : null;

  const IN_TYPES = new Set([
  "income",
  "deposit",
  "deposit_from_user",
  "admin_deposit",
  "commission",
  ]);

  const OUT_TYPES = new Set([
    "withdraw",
    "withdrawal",
    "deposit_to_user",
  ]);


  // =========================
  // UI
  // =========================
  return (
    <div style={styles.page}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* ── HERO HUB (title/subtitle + filters + stat pills), centered on the page ── */}
      <div style={styles.header}>
        <HeroHub
          title="Transactions Management"
          subtitle="Monitor deposits, withdrawals, purchases and blockchain activity"
          search={{
            visible: true,
            value: search,
            onChange: setSearch,
            placeholder: "Search transactions...",
          }}
          dropdowns={[
            {
              key: "type",
              visible: true,
              value: typeFilter,
              onChange: setTypeFilter,
              placeholder: "All Types",
              options: [
                { label: "Deposit", value: "deposit" },
                { label: "Withdraw", value: "withdraw" },
                { label: "Purchase", value: "purchase" },
                { label: "Refund", value: "refund" },
              ],
            },
            {
              key: "status",
              visible: true,
              value: statusFilter,
              onChange: setStatusFilter,
              placeholder: "All Status",
              options: [
                { label: "Pending", value: "pending" },
                { label: "Completed", value: "completed" },
                { label: "Failed", value: "failed" },
                { label: "Frozen", value: "frozen" },
              ],
            },
            {
              key: "currency",
              visible: true,
              value: currencyFilter,
              onChange: setCurrencyFilter,
              placeholder: "All Currency",
              options: currencies.map((c) => ({ label: c, value: c })),
            },
            {
              key: "network",
              visible: true,
              value: networkFilter,
              onChange: setNetworkFilter,
              placeholder: "All Networks",
              options: networks.map((n) => ({ label: n, value: n })),
            },
            {
              key: "actor",
              visible: true,
              value: actorFilter,
              onChange: setActorFilter,
              placeholder: "All Actors",
              options: [
                { label: "Admin Only", value: "admin" },
                { label: "User Only", value: "user" },
              ],
            },
          ]}
          datePicker={{
            visible: true,
            selectsRange: true,
            startDate,
            endDate,
            onChange: (update) => setDateRange(update),
            placeholderText: "Select date range",
          }}
          statPills={[
            { key: "totalTx", icon: SlidersHorizontal, label: "Transactions", value: filteredTxCount, accent: "#a78bfa", loading },
            { key: "volume", icon: Wallet, label: "Volume", value: totalVolume, meta: totalVolumeCurrency, accent: "#22d3ee", loading },
          ]}
          onRefresh={loadTransactions}
          refreshing={loading}
        />
      </div>

      {/* TABLE */}
      <div style={styles.tableContainer}>
        <div style={styles.tableScroll}>
        <table style={styles.table}>

          <thead>

            <tr style={styles.tableHeader}>

              <th style={thStyle}>TX</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>User</th>
              <th style={thStyle}>Order</th>
              <th style={thStyle}>Product</th>
              <th style={thStyle}>Amount</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}>Wallet</th>
              <th style={thStyle}>Hash</th>
              <th style={thStyle}>Confirm</th>

            </tr>

          </thead>

          <tbody>

            {filteredTx.map((t) => {


              const isIncome = IN_TYPES.has(t.type);
              
              const amountValue = Number(t.amount);
              const typeColor = amountValue > 0 || isIncome ? "#10b981" : "#ef4444";


              
              const sign = amountValue > 0 || isIncome ? "+" : "-";


              return (

                <tr
                  key={t.id}
                  style={styles.row}
                >

                  {/* TX */}
                  <td style={tdStyle}>
                    <strong>
                      #{t.id}
                    </strong>
                  </td>

                  {/* TYPE */}
                  <td style={tdStyle}>
                    <span style={styles.typeBadge}>
                      {t.type}
                    </span>
                  </td>

                  {/* USER */}
                  <td style={tdStyle}>
                    <div
                      onClick={() => openUser(t)}
                      style={styles.userLink}
                    >
                      {t.username || "Unknown"}
                    </div>

                    <small style={styles.sub}>
                      USER #{t.user_id}
                    </small>
                  </td>

                  {/* ORDER */}
                  <td style={tdStyle}>

                    {t.order_id ? (
                      <div
                        onClick={() => openOrder(t)}
                        style={styles.orderLink}
                      >
                        #{t.order_id}
                      </div>
                    ) : (
                      "-"
                    )}

                  </td>

                  {/* PRODUCT */}
                  <td style={tdStyle}>

                    <div
                      style={{
                        fontWeight: 600,
                      }}
                    >
                      {t.product?.name ||  "-"}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        marginTop: 6,
                      }}
                    >

                      {t.plan && (
                        <span
                          style={styles.planBadge}
                        >
                          {t.plan}
                        </span>
                      )}



                    </div>

                  </td>

                  {/* AMOUNT */}
                  <td style={tdStyle}>

                    <div
                      style={{
                        color: typeColor,
                        fontWeight: 700
                      }}
                    >
                {sign}
                {fmt(Math.abs(t.amount), 4)}
                            </div>
                    

                    <small style={styles.sub}>
                      {t.currency_symbol}
                      
                    </small>
                      {t.network_name && (
                        <span
                          style={{
                            ...styles.networkBadge, marginLeft:6,
                          }}
                        >
                          {t.network_name}
                        </span>
                      )}


                  </td>



                  {/* STATUS */}
                  <td style={tdStyle}>

                    <span
                      style={{
                        ...styles.statusBadge,

                        background:
                          t.status === "completed"
                            ? "#10b98122"
                            : t.status ===
                              "pending"
                            ? "#f59e0b22"
                            : "#ef444422",

                        color:
                          t.status === "completed"
                            ? "#34d399"
                            : t.status ===
                              "pending"
                            ? "#fbbf24"
                            : "#f87171",
                      }}
                    >
                      {t.status}
                    </span>

                  </td>

                  {/* CREATED */}
                  <td style={tdStyle}>

                    <small>{formatDate(t.created_at)}
                    </small>

                  </td>

                  {/* WALLET */}
                  <td style={tdStyle}>

                    {t.wallet_address ? (
                      <div style={styles.hashText}>
                        {t.wallet_address.slice(
                          0,
                          8
                        )}
                        ...
                        {t.wallet_address.slice(
                          -6
                        )}
                      </div>
                    ) : (
                      "-"
                    )}

                  </td>

                  {/* HASH */}
                  <td style={tdStyle}>

                    {t.tx_hash ? (
                      <div style={styles.hashText}>
                        {t.tx_hash.slice(0, 10)}
                        ...
                        {t.tx_hash.slice(-6)}
                      </div>
                    ) : (
                      "-"
                    )}

                  </td>

                  {/* CONFIRM */}
                  <td style={tdStyle}>

                    <span
                      style={{
                        color:
                          Number(
                            t.confirmations || 0
                          ) > 0
                            ? "#22c55e"
                            : "#64748b",
                        fontWeight: 700,
                      }}
                    >
                      {t.confirmations || 0}
                    </span>

                  </td>

                </tr>
              );
            })}

          </tbody>

        </table>

        {!loading && transactions.length > 0 && filteredTx.length === 0 && (
            <div style={styles.empty}>
              No transactions found
            </div>
          )}

      </div>
      </div>




      {/* SIDEBARS */}
      {selectedUser && (
        <UserSidebar
          user={selectedUser}
          onClose={() =>
            setSelectedUser(null)
          }
          onRefresh={loadTransactions}
        />
      )}

      {selectedOrder && (
        <OrderSidebar
          order={selectedOrder}
          onClose={() =>
            setSelectedOrder(null)
          }
          onRefresh={loadTransactions}
          onOpenUser={openUser}
        />
      )}

    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "18px 16px",
  color: "#94a3b8",
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "18px 16px",
  borderBottom: "1px solid #1e293b",
  verticalAlign: "middle",
};

const styles = {
  page: {
    padding: "0px",
    background: "#020617",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    color: "white",
    boxSizing: "border-box",
  },



tableScroll: {
  overflowY: "auto",
  flex: 1,
  minHeight: 0,
},

    title: { color: "#2e7ce9af",margin: 0, fontSize: 26, fontWeight: 600, marginRight: 20 , letterSpacing: "0.1rem",   },
  subtitle: { color: "#64748b", fontSize: 13, margin: "2px 0 0" },
  header: {
    display: "flex",
    justifyContent: "flex-start",
    width: "100%",
    padding: "0px 0px 10px",
    boxSizing: "border-box",
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

 filtersContainer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 14,
    marginBottom: 24,
    flexWrap: "wrap",
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

  filterInput: {
    background:"#0a1020", border:"1px solid rgba(255,255,255,.07)", color:"white",
    borderRadius:8, padding:"6px 10px", fontSize:11, outline:"none", minWidth:80,
  },

  tableContainer: {
    background: "#0b1424",
    border: "1px solid #313d58bc",
    borderRadius: 15,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    
    margin: "10px 100px 20px 100px",
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

  userLink: {
    color: "#60a5fa",
    fontWeight: 600,
    cursor: "pointer",
  },

  orderLink: {
    color: "#34d399",
    fontWeight: 700,
    cursor: "pointer",
  },

  sub: {
    color: "#64748b",
    fontSize: 11,
  },

  typeBadge: {
    background: "#1e293b",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    textTransform: "capitalize",
  },

  planBadge: {
    background: "#172554",
    color: "#93c5fd",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 11,
  },

  networkBadge: {
    background: "#1e293b",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 11,
  },

  statusBadge: {
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "capitalize",
  },

  hashText: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#cbd5e1",
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