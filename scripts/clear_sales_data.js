const { Pool } = require("pg");
require("dotenv").config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function clearSalesData() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("[1/6] Clearing active orders from dining tables...");
    const tablesRes = await client.query("UPDATE restaurant_tables SET active_invoice_id = NULL WHERE active_invoice_id IS NOT NULL");
    console.log(`  -> Cleared ${tablesRes.rowCount} table assignments.`);

    console.log("[2/6] Deleting kitchen order items and tickets...");
    const koiRes = await client.query("DELETE FROM kitchen_order_items");
    console.log(`  -> Deleted ${koiRes.rowCount} kitchen order items.`);
    const koRes = await client.query("DELETE FROM kitchen_orders");
    console.log(`  -> Deleted ${koRes.rowCount} kitchen orders.`);

    console.log("[3/6] Deleting invoice items...");
    const iiRes = await client.query("DELETE FROM invoice_items");
    console.log(`  -> Deleted ${iiRes.rowCount} invoice items.`);

    console.log("[4/6] Deleting journal lines and entries...");
    const jlRes = await client.query("DELETE FROM journal_lines");
    console.log(`  -> Deleted ${jlRes.rowCount} journal lines.`);
    const jeRes = await client.query("DELETE FROM journal_entries");
    console.log(`  -> Deleted ${jeRes.rowCount} journal entries.`);

    console.log("[5/6] Deleting invoices (sales bills)...");
    const invRes = await client.query("DELETE FROM invoices");
    console.log(`  -> Deleted ${invRes.rowCount} invoices.`);

    await client.query("COMMIT");
    console.log("[6/6] Sales data successfully reset to ZERO!");

    // Verification
    const prods = await client.query("SELECT count(*)::int as c FROM products");
    const cats = await client.query("SELECT count(*)::int as c FROM categories");
    const sizes = await client.query("SELECT count(*)::int as c FROM restaurant_menu_sizes");
    const invs = await client.query("SELECT count(*)::int as c FROM invoices");
    const kos = await client.query("SELECT count(*)::int as c FROM kitchen_orders");
    const jes = await client.query("SELECT count(*)::int as c FROM journal_entries");

    console.log("=== VERIFICATION ===");
    console.log(`Invoices: ${invs.rows[0].c}`);
    console.log(`Kitchen Orders: ${kos.rows[0].c}`);
    console.log(`Journal Entries: ${jes.rows[0].c}`);
    console.log(`Products (Intact): ${prods.rows[0].c}`);
    console.log(`Categories (Intact): ${cats.rows[0].c}`);
    console.log(`Menu Sizes (Intact): ${sizes.rows[0].c}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Transaction rolled back due to error:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

clearSalesData().catch(console.error);
