import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  CalendarClock, CircleUserRound, CreditCard, Mail,  Pencil, Phone, Save,
  Send, ShieldCheck, KeyRound, Ticket, Wallet, X,
} from "lucide-react";
import { API_URL } from "../config";
import BalancesPanel from "../components/BalancesPanel";
import InvitationsPanel from "../components/InvitationsPanel";
import SubscriptionAdminPanel from "../components/SubscriptionAdminPanel";
import PlanCard from "../components/PlanCard";
import AccessPointCard from "../components/AccessPointCard";
import PlanSwitchModal from "../components/PlanSwitchModal";
import { S as SS, T, accentFor, statusColor, fmtDateShort, fmtMoney, daysRemaining } from "../components/subscriptionTheme";

const api = axios.create({ baseURL: API_URL });
const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

function showToast(msg, ok = true) {
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed", bottom: "24px", right: "24px", zIndex: 99999,
    padding: "12px 20px", borderRadius: "12px", fontWeight: 600, fontSize: "13px",
    color: "white", pointerEvents: "none",
    background: ok ? "#16a34a" : "#dc2626",
    boxShadow: ok ? "0 8px 32px rgba(22,163,74,.35)" : "0 8px 32px rgba(220,38,38,.35)",
    transform: "translateY(8px)", opacity: 0, transition: "all .25s ease",
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = 1; el.style.transform = "translateY(0)"; });
  setTimeout(() => {
    el.style.opacity = 0; el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

const fmtDate = (value) => (value ? new Date(value).toLocaleString() : "—");


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

  
  console.log("user:", profile)
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

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <aside style={styles.sidebar}>
          <SidebarProfileCard
            profile={profile}
            isMaster={isMaster}
            onEdit={() => setProfileModalOpen(true)}
          />

          {!isMaster && <SidebarPlanChip status={myPlanStatus} />}

          <div style={styles.sectionNav}>
            {sections.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.key;
              return (
                <button key={section.key} type="button" onClick={() => setActiveSection(section.key)} style={styles.navItem(active)}>
                  <span style={styles.navItemInner}>
                    <Icon size={14} />
                    {section.label}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <main style={styles.main}>
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

        {error && (
          <div style={{ position: "fixed", top: 46, right: 16, zIndex: 9000, maxWidth: 420, background: "rgba(127,29,29,.95)", border: "1px solid rgba(239,68,68,.5)", borderRadius: 14, padding: "12px 16px", color: "#fecaca", fontSize: 13, display: "flex", gap: 10, alignItems: "flex-start", boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
            <span style={{ flex: 1 }}><strong>Error:</strong> {error}</span>
            <button type="button" onClick={() => setError("")} style={{ background: "none", border: "none", color: "#fecaca", cursor: "pointer", padding: 0, lineHeight: 1 }}><X size={14} /></button>
          </div>
        )}
      </div>

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

function Tag({ text, color }) {
  return <span style={styles.tag(color)}>{text}</span>;
}

// =========================================================
// ADMIN SUBSCRIPTION VIEW — overview, plans row, access
// points row, invoice history. Mirrors the master's panel
// visual language (PlanCard / AccessPointCard / scroll rows).
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
    const usedPct = Math.min(100, Math.max(0, 100 - (leftMs / totalMs) * 100));
    return usedPct;
  })();

  // Full plan record (with its fixed access points) for whatever plan the
  // admin is currently on, so the overview can show exactly what's
  // included — not just the plan name.
  const currentPlanFull = sub ? subCatalog.plans.find((p) => p.id === sub.plan_id) : null;
  const includedAccessPoints = currentPlanFull?.access_points || [];
  const activeAddons = mySub.addons.filter((a) => a.status !== "expired");

  return (
    <div style={styles.stack}>
      {/* ── Overview ── */}
      <div style={{ ...styles.card, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(600px 160px at 0% 0%, ${color}14, transparent)`, pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={styles.cardTitle}>Current plan</div>
          {sub ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "white" }}>{sub.plan_name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <Tag text={sub.status.toUpperCase()} color={color} />
                    {sub.forced_by_master && <span style={{ fontSize: 10.5, color: "#93c5fd" }}>Set by master</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: T.textDim, display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                    <CalendarClock size={12} /> Renews / expires
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "white", marginTop: 4 }}>
                    {sub.current_period_end ? fmtDateShort(sub.current_period_end) : "Never (free plan)"}
                  </div>
                  {remaining != null && (
                    <div style={{ fontSize: 12, color: remaining <= 3 ? "#f87171" : T.textDim, marginTop: 2 }}>
                      {remaining >= 0 ? `${remaining} day${remaining === 1 ? "" : "s"} left` : "Expired"}
                    </div>
                  )}
                </div>
              </div>

              {cyclePct != null && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ height: 6, borderRadius: 999, background: "rgba(148,163,184,0.12)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${cyclePct}%`, borderRadius: 999, background: `linear-gradient(90deg, ${color}, ${color}aa)` }} />
                  </div>
                </div>
              )}

              {sub.status === "grace" && (
                <div style={{ ...styles.alertWarn, marginTop: 14 }}>
                  Your last renewal failed. Top up your balance before the grace period ends or your plan's access points will be revoked.
                </div>
              )}

              <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                <div>
                  <div style={styles.overviewSectionLabel}>Included in your plan</div>
                  <div style={styles.chipWrapRow}>
                    {includedAccessPoints.length === 0 && <span style={styles.subtle}>No fixed access points on this plan.</span>}
                    {includedAccessPoints.map((ap) => (
                      <span key={ap.id} style={styles.accessChip("#10b981")}>
                        {ap.label}{ap.choice_group ? ` · ${ap.choice_group}` : ""}
                      </span>
                    ))}
                  </div>
                </div>

                {activeAddons.length > 0 && (
                  <div>
                    <div style={styles.overviewSectionLabel}>Your active add-ons</div>
                    <div style={styles.chipWrapRow}>
                      {activeAddons.map((a) => (
                        <span key={a.id} style={styles.accessChip("#8b5cf6")}>
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
            <div style={{ ...styles.subtle, marginTop: 10 }}>No active subscription — pick a plan below.</div>
          )}
        </div>
      </div>

      {/* ── Plans row ── */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Available plans</div>
        <div style={{ ...styles.subtle, marginTop: 2 }}>Switching resets your billing cycle and charges the full plan price.</div>
        <div style={{ ...SS.scrollRow, marginTop: 14 }}>
          {subCatalog.plans.map((plan, i) => {
            const isCurrent = sub?.plan_id === plan.id;
            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                accentColor={accentFor(plan, i)}
                current={isCurrent}
                footer={
                  isCurrent ? (
                    <div style={{ ...styles.subtle, textAlign: "center" }}>This is your current plan</div>
                  ) : plan.is_default ? (
                    <button type="button" disabled={subscribing} onClick={() => onOpenSwitch(plan)} style={{ ...styles.secondaryBtn, width: "100%", justifyContent: "center" }}>
                      Switch to Free
                    </button>
                  ) : plan.prices.length === 0 ? (
                    <div style={{ ...styles.subtle, textAlign: "center" }}>Not available yet</div>
                  ) : (
                    <button type="button" disabled={subscribing} onClick={() => onOpenSwitch(plan)} style={{ ...styles.primaryBtn, width: "100%", justifyContent: "center" }}>
                      Switch to this plan
                    </button>
                  )
                }
              />
            );
          })}
          {subCatalog.plans.length === 0 && <div style={styles.subtle}>No plans available.</div>}
        </div>
      </div>

      {/* ── Access points row ── */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Add-ons</div>
        <div style={{ ...styles.subtle, marginTop: 2 }}>Purchase extra access points priced by master, where your plan allows it. Anything already included free in your current plan won't be listed here.</div>
        <div style={{ ...SS.scrollRow, marginTop: 14 }}>
          {subCatalog.access_points.map((ap, i) => {
            const owned = mySub.addons.find((a) => a.key === ap.key && a.status !== "expired");
            const eligible = isAddonEligible(ap);
            return (
              <AccessPointCard
                key={ap.id}
                ap={ap}
                accentColor={["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899"][i % 5]}
                muted={!owned && !eligible}
                statusChip={owned ? { text: owned.status.toUpperCase(), color: statusColor(owned.status) } : null}
                footer={
                  owned ? (
                    <button type="button" onClick={() => onCancelAddon(ap.id)} style={{ ...styles.secondaryBtn, width: "100%", justifyContent: "center", color: "#f87171" }}>
                      Cancel
                    </button>
                  ) : !eligible ? (
                    <button type="button" disabled style={{ ...styles.secondaryBtn, width: "100%", justifyContent: "center", cursor: "not-allowed" }}>
                      Requires {ap.required_plans.map((p) => p.name).join(" or ")}
                    </button>
                  ) : ap.prices.length === 0 ? (
                    <div style={{ ...styles.subtle, textAlign: "center" }}>Not available yet</div>
                  ) : (
                    <button
                      type="button"
                      disabled={purchasingAddonId === ap.id}
                      onClick={() => onBuyAddon(ap.id, ap.prices[0].currency_id, ap.prices[0].network_id)}
                      style={{ ...styles.primaryBtn, width: "100%", justifyContent: "center" }}
                    >
                      {purchasingAddonId === ap.id ? "Adding…" : ap.prices[0].effective_price === 0 ? "Add for free" : "Buy add-on"}
                    </button>
                  )
                }
              />
            );
          })}
          {subCatalog.access_points.length === 0 && <div style={styles.subtle}>No add-ons available.</div>}
        </div>
      </div>

      {/* ── Invoices ── */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Invoice history</div>
        <div style={{ marginTop: 10 }}>
          {mySub.invoices.map((i) => (
            <div key={i.id} style={styles.invoiceRow}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "white" }}>
                  {i.type === "plan" ? i.plan_name : i.access_point_key}
                </div>
                <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>{fmtDateShort(i.created_at)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: "white" }}>
                  {fmtMoney(i.amount)} {i.currency}
                  {i.discount_percent > 0 && <span style={{ color: "#f59e0b", fontWeight: 700 }}> -{i.discount_percent}%</span>}
                </div>
                <div style={{ fontSize: 11, color: statusColor(i.status === "paid" ? "active" : i.status === "failed" ? "expired" : "grace"), marginTop: 2, fontWeight: 700 }}>{i.status}</div>
              </div>
            </div>
          ))}
          {mySub.invoices.length === 0 && <div style={styles.subtle}>No invoices yet.</div>}
        </div>
      </div>
    </div>
  );
}

// =========================================================
// SIDEBAR — merged profile card (compact, fits 260px column)
// =========================================================
function SidebarProfileCard({ profile, isMaster, onEdit }) {
  const initials = (profile?.first_name || profile?.username || "?").slice(0, 1).toUpperCase();
  const isActive = String(profile?.status || "").toLowerCase() === "active";
  return (
    <div style={styles.profileCard}>
      <div style={styles.profileTopRow}>
        <div style={styles.profileAvatarWrap}>
          <div style={styles.profileAvatar}>{initials}</div>
          <span style={styles.profileStatusDot(isActive)} />
        </div>
        <button type="button" onClick={onEdit} style={styles.editIconBtn} title="Edit profile">
          <Pencil size={12} />
        </button>
      </div>

      <div style={styles.profileName}>{profile?.full_name || profile?.username || "—"}</div>
      <div style={styles.profileHandle}>@{profile?.username || "—"}</div>

      <div style={styles.profileChipsRow}>
        <Tag text={String(profile?.status || "unknown").toUpperCase()} color={isActive ? "#10b981" : "#f87171"} />
        {profile?.role && (
          <span style={styles.profileMiniChip}>
            <ShieldCheck size={11} /> {String(profile.role).toUpperCase()}
          </span>
        )}
      </div>

      <div style={styles.profileDetailList}>
        {profile?.email && (
          <div style={styles.profileDetailRow}><Mail size={11} /> <span>{profile.email}</span></div>
        )}
        {profile?.phone_number && (
          <div style={styles.profileDetailRow}><Phone size={11} /> <span>{profile.phone_number}</span></div>
        )}
        {profile?.telegram_id && (
          <div style={styles.profileDetailRow}><Send size={11} /> <span>{profile.telegram_id}</span></div>
        )}
        {profile?.account_id && (
          <div style={styles.profileDetailRow}><KeyRound size={11} /> <span style={{ wordBreak: "break-all" }}>#{profile.account_id}</span></div>
        )}
      </div>
    </div>
  );
}

// Subscription status chip for the sidebar — plan name, status, and a
// short "days left" readout so it doubles as an at-a-glance summary.
function SidebarPlanChip({ status }) {
  const color = status ? statusColor(status.status) : "#64748b";
  const remaining = status ? daysRemaining(status.current_period_end) : null;
  return (
    <div style={styles.planChip}>
      <div style={styles.planChipTopRow}>
        <span style={styles.planChipLabel}>Subscription</span>
        {status && <span style={styles.planChipTag(color)}>{status.status.toUpperCase()}</span>}
      </div>
      {status ? (
        <>
          <div style={styles.planChipName}>{status.plan_name}</div>
          <div style={styles.planChipMeta}>
            {status.current_period_end ? (
              <>
                <CalendarClock size={11} />
                {remaining != null && remaining >= 0 ? `${remaining}d left` : "Renewal date passed"}
                <span style={{ color: T.textFaint }}>· {fmtDateShort(status.current_period_end)}</span>
              </>
            ) : "Free plan · never expires"}
          </div>
        </>
      ) : (
        <span style={styles.subtle}>No subscription yet</span>
      )}
    </div>
  );
}

function ProfileModal({ title, draft, setDraft, onClose, onSave, saving }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.cardTitle}>Edit {title}</div>
            <div style={styles.subtle}>Update one field at a time without leaving the page.</div>
          </div>
          <button type="button" onClick={onClose} style={styles.closeBtn}>
            <X size={14} />
          </button>
        </div>
        <div style={styles.formGrid}>
          <Field label="First name" value={draft.first_name} onChange={(value) => setDraft((prev) => ({ ...prev, first_name: value }))} />
          <Field label="Last name" value={draft.last_name} onChange={(value) => setDraft((prev) => ({ ...prev, last_name: value }))} />
          <Field label="Email" value={draft.email} onChange={(value) => setDraft((prev) => ({ ...prev, email: value }))} />
          <Field label="Phone" value={draft.phone_number} onChange={(value) => setDraft((prev) => ({ ...prev, phone_number: value }))} />
        </div>
        <div style={styles.rowGap}>
          <button type="button" onClick={onSave} style={styles.primaryBtn} disabled={saving}>
            <Save size={13} /> {saving ? "Saving..." : "Save changes"}
          </button>
          <button type="button" onClick={onClose} style={styles.ghostBtn}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label style={styles.inputWrap}>
      <span style={styles.metaLabel}>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} style={styles.input} />
    </label>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#060b16", color: "white" },
  wrapper: { display: "grid", gridTemplateColumns: "380px 1fr", minHeight: "100vh" },
  sidebar: {
    position: "sticky",
    top: 0,
    height: "100vh",
    padding: 18,
    background: "#040a14",
    borderRight: "1px solid #15243c",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    overflowY: "auto",
  },

  // ── Profile card (merged into sidebar) ──
  profileCard: {
    borderRadius: 16,
    border: "1px solid #223451",
    background: "linear-gradient(160deg, rgba(15,27,48,.98), rgba(8,15,29,.96))",
    padding: 14,
  },
  profileTopRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  profileAvatarWrap: { position: "relative" },
  profileAvatar: {
    width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 900, fontSize: 18,
    background: "linear-gradient(160deg, rgba(59,130,246,.28), rgba(139,92,246,.2))",
    border: "1px solid rgba(96,165,250,.45)", color: "#dbeafe",
  },
  profileStatusDot: (active) => ({
    position: "absolute", bottom: -2, right: -2, width: 11, height: 11, borderRadius: "50%",
    background: active ? "#10b981" : "#f87171", border: "2px solid #0b1628",
  }),
  editIconBtn: {
    width: 26, height: 26, borderRadius: 8, border: "1px solid #223451", background: "#0b1628",
    color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  profileName: { fontSize: 15, fontWeight: 800, marginTop: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  profileHandle: { fontSize: 11, color: "#64748b", marginTop: 2 },
  profileChipsRow: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 },
  profileMiniChip: {
    display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999,
    background: "#0d1c33", border: "1px solid #223451", color: "#93c5fd", fontSize: 10, fontWeight: 700,
  },
  profileDetailList: { display: "flex", flexDirection: "column", gap: 6, marginTop: 10 },
  profileDetailRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" },

  // ── Plan status chip ──
  planChip: { borderRadius: 14, border: "1px solid #223451", background: "linear-gradient(160deg, rgba(15,27,48,.9), rgba(8,15,29,.9))", padding: 12 },
  planChipTopRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  planChipLabel: { fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: 0.6 },
  planChipName: { fontSize: 14, fontWeight: 800, color: "white", marginTop: 6 },
  planChipMeta: { display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#94a3b8", marginTop: 5 },
  planChipTag: (color) => ({
    fontSize: 9, fontWeight: 800, color, background: `${color}22`, border: `1px solid ${color}`,
    borderRadius: 999, padding: "2px 7px",
  }),

  title: { color: "#2e7ce9af", margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "0.1rem" },
  subtitle: { color: "#64748b", fontSize: 13, margin: "2px 0 0" },
  subtle: { fontSize: 12, color: "#7c8ca8" },

  sectionNav: { display: "flex", flexDirection: "column", gap: 8, marginTop: 4 },
  navItem: (active) => ({
    border: `1px solid ${active ? "#3b82f6" : "#223451"}`,
    background: active ? "rgba(59,130,246,.18)" : "#0b1628",
    color: active ? "#bfdbfe" : "#94a3b8",
    borderRadius: 12,
    minHeight: 42,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
  }),
  navItemInner: { display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 },

  main: { padding: 20, paddingBottom: 60, overflowY: "auto", height: "100vh" },
  stack: { display: "flex", flexDirection: "column", gap: 16 },
  card: {
    borderRadius: 18,
    border: "1px solid #223451",
    background: "linear-gradient(180deg, rgba(11,22,40,.98), rgba(8,18,36,.94))",
    padding: 16,
    boxShadow: "0 16px 42px rgba(0,0,0,.25)",
  },
  cardTitle: { fontSize: 16, fontWeight: 800, marginBottom: 4 },
  rowGap: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  tag: (color) => ({
    display: "inline-flex", alignItems: "center", minHeight: 28, padding: "0 10px",
    borderRadius: 999, border: `1px solid ${color}`, background: `${color}22`, color, fontSize: 11, fontWeight: 800,
  }),
  alertWarn: {
    padding: 14, borderRadius: 14, background: "rgba(120,53,15,.18)", border: "1px solid rgba(245,158,11,.35)", color: "#fde68a",
  },
  overviewSectionLabel: { fontSize: 10.5, fontWeight: 800, color: "#64748b", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
  chipWrapRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  accessChip: (color) => ({
    fontSize: 11.5, fontWeight: 700, color, background: `${color}1a`, border: `1px solid ${color}55`,
    borderRadius: 999, padding: "5px 11px",
  }),
  invoiceRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0",
    borderBottom: "1px solid rgba(148,163,184,0.1)",
  },

  input: { width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #29405e", background: "#081224", color: "white", boxSizing: "border-box" },
  inputWrap: { display: "grid", gap: 6 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  metaLabel: { color: "#7c8ca8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7 },

  primaryBtn: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 12px",
    borderRadius: 12, border: "1px solid rgba(59,130,246,.4)", background: "rgba(37,99,235,.18)", color: "#bfdbfe", fontWeight: 800, cursor: "pointer",
  },
  secondaryBtn: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px",
    borderRadius: 12, border: "1px solid #28405f", background: "#0e1a2d", color: "#cbd5e1", fontWeight: 700, cursor: "pointer",
  },
  ghostBtn: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px",
    borderRadius: 12, border: "1px solid #2d3a52", background: "transparent", color: "#94a3b8", fontWeight: 700, cursor: "pointer",
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10, border: "1px solid #31425f", background: "#0b1527", color: "#94a3b8",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },

  messageLayout: { display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(260px, .9fr)", gap: 12, marginTop: 14 },
  messageThread: { minHeight: 280, maxHeight: 540, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 },
  composeCard: { display: "grid", gap: 10, alignContent: "start" },
  textarea: {
    width: "100%", minHeight: 140, padding: 12, borderRadius: 14, border: "1px solid #29405e",
    background: "#081224", color: "white", resize: "vertical", boxSizing: "border-box",
  },
  messageBubble: (mine) => ({
    alignSelf: mine ? "flex-end" : "flex-start",
    maxWidth: "78%",
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${mine ? "rgba(59,130,246,.32)" : "#27364e"}`,
    background: mine ? "rgba(37,99,235,.18)" : "#091629",
  }),
  messageMeta: { fontSize: 10, color: "#94a3b8", marginBottom: 6 },
  messageLink: { color: "#93c5fd", display: "inline-block", marginTop: 8 },

  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 2500,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
  },
  modal: {
    width: "min(680px, 96vw)", borderRadius: 20, border: "1px solid #223451",
    background: "linear-gradient(180deg, #0b1628 0%, #091629 100%)", padding: 18,
    boxShadow: "0 30px 90px rgba(0,0,0,.6)", display: "grid", gap: 16,
  },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
};