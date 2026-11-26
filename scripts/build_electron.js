const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist-electron");
const outDir = path.join(distDir, "win-unpacked");
const cacheZip = path.join(root, ".cache-electron-v32.2.8-win32-x64.zip");
const exeOnly = process.argv.includes("--exe-only");

console.log("==================================================");
console.log("  Building Cook Swift POS Desktop (.exe)          ");
console.log("  Linked with Vercel & Neon PostgreSQL            ");
console.log("==================================================");

// 1. Always clean previous dist-electron so old EXE is deleted and never double-patched
if (fs.existsSync(distDir)) {
  console.log("[1/4] Deleting old dist-electron artifacts...");
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// 2. Ensure public/icon.ico exists (only generate if missing)
const publicIco = path.join(root, "public", "icon.ico");
const iconScript = path.join(root, "scripts", "generate_icons.py");
if (!fs.existsSync(publicIco) && fs.existsSync(iconScript)) {
  try {
    console.log("[1b] Generating public/icon.ico...");
    execSync(`python "${iconScript}"`, { cwd: root, stdio: "inherit" });
  } catch (err) {
    console.warn("Notice: generate_icons python script warning:", err.message);
  }
} else {
  console.log("[1b] Using existing icon:", publicIco);
}

// 3. Extract official Electron 32.2.8 runtime cleanly
console.log("[2/4] Extracting fresh Electron runtime to win-unpacked...");
if (!fs.existsSync(cacheZip)) {
  console.error("Missing cached Electron zip at:", cacheZip);
  process.exit(1);
}
execSync(`tar -xf "${cacheZip}" -C "${outDir}"`, { stdio: "inherit" });

// 4. Prepare resources/app and brand executable with custom icon
console.log("[3/4] Preparing application resources (preload, silent printer, cloud link, icon)...");
require("./prepare_unpacked.js");

// 5. Build NSIS Windows Installer (skip when --exe-only is requested)
if (exeOnly) {
  console.log("[4/4] Skipping NSIS Installer (--exe-only requested).");
  console.log("==================================================");
  console.log("  FRESH EXE BUILD SUCCESSFUL!");
  console.log(`  Portable EXE: ${path.join(outDir, "Cook Swift.exe")}`);
  console.log("==================================================");
  process.exit(0);
}

console.log("[4/4] Compiling Windows NSIS Installer (.exe)...");
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
