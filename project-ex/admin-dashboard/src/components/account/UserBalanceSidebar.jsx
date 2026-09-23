import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  Landmark,
  LoaderCircle,
  MessageSquare,
  QrCode,
  Save,
  Wallet,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import axios from "axios";
import { API_URL } from "../../config";

const api = axios.create({ baseURL: API_URL });

const fmt = (value, digits = 6) =>
  value != null
    ? Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
      })
    : "—";

const fmtDate = (value) => (value ? new Date(value).toLocaleString() : "—");

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

export default function UserBalanceSidebar({ balance, token, onClose, onRefresh }) {
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [actionMode, setActionMode] = useState("overview");
  const [statusMessage, setStatusMessage] = useState(null);
  const [qrSrc, setQrSrc] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [irtBankDraft, setIrtBankDraft] = useState({
    bank_holder_name: "",
    bank_card_number: "",
    bank_name: "",
    bank_sheba: "",
  });
  const [savingIrtBank, setSavingIrtBank] = useState(false);

  const [irtDepositAmount, setIrtDepositAmount] = useState("");
  const [irtDepositNote, setIrtDepositNote] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [submittingReceipt, setSubmittingReceipt] = useState(false);

  const [watchState, setWatchState] = useState(null);

  const total = useMemo(
    () => Number(balance?.available || 0) + Number(balance?.frozen || 0),
    [balance?.available, balance?.frozen]
  );

  const isIrt = String(balance?.currency || "").toUpperCase() === "IRT";

  const loadDetails = async () => {
    if (!balance?.currency_id || !token) {
      setDetails(null);
      return;
    }

    setLoadingDetails(true);
    setDetailsError("");

    try {
      const params = new URLSearchParams({ currency_id: String(balance.currency_id) });
      if (balance.network_id != null) {
        params.append("network_id", String(balance.network_id));
      }
      const res = await api.get(`/admin-account/deposit-info?${params.toString()}`, {
        headers: authHeaders(token),
      });
      setDetails(res.data || null);
      setWithdrawAddress(res.data?.external_wallet_address || "");
      if (res.data?.user_bank_info) {
        setIrtBankDraft({
          bank_holder_name: res.data.user_bank_info.bank_holder_name || "",
          bank_card_number: res.data.user_bank_info.bank_card_number || "",
          bank_name: res.data.user_bank_info.bank_name || "",
          bank_sheba: res.data.user_bank_info.bank_sheba || "",
        });
      }
    } catch (err) {
      setDetails(null);
      setDetailsError(err?.response?.data?.detail || err?.message || "Failed to load wallet details.");
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
      setActionMode("overview");
      setStatusMessage(null);
      setWatchState(null);
      setWithdrawAmount("");
      setWithdrawAddress("");
      setWithdrawNote("");
      setIrtDepositAmount("");
      setIrtDepositNote("");
      setReceiptFile(null);
      void loadDetails();
    }, 0);
    return () => {
      clearTimeout(timer);
      setVisible(false);
    };
  }, [balance?.currency_id, balance?.network_id, token]);

  useEffect(() => {
    if (actionMode === "deposit" && details?.method === "crypto" && details?.deposit_address) {
      let cancelled = false;
      QRCode.toDataURL(details.deposit_address, {
        width: 220,
        margin: 1,
        color: {
          dark: "#dbeafe",
          light: "#071120",
        },
      })
        .then((src) => {
          if (!cancelled) setQrSrc(src);
        })
        .catch(() => {
          if (!cancelled) setQrSrc("");
        });
      return () => {
        cancelled = true;
      };
    } else {
      const timer = setTimeout(() => setQrSrc(""), 0);
      return () => clearTimeout(timer);
    }
  }, [actionMode, details?.deposit_address, details?.method]);

  useEffect(() => {
    if (!watchState || !token) return undefined;

    const interval = setInterval(async () => {
      try {
        const res = await api.get("/admin-account/balances", {
          headers: authHeaders(token),
        });
        const balances = Array.isArray(res.data?.balances) ? res.data.balances : [];
        const current = balances.find(
          (item) =>
            item.currency_id === balance.currency_id &&
            String(item.network_id) === String(balance.network_id)
        );
        const availableNow = Number(current?.available || 0);
        if (availableNow > Number(watchState.baselineAvailable || 0)) {
          setStatusMessage({
            type: "success",
            text:
              watchState.kind === "crypto-deposit"
                ? "Deposit confirmed and your balance has been updated."
                : "IRT deposit was approved and your balance has been updated.",
          });
          setWatchState(null);
          onRefresh?.();
          setTimeout(() => onClose?.(), 1200);
        }
      } catch (err) {
        console.error("Failed to poll balance:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [balance.currency_id, balance.network_id, onClose, onRefresh, token, watchState]);

  const copyToClipboard = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setStatusMessage({ type: "success", text: "Copied to clipboard." });
    } catch {
      setStatusMessage({ type: "error", text: "Failed to copy to clipboard." });
    }
  };

  const saveExternalWallet = async () => {
    if (!withdrawAddress.trim()) {
      setStatusMessage({ type: "error", text: "Enter an external wallet address first." });
      return false;
    }

    setSavingAddress(true);
    try {
      await api.post(
        "/wallet/external-wallet",
        {
          currency_id: balance.currency_id,
          network_id: balance.network_id,
          address: withdrawAddress.trim(),
        },
        { headers: authHeaders(token) }
      );
      setStatusMessage({ type: "success", text: "External withdrawal wallet saved." });
      return true;
    } catch (err) {
      setStatusMessage({ type: "error", text: err?.response?.data?.detail || err?.message || "Failed to save wallet." });
      return false;
    } finally {
      setSavingAddress(false);
    }
  };

  const submitWithdraw = async () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      setStatusMessage({ type: "error", text: "Enter a valid withdrawal amount." });
      return;
    }

    setSubmittingWithdraw(true);
    setStatusMessage(null);
    try {
      if (isIrt) {
        const saveRes = await api.put(
          "/admin-account/bank-info",
          irtBankDraft,
          { headers: authHeaders(token) }
        );
        const res = await api.post(
          "/admin-account/withdraw/irt",
          {
            amount: Number(withdrawAmount),
            note: withdrawNote.trim() || null,
          },
          { headers: authHeaders(token) }
        );
        setStatusMessage({
          type: "success",
          text: `IRT withdrawal request submitted. Transaction #${res.data?.transaction_id || "—"} is pending approval.`,
        });
        if (saveRes?.data?.bank_info) {
          setIrtBankDraft({
            bank_holder_name: saveRes.data.bank_info.bank_holder_name || "",
            bank_card_number: saveRes.data.bank_info.bank_card_number || "",
            bank_name: saveRes.data.bank_info.bank_name || "",
            bank_sheba: saveRes.data.bank_info.bank_sheba || "",
          });
        }
      } else {
        const saved = await saveExternalWallet();
        if (!saved) return;

        await api.post(
          "/wallet/withdraw",
          {
            amount: Number(withdrawAmount),
            currency: balance.currency,
            network: balance.network_chain || balance.network,
            wallet_address: withdrawAddress.trim(),
          },
          { headers: authHeaders(token) }
        );
        setStatusMessage({
          type: "success",
          text: "Crypto withdrawal submitted and is now pending the existing approval flow.",
        });
      }
      onRefresh?.();
      setTimeout(() => onClose?.(), 1200);
    } catch (err) {
      setStatusMessage({ type: "error", text: err?.response?.data?.detail || err?.message || "Failed to submit withdrawal." });
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const submitIrtReceipt = async () => {
    if (!irtDepositAmount || Number(irtDepositAmount) <= 0) {
      setStatusMessage({ type: "error", text: "Enter the IRT amount you transferred." });
      return;
    }
    if (!receiptFile) {
      setStatusMessage({ type: "error", text: "Upload the transfer receipt photo first." });
      return;
    }

    setSubmittingReceipt(true);
    setStatusMessage(null);
    try {
      const mediaFile = await fileToDataUrl(receiptFile);
      await api.post(
        "/admin-master-messages/send",
        {
          content:
            `IRT deposit receipt\n` +
            `Currency: ${balance.currency}\n` +
            `Amount: ${Number(irtDepositAmount)}\n` +
            `Network: ${balance.network_chain || balance.network || "INTERNAL"}\n` +
            (irtDepositNote.trim() ? `Note: ${irtDepositNote.trim()}` : ""),
          media_type: "receipt",
          media_file: mediaFile,
        },
        { headers: authHeaders(token) }
      );
      setWatchState({
        kind: "irt-deposit",
        baselineAvailable: Number(balance.available || 0),
      });
      setStatusMessage({
        type: "success",
        text: "Receipt sent to master for manual review. This panel will close automatically after balance approval.",
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: err?.response?.data?.detail || err?.message || "Failed to send receipt." });
    } finally {
      setSubmittingReceipt(false);
    }
  };

  const startCryptoWatch = () => {
    setWatchState({
      kind: "crypto-deposit",
      baselineAvailable: Number(balance.available || 0),
    });
    setStatusMessage({
      type: "success",
      text: "Watching for on-chain confirmation. This panel will close automatically after the balance updates.",
    });
  };

  return createPortal(
    <>
      <div style={styles.overlay(visible)} onClick={onClose} />
      <div style={styles.panel(visible)}>
        <div style={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={styles.walletIcon}>
              <Wallet size={18} />
            </div>
            <div>
              <div style={styles.title}>{balance?.currency || "Wallet"}</div>
              <div style={styles.subtitle}>
                {balance?.network_chain || balance?.network || "Primary Balance View"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} type="button">
            <X size={15} />
          </button>
        </div>

        <div style={styles.hero}>
          <div style={styles.totalLabel}>Total Balance</div>
          <div style={styles.totalValue}>{fmt(total)}</div>
          <div style={styles.splitRow}>
            <div style={styles.splitCard}>
              <span style={styles.splitLabel}>Available</span>
              <strong style={{ color: "#10b981" }}>{fmt(balance?.available)}</strong>
            </div>
            <div style={styles.splitCard}>
              <span style={styles.splitLabel}>Frozen</span>
              <strong style={{ color: "#f59e0b" }}>{fmt(balance?.frozen)}</strong>
            </div>
          </div>
        </div>

        <div style={styles.actionsRow}>
          <button
            onClick={() => setActionMode("deposit")}
            style={{ ...styles.actionBtn, ...styles.depositBtn, ...(actionMode === "deposit" ? styles.actionBtnActive : null) }}
            type="button"
          >
            <ArrowDownToLine size={14} />
            Deposit
          </button>
          <button
            onClick={() => setActionMode("withdraw")}
            style={{ ...styles.actionBtn, ...styles.withdrawBtn, ...(actionMode === "withdraw" ? styles.actionBtnActive : null) }}
            type="button"
          >
            <ArrowUpFromLine size={14} />
            Withdraw
          </button>
        </div>

        {statusMessage && (
          <div style={statusMessage.type === "error" ? styles.errorBox : styles.successBox}>{statusMessage.text}</div>
        )}


        {actionMode === "deposit" && details?.method === "crypto" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <QrCode size={14} />
              Crypto Deposit
            </div>
            {details?.tatum_api_warning && (
              <div style={styles.warningBox}>
                ⚠️ Deposit confirmation service is currently unavailable — your deposit will be credited once connectivity is restored.
              </div>
            )}
            <div style={styles.qrWrap}>
              {qrSrc ? <img src={qrSrc} alt="Deposit QR" style={styles.qrImage} /> : <div style={styles.dimText}>QR code unavailable.</div>}
            </div>
            <div style={styles.addressCard}>
              <div style={styles.metaLabel}>Deposit Address</div>
              <div style={styles.addressValue}>{details.deposit_address}</div>
              <button onClick={() => copyToClipboard(details.deposit_address)} style={styles.inlineBtn} type="button">
                <Copy size={13} /> Copy address
              </button>
            </div>
            <div style={styles.infoList}>
              <InfoRow label="Confirmations required" value={details.confirmations_required} />
              <InfoRow label="Min deposit" value={fmt(details.min_deposit)} />
              <InfoRow label="Max deposit" value={details.max_deposit ? fmt(details.max_deposit) : "No configured cap"} />
              <InfoRow label="Current available balance" value={fmt(balance.available)} />
            </div>
            <button onClick={startCryptoWatch} style={styles.primaryBtn} type="button">
              <Activity size={14} /> Watch for confirmation
            </button>
            {watchState?.kind === "crypto-deposit" && (
              <div style={styles.watchBox}>Waiting for Tatum/webhook confirmation and balance credit...</div>
            )}
          </div>
        )}

        {actionMode === "deposit" && details?.method === "irt_manual" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <Landmark size={14} />
              IRT Deposit
            </div>
            <div style={styles.bankGrid}>
              <Meta label="Bank" value={details.platform_bank_account?.bank_name || "—"} />
              <Meta label="Holder" value={details.platform_bank_account?.bank_holder_name || "—"} />
              <Meta label="Card Number" value={details.platform_bank_account?.bank_card_number || "—"} mono />
              <Meta label="Sheba" value={details.platform_bank_account?.bank_sheba || "—"} mono />
            </div>
            <div style={styles.formStack}>
              <Field
                label="Transferred Amount"
                value={irtDepositAmount}
                onChange={setIrtDepositAmount}
                placeholder="Enter the amount you transferred"
                type="number"
              />
              <label style={styles.fieldWrap}>
                <span style={styles.metaLabel}>Note to master (optional)</span>
                <textarea
                  value={irtDepositNote}
                  onChange={(event) => setIrtDepositNote(event.target.value)}
                  rows={3}
                  style={styles.textarea}
                  placeholder="Add any payment note or receipt context"
                />
              </label>
              <label style={styles.fieldWrap}>
                <span style={styles.metaLabel}>Receipt Photo</span>
                <input type="file" accept="image/*" onChange={(event) => setReceiptFile(event.target.files?.[0] || null)} style={styles.input} />
              </label>
              {receiptFile && <div style={styles.note}>Selected receipt: {receiptFile.name}</div>}
              <button onClick={submitIrtReceipt} style={styles.primaryBtn} disabled={submittingReceipt} type="button">
                <MessageSquare size={14} /> {submittingReceipt ? "Sending..." : "Upload Receipt to Master"}
              </button>
              {watchState?.kind === "irt-deposit" && (
                <div style={styles.watchBox}>Waiting for manual approval. This panel watches your balance and closes after approval.</div>
              )}
            </div>
          </div>
        )}

        {actionMode === "withdraw" && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <ArrowUpFromLine size={14} />
              {isIrt ? "IRT Withdrawal" : "Crypto Withdrawal"}
            </div>
            <div style={styles.formStack}>
              {!isIrt && (
                <>
                  <Field
                    label="External Wallet Address"
                    value={withdrawAddress}
                    onChange={setWithdrawAddress}
                    placeholder="Your private wallet address"
                  />
                  <div style={styles.inlineActions}>
                    <button onClick={saveExternalWallet} style={styles.inlineBtn} disabled={savingAddress} type="button">
                      <Save size={13} /> {savingAddress ? "Saving..." : "Save Wallet"}
                    </button>
                  </div>
                </>
              )}
              {isIrt && !details?.user_bank_info_complete && (
                <div style={styles.warningText}>Add or update your bank info here before requesting an IRT withdrawal.</div>
              )}
              {isIrt && (
                <div style={styles.bankEditCard}>
                  <div style={styles.sectionTitle}>My Bank Account</div>
                  <Field label="Bank name" value={irtBankDraft.bank_name} onChange={(value) => setIrtBankDraft((prev) => ({ ...prev, bank_name: value }))} />
                  <Field
                    label="Holder name"
                    value={irtBankDraft.bank_holder_name}
                    onChange={(value) => setIrtBankDraft((prev) => ({ ...prev, bank_holder_name: value }))}
                  />
                  <Field
                    label="Card number"
                    value={irtBankDraft.bank_card_number}
                    onChange={(value) => setIrtBankDraft((prev) => ({ ...prev, bank_card_number: value }))}
                  />
                  <Field
                    label="Sheba"
                    value={irtBankDraft.bank_sheba}
                    onChange={(value) => setIrtBankDraft((prev) => ({ ...prev, bank_sheba: value }))}
                  />
                </div>
              )}
              <Field
                label="Amount"
                value={withdrawAmount}
                onChange={setWithdrawAmount}
                placeholder="Enter amount"
                type="number"
              />
              <label style={styles.fieldWrap}>
                <span style={styles.metaLabel}>Note (optional)</span>
                <textarea
                  value={withdrawNote}
                  onChange={(event) => setWithdrawNote(event.target.value)}
                  rows={3}
                  style={styles.textarea}
                  placeholder={isIrt ? "Add payout instructions if needed" : "Optional withdrawal note"}
                />
              </label>
              {isIrt && (
                <div style={styles.bankGrid}>
                  <Meta label="My Bank" value={details?.user_bank_info?.bank_name || "—"} />
                  <Meta label="Holder" value={details?.user_bank_info?.bank_holder_name || "—"} />
                  <Meta label="Card Number" value={details?.user_bank_info?.bank_card_number || "—"} mono />
                  <Meta label="Sheba" value={details?.user_bank_info?.bank_sheba || "—"} mono />
                </div>
              )}
              <button
                onClick={submitWithdraw}
                style={styles.primaryBtn}
                disabled={submittingWithdraw}
                type="button"
              >
                <ArrowUpFromLine size={14} /> {submittingWithdraw ? "Submitting..." : "Submit Withdrawal"}
              </button>
            </div>
          </div>
        )}

        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <Activity size={14} />
            Recent Activity
          </div>
          {!Array.isArray(balance?.recentActivity) || balance.recentActivity.length === 0 ? (
            <div style={styles.dimText}>No recent transactions for this wallet pair.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {balance.recentActivity.slice(0, 8).map((tx, index) => (
                
                <div key={tx.id || `${tx.type}-${index}`} style={styles.activityRow}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={styles.activityType}>#{tx.id} - {(tx.type || "transaction").toUpperCase()}</span>
                    <span style={styles.activityDate}>{fmtDate(tx.created_at)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <strong style={styles.activityAmount}>{fmt(tx.amount)}</strong>
                    <span style={styles.activityDate}>{tx.status || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

function Meta({ label, value, mono = false }) {
  return (
    <div style={styles.metaCard}>
      <div style={styles.metaLabel}>{label}</div>
      <div style={{ ...styles.metaValue, fontFamily: mono ? "monospace" : "inherit" }}>{value ?? "—"}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label style={styles.fieldWrap}>
      <span style={styles.metaLabel}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        style={styles.input}
      />
    </label>
  );
}

const styles = {
  overlay: (visible) => ({
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 1800,
    opacity: visible ? 1 : 0,
    transition: "opacity 180ms ease",
  }),
  panel: (visible) => ({
    position: "fixed",
    top: 0,
    right: 0,
    width: 560,
    maxWidth: "94vw",
    height: "100vh",
    zIndex: 1900,
    background: "linear-gradient(170deg,#051120 0%,#0a1427 40%,#101a32 100%)",
    borderLeft: "1px solid #22324e",
    boxShadow: "-20px 0 60px rgba(0,0,0,.55)",
    color: "white",
    padding: 18,
    overflowY: "auto",
    transform: visible ? "translateX(0)" : "translateX(100%)",
    transition: "transform 200ms ease",
  }),
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  walletIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: "rgba(59,130,246,.2)",
    color: "#60a5fa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: 800 },
  subtitle: { fontSize: 11, color: "#7c8ca8" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    border: "1px solid #31425f",
    background: "#0b1527",
    color: "#94a3b8",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    background: "linear-gradient(155deg,#12213d,#0b1831)",
    border: "1px solid #2a3f65",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  totalLabel: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#7c8ca8", marginBottom: 6 },
  totalValue: { fontSize: 28, fontWeight: 900, color: "#e2e8f0", letterSpacing: -0.7 },
  splitRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 },
  splitCard: {
    background: "rgba(2,6,23,.55)",
    border: "1px solid #24344f",
    borderRadius: 10,
    padding: "8px 10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
  },
  splitLabel: { color: "#8ea1bf", fontSize: 11 },
  section: {
    background: "rgba(2,6,23,.45)",
    border: "1px solid #24344f",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 800,
    color: "#cdd8eb",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  metaGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  metaCard: { background: "#091629", border: "1px solid #20314e", borderRadius: 10, padding: 10 },
  metaLabel: { fontSize: 10, color: "#6f82a3", marginBottom: 5, textTransform: "uppercase" },
  metaValue: { fontSize: 12, fontWeight: 700, color: "#dbe7fb", wordBreak: "break-word" },
  note: { marginTop: 10, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 },
  warningText: { marginTop: 10, color: "#fcd34d", fontSize: 12, lineHeight: 1.5 },
  actionsRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 },
  actionBtn: {
    borderRadius: 10,
    border: "1px solid transparent",
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    cursor: "pointer",
  },
  actionBtnActive: {
    boxShadow: "0 0 0 1px rgba(255,255,255,.12) inset",
  },
  depositBtn: { background: "rgba(16,185,129,.14)", borderColor: "rgba(16,185,129,.4)", color: "#34d399" },
  withdrawBtn: { background: "rgba(245,158,11,.14)", borderColor: "rgba(245,158,11,.4)", color: "#fbbf24" },
  dimText: { color: "#7084a7", fontSize: 12, display: "flex", alignItems: "center", gap: 8 },
  errorText: { color: "#f87171", fontSize: 12 },
  successBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    background: "rgba(16,185,129,.14)",
    border: "1px solid rgba(16,185,129,.35)",
    color: "#a7f3d0",
    fontSize: 12,
  },
  errorBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    background: "rgba(239,68,68,.14)",
    border: "1px solid rgba(239,68,68,.35)",
    color: "#fecaca",
    fontSize: 12,
  },
  warningBox: {
   marginBottom: 12,
   padding: 12,
   borderRadius: 12,
   background: "rgba(245,158,11,.14)",
   border: "1px solid rgba(245,158,11,.35)",
   color: "#fde68a",
   fontSize: 12,
   lineHeight: 1.5,
  },
  qrWrap: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 12,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
    border: "1px solid #24344f",
    background: "#071120",
    padding: 8,
  },
  addressCard: {
    background: "#091629",
    border: "1px solid #20314e",
    borderRadius: 12,
    padding: 12,
  },
  addressValue: { fontSize: 12, wordBreak: "break-all", color: "#dbeafe", marginBottom: 8 },
  infoList: { display: "flex", flexDirection: "column", gap: 8, marginTop: 12, marginBottom: 12 },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    background: "#091629",
    border: "1px solid #20314e",
    borderRadius: 10,
    padding: "9px 10px",
    fontSize: 12,
  },
  primaryBtn: {
    borderRadius: 10,
    border: "1px solid rgba(59,130,246,.4)",
    background: "rgba(37,99,235,.18)",
    color: "#bfdbfe",
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    cursor: "pointer",
  },
  inlineBtn: {
    borderRadius: 10,
    border: "1px solid #2a3f65",
    background: "#081224",
    color: "#cbd5e1",
    padding: "8px 10px",
    fontSize: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
  },
  input: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #29405e",
    background: "#081224",
    color: "white",
    padding: "10px 12px",
    fontSize: 13,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid #29405e",
    background: "#081224",
    color: "white",
    padding: 12,
    fontSize: 13,
    boxSizing: "border-box",
    resize: "vertical",
  },
  fieldWrap: { display: "grid", gap: 6 },
  formStack: { display: "grid", gap: 12 },
  bankGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 },
  bankEditCard: {
    display: "grid",
    gap: 10,
    borderRadius: 14,
    border: "1px solid #20314e",
    background: "#091629",
    padding: 12,
  },
  inlineActions: { display: "flex", justifyContent: "flex-end" },
  watchBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    background: "rgba(59,130,246,.12)",
    border: "1px solid rgba(59,130,246,.3)",
    color: "#bfdbfe",
    fontSize: 12,
  },
  activityRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#091629",
    border: "1px solid #20314e",
    borderRadius: 10,
    padding: "8px 10px",
  },
  activityType: { fontSize: 11, fontWeight: 700, color: "#cbd5e1" },
  activityDate: { fontSize: 10, color: "#64748b" },
  activityAmount: { fontSize: 12, color: "#60a5fa" },
  spin: { animation: "spin 1s linear infinite" },
};
