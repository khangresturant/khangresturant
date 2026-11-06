// High-Contrast Direct Thermal Printing Engine for Web POS
// Optimizes thermal receipts for 80mm & 58mm POS printers (Xprinter, Black Copper, Rongta, Epson, ZJiang, etc.)
// Ensures pitch-black text, crisp solid borders, zero-latency rendering, and iframe-based direct printing.

import { ReceiptSettings } from "@/components/ReceiptTemplate";

export interface PrintReceiptOptions {
  receiptHtml: string;
  settings: Partial<ReceiptSettings>;
  title?: string;
  /** Windows printer name; empty = try default via API, then browser dialog */
  targetPrinterName?: string;
  onSuccess?: () => void;
  onError?: (err: any) => void;
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

  const padLeftMm = Math.max(0.2, 1 + leftMargin);
  const padRightMm = Math.max(0.2, 1 + rightMargin);
  const padTopMm = Math.max(0.5, 1.5 + topMargin);
  const padBottomMm = Math.max(0.5, 2 + bottomMargin);

  let paperWidth = "80mm";
  let bodyWidth = "76mm";
  if (pageSize === "MM58") {
    paperWidth = "58mm";
    bodyWidth = "52mm";
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');

    @page {
      size: ${paperWidth} auto;
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
      width: ${bodyWidth} !important;
      max-width: ${bodyWidth} !important;
      ${fontCss}
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
    }

    /* Thermal Receipt Container normalization */
    div.thermal-receipt-view,
    .thermal-receipt-view.border,
    .thermal-receipt-view.border-black\\/40,
    .thermal-receipt-view {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      border-width: 0px !important;
      background: transparent !important;
      box-shadow: none !important;
      outline: none !important;
    }

    /* Thermal High-Contrast Overrides: Turn everything pitch black */
    body * {
      color: #000000 !important;
      text-shadow: none !important;
    }

    /* Keep headings and key numbers bold */
    h1, h2, h3, h4, h5, h6, strong, b, .font-bold, .font-black, .font-extrabold, th {
      color: #000000 !important;
      font-weight: 800 !important;
    }

    p, span, div, td, th {
      color: #000000 !important;
    }

    /* Borders: Crisp and visible on thermal paper */
    .border { border: 1px solid #000000 !important; }
    .border-2 { border: 2px solid #000000 !important; }
    .border-t { border-top: 1px solid #000000 !important; }
    .border-b { border-bottom: 1px solid #000000 !important; }
    .border-r { border-right: 1px solid #000000 !important; }
    .border-l { border-left: 1px solid #000000 !important; }
    .border-y { border-top: 1px solid #000000 !important; border-bottom: 1px solid #000000 !important; }
    .border-x { border-left: 1px solid #000000 !important; border-right: 1px solid #000000 !important; }
    .border-t-2 { border-top: 2px solid #000000 !important; }
    .border-b-2 { border-bottom: 2px solid #000000 !important; }
    .border-y-2 { border-top: 2px solid #000000 !important; border-bottom: 2px solid #000000 !important; }
    .border-y-4 { border-top: 4px solid #000000 !important; border-bottom: 4px solid #000000 !important; }
    .border-dashed { border-style: dashed !important; border-color: #000000 !important; }
    .border-dotted { border-style: dotted !important; border-color: #000000 !important; }
    .border-double { border-style: double !important; border-color: #000000 !important; }
    .divide-y > * + * { border-top: 1px solid #000000 !important; }
    .divide-black\\/30 > * + * { border-top: 1px solid rgba(0,0,0,0.5) !important; }

    /* Ensure container never has outer border even after .border rule */
    div.thermal-receipt-view,
    .thermal-receipt-view.border,
    .thermal-receipt-view.border-black\\/40 {
      border: none !important;
      border-width: 0px !important;
    }

    table {
      width: 100% !important;
      border-collapse: collapse !important;
      color: #000000 !important;
    }

    th, td {
      color: #000000 !important;
      padding: 1.5px 0 !important;
    }

    img {
      max-width: 100% !important;
      filter: grayscale(100%) contrast(200%) !important;
      display: block !important;
    }

    /* Fixed dimensions for QR codes and logos */
    .w-16 { width: 56px !important; min-width: 56px !important; max-width: 56px !important; }
    .h-16 { height: 56px !important; min-height: 56px !important; max-height: 56px !important; }
    .w-20 { width: 72px !important; min-width: 72px !important; max-width: 72px !important; }
    .h-20 { height: 72px !important; min-height: 72px !important; max-height: 72px !important; }
    .w-10 { width: 36px !important; }
    .h-10 { height: 36px !important; }
    .w-auto { width: auto !important; }
    .h-auto { height: auto !important; }
    .w-full { width: 100% !important; }
    .h-full { height: 100% !important; }
    .object-contain { object-fit: contain !important; }
    .overflow-hidden { overflow: hidden !important; }

    /* Flexbox and Layout Polyfills */
    .flex { display: flex !important; }
    .flex-col { flex-direction: column !important; }
    .flex-wrap { flex-wrap: wrap !important; }
    .items-center { align-items: center !important; }
    .items-start { align-items: flex-start !important; }
    .items-end { align-items: flex-end !important; }
    .justify-between { justify-content: space-between !important; }
    .justify-center { justify-content: center !important; }
    .justify-end { justify-content: flex-end !important; }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .text-left { text-align: left !important; }
    .uppercase { text-transform: uppercase !important; }
    .font-mono { font-family: 'Courier New', Courier, monospace !important; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .italic { font-style: italic !important; }
    .underline { text-decoration: underline !important; }

    /* Gaps */
    .gap-0\\.5 { gap: 2px !important; }
    .gap-1 { gap: 4px !important; }
    .gap-1\\.5 { gap: 6px !important; }
    .gap-2 { gap: 8px !important; }
    .gap-3 { gap: 12px !important; }
    .gap-4 { gap: 16px !important; }

    /* Spacing between children */
    .space-y-0\\.5 > * + * { margin-top: 2px !important; }
    .space-y-1 > * + * { margin-top: 4px !important; }
    .space-y-1\\.5 > * + * { margin-top: 6px !important; }
    .space-y-2 > * + * { margin-top: 8px !important; }

    /* Font Sizes */
    .text-\\[7\\.5px\\] { font-size: 7.5px !important; line-height: 1.1 !important; }
    .text-\\[8px\\] { font-size: 8px !important; line-height: 1.15 !important; }
    .text-\\[8\\.5px\\] { font-size: 8.5px !important; line-height: 1.2 !important; }
    .text-\\[9px\\] { font-size: 9px !important; line-height: 1.2 !important; }
    .text-\\[9\\.5px\\] { font-size: 9.5px !important; line-height: 1.25 !important; }
    .text-\\[10px\\] { font-size: 10px !important; line-height: 1.3 !important; }
    .text-\\[11px\\] { font-size: 11px !important; line-height: 1.3 !important; }
    .text-\\[12px\\] { font-size: 12px !important; line-height: 1.3 !important; }
    .text-xs { font-size: 11px !important; }
    .text-sm { font-size: 13px !important; }
    .text-base { font-size: 15px !important; }

    /* Paddings */
    .p-0\\.5 { padding: 2px !important; }
    .p-1 { padding: 4px !important; }
    .p-1\\.5 { padding: 6px !important; }
    .p-2 { padding: 8px !important; }
    .p-2\\.5 { padding: 10px !important; }
    .p-3\\.5 { padding: 12px !important; }
    .py-0\\.5 { padding-top: 2px !important; padding-bottom: 2px !important; }
    .py-1 { padding-top: 4px !important; padding-bottom: 4px !important; }
    .py-1\\.5 { padding-top: 6px !important; padding-bottom: 6px !important; }
    .py-2 { padding-top: 8px !important; padding-bottom: 8px !important; }
    .px-0\\.5 { padding-left: 2px !important; padding-right: 2px !important; }
    .px-1 { padding-left: 4px !important; padding-right: 4px !important; }
    .px-1\\.5 { padding-left: 6px !important; padding-right: 6px !important; }
    .px-2 { padding-left: 8px !important; padding-right: 8px !important; }
    .pt-0\\.5 { padding-top: 2px !important; }
    .pt-1 { padding-top: 4px !important; }
    .pt-2 { padding-top: 8px !important; }
    .pb-0\\.5 { padding-bottom: 2px !important; }
    .pb-1 { padding-bottom: 4px !important; }
    .pr-2 { padding-right: 8px !important; }

    /* Margins */
    .my-1 { margin-top: 4px !important; margin-bottom: 4px !important; }
    .my-1\\.5 { margin-top: 6px !important; margin-bottom: 6px !important; }
    .my-2 { margin-top: 8px !important; margin-bottom: 8px !important; }
    .mt-0\\.5 { margin-top: 2px !important; }
    .mt-1 { margin-top: 4px !important; }
    .mt-2 { margin-top: 8px !important; }
    .mt-2\\.5 { margin-top: 10px !important; }
    .mb-1 { margin-bottom: 4px !important; }
    .mb-2 { margin-bottom: 8px !important; }
    .mb-2\\.5 { margin-bottom: 10px !important; }

    /* Rounded */
    .rounded { border-radius: 3px !important; }
    .rounded-xs { border-radius: 2px !important; }
    .rounded-md { border-radius: 4px !important; }
    .rounded-lg { border-radius: 6px !important; }
    .rounded-xl { border-radius: 8px !important; }

    @media print {
      body {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div style="width: 100%; margin: 0 auto;">
    ${receiptInnerHtml}
  </div>
</body>
</html>`;
}

/**
 * Silent print on local Windows (named printer) when possible; otherwise iframe print dialog.
 */
export async function printThermalReceipt({
  receiptHtml,
  settings,
  title = "Receipt",
  targetPrinterName,
  onSuccess,
  onError,
}: PrintReceiptOptions): Promise<void> {
  const fullHtml = buildThermalPrintHtml(receiptHtml, settings, title);
  const printer = targetPrinterName?.trim();

  if (typeof window !== "undefined") {
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
        printer?: string;
      };
      if (data.ok) {
        onSuccess?.();
        return;
      }
      if (data.useBrowser && data.error) {
        console.warn("Thermal silent print fallback:", data.error);
      }
    } catch (fetchErr) {
      console.warn("Thermal API print unavailable:", fetchErr);
    }
  }

  printReceiptViaIframe(fullHtml, title, onSuccess, onError, printer);
}

function printReceiptViaIframe(
  fullHtml: string,
  title: string,
  onSuccess?: () => void,
  onError?: (err: any) => void,
  hintPrinter?: string
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
      iframe.style.width = "1px";
      iframe.style.height = "1px";
      iframe.style.border = "0";
      iframe.style.opacity = "0.01";
      iframe.style.pointerEvents = "none";
      iframe.style.zIndex = "99999";
      document.body.appendChild(iframe);
    }

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
