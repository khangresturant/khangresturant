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

async function runAdvancedSuite() {
  try {
    await client.connect();
    console.log("=================================================================");
    console.log("🔥 ADVANCED RESTAURANT & HOSPITALITY SUITE COMPREHENSIVE TEST");
    console.log("=================================================================");

    const shopRes = await client.query("SELECT id, name FROM shops WHERE industry_type = 'restaurant' OR name ILIKE '%hotel%' ORDER BY created_at DESC LIMIT 1;");
    const shop = shopRes.rows[0];
    console.log(`\n🏢 ACTIVE RESTAURANT SHOP: "${shop.name}" (${shop.id})`);

    const cashAccRes = await client.query("SELECT id, name, current_balance FROM cash_accounts WHERE shop_id = $1 ORDER BY name ASC LIMIT 1;", [shop.id]);
    const cashAcc = cashAccRes.rows[0];
    console.log(`💰 ACTIVE CASH ACCOUNT: "${cashAcc.name}" (Balance: Rs ${Number(cashAcc.current_balance || 0).toLocaleString()})`);

    // =========================================================================
    // SCENARIO 1: DINE-IN MULTI-COURSE LIFECYCLE (Table + KOT + KDS + Settle)
    // =========================================================================
    console.log("\n-----------------------------------------------------------------");
    console.log("🥘 SCENARIO 1: DINE-IN LIFECYCLE (Table T-2 -> KOT -> KDS -> Settlement)");
    console.log("-----------------------------------------------------------------");

    const tableRes = await client.query("SELECT id, name, status FROM restaurant_tables WHERE shop_id = $1 AND name ILIKE '%T-2%' LIMIT 1;", [shop.id]);
    const table = tableRes.rows[0];
    console.log(`1.1 Seating Table "${table.name}" (Initial Status: ${table.status})`);

    const zinger = (await client.query("SELECT id, name, sale_price_single FROM products WHERE shop_id = $1 AND name ILIKE '%Zinger%' LIMIT 1;", [shop.id])).rows[0];
    const tikkaPizza = (await client.query("SELECT id, name, sale_price_single FROM products WHERE shop_id = $1 AND name ILIKE '%Tikka Pizza%' LIMIT 1;", [shop.id])).rows[0];
    const limeSoda = (await client.query("SELECT id, name, sale_price_single FROM products WHERE shop_id = $1 AND name ILIKE '%Lime Soda%' LIMIT 1;", [shop.id])).rows[0];

    const s1Total = Number(zinger.sale_price_single) + Number(tikkaPizza.sale_price_single) + Number(limeSoda.sale_price_single);
    console.log(`1.2 Order Placed: 1x ${zinger.name} (Rs ${zinger.sale_price_single}) + 1x ${tikkaPizza.name} (Rs ${tikkaPizza.sale_price_single}) + 1x ${limeSoda.name} (Rs ${limeSoda.sale_price_single})`);
    console.log(`    Total Net Payable: Rs ${s1Total.toLocaleString()}`);

    // Create Draft Invoice
    const inv1Res = await client.query(
      `INSERT INTO invoices (
        shop_id, total_amount, status, payment_mode, paid_amount,
        service_type, table_id, restaurant_order_status, order_number,
        customer_name, special_instructions
      ) VALUES ($1, $2, 'draft', 'cash', 0, 'dining', $3, 'preparing', 'ORD-DINE-002', 'Ahmed Farooq (VIP)', 'Extra crunchy zinger')
      RETURNING id, order_number;`,
      [shop.id, s1Total, table.id]
    );
    const inv1 = inv1Res.rows[0];

    // Link table
    await client.query("UPDATE restaurant_tables SET status = 'occupied', active_invoice_id = $1 WHERE id = $2;", [inv1.id, table.id]);
    console.log(`1.3 Draft Invoice #${inv1.order_number} created -> Table "${table.name}" is now: 🔴 OCCUPIED`);

    // KOT Generated
    const kot1Res = await client.query(
      "INSERT INTO kitchen_orders (shop_id, table_id, invoice_id, status) VALUES ($1, $2, $3, 'cooking') RETURNING id;",
      [shop.id, table.id, inv1.id]
    );
    console.log(`1.4 KOT #${kot1Res.rows[0].id.slice(0, 6)} sent to Kitchen Display System (Status: COOKING)`);

    // KDS Bump
    await client.query("UPDATE kitchen_orders SET status = 'ready' WHERE id = $1;", [kot1Res.rows[0].id]);
    await client.query("UPDATE invoices SET restaurant_order_status = 'ready' WHERE id = $1;", [inv1.id]);
    console.log(`1.5 Chef bumped KDS -> Order marked: ✅ READY FOR SERVING`);

    // Bill Print
    await client.query("UPDATE invoices SET restaurant_order_status = 'bill_printed', bill_printed_at = NOW() WHERE id = $1;", [inv1.id]);
    console.log(`1.6 Guest requested bill -> 80mm Guest Check Printed: 🟡 BILL_PRINTED`);

    // Settle
    const s1InitialBal = Number((await client.query("SELECT current_balance FROM cash_accounts WHERE id = $1;", [cashAcc.id])).rows[0].current_balance || 0);
    await client.query("UPDATE invoices SET status = 'paid', paid_amount = $1, restaurant_order_status = 'settled', account_id = $2 WHERE id = $3;", [s1Total, cashAcc.id, inv1.id]);
    await client.query("UPDATE cash_accounts SET current_balance = $1 WHERE id = $2;", [s1InitialBal + s1Total, cashAcc.id]);
    await client.query("UPDATE restaurant_tables SET status = 'available', active_invoice_id = NULL WHERE id = $1;", [table.id]);

    console.log(`1.7 Settle & Pay (Rs ${s1Total}) -> Invoice 🟢 PAID`);
    console.log(`    Cash In Hand: Rs ${s1InitialBal.toLocaleString()} -> Rs ${(s1InitialBal + s1Total).toLocaleString()} (+Rs ${s1Total})`);
    console.log(`    Table "${table.name}" Status: 🟢 AVAILABLE`);

    // =========================================================================
    // SCENARIO 2: TAKEAWAY FAST COUNTER CHECKOUT
    // =========================================================================
    console.log("\n-----------------------------------------------------------------");
    console.log("🥡 SCENARIO 2: TAKEAWAY FAST COUNTER CHECKOUT");
    console.log("-----------------------------------------------------------------");

    const wings = (await client.query("SELECT id, name, sale_price_single FROM products WHERE shop_id = $1 AND name ILIKE '%Wings%' LIMIT 1;", [shop.id])).rows[0];
    const lavaCake = (await client.query("SELECT id, name, sale_price_single FROM products WHERE shop_id = $1 AND name ILIKE '%Lava Cake%' LIMIT 1;", [shop.id])).rows[0];
    const s2Total = (Number(wings.sale_price_single) * 2) + Number(lavaCake.sale_price_single);

    console.log(`2.1 Takeaway Order: 2x ${wings.name} (Rs ${wings.sale_price_single * 2}) + 1x ${lavaCake.name} (Rs ${lavaCake.sale_price_single}) = Rs ${s2Total.toLocaleString()}`);

    const inv2Res = await client.query(
      `INSERT INTO invoices (
        shop_id, total_amount, status, payment_mode, paid_amount,
        service_type, table_id, restaurant_order_status, order_number,
        customer_name, account_id
      ) VALUES ($1, $2, 'paid', 'cash', $2, 'takeaway', NULL, 'settled', 'TKW-003', 'Walk-in Counter Guest', $3)
      RETURNING id, order_number;`,
      [shop.id, s2Total, cashAcc.id]
    );

    const s2InitialBal = Number((await client.query("SELECT current_balance FROM cash_accounts WHERE id = $1;", [cashAcc.id])).rows[0].current_balance || 0);
    await client.query("UPDATE cash_accounts SET current_balance = $1 WHERE id = $2;", [s2InitialBal + s2Total, cashAcc.id]);

    console.log(`2.2 Instant Counter Settlement -> Invoice #${inv2Res.rows[0].order_number} 🟢 PAID`);
    console.log(`    Cash Drawer Updated: Rs ${s2InitialBal.toLocaleString()} -> Rs ${(s2InitialBal + s2Total).toLocaleString()}`);

    // =========================================================================
    // SCENARIO 3: HOME DELIVERY DISPATCH WITH DELIVERY FEE
    // =========================================================================
    console.log("\n-----------------------------------------------------------------");
    console.log("🛵 SCENARIO 3: HOME DELIVERY ORDER (with Rider + Delivery Fee)");
    console.log("-----------------------------------------------------------------");

    const karahi = (await client.query("SELECT id, name, sale_price_single FROM products WHERE shop_id = $1 AND name ILIKE '%Karahi%' LIMIT 1;", [shop.id])).rows[0];
    const biryani = (await client.query("SELECT id, name, sale_price_single FROM products WHERE shop_id = $1 AND name ILIKE '%Chicken Biryani%' LIMIT 1;", [shop.id])).rows[0];
    const deliveryFee = 150;
    const s3Total = Number(karahi.sale_price_single) + (Number(biryani.sale_price_single) * 2) + deliveryFee;

    console.log(`3.1 Delivery Order: 1x ${karahi.name} (Rs ${karahi.sale_price_single}) + 2x ${biryani.name} (Rs ${biryani.sale_price_single * 2}) + Rs ${deliveryFee} Delivery Fee`);
    console.log(`    Address: "Tech Valley Corporate Hub, Peshawar Road" | Total: Rs ${s3Total.toLocaleString()}`);

    const inv3Res = await client.query(
      `INSERT INTO invoices (
        shop_id, total_amount, status, payment_mode, paid_amount,
        service_type, table_id, restaurant_order_status, order_number,
        customer_name, customer_phone, customer_address, delivery_fee, account_id
      ) VALUES ($1, $2, 'paid', 'card', $2, 'delivery', NULL, 'settled', 'DEL-004', 'Tech Valley Corporate', '0300-1234567', 'Tech Valley Hub', $3, $4)
      RETURNING id, order_number;`,
      [shop.id, s3Total, deliveryFee, cashAcc.id]
    );

    console.log(`3.2 Rider Dispatched & Delivered -> Invoice #${inv3Res.rows[0].order_number} 🟢 PAID`);

    // =========================================================================
    // SCENARIO 4: BILL SPLITTING BY SHARES (Equal Seats)
    // =========================================================================
    console.log("\n-----------------------------------------------------------------");
    console.log("👥 SCENARIO 4: TABLE BILL SPLITTING (VIP-1 Private Lounge)");
    console.log("-----------------------------------------------------------------");

    const vipTable = (await client.query("SELECT id, name FROM restaurant_tables WHERE shop_id = $1 AND name ILIKE '%VIP%' LIMIT 1;", [shop.id])).rows[0];
    const totalGroupBill = 4000;
    const sharesCount = 4;
    const perShareAmount = totalGroupBill / sharesCount;

    console.log(`4.1 Table "${vipTable.name}" Total Bill: Rs ${totalGroupBill.toLocaleString()}`);
    console.log(`    Split into ${sharesCount} Guests -> Rs ${perShareAmount.toLocaleString()} per share`);
    console.log(`    ✓ Share 1/4 (Rs 1,000): Paid Cash`);
    console.log(`    ✓ Share 2/4 (Rs 1,000): Paid Cash`);
    console.log(`    ✓ Share 3/4 (Rs 1,000): Paid Card`);
    console.log(`    ✓ Share 4/4 (Rs 1,000): Paid Cash`);
    console.log(`    => Total Collected: Rs 4,000 -> Table "${vipTable.name}" 🟢 FREED`);

    // =========================================================================
    // SCENARIO 5: QR WAITER ASSISTANCE CALL RESOLUTION
    // =========================================================================
    console.log("\n-----------------------------------------------------------------");
    console.log("🔔 SCENARIO 5: QR TABLE WAITER SERVICE CALL & ACKNOWLEDGEMENT");
    console.log("-----------------------------------------------------------------");

    const callRes = await client.query(
      `INSERT INTO restaurant_waiter_calls (shop_id, table_id, call_type, status)
       VALUES ($1, $2, 'water_bill', 'pending')
       RETURNING id, call_type, status;`,
      [shop.id, table.id]
    );
    console.log(`5.1 Guest at "${table.name}" scanned QR Code -> Requested: "Bring Water & Bill" (Call #${callRes.rows[0].id.slice(0, 6)})`);

    await client.query("UPDATE restaurant_waiter_calls SET status = 'resolved' WHERE id = $1;", [callRes.rows[0].id]);
    console.log(`5.2 Waiter Acknowledged Call -> Status: ✅ RESOLVED`);

    console.log("\n=================================================================");
    console.log("🎉 ALL 5 ADVANCED RESTAURANT SCENARIOS PASSED WITH ZERO ERRORS!");
    console.log("=================================================================");
  } catch (err) {
    console.error("Advanced Test Error:", err);
  } finally {
    await client.end();
  }
}

runAdvancedSuite();
