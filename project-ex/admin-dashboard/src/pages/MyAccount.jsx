import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  CalendarClock, CreditCard, Mail, Pencil, Phone, Save,
  Send, ShieldCheck, KeyRound, Ticket, Wallet, X,
} from "lucide-react";
import { API_URL } from "../config";
import BalancesPanel from "../components/account/BalancesPanel";
import InvitationsPanel from "../components/account/InvitationsPanel";
import SubscriptionAdminPanel from "../components/account/SubscriptionAdminPanel";
import PlanCard from "../components/account/PlanCard";
import AccessPointCard from "../components/account/AccessPointCard";
import PlanSwitchModal from "../components/account/PlanSwitchModal";
import { Tag } from "../components/account/AccountBits";
import { authHeaders, showToast } from "../components/account/accountUtils";
import { accentFor, statusColor, fmtDateShort, fmtMoney, daysRemaining } from "../components/account/SubscriptionTheme";
import "./MyAccount.css";

const api = axios.create({ baseURL: API_URL });

const sectionsBase = [
  { key: "balances", label: "Balances", icon: Wallet },
  { key: "subscription", label: "Subscription", icon: CreditCard },
  { key: "invitations", label: "Invitations", icon: Ticket },
];

const emptyProfileDraft = { first_name: "", last_name: "", email: "", phone_number: "" };

export default function MyAccount() {
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);

  const [activeSection, setActiveSection] = useState("balances");

  const [profileDraft, setProfileDraft] = useState(emptyProfileDraft);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);


  const [subCatalog, setSubCatalog] = useState({ plans: [], access_points: [] });
  const [mySub, setMySub] = useState({ subscription: null, addons: [], invoices: [] });
  const [subscribing, setSubscribing] = useState(false);
  const [purchasingAddonId, setPurchasingAddonId] = useState(null);
  const [myPlanStatus, setMyPlanStatus] = useState(null); // lightweight status for the sidebar
  const [switchTarget, setSwitchTarget] = useState(null); // plan object mid-switch confirmation

  const role = (profile?.role || "").toLowerCase();
  const isMaster = role === "master" || role === "superadmin";

  const sections = sectionsBase;

  
  // =========================================================
  // PROFILE
  // =========================================================
  const loadProfile = useCallback(async () => {
    if (!token) {
      setError("Missing authentication token.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin-account/summary", { headers: authHeaders(token) });
      setProfile(res.data?.profile || null);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Failed to load account summary.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    setProfileDraft({
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
      email: profile?.email || "",
      phone_number: profile?.phone_number || "",
    });
  }, [profile]);

  const saveProfile = async () => {
    if (!token) return;
    setSavingProfile(true);
    try {
      await api.put("/admin-account/me", profileDraft, { headers: authHeaders(token) });
      setProfileModalOpen(false);
      showToast("Profile saved");
      await loadProfile();
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to save profile.", false);
    } finally {
      setSavingProfile(false);
    }
  };

  // =========================================================
  // SUBSCRIPTION (self-serve, admin only) — also feeds the
  // lightweight plan-status chip in the sidebar
  // =========================================================
  const loadSubscription = useCallback(async () => {
    if (!token || isMaster) return;
    try {
      const [catRes, meRes] = await Promise.all([
        api.get("/admin/subscriptions/catalog", { headers: authHeaders(token) }),
        api.get("/admin/subscriptions/me", { headers: authHeaders(token) }),
      ]);
      setSubCatalog(catRes.data || { plans: [], access_points: [] });
      setMySub(meRes.data || { subscription: null, addons: [], invoices: [] });
      setMyPlanStatus(meRes.data?.subscription || null);
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to load subscription.", false);
    }
  }, [isMaster, token]);

  // Load once profile resolves (for the sidebar chip), then again whenever
  // the Subscription tab is opened (in case it changed elsewhere).
  useEffect(() => {
    if (profile && !isMaster) void loadSubscription();
  }, [profile, isMaster, loadSubscription]);

  useEffect(() => {
    if (activeSection === "subscription" && !isMaster) {
      void loadSubscription();
    }
  }, [activeSection, isMaster, loadSubscription]);

  const subscribeToPlan = async (planId, currencyId, networkId) => {
    setSubscribing(true);
    try {
      await api.post(
        "/admin/subscriptions/me/subscribe",
        { plan_id: planId, currency_id: currencyId || null, network_id: networkId || null },
        { headers: authHeaders(token) }
      );
      showToast("Subscribed successfully");
      setSwitchTarget(null);
      await loadSubscription();
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Subscription failed.", false);
      throw err;
    } finally {
      setSubscribing(false);
    }
  };

  const buyAddon = async (accessPointId, currencyId, networkId) => {
    setPurchasingAddonId(accessPointId);
    try {
      await api.post(
        "/admin/subscriptions/me/addons",
        { access_point_id: accessPointId, currency_id: currencyId, network_id: networkId },
        { headers: authHeaders(token) }
      );
      showToast("Add-on purchased");
      await loadSubscription();
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Purchase failed.", false);
    } finally {
      setPurchasingAddonId(null);
    }
  };

  const cancelAddon = async (accessPointId) => {
    try {
      await api.delete(`/admin/subscriptions/me/addons/${accessPointId}`, { headers: authHeaders(token) });
      showToast("Add-on cancelled");
      await loadSubscription();
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Cancel failed.", false);
    }
  };

  // Mirrors the backend's eligibility check — backend is the real
  // enforcement point (403 on purchase), this only drives the UI. An
  // add-on with no required plans is open to everyone; otherwise the
  // admin's current plan just needs to be ANY ONE of the listed plans.
  const isAddonEligible = (ap) => {
    if (!ap.required_plan_ids || ap.required_plan_ids.length === 0) return true;
    const sub = mySub.subscription;
    return !!sub && ap.required_plan_ids.includes(sub.plan_id) && (sub.status === "active" || sub.status === "grace");
  };


  const profileTitle = isMaster ? "Master Info" : "Admin Info";

  // The app shell doesn't scroll, so this page is its own scroll container.
  // Fit it to whatever viewport space is left below any header the shell adds
  // (also handles mobile browser toolbars / rotation).
  const pageRef = useRef(null);
  const [pageH, setPageH] = useState(null);
  useEffect(() => {
    const fit = () => {
      const el = pageRef.current;
      if (!el) return;
      const top = Math.max(0, el.getBoundingClientRect().top);
      const vh = window.visualViewport?.height || window.innerHeight;
      setPageH(Math.max(320, Math.round(vh - top)));
    };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
  }, []);

  return (
    <div className="ma-page" ref={pageRef} style={pageH ? { height: pageH } : undefined}>
      <div className="ma-shell">
        {/* ── Hero hub ── */}
        <ProfileHero
          profile={profile}
          loading={loading}
          isMaster={isMaster}
          planStatus={myPlanStatus}
          onEdit={() => setProfileModalOpen(true)}
        />

        {/* ── Tabs ── */}
        <nav className="ma-tabs" aria-label="Account sections">
          <div className="ma-tabbar" role="tablist">
            {sections.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveSection(section.key)}
                  className={`ma-tab${active ? " is-active" : ""}`}
                >
                  <Icon size={15} />
                  {section.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Tab content ── */}
        <main className="ma-content" role="tabpanel">
          {activeSection === "balances" && <BalancesPanel isMaster={isMaster} />}

          {activeSection === "subscription" && (
            isMaster ? (
              <SubscriptionAdminPanel />
            ) : (
              <AdminSubscriptionView
                mySub={mySub}
                subCatalog={subCatalog}
                subscribing={subscribing}
                purchasingAddonId={purchasingAddonId}
                isAddonEligible={isAddonEligible}
                onOpenSwitch={(plan) => setSwitchTarget(plan)}
                onBuyAddon={buyAddon}
                onCancelAddon={cancelAddon}
              />
            )
          )}

          {activeSection === "invitations" && <InvitationsPanel isMaster={isMaster} />}
        </main>
      </div>

      {error && (
        <div className="ma-alert ma-alert--err" style={{ position: "fixed", top: 16, right: 16, left: "auto", zIndex: 9000, maxWidth: "min(420px, calc(100vw - 32px))", display: "flex", gap: 10, alignItems: "flex-start", boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
          <span style={{ flex: 1 }}><strong>Error:</strong> {error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss" style={{ background: "none", border: "none", color: "#fecaca", cursor: "pointer", padding: 0, lineHeight: 1 }}><X size={14} /></button>
        </div>
      )}

      {profileModalOpen && (
        <ProfileModal
          title={profileTitle}
          draft={profileDraft}
          setDraft={setProfileDraft}
          onClose={() => setProfileModalOpen(false)}
          onSave={saveProfile}
          saving={savingProfile}
        />
      )}

      {switchTarget && (
        <PlanSwitchModal
          currentPlanName={mySub.subscription?.plan_name}
          plan={switchTarget}
          onClose={() => setSwitchTarget(null)}
          onConfirm={(cid, nid) => subscribeToPlan(switchTarget.id, cid, nid)}
        />
      )}
    </div>
  );
}

// =========================================================
// HERO HUB — narrow profile container (replaces the sidebar)
// =========================================================
function ProfileHero({ profile, loading, isMaster, planStatus, onEdit }) {
  const initials = (profile?.first_name || profile?.username || "?").slice(0, 1).toUpperCase();
  const isActive = String(profile?.status || "").toLowerCase() === "active";
  const planColor = planStatus ? statusColor(planStatus.status) : "#64748b";
  const remaining = planStatus ? daysRemaining(planStatus.current_period_end) : null;

  return (
    <header className={`ma-hero${!isMaster ? " ma-hero--plan" : ""}`}>
      <div className="ma-hero-main">
        <div className="ma-avatar-wrap">
          <div className="ma-avatar">{initials}</div>
          <span className={`ma-avatar-dot${isActive ? " is-on" : ""}`} />
        </div>

        <div className="ma-hero-id">
          <div className="ma-hero-name">{profile?.full_name || profile?.username || (loading ? "Loading…" : "—")}</div>
          <div className="ma-hero-handle">@{profile?.username || "—"}</div>
          <div className="ma-hero-chips">
            <Tag text={String(profile?.status || "unknown").toUpperCase()} color={isActive ? "#10b981" : "#f87171"} />
            {profile?.role && (
              <span className="ma-pill"><ShieldCheck size={11} /> {String(profile.role).toUpperCase()}</span>
            )}
            
        <button type="button" onClick={onEdit} className="ma-iconBtn" title="Edit profile" aria-label="Edit profile" style={{ alignSelf: "flex-start" }}>
          <Pencil size={13} />
        </button>
          </div>
          
        </div>

      </div>

      {(profile?.email || profile?.phone_number || profile?.telegram_id || profile?.account_id) && (
        <div className="ma-hero-details">
          {profile?.email && <span className="ma-detail" title={profile.email}><Mail size={12} /><span>{profile.email}</span></span>}
          {profile?.phone_number && <span className="ma-detail"><Phone size={12} /><span>{profile.phone_number}</span></span>}
          {profile?.telegram_id && <span className="ma-detail"><Send size={12} /><span>{profile.telegram_id}</span></span>}
          {profile?.account_id && <span className="ma-detail"><KeyRound size={12} /><span>#{profile.account_id}</span></span>}
        </div>
      )}

      {!isMaster && (
        <div className="ma-hero-plan">
          <div>
            <div className="ma-label">Subscription</div>
            {planStatus ? (
              <>
                <div className="ma-hero-plan-name">{planStatus.plan_name}</div>
                <div className="ma-hero-plan-meta">
                  {planStatus.current_period_end ? (
                    <>
                      <CalendarClock size={11} />
                      {remaining != null && remaining >= 0 ? `${remaining}d left` : "Renewal date passed"}
                      <span className="ma-faint">· {fmtDateShort(planStatus.current_period_end)}</span>
                    </>
                  ) : "Free plan · never expires"}
                </div>
              </>
            ) : (
              <div className="ma-subtle" style={{ marginTop: 3 }}>No subscription yet</div>
            )}
          </div>
          {planStatus && <Tag text={planStatus.status.toUpperCase()} color={planColor} />}
        </div>
      )}
    </header>
  );
}

// =========================================================
// ADMIN SUBSCRIPTION VIEW — overview + invoices on top, then
// plans grid and add-ons grid (scroll-snap rows on mobile).
// =========================================================
function AdminSubscriptionView({
  mySub, subCatalog, subscribing, purchasingAddonId, isAddonEligible,
  onOpenSwitch, onBuyAddon, onCancelAddon,
}) {
  const sub = mySub.subscription;
  const color = sub ? statusColor(sub.status) : "#64748b";
  const remaining = sub ? daysRemaining(sub.current_period_end) : null;
  const cyclePct = (() => {
    if (!sub?.current_period_end || !sub?.duration_days) return null;
    const totalMs = sub.duration_days * 86400000;
    const leftMs = new Date(sub.current_period_end).getTime() - Date.now();
    return Math.min(100, Math.max(0, 100 - (leftMs / totalMs) * 100));
  })();

  const currentPlanFull = sub ? subCatalog.plans.find((p) => p.id === sub.plan_id) : null;
  const includedAccessPoints = currentPlanFull?.access_points || [];
  const activeAddons = mySub.addons.filter((a) => a.status !== "expired");

  return (
    <div className="ma-stack">
      <div className="ma-sub-top">
        {/* ── Overview ── */}
        <section className="ma-card ma-plan-hero" style={{ "--ma-glow": `${color}22` }}>
          <div className="ma-card-title">Current plan</div>
          {sub ? (
            <>
              <div className="ma-row-between" style={{ alignItems: "flex-start", marginTop: 12 }}>
                <div>
                  <div className="ma-plan-name">{sub.plan_name}</div>
                  <div className="ma-row" style={{ marginTop: 8 }}>
                    <Tag text={sub.status.toUpperCase()} color={color} />
                    {sub.forced_by_master && <span style={{ fontSize: 10.5, color: "#93c5fd" }}>Set by master</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="ma-subtle" style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                    <CalendarClock size={12} /> Renews / expires
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>
                    {sub.current_period_end ? fmtDateShort(sub.current_period_end) : "Never (free plan)"}
                  </div>
                  {remaining != null && (
                    <div style={{ fontSize: 12, color: remaining <= 3 ? "#f87171" : "#7c8ca8", marginTop: 2 }}>
                      {remaining >= 0 ? `${remaining} day${remaining === 1 ? "" : "s"} left` : "Expired"}
                    </div>
                  )}
                </div>
              </div>

              {cyclePct != null && (
                <div className="ma-progress"><div style={{ width: `${cyclePct}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }} /></div>
              )}

              {sub.status === "grace" && (
                <div className="ma-alert ma-alert--warn" style={{ marginTop: 14 }}>
                  Your last renewal failed. Top up your balance before the grace period ends or your plan's access points will be revoked.
                </div>
              )}

              <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                <div>
                  <div className="ma-sectionLabel">Included in your plan</div>
                  <div className="ma-chipWrap">
                    {includedAccessPoints.length === 0 && <span className="ma-subtle">No fixed access points on this plan.</span>}
                    {includedAccessPoints.map((ap) => (
                      <span key={ap.id} className="ma-accessChip" style={{ color: "#10b981", background: "#10b9811a", borderColor: "#10b98155" }}>
                        {ap.label}{ap.choice_group ? ` · ${ap.choice_group}` : ""}
                      </span>
                    ))}
                  </div>
                </div>

                {activeAddons.length > 0 && (
                  <div>
                    <div className="ma-sectionLabel">Your active add-ons</div>
                    <div className="ma-chipWrap">
                      {activeAddons.map((a) => (
                        <span key={a.id} className="ma-accessChip" style={{ color: "#8b5cf6", background: "#8b5cf61a", borderColor: "#8b5cf655" }}>
                          {a.label || a.key}
                          {a.status === "grace" && <span style={{ color: "#fbbf24" }}> · grace</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="ma-subtle" style={{ marginTop: 10 }}>No active subscription — pick a plan below.</div>
          )}
        </section>

        {/* ── Invoices ── */}
        <section className="ma-card">
          <div className="ma-card-title">Invoice history</div>
          <div className="ma-scrollY" style={{ marginTop: 8, maxHeight: 420 }}>
            {mySub.invoices.map((i) => (
              <div key={i.id} className="ma-invoice">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>{i.type === "plan" ? i.plan_name : i.access_point_key}</div>
                  <div className="ma-subtle ma-faint" style={{ marginTop: 2 }}>{fmtDateShort(i.created_at)}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>
                    {fmtMoney(i.amount)} {i.currency}
                    {i.discount_percent > 0 && <span style={{ color: "#f59e0b", fontWeight: 700 }}> -{i.discount_percent}%</span>}
                  </div>
                  <div style={{ fontSize: 11, color: statusColor(i.status === "paid" ? "active" : i.status === "failed" ? "expired" : "grace"), marginTop: 2, fontWeight: 700 }}>{i.status}</div>
                </div>
              </div>
            ))}
            {mySub.invoices.length === 0 && <div className="ma-empty">No invoices yet.</div>}
          </div>
        </section>
      </div>

      {/* ── Plans ── */}
      <section className="ma-card">
        <div className="ma-card-title">Available plans</div>
        <div className="ma-subtle">Switching resets your billing cycle and charges the full plan price.</div>
        <div className="ma-cardGrid" style={{ marginTop: 14 }}>
          {subCatalog.plans.map((plan, i) => {
            const isCurrent = sub?.plan_id === plan.id;
            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                width="100%"
                accentColor={accentFor(plan, i)}
                current={isCurrent}
                footer={
                  isCurrent ? (
                    <div className="ma-subtle" style={{ textAlign: "center" }}>This is your current plan</div>
                  ) : plan.is_default ? (
                    <button type="button" disabled={subscribing} onClick={() => onOpenSwitch(plan)} className="ma-btn ma-btn--block">Switch to Free</button>
                  ) : plan.prices.length === 0 ? (
                    <div className="ma-subtle" style={{ textAlign: "center" }}>Not available yet</div>
                  ) : (
                    <button type="button" disabled={subscribing} onClick={() => onOpenSwitch(plan)} className="ma-btn ma-btn--primary ma-btn--block">Switch to this plan</button>
                  )
                }
              />
            );
          })}
        </div>
        {subCatalog.plans.length === 0 && <div className="ma-empty">No plans available.</div>}
      </section>

      {/* ── Add-ons ── */}
      <section className="ma-card">
        <div className="ma-card-title">Add-ons</div>
        <div className="ma-subtle">Purchase extra access points priced by master, where your plan allows it. Anything already included free in your current plan won't be listed here.</div>
        <div className="ma-cardGrid ma-cardGrid--ap" style={{ marginTop: 14 }}>
          {subCatalog.access_points.map((ap, i) => {
            const owned = mySub.addons.find((a) => a.key === ap.key && a.status !== "expired");
            const eligible = isAddonEligible(ap);
            return (
              <AccessPointCard
                key={ap.id}
                ap={ap}
                width="100%"
                accentColor={["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899"][i % 5]}
                muted={!owned && !eligible}
                statusChip={owned ? { text: owned.status.toUpperCase(), color: statusColor(owned.status) } : null}
                footer={
                  owned ? (
                    <button type="button" onClick={() => onCancelAddon(ap.id)} className="ma-btn ma-btn--block" style={{ color: "#f87171" }}>Cancel</button>
                  ) : !eligible ? (
                    <button type="button" disabled className="ma-btn ma-btn--block" style={{ cursor: "not-allowed", whiteSpace: "normal" }}>
                      Requires {ap.required_plans.map((p) => p.name).join(" or ")}
                    </button>
                  ) : ap.prices.length === 0 ? (
                    <div className="ma-subtle" style={{ textAlign: "center" }}>Not available yet</div>
                  ) : (
                    <button
                      type="button"
                      disabled={purchasingAddonId === ap.id}
                      onClick={() => onBuyAddon(ap.id, ap.prices[0].currency_id, ap.prices[0].network_id)}
                      className="ma-btn ma-btn--primary ma-btn--block"
                    >
                      {purchasingAddonId === ap.id ? "Adding…" : ap.prices[0].effective_price === 0 ? "Add for free" : "Buy add-on"}
                    </button>
                  )
                }
              />
            );
          })}
        </div>
        {subCatalog.access_points.length === 0 && <div className="ma-empty">No add-ons available.</div>}
      </section>
    </div>
  );
}

function ProfileModal({ title, draft, setDraft, onClose, onSave, saving }) {
  const set = (key) => (value) => setDraft((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="ma-modalOverlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ma-modal ma-modal--md">
        <div className="ma-modalHeader">
          <div>
            <div className="ma-modalTitle">Edit {title}</div>
            <div className="ma-modalSub">Update one field at a time without leaving the page.</div>
          </div>
          <button type="button" onClick={onClose} className="ma-closeBtn"><X size={14} /></button>
        </div>
        <div className="ma-formGrid">
          <Field label="First name" value={draft.first_name} onChange={set("first_name")} />
          <Field label="Last name" value={draft.last_name} onChange={set("last_name")} />
          <Field label="Email" value={draft.email} onChange={set("email")} />
          <Field label="Phone" value={draft.phone_number} onChange={set("phone_number")} />
        </div>
        <div className="ma-modalActions">
          <button type="button" onClick={onSave} className="ma-btn ma-btn--primary" disabled={saving}>
            <Save size={13} /> {saving ? "Saving..." : "Save changes"}
          </button>
          <button type="button" onClick={onClose} className="ma-btn ma-btn--ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="ma-field">
      <span className="ma-label">{label}</span>
      <input className="ma-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}