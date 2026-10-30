import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Client } = pg;

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("No database connection string found in .env.local");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: false
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL database...");

    const ddl = `
      -- 1. Create supplier_expiry_claims table
      CREATE TABLE IF NOT EXISTS supplier_expiry_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        claim_number VARCHAR(100) NOT NULL,
        supplier_id UUID REFERENCES parties(id) ON DELETE SET NULL,
        supplier_name VARCHAR(255),
        booker_name VARCHAR(255),
        booker_phone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'submitted',
        total_items INT DEFAULT 0,
        total_claimed_amount NUMERIC(12, 2) DEFAULT 0,
        approved_amount NUMERIC(12, 2) DEFAULT 0,
        credit_note_number VARCHAR(100),
        notes TEXT,
        return_reason VARCHAR(100) DEFAULT 'Near Expiry / Expired',
        submitted_at TIMESTAMPTZ DEFAULT now(),
        approved_at TIMESTAMPTZ,
        settled_at TIMESTAMPTZ,
        settled_in_purchase_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      -- 2. Create supplier_expiry_claim_items table
      CREATE TABLE IF NOT EXISTS supplier_expiry_claim_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id UUID NOT NULL REFERENCES supplier_expiry_claims(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        product_name VARCHAR(255),
        variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
        batch_number VARCHAR(100),
        expiry_date DATE,
        quantity NUMERIC(10, 2) NOT NULL,
        pack_size INT,
        unit VARCHAR(50),
        purchase_price NUMERIC(10, 2) NOT NULL,
        subtotal NUMERIC(12, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT now()
      );

      -- 3. Create indices for fast querying
      CREATE INDEX IF NOT EXISTS idx_supplier_expiry_claims_shop_id ON supplier_expiry_claims(shop_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_expiry_claims_supplier_id ON supplier_expiry_claims(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_expiry_claims_status ON supplier_expiry_claims(status);
      CREATE INDEX IF NOT EXISTS idx_supplier_expiry_claim_items_claim_id ON supplier_expiry_claim_items(claim_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_expiry_claim_items_product_id ON supplier_expiry_claim_items(product_id);
    `;

    await client.query(ddl);
    console.log("Successfully created supplier_expiry_claims and supplier_expiry_claim_items tables and indices!");
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
