const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

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

async function seedCurrencies() {
  const isNeon = dbUrl.includes("neon.tech") || dbUrl.includes("sslmode=require");
  const client = new Client({
    connectionString: dbUrl,
    ssl: isNeon ? { rejectUnauthorized: false } : false,
  });

  console.log("Connecting to Neon PostgreSQL to seed currencies...");
  await client.connect();

  const seedSql = `
    INSERT INTO public.currencies (code, name, symbol) VALUES
      ('PKR', 'Pakistani Rupee', 'Rs'),
      ('USD', 'United States Dollar', '$'),
      ('AED', 'United Arab Emirates Dirham', 'AED'),
      ('SAR', 'Saudi Riyal', 'SAR'),
      ('GBP', 'British Pound Sterling', '£'),
      ('EUR', 'Euro', '€'),
      ('INR', 'Indian Rupee', '₹'),
      ('CAD', 'Canadian Dollar', 'CA$'),
      ('AUD', 'Australian Dollar', 'AU$'),
      ('OMR', 'Omani Rial', 'OMR'),
      ('QAR', 'Qatari Riyal', 'QAR'),
      ('KWD', 'Kuwaiti Dinar', 'KWD'),
      ('BHD', 'Bahraini Dinar', 'BHD')
    ON CONFLICT (code) DO UPDATE SET 
      name = EXCLUDED.name, 
      symbol = EXCLUDED.symbol;
  `;

  try {
    await client.query("BEGIN;");
    await client.query(seedSql);
    await client.query("COMMIT;");
    console.log("Currencies seeded successfully!");

    const res = await client.query("SELECT code, name, symbol FROM public.currencies ORDER BY code;");
    console.log("Current Currencies in Database:");
    console.table(res.rows);
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Failed to seed currencies:", err);
  } finally {
    await client.end();
  }
}

seedCurrencies().catch(console.error);
