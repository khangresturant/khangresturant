/**
 * Single source of truth for Free / Starter / Premium feature gates.
 * ShopContext, Sidebar, and billing UI should resolve plans through this module.
 * Remote plan JSON from platform config may override individual flags.
 */

import { shouldHideSupportTickets } from "@/lib/deployment/flame9-brand";

export type PlanId = "free" | "starter" | "premium";

export type PlanFeatures = {
  id: PlanId;
  name: string;
  monthly_price: number;
  yearly_price: number;
  allow_simple_accounts: boolean;
  allow_industrial_accounts: boolean;
  /** POS, sales, purchase, registers (admin: allow_sales_purchases) */
  allow_sales_purchases: boolean;
  /** Khata / credit ledger (admin: allow_credits) */
  allow_credits: boolean;
  /** PDF & analytics reports (admin: allow_pdf) */
  allow_pdf: boolean;
  /** Inventory modules — products, units, etc. (admin: allow_inventory) */
  allow_inventory: boolean;
  /** Staff & roles panel (admin: allow_user_roles) */
  allow_user_roles: boolean;
  allow_backup: boolean;
  allow_barcode: boolean;
  allow_multi_shop: boolean;
  allow_universal_import: boolean;
  allow_ai_product_add: boolean;
  allow_ai_purchase_order: boolean;
  allow_whatsapp: boolean;
  max_devices: string;
  allow_emi: boolean;
  allow_payroll: boolean;
  allow_tax: boolean;
  allow_assets: boolean;
  allow_accounts: boolean;
  allow_reports: boolean;
  allow_expenses: boolean;
  /** Support tickets module */
  allow_support: boolean;
  /** General ledger reports */
  allow_gl: boolean;
  /** Fiscal period closing */
  allow_closing: boolean;
  /** Staff management panel */
  allow_staff: boolean;
};

export const DEFAULT_PLANS: Record<PlanId, PlanFeatures> = {
  free: {
    id: "free",
    name: "Free Trial Plan",
    monthly_price: 0,
    yearly_price: 0,
    allow_simple_accounts: true,
    allow_industrial_accounts: false,
    allow_sales_purchases: true,
    allow_credits: true,
    allow_pdf: true,
    allow_inventory: true,
    allow_user_roles: false,
    allow_backup: false,
    allow_barcode: false,
    allow_multi_shop: false,
    allow_universal_import: false,
    allow_ai_product_add: false,
    allow_ai_purchase_order: false,
    allow_whatsapp: false,
    max_devices: "1",
    allow_emi: false,
    allow_payroll: false,
    allow_tax: false,
    allow_assets: false,
    allow_accounts: true,
    allow_reports: true,
    allow_expenses: false,
    allow_support: false,
    allow_gl: false,
    allow_closing: false,
    allow_staff: false,
  },
  starter: {
    id: "starter",
    name: "Starter Plan",
    monthly_price: 1500,
    yearly_price: 15000,
    allow_simple_accounts: true,
    allow_industrial_accounts: true,
    allow_sales_purchases: true,
    allow_credits: true,
    allow_pdf: true,
    allow_inventory: true,
    allow_user_roles: true,
    allow_backup: true,
    allow_barcode: true,
    allow_multi_shop: false,
    allow_universal_import: true,
    allow_ai_product_add: false,
    allow_ai_purchase_order: false,
    allow_whatsapp: false,
    max_devices: "3",
    allow_emi: true,
    allow_payroll: false,
    allow_tax: false,
    allow_assets: false,
    allow_accounts: true,
    allow_reports: true,
    allow_expenses: true,
    allow_support: false,
    allow_gl: true,
    allow_closing: true,
    allow_staff: true,
  },
  premium: {
    id: "premium",
    name: "Premium POS ERP",
    monthly_price: 3500,
    yearly_price: 35000,
    allow_simple_accounts: true,
    allow_industrial_accounts: true,
    allow_sales_purchases: true,
    allow_credits: true,
    allow_pdf: true,
    allow_inventory: true,
    allow_user_roles: true,
    allow_backup: true,
    allow_barcode: true,
    allow_multi_shop: true,
    allow_universal_import: true,
    allow_ai_product_add: true,
    allow_ai_purchase_order: true,
    allow_whatsapp: true,
    max_devices: "unlimited",
    allow_emi: true,
    allow_payroll: true,
    allow_tax: true,
    allow_assets: true,
    allow_accounts: true,
    allow_reports: true,
    allow_expenses: true,
    allow_support: true,
    allow_gl: true,
    allow_closing: true,
    allow_staff: true,
  },
};

export function normalizePlanId(tier: string | null | undefined): PlanId {
  if (tier === "starter" || tier === "premium") return tier;
  return "free";
}

/** Built-in defaults when remote SaaS plan config is missing. */
export function getDefaultPlan(tier: string | null | undefined): PlanFeatures {
  return { ...DEFAULT_PLANS[normalizePlanId(tier)] };
}

/**
 * Merge remote plan row (from platform company_details) over built-in defaults.
 * Unknown remote fields are ignored; known flags override.
 */
export function resolvePlan(
  tier: string | null | undefined,
  remotePlans: Array<Record<string, unknown>> = []
): PlanFeatures {
  const id = normalizePlanId(tier);
  const base = getDefaultPlan(id);
  const remote = remotePlans.find((p) => p && (p.id === id || p.id === tier));
  if (!remote) return base;

  const pickBool = (key: keyof PlanFeatures, fallback: boolean): boolean => {
    const v = remote[key];
    return typeof v === "boolean" ? v : fallback;
  };

  return {
    ...base,
    id,
    name: typeof remote.name === "string" ? remote.name : base.name,
    monthly_price:
      typeof remote.monthly_price === "number" ? remote.monthly_price : base.monthly_price,
    yearly_price:
      typeof remote.yearly_price === "number" ? remote.yearly_price : base.yearly_price,
    allow_simple_accounts: pickBool("allow_simple_accounts", base.allow_simple_accounts),
    allow_industrial_accounts: pickBool("allow_industrial_accounts", base.allow_industrial_accounts),
    allow_sales_purchases: pickBool("allow_sales_purchases", base.allow_sales_purchases),
    allow_credits: pickBool("allow_credits", base.allow_credits),
    allow_pdf: pickBool("allow_pdf", base.allow_pdf),
    allow_inventory: pickBool("allow_inventory", base.allow_inventory),
    allow_user_roles: pickBool("allow_user_roles", base.allow_user_roles),
    allow_backup: pickBool("allow_backup", base.allow_backup),
    allow_barcode: pickBool("allow_barcode", base.allow_barcode),
    allow_multi_shop: pickBool("allow_multi_shop", base.allow_multi_shop),
    allow_universal_import: pickBool("allow_universal_import", base.allow_universal_import),
    allow_ai_product_add: pickBool("allow_ai_product_add", base.allow_ai_product_add),
    allow_ai_purchase_order: pickBool("allow_ai_purchase_order", base.allow_ai_purchase_order),
    allow_whatsapp: pickBool("allow_whatsapp", base.allow_whatsapp),
    max_devices:
      remote.max_devices !== undefined && remote.max_devices !== null
        ? String(remote.max_devices)
        : base.max_devices,
    allow_emi: pickBool("allow_emi", base.allow_emi),
    allow_payroll: pickBool("allow_payroll", base.allow_payroll),
    allow_tax: pickBool("allow_tax", base.allow_tax),
    allow_assets: pickBool("allow_assets", base.allow_assets),
    allow_accounts: pickBool(
      "allow_accounts",
      typeof remote.allow_accounts === "boolean"
        ? remote.allow_accounts
        : pickBool("allow_simple_accounts", base.allow_simple_accounts) ||
            pickBool("allow_industrial_accounts", base.allow_industrial_accounts)
    ),
    allow_reports: pickBool(
      "allow_reports",
      typeof remote.allow_reports === "boolean"
        ? remote.allow_reports
        : pickBool("allow_pdf", base.allow_reports)
    ),
    allow_expenses: pickBool("allow_expenses", base.allow_expenses),
    allow_support: pickBool("allow_support", base.allow_support),
    allow_gl: pickBool("allow_gl", base.allow_gl ?? base.allow_industrial_accounts),
    allow_closing: pickBool("allow_closing", base.allow_closing ?? base.allow_industrial_accounts),
    allow_staff: pickBool(
      "allow_staff",
      typeof remote.allow_staff === "boolean"
        ? remote.allow_staff
        : pickBool("allow_user_roles", base.allow_staff ?? base.allow_payroll)
    ),
  };
}

/** Days after expiry before full dashboard lock. */
export const SUBSCRIPTION_GRACE_DAYS = 3;

/**
 * Effective tier for plan features.
 * Paid tier is kept during {@link SUBSCRIPTION_GRACE_DAYS}-day grace; then free.
 */
export function getEffectiveTierId(
  subscriptionTier: string | null | undefined,
  subscriptionExpiresAt: string | null | undefined,
  now: Date = new Date()
): PlanId {
  const tier = normalizePlanId(subscriptionTier);
  if (!subscriptionExpiresAt) return tier;

  const expires = new Date(subscriptionExpiresAt);
  if (Number.isNaN(expires.getTime())) return tier;

  if (expires.getTime() > now.getTime()) return tier;

  const graceEnds = new Date(expires);
  graceEnds.setDate(graceEnds.getDate() + SUBSCRIPTION_GRACE_DAYS);
  if (now.getTime() <= graceEnds.getTime()) return tier;

  return "free";
}

/**
 * Path-level gates for sidebar and route guards.
 * Uses plan feature flags from admin-configured SaaS plans.
 */
export function isPathAllowedForPlan(path: string, plan: PlanFeatures): boolean {
  if (path === "/dashboard" || path === "/dashboard/settings" || path.startsWith("/dashboard/settings/profile")) {
    return true;
  }
  if (path.startsWith("/dashboard/billing")) return true;

  if (
    (path.startsWith("/dashboard/pos") ||
      path.startsWith("/dashboard/sales") ||
      path.startsWith("/dashboard/purchase") ||
      path.startsWith("/dashboard/registers") ||
      path.startsWith("/dashboard/returns")) &&
    !plan.allow_sales_purchases
  ) {
    return false;
  }

  if (
    (path.startsWith("/dashboard/products") ||
      path.startsWith("/dashboard/inventory") ||
      path.startsWith("/dashboard/units") ||
      path.startsWith("/dashboard/categories") ||
      path.startsWith("/dashboard/brands")) &&
    !plan.allow_inventory
  ) {
    return false;
  }

  if (path.startsWith("/dashboard/khata") && !plan.allow_credits) {
    return false;
  }

  if (path.startsWith("/dashboard/accounts") && !plan.allow_accounts) {
    return false;
  }

  if (path.startsWith("/dashboard/expenses") && !plan.allow_expenses) {
    return false;
  }

  if (path.startsWith("/dashboard/reports/gl") && !plan.allow_gl && !plan.allow_industrial_accounts) {
    return false;
  }

  if (
    path.startsWith("/dashboard/reports") &&
    !path.startsWith("/dashboard/reports/gl") &&
    !plan.allow_reports &&
    !plan.allow_pdf
  ) {
    return false;
  }

  if (path.startsWith("/dashboard/settings/closing") && !plan.allow_closing && !plan.allow_industrial_accounts) {
    return false;
  }

  if (
    path.startsWith("/dashboard/support") &&
    (!plan.allow_support || shouldHideSupportTickets())
  ) {
    return false;
  }

  if (path.startsWith("/dashboard/backup") && !plan.allow_backup) {
    return false;
  }

  if (path.startsWith("/dashboard/staff") && !plan.allow_staff && !plan.allow_user_roles && !plan.allow_payroll) {
    return false;
  }

  if (path.startsWith("/dashboard/electronics/emi") && !plan.allow_emi) {
    return false;
  }

  if (path.startsWith("/dashboard/general/barcodes") && !plan.allow_barcode) {
    return false;
  }

  if (path.startsWith("/dashboard/settings/migration") && !plan.allow_universal_import) {
    return false;
  }

  if (path.startsWith("/dashboard/settings/wizard") && !plan.allow_ai_product_add) {
    return false;
  }

  if (path.startsWith("/dashboard/my-businesses") && !plan.allow_multi_shop) {
    return false;
  }

  return true;
}

/** Suggest the lowest tier (from admin plans) that unlocks a path. */
export function getSuggestedUpgradePlanName(
  path: string,
  remotePlans: Array<Record<string, unknown>> = []
): string {
  const tiers: PlanId[] = ["starter", "premium"];
  for (const tier of tiers) {
    const candidate = resolvePlan(tier, remotePlans);
    if (isPathAllowedForPlan(path, candidate)) {
      return candidate.name;
    }
  }
  return resolvePlan("premium", remotePlans).name;
}

/** Server-side price lookup for billing (never trust client price alone). */
export function getPlanPrice(
  tier: string,
  billing: "monthly" | "yearly" = "monthly",
  remotePlans: Array<Record<string, unknown>> = []
): number {
  const plan = resolvePlan(tier, remotePlans);
  return billing === "yearly" ? plan.yearly_price : plan.monthly_price;
}
