import { readFileSync } from "fs";
import { resolve } from "path";
import { sendEmail } from "../src/lib/email";
import { generateSubscriptionReceiptEmailHtml } from "../src/lib/email/subscription-receipt";

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

const to = process.argv[2] || "kashifmalikg7867@gmail.com";
const expiry = new Date();
expiry.setMonth(expiry.getMonth() + 1);

async function main() {
  const invoices = [
    {
      customerName: "Kashif Malik",
      shopName: "Kashif Malik Traders",
      planName: "Premium Plan",
      planId: "premium",
      amount: 2000,
      billingPeriod: "monthly",
      paymentMethod: "JazzCash",
      transactionRef: "JC-8847291033",
      orderId: "INV-2026-0041",
      expiryDate: expiry,
      status: "confirmed" as const,
    },
    {
      customerName: "Kashif Malik",
      shopName: "Kashif Malik Traders",
      planName: "Premium Plan",
      planId: "premium",
      amount: 2000,
      billingPeriod: "monthly",
      paymentMethod: "EasyPaisa",
      transactionRef: "EP-7721048892",
      orderId: "INV-2026-0042",
      expiryDate: expiry,
      status: "confirmed" as const,
    },
  ];

  for (const inv of invoices) {
    const html = generateSubscriptionReceiptEmailHtml(inv);
    const subject = `✅ Tax Invoice ${inv.orderId} — Premium Plan | The Accounts`;
    console.log(`Sending ${inv.orderId} to ${to}...`);
    const result = await sendEmail(to, subject, html);
    if (!result.success) {
      console.error("Failed:", result.error);
      process.exit(1);
    }
    console.log("Sent:", result.messageId);
  }

  console.log(`Done — 2 invoice emails sent to ${to}`);
}

main();
