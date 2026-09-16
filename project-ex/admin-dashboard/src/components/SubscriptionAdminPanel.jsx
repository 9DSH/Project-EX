import { useEffect, useMemo, useState } from "react";
import { ArrowDownAZ, ArrowDownUp, Clock, Pencil, Plus, Power, RefreshCcw, Search, ShieldCheck, Trash2 } from "lucide-react";
import { API_URL } from "../config";
import ACCESS_OPTIONS from "../constants/AccessPoints";
import PlanCard from "./PlanCard";
import PlanAddModal from "./PlanAddModal";
import PlanEditModal from "./PlanEditModal";
import AccessPointCard from "./AccessPointCard";
import { AccessPointAddModal, AccessPointEditModal } from "./AccessPointModals";
import { S, T, accentFor, statusColor, fmtDateShort, fmtMoney } from "./subscriptionTheme";

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

  return (
    <div>
      <div style={hs.header}>
        <div>
          <div style={hs.title}>Subscription Management</div>
          <div style={hs.subtitle}>Access points, plans, pricing &amp; admin subscription oversight</div>
        </div>
        <button type="button" onClick={loadAll} style={S.ghostBtn}><RefreshCcw size={13} /> {loading ? "…" : "Refresh"}</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{ padding: "9px 16px", borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1px solid ${tab === t.key ? "#3b82f6" : "#223451"}`, background: tab === t.key ? "rgba(59,130,246,.16)" : "#0b1628", color: tab === t.key ? "#bfdbfe" : "#94a3b8" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "access-points" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={hs.sectionHead}>
            <div>
              <div style={hs.sectionTitle}>Priced access points</div>
              <div style={hs.sectionSub}>Sellable RBAC permissions admins can buy as add-ons — free or paid, gated to one or more plans.</div>
            </div>
            <button type="button" onClick={() => setAddApOpen(true)} style={S.primaryBtn}><Plus size={14} /> Add access point</button>
          </div>

          <div style={S.toolbar}>
            <div style={{ position: "relative", flex: "1 1 auto", minWidth: 0 }}>
              <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
              <input
                value={apSearch}
                onChange={(e) => setApSearch(e.target.value)}
                placeholder="Search by name, key, or plan…"
                style={S.searchInput}
              />
            </div>
            <select value={apPlanFilter} onChange={(e) => setApPlanFilter(e.target.value)} style={{ ...S.input, width: 190, flexShrink: 0 }}>
              <option value="all">All plans</option>
              <option value="open">Open to any plan</option>
              {plans.map((p) => <option key={p.id} value={p.id}>Requires {p.name}</option>)}
            </select>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button type="button" onClick={() => setApSort("name")} title="Sort by name" style={{ ...S.ghostBtn, whiteSpace: "nowrap", color: apSort === "name" ? "#bfdbfe" : "#94a3b8", borderColor: apSort === "name" ? "#3b82f6" : "#28405f" }}>
                <ArrowDownAZ size={13} /> Name
              </button>
              <button type="button" onClick={() => setApSort(apSort === "price_asc" ? "price_desc" : "price_asc")} title="Sort by price" style={{ ...S.ghostBtn, whiteSpace: "nowrap", color: apSort.startsWith("price") ? "#bfdbfe" : "#94a3b8", borderColor: apSort.startsWith("price") ? "#3b82f6" : "#28405f" }}>
                <ArrowDownUp size={13} /> Price {apSort === "price_asc" ? "↑" : apSort === "price_desc" ? "↓" : ""}
              </button>
            </div>
          </div>

          {accessPoints.length === 0 ? (
            <EmptyState text="No access points added yet." />
          ) : filteredAccessPoints.length === 0 ? (
            <EmptyState text="No access points match your search / filter." />
          ) : (
            <div style={S.grid}>
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
                    footer={
                      <button type="button" onClick={() => setEditApId(ap.id)} style={{ ...S.ghostBtn, width: "100%", justifyContent: "center" }}>
                        Manage pricing
                      </button>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "plans" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={hs.sectionHead}>
            <div>
              <div style={hs.sectionTitle}>Plans</div>
              <div style={hs.sectionSub}>Billing tiers admins can subscribe to.</div>
            </div>
            <button type="button" onClick={() => setAddPlanOpen(true)} style={S.primaryBtn}><Plus size={14} /> Add plan</button>
          </div>

          {plans.length === 0 ? (
            <EmptyState text="No plans created yet." />
          ) : (
            <div style={S.scrollRow}>
              {plans.map((plan, i) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  accentColor={accentFor(plan, i)}
                  actions={[
                    { icon: <Pencil size={13} />, label: "Edit plan", onClick: () => setEditPlanId(plan.id) },
                    { icon: <Power size={13} />, label: plan.is_active ? "Deactivate" : "Activate", tone: plan.is_active ? "default" : "active", onClick: () => updatePlanMeta(plan.id, { is_active: !plan.is_active }) },
                    { icon: <Trash2 size={13} />, label: "Delete", tone: "danger", onClick: () => deletePlan(plan) },
                  ]}
                  footer={
                    <button type="button" onClick={() => setEditPlanId(plan.id)} style={{ ...S.ghostBtn, width: "100%", justifyContent: "center" }}>
                      Manage plan
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "admins" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
          <div style={hs.card}>
            <div style={hs.sectionTitle}>Admins</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {adminRows.map((row) => (
                <button
                  key={row.admin_id}
                  type="button"
                  onClick={() => openAdminDetail(row.admin_id)}
                  style={{
                    ...adminRowStyle,
                    borderColor: detail?.admin_id === row.admin_id ? "#3b82f6" : "rgba(148,163,184,0.14)",
                    background: detail?.admin_id === row.admin_id ? "rgba(59,130,246,.08)" : "#0b1220",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: "white" }}>{row.username}</div>
                  <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
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
              {adminRows.length === 0 && <div style={{ fontSize: 12, color: T.textFaint }}>No admins yet.</div>}
            </div>
          </div>

          <div style={hs.card}>
            {!detail && <div style={{ fontSize: 13, color: T.textDim }}>Select an admin to view subscription details.</div>}
            {detail && (
              <div style={{ display: "grid", gap: 18 }}>
                <div style={hs.sectionTitle}>{detail.username} — subscription detail</div>

                {detail.subscription ? (
                  <div style={detailCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>{detail.subscription.plan_name}</div>
                        <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 3 }}>Period end: {fmtDateShort(detail.subscription.current_period_end)}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: statusColor(detail.subscription.status), background: `${statusColor(detail.subscription.status)}22`, border: `1px solid ${statusColor(detail.subscription.status)}55`, borderRadius: 999, padding: "4px 10px" }}>
                        {detail.subscription.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => forceStatus(detail.admin_id, "active")} style={S.ghostBtn}>Force active</button>
                      <button type="button" onClick={() => forceStatus(detail.admin_id, "grace")} style={S.ghostBtn}>Force grace</button>
                      <button type="button" onClick={() => forceStatus(detail.admin_id, "expired")} style={S.ghostBtn}>Force expired</button>
                    </div>

                    <hr style={{ ...S.divider, margin: "14px 0 10px" }} />

                    <div style={S.sectionLabel}>Switch plan</div>
                    <div style={{ fontSize: 11, color: T.textFaint, marginTop: 3 }}>Free master override — replaces their current fixed access points immediately, no charge.</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <select value={switchPlanSelect} onChange={(e) => setSwitchPlanSelect(e.target.value)} style={{ ...S.input, flex: 1, minWidth: 180 }}>
                        <option value="">Select a plan…</option>
                        {plans.filter((p) => p.id !== detail.subscription.plan_id).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => switchAdminPlan(detail.admin_id)} disabled={!switchPlanSelect} style={S.primaryBtn}>Switch plan</button>
                    </div>
                  </div>
                ) : (
                  <div style={detailCard}>
                    <div style={{ fontSize: 13, color: T.textDim, marginBottom: 10 }}>No plan subscription yet.</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <select value={switchPlanSelect} onChange={(e) => setSwitchPlanSelect(e.target.value)} style={{ ...S.input, flex: 1, minWidth: 180 }}>
                        <option value="">Select a plan…</option>
                        {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <button type="button" onClick={() => switchAdminPlan(detail.admin_id)} disabled={!switchPlanSelect} style={S.primaryBtn}>Assign plan</button>
                    </div>
                  </div>
                )}

                <div>
                  <div style={S.sectionLabel}>Add-ons</div>
                  <div style={{ fontSize: 11, color: T.textFaint, marginTop: 3 }}>
                    <Clock size={10} style={{ verticalAlign: -1 }} /> expires it (keeps the record) · <Trash2 size={10} style={{ verticalAlign: -1 }} /> deletes it completely
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {detail.addons.length === 0 && <span style={{ fontSize: 12, color: T.textFaint }}>None</span>}
                    {detail.addons.map((a) => (
                      <span
                        key={a.id}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", color: "#c4b5fd", borderRadius: 999, padding: "5px 8px 5px 11px" }}
                      >
                        {a.label || a.key} · {a.status}
                        <button
                          type="button"
                          onClick={() => expireAdminAddon(detail.admin_id, a.access_point_id)}
                          title="Mark expired (keeps the record)"
                          style={{ width: 18, height: 18, borderRadius: 6, border: "none", background: "rgba(245,158,11,.18)", color: "#fbbf24", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                        >
                          <Clock size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAdminAddon(detail.admin_id, a.access_point_id)}
                          title="Remove completely (deletes the record)"
                          style={{ width: 18, height: 18, borderRadius: 6, border: "none", background: "rgba(239,68,68,.18)", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={S.sectionLabel}>Access breakdown by source</div>
                  {["master_granted", "plan_included", "addon_purchased"].map((src) => {
                    const items = (detail.grants || []).filter((g) => g.source === src);
                    if (items.length === 0) return null;
                    return (
                      <div key={src} style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textFaint, letterSpacing: 0.4 }}>{src.replace("_", " ")}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                          {items.map((g) => (
                            <span
                              key={g.id}
                              onClick={src === "master_granted" ? () => revokeKey(detail.admin_id, g.key) : undefined}
                              title={src === "master_granted" ? "Click to revoke" : "Managed by billing"}
                              style={{
                                fontSize: 11.5, borderRadius: 999, padding: "5px 11px",
                                cursor: src === "master_granted" ? "pointer" : "default",
                                border: src === "master_granted" ? "1px solid rgba(239,68,68,.3)" : "1px solid rgba(148,163,184,0.16)",
                                background: src === "master_granted" ? "rgba(239,68,68,.1)" : "#0b1220",
                                color: src === "master_granted" ? "#fca5a5" : "#cbd5e1",
                              }}
                            >
                              {g.key}{src === "master_granted" ? " ✕" : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <select value={grantKeySelect} onChange={(e) => setGrantKeySelect(e.target.value)} style={{ ...S.input, flex: 1, minWidth: 200 }}>
                      <option value="">Select access point to grant…</option>
                      {(() => {
                        const known = new Map(ACCESS_OPTIONS.map((a) => [a.key, a.label]));
                        accessPoints.forEach((ap) => { if (!known.has(ap.key)) known.set(ap.key, ap.label); });
                        return Array.from(known.entries()).map(([key, label]) => <option key={key} value={key}>{label} ({key})</option>);
                      })()}
                    </select>
                    <button type="button" onClick={() => grantSelectedKey(detail.admin_id)} style={S.primaryBtn}><ShieldCheck size={13} /> Grant</button>
                  </div>
                  <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>Master grants bypass any required-plan restriction.</div>
                </div>

                <div>
                  <div style={S.sectionLabel}>Invoices</div>
                  <div style={{ marginTop: 8 }}>
                    {detail.invoices.map((i) => (
                      <div key={i.id} style={invoiceRow}>
                        <span>{i.type === "plan" ? i.plan_name : i.access_point_key} — {fmtMoney(i.amount)} {i.currency} {i.discount_percent > 0 ? `(-${i.discount_percent}%)` : ""} — {i.status}</span>
                        <span style={{ color: T.textFaint }}>{fmtDateShort(i.created_at)}</span>
                      </div>
                    ))}
                    {detail.invoices.length === 0 && <div style={{ fontSize: 12, color: T.textFaint }}>No invoices yet.</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
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

function EmptyState({ text }) {
  return (
    <div style={{ border: "1px dashed rgba(148,163,184,0.22)", borderRadius: T.radiusLg, padding: 32, textAlign: "center", color: T.textFaint, fontSize: 13 }}>
      {text}
    </div>
  );
}

const hs = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" },
  title: { fontSize: 21, fontWeight: 800, color: "white" },
  subtitle: { fontSize: 12.5, color: T.textDim, marginTop: 4 },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  sectionTitle: { fontSize: 15, fontWeight: 800, color: "white" },
  sectionSub: { fontSize: 12, color: T.textDim, marginTop: 3 },
  card: { background: T.panelBg, border: "1px solid rgba(148,163,184,0.14)", borderRadius: T.radiusLg, padding: 16 },
};

const adminRowStyle = {
  textAlign: "left", padding: 12, borderRadius: 12, border: "1px solid", cursor: "pointer", width: "100%",
};

const detailCard = {
  border: "1px solid rgba(148,163,184,0.14)", borderRadius: T.radiusMd, padding: 14, background: "#0b1220",
};

const invoiceRow = {
  display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0",
  borderBottom: "1px solid rgba(148,163,184,0.1)", fontSize: 12.5, color: "#cbd5e1",
};