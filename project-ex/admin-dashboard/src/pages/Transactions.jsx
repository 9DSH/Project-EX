import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../config";
import UserSidebar from "../components/UserSidebar";
import OrderSidebar from "../components/OrderSidebar";
import HeroHub from "../components/HeroHub";
import { SlidersHorizontal, Wallet } from "lucide-react";
import "./Transactions.css";

// ── Skeleton ─────────────────────────────────────────────────────
function Sk({ w = "100%", h = 16, r = 6 }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: "linear-gradient(90deg,#151f30 25%,#1e2d44 50%,#151f30 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
      }}
    />
  );
}

const fmt = (n, d = 2) =>
  n != null ? Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d }) : "—";

// ── Grid column template — shared by header + every row ─────────
// TX | Type | User | References | Amount | Chain | Wallet | Hash | Confirm | Status | Created
const COLS = "106px 170px 200px 140px 130px 150px 140px 140px 84px 104px 128px";

const IN_TYPES = new Set(["income", "deposit", "deposit_from_user", "admin_deposit", "commission"]);
const OUT_TYPES = new Set(["withdraw", "withdrawal", "deposit_to_user"]);

// ── One transaction row — every field on the Transaction model ──
function TransactionRow({ t, onOpenUser, onOpenOrder, formatDate }) {
  const isIncome = IN_TYPES.has(t.type);
  const amountValue = Number(t.amount);
  const typeColor = amountValue > 0 || isIncome ? "#10b981" : "#ef4444";
  const sign = amountValue > 0 || isIncome ? "+" : "-";

  const statusColors = {
    completed: { bg: "#10b98122", color: "#34d399" },
    pending: { bg: "#f59e0b22", color: "#fbbf24" },
  };
  const statusStyle = statusColors[t.status] || { bg: "#ef444422", color: "#f87171" };

  return (
    <div className="tx-row" style={{ gridTemplateColumns: COLS }}>
      {/* TX (id) */}
      <div className="tx-id">#{t.id}</div>

      {/* TYPE */}
      <div>
        <span className="tx-type-badge">{t.type}</span>
      </div>

      {/* USER */}
      <div style={{ minWidth: 0 }}>
        <div className="tx-user-link" onClick={() => onOpenUser(t)}>
          {t.username || "Unknown"}
        </div>
        <div className="tx-user-sub">USER #{t.user_id}</div>
      </div>

      {/* REFERENCES: order_id / wire_transfer_order_id / platform_bank_account_id */}
      <div className="tx-refs">
        {t.order_id ? (
          <span className="tx-ref-pill">
            Order <span className="tx-ref-link" onClick={() => onOpenOrder(t)}>#{t.order_id}</span>
          </span>
        ) : (
          <span className="tx-ref-pill tx-ref-muted">Order —</span>
        )}
        <span className={`tx-ref-pill${t.wire_transfer_order_id ? "" : " tx-ref-muted"}`}>
          Wire {t.wire_transfer_order_id ? `#${t.wire_transfer_order_id}` : "—"}
        </span>
        <span className={`tx-ref-pill${t.platform_bank_account_id ? "" : " tx-ref-muted"}`}>
          Bank Acct {t.platform_bank_account_id ? `#${t.platform_bank_account_id}` : "—"}
        </span>
      </div>

      {/* AMOUNT */}
      <div>
        <div className="tx-amount" style={{ color: typeColor }}>
          {sign}
          {fmt(Math.abs(t.amount), 4)}
        </div>
        <div className="tx-amount-sub">
          {t.currency_symbol || (t.currency_id ? `#${t.currency_id}` : "—")}
        </div>
      </div>

      {/* CHAIN: currency/network ids + blockchain */}
      <div style={{ minWidth: 0 }}>
        <div className="tx-chain-line">
          {t.network_name || (t.network_id ? `Network #${t.network_id}` : "No network")}
        </div>
        <span className="tx-blockchain-badge">{t.blockchain || "bsc"}</span>
      </div>

      {/* WALLET */}
      <div className="tx-hash-text">
        {t.wallet_address ? (
          <>
            {t.wallet_address.slice(0, 8)}...{t.wallet_address.slice(-6)}
          </>
        ) : (
          <span className="tx-muted">—</span>
        )}
      </div>

      {/* HASH */}
      <div className="tx-hash-text">
        {t.tx_hash ? (
          <>
            {t.tx_hash.slice(0, 10)}...{t.tx_hash.slice(-6)}
          </>
        ) : (
          <span className="tx-muted">—</span>
        )}
      </div>

      {/* CONFIRMATIONS */}
      <div className="tx-confirm" style={{ color: Number(t.confirmations || 0) > 0 ? "#22c55e" : "#64748b" }}>
        {t.confirmations || 0}
      </div>

      {/* STATUS */}
      <div>
        <span className="tx-status-badge" style={{ background: statusStyle.bg, color: statusStyle.color }}>
          {t.status}
        </span>
      </div>

      {/* CREATED */}
      <div className="tx-created">{formatDate(t.created_at)}</div>
    </div>
  );
}

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

  // ── Sort state (same single-key / asc-desc pattern as Users) ──
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const token = localStorage.getItem("token");

  // =========================
  // LOAD TRANSACTIONS
  // =========================
  const loadTransactions = async () => {
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/admin/orders/transactions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
      const res = await fetch(`${API_URL}/admin/users/${t.user_id}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

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
  // FILTER + SORT ENGINE
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
          t.wire_transfer_order_id,
          t.platform_bank_account_id,
          t.user_id,
          t.username,
          t.product_name,
          t.wallet_address,
          t.tx_hash,
          t.network_name,
          t.network_chain,
          t.blockchain,
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

    // ACTOR FILTER
    if (actorFilter !== "all") {
      data = data.filter((t) => t.role === actorFilter);
    }

    // DATE RANGE
    if (startDate) {
      data = data.filter((t) => new Date(t.created_at) >= startDate);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      data = data.filter((t) => new Date(t.created_at) <= end);
    }

    // SORT (mirrors the Users.jsx handleSort/sortKey/sortDir pattern)
    data.sort((a, b) => {
      let A, B;

      switch (sortKey) {
        case "id":
          A = a.id;
          B = b.id;
          break;
        case "type":
          A = a.type || "";
          B = b.type || "";
          break;
        case "user_id":
          A = a.user_id;
          B = b.user_id;
          break;
        case "amount":
          A = Math.abs(Number(a.amount) || 0);
          B = Math.abs(Number(b.amount) || 0);
          break;
        case "confirmations":
          A = Number(a.confirmations || 0);
          B = Number(b.confirmations || 0);
          break;
        case "status":
          A = a.status || "";
          B = b.status || "";
          break;
        case "created_at":
          A = new Date(a.created_at).getTime() || 0;
          B = new Date(b.created_at).getTime() || 0;
          break;
        default:
          A = new Date(a.created_at).getTime() || 0;
          B = new Date(b.created_at).getTime() || 0;
      }

      if (typeof A === "number" && typeof B === "number") {
        return sortDir === "asc" ? A - B : B - A;
      }

      return sortDir === "asc" ? String(A).localeCompare(String(B)) : String(B).localeCompare(String(A));
    });

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
    sortKey,
    sortDir,
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
    return [...new Set(transactions.map((t) => t.currency_symbol).filter(Boolean))];
  }, [transactions]);

  const networks = useMemo(() => {
    return [...new Set(transactions.map((t) => t.network_name).filter(Boolean))];
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

  const sortArrow = (key) => (sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "");

  // =========================
  // UI
  // =========================
  return (
    <div className="tx-page">
      {/* ── HERO HUB (title/subtitle + filters + stat pills), centered on the page ── */}
      <div className="tx-header">
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
              label: "Type",
              value: typeFilter,
              onChange: setTypeFilter,
              placeholder: "All",
              options: [
                { label: "Deposit", value: "deposit" },
                { label: "Withdraw", value: "withdraw" },
                { label: "Purchase", value: "purchase" },
                { label: "Refund", value: "refund" },
              ],
            },
            {
              key: "status",
              label: "Status",
              visible: true,
              value: statusFilter,
              onChange: setStatusFilter,
              placeholder: "All",
              options: [
                { label: "Pending", value: "pending" },
                { label: "Completed", value: "completed" },
                { label: "Failed", value: "failed" },
                { label: "Frozen", value: "frozen" },
              ],
            },
            {
              key: "currency",
              label: "Currency",
              visible: true,
              value: currencyFilter,
              onChange: setCurrencyFilter,
              placeholder: "All",
              options: currencies.map((c) => ({ label: c, value: c })),
            },
            {
              key: "network",
              label: "Network",
              visible: true,
              value: networkFilter,
              onChange: setNetworkFilter,
              placeholder: "All",
              options: networks.map((n) => ({ label: n, value: n })),
            },
            {
              
              key: "actor",
              label: "User",
              visible: true,
              value: actorFilter,
              onChange: setActorFilter,
              placeholder: "All",
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
      <div className="tx-table-container">
        <div className="tx-table-scroll">
          {/* Sticky sortable header — stays visible while the body scrolls */}
          <div className="tx-table-head" style={{ gridTemplateColumns: COLS }}>
            <div className={`tx-sortable${sortKey === "id" ? " is-active" : ""}`} onClick={() => handleSort("id")}>
              TX {sortArrow("id")}
            </div>
            <div className={`tx-sortable${sortKey === "type" ? " is-active" : ""}`} onClick={() => handleSort("type")}>
              Type {sortArrow("type")}
            </div>
            <div className={`tx-sortable${sortKey === "user_id" ? " is-active" : ""}`} onClick={() => handleSort("user_id")}>
              User {sortArrow("user_id")}
            </div>
            <div>References</div>
            <div className={`tx-sortable${sortKey === "amount" ? " is-active" : ""}`} onClick={() => handleSort("amount")}>
              Amount {sortArrow("amount")}
            </div>
            <div>Chain</div>
            <div>Wallet</div>
            <div>Hash</div>
            <div className={`tx-sortable${sortKey === "confirmations" ? " is-active" : ""}`} onClick={() => handleSort("confirmations")}>
              Conf. {sortArrow("confirmations")}
            </div>
            <div className={`tx-sortable${sortKey === "status" ? " is-active" : ""}`} onClick={() => handleSort("status")}>
              Status {sortArrow("status")}
            </div>
            <div className={`tx-sortable${sortKey === "created_at" ? " is-active" : ""}`} onClick={() => handleSort("created_at")}>
              Created {sortArrow("created_at")}
            </div>
          </div>

          {/* Rows */}
          <div className="tx-table-body">
            {filteredTx.map((t) => (
              <TransactionRow key={t.id} t={t} onOpenUser={openUser} onOpenOrder={openOrder} formatDate={formatDate} />
            ))}
          </div>

          {!loading && transactions.length > 0 && filteredTx.length === 0 && (
            <div className="tx-empty">No transactions found</div>
          )}
        </div>
      </div>

      {/* SIDEBARS */}
      {selectedUser && <UserSidebar user={selectedUser} onClose={() => setSelectedUser(null)} onRefresh={loadTransactions} />}

      {selectedOrder && (
        <OrderSidebar order={selectedOrder} onClose={() => setSelectedOrder(null)} onRefresh={loadTransactions} onOpenUser={openUser} />
      )}
    </div>
  );
}