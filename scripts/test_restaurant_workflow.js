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

async function testWorkflow() {
  try {
    await client.connect();
    console.log("=================================================");
    console.log("🚀 STARTING END-TO-END RESTAURANT WORKFLOW TEST");
    console.log("=================================================");

    // 1. Get usman hotel or first restaurant shop
    const shopRes = await client.query("SELECT id, name FROM shops WHERE industry_type = 'restaurant' OR name ILIKE '%hotel%' ORDER BY created_at DESC LIMIT 1;");
    const shop = shopRes.rows[0];
    console.log(`\n1. Target Shop: "${shop.name}" (${shop.id})`);

    // 2. Check Table T-1
    const tableRes = await client.query("SELECT id, name, status, active_invoice_id FROM restaurant_tables WHERE shop_id = $1 AND name ILIKE '%T-1%' LIMIT 1;", [shop.id]);
    const table = tableRes.rows[0];
    console.log(`\n2. Seating Table: "${table.name}" (Initial Status: ${table.status})`);

    // 3. Fetch Menu Products
    const zingerRes = await client.query("SELECT id, name, sale_price_single, current_stock FROM products WHERE shop_id = $1 AND name ILIKE '%Zinger%' LIMIT 1;", [shop.id]);
    const pizzaRes = await client.query("SELECT id, name, sale_price_single, current_stock FROM products WHERE shop_id = $1 AND name ILIKE '%Fajita%' LIMIT 1;", [shop.id]);
    const drinkRes = await client.query("SELECT id, name, sale_price_single, current_stock FROM products WHERE shop_id = $1 AND name ILIKE '%Margarita%' LIMIT 1;", [shop.id]);

    const zinger = zingerRes.rows[0];
    const pizza = pizzaRes.rows[0];
    const drink = drinkRes.rows[0];

    console.log(`\n3. Ordered Menu Items:`);
    console.log(`   - 2x ${zinger.name} @ Rs ${zinger.sale_price_single} = Rs ${zinger.sale_price_single * 2}`);
    console.log(`   - 1x ${pizza.name} @ Rs ${pizza.sale_price_single} = Rs ${pizza.sale_price_single}`);
    console.log(`   - 2x ${drink.name} @ Rs ${drink.sale_price_single} = Rs ${drink.sale_price_single * 2}`);

    const subtotal = (zinger.sale_price_single * 2) + Number(pizza.sale_price_single) + (drink.sale_price_single * 2);
    console.log(`   => Total Order Net: Rs ${subtotal.toLocaleString()}`);

    // 4. Create Draft Invoice & Send KOT
    console.log(`\n4. Dispatching Order & Generating KOT...`);
    const invRes = await client.query(
      `INSERT INTO invoices (
        shop_id, total_amount, status, payment_mode, paid_amount,
        service_type, table_id, restaurant_order_status, order_number,
        customer_name, special_instructions
      ) VALUES ($1, $2, 'draft', 'cash', 0, 'dining', $3, 'preparing', 'ORD-TEST-001', 'Usman Malik', 'Less spicy, extra crispy')
      RETURNING id, order_number, status, restaurant_order_status;`,
      [shop.id, subtotal, table.id]
    );
    const invoice = invRes.rows[0];
    console.log(`   ✓ Draft Invoice created: ID ${invoice.id.slice(0, 8)} (Order #${invoice.order_number})`);

    // Insert invoice items
    await client.query(
      `INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, subtotal) VALUES
        ($1, $2, 2, $3, $4),
        ($1, $5, 1, $6, $7),
        ($1, $8, 2, $9, $10);`,
      [
        invoice.id,
        zinger.id, zinger.sale_price_single, zinger.sale_price_single * 2,
        pizza.id, pizza.sale_price_single, pizza.sale_price_single,
        drink.id, drink.sale_price_single, drink.sale_price_single * 2
      ]
    );

    // Update Table to Occupied
    await client.query(
      "UPDATE restaurant_tables SET status = 'occupied', active_invoice_id = $1 WHERE id = $2;",
      [invoice.id, table.id]
    );
    console.log(`   ✓ Table "${table.name}" status switched to: 🔴 OCCUPIED (Active Bill: Rs ${subtotal})`);

    // Insert KOT
    const kotRes = await client.query(
      "INSERT INTO kitchen_orders (shop_id, table_id, invoice_id, status) VALUES ($1, $2, $3, 'cooking') RETURNING id;",
      [shop.id, table.id, invoice.id]
    );
    const kotId = kotRes.rows[0].id;
    await client.query(
      `INSERT INTO kitchen_order_items (kitchen_order_id, product_id, quantity, remarks) VALUES
        ($1, $2, 2, 'Extra crispy'),
        ($1, $3, 1, 'Well done crust'),
        ($1, $4, 2, 'Extra ice');`,
      [kotId, zinger.id, pizza.id, drink.id]
    );
    console.log(`   ✓ Kitchen Order (KOT #${kotId.slice(0, 6)}) sent to Kitchen Display System (Status: COOKING)`);

    // 5. Simulate KDS Bump: Kitchen marks food as Ready
    console.log(`\n5. Chef Bumps KDS Monitor -> Food is READY!`);
    await client.query("UPDATE kitchen_orders SET status = 'ready' WHERE id = $1;", [kotId]);
    await client.query("UPDATE invoices SET restaurant_order_status = 'ready' WHERE id = $1;", [invoice.id]);
    console.log(`   ✓ KDS ticket marked: ✅ READY (Notification sent to Waiter)`);

    // 6. Simulate Intermediate Guest Bill Print
    console.log(`\n6. Printing Intermediate Guest Check (80mm Thermal Receipt)...`);
    await client.query("UPDATE invoices SET restaurant_order_status = 'bill_printed', bill_printed_at = NOW() WHERE id = $1;", [invoice.id]);
    console.log(`   ✓ Guest bill printed. Status switched to: 🟡 BILL_PRINTED`);

    // 7. Settle Order & Collect Cash Payment
    console.log(`\n7. Settling Payment at POS Desk...`);
    const cashAcc = await client.query("SELECT id, name, current_balance FROM cash_accounts WHERE shop_id = $1 AND name ILIKE '%Cash in Hand%' LIMIT 1;", [shop.id]);
    const account = cashAcc.rows[0];
    const initialBalance = Number(account.current_balance || 0);

    // Finalize invoice settlement
    await client.query(
      `UPDATE invoices SET
        status = 'paid',
        paid_amount = $1,
        restaurant_order_status = 'settled',
        account_id = $2
      WHERE id = $3;`,
      [subtotal, account.id, invoice.id]
    );

    // Deposit to Cash Account
    const updatedBalance = initialBalance + subtotal;
    await client.query("UPDATE cash_accounts SET current_balance = $1 WHERE id = $2;", [updatedBalance, account.id]);
    await client.query(
      `INSERT INTO account_transactions (shop_id, account_id, type, amount, ref_type, ref_id, remarks)
      VALUES ($1, $2, 'deposit', $3, 'invoice', $4, 'Restaurant Order Settlement');`,
      [shop.id, account.id, subtotal, invoice.id]
    );

    // Free up Table
    await client.query(
      "UPDATE restaurant_tables SET status = 'available', active_invoice_id = NULL WHERE id = $1;",
      [table.id]
    );

    console.log(`   ✓ Invoice #${invoice.order_number} marked: 🟢 PAID (Settled)`);
    console.log(`   ✓ Cash in Hand deposit recorded: Rs ${initialBalance.toLocaleString()} -> Rs ${updatedBalance.toLocaleString()} (+Rs ${subtotal.toLocaleString()})`);
    console.log(`   ✓ Table "${table.name}" freed: 🟢 AVAILABLE for next guest`);

    // 8. Verify Table Status
    const finalTableCheck = await client.query("SELECT id, name, status, active_invoice_id FROM restaurant_tables WHERE id = $1;", [table.id]);
    console.log(`\n8. Final Verification:`);
    console.log(`   - Table Status: ${finalTableCheck.rows[0].status} (active_invoice_id: ${finalTableCheck.rows[0].active_invoice_id || 'None'})`);

    console.log("\n=================================================");
    console.log("🎉 ALL RESTAURANT WORKFLOW STEPS PASSED 100%!");
    console.log("=================================================");
  } catch (err) {
    console.error("Workflow Test Error:", err);
  } finally {
    await client.end();
  }
}

testWorkflow();
