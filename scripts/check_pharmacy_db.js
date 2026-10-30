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
    console.log("Connected to database.");

    // Check if formulations exists
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('formulations', 'master_drug_registry', 'platform_drug_catalog', 'products', 'brands', 'categories', 'product_batches');
    `);
    console.log("Existing tables:", tables.rows.map(r => r.table_name));

    // Check counts in pharmacy
    const pCount = await client.query(`SELECT shop_id, COUNT(*) FROM products GROUP BY shop_id;`);
    console.log("Product counts per shop:", pCount.rows);

    const fCount = await client.query(`SELECT shop_id, COUNT(*) FROM formulations GROUP BY shop_id;`);
    console.log("Formulation counts per shop:", fCount.rows);

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
}

run();
