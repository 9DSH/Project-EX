import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  CircleUserRound, CreditCard, Mail, MessageSquare, Pencil, Phone, Save,
  Send, ShieldCheck, KeyRound, Ticket, Wallet, X,
} from "lucide-react";
import { API_URL } from "../config";
import BalancesPanel from "../components/BalancesPanel";
import InvitationsPanel from "../components/InvitationsPanel";
import SubscriptionAdminPanel from "../components/SubscriptionAdminPanel";
import PlanCard from "../components/PlanCard";

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
const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

const sectionsBase = [
  { key: "balances", label: "Balances", icon: Wallet },
  { key: "subscription", label: "Subscription", icon: CreditCard },
  { key: "invitations", label: "Invitations", icon: Ticket },
  { key: "messages", label: "Messages", icon: MessageSquare },
];

const emptyProfileDraft = { first_name: "", last_name: "", email: "", phone_number: "" };

export default function MyAccount() {
  const token = localStorage.getItem("token");
  const messagesBottomRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);

  const [activeSection, setActiveSection] = useState("balances");

  const [profileDraft, setProfileDraft] = useState(emptyProfileDraft);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageFile, setMessageFile] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [subCatalog, setSubCatalog] = useState({ plans: [], access_points: [] });
  const [mySub, setMySub] = useState({ subscription: null, addons: [], invoices: [] });
  const [subscribing, setSubscribing] = useState(false);
  const [purchasingAddonId, setPurchasingAddonId] = useState(null);
  const [myPlanStatus, setMyPlanStatus] = useState(null); // lightweight status for the sidebar

  const role = (profile?.role || "").toLowerCase();
  const isMaster = role === "master" || role === "superadmin";

  const sections = useMemo(
    () => sectionsBase.filter((s) => (isMaster ? s.key !== "messages" : true)),
    [isMaster]
  );

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
      await loadSubscription();
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Subscription failed.", false);
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

  // Mirrors the backend's _assert_required_plan check — backend is the
  // real enforcement point (403 on purchase), this only drives the UI.
  const isAddonEligible = (ap) => {
    if (!ap.required_plan_id) return true;
    const sub = mySub.subscription;
    return !!sub && sub.plan_id === ap.required_plan_id && (sub.status === "active" || sub.status === "grace");
  };

  // =========================================================
  // MESSAGES (admin -> master thread)
  // =========================================================
  const loadMessages = useCallback(async () => {
    if (!token || isMaster) return;
    setMessagesLoading(true);
    try {
      const res = await api.get("/admin-master-messages/messages", { headers: authHeaders(token) });
      setMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to load messages.", false);
    } finally {
      setMessagesLoading(false);
    }
  }, [isMaster, token]);

  useEffect(() => {
    if (activeSection === "messages" && !isMaster) {
      void loadMessages();
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [activeSection, isMaster, loadMessages]);

  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessageToMaster = async () => {
    if (!token || isMaster) return;
    if (!messageText.trim() && !messageFile) return;

    setSendingMessage(true);
    try {
      let mediaPayload = null;
      let mediaType = null;
      if (messageFile) {
        mediaPayload = await fileToDataUrl(messageFile);
        mediaType = messageFile.type.startsWith("image/") ? "photo" : "document";
      }
      await api.post(
        "/admin-master-messages/send",
        { content: messageText.trim() || null, media_type: mediaType, media_file: mediaPayload },
        { headers: authHeaders(token) }
      );
      setMessageText("");
      setMessageFile(null);
      await loadMessages();
    } catch (err) {
      showToast(err?.response?.data?.detail || err?.message || "Failed to send message.", false);
    } finally {
      setSendingMessage(false);
    }
  };

  const profileTitle = isMaster ? "Master Info" : "Admin Info";
  const planStatusColor = myPlanStatus?.status === "active" ? "#10b981" : myPlanStatus?.status === "grace" ? "#f59e0b" : "#ef4444";

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <aside style={styles.sidebar}>
          <SidebarProfileCard
            profile={profile}
            isMaster={isMaster}
            onEdit={() => setProfileModalOpen(true)}
          />

          {!isMaster && (
            <div style={styles.planChip}>
              <span style={styles.planChipLabel}>CURRENT PLAN</span>
              {myPlanStatus ? (
                <div style={styles.planChipRow}>
                  <span style={styles.planChipName}>{myPlanStatus.plan_name}</span>
                  <span style={styles.planChipTag(planStatusColor)}>{myPlanStatus.status.toUpperCase()}</span>
                </div>
              ) : (
                <span style={styles.subtle}>No subscription yet</span>
              )}
            </div>
          )}

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
              <div style={styles.stack}>
                <div style={styles.card}>
                  <div style={styles.cardTitle}>Current Plan</div>
                  {mySub.subscription ? (
                    <div style={{ marginTop: 10 }}>
                      <div>
                        {mySub.subscription.plan_name} —{" "}
                        <Tag
                          text={mySub.subscription.status.toUpperCase()}
                          color={mySub.subscription.status === "active" ? "#10b981" : mySub.subscription.status === "grace" ? "#f59e0b" : "#ef4444"}
                        />
                      </div>
                      <div style={styles.subtle}>Renews / expires: {mySub.subscription.current_period_end || "Never (free plan)"}</div>
                      {mySub.subscription.status === "grace" && (
                        <div style={{ ...styles.alertWarn, marginTop: 10 }}>
                          Your last renewal failed. Top up your balance before the grace period ends or your plan's access points will be revoked.
                        </div>
                      )}
                    </div>
                  ) : <div style={styles.subtle}>No active subscription.</div>}
                </div>

                <div style={styles.card}>
                  <div style={styles.cardTitle}>Available Plans</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 14, marginTop: 12 }}>
                    {subCatalog.plans.map((plan) => {
                      const isCurrent = mySub.subscription?.plan_id === plan.id;
                      return (
                        <PlanCard
                          key={plan.id}
                          plan={plan}
                          highlight={isCurrent}
                          footer={
                            isCurrent ? (
                              <div style={{ ...styles.subtle, textAlign: "center" }}>Current plan</div>
                            ) : plan.is_default ? (
                              <button type="button" disabled={subscribing} onClick={() => subscribeToPlan(plan.id, null, null)} style={{ ...styles.secondaryBtn, width: "100%" }}>
                                Switch to Free
                              </button>
                            ) : plan.prices.length === 0 ? (
                              <div style={{ ...styles.subtle, textAlign: "center" }}>Not available yet</div>
                            ) : (
                              plan.prices.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  disabled={subscribing}
                                  onClick={() => subscribeToPlan(plan.id, p.currency_id, p.network_id)}
                                  style={{ ...styles.secondaryBtn, marginTop: 6, width: "100%" }}
                                >
                                  Subscribe — {p.effective_price} {p.currency}/{p.network}
                                </button>
                              ))
                            )
                          }
                        />
                      );
                    })}
                    {subCatalog.plans.length === 0 && <div style={styles.subtle}>No plans available.</div>}
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardTitle}>Add-ons</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 12, marginTop: 12 }}>
                    {subCatalog.access_points.map((ap) => {
                      const owned = mySub.addons.find((a) => a.key === ap.key && a.status !== "expired");
                      const eligible = isAddonEligible(ap);
                      return (
                        <div key={ap.id} style={{ border: "1px solid #223451", borderRadius: 14, padding: 14, opacity: !owned && !eligible ? 0.55 : 1 }}>
                          <div style={{ fontWeight: 800 }}>{ap.label}</div>
                          {ap.required_plan_name && (
                            <div style={{ ...styles.subtle, marginTop: 4 }}>Requires: {ap.required_plan_name}</div>
                          )}

                          {owned ? (
                            <div style={{ marginTop: 8 }}>
                              <Tag text={owned.status.toUpperCase()} color={owned.status === "active" ? "#10b981" : owned.status === "grace" ? "#f59e0b" : "#ef4444"} />
                              <button type="button" onClick={() => cancelAddon(ap.id)} style={{ ...styles.secondaryBtn, marginTop: 8, width: "100%", color: "#f87171" }}>
                                Cancel
                              </button>
                            </div>
                          ) : !eligible ? (
                            <button type="button" disabled style={{ ...styles.secondaryBtn, marginTop: 8, width: "100%", cursor: "not-allowed" }}>
                              Subscribe to {ap.required_plan_name} first
                            </button>
                          ) : ap.prices.length === 0 ? (
                            <div style={{ ...styles.subtle, marginTop: 8 }}>Not available yet</div>
                          ) : (
                            ap.prices.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                disabled={purchasingAddonId === ap.id}
                                onClick={() => buyAddon(ap.id, p.currency_id, p.network_id)}
                                style={{ ...styles.secondaryBtn, marginTop: 8, width: "100%" }}
                              >
                                Buy — {p.effective_price} {p.currency}/{p.network}
                                {p.discount_percent > 0 ? ` (-${p.discount_percent}%)` : ""}
                              </button>
                            ))
                          )}
                        </div>
                      );
                    })}
                    {subCatalog.access_points.length === 0 && <div style={styles.subtle}>No add-ons available.</div>}
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardTitle}>Invoices</div>
                  <div style={{ marginTop: 10 }}>
                    {mySub.invoices.map((i) => (
                      <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1e293b", fontSize: 13 }}>
                        <span>
                          {i.type === "plan" ? i.plan_name : i.access_point_key} — {i.amount} {i.currency}
                          {i.discount_percent > 0 ? ` (-${i.discount_percent}%)` : ""}
                        </span>
                        <span style={styles.subtle}>{i.status} · {i.created_at}</span>
                      </div>
                    ))}
                    {mySub.invoices.length === 0 && <div style={styles.subtle}>No invoices yet.</div>}
                  </div>
                </div>
              </div>
            )
          )}

          {activeSection === "invitations" && <InvitationsPanel isMaster={isMaster} />}

          {activeSection === "messages" && !isMaster && (
            <div style={styles.stack}>
              <div style={styles.card}>
                <div style={styles.cardTitle}>Message to Master</div>
                <div style={styles.subtle}>Use this thread for admin ↔ master communication and receipt uploads.</div>
                <div style={styles.messageLayout}>
                  <div style={styles.messageThread}>
                    {(messagesLoading && messages.length === 0) ? (
                      <div style={styles.subtle}>Loading messages...</div>
                    ) : (
                      messages.map((message) => (
                        <div key={message.id} style={styles.messageBubble(message.sender === "admin")}>
                          <div style={styles.messageMeta}>{message.sender} · {fmtDate(message.created_at)}</div>
                          {message.content && <div>{message.content}</div>}
                          {message.media_url && (
                            <a href={`${API_URL}${message.media_url}`} target="_blank" rel="noreferrer" style={styles.messageLink}>
                              Open attachment
                            </a>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={messagesBottomRef} />
                  </div>
                  <div style={styles.composeCard}>
                    <textarea
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      rows={6}
                      placeholder="Write to master..."
                      style={styles.textarea}
                    />
                    <input type="file" onChange={(event) => setMessageFile(event.target.files?.[0] || null)} style={styles.input} />
                    {messageFile && <div style={styles.subtle}>{messageFile.name}</div>}
                    <button type="button" onClick={sendMessageToMaster} disabled={sendingMessage} style={styles.primaryBtn}>
                      <Mail size={13} /> {sendingMessage ? "Sending..." : "Send"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {error && (
          <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9000, maxWidth: 420, background: "rgba(127,29,29,.95)", border: "1px solid rgba(239,68,68,.5)", borderRadius: 14, padding: "12px 16px", color: "#fecaca", fontSize: 13, display: "flex", gap: 10, alignItems: "flex-start", boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
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
    </div>
  );
}

function Tag({ text, color }) {
  return <span style={styles.tag(color)}>{text}</span>;
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
  planChip: { borderRadius: 14, border: "1px solid #223451", background: "#0b1628", padding: 12 },
  planChipLabel: { fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: 0.6 },
  planChipRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: 6, flexWrap: "wrap" },
  planChipName: { fontSize: 13, fontWeight: 700, color: "white" },
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