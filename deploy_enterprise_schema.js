const fs = require("fs");
const path = require("path");
const { Client } = require('pg');

function loadEnvLocal() {
  const envPath = path.join(__dirname, ".env.local");
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

const connectionString =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("Error: Database connection string not found in environment variables.");
  process.exit(1);
}

async function deploySchema() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    const sqlFiles = ['enterprise_schema.sql'];
    
    for (const file of sqlFiles) {
        if (fs.existsSync(file)) {
            const sql = fs.readFileSync(file, 'utf8');
            console.log(`Executing ${file}...`);
            await client.query(sql);
            console.log(`Successfully executed ${file}`);
        } else {
            console.log(`File not found: ${file}`);
        }
    }
    
  } catch (err) {
    console.error('Error executing schema:', err);
  } finally {
    await client.end();
  }
}

deploySchema();
