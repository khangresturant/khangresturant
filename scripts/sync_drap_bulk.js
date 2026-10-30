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

async function syncJsonToDb(jsonPath) {
  if (!fs.existsSync(jsonPath)) {
    console.error(`File not found: ${jsonPath}`);
    return;
  }

  const raw = fs.readFileSync(jsonPath, "utf8");
  const medicines = JSON.parse(raw);
  console.log(`Loaded ${medicines.length} medicines from ${jsonPath}`);

  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("No database connection string.");
    return;
  }

  const client = new Client({ connectionString, ssl: false });
  try {
    await client.connect();
    console.log("Connected to PostgreSQL database.");

    // Ensure columns are TEXT
    await client.query(`
      ALTER TABLE platform_drug_catalog ALTER COLUMN generic_formula TYPE TEXT;
      ALTER TABLE platform_drug_catalog ALTER COLUMN name TYPE TEXT;
      ALTER TABLE platform_drug_catalog ALTER COLUMN brand_name TYPE TEXT;
      ALTER TABLE platform_drug_catalog ALTER COLUMN category_name TYPE TEXT;
    `);

    // Insert or update in chunks of 50
    const chunkSize = 50;
    let totalProcessed = 0;

    for (let i = 0; i < medicines.length; i += chunkSize) {
      const chunk = medicines.slice(i, i + chunkSize);
      
      // Build multi-row upsert query or batch execution
      const values = [];
      const placeholders = [];

      chunk.forEach((m, idx) => {
        const offset = idx * 10;
        const tp = parseFloat((m.price * 0.85).toFixed(2)) || 0;
        const mrp = parseFloat(m.price.toFixed(2)) || 0;
        const packSizeMatch = (m.packSize || "").match(/\d+/);
        const packSizeNum = packSizeMatch ? parseInt(packSizeMatch[0]) : 1;

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
          parseFloat((mrp / packSizeNum).toFixed(2))
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

      // Check if unique constraint exists on name, if not create unique index
      try {
        await client.query(query, values);
      } catch (err) {
        if (err.message.includes("no unique or exclusion constraint")) {
          // Add unique constraint on name
          console.log("Adding UNIQUE constraint on platform_drug_catalog(name)...");
          await client.query(`
            DELETE FROM platform_drug_catalog a USING platform_drug_catalog b
            WHERE a.id < b.id AND a.name = b.name;
            ALTER TABLE platform_drug_catalog ADD CONSTRAINT unq_platform_drug_name UNIQUE (name);
          `);
          // Retry query
          await client.query(query, values);
        } else {
          throw err;
        }
      }

      totalProcessed += chunk.length;
      console.log(`Synced ${totalProcessed} / ${medicines.length} medicines to database...`);
    }

    const totalCount = await client.query(`SELECT COUNT(*) FROM platform_drug_catalog;`);
    console.log(`\n🎉 Sync Complete! Total medicines in platform_drug_catalog: ${totalCount.rows[0].count}`);

  } catch (err) {
    console.error("❌ Sync Error:", err.message);
  } finally {
    await client.end();
  }
}

const jsonPath = path.join(__dirname, "../drap_official_medicines_2026.json");
syncJsonToDb(jsonPath);
