const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist-electron", "win-unpacked");
const cacheZip = path.join(root, ".cache-electron-v32.2.8-win32-x64.zip");

console.log("==================================================");
console.log("  Building Cook Swift POS Desktop (.exe)          ");
console.log("  Linked with Vercel & Neon PostgreSQL            ");
console.log("==================================================");

// 1. Ensure win-unpacked exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 2. Extract official Electron 32.2.8 runtime if not present
const electronMarker = path.join(outDir, "Cook Swift.exe");
const electronRaw = path.join(outDir, "electron.exe");
if (!fs.existsSync(electronMarker) && !fs.existsSync(electronRaw)) {
  console.log("[1/3] Extracting Electron runtime to win-unpacked...");
  if (!fs.existsSync(cacheZip)) {
    console.error("Missing cached Electron zip at:", cacheZip);
    process.exit(1);
  }
  execSync(`tar -xf "${cacheZip}" -C "${outDir}"`, { stdio: "inherit" });
} else {
  console.log("[1/3] Electron runtime already unpacked in:", outDir);
}

// 3. Prepare resources/app and brand executable
console.log("[2/3] Preparing application resources (preload, silent printer, cloud link)...");
require("./prepare_unpacked.js");

// 4. Build NSIS Windows Installer
console.log("[3/3] Compiling Windows NSIS Installer (.exe)...");
execSync("npx electron-builder@25.1.8 --win nsis --prepackaged dist-electron/win-unpacked", {
  cwd: root,
  stdio: "inherit",
});

const setupExe = path.join(root, "dist-electron", "Cook Swift Setup 0.1.0.exe");
if (fs.existsSync(setupExe)) {
  const stats = fs.statSync(setupExe);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(1);
  console.log("==================================================");
  console.log("  BUILD SUCCESSFUL!");
  console.log(`  Installer: ${setupExe} (${sizeMb} MB)`);
  console.log(`  Portable:  ${path.join(outDir, "Cook Swift.exe")}`);
  console.log("==================================================");
} else {
  console.error("NSIS installer was not found at:", setupExe);
  process.exit(1);
}
