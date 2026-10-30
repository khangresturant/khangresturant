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

const SHOP_ID = "927fa7f6-17a4-4b29-bd4b-269856550c77"; // Faizan Mobile Parts & Accessories (mfaizan28122000@gmail.com)
const CATEGORY_NAME = "Keypad LCD";

const productsList = [
  // Page 1
  { name: "SPORTS 1 15pin 2.4 Lcd", purchase_price: 215, sale_price: 270, stock: 19 },
  { name: "H100 15pin 2.4 Lcd", purchase_price: 215, sale_price: 270, stock: 13 },
  { name: "E4 2020 19pin 2.4 Lcd", purchase_price: 215, sale_price: 270, stock: 17 },
  { name: "itel i510 15pin 2.4 Lcd", purchase_price: 240, sale_price: 270, stock: 7 },
  { name: "C251 2.4 Lcd", purchase_price: 230, sale_price: 250, stock: 1 },
  { name: "Nokia 206 Lcd", purchase_price: 290, sale_price: 350, stock: 6 },
  { name: "Jazz digit 16pin 2.4 Lcd", purchase_price: 310, sale_price: 350, stock: 3 },
  { name: "Nokia 220 Lcd", purchase_price: 270, sale_price: 350, stock: 7 },
  { name: "CALME C8 2.4 Lcd", purchase_price: 235, sale_price: 250, stock: 6 },
  { name: "D76 17pin 2.8 Lcd", purchase_price: 300, sale_price: 350, stock: 8 },
  { name: "R750 2.8 Lcd", purchase_price: 305, sale_price: 350, stock: 3 },
  { name: "Jazz digit 25pin 2.8 Lcd", purchase_price: 313, sale_price: 350, stock: 8 },
  { name: "itel 37pin 2.8 Lcd", purchase_price: 300, sale_price: 350, stock: 4 },
  { name: "itel i5095 18pin 2.8 Lcd", purchase_price: 305, sale_price: 350, stock: 3 },
  { name: "E4 2020 19pin 2.8 Lcd", purchase_price: 318, sale_price: 350, stock: 2 },
  { name: "Nokia 216 Lcd", purchase_price: 280, sale_price: 350, stock: 11 },
  { name: "Nokia 3310 Lcd", purchase_price: 285, sale_price: 350, stock: 4 },
  { name: "itel i5095 18pin 2.4 Lcd", purchase_price: 230, sale_price: 280, stock: 3 },
  { name: "D76 17pin 2.4 Lcd", purchase_price: 235, sale_price: 280, stock: 14 },
  { name: "ETACHI mega king 20pin 2.8 Lcd", purchase_price: 310, sale_price: 350, stock: 4 },
  { name: "B65 14pin 2.4 Lcd", purchase_price: 218, sale_price: 270, stock: 5 },
  { name: "Jazz digit 25pin 2.4 Lcd", purchase_price: 235, sale_price: 300, stock: 5 },

  // Page 2
  { name: "itel 2166 2.0 Lcd", purchase_price: 200, sale_price: 250, stock: 3 },
  { name: "itel 37pin 2.4 Lcd", purchase_price: 220, sale_price: 250, stock: 3 },
  { name: "Club 17pin 2.4 Lcd", purchase_price: 250, sale_price: 270, stock: 4 },
  { name: "SL 100 14pin 2.4 Lcd", purchase_price: 215, sale_price: 260, stock: 4 },
  { name: "E1000 New 15pin 2.4 Lcd", purchase_price: 230, sale_price: 270, stock: 9 },
  { name: "M200 15pin 2.4 Lcd", purchase_price: 262, sale_price: 280, stock: 6 },
  { name: "19pin 1.8 Lcd", purchase_price: 160, sale_price: 200, stock: 2 },
  { name: "Nokia 210 Lcd", purchase_price: 280, sale_price: 350, stock: 1 },
  // Nokia 216 China stip is crossed out in notebook
  { name: "ETACHI 16pin 2.4 Lcd", purchase_price: 230, sale_price: 270, stock: 5 },
  { name: "Club 17pin 1.8 Lcd", purchase_price: 160, sale_price: 200, stock: 2 },
  { name: "105 2022 12pin 1.8 Lcd", purchase_price: 157, sale_price: 200, stock: 5 },
  { name: "1.8 Black and White Lcd", purchase_price: 195, sale_price: 200, stock: 4 },
  { name: "Nokia 225/230 Lcd", purchase_price: 330, sale_price: 400, stock: 1 },
  { name: "15pin 1.8 Badsha Lcd", purchase_price: 160, sale_price: 200, stock: 17 }
];

async function run() {
  try {
    await client.connect();
    console.log("Connected to DB.");

    // 1. Get or Create Category
    let catRes = await client.query(
      "SELECT id FROM categories WHERE shop_id = $1 AND name ILIKE $2",
      [SHOP_ID, CATEGORY_NAME]
    );

    let categoryId;
    if (catRes.rows.length > 0) {
      categoryId = catRes.rows[0].id;
      console.log(`Found existing category "${CATEGORY_NAME}" with ID:`, categoryId);
    } else {
      const newCat = await client.query(
        "INSERT INTO categories (shop_id, name, description) VALUES ($1, $2, $3) RETURNING id",
        [SHOP_ID, CATEGORY_NAME, "Keypad Mobile LCD Displays"]
      );
      categoryId = newCat.rows[0].id;
      console.log(`Created new category "${CATEGORY_NAME}" with ID:`, categoryId);
    }

    // 2. Insert or update products
    let insertedCount = 0;
    let updatedCount = 0;

    for (const item of productsList) {
      // Check if product already exists
      const existing = await client.query(
        "SELECT id FROM products WHERE shop_id = $1 AND name ILIKE $2",
        [SHOP_ID, item.name]
      );

      if (existing.rows.length > 0) {
        const prodId = existing.rows[0].id;
        await client.query(`
          UPDATE products 
          SET category_id = $1,
              base_price = $2,
              unit = $3,
              current_stock = $4,
              purchase_price_single = $5,
              sale_price_single = $6,
              purchase_price_pack = $7,
              sale_price_pack = $8,
              pack_size = $9,
              min_stock_level = $10,
              measurement_type = $11,
              updated_at = NOW()
          WHERE id = $12
        `, [
          categoryId,
          item.sale_price,
          'Pcs',
          item.stock,
          item.purchase_price,
          item.sale_price,
          0,
          0,
          1,
          1,
          'standard',
          prodId
        ]);
        console.log(`Updated: ${item.name} (Stock: ${item.stock}, Purchase: ${item.purchase_price}, Sale: ${item.sale_price})`);
        updatedCount++;
      } else {
        await client.query(`
          INSERT INTO products (
            shop_id,
            category_id,
            name,
            unit,
            base_price,
            current_stock,
            purchase_price_single,
            sale_price_single,
            purchase_price_pack,
            sale_price_pack,
            pack_size,
            min_stock_level,
            measurement_type,
            has_imei,
            is_ingredient
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
          )
        `, [
          SHOP_ID,
          categoryId,
          item.name,
          'Pcs',
          item.sale_price,
          item.stock,
          item.purchase_price,
          item.sale_price,
          0,
          0,
          1,
          1, // min_stock_level = 1
          'standard',
          false,
          false
        ]);
        console.log(`Inserted: ${item.name} (Stock: ${item.stock}, Purchase: ${item.purchase_price}, Sale: ${item.sale_price})`);
        insertedCount++;
      }
    }

    console.log(`\n✅ Summary: Added ${insertedCount} new products, Updated ${updatedCount} products into category "${CATEGORY_NAME}" for shop ID: ${SHOP_ID}`);

    // Verify total products in category
    const countCheck = await client.query(
      "SELECT count(*) FROM products WHERE shop_id = $1 AND category_id = $2",
      [SHOP_ID, categoryId]
    );
    console.log(`Total products under "${CATEGORY_NAME}": ${countCheck.rows[0].count}`);

  } catch (err) {
    console.error("Error inserting products:", err);
  } finally {
    await client.end();
  }
}

run();
