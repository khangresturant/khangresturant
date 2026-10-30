import {
  mergeRemotePlansWithDefaults,
  type AdminSaasPlan,
} from "@/lib/billing/plan-display";
import { getPlanPrice } from "@/lib/planMatrix";

/** Monthly PKR prices keyed by plan id — from admin saas_plans config. */
export function buildPlanPriceMap(plans: AdminSaasPlan[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of mergeRemotePlansWithDefaults(plans)) {
    if (p.id) map[p.id] = Number(p.monthly_price) || 0;
  }
  return map;
}

export function getMonthlyPriceFromMap(
  planPrices: Record<string, number>,
  tier: string,
  remotePlans: AdminSaasPlan[] = []
): number {
  if (planPrices[tier] !== undefined) return planPrices[tier];
  return getPlanPrice(tier, "monthly", remotePlans);
}

export function getYearlyPriceFromMap(
  planPrices: Record<string, number>,
  tier: string,
  remotePlans: AdminSaasPlan[] = []
): number {
  const plan = mergeRemotePlansWithDefaults(remotePlans).find((p) => p.id === tier);
  if (plan?.yearly_price) return Number(plan.yearly_price);
  const monthly = getMonthlyPriceFromMap(planPrices, tier, remotePlans);
  return monthly * 10;
}
