import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { normalizePlanId } from "@/lib/planMatrix";
import { buildPlanPriceMap } from "@/lib/billing/plan-prices";
import { mergeRemotePlansWithDefaults } from "@/lib/billing/plan-display";
import { notifySubscriptionActivated } from "@/lib/subscription/notify-subscription-email";
import crypto from "crypto";

/**
 * Payment gateway return URL.
 * Prefer verifying gateway signature when Safepay provides one.
 * Optional HMAC: set PAYMENT_CALLBACK_SECRET and pass sig=hmac(shop_id:tier:billing).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shop_id");
    const tierRaw = searchParams.get("tier");
    const billing = searchParams.get("billing") || "monthly";
    const sig = searchParams.get("sig");

    if (!shopId || !tierRaw) {
      return new NextResponse("Missing parameters", { status: 400 });
    }

    const tier = normalizePlanId(tierRaw);
    if (tier === "free") {
      return new NextResponse("Invalid tier", { status: 400 });
    }

    const secret = process.env.PAYMENT_CALLBACK_SECRET;
    if (!secret) {
      console.error("[pay/callback] Server misconfigured: PAYMENT_CALLBACK_SECRET is missing from environment variables.");
      return new NextResponse("Server misconfigured: PAYMENT_CALLBACK_SECRET missing", { status: 500 });
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${shopId}:${tier}:${billing}`)
      .digest("hex");

    if (!sig || sig !== expected) {
      console.error(`[pay/callback] Unauthorized request signature mismatch for shopId=${shopId}, tier=${tier}, billing=${billing}. Provided sig: ${sig || "none"}`);
      return new NextResponse("Invalid signature", { status: 403 });
    }


    const expiry = new Date();
    if (billing === "yearly") {
      expiry.setDate(expiry.getDate() + 365);
    } else {
      expiry.setDate(expiry.getDate() + 30);
    }

    const supabaseAdmin = createServiceSupabaseClient();
    const { error: updateError } = await supabaseAdmin
      .from("shops")
      .update({
        subscription_tier: tier,
        subscription_expires_at: expiry.toISOString(),
      })
      .eq("id", shopId);

    if (updateError) {
      console.error("Database update error:", updateError);
      return new NextResponse("Database update failed: " + updateError.message, { status: 500 });
    }

    // Try sending email notifications asynchronously
    try {
      const { data: shopInfo } = await supabaseAdmin
        .from("shops")
        .select("name, owner_id")
        .eq("id", shopId)
        .maybeSingle();

      if (shopInfo) {
        // Fetch owner email
        const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(shopInfo.owner_id || "");
        const ownerEmail = authUserData?.user?.email || "";

        // Build notification email content
        const adminSubject = `New Subscription Activated: ${shopInfo.name}`;
        const adminHtml = `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: auto; background: #0f172a; padding: 4px; border-radius: 24px;">
            <div style="background: #1e293b; padding: 24px; border-radius: 20px; color: #f8fafc;">
              <!-- Header -->
              <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #334155; padding-bottom: 20px;">
                <span style="background: #065f46; color: #34d399; padding: 6px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">Payment Confirmed</span>
                <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin: 12px 0 4px 0;">Subscription Activated! 🎉</h2>
                <p style="color: #94a3b8; font-size: 13px; margin: 0;">An online payment checkout via Safepay has successfully completed.</p>
              </div>

              <!-- Details Card -->
              <div style="background: #0f172a; border-radius: 16px; padding: 20px; margin-bottom: 24px;">
                <h3 style="color: #38bdf8; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0;">Transaction Summary</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #cbd5e1;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; text-align: left;">Business Name</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #f8fafc;">${shopInfo.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; text-align: left;">Plan Activated</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #f8fafc; text-transform: uppercase;">${tier}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; text-align: left;">Billing Cycle</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #f8fafc; text-transform: capitalize;">${billing}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; text-align: left;">Expiry Date</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #10b981;">${expiry.toLocaleDateString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; text-align: left;">Merchant Email</td>
                    <td style="padding: 8px 0; text-align: right; color: #e2e8f0;">${ownerEmail || "N/A"}</td>
                  </tr>
                </table>
              </div>

              <!-- Action Button -->
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="https://theaccounts.cloud/admin/subscriptions" style="display: inline-block; background: #10b981; color: #ffffff; padding: 14px 32px; border-radius: 12px; font-weight: 800; font-size: 13px; text-decoration: none; letter-spacing: 0.025em;">
                  Manage Platform Licenses
                </a>
              </div>

              <!-- Footnote -->
              <div style="text-align: center; border-top: 1px solid #334155; padding-top: 16px;">
                <p style="color: #64748b; font-size: 10px; margin: 0;">This is an automated activation confirmation sent by TheAccounts SaaS gateway controller.</p>
              </div>
            </div>
          </div>
        `;

        const { sendEmail } = await import("@/lib/email");
        // Notify admin & support
        await sendEmail("usman.dev.core@gmail.com", adminSubject, adminHtml);
        await sendEmail("support@theaccounts.cloud", adminSubject, adminHtml);

        // Notify customer — premium order receipt
        if (ownerEmail) {
          let amount = 0;
          const platformShopId = process.env.NEXT_PUBLIC_PLATFORM_SHOP_ID;
          if (platformShopId) {
            const { data: configRow } = await supabaseAdmin
              .from("company_details")
              .select("website")
              .eq("shop_id", platformShopId)
              .limit(1)
              .maybeSingle();
            if (configRow?.website?.startsWith("{")) {
              try {
                const config = JSON.parse(configRow.website);
                if (Array.isArray(config.saas_plans)) {
                  const prices = buildPlanPriceMap(mergeRemotePlansWithDefaults(config.saas_plans));
                  const monthly = prices[tier] || 0;
                  amount = billing === "yearly" ? monthly * 12 : monthly;
                }
              } catch {
                /* use 0 */
              }
            }
          }

          await notifySubscriptionActivated({
            shopId,
            shopName: shopInfo.name,
            planId: tier,
            expiryDate: expiry,
            amount,
            billingPeriod: billing,
            paymentMethod: "Safepay (Card / JazzCash / EasyPaisa)",
            orderId: `${shopId.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-6)}`,
          });
        }
      }
    } catch (emailErr) {
      console.error("Subscription notification email error:", emailErr);
    }

    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/dashboard?payment_success=true&tier=${tier}`);
  } catch (err: any) {
    return new NextResponse("Callback error: " + err.message, { status: 500 });
  }
}
