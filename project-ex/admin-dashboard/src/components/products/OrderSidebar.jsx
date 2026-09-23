import { useState } from "react";
import { createPortal } from "react-dom";
import { API_URL } from "../../config";
import { hasPermission } from "../../utils/permissions";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Send, User as UserIcon, X } from "lucide-react";

const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "—");

export default function OrderSidebar({ order, onClose, onRefresh,  onOpenUser }) {

  const token = localStorage.getItem("token");

  const currentUser = {
    role: localStorage.getItem("role"),
    username: localStorage.getItem("username") || "My",
    access_points: JSON.parse(localStorage.getItem("access_points") || "[]")
  };

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState(false);

  const iconUrl =
    order.icon_path
      ? `${API_URL}${order.icon_path}`
      : null;
  // -------------------------
  // APPROVE ORDER
  // -------------------------
  const approve = async () => {

    try {

      const res = await fetch(`${API_URL}/admin/orders/${order.id}/approve`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Approve failed (${res.status})`);
      }

      onRefresh?.();
      onClose();

    } catch (err) {

      console.error("Approve failed", err);
      alert(typeof err.message === "string" ? err.message : "Approve failed");
    }
  };

  // -------------------------
  // REJECT ORDER (reason collected via modal)
  // -------------------------
  const reject = async (reason) => {

    try {

      const params = new URLSearchParams();
      if (reason && reason.trim()) params.set("reason", reason.trim());

      const res = await fetch(`${API_URL}/admin/orders/${order.id}/reject?${params.toString()}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Reject failed (${res.status})`);
      }

      setShowRejectModal(false);
      onRefresh?.();
      onClose();

    } catch (err) {

      console.error("Reject failed", err);
      alert(typeof err.message === "string" ? err.message : "Reject failed");
    }
  };
  // =========================
  // DELIVER ORDER (message collected via modal)
  // =========================
  const deliver = async (message) => {

    try {
      let parsedDelivery = {};

      if (message && message.trim()) {

        parsedDelivery = {
          message: message.trim()
        };
      }

      const res = await fetch(
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

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Delivery failed (${res.status})`);
      }

      alert("Order delivered successfully");

      setShowDeliverModal(false);
      onRefresh?.();
      onClose();

    } catch (err) {

      console.error("Delivery failed", err);

      alert(typeof err.message === "string" ? err.message : "Delivery failed");
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
  // STATUS TIMELINE STEPS
  // (mirrors WireTransferDashboard's StatusTimeline: "Ordered" always
  // shows, every other step only shows once it has actually happened)
  // =========================
  const timelineSteps = [
    { key: "created",   label: "Ordered",   at: order.created_at,   by: order.username,      icon: Clock,        color: "#94a3b8" },
    { key: "approved",  label: "Approved",  at: order.approved_at,  by: order.approved_by,   icon: CheckCircle2, color: "#34d399" },
    { key: "rejected",  label: "Rejected",  at: order.rejected_at,  by: order.rejected_by,   icon: XCircle,      color: "#f87171", note: order.rejection_reason },
    { key: "delivered", label: "Delivered", at: order.delivered_at, by: order.delivered_by,  icon: Send,         color: "#60a5fa" },
    { key: "failed",    label: "Failed",    at: order.failed_at,    by: order.failed_by,     icon: AlertTriangle,color: "#fb923c", note: order.fail_reason },
  ].filter((s) => s.key === "created" || !!s.at);


  // =========================
  // GENERAL INFO
  // =========================
  const generalInfoRaw = [
    console.log("order:",order),
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
    (order.product_owner_displayName != null ) && {
      label: "Product Owner",
      value: order.product_owner_displayName
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

  return createPortal(

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
        {/* HERO PRODUCT CARD — 3 columns: timeline | icon+product | user quick access */}
        <div style={styles.heroCard}>

          <div style={styles.heroGrid}>

            {/* LEFT: STATUS TIMELINE */}
            <div style={styles.heroTimelineCol}>
              <StatusTimeline steps={timelineSteps} />
            </div>

            {/* MIDDLE: STATUS + ICON + PRODUCT */}
            <div style={styles.heroCenterCol}>

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

              <div style={styles.productName}>
                {order.product_name}
              </div>

              {order.plan && (
                <div style={styles.productPlan}>
                  {order.plan}
                </div>
              )}
            </div>

            {/* RIGHT: USER QUICK ACCESS */}
            <div style={styles.heroUserCol}>
              {order.user_id ? (
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
                  style={styles.userQuickBtn}
                >
                  <UserIcon size={17} />
                </div>
              ) : (
                <div style={{ ...styles.userQuickBtn, background: "#1e293b", cursor: "default" }}>
                  <UserIcon size={17} />
                </div>
              )}

              <div style={styles.userQuickName}>{order.username || "—"}</div>

              {order.user_status && (
                <div style={{
                  ...styles.userQuickMeta,
                  color: order.user_status === "active" ? "#34d399" : "#94a3b8",
                }}>
                  {order.user_status}
                </div>
              )}

              {order.telegram_id && (
                <div style={styles.userQuickMeta}>Telegram linked</div>
              )}
            </div>

          </div>

        </div>
        

        {/* GENERAL INFO */}
        {hasGeneralInfo && (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>
              General Information
            </div>

            <div style={styles.rowList}>
              {generalInfo.map((item, index) => (
                <DetailRow
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

            <div style={styles.rowList}>
              {extraFeatures.map(([key, value]) => (
                <DetailRow
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

            <div style={styles.rowList}>
              {beforeLoginFields.map(([key, field]) => (
                <DetailRow
                  key={key}
                  label={field.label}
                  value={field.value || "-"}
                />
              ))}

              {afterLoginFields.map(([key, field]) => (
                <DetailRow
                  key={key}
                  label={field.label}
                  value="Required for login"
                />
              ))}
            </div>
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
                onClick={() => setShowRejectModal(true)}
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

              <button
                onClick={() => setShowDeliverModal(true)}
                style={styles.deliverBtn}
              >
                🚀 Deliver Order
              </button>

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
                  {order.delivered_by ? ` · by ${order.delivered_by}` : ""}
                </div>
              </>
            )}

          </div>
        )}

        {/* REJECTION */}
        {order.status === "rejected" && (

          <div style={styles.card}>

            <div style={styles.sectionTitle}>
              Rejection Information
            </div>

            <div style={styles.rejectionBox}>
              {order.rejection_reason || "No reason provided"}
            </div>

            <div style={styles.deliveredAt}>
              Rejected at:
              {" "}
              {order.rejected_at
                ? new Date(order.rejected_at).toLocaleString()
                : "-"}
              {order.rejected_by ? ` · by ${order.rejected_by}` : ""}
            </div>

          </div>
        )}

        {/* REJECT REASON MODAL */}
        {showRejectModal && (
          <RejectModal
            onClose={() => setShowRejectModal(false)}
            onConfirm={reject}
          />
        )}

        {/* DELIVERY MESSAGE MODAL */}
        {showDeliverModal && (
          <DeliverModal
            initialMessage={order.delivery_info?.message || ""}
            onClose={() => setShowDeliverModal(false)}
            onConfirm={deliver}
          />
        )}


      </div>
    </>,
    document.body
  );
}

// =========================
// REJECT REASON MODAL
// =========================
function RejectModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState("");

  return createPortal(
    <div style={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>Reject Order</div>
          <button style={styles.modalCloseIcon} onClick={onClose}><X size={16} /></button>
        </div>

        <div style={styles.modalLabel}>Reason for rejection</div>
        <textarea
          autoFocus
          placeholder="e.g. Payment could not be verified, duplicate order, out of stock…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ ...styles.textarea, minHeight: 120 }}
        />

        <div style={styles.actionsRow}>
          <button style={styles.modalCancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={styles.reject}
            onClick={() => onConfirm(reason)}
          >
            ❌ Confirm Rejection
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// =========================
// DELIVERY MESSAGE MODAL
// =========================
function DeliverModal({ initialMessage, onClose, onConfirm }) {
  const [message, setMessage] = useState(initialMessage || "");

  return createPortal(
    <div style={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>Deliver Order</div>
          <button style={styles.modalCloseIcon} onClick={onClose}><X size={16} /></button>
        </div>

        <div style={styles.modalLabel}>Delivery message (sent to the user's Telegram)</div>
        <textarea
          autoFocus
          placeholder="Paste account credentials, VPN config, activation code, subscription details..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={styles.textarea}
        />

        <div style={styles.actionsRow}>
          <button style={styles.modalCancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={styles.deliverBtn}
            onClick={() => onConfirm(message)}
          >
            🚀 Confirm Delivery
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// =========================
// STATUS TIMELINE (mirrors WireTransferDashboard)
// =========================
function StatusTimeline({ steps }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {steps.map((s, i) => {
        const Icon = s.icon;
        const isLast = i === steps.length - 1;
        return (
          <div key={s.key} style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: `${s.color}18`, border: `1px solid ${s.color}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: s.color, flexShrink: 0,
              }}>
                <Icon size={10} />
              </div>
              {!isLast && <div style={{ width: 1, flex: 1, minHeight: 16, background: "rgba(255, 255, 255, 0.25)", margin: "3px 0" }} />}
            </div>
            <div style={{ paddingBottom: isLast ? 2 : 12 }}>
              <div style={{ color: "white", fontSize: 11, fontWeight: 700 }}>{s.label}</div>
              <div style={{ color: "#7c899b", fontSize: 10, marginTop: "3px" }}>
                {fmtDate(s.at)}{s.by ? ` by ${s.by}` : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =========================
// DETAIL ROW (OrderRow-style stacked list, replaces the old
// wrap-grid of CompactMeta tiles for tighter column control)
// =========================
function DetailRow({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value}</div>
    </div>
  );
}

// =========================
// STYLES
// =========================
const styles = {

  // ── Reject / Deliver popup modals ──────────────────────────
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.72)",
    zIndex: 1100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(6px)",
  },

  modalCard: {
    width: "92%",
    maxWidth: 480,
    background: "#0d1424",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 20,
    padding: "22px 24px",
    boxShadow: "0 32px 80px rgba(0,0,0,.6)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  modalTitle: {
    color: "white",
    fontWeight: 700,
    fontSize: 17,
  },

  modalCloseIcon: {
    background: "#0b1525",
    border: "1px solid #313d58ff",
    color: "#475569",
    width: 30,
    height: 30,
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  modalLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 8,
  },

  modalCancelBtn: {
    flex: 1,
    background: "transparent",
    border: "1px solid rgba(255,255,255,.1)",
    color: "#94a3b8",
    padding: "14px 18px",
    borderRadius: 14,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 15,
  },

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

    padding: "24px 20px",

    marginBottom: 18,
  },

  statusBadge: {
    padding: "8px 14px",

    borderRadius: 999,

    fontWeight: 700,

    fontSize: 12,

    marginBottom: 14,
  },

  // ── 3-column hero layout: timeline | icon+product | user quick access ──
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "140px 1fr 130px",
    alignItems: "center",
    gap: 14,
  },

  heroTimelineCol: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    borderRight: "1px solid rgba(255,255,255,.06)",
    paddingRight: 12,
  },

  heroCenterCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },

  heroUserCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    gap: 6,
    height: "100%",
    borderLeft: "1px solid rgba(255,255,255,.06)",
    paddingLeft: 12,
  },

  userQuickBtn: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "#6f7dfab2",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    cursor: "pointer",
    transition: "0.2s",
    border: "1px solid #1e293b",
  },

  userQuickName: {
    fontSize: 12,
    fontWeight: 700,
    color: "white",
    maxWidth: 120,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  userQuickMeta: {
    fontSize: 10,
    color: "#64748b",
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

  // ── Stacked OrderRow-style detail list (replaces metaGrid/CompactMeta) ──
  rowList: {
    display: "flex",
    flexDirection: "column",
  },

  detailRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    alignItems: "center",
    gap: 12,
    padding: "11px 4px",
    borderBottom: "1px solid rgba(255,255,255,.05)",
  },

  detailLabel: {
    color: "#94a3b8",
    fontSize: 12,
    textTransform: "capitalize",
  },

  detailValue: {
    fontWeight: 700,
    fontSize: 13,
    color: "white",
    textAlign: "right",
    wordBreak: "break-word",
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

  rejectionBox: {
    background: "rgba(239,68,68,.07)",

    border: "1px solid rgba(239,68,68,.2)",

    padding: 18,

    borderRadius: 16,

    whiteSpace: "pre-wrap",

    lineHeight: 1.7,

    color: "#fca5a5",

    fontSize: 14
  },


  deliveredAt: {
    marginTop: 14,
    color: "#94a3b8",
    fontSize: 13
  }
};