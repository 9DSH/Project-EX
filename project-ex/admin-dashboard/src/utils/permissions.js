export function hasPermission(user, key) {
  if (!user) return false;

  const role = localStorage.getItem("role");
  const isMaster = role === "master";

  const access = JSON.parse(localStorage.getItem("access_points") || "[]");

  // master bypass
  if (isMaster) return true;

  return access.includes(key);
}