import { useState } from "react";
import API from "../api/client";
import WireHoleInside from "../components/WireHoleInside.jsx";
import "./Login.css";

export default function Login({ onLogin, onBack }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      setError("");
      const res = await API.post("/auth/login", {
        username,
        password,
      });

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
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Login failed. Check your credentials.");
      console.error("Login error:", err.response?.data || err.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <div className="login-root">
      {/* Large, slow-moving sphere filling the background — no click
          interaction here, just the "inside the sphere" ambience. */}
      <div className="login-wire-bg">
        <WireHoleInside sphereRadius={900} />
      </div>

      <div className="login-vignette" />

      <button
        type="button"
        className="site-logo login-logo login-logo-button"
        onClick={onBack}
        aria-label="Back to landing"
      >
        <img src="/WIRES-txt-LOGO.png" alt="WRIES" className="site-logo-img" />
      </button>

      <div className="login-card">
        <h2 className="login-title">Admin Login</h2>
        <p className="login-subtitle">Sign in to continue</p>

        <div className="login-field">
          <label>Username</label>
          <input
            placeholder="username"
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="login-field">
          <label>Password</label>
          <input
            placeholder="password"
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {error && <div className="login-error">{error}</div>}

        <button className="login-button" onClick={handleLogin}>
          Login
        </button>
      </div>
    </div>
  );
}