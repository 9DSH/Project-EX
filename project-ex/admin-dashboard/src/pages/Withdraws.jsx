import { useEffect, useState } from "react";
import { API_URL } from "../config";

  // ── Skeleton ─────────────────────────────────────────────────────
function Sk({ w = "100%", h = 16, r = 6 }) {
    return (
      <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#151f30 25%,#1e2d44 50%,#151f30 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
    );
  }
  // ── Stat pill ────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, accent, loading }) {
    return (
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: 10, 
        background: "#071020ff", 
        borderRadius: 12, 
        padding: "10px 10px" }}>
        <div style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 10, 
          background: accent + "18", 
          color: accent, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          flexShrink: 0 
          }}>
          <Icon size={17} />
        </div>
        <div>
          <div style={{ 
            fontSize: 10, 
            color: "#475569", 
            fontWeight: 700, 
            letterSpacing: 0.6, 
            marginBottom: 3 
            }}>{label}</div>
          {loading ? <Sk w={56} h={22} /> : <div style={{ 
                                                  fontSize: 16, 
                                                  fontWeight: 800, 
                                                  color: accent, 
                                                  letterSpacing: -0.5 
                                                  }}>{value ?? "—"}</div>}
        </div>
      </div>
    );
  }
  
export default function Withdraws() {
  const [withdraws, setWithdraws] = useState([]);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");

  const loadWithdraws = async () => {
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/admin/withdrawals/pending`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Withdraw load error:", data);
        return;
      }

      setWithdraws(data);
    } catch (err) {
      console.error("Network error:", err);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadWithdraws();
  }, []);

  const approve = async (id) => {
    await fetch(`${API_URL}/admin/withdrawals/approve/${id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    loadWithdraws();
  };

  const reject = async (id) => {
    await fetch(`${API_URL}/admin/withdrawals/reject/${id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    loadWithdraws();
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Withdraw Requests</h2>

      <button onClick={loadWithdraws}>🔄 Refresh</button>

      {loading && <p>Loading...</p>}

      {!loading && (
        <table width="100%" border="1" cellPadding="10">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Amount</th>
              <th>Wallet</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {withdraws.map((w) => (
              <tr key={w.id}>
                <td>{w.id}</td>
                <td>{w.user_id}</td>
                <td>-{w.amount}</td>
                <td>{w.wallet_address}</td>
                <td>{w.status}</td>

                <td>
                  <button onClick={() => approve(w.id)}>Approve</button>
                  <button onClick={() => reject(w.id)}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}