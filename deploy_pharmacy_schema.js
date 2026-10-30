const fs = require("fs");
const path = require("path");
const { Client } = require('pg');

function loadEnvLocal() {
  const envPath = path.join(__dirname, ".env.local");
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

const connectionString =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("Error: Database connection string not found in environment variables.");
  process.exit(1);
}

async function deployPharmacySchema() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    const queries = [
      // Add formula to products
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS formula VARCHAR(255);`,

      // Add pharmacy fields to purchase_order_items
      `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS bonus_quantity FLOAT DEFAULT 0;`,
      `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS discount_amount FLOAT DEFAULT 0;`,
      `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);`,
      `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS expiry_date DATE;`,

      // Add product_batches table
      `CREATE TABLE IF NOT EXISTS product_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id UUID REFERENCES shops(id),
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
        batch_number VARCHAR(100),
        expiry_date DATE,
        stock_quantity FLOAT DEFAULT 0,
        purchase_price FLOAT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      );`
    ];

    for (const sql of queries) {
      console.log(`Executing: ${sql}`);
      await client.query(sql);
      console.log(`Success.`);
    }
    
    console.log("Pharmacy Schema Migration completed.");
  } catch (err) {
    console.error('Error executing schema:', err);
  } finally {
    await client.end();
  }
}

deployPharmacySchema();
