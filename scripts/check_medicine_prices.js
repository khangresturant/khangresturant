const fs = require("fs");
const path = require("path");
const { Client } = require('pg');

function loadEnvLocal() {
  const envPath = path.join(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL || process.env.SUPABASE_DB_URL;

const client = new Client({
  connectionString,
  ssl: false
});

async function run() {
  try {
    await client.connect();

    console.log("--- Checking Top Well-Known Medicines in platform_drug_catalog ---");
    const res = await client.query(`
      SELECT name, pack_size, unit, purchase_price_single, sale_price_single, purchase_price_pack, sale_price_pack
      FROM platform_drug_catalog
      WHERE name ILIKE '%panadol%'
         OR name ILIKE '%augmentin%'
         OR name ILIKE '%brufen%'
         OR name ILIKE '%risek%'
         OR name ILIKE '%flagyl%'
         OR name ILIKE '%ponstan%'
         OR name ILIKE '%disprin%'
         OR name ILIKE '%arinac%'
      LIMIT 25;
    `);
    console.table(res.rows);

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
}

run();
