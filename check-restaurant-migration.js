const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL || "https://bzlryfostkzotfgeozjr.supabase.co";
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function checkTable(label, query) {
  const { error } = await query();
  if (error) {
    const msg = error.message || "";
    if (msg.includes("does not exist") || msg.includes("Could not find the table")) {
      return { label, ok: false, reason: "missing" };
    }
    return { label, ok: false, reason: msg };
  }
  return { label, ok: true };
}

async function check() {
  const results = await Promise.all([
    checkTable("Order workflow (invoices)", () =>
      supabase.from("invoices").select("restaurant_order_status, service_type").limit(1)
    ),
    checkTable("KOT linking (kitchen_orders)", () =>
      supabase.from("kitchen_orders").select("invoice_id, waiter_id").limit(1)
    ),
    checkTable("Menu sizes", () =>
      supabase.from("restaurant_menu_sizes").select("id").limit(1)
    ),
    checkTable("Deals", () =>
      supabase.from("restaurant_deals").select("id").limit(1)
    ),
    checkTable("Waiter calls", () =>
      supabase.from("restaurant_waiter_calls").select("id").limit(1)
    ),
  ]);

  let allOk = true;
  for (const r of results) {
    const status = r.ok ? "OK" : "MISSING";
    console.log(`${status.padEnd(8)} ${r.label}${r.reason && r.reason !== "missing" ? ` — ${r.reason}` : ""}`);
    if (!r.ok) allOk = false;
  }

  if (allOk) {
    console.log("\nSTATUS: ALL MIGRATIONS OK");
    process.exit(0);
  }

  console.log("\nSTATUS: MIGRATION NOT APPLIED");
  console.log("\nRun restaurant_full_migration.sql in Supabase SQL Editor:");
  console.log("https://supabase.com/dashboard/project/bzlryfostkzotfgeozjr/sql/new");
  console.log("\nOr in the app: Restaurant → DB Setup (Migration) → Copy SQL → Run in Supabase");
  process.exit(1);
}

check().catch((e) => {
  console.error("CHECK FAILED:", e.message);
  process.exit(1);
});
