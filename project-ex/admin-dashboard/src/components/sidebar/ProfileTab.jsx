import { useState } from "react";

/* =========================
   ICONS (inline, no deps)
========================= */
const Icon = ({ path, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

const icons = {
  user: "M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  at: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm0 0v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-5.5 8.3",
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z",
  mail: "M4 4h16v16H4V4Zm0 0 8 9 8-9",
  telegram: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z",
  wallet: "M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4h-4Z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  lock: "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2ZM7 11V7a5 5 0 0 1 10 0v4",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff: "M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.3 21.3 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.3 21.3 0 0 1-3.22 4.53M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22",
  check: "M20 6 9 17l-5-5",
  chevron: "M6 9l6 6 6-6",
};

/* =========================
   HELPERS
========================= */
const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

/* =========================
   TOGGLE COMPONENT
========================= */
const Toggle = ({ checked, onChange, label, description, disabled, color = "#6366f1" }) => (
  <label style={{ ...styles.toggleRow, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
    <div style={styles.toggleText}>
      <span style={styles.toggleLabelText}>{label}</span>
      {description && <span style={styles.toggleDesc}>{description}</span>}
    </div>
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        ...styles.toggleTrack,
        background: checked ? color : "#1c2333",
        border: `1px solid ${checked ? color : "#2a3348"}`,
      }}
    >
      <div
        style={{
          ...styles.toggleKnob,
          left: checked ? 21 : 2,
          background: checked ? "#fff" : "#5b6478",
        }}
      />
    </div>
  </label>
);

/* =========================
   INPUT COMPONENT
========================= */
function Input({ label, value, setValue, disabled, icon, type = "text", placeholder }) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <div style={{ ...styles.inputShell, ...(disabled ? styles.inputShellDisabled : {}) }}>
        {icon && (
          <span style={styles.inputIcon}>
            <Icon path={icons[icon]} size={15} />
          </span>
        )}
        <input
          type={type}
          value={value || ""}
          onChange={(e) => setValue(e.target.value)}
          style={styles.input}
          disabled={disabled}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

/* =========================
   SECTION WRAPPER
========================= */
function Section({ icon, title, subtitle, children, right }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionHeaderLeft}>
          <div style={styles.sectionIconBadge}>
            <Icon path={icons[icon]} size={17} />
          </div>
          <div>
            <div style={styles.sectionTitle}>{title}</div>
            {subtitle && <div style={styles.sectionSubtitle}>{subtitle}</div>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */
export default function ProfileTab({
  user, username, setUsername, firstName, setFirstName, lastName, setLastName,
  phoneNumber, setPhoneNumber, email, setEmail,
  telegramId, setTelegramId, status, setStatus, role, setRole, accessPoints,
  toggleAccess, permissionTab, setPermissionTab, updateProfile, resetPassword,
  newPassword, setNewPassword, permissions, ACCESS_GROUPS, hasPermission,
  deleteUser, deletingUser,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [identityExpanded, setIdentityExpanded] = useState(false);
  const canEdit = permissions?.canEditUser;
  const canDelete = permissions?.canDeleteUser && user?.role !== "master";
  const canManagePermissions =
    (user?.role === "admin" || user?.role === "master") && hasPermission(user, "admins.promotion");

  const initials = ((firstName?.[0] || username?.[0] || "?") + (lastName?.[0] || "")).toUpperCase();
  const isActive = status === "active";

  const handleFirstName = (v) => setFirstName(capitalize(v));
  const handleLastName = (v) => setLastName(capitalize(v));

  return (
    <div style={styles.page}>
      {/* =========================
          IDENTITY HEADER (expandable)
      ========================= */}
      <div style={styles.identityCard}>
        <button
          type="button"
          onClick={() => setIdentityExpanded((v) => !v)}
          style={styles.identityCardTrigger}
          aria-expanded={identityExpanded}
        >
          <div style={styles.avatar}>{initials}</div>
          <div style={styles.identityInfo}>
            <div style={styles.identityName}>
              {firstName || lastName
                ? `${capitalize(firstName) || ""} ${capitalize(lastName) || ""}`.trim()
                : username || "Unnamed user"}
            </div>
            <div style={styles.identityHandle}>@{username || "no-username"}</div>
          </div>
          <div style={{ ...styles.statusPill, ...(isActive ? styles.statusPillActive : styles.statusPillInactive) }}>
            <span style={{ ...styles.statusDot, background: isActive ? "#34d399" : "#f87171" }} />
            {isActive ? "Active" : "Disabled"}
          </div>
          <span style={{ ...styles.chevronBtn, transform: identityExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
            <Icon path={icons.chevron} size={16} />
          </span>
        </button>

        {/* =========================
            ACCOUNT INFORMATION (collapsible content)
        ========================= */}
        {identityExpanded && (
          <div style={styles.identityExpandedContent}>
            <div style={styles.divider} />
            <div style={styles.formGrid}>
              <Input label="Username" icon="user" value={username} setValue={setUsername} disabled={!canEdit} />
              <Input label="Telegram ID" icon="telegram" value={telegramId} setValue={setTelegramId} disabled={!canEdit} />
              <Input label="First name" value={firstName} setValue={handleFirstName} disabled={!canEdit} />
              <Input label="Last name" value={lastName} setValue={handleLastName} disabled={!canEdit} />
              <Input label="Phone number" icon="phone" value={phoneNumber} setValue={setPhoneNumber} disabled={!canEdit} />
              <Input label="Email" icon="mail" value={email} setValue={setEmail} disabled={!canEdit} />

              {canManagePermissions && (
                <div style={styles.fieldWrap}>
                  <label style={styles.label}>Role</label>
                  <div style={{ ...styles.inputShell, ...(!canEdit ? styles.inputShellDisabled : {}) }}>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      style={styles.select}
                      disabled={!canEdit}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div style={styles.divider} />

            <Toggle
              checked={isActive}
              onChange={(checked) => setStatus(checked ? "active" : "disabled")}
              label="Account active"
              description="Disabled accounts can't sign in or place trades"
              color="#34d399"
              disabled={!canEdit}
            />
          </div>
        )}
      </div>

      {/* =========================
          SECURITY
      ========================= */}
      {canEdit && (
        <Section icon="lock" title="Security" subtitle="Reset the user's password">
          <div style={styles.securityRow}>
            <div style={{ ...styles.fieldWrap, flex: 1 }}>
              <label style={styles.label}>New password</label>
              <div style={styles.inputShell}>
                <span style={styles.inputIcon}>
                  <Icon path={icons.lock} size={15} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword || ""}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={styles.input}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <Icon path={showPassword ? icons.eyeOff : icons.eye} size={15} />
                </button>
              </div>
            </div>

            <button onClick={() => resetPassword(newPassword)} style={styles.dangerBtn}>
              <Icon path={icons.shield} size={15} />
              Reset password
            </button>
          </div>

          {canDelete && (
            <>
              <div style={styles.divider} />
              <div style={styles.dangerZone}>
                <div style={styles.dangerZoneText}>
                  <div style={styles.dangerZoneTitle}>Delete this user</div>
                  <div style={styles.toggleDesc}>
                    Permanently removes this account and all associated data. This cannot be undone.
                  </div>
                </div>
                <button
                  onClick={deleteUser}
                  disabled={deletingUser}
                  style={{ ...styles.dangerBtn, opacity: deletingUser ? 0.6 : 1, cursor: deletingUser ? "not-allowed" : "pointer" }}
                >
                  <Icon path={icons.lock} size={15} />
                  {deletingUser ? "Deleting..." : "Delete user"}
                </button>
              </div>
            </>
          )}
        </Section>
      )}

      {/* =========================
          PERMISSIONS
      ========================= */}
      {canManagePermissions && (
        <Section icon="shield" title="Admin permissions" subtitle="Control what this admin can access">
          <div style={styles.permissionTabs}>
            {Object.keys(ACCESS_GROUPS).map((group) => (
              <button
                key={group}
                onClick={() => setPermissionTab(group)}
                style={{
                  ...styles.tabBtn,
                  ...(permissionTab === group ? styles.activeTab : {}),
                }}
              >
                {group.charAt(0).toUpperCase() + group.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div style={styles.togglesGridWrap}>
            <div style={styles.togglesGrid}>
              {ACCESS_GROUPS[permissionTab]?.map((item) => (
                <div key={item.key} style={styles.permissionCard}>
                  <Toggle
                    checked={accessPoints.includes(item.key)}
                    onChange={() => toggleAccess(item.key)}
                    label={item.label}
                  />
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* =========================
          SAVE BUTTON
      ========================= */}
      {canEdit && (
        <div style={styles.saveBar}>
          <button onClick={updateProfile} style={styles.saveBtn}>
            <Icon path={icons.check} size={16} />
            Save changes
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================
   STYLES
========================= */
const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },

  /* Identity header */
  identityCard: {
    background: "linear-gradient(135deg, #131a2e 0%, #0c1120 100%)",
    border: "1px solid #1e293b",
    borderRadius: 18,
    padding: "16px 18px",
  },
  identityCardTrigger: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    width: "100%",
    background: "none",
    border: "none",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
    color: "inherit",
  },
  chevronBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    flexShrink: 0,
    transition: "transform 0.2s",
  },
  identityExpandedContent: {
    animation: "none",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: "rgba(99,102,241,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    color: "#818cf8",
    flexShrink: 0,
  },
  identityInfo: { flex: 1, minWidth: 0 },
  identityName: {
    color: "#e2e8f0",
    fontWeight: 700,
    fontSize: 16,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  identityHandle: { color: "#64748b", fontSize: 13, marginTop: 2 },
  statusPill: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 12px",
    borderRadius: 999,
    flexShrink: 0,
  },
  statusPillActive: { background: "rgba(52,211,153,0.12)", color: "#34d399" },
  statusPillInactive: { background: "rgba(248,113,113,0.12)", color: "#f87171" },
  statusDot: { width: 6, height: 6, borderRadius: "50%" },

  /* Section */
  section: {
    background: "linear-gradient(180deg,#111827 0%, #0a1226 100%)",
    border: "1px solid #1e293b",
    borderRadius: 20,
    padding: 20,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 12,
  },
  sectionHeaderLeft: { display: "flex", alignItems: "center", gap: 12 },
  sectionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: "rgba(99,102,241,0.12)",
    color: "#818cf8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: "#e2e8f0" },
  sectionSubtitle: { fontSize: 12.5, color: "#64748b", marginTop: 2 },

  divider: { height: 1, background: "#1c2333", margin: "18px 0" },

  /* Form fields */
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  fieldWrap: { display: "flex", flexDirection: "column" },
  label: {
    marginBottom: 7,
    fontSize: 12.5,
    fontWeight: 500,
    color: "#94a3b8",
  },
  inputShell: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#0b1220",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: "0 12px",
    transition: "border-color 0.15s",
  },
  inputShellDisabled: { opacity: 0.55 },
  inputIcon: { color: "#4b5872", display: "flex", flexShrink: 0 },
  input: {
    flex: 1,
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    padding: "11px 0",
    color: "#e2e8f0",
    fontSize: 14,
  },
  select: {
    flex: 1,
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    padding: "11px 0",
    color: "#e2e8f0",
    fontSize: 14,
  },
  eyeBtn: {
    background: "none",
    border: "none",
    color: "#4b5872",
    cursor: "pointer",
    display: "flex",
    padding: 4,
  },

  /* Security */
  securityRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 12,
    flexWrap: "wrap",
  },
  dangerBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    height: 44,
    background: "#ef4444",
    border: "none",
    borderRadius: 12,
    padding: "0 18px",
    color: "white",
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dangerZone: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    background: "rgba(239,68,68,0.06)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 14,
    padding: "14px 16px",
  },
  dangerZoneText: { display: "flex", flexDirection: "column", gap: 4, minWidth: 200 },
  dangerZoneTitle: { fontSize: 14, fontWeight: 700, color: "#fca5a5" },

  /* Toggle */
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleText: { display: "flex", flexDirection: "column", gap: 2 },
  toggleLabelText: { fontSize: 14, color: "#e2e8f0", fontWeight: 500 },
  toggleDesc: { fontSize: 12, color: "#64748b" },
  toggleTrack: {
    position: "relative",
    width: 40,
    height: 22,
    borderRadius: 12,
    transition: "all 0.2s",
    flexShrink: 0,
  },
  toggleKnob: {
    position: "absolute",
    top: 2,
    width: 16,
    height: 16,
    borderRadius: "50%",
    transition: "left 0.2s",
  },

  /* Permissions */
  permissionTabs: {
    display: "flex",
    gap: 6,
    marginBottom: 16,
    overflowX: "auto",
    paddingBottom: 2,
  },
  tabBtn: {
    padding: "7px 14px",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 500,
    background: "transparent",
    border: "1px solid #26324a",
    color: "#64748b",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  activeTab: {
    background: "rgba(99,102,241,0.15)",
    borderColor: "#6366f1",
    color: "#a5b4fc",
  },
  togglesGridWrap: {
    minHeight: 280,
    alignContent: "flex-start",
  },
  togglesGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    alignContent: "flex-start",
  },
  permissionCard: {
    background: "#0b1220",
    border: "1px solid #1c2333",
    borderRadius: 12,
    padding: "12px 14px",
  },

  /* Save bar */
  saveBar: {
    position: "sticky",
    bottom: 0,
    display: "flex",
    justifyContent: "center",
    padding: "12px 0 4px",
  },
  saveBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "linear-gradient(135deg,#6366f1,#4f46e5)",
    border: "none",
    borderRadius: 14,
    padding: "13px 28px",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(79,70,229,0.35)",
    width: "100%",
    justifyContent: "center",
  },
};