import { useEffect, useRef, useState, useCallback } from "react";
import API from "../api/client";

const IDLE_LOCK_MS = 10 * 60 * 1000;             // total idle time before lock/logout
const WARNING_LEAD_MS = 60 * 1000;                // show warning this long before lock
const TOKEN_REFRESH_INTERVAL_MS = 60 * 1000;      // slide the JWT this often while active

export default function SessionManager() {
  const [warning, setWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const lastActivityRef = useRef(Date.now());
  const lastRefreshRef = useRef(0); // 0 forces an immediate refresh on first tick
  const loggingOutRef = useRef(false);

  const doLogout = useCallback(() => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    localStorage.clear();
    window.location.href = "/";
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const res = await API.post("/auth/refresh");
      if (res?.data?.access_token) {
        localStorage.setItem("token", res.data.access_token);
      } else {
        console.warn("Session refresh returned no token, forcing logout");
        doLogout();
      }
    } catch (e) {
      console.error("Session refresh failed:", e?.response?.status, e?.response?.data || e.message);
      doLogout();
    }
  }, [doLogout]);

  const registerActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setWarning(false);
  }, []);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];
    events.forEach((evt) => window.addEventListener(evt, registerActivity, { passive: true }));

    // Single source of truth: every second, decide both "should we
    // silently refresh the token" and "should we warn / lock". Not
    // dependent on activity-event timing beyond reading the timestamp.
    const tick = setInterval(() => {
      const now = Date.now();
      const idleFor = now - lastActivityRef.current;
      const remaining = IDLE_LOCK_MS - idleFor;

      // Keep the real JWT alive on a fixed schedule as long as the user
      // is inside the "not idle yet" window — independent of exactly
      // which DOM event last fired.
      const stillActive = idleFor < IDLE_LOCK_MS - WARNING_LEAD_MS;
      const dueForRefresh = now - lastRefreshRef.current > TOKEN_REFRESH_INTERVAL_MS;
      if (stillActive && dueForRefresh) {
        lastRefreshRef.current = now;
        refreshToken();
      }

      if (remaining <= 0) {
        doLogout();
        return;
      }

      if (remaining <= WARNING_LEAD_MS) {
        setWarning(true);
        setCountdown(Math.max(1, Math.ceil(remaining / 1000)));
      } else {
        setWarning(false);
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, registerActivity));
      clearInterval(tick);
    };
  }, [registerActivity, refreshToken, doLogout]);

  const handleStayLoggedIn = () => {
    registerActivity();
    lastRefreshRef.current = Date.now();
    refreshToken();
  };

  if (!warning) return null;

  return (
    <div
      onClick={handleStayLoggedIn}
      onMouseMove={handleStayLoggedIn}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        background: "rgba(2,6,23,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <div style={{ padding: "32px 44px", textAlign: "center" }}>
        <div style={{ fontSize: 42, fontWeight: 700, color: "#ef4444", marginBottom: 12 }}>
          {countdown}
        </div>
        <div style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 700 }}>
          You'll be logged out in {countdown} seconds
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>
          Click anywhere to stay logged in
        </div>
      </div>
    </div>
  );
}