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

if (dbUrl) {
  dbUrl = dbUrl.replace(/^["']|["']$/g, "").trim();
}

if (!dbUrl) {
  console.error("Error: DATABASE_URL is required.");
  process.exit(1);
}

async function runMigrations() {
  const isNeon = dbUrl.includes("neon.tech") || dbUrl.includes("sslmode=require");
  const client = new Client({
    connectionString: dbUrl,
    ssl: isNeon ? { rejectUnauthorized: false } : false,
  });

  console.log("Connecting to Neon PostgreSQL...");
  await client.connect();
  console.log("Connected successfully to Neon DB!");

  const steps = [
    {
      name: "1. Deal slots aur allowed product choices",
      sql: `
        ALTER TABLE restaurant_deal_items ADD COLUMN IF NOT EXISTS slot_label VARCHAR(120);
        ALTER TABLE restaurant_deal_items ADD COLUMN IF NOT EXISTS allowed_product_ids JSONB;
      `
    },
    {
      name: "2. Invoice items purchase price aur size linkage",
      sql: `
        ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(15, 4);
        ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS menu_size_id UUID REFERENCES restaurant_menu_sizes(id) ON DELETE SET NULL;
        COMMENT ON COLUMN invoice_items.purchase_price IS 'Restaurant: per-unit COGS snapshot at settle (frozen - raw price changes do not alter past orders)';
      `
    },
    {
      name: "3. Batches sale price",
      sql: `
        ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS sale_price NUMERIC(15, 2);
      `
    },
    {
      name: "4. Restaurant tables table_number",
      sql: `
        ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS table_number VARCHAR(50);
      `
    },
    {
      name: "5. Purchase orders party compatibility",
      sql: `
        ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id) ON DELETE SET NULL;
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'purchase_orders' AND column_name = 'supplier_id'
          ) THEN
            UPDATE purchase_orders SET party_id = supplier_id WHERE party_id IS NULL AND supplier_id IS NOT NULL;
          END IF;
        END $$;
      `
    },
    {
      name: "6. Invoices COGS & edit audit fields",
      sql: `
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cost_amount NUMERIC(15, 2) DEFAULT 0;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS profit_amount NUMERIC(15, 2) DEFAULT 0;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN DEFAULT false;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS edit_history JSONB;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(15, 2) DEFAULT 0;
      `
    },
    {
      name: "7. Product recipes size indexing & DROP OLD CONSTRAINT",
      sql: `
        ALTER TABLE product_recipes ADD COLUMN IF NOT EXISTS menu_size_id UUID REFERENCES restaurant_menu_sizes(id) ON DELETE SET NULL;
        
        -- Drop the old constraint that blocked per-size recipes
        ALTER TABLE product_recipes DROP CONSTRAINT IF EXISTS product_recipes_parent_product_id_ingredient_product_id_key;
        
        -- Drop old index if exists and recreate with per-size uniqueness
        DROP INDEX IF EXISTS product_recipes_parent_product_id_ingredient_product_id_key;
        DROP INDEX IF EXISTS product_recipes_parent_ingredient_size_uniq;
        
        CREATE UNIQUE INDEX IF NOT EXISTS product_recipes_parent_ingredient_size_uniq ON product_recipes (
          parent_product_id,
          ingredient_product_id,
          COALESCE(menu_size_id, '00000000-0000-0000-0000-000000000000'::uuid)
        );

        CREATE INDEX IF NOT EXISTS idx_product_recipes_menu_size ON product_recipes(menu_size_id);
        CREATE INDEX IF NOT EXISTS idx_product_recipes_parent_size ON product_recipes(parent_product_id, menu_size_id);
      `
    },
    {
      name: "8. Products visibility, KDS station & discounts",
      sql: `
        ALTER TABLE products ADD COLUMN IF NOT EXISTS kitchen_station_id UUID;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS not_discounted BOOLEAN DEFAULT false;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_restaurant_pos BOOLEAN DEFAULT true;
      `
    },
    {
      name: "9. Kitchen orders routing & delivery fields",
      sql: `
        ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
        ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS waiter_id UUID;
        ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS rider_id UUID;
        ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS station_id UUID;
        ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS kitchen_hub VARCHAR(100);
      `
    },
    {
      name: "10. PostgREST schema cache reload",
      sql: `
        NOTIFY pgrst, 'reload schema';
      `
    }
  ];

  try {
    await client.query("BEGIN;");

    for (const step of steps) {
      console.log(`Executing step: ${step.name}...`);
      await client.query(step.sql);
      console.log(`  -> Step completed.`);
    }

    await client.query("COMMIT;");
    console.log("\nALL MIGRATIONS APPLIED SUCCESSFULLY AND COMMITTED!");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("MIGRATION FAILED! Rolled back transaction.", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations().catch(console.error);
