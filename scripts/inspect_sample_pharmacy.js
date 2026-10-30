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

    console.log("--- Sample 10 Products from IBRAHIM PHARMACY ---");
    const p = await client.query(`
      SELECT p.id, p.name, p.code, p.unit, p.sale_price_single, p.purchase_price_single, p.pack_size, p.formula, f.name as formulation_name, b.name as brand_name, c.name as category_name
      FROM products p
      LEFT JOIN formulations f ON p.formulation_id = f.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.shop_id = 'cbf93065-5b09-4240-8e0b-92d4223bcfca'
      LIMIT 10;
    `);
    console.log(JSON.stringify(p.rows, null, 2));

    console.log("--- Sample Categories ---");
    const cats = await client.query(`
      SELECT id, name FROM categories WHERE shop_id = 'cbf93065-5b09-4240-8e0b-92d4223bcfca' LIMIT 15;
    `);
    console.log(JSON.stringify(cats.rows, null, 2));

    console.log("--- Sample Formulations ---");
    const forms = await client.query(`
      SELECT id, name FROM formulations WHERE shop_id = 'cbf93065-5b09-4240-8e0b-92d4223bcfca' LIMIT 15;
    `);
    console.log(JSON.stringify(forms.rows, null, 2));

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
}

run();
