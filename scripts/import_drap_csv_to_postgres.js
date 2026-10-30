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

async function main() {
  const jsonPath = path.join(__dirname, "../drap_official_medicines_2026.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("JSON file not found.");
    return;
  }

  const medicines = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  console.log(`Loaded ${medicines.length} official medicines from DRAP file.`);

  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("No database connection string.");
    return;
  }

  const client = new Client({ connectionString, ssl: false });
  await client.connect();
  console.log("Connected to PostgreSQL database.");

  // Ensure table columns are TEXT
  await client.query(`
    ALTER TABLE platform_drug_catalog ALTER COLUMN generic_formula TYPE TEXT;
    ALTER TABLE platform_drug_catalog ALTER COLUMN name TYPE TEXT;
    ALTER TABLE platform_drug_catalog ALTER COLUMN brand_name TYPE TEXT;
    ALTER TABLE platform_drug_catalog ALTER COLUMN category_name TYPE TEXT;
  `);

  // Ensure UNIQUE index on name
  await client.query(`
    DELETE FROM platform_drug_catalog a USING platform_drug_catalog b
    WHERE a.id < b.id AND a.name = b.name;
    ALTER TABLE platform_drug_catalog DROP CONSTRAINT IF EXISTS unq_platform_drug_name;
    ALTER TABLE platform_drug_catalog ADD CONSTRAINT unq_platform_drug_name UNIQUE (name);
  `);

  console.log("Importing in fast multi-row batches of 100...");
  const chunkSize = 100;
  let processed = 0;

  for (let i = 0; i < medicines.length; i += chunkSize) {
    const chunk = medicines.slice(i, i + chunkSize);
    const values = [];
    const placeholders = [];

    chunk.forEach((m, idx) => {
      const offset = idx * 10;
      const mrp = parseFloat(m.price.toFixed(2)) || 0;
      const tp = parseFloat((mrp * 0.85).toFixed(2)) || 0;
      const packMatch = (m.packSize || "").match(/\d+/);
      const packSizeNum = packMatch ? parseInt(packMatch[0]) : 1;
      const singlePrice = parseFloat((mrp / Math.max(1, packSizeNum)).toFixed(2));

      placeholders.push(`(
        $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5},
        $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}
      )`);

      values.push(
        m.productName,
        m.regNumber || null,
        m.genericFormula || 'General Salt',
        m.category || 'Essential Drugs',
        m.manufacturer || 'National Pharma',
        packSizeNum,
        'pack',
        tp,
        mrp,
        singlePrice
      );
    });

    const query = `
      INSERT INTO platform_drug_catalog 
      (name, item_code, generic_formula, category_name, brand_name, pack_size, unit,
       purchase_price_pack, sale_price_pack, sale_price_single)
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (name) DO UPDATE SET
        sale_price_pack = EXCLUDED.sale_price_pack,
        purchase_price_pack = EXCLUDED.purchase_price_pack,
        sale_price_single = EXCLUDED.sale_price_single,
        generic_formula = EXCLUDED.generic_formula,
        brand_name = EXCLUDED.brand_name,
        category_name = EXCLUDED.category_name,
        pack_size = EXCLUDED.pack_size,
        updated_at = now();
    `;

    await client.query(query, values);
    processed += chunk.length;
    if (processed % 1000 === 0 || processed === medicines.length) {
      console.log(`Progress: ${processed} / ${medicines.length} imported into PostgreSQL...`);
    }
  }

  const finalCount = await client.query(`SELECT COUNT(*) FROM platform_drug_catalog;`);
  console.log(`\n🎉 DATABASE IMPORT 100% COMPLETE! Total central drug catalog count: ${finalCount.rows[0].count}`);

  await client.end();
}

main().catch(console.error);
