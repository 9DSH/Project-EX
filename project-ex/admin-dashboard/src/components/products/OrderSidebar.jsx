import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { API_URL } from "../../config";
import { hasPermission } from "../../utils/permissions";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Send, User as UserIcon, X } from "lucide-react";
import "./OrderSidebar.css";

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

  // Open/close slide animation — same mechanism as UserSidebar: fade+slide
  // in on mount, and on close, play the reverse animation for 250ms before
  // actually calling the parent's onClose (which unmounts this).
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);
  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose?.(), 250);
  };

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
      handleClose();

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
      handleClose();

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
      handleClose();

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
        className={`os-overlay${visible ? " is-visible" : ""}`}
        onClick={handleClose}
      />

      {/* SIDEBAR — slides in from the right on desktop, rises from the
          bottom as a sheet on mobile (see OrderSidebar.css), same
          mechanism as UserSidebar. */}
      <div
        className={`os-container${visible ? " is-visible" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >

        {/* TOPBAR */}
        <div className="os-header">

          <div>

            <div className="os-order-id">
              Order #{order.id}
            </div>

            <div className="os-date">
              {new Date(order.created_at).toLocaleString()}
            </div>

          </div>

          <button
            onClick={handleClose}
            className="os-close-icon"
          >
            ✕
          </button>

        </div>
        {/* HERO PRODUCT CARD — 3 columns: timeline | icon+product | user quick access */}
        <div className="os-hero-card">

          <div className="os-hero-grid">

            {/* LEFT: STATUS TIMELINE */}
            <div className="os-hero-timeline-col">
              <StatusTimeline steps={timelineSteps} />
            </div>

            {/* MIDDLE: STATUS + ICON + PRODUCT */}
            <div className="os-hero-center-col">

              {/* STATUS */}
              <div
                className="os-status-badge"
                style={{ background: `${statusColor}22`, color: statusColor }}
              >
                {order.status?.toUpperCase()}
              </div>

              <div className="os-product-icon-container">
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
                  <div className="os-product-icon">📦</div>
                )}
              </div>

              <div className="os-product-name">
                {order.product_name}
              </div>

              {order.plan && (
                <div className="os-product-plan">
                  {order.plan}
                </div>
              )}
            </div>

            {/* RIGHT: USER QUICK ACCESS */}
            <div className="os-hero-user-col">
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
                  className="os-user-quick-btn"
                >
                  <UserIcon size={17} />
                </div>
              ) : (
                <div className="os-user-quick-btn" style={{ background: "#1e293b", cursor: "default" }}>
                  <UserIcon size={17} />
                </div>
              )}

              <div className="os-user-quick-name">{order.username || "—"}</div>

              {order.user_status && (
                <div
                  className="os-user-quick-meta"
                  style={{ color: order.user_status === "active" ? "#34d399" : "#94a3b8" }}
                >
                  {order.user_status}
                </div>
              )}

              {order.telegram_id && (
                <div className="os-user-quick-meta">Telegram linked</div>
              )}
            </div>

          </div>

        </div>
        

        {/* GENERAL INFO */}
        {hasGeneralInfo && (
          <div className="os-card">
            <div className="os-section-title">
              General Information
            </div>

            <div className="os-row-list">
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
          <div className="os-card">
            <div className="os-section-title">Description</div>
            <div className="os-description">
              {order.description}
            </div>
          </div>
        )}

        {/* EXTRA FEATURES */}
        {hasExtraFeatures && (
          <div className="os-card">
            <div className="os-section-title">
              Extra Features
            </div>

            <div className="os-row-list">
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
          <div className="os-card">
            <div className="os-section-title">User Information</div>

            <div className="os-row-list">
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

          <div className="os-card">

            <div className="os-section-title">
              Order Actions
            </div>

            <div className="os-actions-row">

              <button
                onClick={approve}
                className="os-approve"
              >
                ✅ Approve
              </button>

              <button
                onClick={() => setShowRejectModal(true)}
                className="os-reject"
              >
                ❌ Reject
              </button>

            </div>

          </div>
        )}



        {/* DELIVERY */}
      {hasPermission(currentUser, "orders.manage") &&(order.status === "approved" ||
          order.status === "delivered") && (

          <div className="os-card">

            <div className="os-section-title">
              Delivery Information
            </div>

            {order.status === "approved" ? (

              <button
                onClick={() => setShowDeliverModal(true)}
                className="os-deliver-btn"
              >
                🚀 Deliver Order
              </button>

            ) : (

              <>
                <div className="os-delivery-box">
                  {order.delivery_info?.message || "No delivery message"}
                </div>

                <div className="os-delivered-at">
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

          <div className="os-card">

            <div className="os-section-title">
              Rejection Information
            </div>

            <div className="os-rejection-box">
              {order.rejection_reason || "No reason provided"}
            </div>

            <div className="os-delivered-at">
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
    <div className="os-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="os-modal-card">
        <div className="os-modal-header">
          <div className="os-modal-title">Reject Order</div>
          <button className="os-modal-close-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="os-modal-label">Reason for rejection</div>
        <textarea
          autoFocus
          placeholder="e.g. Payment could not be verified, duplicate order, out of stock…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="os-textarea"
          style={{ minHeight: 120 }}
        />

        <div className="os-actions-row">
          <button className="os-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="os-reject"
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
    <div className="os-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="os-modal-card">
        <div className="os-modal-header">
          <div className="os-modal-title">Deliver Order</div>
          <button className="os-modal-close-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="os-modal-label">Delivery message (sent to the user's Telegram)</div>
        <textarea
          autoFocus
          placeholder="Paste account credentials, VPN config, activation code, subscription details..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="os-textarea"
        />

        <div className="os-actions-row">
          <button className="os-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="os-deliver-btn"
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
    <div className="os-detail-row">
      <div className="os-detail-label">{label}</div>
      <div className="os-detail-value">{value}</div>
    </div>
  );
}