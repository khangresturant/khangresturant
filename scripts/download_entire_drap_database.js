const fs = require("fs");
const path = require("path");

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
    console.warn(`[Page ${pageNum}] Error: ${err.message}`);
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  const startPage = parseInt(args[0]) || 1;
  const endPage = parseInt(args[1]) || 1069; // All 1069 pages!
  const concurrency = 15;

  const csvPath = path.join(__dirname, "../drap_official_medicines_2026.csv");
  const jsonPath = path.join(__dirname, "../drap_official_medicines_2026.json");

  console.log(`=======================================================`);
  console.log(`DOWNLOADING ENTIRE DRAP OFFICIAL DATABASE (Pages ${startPage} - ${endPage})`);
  console.log(`Target CSV: ${csvPath}`);
  console.log(`=======================================================`);

  // Load existing if available
  let allMedicines = [];
  if (fs.existsSync(jsonPath)) {
    try {
      allMedicines = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      console.log(`Found ${allMedicines.length} existing scraped medicines.`);
    } catch (e) {}
  }

  const seenNames = new Set(allMedicines.map(m => m.productName));

  for (let i = startPage; i <= endPage; i += concurrency) {
    const batch = [];
    for (let j = i; j < i + concurrency && j <= endPage; j++) {
      batch.push(fetchPage(j));
    }

    const results = await Promise.all(batch);
    let newInBatch = 0;
    for (const pageItems of results) {
      for (const item of pageItems) {
        if (!seenNames.has(item.productName)) {
          seenNames.add(item.productName);
          allMedicines.push(item);
          newInBatch++;
        }
      }
    }

    console.log(`[Pages ${i}-${Math.min(i + concurrency - 1, endPage)}] Added ${newInBatch} new items. Total: ${allMedicines.length}`);

    // Periodically save to disk every 50 pages
    if (i % 50 === 1 || i + concurrency >= endPage) {
      fs.writeFileSync(jsonPath, JSON.stringify(allMedicines, null, 2), "utf8");
      
      const header = "Product Name,Generic Formula,Reg Number,Manufacturer,Category,Pack Size,MRP Price,TP Price (15%),Effective Date\n";
      const rows = allMedicines.map(m => {
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
      fs.writeFileSync(csvPath, header + rows, "utf8");
      console.log(`💾 Auto-saved checkpoint: ${allMedicines.length} medicines in CSV & JSON.`);
    }
  }

  console.log(`\n🎉 DRAP COMPLETE DATABASE DOWNLOAD FINISHED! Total: ${allMedicines.length} medicines.`);
}

main().catch(console.error);
