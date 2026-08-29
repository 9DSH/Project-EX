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
  Landmark,
  Shield,
} from "lucide-react";
import { TOPBAR_HEIGHT, COLLAPSED_WIDTH, EXPANDED_WIDTH } from "./AdminLayout";

export default function Menu({ pinned, setPinned }) {
  const location = useLocation();
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState({ products: false });

  const expanded = pinned || hovered;
  const width = expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
  const floating = !pinned && hovered;

  const toggle = (key) =>
    setOpen((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  const isActive = (path) => location.pathname === path;
  const isGroupActive = (paths) => paths.some((p) => location.pathname === p);
  const user = { role: localStorage.getItem("role") || "user" };

  const linkStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: expanded ? 12 : 0, 
    padding: expanded ? "10px 12px" : "10px 0",
    justifyContent: expanded ? "flex-start" : "center",
    borderRadius: 9,
    textDecoration: "none",
    color: active ? "white" : "#94a3b8",
    background: active ? "rgba(59,130,246,.16)" : "transparent",
    fontWeight: active ? 600 : 500,
    fontSize: 13,
    whiteSpace: "nowrap",
    overflow: "hidden",
    transition: "background .15s, color .15s",
  });

  const sectionTitleWrap = {
    position: "relative",
    height: 20,
    margin: "16px 0 6px",
  };

  const sectionTitle = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: "#3b4a68",
    padding: expanded ? "0 12px" : 0,
    textAlign: expanded ? "left" : "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    opacity: expanded ? 1 : 0,
    transition: "opacity .15s",
    lineHeight: "20px",
  };

  const sectionDivider = {
    position: "absolute",
    top: "50%",
    left: 10,
    right: 10,
    height: 1,
    transform: "translateY(-50%)",
    background: "#1a2333",
    opacity: expanded ? 0 : 1,
    transition: "opacity .15s",
  };

  const submenu = (isOpen) => ({
    display: "flex",
    flexDirection: "column",
    gap: 2,
    paddingLeft: expanded ? 14 : 0,
    overflow: "hidden",
    maxHeight: isOpen ? 200 : 0,
    opacity: isOpen ? 1 : 0,
    transition: "max-height .25s cubic-bezier(.4,0,.2,1), opacity .2s ease",
  });

  const label = (text) => {
    if (!expanded) return null;     
    return (
      <span
        style={{
          opacity: 1,
          maxWidth: 200,
          overflow: "hidden",
          whiteSpace: "nowrap",
          transition: "opacity .15s, max-width .2s",
        }}
      >
        {text}
      </span>
    );
  };

  const arrow = (openState) => {
    if (!expanded) return null;      
    return (
      <ChevronDown
        size={13}
        style={{
          marginLeft: "auto",
          flexShrink: 0,
          transform: openState ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s",
        }}
      />
    );
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        top: TOPBAR_HEIGHT,
        left: 0,
        bottom: 0,
        width,
        background: "#0b1220",
        borderRight: "1px solid #1a2333",
        display: "flex",
        flexDirection: "column",
        padding: expanded ? "14px 10px" : "14px 6px",
        boxSizing: "border-box",
        overflowX: "hidden",
        overflowY: "auto",
        transition: "width .25s cubic-bezier(.4,0,.2,1), padding .25s",
        zIndex: floating ? 6 : 2,
        boxShadow: floating ? "8px 0 30px rgba(0,0,0,.55)" : "none",
      }}
    >
      <Link to="/" style={linkStyle(isActive("/"))} title="Overview">
        <LayoutDashboard size={17} style={{ flexShrink: 0 }} />
        {label("Overview")}
      </Link>

      <Link to="/telegram_management" style={linkStyle(isActive("/telegram_management"))} title="Telegram Management">
        <Shield size={17} style={{ flexShrink: 0 }} />
        {label("Telegram Management")}
      </Link>

      <Link to="/users" style={linkStyle(isActive("/users"))} title="Users">
        <Users size={17} style={{ flexShrink: 0 }} />
        {label("Users")}
      </Link>

    <div style={sectionTitleWrap}>
      <div style={sectionTitle}>SERVICES</div>
      <div style={sectionDivider} />
    </div>
      {hasPermission(user, "products.view") && (
        <div>
          <div
            onClick={() => expanded && toggle("products")}
            style={{ ...linkStyle(!expanded && isGroupActive(["/ProductsManagement", "/OrdersManagement"])), cursor: "pointer" }}
            title="Products"
          >
            <Package size={17} style={{ flexShrink: 0 }} />
            {label("Products")}
            {arrow(open.products)}
          </div>
          <div style={submenu(expanded && open.products)}>
            {hasPermission(user, "products.manage") && (
              <Link to="/ProductsManagement" style={linkStyle(isActive("/ProductsManagement"))}>
                <Boxes size={14} style={{ flexShrink: 0 }} />
                {label("Product Management")}
              </Link>
            )}
            {hasPermission(user, "orders.view") && (
              <Link to="/OrdersManagement" style={linkStyle(isActive("/OrdersManagement"))}>
                <ShoppingCart size={14} style={{ flexShrink: 0 }} />
                {label("Orders & Analysis")}
              </Link>
            )}
          </div>
        </div>
      )}

      {hasPermission(user, "exchange.view") && hasPermission(user, "exchange.manage") && (
        <Link to="/exchange_dashboard" style={linkStyle(isActive("/exchange_dashboard"))} title="Exchange">
          <ArrowLeftRight size={17} style={{ flexShrink: 0 }} />
          {label("Exchange")}
        </Link>
      )}

      {hasPermission(user, "wire_transfer.view") && hasPermission(user, "wire_transfer.manage") && (
        <Link to="/wire_transfer" style={linkStyle(isActive("/wire_transfer"))} title="Wire Transfer">
          <Landmark size={17} style={{ flexShrink: 0 }} />
          {label("Wire Transfer")}
        </Link>
      )}

        <div style={sectionTitleWrap}>
          <div style={sectionTitle}>FINANCE</div>
          <div style={sectionDivider} />
        </div>
      {hasPermission(user, "finance.assets") && (
        <Link to="/asset_manager" style={linkStyle(isActive("/asset_manager"))} title="Asset Management">
          <Wallet size={17} style={{ flexShrink: 0 }} />
          {label("Asset Management")}
        </Link>
      )}

      <Link to="/transactions" style={linkStyle(isActive("/transactions"))} title="Transactions">
        <CreditCard size={17} style={{ flexShrink: 0 }} />
        {label("Transactions")}
      </Link>

      {hasPermission(user, "finance.withdraw") && (
        <Link to="/withdraws" style={linkStyle(isActive("/withdraws"))} title="Withdrawals">
          <Wallet size={17} style={{ flexShrink: 0 }} />
          {label("Withdrawals")}
        </Link>
      )}

      <div style={sectionTitleWrap}>
        <div style={sectionTitle}>COMMUNICATION</div>
        <div style={sectionDivider} />
      </div>
      <Link to="/messages" style={linkStyle(isActive("/messages"))} title="Messages">
        <MessageSquare size={17} style={{ flexShrink: 0 }} />
        {label("Messages")}
      </Link>
    </div>
  );
}