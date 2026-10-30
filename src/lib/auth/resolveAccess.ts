/**
 * Shared access resolver: plan × shop toggles × staff permissions.
 * Use on client (Sidebar, page gates) and server (API / future RPC guards).
 */

import {
  type PlanFeatures,
  getEffectiveTierId,
  isPathAllowedForPlan,
  resolvePlan,
} from "@/lib/planMatrix";
import { isSuperAdmin } from "@/lib/auth/roles";

export type PanelKey =
  | "dashboard"
  | "pos"
  | "sales"
  | "registers"
  | "purchase"
  | "products"
  | "categories"
  | "brands"
  | "units"
  | "khata"
  | "returns"
  | "expenses"
  | "accounts"
  | "reports"
  | "staff"
  | "backup";

export type ActionKey =
  | "edit_bill"
  | "delete_bill"
  | "edit_account"
  | "delete_account";

export type StaffPermissions = {
  panels?: Partial<Record<PanelKey, boolean>> & Record<string, boolean | undefined>;
  actions?: Partial<Record<ActionKey, boolean>> & Record<string, boolean | undefined>;
  max_discount_percentage?: number;
};

export type ShopAccessInput = {
  role?: string | null;
  email?: string | null;
  subscriptionTier?: string | null;
  subscriptionExpiresAt?: string | null;
  /** Remote SaaS plan rows from platform config */
  remotePlans?: Array<Record<string, unknown>>;
  /** Staff JSON from user_profiles.permissions */
  permissions?: StaffPermissions | null;
  /** Shop-level ERP toggles */
  shopToggles?: {
    has_emi?: boolean | null;
    has_payroll?: boolean | null;
    has_tax?: boolean | null;
    has_assets_rec?: boolean | null;
    has_loyalty?: boolean | null;
    has_gift_cards?: boolean | null;
    has_ecommerce?: boolean | null;
    allow_negative_stock?: boolean | null;
  };
};

export type ResolvedAccess = {
  isSuperAdmin: boolean;
  effectiveTier: string;
  plan: PlanFeatures;
  panels: Record<string, boolean>;
  actions: Record<string, boolean>;
  maxDiscountPercentage: number;
  hasEmi: boolean;
  hasPayroll: boolean;
  hasTax: boolean;
  hasAssetsRec: boolean;
  hasLoyalty: boolean;
  hasGiftCards: boolean;
  hasEcommerce: boolean;
  allowNegativeStock: boolean;
  allowAccounts: boolean;
  allowReports: boolean;
  allowExpenses: boolean;
  allowIndustrialAccounts: boolean;
  allowBackup: boolean;
  allowBarcode: boolean;
  allowMultiShop: boolean;
  allowUniversalImport: boolean;
  allowAiProductAdd: boolean;
  allowAiPurchaseOrder: boolean;
  allowWhatsapp: boolean;
  maxDevices: string;
};

const DEFAULT_PANELS: Record<string, boolean> = {
  dashboard: true,
  pos: true,
  sales: true,
  registers: true,
  purchase: true,
  products: true,
  categories: true,
  brands: true,
  units: true,
  khata: true,
  returns: true,
  expenses: true,
  accounts: true,
  reports: true,
  staff: false,
  backup: false,
};

const DEFAULT_ACTIONS: Record<string, boolean> = {
  edit_bill: false,
  delete_bill: false,
  edit_account: false,
  delete_account: false,
};

const SUPERADMIN_PANELS: Record<string, boolean> = {
  ...DEFAULT_PANELS,
  staff: true,
  backup: true,
};

const SUPERADMIN_ACTIONS: Record<string, boolean> = {
  edit_bill: true,
  delete_bill: true,
  edit_account: true,
  delete_account: true,
};

/**
 * Resolve full access for a user in a shop context.
 */
export function resolveAccess(input: ShopAccessInput): ResolvedAccess {
  const superAdmin = isSuperAdmin({ role: input.role, email: input.email });
  const effectiveTier = getEffectiveTierId(
    input.subscriptionTier,
    input.subscriptionExpiresAt
  );
  const plan = resolvePlan(effectiveTier, input.remotePlans || []);
  const toggles = input.shopToggles || {};

  const resolvedHasLoyalty = toggles.has_loyalty !== false;
  const resolvedHasGiftCards = toggles.has_gift_cards !== false;
  const resolvedHasEcommerce = !!toggles.has_ecommerce;
  const resolvedHasPayroll = !!toggles.has_payroll;
  const resolvedHasTax = !!toggles.has_tax;
  const resolvedHasAssetsRec = !!toggles.has_assets_rec;
  const resolvedHasEmi = !!toggles.has_emi;
  const resolvedAllowNegativeStock = !!toggles.allow_negative_stock;

  if (superAdmin) {
    return {
      isSuperAdmin: true,
      effectiveTier,
      plan,
      panels: { ...SUPERADMIN_PANELS },
      actions: { ...SUPERADMIN_ACTIONS },
      maxDiscountPercentage: 100,
      hasEmi: resolvedHasEmi,
      hasPayroll: resolvedHasPayroll,
      hasTax: resolvedHasTax,
      hasAssetsRec: resolvedHasAssetsRec,
      hasLoyalty: resolvedHasLoyalty,
      hasGiftCards: resolvedHasGiftCards,
      hasEcommerce: resolvedHasEcommerce,
      allowNegativeStock: resolvedAllowNegativeStock,
      allowAccounts: true,
      allowReports: true,
      allowExpenses: true,
      allowIndustrialAccounts: true,
      allowBackup: true,
      allowBarcode: true,
      allowMultiShop: true,
      allowUniversalImport: true,
      allowAiProductAdd: true,
      allowAiPurchaseOrder: true,
      allowWhatsapp: true,
      maxDevices: "unlimited",
    };
  }

  const staffPanels = input.permissions?.panels || {};
  const panels: Record<string, boolean> = {
    ...DEFAULT_PANELS,
  };
  for (const [k, v] of Object.entries(staffPanels)) {
    if (typeof v === "boolean") panels[k] = v;
  }
  panels.backup = !!plan.allow_backup && staffPanels.backup !== false;
  panels.staff =
    (!!plan.allow_staff || !!plan.allow_payroll) && staffPanels.staff !== false;
  panels.accounts = !!plan.allow_accounts && staffPanels.accounts !== false;
  panels.expenses = !!plan.allow_expenses && staffPanels.expenses !== false;
  panels.reports = !!plan.allow_reports && staffPanels.reports !== false;

  const actions: Record<string, boolean> = { ...DEFAULT_ACTIONS };
  const staffActions = input.permissions?.actions || {};
  for (const [k, v] of Object.entries(staffActions)) {
    if (typeof v === "boolean") actions[k] = v;
  }

  return {
    isSuperAdmin: false,
    effectiveTier,
    plan,
    panels,
    actions,
    maxDiscountPercentage: input.permissions?.max_discount_percentage ?? 100,
    hasEmi: resolvedHasEmi && (effectiveTier !== "free" && !!plan.allow_emi),
    hasPayroll: resolvedHasPayroll && (!!plan.allow_payroll || !!plan.allow_staff),
    hasTax: resolvedHasTax && !!plan.allow_tax,
    hasAssetsRec: resolvedHasAssetsRec && !!plan.allow_assets,
    hasLoyalty: resolvedHasLoyalty,
    hasGiftCards: resolvedHasGiftCards,
    hasEcommerce: resolvedHasEcommerce,
    allowNegativeStock: resolvedAllowNegativeStock,
    allowAccounts: !!plan.allow_accounts,
    allowReports: !!plan.allow_reports,
    allowExpenses: !!plan.allow_expenses,
    allowIndustrialAccounts: !!plan.allow_industrial_accounts,
    allowBackup: !!plan.allow_backup,
    allowBarcode: !!plan.allow_barcode,
    allowMultiShop: !!plan.allow_multi_shop,
    allowUniversalImport: !!plan.allow_universal_import,
    allowAiProductAdd: !!plan.allow_ai_product_add,
    allowAiPurchaseOrder: !!plan.allow_ai_purchase_order,
    allowWhatsapp: !!plan.allow_whatsapp,
    maxDevices: String(plan.max_devices || "1"),
  };
}

export function canAccessPanel(access: ResolvedAccess, panel: string): boolean {
  if (access.isSuperAdmin) return true;
  return access.panels[panel] === true;
}

export function canPerformAction(access: ResolvedAccess, action: string): boolean {
  if (access.isSuperAdmin) return true;
  return access.actions[action] === true;
}

export function canAccessPath(access: ResolvedAccess, path: string): boolean {
  if (access.isSuperAdmin) return true;
  if (!isPathAllowedForPlan(path, access.plan)) return false;
  // Map common paths to panels
  if (path.startsWith("/dashboard/pos") && !canAccessPanel(access, "pos")) return false;
  if (path.startsWith("/dashboard/sales") && !canAccessPanel(access, "sales")) return false;
  if (path.startsWith("/dashboard/purchase") && !canAccessPanel(access, "purchase")) return false;
  if (path.startsWith("/dashboard/products") && !canAccessPanel(access, "products")) return false;
  if (path.startsWith("/dashboard/khata") && !canAccessPanel(access, "khata")) return false;
  if (path.startsWith("/dashboard/accounts") && !canAccessPanel(access, "accounts")) return false;
  if (path.startsWith("/dashboard/expenses") && !canAccessPanel(access, "expenses")) return false;
  if (path.startsWith("/dashboard/reports") && !canAccessPanel(access, "reports")) return false;
  if (path.startsWith("/dashboard/staff") && !canAccessPanel(access, "staff")) return false;
  if (path.startsWith("/dashboard/backup") && !canAccessPanel(access, "backup")) return false;
  return true;
}
