import { useEffect, useLayoutEffect, useCallback, useRef, useState, forwardRef } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, CalendarRange, RefreshCw, X, ListFilter } from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";
import DatePicker from "react-datepicker";
import "./HeroHub.css";

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
      {loading ? (
        <Sk w={22} h={12} />
      ) : (
        <span className="hh-pill-compact-value" style={{ color: accent }}>
          {value ?? "—"}
        </span>
      )}

      {hovered &&
        createPortal(
          <div
            className="hh-pill-tooltip"
            style={{ top: coords.top, left: coords.left }}
          >
            <div className="hh-pill-tooltip-label">
              {Icon && <Icon size={12} style={{ color: accent, marginRight: 5, verticalAlign: -2 }} />}
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
  const visibleStatPills = statPills; // all pills participate in fitting; none are filtered out

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

  const dateLabel = datePicker?.label || "Date Range";
  const dateActive = Boolean(datePicker?.startDate) || Boolean(datePicker?.endDate);
  const searchLabel = search?.label || "Search";

  const showSearch = Boolean(search && search.visible !== false);
  const showDate = Boolean(datePicker && datePicker.visible !== false);

  /**
   * ── Dynamic fit algorithm ──────────────────────────────────────
   * The hub always fills the space it has. On every resize we measure
   * how much room is actually available and how much room every field
   * would need in its full (uncompacted) form, using hidden same-CSS
   * clones so the measurement is pixel-accurate without ever flashing
   * the wrong state on screen.
   *
   * Priority order when things don't fit (compact one at a time):
   *   1. date range → icon-only
   *   2. search → icon-only
   *   3. stat pills, one by one starting from the last pill → value-only
   *   4. once every pill is already value-only, keep going: hide pills
   *      entirely one by one, still starting from the last pill
   * Everything renders in its full form again as soon as there's space.
   */
  const [dateCompact, setDateCompact] = useState(false);
  const [searchCompact, setSearchCompact] = useState(false);
  const [compactPillCount, setCompactPillCount] = useState(0);
  const [hiddenPillCount, setHiddenPillCount] = useState(0);

  const hubRef = useRef(null);
  const titleColRef = useRef(null);
  const titleDividerRef = useRef(null);
  const clearBtnRef = useRef(null);
  const pillsDividerRef = useRef(null);
  const rightGroupRef = useRef(null);
  const dropdownRefs = useRef({});
  const searchFullMeasureRef = useRef(null);
  const searchCompactMeasureRef = useRef(null);
  const dateFullMeasureRef = useRef(null);
  const dateCompactMeasureRef = useRef(null);
  const pillFullMeasureRefs = useRef({});
  const pillCompactMeasureRefs = useRef({});

  const recalc = useCallback(() => {
    const hub = hubRef.current;
    if (!hub) return;

    const hubStyles = getComputedStyle(hub);
    const paddingX = parseFloat(hubStyles.paddingLeft || 0) + parseFloat(hubStyles.paddingRight || 0);
    const available = hub.clientWidth - paddingX;
    const gapPx = parseFloat(hubStyles.columnGap || hubStyles.gap || 0) || 8;

    // Parts of the row that never change shape — measured directly off
    // the real (already-rendered) elements.
    const titleW = (titleColRef.current?.offsetWidth || 0) + (titleDividerRef.current?.offsetWidth || 0);
    const dropdownsW = Object.values(dropdownRefs.current).reduce((sum, el) => sum + (el?.offsetWidth || 0), 0);
    const clearW = clearBtnRef.current?.offsetWidth || 0;
    const pillsDividerW = pillsDividerRef.current?.offsetWidth || 0;
    const rightGroupW = rightGroupRef.current?.offsetWidth || 0;

    // Rough allowance for the row/segment gaps that sit between all of
    // the pieces above — not exact, but errs toward compacting a touch
    // early rather than overflowing.
    const segmentCount =
      (title || subtitle ? 2 : 0) + 1 + visibleDropdowns.length + (showDate ? 1 : 0) + (showSearch ? 1 : 0) + 2;
    const gapBuffer = gapPx * segmentCount;

    const fixedTotal = titleW + dropdownsW + clearW + pillsDividerW + rightGroupW + gapBuffer;

    const searchFullW = showSearch ? searchFullMeasureRef.current?.offsetWidth || 0 : 0;
    const searchCompactW = showSearch ? searchCompactMeasureRef.current?.offsetWidth || 0 : 0;
    const dateFullW = showDate ? dateFullMeasureRef.current?.offsetWidth || 0 : 0;
    const dateCompactW = showDate ? dateCompactMeasureRef.current?.offsetWidth || 0 : 0;

    const pillFullWidths = visibleStatPills.map((p) => pillFullMeasureRefs.current[p.key]?.offsetWidth || 0);
    const pillCompactWidths = visibleStatPills.map((p) => pillCompactMeasureRefs.current[p.key]?.offsetWidth || 0);
    const n = visibleStatPills.length;

    // Steps 0-1 handle the date range and search. Steps 2..(2+n) compact
    // pills one by one, from the last pill inward. Once every pill is
    // already value-only, steps (2+n)..(2+2n) keep going by hiding those
    // same pills entirely, still starting from the last one.
    const maxStep = 2 + 2 * n;

    for (let step = 0; step <= maxStep; step++) {
      const dateC = showDate && step >= 1;
      const searchC = showSearch && step >= 2;

      const touchedFromEnd = Math.min(Math.max(0, step - 2), n);
      const hiddenCount = Math.min(Math.max(0, step - 2 - n), n);
      const compactVisibleCount = touchedFromEnd - hiddenCount;

      const dateW = showDate ? (dateC ? dateCompactW : dateFullW) : 0;
      const searchW = showSearch ? (searchC ? searchCompactW : searchFullW) : 0;
      const pillsW = pillFullWidths.reduce((sum, w, i) => {
        const positionFromEnd = n - 1 - i;
        if (positionFromEnd < hiddenCount) return sum; // hidden entirely
        if (positionFromEnd < hiddenCount + compactVisibleCount) return sum + pillCompactWidths[i];
        return sum + w;
      }, 0);

      const total = fixedTotal + dateW + searchW + pillsW;

      if (total <= available || step === maxStep) {
        setDateCompact(dateC);
        setSearchCompact(searchC);
        setCompactPillCount(compactVisibleCount);
        setHiddenPillCount(hiddenCount);
        break;
      }
    }
  }, [title, subtitle, showSearch, showDate, visibleDropdowns.length, visibleStatPills]);

  useLayoutEffect(() => {
    recalc();
    const hub = hubRef.current;
    if (!hub || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => recalc());
    ro.observe(hub);
    window.addEventListener("resize", recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [recalc]);

  return (
    <div className="hh-wrap">
      <div className="hh-hub" ref={hubRef}>
        {/* title / subtitle */}
        {(title || subtitle) && (
          <>
            <div className="hh-title-col" ref={titleColRef}>
              {title && <div className="hh-title">{title}</div>}
              {subtitle && <div className="hh-subtitle">{subtitle}</div>}
            </div>
            <div className="hh-divider hh-divider-title" ref={titleDividerRef} />
          </>
        )}

        {/* filters */}
        <div className="hh-filter-row">
          {showSearch && <SearchField search={search} compact={searchCompact} />}

          {visibleDropdowns.map((d) => (
            // Dropdowns always render in their normal, labeled form — only
            // search, the date range, and stat pills take part in compaction.
            <div key={d.key} ref={(el) => (dropdownRefs.current[d.key] = el)}>
              <DropdownFilter dropdown={d} compact={false} />
            </div>
          ))}

          {showDate &&
            (dateCompact ? (
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
            ))}

          {hasActiveFilters && (
            <button
              type="button"
              ref={clearBtnRef}
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
        <div className="hh-divider hh-divider-pills" ref={pillsDividerRef} />

        {/* stat pills */}
        <div className="hh-pills-row">
          {visibleStatPills.map((p, idx) => {
            const positionFromEnd = visibleStatPills.length - 1 - idx;
            if (positionFromEnd < hiddenPillCount) return null; // no room — dropped entirely
            const isCompact = positionFromEnd < hiddenPillCount + compactPillCount;
            return (
              <StatPill
                key={p.key}
                icon={p.icon}
                label={p.label}
                value={p.value}
                accent={p.accent}
                loading={p.loading}
                meta={p.meta}
                compact={isCompact}
              />
            );
          })}
        </div>

        {/* right-corner group — actions + refresh, pinned to the far right
            via margin-left: auto while everything else stays left-aligned */}
        {(visibleActions.length > 0 || onRefresh) && (
          <div className="hh-right-group" ref={rightGroupRef}>
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

        {/* ── Hidden measurement clones ──────────────────────────────
            Same classes/content as the real fields in both their full
            and compact forms, rendered off-screen (visibility: hidden,
            position: fixed) purely so recalc() can read accurate
            offsetWidths for states that aren't currently on screen.
            Never interactive, never visible, never affects layout. */}
        <div
          aria-hidden="true"
          style={{ position: "fixed", top: -9999, left: -9999, visibility: "hidden", pointerEvents: "none", display: "flex" }}
        >
          {showSearch && (
            <div className="hh-field hh-field-search" ref={searchFullMeasureRef}>
              <div className="hh-field-label">{searchLabel}</div>
              <div className="hh-search-wrap">
                <Search size={13} className="hh-field-icon" />
                <input className="hh-input" readOnly value={search.value || ""} placeholder={search.placeholder || "Search..."} />
              </div>
            </div>
          )}
          {showSearch && (
            <div className="hh-field hh-field-compact" ref={searchCompactMeasureRef}>
              <div className="hh-icon-trigger">
                <Search size={14} />
              </div>
            </div>
          )}

          {showDate && (
            <div className="hh-field hh-field-date" ref={dateFullMeasureRef}>
              <div className="hh-field-label">{dateLabel}</div>
              <div className="hh-date-wrap">
                <CalendarRange size={13} className="hh-field-icon" />
                <input
                  className="hh-input hh-date-input"
                  readOnly
                  value={dateActive ? "01 Jan 2024 - 01 Feb 2024" : ""}
                  placeholder={datePicker.placeholderText || "Date range"}
                />
              </div>
            </div>
          )}
          {showDate && (
            <div className="hh-field hh-field-compact" ref={dateCompactMeasureRef}>
              <div className="hh-icon-trigger">
                <CalendarRange size={14} />
              </div>
            </div>
          )}

          {visibleStatPills.map((p) => (
            <div key={p.key} style={{ display: "flex" }}>
              <div className="hh-pill" ref={(el) => (pillFullMeasureRefs.current[p.key] = el)}>
                {p.icon && (
                  <div className="hh-pill-icon">
                    <p.icon size={14} />
                  </div>
                )}
                <div className="hh-pill-text">
                  <div className="hh-pill-label">
                    {p.label}
                    {p.meta && <span className="hh-pill-meta"> - {p.meta}</span>}
                  </div>
                  <div className="hh-pill-value">{p.loading ? "…" : p.value ?? "—"}</div>
                </div>
              </div>
              <div className="hh-pill-compact" ref={(el) => (pillCompactMeasureRefs.current[p.key] = el)}>
                <span className="hh-pill-compact-value">{p.loading ? "…" : p.value ?? "—"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}