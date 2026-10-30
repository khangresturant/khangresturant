const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const SHOP_ID = "dec5f88e-ccd2-497f-a157-dc202192b84f";

async function exportAuditData() {
  await client.connect();
  const res = await client.query(`
    SELECT 
      p.id,
      p.name,
      p.code,
      p.unit,
      p.pack_size,
      p.purchase_price_single,
      p.sale_price_single,
      p.current_stock,
      p.note,
      COALESCE(b.name, 'Other') as brand,
      COALESCE(c.name, 'General') as category
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.shop_id = $1
    ORDER BY b.name, c.name, p.code, p.name
  `, [SHOP_ID]);

  const outDir = path.join(__dirname, "../scratch");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "audit_data.json"), JSON.stringify(res.rows, null, 2));
  console.log(`Exported ${res.rows.length} products to scratch/audit_data.json`);
  await client.end();
}

exportAuditData();
