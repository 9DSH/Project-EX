import { useEffect, useMemo, useState } from "react";
import UserSidebar from "../components/usersidebar/UserSidebar";
import HeroHub from "../components/HeroHub";
import ACCESS_OPTIONS, { ACCESS_GROUPS } from "../constants/AccessPoints"
import { API_URL } from "../config";

import { hasPermission } from "../utils/permissions";
import "./Users.css";
  import {
  Users as UsersIcon,
  X,
  UserPlus,
  Shield,
  User,
  MessageSquare,
  ShoppingCart,
  Landmark,
  Banknote,
} from "lucide-react";

// ── Field wrapper (matches Products style) ────────────────────
const Field = ({ label, children }) => (
  <div className="users-field">
    <label className="users-field-label">{label}</label>
    {children}
  </div>
);

// ── Toggle (matches Products style) ───────────────────────────
const Toggle = ({ checked, onChange, label, color = "#3b82f6" }) => (
  <label className="users-toggle-label">
    <div
      onClick={() => onChange(!checked)}
      className={`users-toggle-track${checked ? " is-checked" : ""}`}
      style={{ "--toggle-color": color }}
    >
      <div className={`users-toggle-thumb${checked ? " is-checked" : ""}`} />
    </div>
    {label && <span className={`users-toggle-text${checked ? " is-checked" : ""}`}>{label}</span>}
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

  // ── Permission gates for the HeroHub "users" filter ────────
  const isMaster = currentUser.role === "master";
  const canViewAllUsers = isMaster || hasPermission(currentUser, "all.users.view");
  const canViewAdmins = isMaster || hasPermission(currentUser, "admins.view");

  
  // Admins without all.users.view access only ever see their own users —
  // keep viewMode pinned there so the (hidden) filter can't drift.
  useEffect(() => {
    if (!canViewAllUsers && viewMode !== "myUsers") setViewMode("myUsers");
  }, [canViewAllUsers, viewMode]);
  

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


  const COLS = "3% 6% 10% 10% 10% minmax(180px, 1fr)";
  const HEAD_COLS = "5% 8% 10% 7% 10% minmax(180px, 1fr)";

  return (
    <div className="users-page">

      {/* ══ MAIN CONTENT ══ */}
      <div className="users-main">

        {/* ── HERO HUB (title/subtitle + users filter + search + stat pill) ── */}
        <div className="users-hero-wrap">
          <HeroHub
            title="Users"
            subtitle="Manage users, balances, messages & orders"
            search={{
              visible: true,
              value: searchInput,
              onChange: setSearchInput,
              placeholder: "Search users…",
            }}
            dropdowns={[
              {
                key: "viewMode",
                label: "Users", 
                // only master / admins with "all.users.view" get to switch between
                // All Users, My Users and Admins — everyone else is pinned to
                // their own users and never sees this filter at all.
                visible: canViewAllUsers,
                value: viewMode,
                onChange: setViewMode,
                options: [
                  { label: "All", value: "users" },
                  { label: myUsersLabel, value: "myUsers" },
                  ...(canViewAdmins ? [{ label: "Admins", value: "admins" }] : []),
                ],
              },
            ]}
            statPills={[
              {
                key: "totalUsers",
                icon: UsersIcon,
                // for master / all.users.view admins this reflects whichever
                // filter is selected (all / my / admins); everyone else
                // just sees their own users total.
                label: "Total Users",
                value: activeUsers.length,
                accent: "#3b82f6",
                loading,
              },
            ]}
            onRefresh={loadAll}
            refreshing={loading}
            actions={[
              {
                key: "addUser",
                visible: hasPermission(currentUser, "users.manage"),
                label: "Add User",
                icon: UserPlus,
                active: panelOpen,
                onClick: () => setPanelOpen((p) => !p),
              },
            ]}
          />
        </div>

        {/* ── row below the hub: Add User panel (left) + user list (right) ── */}
        <div className="users-body-row">
          {/* ══ LEFT PANEL — Add User (mirrors Products sidebar) ══ */}
          <div className={`users-panel${panelOpen ? " is-open" : ""}`}>
            <div className="users-panel-inner">
              {/* Panel header */}
              <div className="users-panel-header">
                <div>
                  <div className="users-panel-title">New User</div>
                  <div className="users-panel-subtitle">Fill in the details below</div>
                </div>

                <button onClick={() => setPanelOpen(false)} className="users-close-btn">
                  <X size={16} />
                </button>
              </div>

              {/* Role selector pills */}
              <div className="users-role-row">
                {[
                  { val: "user", label: "User", icon: User },

                  ...(hasPermission(currentUser, "users.manage")
                    ? [{ val: "admin", label: "Admin", icon: Shield }]
                    : []),
                ].map(({ val, label, icon: Icon }) => (
                  <button
                    key={val}
                    onClick={() => setNewRole(val)}
                    className={`users-role-pill${
                      newRole === val ? (val === "admin" ? " is-selected-admin" : " is-selected-user") : ""
                    }`}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Form fields */}
              <div className="users-form-fields">
                <Field label="Username">
                  <input
                    className="users-input"
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
                    className="users-input"
                    placeholder="Set a secure password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addUser()}
                  />
                </Field>

                {/* Toggles */}
                <div className="users-toggles-box">
                  <Toggle
                    checked={isActive}
                    onChange={setIsActive}
                    label="Active on creation"
                    color="#22c55e"
                  />

                  {hasPermission("users.manage") && (
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
                {hasPermission(currentUser, "users.manage") && newRole === "admin" && (
                  <div className="users-permbox">
                    {/* Header */}
                    <div className="users-permbox-header">
                      <div className="users-permbox-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                        </svg>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="users-permbox-title">Admin permissions</div>
                        <div className="users-permbox-subtitle">Choose what this admin can access</div>
                      </div>
                    </div>

                    {/* Tabs — wrap instead of horizontal-scroll to fit narrow width */}
                    <div className="users-permtabs">
                      {Object.keys(ACCESS_GROUPS).map((key) => (
                        <button
                          key={key}
                          onClick={() => setPermissionTab(key)}
                          className={`users-permtab${permissionTab === key ? " is-active" : ""}`}
                        >
                          {key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>

                    {/* Permissions — single column, full width, scrolls internally so the
                        modal itself never needs to scroll to reach the Create/Cancel buttons */}
                    <div className="users-permlist balances-scroll">
                      {ACCESS_GROUPS[permissionTab].map((item) => (
                        <div key={item.key} className="users-permitem">
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
                {addError && <div className="users-error-box">{addError}</div>}
              </div>

              {/* Footer buttons */}
              <div className="users-panel-footer">
                <button className="users-btn-cancel" onClick={() => setPanelOpen(false)}>
                  Cancel
                </button>

                <button
                  className={`users-btn-submit${adding ? " is-disabled" : ""}`}
                  onClick={addUser}
                  disabled={adding}
                >
                  {adding ? "Creating…" : "Create User"}
                </button>
              </div>
            </div>
          </div>

          <div className="users-table-area">
            {/* Table header */}
            <div className="users-table-head" style={{ gridTemplateColumns: HEAD_COLS }}>
              <div onClick={() => handleSort("user_id")} className="users-sortable">ID {sortKey === "user_id" ? (sortDir === "asc" ? "↑" : "↓") : ""}</div>
              <div onClick={() => handleSort("username")} className="users-sortable">User {sortKey === "username" ? (sortDir === "asc" ? "↑" : "↓") : ""}</div>
              <div onClick={() => handleSort("status")} className="users-sortable">
                Status {sortKey === "status" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </div>
              <div onClick={() => handleSort("activity")} className="users-sortable">
                Activity {sortKey === "activity" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </div>
              <div />
              <div className="users-balance-head">
                <span onClick={() => handleSort("balance")} className="users-sortable">
                  Balances {sortKey === "balance" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </span>

                {/* currency selector pills */}
                <div className="users-currency-pills">
                  {[...new Set(activeUsers.flatMap(u => u.balances?.map(b => b.currency) || []))].map(cur => (
                    <span
                      key={cur}
                      onClick={() => {
                        setBalanceCurrency(cur);
                        setSortKey("balance");
                      }}
                      className={`users-currency-pill${balanceCurrency === cur ? " is-active" : ""}`}
                    >
                      {cur}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Table rows */}
            <div className="users-table-body">
              {filteredUsers.map((u) => (
                <div
                  key={u.user_id}
                  className="users-row"
                  style={{ gridTemplateColumns: COLS }}
                  onClick={() => openUser(u)}
                >
                  <div className="users-row-id">#{u.user_id}</div>

                  <div className="users-row-user">
                    <div className="users-avatar">{u.username?.[0]?.toUpperCase()}</div>
                    <div className="users-username-wrap">
                      <div className="users-username">{u.username}</div>
                      <div className="users-role-text">{u.role}</div>
                    </div>
                  </div>

                  <div className="users-status-cell">
                    <span className={`users-status-badge${u.status === "active" ? " is-active" : " is-inactive"}`}>
                      {u.status}
                    </span>
                  </div>

                  <div className="users-activity-cell">
                    <div className="users-activity-icons">
                    {[
                      [MessageSquare, u.unread_messages, "#22c55e" ],
                      [ShoppingCart, (u.pending_orders || 0) + (u.approved_orders || 0), "#f59e0b"],
                      [Landmark, u.pending_wire_transfers || 0, "#3b82f6"],
                      [Banknote, u.pending_withdrawals || 0, "#ef4444"],
                    ].map(([Icon, count, color], i) => (
                      <div 
                         key={i} 
                         className={`users-activity-icon${count > 0 ? " is-active" : ""}`}
                         style={count > 0 ? { "--count-color": color } : undefined} >
                        {<Icon size={14} color={"#535c7a"} />}
                        {count > 0 && (
                          <span className="users-activity-count" style={{ "--count-color": color }}>{count}</span>
                        )}
                      </div>
                    ))}
                    </div>
                  </div>

                  <div />

                  <div className="users-balances-row balances-scroll">
                    {u.balances?.length > 0 ? u.balances.map((b, idx) => {
                      const available = Number(b.available || 0);
                      const frozen = Number(b.frozen || 0);
                      return (
                        <div key={idx} className="users-balance-card">
                          <div className="users-balance-card-head">
                            <span className="users-balance-currency">{b.currency}</span>
                            <span className={`users-balance-network${b.network ? " is-set" : ""}`}>
                              {b.network || "—"}
                            </span>
                          </div>
                          <div className="users-balance-grid">
                            <div className="users-balance-stat">
                              <span className="users-balance-stat-label">Available</span>
                              <span className="users-balance-available">{available.toLocaleString()}</span>
                            </div>
                            <div className="users-balance-divider" />
                            <div className="users-balance-stat">
                              <span className="users-balance-stat-label">Frozen</span>
                              <span className={`users-balance-frozen${frozen > 0 ? " is-frozen" : ""}`}>{frozen.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }) : <span className="users-no-balances">No balances</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ USER DETAIL SIDEBAR ══ */}
      <div className="users-sidebar-wrap">
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
  );
}