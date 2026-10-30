/**
 * Shared SaaS plan display — admin panel config + landing/billing UI.
 * Note: plan id "free" is the Zero tier slug (paid entry plan), not a $0 plan.
 */

export type AdminSaasPlan = Record<string, unknown> & {
  id: string;
  name: string;
  monthly_price?: number;
  yearly_price?: number;
  monthly_price_usd?: number;
  yearly_price_usd?: number;
  max_devices?: string | number;
  allow_simple_accounts?: boolean;
  allow_industrial_accounts?: boolean;
  allow_sales_purchases?: boolean;
  allow_whatsapp?: boolean;
  allow_emi?: boolean;
  allow_credits?: boolean;
  allow_pdf?: boolean;
  allow_backup?: boolean;
  allow_payroll?: boolean;
  allow_tax?: boolean;
  allow_assets?: boolean;
  allow_user_roles?: boolean;
  allow_inventory?: boolean;
  allow_barcode?: boolean;
  allow_multi_shop?: boolean;
  allow_universal_import?: boolean;
  allow_ai_product_add?: boolean;
  allow_ai_purchase_order?: boolean;
  allow_trial?: boolean;
  trial_days?: number;
};

/** Matches landing page defaults — used when admin config is missing fields. */
export const BILLING_DEFAULT_PLANS: AdminSaasPlan[] = [
  {
    id: "free",
    name: "Zero Plan",
    monthly_price: 500,
    yearly_price: 1500,
    monthly_price_usd: 1.99,
    yearly_price_usd: 5.00,
    max_devices: "1",
    allow_simple_accounts: true,
    allow_industrial_accounts: false,
    allow_sales_purchases: true,
    allow_whatsapp: false,
    allow_emi: false,
    allow_credits: true,
    allow_pdf: true,
    allow_backup: false,
    allow_payroll: false,
    allow_tax: false,
    allow_assets: false,
    allow_user_roles: false,
    allow_inventory: true,
    allow_barcode: false,
    allow_multi_shop: false,
    allow_universal_import: false,
    allow_ai_product_add: false,
    allow_ai_purchase_order: false,
  },
  {
    id: "starter",
    name: "Starter Plan",
    monthly_price: 999,
    yearly_price: 5000,
    monthly_price_usd: 3.99,
    yearly_price_usd: 19.99,
    max_devices: "3",
    allow_simple_accounts: true,
    allow_industrial_accounts: true,
    allow_sales_purchases: true,
    allow_whatsapp: false,
    allow_emi: true,
    allow_credits: true,
    allow_pdf: true,
    allow_backup: true,
    allow_payroll: false,
    allow_tax: false,
    allow_assets: false,
    allow_user_roles: true,
    allow_inventory: true,
    allow_barcode: true,
    allow_multi_shop: false,
    allow_universal_import: true,
    allow_ai_product_add: false,
    allow_ai_purchase_order: false,
  },
  {
    id: "premium",
    name: "Premium POS ERP",
    monthly_price: 2000,
    yearly_price: 10999,
    monthly_price_usd: 7.99,
    yearly_price_usd: 59.99,
    max_devices: "unlimited",
    allow_simple_accounts: true,
    allow_industrial_accounts: true,
    allow_sales_purchases: true,
    allow_whatsapp: true,
    allow_emi: true,
    allow_credits: true,
    allow_pdf: true,
    allow_backup: true,
    allow_payroll: true,
    allow_tax: true,
    allow_assets: true,
    allow_user_roles: true,
    allow_inventory: true,
    allow_barcode: true,
    allow_multi_shop: true,
    allow_universal_import: true,
    allow_ai_product_add: true,
    allow_ai_purchase_order: true,
  },
];

export const PLAN_FEATURE_ROWS: { key: keyof AdminSaasPlan; label: string }[] = [
  { key: "allow_simple_accounts", label: "Simple Customer Accounts" },
  { key: "allow_industrial_accounts", label: "Industrial Accounts Ledger" },
  { key: "allow_sales_purchases", label: "Sales & Purchases Matrix" },
  { key: "allow_user_roles", label: "Staff Roles & Control" },
  { key: "allow_inventory", label: "Inventory Control & Alert" },
  { key: "allow_barcode", label: "Barcode Generation & Print" },
  { key: "allow_multi_shop", label: "Multi-Shop Manager" },
  { key: "allow_universal_import", label: "Universal Products Import" },
  { key: "allow_ai_product_add", label: "AI Product Add (OCR)" },
  { key: "allow_ai_purchase_order", label: "AI Auto Purchase Order" },
  { key: "allow_whatsapp", label: "WhatsApp Alerts" },
];

export type PlanFeatureRow = { label: string; active: boolean };

export function getPlanFeatureMatrix(plan: AdminSaasPlan): PlanFeatureRow[] {
  return PLAN_FEATURE_ROWS.map((row) => ({
    label: row.label,
    active: Boolean(plan[row.key]),
  }));
}

export function mergeRemotePlansWithDefaults(remotePlans?: AdminSaasPlan[] | null): AdminSaasPlan[] {
  const safePlans = Array.isArray(remotePlans) ? remotePlans : [];
  if (!safePlans.length) return [...BILLING_DEFAULT_PLANS];

  const merged = safePlans.map((p) => {
    const fallback =
      BILLING_DEFAULT_PLANS.find((d) => d.id === p.id) ||
      BILLING_DEFAULT_PLANS.find((d) => d.name === p.name);
    return { ...fallback, ...p } as AdminSaasPlan;
  });

  for (const fallback of BILLING_DEFAULT_PLANS) {
    if (!merged.some((p) => p.id === fallback.id)) {
      merged.push(fallback);
    }
  }

  return merged;
}

const PLAN_DISPLAY_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  premium: 2,
};

export function isZeroCostPlan(plan: AdminSaasPlan, isPakistan: boolean): boolean {
  if (isPakistan) {
    return (Number(plan.monthly_price) || 0) === 0 && (Number(plan.yearly_price) || 0) === 0;
  }
  return (
    (Number(plan.monthly_price_usd) || 0) === 0 && (Number(plan.yearly_price_usd) || 0) === 0
  );
}

export function getPlanDisplayPrice(
  plan: AdminSaasPlan,
  billingPeriod: "monthly" | "yearly",
  isPakistan: boolean
): number {
  if (isPakistan) {
    return billingPeriod === "yearly"
      ? Number(plan.yearly_price) || 0
      : Number(plan.monthly_price) || 0;
  }
  return billingPeriod === "yearly"
    ? Number(plan.yearly_price_usd) || 0
    : Number(plan.monthly_price_usd) || 0;
}

export function getYearlySavings(plan: AdminSaasPlan, isPakistan: boolean) {
  const monthly = isPakistan
    ? Number(plan.monthly_price) || 0
    : Number(plan.monthly_price_usd) || 0;
  const yearly = isPakistan
    ? Number(plan.yearly_price) || 0
    : Number(plan.yearly_price_usd) || 0;
  const fullYear = monthly * 12;
  const saved = Math.max(0, fullYear - yearly);
  const percent = fullYear > 0 ? Math.round((saved / fullYear) * 100) : 0;
  return { saved, percent };
}

export type BillingPlanCard = {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number;
  monthly_price_usd: number;
  yearly_price_usd: number;
  featureMatrix: PlanFeatureRow[];
  max_devices: string;
  featured: boolean;
  isZeroCost: boolean;
  yearlySavePercent: number;
};

export function mapPlansForBilling(
  remotePlans?: AdminSaasPlan[] | null,
  options?: { isPakistan?: boolean; billingPeriod?: "monthly" | "yearly" }
): BillingPlanCard[] {
  const source = mergeRemotePlansWithDefaults(remotePlans);
  const isPakistan = options?.isPakistan ?? true;

  return source
    .filter((p) => p?.id && typeof p.id === "string")
    .filter((p) => {
      if (isZeroCostPlan(p, isPakistan)) return true;
      return getPlanDisplayPrice(p, "monthly", isPakistan) > 0;
    })
    .map((p) => {
      const yearlySave = getYearlySavings(p, isPakistan);
      return {
        id: p.id,
        name: String(p.name || p.id),
        monthly_price: Number(p.monthly_price) || 0,
        yearly_price: Number(p.yearly_price) || 0,
        monthly_price_usd: Number(p.monthly_price_usd) || 0,
        yearly_price_usd: Number(p.yearly_price_usd) || 0,
        featureMatrix: getPlanFeatureMatrix(p),
        max_devices: String(p.max_devices || "1"),
        featured: p.id === "premium",
        isZeroCost: isZeroCostPlan(p, isPakistan),
        yearlySavePercent: yearlySave.percent,
      };
    })
    .sort((a, b) => {
      const orderA = PLAN_DISPLAY_ORDER[a.id] ?? 50 + a.monthly_price;
      const orderB = PLAN_DISPLAY_ORDER[b.id] ?? 50 + b.monthly_price;
      return orderA - orderB || a.monthly_price - b.monthly_price;
    });
}
