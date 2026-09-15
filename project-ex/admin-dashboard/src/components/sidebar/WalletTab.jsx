import { useEffect, useState } from "react";
import { API_URL } from "../../config";
import PermissionGate from "../../components/PermissionGate";
import {
  Trash2,
  ChevronDown,
  Wallet,
  Link2,
  Landmark,
  User,
  CreditCard,
  Building2,
  Hash,
} from "lucide-react";

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

  const saveWalletField = async (balanceItem, field) => {
    if (!user?.user_id) return;

    const walletKey = getWalletKey(balanceItem);
    const token = localStorage.getItem("token");
    const draftValue = walletPairDrafts[walletKey]?.[field] ?? "";

    setWalletPairSaving((prev) => ({ ...prev, [walletKey]: field }));
    setWalletPairMessages((prev) => ({ ...prev, [walletKey]: null }));

    try {
      const body = {
        currency_id: balanceItem.currency_id,
        network_id: balanceItem.network_id,
        [field]: draftValue,
      };

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
        throw new Error(data?.detail || "Failed to save wallet address");
      }

      setWalletPairDetails((prev) => ({
        ...prev,
        [walletKey]: {
          ...(prev[walletKey] || {}),
          ...data,
        },
      }));
      setWalletPairDrafts((prev) => ({
        ...prev,
        [walletKey]: {
          ...(prev[walletKey] || {}),
          [field]: data?.[field] ?? "",
        },
      }));
      setWalletPairMessages((prev) => ({
        ...prev,
        [walletKey]: { type: "success", text: "Address saved successfully." },
      }));
    } catch (err) {
      setWalletPairMessages((prev) => ({
        ...prev,
        [walletKey]: { type: "error", text: err.message || "Failed to save wallet address" },
      }));
    } finally {
      setWalletPairSaving((prev) => ({ ...prev, [walletKey]: null }));
    }
  };

  return (
    <>
{/* Balance List */}
<div style={styles.walletList}>
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
      const walletMessage = walletPairMessages[walletKey];
      const canDeleteBalance = Number(b.available || 0) === 0 && Number(b.frozen || 0) === 0;
      const coinLabel = (b.currency || "?").slice(0, 3).toUpperCase();

      return (
        <div
          key={`${walletKey}-${idx}`}
          style={{ ...styles.walletRowCard, borderColor: isOpen ? "#2c3a56" : "#1e293b" }}
        >
          <button
            type="button"
            tabIndex={-1}
            style={styles.walletRowButton}
            onClick={() => toggleWalletRow(b)}
          >
            <div style={styles.walletRowMain}>
              <div style={styles.walletRowLeft}>
                <div style={{ ...styles.walletCoinBadge, ...(isIrt ? styles.walletCoinBadgeIrt : styles.walletCoinBadgeCrypto) }}>
                  {isIrt ? <Landmark size={18} /> : coinLabel.slice(0, 2)}
                </div>
                <div style={styles.walletRowLabels}>
                  <div style={styles.walletRowTitleRow}>
                    <span style={styles.walletRowTitle}>{b.currency}</span>
                    {!isIrt && (
                      <span style={styles.walletNetworkChip}>
                        {b.network_chain || b.network || "No network"}
                      </span>
                    )}
                  </div>
                  <div style={styles.walletRowMeta}>
                    {isIrt ? "Internal toman balance" : b.network || "Wallet pair"}
                  </div>
                </div>
              </div>

              <div style={styles.walletAmounts}>
                <div style={styles.walletAmountItem}>
                  <span style={styles.balanceLabel}>Available</span>
                  <span style={styles.availableValue}>{formatBalance(b.available)}</span>
                </div>
                <div style={styles.walletAmountDivider} />
                <div style={styles.walletAmountItem}>
                  <span style={styles.balanceLabel}>Frozen</span>
                  <span style={styles.frozenValue}>{formatBalance(b.frozen)}</span>
                </div>
                <span
                  style={{
                    ...styles.walletExpandIcon,
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <ChevronDown size={16} />
                </span>
              </div>
            </div>
          </button>

          {isOpen && (
            <div style={styles.walletDetailsPanel}>
              {isIrt ? (
                /* ---- IRT bank details ---- */
                <div style={styles.irtPanel}>
                  <div style={styles.irtPanelHeader}>
                    <div style={styles.irtPanelHeaderIcon}>
                      <Landmark size={16} />
                    </div>
                    <div>
                      <div style={styles.irtPanelTitle}>Bank account details</div>
                      <div style={styles.irtPanelSub}>Used to verify IRT deposits and withdrawals</div>
                    </div>
                  </div>

                  {irtBankMessage && (
                    <div
                      style={
                        irtBankMessage.type === "error"
                          ? styles.walletMessageError
                          : styles.walletMessageSuccess
                      }
                    >
                      {irtBankMessage.text}
                    </div>
                  )}

                  <div style={styles.irtGrid}>
                    {[
                      ["bank_holder_name", "Bank holder name", User],
                      ["bank_card_number", "Bank card number", CreditCard],
                      ["bank_name", "Bank name", Building2],
                      ["bank_sheba", "Bank Sheba (IBAN)", Hash],
                    ].map(([field, fieldLabel, FieldIcon]) => (
                      <div key={field} style={styles.irtFieldCard}>
                        <label style={styles.irtFieldLabel}>
                          <FieldIcon size={13} />
                          {fieldLabel}
                        </label>
                        {canManageBalance ? (
                          <input
                            value={irtBankDraft[field]}
                            onChange={(e) =>
                              setIrtBankDraft((prev) => ({ ...prev, [field]: e.target.value }))
                            }
                            style={styles.irtFieldInput}
                            placeholder={`Enter ${fieldLabel.toLowerCase()}`}
                          />
                        ) : (
                          <div style={styles.walletReadOnlyValue}>
                            {irtBankDraft[field] || "Not set yet"}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={styles.walletDetailActions}>
                    <span style={styles.walletDetailsHint}>
                      Editable by admin for user corrections or support.
                    </span>
                    {canManageBalance && (
                      <button
                        type="button"
                        className="primaryBtn"
                        style={styles.walletSaveBtn}
                        onClick={saveIrtBankInfo}
                        disabled={irtBankSaving}
                      >
                        {irtBankSaving ? "Saving…" : "Save bank info"}
                      </button>
                    )}
                  </div>
                </div>
              ) : isLoadingWallet ? (
                <div style={styles.walletLoadingState}>
                  <span style={styles.walletSpinnerDot} />
                  Loading wallet details…
                </div>
              ) : (
                <>
                  {walletMessage && (
                    <div
                      style={
                        walletMessage.type === "error"
                          ? styles.walletMessageError
                          : styles.walletMessageSuccess
                      }
                    >
                      {walletMessage.text}
                    </div>
                  )}

                  {canManageBalance ? (
                    <PermissionGate allowed={canManageBalance}>
                      <div style={styles.walletPairGrid}>
                        <div style={styles.walletAddressCard}>
                          <div style={styles.walletAddressHeader}>
                            <span style={styles.walletAddressIcon}>
                              <Wallet size={14} />
                            </span>
                            <span style={styles.walletAddressTitle}>Deposit wallet</span>
                          </div>
                          <input
                            value={walletDraft.deposit_address}
                            onChange={(e) =>
                              handleWalletDraftChange(walletKey, "deposit_address", e.target.value)
                            }
                            style={styles.walletAddressInput}
                            placeholder={walletDetails?.deposit_address ? "" : "Not set yet"}
                          />
                          <div style={styles.walletDetailActions}>
                            <span style={styles.walletDetailsHint}>
                              { "Deposit address for this currency/network."}
                            </span>
                            <button
                              type="button"
                              className="primaryBtn"
                              style={styles.walletSaveBtn}
                              onClick={() => saveWalletField(b, "deposit_address")}
                              disabled={savingField === "deposit_address"}
                            >
                              {savingField === "deposit_address" ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>

                        <div style={styles.walletAddressCard}>
                          <div style={styles.walletAddressHeader}>
                            <span style={styles.walletAddressIcon}>
                              <Link2 size={14} />
                            </span>
                            <span style={styles.walletAddressTitle}>External wallet</span>
                          </div>
                          <input
                            value={walletDraft.external_wallet_address}
                            onChange={(e) =>
                              handleWalletDraftChange(walletKey, "external_wallet_address", e.target.value)
                            }
                            style={styles.walletAddressInput}
                            placeholder={walletDetails?.external_wallet_address ? "" : "Not set yet"}
                          />
                          <div style={styles.walletDetailActions}>
                            <span style={styles.walletDetailsHint}>
                              User withdrawal destination for this currency/network.
                            </span>
                            <button
                              type="button"
                              className="primaryBtn"
                              style={styles.walletSaveBtn}
                              onClick={() => saveWalletField(b, "external_wallet_address")}
                              disabled={savingField === "external_wallet_address"}
                            >
                              {savingField === "external_wallet_address" ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={styles.walletDangerBlock}>
                        <div>
                          <div style={styles.walletDangerTitle}>Delete balance row</div>
                          <div style={styles.walletDangerHint}>
                            Removes this pair from the user sidebar only if available and frozen balances are both zero and the pair has no transaction history.
                          </div>
                        </div>
                        <button
                          type="button"
                          style={{
                            ...styles.walletDeleteBtn,
                            opacity: canDeleteBalance ? 1 : 0.45,
                            cursor: canDeleteBalance ? "pointer" : "not-allowed",
                          }}
                          disabled={!canDeleteBalance}
                          onClick={() => deleteBalancePair?.(b)}
                          title={canDeleteBalance ? "Delete zero unused balance" : "Only zero balances can be deleted"}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </PermissionGate>
                  ) : (
                    <div style={styles.walletPairGrid}>
                      <div style={styles.walletAddressCard}>
                        <div style={styles.walletAddressHeader}>
                          <span style={styles.walletAddressIcon}>
                            <Wallet size={14} />
                          </span>
                          <span style={styles.walletAddressTitle}>Deposit wallet</span>
                        </div>
                        <div style={styles.walletReadOnlyValue}>
                          {walletDetails?.deposit_address || "Not set yet"}
                        </div>
                      </div>
                      <div style={styles.walletAddressCard}>
                        <div style={styles.walletAddressHeader}>
                          <span style={styles.walletAddressIcon}>
                            <Link2 size={14} />
                          </span>
                          <span style={styles.walletAddressTitle}>External wallet</span>
                        </div>
                        <div style={styles.walletReadOnlyValue}>
                          {walletDetails?.external_wallet_address || "Not set yet"}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      );
    })
  ) : (
    <div style={styles.emptyBalances}>No balances available</div>
  )}
</div>

                {/*  BALANCE MANAGEMENT  */}
                <PermissionGate allowed={hasPermission(user, "balance.manage")}>
                <div style={styles.transferBox}>
                  {/* HEADER */}
                  <div
                    style={styles.transferHeader}
                    onClick={() => setBalanceOpen((v) => !v)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={styles.transferIcon}></div>

                      <div>
                        <div style={styles.transferHeaderLabel}>
                          Balance Management
                        </div>

                        <div style={styles.transferHeaderSub}>
                          Deposit or withdraw funds from this user
                        </div>
                      </div>
                    </div>

                    <span style={{ color: "#64748b", fontSize: 11 }}>
                      {balanceOpen ? "v" : ">"}
                    </span>
                  </div>

                  {/* BODY */}
                  {balanceOpen && (
                    <div style={styles.transferBody}>
                      <div style={styles.formGrid}>
                        <div>
                          <label style={styles.label}>Currency</label>

                          <select
                            value={selectedCurrency}
                            onChange={(e) => {
                              setSelectedCurrency(e.target.value);
                              setSelectedNetwork("");
                            }}
                            style={styles.input}
                          >
                            <option value="">Select Currency</option>

                            {currencies
                              .filter((c) => c.is_active)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.symbol} - {c.name}
                                </option>
                              ))}
                          </select>
                        </div>

                      <div>
                        <label style={styles.label}>Network</label>

                        <select
                          value={selectedNetwork}
                          onChange={(e) => setSelectedNetwork(e.target.value)}
                          style={styles.input}
                          disabled={!selectedCurrency || !balanceRequiresNetwork}
                        >
                          <option value="">
                            {balanceRequiresNetwork
                              ? "Select Network"
                              : "No Network Required"}
                          </option>

                          {availableNetworks.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.name} ({n.chain})
                            </option>
                          ))}
                        </select>
                      </div>

                        <div>
                          <label style={styles.label}>Action</label>

                          <select
                            value={balanceAction}
                            onChange={(e) => setBalanceAction(e.target.value)}
                            style={styles.input}
                          >
                            <option value="deposit">Deposit</option>
                            <option value="withdraw">Withdraw</option>
                          </select>
                        </div>

                        <div>
                          <label style={styles.label}>Amount</label>

                          <input
                            type="number"
                            value={balance}
                            onChange={(e) => setBalance(e.target.value)}
                            style={styles.input}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    <div style={styles.buttonRow}>
                      <button
                        onClick={updateBalance}
                        className="primaryBtn"
                      >
                         Apply Balance Action
                      </button>
                      </div>
                    </div>
                  )}
                </div>
                </PermissionGate>

             

                  {/*  INTERNAL TRANSFER  */}

                <PermissionGate allowed={hasPermission(user, "users.internal.transfer")}>
                  <div style={styles.transferBox}>
                    {/* HEADER */}
                    <div
                      style={styles.transferHeader}
                      onClick={() => {
                        if (transferOpen) {
                          setTransferSuccess(null);
                          setTransferError(null);
                        }
                        setTransferOpen((v) => !v);
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={styles.transferIcon}></div>
                        <div>
                          <div style={styles.transferHeaderLabel}>Internal Transfer</div>
                          <div style={styles.transferHeaderSub}>Move this user's balance to another user</div>
                        </div>
                      </div>
                      <span style={{ color: "#64748b", fontSize: 11 }}>
                        {transferOpen ? "" : ""}
                      </span>
                    </div>

                    {/* BODY */}
                    {transferOpen && (
                      <div style={styles.transferBody}>

                        {/* RECIPIENT SEARCH */}
                        <div>
                          <label style={styles.label}>Recipient User</label>
                          <div style={{ position: "relative" }}>
                            <input
                              style={{
                                ...styles.input,
                                ...(transferTarget ? {
                                  border: "1px solid rgba(34,197,94,0.4)",
                                  background: "rgba(34,197,94,0.04)",
                                } : {}),
                              }}
                              placeholder="Search username"
                              value={transferSearch}
                              onChange={handleTransferSearchChange}
                              autoComplete="off"
                            />

                            {/* selected badge */}
                            {transferTarget && (
                              <div style={styles.transferSelectedBadge}>
                                #{transferTarget.user_id}
                              </div>
                            )}

                            {/* search spinner */}
                            {transferSearchLoading && !transferTarget && (
                              <div style={styles.transferSpinner}></div>
                            )}

                            {/* dropdown */}
                            {transferResults.length > 0 && !transferTarget && (
                              <div style={styles.transferDropdown}>
                                {transferResults.map((u) => (
                                  <div
                                    key={u.user_id}
                                    style={styles.transferDropItem}
                                    onMouseDown={() => selectTransferTarget(u)}
                                  >
                                    <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>
                                      {u.username}
                                    </span>
                                    <span style={{ color: "#64748b", fontSize: 12 }}>
                                      #{u.user_id}  {u.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* CURRENCY + NETWORK */}
                        <div style={styles.formGrid}>
                          <div>
                            <label style={styles.label}>Currency</label>
                            <select
                              style={styles.input}
                              value={transferCurrency}
                              onChange={(e) => {
                                setTransferCurrency(e.target.value);
                                setTransferNetwork("");
                                setTransferError(null);
                                setTransferSuccess(null);
                              }}
                            >
                              <option value="">Select</option>
                              {currencies.filter((c) => c.is_active).map((c) => (
                                <option key={c.id} value={c.id}>{c.symbol}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={styles.label}>Network</label>
                            <select
                              style={styles.input}
                              value={transferNetwork}
                              onChange={(e) => {
                                setTransferNetwork(e.target.value);
                                setTransferError(null);
                                setTransferSuccess(null);
                              }}
                              disabled={!transferCurrency || !transferRequiresNetwork}
                            >
                              <option value="">
                                        {transferRequiresNetwork
                                          ? "Select Network"
                                          : "No Network Required"}
                                      </option>
                              {transferAvailableNetworks.map((n) => (
                                <option key={n.id} value={n.id}>{n.name} ({n.chain})</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* AVAILABLE BALANCE HINT */}
                        {transferCurrency && (
                          <div style={styles.transferBalanceHint}>
                            <span style={{ fontSize: 12, color: "#64748b" }}>Available to send</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                              {Number(transferMaxAmount).toLocaleString()} {transferCurrencySymbol}
                            </span>
                          </div>
                        )}

                        {/* AMOUNT */}
                        <div>
                          <label style={styles.label}>Amount</label>
                          <div style={{ position: "relative" }}>
                            <input
                              type="number"
                              style={styles.input}
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
                                style={styles.transferMaxBtn}
                                onClick={() => setTransferAmount(String(transferMaxAmount))}
                              >
                                MAX
                              </button>
                            )}
                          </div>
                        </div>

                        {/* NOTE */}
                        <div>
                          <label style={styles.label}>Note (optional)</label>
                          <input
                            style={styles.input}
                            placeholder="Admin note"
                            value={transferNote}
                            onChange={(e) => setTransferNote(e.target.value)}
                          />
                        </div>

                        {/* PREVIEW STRIP */}
                        {transferTarget && transferCurrency && transferNetwork && Number(transferAmount) > 0 && (
                          <div style={styles.transferPreview}>
                            {[
                              ["From",    `${user.username} #${user.user_id}`],
                              ["To",      `${transferTarget.username} #${transferTarget.user_id}`],
                              ["Amount",  `${Number(transferAmount).toLocaleString()} ${transferCurrencySymbol}`],
                              ["Network", networks.find((n) => String(n.id) === String(transferNetwork))?.name ?? transferNetwork],
                            ].map(([label, value]) => (
                              <div key={label} style={styles.transferPreviewRow}>
                                <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
                                <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{value}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ERROR */}
                        {transferError && (
                          <div style={styles.transferErrorBox}>{transferError}</div>
                        )}

                        {/* SUCCESS */}
                        {transferSuccess && (
                          <div style={styles.transferSuccessBox}>{transferSuccess}</div>
                        )}

                        {/* SUBMIT */}
                    <div style={styles.buttonRow}>
                      <button
                        className="primaryBtn"
                        style={{
                          opacity: transferSubmitting ? 0.6 : 1,
                          cursor: transferSubmitting ? "not-allowed" : "pointer",
                        }}
                        onClick={executeTransfer}
                        disabled={transferSubmitting}
                      >
                        {transferSubmitting ? "Processing" : " Execute Internal Transfer"}
                      </button>
                    </div>
                      </div>
                    )}
                  </div>
                </PermissionGate>
                </>
  );
}


const customScrollbar = {
  scrollbarWidth: "thin",
  scrollbarColor: "#64748b #1e293b",
  overflowY: "auto",
  overflowX: "auto",
};

const styles = {
  overlay: (visible) => ({
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    backdropFilter: "blur(4px)",
    zIndex: 50,
    opacity: visible ? 1 : 0,
    transition: "opacity 250ms ease",
  }),

  container: (visible) => ({
    position: "fixed",
    top: 0,
    right: 0,
    width: 580,
    height: "100vh",
    background: "#0f172a",
    borderLeft: "2px solid #1e293b",
    color: "white",
    zIndex: 60,
    display: "flex",
    flexDirection: "column",

    transform: visible ? "translateX(0%)" : "translateX(100%)",
    opacity: visible ? 1 : 0,
    transition: "transform 200ms ease, opacity 250ms ease",
  }),

  header: {
    padding: 20,
    borderBottom: "1px solid #1e293b",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  userTitle: { fontSize: 20, fontWeight: 700 },
  userSub: { fontSize: 12, color: "#94a3b8", marginTop: 4 },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#111827",
    color: "white",
    cursor: "pointer",
  },

  tabs: {
    display: "flex",
    gap: 8,
    padding: 14,
    overflowX: "auto",
    borderBottom: "1px solid #1e293b",
    scrollbarWidth: "thin",
    scrollbarColor: "#64748b #1e293b",
  },

  tab: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #1e293b",
    background: "#111827",
    color: "#94a3b8",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  activeTab: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #2563eb",
    background: "#1d4fd871",
    color: "white",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 600,
  },

  content: {
    flex: 1,
    padding: 18,
    ...customScrollbar,
  },

  section: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #1e293b",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },

  sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 18 },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },

  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 13,
    color: "#94a3b8",
  },

  input: {
    width: "100%",
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: 12,
    color: "white",
    outline: "none",
    boxSizing: "border-box",
  },

 

  toggleRow: {
    marginTop: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  
  buttonRow: {
    padding:15,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },

  enabledToggle: {
    background: "rgba(34,197,94,0.15)",
    color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },

  disabledToggle: {
    background: "rgba(239,68,68,0.15)",
    color: "#ef4444",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },

  list: { display: "flex", flexDirection: "column", gap: 12, ...customScrollbar },
  card: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: { fontWeight: 700, marginBottom: 6 },
  cardSub: { color: "#94a3b8", fontSize: 13 },

  chatWrapper: { 
    height: "100%", 
    display: "flex", 
    flexDirection: "column",
    overflow: "hidden",
 },

  walletList: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 15 },

  walletRowCard: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#1e293b",
    borderRadius: 18,
    overflow: "hidden",
    transition: "border-color 0.15s",
  },

  walletRowButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "inherit",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    textAlign: "left",
    outline: "none",
    display: "block",
    borderRadius: "inherit",
  },

  walletRowMain: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: "14px 16px",
    flexWrap: "wrap",
  },

  walletRowLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },

  walletCoinBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    flexShrink: 0,
  },

  walletCoinBadgeCrypto: {
    background: "linear-gradient(135deg, rgba(37,99,235,0.25), rgba(37,99,235,0.08))",
    border: "1px solid rgba(59,130,246,0.35)",
    color: "#93c5fd",
  },

  walletCoinBadgeIrt: {
    background: "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(34,197,94,0.08))",
    border: "1px solid rgba(34,197,94,0.35)",
    color: "#86efac",
  },

  walletRowLabels: { minWidth: 0 },

  walletRowTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  walletRowTitle: { fontSize: 16, fontWeight: 700, color: "white" },

  walletNetworkChip: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#93c5fd",
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(37,99,235,0.25)",
    borderRadius: 999,
    padding: "3px 8px",
  },

  walletRowMeta: { fontSize: 11, color: "#64748b", marginTop: 4 },

  walletAmounts: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  walletAmountItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    fontSize: 12,
  },

  walletAmountDivider: {
    width: 1,
    height: 26,
    background: "#1e293b",
  },

  walletExpandIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    minWidth: 18,
    transition: "transform 0.2s",
  },

  walletDetailsPanel: {
    borderTop: "1px solid #1e293b",
    background: "#0b1220",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  walletDetailActions: {
    marginTop: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  walletDetailsHint: {
    fontSize: 12,
    color: "#64748b",
  },

  walletSaveBtn: {
    minWidth: 92,
    opacity: 1,
  },

  walletLoadingState: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "#94a3b8",
    padding: "6px 2px",
  },

  walletSpinnerDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#3b82f6",
    opacity: 0.8,
  },

  /* Crypto wallet pair (deposit / external) */
  walletPairGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },

  walletAddressCard: {
    background: "rgba(15,23,42,0.75)",
    border: "1px solid #1e293b",
    borderRadius: 14,
    padding: 14,
  },

  walletAddressHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  walletAddressIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    background: "rgba(59,130,246,0.12)",
    color: "#93c5fd",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  walletAddressTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#e2e8f0",
  },

  walletAddressInput: {
    width: "100%",
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 10,
    padding: "10px 12px",
    color: "white",
    outline: "none",
    fontSize: 13,
    fontFamily: "monospace",
    boxSizing: "border-box",
  },

  walletDangerBlock: {
    background: "rgba(127,29,29,0.18)",
    border: "1px solid rgba(239,68,68,0.22)",
    borderRadius: 14,
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    gap: 12,
    flexWrap: "wrap",
  },

  walletDangerTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#fecaca",
    marginBottom: 4,
  },

  walletDangerHint: {
    fontSize: 12,
    color: "#fca5a5",
    maxWidth: 360,
    lineHeight: 1.4,
  },

  walletDeleteBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.14)",
    color: "#f87171",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 700,
  },

  walletMessageError: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#ef4444",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 600,
  },

  walletMessageSuccess: {
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#22c55e",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 600,
  },

  walletReadOnlyValue: {
    color: "#e2e8f0",
    fontSize: 13,
    lineHeight: 1.5,
    wordBreak: "break-all",
    fontFamily: "monospace",
  },

  balanceLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 },
  availableValue: { color: "#22c55e", fontWeight: 700, fontSize: 15 },
  frozenValue: { color: "#f59e0b", fontWeight: 700, fontSize: 15 },

  emptyBalances: {
    gridColumn: "1 / -1",
    textAlign: "center",
    padding: 24,
    borderRadius: 16,
    border: "1px dashed #334155",
    background: "#0b1220",
    color: "#64748b",
  },

  /* IRT bank panel */
  irtPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  irtPanelHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  irtPanelHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    background: "rgba(34,197,94,0.12)",
    color: "#86efac",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  irtPanelTitle: { fontSize: 14, fontWeight: 700, color: "#e2e8f0" },
  irtPanelSub: { fontSize: 12, color: "#64748b", marginTop: 2 },

  irtFieldCard: {
    background: "rgba(15,23,42,0.75)",
    border: "1px solid #1e293b",
    borderRadius: 14,
    padding: 12,
  },

  irtFieldLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: 500,
    color: "#94a3b8",
  },

  irtFieldInput: {
    width: "100%",
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 10,
    padding: "10px 12px",
    color: "white",
    outline: "none",
    fontSize: 13,
    boxSizing: "border-box",
  },

  //  INTERNAL TRANSFER 
  transferBox: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #2564eb63",
    borderRadius: 15,
    overflow: "visible",
    marginTop: 4,
    marginBottom:10
  },

  transferHeader: {
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    borderBottom: "1px solid #1e293b",
    userSelect: "none",
  },

  transferIcon: {
    fontSize: 16,
    color: "#60a5fa",
    background: "rgba(37,99,235,0.15)",
    border: "1px solid rgba(37,99,235,0.25)",
    borderRadius: 8,
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    flexShrink: 0,
  },

  transferHeaderLabel: { fontWeight: 600, color: "#e2e8f0", fontSize: 14 },
  transferHeaderSub: { fontSize: 11, color: "#64748b", marginTop: 2 },

  transferBody: {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  transferSelectedBadge: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#22c55e",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    pointerEvents: "none",
  },

  transferSpinner: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#64748b",
    fontSize: 16,
    pointerEvents: "none",
  },

  transferDropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 12,
    zIndex: 999,
    maxHeight: 200,
    overflowY: "auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  },

  transferDropItem: {
    padding: "10px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    borderBottom: "1px solid #1e293b",
  },

  transferBalanceHint: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 10,
    padding: "8px 12px",
  },

  transferMaxBtn: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(37,99,235,0.2)",
    border: "1px solid rgba(37,99,235,0.4)",
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: 800,
    padding: "4px 8px",
    borderRadius: 6,
    cursor: "pointer",
    letterSpacing: 0.5,
  },

  transferPreview: {
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 14,
    padding: "10px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },

  transferPreviewRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    borderBottom: "1px solid #1e293b",
  },

  transferErrorBox: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#ef4444",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
  },

  transferSuccessBox: {
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#22c55e",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
  },

  transferBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)",
    border: "1px solid rgba(37,99,235,0.4)",
    borderRadius: 14,
    padding: "13px 0",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  //  END INTERNAL TRANSFER 

  ordersList: { display: "flex", flexDirection: "column", gap: 14, ...customScrollbar },

  orderCard: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #2c384dff",
    borderRadius: 20,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  orderTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  orderProduct: { fontSize: 16, fontWeight: 700, color: "white" },
  orderMeta: { marginTop: 6, fontSize: 12, color: "#64748b" },

  orderStatus: { padding: "7px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "1px solid" },
  statusPending: { background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.25)", color: "#f59e0b" },
  statusApproved: { background: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.25)", color: "#60a5fa" },
  statusDelivered: { background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)", color: "#22c55e" },
  statusDefault: { background: "rgba(246, 7, 7, 0.35)", borderColor: "rgba(184, 156, 148, 0.25)", color: "#b89994ff" },

  orderPriceRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  orderPrice: { fontSize: 22, fontWeight: 800, color: "white" },
  orderCurrency: { fontSize: 13, marginLeft: 8, color: "#94a3b8", fontWeight: 600 },

  networkBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(37,99,235,0.25)",
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 700,
  },

  orderDates: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

  dateItem: { background: "#0b1220", border: "1px solid #1e293b", borderRadius: 14, padding: 12 },
  dateLabel: { display: "block", fontSize: 11, color: "#64748b", marginBottom: 6 },
  dateValue: { fontSize: 13, color: "#e2e8f0", fontWeight: 600 },

  emptyOrders: {
    padding: 24,
    borderRadius: 18,
    textAlign: "center",
    border: "1px dashed #334155",
    background: "#111827",
    color: "#64748b",
  },

  transactionsList: { display: "flex", flexDirection: "column", gap: 14, ...customScrollbar },

  txCard: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #2c384dff",
    borderRadius: 20,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  txHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  txType: { fontSize: 16, fontWeight: 700, color: "white", textTransform: "capitalize" },
  txMeta: { marginTop: 6, fontSize: 12, color: "#64748b" },

  txStatus: { padding: "7px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "1px solid" },
  txCompleted: { background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)", color: "#22c55e" },
  txPending: { background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.25)", color: "#f59e0b" },
  txFailed: { background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.25)", color: "#ef4444" },

  txAmountRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  txAmount: { fontSize: 24, fontWeight: 800 },

  chainBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(37,99,235,0.25)",
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 700,
  },

  txBlockchain: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 14,
  },

  txInfoItem: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  txInfoLabel: { fontSize: 12, color: "#64748b" },
  txInfoValue: { fontSize: 12, color: "#e2e8f0", fontWeight: 600, fontFamily: "monospace" },

  txFooter: { display: "flex", justifyContent: "flex-end" },
  txDate: { fontSize: 12, color: "#64748b" },

  emptyTransactions: {
    padding: 24,
    borderRadius: 18,
    textAlign: "center",
    border: "1px dashed #334155",
    background: "#111827",
    color: "#64748b",
  },

  subTabs: { display: "flex", gap: 10, marginBottom: 14 },

  subTab: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid #1e293b",
    background: "#0b1220",
    color: "#94a3b8",
    cursor: "pointer",
  },

  subTabActive: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid #2563eb",
    background: "#1d4fd871",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  },

  createOrderBox: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #2564eb63",
    borderRadius: 15,
    overflow: "hidden",
  },


  createOrderBody: {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  ordersDivider: { display: "flex", alignItems: "center", gap: 12, marginTop: 18, marginBottom: 18 },
  ordersDividerLine: { flex: 1, height: 1, background: "linear-gradient(90deg, transparent, #334155, transparent)" },
  ordersDividerText: { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#64748b", whiteSpace: "nowrap" },
};
styles.irtCard = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(59,130,246,.22)",
  background: "rgba(59,130,246,.06)",
};
styles.irtCardHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};
styles.irtCardTitle = { fontSize: 15, fontWeight: 800, color: "#bfdbfe" };
styles.irtCardSub = { fontSize: 12, color: "#93c5fd", marginTop: 2 };
styles.irtCardBadge = {
  fontSize: 10,
  fontWeight: 700,
  color: "#93c5fd",
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid rgba(59,130,246,.25)",
  background: "rgba(59,130,246,.1)",
};
styles.irtGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};