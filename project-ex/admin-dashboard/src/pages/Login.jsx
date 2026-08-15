import { useState } from "react";
import API from "../api/client";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const res = await API.post("/auth/login", {
        username,
        password,
      });

      const data = res.data;

      const {
        access_token,
        username: loginUsername,
        role,
        access_points,
        user_id,
      } = res.data;

      localStorage.setItem("token", access_token);
      localStorage.setItem("username", loginUsername);
      localStorage.setItem("user_id", String(user_id));
      localStorage.setItem("role", role);
      localStorage.setItem(
        "access_points",
        JSON.stringify(access_points || [])
      );

      onLogin();
    } catch (err) {
      alert("Login failed");
      console.log(err.response?.data || err.message);
    }
  };

    const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#0b1220",
      color: "white"
    }}>
      <div style={{
        padding: 30,
        background: "#111827",
        borderRadius: 10,
        width: 300
      }}>
        <h2>Admin Login</h2>

        <input
          placeholder="username"
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ width: "100%", marginBottom: 10 }}
        />

        <input
          placeholder="password"
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ width: "100%", marginBottom: 10 }}
        />

        <button onClick={handleLogin} style={{ width: "100%" }}>
          Login
        </button>
      </div>
    </div>
  );
}