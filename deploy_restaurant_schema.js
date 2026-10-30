const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

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

function printManualInstructions() {
  const workflowSql = fs.readFileSync(
    path.join(__dirname, "restaurant_order_workflow.sql"),
    "utf8"
  );
  const extendedSql = fs.readFileSync(
    path.join(__dirname, "restaurant_extended_schema.sql"),
    "utf8"
  );

  console.log("\n========================================");
  console.log("MANUAL MIGRATION (works on all networks)");
  console.log("========================================");
  console.log("1. Open https://supabase.com/dashboard");
  console.log("2. Select project: bzlryfostkzotfgeozjr");
  console.log("3. Go to SQL Editor → New query");
  console.log("4. Paste and run the SQL below:\n");
  console.log(workflowSql);
  console.log("\n-- Extended features (deals, sizes, waiter calls)\n");
  console.log(extendedSql);
  console.log("\n========================================");
  console.log(
    "TIP: Get IPv4 pooler URL from Dashboard → Project Settings → Database → Connection string (Session pooler), then set DATABASE_URL in .env.local and re-run this script."
  );
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

async function deployRestaurantSchema() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL database.");

    const queries = [
      `CREATE TABLE IF NOT EXISTS restaurant_tables (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          capacity INTEGER DEFAULT 4,
          status VARCHAR(50) DEFAULT 'available',
          active_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT now()
      );`,

      `CREATE TABLE IF NOT EXISTS kitchen_orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
          table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
          invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
          waiter_id UUID,
          status VARCHAR(50) DEFAULT 'cooking',
          created_at TIMESTAMPTZ DEFAULT now()
      );`,

      `CREATE TABLE IF NOT EXISTS kitchen_order_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          kitchen_order_id UUID REFERENCES kitchen_orders(id) ON DELETE CASCADE,
          product_id UUID REFERENCES products(id) ON DELETE CASCADE,
          quantity NUMERIC(15, 2) NOT NULL,
          remarks VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT now()
      );`,

      `ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE kitchen_orders ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE kitchen_order_items ENABLE ROW LEVEL SECURITY;`,

      `DROP POLICY IF EXISTS "Allow all actions for authenticated users on restaurant_tables" ON restaurant_tables;`,
      `CREATE POLICY "Allow all actions for authenticated users on restaurant_tables" ON restaurant_tables FOR ALL TO authenticated USING (true) WITH CHECK (true);`,

      `DROP POLICY IF EXISTS "Allow all actions for authenticated users on kitchen_orders" ON kitchen_orders;`,
      `CREATE POLICY "Allow all actions for authenticated users on kitchen_orders" ON kitchen_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);`,

      `DROP POLICY IF EXISTS "Allow all actions for authenticated users on kitchen_order_items" ON kitchen_order_items;`,
      `CREATE POLICY "Allow all actions for authenticated users on kitchen_order_items" ON kitchen_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);`,

      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS restaurant_order_status VARCHAR(50);`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_type VARCHAR(50);`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL;`,
      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_printed_at TIMESTAMPTZ;`,
      `ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;`,
      `ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS waiter_id UUID;`,

      `CREATE TABLE IF NOT EXISTS restaurant_menu_sizes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
          product_id UUID REFERENCES products(id) ON DELETE CASCADE,
          size_name VARCHAR(30) NOT NULL,
          size_description VARCHAR(100),
          price NUMERIC(15, 2) NOT NULL DEFAULT 0,
          is_available BOOLEAN DEFAULT true,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(shop_id, product_id, size_name)
      );`,

      `CREATE TABLE IF NOT EXISTS restaurant_deals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          image_url TEXT,
          original_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
          deal_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
          discount_percentage NUMERIC(5, 2) DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          valid_from TIMESTAMPTZ,
          valid_until TIMESTAMPTZ,
          max_uses INTEGER,
          current_uses INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT now()
      );`,

      `CREATE TABLE IF NOT EXISTS restaurant_deal_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          deal_id UUID REFERENCES restaurant_deals(id) ON DELETE CASCADE,
          product_id UUID REFERENCES products(id) ON DELETE SET NULL,
          item_type VARCHAR(30) DEFAULT 'item',
          quantity NUMERIC(15, 2) NOT NULL DEFAULT 1,
          size_name VARCHAR(30),
          created_at TIMESTAMPTZ DEFAULT now()
      );`,

      `CREATE TABLE IF NOT EXISTS restaurant_waiter_calls (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
          table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
          invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
          message VARCHAR(255) DEFAULT 'Waiter requested',
          call_type VARCHAR(30) DEFAULT 'help',
          status VARCHAR(20) DEFAULT 'pending',
          waiter_id UUID,
          acknowledged_at TIMESTAMPTZ,
          acknowledged_by UUID,
          created_at TIMESTAMPTZ DEFAULT now()
      );`,

      `ALTER TABLE restaurant_menu_sizes ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE restaurant_deals ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE restaurant_deal_items ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE restaurant_waiter_calls ENABLE ROW LEVEL SECURITY;`,

      `DROP POLICY IF EXISTS "restaurant_menu_sizes_all" ON restaurant_menu_sizes;`,
      `CREATE POLICY "restaurant_menu_sizes_all" ON restaurant_menu_sizes FOR ALL TO authenticated USING (true) WITH CHECK (true);`,

      `DROP POLICY IF EXISTS "restaurant_deals_all" ON restaurant_deals;`,
      `CREATE POLICY "restaurant_deals_all" ON restaurant_deals FOR ALL TO authenticated USING (true) WITH CHECK (true);`,

      `DROP POLICY IF EXISTS "restaurant_deal_items_all" ON restaurant_deal_items;`,
      `CREATE POLICY "restaurant_deal_items_all" ON restaurant_deal_items FOR ALL TO authenticated USING (true) WITH CHECK (true);`,

      `DROP POLICY IF EXISTS "restaurant_waiter_calls_all" ON restaurant_waiter_calls;`,
      `CREATE POLICY "restaurant_waiter_calls_all" ON restaurant_waiter_calls FOR ALL TO authenticated USING (true) WITH CHECK (true);`,
    ];

    for (const sql of queries) {
      await client.query(sql);
      console.log("OK:", sql.trim().split("\n")[0].slice(0, 70));
    }

    console.log("\nRestaurant schema migration completed successfully.");
  } catch (err) {
    if (err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
      console.error(
        "\nDatabase connection failed:",
        err.message,
        "\n\nReason: Supabase direct host (db.*.supabase.co) is IPv6-only.",
        "Your network/Node.js cannot reach it over IPv4."
      );
    } else {
      console.error("Error executing schema:", err.message || err);
    }
    printManualInstructions();
    process.exitCode = 1;
  } finally {
    try {
      await client.end();
    } catch {
      /* not connected */
    }
  }
}

deployRestaurantSchema();
