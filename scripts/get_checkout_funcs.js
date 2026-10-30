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
  const res = await client.query(`
    SELECT p.proname, pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname LIKE '%checkout%';
  `);
  console.log('Checkout functions found:', res.rows.map(r => r.proname));
  if (res.rows.length > 0) {
    console.log(res.rows[0].def);
  }
  await client.end();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
