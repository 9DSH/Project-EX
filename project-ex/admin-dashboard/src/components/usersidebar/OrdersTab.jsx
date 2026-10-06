import { 
  ChevronDown,
 ShoppingCart,
 ArrowLeftRight,
 } from "lucide-react";
import PermissionGate from "../../components/PermissionGate";
import "react-datepicker/dist/react-datepicker.css";
import "./UserSidebar.css";
import { useMemo, useState, useEffect } from "react";
import {formatBigNumber , getNumberSuffixColor} from "../../components/HelperFunctions";
import { FilterBar, MiniDropdown, MiniDateRange, StatPillsRow } from "./HubFilterControls";

export default function OrdersTab({
  user,
  orders,
  orderSubTab,
  setOrderSubTab,
  permissions,
  hasPermission,
  // Products props
  productCategories,
  selectedCategory,
  setSelectedCategory,
  products,
  selectedProduct,
  setSelectedProduct,
  loadProductsByCategory,
  inputDataText,
  setInputDataText,
  bonusPercent,
  setBonusPercent,
  creatingOrder,
  createOrderForUser,
  calculateProductPricing,
  createOrderOpen,
  loadingOrders,
  setCreateOrderOpen,
  // Exchange props
  exchangeOpen,
  setExchangeOpen,
  loadingExchangeOrders,
  exchangeOrders,
  exchangePairs,
  currencyExchangeFrom,
  balanceMap,
  networkExchangeFrom,
  fromNetworkRequired,
  exchangeFromNetworks,
  currencyExchangeTo,
  networkExchangeTo,
  toNetworkRequired,
  exchangeToNetworks,
  maxExchangeable,
  exchangeAmount,
  selectedPairData,
  loadingRate,
  liveRate,
  customRate,
  previewExchange,
  loadingPreview,
  exchangePreview,
  executeExchange,
  executingExchange,
  setCurrencyExchangeFrom,
  setCurrencyExchangeTo,
  setNetworkExchangeFrom,
  setNetworkExchangeTo,
  setExchangePreview,
  setSelectedPairData,
  setLiveRate,
  fetchLiveRate,
  setExchangeAmount,
  formatRate,
  setCustomRate,
}) {

  // =====================
  // PRODUCTS FILTERS
  // =====================
  const [orderDateRange, setOrderDateRange] = useState([null, null]);
  const [orderStartDate, orderEndDate] = orderDateRange;
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("");
  const [orderCurrencyFilter, setOrderCurrencyFilter] = useState("");
  const [selectedProductSchema, setSelectedProductSchema] = useState(null);

  // =====================
  // EXCHANGE FILTERS
  // =====================
  const [exchangeDateRange, setExchangeDateRange] = useState([null, null]);
  const [exchangeStartDate, exchangeEndDate] = exchangeDateRange;
  const [exchangeStatusFilter, setExchangeStatusFilter] = useState("");
  const [exchangeCurrencyFilter, setExchangeCurrencyFilter] = useState("");

  useEffect(() => {
    if (!selectedProduct) {
      setSelectedProductSchema(null);
      return;
    }

    const prod = products.find(
      (p) => String(p.id) === String(selectedProduct)
    );

    if (!prod) {
      setSelectedProductSchema(null);
      return;
    }

    let parsed = {};

    try {
      parsed =
        typeof prod.required_user_data === "string"
          ? JSON.parse(prod.required_user_data)
          : prod.required_user_data ?? {};
    } catch (err) {
      console.error("Invalid required_user_data JSON:", err);
      parsed = {};
    }

    const cleanSchema = Object.entries(parsed)
      .filter(([k]) => k !== "_placeholder")
      .reduce((acc, [key, field]) => {
        acc[key] = field;
        return acc;
      }, {});

    // Keep the original schema exactly as it came from the backend
    const rawInputData =
      typeof prod.required_user_data === "string"
        ? JSON.parse(prod.required_user_data)
        : structuredClone(prod.required_user_data ?? {});

    // Initialize only the value property
    Object.keys(rawInputData).forEach((key) => {
      if (key === "_placeholder") return;

      if (typeof rawInputData[key] === "object") {
        rawInputData[key].value = "";
      }
    });

    setInputDataText(rawInputData);

    const beforeOrderFields = Object.entries(cleanSchema)
      .filter(([, v]) => v.step === "before_order");

    const afterLoginFields = Object.entries(cleanSchema)
      .filter(([, v]) => v.step === "after_login");

    setSelectedProductSchema({
      raw: cleanSchema,
      beforeOrderFields,
      afterLoginFields,
    });
  }, [selectedProduct, products]);

  const getDisplayRate = (rate, fromCurrency) => {
    const numericRate = Number(rate);

    if (!numericRate || numericRate === 0) return null;

    if (fromCurrency === "IRT") {
      return 1 / numericRate;
    }

    return numericRate;
  };

  const endOfDay = (date) => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const startOfDay = (date) => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Formats a date like "27 Jun 2026 17:56". Used across both
  // product orders and exchange orders so the display stays consistent.
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

  // Currencies actually present in this user's orders / exchange orders,
  // used to populate the currency selector options below.
  const orderCurrencyOptions = useMemo(() => {
    return [...new Set((orders || []).map((o) => o.currency).filter(Boolean))];
  }, [orders]);

  const exchangeCurrencyOptions = useMemo(() => {
    return [
      ...new Set(
        (exchangeOrders || [])
          .map((o) => o.from_currency?.symbol)
          .filter(Boolean)
      ),
    ];
  }, [exchangeOrders]);

  // Default to the first available currency once orders load, and keep the
  // selection valid if the underlying order list changes.
  useEffect(() => {
    if (orderCurrencyOptions.length === 0) {
      if (orderCurrencyFilter) setOrderCurrencyFilter("");
      return;
    }
    if (!orderCurrencyOptions.includes(orderCurrencyFilter)) {
      setOrderCurrencyFilter(orderCurrencyOptions[0]);
    }
  }, [orderCurrencyOptions]);

  useEffect(() => {
    if (exchangeCurrencyOptions.length === 0) {
      if (exchangeCurrencyFilter) setExchangeCurrencyFilter("");
      return;
    }
    if (!exchangeCurrencyOptions.includes(exchangeCurrencyFilter)) {
      setExchangeCurrencyFilter(exchangeCurrencyOptions[0]);
    }
  }, [exchangeCurrencyOptions]);

  const filteredOrders = useMemo(() => {
    const start = startOfDay(orderStartDate);
    const end = endOfDay(orderEndDate);

    return (orders || []).filter((o) => {
      const created = new Date(o.created_at);

      const inDateRange =
        (!start || created >= start) &&
        (!end || created <= end);

      const statusMatch =
        !orderStatusFilter || o.status === orderStatusFilter;

      const typeMatch =
        !productTypeFilter || o.product_type === productTypeFilter;

      return inDateRange && statusMatch && typeMatch;
    });
  }, [orders, orderStartDate, orderEndDate, orderStatusFilter, productTypeFilter]);

  // Orders filtered further by the selected currency — used only for the
  // "Total Purchase" stat, so it always reflects a single currency.
  const currencyFilteredOrders = useMemo(() => {
    return (filteredOrders || []).filter(
      (o) => !orderCurrencyFilter || o.currency === orderCurrencyFilter
    );
  }, [filteredOrders, orderCurrencyFilter]);

  const filteredExchangeOrders = useMemo(() => {
    const start = startOfDay(exchangeStartDate);
    const end = endOfDay(exchangeEndDate);

    return (exchangeOrders || []).filter((o) => {
      const created = new Date(o.created_at);

      const inDateRange =
        (!start || created >= start) &&
        (!end || created <= end);

      const statusMatch =
        !exchangeStatusFilter || o.status === exchangeStatusFilter;

      return inDateRange && statusMatch;
    });
  }, [exchangeOrders, exchangeStartDate, exchangeEndDate, exchangeStatusFilter]);

  // Exchange orders filtered further by the selected "from" currency — used
  // only for the "Total Exchanged" stat.
  const currencyFilteredExchangeOrders = useMemo(() => {
    return (filteredExchangeOrders || []).filter(
      (o) => !exchangeCurrencyFilter || o.from_currency?.symbol === exchangeCurrencyFilter
    );
  }, [filteredExchangeOrders, exchangeCurrencyFilter]);

  const orderStats = useMemo(() => {
    const list = filteredOrders || [];

    const totalCount = list.length;

    // Only sum orders matching the selected currency, so the total is never
    // a meaningless mix of different currencies.
    const totalPurchase = (currencyFilteredOrders || []).reduce((sum, o) => {
      return sum + Number(o.price || 0);
    }, 0);

    const completedCount = list.filter(o => o.status === "delivered" || o.status === "completed").length;
    const pendingCount = list.filter(o => o.status === "pending").length;

    return {
      totalCount,
      totalPurchase,
      completedCount,
      pendingCount,
    };
  }, [filteredOrders, currencyFilteredOrders]);

  const exchangeStats = useMemo(() => {
    const list = filteredExchangeOrders  || [];

    const totalCount = list.length;

    // Only sum exchanges matching the selected "from" currency.
    const totalExchanged = (currencyFilteredExchangeOrders || []).reduce((sum, x) => {
      return sum + Number(x.from_amount || 0);
    }, 0);

    const completedCount = list.filter(x => x.status === "completed").length;
    const pendingCount = list.filter(x => x.status === "pending").length;

    return {
      totalCount,
      totalExchanged,
      completedCount,
      pendingCount,
    };
  }, [filteredExchangeOrders, currencyFilteredExchangeOrders]);

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

  const orderStatusBadgeClass = (status) =>
    `us-badge${
      status === "pending" ? " is-warning"
      : status === "approved" ? " is-info"
      : status === "delivered" || status === "completed" ? " is-success"
      : " is-danger"
    }`;

  return (
    <>
      {/* SUB TABS */}
      <div className="us-tabs-row">
        {hasPermission(user, "orders.view") && (
          <button
            onClick={() => setOrderSubTab("products")}
            className={`us-tab-btn${orderSubTab === "products" ? " is-active" : ""}`}
          >
            Products
          </button>
        )}
        {hasPermission(user, "exchange.view") && (
          <button
            onClick={() => setOrderSubTab("exchange")}
            className={`us-tab-btn${orderSubTab === "exchange" ? " is-active" : ""}`}
          >
            Exchange
          </button>
        )}
      </div>

      {/* Products Subtab */}
      {permissions.canViewOrders && orderSubTab === "products" && (
        <>
          <PermissionGate allowed={hasPermission(user, "orders.create")}>
            <div className="us-collapsible-box">
              {/* HEADER */}
              <div
                className="us-collapsible-header"
                onClick={() => setCreateOrderOpen(!createOrderOpen)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="us-collapsible-icon">
                    <ShoppingCart size={17} />
                  </div>
                  <div>
                    <div className="us-collapsible-title">New Order</div>
                    <div className="us-collapsible-sub">Place an order for this user</div>
                  </div>
                </div>
                <span className={`us-chevron${createOrderOpen ? " is-open" : ""}`}>
                  <ChevronDown size={16} />
                </span>
              </div>

              {/*--------------- New Order container -------------------- */}
              <div className={`us-collapse${createOrderOpen ? " is-open" : ""}`}>
                <div className="us-collapse-inner">
                <div className="us-collapsible-body">
                  <div>
                    <MiniDropdown
                      label="Category"
                      value={selectedCategory}
                      onChange={(v) => {
                        setSelectedCategory(v);
                        setSelectedProduct("");
                        loadProductsByCategory(v);
                      }}
                      placeholder="Select category"
                      options={productCategories.map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </div>

                  <div>
                    <MiniDropdown
                      label="Product"
                      value={selectedProduct}
                      onChange={(v) => setSelectedProduct(v)}
                      placeholder="Select product"
                      options={products.map((p) => ({
                        value: p.id,
                        label: `${p.name} — ${p.plan} | ${
                          p.discount_percent
                            ? `${Number(p.price).toFixed(2)} → ${(Number(p.price) * (1 - Number(p.discount_percent) / 100)).toFixed(2)}`
                            : Number(p.price).toFixed(2)
                        } ${p.currency}`,
                      }))}
                    />

                    {/* Dynamic Required User Data Fields */}
                    {selectedProductSchema?.beforeOrderFields?.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                        <div className="us-eyebrow">Required Customer Information</div>

                        <div className="us-req-info-grid">
                          {selectedProductSchema.beforeOrderFields.map(([key, field]) => (
                            <div key={key}>
                              <label className="us-label">
                                {field.label}
                                {field.required && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
                              </label>

                              <input
                                type={field.type === "number" ? "number"
                                    : field.type === "email" ? "email"
                                    : field.type === "password" ? "password"
                                    : field.type === "textarea" ? "text"
                                    : "text"}
                                className="us-input-standalone"
                                value={inputDataText[key]?.value || ""}
                                onChange={(e) =>
                                  setInputDataText((prev) => ({
                                    ...prev,
                                    [key]: {
                                      ...prev[key],
                                      value: e.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* After Login Steps */}
                    {selectedProductSchema?.afterLoginFields?.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div className="us-eyebrow" style={{ marginBottom: 8 }}>After Login Steps</div>

                        <div className="us-chip-row">
                          {selectedProductSchema.afterLoginFields.map(([key, field]) => (
                            <div key={key} className="us-chip">
                              {field.label}
                              {field.required && (
                                <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="us-subpanel">
                    <div className="us-subpanel-title">🎁 Admin Bonus (Optional)</div>

                    <div>
                      <label className="us-label">Bonus Discount %</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="e.g. 50"
                        value={bonusPercent}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "" || (Number(v) >= 1 && Number(v) <= 100)) {
                            setBonusPercent(v);
                          }
                        }}
                        className="us-input-standalone"
                      />
                    </div>

                    {(() => {
                      const prod = products.find(
                        (p) => String(p.id) === String(selectedProduct)
                      );

                      if (!prod) return null;

                      const pricing = calculateProductPricing(
                        prod,
                        user,
                        Number(bonusPercent || 0)
                      );
                      return (
                        <div className="us-pricing-box">
                          {/* Original Price */}
                          <div className="us-pricing-row-top">
                            <span>Original Price</span>
                            <span>
                              {pricing.originalPrice.toFixed(2)} {prod.currency}
                            </span>
                          </div>

                          {/* Breakdown */}
                          {pricing.steps.map((step, idx) => (
                            <div key={idx} className="us-pricing-step" style={{ color: step.color }}>
                              <div>
                                {step.label} ({step.percent}%)
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <div>
                                  -{step.deducted.toFixed(2)} {prod.currency}
                                </div>
                                <div className="us-pricing-step-remaining">
                                  Remaining: {step.remaining.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Summary */}
                          <div className="us-pricing-summary">
                            <div className="us-pricing-summary-row">
                              <span>Total Fee & Discount ({pricing.effectiveDiscount.toFixed(2)}%)</span>
                              <span>
                                -{pricing.totalSaved.toFixed(2)} {prod.currency}
                              </span>
                            </div>

                            <div className="us-pricing-summary-row">
                              <span>Owner Receives ({prod.admin_username})</span>
                              <span>
                                {pricing.finalDue.toFixed(2)} {prod.currency}
                              </span>
                            </div>

                            <div className="us-pricing-final-row">
                              <span>Final Due for user</span>
                              <span>
                                {pricing.finalForUser.toFixed(2)} {prod.currency}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="us-btn-row">
                    <button
                      className="primaryBtn"
                      onClick={createOrderForUser}
                      disabled={creatingOrder}
                      style={{ opacity: creatingOrder ? 0.6 : 1, cursor: creatingOrder ? "not-allowed" : "pointer" }}
                    >
                      {creatingOrder ? "Creating..." : "Create Order"}
                    </button>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </PermissionGate>

          {/*--------------- Order History -------------------- */}
          <div className="us-labeled-divider">
            <div className="us-labeled-divider-line" />
            <div className="us-labeled-divider-text">ORDER HISTORY</div>
            <div className="us-labeled-divider-line" />
          </div>

          {/*--------------- Filter Order History -------------------- */}
          <FilterBar>
            <div className="us-hh-filter-row">
              <MiniDateRange
                label="Date Range"
                startDate={orderStartDate}
                endDate={orderEndDate}
                onChange={(update) => setOrderDateRange(update)}
                placeholderText="Order date range"
                portalId="user-sidebar-datepicker-portal"
              />

              <MiniDropdown
                label="Status"
                value={orderStatusFilter}
                onChange={setOrderStatusFilter}
                placeholder="All Status"
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "delivered", label: "Delivered" },
                ]}
              />

              <MiniDropdown
                label="Order Type"
                value={productTypeFilter}
                onChange={setProductTypeFilter}
                placeholder="All Types"
                options={[
                  { value: "digital", label: "Digital" },
                  { value: "subscription", label: "Subscription" },
                  { value: "service", label: "Service" },
                ]}
              />

              {orderCurrencyOptions.length > 0 && (
                <MiniDropdown
                  label="Currency"
                  value={orderCurrencyFilter}
                  onChange={setOrderCurrencyFilter}
                  options={orderCurrencyOptions.map((sym) => ({ value: sym, label: sym }))}
                />
              )}
            </div>

            <div className="us-hh-row-divider" />

            {/*--------------- Stat pills for filtered orders -------------------- */}
            <StatPillsRow
              pills={[
                { key: "count", label: "Total Orders", value: orderStats.totalCount, accent: "#94a3b8" },
                {
                  key: "purchase",
                  label: "Total Purchase",
                  accent: "#60a5fa",
                  meta: orderCurrencyFilter || undefined,
                  tooltip: `Total Purchase: ${formatBigNumber(orderStats.totalPurchase).value}${formatBigNumber(orderStats.totalPurchase).suffix || ""} ${orderCurrencyFilter || ""}`,
                  value: (
                    <>
                      {formatBigNumber(orderStats.totalPurchase).value}
                      {formatBigNumber(orderStats.totalPurchase).suffix && (
                        <span style={{ color: getNumberSuffixColor(formatBigNumber(orderStats.totalPurchase).suffix) }}>
                          {formatBigNumber(orderStats.totalPurchase).suffix}
                        </span>
                      )}
                    </>
                  ),
                },
                { key: "completed", label: "Completed", value: orderStats.completedCount, accent: "#22c55e" },
                { key: "pending", label: "Pending", value: orderStats.pendingCount, accent: "#f59e0b" },
              ]}
            />
          </FilterBar>

          <PermissionGate allowed={hasPermission(user, "orders.view")}>
            <div className="us-scroll-list">
              {loadingOrders ? (
                <div className="us-empty-state">Loading orders...</div>
              ) : (orders || []).length === 0 ? (
                <div className="us-empty-state">No orders found</div>
              ) : (
                (filteredOrders || []).map((o) => (
                  <div key={o.order_id} className="us-record-card is-spacious">
                    <div className="us-record-top">
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="us-record-title">{o.product_name}</div>
                          {o.product_admin_id != null && (
                            <div className="us-meta-tag">
                              Provider #{o.product_admin_id} {o.product_owner_displayName}
                            </div>
                          )}
                        </div>

                        <div className="us-record-sub">
                          #{o.id}
                          {o.plan && ` • ${o.plan}`}
                          {o.product_type && ` • ${o.product_type}`}
                          {o.data_volume_gb && ` • ${o.data_volume_gb} GB`}
                        </div>
                      </div>

                      <div className={orderStatusBadgeClass(o.status)}>
                        {o.status?.toUpperCase()}
                      </div>
                    </div>

                    <div className="us-amount-row">
                      <div className="us-amount">
                        <BigNumber value={o.price} />
                        <span className="us-currency-tag">{o.currency} </span>
                      </div>

                      {o.network && <div className="us-network-tag">{o.network}</div>}
                      {o.discount_percent > 0 && (
                        <div className="us-badge" style={{ background: "rgba(220,128,16,0.4)", color: "#fee500" }}>
                          {o.discount_percent}% Discounted
                        </div>
                      )}
                    </div>

                    <div className="us-stat-grid">
                      <div className="us-stat-box">
                        <span className="us-stat-label">Created</span>
                        <span className="us-stat-value">{formatDateTime(o.created_at)}</span>
                      </div>
                      <div className="us-stat-box">
                        <span className="us-stat-label">Delivered</span>
                        <span className="us-stat-value">
                          {o.delivered_at ? formatDateTime(o.delivered_at) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </PermissionGate>
        </>
      )}

      {/* ================= EXCHANGE ORDERS ================= */}
      {permissions.canViewExchange && orderSubTab === "exchange" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, width: "100%" }}>
          <PermissionGate allowed={hasPermission(user, "exchange.create")}>
            <div className="us-collapsible-box">
              {/* HEADER */}
              <div
                className="us-collapsible-header"
                onClick={() => setExchangeOpen(!exchangeOpen)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="us-collapsible-icon">
                    <ArrowLeftRight size={17} />
                  </div>
                  <div>
                    <div className="us-collapsible-title">Exchange for User</div>
                    <div className="us-collapsible-sub">Execute an exchange for this user</div>
                  </div>
                </div>
                <span className={`us-chevron${exchangeOpen ? " is-open" : ""}`}>
                  <ChevronDown size={16} />
                </span>
              </div>

              <div className={`us-collapse${exchangeOpen ? " is-open" : ""}`}>
                <div className="us-collapse-inner">
                <div className="us-collapsible-body">
                  <div className="us-two-col-row">
                    <div>
                      <MiniDropdown
                        label="From Currency"
                        value={currencyExchangeFrom}
                        onChange={(v) => {
                          setCurrencyExchangeFrom(v);
                          setCurrencyExchangeTo("");
                          setNetworkExchangeFrom("");
                          setNetworkExchangeTo("");
                          setExchangePreview(null);
                          setSelectedPairData(null);
                          setLiveRate(null);
                        }}
                        placeholder="Select currency"
                        options={[...new Set(
                          exchangePairs.filter((p) => p.is_active).map((p) => p.from_currency?.symbol)
                        )].map((sym) => ({
                          value: sym,
                          label: <>{sym} (<BigNumber value={balanceMap[sym] ?? 0} />)</>,
                        }))}
                      />
                    </div>

                    <div>
                      <MiniDropdown
                        label="From Network"
                        value={networkExchangeFrom}
                        onChange={(v) => {
                          setNetworkExchangeFrom(v);
                          setNetworkExchangeTo("");
                          setExchangePreview(null);
                          setSelectedPairData(null);
                          setLiveRate(null);
                          if (currencyExchangeFrom && currencyExchangeTo) {
                            fetchLiveRate(
                              currencyExchangeFrom,
                              currencyExchangeTo,
                              v,
                              "",
                              customRate
                            );
                          }
                        }}
                        disabled={!currencyExchangeFrom || !fromNetworkRequired}
                        placeholder={fromNetworkRequired ? "Select Network" : "No Network Required"}
                        options={exchangeFromNetworks.map((n) => ({
                          value: n.id,
                          label: `${n.name || n.symbol}${n.chain ? ` (${n.chain})` : ""}`,
                        }))}
                      />
                    </div>
                  </div>

                  <div className="us-two-col-row">
                    <div>
                      <MiniDropdown
                        label="To Currency"
                        value={currencyExchangeTo}
                        onChange={(v) => {
                          setCurrencyExchangeTo(v);
                          setNetworkExchangeTo("");
                          setExchangePreview(null);
                          setSelectedPairData(null);
                          fetchLiveRate(
                            currencyExchangeFrom,
                            v,
                            networkExchangeFrom,
                            "",
                            customRate
                          );
                        }}
                        placeholder="Select currency"
                        options={[...new Set(
                          exchangePairs
                            .filter(
                              (p) =>
                                p.is_active &&
                                p.from_currency?.symbol === currencyExchangeFrom
                            )
                            .map((p) => p.to_currency?.symbol)
                        )].map((sym) => ({
                          value: sym,
                          label: <>{sym} (<BigNumber value={balanceMap[sym] ?? 0} />)</>,
                        }))}
                      />
                    </div>

                    <div>
                      <MiniDropdown
                        label="To Network"
                        value={networkExchangeTo}
                        onChange={(v) => {
                          setNetworkExchangeTo(v);
                          setExchangePreview(null);
                          setSelectedPairData(null);
                          fetchLiveRate(
                            currencyExchangeFrom,
                            currencyExchangeTo,
                            networkExchangeFrom,
                            v,
                            customRate
                          );
                        }}
                        disabled={!currencyExchangeTo || !toNetworkRequired}
                        placeholder={toNetworkRequired ? "Select Network" : "No Network Required"}
                        options={exchangeToNetworks.map((n) => ({
                          value: n.id,
                          label: `${n.name || n.symbol}${n.chain ? ` (${n.chain})` : ""}`,
                        }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="us-label">
                      Amount (Max: <BigNumber value={maxExchangeable || 0} />)
                    </label>
                    <input
                      type="string"
                      className="us-input-standalone"
                      value={exchangeAmount}
                      onChange={(e) => { setExchangeAmount(e.target.value); setExchangePreview(null); }}
                      placeholder="Enter amount"
                    />
                  </div>

                  <div className="us-subpanel">
                    <div className="us-subpanel-row">
                      <div className="us-subpanel-title">Exchange Rate Configuration</div>
                      {selectedPairData && <div className="us-subpanel-note">Pair #{selectedPairData.id}</div>}
                    </div>
                    <div className="us-stat-grid" style={{ marginBottom: 14 }}>
                      <div className="us-stat-box">
                        <div className="us-stat-label" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>Current System Rate</div>
                        <div className="us-stat-value-lg" style={{ color: "#e2e8f0" }}>
                          {loadingRate ? "..." : liveRate ? formatRate(liveRate) : selectedPairData?.rate ? formatRate(selectedPairData.rate) : "-"}
                        </div>
                      </div>
                      <div className="us-stat-box">
                        <div className="us-stat-label" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>Exchange Fee</div>
                        <div className="us-stat-value-lg" style={{ color: "#f8fafc" }}>{selectedPairData?.fee_percent ?? 0}%</div>
                      </div>
                    </div>

                    <div>
                      <label className="us-label">Custom Admin Rate (Optional)</label>
                      <input
                        type="number"
                        placeholder="Leave empty to use live system rate"
                        value={customRate ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCustomRate(value);
                          setExchangePreview(null);
                          if (currencyExchangeFrom && currencyExchangeTo) {
                            fetchLiveRate(
                              currencyExchangeFrom,
                              currencyExchangeTo,
                              networkExchangeFrom,
                              networkExchangeTo,
                              value || null
                            );
                          }
                        }}
                        className="us-input-standalone"
                        style={{
                          border: customRate !== "" && customRate !== null ? "1px solid #2563eb" : "1px solid #1e293b",
                          background: customRate !== "" && customRate !== null ? "#0b1730" : "#0b1220",
                        }}
                      />
                      <div className={`us-subpanel-note${customRate !== "" ? " is-accent" : ""}`} style={{ marginTop: 8 }}>
                        {customRate !== "" ? "Custom admin rate will override the live pair rate." : "Using automatic live exchange rate."}
                      </div>
                    </div>
                  </div>

                  <div className="us-btn-row">
                    <button onClick={previewExchange} className="primaryBtn" style={{ background: "#334155" }} disabled={loadingPreview}>
                      {loadingPreview ? "Calculating..." : "Preview Exchange"}
                    </button>
                  </div>

                  {exchangePreview ? (
                    <div className="us-subpanel-center">
                      Rate: <b>{formatRate(exchangePreview.selected_rate)}</b> • Fee: <b>{exchangePreview.fee_percent}% </b> {currencyExchangeFrom}
                    </div>
                  ) : (
                    currencyExchangeFrom && currencyExchangeTo && (
                      <div className="us-subpanel-center is-muted">
                        Select amount and preview to see exchange details
                      </div>
                    )
                  )}

                  {exchangePreview && (
                    <div className="us-preview-box">
                      <div>Rate: <b>{formatRate(exchangePreview.selected_rate)}</b></div>
                      <div>Fee: <b>{formatRate(exchangePreview.fee_amount)}</b> {currencyExchangeFrom}</div>
                      <div>Gross: <b>{formatRate(exchangePreview.gross_amount)}</b> {currencyExchangeFrom}</div>
                      <div>User Receives: <b>{formatRate(exchangePreview.received_amount)} </b> {currencyExchangeTo}</div>
                    </div>
                  )}

                  <div className="us-btn-row">
                    <button
                      className="primaryBtn"
                      onClick={executeExchange}
                      disabled={executingExchange || !exchangePreview}
                      style={{
                        opacity: executingExchange || !exchangePreview ? 0.5 : 1,
                        cursor: executingExchange || !exchangePreview ? "not-allowed" : "pointer",
                        background: "#1d4fd871",
                      }}
                    >
                      {executingExchange ? "Executing..." : "Execute Exchange"}
                    </button>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </PermissionGate>

          <div className="us-labeled-divider">
            <div className="us-labeled-divider-line" />
            <div className="us-labeled-divider-text">EXCHANGE HISTORY</div>
            <div className="us-labeled-divider-line" />
          </div>

          <FilterBar>
            <div className="us-hh-filter-row">
              <MiniDateRange
                label="Date Range"
                startDate={exchangeStartDate}
                endDate={exchangeEndDate}
                onChange={(update) => setExchangeDateRange(update)}
                placeholderText="Exchange date range"
                portalId="user-sidebar-datepicker-portal"
              />

              <MiniDropdown
                label="Status"
                value={exchangeStatusFilter}
                onChange={setExchangeStatusFilter}
                placeholder="All Status"
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "completed", label: "Completed" },
                  { value: "failed", label: "Failed" },
                ]}
              />

              {exchangeCurrencyOptions.length > 0 && (
                <MiniDropdown
                  label="Currency"
                  value={exchangeCurrencyFilter}
                  onChange={setExchangeCurrencyFilter}
                  options={exchangeCurrencyOptions.map((sym) => ({ value: sym, label: sym }))}
                />
              )}
            </div>

            <div className="us-hh-row-divider" />

            <StatPillsRow
              pills={[
                { key: "count", label: "Exchanges", value: exchangeStats.totalCount, accent: "#94a3b8" },
                {
                  key: "exchanged",
                  label: "Total Exchanged",
                  accent: "#60a5fa",
                  meta: exchangeCurrencyFilter || undefined,
                  tooltip: `Total Exchanged: ${formatBigNumber(exchangeStats.totalExchanged).value}${formatBigNumber(exchangeStats.totalExchanged).suffix || ""} ${exchangeCurrencyFilter || ""}`,
                  value: (
                    <>
                      {formatBigNumber(exchangeStats.totalExchanged).value}
                      {formatBigNumber(exchangeStats.totalExchanged).suffix && (
                        <span style={{ color: getNumberSuffixColor(formatBigNumber(exchangeStats.totalExchanged).suffix) }}>
                          {formatBigNumber(exchangeStats.totalExchanged).suffix}
                        </span>
                      )}
                    </>
                  ),
                },
                { key: "completed", label: "Completed", value: exchangeStats.completedCount, accent: "#22c55e" },
                { key: "pending", label: "Pending", value: exchangeStats.pendingCount, accent: "#f59e0b" },
              ]}
            />
          </FilterBar>

          <PermissionGate allowed={hasPermission(user, "exchange.view")}>
            <div className="us-scroll-list">
              {loadingExchangeOrders ? (
                <div className="us-empty-state">Loading exchange orders...</div>
              ) : (filteredExchangeOrders || []).length === 0 ? (
                <div className="us-empty-state">No exchange orders</div>
              ) : (
                filteredExchangeOrders.map((o) => (
                  <div key={o.id} className="us-record-card is-spacious">
                    <div className="us-record-top">
                      <div>
                        <div className="us-record-title">
                          {o.from_currency?.symbol || "?"} → {o.to_currency?.symbol || "?"}
                          <span className="us-network-tag" style={{ marginLeft: 20 }}>
                            RATE {getDisplayRate(o.rate, o.from_currency?.symbol)?.toLocaleString() || "-"}
                          </span>
                          <span className="us-network-tag" style={{ marginLeft: 10 }}>
                            FEE {Number(o.fee_amount).toLocaleString()}
                          </span>
                        </div>
                        <div className="us-record-sub">#{o.id} • Exchange #{o.admin_id} {o.admin_displayName}</div>
                      </div>
                      <div className={orderStatusBadgeClass(o.status === "completed" ? "delivered" : o.status)}>
                        {o.status?.toUpperCase()}
                      </div>
                    </div>

                    <div className="us-amount-row">
                      <div className="us-amount">
                        <BigNumber value={o.from_amount} /> → <BigNumber value={o.to_amount} />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <span className="us-date-tag">
                        {o.created_at ? formatDateTime(o.created_at) : "-"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </PermissionGate>
        </div>
      )}
    </>
  );
}