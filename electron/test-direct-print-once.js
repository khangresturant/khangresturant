/**
 * One-shot: direct webContents.print only (no PDF fallback). ~10s max.
 * Usage: npx electron electron/test-direct-print-once.js
 */
const { app, BrowserWindow } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const {
  parseThermalPaperWidthMm,
  injectThermalPageSize,
  applyThermalPageSizeToDocument,
  measureSlipHeightMm,
} = require("./thermal-pdf");

const TIMEOUT_MS = 10_000;

const TEST_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="x-thermal-width-mm" content="80" />
<style>
@page { size: 80mm auto portrait; margin: 0; }
body { margin: 0; font: bold 14px Arial, sans-serif; width: 80mm; }
</style>
</head><body>
<div class="receipt-container">
<p align="center">DIRECT PRINT TEST</p>
<p align="center">${new Date().toLocaleString()}</p>
<hr/>
<p>KOT slip test — one attempt</p>
</div>
</body></html>`;

function mmToMicrons(mm) {
  return Math.round(Number(mm) * 1000);
}

app.whenReady().then(async () => {
  const started = Date.now();
  let exitCode = 1;
  let resultLine = "PRINT_DIRECT_RESULT=UNKNOWN";

  try {
    const tmpDir = path.join(os.tmpdir(), "cookswift-thermal");
    await fs.mkdir(tmpDir, { recursive: true });
    const htmlPath = path.join(tmpDir, `direct-test-${Date.now()}.html`);
    const paperWidthMm = parseThermalPaperWidthMm(TEST_HTML);
    const htmlForPrint = injectThermalPageSize(TEST_HTML, paperWidthMm, 200);
    await fs.writeFile(htmlPath, htmlForPrint, "utf8");

    const win = new BrowserWindow({
      show: false,
      width: 320,
      height: 800,
      webPreferences: { contextIsolation: true, backgroundThrottling: false },
    });

    await Promise.race([
      win.loadFile(htmlPath),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("load timeout")), 6000)
      ),
    ]);
    await win.webContents.executeJavaScript(
      `new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`
    );

    const printers = await win.webContents.getPrintersAsync();
    const def = printers.find((p) => p.isDefault) || printers[0];
    if (!def?.name) {
      resultLine = "PRINT_DIRECT_RESULT=NO_PRINTER";
      console.log(resultLine);
      win.destroy();
      app.exit(2);
      return;
    }

    let heightMm = await measureSlipHeightMm(win.webContents);
    heightMm = Math.min(Math.max(heightMm, paperWidthMm + 20), 400);
    await applyThermalPageSizeToDocument(win.webContents, paperWidthMm, heightMm);

    const options = {
      silent: true,
      printBackground: true,
      deviceName: def.name,
      color: false,
      landscape: false,
      margins: { marginType: "none" },
      scaleFactor: 100,
      copies: 1,
    };

    const printOk = await new Promise((resolve) => {
      const left = Math.max(500, TIMEOUT_MS - (Date.now() - started));
      const timer = setTimeout(() => resolve(false), left);
      try {
        win.webContents.print(options, (success) => {
          clearTimeout(timer);
          resolve(!!success);
        });
      } catch {
        clearTimeout(timer);
        resolve(false);
      }
    });

    win.destroy();
    await fs.unlink(htmlPath).catch(() => undefined);

    if (printOk) {
      resultLine = `PRINT_DIRECT_RESULT=SPOOLER_OK printer="${def.name}"`;
      exitCode = 0;
    } else {
      resultLine = `PRINT_DIRECT_RESULT=FAILED printer="${def.name}"`;
      exitCode = 1;
    }
  } catch (err) {
    resultLine = `PRINT_DIRECT_RESULT=FAILED error="${err instanceof Error ? err.message : err}"`;
    exitCode = 1;
  }

  console.log(resultLine);
  console.log(`elapsed_ms=${Date.now() - started}`);
  app.exit(exitCode);
});

app.on("window-all-closed", () => {});