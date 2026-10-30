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

    // 1. Create central platform_drug_catalog table
    console.log("1. Creating platform_drug_catalog table...");
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
    console.log("✅ platform_drug_catalog table ready.");

    // 2. Check source data from existing pharmacy with 2,716 products
    console.log("2. Fetching rich pharmacy master records...");
    const sourceRes = await client.query(`
      SELECT 
        p.name, p.code, p.unit, p.sale_price_single, p.purchase_price_single, p.pack_size,
        COALESCE(f.name, p.formula, 'General Salt') as generic_formula,
        COALESCE(c.name, 'Medicines') as category_name,
        COALESCE(b.name, 'National Pharma') as brand_name,
        p.note
      FROM products p
      LEFT JOIN formulations f ON p.formulation_id = f.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.shop_id = 'cbf93065-5b09-4240-8e0b-92d4223bcfca';
    `);

    console.log(`Found ${sourceRes.rows.length} master drug records from source shop.`);

    // 3. Populate platform_drug_catalog
    console.log("3. Inserting records into platform_drug_catalog...");
    let insertedCount = 0;
    for (const item of sourceRes.rows) {
      const isNarcotic = (item.note || "").includes("[CONTROLLED_DRUG]") || false;
      const packSize = Number(item.pack_size) || 1;
      const saleSingle = Number(item.sale_price_single) || 0;
      const purchaseSingle = Number(item.purchase_price_single) || 0;
      const salePack = saleSingle * packSize;
      const purchasePack = purchaseSingle * packSize;

      // Check if already in catalog by name
      const exist = await client.query(`SELECT id FROM platform_drug_catalog WHERE name = $1 LIMIT 1;`, [item.name]);
      if (exist.rows.length === 0) {
        await client.query(`
          INSERT INTO platform_drug_catalog 
          (name, item_code, generic_formula, category_name, brand_name, pack_size, unit,
           purchase_price_pack, sale_price_pack, purchase_price_single, sale_price_single,
           is_narcotic, requires_prescription)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);
        `, [
          item.name,
          item.code || null,
          item.generic_formula,
          item.category_name,
          item.brand_name,
          packSize,
          item.unit || 'pcs',
          purchasePack,
          salePack,
          purchaseSingle,
          saleSingle,
          isNarcotic,
          isNarcotic
        ]);
        insertedCount++;
      }
    }

    const totalCentral = await client.query(`SELECT COUNT(*) FROM platform_drug_catalog;`);
    console.log(`✅ Total medicines in platform_drug_catalog: ${totalCentral.rows[0].count} (New inserted: ${insertedCount})`);

    // 4. Also propagate / seed to all other pharmacy shops in the system!
    const pharmaShopsRes = await client.query(`SELECT id, name FROM shops WHERE industry_type = 'pharmacy';`);
    console.log(`\n4. Synchronizing to all ${pharmaShopsRes.rows.length} pharmacy shops in the system...`);

    for (const shop of pharmaShopsRes.rows) {
      const shopId = shop.id;
      console.log(`\nProcessing shop: ${shop.name} (${shopId})...`);

      // 4a. Sync Categories
      const catsRes = await client.query(`SELECT DISTINCT category_name FROM platform_drug_catalog WHERE category_name IS NOT NULL;`);
      const catMap = new Map();
      for (const row of catsRes.rows) {
        const catName = row.category_name.trim();
        let cat = await client.query(`SELECT id FROM categories WHERE shop_id = $1 AND name = $2 LIMIT 1;`, [shopId, catName]);
        if (cat.rows.length === 0) {
          cat = await client.query(`INSERT INTO categories (shop_id, name) VALUES ($1, $2) RETURNING id;`, [shopId, catName]);
        }
        catMap.set(catName, cat.rows[0].id);
      }

      // 4b. Sync Formulations
      const formsRes = await client.query(`SELECT DISTINCT generic_formula FROM platform_drug_catalog WHERE generic_formula IS NOT NULL;`);
      const formMap = new Map();
      for (const row of formsRes.rows) {
        const formName = row.generic_formula.trim();
        let form = await client.query(`SELECT id FROM formulations WHERE shop_id = $1 AND name = $2 LIMIT 1;`, [shopId, formName]);
        if (form.rows.length === 0) {
          form = await client.query(`INSERT INTO formulations (shop_id, name) VALUES ($1, $2) RETURNING id;`, [shopId, formName]);
        }
        formMap.set(formName, form.rows[0].id);
      }

      // 4c. Sync Brands
      const brandsRes = await client.query(`SELECT DISTINCT brand_name FROM platform_drug_catalog WHERE brand_name IS NOT NULL;`);
      const brandMap = new Map();
      for (const row of brandsRes.rows) {
        const brandName = row.brand_name.trim();
        let brand = await client.query(`SELECT id FROM brands WHERE shop_id = $1 AND name = $2 LIMIT 1;`, [shopId, brandName]);
        if (brand.rows.length === 0) {
          brand = await client.query(`INSERT INTO brands (shop_id, name) VALUES ($1, $2) RETURNING id;`, [shopId, brandName]);
        }
        brandMap.set(brandName, brand.rows[0].id);
      }

      // 4d. Sync Products
      const allMasterDrugs = await client.query(`SELECT * FROM platform_drug_catalog;`);
      let shopAdded = 0;
      for (const drug of allMasterDrugs.rows) {
        const pExist = await client.query(`SELECT id FROM products WHERE shop_id = $1 AND name = $2 LIMIT 1;`, [shopId, drug.name]);
        if (pExist.rows.length === 0) {
          const catId = catMap.get(drug.category_name) || null;
          const formId = formMap.get(drug.generic_formula) || null;
          const brandId = brandMap.get(drug.brand_name) || null;
          const note = drug.is_narcotic ? '[CONTROLLED_DRUG]' : null;

          const prodRes = await client.query(`
            INSERT INTO products 
            (shop_id, name, code, unit, sale_price_single, purchase_price_single, current_stock,
             pack_size, min_stock_level, category_id, brand_id, formulation_id, formula, note)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id;
          `, [
            shopId,
            drug.name,
            drug.item_code || null,
            drug.unit || 'pcs',
            Number(drug.sale_price_single) || 0,
            Number(drug.purchase_price_single) || 0,
            10, // initial stock
            Number(drug.pack_size) || 1,
            5,
            catId,
            brandId,
            formId,
            drug.generic_formula,
            note
          ]);

          // Also add default variant for box if pack_size > 1
          if (Number(drug.pack_size) > 1) {
            await client.query(`
              INSERT INTO product_variants 
              (product_id, packing_name, sale_price, purchase_price, stock_quantity, is_packing, pack_size)
              VALUES ($1, $2, $3, $4, $5, $6, $7);
            `, [
              prodRes.rows[0].id,
              `Box (${drug.pack_size} ${drug.unit || 'pcs'})`,
              Number(drug.sale_price_pack) || (Number(drug.sale_price_single) * Number(drug.pack_size)),
              Number(drug.purchase_price_pack) || (Number(drug.purchase_price_single) * Number(drug.pack_size)),
              10,
              true,
              Number(drug.pack_size)
            ]);
          }

          // Also create an active batch in product_batches with a 2-year expiry date
          const expDate = new Date();
          expDate.setFullYear(expDate.getFullYear() + 2);
          const expStr = expDate.toISOString().split('T')[0];

          await client.query(`
            INSERT INTO product_batches 
            (shop_id, product_id, batch_number, expiry_date, stock_quantity, purchase_price, sale_price)
            VALUES ($1, $2, $3, $4, $5, $6, $7);
          `, [
            shopId,
            prodRes.rows[0].id,
            `BT-${Math.floor(1000 + Math.random() * 9000)}`,
            expStr,
            10,
            Number(drug.purchase_price_single) || 0,
            Number(drug.sale_price_single) || 0
          ]);

          shopAdded++;
        }
      }
      console.log(`✅ Shop ${shop.name} populated with ${shopAdded} new medicines.`);
    }

    console.log("\n=======================================================");
    console.log("🎉 MASTER DRUG REGISTRY & PHARMACY DATA SEEDING COMPLETE!");
    console.log("=======================================================");

  } catch (err) {
    console.error("❌ Fatal Error:", err.message);
  } finally {
    await client.end();
  }
}

main();
