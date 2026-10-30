import { readFileSync } from "fs";
import { resolve } from "path";
import { sendSubscriptionReceiptEmail } from "../src/lib/email/subscription-receipt";

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

const orderId = `PREM-${Date.now().toString().slice(-8)}`;

async function main() {
  console.log(`Sending Premium subscription receipt to ${to}...`);
  const result = await sendSubscriptionReceiptEmail(to, {
    customerName: "Kashif Malik",
    shopName: "Kashif Malik Business",
    planName: "Premium Plan",
    planId: "premium",
    amount: 2000,
    billingPeriod: "monthly",
    paymentMethod: "Safepay (Card / JazzCash / EasyPaisa)",
    transactionRef: `TXN-${orderId}`,
    orderId,
    expiryDate: expiry,
    status: "confirmed",
  });

  if (!result.success) {
    console.error("Failed:", result.error);
    process.exit(1);
  }

  console.log("Email sent successfully. Message ID:", result.messageId);
}

main();
