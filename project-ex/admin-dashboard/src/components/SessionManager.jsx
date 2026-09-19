import { useEffect, useRef, useState, useCallback } from "react";
import API from "../api/client";

const JWT_LIFETIME_MS = 10 * 60 * 1000;   // must match ACCESS_TOKEN_EXPIRE_MINUTES
const WARNING_LEAD_MS = 60 * 1000;        // show warning 60s before expiry
const ACTIVITY_REFRESH_THROTTLE_MS = 60 * 1000; // min gap between silent refreshes

export default function SessionManager() {
  const [warning, setWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const warnTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const lastActivityRefreshRef = useRef(0);
  const warningRef = useRef(false); // mirrors `warning` for use inside stable listeners

  const doLogout = useCallback(() => {
    localStorage.clear();
    window.location.reload();
  }, []);

  const clearTimers = () => {
    clearTimeout(warnTimerRef.current);
    clearInterval(countdownIntervalRef.current);
  };

  const scheduleWarning = useCallback(() => {
    clearTimers();
    warnTimerRef.current = setTimeout(() => {
      warningRef.current = true;
      setWarning(true);
      setCountdown(60);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownIntervalRef.current);
            doLogout();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }, JWT_LIFETIME_MS - WARNING_LEAD_MS);
  }, [doLogout]);

  const refreshSession = useCallback(async () => {
    try {
      const res = await API.post("/auth/refresh");
      localStorage.setItem("token", res.data.access_token);
      warningRef.current = false;
      setWarning(false);
      scheduleWarning();
    } catch (e) {
      doLogout();
    }
  }, [scheduleWarning, doLogout]);

  const handleActivity = useCallback(() => {
    if (warningRef.current) return; // during warning, only the explicit click counts
    const now = Date.now();
    if (now - lastActivityRefreshRef.current > ACTIVITY_REFRESH_THROTTLE_MS) {
      lastActivityRefreshRef.current = now;
      refreshSession();
    }
  }, [refreshSession]);

  useEffect(() => {
    scheduleWarning();
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    return () => {
      clearTimers();
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!warning) return null;

  return (
    <div
      onClick={refreshSession}
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
      <div
        style={{
          padding: "32px 44px",
          textAlign: "center",
        }}
      >
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