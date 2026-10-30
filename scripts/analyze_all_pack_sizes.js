const fs = require("fs");
const path = require("path");

function main() {
  const jsonPath = path.join(__dirname, "../drap_official_medicines_2026.json");
  const medicines = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  console.log(`Analyzing pack sizes across ${medicines.length} medicines...`);

  const packCountMap = new Map();
  medicines.forEach(m => {
    const raw = (m.packSize || "").trim();
    packCountMap.set(raw, (packCountMap.get(raw) || 0) + 1);
  });

  // Sort by frequency
  const sorted = Array.from(packCountMap.entries()).sort((a, b) => b[1] - a[1]);
  console.log(`Found ${sorted.length} unique pack size formats. Top 40 most common:`);
  console.table(sorted.slice(0, 40).map(([pattern, count]) => ({ pattern, count })));
}

main();
