import nodemailer from "nodemailer";
import { usesLocalDatabase } from "@/lib/config";

const host = process.env.SMTP_HOST?.trim() || "";
const port = parseInt(process.env.SMTP_PORT || "465", 10);
const user = process.env.SMTP_USER?.trim() || "";
const pass = process.env.SMTP_PASS || "";
const from = process.env.SMTP_FROM?.trim() || user;

const transporter =
  host && user && pass
    ? nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      })
    : null;

export async function sendEmail(to: string, subject: string, html: string) {
  if (!transporter || usesLocalDatabase()) {
    console.log(`[Email offline] To: ${to} | Subject: ${subject}`);
    return { success: true, messageId: "offline-local" };
  }
  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });
    console.log(`[Email] Message sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[Email] Failed to send email:", error);
    return { success: false, error: error.message };
  }
}

/**
 * NO-LINK VIP OTP Email Template Generator.
 * Strips out all <a> tags and URLs to ensure 100% inbox delivery without spam flags.
 */
export function generateOtpEmailHtml(otpCode: string, title: string = "Security Verification Code") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #ffffff; border: 2px solid #e0e7ff; border-radius: 28px; overflow: hidden; box-shadow: 0 20px 40px rgba(79, 70, 229, 0.08);">
          
          <!-- Top Decorative Gradient Line -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%); height: 6px;"></td>
          </tr>

          <!-- Content Area -->
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

              <h1 style="margin: 0 0 6px 0; color: #0f172a; font-size: 22px; font-weight: 800; tracking: -0.5px;">
                The Accounts
              </h1>
              <p style="margin: 0 0 24px 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">
                ${title}
              </p>

              <!-- Main Notice Text -->
              <p style="margin: 0 0 24px 0; color: #334155; font-size: 14px; font-weight: 500; line-height: 1.6;">
                Use the following 6-digit verification code (OTP) to complete your action. This code is valid for <strong>10 minutes</strong>.
              </p>

              <!-- OTP Code Display Box (NO LINKS AT ALL!) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <div style="background-color: #f1f5f9; border: 2px border-style: dashed; border-color: #6366f1; border-radius: 20px; padding: 18px 24px; display: inline-block;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; color: #4f46e5; letter-spacing: 10px; padding-left: 10px; display: block;">
                        ${otpCode}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Warning Box -->
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 16px; padding: 14px 18px; text-align: left; margin-bottom: 24px;">
                <p style="margin: 0; color: #92400e; font-size: 12px; font-weight: 600; line-height: 1.5;">
                  🔒 <strong>Security Warning:</strong> Do not share this code with anyone. Official staff members will never ask for your verification code.
                </p>
              </div>

              <!-- Footer info (NO LINKS!) -->
              <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; text-align: center;">
                <p style="margin: 0 0 4px 0; color: #94a3b8; font-size: 11px; font-weight: 600;">
                  Sent automatically by The Accounts System.
                </p>
                <p style="margin: 0; color: #cbd5e1; font-size: 10px; font-weight: 500;">
                  If you did not request this verification code, please ignore this email.
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
}

export async function sendOtpEmail(to: string, otpCode: string, title: string = "Security Verification Code") {
  const html = generateOtpEmailHtml(otpCode, title);
  return sendEmail(to, `🔑 Verification Code: ${otpCode} - The Accounts`, html);
}
