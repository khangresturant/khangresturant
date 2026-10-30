import { resolvePlan } from "@/lib/planMatrix";
import type { AdminSaasPlan } from "@/lib/billing/plan-display";

/** Map admin plan flags → shop-level module toggles. */
export function shopTogglesFromPlan(
  tier: string,
  remotePlans: AdminSaasPlan[] = []
): Record<string, boolean> {
  const plan = resolvePlan(tier, remotePlans);
  return {
    has_emi: !!plan.allow_emi,
    has_payroll: !!plan.allow_payroll,
    has_tax: !!plan.allow_tax,
    has_assets_rec: !!plan.allow_assets,
  };
}

export function getSubscriptionStatus(
  tier: string | null | undefined,
  expiresAt: string | null | undefined
): "active" | "expired" | "trial" | "none" {
  const id = tier || "free";
  if (!expiresAt) {
    return id === "free" ? "trial" : "none";
  }
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return "none";
  return exp > new Date() ? "active" : "expired";
}

export function addDaysToExpiry(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function extendSubscriptionExpiry(
  currentExpiry: string | null | undefined,
  days: number
): string {
  const now = new Date();
  const base =
    currentExpiry && new Date(currentExpiry) > now ? new Date(currentExpiry) : now;
  return addDaysToExpiry(base, days);
}
