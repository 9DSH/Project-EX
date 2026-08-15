import { useState } from "react";

/* =========================
   TOGGLE COMPONENT
========================= */
const Toggle = ({ checked, onChange, label, color = "#3b82f6" }) => (
  <label style={styles.toggleLabel}>
    <div
      onClick={() => onChange(!checked)}
      style={{
        ...styles.toggleTrack,
        background: checked ? color : "#1e293b",
        border: `1px solid ${checked ? color : "#334155"}`,
      }}
    >
      <div
        style={{
          ...styles.toggleKnob,
          left: checked ? 22 : 2,
          background: checked ? "#fff" : "#475569",
        }}
      />
    </div>

    <span style={{ color: checked ? "#e2e8f0" : "#64748b" }}>
      {label}
    </span>
  </label>
);

/* =========================
   MAIN COMPONENT
========================= */
export default function ProfileTab({
  user,  username, setUsername, firstName, setFirstName, lastName, setLastName,
  phoneNumber, setPhoneNumber, email, setEmail, withdrawalWallet, setWithdrawalWallet,
  telegramId, setTelegramId,  status, setStatus,  role, setRole,  accessPoints,
  toggleAccess,  permissionTab, setPermissionTab,  updateProfile,  resetPassword,
  newPassword, setNewPassword,  permissions, ACCESS_GROUPS, hasPermission,
}) {
  const canEdit = permissions?.canEditUser;

  return (
    <>
      {/* =========================
          PROFILE INFO
      ========================= */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Account Information</div>

        <div style={styles.formGrid}>
          <Input label="Username" value={username} setValue={setUsername} disabled={!canEdit} />
          <Input label="Telegram ID" value={telegramId} setValue={setTelegramId} disabled={!canEdit} />
          <Input label="First Name" value={firstName} setValue={setFirstName} disabled={!canEdit} />
          <Input label="Last Name" value={lastName} setValue={setLastName} disabled={!canEdit} />
          <Input label="Phone Number" value={phoneNumber} setValue={setPhoneNumber} disabled={!canEdit} />
          <Input label="Email" value={email} setValue={setEmail} disabled={!canEdit} />
         

        <Toggle
          checked={status === "active"}
          onChange={(checked) => setStatus(checked ? "active" : "disabled")}
          label="Active"
          color="#3b82f6"
          disabled={!canEdit}
        />

          {(user?.role === "admin" || user?.role === "master") &&
            hasPermission(user, "admins.promotion") && (
              <div>
                <label style={styles.label}>Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={styles.input}
                  disabled={!canEdit}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}
        </div>
      </div>

      {/* =========================
          SECURITY
      ========================= */}
      {canEdit && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Security</div>

          <div style={styles.formGrid}>

            <div>
              <label style={styles.label}>New Password</label>
              <input
                type="password"
                value={newPassword || ""}
                onChange={(e) => setNewPassword(e.target.value)}
                style={styles.input}
                placeholder="Enter new password"
              />
            </div>
            
          
          <button 
            onClick={() => resetPassword(newPassword)}
            style={styles.dangerBtn}
          >
            Reset Password
          </button>
          </div>
        </div>
      )}

      {/* =========================
          PERMISSIONS
      ========================= */}
      {(user?.role === "admin" || user?.role === "master") &&
        hasPermission(user, "admins.promotion") && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Admin Permissions</div>

            <div style={permissionTabsStyle}>
              {Object.keys(ACCESS_GROUPS).map((group) => (
                <button
                  key={group}
                  onClick={() => setPermissionTab(group)}
                  style={{
                    ...tabBtn,
                    ...(permissionTab === group ? activeTab : {}),
                  }}
                >
                  {group.toUpperCase()}
                </button>
              ))}
            </div>

            <div style={togglesContainer}>
              {ACCESS_GROUPS[permissionTab]?.map((item) => (
                <Toggle
                  key={item.key}
                  checked={accessPoints.includes(item.key)}
                  onChange={() => toggleAccess(item.key)}
                  label={item.label}
                />
              ))}
            </div>
          </div>
        )}

      {/* =========================
          SAVE BUTTON
      ========================= */}
      <div style={styles.buttonRow}>
        {canEdit && (
          <button onClick={updateProfile} className="primaryBtn">
            Save Changes
          </button>
        )}
      </div>
    </>
  );
}

/* =========================
   INPUT COMPONENT
========================= */
function Input({ label, value, setValue, disabled }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <input
        value={value || ""}
        onChange={(e) => setValue(e.target.value)}
        style={styles.input}
        disabled={disabled}
      />
    </div>
  );
}

/* =========================
   STYLES
========================= */
const styles = {
  section: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226ff 100%)",
    border: "1px solid #1e293b",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 18,
    color: "#e2e8f0",
  },

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
  },


    buttonRow: {
    marginTop:50,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },

  dangerBtn: {
    width: "100%",
    height: "40px",
    marginTop: 25,
    background: "#ef4444",
    border: "none",
    borderRadius: 10,
    padding: 0,
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },

  toggleLabel: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
  },

  toggleTrack: {
    position: "relative",
    width: 44,
    height: 24,
    borderRadius: 12,
    transition: "all 0.2s",
  },

  toggleKnob: {
    position: "absolute",
    top: 2,
    width: 18,
    height: 18,
    borderRadius: "50%",
    transition: "left 0.2s",
  },
};

const permissionTabsStyle = {
  display: "flex",
  gap: 6,
  marginBottom: 12,
  overflowX: "auto",
};

const tabBtn = {
  padding: "6px 10px",
  borderRadius: 8,
  fontSize: 12,
  background: "transparent",
  border: "1px solid #26324a",
  color: "#64748b",
  cursor: "pointer",
};

const activeTab = {
  background: "rgba(59,130,246,0.2)",
  borderColor: "#3b82f6",
  color: "#60a5fa",
};

const togglesContainer = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};