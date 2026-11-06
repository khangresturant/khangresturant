/**
 * Flame 9 - Pizza House & Café deployment profile (D:\pizza).
 * Branding + permanent restaurant license (no SaaS billing UI).
 */

export const FLAME9 = {
  id: "flame9",
  name: "Flame 9",
  fullName: "Flame 9 Pizza House & Café",
  tagline: "Fresh • Fast • Flavor",
  logoPath: "/brands/flame9/logo.png",
  colors: {
    flame: "#FF4D00",
    flameDark: "#C93400",
    ember: "#FF8A3D",
    coal: "#14110F",
    cream: "#FFF8F0",
  },
} as const;

export function isFlame9Brand(): boolean {
  return (process.env.NEXT_PUBLIC_BRAND || "").toLowerCase() === "flame9";
}

/** Owner-operated install: premium features, no expiry, hide payment plans. */
export function isPermanentRestaurantLicense(): boolean {
  if (process.env.NEXT_PUBLIC_PERMANENT_LICENSE === "true") return true;
  if (process.env.NEXT_PUBLIC_USE_LOCAL_SQLITE === "true") return true;
  return isFlame9Brand();
}

export function shouldHideBillingAndPlans(): boolean {
  if (process.env.NEXT_PUBLIC_HIDE_BILLING === "true") return true;
  return isPermanentRestaurantLicense();
}

/** Default dashboard sidebar theme for this deployment. */
export function getDefaultSidebarThemeId(): "flame9-ember" | "midnight-violet" {
  return isFlame9Brand() ? "flame9-ember" : "midnight-violet";
}

/** Block backup / restore / cloud export for local Flame 9 installs. */
export function shouldDisableBackupRestore(): boolean {
  return isFlame9Brand() || process.env.NEXT_PUBLIC_USE_LOCAL_SQLITE === "true";
}

/** Hide Support Tickets in sidebar; page stays in codebase for SaaS builds. */
export function shouldHideSupportTickets(): boolean {
  if (process.env.NEXT_PUBLIC_HIDE_SUPPORT === "true") return true;
  return isPermanentRestaurantLicense();
}

/** Primary super-admin email hint for login (public env only). */
export function getFlame9AdminEmailHint(): string {
  const explicit = process.env.NEXT_PUBLIC_FLAME9_ADMIN_EMAIL?.trim();
  if (explicit) return explicit;
  const raw = process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS || "";
  const first = raw.split(",").map((e) => e.trim()).filter(Boolean)[0];
  return first || "admin@flame9.pizza";
}

export const PERMANENT_PLAN_LABEL = "Permanent - Pizza House & Café";
