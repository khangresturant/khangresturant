const fs = require("fs");
const path = require("path");

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

// 1. Copy electron/ -> resources/app/electron/
const srcElectron = path.join(root, "electron");
const destElectron = path.join(appDir, "electron");
fs.cpSync(srcElectron, destElectron, { recursive: true });

// 2. Copy public/ -> resources/app/public/
const srcPublic = path.join(root, "public");
const destPublic = path.join(appDir, "public");
if (fs.existsSync(srcPublic)) {
  fs.cpSync(srcPublic, destPublic, { recursive: true });
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

console.log("[prepare_unpacked] Ready! Cook Swift executable prepared at:", brandedExe);
