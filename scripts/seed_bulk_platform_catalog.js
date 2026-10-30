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

async function main() {
  try {
    await client.connect();
    console.log("Connected to PostgreSQL database.");

    // 1. Ensure platform_drug_catalog table exists with unique constraint on name
    console.log("1. Preparing platform_drug_catalog schema...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_drug_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_code VARCHAR(100),
        barcode VARCHAR(100),
        name VARCHAR(255) NOT NULL,
        generic_formula VARCHAR(255),
        category_name VARCHAR(150),
        brand_name VARCHAR(150),
        pack_size INT DEFAULT 1,
        unit VARCHAR(50) DEFAULT 'pcs',
        purchase_price_pack NUMERIC(12, 2) DEFAULT 0,
        sale_price_pack NUMERIC(12, 2) DEFAULT 0,
        purchase_price_single NUMERIC(12, 2) DEFAULT 0,
        sale_price_single NUMERIC(12, 2) DEFAULT 0,
        is_narcotic BOOLEAN DEFAULT false,
        requires_prescription BOOLEAN DEFAULT false,
        shelf_location VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_platform_drugs_name ON platform_drug_catalog(name);
      CREATE INDEX IF NOT EXISTS idx_platform_drugs_formula ON platform_drug_catalog(generic_formula);
      CREATE INDEX IF NOT EXISTS idx_platform_drugs_barcode ON platform_drug_catalog(barcode);
    `);

    // 2. Extract directly via SQL INSERT INTO ... SELECT from shop cbf93065-5b09-4240-8e0b-92d4223bcfca
    console.log("2. Performing high-speed bulk insert from source pharmacy into platform_drug_catalog...");
    const copyQuery = `
      INSERT INTO platform_drug_catalog 
      (name, item_code, generic_formula, category_name, brand_name, pack_size, unit,
       purchase_price_pack, sale_price_pack, purchase_price_single, sale_price_single,
       is_narcotic, requires_prescription)
      SELECT 
        DISTINCT ON (p.name)
        p.name,
        p.code,
        COALESCE(f.name, p.formula, 'General Formulation'),
        COALESCE(c.name, 'Medicines'),
        COALESCE(b.name, 'National Pharma'),
        COALESCE(p.pack_size, 1),
        COALESCE(p.unit, 'pcs'),
        COALESCE(p.purchase_price_single, 0) * COALESCE(p.pack_size, 1),
        COALESCE(p.sale_price_single, 0) * COALESCE(p.pack_size, 1),
        COALESCE(p.purchase_price_single, 0),
        COALESCE(p.sale_price_single, 0),
        (p.note LIKE '%[CONTROLLED_DRUG]%'),
        (p.note LIKE '%[CONTROLLED_DRUG]%')
      FROM products p
      LEFT JOIN formulations f ON p.formulation_id = f.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.shop_id = 'cbf93065-5b09-4240-8e0b-92d4223bcfca'
      AND p.name NOT IN (SELECT name FROM platform_drug_catalog);
    `;

    const copyRes = await client.query(copyQuery);
    console.log(`✅ Bulk copy completed! Inserted rows: ${copyRes.rowCount}`);

    const countRes = await client.query(`SELECT COUNT(*) FROM platform_drug_catalog;`);
    console.log(`\n🎉 Total medicines currently in platform_drug_catalog: ${countRes.rows[0].count}`);

    // Show top categories in the catalog
    const catStats = await client.query(`
      SELECT category_name, COUNT(*) as drug_count 
      FROM platform_drug_catalog 
      GROUP BY category_name 
      ORDER BY drug_count DESC 
      LIMIT 10;
    `);
    console.log("\n--- Top Therapeutic Categories ---");
    console.table(catStats.rows);

    // Show top brands in the catalog
    const brandStats = await client.query(`
      SELECT brand_name, COUNT(*) as drug_count 
      FROM platform_drug_catalog 
      GROUP BY brand_name 
      ORDER BY drug_count DESC 
      LIMIT 10;
    `);
    console.log("\n--- Top Pharma Brands ---");
    console.table(brandStats.rows);

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.end();
  }
}

main();
