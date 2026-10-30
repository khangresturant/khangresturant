const fs = require("fs");
const path = require("path");

async function fetchPage(pageNum) {
  const url = `https://e.dra.gov.pk/public/price?page=${pageNum}`;
  console.log(`Fetching DRAP Page ${pageNum}: ${url}`);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP Error ${res.status}`);
  }

  const html = await res.text();
  return parsePageHtml(html);
}

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

  // Match each <tr> inside tbody
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return products;

  const tbody = tbodyMatch[1];
  const rowMatches = tbody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  for (const row of rowMatches) {
    // 1. Product Name & Generic
    const nameBlockMatch = row.match(/<div class="text-sm font-medium text-gray-900">([^<]+)<\/div>[\s\S]*?<div class="[^"]*text-sm text-gray-500[^"]*">([^<]+)<\/div>/i);
    const productName = nameBlockMatch ? cleanText(nameBlockMatch[1]) : "";
    const genericFormula = nameBlockMatch ? cleanText(nameBlockMatch[2]) : "";

    // 2. Reg Number (2nd td)
    const tdMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    let regNumber = "";
    if (tdMatches[1]) {
      const regMatch = tdMatches[1].match(/>\s*([0-9A-Za-z\-_]+)\s*</);
      if (regMatch) regNumber = cleanText(regMatch[1]);
    }

    // 3. Manufacturer (3rd td)
    let manufacturer = "";
    if (tdMatches[2]) {
      const mMatch = tdMatches[2].match(/<div class="text-sm text-gray-900">([^<]+)<\/div>/i);
      if (mMatch) manufacturer = cleanText(mMatch[1]);
    }

    // 4. Category (4th td)
    let category = "";
    if (tdMatches[3]) {
      const catMatch = tdMatches[3].match(/<span[^>]*>([^<]+)<\/span>/i);
      if (catMatch) category = cleanText(catMatch[1]);
    }

    // 5. Pack Size (5th td)
    let packSize = "";
    if (tdMatches[4]) {
      const pMatch = tdMatches[4].replace(/<[^>]+>/g, " ").trim();
      packSize = cleanText(pMatch);
    }

    // 6. Price (6th td)
    let price = 0;
    if (tdMatches[5]) {
      const priceText = tdMatches[5].replace(/<[^>]+>/g, " ").replace(/Rs/g, "").replace(/,/g, "").trim();
      const num = parseFloat(priceText);
      if (!isNaN(num)) price = num;
    }

    // 7. Effective Date (7th td)
    let effectiveDate = "";
    if (tdMatches[6]) {
      effectiveDate = cleanText(tdMatches[6].replace(/<[^>]+>/g, " ").trim());
    }

    if (productName) {
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

async function main() {
  console.log("Testing DRAP Parser on Page 1 & Page 2...");
  const p1 = await fetchPage(1);
  console.log(`Page 1 Extracted ${p1.length} Medicines:`);
  console.table(p1.slice(0, 5));

  const p2 = await fetchPage(2);
  console.log(`Page 2 Extracted ${p2.length} Medicines:`);
  console.table(p2.slice(0, 5));
}

main().catch(console.error);
