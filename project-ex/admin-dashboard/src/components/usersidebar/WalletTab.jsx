import { useEffect, useState } from "react";
import { API_URL } from "../../config";
import PermissionGate from "../PermissionGate";
import {
  Trash2,
  ChevronDown,
  Wallet,
  Link2,
  Banknote,
  Landmark,
  User,
  CreditCard,
  Building2,
  ArrowLeftRight,
  Hash,
} from "lucide-react";
import { MiniDropdown } from "./HubFilterControls";
import "./UserSidebar.css";

export default function WalletTab({
  user,   currencies,  networks,  pairs,  selectedCurrency,  setSelectedCurrency,
  selectedNetwork,  setSelectedNetwork,  balanceAction,  setBalanceAction,  balance,
  setBalance,  balanceOpen,  setBalanceOpen,  updateBalance,  deleteBalancePair,  transferOpen,  setTransferOpen,
  // ... all transfer related props
  transferCurrency,  setTransferCurrency,  transferNetwork,  setTransferNetwork,
  transferAmount,  setTransferAmount,  transferNote,  setTransferNote,  transferSearch,
  setTransferSearch,  transferResults,  transferSearchLoading,  availableNetworks,
  balanceRequiresNetwork,  transferAvailableNetworks,  transferRequiresNetwork,
  transferTarget,  transferError,  transferSuccess,  transferSubmitting,  transferCurrencySymbol,
  transferMaxAmount,  handleTransferSearchChange,  selectTransferTarget,
  executeTransfer,  permissions,  hasPermission,  setTransferSuccess,  setTransferError

}) {
  const [expandedWalletKey, setExpandedWalletKey] = useState(null);
  const [walletPairDetails, setWalletPairDetails] = useState({});
  const [walletPairDrafts, setWalletPairDrafts] = useState({});
  const [walletPairLoading, setWalletPairLoading] = useState({});
  const [walletPairSaving, setWalletPairSaving] = useState({});
  const [walletPairMessages, setWalletPairMessages] = useState({});
  const [irtBankDraft, setIrtBankDraft] = useState({
    bank_holder_name: "",
    bank_card_number: "",
    bank_name: "",
    bank_sheba: "",
  });
  const [irtBankSaving, setIrtBankSaving] = useState(false);
  const [irtBankMessage, setIrtBankMessage] = useState(null);

  const canManageBalance = hasPermission(user, "balance.manage");

  useEffect(() => {
    setExpandedWalletKey(null);
    setWalletPairDetails({});
    setWalletPairDrafts({});
    setWalletPairLoading({});
    setWalletPairSaving({});
    setWalletPairMessages({});
  }, [user?.user_id]);

  useEffect(() => {
    const bankInfo = user?.bank_info || {};
    setIrtBankDraft({
      bank_holder_name: bankInfo.bank_holder_name || "",
      bank_card_number: bankInfo.bank_card_number || "",
      bank_name: bankInfo.bank_name || "",
      bank_sheba: bankInfo.bank_sheba || "",
    });
    setIrtBankMessage(null);
  }, [user?.user_id, user?.bank_info]);

  const getWalletKey = (balanceItem) =>
    `${balanceItem.currency_id ?? balanceItem.currency}-${balanceItem.network_id ?? balanceItem.network}`;

  const formatBalance = (value) =>
    Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    });

  const irtBalance = Number(
    user?.balances?.find((b) => String(b.currency || "").toUpperCase() === "IRT")?.available || 0
  );

  const saveIrtBankInfo = async () => {
    if (!user?.user_id) return;
    const token = localStorage.getItem("token");
    setIrtBankSaving(true);
    setIrtBankMessage(null);
    try {
      const res = await fetch(`${API_URL}/admin/users/${user.user_id}/bank-info`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(irtBankDraft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to save bank info");
      setIrtBankDraft({
        bank_holder_name: data?.bank_holder_name || "",
        bank_card_number: data?.bank_card_number || "",
        bank_name: data?.bank_name || "",
        bank_sheba: data?.bank_sheba || "",
      });
      setIrtBankMessage({ type: "success", text: "IRT bank info saved successfully." });
    } catch (err) {
      setIrtBankMessage({ type: "error", text: err.message || "Failed to save bank info" });
    } finally {
      setIrtBankSaving(false);
    }
  };

  const fetchWalletPair = async (balanceItem) => {
    if (!user?.user_id) return;

    const walletKey = getWalletKey(balanceItem);
    const token = localStorage.getItem("token");
    const params = new URLSearchParams({
      currency_id: String(balanceItem.currency_id),
      network_id: String(balanceItem.network_id),
    });

    setWalletPairLoading((prev) => ({ ...prev, [walletKey]: true }));
    setWalletPairMessages((prev) => ({ ...prev, [walletKey]: null }));

    try {
      const res = await fetch(`${API_URL}/admin/users/${user.user_id}/wallet-pair?${params.toString()}`, {
        headers: { Authorization: "Bearer " + token },
      });

      const data = await res.json();

      setWalletPairDetails((prev) => ({ ...prev, [walletKey]: data }));
      setWalletPairDrafts((prev) => ({
        ...prev,
        [walletKey]: {
          deposit_address: data?.deposit_address ?? "",
          external_wallet_address: data?.external_wallet_address ?? "",
        },
      }));
    } catch (err) {
      setWalletPairMessages((prev) => ({
        ...prev,
        [walletKey]: { type: "error", text: err.message || "Failed to load wallet details" },
      }));
    } finally {
      setWalletPairLoading((prev) => ({ ...prev, [walletKey]: false }));
    }
  };

  const toggleWalletRow = (balanceItem) => {
    const walletKey = getWalletKey(balanceItem);
    const isOpen = expandedWalletKey === walletKey;

    setExpandedWalletKey(isOpen ? null : walletKey);

    if (
      !isOpen &&
      !walletPairDetails[walletKey] &&
      !walletPairLoading[walletKey]
    ) {
      fetchWalletPair(balanceItem);
    }
  };

  const handleWalletDraftChange = (walletKey, field, value) => {
    setWalletPairDrafts((prev) => ({
      ...prev,
      [walletKey]: {
        ...(prev[walletKey] || {}),
        [field]: value,
      },
    }));
    setWalletPairMessages((prev) => ({ ...prev, [walletKey]: null }));
  };

  // One save for the whole pair: only the fields that actually changed are sent.
  const saveWalletPair = async (balanceItem) => {
    if (!user?.user_id) return;

    const walletKey = getWalletKey(balanceItem);
    const token = localStorage.getItem("token");
    const draft = walletPairDrafts[walletKey] || {};
    const saved = walletPairDetails[walletKey] || {};
    const changed = ["deposit_address", "external_wallet_address"].filter(
      (f) => (draft[f] ?? "") !== (saved[f] ?? "")
    );
    if (!changed.length) return;

    setWalletPairSaving((prev) => ({ ...prev, [walletKey]: true }));
    setWalletPairMessages((prev) => ({ ...prev, [walletKey]: null }));

    try {
      const body = {
        currency_id: balanceItem.currency_id,
        network_id: balanceItem.network_id,
      };
      changed.forEach((f) => {
        body[f] = draft[f] ?? "";
      });

      const res = await fetch(`${API_URL}/admin/users/${user.user_id}/wallet-pair`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to save wallet addresses");
      }

      setWalletPairDetails((prev) => ({
        ...prev,
        [walletKey]: { ...(prev[walletKey] || {}), ...data },
      }));
      setWalletPairDrafts((prev) => {
        const next = { ...(prev[walletKey] || {}) };
        changed.forEach((f) => {
          next[f] = data?.[f] ?? "";
        });
        return { ...prev, [walletKey]: next };
      });
      setWalletPairMessages((prev) => ({
        ...prev,
        [walletKey]: { type: "success", text: "Wallet addresses updated." },
      }));
    } catch (err) {
      setWalletPairMessages((prev) => ({
        ...prev,
        [walletKey]: { type: "error", text: err.message || "Failed to save wallet addresses" },
      }));
    } finally {
      setWalletPairSaving((prev) => ({ ...prev, [walletKey]: false }));
    }
  };

  return (
    <>
      {/* ================= BALANCE LIST ================= */}
      <div className="us-wallet-list">
        {user.balances?.length ? (
          user.balances.map((b, idx) => {
            const walletKey = getWalletKey(b);
            const isOpen = expandedWalletKey === walletKey;
            const isIrt = b.currency === "IRT";
            const walletDetails = walletPairDetails[walletKey];
            const walletDraft = walletPairDrafts[walletKey] || {
              deposit_address: "",
              external_wallet_address: "",
            };
            const isLoadingWallet = walletPairLoading[walletKey];
            const savingField = walletPairSaving[walletKey];
            const walletDirty = ["deposit_address", "external_wallet_address"].some(
              (f) => (walletDraft[f] ?? "") !== (walletDetails?.[f] ?? "")
            );
            const walletMessage = walletPairMessages[walletKey];
            const canDeleteBalance = Number(b.available || 0) === 0 && Number(b.frozen || 0) === 0;
            const coinLabel = (b.currency || "?").slice(0, 3).toUpperCase();

            return (
              <div
                key={`${walletKey}-${idx}`}
                className={`us-wallet-card${isOpen ? " is-open" : ""}`}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  className="us-wallet-trigger"
                  onClick={() => toggleWalletRow(b)}
                >
                  <div className="us-wallet-left">
                    <div className={`us-wallet-coin-badge${isIrt ? " is-irt" : " is-crypto"}`}>
                      {isIrt ? <Landmark size={18} /> : coinLabel.slice(0, 2)}
                    </div>
                    <div className="us-wallet-labels">
                      <div className="us-wallet-title-row">
                        <span className="us-wallet-symbol">{b.currency}</span>
                        {!isIrt && (
                          <span className="us-network-tag">
                            {b.network_chain || b.network || "No network"}
                          </span>
                        )}
                      </div>
                      <div className="us-wallet-meta">
                        {isIrt ? "Internal toman balance" : b.network || "Wallet pair"}
                      </div>
                    </div>
                  </div>

                  <div className="us-wallet-balances">
                    <div className="us-wallet-balance-item">
                      <span className="us-wallet-balance-label">Available</span>
                      <span className="us-wallet-balance-value is-available">
                        {formatBalance(b.available)}
                      </span>
                    </div>
                    <div className="us-wallet-balance-divider" />
                    <div className="us-wallet-balance-item">
                      <span className="us-wallet-balance-label">Frozen</span>
                      <span className="us-wallet-balance-value is-frozen">
                        {formatBalance(b.frozen)}
                      </span>
                    </div>
                    <span className={`us-chevron${isOpen ? " is-open" : ""}`}>
                      <ChevronDown size={16} />
                    </span>
                  </div>
                </button>

                {/* Smooth grid-row expand/collapse, same pattern used across
                    the other tabs (Identity, New Order, Exchange for User). */}
                <div className={`us-collapse${isOpen ? " is-open" : ""}`}>
                  <div className="us-collapse-inner">
                    <div className="us-wallet-panel">
                      {isIrt ? (
                        /* ---- IRT bank details: one compact row per field ---- */
                        <>
                          {irtBankMessage && (
                            <div className={`us-inline-msg${irtBankMessage.type === "error" ? " is-error" : " is-success"}`}>
                              {irtBankMessage.text}
                            </div>
                          )}

                          <div className="us-kv-caption">Bank account details</div>
                          <div className="us-kv-list">
                            {[
                              ["bank_holder_name", "Holder name", User],
                              ["bank_card_number", "Card number", CreditCard],
                              ["bank_name", "Bank name", Building2],
                              ["bank_sheba", "Sheba (IBAN)", Hash],
                            ].map(([field, fieldLabel, FieldIcon]) => (
                              <div key={field} className="us-kv-row">
                                <div className="us-kv-label" title={fieldLabel}>
                                  <FieldIcon size={13} />
                                  <span>{fieldLabel}</span>
                                </div>
                                {canManageBalance ? (
                                  <input
                                    value={irtBankDraft[field]}
                                    onChange={(e) =>
                                      setIrtBankDraft((prev) => ({ ...prev, [field]: e.target.value }))
                                    }
                                    className="us-kv-input"
                                    placeholder="Not set"
                                  />
                                ) : (
                                  <div className="us-kv-value">{irtBankDraft[field] || "Not set yet"}</div>
                                )}
                              </div>
                            ))}
                          </div>

                          {canManageBalance && (
                            <div className="us-kv-footer">
                              <span className="us-kv-hint">Used to verify manual IRT deposits/withdrawals.</span>
                              <button
                                type="button"
                                className="primaryBtn us-btn-compact"
                                onClick={saveIrtBankInfo}
                                disabled={irtBankSaving}
                              >
                                {irtBankSaving ? "Saving…" : "Save"}
                              </button>
                            </div>
                          )}
                        </>
                      ) : isLoadingWallet ? (
                        <div className="us-wallet-loading">
                          <span className="us-wallet-spinner-dot" />
                          Loading wallet details…
                        </div>
                      ) : (
                        <>
                          {walletMessage && (
                            <div className={`us-inline-msg${walletMessage.type === "error" ? " is-error" : " is-success"}`}>
                              {walletMessage.text}
                            </div>
                          )}

                          <div className="us-kv-caption">Wallet addresses</div>
                          <div className="us-kv-list">
                            {[
                              ["deposit_address", "Deposit wallet", Wallet],
                              ["external_wallet_address", "External wallet", Link2],
                            ].map(([field, fieldLabel, FieldIcon]) => (
                              <div key={field} className="us-kv-row">
                                <div className="us-kv-label" title={fieldLabel}>
                                  <FieldIcon size={13} />
                                  <span>{fieldLabel}</span>
                                </div>
                                {canManageBalance ? (
                                  <input
                                    value={walletDraft[field] ?? ""}
                                    onChange={(e) => handleWalletDraftChange(walletKey, field, e.target.value)}
                                    className="us-kv-input is-mono"
                                    placeholder="Not set"
                                  />
                                ) : (
                                  <div className="us-kv-value is-mono">
                                    {walletDetails?.[field] || "Not set yet"}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          <PermissionGate allowed={canManageBalance}>
                            <div className="us-kv-footer">
                              <span className="us-kv-hint">
                                Deposit address and user withdrawal destination.
                              </span>
                              <button
                                type="button"
                                className="primaryBtn us-btn-compact"
                                onClick={() => saveWalletPair(b)}
                                disabled={savingField || !walletDirty}
                              >
                                {savingField ? "Saving…" : "Update"}
                              </button>
                            </div>

                            <div className="us-wallet-delete-row">
                              <div className="us-wallet-delete-text">
                                <div className="us-wallet-delete-title">Delete balance row</div>
                                <div className="us-wallet-delete-desc">
                                  Only when both balances are zero and there is no history.
                                </div>
                              </div>
                              <button
                                type="button"
                                className="us-btn-danger us-btn-danger-sm"
                                style={{
                                  opacity: canDeleteBalance ? 1 : 0.45,
                                  cursor: canDeleteBalance ? "pointer" : "not-allowed",
                                }}
                                disabled={!canDeleteBalance}
                                onClick={() => deleteBalancePair?.(b)}
                                title={canDeleteBalance ? "Delete zero unused balance" : "Only zero balances can be deleted"}
                              >
                                <Trash2 size={13} />
                                Delete
                              </button>
                            </div>
                          </PermissionGate>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="us-empty-state">No balances available</div>
        )}
      </div>

      <div className="us-labeled-divider">
        <div className="us-labeled-divider-line" />
        <div className="us-labeled-divider-text">BALANCE OPERATIONS</div>
        <div className="us-labeled-divider-line" />
      </div>

      {/* ================= BALANCE MANAGEMENT ================= */}
      <PermissionGate allowed={hasPermission(user, "balance.manage")}>
        <div className="us-collapsible-box">
          <div className="us-collapsible-header" onClick={() => setBalanceOpen((v) => !v)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="us-collapsible-icon">
                <Banknote size={17} />
              </div>
              <div>
                <div className="us-collapsible-title">Balance Management</div>
                <div className="us-collapsible-sub">Deposit or withdraw funds from this user</div>
              </div>
            </div>
            <span className={`us-chevron${balanceOpen ? " is-open" : ""}`}>
              <ChevronDown size={16} />
            </span>
          </div>

          <div className={`us-collapse${balanceOpen ? " is-open" : ""}`}>
            <div className="us-collapse-inner">
              <div className="us-collapsible-body">
                <div className="us-two-col-row">
                  <div>
                    <MiniDropdown
                      label="Currency"
                      value={selectedCurrency}
                      onChange={(v) => {
                        setSelectedCurrency(v);
                        setSelectedNetwork("");
                      }}
                      placeholder="Select currency"
                      options={currencies
                        .filter((c) => c.is_active)
                        .map((c) => ({ value: String(c.id), label: `${c.symbol} - ${c.name}` }))}
                    />
                  </div>

                  <div>
                    <MiniDropdown
                      label="Network"
                      value={selectedNetwork}
                      onChange={(v) => setSelectedNetwork(v)}
                      disabled={!selectedCurrency || !balanceRequiresNetwork}
                      placeholder={balanceRequiresNetwork ? "Select Network" : "No Network Required"}
                      options={availableNetworks.map((n) => ({
                        value: String(n.id),
                        label: `${n.name} (${n.chain})`,
                      }))}
                    />
                  </div>
                </div>

                <div className="us-two-col-row">
                  <div>
                    <MiniDropdown
                      label="Action"
                      value={balanceAction}
                      onChange={(v) => setBalanceAction(v)}
                      options={[
                        { value: "deposit", label: "Deposit" },
                        { value: "withdraw", label: "Withdraw" },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="us-label">Amount</label>
                    <input
                      type="number"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      className="us-input-standalone"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="us-btn-row">
                  <button onClick={updateBalance} className="primaryBtn">
                    Apply Balance Action
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PermissionGate>

      {/* ================= INTERNAL TRANSFER ================= */}
      <PermissionGate allowed={hasPermission(user, "users.internal.transfer")}>
        <div className="us-collapsible-box" style={{ marginTop: 14 }}>
          <div
            className="us-collapsible-header"
            onClick={() => {
              if (transferOpen) {
                setTransferSuccess(null);
                setTransferError(null);
              }
              setTransferOpen((v) => !v);
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="us-collapsible-icon">
                <ArrowLeftRight size={17} />
              </div>
              <div>
                <div className="us-collapsible-title">Internal Transfer</div>
                <div className="us-collapsible-sub">Move this user's balance to another user</div>
              </div>
            </div>
            <span className={`us-chevron${transferOpen ? " is-open" : ""}`}>
              <ChevronDown size={16} />
            </span>
          </div>

          <div className={`us-collapse${transferOpen ? " is-open" : ""}`}>
            <div className="us-collapse-inner">
              <div className="us-collapsible-body">
                {/* RECIPIENT SEARCH */}
                <div>
                  <label className="us-label">Recipient User</label>
                  <div style={{ position: "relative" }}>
                    <input
                      className={`us-input-standalone${transferTarget ? " is-selected" : ""}`}
                      placeholder="Search username"
                      value={transferSearch}
                      onChange={handleTransferSearchChange}
                      autoComplete="off"
                    />

                    {transferTarget && (
                      <div className="us-transfer-selected-badge">#{transferTarget.user_id}</div>
                    )}

                    {transferSearchLoading && !transferTarget && (
                      <div className="us-transfer-spinner" />
                    )}

                    {transferResults.length > 0 && !transferTarget && (
                      <div className="us-transfer-dropdown">
                        {transferResults.map((u) => (
                          <div
                            key={u.user_id}
                            className="us-transfer-drop-item"
                            onMouseDown={() => selectTransferTarget(u)}
                          >
                            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>
                              {u.username}
                            </span>
                            <span style={{ color: "#64748b", fontSize: 12 }}>
                              #{u.user_id} {u.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* CURRENCY + NETWORK */}
                <div className="us-two-col-row">
                  <div>
                    <MiniDropdown
                      label="Currency"
                      value={transferCurrency}
                      onChange={(v) => {
                        setTransferCurrency(v);
                        setTransferNetwork("");
                        setTransferError(null);
                        setTransferSuccess(null);
                      }}
                      placeholder="Select"
                      options={currencies
                        .filter((c) => c.is_active)
                        .map((c) => ({ value: String(c.id), label: c.symbol }))}
                    />
                  </div>

                  <div>
                    <MiniDropdown
                      label="Network"
                      value={transferNetwork}
                      onChange={(v) => {
                        setTransferNetwork(v);
                        setTransferError(null);
                        setTransferSuccess(null);
                      }}
                      disabled={!transferCurrency || !transferRequiresNetwork}
                      placeholder={transferRequiresNetwork ? "Select Network" : "No Network Required"}
                      options={transferAvailableNetworks.map((n) => ({
                        value: String(n.id),
                        label: `${n.name} (${n.chain})`,
                      }))}
                    />
                  </div>
                </div>

                {/* AVAILABLE BALANCE HINT */}
                {transferCurrency && (
                  <div className="us-transfer-balance-hint">
                    <span style={{ fontSize: 12, color: "#64748b" }}>Available to send</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                      {Number(transferMaxAmount).toLocaleString()} {transferCurrencySymbol}
                    </span>
                  </div>
                )}

                {/* AMOUNT */}
                <div>
                  <label className="us-label">Amount</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      className="us-input-standalone"
                      placeholder="0.00"
                      value={transferAmount}
                      min="0"
                      onChange={(e) => {
                        setTransferAmount(e.target.value);
                        setTransferError(null);
                        setTransferSuccess(null);
                      }}
                    />
                    {transferMaxAmount > 0 && (
                      <button
                        type="button"
                        className="us-transfer-max-btn"
                        onClick={() => setTransferAmount(String(transferMaxAmount))}
                      >
                        MAX
                      </button>
                    )}
                  </div>
                </div>

                {/* NOTE */}
                <div>
                  <label className="us-label">Note (optional)</label>
                  <input
                    className="us-input-standalone"
                    placeholder="Admin note"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                  />
                </div>

                {/* PREVIEW STRIP */}
                {transferTarget && transferCurrency && transferNetwork && Number(transferAmount) > 0 && (
                  <div className="us-transfer-preview">
                    {[
                      ["From", `${user.username} #${user.user_id}`],
                      ["To", `${transferTarget.username} #${transferTarget.user_id}`],
                      ["Amount", `${Number(transferAmount).toLocaleString()} ${transferCurrencySymbol}`],
                      ["Network", networks.find((n) => String(n.id) === String(transferNetwork))?.name ?? transferNetwork],
                    ].map(([label, value]) => (
                      <div key={label} className="us-transfer-preview-row">
                        <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
                        <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ERROR / SUCCESS */}
                {transferError && <div className="us-inline-msg is-error">{transferError}</div>}
                {transferSuccess && <div className="us-inline-msg is-success">{transferSuccess}</div>}

                {/* SUBMIT */}
                <div className="us-btn-row">
                  <button
                    className="primaryBtn"
                    style={{
                      opacity: transferSubmitting ? 0.6 : 1,
                      cursor: transferSubmitting ? "not-allowed" : "pointer",
                    }}
                    onClick={executeTransfer}
                    disabled={transferSubmitting}
                  >
                    {transferSubmitting ? "Processing" : "Execute Internal Transfer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PermissionGate>
    </>
  );
}