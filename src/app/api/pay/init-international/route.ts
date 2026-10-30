import { NextResponse } from "next/server";
import { getPlanPrice, resolvePlan } from "@/lib/planMatrix";
import { getPlatformShopId } from "@/lib/config";
import crypto from "crypto";
import {
  requireApiUser,
  requireShopAccess,
  createServiceSupabaseClient,
} from "@/lib/auth/apiAuth";

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const { shopId, tier, price, billing, gateway } = await request.json();
    const billingCycle = billing === "yearly" ? "yearly" : "monthly";

    if (!shopId || !tier || !gateway) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const shopCheck = await requireShopAccess(auth.ctx, shopId);
    if (!shopCheck.ok) return shopCheck.response;

    const platformShopId = getPlatformShopId();
    if (!platformShopId) {
      return NextResponse.json(
        { error: "Server misconfigured: NEXT_PUBLIC_PLATFORM_SHOP_ID is not set" },
        { status: 503 }
      );
    }

    const supabaseAdmin = createServiceSupabaseClient();

    const { data: configRows } = await supabaseAdmin
      .from("company_details")
      .select("website")
      .eq("shop_id", platformShopId)
      .limit(1);

    const config = configRows?.[0];
    let stripeSecretKey = "";
    let stripeActive = false;
    let remotePlans: Array<Record<string, any>> = [];

    if (config?.website && config.website.startsWith("{")) {
      try {
        const parsed = JSON.parse(config.website);
        if (parsed.stripe_secret_key) stripeSecretKey = parsed.stripe_secret_key;
        if (parsed.stripe_active !== undefined) stripeActive = parsed.stripe_active;
        if (Array.isArray(parsed.saas_plans)) remotePlans = parsed.saas_plans;
      } catch (e) {}
    }

    if (gateway === "stripe") {
      if (!stripeSecretKey || !stripeActive) {
        return NextResponse.json(
          { error: "Stripe is not currently active or configured by administrator." },
          { status: 503 }
      );
      }

      // Find plan details
      const plan = remotePlans.find((p) => p.id === tier);
      const planPrice = billing === "yearly"
        ? (plan?.yearly_price_usd || price)
        : (plan?.monthly_price_usd || price);

      if (!planPrice || planPrice <= 0) {
        return NextResponse.json({ error: "Invalid plan or price for international checkout" }, { status: 400 });
      }

      const origin = new URL(request.url).origin;

      // Generate a secure callback signature
      const secret = process.env.PAYMENT_CALLBACK_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: "Server misconfigured: PAYMENT_CALLBACK_SECRET is not set" },
          { status: 503 }
        );
      }
      const sig = crypto
        .createHmac("sha256", secret)
        .update(`${shopId}:${tier}:${billing}`)
        .digest("hex");

      const successUrl = `${origin}/api/pay/callback?shop_id=${shopId}&tier=${tier}&billing=${billing}&sig=${sig}`;
      const cancelUrl = `${origin}/dashboard/billing`;

      const stripeParams = new URLSearchParams();
      stripeParams.append("success_url", successUrl);
      stripeParams.append("cancel_url", cancelUrl);
      stripeParams.append("mode", "payment");
      stripeParams.append("line_items[0][price_data][currency]", "usd");
      stripeParams.append("line_items[0][price_data][product_data][name]", `The Accounts - ${plan?.name || tier.toUpperCase()} Plan (${billing})`);
      stripeParams.append("line_items[0][price_data][unit_amount]", String(Math.round(planPrice * 100))); // cents
      stripeParams.append("line_items[0][quantity]", "1");

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: stripeParams.toString()
      });

      const stripeJson = await stripeRes.json();

      if (!stripeRes.ok || !stripeJson.url) {
        return NextResponse.json(
          { error: "Stripe checkout session initialization failed", details: stripeJson },
          { status: 500 }
        );
      }

      return NextResponse.json({ url: stripeJson.url });
    }

    return NextResponse.json({ error: "Unsupported international gateway" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
