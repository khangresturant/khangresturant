import { buildRestaurantBillPreviewHtml } from "../src/lib/restaurant-receipt-print.ts";
import { RECEIPT_TEMPLATES, DEFAULT_RECEIPT_SETTINGS } from "../src/components/ReceiptTemplate.tsx";
import { mergeRestaurantReceiptPrintSettings } from "../src/lib/receipt-template-default.ts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReceiptTemplate } from "../src/components/ReceiptTemplate.tsx";

const html = buildRestaurantBillPreviewHtml(DEFAULT_RECEIPT_SETTINGS, {
  name: "Cook Swift",
  phone: "0300",
  address: "Lahore",
});

const checks = [
  ["4 item cells", html.includes('class="bill-item"') && html.includes('class="bill-qty"') && html.includes('class="bill-unit"') && html.includes('class="bill-line-total"')],
  ["36mm item", html.includes("36mm")],
  ["10mm qty", html.includes("10mm")],
  ["17mm price", html.includes("17mm")],
  ["2px right", html.includes("padding-right: 2px") || html.includes("padding-right:2px")],
  ["not remapped classic header", !html.includes("Article / Description")],
];

const reset = mergeRestaurantReceiptPrintSettings({
  ...DEFAULT_RECEIPT_SETTINGS,
  templateId: "restaurant-default",
  fontSize: 20,
  fontFamily: "serif",
  marginRight: 12,
});
checks.push(["default font stays 11", reset.fontSize === 11]);
checks.push(["default font family", reset.fontFamily === "monospace"]);
checks.push(["default margin cleared", reset.marginRight === 0]);

const invoice = {
  id: "1",
  items: [{ name: "Tea", quantity: 2, price: 100, subtotal: 200 }],
  total_amount: 200,
  tax_amount: 0,
  discount: 0,
};
const shop = { name: "Shop" };
for (const tmpl of RECEIPT_TEMPLATES) {
  if (tmpl.id === "restaurant-default") continue;
  const markup = renderToStaticMarkup(
    createElement(ReceiptTemplate, {
      settings: { ...DEFAULT_RECEIPT_SETTINGS, templateId: tmpl.id },
      invoice,
      shopDetails: shop,
    })
  );
  checks.push([`template ${tmpl.id} renders`, markup.includes("Tea") && markup.length > 200]);
}

const noLogo = renderToStaticMarkup(
  createElement(ReceiptTemplate, {
    settings: { ...DEFAULT_RECEIPT_SETTINGS, templateId: "classic-thermal", showLogo: false, logoUrl: "" },
    invoice,
    shopDetails: shop,
  })
);
const withLogo = renderToStaticMarkup(
  createElement(ReceiptTemplate, {
    settings: { ...DEFAULT_RECEIPT_SETTINGS, templateId: "modern-carbon", showLogo: true, logoUrl: "https://example.com/logo.png" },
    invoice,
    shopDetails: shop,
  })
);
checks.push(["no logo means no image", !noLogo.includes("<img")]);
checks.push(["selected logo renders", withLogo.includes("receipt-logo") && withLogo.includes("logo.png")]);
checks.push(["classic fits page width", noLogo.includes("width:100%") || noLogo.includes("width: 100%")]);

const failed = checks.filter(([, ok]) => !ok);
console.log(checks.map(([n, ok]) => `${ok ? "OK" : "FAIL"} ${n}`).join("\n"));
if (failed.length) {
  console.error("FAILED", failed.map(([n]) => n).join(", "));
  process.exit(1);
}
console.log("RECEIPT_FLOW_OK");
