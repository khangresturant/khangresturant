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

function cleanText(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePageHtml(html) {
  const products = [];
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return products;

  const tbody = tbodyMatch[1];
  const rowMatches = tbody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  for (const row of rowMatches) {
    const nameBlockMatch = row.match(/<div class="text-sm font-medium text-gray-900">([^<]+)<\/div>[\s\S]*?<div class="[^"]*text-sm text-gray-500[^"]*">([^<]+)<\/div>/i);
    const productName = nameBlockMatch ? cleanText(nameBlockMatch[1]) : "";
    const genericFormula = nameBlockMatch ? cleanText(nameBlockMatch[2]) : "";

    const tdMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    let regNumber = "";
    if (tdMatches[1]) {
      const regMatch = tdMatches[1].match(/>\s*([0-9A-Za-z\-_]+)\s*</);
      if (regMatch) regNumber = cleanText(regMatch[1]);
    }

    let manufacturer = "";
    if (tdMatches[2]) {
      const mMatch = tdMatches[2].match(/<div class="text-sm text-gray-900">([^<]+)<\/div>/i);
      if (mMatch) manufacturer = cleanText(mMatch[1]);
    }

    let category = "";
    if (tdMatches[3]) {
      const catMatch = tdMatches[3].match(/<span[^>]*>([^<]+)<\/span>/i);
      if (catMatch) category = cleanText(catMatch[1]);
    }

    let packSize = "";
    if (tdMatches[4]) {
      packSize = cleanText(tdMatches[4].replace(/<[^>]+>/g, " ").trim());
    }

    let price = 0;
    if (tdMatches[5]) {
      const priceText = tdMatches[5].replace(/<[^>]+>/g, " ").replace(/Rs/g, "").replace(/,/g, "").trim();
      const num = parseFloat(priceText);
      if (!isNaN(num)) price = num;
    }

    let effectiveDate = "";
    if (tdMatches[6]) {
      effectiveDate = cleanText(tdMatches[6].replace(/<[^>]+>/g, " ").trim());
    }

    if (productName && price > 0) {
      products.push({
        productName,
        genericFormula,
        regNumber,
        manufacturer,
        category,
        packSize,
        price,
        effectiveDate
      });
    }
  }

  return products;
}

async function fetchPage(pageNum) {
  const url = `https://e.dra.gov.pk/public/price?page=${pageNum}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!res.ok) {
      console.warn(`[Page ${pageNum}] HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    return parsePageHtml(html);
  } catch (err) {
    console.warn(`[Page ${pageNum}] Fetch error: ${err.message}`);
    return [];
  }
}

async function downloadDrapInBatches(startPage = 1, endPage = 100, concurrency = 10) {
  console.log(`Starting DRAP download from page ${startPage} to ${endPage} with concurrency ${concurrency}...`);
  const allResults = [];

  for (let i = startPage; i <= endPage; i += concurrency) {
    const chunk = [];
    for (let j = i; j < i + concurrency && j <= endPage; j++) {
      chunk.push(fetchPage(j));
    }

    const results = await Promise.all(chunk);
    for (const pageItems of results) {
      allResults.push(...pageItems);
    }
    console.log(`Progress: Pages ${i} - ${Math.min(i + concurrency - 1, endPage)} completed. Total medicines scraped so far: ${allResults.length}`);
  }

  return allResults;
}

async function saveToCsv(medicines, outputPath) {
  const header = "Product Name,Generic Formula,Reg Number,Manufacturer,Category,Pack Size,MRP Price,TP Price (15%),Effective Date\n";
  const rows = medicines.map(m => {
    const tp = (m.price * 0.85).toFixed(2);
    const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""')}"`;
    return [
      escapeCsv(m.productName),
      escapeCsv(m.genericFormula),
      escapeCsv(m.regNumber),
      escapeCsv(m.manufacturer),
      escapeCsv(m.category),
      escapeCsv(m.packSize),
      m.price.toFixed(2),
      tp,
      escapeCsv(m.effectiveDate)
    ].join(",");
  }).join("\n");

  fs.writeFileSync(outputPath, header + rows, "utf8");
  console.log(`✅ Saved ${medicines.length} medicines to ${outputPath}`);
}

async function syncToDatabase(medicines) {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.log("No DB connection string; skipping database sync.");
    return;
  }

  const client = new Client({ connectionString, ssl: false });
  try {
    await client.connect();
    console.log("Connected to database for DRAP price synchronization...");

    // Ensure TEXT types so long formula descriptions don't fail
    await client.query(`
      ALTER TABLE platform_drug_catalog ALTER COLUMN generic_formula TYPE TEXT;
      ALTER TABLE platform_drug_catalog ALTER COLUMN name TYPE TEXT;
      ALTER TABLE platform_drug_catalog ALTER COLUMN brand_name TYPE TEXT;
      ALTER TABLE platform_drug_catalog ALTER COLUMN category_name TYPE TEXT;
    `);

    let updatedCount = 0;
    let insertedCount = 0;

    for (const m of medicines) {
      const tp = parseFloat((m.price * 0.85).toFixed(2));
      const mrp = parseFloat(m.price.toFixed(2));

      // Upsert into platform_drug_catalog
      const exist = await client.query(`SELECT id FROM platform_drug_catalog WHERE name = $1 LIMIT 1;`, [m.productName]);
      if (exist.rows.length > 0) {
        await client.query(`
          UPDATE platform_drug_catalog
          SET sale_price_pack = $1, purchase_price_pack = $2,
              generic_formula = COALESCE(NULLIF($3, ''), generic_formula),
              brand_name = COALESCE(NULLIF($4, ''), brand_name),
              category_name = COALESCE(NULLIF($5, ''), category_name),
              updated_at = now()
          WHERE id = $6;
        `, [mrp, tp, m.genericFormula, m.manufacturer, m.category, exist.rows[0].id]);
        updatedCount++;
      } else {
        await client.query(`
          INSERT INTO platform_drug_catalog 
          (name, item_code, generic_formula, category_name, brand_name, unit,
           purchase_price_pack, sale_price_pack, purchase_price_single, sale_price_single)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        `, [
          m.productName,
          m.regNumber || null,
          m.genericFormula || 'General Salt',
          m.category || 'Essential Drugs',
          m.manufacturer || 'National Pharma',
          'pack',
          tp,
          mrp,
          tp,
          mrp
        ]);
        insertedCount++;
      }
    }

    console.log(`✅ DRAP Database Sync Complete! (Inserted: ${insertedCount}, Updated: ${updatedCount})`);
  } catch (err) {
    console.error("DB Sync Error:", err.message);
  } finally {
    await client.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const start = parseInt(args[0]) || 1;
  const end = parseInt(args[1]) || 50; // default 50 pages (1,000 medicines)

  console.log(`=============================================`);
  console.log(`DRAP PHARMACEUTICAL PRICE INDEX DOWNLOADER`);
  console.log(`Target: Pages ${start} to ${end}`);
  console.log(`=============================================`);

  const medicines = await downloadDrapInBatches(start, end, 10);

  const csvPath = path.join(__dirname, "../drap_official_medicines_2026.csv");
  await saveToCsv(medicines, csvPath);

  const jsonPath = path.join(__dirname, "../drap_official_medicines_2026.json");
  fs.writeFileSync(jsonPath, JSON.stringify(medicines, null, 2), "utf8");
  console.log(`✅ Saved JSON to ${jsonPath}`);

  await syncToDatabase(medicines);
}

main().catch(console.error);
