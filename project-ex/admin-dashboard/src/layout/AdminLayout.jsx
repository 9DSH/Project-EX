import { useState } from "react";
import Menu from "./Menu";
import TopBar from "./TopBar";
import SessionManager from "../components/SessionManager";


export const TOPBAR_HEIGHT = 48;
export const COLLAPSED_WIDTH = 54;
export const EXPANDED_WIDTH = 250;

export default function AdminLayout({ children }) {
  const [pinned, setPinned] = useState(false);
  const contentOffset = pinned ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <div style={{ width: "100%", height: "100vh", overflow: "hidden", background: "#020617" }}>
      <TopBar pinned={pinned} onToggleMenu={() => setPinned((p) => !p)} />

      <Menu pinned={pinned} setPinned={setPinned} />

      <div
        style={{
          position: "fixed",
          top: TOPBAR_HEIGHT,
          left: contentOffset,
          right: 0,
          bottom: 0,
          background: "#020617",
          display: "flex",
          flexDirection: "column",
          transition: "left .25s cubic-bezier(.4,0,.2,1)",
          overflow: "hidden",
          zIndex: 1,
        }}
      >
        <div style={{ flex: 1, padding: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          {children}
        </div>
      </div>

      <SessionManager />

    </div>
  );
}