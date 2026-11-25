import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  ReceiptTemplate,
  type ReceiptSettings,
} from "@/components/ReceiptTemplate";

/** Page CSS so the print window matches the Receipt Designer preview. */
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
  const safeTitle = title.replace(/[<>&]/g, "");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="x-thermal-width-mm" content="${width.replace("mm", "")}" />
  <meta name="x-thermal-format" content="roll" />
  <title>${safeTitle}</title>
  <style>
    ${captureDocumentCss()}
    @page { size: ${width} auto portrait; margin: 0; }
    html, body {
      margin: 0;
      padding: 0 2px 3mm 0;
      background: #fff;
      width: ${width};
      max-width: ${width};
      box-sizing: border-box;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      -webkit-font-smoothing: none !important;
      text-rendering: geometricPrecision !important;
      transform: none !important;
      filter: none !important;
      transition: none !important;
    }
    .thermal-receipt-view, .receipt-container {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    table { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; }
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
