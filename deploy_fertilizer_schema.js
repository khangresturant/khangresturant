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

async function deployFertilizerSchema() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    const queries = [
      // 1. Create Seasonal Khata Table
      `CREATE TABLE IF NOT EXISTS seasonal_khata (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
        party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
        crop_season VARCHAR(100) NOT NULL,
        credit_limit NUMERIC(15, 2) DEFAULT 0,
        outstanding_balance NUMERIC(15, 2) DEFAULT 0,
        expected_harvest_payback DATE,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT now()
      );`,

      // 2. Add batch columns to invoice_items
      `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL;`,
      `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);`,

      // 3. Add government subsidy columns to invoices
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subsidy_amount NUMERIC(15, 2) DEFAULT 0;`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subsidy_voucher VARCHAR(100);`
    ];

    for (const sql of queries) {
      console.log(`Executing: ${sql.trim().split('\n')[0]}...`);
      await client.query(sql);
      console.log(`Success.`);
    }
    
    console.log("Fertilizer Schema Migration completed successfully.");
  } catch (err) {
    console.error('Error executing schema:', err);
  } finally {
    await client.end();
  }
}

deployFertilizerSchema();
