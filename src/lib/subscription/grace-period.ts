import {
  SUBSCRIPTION_GRACE_DAYS,
  getEffectiveTierId,
  type PlanId,
} from "@/lib/planMatrix";

export { SUBSCRIPTION_GRACE_DAYS };

export type SubscriptionLifecycle = "active" | "grace" | "locked" | "no_expiry";

const BILLING_PATH_PREFIX = "/dashboard/billing";

export function getSubscriptionLifecycle(
  subscriptionTier: string | null | undefined,
  subscriptionExpiresAt: string | null | undefined,
  now: Date = new Date()
): SubscriptionLifecycle {
  if (!subscriptionExpiresAt) {
    return "no_expiry";
  }

  const expires = new Date(subscriptionExpiresAt);
  if (Number.isNaN(expires.getTime())) {
    return "no_expiry";
  }

  if (expires.getTime() > now.getTime()) {
    return "active";
  }

  const graceEnds = new Date(expires);
  graceEnds.setDate(graceEnds.getDate() + SUBSCRIPTION_GRACE_DAYS);

  if (now.getTime() <= graceEnds.getTime()) {
    return "grace";
  }

  return "locked";
}

export function isSubscriptionLocked(
  subscriptionTier: string | null | undefined,
  subscriptionExpiresAt: string | null | undefined,
  now?: Date
): boolean {
  return getSubscriptionLifecycle(subscriptionTier, subscriptionExpiresAt, now) === "locked";
}

export function getGraceDaysRemaining(
  subscriptionExpiresAt: string | null | undefined,
  now: Date = new Date()
): number {
  if (!subscriptionExpiresAt) return 0;
  const expires = new Date(subscriptionExpiresAt);
  if (Number.isNaN(expires.getTime()) || expires.getTime() > now.getTime()) return 0;

  const graceEnds = new Date(expires);
  graceEnds.setDate(graceEnds.getDate() + SUBSCRIPTION_GRACE_DAYS);
  const ms = graceEnds.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function getEffectiveTierWithGrace(
  subscriptionTier: string | null | undefined,
  subscriptionExpiresAt: string | null | undefined,
  now: Date = new Date()
): PlanId {
  return getEffectiveTierId(subscriptionTier, subscriptionExpiresAt, now);
}

export function isPathAllowedWhenLocked(pathname: string): boolean {
  return pathname === BILLING_PATH_PREFIX || pathname.startsWith(`${BILLING_PATH_PREFIX}/`);
}

export function isDashboardPathBlockedBySubscriptionLock(
  pathname: string,
  subscriptionTier: string | null | undefined,
  subscriptionExpiresAt: string | null | undefined,
  isPlatformSuperAdmin = false
): boolean {
  if (isPlatformSuperAdmin) return false;
  if (!isSubscriptionLocked(subscriptionTier, subscriptionExpiresAt)) return false;
  return !isPathAllowedWhenLocked(pathname);
}
