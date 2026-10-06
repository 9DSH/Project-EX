import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownAZ, ArrowDownUp, Clock, Pencil, Plus, Power, RefreshCcw, Search, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { API_URL } from "../../config";
import ACCESS_OPTIONS from "../../constants/AccessPoints";
import PlanCard from "./PlanCard";
import PlanAddModal from "./PlanAddModal";
import PlanEditModal from "./PlanEditModal";
import AccessPointCard from "./AccessPointCard";
import { AccessPointAddModal, AccessPointEditModal } from "./AccessPointModals";
import { accentFor, statusColor, fmtDateShort, fmtMoney } from "./SubscriptionTheme";
import { EmptyState, SidePanel } from "./AccountBits";
import { useIsMobile } from "./accountUtils";
import "../../pages/MyAccount.css";

const authHeaders = (token) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

const TABS = [
  { key: "access-points", label: "Access Points" },
  { key: "plans", label: "Plans" },
  { key: "admins", label: "Admin Subscriptions" },
];

async function req(url, token, opts = {}) {
  const res = await fetch(url, { headers: authHeaders(token), ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { response: { data } };
  return data;
}

export default function SubscriptionAdminPanel() {
  const token = localStorage.getItem("token");
  const isMobile = useIsMobile();
  const detailRef = useRef(null);
  const [tab, setTab] = useState("access-points");

  const [accessPoints, setAccessPoints] = useState([]);
  const [plans, setPlans] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [adminRows, setAdminRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const [addPlanOpen, setAddPlanOpen] = useState(false);
  const [editPlanId, setEditPlanId] = useState(null);
  const [addApOpen, setAddApOpen] = useState(false);
  const [editApId, setEditApId] = useState(null);

  const [grantKeySelect, setGrantKeySelect] = useState("");
  const [switchPlanSelect, setSwitchPlanSelect] = useState("");
  const [addAddonSelect, setAddAddonSelect] = useState("");

  const [apSearch, setApSearch] = useState("");
  const [apPlanFilter, setApPlanFilter] = useState("all");
  const [apSort, setApSort] = useState("name");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ap, pl, pr, ad] = await Promise.all([
        fetch(`${API_URL}/admin/subscriptions/access-points`, { headers: authHeaders(token) }).then((r) => r.json()),
        fetch(`${API_URL}/admin/subscriptions/plans`, { headers: authHeaders(token) }).then((r) => r.json()),
        fetch(`${API_URL}/admin/currency-networks/`, { headers: authHeaders(token) }).then((r) => r.json()),
        fetch(`${API_URL}/admin/subscriptions/admins`, { headers: authHeaders(token) }).then((r) => r.json()),
      ]);
      setAccessPoints(Array.isArray(ap) ? ap : []);
      setPlans(Array.isArray(pl) ? pl : []);
      setPairs(Array.isArray(pr) ? pr : []);
      setAdminRows(Array.isArray(ad) ? ad : []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const pairOptions = pairs
    .filter((p) => p.currency?.id && p.network?.id)
    .map((p) => ({ currency_id: p.currency.id, network_id: p.network.id, label: `${p.currency.symbol} / ${p.network.chain}` }));

  const editingPlan = plans.find((p) => p.id === editPlanId) || null;
  const editingAp = accessPoints.find((a) => a.id === editApId) || null;

  const cheapestPrice = (ap) => (ap.prices?.length ? Math.min(...ap.prices.map((p) => p.effective_price)) : null);

  const filteredAccessPoints = useMemo(() => {
    const q = apSearch.trim().toLowerCase();
    let rows = accessPoints.filter((ap) => {
      const matchesSearch =
        !q ||
        ap.label.toLowerCase().includes(q) ||
        ap.key.toLowerCase().includes(q) ||
        (ap.required_plans || []).some((p) => p.name.toLowerCase().includes(q));
      const matchesPlan =
        apPlanFilter === "all" ||
        (apPlanFilter === "open" ? (ap.required_plan_ids || []).length === 0 : (ap.required_plan_ids || []).includes(Number(apPlanFilter)));
      return matchesSearch && matchesPlan;
    });

    rows = [...rows].sort((a, b) => {
      if (apSort === "name") return a.label.localeCompare(b.label);
      const ap = cheapestPrice(a);
      const bp = cheapestPrice(b);
      if (apSort === "price_asc") return (ap ?? Infinity) - (bp ?? Infinity);
      if (apSort === "price_desc") return (bp ?? -Infinity) - (ap ?? -Infinity);
      return 0;
    });

    return rows;
  }, [accessPoints, apSearch, apPlanFilter, apSort]);

  // ── PLANS ──────────────────────────────────────
  const createPlan = async (payload) => {
    const data = await req(`${API_URL}/admin/subscriptions/plans`, token, { method: "POST", body: JSON.stringify(payload) });
    setAddPlanOpen(false);
    await loadAll();
    setEditPlanId(data.id);
  };

  const updatePlanMeta = async (planId, patch) => {
    await req(`${API_URL}/admin/subscriptions/plans/${planId}`, token, { method: "PUT", body: JSON.stringify(patch) });
    await loadAll();
  };

  const setPlanPrice = async (planId, currencyId, networkId, price, discount) => {
    if (!currencyId || !networkId || price === "" || price == null) return;
    await req(`${API_URL}/admin/subscriptions/plans/${planId}/prices`, token, {
      method: "PUT",
      body: JSON.stringify({ currency_id: Number(currencyId), network_id: Number(networkId), price: Number(price), discount_percent: Number(discount || 0), is_active: true }),
    });
    await loadAll();
  };

  const deletePlanPrice = async (planId, priceId) => {
    if (!window.confirm("Remove this price? The plan will no longer be subscribable for this pair.")) return;
    await req(`${API_URL}/admin/subscriptions/plans/${planId}/prices/${priceId}`, token, { method: "DELETE" });
    await loadAll();
  };

  const togglePlanAccessPoint = async (plan, ap) => {
    const already = plan.access_points.some((x) => x.access_point_id === ap.id);
    const nextItems = already
      ? plan.access_points.filter((x) => x.access_point_id !== ap.id).map((x) => ({ access_point_id: x.access_point_id, choice_group: x.choice_group }))
      : [...plan.access_points.map((x) => ({ access_point_id: x.access_point_id, choice_group: x.choice_group })), { access_point_id: ap.id, choice_group: null }];
    await req(`${API_URL}/admin/subscriptions/plans/${plan.id}/access-points`, token, { method: "PUT", body: JSON.stringify({ items: nextItems }) });
    await loadAll();
  };

  const deletePlan = async (plan) => {
    if (!window.confirm(`Delete plan "${plan.name}"? This only works if no admins are subscribed and no add-ons require it.`)) return;
    try {
      await req(`${API_URL}/admin/subscriptions/plans/${plan.id}`, token, { method: "DELETE" });
      if (editPlanId === plan.id) setEditPlanId(null);
      await loadAll();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to delete plan.");
    }
  };

  // ── ACCESS POINTS ──────────────────────────────
  const createAccessPoint = async (payload, prices) => {
    const data = await req(`${API_URL}/admin/subscriptions/access-points`, token, { method: "POST", body: JSON.stringify(payload) });
    for (const pr of prices) {
      await req(`${API_URL}/admin/subscriptions/access-points/${data.id}/prices`, token, {
        method: "PUT",
        body: JSON.stringify({ currency_id: pr.currency_id, network_id: pr.network_id, price: pr.price, discount_percent: pr.discount_percent, is_active: true }),
      });
    }
    setAddApOpen(false);
    await loadAll();
  };

  const updateApMeta = async (apId, patch) => {
    await req(`${API_URL}/admin/subscriptions/access-points/${apId}`, token, { method: "PUT", body: JSON.stringify(patch) });
    await loadAll();
  };

  const setApPrice = async (apId, currencyId, networkId, price, discount) => {
    if (!currencyId || !networkId || price === "" || price == null) return;
    await req(`${API_URL}/admin/subscriptions/access-points/${apId}/prices`, token, {
      method: "PUT",
      body: JSON.stringify({ currency_id: Number(currencyId), network_id: Number(networkId), price: Number(price), discount_percent: Number(discount || 0), is_active: true }),
    });
    await loadAll();
  };

  const deleteApPrice = async (apId, priceId) => {
    if (!window.confirm("Remove this price? The access point will no longer be purchasable for this pair.")) return;
    await req(`${API_URL}/admin/subscriptions/access-points/${apId}/prices/${priceId}`, token, { method: "DELETE" });
    await loadAll();
  };

  const deleteAccessPoint = async (ap) => {
    if (!window.confirm(`Delete access point "${ap.label}"? This only works if no admin has purchased it and no plan includes it.`)) return;
    try {
      await req(`${API_URL}/admin/subscriptions/access-points/${ap.id}`, token, { method: "DELETE" });
      if (editApId === ap.id) setEditApId(null);
      await loadAll();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to delete access point.");
    }
  };

  // ── ADMIN OVERSIGHT ────────────────────────────
  useEffect(() => {
    // tablet (stacked layout): bring the freshly opened detail into view
    if (detail && !isMobile && window.innerWidth <= 900) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.admin_id]);

  const openAdminDetail = async (adminId) => {
    const data = await req(`${API_URL}/admin/subscriptions/admins/${adminId}`, token);
    setDetail(data);
  };

  const forceStatus = async (adminId, status) => {
    await req(`${API_URL}/admin/subscriptions/admins/${adminId}/status`, token, { method: "PUT", body: JSON.stringify({ status }) });
    openAdminDetail(adminId);
    loadAll();
  };

  const grantSelectedKey = async (adminId) => {
    if (!grantKeySelect) return;
    await req(`${API_URL}/admin/subscriptions/admins/${adminId}/grant`, token, { method: "POST", body: JSON.stringify({ key: grantKeySelect }) });
    setGrantKeySelect("");
    openAdminDetail(adminId);
  };

  const revokeKey = async (adminId, key) => {
    await req(`${API_URL}/admin/subscriptions/admins/${adminId}/revoke`, token, { method: "POST", body: JSON.stringify({ key }) });
    openAdminDetail(adminId);
  };

  const switchAdminPlan = async (adminId) => {
    if (!switchPlanSelect) return;
    const plan = plans.find((p) => p.id === Number(switchPlanSelect));
    if (!window.confirm(`Switch this admin to "${plan?.name}"? This is a free master override — no charge, and it replaces their current fixed access points immediately.`)) return;
    try {
      await req(`${API_URL}/admin/subscriptions/admins/${adminId}/switch-plan`, token, { method: "POST", body: JSON.stringify({ plan_id: Number(switchPlanSelect) }) });
      setSwitchPlanSelect("");
      openAdminDetail(adminId);
      loadAll();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to switch plan.");
    }
  };

  const addAdminAddon = async (adminId) => {
    if (!addAddonSelect) return;
    try {
      await req(`${API_URL}/admin/subscriptions/admins/${adminId}/addons`, token, { method: "POST", body: JSON.stringify({ access_point_id: Number(addAddonSelect) }) });
      setAddAddonSelect("");
      openAdminDetail(adminId);
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to add add-on.");
    }
  };

  const expireAdminAddon = async (adminId, accessPointId) => {
    if (!window.confirm("Mark this add-on as expired? Access is revoked immediately, but the purchase record stays for the books.")) return;
    try {
      await req(`${API_URL}/admin/subscriptions/admins/${adminId}/addons/${accessPointId}/expire`, token, { method: "PUT" });
      openAdminDetail(adminId);
      loadAll();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to expire add-on.");
    }
  };

  const removeAdminAddon = async (adminId, accessPointId) => {
    if (!window.confirm("Remove this add-on from the admin? This fully deletes their purchase record, not just marks it expired.")) return;
    try {
      await req(`${API_URL}/admin/subscriptions/admins/${adminId}/addons/${accessPointId}`, token, { method: "DELETE" });
      openAdminDetail(adminId);
      loadAll();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to remove add-on.");
    }
  };

  const addonChoices = detail
    ? accessPoints.filter((ap) => !(detail.addons || []).some((a) => a.access_point_id === ap.id && a.status !== "expired"))
    : [];

  const renderDetail = () => (
    <div className="ma-detail-body">
      {detail.subscription ? (
        <div className="ma-detail-box">
          <div className="ma-row-between">
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{detail.subscription.plan_name}</div>
              <div className="ma-subtle" style={{ marginTop: 3 }}>Period end: {fmtDateShort(detail.subscription.current_period_end)}</div>
            </div>
            <span className="ma-tag" style={{ color: statusColor(detail.subscription.status), borderColor: `${statusColor(detail.subscription.status)}55`, background: `${statusColor(detail.subscription.status)}22` }}>
              {detail.subscription.status.toUpperCase()}
            </span>
          </div>
          <div className="ma-row" style={{ marginTop: 14 }}>
            <button type="button" onClick={() => forceStatus(detail.admin_id, "active")} className="ma-btn ma-btn--sm">Force active</button>
            <button type="button" onClick={() => forceStatus(detail.admin_id, "grace")} className="ma-btn ma-btn--sm">Force grace</button>
            <button type="button" onClick={() => forceStatus(detail.admin_id, "expired")} className="ma-btn ma-btn--sm">Force expired</button>
          </div>
          <hr style={{ border: "none", height: 1, background: "rgba(148,163,184,.12)", margin: "14px 0 12px" }} />
          <div className="ma-sectionLabel" style={{ marginBottom: 0 }}>Switch plan</div>
          <div className="ma-subtle" style={{ marginTop: 3 }}>Free master override — replaces their current fixed access points immediately, no charge.</div>
          <div className="ma-inlineAdd">
            <select className="ma-select" value={switchPlanSelect} onChange={(e) => setSwitchPlanSelect(e.target.value)}>
              <option value="">Select a plan…</option>
              {plans.filter((p) => p.id !== detail.subscription.plan_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" onClick={() => switchAdminPlan(detail.admin_id)} disabled={!switchPlanSelect} className="ma-btn ma-btn--primary">Switch plan</button>
          </div>
        </div>
      ) : (
        <div className="ma-detail-box">
          <div className="ma-subtle" style={{ marginBottom: 10 }}>No plan subscription yet.</div>
          <div className="ma-inlineAdd" style={{ marginTop: 0 }}>
            <select className="ma-select" value={switchPlanSelect} onChange={(e) => setSwitchPlanSelect(e.target.value)}>
              <option value="">Select a plan…</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" onClick={() => switchAdminPlan(detail.admin_id)} disabled={!switchPlanSelect} className="ma-btn ma-btn--primary">Assign plan</button>
          </div>
        </div>
      )}

      <div className="ma-detail-box">
        <div className="ma-sectionLabel" style={{ marginBottom: 0 }}>Add-ons</div>
        <div className="ma-subtle" style={{ marginTop: 3 }}>
          <Clock size={10} style={{ verticalAlign: -1 }} /> expires it (keeps the record) · <Trash2 size={10} style={{ verticalAlign: -1 }} /> deletes it completely
        </div>
        <div className="ma-chipWrap" style={{ marginTop: 10 }}>
          {detail.addons.length === 0 && <span className="ma-subtle ma-faint">None</span>}
          {detail.addons.map((a) => (
            <span key={a.id} className="ma-accessChip" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#c4b5fd", borderColor: "rgba(168,85,247,.25)", background: "rgba(168,85,247,.1)", padding: "5px 8px 5px 11px" }}>
              {a.label || a.key} · {a.status}
              <button type="button" onClick={() => expireAdminAddon(detail.admin_id, a.access_point_id)} title="Mark expired (keeps the record)" aria-label="Mark expired" style={miniBtn("rgba(245,158,11,.18)", "#fbbf24")}><Clock size={11} /></button>
              <button type="button" onClick={() => removeAdminAddon(detail.admin_id, a.access_point_id)} title="Remove completely (deletes the record)" aria-label="Remove" style={miniBtn("rgba(239,68,68,.18)", "#f87171")}><Trash2 size={11} /></button>
            </span>
          ))}
        </div>

        {/* NEW: add an add-on to this admin (uses addAddonSelect / addAdminAddon) */}
        <div className="ma-inlineAdd">
          <select className="ma-select" value={addAddonSelect} onChange={(e) => setAddAddonSelect(e.target.value)}>
            <option value="">Select add-on to attach…</option>
            {addonChoices.map((ap) => <option key={ap.id} value={ap.id}>{ap.label} ({ap.key})</option>)}
          </select>
          <button type="button" onClick={() => addAdminAddon(detail.admin_id)} disabled={!addAddonSelect} className="ma-btn ma-btn--primary"><Plus size={13} /> Add add-on</button>
        </div>
        {addonChoices.length === 0 && <div className="ma-subtle" style={{ marginTop: 6 }}>Every access point is already attached as an add-on.</div>}
      </div>

      <div className="ma-detail-box">
        <div className="ma-sectionLabel">Access breakdown by source</div>
        {["master_granted", "plan_included", "addon_purchased"].map((src) => {
          const items = (detail.grants || []).filter((g) => g.source === src);
          if (items.length === 0) return null;
          const revocable = src === "master_granted";
          return (
            <div key={src} style={{ marginTop: 10 }}>
              <div className="ma-subtle ma-faint" style={{ fontWeight: 700 }}>{src.replace("_", " ")}</div>
              <div className="ma-chipWrap" style={{ marginTop: 6 }}>
                {items.map((g) => (
                  <span
                    key={g.id}
                    onClick={revocable ? () => revokeKey(detail.admin_id, g.key) : undefined}
                    title={revocable ? "Click to revoke" : "Managed by billing"}
                    className="ma-accessChip"
                    style={{
                      cursor: revocable ? "pointer" : "default", fontWeight: 500,
                      borderColor: revocable ? "rgba(239,68,68,.3)" : "rgba(148,163,184,.16)",
                      background: revocable ? "rgba(239,68,68,.1)" : "#0b1220",
                      color: revocable ? "#fca5a5" : "#cbd5e1",
                    }}
                  >
                    {g.key}{revocable ? " ✕" : ""}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <div className="ma-inlineAdd">
          <select className="ma-select" value={grantKeySelect} onChange={(e) => setGrantKeySelect(e.target.value)}>
            <option value="">Select access point to grant…</option>
            {(() => {
              const known = new Map(ACCESS_OPTIONS.map((a) => [a.key, a.label]));
              accessPoints.forEach((ap) => { if (!known.has(ap.key)) known.set(ap.key, ap.label); });
              return Array.from(known.entries()).map(([key, label]) => <option key={key} value={key}>{label} ({key})</option>);
            })()}
          </select>
          <button type="button" onClick={() => grantSelectedKey(detail.admin_id)} className="ma-btn ma-btn--primary"><ShieldCheck size={13} /> Grant</button>
        </div>
        <div className="ma-subtle ma-faint" style={{ marginTop: 6 }}>Master grants bypass any required-plan restriction.</div>
      </div>

      <div className="ma-detail-box">
        <div className="ma-sectionLabel">Invoices</div>
        {detail.invoices.map((i) => (
          <div key={i.id} className="ma-invoice" style={{ fontSize: 12.5, color: "#cbd5e1", alignItems: "flex-start", flexWrap: "wrap" }}>
            <span style={{ minWidth: 0 }}>{i.type === "plan" ? i.plan_name : i.access_point_key} — {fmtMoney(i.amount)} {i.currency} {i.discount_percent > 0 ? `(-${i.discount_percent}%)` : ""} — {i.status}</span>
            <span className="ma-faint">{fmtDateShort(i.created_at)}</span>
          </div>
        ))}
        {detail.invoices.length === 0 && <div className="ma-subtle ma-faint">No invoices yet.</div>}
      </div>
    </div>
  );

  return (
    <div className="ma-stack">
      <div className="ma-row-between">
        <div>
          <div className="ma-card-title" style={{ fontSize: 20 }}>Subscription Management</div>
          <div className="ma-subtle">Access points, plans, pricing &amp; admin subscription oversight</div>
        </div>
        <button type="button" onClick={loadAll} className="ma-btn"><RefreshCcw size={13} className={loading ? "ma-spin" : ""} /> {loading ? "…" : "Refresh"}</button>
      </div>

      <div className="ma-subtabs" style={{ alignSelf: "flex-start" }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`ma-subtab${tab === t.key ? " is-active" : ""}`}>{t.label}</button>
        ))}
      </div>

      {tab === "access-points" && (
        <section className="ma-card">
          <div className="ma-card-head">
            <div>
              <div className="ma-card-title">Priced access points</div>
              <div className="ma-subtle">Sellable RBAC permissions admins can buy as add-ons — free or paid, gated to one or more plans.</div>
            </div>
            <button type="button" onClick={() => setAddApOpen(true)} className="ma-btn ma-btn--primary"><Plus size={14} /> Add access point</button>
          </div>

          <div className="ma-toolbar" style={{ margin: "14px 0" }}>
            <div className="ma-searchWrap">
              <Search size={14} />
              <input className="ma-input" value={apSearch} onChange={(e) => setApSearch(e.target.value)} placeholder="Search by name, key, or plan…" />
            </div>
            <select className="ma-select" style={{ width: 190, maxWidth: "100%" }} value={apPlanFilter} onChange={(e) => setApPlanFilter(e.target.value)}>
              <option value="all">All plans</option>
              <option value="open">Open to any plan</option>
              {plans.map((p) => <option key={p.id} value={p.id}>Requires {p.name}</option>)}
            </select>
            <div className="ma-row">
              <button type="button" onClick={() => setApSort("name")} title="Sort by name" className="ma-btn" style={apSort === "name" ? activeSort : undefined}><ArrowDownAZ size={13} /> Name</button>
              <button type="button" onClick={() => setApSort(apSort === "price_asc" ? "price_desc" : "price_asc")} title="Sort by price" className="ma-btn" style={apSort.startsWith("price") ? activeSort : undefined}>
                <ArrowDownUp size={13} /> Price {apSort === "price_asc" ? "↑" : apSort === "price_desc" ? "↓" : ""}
              </button>
            </div>
          </div>

          {accessPoints.length === 0 ? (
            <EmptyState>No access points added yet.</EmptyState>
          ) : filteredAccessPoints.length === 0 ? (
            <EmptyState>No access points match your search / filter.</EmptyState>
          ) : (
            <div className="ma-cardGrid ma-cardGrid--ap">
              {filteredAccessPoints.map((ap) => {
                const i = accessPoints.indexOf(ap);
                return (
                  <AccessPointCard
                    key={ap.id}
                    ap={ap}
                    accentColor={["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899"][i % 5]}
                    statusChip={{ text: ap.is_active ? "ACTIVE" : "INACTIVE", color: ap.is_active ? "#10b981" : "#94a3b8" }}
                    actions={[
                      { icon: <Pencil size={13} />, label: "Edit", onClick: () => setEditApId(ap.id) },
                      { icon: <Trash2 size={13} />, label: "Delete", tone: "danger", onClick: () => deleteAccessPoint(ap) },
                    ]}
                    width="100%"
                    footer={<button type="button" onClick={() => setEditApId(ap.id)} className="ma-btn ma-btn--block">Manage pricing</button>}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "plans" && (
        <section className="ma-card">
          <div className="ma-card-head">
            <div>
              <div className="ma-card-title">Plans</div>
              <div className="ma-subtle">Billing tiers admins can subscribe to.</div>
            </div>
            <button type="button" onClick={() => setAddPlanOpen(true)} className="ma-btn ma-btn--primary"><Plus size={14} /> Add plan</button>
          </div>
          <div style={{ marginTop: 14 }}>
            {plans.length === 0 ? (
              <EmptyState>No plans created yet.</EmptyState>
            ) : (
              <div className="ma-cardGrid">
                {plans.map((plan, i) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    width="100%"
                    accentColor={accentFor(plan, i)}
                    actions={[
                      { icon: <Pencil size={13} />, label: "Edit plan", onClick: () => setEditPlanId(plan.id) },
                      { icon: <Power size={13} />, label: plan.is_active ? "Deactivate" : "Activate", tone: plan.is_active ? "default" : "active", onClick: () => updatePlanMeta(plan.id, { is_active: !plan.is_active }) },
                      { icon: <Trash2 size={13} />, label: "Delete", tone: "danger", onClick: () => deletePlan(plan) },
                    ]}
                    footer={<button type="button" onClick={() => setEditPlanId(plan.id)} className="ma-btn ma-btn--block">Manage plan</button>}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "admins" && (
        <section className="ma-card">
          <div className="ma-card-title">Admin subscriptions</div>
          <div className="ma-subtle">Select an admin to inspect or override their plan, add-ons and access.</div>
          <div className="ma-admins">
            <div className="ma-adminList">
              {adminRows.map((row) => (
                <button key={row.admin_id} type="button" onClick={() => openAdminDetail(row.admin_id)} className={`ma-adminItem${detail?.admin_id === row.admin_id ? " is-active" : ""}`}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{row.username}</div>
                  <div className="ma-subtle" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {row.subscription ? (
                      <>
                        <span>{row.subscription.plan_name}</span>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: statusColor(row.subscription.status) }} />
                        <span style={{ color: statusColor(row.subscription.status), fontWeight: 700 }}>{row.subscription.status}</span>
                      </>
                    ) : "No subscription"}
                    {row.addons.length > 0 && <span>· {row.addons.length} addon{row.addons.length === 1 ? "" : "s"}</span>}
                  </div>
                </button>
              ))}
              {adminRows.length === 0 && <EmptyState>No admins yet.</EmptyState>}
            </div>

            {!isMobile && (
              <div ref={detailRef} className="ma-detail-box" style={{ scrollMarginTop: 12 }}>
                {!detail && <div className="ma-subtle"><UserRound size={14} style={{ verticalAlign: -2 }} /> Select an admin to view subscription details.</div>}
                {detail && (
                  <>
                    <div className="ma-card-title" style={{ marginBottom: 14 }}>{detail.username} — subscription detail</div>
                    {renderDetail()}
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* mobile: admin detail opens as a bottom sheet */}
      {isMobile && tab === "admins" && detail && (
        <SidePanel onClose={() => setDetail(null)} icon={UserRound} title={detail.username} subtitle="Subscription detail">
          {renderDetail()}
        </SidePanel>
      )}

      {addPlanOpen && <PlanAddModal onClose={() => setAddPlanOpen(false)} onCreate={createPlan} />}
      {editingPlan && (
        <PlanEditModal
          plan={editingPlan}
          accessPoints={accessPoints}
          pairOptions={pairOptions}
          onClose={() => setEditPlanId(null)}
          onUpdateMeta={(patch) => updatePlanMeta(editingPlan.id, patch)}
          onSetPrice={(cid, nid, price, discount) => setPlanPrice(editingPlan.id, cid, nid, price, discount)}
          onDeletePrice={(priceId) => deletePlanPrice(editingPlan.id, priceId)}
          onToggleAccessPoint={(ap) => togglePlanAccessPoint(editingPlan, ap)}
          onDeletePlan={() => deletePlan(editingPlan)}
        />
      )}

      {addApOpen && <AccessPointAddModal plans={plans} pairOptions={pairOptions} onClose={() => setAddApOpen(false)} onCreate={createAccessPoint} />}
      {editingAp && (
        <AccessPointEditModal
          ap={editingAp}
          plans={plans}
          pairOptions={pairOptions}
          onClose={() => setEditApId(null)}
          onUpdateMeta={(patch) => updateApMeta(editingAp.id, patch)}
          onSetPrice={(cid, nid, price, discount) => setApPrice(editingAp.id, cid, nid, price, discount)}
          onDeletePrice={(priceId) => deleteApPrice(editingAp.id, priceId)}
          onDelete={() => deleteAccessPoint(editingAp)}
        />
      )}
    </div>
  );
}

const activeSort = { color: "#bfdbfe", borderColor: "#3b82f6" };
const miniBtn = (bg, color) => ({
  width: 18, height: 18, borderRadius: 6, border: "none", background: bg, color,
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
});