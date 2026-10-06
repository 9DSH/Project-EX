import { useEffect, useState } from "react";

export const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

export const fmt = (value, digits = 6) =>
  value != null
    ? Number(value).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits })
    : "—";

export const fmtDate = (value) => (value ? new Date(value).toLocaleString() : "—");

export const shortAddress = (value) => {
  if (!value) return "—";
  if (String(value).length <= 18) return value;
  return `${String(value).slice(0, 8)}...${String(value).slice(-8)}`;
};

export function showToast(msg, ok = true) {
  const narrow = typeof window !== "undefined" && window.innerWidth <= 640;
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed", bottom: "24px", right: narrow ? "12px" : "24px",
    left: narrow ? "12px" : "auto", maxWidth: narrow ? "none" : "420px",
    zIndex: 200000, padding: "12px 20px", borderRadius: "12px", fontWeight: 600,
    fontSize: "13px", color: "white", pointerEvents: "none", textAlign: narrow ? "center" : "left",
    background: ok ? "#16a34a" : "#dc2626",
    boxShadow: ok ? "0 8px 32px rgba(22,163,74,.35)" : "0 8px 32px rgba(220,38,38,.35)",
    transform: "translateY(8px)", opacity: 0, transition: "all .25s ease",
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = 1; el.style.transform = "translateY(0)"; });
  setTimeout(() => {
    el.style.opacity = 0; el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

export function useMediaQuery(query) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [query]);
  return matches;
}

/** Same breakpoint the CSS uses for bottom sheets. */
export const useIsMobile = () => useMediaQuery("(max-width: 640px)");

export function useBodyLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}