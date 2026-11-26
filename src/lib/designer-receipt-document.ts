import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_RECEIPT_SETTINGS,
  ReceiptTemplate,
  type ReceiptSettings,
} from "@/components/ReceiptTemplate";
import { resolveRestaurantRollDimensions } from "@/lib/restaurant-receipt-styling";
import { THERMAL_RECEIPT_TAILWIND_SHIM_CSS } from "@/lib/thermal-receipt-tailwind-shim";
import {
  buildConfigurationThermalSlipCss,
  THERMAL_ROLL_HARDWARE_MM,
} from "@/lib/thermalPrinter";

/** Live dashboard styles (preview only — do not use in silent thermal print). */
export function captureDocumentCss(): string {
  if (typeof document === "undefined") return "";
  let css = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        css += `${rule.cssText}\n`;
      }
    } catch {
      const href = sheet.href;
      if (href) css += `@import url("${href}");\n`;
    }
  }
  return css;
}

function designerPrintCss(settings?: Partial<ReceiptSettings>): string {
  const merged = { ...DEFAULT_RECEIPT_SETTINGS, ...settings };
  const { rollWidthMm, contentWidthMm } = resolveRestaurantRollDimensions(merged);
  return `${buildConfigurationThermalSlipCss(merged, {
    rollWidthMm,
    contentWidthMm,
    rootSelector: ".thermal-receipt-view",
  })}\n${THERMAL_RECEIPT_TAILWIND_SHIM_CSS}`;
}

function pageWidth(settings?: Partial<ReceiptSettings>): string {
  if (settings?.pageSize === "MM58") return "58mm";
  if (settings?.pageSize === "A4") return "210mm";
  if (settings?.pageSize === "A5") return "148mm";
  return "80mm";
}

/** Full HTML document: same markup as the designer preview, plus its styles. */
export function buildDesignerReceiptDocument(
  markup: string,
  settings: Partial<ReceiptSettings> | undefined,
  title: string
): string {
  const width = pageWidth(settings);
  const widthMm = width.replace("mm", "") || String(THERMAL_ROLL_HARDWARE_MM);
  const safeTitle = title.replace(/[<>&]/g, "");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="x-thermal-width-mm" content="${widthMm}" />
  <meta name="x-thermal-format" content="roll" />
  <meta name="x-thermal-ink-level" content="restaurant-high" />
  <title>${safeTitle}</title>
  <style>
    ${designerPrintCss(settings)}
    img.receipt-logo, img {
      max-width: 100% !important;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      filter: none !important;
    }
  </style>
</head>
<body>${markup}</body>
</html>`;
}

export function renderDesignerReceiptMarkup(props: {
  settings: Partial<ReceiptSettings>;
  invoice: unknown;
  shopDetails: {
    name: string;
    phone?: string;
    address?: string;
    email?: string;
    website?: string;
  };
}): string {
  if (typeof document === "undefined") return "";
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => {
    root.render(createElement(ReceiptTemplate, props));
  });
  const markup = host.innerHTML;
  root.unmount();
  return markup;
}
