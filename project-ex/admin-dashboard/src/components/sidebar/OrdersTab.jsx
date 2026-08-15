import { AlignCenterVerticalIcon, AlignEndVertical, ListVideo } from "lucide-react";
import PermissionGate from "../../components/PermissionGate";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useMemo, useState, useEffect } from "react";
import {formatBigNumber , getNumberSuffixColor} from "../../components/HelperFunctions";

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
  transferOpen,
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
  currencies,
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
  setCustomRate
  // etc.
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
    <>
            {/* SUB TABS */}
              <div style={styles.subTabs}>
                  {hasPermission(user, "orders.view") && (
                <button
                  onClick={() => setOrderSubTab("products")}
                  style={orderSubTab === "products" ? styles.subTabActive : styles.subTab}
                >
                  Products
                </button>
                  )}
                {hasPermission(user, "exchange.view") && (

                <button
                  onClick={() => setOrderSubTab("exchange")}
                  style={orderSubTab === "exchange" ? styles.subTabActive : styles.subTab}
                >
                  Exchange
                </button>
                )}
              </div>

      {/* Products Subtab */}

              {permissions.canViewOrders && orderSubTab === "products" &&  (
                <>
                  <PermissionGate allowed={hasPermission(user, "orders.create")}>
                  <div style={styles.createOrderBox}>
               {/* HEADER */}
               

                  <div
                    style={styles.transferHeader}
                    onClick={() => setCreateOrderOpen(!createOrderOpen)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={styles.transferIcon}>➕</div>
                      <div>
                        <div style={styles.transferHeaderLabel}>New Order</div>
                        <div style={styles.transferHeaderSub}>Place an order for this user</div>
                      </div>
                    </div>
                    <span style={{ color: "#64748b", fontSize: 11 }}>
                      {createOrderOpen ? "▲" : "▼"}
                    </span>
                  </div>

                  {/*--------------- New Order container -------------------- */}

                    {createOrderOpen && (
                      <div style={styles.createOrderBody}>
                        <div>
                          <label style={styles.label}>Category</label>
                          <select
                            style={styles.input}
                            value={selectedCategory}
                            onChange={(e) => {
                              setSelectedCategory(e.target.value);
                              setSelectedProduct("");
                              loadProductsByCategory(e.target.value);
                            }}
                          >
                            <option value="">Select category</option>
                            {productCategories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={styles.label}>Product</label>
                          <select
                            style={styles.input}
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                          >
                            <option value="">Select product</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {`${p.name} — ${p.plan} | ${
                                  p.discount_percent
                                    ? `${Number(p.price).toFixed(2)} → ${(Number(p.price) * (1 - Number(p.discount_percent) / 100)).toFixed(2)}`
                                    : Number(p.price).toFixed(2)
                                } ${p.currency}`}
                              </option>
                            ))}
                          </select>

                            {/* Dynamic Required User Data Fields */}
                            {selectedProductSchema?.beforeOrderFields?.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                                
                                <div style={{
                                  fontSize: 12,
                                  color: "#64748b",
                                  fontWeight: 700,
                                  letterSpacing: "0.06em",
                                  textTransform: "uppercase"
                                }}>
                                  Required Customer Information
                                </div>

                                {selectedProductSchema.beforeOrderFields.map(([key, field]) => (
                                  <div key={key}>
                                    <label style={styles.label}>
                                      {field.label}
                                      {field.required && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
                                    </label>

                                    <input
                                      type={field.type === "number" ? "number"
                                          : field.type === "email" ? "email"
                                          : field.type === "password" ? "password"
                                          : field.type === "textarea" ? "text"
                                          : "text"}
                                      style={styles.input}
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
                            )}
                            {/* After Login Steps */}
                            {selectedProductSchema?.afterLoginFields?.length > 0 && (
                              <div style={{ marginTop: 14 }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "#64748b",
                                    fontWeight: 700,
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                    marginBottom: 8,
                                  }}
                                >
                                  After Login Steps
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 8,
                                  }}
                                >
                                  {selectedProductSchema.afterLoginFields.map(([key, field]) => (
                                    <div
                                      key={key}
                                      style={{
                                        padding: "8px 12px",
                                        borderRadius: 999,
                                        background: "rgba(37,99,235,0.12)",
                                        border: "1px solid rgba(37,99,235,0.25)",
                                        color: "#93c5fd",
                                        fontSize: 12,
                                        fontWeight: 600,
                                      }}
                                    >
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

                        <div style={{
                          background: "linear-gradient(180deg,#0f172a 0%, #09101d 100%)",
                          border: "1px solid #1e293b",
                          borderRadius: 14,
                          padding: 14,
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                        }}>
                          <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>🎁 Admin Bonus (Optional)</div>

                          <div>
                            <label style={styles.label}>Bonus Discount %</label>
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
                              style={styles.input}
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
                          <div
                            style={{
                              background: "#0b1220",
                              border: "1px solid #1e293b",
                              borderRadius: 12,
                              padding: 14,
                              display: "flex",
                              flexDirection: "column",
                              gap: 10,
                            }}
                          >
                            {/* Original Price */}
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 13,
                                paddingBottom: 15,
                                borderBottom: "1px solid #1e293b",
                                color: "#b2c0d4ff",
                                fontWeight: 600,
                              }}
                            >
                              <span>Original Price</span>
                              <span>
                                {pricing.originalPrice.toFixed(2)} {prod.currency}
                              </span>
                            </div>

                            {/* Breakdown */}
                            {pricing.steps.map((step, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: 10,
                                  fontSize: 12,
                                  color: step.color,
                                }}
                              >
                                <div>
                                  {step.label} ({step.percent}%)
                                </div>

                                <div style={{ textAlign: "right" }}>
                                  <div>
                                    -{step.deducted.toFixed(2)} {prod.currency}
                                  </div>

                                  <div
                                    style={{
                                      color: "#64748b",
                                      fontSize: 11,
                                      marginTop: 2,
                                    }}
                                  >
                                    Remaining: {step.remaining.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            ))}

                            {/* Summary */}
                            <div
                              style={{
                                borderTop: "1px solid #1e293b",
                                paddingTop: 10,
                                marginTop: 4,
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  color: "#a8ccebff",
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                <span>Total Saved</span>
                                <span>
                                  {pricing.totalSaved.toFixed(2)} {prod.currency}
                                </span>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  color: "#a8ccebff",
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                <span>Effective Discount</span>
                                <span>
                                  {pricing.effectiveDiscount.toFixed(2)}%
                                </span>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  borderTop: "1px solid #1e293b",
                                  paddingTop: 10,
                                  marginTop: 4,
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: "#22c55e",
                                }}
                              >
                                <span>Final Due</span>
                                <span>
                                  {pricing.finalDue.toFixed(2)} {prod.currency}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                        </div>
                       <div style={styles.buttonRow}>
                        <button
                        
                          className="primaryBtn"
                          onClick={createOrderForUser}
                          disabled={creatingOrder}
                          style={{opacity: creatingOrder ? 0.6 : 1, cursor: creatingOrder ? "not-allowed" : "pointer" }}
                        >
                          {creatingOrder ? "Creating..." : "Create Order"}
                        </button>
                         </div>
                      </div>
                    )}
                  </div>

                  </PermissionGate>

                  {/*--------------- Order History -------------------- */}

                  <div style={styles.ordersDivider}>
                    <div style={styles.ordersDividerLine} />
                    <div style={styles.ordersDividerText}>ORDER HISTORY</div>
                    <div style={styles.ordersDividerLine} />
                  </div>

                  {/*--------------- Filter Order History -------------------- */}             
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
                    <div style={{ flex:1 }}>
                      <div style={styles.historyFitlerTitle}>Date Range</div>
                      <DatePicker
                      selectsRange
                      startDate={orderStartDate}
                      endDate={orderEndDate}
                      onChange={(update) => setOrderDateRange(update)}
                      isClearable
                      placeholderText="Order date range"
                      customInput={<input style={{ ...styles.input, width: 220 }} />}
                    />
                   </div>
                     <div style={{ flex:1 }}>
                      <div style={styles.historyFitlerTitle}>Status</div>
                      <select
                        style={styles.input}
                        value={orderStatusFilter}
                        onChange={(e) => setOrderStatusFilter(e.target.value)}
                      >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="delivered">Delivered</option>
                      </select>
                      </div>
                    <div style={{ flex:1 }}>
                      <div style={styles.historyFitlerTitle}>Order Type</div>
                      <select
                        style={styles.input}
                        value={productTypeFilter}
                        onChange={(e) => setProductTypeFilter(e.target.value)}
                      >
                        <option value="">All Types</option>
                        <option value="digital">Digital</option>
                        <option value="subscription">Subscription</option>
                        <option value="service">Service</option>
                      </select>

                      </div>

                    {orderCurrencyOptions.length > 0 && (
                      <div style={{ flex: 1 }}>
                        <div style={styles.historyFitlerTitle}>Currency</div>
                        <select
                          style={styles.input}
                          value={orderCurrencyFilter}
                          onChange={(e) => setOrderCurrencyFilter(e.target.value)}
                        >
                          {orderCurrencyOptions.map((sym) => (
                            <option key={sym} value={sym}>{sym}</option>
                          ))}
                        </select>
                      </div>
                    )}

                  </div>

                  {/*--------------- StatePills fro Filtered Orders-------------------- */}             
                  <div style={styles.txPillsRow}>

                    <div style={styles.txPill}>
                      <div style={styles.txPillValue}>{orderStats.totalCount}</div>
                      <div style={styles.txPillLabel}>Total Orders</div>
                    </div>

                    <div style={styles.txPill}>
                      <div style={styles.txPillValue}>
                        <BigNumber value={orderStats.totalPurchase} />
                                      
                        {orderCurrencyFilter && (
                          <span style={{...styles.providerMeta, fontSize:10, marginLeft:4}}>{orderCurrencyFilter}</span>
                        )}

                      </div>
                      <div style={styles.txPillLabel}>Total Purchase  
                        </div>
                    </div>

                    <div style={styles.txPill}>
                      <div style={{ ...styles.txPillValue, color: "#22c55e" }}>
                        {orderStats.completedCount}
                      </div>
                      <div style={styles.txPillLabel}>Completed</div>
                    </div>

                    <div style={styles.txPill}>
                      <div style={{ ...styles.txPillValue, color: "#f59e0b" }}>
                        {orderStats.pendingCount}
                      </div>
                      <div style={styles.txPillLabel}>Pending</div>
                    </div>
                  </div>

   


                   <PermissionGate allowed={hasPermission(user, "orders.view")}>
                  {
                  console.log(orders)}
                  <div style={styles.ordersList}>
                    {loadingOrders ? (
                      <div style={styles.emptyOrders}>Loading orders...</div>
                    ) : (orders || []).length === 0 ? (
                      <div style={styles.emptyOrders}>No orders found</div>
                    ) : (
                      (filteredOrders || []).map((o) => (
                        
                        <div key={o.order_id} style={styles.orderCard}>
                  <div style={styles.orderTop}>
                    <div>
                      <div style={styles.productTitleRow}>
                        <div style={styles.orderProduct}>
                          {o.product_name}
                        </div>

                        {o.product_admin_id != null && (
                          <div style={styles.providerMeta}>
                            Provider admin #{o.product_admin_id}
                          </div>
                        )}
                      </div>

                      <div style={styles.orderMeta}>
                        #{o.id}
                        {o.plan && ` • ${o.plan}`}
                        {o.product_type && ` • ${o.product_type}`}
                        {o.data_volume_gb && ` • ${o.data_volume_gb} GB`}
                      </div>
                    </div>

                    <div
                      style={{
                        ...styles.orderStatus,
                        ...(o.status === "pending"
                          ? styles.statusPending
                          : o.status === "approved"
                          ? styles.statusApproved
                          : o.status === "delivered"
                          ? styles.statusDelivered
                          : styles.statusDefault),
                      }}
                    >
                      {o.status?.toUpperCase()}
                    </div>
                  </div>
                          

                          <div style={styles.orderPriceRow}>
                            <div style={styles.orderPrice}>
                              <BigNumber value={o.price} />
                              <span style={styles.orderCurrency}>{o.currency} </span> 
                              
                            </div>
                            
                             {o.network && <div style={styles.networkBadge}>{o.network}</div>}
                              {o.discount_percent > 0 && <div style={styles.featuredBadge}>{o.discount_percent}% Discounted</div>}

                          </div>

                          <div style={styles.orderDates}>
                            <div style={styles.dateItem}>
                              <span style={styles.dateLabel}>Created</span>
                              <span style={styles.dateValue}>{formatDateTime(o.created_at)}</span>
                            </div>
                            <div style={styles.dateItem}>
                              <span style={styles.dateLabel}>Delivered</span>
                              <span style={styles.dateValue}>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 0, width: "100%", }}>
                 <PermissionGate allowed={hasPermission(user, "exchange.manage")}>
                  <div style={styles.createOrderBox}>

                    {/* HEADER */}

                    <div
                      style={styles.transferHeader}
                      onClick={() => setExchangeOpen(!exchangeOpen)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={styles.transferIcon}>💱</div>
                        <div>
                          <div style={styles.transferHeaderLabel}>Exchange for User</div>
                          <div style={styles.transferHeaderSub}>Execute an exchange for this user</div>
                        </div>
                      </div>
                      <span style={{ color: "#64748b", fontSize: 11 }}>
                        {exchangeOpen ? "▲" : "▼"}
                      </span>
                    </div>
                    


                    {exchangeOpen && (
                      <div style={styles.createOrderBody}>
                        <div>
                          <label style={styles.label}>From Currency</label>
                          <select
                            style={styles.input}
                            value={currencyExchangeFrom}
                            onChange={(e) => {
                              setCurrencyExchangeFrom(e.target.value);
                              setCurrencyExchangeTo("");
                              setNetworkExchangeFrom("");
                              setNetworkExchangeTo("");
                              setExchangePreview(null);
                              setSelectedPairData(null);
                              setLiveRate(null);
                            }}
                          >
                            <option value="">Select currency</option>
                            {[...new Set(
                              exchangePairs.filter((p) => p.is_active).map((p) => p.from_currency?.symbol)
                            )].map((sym) => (
                              <option key={sym} value={sym}>
                                {sym} (<BigNumber value={balanceMap[sym] ?? 0} />)
                              </option>
                            ))}
                          </select>

                          <label style={styles.label}>From Network</label>
                          <select
                            style={styles.input}
                            value={networkExchangeFrom}
                            onChange={(e) => {
                              setNetworkExchangeFrom(e.target.value);
                              setNetworkExchangeTo("");
                              setExchangePreview(null);
                              setSelectedPairData(null);
                              setLiveRate(null);
                              if (currencyExchangeFrom && currencyExchangeTo) {
                                fetchLiveRate(
                                  currencyExchangeFrom,
                                  currencyExchangeTo,
                                  e.target.value,
                                  "",
                                  customRate
                                );
                              }
                            }}
                            disabled={!currencyExchangeFrom || !fromNetworkRequired}
                          >
                            <option value="">
                              {fromNetworkRequired ? "Select Network" : "No Network Required"}
                            </option>
                            {exchangeFromNetworks.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.name || n.symbol}{n.chain ? ` (${n.chain})` : ""}
                              </option>
                            ))}
                          </select>

                          <label style={styles.label}>To Currency</label>
                          <select
                            style={styles.input}
                            value={currencyExchangeTo}
                            onChange={(e) => {
                              setCurrencyExchangeTo(e.target.value);
                              setNetworkExchangeTo("");
                              setExchangePreview(null);
                              setSelectedPairData(null);
                              fetchLiveRate(
                                currencyExchangeFrom,
                                e.target.value,
                                networkExchangeFrom,
                                "",
                                customRate
                              );
                            }}
                          >
                            <option value="">Select currency</option>
                            {[...new Set(
                              exchangePairs
                                .filter(
                                  (p) =>
                                    p.is_active &&
                                    p.from_currency?.symbol === currencyExchangeFrom
                                            )
                                .map((p) => p.to_currency?.symbol)
                            )].map((sym) => (
                              <option key={sym} value={sym}>
                                {sym} (<BigNumber value={balanceMap[sym] ?? 0} />)
                              </option>
                            ))}
                          </select>

                          <label style={styles.label}>To Network</label>
                          <select
                            style={styles.input}
                            value={networkExchangeTo}
                            onChange={(e) => {
                              setNetworkExchangeTo(e.target.value);
                              setExchangePreview(null);
                              setSelectedPairData(null);
                              fetchLiveRate(
                                currencyExchangeFrom,
                                currencyExchangeTo,
                                networkExchangeFrom,
                                e.target.value,
                                customRate
                              );
                            }}
                            disabled={!currencyExchangeTo || !toNetworkRequired}
                          >
                            <option value="">
                              {toNetworkRequired ? "Select Network" : "No Network Required"}
                            </option>
                            {exchangeToNetworks.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.name || n.symbol}{n.chain ? ` (${n.chain})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label style={styles.label}>
                            Amount (Max: <BigNumber value={maxExchangeable || 0} />)
                          </label>
                          <input
                            type="string"
                            style={styles.input}
                            value={exchangeAmount}
                            onChange={(e) => { setExchangeAmount(e.target.value); setExchangePreview(null); }}
                            placeholder="Enter amount"
                          />
                        </div>

                        <div style={{ background: "linear-gradient(180deg,#0f172a 0%, #09101d 100%)", border: "1px solid #1e293b", borderRadius: 16, padding: 14, marginTop: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>Exchange Rate Configuration</div>
                            {selectedPairData && <div style={{ fontSize: 12, color: "#64748b" }}>Pair #{selectedPairData.id}</div>}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                            <div style={{ background: "#0b1220", border: "1px solid #1e293b", borderRadius: 12, padding: 12 }}>
                              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Current System Rate</div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>
                              {loadingRate ? "..." : liveRate ? formatRate(liveRate) : selectedPairData?.rate ? formatRate(selectedPairData.rate) : "-"}
                              </div>
                            </div>
                            <div style={{ background: "#0b1220", border: "1px solid #1e293b", borderRadius: 12, padding: 12 }}>
                              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Exchange Fee</div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: "#f8fafc" }}>{selectedPairData?.fee_percent ?? 0}%</div>
                            </div>
                          </div>

                          <div>
                            <label style={styles.label}>Custom Admin Rate (Optional)</label>
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
                              style={{
                                ...styles.input,
                                border: customRate !== "" && customRate !== null ? "1px solid #2563eb" : "1px solid #1e293b",
                                background: customRate !== "" && customRate !== null ? "#0b1730" : "#0b1220",
                              }}
                            />
                            <div style={{ marginTop: 8, fontSize: 12, color: customRate !== "" ? "#60a5fa" : "#64748b" }}>
                              {customRate !== "" ? "Custom admin rate will override the live pair rate." : "Using automatic live exchange rate."}
                            </div>
                          </div>
                        </div>
                        <div style={styles.buttonRow}>
                        <button onClick={previewExchange} className="primaryBtn" style={{  background: "#334155" }} disabled={loadingPreview}>
                          {loadingPreview ? "Calculating..." : "Preview Exchange"}
                        </button>
                        </div>

                        {exchangePreview ? (
                          <div style={{ display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",  fontSize: 13, color: "#94a3b8" }}>
                            Rate: <b>{formatRate(exchangePreview.selected_rate)}</b> • Fee: <b>{exchangePreview.fee_percent}%  </b> {currencyExchangeFrom}
                          </div>
                        ) : (
                          currencyExchangeFrom && currencyExchangeTo && (
                            <div style={{    display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center", 
                                        fontSize: 13, 
                                        color: "#64748b" 
                                        }}>
                              Select amount and preview to see exchange details
                            </div>
                          )
                        )}

                        {exchangePreview && (
                          <div style={{ background: "#0b1220", border: "1px solid #1e293b", borderRadius: 14, padding: 12, color: "#cbd5e1", fontSize: 13, marginTop: 10 }}>

                            <div>Rate: <b>{formatRate(exchangePreview.selected_rate)}</b></div>
                            <div>Fee: <b>{formatRate(exchangePreview.fee_amount)}</b>  {currencyExchangeFrom}</div>
                            <div>Gross: <b>{formatRate(exchangePreview.gross_amount)}</b>  {currencyExchangeFrom}</div>
                            <div>User Receives: <b>{formatRate(exchangePreview.received_amount)} </b> {currencyExchangeTo}</div>
                          </div>
                        )}
                       <div style={styles.buttonRow}>
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
                    )}
                  </div>

                  </PermissionGate >


                  <div style={styles.ordersDivider}>
                    <div style={styles.ordersDividerLine} />
                    <div style={styles.ordersDividerText}>EXCHANGE HISTORY</div>
                    <div style={styles.ordersDividerLine} />
                  </div>


                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      width: "100%",
                      flexWrap: "nowrap",
                      alignItems: "center",
                      overflowX: "auto",
                    }}
                  >
                             <div style={{ flex:1 }}>
                      <div style={styles.historyFitlerTitle}>Date Range</div>
                     
                  <DatePicker
                    selectsRange
                    startDate={exchangeStartDate}
                    endDate={exchangeEndDate}
                    onChange={(update) => setExchangeDateRange(update)}
                    isClearable
                    placeholderText="Exchange date range"
                    customInput={<input style={{ ...styles.input}} />}
                  />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={styles.historyFitlerTitle}>Status</div>
                     
                  <select
                    style={styles.input}
                    value={exchangeStatusFilter}
                    onChange={(e) => setExchangeStatusFilter(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                {exchangeCurrencyOptions.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <div style={styles.historyFitlerTitle}>Currency</div>
                    <select
                      style={styles.input}
                      value={exchangeCurrencyFilter}
                      onChange={(e) => setExchangeCurrencyFilter(e.target.value)}
                    >
                      {exchangeCurrencyOptions.map((sym) => (
                        <option key={sym} value={sym}>{sym}</option>
                      ))}
                    </select>
                  </div>
                )}
                </div>

                
                  <div style={styles.txPillsRow}>
                    <div style={styles.txPill}>
                      <div style={styles.txPillValue}>{exchangeStats.totalCount}</div>
                      <div style={styles.txPillLabel}>Exchanges</div>
                    </div>

                    <div style={styles.txPill}>
                      <div style={styles.txPillValue}>
                        <BigNumber value={exchangeStats.totalExchanged} />
                        {exchangeCurrencyFilter && (
                          <span style={{...styles.providerMeta, fontSize:10, marginLeft:4}}>{exchangeCurrencyFilter}</span>
                        )}
                      </div>
                      <div style={styles.txPillLabel}>Total Exchanged
                        
                      </div>
                    </div>

                    <div style={styles.txPill}>
                      <div style={{ ...styles.txPillValue, color: "#22c55e" }}>
                        {exchangeStats.completedCount}
                      </div>
                      <div style={styles.txPillLabel}>Completed</div>
                    </div>

                    <div style={styles.txPill}>
                      <div style={{ ...styles.txPillValue, color: "#f59e0b" }}>
                        {exchangeStats.pendingCount}
                      </div>
                      <div style={styles.txPillLabel}>Pending</div>
                    </div>

                  </div>

                   <PermissionGate allowed={hasPermission(user, "exchange.view")}>

                  <div style={styles.ordersList}>
                    {loadingExchangeOrders ? (
                      <div style={styles.emptyOrders}>Loading exchange orders...</div>
                    ) : (filteredExchangeOrders || []).length === 0 ? (
                      <div style={styles.emptyOrders}>No exchange orders</div>
                    ) : (
                      filteredExchangeOrders.map((o) => (
                        <div key={o.id} style={styles.orderCard}>
                          <div style={styles.orderTop}>
                            <div>
                              <div style={styles.orderProduct}>
                                {o.from_currency?.symbol || "?"} → {o.to_currency?.symbol || "?"}
                                <span style={{ ...styles.networkBadge, marginLeft: 20 }}>   RATE {
                                            getDisplayRate(
                                              o.rate,
                                              o.from_currency?.symbol
                                            )?.toLocaleString() || "-"
                                          }</span>
                                <span style={{ ...styles.networkBadge, marginLeft: 10 }}>FEE {Number(o.fee_amount).toLocaleString()}</span>
                              </div>
                              <div style={styles.orderMeta}>#{o.id} • User #{o.user_id}</div>
                            </div>
                            <div style={{
                              ...styles.orderStatus,
                              ...(o.status === "pending" ? styles.statusPending : o.status === "completed" ? styles.statusDelivered : styles.statusDefault),
                            }}>
                              {o.status?.toUpperCase()}
                            </div>
                          </div>

                          <div style={styles.orderPriceRow}>
                            <div style={styles.orderPrice}>
                              <BigNumber value={o.from_amount} /> → <BigNumber value={o.to_amount} />
                            </div>
                          </div>

                          <div style={styles.txFooter}>
                            <span style={styles.txDate}>
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
  buttonRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
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
  historyFitlerTitle: {fontSize: 11, color: "#64748b",padding:"0  0 5px 5px"},

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
  orderProduct: { 
    fontSize: 16, 
    fontWeight: 700, 
    color: "white" , 
    marginBottom:5},
  
  orderMeta: {display: "flex",alignItems: "center", lineHeight: 1.2, fontSize: 12, color: "#64748b" },
  productTitleRow: {
  display: "flex",
  alignItems: "center",
  gap: 8,
},

providerMeta: {
  fontSize: 12,
  fontWeight: 400,
  color: "#94a3b8c0",
  whiteSpace: "nowrap",
},
  orderStatus: { padding: "7px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "1px solid" },
  statusPending: { background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.25)", color: "#f59e0b" },
  statusApproved: { background: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.25)", color: "#60a5fa" },
  statusDelivered: { background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)", color: "#22c55e" },
  statusDefault: { background: "rgba(246, 7, 7, 0.35)", borderColor: "rgba(184, 156, 148, 0.25)", color: "#b89994ff" },

  orderPriceRow: { 
    display: "flex", 
    justifyContent: "left", 
    alignItems: "center" ,
    gap:5
  },
  orderPrice: {
  display: "flex",
  alignItems: "center",
  fontSize: 22,
  fontWeight: 800,
  color: "white",
  gap:10
},
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

featuredBadge: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2px 10px",
  height: 22,
  boxSizing: "border-box",
  borderRadius: 999,
  background: "rgba(220, 128, 16, 0.4)",
  border: "1px solid rgba(37,99,235,0.25)",
  color: "#fee500",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1,
},

  orderDates: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

  dateItem: { 
    display: "flex",
    background: "#0b1220", 
    border: "1px solid #1e293b", 
    borderRadius: 14, 
    padding: 12 ,
    gap: 20},
    
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
    borderRadius: 20,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  txHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  txType: { fontSize: 16, fontWeight: 700, color: "white", textTransform: "capitalize" },
  txMeta: { marginTop: 6, fontSize: 12, color: "#64748b" },

  txStatus: { padding: "7px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "1px solid" },
  txCompleted: { background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)", color: "#22c55e" },
  txPending: { background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.25)", color: "#f59e0b" },
  txFailed: { background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.25)", color: "#ef4444" },

  txAmountRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  txAmount: { fontSize: 24, fontWeight: 800 },

  chainBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(37,99,235,0.25)",
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 700,
  },

  txBlockchain: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 14,
  },

  txInfoItem: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  txInfoLabel: { fontSize: 12, color: "#64748b" },
  txInfoValue: { fontSize: 12, color: "#e2e8f0", fontWeight: 600, fontFamily: "monospace" },

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