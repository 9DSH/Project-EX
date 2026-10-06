import "react-datepicker/dist/react-datepicker.css";
import "./UserSidebar.css";
import { useState, useMemo, useEffect } from "react";
import {formatBigNumber , getNumberSuffixColor} from "../../components/HelperFunctions";
import { FilterBar, MiniDropdown, MiniDateRange, StatPillsRow } from "./HubFilterControls";


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


  const BigNumber = ({ value, className = "" }) => {
    const formatted = formatBigNumber(value);

    return (
      <span className={className}>
        {formatted.value}
        {formatted.suffix && (
          <span
            className="us-meta-tag"
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

  const statusBadgeClass = (status) =>
    `us-badge${
      status === "completed" ? " is-success"
      : status === "pending" ? " is-warning"
      : " is-danger"
    }`;

  // Same date format used by OrdersTab ("27 Jun 2026 17:56"), so both
  // history lists read consistently.
  const formatDateTime = (date) => {
    if (!date) return "—";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";

    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");

    return `${day} ${month} ${year} ${hours}:${minutes}`;
  };

  return (
    <div className="us-scroll-list">

        {/* =========================
            FILTER ROW
        ========================= */}
        <FilterBar>
          <div className="us-hh-filter-row">
            <MiniDateRange
              label="Date Range"
              startDate={txStartDate}
              endDate={txEndDate}
              onChange={(update) => setTxDateRange(update)}
              placeholderText="Transaction date range"
              portalId="user-sidebar-datepicker-portal"
            />

            <MiniDropdown
              label="Status"
              value={txStatusFilter}
              onChange={setTxStatusFilter}
              placeholder="All Status"
              options={[
                { value: "completed", label: "Completed" },
                { value: "pending", label: "Pending" },
                { value: "failed", label: "Failed" },
              ]}
            />

            <MiniDropdown
              label="Transaction Type"
              value={txTypeFilter}
              onChange={setTxTypeFilter}
              placeholder="All Types"
              options={typeOptions.map((t) => ({ value: t, label: t }))}
            />

            {txCurrencyOptions.length > 0 && (
              <MiniDropdown
                label="Currency"
                value={txCurrencyFilter}
                onChange={setTxCurrencyFilter}
                options={txCurrencyOptions.map((sym) => ({ value: sym, label: sym }))}
              />
            )}
          </div>

          <div className="us-hh-row-divider" />

          <StatPillsRow
            pills={[
              { key: "count", label: "Transactions", value: txStats.totalCount, accent: "#94a3b8" },
              {
                key: "inflow",
                label: "Inflow",
                accent: "#22c55e",
                meta: txCurrencyFilter !== "ALL" ? txCurrencyFilter : undefined,
                tooltip: txCurrencyFilter === "ALL"
                  ? "Inflow: —"
                  : `Inflow: ${formatBigNumber(txStats.inflow).value}${formatBigNumber(txStats.inflow).suffix || ""} ${txCurrencyFilter}`,
                value: txCurrencyFilter === "ALL" ? "..." : (
                  <>
                    {formatBigNumber(txStats.inflow).value}
                    {formatBigNumber(txStats.inflow).suffix && (
                      <span style={{ color: getNumberSuffixColor(formatBigNumber(txStats.inflow).suffix) }}>
                        {formatBigNumber(txStats.inflow).suffix}
                      </span>
                    )}
                  </>
                ),
              },
              {
                key: "outflow",
                label: "Outflow",
                accent: "#db3e3e",
                meta: txCurrencyFilter !== "ALL" ? txCurrencyFilter : undefined,
                tooltip: txCurrencyFilter === "ALL"
                  ? "Outflow: —"
                  : `Outflow: ${formatBigNumber(txStats.outflow).value}${formatBigNumber(txStats.outflow).suffix || ""} ${txCurrencyFilter}`,
                value: txCurrencyFilter === "ALL" ? "..." : (
                  <>
                    {formatBigNumber(txStats.outflow).value}
                    {formatBigNumber(txStats.outflow).suffix && (
                      <span style={{ color: getNumberSuffixColor(formatBigNumber(txStats.outflow).suffix) }}>
                        {formatBigNumber(txStats.outflow).suffix}
                      </span>
                    )}
                  </>
                ),
              },
              { key: "completed", label: "Completed", value: txStats.completedCount, accent: "#22c55e" },
            ]}
          />
        </FilterBar>

              {/* =========================
                  LIST
              ========================= */}
              {loadingTx ? (
                <div>Loading transactions...</div>
              ) : (filteredTransactions || []).length === 0 ? (
                <div className="us-empty-state">No product transactions found</div>
              ) : (
(filteredTransactions || []).map((t) => {
  const isPositive = Number(t.amount) >= 0;
  const currencySymbol = t.currency?.symbol || t.currency_symbol || "—";
  const networkName = t.network?.name || t.network_name || "";
  const txHash = t.tx_hash || "";
  const txWalletAddress = t.walletAddress || "";
  const TxConfirmations = t.confirmations || "";
  const TxBlockchain = t.blockchain || "";

  const metaParts = [
    `#${t.id}`,
    t.order_id ? `ORDER #${t.order_id}` : null,
    t.wire_transfer_order_id ? `WIRE #${t.wire_transfer_order_id}` : null,
    t.product?.name || null,
    t.product?.plan || null,
    networkName ? networkName.toUpperCase() : null,
  ].filter(Boolean);

  const hasChain = TxBlockchain || txWalletAddress || txHash || TxConfirmations;

  return (
    <div key={t.id} className="us-tx-card">
      {/* ===== ROW 1: Type + Status ===== */}
      <div className="us-tx-top">
        <div className="us-tx-type is-capitalize">{t.type || "Product Transaction"}</div>
        <div className={statusBadgeClass(t.status) + " us-tx-badge"}>
          {t.status?.toUpperCase()}
        </div>
      </div>

      {/* ===== ROW 2: Amount + Date ===== */}
      <div className="us-tx-amount-row">
        <div className="us-tx-amount" style={{ color: isPositive ? "#22c55e" : "#ef4444" }}>
          {isPositive ? "+" : ""}
          <BigNumber value={t.amount} />
          <span className="us-tx-currency">{currencySymbol}</span>
        </div>
        <div className="us-tx-date">{formatDateTime(t.created_at)}</div>
      </div>

      {/* ===== ROW 3: single truncated meta line (ids / product / network) ===== */}
      <div className="us-tx-meta-line">{metaParts.join("  ·  ")}</div>

      {/* ===== ROW 4: blockchain details as compact chips (only if any exist) ===== */}
      {hasChain && (
        <div className="us-tx-chip-row">
          {TxBlockchain && (
            <span className="us-tx-chip">
              <span className="us-tx-chip-k">Chain</span>{t.blockchain.toUpperCase()}
            </span>
          )}
          {txWalletAddress && (
            <span className="us-tx-chip">
              <span className="us-tx-chip-k">Wallet</span>
              {txWalletAddress.slice(0, 6)}...{txWalletAddress.slice(-4)}
            </span>
          )}
          {txHash && (
            <span className="us-tx-chip">
              <span className="us-tx-chip-k">Hash</span>
              {txHash.slice(0, 6)}...{txHash.slice(-4)}
            </span>
          )}
          {TxConfirmations && (
            <span className="us-tx-chip">
              <span className="us-tx-chip-k">Conf</span>{t.confirmations}
            </span>
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