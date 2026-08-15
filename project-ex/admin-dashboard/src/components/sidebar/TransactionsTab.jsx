import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useState, useMemo, useEffect } from "react";
import {formatBigNumber , getNumberSuffixColor} from "../../components/HelperFunctions";


export default function TransactionsTab({ transactions, loadingTx }) {
    // =========================
  // FILTER STATE
  // =========================
  const [txDateRange, setTxDateRange] = useState([null, null]);
  const [txStartDate, txEndDate] = txDateRange;
  const [txCurrencyFilter, setTxCurrencyFilter] = useState("");
  const [txStatusFilter, setTxStatusFilter] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("");
  
      // Get unique currencies from transactions
  const txCurrencyOptions = useMemo(() => {
    const currencies = [
      ...new Set(
        (transactions || [])
          .map(t => t.currency?.symbol)
          .filter(Boolean)
      ),
    ];

    return ["ALL", ...currencies];
  }, [transactions]);

    // Default to first currency when options change
  useEffect(() => {
    if (
      txCurrencyOptions.length > 0 &&
      !txCurrencyFilter
    ) {
      setTxCurrencyFilter("ALL");
    }
  }, [txCurrencyOptions, txCurrencyFilter]);

  const startOfDay = (date) => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const endOfDay = (date) => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  // =========================
  // FILTER LOGIC
  // =========================
    const filteredTransactions = useMemo(() => {
      const start = startOfDay(txStartDate);
      const end = endOfDay(txEndDate);

      return (transactions || []).filter((t) => {
        const created = new Date(t.created_at);

        const inDateRange =
          (!start || created >= start) &&
          (!end || created <= end);

        const statusMatch =
          !txStatusFilter ||
          txStatusFilter === "all" ||
          t.status === txStatusFilter;

        const currencyMatch =
          !txCurrencyFilter ||
          txCurrencyFilter === "ALL" ||
          t.currency?.symbol === txCurrencyFilter;

        const typeMatch =
          !txTypeFilter ||
          txTypeFilter === "all" ||
          t.type === txTypeFilter;

        return (
          inDateRange &&
          statusMatch &&
          currencyMatch &&
          typeMatch
        );
      });
    }, [
      transactions,
      txStartDate,
      txEndDate,
      txStatusFilter,
      txTypeFilter,
      txCurrencyFilter,
    ]);
      
  
    const txStats = useMemo(() => {
      const list = filteredTransactions || [];

      const totalCount = list.length;

      const completedCount = list.filter(
        (t) => t.status === "completed"
      ).length;

      let inflow = null;
      let outflow = null;

      // Only calculate money totals when a specific currency is selected
      if (txCurrencyFilter !== "ALL") {
        const moneyTx = list.filter((t) => t.status !== "frozen");

        // Positive amounts = Inflow
        inflow = moneyTx
          .filter((t) => Number(t.amount) > 0)
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);

        // Negative amounts = Outflow (show as positive number)
        outflow = moneyTx
          .filter((t) => Number(t.amount) < 0)
          .reduce((sum, t) => sum + (Number(t.amount || 0)), 0);
      }

      return {
        totalCount,
        inflow,
        outflow,
        completedCount,
      };
    }, [filteredTransactions, txCurrencyFilter]);
  // =========================
  // UNIQUE TYPE OPTIONS
  // =========================
    const typeOptions = useMemo(() => {
      const set = new Set();
      (transactions || []).forEach((t) => {
        set.add(t.type || t.product?.name || "unknown");
      });
      return Array.from(set);
    }, [transactions]);


  const BigNumber = ({ value, style = {} }) => {
    const formatted = formatBigNumber(value);
  
    return (
      <span style={{ ...style }}>
        {formatted.value}
        {formatted.suffix && (
          <span
            style={{
              marginLeft: 4,
              color: getNumberSuffixColor(formatted.suffix),
              fontSize: "0.9em",
              fontWeight: 700,
            }}
          >
            {formatted.suffix}
          </span>
        )}
      </span>
    );
  };

  return (
            <div style={styles.transactionsList}>


        {/* =========================
            FILTER ROW
        ========================= */}
        <div
          style={{
            display: "flex",
            gap: 10,
            flex: 1,
            flexWrap: "nowrap",
            alignItems: "center",
            overflowX: "auto",
          }}
        >
          {/* DATE RANGE */}
          <div style={{ flex: 1 }}>
            <div style={styles.historyFitlerTitle}>Date Range</div>

            <DatePicker
              selectsRange
              startDate={txStartDate}
              endDate={txEndDate}
              onChange={(update) => setTxDateRange(update)}
              isClearable
              placeholderText="Transaction date range"
              customInput={
                <input
                  style={{
                    ...styles.input,
                    width: 220,
                  }}
                />
              }
            />
          </div>

          {/* STATUS */}
          <div style={{ flex: 1 }}>
            <div style={styles.historyFitlerTitle}>Status</div>

            <select
              style={styles.input}
              value={txStatusFilter}
              onChange={(e) => setTxStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* TYPE */}
          <div style={{ flex: 1 }}>
            <div style={styles.historyFitlerTitle}>Transaction Type</div>

            <select
              style={styles.input}
              value={txTypeFilter}
              onChange={(e) => setTxTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>

              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* CURRENCY */}
          {txCurrencyOptions.length > 0 && (
            <div style={{ flex: 1 }}>
              <div style={styles.historyFitlerTitle}>Currency</div>

              <select
                style={styles.input}
                value={txCurrencyFilter}
                onChange={(e) => setTxCurrencyFilter(e.target.value)}
              >
                {txCurrencyOptions.map((sym) => (
                  <option key={sym} value={sym}>
                    {sym}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

              
          {/* =========================
              METRICS PILLs
          ========================= */}
          <div style={styles.txPillsRow}>
            {/* 1. Total Transactions */}
            <div style={styles.txPill}>
              <div style={styles.txPillValue}>{txStats.totalCount}</div>
              <div style={styles.txPillLabel}>Transactions</div>
            </div>

            {/* 2. Inflow */}
            <div style={styles.txPill}>
              <div style={styles.txPillValue}>
                {txCurrencyFilter === "ALL" ? (
                  "..."
                ) : (
                  <>
                    <BigNumber value={txStats.inflow} />
                    {txCurrencyFilter && (
                      <span
                        style={{
                          ...styles.providerMeta,
                          fontSize: 10,
                          marginLeft: 4,
                        }}
                      >
                        {txCurrencyFilter}
                      </span>
                    )}
                  </>
                )}
              </div>
              <div style={styles.txPillLabel}>Inflow</div>
            </div>

            {/* 3. Outflow */}
            <div style={styles.txPill}>
              <div style={{...styles.txPillValue, color: "#db3e3e"}}>
                {txCurrencyFilter === "ALL" ? (
                  "..."
                ) : (
                  <>
                    <BigNumber value={txStats.outflow} />
                    {txCurrencyFilter && (
                      <span
                        style={{
                          ...styles.providerMeta,
                          fontSize: 10,
                          marginLeft: 4,
                        }}
                      >
                        {txCurrencyFilter}
                      </span>
                    )}
                  </>
                )}
              </div>
              <div style={styles.txPillLabel}>Outflow</div>
            </div>

            {/* 4. Completed */}
            <div style={styles.txPill}>
              <div style={{ ...styles.txPillValue, color: "#22c55e" }}>
                {txStats.completedCount}
              </div>
              <div style={styles.txPillLabel}>Completed</div>
            </div>
          </div>

              {/* =========================
                  LIST
              ========================= */}
              {loadingTx ? (
                <div>Loading transactions...</div>
              ) : (filteredTransactions || []).length === 0 ? (
                <div style={styles.emptyTransactions}>No product transactions found</div>
              ) : (
(filteredTransactions || []).map((t) => {
  const isPositive = Number(t.amount) >= 0;
  const currencySymbol = t.currency?.symbol || t.currency_symbol || "—";
  const networkName = t.network?.name || t.network_name || "";
  const txHash = t.tx_hash || "";
  const txWalletAddress = t.walletAddress || "";
  const TxConfirmations = t.confirmations || "";
  const TxBlockchain = t.blockchain || "";

  return (
    <div key={t.id} style={styles.txCard}>
      {/* ===== TOP ROW: Type + Status ===== */}
      <div style={styles.txHeader}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.txType}>
            {t.type || "Product Transaction"}
          </div>
          <div style={styles.txMeta}>
            {t.product?.name && `${t.product.name}`}
            {t.product?.plan && ` • ${t.product.plan}`}
          </div>
        </div>

        <div
          style={{
            ...styles.txStatus,
            ...(t.status === "completed"
              ? styles.txCompleted
              : t.status === "pending"
              ? styles.txPending
              : styles.txFailed),
          }}
        >
          {t.status?.toUpperCase()}
        </div>
      </div>

      {/* ===== AMOUNT + NETWORK ===== */}
      <div style={styles.txAmountRow}>
        <div
          style={{
            ...styles.txAmount,
            color: isPositive ? "#22c55e" : "#ef4444",
          }}
        >
          {isPositive ? "+" : ""}
          <BigNumber value={t.amount} />
          <span style={styles.orderCurrency}>
            {currencySymbol && ` ${currencySymbol}`}
          </span>
        </div>

        {networkName && (
          <div style={styles.networkBadge}>{networkName.toUpperCase()}</div>
        )}
      </div>

      {/* ===== IDs + DATE ===== */}
      <div style={styles.txIdsRow}>
        <div style={styles.txMeta}>
          TX #{t.id}
          {t.order_id && ` • ORDER #${t.order_id}`}
          {t.wire_transfer_order_id && ` • WIRE #${t.wire_transfer_order_id}`}
        </div>
        <span style={styles.txDate}>
          {new Date(t.created_at).toLocaleString()}
        </span>
      </div>

      {/* ===== BLOCKCHAIN DETAILS (only if any exist) ===== */}
      {(TxBlockchain || txWalletAddress || txHash || TxConfirmations) && (
        <div style={styles.txBlockchain}>
          {TxBlockchain && (
            <div style={styles.txInfoItem}>
              <span style={styles.txInfoLabel}>Chain</span>
              <span style={styles.txInfoValue}>
                {t.blockchain.toUpperCase()}
              </span>
            </div>
          )}

          {txWalletAddress && (
            <div style={styles.txInfoItem}>
              <span style={styles.txInfoLabel}>Wallet</span>
              <span style={styles.txInfoValue}>
                {txWalletAddress.slice(0, 8)}...{txWalletAddress.slice(-6)}
              </span>
            </div>
          )}

          {txHash && (
            <div style={styles.txInfoItem}>
              <span style={styles.txInfoLabel}>Hash</span>
              <span style={styles.txInfoValue}>
                {txHash.slice(0, 8)}...{txHash.slice(-6)}
              </span>
            </div>
          )}

          {TxConfirmations && (
            <div style={styles.txInfoItem}>
              <span style={styles.txInfoLabel}>Conf</span>
              <span style={styles.txInfoValue}>{t.confirmations}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
})
              )}
            </div>
  );
}


// =====================================================
// STYLES
// =====================================================

const customScrollbar = {
  scrollbarWidth: "thin",
  scrollbarColor: "#64748b #1e293b",
  overflowY: "auto",
  overflowX: "auto",
};

const styles = {
  overlay: (visible) => ({
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    backdropFilter: "blur(4px)",
    zIndex: 50,
    opacity: visible ? 1 : 0,
    transition: "opacity 250ms ease",
  }),

  container: (visible) => ({
    position: "fixed",
    top: 0,
    right: 0,
    width: 580,
    height: "100vh",
    background: "#0f172a",
    borderLeft: "2px solid #1e293b",
    color: "white",
    zIndex: 60,
    display: "flex",
    flexDirection: "column",

    transform: visible ? "translateX(0%)" : "translateX(100%)",
    opacity: visible ? 1 : 0,
    transition: "transform 200ms ease, opacity 250ms ease",
  }),

  header: {
    padding: 20,
    borderBottom: "1px solid #1e293b",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  userTitle: { fontSize: 20, fontWeight: 700 },
  userSub: { fontSize: 12, color: "#94a3b8", marginTop: 4 },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#111827",
    color: "white",
    cursor: "pointer",
  },

  tabs: {
    display: "flex",
    gap: 8,
    padding: 14,
    overflowX: "auto",
    borderBottom: "1px solid #1e293b",
    scrollbarWidth: "thin",
    scrollbarColor: "#64748b #1e293b",
  },

  tab: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #1e293b",
    background: "#111827",
    color: "#94a3b8",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  activeTab: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #2563eb",
    background: "#1d4fd871",
    color: "white",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 600,
  },

  content: {
    flex: 1,
    padding: 18,
    ...customScrollbar,
  },

  section: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #1e293b",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },

  sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 18 },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },

  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 13,
    color: "#94a3b8",
  },

 input: {
    width: "100%",
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: 12,
    color: "white",
    outline: "none",
    boxSizing: "border-box",
  },

  primaryBtn: {
    width: "100%",
    background: "#1d4fd871",
    border: "none",
    marginTop: 20,
    borderRadius: 14,
    padding: 14,
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },

  toggleRow: {
    marginTop: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  enabledToggle: {
    background: "rgba(34,197,94,0.15)",
    color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },

  disabledToggle: {
    background: "rgba(239,68,68,0.15)",
    color: "#ef4444",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },

  list: { display: "flex", flexDirection: "column", gap: 12, ...customScrollbar },
  card: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: { fontWeight: 700, marginBottom: 6 },
  cardSub: { color: "#94a3b8", fontSize: 13 },

  chatWrapper: { 
    height: "100%", 
    display: "flex", 
    flexDirection: "column",
    overflow: "hidden",
 },

  balanceGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 15 },

  balanceCard: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #1e293b",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  balanceHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  balanceCurrency: { fontSize: 18, fontWeight: 700, color: "white" },
  balanceNetwork: {
    fontSize: 11,
    fontWeight: 600,
    color: "#93c5fd",
    background: "rgba(37,99,235,0.15)",
    border: "1px solid rgba(37,99,235,0.25)",
    padding: "4px 8px",
    borderRadius: 999,
  },

  balanceRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  balanceLabel: { fontSize: 12, color: "#94a3b8" },
  availableValue: { color: "#22c55e", fontWeight: 700, fontSize: 15 },
  frozenValue: { color: "#f59e0b", fontWeight: 700, fontSize: 15 },

  emptyBalances: {
    gridColumn: "1 / -1",
    textAlign: "center",
    padding: 24,
    borderRadius: 16,
    border: "1px dashed #334155",
    background: "#0b1220",
    color: "#64748b",
  },

  historyFitlerTitle: {
    fontSize: 11,
    color: "#64748b",
    padding: "0 0 5px 5px"
},
providerMeta: {
    fontSize: 12,
    fontWeight: 400,
    color: "#94a3b8c0",
    whiteSpace: "nowrap",
},

  // ── INTERNAL TRANSFER ──────────────────────────────────────────
  transferBox: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #2564eb63",
    borderRadius: 15,
    overflow: "visible",
    marginTop: 4,
    marginBottom:10
  },

  transferHeader: {
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    borderBottom: "1px solid #1e293b",
    userSelect: "none",
  },

  transferIcon: {
    fontSize: 16,
    color: "#60a5fa",
    background: "rgba(37,99,235,0.15)",
    border: "1px solid rgba(37,99,235,0.25)",
    borderRadius: 8,
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    flexShrink: 0,
  },

  transferHeaderLabel: { fontWeight: 600, color: "#e2e8f0", fontSize: 14 },
  transferHeaderSub: { fontSize: 11, color: "#64748b", marginTop: 2 },

  transferBody: {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  transferSelectedBadge: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#22c55e",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    pointerEvents: "none",
  },

  transferSpinner: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#64748b",
    fontSize: 16,
    pointerEvents: "none",
  },

  transferDropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 12,
    zIndex: 999,
    maxHeight: 200,
    overflowY: "auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  },

  transferDropItem: {
    padding: "10px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    borderBottom: "1px solid #1e293b",
  },

  transferBalanceHint: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 10,
    padding: "8px 12px",
  },

  transferMaxBtn: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(37,99,235,0.2)",
    border: "1px solid rgba(37,99,235,0.4)",
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: 800,
    padding: "4px 8px",
    borderRadius: 6,
    cursor: "pointer",
    letterSpacing: 0.5,
  },

  transferPreview: {
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 14,
    padding: "10px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },

  transferPreviewRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    borderBottom: "1px solid #1e293b",
  },

  transferErrorBox: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#ef4444",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
  },

  transferSuccessBox: {
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#22c55e",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
  },

  transferBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)",
    border: "1px solid rgba(37,99,235,0.4)",
    borderRadius: 14,
    padding: "13px 0",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  // ── END INTERNAL TRANSFER ──────────────────────────────────────

  ordersList: { display: "flex", flexDirection: "column", gap: 14, ...customScrollbar },

  orderCard: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #2c384dff",
    borderRadius: 20,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  orderTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  orderProduct: { fontSize: 16, fontWeight: 700, color: "white" },
  orderMeta: { marginTop: 6, fontSize: 12, color: "#64748b" },

  orderStatus: { padding: "7px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "1px solid" },
  statusPending: { background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.25)", color: "#f59e0b" },
  statusApproved: { background: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.25)", color: "#60a5fa" },
  statusDelivered: { background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)", color: "#22c55e" },
  statusDefault: { background: "rgba(246, 7, 7, 0.35)", borderColor: "rgba(184, 156, 148, 0.25)", color: "#b89994ff" },


orderCurrency: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  background: "rgba(37,99,235,0.12)",
  border: "1px solid rgba(37,99,235,0.25)",
  padding: "2px 10px",
  fontSize: 12,
  marginLeft: 8,
  color: "#94a3b8",
  fontWeight: 600,
  lineHeight: 1,
  height: 22,
  boxSizing: "border-box",
},

networkBadge: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2px 10px",
  height: 22,
  boxSizing: "border-box",
  borderRadius: 999,
  background: "rgba(37,99,235,0.12)",
  border: "1px solid rgba(37,99,235,0.25)",
  color: "#93c5fd",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1,
},
  orderDates: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

  dateItem: { background: "#0b1220", border: "1px solid #1e293b", borderRadius: 14, padding: 12 },
  dateLabel: { display: "block", fontSize: 11, color: "#64748b", marginBottom: 6 },
  dateValue: { fontSize: 13, color: "#e2e8f0", fontWeight: 600 },

  emptyOrders: {
    padding: 24,
    borderRadius: 18,
    textAlign: "center",
    border: "1px dashed #334155",
    background: "#111827",
    color: "#64748b",
  },

  transactionsList: { display: "flex", flexDirection: "column", gap: 14, ...customScrollbar },

txCard: {
  background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
  border: "1px solid #2c384dff",
  borderRadius: 16,
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
},

txHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
},

txType: {
  fontSize: 14,
  fontWeight: 700,
  color: "white",
  textTransform: "capitalize",
  lineHeight: 1.3,
},

txMeta: {
  marginTop: 3,
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.3,
},

txAmountRow: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
},

txAmount: {
  display: "flex",
  alignItems: "center",
  fontSize: 18,
  fontWeight: 800,
  gap: 6,
},

txIdsRow: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
},
// Status badges
txStatus: { 
  padding: "7px 12px", 
  borderRadius: 999, 
  fontSize: 11, 
  fontWeight: 700, 
  border: "1px solid" 
},
txCompleted: { 
  background: "rgba(34,197,94,0.12)", 
  borderColor: "rgba(34,197,94,0.25)", 
  color: "#22c55e" 
},
txPending: { 
  background: "rgba(245,158,11,0.12)", 
  borderColor: "rgba(245,158,11,0.25)", 
  color: "#f59e0b" 
},
txFailed: { 
  background: "rgba(239,68,68,0.12)", 
  borderColor: "rgba(239,68,68,0.25)", 
  color: "#ef4444" 
},

txDate: {
  fontSize: 11,
  color: "#64748b",
  whiteSpace: "nowrap",
},

txBlockchain: {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 16px",
  background: "#0b1220",
  border: "1px solid #1e293b",
  borderRadius: 12,
  padding: "10px 12px",
},

txInfoItem: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  minWidth: 150,          // ← this is the key
  flex: "1 1 150px",      // optional: allows them to grow
},

txInfoLabel: {
  fontSize: 11,
  color: "#64748b",
},

txInfoValue: {
  fontSize: 11,
  color: "#e2e8f0",
  fontWeight: 600,
  fontFamily: "monospace",
},
  txFooter: { display: "flex", justifyContent: "flex-end" },
  txDate: { fontSize: 12, color: "#64748b" },

  emptyTransactions: {
    padding: 24,
    borderRadius: 18,
    textAlign: "center",
    border: "1px dashed #334155",
    background: "#111827",
    color: "#64748b",
  },

  subTabs: { display: "flex", gap: 10, marginBottom: 14 },

  subTab: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid #1e293b",
    background: "#0b1220",
    color: "#94a3b8",
    cursor: "pointer",
  },

  subTabActive: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid #2563eb",
    background: "#1d4fd871",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  },

  createOrderBox: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #2564eb63",
    borderRadius: 15,
    overflow: "hidden",
  },


  createOrderBody: {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
    txPillsRow: {
  display: "flex",
  gap: 10,
  marginBottom: 15,
  flexWrap: "wrap",
  borderRadius: 14,
  background: "linear-gradient(180deg, #0f172a 30%, #070e1dff 100%)",
},

txPill: {
  flex: "1",
  minWidth: 120,
  alignItems: "center",
  borderRadius: 14,
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
},

txPillValue: {
  fontSize: 16,
  fontWeight: 800,
  color: "white",
},

txPillLabel: {
  fontSize: 11,
  color: "#94a3b8",
},

  ordersDivider: { display: "flex", alignItems: "center", gap: 12, marginTop: 18, marginBottom: 18 },
  ordersDividerLine: { flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #334155, transparent)" },
  ordersDividerText: { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#64748b", whiteSpace: "nowrap" },
};