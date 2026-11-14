const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

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

const SHOP_ID = "97f7a570-2e51-4aae-b0f1-01b62fe353e6"; // Khan G Resturant

async function importMenu() {
  const isNeon = dbUrl.includes("neon.tech") || dbUrl.includes("sslmode=require");
  const client = new Client({
    connectionString: dbUrl,
    ssl: isNeon ? { rejectUnauthorized: false } : false,
  });

  console.log("Connecting to Neon PostgreSQL...");
  await client.connect();
  console.log("Connected successfully to Neon DB!");

  // 1. Read Excel Menu File
  const excelPath = path.resolve(__dirname, "../Khan Restaurant Menu.xlsx");
  if (!fs.existsSync(excelPath)) {
    throw new Error("File not found: " + excelPath);
  }

  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets["Menu"];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // Rows start at index 7 (row 8 in Excel)
  const items = [];
  for (let i = 7; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || !row[0] || !row[1]) continue;
    const category = String(row[0]).trim();
    const name = String(row[1]).trim();
    const half = row[2] != null ? Number(row[2]) : null;
    const full = row[3] != null ? Number(row[3]) : null;
    items.push({ category, name, half, full });
  }

  console.log(`Read ${items.length} dishes from Khan Restaurant Menu.xlsx`);

  const uniqueCategories = [...new Set(items.map((x) => x.category))];
  console.log(`Found ${uniqueCategories.length} categories.`);

  try {
    await client.query("BEGIN;");

    console.log("\n--- STEP 1: CLEANING PREVIOUS DATA & ZEROING BALANCES ---");
    const cleanupQueries = [
      "DELETE FROM public.kitchen_orders WHERE shop_id = $1;",
      "DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM public.invoices WHERE shop_id = $1);",
      "DELETE FROM public.invoices WHERE shop_id = $1;",
      "DELETE FROM public.journal_lines WHERE entry_id IN (SELECT id FROM public.journal_entries WHERE shop_id = $1);",
      "DELETE FROM public.journal_entries WHERE shop_id = $1;",
      "DELETE FROM public.product_recipes WHERE parent_product_id IN (SELECT id FROM public.products WHERE shop_id = $1) OR ingredient_product_id IN (SELECT id FROM public.products WHERE shop_id = $1);",
      "DELETE FROM public.restaurant_menu_sizes WHERE shop_id = $1;",
      "DELETE FROM public.restaurant_deal_items WHERE deal_id IN (SELECT id FROM public.restaurant_deals WHERE shop_id = $1);",
      "DELETE FROM public.restaurant_deals WHERE shop_id = $1;",
      "DELETE FROM public.product_batches WHERE product_id IN (SELECT id FROM public.products WHERE shop_id = $1);",
      "DELETE FROM public.products WHERE shop_id = $1;",
      "DELETE FROM public.categories WHERE shop_id = $1;",
      "UPDATE public.cash_accounts SET current_balance = 0 WHERE shop_id = $1;",
      "UPDATE public.parties SET current_balance = 0 WHERE shop_id = $1;",
      "UPDATE public.shops SET referral_credits = 0 WHERE id = $1;"
    ];

    for (const q of cleanupQueries) {
      await client.query(q, [SHOP_ID]);
    }
    console.log("Cleaned old test sales, products, and reset balances to zero.");

    console.log("\n--- STEP 2: CREATING CATEGORIES ---");
    const categoryMap = {};
    for (const catName of uniqueCategories) {
      const res = await client.query(`
        INSERT INTO public.categories (shop_id, name, created_at)
        VALUES ($1, $2, now())
        RETURNING id;
      `, [SHOP_ID, catName]);
      categoryMap[catName] = res.rows[0].id;
    }
    console.log(`Inserted ${Object.keys(categoryMap).length} categories.`);

    console.log("\n--- STEP 3: CREATING PRODUCTS & SIZES ---");
    let insertedProducts = 0;
    let insertedSizes = 0;

    for (const item of items) {
      const categoryId = categoryMap[item.category];
      const hasHalf = item.half != null && !isNaN(item.half);
      const hasFull = item.full != null && !isNaN(item.full);

      // Determine default sale price
      let defaultPrice = 0;
      if (hasFull) {
        defaultPrice = item.full;
      } else if (hasHalf) {
        defaultPrice = item.half;
      }

      // Insert product
      const prodRes = await client.query(`
        INSERT INTO public.products (
          shop_id, category_id, name,
          sale_price_single, purchase_price_single,
          current_stock, unit,
          is_ingredient, show_in_restaurant_pos, not_discounted,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3,
          $4, 0,
          0, null,
          false, true, false,
          now(), now()
        )
        RETURNING id;
      `, [SHOP_ID, categoryId, item.name, defaultPrice]);

      const productId = prodRes.rows[0].id;
      insertedProducts++;

      // If item has both Half and Full, create sizes in restaurant_menu_sizes
      if (hasHalf && hasFull) {
        // Size: Half
        await client.query(`
          INSERT INTO public.restaurant_menu_sizes (
            shop_id, product_id, size_name, price, is_available, sort_order, created_at
          ) VALUES ($1, $2, 'Half', $3, true, 0, now());
        `, [SHOP_ID, productId, item.half]);
        insertedSizes++;

        // Size: Full
        await client.query(`
          INSERT INTO public.restaurant_menu_sizes (
            shop_id, product_id, size_name, price, is_available, sort_order, created_at
          ) VALUES ($1, $2, 'Full', $3, true, 1, now());
        `, [SHOP_ID, productId, item.full]);
        insertedSizes++;
      }
    }

    console.log(`Successfully created ${insertedProducts} products/dishes!`);
    console.log(`Successfully created ${insertedSizes} menu sizes (Half / Full)!`);

    await client.query("COMMIT;");
    console.log("\n=== ALL MENU DATA SUCCESSFULLY IMPORTED AND COMMITTED TO NEON DB ===");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("IMPORT FAILED! Rolled back transaction.", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

importMenu().catch(console.error);
