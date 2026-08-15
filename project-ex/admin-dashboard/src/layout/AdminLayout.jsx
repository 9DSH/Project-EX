import Menu from "./Menu";

export default function AdminLayout({ children }) {
  return (
    <div style={{
      display: "flex",
      width: "100%",
      height: "100vh",
      overflow: "hidden"
    }}>
      
      <Menu />

      {/* CRITICAL FIX: minHeight: 0 */}
      <div style={{
        flex: 1,
        background: "#020617",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,   // 🔥 THIS FIXES CLIPPING
        overflow: "hidden"
      }}>
        {children}
      </div>

    </div>
  );
}