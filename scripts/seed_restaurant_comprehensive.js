const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

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
const client = new Client({ connectionString, ssl: false });

async function seed() {
  try {
    await client.connect();
    console.log("Connected to PostgreSQL database.");

    // Find all restaurant shops
    const shopsRes = await client.query("SELECT id, name, industry_type FROM shops WHERE industry_type = 'restaurant' OR name ILIKE '%hotel%' OR name ILIKE '%rotti%' ORDER BY created_at DESC;");
    let restaurantShops = shopsRes.rows;

    if (restaurantShops.length === 0) {
      console.log("No restaurant shops found. Seeding to latest shop...");
      const latest = await client.query("SELECT id, name FROM shops ORDER BY created_at DESC LIMIT 1;");
      if (latest.rows.length > 0) {
        restaurantShops = [latest.rows[0]];
      }
    }

    console.log(`Found ${restaurantShops.length} shops to seed restaurant data:`, restaurantShops.map(s => `${s.name} (${s.id})`));

    for (const shop of restaurantShops) {
      const shopId = shop.id;
      console.log(`\n========================================`);
      console.log(`Seeding Shop: ${shop.name} (${shopId})`);
      console.log(`========================================`);

      // 1. Seed Cash Accounts
      const cashCheck = await client.query("SELECT id FROM cash_accounts WHERE shop_id = $1 AND name ILIKE '%Cash in Hand%'", [shopId]);
      let cashAccId = cashCheck.rows[0]?.id;
      if (!cashAccId) {
        const cashRes = await client.query(
          "INSERT INTO cash_accounts (shop_id, name, type, current_balance) VALUES ($1, 'Cash in Hand', 'cash', 50000) RETURNING id;",
          [shopId]
        );
        cashAccId = cashRes.rows[0].id;
        console.log("  + Created Cash in Hand account:", cashAccId);
      } else {
        console.log("  ✓ Cash in Hand exists:", cashAccId);
      }

      const bankCheck = await client.query("SELECT id FROM cash_accounts WHERE shop_id = $1 AND name ILIKE '%Bank%'", [shopId]);
      if (bankCheck.rows.length === 0) {
        await client.query(
          "INSERT INTO cash_accounts (shop_id, name, type, current_balance) VALUES ($1, 'Bank Alfalah Card POS', 'bank', 120000);",
          [shopId]
        );
        console.log("  + Created Bank Alfalah Card POS account");
      }

      // 2. Seed Kitchen Stations
      const stationsList = [
        { name: "Grill & BBQ Station", kitchen_hub: "Main Kitchen", sort_order: 1 },
        { name: "Fryer & Fast Food", kitchen_hub: "Main Kitchen", sort_order: 2 },
        { name: "Pizza & Oven Station", kitchen_hub: "Main Kitchen", sort_order: 3 },
        { name: "Beverages & Bar", kitchen_hub: "Drinks Counter", sort_order: 4 },
        { name: "Dessert & Pastry", kitchen_hub: "Pastry Bar", sort_order: 5 }
      ];

      for (const st of stationsList) {
        try {
          const check = await client.query("SELECT id FROM restaurant_stations WHERE shop_id = $1 AND name = $2", [shopId, st.name]);
          if (check.rows.length === 0) {
            await client.query(
              "INSERT INTO restaurant_stations (shop_id, name, kitchen_hub, sort_order, is_active) VALUES ($1, $2, $3, $4, true);",
              [shopId, st.name, st.kitchen_hub, st.sort_order]
            );
            console.log(`  + Kitchen Station added: ${st.name}`);
          }
        } catch (e) {}
      }

      // 3. Seed Dining Tables across multiple floors
      const tablesList = [
        { name: "T-1 (Ground)", capacity: 4, floor_name: "Ground Floor", section_name: "Family Hall", status: "available" },
        { name: "T-2 (Ground)", capacity: 2, floor_name: "Ground Floor", section_name: "Couples", status: "available" },
        { name: "T-3 (Ground)", capacity: 6, floor_name: "Ground Floor", section_name: "Family Hall", status: "available" },
        { name: "T-4 (Ground)", capacity: 4, floor_name: "Ground Floor", section_name: "Main Hall", status: "available" },
        { name: "F-1 (1st Floor)", capacity: 4, floor_name: "1st Floor", section_name: "Lounge", status: "available" },
        { name: "F-2 (1st Floor)", capacity: 8, floor_name: "1st Floor", section_name: "Executive Hall", status: "available" },
        { name: "R-1 (Rooftop)", capacity: 4, floor_name: "Rooftop", section_name: "Open Sky", status: "available" },
        { name: "R-2 (Rooftop)", capacity: 6, floor_name: "Rooftop", section_name: "Open Sky", status: "available" },
        { name: "VIP-1 (Private)", capacity: 10, floor_name: "VIP Lounge", section_name: "Private Dining", status: "available" }
      ];

      for (const tab of tablesList) {
        const check = await client.query("SELECT id FROM restaurant_tables WHERE shop_id = $1 AND name = $2", [shopId, tab.name]);
        if (check.rows.length === 0) {
          try {
            await client.query(
              "INSERT INTO restaurant_tables (shop_id, name, capacity, status, floor_name, section_name) VALUES ($1, $2, $3, $4, $5, $6);",
              [shopId, tab.name, tab.capacity, tab.status, tab.floor_name, tab.section_name]
            );
            console.log(`  + Table added: ${tab.name} (${tab.floor_name})`);
          } catch (err) {
            await client.query(
              "INSERT INTO restaurant_tables (shop_id, name, capacity, status) VALUES ($1, $2, $3, $4);",
              [shopId, tab.name, tab.capacity, tab.status]
            );
            console.log(`  + Table added (base): ${tab.name}`);
          }
        }
      }

      // 4. Seed Food Categories
      const categoriesList = [
        "Fast Food & Burgers",
        "Pizza & Calzones",
        "Karahi & Handi",
        "BBQ & Grills",
        "Rice & Biryani",
        "Hot & Cold Drinks",
        "Desserts & Sweets",
        "Raw Ingredients & Meat"
      ];

      const categoryMap = {};
      for (const catName of categoriesList) {
        let check = await client.query("SELECT id FROM categories WHERE shop_id = $1 AND name = $2", [shopId, catName]);
        if (check.rows.length === 0) {
          const res = await client.query("INSERT INTO categories (shop_id, name) VALUES ($1, $2) RETURNING id;", [shopId, catName]);
          categoryMap[catName] = res.rows[0].id;
          console.log(`  + Category added: ${catName}`);
        } else {
          categoryMap[catName] = check.rows[0].id;
        }
      }

      // 5. Seed Raw Material Ingredients
      const rawIngredients = [
        { name: "Burger Bun (Fresh Bakery)", cost: 35, unit: "piece", stock: 500 },
        { name: "Zinger Chicken Patty (Marinated)", cost: 180, unit: "piece", stock: 350 },
        { name: "Beef Smash Patty (150g)", cost: 220, unit: "piece", stock: 200 },
        { name: "Mozzarella Cheese (Grated)", cost: 15, unit: "gram", stock: 50000 },
        { name: "Pizza Dough Ball (Large)", cost: 80, unit: "piece", stock: 200 },
        { name: "Boneless Chicken Breast (Cubed)", cost: 650, unit: "kg", stock: 100 },
        { name: "Desi Ghee Pure", cost: 1200, unit: "kg", stock: 50 },
        { name: "Basmati Sella Rice Super", cost: 320, unit: "kg", stock: 250 },
        { name: "Mayo Garlic Sauce", cost: 8, unit: "gram", stock: 20000 },
        { name: "Takeaway Packaging Box", cost: 25, unit: "piece", stock: 1000 }
      ];

      const rawProductMap = {};
      for (const raw of rawIngredients) {
        const catId = categoryMap["Raw Ingredients & Meat"];
        const check = await client.query("SELECT id FROM products WHERE shop_id = $1 AND name = $2", [shopId, raw.name]);
        if (check.rows.length === 0) {
          const res = await client.query(
            "INSERT INTO products (shop_id, name, category_id, sale_price_single, purchase_price_single, current_stock, unit) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;",
            [shopId, raw.name, catId, raw.cost, raw.cost, raw.stock, raw.unit]
          );
          rawProductMap[raw.name] = res.rows[0].id;
          console.log(`  + Raw Ingredient added: ${raw.name} (${raw.stock} ${raw.unit})`);
        } else {
          rawProductMap[raw.name] = check.rows[0].id;
        }
      }

      // 6. Seed Finished Dishes & Menu Products
      const menuProducts = [
        { name: "Special Zinger Burger", cat: "Fast Food & Burgers", sale: 550, cost: 300, stock: 150 },
        { name: "Double Beef Smash Burger", cat: "Fast Food & Burgers", sale: 750, cost: 420, stock: 100 },
        { name: "Crispy Chicken Wings (6 Pcs)", cat: "Fast Food & Burgers", sale: 450, cost: 240, stock: 80 },
        { name: "Chicken Fajita Pizza", cat: "Pizza & Calzones", sale: 1450, cost: 750, stock: 120 },
        { name: "Chicken Tikka Pizza", cat: "Pizza & Calzones", sale: 1350, cost: 700, stock: 120 },
        { name: "Special Stuffed Cheese Calzone", cat: "Pizza & Calzones", sale: 950, cost: 500, stock: 60 },
        { name: "Mutton Desi Ghee Karahi (1 KG)", cat: "Karahi & Handi", sale: 2800, cost: 1800, stock: 50 },
        { name: "Chicken White Handi", cat: "Karahi & Handi", sale: 1600, cost: 950, stock: 75 },
        { name: "Chicken Malai Boti Plate", cat: "BBQ & Grills", sale: 750, cost: 400, stock: 90 },
        { name: "Beef Seekh Kabab (4 Pcs)", cat: "BBQ & Grills", sale: 650, cost: 350, stock: 90 },
        { name: "Special Chicken Biryani", cat: "Rice & Biryani", sale: 450, cost: 220, stock: 200 },
        { name: "Mutton Dum Pukht Biryani", cat: "Rice & Biryani", sale: 850, cost: 500, stock: 80 },
        { name: "Mint Margarita Cooler", cat: "Hot & Cold Drinks", sale: 250, cost: 80, stock: 300 },
        { name: "Fresh Lime Soda", cat: "Hot & Cold Drinks", sale: 180, cost: 40, stock: 300 },
        { name: "Mineral Water 1.5L", cat: "Hot & Cold Drinks", sale: 120, cost: 70, stock: 500 },
        { name: "Chocolate Lava Cake with Gelato", cat: "Desserts & Sweets", sale: 450, cost: 200, stock: 60 },
        { name: "Gulab Jamun with Rabri", cat: "Desserts & Sweets", sale: 300, cost: 120, stock: 100 }
      ];

      const finishedProductMap = {};
      for (const prod of menuProducts) {
        const catId = categoryMap[prod.cat] || null;
        let check = await client.query("SELECT id FROM products WHERE shop_id = $1 AND name = $2", [shopId, prod.name]);
        let prodId = check.rows[0]?.id;
        if (!prodId) {
          const res = await client.query(
            "INSERT INTO products (shop_id, name, category_id, sale_price_single, purchase_price_single, current_stock, unit) VALUES ($1, $2, $3, $4, $5, $6, 'plate') RETURNING id;",
            [shopId, prod.name, catId, prod.sale, prod.cost, prod.stock]
          );
          prodId = res.rows[0].id;
          console.log(`  + Finished Dish added: ${prod.name} (Rs ${prod.sale})`);

          // If Pizza, add sizes
          if (prod.name.includes("Pizza")) {
            try {
              await client.query(
                "INSERT INTO restaurant_menu_sizes (shop_id, product_id, size_name, price, sort_order, is_available) VALUES " +
                "($1, $2, 'Small 7-inch', $3, 1, true), " +
                "($1, $2, 'Medium 10-inch', $4, 2, true), " +
                "($1, $2, 'Large 13-inch', $5, 3, true);",
                [shopId, prodId, Math.round(prod.sale * 0.55), prod.sale, Math.round(prod.sale * 1.45)]
              );
              console.log(`    -> Added Small, Medium, Large sizes for ${prod.name}`);
            } catch (e) {}
          }
        }
        finishedProductMap[prod.name] = prodId;
      }

      // 7. Seed Recipe BOM (Bill of Materials) for Zinger Burger and Fajita Pizza
      try {
        const zingerId = finishedProductMap["Special Zinger Burger"];
        const bunId = rawProductMap["Burger Bun (Fresh Bakery)"];
        const pattyId = rawProductMap["Zinger Chicken Patty (Marinated)"];
        const mayoId = rawProductMap["Mayo Garlic Sauce"];
        const boxId = rawProductMap["Takeaway Packaging Box"];

        if (zingerId && bunId && pattyId) {
          const checkRecipe = await client.query("SELECT id FROM product_recipes WHERE parent_product_id = $1", [zingerId]);
          if (checkRecipe.rows.length === 0) {
            await client.query(
              "INSERT INTO product_recipes (parent_product_id, ingredient_product_id, quantity) VALUES " +
              "($1, $2, 1), " +
              "($1, $3, 1), " +
              "($1, $4, 25), " +
              "($1, $5, 1);",
              [zingerId, bunId, pattyId, mayoId, boxId]
            );
            console.log("  + Recipe BOM added for Special Zinger Burger (Bun + Patty + Mayo + Box)");
          }
        }
      } catch (e) {
        console.log("  (Recipe BOM skipped:", e.message, ")");
      }

      // 8. Seed Customer Parties
      const partiesList = [
        { name: "Usman Malik (VIP Customer)", phone: "03241974677", type: "customer", balance: 0 },
        { name: "Tech Valley Corporate Client", phone: "03001234567", type: "customer", balance: 0 },
        { name: "Ahmed Farooq (Regular)", phone: "03129876543", type: "customer", balance: 0 }
      ];

      for (const p of partiesList) {
        const check = await client.query("SELECT id FROM parties WHERE shop_id = $1 AND name = $2", [shopId, p.name]);
        if (check.rows.length === 0) {
          await client.query(
            "INSERT INTO parties (shop_id, name, phone, type, current_balance) VALUES ($1, $2, $3, $4, $5);",
            [shopId, p.name, p.phone, p.type, p.balance]
          );
          console.log(`  + Customer party added: ${p.name}`);
        }
      }
    }

    console.log("\n✅ ALL RESTAURANT TEST DATA SUCCESSFULLY SEEDED!");
  } catch (err) {
    console.error("Error during seeding:", err);
  } finally {
    await client.end();
  }
}

seed();
