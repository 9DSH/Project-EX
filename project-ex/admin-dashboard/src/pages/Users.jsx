import { useEffect, useMemo, useState } from "react";
import UserSidebar from "../components/UserSidebar";
import ACCESS_OPTIONS, { ACCESS_GROUPS } from "../constants/AccessPoints"
import { API_URL } from "../config";
import { Users as UsersIcon, X, UserPlus, RefreshCcw, Search, Shield, User } from "lucide-react";
import { hasPermission } from "../utils/permissions";



// ── Skeleton ──────────────────────────────────────────────────
function Sk({ w = "100%", h = 16, r = 6 }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#151f30 25%,#1e2d44 50%,#151f30 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
  );
}

// ── Stat pill ─────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, accent, loading }) {
  return (
        <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", borderRadius:12, padding:"10px 14px" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: accent + "18", color: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: 0.6, marginBottom: 3 }}>{label}</div>
        {loading ? <Sk w={56} h={22} /> : <div style={{ fontSize: 16, fontWeight: 800, color: accent, letterSpacing: -0.5 }}>{value ?? "—"}</div>}
      </div>
    </div>
  );
}

// ── Field wrapper (matches Products style) ────────────────────
const Field = ({ label, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <label style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</label>
    {children}
  </div>
);

// ── Toggle (matches Products style) ───────────────────────────
const Toggle = ({ checked, onChange, label, color = "#3b82f6" }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
    <div onClick={() => onChange(!checked)} style={{ position: "relative", width: 44, height: 24, borderRadius: 12, background: checked ? color : "#1e293b", border: `1px solid ${checked ? color : "#334155"}`, transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)", cursor: "pointer", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: checked ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: checked ? "white" : "#475569", transition: "left 0.25s cubic-bezier(0.4,0,0.2,1)", boxShadow: checked ? "0 2px 6px rgba(0,0,0,0.4)" : "none" }} />
    </div>
    {label && <span style={{ color: checked ? "#e2e8f0" : "#64748b", fontSize: 13, fontWeight: 500, transition: "color 0.2s" }}>{label}</span>}
  </label>
);

export default function Users() {
  const token = localStorage.getItem("token");

  // ── ALL DATA (important change) ───────────────────────────
  const [allUsers, setAllUsers] = useState([]);
  const [myUsers, setMyUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [accessPoints, setAccessPoints] = useState([]);

  const [permissionTab, setPermissionTab] = useState("basic");
  const username = localStorage.getItem("username") || "My";

  const [viewMode, setViewMode] = useState("users");
  const [selectedUser, setSelectedUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("user_id");
  const [balanceCurrency, setBalanceCurrency] = useState("USDT"); // default
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(true);

  // ── Add user panel state ──────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [isActive, setIsActive] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");


 
  const currentUser = {
        role: localStorage.getItem("role"),
        access_points: JSON.parse(localStorage.getItem("access_points") || "[]")
      };
  

  // ── LOAD ALL DATA ONCE ────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    try {
      const [u1, u2, u3] = await Promise.all([
        fetch(`${API_URL}/admin/users/`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/admin/users/my-users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/admin/users/admins`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [d1, d2, d3] = await Promise.all([u1.json(), u2.json(), u3.json()]);

      if (u1.ok) setAllUsers(d1);
      if (u2.ok) setMyUsers(d2);
      if (u3.ok) setAdmins(d3);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ── ACTIVE DATA (NO API CALLS HERE) ───────────────────────
  const activeUsers = useMemo(() => {
    if (viewMode === "users") return allUsers;
    if (viewMode === "myUsers") return myUsers;
    if (viewMode === "admins") return admins;
    return allUsers;
  }, [viewMode, allUsers, myUsers, admins]);


  const myUsersLabel = username.endsWith("s")
  ? `${username}' Users`
  : `${username}'s Users`;


  // ------- acess point --------------------------------
  const toggleAccess = (access) => {
      setAccessPoints(prev =>
        prev.includes(access)
          ? prev.filter(x => x !== access)
          : [...prev, access]
      );
    };


  // ── Search debounce ───────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Filter + sort ─────────────────────────────────────────
  const getUserActivityScore = (u) => {
    return (u.pending_orders || 0) + (u.approved_orders || 0) + (u.unread_messages || 0)
      + (u.pending_wire_transfers || 0) + (u.pending_withdrawals || 0);
  };

  const getUserBalanceValue = (u, currency) => {
    if (!u.balances) return 0;
    const b = u.balances.find(x => x.currency === currency);
    if (!b) return 0;
    return Number(b.available || 0) + Number(b.frozen || 0);
  };
  const filteredUsers = useMemo(() => {
    let list = [...activeUsers];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((u) => String(u.user_id).includes(q) || (u.username && u.username.toLowerCase().includes(q)));
    }
    list.sort((a, b) => {
      let A, B;

      switch (sortKey) {
        case "user_id":
          A = a.user_id;
          B = b.user_id;
          break;

        case "username":
          A = a.username || "";
          B = b.username || "";
          break;

        case "status":
          A = a.status === "active" ? 1 : 0;
          B = b.status === "active" ? 1 : 0;
          break;

        case "activity":
          A = getUserActivityScore(a);
          B = getUserActivityScore(b);
          break;

        case "balance":
          A = getUserBalanceValue(a, balanceCurrency);
          B = getUserBalanceValue(b, balanceCurrency);
          break;

        default:
          A = a.user_id;
          B = b.user_id;
      }

      if (typeof A === "number" && typeof B === "number") {
        return sortDir === "asc" ? A - B : B - A;
      }

      return sortDir === "asc"
        ? String(A).localeCompare(String(B))
        : String(B).localeCompare(String(A));
    });
    return list;
  }, [activeUsers, search, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // ── Open user ─────────────────────────────────────────────
  const openUser = async (user) => {
    setSelectedUser(user);
    try {
      const [ordersRes, txRes] = await Promise.all([
        fetch(`${API_URL}/admin/users/${user.user_id}/orders`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/admin/users/${user.user_id}/transactions`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
    } catch (err) { console.error(err); }
  };

  // ── Add user ──────────────────────────────────────────────
  const addUser = async () => {
    setAddError("");
    if (!newUsername.trim()) { setAddError("Username is required."); return; }
    if (!newPassword.trim()) { setAddError("Password is required."); return; }
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          username: newUsername, 
          password: newPassword, 
          role: newRole, 
          telegram_id: "",
          access_points: accessPoints, }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewUsername(""); setNewPassword(""); setNewRole("user"); setIsActive(true);
        setPanelOpen(false);
        loadAll();
      } else {
        setAddError(data.detail || data.message || "Failed to create user.");
      }
    } catch (err) { setAddError("Request failed."); }
    setAdding(false);
  };


  const COLS = "3% 6% 10% 10% 10% 1fr";
  const HEAD_COLS = "5% 8% 10% 7% 10% 1fr";

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
        button, input, select { font-family: inherit; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #060b16; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
      `}</style>

      <div style={{ 
        display: "flex", 
        height: "100vh", 
        background: "#060b16", 
        overflow: "hidden", 
        padding:"5px",
        fontFamily: "'DM Sans', system-ui, sans-serif" }}>


        {/* ══ LEFT PANEL — Add User (mirrors Products sidebar) ══ */}
        <div
          style={{
            width: panelOpen ? 360 : 0,
            minWidth: panelOpen ? 360 : 0,
            transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
            overflow: "hidden",
            borderRight: panelOpen ? "1px solid #0f172a" : "none",
            background: "#080e1a",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              width: 360,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              padding: 24,
              boxSizing: "border-box",
            }}
          >
            {/* Panel header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 28,
              }}
            >
              <div>
                <div style={{ color: "white", fontWeight: 700, fontSize: 18 }}>
                  New User
                </div>
                <div style={{ color: "#63748dff", fontSize: 14, marginTop: 3 }}>
                  Fill in the details below
                </div>
              </div>

              <button onClick={() => setPanelOpen(false)} style={S.closeIconBtn}>
                <X size={16} />
              </button>
            </div>

            {/* Role selector pills */}
            <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
              {[
                { val: "user", label: "User", icon: User },

                ...(hasPermission(currentUser, "users.create")
                  ? [{ val: "admin", label: "Admin", icon: Shield }]
                  : []),
              ].map(({ val, label, icon: Icon }) => (
                <button
                  key={val}
                  onClick={() => setNewRole(val)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 16px",
                    borderRadius: 20,
                    fontSize: 13,
                    cursor: "pointer",
                    fontWeight: 600,
                    border: "1px solid",
                    background:
                      newRole === val
                        ? val === "admin"
                          ? "rgba(239,68,68,0.2)"
                          : "rgba(59,130,246,0.2)"
                        : "transparent",
                    borderColor:
                      newRole === val
                        ? val === "admin"
                          ? "#ef4444"
                          : "#3b82f6"
                        : "#313d58ff",
                    color:
                      newRole === val
                        ? val === "admin"
                          ? "#fca5a5"
                          : "#60a5fa"
                        : "#5f6e83ff",
                    transition: "all 0.15s",
                  }}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>

            {/* Form fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
              <Field label="Username">
                <input
                  style={S.input}
                  placeholder="e.g. john_doe"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addUser()}
                  autoComplete="off"
                />
              </Field>

              <Field label="Password">
                <input
                  type="password"
                  style={S.input}
                  placeholder="Set a secure password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addUser()}
                />
              </Field>

              {/* Toggles */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "14px 16px",
                  background: "#050a1405",
                  borderRadius: 12,
                }}
              >
                <Toggle
                  checked={isActive}
                  onChange={setIsActive}
                  label="Active on creation"
                  color="#22c55e"
                />

                {hasPermission("users.create") && (
                  <Toggle
                    checked={newRole === "master"}
                    onChange={(v) => {
                      if (v) {
                        setNewRole("master");
                        setAccessPoints(ACCESS_OPTIONS.map((a) => a.key));
                      } else {
                        setNewRole("user");
                        setAccessPoints([]);
                      }
                    }}
                    label="Grant Master access (Full Control)"
                    color="#f59e0b"
                  />
                )}
              </div>


{/* ══ PERMISSION TABS SYSTEM (fitted to 360px sidebar) ══ */}
{hasPermission(currentUser, "users.create") && newRole === "admin" && (
  <div
    style={{
      background: "linear-gradient(180deg,#111827 0%, #0a1226 100%)",
      border: "1px solid #1e293b",
      borderRadius: 16,
      padding: 14,
      width: "100%",
      boxSizing: "border-box",
    }}
  >
    {/* Header */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "rgba(99,102,241,0.12)",
          color: "#818cf8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        </svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
          Admin permissions
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
          Choose what this admin can access
        </div>
      </div>
    </div>

    {/* Tabs — wrap instead of horizontal-scroll to fit narrow width */}
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 5,
        marginBottom: 12,
        width: "100%",
      }}
    >
      {Object.keys(ACCESS_GROUPS).map((key) => (
        <button
          key={key}
          onClick={() => setPermissionTab(key)}
          style={{
            padding: "5px 6px",
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 500,
            background:
              permissionTab === key ? "rgba(99,102,241,0.15)" : "transparent",
            border: `1px solid ${permissionTab === key ? "#6366f1" : "#26324a"}`,
            color: permissionTab === key ? "#a5b4fc" : "#64748b",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()}
        </button>
      ))}
    </div>

    {/* Permissions — single column, full width, fixed min-height so tabs don't jump */}
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minHeight: 180,
        alignContent: "flex-start",
        width: "100%",
      }}
    >
      {ACCESS_GROUPS[permissionTab].map((item) => (
        <div
          key={item.key}
          style={{
            background: "#0b1220",
            border: "1px solid #1c2333",
            borderRadius: 10,
            padding: "10px 12px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <Toggle
            checked={accessPoints.includes(item.key)}
            onChange={() => toggleAccess(item.key)}
            label={item.label}
            color="#6366f1"
          />
        </div>
      ))}
    </div>
  </div>
)}

              {/* Error */}
              {addError && (
                <div
                  style={{
                    background: "rgba(239,68,68,.08)",
                    border: "1px solid rgba(239,68,68,.2)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 12,
                    color: "#fca5a5",
                  }}
                >
                  {addError}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 24,
                paddingTop: 16,
                borderTop: "1px solid #0f172a",
              }}
            >
              <button style={S.cancelBtn} onClick={() => setPanelOpen(false)}>
                Cancel
              </button>

              <button
                style={{ ...S.submitBtn, opacity: adding ? 0.6 : 1 }}
                onClick={addUser}
                disabled={adding}
              >
                {adding ? "Creating…" : "Create User"}
              </button>
            </div>
          </div>
        </div>

        {/* ══ MAIN CONTENT ══ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", color: "white" }}>

          {/* Top bar */}
          <div style={S.header}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                           <div>
            <div style={S.title}>Users</div>
            <div style={S.subtitle}>Manage users, balances, messages &amp; orders</div>
          </div>
              <StatPill icon={UsersIcon} label="Active Users" value={`${allUsers.filter((u) => u.status === "active").length} / ${allUsers.length}`} accent="#3b82f6" loading={loading} />
            {hasPermission(currentUser, "admins.view") && (
              <StatPill
                icon={Shield}
                label="Total Admins"
                value={`${admins.length}`}
                accent="#f59e0b"
                loading={loading}
              />
            )}
            </div>

         
          </div>

        {/* ── Buttons and Refresh ─────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
          }}
        >

          
            <div style={{ display: "flex", gap: 8, marginLeft: 25}}>

              {/* All Users (both admin + master) */}
              {hasPermission(currentUser,"users.view") && (
              <button
                onClick={() => setViewMode("users")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  border: `1px solid ${
                    viewMode === "users"
                      ? "#3b82f6"
                      : "rgba(59,130,246,0.3)"
                  }`,
                  background: viewMode === "users"    ? "rgba(3, 89, 227, 0.48)"
                      : "rgba(59,130,246,0.12)",
                  color: viewMode === "users" ? "white" : "#64748b",
                }}
              >
                All Users
              </button>
              )}

              {/* My Users (both admin + master) */}
              <button
                onClick={() => setViewMode("myUsers")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  border: `1px solid ${
                    viewMode === "myUsers"
                      ? "#3b82f6"
                      : "rgba(59,130,246,0.3)"
                  }`,
                  background:
                    viewMode === "myUsers"
                      ? "rgba(3, 89, 227, 0.48)"
                      : "rgba(59,130,246,0.12)",
                  color: viewMode === "myUsers" ? "white" : "#64748b",
                }}
              >
                {myUsersLabel}
              </button>

              {/* ONLY MASTER */}
              {hasPermission(currentUser,"admins.view") && (
                <button
                  onClick={() => setViewMode("admins")}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    border: viewMode === "admins" ? "1px solid #8f9aabff" :"1px solid #f59f0b5e",
                    background: viewMode === "admins" ? "#f59f0b5e" : "rgba(59,130,246,0.12)",
                    color: viewMode === "admins" ? "white" : "#64748b",
                  }}
                >
                  Admins
                </button>
              )}

            </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginLeft: "auto",
            gap: 10,
            marginRight: 30,
          }}
        >

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Search */}
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#334155" }} />
                <input
                  placeholder="Search users…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  style={{ ...S.input, width: 220, paddingLeft: 34, height: 38, fontSize: 13 }}
                />
              </div>

              <button onClick={loadAll} disabled={loading} style={S.refreshBtn}>
                <RefreshCcw size={13} style={{ marginRight: 6, opacity: loading ? 0.5 : 1, animation: loading ? "spin 1s linear infinite" : "none" }} />
                {loading ? "…" : "Refresh"}
              </button>



            </div>

              {/* Add User — same style as Products "Add Product" button */}
              {hasPermission(currentUser, "users.create") && (
              <button
                onClick={() => setPanelOpen((p) => !p)}
                style={{
                  display: "flex", alignItems: "center",
                  border: "1px solid",
                  borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13,
                  background: panelOpen ? "rgba(59,130,246,0.25)" : "rgba(59,130,246,0.12)",
                  borderColor: panelOpen ? "#3b82f6" : "rgba(59,130,246,0.3)",
                  color: panelOpen ? "white" : "#60a5fa",
                  transition: "all 0.2s",
                }}
              >
                <UserPlus size={14} style={{ marginRight: 7 }} />
                Add User
              </button>
              )}
              </div>
        </div>

          {/* Table header */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: HEAD_COLS, 
            gap: 12, 
            marginLeft: 12, 
            padding: "8px 28px", 
            color: "#475569", 
            fontSize: 11, 
            letterSpacing: "0.04em", 
            borderBottom: "1px solid #1e293b", 
            marginBottom: 0, 
            flexShrink: 0 
            }}
            >
            <div onClick={() => handleSort("user_id")} style={S.sortable}>ID {sortKey === "user_id" ? (sortDir === "asc" ? "↑" : "↓") : ""}</div>
            <div onClick={() => handleSort("username")} style={S.sortable}>User {sortKey === "username" ? (sortDir === "asc" ? "↑" : "↓") : ""}</div>
            <div onClick={() => handleSort("status")} style={S.sortable}>
                                Status {sortKey === "status" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                              </div>
            <div onClick={() => handleSort("activity")} style={S.sortable}>
                              Activity {sortKey === "activity" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                            </div>
            <div />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                onClick={() => handleSort("balance")}
                style={{ ...S.sortable }}
              >
                Balances {sortKey === "balance" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </span>

              {/* currency selector pills */}
              <div style={{ display: "flex", gap: 6, marginLeft: 10 }}>
                {[...new Set(activeUsers.flatMap(u => u.balances?.map(b => b.currency) || []))].map(cur => (
                  <span
                    key={cur}
                    onClick={() => {
                      setBalanceCurrency(cur);
                      setSortKey("balance");
                    }}
                    style={{
                      padding: "3px 8px",
                      fontSize: 10,
                      borderRadius: 999,
                      cursor: "pointer",
                      border: balanceCurrency === cur ? "1px solid #3b82f6" : "1px solid #1e293b",
                      background: balanceCurrency === cur ? "rgba(59,130,246,0.15)" : "transparent",
                      color: balanceCurrency === cur ? "#60a5fa" : "#64748b",
                    }}
                  >
                    {cur}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Table rows */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 28px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
            {filteredUsers.map((u) => (
              <div
                key={u.user_id}
                style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, alignItems: "center", padding: "12px 14px", background: "#0d1526", border: "1px solid #1a2540", borderRadius: 14, cursor: "pointer", transition: "border-color 0.15s ease" }}
                onClick={() => openUser(u)}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2a3a5c")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a2540")}
              >
                <div style={{ color: "#475569", fontSize: 12, fontWeight: 600 }}>#{u.user_id}</div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1d4fd871", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {u.username?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ minWidth: 200 }}>
                    <div style={{ 
                      fontWeight: 700, 
                      fontSize: 13, 
                      whiteSpace: "nowrap", 
                      overflow: "hidden", 
                      textOverflow: "ellipsis" }}>{u.username}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{u.role}</div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "center" }}>
                  <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, ...(u.status === "active" ? { background: "rgba(34,197,94,0.12)", color: "#22c55e" } : { background: "rgba(239,68,68,0.12)", color: "#ef4444" }) }}>
                    {u.status}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div style={{ display: "flex", gap: 7 }}>
                    {[
                      ["💬", u.unread_messages, "#ef4444"],
                      ["📦", (u.pending_orders || 0) + (u.approved_orders || 0), "#f59e0b"],
                      ["🏦", u.pending_wire_transfers || 0, "#3b82f6"],
                      ["💵", u.pending_withdrawals || 0, "#a855f7"],
                    ].map(([icon, count, color], i) => (
                      <div key={i} style={{ width: 34, height: 34, borderRadius: 9, background: "#0b1220", border: "1px solid #1a2540", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, position: "relative" }}>
                        {icon}
                        {count > 0 && (
                          <span style={{ position: "absolute", top: -4, right: -4, fontSize: 10, fontWeight: 700, padding: "1px 4px", borderRadius: 999, color: "black", lineHeight: 1.4, background: color }}>{count}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div />

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {u.balances?.length > 0 ? u.balances.map((b, idx) => {
                    const available = Number(b.available || 0);
                    const frozen = Number(b.frozen || 0);
                    return (
                      <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 10px", borderRadius: 12, background: "#0b1220", border: "1px solid #1a2540", minWidth: 170 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(96,165,250,0.12)", color: "#bfdbfe", fontSize: 11, fontWeight: 700, border: "1px solid rgba(96,165,250,0.14)" }}>{b.currency}</span>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 7px",
                              borderRadius: 999,
                              background: b.network ? "rgba(56,189,248,0.10)" : "transparent",
                              color: b.network ? "#7dd3fc" : "transparent",
                              border: b.network ? "1px solid rgba(56,189,248,0.12)" : "1px solid transparent",
                            }}
                          >
                            {b.network || "—"}
                          </span>
                          </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>Available</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e", textAlign: "center" }}>{available.toLocaleString()}</span>
                          </div>
                          <div style={{ width: 1, height: 24, background: "rgba(148,163,184,0.12)" }} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>Frozen</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: frozen > 0 ? "#f59e0b" : "#334155", textAlign: "center" }}>{frozen.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }) : <span style={{ fontSize: 12, color: "#475569" }}>No balances</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ USER DETAIL SIDEBAR ══ */}
        <div style={{ width: 0 }}>
          {selectedUser && (
            <UserSidebar
              user={selectedUser}
              orders={orders}
              transactions={transactions}
              onClose={() => setSelectedUser(null)}
              onRefresh={loadAll}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────
const S = {
  input: {
    background: "#060d1a", border: "1px solid #313d58ff", color: "white",
    padding: "10px 13px", borderRadius: 10, outline: "none", fontSize: 13,
    width: "100%", boxSizing: "border-box", transition: "border-color 0.15s",
  },
  closeIconBtn: {
    background: "#0b1525", border: "1px solid #313d58ff", color: "#475569",
    width: 32, height: 32, borderRadius: 8, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  submitBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    flex: 1, background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.35)",
    color: "#60a5fa", padding: "10px 20px", borderRadius: 10,
    cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.15s",
  },
  cancelBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "transparent", border: "1px solid #313d58ff",
    color: "#475569", padding: "10px 16px", borderRadius: 10,
    cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap",
  },
  refreshBtn: {
    display: "flex", alignItems: "center",
    background: "transparent", border: "1px solid #313d58ff",
    borderRadius: 10, padding: "8px 14px", color: "#6c798dff",
    cursor: "pointer", fontWeight: 600, fontSize: 13,
  },
  sortable: { cursor: "pointer", userSelect: "none" },
    title: { color: "#2e7ce9af",margin: 0, fontSize: 26, fontWeight: 600, marginRight: 20 , letterSpacing: "0.1rem",   },
  subtitle: { color: "#64748b", fontSize: 13, margin: "2px 0 0" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 14,  padding :"10px 0 20px 20px",  flexWrap: "wrap"
  },
};