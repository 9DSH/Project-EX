import { useState } from "react";
import "./UserSidebar.css";
import {
  User,
  Phone,
  Mail,
  Send,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Check,
  ChevronDown,
  Trash2,
} from "lucide-react";


/* =========================
   HELPERS
========================= */
const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

/* =========================
   TOGGLE COMPONENT
========================= */
const Toggle = ({ checked, onChange, label, description, disabled, color = "#6366f1" }) => (
  <label className={`us-toggle-row${disabled ? " is-disabled" : ""}`}>
    <div className="us-toggle-text">
      <span className="us-toggle-label-text">{label}</span>
      {description && <span className="us-toggle-desc">{description}</span>}
    </div>
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`us-toggle-track${checked ? " is-checked" : ""}`}
      style={{ "--toggle-color": color }}
    >
      <div className={`us-toggle-knob${checked ? " is-checked" : ""}`} />
    </div>
  </label>
);

/* =========================
   INPUT COMPONENT
========================= */
function Input({ label, value, setValue, disabled, icon: IconComp, type = "text", placeholder }) {
  return (
    <div className="us-field">
      <label className="us-label">{label}</label>
      <div className={`us-input-shell${disabled ? " is-disabled" : ""}`}>
        {IconComp && (
          <span className="us-input-icon">
            <IconComp size={15} />
          </span>
        )}
        <input
          type={type}
          value={value || ""}
          onChange={(e) => setValue(e.target.value)}
          className="us-input"
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
function Section({ icon: IconComp, title, subtitle, children, right }) {
  return (
    <div className="us-section">
      <div className="us-section-header">
        <div className="us-section-header-left">
          <div className="us-icon-badge">
            {IconComp && <IconComp size={17} />}
          </div>
          <div>
            <div className="us-title">{title}</div>
            {subtitle && <div className="us-subtitle">{subtitle}</div>}
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
  const [securityExpanded, setSecurityExpanded] = useState(false);
  const canEdit = permissions?.canEditUser;
  const canDelete = permissions?.canDeleteUser && user?.role !== "master";
  const canManagePermissions =
    (user?.role === "admin" || user?.role === "master") && hasPermission(user, "admins.promotion");

  const initials = ((firstName?.[0] || username?.[0] || "?") + (lastName?.[0] || "")).toUpperCase();
  const isActive = status === "active";

  const handleFirstName = (v) => setFirstName(capitalize(v));
  const handleLastName = (v) => setLastName(capitalize(v));

  return (
    <div className="us-page">
      {/* =========================
          IDENTITY HEADER (expandable)
      ========================= */}
      <div className="us-identity-card">
        <button
          type="button"
          onClick={() => setIdentityExpanded((v) => !v)}
          className="us-identity-trigger"
          aria-expanded={identityExpanded}
        >
          <div className="us-avatar">{initials}</div>
          <div className="us-identity-info">
            <div className="us-identity-name">
              {firstName || lastName
                ? `${capitalize(firstName) || ""} ${capitalize(lastName) || ""}`.trim()
                : username || "Unnamed user"}
            </div>
            <div className="us-identity-handle">@{username || "no-username"}</div>
          </div>
          <div className={`us-status-pill${isActive ? " is-active" : " is-inactive"}`}>
            <span className="us-status-dot" style={{ background: isActive ? "#34d399" : "#f87171" }} />
            {isActive ? "Active" : "Disabled"}
          </div>
          <span className={`us-chevron${identityExpanded ? " is-open" : ""}`}>
            <ChevronDown size={16} />
          </span>
        </button>

        {/* =========================
            ACCOUNT INFORMATION (collapsible content)
        ========================= */}
        <div className={`us-collapse${identityExpanded ? " is-open" : ""}`}>
          <div className="us-collapse-inner">
          <div className="us-identity-expanded">
            <div className="us-divider" />
            <div className="us-form-grid">
              <Input label="Username" icon={User} value={username} setValue={setUsername} disabled={!canEdit} />
              <Input label="Telegram ID" icon={Send} value={telegramId} setValue={setTelegramId} disabled={!canEdit} />
              <Input label="First name" value={firstName} setValue={handleFirstName} disabled={!canEdit} />
              <Input label="Last name" value={lastName} setValue={handleLastName} disabled={!canEdit} />
              <Input label="Phone number" icon={Phone} value={phoneNumber} setValue={setPhoneNumber} disabled={!canEdit} />
              <Input label="Email" icon={Mail} value={email} setValue={setEmail} disabled={!canEdit} />

              {canManagePermissions && (
                <div className="us-field">
                  <label className="us-label">Role</label>
                  <div className={`us-input-shell${!canEdit ? " is-disabled" : ""}`}>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="us-select"
                      disabled={!canEdit}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="us-divider" />

            <Toggle
              checked={isActive}
              onChange={(checked) => setStatus(checked ? "active" : "disabled")}
              label="Account active"
              description="Disabled accounts can't sign in or place trades"
              color="#34d399"
              disabled={!canEdit}
            />
          </div>
          </div>
        </div>
      </div>

      {/* =========================
          SECURITY (expandable)
      ========================= */}
      {canEdit && (
        <div className="us-section">
          <button
            type="button"
            onClick={() => setSecurityExpanded((v) => !v)}
            className="us-section-header-trigger"
            aria-expanded={securityExpanded}
          >
            <div className="us-section-header-left">
              <div className="us-icon-badge">
                <Lock size={17} />
              </div>
              <div>
                <div className="us-title">Security</div>
                <div className="us-subtitle">Reset the user's password</div>
              </div>
            </div>
            <span className={`us-chevron${securityExpanded ? " is-open" : ""}`}>
              <ChevronDown size={16} />
            </span>
          </button>

          <div className={`us-collapse${securityExpanded ? " is-open" : ""}`}>
            <div className="us-collapse-inner">
            <div className="us-identity-expanded">
              <div className="us-divider" />
              <div className="us-security-row">
                <div className="us-field" style={{ flex: 1 }}>
                  <label className="us-label">New password</label>
                  <div className="us-input-shell">
                    <span className="us-input-icon">
                      <Lock size={15} />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword || ""}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="us-input"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="us-eye-btn"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button onClick={() => resetPassword(newPassword)} className="us-btn-danger">
                  <Shield size={15} />
                  Reset password
                </button>
              </div>

              {canDelete && (
                <>
                  <div className="us-divider" />
                  <div className="us-danger-zone">
                    <div className="us-danger-zone-text">
                     
                      <div className="us-toggle-desc">
                        Permanently removes this account and all associated data. This cannot be undone.
                      
                      </div>
                      
                    <button
                      onClick={deleteUser}
                      disabled={deletingUser}
                      className={`us-btn-danger${deletingUser ? " is-disabled" : ""}`}
                    >
                      <Trash2 size={15} />
                      {deletingUser ? "Deleting..." : "Delete user"}
                    </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================
          PERMISSIONS
      ========================= */}
      {canManagePermissions && (
        <Section icon={Shield} title="Admin permissions" subtitle="Control what this admin can access">
          <div className="us-tabs-row">
            {Object.keys(ACCESS_GROUPS).map((group) => (
              <button
                key={group}
                onClick={() => setPermissionTab(group)}
                className={`us-tab-btn${permissionTab === group ? " is-active" : ""}`}
              >
                {group.charAt(0).toUpperCase() + group.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="us-grid-2">
            {ACCESS_GROUPS[permissionTab]?.map((item) => (
              <div key={item.key} className="us-card-sm">
                <Toggle
                  checked={accessPoints.includes(item.key)}
                  onChange={() => toggleAccess(item.key)}
                  label={item.label}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* =========================
          SAVE BUTTON
      ========================= */}
      {canEdit && (
        <div className="us-save-bar">
          <button
          onClick={updateProfile}

          className="primaryBtn"
           >
            Save changes
          </button>
        </div>
      )}
    </div>
  );
}