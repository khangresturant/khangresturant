const { BrowserWindow } = require("electron");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const os = require("os");
const {
  parseThermalPaperWidthMm,
  injectThermalRollLayoutHtml,
  printWindowToThermalPdf,
} = require("./thermal-pdf");

const LOAD_TIMEOUT_MS = 25000;
const JOB_MAX_ATTEMPTS = 3;
const JOB_RETRY_MS = 400;

/** One thermal job at a time so back-to-back slips never drop. */
let thermalPrintQueue = Promise.resolve();

function enqueueThermalPrint(task) {
  const job = thermalPrintQueue.then(task, task);
  thermalPrintQueue = job.catch(() => {});
  return job;
}

function loadPdfToPrinter() {
  const appRoot = path.join(__dirname, "..");
  const candidates = [
    path.join(appRoot, "node_modules", "pdf-to-printer"),
    path.join(appRoot, ".next", "standalone", "node_modules", "pdf-to-printer"),
  ];
  for (const dir of candidates) {
    const pkg = path.join(dir, "package.json");
    if (fsSync.existsSync(pkg)) {
      return require(dir);
    }
  }
  return require("pdf-to-printer");
}

function resolveMatchedPrinter(printers, printerName) {
  const list = Array.isArray(printers) ? printers : [];
  let matched = printerName?.trim() || "";

  if (matched) {
    const exact = list.find(
      (p) => p.name.toLowerCase() === matched.toLowerCase()
    );
    if (exact) return exact.name;
    const loose = list.find(
      (p) =>
        p.name.toLowerCase().includes(matched.toLowerCase()) ||
        matched.toLowerCase().includes(p.name.toLowerCase())
    );
    if (loose) return loose.name;
    console.warn(
      `[Electron Print] Target printer "${matched}" not found. Using default.`
    );
  }

  const def = list.find((p) => p.isDefault);
  return def?.name || list[0]?.name || "";
}

async function waitForPrintWindowReady(webContents, loadPromise) {
  await Promise.race([
    loadPromise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Thermal print window load timeout")),
        LOAD_TIMEOUT_MS
      )
    ),
  ]);
  if (webContents.isDestroyed()) {
    throw new Error("Print window destroyed before print");
  }
  await new Promise((r) => setTimeout(r, 450));
}

/**
 * Silent thermal print: HTML → PDF (Chromium, 80mm roll) → pdf-to-printer / Sumatra.
 * Proven path for ESC/POS drivers (Black Copper, Xprinter, etc.).
 */
async function printThermalSilentJobOnce({ html, printerName, copies = 1 }) {
  if (!html || typeof html !== "string") {
    throw new Error("Receipt HTML content is required for printing.");
  }

  const tmpDir = path.join(os.tmpdir(), "cookswift-thermal");
  await fs.mkdir(tmpDir, { recursive: true });
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const htmlPath = path.join(tmpDir, `receipt-${stamp}.html`);
  const pdfPath = path.join(tmpDir, `receipt-${stamp}.pdf`);

  let printWindow = null;

  const cleanup = async () => {
    if (printWindow) {
      try {
        printWindow.destroy();
      } catch {
        /* already destroyed */
      }
      printWindow = null;
    }
    await fs.unlink(htmlPath).catch(() => undefined);
    await fs.unlink(pdfPath).catch(() => undefined);
  };

  try {
    const paperWidthMm = parseThermalPaperWidthMm(html);
    const htmlForPrint = injectThermalRollLayoutHtml(html, paperWidthMm);
    await fs.writeFile(htmlPath, htmlForPrint, "utf8");

    const slipPxW = Math.round((paperWidthMm / 25.4) * 96) + 32;
    printWindow = new BrowserWindow({
      show: false,
      width: Math.max(336, slipPxW),
      height: 1600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
        zoomFactor: 1,
      },
    });
    printWindow.webContents.setZoomFactor(1);

    await waitForPrintWindowReady(
      printWindow.webContents,
      printWindow.loadFile(htmlPath)
    );

    const printers = await printWindow.webContents.getPrintersAsync();
    const matchedPrinter = resolveMatchedPrinter(printers, printerName);

    if (!matchedPrinter) {
      throw new Error("No Windows printer found for silent thermal print.");
    }

    const { pdfBuffer } = await printWindowToThermalPdf(
      printWindow.webContents,
      paperWidthMm
    );

    await fs.writeFile(pdfPath, pdfBuffer);

    const mod = loadPdfToPrinter();
    const printFn = mod.print || mod.default?.print;
    if (typeof printFn !== "function") {
      throw new Error("pdf-to-printer module is missing print().");
    }

    const copyCount = Math.max(1, Math.min(99, Math.floor(Number(copies) || 1)));
    await printFn(pdfPath, {
      printer: matchedPrinter,
      silent: true,
      scale: "noscale",
      monochrome: true,
      copies: copyCount,
    });

    console.info(
      `[Electron Print] PDF → ${matchedPrinter} ×${copyCount} (${paperWidthMm}mm roll)`
    );

    await cleanup();
    return { success: true, printer: matchedPrinter, method: "pdf" };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

async function printThermalSilentJob(args) {
  let lastErr = null;
  for (let attempt = 1; attempt <= JOB_MAX_ATTEMPTS; attempt++) {
    try {
      return await printThermalSilentJobOnce(args);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Electron Print] attempt ${attempt}/${JOB_MAX_ATTEMPTS}: ${msg}`);
      if (attempt < JOB_MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, JOB_RETRY_MS * attempt));
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Silent thermal printing failed");
}

function printThermalSilent(args) {
  return enqueueThermalPrint(() => printThermalSilentJob(args));
}

module.exports = { printThermalSilent };