import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { hasPermission } from "../utils/permissions";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  ArrowLeftRight,
  Boxes,
  CreditCard,
  Wallet,
  MessageSquare,
  ChevronDown,
  LogOut,
  Landmark,
  Shield,
} from "lucide-react";


export default function Menu() {
  const token = localStorage.getItem("token");
  const location = useLocation();

  const [open, setOpen] = useState({
    products: false,
    exchange: false,
    wire_transfer: false,
  });

  const toggle = (key) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    localStorage.removeItem("access_points");
    window.location.reload();
  };

  const isActive = (path) => location.pathname === path;

  const linkStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    textDecoration: "none",
    color: active ? "white" : "#94a3b8",
    background: active ? "#1d4fd871" : "transparent",
    fontWeight: active ? 500 : 400,
  });

  const sectionTitle = {
    fontSize: 11,
    color: "#64748b",
    marginTop: 14,
    marginBottom: 6,
    letterSpacing: 1,
  };

  const submenu = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    paddingLeft: 14,
  };

  const arrow = (openState) => ({
    marginLeft: "auto",
    transform: openState ? "rotate(180deg)" : "rotate(0deg)",
    transition: "0.2s",
  });

  // =========================
  // USER INFO (FIXED)
  // =========================
  const rawUsername = localStorage.getItem("username") || "user";
  const role = localStorage.getItem("role") || "user";

  const username =
    rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1);

  const roleLabel = {
    master: "Master Admin",
    admin: "Administrator",
    user: "User",
  }[role] || role;

  const user = { role };

  return (
    <div
      style={{
        width: 250,
        height: "100vh",
        background: "#0b1220",
        borderRight: "1px solid #1f2937",
        padding: 16,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Project EX</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Admin Console
        </div>
      </div>

      {/* OVERVIEW */}
      <Link to="/" style={linkStyle(isActive("/"))}>
        <LayoutDashboard size={16} />
        Overview
      </Link>

            {/* PROFILE */}
        <Link to="/admin_profile" style={linkStyle(isActive("/admin_profile"))}>
          <Shield size={16} />
          Admin Profile
        </Link>


      {/* USERS */}
      <Link to="/users" style={linkStyle(isActive("/users"))}>
        <Users size={16} />
        Users
      </Link>

      {/* SERVICES */}
      <div style={sectionTitle}>SERVICES</div>

      {/* PRODUCTS */}
      {hasPermission(user, "products.view") && (
      <div>
        <div
          onClick={() => toggle("products")}
          style={{
            ...linkStyle(false),
            cursor: "pointer",
          }}
        >
          <Package size={16} />
          Products
          <ChevronDown size={14} style={arrow(open.products)} />
        </div>

        {open.products && (
          <div style={submenu}>
            {hasPermission(user, "products.manage") && (
            <Link
              to="/ProductsManagement"
              style={linkStyle(isActive("/ProductsManagement"))}
            >
              <Boxes size={14} />
              Product Management
            </Link>
            )}

            {hasPermission(user, "orders.view") && (

            <Link
              to="/OrdersManagement"
              style={linkStyle(isActive("/OrdersManagement"))}
            >
              <ShoppingCart size={14} />
              Orders & Analysis
            </Link>
              )}
          </div>
        )}
      </div>
      )}

      {/* EXCHANGE */}
      {hasPermission(user, "exchange.view") && (
      <div>
        <div
          onClick={() => toggle("exchange")}
          style={{
            ...linkStyle(false),
            cursor: "pointer",
          }}
        >
          <ArrowLeftRight size={16} />
          Exchange
          <ChevronDown size={14} style={arrow(open.exchange)} />
        </div>

        {open.exchange && (
          <div style={submenu}>
            {hasPermission(user, "exchange.manage") && (
            <Link
              to="/exchange_dashboard"
              style={linkStyle(isActive("/exchange_dashboard"))}
            >
              <ArrowLeftRight size={14} />
              Exchange Management
            </Link>
             )}
          </div>
           
        )}
      </div>

      )}

      {/* WIRE TRANSFER */}
      {hasPermission(user, "wire_transfer.view") && (
      <div>
        <div
          onClick={() => toggle("wire_transfer")}
          style={{ ...linkStyle(false), cursor: "pointer" }}
        >
          <Landmark size={16} />
          Wire Transfer
          <ChevronDown size={14} style={arrow(open.wire_transfer)} />
        </div>

        {open.wire_transfer && (
          <div style={submenu}>
            {hasPermission(user, "wire_transfer.manage") && (
            <Link
              to="/wire_transfer"
              style={linkStyle(isActive("/wire_transfer"))}
            >
              <Landmark size={14} />
              Transfer Management
            </Link>
            )}
          </div>
        )}
      </div>
      )}



      {/* FINANCE */}
      <div style={sectionTitle}>FINANCE</div>
     {hasPermission(user, "finance.assets") && (
      <Link to="/asset_manager" style={linkStyle(isActive("/asset_manager"))}>
        <Wallet size={16} />
        Asset Management
      </Link>
     )}

      <Link to="/transactions" style={linkStyle(isActive("/transactions"))}>
        <CreditCard size={16} />
        Transactions
      </Link>

       {hasPermission(user, "finance.withdraw") && (

      <Link to="/withdraws" style={linkStyle(isActive("/withdraws"))}>
        <Wallet size={16} />
        Withdrawals
      </Link>
       )}

      {/* COMMUNICATION */}
      <div style={sectionTitle}>COMMUNICATION</div>

      <Link to="/messages" style={linkStyle(isActive("/messages"))}>
        <MessageSquare size={16} />
        Messages
      </Link>

      {/* FOOTER */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 14,
          borderTop: "1px solid #1f2937",
        }}
      >
        {/* USER INFO */}
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>
            {username}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              letterSpacing: 1.2,
              marginTop: 3,
              textTransform: "capitalize",
            }}
          >
            {roleLabel}
          </div>
        </div>

        {/* LOGOUT */}
        {token ? (
          <button
            onClick={logout}
            style={{
              background: "#62626246",
              border: "1px solid #1f2937",
              color: "#94a3b8",
              width: 36,
              height: 36,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.1)";
              e.currentTarget.style.color = "#ef4444";
              e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#94a3b8";
              e.currentTarget.style.borderColor = "#1f2937";
            }}
          >
            <LogOut size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}