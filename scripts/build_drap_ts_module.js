const fs = require("fs");
const path = require("path");

function parsePharmaPiecesPerBox(rawStr) {
  if (!rawStr) return 1;
  let s = rawStr.trim();

  // Normalize quotes and spaces
  s = s.replace(/[’‘`]/g, "'").replace(/\s+/g, " ");

  // 1. If it's pure liquid/cream volume (e.g. "60ml", "120 ml", "15gm", "20g", "1000ml", "1 Vial", "Tube", "Bottle", "PFS")
  // and has NO piece count indicator like "x 10's", "10x10", "10's", "10 Tablets"
  const isPureVolume = /^\d+\.?\d*\s*(?:ml|gm?|grams?|liters?|ltr|pfs|iu|vial|ampoule|bottle|tube|dropper|sachet)?$/i.test(s);
  if (isPureVolume && !s.includes("'s") && !s.includes("x") && !s.includes("*")) {
    return 1;
  }

  // Remove liquid/mass measurement tokens so they don't interfere with piece counts
  // e.g. "0.5ml x 5's" -> " x 5's", "100mg (10x10)" -> " (10x10)", "120ml (1's pack)" -> " (1's pack)"
  const clean = s.replace(/\d+\.?\d*\s*(?:ml|mg|g|gm|mcg|iu|iu\/ml|pfs|l|liters?)\b/gi, " ").trim();

  // 2. Check for explicit multiplier patterns like 10x10, 10*10, 2x14, 1X50, 20x10, 25x10, 3x10
  const multMatch = clean.match(/(\d+)\s*[xX\*]\s*(\d+)/);
  if (multMatch) {
    const a = parseInt(multMatch[1]);
    const b = parseInt(multMatch[2]);
    if (a > 0 && b > 0) return a * b;
  }

  // 3. Check for blister / piece patterns like "10's", "10s", "100's", "14's", "5's", "28's", "x 10's", "/10's"
  const countMatch = clean.match(/(?:[xX\*\/\(\s-]|^)(\d+)\s*(?:'s|s|tablets?|capsules?|tabs?|caps?|vials?|amps?|ampoules?|sachets?|bottles?|tubes?|respules?|cartridges?)\b/i);
  if (countMatch) {
    const val = parseInt(countMatch[1]);
    if (val > 0) return val;
  }

  // 4. Check for standalone numbers in cleaned string
  const numMatch = clean.match(/\d+/);
  if (numMatch) {
    const val = parseInt(numMatch[0]);
    if (val > 0 && val <= 10000) return val;
  }

  return 1;
}

function main() {
  const jsonPath = path.join(__dirname, "../drap_official_medicines_2026.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("DRAP JSON file not found.");
    return;
  }

  const raw = fs.readFileSync(jsonPath, "utf8");
  const drapList = JSON.parse(raw);
  console.log(`Processing ${drapList.length} medicines with strict Pieces-Per-Box parsing...`);

  const formatted = drapList.map(m => {
    const mrp = parseFloat(m.price.toFixed(2)) || 0;
    const tp = parseFloat((mrp * 0.85).toFixed(2)) || 0;
    
    // Strict pieces per box calculation (e.g. 100, 200, 14, 1)
    const packSize = Math.max(1, parsePharmaPiecesPerBox(m.packSize));

    // Determine type (Tabs, Caps, Syrup, Inj, Sachet, Drops, etc.)
    let type = "Tablets";
    const nameLower = (m.productName || "").toLowerCase();
    if (nameLower.includes("syrup") || nameLower.includes("suspension") || nameLower.includes("solution") || nameLower.includes("liquid") || nameLower.includes("syp")) {
      type = "Syrups";
    } else if (nameLower.includes("capsule") || nameLower.includes("cap")) {
      type = "Capsules";
    } else if (nameLower.includes("injection") || nameLower.includes("inj") || nameLower.includes("vial") || nameLower.includes("ampoule")) {
      type = "Injections";
    } else if (nameLower.includes("sachet")) {
      type = "Sachets";
    } else if (nameLower.includes("drop") || nameLower.includes("drops") || nameLower.includes("eye") || nameLower.includes("ear")) {
      type = "Drops";
    } else if (nameLower.includes("cream") || nameLower.includes("ointment") || nameLower.includes("gel")) {
      type = "Topical";
    } else if (nameLower.includes("inhaler") || nameLower.includes("respule") || nameLower.includes("nebule")) {
      type = "Respiratory";
    }

    return {
      name: m.productName,
      formula: m.genericFormula || "General Formulation",
      pack_size: packSize,
      purchase_price: tp,
      sale_price: mrp,
      type: type,
      manufacturer: m.manufacturer || "National Pharma",
      reg_number: m.regNumber || "",
      category: m.category || "Essential Drugs",
      effective_date: m.effectiveDate || "2026"
    };
  });

  const outDir = path.join(__dirname, "../src/lib/pharma");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outJsonPath = path.join(outDir, "drap-master-medicines.json");
  fs.writeFileSync(outJsonPath, JSON.stringify(formatted, null, 2), "utf8");
  console.log(`✅ Saved ${formatted.length} formatted medicines to ${outJsonPath}`);

  // Also create drap-medicines.ts export
  const tsContent = `// Auto-generated 100% Official DRAP Master Drug Database (2026)
import drapMedicinesData from "./drap-master-medicines.json";

export interface MasterMedicineItem {
  name: string;
  formula: string;
  pack_size: number;
  purchase_price: number;
  sale_price: number;
  type: string;
  manufacturer: string;
  reg_number?: string;
  category?: string;
  effective_date?: string;
}

export const DRAP_MASTER_MEDICINES: MasterMedicineItem[] = drapMedicinesData as MasterMedicineItem[];
`;

  const outTsPath = path.join(outDir, "drap-medicines.ts");
  fs.writeFileSync(outTsPath, tsContent, "utf8");
  console.log(`✅ Saved TypeScript export to ${outTsPath}`);

  // Also update CSV file with exact pieces per box
  const csvPath = path.join(__dirname, "../drap_official_medicines_2026.csv");
  const header = "Product Name,Generic Formula,Reg Number,Manufacturer,Category,Pack Size (Pcs per Box),MRP Price,TP Price (15%),Effective Date\n";
  const rows = formatted.map(m => {
    const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""')}"`;
    return [
      escapeCsv(m.name),
      escapeCsv(m.formula),
      escapeCsv(m.reg_number),
      escapeCsv(m.manufacturer),
      escapeCsv(m.category),
      m.pack_size,
      m.sale_price.toFixed(2),
      m.purchase_price.toFixed(2),
      escapeCsv(m.effective_date)
    ].join(",");
  }).join("\n");
  fs.writeFileSync(csvPath, header + rows, "utf8");
  console.log(`✅ Updated CSV file with clean Pieces per Box: ${csvPath}`);
}

main();
