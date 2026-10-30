const { Client } = require('pg');
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Set SUPABASE_DB_URL or DATABASE_URL');
  process.exit(1);
}

async function migrate() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to DB');
    const sql = `
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS has_payroll BOOLEAN DEFAULT false;
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS has_tax BOOLEAN DEFAULT false;
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS has_assets_rec BOOLEAN DEFAULT false;
      NOTIFY pgrst, 'reload schema';
    `;
    await client.query(sql);
    console.log('Success');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
migrate();
