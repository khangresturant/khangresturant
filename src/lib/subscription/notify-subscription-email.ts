import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { buildPlanPriceMap } from "@/lib/billing/plan-prices";
import { mergeRemotePlansWithDefaults } from "@/lib/billing/plan-display";
import {
  formatPlanLabel,
  sendSubscriptionReceiptEmail,
} from "@/lib/email/subscription-receipt";

export type NotifySubscriptionActivatedInput = {
  shopId: string;
  shopName?: string;
  planId: string;
  expiryDate: Date | string;
  amount?: number;
  billingPeriod?: string;
  paymentMethod?: string;
  transactionRef?: string;
  orderId?: string;
  customerName?: string;
  creditsApplied?: number;
};

async function resolveOwnerEmail(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  shopId: string,
  ownerId: string | null | undefined
): Promise<{ email: string | null; name: string | null }> {
  if (ownerId) {
    const { data: authUser } = await supabase.auth.admin.getUserById(ownerId);
    if (authUser?.user?.email) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("name")
        .eq("id", ownerId)
        .maybeSingle();
      return { email: authUser.user.email, name: profile?.name || null };
    }
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, name, email")
    .eq("shop_id", shopId)
    .in("role", ["owner", "superadmin", "admin"])
    .limit(1)
    .maybeSingle();

  if (profile?.email) {
    return { email: profile.email, name: profile.name || null };
  }

  if (profile?.id) {
    const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
    if (authUser?.user?.email) {
      return { email: authUser.user.email, name: profile.name || null };
    }
  }

  return { email: null, name: null };
}

async function loadPlanPrice(planId: string): Promise<number> {
  const platformShopId = process.env.NEXT_PUBLIC_PLATFORM_SHOP_ID;
  if (!platformShopId) return 0;

  const supabase = createServiceSupabaseClient();
  const { data: configRow } = await supabase
    .from("company_details")
    .select("website")
    .eq("shop_id", platformShopId)
    .limit(1)
    .maybeSingle();

  if (!configRow?.website?.startsWith("{")) return 0;

  try {
    const config = JSON.parse(configRow.website);
    if (!Array.isArray(config.saas_plans)) return 0;
    const prices = buildPlanPriceMap(mergeRemotePlansWithDefaults(config.saas_plans));
    return prices[planId] || 0;
  } catch {
    return 0;
  }
}

/**
 * Send premium subscription receipt to shop owner after activation (admin, payment, Safepay).
 */
export async function notifySubscriptionActivated(
  input: NotifySubscriptionActivatedInput
): Promise<{ sent: boolean; email?: string; error?: string }> {
  try {
    const supabase = createServiceSupabaseClient();

    let shopName = input.shopName;
    let ownerId: string | null | undefined;

    if (!shopName) {
      const { data: shop } = await supabase
        .from("shops")
        .select("name, owner_id")
        .eq("id", input.shopId)
        .maybeSingle();
      shopName = shop?.name || "Your Business";
      ownerId = shop?.owner_id;
    } else {
      const { data: shop } = await supabase
        .from("shops")
        .select("owner_id")
        .eq("id", input.shopId)
        .maybeSingle();
      ownerId = shop?.owner_id;
    }

    const { email, name } = await resolveOwnerEmail(supabase, input.shopId, ownerId);
    if (!email) {
      console.error("[notifySubscriptionActivated] No owner email for shop", input.shopId);
      return { sent: false, error: "Owner email not found" };
    }

    const amount =
      input.amount !== undefined ? input.amount : await loadPlanPrice(input.planId);

    const result = await sendSubscriptionReceiptEmail(email, {
      customerName: input.customerName || name || undefined,
      shopName: shopName || "Your Business",
      planName: formatPlanLabel(input.planId),
      planId: input.planId,
      amount,
      creditsApplied: input.creditsApplied || 0,
      billingPeriod: input.billingPeriod || "monthly",
      paymentMethod: input.paymentMethod || "Admin Activation",
      transactionRef: input.transactionRef,
      orderId:
        input.orderId ||
        `ADM-${input.shopId.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      expiryDate: input.expiryDate,
      status: "confirmed",
    });

    if (!result.success) {
      console.error("[notifySubscriptionActivated] SMTP failed:", result.error);
      return { sent: false, email, error: result.error };
    }

    console.log(`[notifySubscriptionActivated] Receipt sent to ${email} for shop ${input.shopId}`);
    return { sent: true, email };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[notifySubscriptionActivated]", message);
    return { sent: false, error: message };
  }
}
