import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  Users, Wallet, ShoppingCart, Package, Clock, TrendingDown,
  RefreshCcw, BarChart3, LayoutDashboard, Coins, AlertCircle,
  ArrowDownLeft, CheckCircle2, CheckCircle, XCircle, Loader2,
  ChevronRight, Zap, Activity, Shield, Server, AlertTriangle,
  User, Key, ToggleLeft, ToggleRight, Globe, Lock, DollarSign, ChevronDown, ChevronUp
} from "lucide-react";
import { API_URL } from "../config";
import { ACCESS_GROUPS } from "../constants/AccessPoints";

const api = axios.create({ baseURL: API_URL });

const fmt = (n, d = 2) =>
  n != null ? Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d }) : "—";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const fmtAddr = (a) => (a ? `${a.slice(0, 10)}…${a.slice(-8)}` : "—");

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Sk({ w = "100%", h = 16, r = 6 }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#151f30 25%,#1e2d44 50%,#151f30 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon: Icon, accent = "#3b82f6", badge, children, style }) {
  return (
    <div style={{ ...sec.wrap, ...style }}>
      <div style={sec.header}>
        <div style={{ ...sec.iconBox, background: accent + "18", color: accent }}>
          <Icon size={14} />
        </div>
        <span style={sec.title}>{title}</span>
        {badge != null && (
          <span style={{ ...sec.badge, background: accent + "18", color: accent }}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

const sec = {
  wrap: { background: "#0a1628", border: "1px solid #162236", borderRadius: 16, padding: 20 },
  header: { display: "flex", alignItems: "center", gap: 8, marginBottom: 16 },
  iconBox: { width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  title: { fontSize: 14, fontWeight: 700, color: "#c3d1e5ff", letterSpacing: 1, textTransform: "uppercase", flex: 1 },
  badge: { fontSize: 10, fontWeight: 800, padding: "2px 9px", borderRadius: 999, letterSpacing: 0.4 },
};

const GROUP_META = {
  basic: {
    label: "Basic",
    icon: User,
    color: "#3b82f6",
  },
  finance: {
    label: "Finance",
    icon: DollarSign,
    color: "#10b981",
  },
  products: {
    label: "Products",
    icon: Package,
    color: "#f59e0b",
  },
  exchange: {
    label: "Exchange",
    icon: RefreshCcw,
    color: "#8b5cf6",
  },
};

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, adminValue, globalValue, accent, loading, hasAccess }) {
  if (!hasAccess) {
    return (
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", borderRadius:12, padding:"10px 14px" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} style={{ color: "#64748b" }} />
        </div>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Restricted</div>
      </div>
    );
  }

  return (
        <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", borderRadius:12, padding:"10px 14px" }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: accent + "18", color: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.6 }}>{label}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 10 }}>
          <div style={{ padding: "6px 8px", background: "#0a1628", borderRadius: 8, border: "1px solid #162236" }}>
            <div style={{ color: "#64748b", marginBottom: 3 }}>Admin</div>
            <div style={{ color: accent, fontWeight: 700 }}>{loading ? "—" : adminValue ?? "—"}</div>
          </div>
          <div style={{ padding: "6px 8px", background: "#0a1628", borderRadius: 8, border: "1px solid #162236" }}>
            <div style={{ color: "#64748b", marginBottom: 3 }}>Global</div>
            <div style={{ color: accent, fontWeight: 700 }}>{loading ? "—" : globalValue ?? "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Balance card ──────────────────────────────────────────────────────────────
function BalanceCard({ symbol, available, frozen, loading }) {
  const total = (available || 0) + (frozen || 0);
  const frozenPct = total > 0 ? ((frozen || 0) / total) * 100 : 0;
  const colors = { USDT: "#10b981", IRT: "#f59e0b", BTC: "#f97316", ETH: "#8b5cf6", BNB: "#eab308", TRX: "#e11d48" };
  const accent = colors[symbol?.toUpperCase()] || "#3b82f6";
  return (
    <div style={{ background: "#060d1a", border: `1px solid ${accent}22`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: accent, background: accent + "18", padding: "3px 10px", borderRadius: 999 }}>{symbol}</span>
        {loading ? <Sk w={50} h={12} /> : <span style={{ fontSize: 10, color: "#334155" }}>Total: <strong style={{ color: "#94a3b8" }}>{fmt(total, 4)}</strong></span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
        {[["Available", available, accent], ["Frozen", frozen, "#f59e0b"]].map(([lbl, val, clr]) => (
          <div key={lbl} style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "#475569" }}>{lbl}</span>
            {loading ? <Sk w={60} h={13} /> : <span style={{ fontSize: 12, fontWeight: 700, color: clr }}>{fmt(val, 4)}</span>}
          </div>
        ))}
      </div>
      {!loading && total > 0 && (
        <div style={{ height: 3, borderRadius: 999, background: "#1a2d4a", display: "flex", overflow: "hidden" }}>
          <div style={{ width: `${100 - frozenPct}%`, background: accent, borderRadius: 999 }} />
          <div style={{ width: `${frozenPct}%`, background: "#f59e0b", opacity: 0.7 }} />
        </div>
      )}
    </div>
  );
}

// ── Withdrawal row ────────────────────────────────────────────────────────────
function WithdrawalRow({ item }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#060d1a", border: "1px solid #162236", borderRadius: 11, padding: "11px 14px" }}>
      <div style={{ width: 30, height: 30, background: "rgba(245,158,11,.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <ArrowDownLeft size={14} style={{ color: "#f59e0b" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
          {fmt(item.amount, 4)} <span style={{ color: "#64748b", fontWeight: 500 }}>{item.currency}</span>
        </div>
        {item.wallet_address && (
          <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.wallet_address.slice(0, 12)}…{item.wallet_address.slice(-8)}
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, color: "#334155", whiteSpace: "nowrap" }}>{fmtDate(item.created_at)}</div>
    </div>
  );
}

// ── Wallet health pill ────────────────────────────────────────────────────────
function HealthPill({ label, ok, val, loading }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: loading ? "#060d1a" : ok ? "rgba(16,185,129,.06)" : "rgba(239,68,68,.08)", border: `1px solid ${loading ? "#162236" : ok ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.25)"}` }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: loading ? "#1a2d4a" : ok ? "#10b981" : "#ef4444", flexShrink: 0, boxShadow: loading ? "none" : ok ? "0 0 6px #10b981" : "0 0 6px #ef4444" }} />
      <div>
        <div style={{ fontSize: 9, color: "#475569", fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</div>
        {loading ? <div style={{ width: 55, height: 12, borderRadius: 4, background: "#1a2d4a", marginTop: 2 }} /> : <div style={{ fontSize: 11, fontWeight: 700, color: ok ? "#10b981" : "#ef4444", marginTop: 1 }}>{val}</div>}
      </div>
    </div>
  );
}

// ── Big wallet card ───────────────────────────────────────────────────────────
function WalletCard({ label, badge, accent, w, loading }) {
  return (
    <div style={{ background: "#060d1a", border: `1px solid ${accent}25`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#6d7c91ff", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
          {loading ? <Sk w={120} h={11} /> : <div style={{ fontSize: 11, color: "#365680ff", fontFamily: "monospace" }}>{fmtAddr(w?.address)}</div>}
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, background: accent + "18", color: accent, border: `1px solid ${accent}33`, padding: "3px 8px", borderRadius: 6, letterSpacing: 0.6 }}>{badge}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { sym: "USDT", val: w?.usdt_balance, color: "#10b981", size: 22 },
          { sym: "BNB",  val: w?.bnb_balance,  color: "#eab308", size: 17 },
        ].map(({ sym, val, color, size }) => (
          <div key={sym} style={{ background: "#0a1628", border: "1px solid #162236", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 9, color: "#4a5b73ff", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 }}>{sym}</div>
            {loading ? <Sk w={80} h={size} /> : <div style={{ fontSize: size, fontWeight: 800, color, letterSpacing: -0.5 }}>{fmt(val, sym === "BNB" ? 5 : 2)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sweep log entry ───────────────────────────────────────────────────────────
function SweepEntry({ entry }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 12px", background: "#060d1a", border: `1px solid ${entry.ok ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)"}`, borderRadius: 10, fontSize: 11 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: entry.ok ? "#10b981" : "#ef4444", marginTop: 4, flexShrink: 0, boxShadow: entry.ok ? "0 0 5px #10b981" : "0 0 5px #ef4444" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
          <span style={{ color: "#7f8da0ff", fontSize: 10 }}>{entry.time}</span>
          <span style={{ fontWeight: 700, color: entry.ok ? "#10b981" : "#ef4444" }}>{entry.ok ? "Swept" : "Failed"}</span>
        </div>
        <pre style={{ color: "#466082ff", fontFamily: "monospace", whiteSpace: "pre-wrap", fontSize: 10, margin: 0, lineHeight: 1.6 }}>{entry.detail}</pre>
      </div>
    </div>
  );
}

// ── Admin profile card ────────────────────────────────────────────────────────
function AdminProfileCard({ adminInfo, loading, adminTransactions, token }) {
  const [showPermissions, setShowPermissions] = useState(false);
  const [invites, setInvites] = useState([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showAllInvites, setShowAllInvites] = useState(false);
  const [tab, setTab] = useState("active");

  

  
  const fetchInvites = async () => {
      setInviteLoading(true);
      try {
        const res = await api.get("/admin/invitations/", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setInvites(res.data || []);
      } catch (e) {
        console.error(e);
      }
      setInviteLoading(false);
    };

    useEffect(() => {
      if (adminInfo?.role === "master") {
          fetchInvites();
        }
      },[adminInfo?.role]); 

  
  if (loading) {
    return (
      <div style={{ background: "#060d1a", border: "1px solid #162236", borderRadius: 14, padding: 18 }}>
        <Sk w="60%" h={18} />
        <Sk w="40%" h={13} />
        <Sk h={32} />
      </div>
    );
  }

  if (!adminInfo) return null;

  // =========================
  // POOL ACTION
  // =========================


      const generatePool = async () => {
        await api.post(
          "/admin/invitations/generate-pool",
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        fetchInvites();
      };

    const revokeCode = async (id) => {
      await api.post(`/admin/invitations/revoke/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchInvites();
    };
  
    // ─────────────────────────────
  // 📊 STATS
  // ─────────────────────────────
  const totalGenerated = invites.length;
 
  const used = invites.filter(i => i.is_used).length;
  const total = totalGenerated - used;
  const active = invites.filter(i => i.is_active).length;
  const connected = invites.filter(i => i.used_by_user_id != null).length;
  

  const canGenerate = active < 20;

  const activeCodes = invites.filter(i => i.is_active && !i.is_used);

  const usedCodes = invites.filter(i => i.is_used);

  const revokedCodes = invites.filter(i => !i.is_active && !i.is_used);

  const displayedCodes =
    tab === "active"
      ? activeCodes
      : tab === "used"
      ? usedCodes
      : revokedCodes; 



  const visibleInvites = showAllInvites
    ? invites
    : invites.slice(0, 5);

  const rawAccess = adminInfo.access_points;
  const txs = Array.isArray(adminTransactions) ? adminTransactions : [];

  const accessPoints =
    rawAccess === "*" || !rawAccess
      ? "*"
      : Array.isArray(rawAccess)
        ? rawAccess
        : [];

  const roleColors = { master: "#f59e0b", superadmin: "#ef4444", admin: "#3b82f6", moderator: "#8b5cf6" };
  const roleColor = roleColors[adminInfo.role?.toLowerCase()] || "#3b82f6";

  const permissionGroups = accessPoints === "*"
    ? []
    : Object.entries(ACCESS_GROUPS).map(([groupKey, permissions]) => ({
        key: groupKey,
        total: permissions.length,
        granted: permissions.filter((p) => accessPoints.includes(p.key)).length,
      }));



  return (
    <div style={{ background: "#060d1a", border: `1px solid ${roleColor}22`, borderRadius: 14, padding: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: roleColor + "20", border: `1px solid ${roleColor}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {adminInfo.is_master ? <Shield size={20} style={{ color: roleColor }} /> : <User size={20} style={{ color: roleColor }} />}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#e2e8f0", letterSpacing: -0.3 }}>{adminInfo.username || adminInfo.email || `Admin #${adminInfo.id}`}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, background: roleColor + "18", color: roleColor, padding: "2px 8px", borderRadius: 999, letterSpacing: 0.5 }}>{adminInfo.role || "admin"}</span>
            {adminInfo.is_master && (
              <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(245,158,11,.15)", color: "#f59e0b", padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(245,158,11,.3)" }}>MASTER</span>
            )}
          </div>
        </div>
      </div>

      {/* Admin's own balances */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[1, 2, 3, 4].map(i => <BalanceCard key={i} loading />)}
        </div>
      ) : adminInfo.balances.length === 0 ? (
        <div style={{ color: "#334155", fontSize: 13, padding: "16px 0", textAlign: "center" }}>No balance data</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {adminInfo.balances.map(b => (
            <BalanceCard key={b.currency} symbol={b.currency} available={b.available} frozen={b.frozen} />
          ))}
        </div>
      )}

      {/* Permissions */}
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        {accessPoints !== "*" && accessPoints.length > 0 && (
          <>
            <div
              onClick={() => setShowPermissions((v) => !v)}
              style={{ cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "#0b1626ff", border: "1px solid #162236", transition: "all .2s ease" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Key size={13} style={{ color: "#64748b" }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#cbd5e1", letterSpacing: 0.6, textTransform: "uppercase" }}>Permissions</span>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "#1c2940ff", color: "#94a3b8", fontWeight: 700 }}>{accessPoints.length} Access Points</span>
              </div>
              {showPermissions ? <ChevronUp size={15} style={{ color: "#94a3b8" }} /> : <ChevronDown size={15} style={{ color: "#94a3b8" }} />}
            </div>

            {showPermissions && (
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {permissionGroups.map((group) => {
                  const meta = GROUP_META[group.key];
                  const Icon = meta.icon;
                  const grantedPermissions = ACCESS_GROUPS[group.key].filter((p) => accessPoints.includes(p.key));
                  const isFullAccess = group.granted === group.total;
                  return (
                    <div key={group.key} style={{ background: "#0a1628", border: `1px solid ${meta.color}22`, borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                        <Icon size={13} style={{ color: meta.color }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#cbd5e1" }}>{meta.label}</span>
                        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 800, color: meta.color }}>{group.granted}/{group.total}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 999, background: "#162236", overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ width: `${(group.granted / group.total) * 100}%`, height: "100%", background: meta.color }} />
                      </div>
                      {isFullAccess ? (
                        <div style={{ fontSize: 10, fontWeight: 700, color: meta.color }}>Full Access</div>
                      ) : grantedPermissions.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {grantedPermissions.map((perm) => (
                            <span key={perm.key} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 999, background: meta.color + "15", color: meta.color, fontWeight: 600, whiteSpace: "nowrap" }}>{perm.label}</span>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: "#64748b" }}>No Access</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {accessPoints === "*" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px", borderRadius: 10, background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)" }}>
            <Key size={14} style={{ color: "#f59e0b" }} />
            <div>
              <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 12 }}>Full System Access</div>
              <div style={{ color: "#64748b", fontSize: 10 }}>All permission groups enabled</div>
            </div>
          </div>
        )}
      </div>

      {/* Transactions */}
      <Section title="Transactions" icon={TrendingDown} accent="#61cec2ff" badge={txs?.length > 0 ? `${txs.length} Transactions` : null}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2].map(i => <Sk key={i} h={54} r={11} />)}
          </div>
        ) : (txs?.length ?? 0) === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,.05)", border: "1px solid rgba(16,185,129,.12)", borderRadius: 10, padding: "13px 14px", fontSize: 13, color: "#475569" }}>
            <CheckCircle2 size={15} style={{ color: "#10b981" }} />
            All clear — no pending withdrawals
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {txs.map((item, i) => <TransactionRow key={item.id ?? i} item={item} />)}
          </div>
        )}
      </Section>
      

      {/* Invitations */}
      <div style={{ marginTop: 16, marginBottom: 16 }}>
      {adminInfo?.role === "master" && (
      <Section
        title="Invitation Codes"
        icon={Key}
        accent="#8b5cf6"
        badge={invites.length ? `${invites.length} codes` : null}
      >
      {/* TAB SWITCHER */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["active", "used", "revoked"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  border: "none",
                  cursor: "pointer",
                  background: tab === t ? "#5a36adff" : "#0a1628",
                  color: tab === t ? "#fff" : "#94a3b8"
                }}
              >
                {t.toUpperCase()}
              </button>
            ))}
        <div style={{ display: "flex", justifyContent: "space-between", marginLeft: 10, gap:10 }}>
        
        <button
          onClick={generatePool}
          disabled={!canGenerate}
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            background: canGenerate ? "#5a36adff" : "#1f2937",
            border: canGenerate ? "#9285b0ff" : "none",
            color: "white",
            fontWeight: 700,
            fontSize: 11,
            cursor: canGenerate ? "pointer" : "not-allowed"
          }}
        >
          Generate Pool
        </button>

        <button
          onClick={fetchInvites}
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            background: "#0a1628",
            border: "1px solid #293750ff",
            color: "#94a3b8",
            fontSize: 11,
            cursor: "pointer"
          }}
        >
          Refresh
        </button>
      </div>
          </div>
          
          {/* ───────── STATS ───────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: 8,
        marginBottom: 12
      }}>
        <MiniStat label="Total Available" value={total} color="#3b82f6" />
        <MiniStat label="Used" value={used} color="#ef4444" />
        <MiniStat label="Active" value={active} color="#10b981" />
        <MiniStat label="Connected" value={connected} color="#8b5cf6" />
      </div>
      {/* ───────── ACTIONS ───────── */}


      {/* ───────── LIST (COMPACT) ───────── */}
      {inviteLoading ? (
        <div style={{ fontSize: 12, color: "#64748b" }}>Loading...</div>
      ) : invites.length === 0 ? (
        <div style={{ fontSize: 12, color: "#64748b" }}>No invitation codes</div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {displayedCodes.slice(0, 5).map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  background: "#0a1628",
                  border: "1px solid #162236",
                  borderRadius: 10
                }}
              >

                {/* CODE */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#e2e8f0" }}>
                    {c.code}
                  </div>

                  <div style={{ fontSize: 9, color: "#64748b" }}>
                    ID #{c.id}
                  </div>
                </div>

                {/* STATUS */}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <StatusPill
                    text={c.is_active ? "ACTIVE" : "REVOKED"}
                    color={c.is_active ? "#10b981" : "#ef4444"}
                  />

                  {c.created_by_user_id && (

                  <StatusPill
                    text={ `Invited by: ${c.created_by_user_id}`}
                    color={  "#10b981" }
                  />
                  )}


                  {c.used_by_user_id && (
                    <StatusPill text={`Conneted to: ${c.used_by_user_id}`} color="#3b82f6" />
                  )}
                </div>

                {/* ACTION */}
                <button
                  onClick={() => revokeCode(c.id)}
                  disabled={!c.is_active}
                  style={{
                    padding: "5px 8px",
                    borderRadius: 7,
                    background: c.is_active ? "#ef4444" : "#1f2937",
                    border: "none",
                    color: "white",
                    fontSize: 10,
                    cursor: c.is_active ? "pointer" : "not-allowed"
                  }}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
          </>
            )}
     </Section>
)}
</div>
    </div>
  );
}
function MiniStat({ label, value, color }) {
  return (
    <div style={{
      background: "#0a1628",
      border: "1px solid #162236",
      borderRadius: 10,
      padding: "8px"
    }}>
      <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 900, color }}>
        {value}
      </div>
    </div>
  );
}

function StatusPill({ text, color }) {
  return (
    <span style={{
      fontSize: 12,
      padding: "2px 6px",
      borderRadius: 999,
      background: color + "20",
      color,
      fontWeight: 500,
      whiteSpace: "nowrap"
    }}>
      {text}
    </span>
  );
}
function TransactionRow({ item }) {
  const statusColor = { completed: "#10b981", pending: "#f59e0b", failed: "#ef4444" }[item.status] || "#64748b";

  const IN_TYPES = new Set([
    "income",
    "deposit",
    "reward",
    "deposit_from_user",
    "exchange_commission",
    "order_commission",
    "admin_deposit",
    "exchange_in"
      ]);
  const OUT_TYPES = new Set(["withdraw", "withdrawal", "deposit_to_user"]);

  const isIncome = IN_TYPES.has(item.type);
  const typeColor = isIncome ? "#10b981" : "#ef4444";
  const sign = item.amount > 0 || isIncome ? "+" : "-";

  console.log(IN_TYPES);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#060d1a", border: "1px solid #162236", borderRadius: 10 }}>
      <div style={{ minWidth: 90, fontWeight: 800, color: typeColor, fontSize: 13 }}>
        {sign}{fmt(Math.abs(item.amount), 4)}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", gap: 11, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: typeColor + "25", color: typeColor, fontWeight: 700 }}>{item.type?.toUpperCase()}</span>
          <span style={{ fontSize: 10, color: "#64748b" }}>{item.blockchain?.toUpperCase()}</span>
          <span style={{ fontSize: 10, color: "#64748b" }}>Order #{item.order_id}</span>
          <div style={{ fontSize: 10, display: "flex", marginLeft: "auto", alignItems: "center", gap: 8, color: "#475569" }}>
            {fmtDate(item.created_at)}
            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: statusColor + "25", color: statusColor, fontWeight: 700 }}>{item.status?.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wallet Panel ──────────────────────────────────────────────────────────────
function WalletPanel({ token, isMaster, walletData, walletLoading, onRefresh, loading, withdrawals }) {
  const [sweeping, setSweeping] = useState(false);
  const [sweepLog, setSweepLog] = useState([]);

  const canSweep = walletData?.sweep_enabled;

  const doSweep = async () => {
    setSweeping(true);
    try {
      const res = await api.post("/admin/wallet/sweep", {}, { headers: { Authorization: `Bearer ${token}` } });
      const { user_sweep = [], hot_sweep = {} } = res.data;
      const lines = [];
      if (!user_sweep.length) lines.push("user→hot: nothing flagged");
      else user_sweep.forEach((u) => lines.push(u.error ? `user #${u.user_id}: ✗ ${u.error.slice(0, 100)}` : `user #${u.user_id}: ✓ ${u.amount} ${u.tatum_symbol}`));
      lines.push(`hot→master: ${hot_sweep.status}${hot_sweep.amount ? " (" + hot_sweep.amount + " USDT)" : ""}`);
      setSweepLog((p) => [...p, { ok: !user_sweep.some((u) => u.error), time: new Date().toLocaleTimeString(), detail: lines.join("\n") }]);
      onRefresh();
    } catch (e) {
      setSweepLog((p) => [...p, { ok: false, time: new Date().toLocaleTimeString(), detail: "Request failed: " + e.message }]);
    }
    setSweeping(false);
  };

  if (!walletData && !walletLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.15)", borderRadius: 12, padding: "16px 18px" }}>
        <Lock size={15} style={{ color: "#3b82f6", flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: "#475569" }}>Wallet access requires <strong style={{ color: "#60a5fa" }}>wallet.view</strong> permission</div>
      </div>
    );
  }

  const hot    = walletData?.hot_wallet;
  const master = walletData?.master_wallet;
  const gasOk  = (hot?.bnb_balance ?? 0) >= 0.005;
  const hotOk  = (hot?.usdt_balance ?? 0) > 0;
  const hasErr = !!walletData?.error;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {hasErr && !walletLoading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 12, padding: "12px 16px" }}>
          <AlertTriangle size={15} style={{ color: "#ef4444", flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: "#ef4444" }}>Wallet RPC error: {walletData.error}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <HealthPill label="Hot USDT"  ok={hotOk} val={fmt(hot?.usdt_balance, 2) + " USDT"} loading={walletLoading} />
        <HealthPill label="BNB Gas"   ok={gasOk} val={fmt(hot?.bnb_balance, 4) + " BNB"}   loading={walletLoading} />
        <HealthPill label="Master"    ok={true}  val={fmt(master?.usdt_balance, 2) + " USDT"} loading={walletLoading} />
      </div>

      <WalletCard label="Hot Wallet"    badge="OPERATIONAL" accent="#f59e0b" w={hot}    loading={walletLoading} />
      <WalletCard label="Master Wallet" badge="TREASURY"    accent="#3b82f6" w={master} loading={walletLoading} />

      {isMaster && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            {canSweep && (
              <button
                onClick={doSweep}
                disabled={sweeping}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: sweeping ? "#0a1628" : "#0b1220", border: `1px solid ${sweeping ? "#162236" : "rgba(59,130,246,.4)"}`, color: "white", cursor: sweeping ? "not-allowed" : "pointer", letterSpacing: 0.3 }}
              >
                <Zap size={13} style={{ animation: sweeping ? "pulse 1s ease infinite" : "none" }} />
                {sweeping ? "Sweeping…" : "Sweep Now"}
              </button>
            )}
          </div>

          <Section title="Pending Withdrawals" icon={TrendingDown} accent="#ef4444" badge={withdrawals.pending_count > 0 ? `${withdrawals.pending_count} waiting` : null}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1, 2].map(i => <Sk key={i} h={54} r={11} />)}
              </div>
            ) : (withdrawals.pending || []).length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,.05)", border: "1px solid rgba(16,185,129,.12)", borderRadius: 10, padding: "13px 14px", fontSize: 13, color: "#475569" }}>
                <CheckCircle2 size={15} style={{ color: "#10b981" }} />
                All clear — no pending withdrawals
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {withdrawals.pending.map((item, i) => <WithdrawalRow key={item.transaction_id ?? i} item={item} />)}
              </div>
            )}
          </Section>

          <div style={{ background: "#0a1628", border: "1px solid #162236", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Activity size={13} style={{ color: "#3b82f6" }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", letterSpacing: 0.8, textTransform: "uppercase" }}>Sweep Log</span>
                {sweepLog.length > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(59,130,246,.15)", color: "#60a5fa", padding: "2px 7px", borderRadius: 999 }}>{sweepLog.length}</span>
                )}
              </div>
              {sweepLog.length > 0 && (
                <button onClick={() => setSweepLog([])} style={{ fontSize: 10, color: "#5b708dff", background: "none", border: "1px solid #264883ff", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Clear</button>
              )}
            </div>
            {sweepLog.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 0", color: "#334155", fontSize: 12 }}>
                <Server size={14} style={{ color: "#1a2d4a" }} />
                No sweeps run this session
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                {[...sweepLog].reverse().map((e, i) => <SweepEntry key={i} entry={e} />)}
              </div>
            )}
          </div>
        </>
      )}

      {!isMaster && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(59,130,246,.05)", border: "1px solid rgba(59,130,246,.12)", borderRadius: 10, padding: "10px 14px" }}>
          <Shield size={13} style={{ color: "#3b82f6" }} />
          <span style={{ fontSize: 11, color: "#475569" }}>Sweep controls are restricted to Master only</span>
        </div>
      )}
    </div>
  );
}

// ── Right Column Tabs ─────────────────────────────────────────────────────────
const RIGHT_TABS = [
  { key: "profile", label: "Admin Profile", icon: User, accent: "#3b82f6", perm: null },
  { key: "wallet", label: "System Wallet", icon: Wallet, accent: "#f59e0b", perm: "finance.manage" },
];

function RightColumnTabs({ activeTab, onSelect , hasAccess }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "#060d1a", border: "1px solid #162236", borderRadius: 12, padding: 4 }}>
      {RIGHT_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        const allowed = !tab.perm || hasAccess(tab.perm);
        return (
          <button
            key={tab.key}
            onClick={() => allowed && onSelect(tab.key)}
            disabled={!allowed}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              padding: "9px 14px",
              borderRadius: 9,
              border: "none",
              cursor: allowed ? "pointer" : "not-allowed",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.3,
              transition: "all .18s ease",
              background: isActive ? tab.accent + "18" : "transparent",
              color: !allowed ? "#334155" : isActive ? tab.accent : "#475569",
              opacity: allowed ? 1 : 0.4,
              outline: isActive ? `1px solid ${tab.accent}33` : "1px solid transparent",
            }}
          >
            <Icon size={13} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
export default function AdminOverview() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [rightTab, setRightTab]   = useState("profile");

  const token = localStorage.getItem("token");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/dashboard/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  const balances          = data?.balances    || [];
  const users             = data?.users       || {};
  const orders            = data?.orders      || {};
  const withdrawals       = data?.withdrawals || {};
  const adminInfo         = data?.admin       || null;
  const accessPoints      = adminInfo?.access_points || [];
  const adminOrders       = adminInfo?.admin_orders || {};
  const adminBalances     = adminInfo?.balances || [];
  const adminTransactions = adminInfo?.admin_transactions || [];

  console.log("adminTransactions", adminTransactions);

  const isMaster = adminInfo?.role === "master" || adminInfo?.role === "superadmin";

  const hasAccess = (perm) => {
    if (isMaster) return true;
    if (accessPoints.includes("*")) return true;
    return accessPoints.includes(perm);
  };

  const walletAccess = hasAccess("finance.manage");

  console.log(adminInfo);

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        * { box-sizing:border-box; }
        button,input,select { font-family:inherit; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:#060d1a; }
        ::-webkit-scrollbar-thumb { background:#162236; border-radius:4px; }
      `}</style>

      <div style={{ background: "#060b16", minHeight: "100vh", height: "100vh", overflowY: "auto", overflowX: "hidden", fontFamily: "'DM Sans', system-ui, sans-serif", animation: "fadeUp .3s ease" }}>

        {/* ── Top bar ── */}
        <div style={S.topBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", flex: 1 }}>
            <div>
              <div style={{ color: "white", fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Admin Dashboard</div>
            </div>

            <StatPill
              icon={Users}
              label="Total Users"
              hasAccess={hasAccess("users.view")}
              adminValue={adminInfo?.admin_users_count}
              globalValue={users?.total_users}
              accent="#3b82f6"
              loading={loading}
            />
            <StatPill
              icon={Package}
              label="Products"
              hasAccess={hasAccess("products.view")}
              adminValue={`${adminOrders?.admin_active_products ?? "—"} / ${adminOrders?.admin_total_products ?? "—"}`}
              globalValue={`${orders?.active_products ?? "—"} / ${orders?.total_products ?? "—"}`}
              accent="#10b981"
              loading={loading}
            />
            <StatPill
              icon={ShoppingCart}
              label="Pending Orders"
              hasAccess={hasAccess("orders.view")}
              adminValue={adminOrders?.pending}
              globalValue={orders?.pending}
              accent="#f59e0b"
              loading={loading}
            />
            <StatPill
              icon={Clock}
              label="Pending Withdrawals"
              hasAccess={hasAccess("finance.manage")}
              adminValue={withdrawals?.admin_pending}
              globalValue={withdrawals?.pending_count}
              accent="#ef4444"
              loading={loading}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => loadData()} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 7, background: "#0a1628", border: "1px solid #1e3a5f", color: "#60a5fa", borderRadius: 11, padding: "10px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <RefreshCcw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              {loading ? "Refreshing…" : "Refresh All"}
            </button>
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start", padding: "10px 10px 28px" }}>

          {/* ══ LEFT ══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "0 10px" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 3, height: 20, borderRadius: 2, background: "#3b82f6" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", letterSpacing: 1.2, textTransform: "uppercase" }}>Platform & Users</span>
            </div>

            {/* Orders + Withdrawals side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Section title="My Product Orders" icon={ShoppingCart} accent="#3b82f6">
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {[
                    { label: "Pending",   val: adminOrders.pending,   color: "#f59e0b", icon: Clock },
                    { label: "Approved",  val: adminOrders.approved,  color: "#3b82f6", icon: CheckCircle },
                    { label: "Delivered", val: adminOrders.delivered, color: "#10b981", icon: CheckCircle2 },
                    { label: "Failed",    val: adminOrders.failed,    color: "#ef4444", icon: XCircle },
                  ].map(({ label, val, color, icon: Icon }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #182b43ff" }}>
                      <div style={{ width: 26, height: 26, background: color + "15", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={13} style={{ color }} />
                      </div>
                      <span style={{ flex: 1, fontSize: 13, color: "#93a3b9ff" }}>{label}</span>
                      {loading ? <Sk w={28} h={16} r={4} /> : <span style={{ fontSize: 15, fontWeight: 800, color }}>{val ?? "—"}</span>}
                    </div>
                  ))}
                </div>
              </Section>

              {hasAccess("orders.view") && (
                <Section title="Platform Orders" icon={ShoppingCart} accent="#f59e0b">
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {[
                      { label: "Pending",   val: orders.pending,   color: "#f59e0b", icon: Clock },
                      { label: "Approved",  val: orders.approved,  color: "#3b82f6", icon: CheckCircle },
                      { label: "Delivered", val: orders.delivered, color: "#10b981", icon: CheckCircle2 },
                      { label: "Failed",    val: orders.failed,    color: "#ef4444", icon: XCircle },
                    ].map(({ label, val, color, icon: Icon }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #182b43ff" }}>
                        <div style={{ width: 26, height: 26, background: color + "15", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={13} style={{ color }} />
                        </div>
                        <span style={{ flex: 1, fontSize: 13, color: "#93a3b9ff" }}>{label}</span>
                        {loading ? <Sk w={28} h={16} r={4} /> : <span style={{ fontSize: 15, fontWeight: 800, color }}>{val ?? "—"}</span>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>

            {/* Platform Balances */}
            <Section title="Platform Balances" icon={Coins} accent="#3b82f6" badge={`${balances.length} currencies`}>
              {loading ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[1, 2, 3, 4].map(i => <BalanceCard key={i} loading />)}
                </div>
              ) : balances.length === 0 ? (
                <div style={{ color: "#334155", fontSize: 13, padding: "16px 0", textAlign: "center" }}>No balance data</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {balances.map(b => (
                    <BalanceCard key={b.currency} symbol={b.currency} available={b.total_available} frozen={b.total_frozen} />
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* ══ RIGHT — Tabbed Wallet & Treasury ══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 10px" }}>

            {/* Section label */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 3, height: 20, borderRadius: 2, background: "#f59e0b" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: 1.2, textTransform: "uppercase" }}>Wallet & Treasury</span>
              <div style={{ marginLeft: "auto" }}>
                <button
                  onClick={() => loadData()}
                  disabled={loading}
                  style={{ padding: "9px 11px", borderRadius: 10, background: "#0a1628", border: "1px solid rgba(59,130,246,.4)", color: "#738092ff", cursor: "pointer", display: "flex", alignItems: "center" }}
                >
                  <RefreshCcw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                </button>
              </div>
            </div>

            {/* Tab switcher */}
            <RightColumnTabs activeTab={rightTab} onSelect={setRightTab}  hasAccess={hasAccess}/>

            {/* Tab: Admin Profile */}
            {rightTab === "profile" && (
              <AdminProfileCard
                adminInfo={adminInfo}
                loading={loading}
                adminTransactions={adminTransactions}
                token= {token}
              />
            )}

            {/* Tab: System Wallet */}
            {rightTab === "wallet" ? (
              walletAccess ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Wallet header line */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#e2e8f0", letterSpacing: -0.3 }}>Wallet Operations</div>
                    <div style={{ fontSize: 11, color: "#55657bff", marginTop: 2 }}>
                      {isMaster
                        ? `Full access — master controls enabled • ${adminBalances.length} balances`
                        : `Read-only — ${adminBalances.length} balances`}
                    </div>
                  </div>
                </div>

                <WalletPanel
                  loading={loading}
                  token={token}
                  isMaster={isMaster}
                  walletData={hasAccess("finance.manage") ? data?.wallet : null}
                  walletLoading={loading}
                  onRefresh={() => loadData()}
                  withdrawals={withdrawals}
                />
              </div>
            ) : (
              <div style={{
                padding: 18,
                borderRadius: 12,
                background: "rgba(239,68,68,.06)",
                border: "1px solid rgba(239,68,68,.2)",
                color: "#ef4444",
                fontSize: 13
              }}>
                You don’t have permission to access Wallet Management.
              </div>
            )
          ) : null}

        

          </div>
        </div>
      </div>
    </>
  );
}

const S = {
  topBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "0 28px", borderBottom: "1px solid #0a1120",
    background: "transparent", flexShrink: 0, flexWrap: "wrap", gap: 12,
  },
};