/**
 * electron-builder sometimes leaves win-unpacked without electron.exe (bad cache zip).
 * Re-extract the official Electron zip into dist-electron/win-unpacked when needed.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const electronVersion =
  (pkg.devDependencies && pkg.devDependencies.electron) || "32.2.8";
const ver = String(electronVersion).replace(/^\^/, "");

const outDir = path.join(root, "dist-electron", "win-unpacked");
const marker = path.join(outDir, "Cook Swift.exe");
const fallback = path.join(outDir, "electron.exe");

if (fs.existsSync(marker) || fs.existsSync(fallback)) {
  console.log("[patch-electron-runtime] Runtime OK:", outDir);
  process.exit(0);
}

const zipName = `electron-v${ver}-win32-x64.zip`;
const localZip = path.join(root, `.cache-${zipName}`);
let zipPath = fs.existsSync(localZip) ? localZip : null;

if (!zipPath && process.env.LOCALAPPDATA) {
  const cacheBase = path.join(process.env.LOCALAPPDATA, "electron", "Cache");
  if (fs.existsSync(cacheBase)) {
    // Check direct file or search subdirectories recursively
    const direct = path.join(cacheBase, zipName);
    if (fs.existsSync(direct)) {
      zipPath = direct;
    } else {
      try {
        const subdirs = fs.readdirSync(cacheBase);
        for (const sub of subdirs) {
          const candidate = path.join(cacheBase, sub, zipName);
          if (fs.existsSync(candidate)) {
            zipPath = candidate;
            break;
          }
        }
      } catch {
        // ignore
      }
    }
  }
}

if (!zipPath) {
  console.error(
    `[patch-electron-runtime] Missing ${zipName}. Run electron-builder once or download from GitHub releases.`
  );
  process.exit(1);
}

if (!fs.existsSync(outDir)) {
  console.error("[patch-electron-runtime] Missing", outDir);
  process.exit(1);
}

console.log("[patch-electron-runtime] Extracting", zipPath, "→", outDir);
execFileSync("tar", ["-xf", zipPath, "-C", outDir], { stdio: "inherit" });

const electronExe = path.join(outDir, "electron.exe");
const productName = (pkg.build && pkg.build.productName) || "Cook Swift";
const branded = path.join(outDir, `${productName}.exe`);

if (fs.existsSync(electronExe) && !fs.existsSync(branded)) {
  fs.renameSync(electronExe, branded);
}

console.log("[patch-electron-runtime] Done:", branded);
