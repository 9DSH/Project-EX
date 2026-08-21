import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000";

export default function BotInfrastructure() {
  const token = localStorage.getItem("token");
  const [settings, setSettings] = useState(null);
  const [supportTokenInput, setSupportTokenInput] = useState("");
  const [mainTokenInput, setMainTokenInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/global-bot-settings/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSettings(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {};
      if (supportTokenInput.trim()) payload.support_bot_token = supportTokenInput.trim();
      if (mainTokenInput.trim()) payload.main_bot_token = mainTokenInput.trim();
      const res = await axios.put(`${API}/admin/global-bot-settings/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSettings(res.data);
      setSupportTokenInput("");
      setMainTokenInput("");
      setSuccess("Saved.");
    } catch (e) {
      setError(e?.response?.data?.detail || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", background: "#0b1220", border: "1px solid rgba(255,255,255,.1)",
    color: "white", padding: "10px 12px", borderRadius: 10, outline: "none", boxSizing: "border-box",
  };

  const BotBlock = ({ label, tokenInput, setTokenInput, masked, username, validatedAt, error: botError }) => (
    <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{label}</div>
      {username && (
        <div style={{ fontSize: 13, color: "#86efac", marginBottom: 8 }}>
          Connected: @{username}
          {validatedAt && <span style={{ color: "#64748b" }}> · validated {new Date(validatedAt).toLocaleString()}</span>}
        </div>
      )}
      {botError && <div style={{ fontSize: 13, color: "#fda4af", marginBottom: 8 }}>Last error: {botError}</div>}
      <input
        style={inputStyle}
        type="password"
        placeholder={masked || "Paste bot token"}
        value={tokenInput}
        onChange={(e) => setTokenInput(e.target.value)}
      />
    </div>
  );

  if (loading) return <div style={{ padding: 24, color: "#f8fafc" }}>Loading…</div>;

  return (
    <div style={{ padding: 24, color: "#f8fafc", maxWidth: 640 }}>
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Bot Infrastructure</div>
      <div style={{ color: "#64748b", marginBottom: 20 }}>Configure the platform's global bot tokens.</div>

      {error ? <div style={{ marginBottom: 12, color: "#fda4af", fontSize: 13 }}>{error}</div> : null}
      {success ? <div style={{ marginBottom: 12, color: "#86efac", fontSize: 13 }}>{success}</div> : null}

      <BotBlock
        label="Support Bot"
        tokenInput={supportTokenInput}
        setTokenInput={setSupportTokenInput}
        masked={settings?.support_bot_token_masked}
        username={settings?.support_bot_username}
        validatedAt={settings?.support_last_validated_at}
        error={settings?.support_last_validation_error}
      />

      <BotBlock
        label="Global Main Bot (Wires)"
        tokenInput={mainTokenInput}
        setTokenInput={setMainTokenInput}
        masked={settings?.main_bot_token_masked}
        username={settings?.main_bot_username}
        validatedAt={settings?.main_last_validated_at}
        error={settings?.main_last_validation_error}
      />

      <button
        onClick={save}
        disabled={saving}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, border: "none", borderRadius: 10,
          background: "rgba(59,130,246,.18)", color: "#93c5fd", padding: "10px 16px", cursor: "pointer",
          fontWeight: 700, opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}