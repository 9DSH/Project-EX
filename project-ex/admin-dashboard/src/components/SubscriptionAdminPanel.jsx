import { useEffect, useState } from "react";
import { API_URL } from "../config";
import ACCESS_OPTIONS from "../constants/AccessPoints";
import PlanCard from "./PlanCard";

const authHeaders = (token) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

const TABS = [
  { key: "access-points", label: "Access Points" },
  { key: "plans", label: "Plans" },
  { key: "admins", label: "Admin Subscriptions" },
];

export default function SubscriptionAdminPanel() {
  const token = localStorage.getItem("token");
  const [tab, setTab] = useState("access-points");

  const [accessPoints, setAccessPoints] = useState([]);
  const [plans, setPlans] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [adminRows, setAdminRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const [newApKey, setNewApKey] = useState("");
  const [newApLabel, setNewApLabel] = useState("");
  const [newApRequiredPlan, setNewApRequiredPlan] = useState("");

  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanDefault, setNewPlanDefault] = useState(false);
  const [newPlanDuration, setNewPlanDuration] = useState(30);

  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [grantKeySelect, setGrantKeySelect] = useState("");

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
    .map((p) => ({
      currency_id: p.currency.id,
      network_id: p.network.id,
      label: `${p.currency.symbol} / ${p.network.chain}`,
    }));

  // Dropdown source for master's manual grant: the full RBAC catalog plus
  // any custom keys already in the sellable catalog that aren't in it.
  const grantableKeys = (() => {
    const known = new Map(ACCESS_OPTIONS.map((a) => [a.key, a.label]));
    accessPoints.forEach((ap) => { if (!known.has(ap.key)) known.set(ap.key, ap.label); });
    return Array.from(known.entries()).map(([key, label]) => ({ key, label }));
  })();

  // ── ACCESS POINTS ──────────────────────────────
  const createAccessPoint = async () => {
    if (!newApKey.trim() || !newApLabel.trim()) return;
    const res = await fetch(`${API_URL}/admin/subscriptions/access-points`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        key: newApKey.trim(),
        label: newApLabel.trim(),
        is_active: true,
        required_plan_id: newApRequiredPlan ? Number(newApRequiredPlan) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.detail || "Failed"); return; }
    setNewApKey(""); setNewApLabel(""); setNewApRequiredPlan("");
    loadAll();
  };

  const toggleAccessPointActive = async (ap) => {
    await fetch(`${API_URL}/admin/subscriptions/access-points/${ap.id}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ is_active: !ap.is_active }),
    });
    loadAll();
  };

  const setAccessPointRequiredPlan = async (ap, planId) => {
    const body = planId ? { required_plan_id: Number(planId) } : { clear_required_plan: true };
    await fetch(`${API_URL}/admin/subscriptions/access-points/${ap.id}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    loadAll();
  };

  const setAccessPointPrice = async (apId, currencyId, networkId, price, discount) => {
    if (!currencyId || !networkId || price === "" || price == null) return;
    await fetch(`${API_URL}/admin/subscriptions/access-points/${apId}/prices`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({
        currency_id: Number(currencyId), network_id: Number(networkId),
        price: Number(price), discount_percent: Number(discount || 0), is_active: true,
      }),
    });
    loadAll();
  };

  const deleteAccessPointPrice = async (apId, priceId) => {
    if (!window.confirm("Remove this price? The access point will no longer be purchasable for this pair.")) return;
    await fetch(`${API_URL}/admin/subscriptions/access-points/${apId}/prices/${priceId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    loadAll();
  };

  // ── PLANS ──────────────────────────────────────
  const createPlan = async () => {
    if (!newPlanName.trim()) return;
    const res = await fetch(`${API_URL}/admin/subscriptions/plans`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        name: newPlanName.trim(), is_active: true, is_default: newPlanDefault,
        duration_days: Number(newPlanDuration) || 30,
      }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.detail || "Failed"); return; }
    setNewPlanName(""); setNewPlanDefault(false); setNewPlanDuration(30);
    loadAll();
  };

  const togglePlanActive = async (plan) => {
    await fetch(`${API_URL}/admin/subscriptions/plans/${plan.id}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ is_active: !plan.is_active }),
    });
    loadAll();
  };

  const setPlanDefault = async (plan) => {
    await fetch(`${API_URL}/admin/subscriptions/plans/${plan.id}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ is_default: true }),
    });
    loadAll();
  };

  const setPlanDuration = async (plan, days) => {
    if (!days || Number(days) <= 0) return;
    await fetch(`${API_URL}/admin/subscriptions/plans/${plan.id}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ duration_days: Number(days) }),
    });
    loadAll();
  };

  const renamePlan = async (plan, name) => {
    if (!name || !name.trim()) return;
    await fetch(`${API_URL}/admin/subscriptions/plans/${plan.id}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ name: name.trim() }),
    });
    loadAll();
  };

  const deletePlan = async (plan) => {
    if (!window.confirm(`Delete plan "${plan.name}"? This only works if no admins are subscribed and no add-ons require it.`)) return;
    const res = await fetch(`${API_URL}/admin/subscriptions/plans/${plan.id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.detail || "Failed to delete"); return; }
    loadAll();
  };

  const setPlanPrice = async (planId, currencyId, networkId, price, discount) => {
    if (!currencyId || !networkId || price === "" || price == null) return;
    await fetch(`${API_URL}/admin/subscriptions/plans/${planId}/prices`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({
        currency_id: Number(currencyId), network_id: Number(networkId),
        price: Number(price), discount_percent: Number(discount || 0), is_active: true,
      }),
    });
    loadAll();
  };

  const deletePlanPrice = async (planId, priceId) => {
    if (!window.confirm("Remove this price? The plan will no longer be subscribable for this pair.")) return;
    await fetch(`${API_URL}/admin/subscriptions/plans/${planId}/prices/${priceId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    loadAll();
  };

  const togglePlanAccessPoint = async (plan, ap) => {
    const already = plan.access_points.some((x) => x.access_point_id === ap.id);
    const nextItems = already
      ? plan.access_points.filter((x) => x.access_point_id !== ap.id).map((x) => ({ access_point_id: x.access_point_id, choice_group: x.choice_group }))
      : [...plan.access_points.map((x) => ({ access_point_id: x.access_point_id, choice_group: x.choice_group })), { access_point_id: ap.id, choice_group: null }];

    await fetch(`${API_URL}/admin/subscriptions/plans/${plan.id}/access-points`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ items: nextItems }),
    });
    loadAll();
  };

  // ── ADMIN OVERSIGHT ────────────────────────────
  const openAdminDetail = async (adminId) => {
    const res = await fetch(`${API_URL}/admin/subscriptions/admins/${adminId}`, { headers: authHeaders(token) });
    if (res.ok) setDetail(await res.json());
  };

  const forceStatus = async (adminId, status) => {
    await fetch(`${API_URL}/admin/subscriptions/admins/${adminId}/status`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ status }),
    });
    openAdminDetail(adminId);
    loadAll();
  };

  const grantSelectedKey = async (adminId) => {
    if (!grantKeySelect) return;
    await fetch(`${API_URL}/admin/subscriptions/admins/${adminId}/grant`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ key: grantKeySelect }),
    });
    setGrantKeySelect("");
    openAdminDetail(adminId);
  };

  const revokeKey = async (adminId, key) => {
    await fetch(`${API_URL}/admin/subscriptions/admins/${adminId}/revoke`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ key }),
    });
    openAdminDetail(adminId);
  };

  return (
    <div>
      <div style={S.header}>
        <div>
          <div style={S.title}>Subscription Management</div>
          <div style={S.subtitle}>Access points, plans, pricing &amp; admin subscription oversight</div>
        </div>
        <button onClick={loadAll} style={S.refreshBtn}>{loading ? "…" : "Refresh"}</button>
      </div>

      <div style={S.tabRow}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={t.key === tab ? S.tabActive : S.tab}>{t.label}</button>
        ))}
      </div>

      {tab === "access-points" && (
        <div style={S.stack}>
          <div style={S.card}>
            <div style={S.cardTitle}>Add Access Point</div>
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <input
                placeholder="key (pick from existing permissions, e.g. exchange.manage)"
                list="known-access-keys"
                value={newApKey}
                onChange={(e) => setNewApKey(e.target.value)}
                style={S.input}
              />
              <datalist id="known-access-keys">
                {ACCESS_OPTIONS.map((a) => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </datalist>
              <input placeholder="label" value={newApLabel} onChange={(e) => setNewApLabel(e.target.value)} style={S.input} />
              <select value={newApRequiredPlan} onChange={(e) => setNewApRequiredPlan(e.target.value)} style={S.input}>
                <option value="">No required plan</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={createAccessPoint} style={S.primaryBtn}>Add</button>
            </div>
            <div style={S.subtle}>
              The key must match an existing permission key from your RBAC catalog (see Users → Access Points).
              This only controls what's sellable/priced — it does not create new permissions in the app.
              If a required plan is set, only admins subscribed to that plan can purchase this add-on.
            </div>
          </div>

          {accessPoints.length === 0 && <div style={{ ...S.card, textAlign: "center" }}><span style={S.subtle}>No access points added yet.</span></div>}

          {accessPoints.map((ap) => (
            <div key={ap.id} style={S.card}>
              <div style={S.rowBetween}>
                <div>
                  <div style={S.cardTitle}>{ap.label} <span style={S.mono}>({ap.key})</span></div>
                  <span style={ap.is_active ? S.statusActive : S.statusInactive}>{ap.is_active ? "ACTIVE" : "INACTIVE"}</span>
                </div>
                <button onClick={() => toggleAccessPointActive(ap)} style={S.secondaryBtn}>
                  {ap.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={S.subtle}>REQUIRED PLAN</div>
                <select
                  value={ap.required_plan_id || ""}
                  onChange={(e) => setAccessPointRequiredPlan(ap, e.target.value)}
                  style={{ ...S.input, marginTop: 6, width: 260 }}
                >
                  <option value="">No required plan — purchasable by anyone</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={S.subtle}>PRICING</div>
                {ap.prices.length === 0 ? (
                  <div style={{ ...S.subtle, marginTop: 8 }}>No price set — not purchasable yet.</div>
                ) : (
                  <div style={S.priceTable}>
                    <div style={S.priceTableHead}>
                      <span>Pair</span><span>Price</span><span>Discount %</span><span>Effective</span><span>Status</span><span></span>
                    </div>
                    {ap.prices.map((p) => (
                      <PriceEditRow key={p.id} price={p} onSave={(price, discount) => setAccessPointPrice(ap.id, p.currency_id, p.network_id, price, discount)} onDelete={() => deleteAccessPointPrice(ap.id, p.id)} />
                    ))}
                  </div>
                )}
                <PriceAdder pairOptions={pairOptions} onSave={(cid, nid, price, discount) => setAccessPointPrice(ap.id, cid, nid, price, discount)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "plans" && (
        <div style={S.stack}>
          <div style={S.card}>
            <div style={S.cardTitle}>Add Plan</div>
            <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input placeholder="plan name" value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} style={S.input} />
              <input placeholder="duration (days)" type="number" value={newPlanDuration} onChange={(e) => setNewPlanDuration(e.target.value)} style={{ ...S.input, width: 140 }} />
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#94a3b8" }}>
                <input type="checkbox" checked={newPlanDefault} onChange={(e) => setNewPlanDefault(e.target.checked)} />
                Default (free) plan
              </label>
              <button onClick={createPlan} style={S.primaryBtn}>Add</button>
            </div>
          </div>

          {plans.length === 0 && <div style={{ ...S.card, textAlign: "center" }}><span style={S.subtle}>No plans created yet.</span></div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                highlight={expandedPlanId === plan.id}
                footer={
                  <button onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)} style={{ ...S.secondaryBtn, width: "100%" }}>
                    {expandedPlanId === plan.id ? "Close Editor" : "Manage Plan"}
                  </button>
                }
              />
            ))}
          </div>

          {plans.filter((p) => p.id === expandedPlanId).map((plan) => (
            <div key={plan.id} style={{ ...S.card, borderColor: "#3b82f6" }}>
              <div style={S.rowBetween}>
                <div style={S.cardTitle}>Editing: {plan.name}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!plan.is_default && <button onClick={() => setPlanDefault(plan)} style={S.secondaryBtn}>Make Default</button>}
                  <button onClick={() => togglePlanActive(plan)} style={S.secondaryBtn}>{plan.is_active ? "Deactivate" : "Activate"}</button>
                  <button onClick={() => deletePlan(plan)} style={S.deleteTextBtn}>Delete Plan</button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
                <div>
                  <div style={S.subtle}>NAME</div>
                  <input defaultValue={plan.name} onBlur={(e) => renamePlan(plan, e.target.value)} style={{ ...S.input, marginTop: 6 }} />
                </div>
                <div>
                  <div style={S.subtle}>DURATION (DAYS)</div>
                  <input type="number" defaultValue={plan.duration_days} onBlur={(e) => setPlanDuration(plan, e.target.value)} style={{ ...S.input, marginTop: 6, width: 140 }} disabled={plan.is_default} />
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={S.subtle}>PRICING</div>
                {plan.is_default ? (
                  <div style={{ ...S.subtle, marginTop: 8 }}>Default plan — always free, no pricing needed.</div>
                ) : (
                  <>
                    {plan.prices.length > 0 && (
                      <div style={S.priceTable}>
                        <div style={S.priceTableHead}>
                          <span>Pair</span><span>Price</span><span>Discount %</span><span>Effective</span><span>Status</span><span></span>
                        </div>
                        {plan.prices.map((p) => (
                          <PriceEditRow key={p.id} price={p} onSave={(price, discount) => setPlanPrice(plan.id, p.currency_id, p.network_id, price, discount)} onDelete={() => deletePlanPrice(plan.id, p.id)} />
                        ))}
                      </div>
                    )}
                    <PriceAdder pairOptions={pairOptions} onSave={(cid, nid, price, discount) => setPlanPrice(plan.id, cid, nid, price, discount)} />
                  </>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={S.subtle}>FIXED ACCESS POINTS (auto-granted on subscribe)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {accessPoints.map((ap) => {
                    const included = plan.access_points.some((x) => x.access_point_id === ap.id);
                    return (
                      <button key={ap.id} onClick={() => togglePlanAccessPoint(plan, ap)} style={included ? S.chipActive : S.chip}>
                        {ap.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={S.subtle}>AVAILABLE ADD-ONS (require this plan — set via each access point's "Required Plan")</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {plan.addons.length === 0 && <span style={S.subtle}>None yet</span>}
                  {plan.addons.map((ap) => <span key={ap.id} style={S.chipAddon}>{ap.label}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "admins" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
          <div style={S.card}>
            <div style={S.cardTitle}>Admins</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {adminRows.map((row) => (
                <div
                  key={row.admin_id}
                  onClick={() => openAdminDetail(row.admin_id)}
                  style={{ ...S.adminRow, borderColor: detail?.admin_id === row.admin_id ? "#3b82f6" : "#1e293b" }}
                >
                  <div style={{ fontWeight: 700 }}>{row.username}</div>
                  <div style={S.subtle}>
                    {row.subscription ? `${row.subscription.plan_name} · ${row.subscription.status}` : "No subscription"}
                    {row.addons.length > 0 && ` · ${row.addons.length} addon(s)`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={S.card}>
            {!detail && <div style={S.subtle}>Select an admin to view details.</div>}
            {detail && (
              <div>
                <div style={S.cardTitle}>{detail.username} — Subscription Detail</div>

                {detail.subscription ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={S.subtle}>Plan: {detail.subscription.plan_name} · Status: {detail.subscription.status}</div>
                    <div style={S.subtle}>Period end: {detail.subscription.current_period_end || "—"}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => forceStatus(detail.admin_id, "active")} style={S.secondaryBtn}>Force Active</button>
                      <button onClick={() => forceStatus(detail.admin_id, "grace")} style={S.secondaryBtn}>Force Grace</button>
                      <button onClick={() => forceStatus(detail.admin_id, "expired")} style={S.secondaryBtn}>Force Expired</button>
                    </div>
                  </div>
                ) : <div style={S.subtle}>No plan subscription yet.</div>}

                <div style={{ marginTop: 16 }}>
                  <div style={S.subtle}>Add-ons</div>
                  {detail.addons.length === 0 && <div style={S.subtle}>None</div>}
                  {detail.addons.map((a) => (
                    <div key={a.id} style={S.priceRow}>
                      <span>{a.label || a.key} — {a.status}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={S.subtle}>ACCESS BREAKDOWN BY SOURCE</div>
                  {["master_granted", "plan_included", "addon_purchased"].map((src) => {
                    const items = (detail.grants || []).filter((g) => g.source === src);
                    if (items.length === 0) return null;
                    return (
                      <div key={src} style={{ marginTop: 10 }}>
                        <div style={S.sourceLabel}>{src.replace("_", " ").toUpperCase()}</div>
                        <div style={S.chipWrap}>
                          {items.map((g) => (
                            <span
                              key={g.id}
                              style={src === "master_granted" ? S.chipRevocable : S.chip}
                              onClick={src === "master_granted" ? () => revokeKey(detail.admin_id, g.key) : undefined}
                              title={src === "master_granted" ? "Click to revoke" : "Managed by billing — cancel the subscription/addon to remove"}
                            >
                              {g.key}{src === "master_granted" ? " ✕" : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <select value={grantKeySelect} onChange={(e) => setGrantKeySelect(e.target.value)} style={{ ...S.input, flex: 1 }}>
                      <option value="">Select access point to grant…</option>
                      {(() => {
                        const known = new Map(ACCESS_OPTIONS.map((a) => [a.key, a.label]));
                        accessPoints.forEach((ap) => { if (!known.has(ap.key)) known.set(ap.key, ap.label); });
                        return Array.from(known.entries()).map(([key, label]) => (
                          <option key={key} value={key}>{label} ({key})</option>
                        ));
                      })()}
                    </select>
                    <button onClick={() => grantSelectedKey(detail.admin_id)} style={S.primaryBtn}>Grant</button>
                  </div>
                  <div style={S.subtle}>Master grants bypass any required-plan restriction.</div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={S.subtle}>Invoices</div>
                  {detail.invoices.map((i) => (
                    <div key={i.id} style={S.priceRow}>
                      <span>{i.type === "plan" ? i.plan_name : i.access_point_key} — {i.amount} {i.currency} {i.discount_percent > 0 ? `(-${i.discount_percent}%)` : ""} — {i.status}</span>
                      <span style={S.subtle}>{i.created_at}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PriceEditRow({ price, onSave, onDelete }) {
  const [p, setP] = useState(price.price);
  const [d, setD] = useState(price.discount_percent);
  return (
    <div style={S.priceTableRow}>
      <span>{price.currency} / {price.network}</span>
      <input type="number" value={p} onChange={(e) => setP(e.target.value)} onBlur={() => onSave(p, d)} style={S.priceInput} />
      <input type="number" value={d} onChange={(e) => setD(e.target.value)} onBlur={() => onSave(p, d)} style={S.priceInput} />
      <span style={{ fontWeight: 700 }}>{price.effective_price}</span>
      <span style={price.is_active ? S.statusActive : S.statusInactive}>{price.is_active ? "ACTIVE" : "OFF"}</span>
      <button onClick={onDelete} style={S.deleteBtn}>✕</button>
    </div>
  );
}

function PriceAdder({ pairOptions, onSave }) {
  const [pair, setPair] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
      <select value={pair} onChange={(e) => setPair(e.target.value)} style={S.input}>
        <option value="">Select pair…</option>
        {pairOptions.map((p, i) => (
          <option key={i} value={`${p.currency_id}:${p.network_id}`}>{p.label}</option>
        ))}
      </select>
      <input placeholder="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} style={S.priceInput} />
      <input placeholder="discount %" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} style={S.priceInput} />
      <button
        style={S.secondaryBtn}
        onClick={() => {
          if (!pair) return;
          const [cid, nid] = pair.split(":");
          onSave(cid, nid, price, discount);
          setPair(""); setPrice(""); setDiscount("");
        }}
      >
        Set Price
      </button>
    </div>
  );
}

const S = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 800, color: "#3b82f6" },
  subtitle: { fontSize: 12, color: "#64748b", marginTop: 4 },
  refreshBtn: { background: "#0f1b2f", border: "1px solid #243957", color: "white", padding: "8px 14px", borderRadius: 10, cursor: "pointer" },
  tabRow: { display: "flex", gap: 8, marginBottom: 16 },
  tab: { padding: "8px 14px", borderRadius: 10, border: "1px solid #1e293b", background: "#0b1220", color: "#94a3b8", cursor: "pointer" },
  tabActive: { padding: "8px 14px", borderRadius: 10, border: "1px solid #3b82f6", background: "#1d4fd871", color: "white", cursor: "pointer", fontWeight: 700 },
  stack: { display: "flex", flexDirection: "column", gap: 14 },
  card: { background: "linear-gradient(180deg,#111827 0%, #0a1226 100%)", border: "1px solid #1e293b", borderRadius: 16, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700 },
  subtle: { fontSize: 12, color: "#7c8ca8", marginTop: 4 },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  input: { background: "#0b1220", border: "1px solid #1e293b", borderRadius: 10, padding: 10, color: "white", outline: "none" },
  priceInput: { width: 90, background: "#0b1220", border: "1px solid #1e293b", borderRadius: 8, padding: "6px 8px", color: "white" },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1e293b", fontSize: 13 },
  priceTable: { marginTop: 8, border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden" },
  priceTableHead: { display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 70px 28px", gap: 10, padding: "8px 10px", background: "#0b1220", fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 },
  priceTableRow: { display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 70px 28px", gap: 10, alignItems: "center", padding: "8px 10px", fontSize: 13, borderTop: "1px solid #16202f" },
  statusActive: { fontSize: 10, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 999, padding: "2px 8px" },
  statusInactive: { fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 999, padding: "2px 8px" },
  deleteBtn: { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: 6, width: 24, height: 24, cursor: "pointer", fontSize: 11, lineHeight: 1 },
  deleteTextBtn: { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 12 },
  primaryBtn: { background: "#1d4fd871", border: "1px solid #2563eb", color: "white", padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 700 },
  secondaryBtn: { background: "#0e1a2d", border: "1px solid #28405f", color: "#cbd5e1", padding: "6px 12px", borderRadius: 10, cursor: "pointer", fontSize: 12 },
  chip: { padding: "6px 12px", borderRadius: 999, border: "1px solid #1e293b", background: "#0b1220", color: "#94a3b8", cursor: "pointer", fontSize: 12 },
  chipActive: { padding: "6px 12px", borderRadius: 999, border: "1px solid #22c55e", background: "rgba(34,197,94,0.12)", color: "#6ee7b7", cursor: "pointer", fontSize: 12 },
  chipAddon: { padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(168,85,247,0.25)", background: "rgba(168,85,247,0.1)", color: "#c4b5fd", fontSize: 12 },
  chipRevocable: { padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#fca5a5", cursor: "pointer", fontSize: 12 },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 },
  sourceLabel: { fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: 0.6 },
  badge: { fontSize: 10, background: "#f59e0b33", color: "#f59e0b", padding: "2px 8px", borderRadius: 999, marginLeft: 8 },
  adminRow: { padding: 10, borderRadius: 10, border: "1px solid #1e293b", cursor: "pointer" },
  mono: { fontFamily: "monospace", color: "#7c8ca8", fontSize: 12 },
};