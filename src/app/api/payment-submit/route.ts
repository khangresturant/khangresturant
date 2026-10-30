import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import {
  requireApiUser,
  requireShopAccess,
  requireSuperAdmin,
} from "@/lib/auth/apiAuth";
import { sendEmail } from "@/lib/email";
import {
  formatPlanLabel,
  sendSubscriptionReceiptEmail,
} from "@/lib/email/subscription-receipt";
import { notifySubscriptionActivated } from "@/lib/subscription/notify-subscription-email";
import { buildPlanPriceMap } from "@/lib/billing/plan-prices";
import { mergeRemotePlansWithDefaults } from "@/lib/billing/plan-display";
import path from "path";
import fs from "fs";

const ADMIN_EMAIL = process.env.SMTP_USER || "contact@muhammadusman.me";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://theaccounts.cloud";
const SCREENSHOTS_DIR = path.join(process.cwd(), "public", "payment-screenshots");

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// POST: Submit a manual payment with screenshot
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const shopId = formData.get("shopId") as string;
    const planId = formData.get("planId") as string;
    const billingPeriod = formData.get("billingPeriod") as string;
    const amount = Number(formData.get("amount"));
    const gateway = formData.get("gateway") as string;
    const transactionRef = formData.get("transactionRef") as string;
    const screenshot = formData.get("screenshot") as File | null;
    const creditsApplied = Number(formData.get("creditsApplied") || 0);

    if (!shopId || !planId || !gateway || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const shopCheck = await requireShopAccess(auth.ctx, shopId);
    if (!shopCheck.ok) return shopCheck.response;

    const supabase = createServiceSupabaseClient();
    let screenshotUrl: string | null = null;

    // Save screenshot to VPS local filesystem (served as static file)
    if (screenshot && screenshot.size > 0) {
      if (screenshot.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Screenshot too large (max 5 MB)" }, { status: 400 });
      }
      const fileExt = screenshot.name.split(".").pop()?.toLowerCase() || "png";
      if (!["png", "jpg", "jpeg", "webp", "gif"].includes(fileExt)) {
        return NextResponse.json({ error: "Unsupported screenshot type" }, { status: 400 });
      }
      const fileName = `pay_${shopId.slice(0, 8)}_${Date.now()}.${fileExt}`;
      const filePath = path.join(SCREENSHOTS_DIR, fileName);
      const arrayBuffer = await screenshot.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);
      screenshotUrl = `${APP_URL}/payment-screenshots/${fileName}`;
    }

    // Get shop name and owner email for notification
    const { data: shopData } = await supabase
      .from("shops")
      .select("name, owner_id, referral_credits")
      .eq("id", shopId)
      .single();

    // Insert payment submission record
    const { data, error } = await supabase
      .from("payment_submissions")
      .insert({
        shop_id: shopId,
        plan_id: planId,
        billing_period: billingPeriod || "monthly",
        amount,
        gateway,
        transaction_ref: transactionRef || null,
        screenshot_url: screenshotUrl,
        status: "pending",
        credits_applied: creditsApplied,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const shopName = shopData?.name || shopId;
    const gatewayLabel = { jazzcash: "JazzCash", easypaisa: "EasyPaisa", bank: "Bank Transfer", safepay: "Safepay" }[gateway] || gateway;

    // Email Admin — new payment notification (amount from submission = admin plan price at checkout)
    const totalCost = Number(amount) || 0;
    const currentCredits = Number(shopData?.referral_credits || 0);
    const creditsRemaining = Math.max(0, currentCredits - creditsApplied);

    const adminHtml = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: auto; background: #0f172a; padding: 4px; border-radius: 24px;">
        <div style="background: #1e293b; padding: 24px; border-radius: 20px; color: #f8fafc;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #334155; padding-bottom: 20px;">
            <span style="background: #312e81; color: #a5b4fc; padding: 6px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">New Manual Payment</span>
            <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin: 12px 0 4px 0;">Subscription Requested</h2>
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">A merchant has submitted a manual payment receipt for approval.</p>
          </div>

          <!-- Details Card -->
          <div style="background: #0f172a; border-radius: 16px; padding: 20px; margin-bottom: 24px;">
            <h3 style="color: #38bdf8; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0;">Transaction Summary</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #cbd5e1;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600; text-align: left;">Business Name</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #f8fafc;">${shopName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600; text-align: left;">Plan Requested</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #f8fafc; text-transform: capitalize;">${planId} (${billingPeriod})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600; text-align: left;">Gateway</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #f8fafc;">${gatewayLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600; text-align: left;">Transaction Ref</td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; color: #e2e8f0;">${transactionRef || "—"}</td>
              </tr>
            </table>

            <div style="border-top: 1px solid #334155; margin: 16px 0; padding-top: 16px;"></div>

            <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #cbd5e1;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 600; text-align: left;">Original Price</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #f8fafc;">Rs ${totalCost.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #f43f5e; font-weight: 600; text-align: left;">Referral Credits Applied</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #f43f5e;">- Rs ${creditsApplied.toLocaleString()}</td>
              </tr>
              <tr style="font-size: 15px;">
                <td style="padding: 12px 0 0 0; color: #10b981; font-weight: 800; text-align: left;">Net Amount Payable</td>
                <td style="padding: 12px 0 0 0; text-align: right; font-weight: 900; color: #10b981;">Rs ${amount.toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <!-- Referral Wallet Status -->
          <div style="background: #1e1b4b; border: 1px solid #312e81; border-radius: 16px; padding: 16px 20px; margin-bottom: 24px;">
            <h3 style="color: #818cf8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0;">Referral Balance Ledger</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #a5b4fc;">
              <tr>
                <td style="padding: 4px 0; text-align: left;">Credits Applied This Order</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 700;">Rs ${creditsApplied.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; text-align: left;">Wallet Balance Remaining</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 700;">Rs ${creditsRemaining.toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <!-- Action Button -->
          <div style="text-align: center; margin-bottom: 20px;">
            <a href="${APP_URL}/admin/subscriptions" style="display: inline-block; background: #3b82f6; color: #ffffff; padding: 14px 32px; border-radius: 12px; font-weight: 800; font-size: 13px; text-decoration: none; letter-spacing: 0.025em;">
              Review & Approve Payment
            </a>
          </div>

          <!-- Footnote -->
          <div style="text-align: center; border-top: 1px solid #334155; padding-top: 16px;">
            ${screenshotUrl ? `<p style="margin: 0 0 12px 0; font-size: 12px;"><a href="${screenshotUrl}" style="color: #38bdf8; text-decoration: none; font-weight: 600;">View Uploaded Screenshot Receipt →</a></p>` : ""}
            <p style="color: #64748b; font-size: 10px; margin: 0;">This is an automated request sent by TheAccounts SaaS licensing manager.</p>
          </div>
        </div>
      </div>
    `;

    const adminEmails = [ADMIN_EMAIL, "usman.dev.core@gmail.com"];
    for (const email of adminEmails) {
      await sendEmail(email, `💰 New Payment Submitted — ${shopName}`, adminHtml);
    }

    // Get owner email for user confirmation
    if (shopData?.owner_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(shopData.owner_id);
      const userEmail = authUser?.user?.email;
      if (userEmail) {
        await sendSubscriptionReceiptEmail(userEmail, {
          shopName,
          planName: formatPlanLabel(planId),
          planId,
          amount,
          creditsApplied,
          billingPeriod: billingPeriod || "monthly",
          paymentMethod: gatewayLabel,
          transactionRef: transactionRef || undefined,
          orderId: data?.id?.slice(0, 8).toUpperCase() || `ORD-${Date.now().toString().slice(-8)}`,
          expiryDate: new Date(),
          status: "pending",
        });
      }
    }

    return NextResponse.json({ success: true, submission: data });
  } catch (err: any) {
    console.error("Payment submit error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: Get submissions for a shop (user) or all (admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId");
    const adminMode = searchParams.get("admin") === "1";

    if (adminMode) {
      const admin = await requireSuperAdmin();
      if (!admin.ok) return admin.response;
    } else {
      const auth = await requireApiUser();
      if (!auth.ok) return auth.response;
      if (!shopId) {
        return NextResponse.json({ error: "shopId is required" }, { status: 400 });
      }
      const shopCheck = await requireShopAccess(auth.ctx, shopId);
      if (!shopCheck.ok) return shopCheck.response;
    }

    const supabase = createServiceSupabaseClient();
    let query = supabase
      .from("payment_submissions")
      .select("*, shops(name)")
      .order("submitted_at", { ascending: false });

    if (!adminMode && shopId) {
      query = query.eq("shop_id", shopId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ submissions: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Admin approves or rejects a submission
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    if (!admin.ok) return admin.response;

    const { submissionId, action, adminNote, months } = await request.json();

    if (!submissionId || !action) {
      return NextResponse.json({ error: "Missing submissionId or action" }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient();

    // Get submission + shop details
    const { data: submission, error: fetchErr } = await supabase
      .from("payment_submissions")
      .select("*, shops(name, owner_id, referred_by_shop_id)")
      .eq("id", submissionId)
      .single();

    if (fetchErr || !submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Update submission status
    await supabase
      .from("payment_submissions")
      .update({
        status: action === "approve" ? "approved" : "rejected",
        admin_note: adminNote || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    const shopName = submission.shops?.name || "Your Business";
    const gatewayLabel = { jazzcash: "JazzCash", easypaisa: "EasyPaisa", bank: "Bank Transfer", safepay: "Safepay" }[submission.gateway as string] || submission.gateway;
    let finalExpiry: Date | null = null;

    // If approved → activate shop plan with PRORATION support
    if (action === "approve") {
      const monthsToAdd = months || (submission.billing_period === "yearly" ? 12 : 1);

      // Get current shop subscription state
      const { data: shopData } = await supabase
        .from("shops")
        .select("subscription_tier, subscription_expires_at")
        .eq("id", submission.shop_id)
        .single();

      const currentTier = shopData?.subscription_tier || "free";
      const newTier = submission.plan_id;
      const currentExpiry = shopData?.subscription_expires_at
        ? new Date(shopData.subscription_expires_at)
        : null;
      const now = new Date();
      const isCurrentlyActive = currentExpiry && currentExpiry > now;

      // --- Load plan prices from platform config ---
      const platformShopId = process.env.NEXT_PUBLIC_PLATFORM_SHOP_ID;
      let planPrices: Record<string, number> = buildPlanPriceMap([]);

      if (platformShopId) {
        const { data: configRow } = await supabase
          .from("company_details")
          .select("website")
          .eq("shop_id", platformShopId)
          .limit(1)
          .maybeSingle();

        if (configRow?.website?.startsWith("{")) {
          try {
            const config = JSON.parse(configRow.website);
            if (Array.isArray(config.saas_plans)) {
              planPrices = buildPlanPriceMap(mergeRemotePlansWithDefaults(config.saas_plans));
            }
          } catch {
            /* use defaults */
          }
        }
      }

      let computedExpiry: Date;

      if (isCurrentlyActive && currentTier !== "free" && currentTier !== newTier) {
        // ── PLAN CHANGE with remaining time → apply PRORATION ──
        const remainingMs = currentExpiry!.getTime() - now.getTime();
        const remainingDays = remainingMs / (1000 * 60 * 60 * 24);

        const oldDailyRate = (planPrices[currentTier] || 0) / 30;
        const newDailyRate = (planPrices[newTier] || 0) / 30;

        // Convert remaining credit to days on new plan
        const remainingCredit = remainingDays * oldDailyRate;
        const creditDaysOnNewPlan = newDailyRate > 0 ? remainingCredit / newDailyRate : 0;

        // Total days = prorated credit + newly paid months
        const totalDays = Math.round(creditDaysOnNewPlan) + (monthsToAdd * 30);

        computedExpiry = new Date(now);
        computedExpiry.setDate(computedExpiry.getDate() + totalDays);

        console.log(`[Proration] ${currentTier}→${newTier}: ${remainingDays.toFixed(1)} days credit → ${creditDaysOnNewPlan.toFixed(1)} days on new plan + ${monthsToAdd*30} paid days = ${totalDays} total days`);
      } else if (isCurrentlyActive && currentTier === newTier) {
        // ── SAME PLAN RENEWAL → extend from current expiry ──
        computedExpiry = new Date(currentExpiry!);
        computedExpiry.setMonth(computedExpiry.getMonth() + monthsToAdd);
      } else {
        // ── NEW / EXPIRED subscription → start fresh from today ──
        computedExpiry = new Date(now);
        computedExpiry.setMonth(computedExpiry.getMonth() + monthsToAdd);
      }

      finalExpiry = computedExpiry;

      await supabase
        .from("shops")
        .update({
          subscription_tier: newTier,
          subscription_expires_at: computedExpiry.toISOString(),
        })
        .eq("id", submission.shop_id);

      // ── CREDITS USAGE DEDUCTION ──
      const creditsApplied = Number(submission.credits_applied || 0);
      if (creditsApplied > 0) {
        const { data: activeShop } = await supabase
          .from("shops")
          .select("referral_credits")
          .eq("id", submission.shop_id)
          .single();

        const currentCredits = Number(activeShop?.referral_credits || 0);
        const newCredits = Math.max(0, currentCredits - creditsApplied);

        await supabase
          .from("shops")
          .update({ referral_credits: newCredits })
          .eq("id", submission.shop_id);

        await supabase
          .from("referral_transactions")
          .insert({
            shop_id: submission.shop_id,
            type: "usage",
            amount: creditsApplied,
            description: `Applied Rs ${creditsApplied} credits as a discount for subscription renewal (${submission.plan_id})`
          });
      }

      // ── REFERRAL REWARD PAYOUT ──
      const referrerId = submission.shops?.referred_by_shop_id;
      if (referrerId) {
        const { data: alreadyRewarded } = await supabase
          .from("referral_transactions")
          .select("id")
          .eq("shop_id", referrerId)
          .eq("referred_shop_id", submission.shop_id)
          .eq("type", "reward")
          .eq("description", `Referral reward for payment approval: ${submission.id}`)
          .maybeSingle();

        if (!alreadyRewarded) {
          const rewardAmount = submission.plan_id === "premium" ? 80 : 50;

          const { data: referrerShop } = await supabase
            .from("shops")
            .select("referral_credits")
            .eq("id", referrerId)
            .single();

          if (referrerShop) {
            const updatedReferrerCredits = Number(referrerShop.referral_credits || 0) + rewardAmount;

            await supabase
              .from("shops")
              .update({ referral_credits: updatedReferrerCredits })
              .eq("id", referrerId);

            await supabase
              .from("referral_transactions")
              .insert({
                shop_id: referrerId,
                referred_shop_id: submission.shop_id,
                type: "reward",
                amount: rewardAmount,
                description: `Referral reward for payment approval: ${submission.id}`
              });
          }
        }
      }
    }

    // Email user and admin about approval/rejection
    if (submission.shops?.owner_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(submission.shops.owner_id);
      const userEmail = authUser?.user?.email;
      if (userEmail) {
        const isApproved = action === "approve";
        if (isApproved && finalExpiry) {
          const notify = await notifySubscriptionActivated({
            shopId: submission.shop_id,
            shopName,
            planId: submission.plan_id,
            expiryDate: finalExpiry,
            amount: Number(submission.amount || 0),
            creditsApplied: Number(submission.credits_applied || 0),
            billingPeriod: submission.billing_period || "monthly",
            paymentMethod: gatewayLabel,
            transactionRef: submission.transaction_ref || undefined,
            orderId: submission.id.slice(0, 8).toUpperCase(),
          });
          if (!notify.sent) {
            console.error("[payment-submit] Approval email failed:", notify.error);
          }
        } else if (!isApproved) {
          const emailSubject = `❌ Payment Not Approved`;
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #f8fafc; padding: 32px; border-radius: 16px;">
              <h2 style="color: #dc2626;">❌ Payment Not Approved</h2>
              <p style="color: #64748b; font-size: 14px;">
                Unfortunately, your payment submission for <strong>${shopName}</strong> was not approved.
              </p>
              ${adminNote ? `<p style="color:#64748b;font-size:13px;"><strong>Note:</strong> ${adminNote}</p>` : ""}
              <p style="color:#64748b;font-size:13px;">Please contact support or try submitting your payment again with the correct details.</p>
              <p style="color: #94a3b8; font-size: 11px; margin-top: 24px;">The Accounts SaaS Platform</p>
            </div>
          `;
          await sendEmail(userEmail, emailSubject, emailHtml);
        }

        const adminNotifyEmail = process.env.SMTP_USER || "usman.dev.core@gmail.com";
        if (isApproved && adminNotifyEmail !== userEmail) {
          await sendEmail(
            adminNotifyEmail,
            `🎉 Payment Approved — ${shopName}`,
            `<p style="font-family:sans-serif;">Payment approved for <strong>${shopName}</strong> — ${submission.plan_id} plan activated.</p>`
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
