import { useState, useEffect } from "react";
import Menu from "./Menu";
import TopBar from "./TopBar";
import SessionManager from "../components/SessionManager";

export const TOPBAR_HEIGHT = 48;
export const COLLAPSED_WIDTH = 54;
export const EXPANDED_WIDTH = 250;
export const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_BREAKPOINT : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile;
}

export default function AdminLayout({ children }) {
  const [pinned, setPinned] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  // Auto-close the mobile overlay if the viewport grows back to desktop size
  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  // On mobile the sidebar is an overlay, so content never gets pushed over
  const contentOffset = isMobile ? 0 : pinned ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  const handleToggleMenu = () => {
    if (isMobile) {
      setMobileMenuOpen((open) => !open);
    } else {
      setPinned((p) => !p);
    }
  };

  return (
    <div style={{ width: "100%", height: "100vh", overflow: "hidden", background: "#020617" }}>
      <TopBar
        pinned={pinned}
        isMobile={isMobile}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMenu={handleToggleMenu}
      />

      <Menu
        pinned={pinned}
        setPinned={setPinned}
        isMobile={isMobile}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

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