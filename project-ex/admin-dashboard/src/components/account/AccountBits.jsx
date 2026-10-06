import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { fmt, fmtDate, shortAddress, useBodyLock } from "./AccountUtils";

export function Tag({ text, color }) {
  return <span className="ma-tag" style={{ color, borderColor: color, background: `${color}22` }}>{text}</span>;
}

export function MetaRow({ label, value }) {
  return (
    <div className="ma-metaRow">
      <span className="ma-metaLabel">{label}</span>
      <span className="ma-metaValue">{value ?? "—"}</span>
    </div>
  );
}

export function Stat({ label, value }) {
  return (
    <div className="ma-stat">
      <div className="ma-stat-label">{label}</div>
      <div className="ma-stat-value">{value ?? "—"}</div>
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="ma-empty">{children}</div>;
}

export function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const kind = ["completed", "confirmed", "success"].includes(s) ? "completed"
    : ["pending", "processing"].includes(s) ? "pending"
    : ["failed", "rejected", "cancelled", "canceled"].includes(s) ? "failed" : "other";
  return <span className={`ma-st ma-st--${kind}`}>{status || "—"}</span>;
}

/** One transaction as a compact, responsive card (replaces the wide table rows). */
export function TxRow({ tx, showUser = true, showHash = true, showNetwork = true, forceCurrency }) {
  const hash = tx.tx_hash || tx.wallet_address;
  const cur = forceCurrency || tx.currency || "—";
  return (
    <div className="ma-tx">
      <div className="ma-tx-l">
        <div className="ma-tx-line">
          <span className="ma-typeBadge">{tx.type || "—"}</span>
          <StatusBadge status={tx.status} />
        </div>
        <div className="ma-tx-sub">{fmtDate(tx.created_at || tx.timestamp || tx.time)}</div>
        {showUser && (
          <div className="ma-tx-sub"><strong>{tx.username || "—"}</strong> · #{tx.user_id ?? "—"}</div>
        )}
      </div>
      <div className="ma-tx-r">
        <div className="ma-tx-amt">{fmt(tx.amount)}</div>
        <div className="ma-tx-cur">{cur}{showNetwork && tx.network ? ` · ${tx.network}` : ""}</div>
        {showHash && <div className="ma-tx-hash" title={hash || ""}>{shortAddress(hash)}</div>}
        <div className="ma-tx-sub">#{tx.id ?? "—"}</div>
      </div>
    </div>
  );
}

/**
 * Desktop/tablet: slides in from the right.
 * Mobile (<=640px): bottom sheet that rises from the very bottom, leaving a
 * small dimmed strip at the top. All behaviour lives in myaccount.css.
 */
export function SidePanel({ onClose, icon: Icon, title, subtitle, headerRight, children }) {
  const [open, setOpen] = useState(false);
  useBodyLock(true);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(id); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return createPortal(
    <div className={`ma-side${open ? " is-open" : ""}`}>
      <div className="ma-side-backdrop" onClick={onClose} />
      <aside className="ma-side-panel" role="dialog" aria-modal="true">
        <div className="ma-side-head">
          <div className="ma-side-title">
            {Icon && <Icon size={18} />}
            <div style={{ minWidth: 0 }}>
              <strong>{title}</strong>
              {subtitle && <span className="sub">{subtitle}</span>}
            </div>
          </div>
          <div className="ma-row" style={{ flexWrap: "nowrap" }}>
            {headerRight}
            <button type="button" className="ma-closeBtn" onClick={onClose} aria-label="Close"><X size={14} /></button>
          </div>
        </div>
        <div className="ma-side-body">{children}</div>
      </aside>
    </div>,
    document.body
  );
}