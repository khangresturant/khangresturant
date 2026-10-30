import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { authorizeCronOrSuperAdmin } from "@/lib/auth/apiSecurity";

export async function GET(req: NextRequest) {
  return handleSubscriptionReminders(req);
}

export async function POST(req: NextRequest) {
  return handleSubscriptionReminders(req);
}

async function handleSubscriptionReminders(req: NextRequest) {
  const auth = await authorizeCronOrSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const timestamp = new Date().toISOString();
  const supabase = createServiceSupabaseClient();

  try {
    // 1. Fetch all active shops with non-free subscription tiers
    const { data: shops, error: shopsErr } = await supabase
      .from("shops")
      .select("id, name, subscription_tier, subscription_expires_at, phone")
      .neq("subscription_tier", "free")
      .not("subscription_expires_at", "is", null);

    if (shopsErr) throw shopsErr;

    // 2. Fetch user_profiles to resolve merchant email address for each shop
    const { data: profiles, error: profilesErr } = await supabase
      .from("user_profiles")
      .select("id, email, name, shop_id");

    if (profilesErr) throw profilesErr;

    const emailLogs: any[] = [];
    const now = new Date();

    for (const shop of shops || []) {
      if (!shop.subscription_expires_at) continue;

      const expiryDate = new Date(shop.subscription_expires_at);
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Find owner profile for this shop
      const ownerProfile = profiles?.find(p => p.shop_id === shop.id) || profiles?.[0];
      const merchantEmail = ownerProfile?.email || "support@theaccounts.cloud";
      const merchantName = ownerProfile?.name || shop.name;

      // Determine warning level (7 days, 3 days, 1 day, or expired)
      let subject = "";
      let titleNotice = "";
      let alertStyle = "warning";
      let daysText = "";

      if (diffDays === 7) {
        subject = `⚠️ Reminder: Your Subscription expires in 7 Days — The Accounts`;
        titleNotice = "7 Days Subscription Renewal Reminder";
        daysText = "7 days";
      } else if (diffDays === 3) {
        subject = `⏳ 3 Days Remaining: Renew Your Subscription — The Accounts`;
        titleNotice = "3 Days Subscription Renewal Notice";
        daysText = "3 days";
      } else if (diffDays === 1) {
        subject = `🚨 Action Required: 1 Day Left Before Account Lock — The Accounts`;
        titleNotice = "CRITICAL: 1 Day Left Before Subscription Expiry";
        daysText = "1 day (Tomorrow)";
        alertStyle = "danger";
      } else if (diffDays <= 0 && diffDays >= -2) {
        subject = `❌ Subscription Expired — Action Required — The Accounts`;
        titleNotice = "Your Subscription Tier Has Expired";
        daysText = "Expired";
        alertStyle = "danger";
      } else {
        // Skip if not matching trigger days
        continue;
      }

      // Generate VIP NO-LINK Email HTML Template (100% Inbox Deliverability)
      const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleNotice}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #ffffff; border: 2px solid #e0e7ff; border-radius: 28px; overflow: hidden; box-shadow: 0 20px 40px rgba(79, 70, 229, 0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%); height: 6px;"></td>
          </tr>
          <tr>
            <td style="padding: 40px 32px; text-align: center;">
              
              <!-- Brand Logo Emblem -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 20px auto;">
                <tr>
                  <td align="center">
                    <div style="width: 54px; height: 54px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 16px; text-align: center; line-height: 54px; box-shadow: 0 10px 25px rgba(79, 70, 229, 0.3);">
                      <span style="color: #ffffff; font-size: 26px; font-weight: 900; font-family: sans-serif;">A</span>
                    </div>
                  </td>
                </tr>
              </table>

              <h1 style="margin: 0 0 6px 0; color: #0f172a; font-size: 22px; font-weight: 800;">The Accounts</h1>
              <p style="margin: 0 0 24px 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">
                ${titleNotice}
              </p>

              <p style="margin: 0 0 20px 0; color: #334155; font-size: 14px; font-weight: 500; line-height: 1.6;">
                Hello <strong>${merchantName}</strong> (${shop.name}),
              </p>

              <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; font-weight: 500; line-height: 1.6;">
                Your <strong>${(shop.subscription_tier || "Standard").toUpperCase()} POS & Accounting License</strong> has <strong>${daysText}</strong> remaining (Expires on <strong>${expiryDate.toLocaleDateString()}</strong>).
              </p>

              <!-- Notice Box -->
              <div style="background-color: ${alertStyle === 'danger' ? '#fef2f2' : '#fffbeb'}; border: 1px solid ${alertStyle === 'danger' ? '#fecaca' : '#fde68a'}; border-radius: 20px; padding: 18px 20px; text-align: left; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; color: ${alertStyle === 'danger' ? '#991b1b' : '#92400e'}; font-size: 13px; font-weight: 800;">
                  📌 How to Renew Your Plan:
                </p>
                <p style="margin: 0; color: ${alertStyle === 'danger' ? '#7f1d1d' : '#78350f'}; font-size: 12px; font-weight: 500; line-height: 1.5;">
                  Log in to your shop dashboard at <strong>theaccounts.cloud/dashboard/billing</strong> and select your preferred payment gateway (JazzCash, EasyPaisa, or Bank Transfer) to extend your license instantly.
                </p>
              </div>

              <!-- Footer info (NO LINKS FOR MAXIMUM INBOX DELIVERABILITY) -->
              <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; text-align: center;">
                <p style="margin: 0 0 4px 0; color: #94a3b8; font-size: 11px; font-weight: 600;">
                  Sent automatically by The Accounts License Control System.
                </p>
                <p style="margin: 0; color: #cbd5e1; font-size: 10px; font-weight: 500;">
                  If you have already submitted your payment proof, please ignore this notice.
                </p>
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const res = await sendEmail(merchantEmail, subject, emailHtml);
      emailLogs.push({
        shopId: shop.id,
        shopName: shop.name,
        email: merchantEmail,
        daysRemaining: diffDays,
        status: res.success ? "sent" : "failed",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Subscription expiry scan complete. ${emailLogs.length} reminder emails dispatched.`,
      scannedShopsCount: shops?.length || 0,
      dispatchedCount: emailLogs.length,
      logs: emailLogs,
      timestamp,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message, timestamp },
      { status: 500 }
    );
  }
}
