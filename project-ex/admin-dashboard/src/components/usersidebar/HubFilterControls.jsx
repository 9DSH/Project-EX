import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, CalendarRange } from "lucide-react";
import DatePicker from "react-datepicker";
import { forwardRef } from "react";
import "./UserSidebar.css";

/**
 * Small hook mirroring the sidebar's own 700px mobile breakpoint, so the
 * date field can swap from a labeled input to an icon-only trigger —
 * everything else in the row stays exactly where it is.
 */
export function useIsCompact(breakpoint = 700) {
  const [compact, setCompact] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return compact;
}

function useClickAway(open, onClose, refs) {
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e) => {
      if (refs.some((r) => r.current?.contains(e.target))) return;
      onClose();
    };
    const handleKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [open]);
}

/**
 * The whole filter bar's background container — the icy dark strip
 * used across HeroHub, wrapping the filter row (+ optional stat pills).
 */
export function FilterBar({ children }) {
  return <div className="us-hh-bar">{children}</div>;
}

/**
 * Re-themed dropdown: a custom trigger + portal-rendered options panel
 * (native <select> popups can't be restyled), same icy/blur look as
 * HeroHub's DropdownFilter. Always renders in labeled form.
 */
export function MiniDropdown({ label, value, onChange, options, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useClickAway(open, () => setOpen(false), [triggerRef, panelRef]);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected ? selected.label : placeholder || "Select";

  const openPanel = () => {
    if (disabled) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 150) });
    setOpen(true);
  };

  const pick = (v) => {
    onChange?.(v);
    setOpen(false);
  };

  return (
    <div className="us-hh-field">
      {label && <div className="us-hh-field-label">{label}</div>}
      <div
        className={`us-hh-select-wrap${disabled ? " is-disabled" : ""}`}
        ref={triggerRef}
        onClick={() => (disabled ? null : open ? setOpen(false) : openPanel())}
      >
        <div className="us-hh-select">{displayLabel}</div>
        <ChevronDown size={13} className="us-hh-select-icon" />
      </div>

      {open &&
        !disabled &&
        createPortal(
          <div
            className="us-hh-dropdown-panel"
            ref={panelRef}
            style={{ top: coords.top, left: coords.left, minWidth: coords.width }}
          >
            {placeholder && (
              <div
                className={`us-hh-dropdown-option${!value || value === "all" ? " is-active" : ""}`}
                onClick={() => pick("")}
              >
                {placeholder}
              </div>
            )}
            {options.map((opt) => (
              <div
                key={opt.value}
                className={`us-hh-dropdown-option${value === opt.value ? " is-active" : ""}`}
                onClick={() => pick(opt.value)}
              >
                {opt.label}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

const DateIconButton = forwardRef(({ value, onClick, active, label }, ref) => (
  <button
    type="button"
    ref={ref}
    onClick={onClick}
    className={`us-hh-icon-trigger${active ? " is-active" : ""}`}
    title={value || label}
    aria-label={label}
  >
    <CalendarRange size={14} />
  </button>
));
DateIconButton.displayName = "DateIconButton";

/**
 * Date-range field: full labeled input with calendar icon on desktop,
 * collapses to an icon-only trigger on mobile — the calendar itself
 * still opens in a portal either way, so it's never clipped.
 */
export function MiniDateRange({ label, startDate, endDate, onChange, placeholderText, portalId }) {
  const compact = useIsCompact();
  const active = Boolean(startDate || endDate);

  if (compact) {
    return (
      <div className="us-hh-field us-hh-field-compact">
        <DatePicker
          selectsRange
          startDate={startDate}
          endDate={endDate}
          onChange={onChange}
          isClearable
          placeholderText={placeholderText || "Date range"}
          dateFormat="dd MMM yyyy"
          customInput={<DateIconButton active={active} label={label || "Date range"} />}
          portalId={portalId}
          popperClassName="us-hh-datepicker-popper"
          popperPlacement="bottom-start"
        />
      </div>
    );
  }

  return (
    <div className="us-hh-field">
      {label && <div className="us-hh-field-label">{label}</div>}
      <div className="us-hh-date-wrap">
        <CalendarRange size={13} className="us-hh-field-icon" />
        <DatePicker
          selectsRange
          startDate={startDate}
          endDate={endDate}
          onChange={onChange}
          isClearable
          placeholderText={placeholderText || "Date range"}
          dateFormat="dd MMM yyyy"
          customInput={<input className="us-hh-input us-hh-date-input" />}
          portalId={portalId}
          popperClassName="us-hh-datepicker-popper"
          popperPlacement="bottom-start"
        />
      </div>
    </div>
  );
}

/** Row of stat pills, icy HeroHub theme — label + value only (no icons).
 * pills: [{key, label, value, accent, meta, tooltip}] — `value` may be a
 * plain string/number or JSX (e.g. a value + colored suffix); pass an
 * explicit `tooltip` string in that case so the native title attribute
 * doesn't end up stringifying a React element into "[object Object]". */
export function StatPillsRow({ pills }) {
  return (
    <div className="us-hh-pills-row">
      {pills.map((p) => {
        const isPlainValue = typeof p.value === "string" || typeof p.value === "number";
        const title = p.tooltip || (isPlainValue ? `${p.label}: ${p.value}` : p.label);
        return (
          <div key={p.key} className="us-hh-pill" title={title}>
            <div className="us-hh-pill-text">
              <div className="us-hh-pill-label">
                {p.label}
                {p.meta && <span className="us-hh-pill-meta" style={{ color: p.accent || "#60a5fa" }}> · {p.meta}</span>}
              </div>
              <div className="us-hh-pill-value" style={{ color: p.accent || "#e2e8f0" }}>{p.value ?? "—"}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}