const fs = require("fs");
const path = require("path");

function parsePharmaPackSize(str) {
  if (!str) return 1;
  const cleaned = str.trim();

  // Remove volume / strength like 0.5ml, 100mg, 500mg, 10ml, 120ml, 0.6ml
  const strippedVolume = cleaned.replace(/\d+\.?\d*\s*(?:ml|mg|g|mcg|iu|l|kg|pfs|iu\/ml)\b/gi, " ");

  // 1. Check for multiplier patterns like (10x10), 10*10, 2x14, 1X50
  const multMatch = strippedVolume.match(/(\d+)\s*[xX\*]\s*(\d+)/);
  if (multMatch) {
    const n1 = parseInt(multMatch[1]);
    const n2 = parseInt(multMatch[2]);
    if (n1 > 0 && n2 > 0) return n1 * n2;
  }

  // 2. Check for "x 10's", "x10s", "*10's", "x 5", "x1's", "/1's", "(10's)"
  const xMatch = strippedVolume.match(/(?:[xX\*\/\-\(]|^)\s*(\d+)\s*'?s?/i);
  if (xMatch) {
    const val = parseInt(xMatch[1]);
    if (val > 0) return val;
  }

  // 3. Check for any remaining number
  const numMatch = strippedVolume.match(/\d+/);
  if (numMatch) {
    const val = parseInt(numMatch[0]);
    if (val > 0) return val;
  }

  // Default fallback
  return 1;
}

const testCases = [
  "0.5ml x 5's",
  "0.5ml x1's",
  "0.5ml x10's",
  "0.6ml/1's",
  "0.4mlx1's",
  "(1X50)Vial",
  "(1's pack)",
  "10x10",
  "2*14",
  "120ml bottle",
  "0.5ml PFS (1's)",
  "0.5ml x 1's",
  "0.5ml x 10's",
  "100 Tablets",
  "250 Caps",
  "50mg/5ml 60ml"
];

console.log("--- Testing Pack Size Parser ---");
testCases.forEach(tc => {
  console.log(`"${tc}" ➔ Pack Size: ${parsePharmaPackSize(tc)}`);
});
