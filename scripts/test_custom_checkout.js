const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connStr = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const isRemoteSSL = connStr.includes('sslmode=require') || connStr.includes('supabase.co') || connStr.includes('pooler');

const client = new Client({
  connectionString: connStr,
  ssl: isRemoteSSL ? { rejectUnauthorized: false } : false
});

async function testCustomItemCheckout() {
  await client.connect();
  
  // Get an existing shop id
  const shopRes = await client.query(`SELECT id FROM shops LIMIT 1;`);
  const shopId = shopRes.rows[0].id;

  const payload = {
    invoice: {
      shop_id: shopId,
      total_amount: 1000,
      discount_amount: 0,
      tax_amount: 0,
      payment_mode: 'cash',
      status: 'paid'
    },
    items: [
      {
        product_id: null,
        custom_name: 'Test One-Time Inverter AC',
        quantity: 1,
        unit_price: 1000,
        subtotal: 1000,
        stock_qty: 0,
        purchase_price: 800
      }
    ],
    payment: {
      cash_amount: 1000,
      credit_amount: 0,
      gift_card_amount: 0,
      loyalty_points_delta: 0,
      emi_schedules: []
    }
  };

  const res = await client.query(`
    SELECT public.atomic_pos_checkout($1::jsonb, $2::jsonb, $3::jsonb) as result;
  `, [JSON.stringify(payload.invoice), JSON.stringify(payload.items), JSON.stringify(payload.payment)]);

  console.log('Checkout Test Result:', res.rows[0].result);

  // Clean up test invoice
  const testInvId = res.rows[0].result.invoice_id;
  await client.query(`DELETE FROM invoice_items WHERE invoice_id = $1;`, [testInvId]);
  await client.query(`DELETE FROM invoices WHERE id = $1;`, [testInvId]);
  console.log('Cleaned up test invoice successfully!');

  await client.end();
}

testCustomItemCheckout().catch(e => {
  console.error('Test Failed:', e);
  process.exit(1);
});
