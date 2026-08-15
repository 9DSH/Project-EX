// src/components/PermissionGate.jsx
import React from "react";

export default function PermissionGate({
  allowed,
  children,
  message = "NO PERMISSION",
}) {
  return (
    <div style={{ position: "relative" }}>
      {/* CONTENT */}
      <div
        style={{
          filter: allowed ? "none" : "blur(1.5px) grayscale(0.4)",
          opacity: allowed ? 1 : 0.5,
          pointerEvents: allowed ? "auto" : "none",
          transition: "0.2s",
        }}
      >
        {children}
      </div>

      {/* OVERLAY */}
      {!allowed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            letterSpacing: 2,
            fontSize: 12,
            color: "#ffffffa3",
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(1px)",
            borderRadius: 10,
            pointerEvents: "none",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}