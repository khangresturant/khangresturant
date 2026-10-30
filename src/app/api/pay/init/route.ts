import { NextResponse } from "next/server";
import { getPlanPrice, resolvePlan } from "@/lib/planMatrix";
import { getPlatformShopId } from "@/lib/config";
import {
  requireApiUser,
  requireShopAccess,
  createServiceSupabaseClient,
} from "@/lib/auth/apiAuth";

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const { shopId, tier, price, billing } = await request.json();
    const billingCycle = billing === "yearly" ? "yearly" : "monthly";

    if (!shopId || !tier) {
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
    let safepayApiKey = "";
    let isSandbox = true;
    let remotePlans: Array<Record<string, unknown>> = [];

    if (config?.website && config.website.startsWith("{")) {
      try {
        const parsed = JSON.parse(config.website);
        if (parsed.safepay_api_key) safepayApiKey = parsed.safepay_api_key;
        if (parsed.safepay_sandbox !== undefined) isSandbox = parsed.safepay_sandbox;
        if (Array.isArray(parsed.saas_plans)) remotePlans = parsed.saas_plans;
      } catch (e) {}
    }

    if (!safepayApiKey) {
      return NextResponse.json(
        { error: "Safepay is not configured. Set safepay_api_key in platform gateway settings." },
        { status: 503 }
      );
    }

    // Never trust client price — resolve from plan matrix / remote config
    const serverPrice = getPlanPrice(String(tier), billingCycle, remotePlans);
    if (!serverPrice || serverPrice <= 0) {
      return NextResponse.json({ error: "Invalid plan or price" }, { status: 400 });
    }

    if (price != null && Number(price) !== serverPrice) {
      console.warn(
        `[pay/init] Client price ${price} ignored; charging server price ${serverPrice} for tier=${tier}`
      );
    }

    const host = isSandbox ? "sandbox.api.getsafepay.com" : "api.getsafepay.com";

    const response = await fetch(`https://${host}/order/v1/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: safepayApiKey,
        amount: Number(serverPrice),
        currency: "PKR",
        environment: isSandbox ? "sandbox" : "production",
      }),
    });

    const result = await response.json();

    if (!response.ok || !result?.data?.token) {
      return NextResponse.json(
        { error: "Safepay session initialization failed", details: result },
        { status: 500 }
      );
    }

    return NextResponse.json({
      token: result.data.token,
      client: safepayApiKey,
      sandbox: isSandbox,
      amount: serverPrice,
      tier,
      plan: resolvePlan(String(tier), remotePlans).name,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
