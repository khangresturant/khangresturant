/**
 * Superadmin checks — prefer `user_profiles.role = 'superadmin'`.
 * Optional env bootstrap: SUPERADMIN_EMAILS=comma,separated@emails
 * (for initial break-glass only; do not hardcode production emails in source).
 */

export type UserProfileRole = string | null | undefined;

export function isSuperAdminRole(role: UserProfileRole): boolean {
  return String(role || "").toLowerCase() === "superadmin";
}

/** Env-based bootstrap allowlist (optional). Empty in production preferred. */
export function isSuperAdminBootstrapEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.SUPERADMIN_EMAILS || process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS || "";
  if (!raw.trim()) return false;
  const list = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export function isSuperAdmin(opts: {
  role?: UserProfileRole;
  email?: string | null;
}): boolean {
  if (isSuperAdminRole(opts.role)) return true;
  if (isSuperAdminBootstrapEmail(opts.email)) return true;
  return false;
}

export function isSaaSAdmin(email: string | null | undefined): boolean {
  return isSuperAdminBootstrapEmail(email);
}
