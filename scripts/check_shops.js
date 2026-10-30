const fs = require("fs");
const path = require("path");
const { Client } = require('pg');

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

if (!connectionString) {
  console.error("Error: Database connection string not found in environment variables.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: false
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to database.");
    const res = await client.query("SELECT id, name, industry_type, created_at FROM shops ORDER BY created_at DESC LIMIT 10;");
    console.log("Shops in database:", res.rows);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
}

run();
