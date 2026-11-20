const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");

if (!fs.existsSync(standaloneDir)) {
  console.error("Standalone directory not found. Ensure next build with output: standalone completed.");
  process.exit(1);
}

// 1. Copy public/ -> .next/standalone/public/
const srcPublic = path.join(root, "public");
const destPublic = path.join(standaloneDir, "public");
if (fs.existsSync(srcPublic)) {
  console.log("Copying public/ to standalone...");
  fs.cpSync(srcPublic, destPublic, { recursive: true });
}

// 2. Copy .next/static/ -> .next/standalone/.next/static/
const srcStatic = path.join(root, ".next", "static");
const destStatic = path.join(standaloneDir, ".next", "static");
if (fs.existsSync(srcStatic)) {
  console.log("Copying .next/static/ to standalone...");
  fs.mkdirSync(path.dirname(destStatic), { recursive: true });
  fs.cpSync(srcStatic, destStatic, { recursive: true });
}

console.log("Standalone preparation complete.");
