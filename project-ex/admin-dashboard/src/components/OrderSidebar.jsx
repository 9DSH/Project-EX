import { useState } from "react";
import { API_URL } from "../config";
import { hasPermission } from "../utils/permissions";

export default function OrderSidebar({ order, onClose, onRefresh,  onOpenUser }) {

  const token = localStorage.getItem("token");

  const currentUser = {
    role: localStorage.getItem("role"),
    username: localStorage.getItem("username") || "My",
    access_points: JSON.parse(localStorage.getItem("access_points") || "[]")
  };

  const [deliveryInfo, setDeliveryInfo] = useState(
    order.delivery_info?.message || ""
  );
  const iconUrl =
    order.icon_path
      ? `${API_URL}${order.icon_path}`
      : null;
  // -------------------------
  // APPROVE ORDER
  // -------------------------
  const approve = async () => {

    try {

      await fetch(`${API_URL}/admin/orders/${order.id}/approve`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
      });

      onRefresh?.();
      onClose();

    } catch (err) {

      console.error("Approve failed", err);
    }
  };

  // -------------------------
  // REJECT ORDER
  // -------------------------
  const reject = async () => {

    try {

      await fetch(`${API_URL}/admin/orders/${order.id}/reject`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
      });

      onRefresh?.();
      onClose();

    } catch (err) {

      console.error("Reject failed", err);
    }
  };
  // =========================
  // DELIVER ORDER
  // =========================
  const deliver = async () => {

    try {
      let parsedDelivery = {};

      if (deliveryInfo.trim()) {

        parsedDelivery = {
          message: deliveryInfo
        };
      }

      await fetch(
        `${API_URL}/admin/orders/${order.id}/deliver`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },

          body: JSON.stringify({
            delivery_info: parsedDelivery
          })
        }
        
      );
      
      console.log(parsedDelivery)
      alert("Order delivered successfully");

      onRefresh?.();
      onClose();

    } catch (err) {

      console.error("Delivery failed", err);

      alert("Delivery failed");
    }
  };

  // =========================
  // STATUS COLORS
  // =========================
  const statusColor =
    order.status === "pending"
      ? "#f59e0b"
      : order.status === "approved"
      ? "#10b981"
      : order.status === "delivered"
      ? "#3b82f6"
      : "#ef4444";


  // =========================
  // GENERAL INFO
  // =========================
  const generalInfoRaw = [
    order.username && { label: "Username", value: order.username },
    order.product_type && { label: "Product Type", value: order.product_type },
    order.category_name && { label: "Category", value: order.category_name },
    order.plan && { label: "Plan", value: order.plan },

    (order.price != null && order.currency) && {
      label: "Price",
      value: `${parseFloat(order.price).toFixed(2)} ${order.currency}`
    },

    order.discount_percent != null && {
      label: "Discount",
      value: `${parseFloat(order.discount_percent).toFixed(2)}%`
    },
    order.product_reward != null && {
      label: "Owner Reward",
      value: `${parseFloat(order.product_reward).toFixed(2)}%`
    },

    order.product_commision != null && {
      label: "System Commision",
      value: `${parseFloat(order.product_commision).toFixed(2)}%`
    },

    order.network && { label: "Network", value: order.network },

    (order.validity_days || order.validity_hours) && {
      label: "Validity",
      value: order.validity_days
        ? `${order.validity_days} Days`
        : `${order.validity_hours} Hours`
    },

    order.data_volume_gb && {
      label: "Data",
      value: `${order.data_volume_gb} GB`
    },

    order.is_recurring && { label: "Recurring", value: "Yes" },

    (order.stock !== null && order.stock !== undefined) && {
      label: "Stock",
      value: order.stock
    },

    order.is_featured && { label: "Featured", value: "Yes" },
  ];

  const generalInfo = generalInfoRaw.filter(Boolean);
  const hasGeneralInfo = generalInfo.length > 0;

  const hasDescription =
    typeof order.description === "string" &&
    order.description.trim().length > 0;

  const inputData =
    order.input_data && typeof order.input_data === "object"
      ? order.input_data
      : {};

  const beforeLoginFields = Object.entries(inputData).filter(
    ([, field]) => field.step === "before_order"
  );

  const afterLoginFields = Object.entries(inputData).filter(
    ([, field]) => field.step === "after_login"
  );

  const hasInputData =
    beforeLoginFields.length > 0 || afterLoginFields.length > 0;
  // =========================
  // EXTRA FEATURES
  // =========================
  const extraFeatures =
    order.extra_data &&
    typeof order.extra_data === "object"
      ? Object.entries(order.extra_data).filter(
          ([, value]) =>
            value !== null &&
            value !== undefined &&
            value !== "" &&
            !(Array.isArray(value) && value.length === 0)
        )
      : [];

  const hasExtraFeatures = extraFeatures.length > 0;


  console.log(order)
  return (

    <>
      {/* OVERLAY */}
      <div
        style={styles.overlay}
        onClick={onClose}
      />

      {/* SIDEBAR */}
      <div style={styles.container}>

        {/* TOPBAR */}
        <div style={styles.header}>

          <div>

            <div style={styles.orderId}>
              Order #{order.id}
            </div>

            <div style={styles.date}>
              {new Date(order.created_at).toLocaleString()}
            </div>

          </div>

          <button
            onClick={onClose}
            style={styles.closeIcon}
          >
            ✕
          </button>

        </div>
        {/* HERO PRODUCT CARD */}
        <div style={styles.heroCard}>

          {/* STATUS */}
          <div
            style={{
              ...styles.statusBadge,
              background: `${statusColor}22`,
              color: statusColor
            }}
          >
            {order.status?.toUpperCase()}
          </div>

            {/* USER QUICK ACCESS */}
            {order.user_id && (
              <div
                onClick={() => {
                  onClose?.();

                  onOpenUser?.({
                    user_id: order.user_id,
                    username: order.username,
                    admin_id: order.user_admin_id,
                    telegram_id: order.telegram_id,
                    status: order.user_status,
                    balances: order.balances,
                    created_date: order.created_date,
                    access_points: order.access_points,
                  });
                }}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,

                  width: 40,
                  height: 40,

                  borderRadius: "50%",

                  background: "#6f7dfab2",

                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",

                  fontSize: 14,
                  fontWeight: 700,

                  color: "white",

                  cursor: "pointer",

                  transition: "0.2s",

                  border: "1px solid #1e293b"
                }}
              >
            👤
              </div>
            )}

          {/* ICON */}
            <div style={styles.productIconContainer}>
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt={order.product_name}
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 18,
                    objectFit: "cover",
                    padding: 10,
                    boxSizing: "border-box",
                  }}
                />
              ) : (
                <div style={styles.productIcon}>📦</div>
              )}
            </div>

          {/* PRODUCT */}
          <div style={styles.productName}>
            {order.product_name}
          </div>

          {/* PLAN */}
          {order.plan && (
            <div style={styles.productPlan}>
              {order.plan}
            </div>
          )}

        </div>
        

        {/* GENERAL INFO */}
        {hasGeneralInfo && (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>
              General Information
            </div>

            <div style={styles.metaGrid}>
              {generalInfo.map((item, index) => (
                <CompactMeta
                  key={index}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>
          </div>
        )}

        {/* DESCRIPTION */}
        {hasDescription && (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>Description</div>
            <div style={styles.description}>
              {order.description}
            </div>
          </div>
        )}

        {/* EXTRA FEATURES */}
        {hasExtraFeatures && (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>
              Extra Features
            </div>

            <div style={styles.metaGrid}>
              {extraFeatures.map(([key, value]) => (
                <CompactMeta
                  key={key}
                  label={key}
                  value={
                    typeof value === "object"
                      ? JSON.stringify(value)
                      : value?.toString()
                  }
                />
              ))}
            </div>
          </div>
        )}
        {/* Input Data */}
        {/* Order Information */}
        {hasInputData && (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>User Information</div>

            {beforeLoginFields.length > 0 && (
              <>

                <div style={styles.metaGrid}>
                  {beforeLoginFields.map(([key, field]) => (
                    <CompactMeta
                      key={key}
                      label={field.label}
                      value={field.value || "-"}
                    />
                  ))}
                </div>
              </>
            )}

            {afterLoginFields.length > 0 && (
              <>

                <div style={{...styles.metaGrid , marginTop:10}}>
                  {afterLoginFields.map(([key, field]) => (
                    <CompactMeta
                      key={key}
                      label={field.label}
                      value="Required for login"
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}


        {/* ACTIONS */}
        {hasPermission(currentUser, "orders.manage") && order.status === "pending" && (

          <div style={styles.card}>

            <div style={styles.sectionTitle}>
              Order Actions
            </div>

            <div style={styles.actionsRow}>

              <button
                onClick={approve}
                style={styles.approve}
              >
                ✅ Approve
              </button>

              <button
                onClick={reject}
                style={styles.reject}
              >
                ❌ Reject
              </button>

            </div>

          </div>
        )}



        {/* DELIVERY */}
      {hasPermission(currentUser, "orders.manage") &&(order.status === "approved" ||
          order.status === "delivered") && (

          <div style={styles.card}>

            <div style={styles.sectionTitle}>
              Delivery Information
            </div>

            {order.status === "approved" ? (

              <>
                <textarea
                  placeholder="Paste account credentials, VPN config, activation code, subscription details..."
                  value={deliveryInfo}
                  onChange={(e) => setDeliveryInfo(e.target.value)}
                  style={styles.textarea}
                />

                <button
                  onClick={deliver}
                  style={styles.deliverBtn}
                >
                  🚀 Deliver Order
                </button>
              </>

            ) : (

              <>
                <div style={styles.deliveryBox}>
                  {order.delivery_info?.message || "No delivery message"}
                </div>

                <div style={styles.deliveredAt}>
                  Delivered at:
                  {" "}
                  {order.delivered_at
                    ? new Date(order.delivered_at).toLocaleString()
                    : "-"}
                </div>
              </>
            )}

          </div>
        )}


      </div>
    </>
  );
}

// =========================
// COMPACT META
// =========================
function CompactMeta({ label, value }) {

  return (

    <div style={styles.compactMeta}>

      <div style={styles.compactLabel}>
        {label}
      </div>

      <div style={styles.compactValue}>
        {value}
      </div>

    </div>
  );
}

// =========================
// STYLES
// =========================
const styles = {

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 999
  },

  container: {
    position: "fixed",
    right: 0,
    top: 0,
    width: 580,
    height: "100vh",

    background: "#0f172a",

    color: "white",

    padding: 24,

    overflowY: "auto",

    zIndex: 1000,

    boxShadow: "-10px 0 40px rgba(0,0,0,0.6)",

    borderLeft: "1px solid #1e293b"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22
  },

  orderId: {
    fontSize: 28,
    fontWeight: 700
  },

  date: {
    marginTop: 4,
    color: "#94a3b8",
    fontSize: 13
  },

  closeIcon: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    fontSize: 24,
    cursor: "pointer"
  },

  heroCard: {
    position: "relative",

    background:
      "linear-gradient(to bottom right, #111827, #0f172a)",
 
    border: "1px solid #1e293b",

    borderRadius: 24,

    padding: "30px 20px",

    marginBottom: 18,

    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },

  statusBadge: {
    position: "absolute",
    top: 18,
    left: 18,

    padding: "8px 14px",

    borderRadius: 999,

    fontWeight: 700,

    fontSize: 12
  },

  productIconContainer: {
    width: 92,
    height: 92,

    borderRadius: 24,
    border: "1px solid #3b3b35ed",
    background:  "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    marginTop: 14
  },

  productIcon: {
    fontSize: 40
  },

  productName: {
    fontSize: 22,
    fontWeight: 700,
    textAlign: "center"
  },

  productPlan: {
    marginTop: 8,

    padding: "8px 14px",

    borderRadius: 999,

    background: "#1e293b",

    color: "#cbd5e1",

    fontSize: 13
  },

  card: {
    background: "#0f172a",

    border: "1px solid #1e293b",

    borderRadius: 22,

    padding: 18,

    marginBottom: 18
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: 700,
    marginBottom: 18
  },

  metaGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12
  },

  compactMeta: {
    background: "#111827",

    border: "1px solid #1e293b",

    borderRadius: 16,

    padding: "12px 14px",

    minWidth: "calc(50% - 6px)",

    flex: 1
  },

  compactLabel: {
    color: "#94a3b8",
    fontSize: 12,
    marginBottom: 6
  },

  compactValue: {
    fontWeight: 700,
    fontSize: 14,
    wordBreak: "break-word"
  },

  description: {
    color: "#cbd5e1",
    lineHeight: 1.7,
    fontSize: 14
  },

  input: {
    width: "100%",

    padding: 14,

    background: "#020617",

    border: "1px solid #334155",

    borderRadius: 14,

    color: "white",

    marginBottom: 14,

    fontSize: 15
  },

  textarea: {
    width: "100%",

    minHeight: 180,

    padding: 14,

    background: "#0206177b",

    border: "1px solid #334155",

    borderRadius: 16,

    color: "white",

    resize: "vertical",

    fontSize: 14,

    marginBottom: 16,

    lineHeight: 1.6
  },

  actionsRow: {
    display: "flex",
    gap: 12
  },

  approve: {
    flex: 1,

    background: "#10b981",

    color: "white",

    border: "none",

    padding: "14px 18px",

    borderRadius: 14,

    cursor: "pointer",

    fontWeight: 700,

    fontSize: 15
  },

  reject: {
    flex: 1,

    background: "#ef4444",

    color: "white",

    border: "none",

    padding: "14px 18px",

    borderRadius: 14,

    cursor: "pointer",

    fontWeight: 700,

    fontSize: 15
  },

  updateBtn: {
    width: "100%",

    background: "#2563eb",

    color: "white",

    border: "none",

    padding: "14px",

    borderRadius: 14,

    cursor: "pointer",

    fontWeight: 700,

    fontSize: 15
  },

  deliverBtn: {
    width: "100%",

    background: "#7c3aed",

    color: "white",

    border: "none",

    padding: "16px",

    borderRadius: 16,

    cursor: "pointer",

    fontWeight: 700,

    fontSize: 16
  },

  deliveryBox: {
    background: "#0206177b",

    border: "1px solid #1e293b",

    padding: 18,

    borderRadius: 16,

    whiteSpace: "pre-wrap",

    lineHeight: 1.7,

    color: "#e2e8f0",

    fontSize: 14
  },


  deliveredAt: {
    marginTop: 14,
    color: "#94a3b8",
    fontSize: 13
  }
};