import { sendEmail } from "@/lib/email";
import { getPublicAppUrl } from "@/lib/app-url";

const APP_URL = getPublicAppUrl();
const SUPPORT_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || "admin@local.cafe";

export type SubscriptionReceiptEmailData = {
  customerName?: string;
  shopName: string;
  planName: string;
  planId: string;
  amount: number;
  creditsApplied?: number;
  currency?: string;
  billingPeriod: string;
  paymentMethod: string;
  transactionRef?: string;
  orderId: string;
  expiryDate: Date | string;
  status?: "confirmed" | "pending";
};

function formatMoney(amount: number, currency = "PKR") {
  const formatted = Number(amount || 0).toLocaleString("en-PK");
  return currency === "PKR" ? `Rs ${formatted}` : `${currency} ${formatted}`;
}

function formatPlanLabel(planId: string) {
  const labels: Record<string, string> = {
    free: "Zero Plan",
    starter: "Starter Plan",
    premium: "Premium Plan",
  };
  return labels[planId] || planId.charAt(0).toUpperCase() + planId.slice(1);
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatBillingPeriod(period: string) {
  return period === "yearly" ? "Yearly" : "Monthly";
}

function receiptRow(label: string, value: string, valueColor = "#0f172a") {
  return `
    <tr>
      <td style="padding: 10px 0; color: #64748b; font-size: 13px; font-weight: 600; width: 42%;">${label}</td>
      <td style="padding: 10px 0; color: ${valueColor}; font-size: 13px; font-weight: 800; text-align: right;">${value}</td>
    </tr>`;
}

/**
 * Premium colorful order receipt - use for Safepay onboarding sample & customer notifications.
 */
export function generateSubscriptionReceiptEmailHtml(data: SubscriptionReceiptEmailData) {
  const isPending = data.status === "pending";
  const currency = data.currency || "PKR";
  const planTitle = data.planName || formatPlanLabel(data.planId);
  const greeting = data.customerName ? `Hi ${data.customerName},` : "Hi there,";
  const creditsApplied = Number(data.creditsApplied || 0);
  const orderDate = formatDate(new Date());
  const validUntil = formatDate(data.expiryDate);
  const billingLabel = formatBillingPeriod(data.billingPeriod);
  const statusLabel = isPending ? "Payment Received" : "Order Confirmed";
  const statusColor = isPending ? "#b45309" : "#047857";
  const statusBg = isPending ? "#fef3c7" : "#d1fae5";
  const heroSubtitle = isPending
    ? "We received your subscription payment. Your plan will activate shortly after verification."
    : "Your subscription payment was successful. Your plan is now active and ready to use.";
  const heroEmoji = isPending ? "⏳" : "🎉";
  const amountPaid = formatMoney(data.amount, currency);
  const creditsLine =
    creditsApplied > 0
      ? receiptRow("Referral Credits", `- ${formatMoney(creditsApplied, currency)}`, "#dc2626")
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusLabel} - The Accounts</title>
</head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#eef2ff 0%,#f8fafc 45%,#fdf2f8 100%);padding:36px 16px;">
    <tr>
      <td align="center">

        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 24px 60px rgba(79,70,229,0.18);border:1px solid #e0e7ff;">
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 45%,#db2777 100%);padding:34px 28px;text-align:center;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 16px auto;">
                <tr>
                  <td style="width:58px;height:58px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.28);border-radius:18px;text-align:center;line-height:58px;">
                    <span style="color:#ffffff;font-size:28px;font-weight:900;">A</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px 0;color:rgba(255,255,255,0.82);font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">The Accounts</p>
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:900;line-height:1.2;">${heroEmoji} ${statusLabel}</h1>
              <p style="margin:12px 0 0 0;color:rgba(255,255,255,0.88);font-size:14px;line-height:1.6;max-width:460px;display:inline-block;">${heroSubtitle}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <p style="margin:0 0 8px 0;color:#0f172a;font-size:16px;font-weight:800;">${greeting}</p>
              <p style="margin:0;color:#64748b;font-size:14px;line-height:1.7;">
                Thank you for subscribing to <strong style="color:#4f46e5;">The Accounts</strong>.
                ${isPending ? "This is your payment receipt while we verify your transaction." : "Below is your official order receipt for your records."}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 28px 24px 28px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%);border:1px solid #e2e8f0;border-radius:22px;padding:4px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom:14px;">
                          <span style="display:inline-block;background:${statusBg};color:${statusColor};padding:6px 12px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:1px;text-transform:uppercase;">
                            ${isPending ? "Pending Verification" : "Paid & Activated"}
                          </span>
                        </td>
                        <td style="padding-bottom:14px;text-align:right;color:#64748b;font-size:11px;font-weight:700;">
                          Order #${data.orderId}
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top:1px dashed #cbd5e1;">
                      ${receiptRow("Business", data.shopName)}
                      ${receiptRow("Plan", planTitle)}
                      ${receiptRow("Billing Cycle", billingLabel)}
                      ${receiptRow("Payment Method", data.paymentMethod)}
                      ${data.transactionRef ? receiptRow("Transaction Ref", data.transactionRef, "#334155") : ""}
                      ${receiptRow("Order Date", orderDate)}
                      ${isPending ? receiptRow("Activation", "After verification", "#b45309") : receiptRow("Valid Until", validUntil, "#047857")}
                      ${creditsLine}
                    </table>

                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top:16px;background:#ffffff;border-radius:18px;border:1px solid #e2e8f0;">
                      <tr>
                        <td style="padding:18px 20px;">
                          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Total Paid</td>
                              <td style="text-align:right;color:#4f46e5;font-size:28px;font-weight:900;line-height:1;">${amountPaid}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 28px 24px 28px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding:8px 0 18px 0;">
                    <a href="${APP_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#db2777 100%);color:#ffffff;text-decoration:none;padding:15px 34px;border-radius:16px;font-size:13px;font-weight:900;letter-spacing:0.4px;box-shadow:0 14px 30px rgba(79,70,229,0.28);">
                      Open Dashboard →
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="background:linear-gradient(135deg,#fff7ed 0%,#fef3c7 100%);border:1px solid #fde68a;border-radius:18px;padding:14px 16px;">
                    <p style="margin:0;color:#92400e;font-size:12px;font-weight:600;line-height:1.6;">
                      ${isPending ? "⏳" : "✅"} ${isPending ? "Your plan activates after admin verification (usually within a few hours)." : "Your subscription is live. Refresh your dashboard if features do not appear immediately."}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:#0f172a;padding:22px 28px;text-align:center;">
              <p style="margin:0 0 6px 0;color:#e2e8f0;font-size:12px;font-weight:700;">Need help? Reply to this email or contact ${SUPPORT_EMAIL}</p>
              <p style="margin:0;color:#64748b;font-size:10px;font-weight:600;">© ${new Date().getFullYear()} The Accounts · Secure SaaS Billing Receipt</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function subscriptionReceiptSubject(data: SubscriptionReceiptEmailData) {
  const planTitle = data.planName || formatPlanLabel(data.planId);
  if (data.status === "pending") {
    return `⏳ Payment Received - ${planTitle} | The Accounts`;
  }
  return `✅ Order Confirmed - ${planTitle} is Active | The Accounts`;
}

export async function sendSubscriptionReceiptEmail(
  to: string,
  data: SubscriptionReceiptEmailData
) {
  const html = generateSubscriptionReceiptEmailHtml(data);
  const subject = subscriptionReceiptSubject(data);
  return sendEmail(to, subject, html);
}

export { formatPlanLabel };
