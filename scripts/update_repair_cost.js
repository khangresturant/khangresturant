const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connStr = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const isRemoteSSL = connStr.includes('sslmode=require') || connStr.includes('supabase.co') || connStr.includes('pooler');

const client = new Client({
  connectionString: connStr,
  ssl: isRemoteSSL ? { rejectUnauthorized: false } : false
});

async function run() {
  await client.connect();
  console.log('Connected to Postgres');
  await client.query(`
    ALTER TABLE IF EXISTS public.repair_tickets
      ADD COLUMN IF NOT EXISTS customer_name varchar(150),
      ADD COLUMN IF NOT EXISTS customer_phone varchar(50),
      ADD COLUMN IF NOT EXISTS repair_cost numeric(10,2) DEFAULT 0;

    ALTER TABLE IF EXISTS public.repair_tickets
      ALTER COLUMN party_id DROP NOT NULL;
  `);
  console.log('repair_tickets columns updated successfully!');
  await client.end();
}

run().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
