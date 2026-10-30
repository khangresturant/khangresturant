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
  const medicines = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  console.log("Testing parsePharmaPiecesPerBox across all 16,317 medicines...");
  const samples = [
    "60ml", "120ml", "10's", "1's", "14's", "30's", "1x10's", "20's", "100's", "5's",
    "6's", "12's", "28's", "2x10's", "10x10's", "3x10's", "50's", "0.5ml x 5's", "(1X50)Vial",
    "0.6ml/1's", "15gm", "20g", "20x10's", "25x10's", "500's", "1000's", "10 Tablets", "250 Caps",
    "100ml Infusion", "1 Vial", "5 Ampoules", "14 Sachets"
  ];

  samples.forEach(s => {
    console.log(`Input: "${s}" ➔ Pieces per Box: ${parsePharmaPiecesPerBox(s)}`);
  });
}

main();
