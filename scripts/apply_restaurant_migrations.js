const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// Read DATABASE_URL from environment or local .env.local
let dbUrl = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL;

if (!dbUrl) {
  try {
    const envPath = path.resolve(__dirname, "../.env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) {
        dbUrl = match[1].trim();
      }
    }
  } catch (e) {
    // Ignore read errors
  }
}

if (!dbUrl) {
  console.error("Error: DATABASE_URL environment variable is required.");
  process.exit(1);
}

async function applyMigrations() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: false,
  });

  console.log("Connecting to PostgreSQL...");
  await client.connect();
  console.log("Connected successfully!");

  try {
    console.log("Starting migration transaction...");
    await client.query("BEGIN;");

    // 1. Dual thermal printer support on company_details
    console.log("1. Migrating company_details (printer columns)...");
    await client.query(`
      ALTER TABLE company_details ADD COLUMN IF NOT EXISTS kitchen_printer_name VARCHAR(255);
      ALTER TABLE company_details ADD COLUMN IF NOT EXISTS customer_printer_name VARCHAR(255);
      ALTER TABLE company_details ADD COLUMN IF NOT EXISTS printer_name VARCHAR(255);
    `);

    // 2. Product discount exemption & restaurant POS visibility on products
    console.log("2. Migrating products (discount exemption & restaurant visibility)...");
    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS not_discounted BOOLEAN DEFAULT false;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_restaurant_pos BOOLEAN DEFAULT true;
    `);

    // 3. Restaurant order COGS & stock deduction on invoices
    console.log("3. Migrating invoices (cost_amount, profit_amount, stock_deducted)...");
    await client.query(`
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cost_amount NUMERIC(15, 2) DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS profit_amount NUMERIC(15, 2) DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN DEFAULT false;
    `);

    // 4. Per-size recipe BOM costing & order line sizing on invoice_items
    console.log("4. Migrating invoice_items (menu_size_id)...");
    await client.query(`
      ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS menu_size_id UUID REFERENCES restaurant_menu_sizes(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_invoice_items_menu_size ON invoice_items(menu_size_id);
    `);

    // 5. Per-size recipes on product_recipes
    console.log("5. Migrating product_recipes (menu_size_id & unique index per size)...");
    await client.query(`
      ALTER TABLE product_recipes ADD COLUMN IF NOT EXISTS menu_size_id UUID REFERENCES restaurant_menu_sizes(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_product_recipes_menu_size ON product_recipes(menu_size_id);
      CREATE INDEX IF NOT EXISTS idx_product_recipes_parent_size ON product_recipes(parent_product_id, menu_size_id);
      
      -- Replace legacy single-ingredient constraint with per-size unique index
      ALTER TABLE product_recipes DROP CONSTRAINT IF EXISTS product_recipes_parent_product_id_ingredient_product_id_key;
      DROP INDEX IF EXISTS product_recipes_parent_ingredient_size_uniq;
      CREATE UNIQUE INDEX product_recipes_parent_ingredient_size_uniq ON product_recipes (
        parent_product_id,
        ingredient_product_id,
        COALESCE(menu_size_id, '00000000-0000-0000-0000-000000000000'::uuid)
      );
    `);

    // 6. Reload PostgREST schema cache
    console.log("6. Reloading PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");

    await client.query("COMMIT;");
    console.log("All migrations applied and committed successfully!");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Migration failed and rolled back:", err);
    throw err;
  } finally {
    await client.end();
  }
}

applyMigrations().catch((err) => {
  console.error("Execution terminated with error:", err.message);
  process.exit(1);
});
