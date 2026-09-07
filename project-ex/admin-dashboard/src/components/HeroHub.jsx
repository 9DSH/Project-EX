import { useEffect, useRef, useState, forwardRef } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, CalendarRange, RefreshCw, X, ListFilter } from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";
import DatePicker from "react-datepicker";
import "./HeroHub.css";

/**
 * ── useIsCompact ─────────────────────────────────────────────────
 * Tracks whether the viewport is at/below `breakpoint`. Used to collapse
 * the search and date fields down to an icon-only trigger + popover so
 * the hub itself never has to wrap onto a second row.
 */
function useIsCompact(breakpoint = 680) {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= breakpoint
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setCompact(e.matches);
    handler(mq);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, [breakpoint]);

  return compact;
}

/**
 * ── useClickAway ─────────────────────────────────────────────────
 * Closes a popover on outside click, scroll, resize, or Escape.
 */
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
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/**
 * ── Skeleton (used for loading stat pill values) ──────────────────
 */
function Sk({ w = 40, h = 15 }) {
  return <div className="hh-sk" style={{ width: w, height: h }} />;
}

/**
 * ── Stat pill ────────────────────────────────────────────────────
 * pill: { key, icon, label, value, accent, loading, meta }
 * meta: optional short prefix (e.g. a currency code) rendered before
 * the label — use this instead of baking the currency into `value`
 * whenever the pill's value represents a total/volume in a currency.
 *
 * `compact` collapses the pill to just its icon; hovering (or
 * focusing, for keyboard users) reveals a small popover with the
 * title and value — same icy/blur theme as the hub's other popovers,
 * escaping hh-hub's overflow via a portal so it's never clipped.
 */
function StatPill({ icon: Icon, label, value, accent = "#60a5fa", loading, meta, compact }) {
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  if (!compact) {
    return (
      <div className="hh-pill" title={`${label}: ${loading ? "…" : value ?? "—"}`}>
        {Icon && (
          <div className="hh-pill-icon" style={{ background: accent + "16", color: accent }}>
            <Icon size={14} />
          </div>
        )}
        <div className="hh-pill-text">
          <div className="hh-pill-label">
            {label}
            {meta && <span className="hh-pill-meta" style={{ color: accent }}> - {meta}</span>}
            
          </div>
          {loading ? <Sk /> : <div className="hh-pill-value" style={{ color: accent }}>{value ?? "—"}</div>}
        </div>
      </div>
    );
  }

  const show = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
    setHovered(true);
  };
  const hide = () => setHovered(false);

  return (
    <div
      className="hh-pill-compact"
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
      role="button"
      aria-label={`${label}: ${loading ? "loading" : value ?? "—"}`}
      style={{ background: accent + "16", color: accent }}
    >
      {Icon && <Icon size={14} />}

      {hovered &&
        createPortal(
          <div
            className="hh-pill-tooltip"
            style={{ top: coords.top, left: coords.left }}
          >
            <div className="hh-pill-tooltip-label">
              {meta && <span style={{ color: accent }}>{meta} </span>}
              {label}
            </div>
            {loading ? (
              <Sk w={40} h={14} />
            ) : (
              <div className="hh-pill-tooltip-value" style={{ color: accent }}>
                {value ?? "—"}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * ── Field wrapper ────────────────────────────────────────────────
 * Gives every filter field a small caption above it, and the same text
 * as a native title tooltip so it's still readable on hover even where
 * space is tight.
 */
function Field({ label, className = "", children }) {
  return (
    <div className={`hh-field ${className}`} title={label}>
      {label && <div className="hh-field-label">{label}</div>}
      {children}
    </div>
  );
}

/**
 * ── Compact search field ─────────────────────────────────────────
 * Wide screens: a normal labeled search input.
 * Narrow screens: collapses to an icon-only trigger; clicking it opens
 * a small popover below the icon containing the actual input, so the
 * hub itself never grows past one row.
 */
function SearchField({ search, compact }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  useClickAway(open, () => setOpen(false), [triggerRef, panelRef]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const label = search.label || "Search";

  if (!compact) {
    return (
      <Field label={label} className="hh-field-search">
        <div className="hh-search-wrap">
          <Search size={13} className="hh-field-icon" />
          <input
            className="hh-input"
            placeholder={search.placeholder || "Search..."}
            value={search.value}
            onChange={(e) => search.onChange?.(e.target.value)}
            style={search.style}
          />
        </div>
      </Field>
    );
  }

  const isActive = Boolean(search.value?.trim());

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 6, left: rect.left });
    setOpen(true);
  };

  return (
    <div className="hh-field hh-field-compact">
      <button
        type="button"
        ref={triggerRef}
        className={`hh-icon-trigger${isActive ? " hh-icon-trigger-active" : ""}`}
        onClick={toggle}
        title={label}
        aria-label={label}
      >
        <Search size={14} />
      </button>

      {open &&
        createPortal(
          <div
            className="hh-compact-panel"
            ref={panelRef}
            style={{ top: coords.top, left: coords.left }}
          >
            <div className="hh-field-label">{label}</div>
            <div className="hh-search-wrap">
              <Search size={13} className="hh-field-icon" />
              <input
                ref={inputRef}
                className="hh-input"
                placeholder={search.placeholder || "Search..."}
                value={search.value}
                onChange={(e) => search.onChange?.(e.target.value)}
                style={search.style}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * ── Date icon trigger ────────────────────────────────────────────
 * Used as react-datepicker's `customInput` on narrow screens: an
 * icon-only button. react-datepicker forwards `onClick`/`value`/`ref`
 * to it and still opens its own portal-rendered calendar below it —
 * so this is all that's needed to get "icon collapses, calendar opens
 * below on click" without any custom popover logic.
 */
const DateIconButton = forwardRef(({ value, onClick, active, label }, ref) => (
  <button
    type="button"
    ref={ref}
    onClick={onClick}
    className={`hh-icon-trigger${active ? " hh-icon-trigger-active" : ""}`}
    title={value || label}
    aria-label={label}
  >
    <CalendarRange size={14} />
  </button>
));
DateIconButton.displayName = "DateIconButton";

/**
 * ── Dropdown filter ──────────────────────────────────────────────
 * dropdown: { key, visible, value, onChange, options: [{label, value}], placeholder, style, icon }
 *
 * Renders a custom trigger + a portal-rendered options panel instead of a
 * native <select>, since browsers render the native option list with the
 * OS/browser's own popup chrome and ignore border-radius/backdrop-filter
 * on it. The portal lets the panel escape hh-hub's overflow and sit above
 * everything else, positioned against the trigger's live bounding box.
 *
 * `compact` (passed down from HeroHub) swaps the labeled trigger for an
 * icon-only button — same options panel, just a much narrower trigger,
 * so a whole row of dropdowns keeps fitting on narrow screens.
 */
function DropdownFilter({ dropdown, compact }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const options = dropdown.options || [];
  const selected = options.find((o) => o.value === dropdown.value);
  const displayLabel = selected ? selected.label : dropdown.placeholder || "Select";
  const isActive = Boolean(dropdown.value && dropdown.value !== "all");
  const DropIcon = dropdown.icon || ListFilter;

  const openPanel = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 150) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const handleClose = () => setOpen(false);
    const handleKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [open]);

  if (dropdown.visible === false) return null;

  const pick = (value) => {
    dropdown.onChange?.(value);
    setOpen(false);
  };

  const fieldLabel = dropdown.label || "Filter";

  const panel = open &&
    createPortal(
      <div
        className="hh-dropdown-panel"
        ref={panelRef}
        style={{ top: coords.top, left: coords.left, minWidth: coords.width }}
      >
        {dropdown.placeholder && (
          <div
            className={`hh-dropdown-option${dropdown.value === "all" ? " hh-dropdown-option-active" : ""}`}
            onClick={() => pick("all")}
          >
            {dropdown.placeholder}
          </div>
        )}
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`hh-dropdown-option${dropdown.value === opt.value ? " hh-dropdown-option-active" : ""}`}
            onClick={() => pick(opt.value)}
          >
            {opt.label}
          </div>
        ))}
      </div>,
      document.body
    );

  if (compact) {
    return (
      <div className="hh-field hh-field-compact">
        <button
          type="button"
          ref={triggerRef}
          className={`hh-icon-trigger${isActive ? " hh-icon-trigger-active" : ""}`}
          onClick={() => (open ? setOpen(false) : openPanel())}
          title={`${fieldLabel}${selected ? `: ${selected.label}` : ""}`}
          aria-label={fieldLabel}
        >
          <DropIcon size={14} />
        </button>
        {panel}
      </div>
    );
  }

  return (
    <Field label={fieldLabel} className="hh-field-dropdown">
      <div
        className="hh-select-wrap"
        ref={triggerRef}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <div className="hh-select hh-select-trigger" style={dropdown.style}>
          {displayLabel}
        </div>
        <ChevronDown size={13} className="hh-select-icon" />
        {panel}
      </div>
    </Field>
  );
}

/**
 * ── Action button ────────────────────────────────────────────────
 * action: { key, label, icon, onClick, active, disabled }
 * Styled identically to the page-level "Add User"-style button — a
 * pill button that switches to a filled/highlighted look when `active`
 * is true (e.g. while its panel is open).
 */
function ActionButton({ label, icon: Icon, onClick, active, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`hh-action-btn${active ? " hh-action-btn-active" : ""}`}
    >
      {Icon && <Icon size={14} className="hh-action-btn-icon" />}
      <span className="hh-action-btn-label">{label}</span>
    </button>
  );
}

/**
 * ── HeroHub ──────────────────────────────────────────────────────
 * Compact, per-page-configurable filter + stat-pill bar.
 * Always a single row — never wraps and never scrolls. Every field
 * continuously fluid-resizes with the viewport (via CSS clamp()), and
 * below a breakpoint the search, each dropdown, and the date range
 * collapse to icon-only triggers that open their real control in a
 * popover/calendar right below the icon — so the row keeps fitting at
 * any window width instead of overflowing. Renders centered on the page.
 *
 * Every filter field (search, dropdown, date range) shows a small
 * caption above it at all times, and the same text as a native title
 * tooltip on hover — pass `label` on `search`/`datePicker`/each
 * dropdown to customize it (falls back to placeholder/key otherwise).
 *
 * Props:
 * - title: string
 * - subtitle: string
 * - search: { visible, value, onChange, placeholder, style } | undefined
 * - datePicker: { visible, selectsRange, startDate, endDate, onChange, placeholderText, style } | undefined
 * - dropdowns: [{ key, label, visible, value, onChange, options:[{label,value}], placeholder, icon, style }]
 *   `label` is the field's caption/tooltip text (e.g. "Status") and is
 *   required for that purpose — it is NOT derived from `placeholder`,
 *   since placeholder is just the "All ..." option shown inside the
 *   options list, not the field's name. Falls back to "Filter" if omitted.
 *   A "Clear" button appears automatically in the filter row whenever
 *   search, any dropdown, or the date range is non-default; clicking it
 *   resets search to "", every dropdown to "all", and the date range to
 *   empty — no extra prop needed.
 * - statPills: [{ key, icon, label, value, accent, loading, meta }]
 * - actions: [{ key, label, icon, onClick, active, disabled }] — optional,
 *   renders page-level action buttons (e.g. "Add User") inside the hub,
 *   styled like a page's primary action button. Renders nothing if omitted
 *   or empty.
 * - onRefresh: () => void — optional, renders an icon-only refresh button in the far-right corner
 * - refreshing: boolean — optional, spins the refresh icon while true
 */
export default function HeroHub({
  title,
  subtitle,
  search,
  datePicker,
  dropdowns = [],
  statPills = [],
  actions = [],
  onRefresh,
  refreshing = false,
}) {
  const visibleActions = actions.filter((a) => a.visible !== false);

  const visibleDropdowns = dropdowns.filter((d) => d.visible !== false);

  const hasActiveFilters =
    Boolean(search?.value?.trim()) ||
    visibleDropdowns.some((d) => d.value && d.value !== "all") ||
    Boolean(datePicker?.startDate) ||
    Boolean(datePicker?.endDate);

  const handleClearFilters = () => {
    if (search) search.onChange?.("");
    visibleDropdowns.forEach((d) => d.onChange?.("all"));
    if (datePicker) {
      datePicker.onChange?.((datePicker.selectsRange ?? true) ? [null, null] : null);
    }
  };

  const compact = useIsCompact(1280);

  const dateLabel = datePicker?.label || "Date Range";
  const dateActive = Boolean(datePicker?.startDate) || Boolean(datePicker?.endDate);

  return (
    <div className="hh-wrap">
      <div className="hh-hub">
        {/* title / subtitle */}
        {(title || subtitle) && (
          <>
            <div className="hh-title-col">
              {title && <div className="hh-title">{title}</div>}
              {subtitle && <div className="hh-subtitle">{subtitle}</div>}
            </div>
            <div className="hh-divider" />
          </>
        )}

        {/* filters */}
        <div className="hh-filter-row">
          {search && search.visible !== false && (
            <SearchField search={search} compact={compact} />
          )}

          {dropdowns
            .filter((d) => d.visible !== false)
            .map((d) => (
              <DropdownFilter key={d.key} dropdown={d} compact={compact} />
            ))}

          {datePicker && datePicker.visible !== false && (
            compact ? (
              <div className="hh-field hh-field-compact">
                <DatePicker
                  selectsRange={datePicker.selectsRange ?? true}
                  startDate={datePicker.startDate}
                  endDate={datePicker.endDate}
                  onChange={datePicker.onChange}
                  isClearable
                  placeholderText={datePicker.placeholderText || "Date range"}
                  dateFormat={datePicker.dateFormat || "dd MMM yyyy"}
                  customInput={<DateIconButton active={dateActive} label={dateLabel} />}
                  portalId="hh-datepicker-portal"
                  popperClassName="hh-datepicker-popper"
                  popperPlacement="bottom-start"
                />
              </div>
            ) : (
              <Field label={dateLabel} className="hh-field-date">
                <div className="hh-date-wrap">
                  <CalendarRange size={13} className="hh-field-icon" />
                  <DatePicker
                    selectsRange={datePicker.selectsRange ?? true}
                    startDate={datePicker.startDate}
                    endDate={datePicker.endDate}
                    onChange={datePicker.onChange}
                    isClearable
                    placeholderText={datePicker.placeholderText || "Date range"}
                    dateFormat={datePicker.dateFormat || "dd MMM yyyy"}
                    customInput={<input className="hh-input hh-date-input" style={datePicker.style} />}
                    portalId="hh-datepicker-portal"
                    popperClassName="hh-datepicker-popper"
                    popperPlacement="bottom-start"
                  />
                </div>
              </Field>
            )
          )}

          {hasActiveFilters && (
            <button
              type="button"
              className="hh-clear-btn"
              onClick={handleClearFilters}
              title="Clear filters"
              aria-label="Clear filters"
            >
              <X size={12} />
              <span className="hh-clear-btn-label">Clear</span>
            </button>
          )}
        </div>

        {/* divider */}
        <div className="hh-divider" />

        {/* stat pills */}
        <div className="hh-pills-row">
          {statPills.map((p) => (
            <StatPill key={p.key} icon={p.icon} label={p.label} value={p.value} accent={p.accent} loading={p.loading} meta={p.meta} compact={compact} />
          ))}
        </div>

        {/* right-corner group — actions + refresh, pinned to the far right
            via margin-left: auto while everything else stays left-aligned */}
        {(visibleActions.length > 0 || onRefresh) && (
          <div className="hh-right-group">
            {visibleActions.length > 0 && (
              <>
                <div className="hh-divider" />
                <div className="hh-actions-row">
                  {visibleActions.map((a) => (
                    <ActionButton
                      key={a.key}
                      label={a.label}
                      icon={a.icon}
                      onClick={a.onClick}
                      active={a.active}
                      disabled={a.disabled}
                    />
                  ))}
                </div>
              </>
            )}

            {onRefresh && (
              <>
                <div className="hh-divider" />
                <button
                  type="button"
                  className="hh-refresh-btn"
                  onClick={onRefresh}
                  disabled={refreshing}
                  title="Refresh"
                  aria-label="Refresh"
                >
                  <RefreshCw size={14} className={refreshing ? "hh-spin" : ""} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}