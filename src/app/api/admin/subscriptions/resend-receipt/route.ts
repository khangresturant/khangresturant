import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/app/api/admin/shops/route";
import { notifySubscriptionActivated } from "@/lib/subscription/notify-subscription-email";

/** Resend subscription confirmation / invoice email to shop owner. */
export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { shopId } = await request.json();
    if (!shopId) {
      return NextResponse.json({ error: "shopId is required" }, { status: 400 });
    }

    const db = createServiceSupabaseClient();
    const { data: shop, error } = await db
      .from("shops")
      .select("id, name, subscription_tier, subscription_expires_at")
      .eq("id", shopId)
      .single();

    if (error || !shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const tier = shop.subscription_tier || "free";
    if (tier === "free" || !shop.subscription_expires_at) {
      return NextResponse.json(
        { error: "Shop has no active paid subscription to send a receipt for." },
        { status: 400 }
      );
    }

    const notify = await notifySubscriptionActivated({
      shopId: shop.id,
      shopName: shop.name,
      planId: tier,
      expiryDate: shop.subscription_expires_at,
      paymentMethod: "Admin Panel Activation",
    });

    if (!notify.sent) {
      return NextResponse.json(
        { error: notify.error || "Failed to send email", email: notify.email },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, email: notify.email });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to resend receipt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
