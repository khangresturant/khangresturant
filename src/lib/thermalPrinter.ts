// High-Contrast Direct Thermal Printing Engine for Web POS
// Optimizes thermal receipts for 80mm & 58mm POS printers (Xprinter, Black Copper, Rongta, Epson, ZJiang, etc.)
// Ensures pitch-black text, crisp solid borders, zero-latency rendering, and iframe-based direct printing.

import { ReceiptSettings } from "@/components/ReceiptTemplate";
import { RESTAURANT_THERMAL_TABLE_ALIGN_CSS } from "@/lib/restaurant-thermal-table-align";
import { THERMAL_SHARP_TEXT_CSS } from "@/lib/thermal-sharp-text-css";
import { THERMAL_RECEIPT_TAILWIND_SHIM_CSS } from "@/lib/thermal-receipt-tailwind-shim";
import {
  POS_KITCHEN_RECEIPT_CSS,
  POS_PAYMENT_RECEIPT_CSS,
  type PosRestaurantSlipKind,
  posRestaurantPaperWidthMm,
} from "@/lib/posrestaurant-receipt-template";

/** Physical 80mm thermal roll width (PDF page / driver). */
export const THERMAL_ROLL_HARDWARE_MM = 80;
/** Printable content width — use full 80mm roll so columns are not clipped. */
export const THERMAL_80_PRINTABLE_MM = 80;
export const THERMAL_80_CONTENT_MM = 80;
export const THERMAL_58_ROLL_MM = 58;
export const THERMAL_58_CONTENT_MM = 52;

export interface PrintReceiptOptions {
  receiptHtml: string;
  settings: Partial<ReceiptSettings>;
  title?: string;
  /** Windows printer name; empty = try default via API, then browser dialog */
  targetPrinterName?: string;
  /** Electron / silent print copies (default 1). Ignored when 0 — treated as 1. */
  copies?: number;
  /** Match POSRESTURANT `fast_food_order_view` Arial / 320px slips (not monospace wrapper). */
  layout?: "posrestaurant";
  posSlipKind?: PosRestaurantSlipKind;
  onSuccess?: () => void;
  onError?: (err: any) => void;
}

/**
 * POSRESTURANT-style full HTML document (kitchen + payment) for direct thermal print.
 */
export function buildPosRestaurantThermalPrintHtml(
  receiptInnerHtml: string,
  settings: Partial<ReceiptSettings>,
  title = "Receipt",
  kind: PosRestaurantSlipKind = "payment"
): string {
  const paperMm = posRestaurantPaperWidthMm(kind);
  const slipCss =
    kind === "kitchen" ? POS_KITCHEN_RECEIPT_CSS : POS_PAYMENT_RECEIPT_CSS;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="x-thermal-width-mm" content="${paperMm}" />
  <meta name="x-thermal-format" content="roll" />
  <title>${title}</title>
  <style>
    @page {
      size: ${paperMm}mm auto portrait;
      margin: 0 !important;
    }
    html, body {
      margin: 0 auto !important;
      padding: 0 !important;
      width: ${paperMm}mm !important;
      max-width: ${paperMm}mm !important;
      background: #fff !important;
      color: #000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    ${slipCss}
    hr {
      border: none;
      border-top: 1px solid #000;
      margin: 4px 0;
    }
  .receipt-container {
      padding-top: 0 !important;
      margin-top: 0 !important;
      padding-bottom: 3mm !important;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    ${receiptInnerHtml}
  </div>
</body>
</html>`;
}

export type ConfigurationSlipCssOptions = {
  rollWidthMm: number;
  contentWidthMm: number;
  rootSelector: string;
};

/** High-ink configuration CSS for full HTML slip documents (restaurant + designer sample). */
export function buildConfigurationThermalSlipCss(
  settings: Partial<ReceiptSettings>,
  opts: ConfigurationSlipCssOptions
): string {
  const fontFamily = settings.fontFamily || "monospace";
  const leftMargin = Number(settings.marginLeft ?? 0);
  const rightMargin = Number(settings.marginRight ?? 0);
  const topMargin = Number(settings.marginTop ?? 0);
  const bottomMargin = Number(settings.marginBottom ?? 0);
  const is80 = opts.rollWidthMm >= THERMAL_ROLL_HARDWARE_MM;

  let padLeftMm = Math.max(0, leftMargin);
  let padRightMm = Math.max(0, rightMargin);
  let padTopMm = Math.max(0, topMargin);
  let padBottomMm = Math.max(2, 2 + bottomMargin);
  if (is80) {
    padTopMm = Math.max(0, topMargin);
    padBottomMm = Math.max(3, 3 + bottomMargin);
  }

  let fontCss = `font-family: 'Courier New', Courier, monospace, Arial, sans-serif;`;
  if (fontFamily === "sans-serif") {
    fontCss = `font-family: Arial, Helvetica, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`;
  } else if (fontFamily === "serif") {
    fontCss = `font-family: 'Times New Roman', Times, Georgia, serif;`;
  } else if (fontFamily === "urdu") {
    fontCss = `font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', Tahoma, sans-serif;`;
  }

  const nastaliqImport =
    fontFamily === "urdu"
      ? `@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');`
      : "";

  const configurationFontPx = Math.min(
    Math.max(Number(settings.fontSize) || 12, 8),
    20
  );

  const border = settings.borderStyle || "dashed";
  const hrStyle =
    border === "solid" || settings.templateId === "modern-carbon"
      ? "solid"
      : border === "double" || settings.templateId === "boutique-serif"
        ? "double"
        : border === "none" || settings.templateId === "minimalist-air"
          ? "none"
          : "dashed";

  const root = opts.rootSelector;

  return `
    ${nastaliqImport}
    @page {
      size: ${opts.rollWidthMm}mm auto portrait;
      margin: 0mm !important;
      padding: 0mm !important;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      color: #000 !important;
      width: ${opts.rollWidthMm}mm !important;
      max-width: ${opts.rollWidthMm}mm !important;
      ${fontCss}
    }
    ${root} {
      width: ${opts.contentWidthMm}mm !important;
      max-width: ${opts.contentWidthMm}mm !important;
      margin: 0 auto !important;
      padding: ${padTopMm}mm ${padRightMm}mm ${padBottomMm}mm ${padLeftMm}mm !important;
      box-sizing: border-box !important;
      font-size: ${configurationFontPx}px !important;
      line-height: 1.35 !important;
      overflow: visible !important;
      ${fontCss}
    }
    html, body, ${root} {
      -webkit-font-smoothing: none !important;
      text-rendering: geometricPrecision !important;
    }
    .text-black, .text-slate-400, .text-slate-500, .text-gray-500,
    ${root}, .thermal-receipt-view {
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
    }
    .bg-black { background-color: #000000 !important; }
    .text-white,
    .bg-black .text-white,
    .bg-black h1, .bg-black h2, .bg-black h3, .bg-black th, .bg-black td, .bg-black span, .bg-black div, .bg-black p {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      -webkit-text-stroke: 0 !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
    }
    th, td {
      padding: 2px 0 !important;
    }
    hr, .receipt-hairline {
      border-style: ${hrStyle} !important;
      border-color: #000 !important;
      border-width: 0 0 1px 0 !important;
      margin: 3px 0 !important;
      height: 0 !important;
    }
    ${RESTAURANT_THERMAL_TABLE_ALIGN_CSS}
    ${THERMAL_SHARP_TEXT_CSS}
  `;
}

/**
 * Generates an ultra-crisp, high-contrast, thermal-optimized HTML document for instant printing.
 * Converts all faded grays and light colors into deep solid black (#000000) for thermal print heads.
 */
export function buildThermalPrintHtml(receiptInnerHtml: string, settings: Partial<ReceiptSettings>, title = "POS Receipt"): string {
  const pageSize = settings.pageSize || "MM80";
  const fontFamily = settings.fontFamily || "monospace";

  const leftMargin = Number(settings.marginLeft ?? 0);
  const rightMargin = Number(settings.marginRight ?? 0);
  const topMargin = Number(settings.marginTop ?? 0);
  const bottomMargin = Number(settings.marginBottom ?? 0);

  const is80Roll = pageSize === "MM80";
  const is58Roll = pageSize === "MM58";

  let padLeftMm = Math.max(0, leftMargin);
  let padRightMm = Math.max(0, rightMargin);
  let padTopMm = Math.max(0, topMargin);
  let padBottomMm = Math.max(2, 2 + bottomMargin);

  let paperWidth = `${THERMAL_ROLL_HARDWARE_MM}mm`;
  let bodyWidth = `${THERMAL_80_CONTENT_MM}mm`;
  let thermalMetaMm = THERMAL_ROLL_HARDWARE_MM;
  if (is80Roll) {
    padTopMm = Math.max(0, topMargin);
    padBottomMm = Math.max(3, 3 + bottomMargin);
  }
  if (pageSize === "MM58") {
    paperWidth = `${THERMAL_58_ROLL_MM}mm`;
    bodyWidth = `${THERMAL_58_CONTENT_MM}mm`;
    thermalMetaMm = THERMAL_58_ROLL_MM;
  } else if (pageSize === "A5") {
    paperWidth = "148mm";
    bodyWidth = "140mm";
  } else if (pageSize === "A4") {
    paperWidth = "210mm";
    bodyWidth = "190mm";
  }

  let fontCss = `
    font-family: 'Courier New', Courier, monospace, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  `;
  if (fontFamily === "sans-serif") {
    fontCss = `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;`;
  } else if (fontFamily === "serif") {
    fontCss = `font-family: 'Times New Roman', Times, Georgia, serif;`;
  } else if (fontFamily === "urdu") {
    fontCss = `font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', Tahoma, sans-serif;`;
  }

  const nastaliqImport =
    fontFamily === "urdu"
      ? `@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');`
      : "";

  /** Receipt Designer (Configurations) slider is 8–20px — must reach the printer, not clamped to 10–13. */
  const configurationFontPx = Math.min(
    Math.max(Number(settings.fontSize) || 12, 8),
    20
  );

  return `<!DOCTYPE html>
<html lang="${fontFamily === "urdu" ? "ur" : "en"}">
<head>
  <meta charset="utf-8" />
  <meta name="x-thermal-width-mm" content="${pageSize === "MM58" ? String(THERMAL_58_ROLL_MM) : pageSize === "A4" ? "210" : pageSize === "A5" ? "148" : String(thermalMetaMm)}" />
  <meta name="x-thermal-format" content="roll" />
  <meta name="x-thermal-ink-level" content="configuration-high" />
  <title>${title}</title>
  <style>
    ${nastaliqImport}

    @page {
      size: ${pageSize === "A4" || pageSize === "A5" ? `${paperWidth} auto` : is80Roll ? `${THERMAL_ROLL_HARDWARE_MM}mm auto portrait` : is58Roll ? `${THERMAL_58_ROLL_MM}mm auto portrait` : `${paperWidth} auto portrait`};
      margin: 0mm !important;
      padding: 0mm !important;
    }

    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    html, body {
      margin: 0 auto !important;
      padding: ${padTopMm}mm ${padRightMm}mm ${padBottomMm}mm ${padLeftMm}mm !important;
      background: #ffffff !important;
      color: #000000 !important;
      width: ${paperWidth} !important;
      max-width: ${paperWidth} !important;
      min-width: 0 !important;
      overflow-x: hidden !important;
      ${fontCss}
      -webkit-font-smoothing: none;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: geometricPrecision;
    }

    .thermal-slip-root {
      width: ${bodyWidth} !important;
      max-width: ${bodyWidth} !important;
      margin: 0 auto !important;
      font-size: ${configurationFontPx}px !important;
      line-height: 1.4 !important;
      word-wrap: break-word !important;
      overflow-wrap: anywhere !important;
      -webkit-font-smoothing: none !important;
      text-rendering: geometricPrecision !important;
    }

    .thermal-slip-root *:not(img) {
      font-family: inherit !important;
    }

    /* Thermal Receipt Container normalization */
    div.thermal-receipt-view {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      box-shadow: none !important;
      -webkit-font-smoothing: none !important;
      text-rendering: geometricPrecision !important;
    }

    .text-black, .text-slate-400, .text-slate-500, .text-gray-500,
    .thermal-receipt-view, .thermal-slip-root {
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
    }
    .bg-black { background-color: #000000 !important; }
    .text-white,
    .bg-black .text-white,
    .bg-black h1, .bg-black h2, .bg-black h3, .bg-black th, .bg-black td, .bg-black span, .bg-black div, .bg-black p {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      -webkit-text-stroke: 0 !important;
    }

    ${THERMAL_RECEIPT_TAILWIND_SHIM_CSS}

    .thermal-slip-root.thermal-receipt-view {
      width: ${bodyWidth} !important;
      max-width: ${bodyWidth} !important;
    }

    @media print {
      html, body {
        width: ${paperWidth} !important;
        max-width: ${paperWidth} !important;
        margin: 0 auto !important;
        padding: ${padTopMm}mm ${padRightMm}mm ${padBottomMm}mm ${padLeftMm}mm !important;
      }
      .thermal-slip-root {
        width: ${bodyWidth} !important;
        max-width: ${bodyWidth} !important;
      }
      .no-print {
        display: none !important;
      }
    }

    ${THERMAL_SHARP_TEXT_CSS}
  </style>
</head>
<body>
  <div class="thermal-slip-root thermal-receipt-view">
    ${receiptInnerHtml}
  </div>
</body>
</html>`;
}

/** Serialize all thermal jobs (across orders/slips) so the spooler never overlaps. */
let thermalReceiptQueue = Promise.resolve();

function logThermalPrint(
  phase: "start" | "ok" | "fail" | "retry",
  detail: string
): void {
  if (typeof console !== "undefined") {
    console.info(`[ThermalPrint:${phase}] ${detail}`);
  }
}

const THERMAL_PRINT_MAX_ATTEMPTS = 3;
const THERMAL_PRINT_RETRY_MS = 400;

/**
 * Silent print on local Windows (named printer) when possible; otherwise iframe print dialog.
 */
export async function printThermalReceipt(
  options: PrintReceiptOptions
): Promise<void> {
  const run = () => printThermalReceiptJob(options);
  const chained = thermalReceiptQueue.then(run, run);
  thermalReceiptQueue = chained.catch(() => {});
  return chained;
}

async function printThermalReceiptJob({
  receiptHtml,
  settings,
  title = "Receipt",
  targetPrinterName,
  copies = 1,
  layout,
  posSlipKind = "payment",
  onSuccess,
  onError,
}: PrintReceiptOptions): Promise<void> {
  const isFullDocument = receiptHtml.trim().toLowerCase().startsWith("<!doctype");
  const fullHtml = isFullDocument
    ? receiptHtml
    : layout === "posrestaurant"
      ? buildPosRestaurantThermalPrintHtml(
          receiptHtml,
          settings,
          title,
          posSlipKind
        )
      : buildThermalPrintHtml(receiptHtml, settings, title);
  const printer = targetPrinterName?.trim();
  const copyCount = Math.max(1, Math.min(99, Math.floor(Number(copies) || 1)));
  const jobLabel = `${title || "Receipt"} → ${printer || "default"} ×${copyCount}`;

  logThermalPrint("start", jobLabel);

  const isDesktopElectron =
    typeof window !== "undefined" &&
    window.electronAPI?.isDesktop === true &&
    typeof window.electronAPI.printThermalSilent === "function";

  /** EXE only: IPC → main → webContents.print. No API / Sumatra / iframe. */
  const runElectronOnce = async (): Promise<boolean> => {
    if (!isDesktopElectron) return false;
    const result = await window.electronAPI!.printThermalSilent(
      fullHtml,
      printer,
      copyCount
    );
    if (result?.success) return true;
    const detail =
      typeof result?.error === "string" && result.error.trim()
        ? result.error.trim()
        : "Desktop silent print failed — check printer name in Business Settings.";
    console.warn("[Electron Silent Print]", detail);
    throw new Error(detail);
  };

  /** Browser / dev server only (API uses PDF+Sumatra — never used from desktop). */
  const runWebFallbackOnce = async (): Promise<boolean> => {
    if (typeof window === "undefined" || isDesktopElectron) return false;

    try {
      const res = await fetch("/api/restaurant/thermal-print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: fullHtml,
          printerName: printer || undefined,
          title,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        useBrowser?: boolean;
        error?: string;
      };
      if (data.ok) return true;
      if (data.error) console.warn("Thermal API print:", data.error);
    } catch (fetchErr) {
      console.warn("Thermal API print unavailable:", fetchErr);
    }

    const previewW =
      settings.pageSize === "MM58"
        ? "220px"
        : `${Math.round((THERMAL_80_PRINTABLE_MM / 25.4) * 96)}px`;

    return await new Promise<boolean>((resolve) => {
      printReceiptViaIframe(
        fullHtml,
        title,
        () => resolve(true),
        () => resolve(false),
        printer,
        previewW
      );
    });
  };

  const failError = (detail: string) =>
    new Error(detail || (printer ? `Print failed (${printer})` : "Print failed"));

  if (isDesktopElectron) {
    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= THERMAL_PRINT_MAX_ATTEMPTS; attempt++) {
      const ok = await runElectronOnce();
      if (ok) {
        logThermalPrint("ok", `${jobLabel} (attempt ${attempt})`);
        onSuccess?.();
        return;
      }
      lastErr = failError(`Desktop silent print failed (attempt ${attempt})`);
      logThermalPrint(
        attempt < THERMAL_PRINT_MAX_ATTEMPTS ? "retry" : "fail",
        `${jobLabel} — ${lastErr.message}`
      );
      if (attempt < THERMAL_PRINT_MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, THERMAL_PRINT_RETRY_MS * attempt));
      }
    }
    onError?.(lastErr);
    throw lastErr!;
  }

  for (let i = 0; i < copyCount; i++) {
    let copyOk = false;
    for (let attempt = 1; attempt <= THERMAL_PRINT_MAX_ATTEMPTS; attempt++) {
      copyOk = await runWebFallbackOnce();
      if (copyOk) break;
      if (attempt < THERMAL_PRINT_MAX_ATTEMPTS) {
        logThermalPrint("retry", `${jobLabel} copy ${i + 1}/${copyCount} attempt ${attempt}`);
        await new Promise((r) => setTimeout(r, THERMAL_PRINT_RETRY_MS * attempt));
      }
    }
    if (!copyOk) {
      const err = failError(`Print failed copy ${i + 1}/${copyCount}`);
      logThermalPrint("fail", err.message);
      onError?.(err);
      throw err;
    }
  }
  logThermalPrint("ok", jobLabel);
  onSuccess?.();
}

function printReceiptViaIframe(
  fullHtml: string,
  title: string,
  onSuccess?: () => void,
  onError?: (err: any) => void,
  hintPrinter?: string,
  previewWidth = `${Math.round((THERMAL_80_PRINTABLE_MM / 25.4) * 96)}px`
): void {
  try {
    let iframe = document.getElementById(
      "theaccounts-thermal-print-frame"
    ) as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "theaccounts-thermal-print-frame";
      iframe.setAttribute("title", "Thermal receipt print");
      iframe.style.position = "fixed";
      iframe.style.left = "0";
      iframe.style.top = "0";
      iframe.style.height = "600px";
      iframe.style.border = "0";
      iframe.style.opacity = "0.01";
      iframe.style.pointerEvents = "none";
      iframe.style.zIndex = "99999";
      document.body.appendChild(iframe);
    }
    iframe.style.width = previewWidth;

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument || win?.document;
    if (!doc || !win) {
      throw new Error(
        hintPrinter
          ? `Print frame blocked. Choose printer "${hintPrinter}" in the dialog.`
          : "Print frame blocked. Allow pop-ups for this site or refresh and try again."
      );
    }

    doc.open();
    doc.write(fullHtml);
    doc.close();

    const invokePrint = () => {
      try {
        win.focus();
        win.print();
        onSuccess?.();
      } catch (printErr) {
        console.error("Thermal print dialog error:", printErr);
        onError?.(printErr);
      }
    };

    if (win.document.readyState === "complete") {
      window.setTimeout(invokePrint, 350);
    } else {
      win.onload = () => window.setTimeout(invokePrint, 350);
    }
  } catch (err) {
    console.error("Thermal Direct Printing Error:", err);
    onError?.(err);
  }
}

/**
 * Opens the system print dialog (uses Windows **default printer** when you click Print).
 * When `targetPrinterName` is set, local Windows API is tried first for silent routing.
 */
export function printReceiptDirect(options: PrintReceiptOptions): void {
  void printThermalReceipt(options);
}
