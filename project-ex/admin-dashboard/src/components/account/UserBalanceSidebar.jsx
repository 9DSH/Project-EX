import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowUpFromLine, Copy, Landmark, LoaderCircle,
  MessageSquare, QrCode, Save, Wallet,
} from "lucide-react";
import QRCode from "qrcode";
import axios from "axios";
import { API_URL } from "../../config";
import { authHeaders, fmt } from "./accountUtils";
import { SidePanel, TxRow } from "./AccountBits";
import "../../pages/MyAccount.css";

const api = axios.create({ baseURL: API_URL });

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

/**
 * Desktop / tablet: slides in from the right.
 * Mobile (<= 640px): bottom sheet rising from the very bottom with a small
 * dimmed strip left at the top (see .ma-side-* in myaccount.css).
 */
export default function UserBalanceSidebar({ balance, token, onClose, onRefresh }) {
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

  return (
    <SidePanel
      onClose={onClose}
      icon={Wallet}
      title={balance?.currency || "Wallet"}
      subtitle={balance?.network_chain || balance?.network || "Primary Balance View"}
    >
      <div className="ma-sb-hero">
        <div className="ma-sb-totalLabel">Total Balance</div>
        <div className="ma-sb-total">{fmt(total)}</div>
        <div className="ma-sb-split">
          <div className="ma-bal-part"><small>Available</small><strong style={{ color: "#10b981" }}>{fmt(balance?.available)}</strong></div>
          <div className="ma-bal-part"><small>Frozen</small><strong style={{ color: "#f59e0b" }}>{fmt(balance?.frozen)}</strong></div>
        </div>
      </div>

      <div className="ma-sb-actions">
        <button type="button" onClick={() => setActionMode("deposit")} className={`ma-btn ma-btn--primary${actionMode === "deposit" ? " is-on" : ""}`} style={actionMode === "deposit" ? { borderColor: "#10b981", color: "#a7f3d0", background: "rgba(16,185,129,.16)" } : undefined}>
          <ArrowDownToLine size={14} /> Deposit
        </button>
        <button type="button" onClick={() => setActionMode("withdraw")} className="ma-btn ma-btn--primary" style={actionMode === "withdraw" ? { borderColor: "#f59e0b", color: "#fde68a", background: "rgba(245,158,11,.16)" } : undefined}>
          <ArrowUpFromLine size={14} /> Withdraw
        </button>
      </div>

      {loadingDetails && (
        <div className="ma-subtle ma-row"><LoaderCircle size={14} className="ma-spin" /> Loading wallet details…</div>
      )}
      {detailsError && <div className="ma-alert ma-alert--err">{detailsError}</div>}
      {statusMessage && (
        <div className={`ma-alert ${statusMessage.type === "error" ? "ma-alert--err" : "ma-alert--ok"}`}>{statusMessage.text}</div>
      )}

      {actionMode === "deposit" && details?.method === "crypto" && (
        <div className="ma-sb-section">
          <div className="ma-sb-title"><QrCode size={14} /> Crypto Deposit</div>
          {details?.tatum_api_warning && (
            <div className="ma-alert ma-alert--warn">⚠️ Deposit confirmation service is currently unavailable — your deposit will be credited once connectivity is restored.</div>
          )}
          <div className="ma-qr">
            {qrSrc ? <img src={qrSrc} alt="Deposit QR" width={200} height={200} /> : <div className="ma-subtle" style={{ color: "#334155" }}>QR code unavailable.</div>}
          </div>
          <div className="ma-infoCell">
            <small>Deposit Address</small>
            <div className="ma-addr">{details.deposit_address}</div>
            <button type="button" onClick={() => copyToClipboard(details.deposit_address)} className="ma-btn ma-btn--sm" style={{ marginTop: 8 }}>
              <Copy size={13} /> Copy address
            </button>
          </div>
          <div className="ma-metaList">
            <InfoRow label="Confirmations required" value={details.confirmations_required} />
            <InfoRow label="Min deposit" value={fmt(details.min_deposit)} />
            <InfoRow label="Max deposit" value={details.max_deposit ? fmt(details.max_deposit) : "No configured cap"} />
            <InfoRow label="Current available balance" value={fmt(balance.available)} />
          </div>
          <button type="button" onClick={startCryptoWatch} className="ma-btn ma-btn--primary"><Activity size={14} /> Watch for confirmation</button>
          {watchState?.kind === "crypto-deposit" && (
            <div className="ma-alert ma-alert--ok">Waiting for Tatum/webhook confirmation and balance credit...</div>
          )}
        </div>
      )}

      {actionMode === "deposit" && details?.method === "irt_manual" && (
        <div className="ma-sb-section">
          <div className="ma-sb-title"><Landmark size={14} /> IRT Deposit</div>
          <div className="ma-infoGrid">
            <Meta label="Bank" value={details.platform_bank_account?.bank_name || "—"} />
            <Meta label="Holder" value={details.platform_bank_account?.bank_holder_name || "—"} />
            <Meta label="Card Number" value={details.platform_bank_account?.bank_card_number || "—"} mono />
            <Meta label="Sheba" value={details.platform_bank_account?.bank_sheba || "—"} mono />
          </div>
          <Field label="Transferred Amount" value={irtDepositAmount} onChange={setIrtDepositAmount} placeholder="Enter the amount you transferred" type="number" />
          <label className="ma-field">
            <span className="ma-label">Note to master (optional)</span>
            <textarea className="ma-textarea" value={irtDepositNote} onChange={(e) => setIrtDepositNote(e.target.value)} rows={3} placeholder="Add any payment note or receipt context" />
          </label>
          <label className="ma-field">
            <span className="ma-label">Receipt Photo</span>
            <input className="ma-input" type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
          </label>
          {receiptFile && <div className="ma-subtle">Selected receipt: {receiptFile.name}</div>}
          <button type="button" onClick={submitIrtReceipt} disabled={submittingReceipt} className="ma-btn ma-btn--primary">
            <MessageSquare size={14} /> {submittingReceipt ? "Sending..." : "Upload Receipt to Master"}
          </button>
          {watchState?.kind === "irt-deposit" && (
            <div className="ma-alert ma-alert--ok">Waiting for manual approval. This panel watches your balance and closes after approval.</div>
          )}
        </div>
      )}

      {actionMode === "withdraw" && (
        <div className="ma-sb-section">
          <div className="ma-sb-title"><ArrowUpFromLine size={14} /> {isIrt ? "IRT Withdrawal" : "Crypto Withdrawal"}</div>
          {!isIrt && (
            <>
              <Field label="External Wallet Address" value={withdrawAddress} onChange={setWithdrawAddress} placeholder="Your private wallet address" />
              <div>
                <button type="button" onClick={saveExternalWallet} disabled={savingAddress} className="ma-btn ma-btn--sm">
                  <Save size={13} /> {savingAddress ? "Saving..." : "Save Wallet"}
                </button>
              </div>
            </>
          )}
          {isIrt && !details?.user_bank_info_complete && (
            <div className="ma-alert ma-alert--warn">Add or update your bank info here before requesting an IRT withdrawal.</div>
          )}
          {isIrt && (
            <div className="ma-sb-section" style={{ background: "#081224" }}>
              <div className="ma-sb-title">My Bank Account</div>
              <Field label="Bank name" value={irtBankDraft.bank_name} onChange={(v) => setIrtBankDraft((p) => ({ ...p, bank_name: v }))} />
              <Field label="Holder name" value={irtBankDraft.bank_holder_name} onChange={(v) => setIrtBankDraft((p) => ({ ...p, bank_holder_name: v }))} />
              <Field label="Card number" value={irtBankDraft.bank_card_number} onChange={(v) => setIrtBankDraft((p) => ({ ...p, bank_card_number: v }))} />
              <Field label="Sheba" value={irtBankDraft.bank_sheba} onChange={(v) => setIrtBankDraft((p) => ({ ...p, bank_sheba: v }))} />
            </div>
          )}
          <Field label="Amount" value={withdrawAmount} onChange={setWithdrawAmount} placeholder="Enter amount" type="number" />
          <label className="ma-field">
            <span className="ma-label">Note (optional)</span>
            <textarea className="ma-textarea" value={withdrawNote} onChange={(e) => setWithdrawNote(e.target.value)} rows={3} placeholder={isIrt ? "Add payout instructions if needed" : "Optional withdrawal note"} />
          </label>
          {isIrt && (
            <div className="ma-infoGrid">
              <Meta label="My Bank" value={details?.user_bank_info?.bank_name || "—"} />
              <Meta label="Holder" value={details?.user_bank_info?.bank_holder_name || "—"} />
              <Meta label="Card Number" value={details?.user_bank_info?.bank_card_number || "—"} mono />
              <Meta label="Sheba" value={details?.user_bank_info?.bank_sheba || "—"} mono />
            </div>
          )}
          <button type="button" onClick={submitWithdraw} disabled={submittingWithdraw} className="ma-btn ma-btn--primary">
            <ArrowUpFromLine size={14} /> {submittingWithdraw ? "Submitting..." : "Submit Withdrawal"}
          </button>
        </div>
      )}

      <div className="ma-sb-section">
        <div className="ma-sb-title"><Activity size={14} /> Recent Activity</div>
        {!Array.isArray(balance?.recentActivity) || balance.recentActivity.length === 0 ? (
          <div className="ma-subtle">No recent transactions for this wallet pair.</div>
        ) : (
          <div className="ma-activity">
            {balance.recentActivity.slice(0, 8).map((tx, index) => (
              <TxRow key={tx.id || `${tx.type}-${index}`} tx={tx} showUser={false} showHash={false} showNetwork={false} />
            ))}
          </div>
        )}
      </div>
    </SidePanel>
  );
}

function Meta({ label, value, mono = false }) {
  return (
    <div className="ma-infoCell">
      <small>{label}</small>
      <div className={mono ? "ma-mono" : ""}>{value ?? "—"}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="ma-metaRow">
      <span className="ma-metaLabel" style={{ textTransform: "none", letterSpacing: 0, fontSize: 12 }}>{label}</span>
      <strong className="ma-metaValue">{value ?? "—"}</strong>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="ma-field">
      <span className="ma-label">{label}</span>
      <input className="ma-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} />
    </label>
  );
}