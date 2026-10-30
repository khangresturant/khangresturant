const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connStr = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const isRemoteSSL = connStr.includes('sslmode=require') || connStr.includes('supabase.co') || connStr.includes('pooler');

const client = new Client({
  connectionString: connStr,
  ssl: isRemoteSSL ? { rejectUnauthorized: false } : false
});

async function check() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'invoice_items';
  `);
  console.log('invoice_items columns:', res.rows.map(r => `${r.column_name} (${r.is_nullable})`));

  // Also check if custom_name column exists
  const hasCustomName = res.rows.some(r => r.column_name === 'custom_name');
  if (!hasCustomName) {
    await client.query(`
      ALTER TABLE public.invoice_items 
        ADD COLUMN IF NOT EXISTS custom_name varchar(255),
        ALTER COLUMN product_id DROP NOT NULL;
    `);
    console.log('Added custom_name and dropped NOT NULL constraint on product_id in invoice_items!');
  } else {
    await client.query(`
      ALTER TABLE public.invoice_items 
        ALTER COLUMN product_id DROP NOT NULL;
    `);
    console.log('Ensured product_id is nullable in invoice_items!');
  }

  await client.end();
}
check().catch(e => { console.error(e); process.exit(1); });
