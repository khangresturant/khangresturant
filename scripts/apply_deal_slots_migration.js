const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

let dbUrl = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL;
if (!dbUrl) {
  try {
    const envPath = path.resolve(__dirname, "../.env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) dbUrl = match[1].trim();
    }
  } catch (e) {}
}

if (!dbUrl) {
  console.error("Error: DATABASE_URL is required.");
  process.exit(1);
}

async function applyDealSlotsMigration() {
  const client = new Client({ connectionString: dbUrl, ssl: false });
  console.log("Connecting to PostgreSQL...");
  await client.connect();

  try {
    console.log("Starting transaction for deal slots & COGS migration...");
    await client.query("BEGIN;");

    console.log("1. Adding slot_label and allowed_product_ids to restaurant_deal_items...");
    await client.query(`
      ALTER TABLE restaurant_deal_items ADD COLUMN IF NOT EXISTS slot_label VARCHAR(120);
      ALTER TABLE restaurant_deal_items ADD COLUMN IF NOT EXISTS allowed_product_ids JSONB;
    `);

    console.log("2. Ensuring purchase_price on invoice_items...");
    await client.query(`
      ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(15, 4);
    `);

    console.log("3. Reloading PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");

    await client.query("COMMIT;");
    console.log("Migration committed successfully!");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

applyDealSlotsMigration().catch(console.error);
