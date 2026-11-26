const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist-electron", "win-unpacked");
const resourcesDir = path.join(outDir, "resources");
const appDir = path.join(resourcesDir, "app");

console.log("[prepare_unpacked] Setting up application in resources/app...");

// Ensure resources/app exists
if (!fs.existsSync(appDir)) {
  fs.mkdirSync(appDir, { recursive: true });
}

// Remove default_app.asar if present so Electron loads resources/app
const defaultAsar = path.join(resourcesDir, "default_app.asar");
if (fs.existsSync(defaultAsar)) {
  fs.unlinkSync(defaultAsar);
}

// 1. Copy electron/ -> resources/app/electron/ (and sync public/icon.ico as electron/icon.ico)
const srcElectron = path.join(root, "electron");
const destElectron = path.join(appDir, "electron");
fs.cpSync(srcElectron, destElectron, { recursive: true });
const publicIcoSrc = path.join(root, "public", "icon.ico");
if (fs.existsSync(publicIcoSrc)) {
  fs.copyFileSync(publicIcoSrc, path.join(destElectron, "icon.ico"));
}

// 2. Copy public/ -> resources/app/public/
const srcPublic = path.join(root, "public");
const destPublic = path.join(appDir, "public");
if (fs.existsSync(srcPublic)) {
  fs.cpSync(srcPublic, destPublic, { recursive: true });
}

// 2b. Copy pdf-to-printer (needed by electron/printer.js PDF thermal print path)
const srcPdfToPrinter = path.join(root, "node_modules", "pdf-to-printer");
const destPdfToPrinter = path.join(appDir, "node_modules", "pdf-to-printer");
if (fs.existsSync(srcPdfToPrinter)) {
  fs.mkdirSync(path.dirname(destPdfToPrinter), { recursive: true });
  fs.cpSync(srcPdfToPrinter, destPdfToPrinter, { recursive: true });
}

// 3. Write minimal runtime package.json in resources/app
const runtimePkg = {
  name: "the-accounts",
  version: "0.1.0",
  description: "Cook Swift - Restaurant POS & Management System",
  main: "electron/main.js",
  dependencies: {}
};
fs.writeFileSync(
  path.join(appDir, "package.json"),
  JSON.stringify(runtimePkg, null, 2),
  "utf8"
);

// 4. Rename electron.exe -> Cook Swift.exe
const electronExe = path.join(outDir, "electron.exe");
const brandedExe = path.join(outDir, "Cook Swift.exe");
if (fs.existsSync(electronExe) && !fs.existsSync(brandedExe)) {
  fs.renameSync(electronExe, brandedExe);
}

// 5. Ensure elevate.exe is present if available in cafe or cache
const cafeElevate = path.join("D:\\peronal\\cafe\\dist-electron\\win-unpacked\\resources\\elevate.exe");
const destElevate = path.join(resourcesDir, "elevate.exe");
if (!fs.existsSync(destElevate) && fs.existsSync(cafeElevate)) {
  fs.copyFileSync(cafeElevate, destElevate);
}

// 6. Embed custom icon into Cook Swift.exe using modern rcedit (avoid legacy winCodeSign-2.6.0 rcedit which corrupts Electron 32 PE headers)
const iconIco = path.join(root, "public", "icon.ico");
const rceditCandidates = [
  path.join(root, "node_modules", "rcedit", "bin", "rcedit-x64.exe"),
  path.join(root, "node_modules", "rcedit", "bin", "rcedit.exe"),
  path.join(process.env.LOCALAPPDATA || "", "Programs", "Antigravity IDE", "resources", "app", "node_modules", "rcedit", "bin", "rcedit.exe"),
  path.join(process.env.LOCALAPPDATA || "", "Programs", "Antigravity IDE", "_", "resources", "app", "node_modules", "rcedit", "bin", "rcedit.exe"),
];

const rceditPath = rceditCandidates.find(p => fs.existsSync(p));
if (rceditPath && fs.existsSync(brandedExe) && fs.existsSync(iconIco)) {
  try {
    console.log("[prepare_unpacked] Embedding chef icon into Cook Swift.exe using:", rceditPath);
    execFileSync(rceditPath, [brandedExe, "--set-icon", iconIco]);
    console.log("[prepare_unpacked] Successfully embedded icon into Cook Swift.exe!");
  } catch (err) {
    console.warn("[prepare_unpacked] rcedit warning:", err.message);
  }
} else if (!rceditPath) {
  console.warn("[prepare_unpacked] Modern rcedit.exe not found; skipping icon patch.");
}

console.log("[prepare_unpacked] Ready! Cook Swift executable prepared at:", brandedExe);
