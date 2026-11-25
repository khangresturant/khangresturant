/**
 * Direct port of POSRESTURANT `fast_food_order_view.py` receipt helpers
 * (module-level builders + `fast_food_display.py` kitchen rows / payment footer).
 */

import { RECEIPT_FOOTER_CSS } from "@/lib/posrestaurant-receipt-template";
import { RESTAURANT_THERMAL_TABLE_ALIGN_CSS } from "@/lib/restaurant-thermal-table-align";
import {
  THERMAL_80_PRINTABLE_MM,
  THERMAL_ROLL_HARDWARE_MM,
} from "@/lib/thermalPrinter";

export { RESTAURANT_THERMAL_TABLE_ALIGN_CSS } from "@/lib/restaurant-thermal-table-align";
import { mergeSizeIntoKitchenDisplayName } from "@/lib/restaurant-kot-display";
import {
  receiptSizeColumnValue,
  slipUsesTwoColumnItemTable,
} from "@/lib/restaurant-receipt-size";
import {
  RESTAURANT_BILL_COL_MM,
  RESTAURANT_BILL_ITEMS_TABLE_CSS,
} from "@/lib/restaurant-thermal-table-align";

/** Shown at the very bottom of thermal slips (restaurant). */
export const RECEIPT_DEVELOPED_BY = "Powered by Falcon Shift";
/** @deprecated Use RECEIPT_DEVELOPED_BY */
export const RECEIPT_ORDERED_BY = RECEIPT_DEVELOPED_BY;
export const DEVELOPER_CREDIT = RECEIPT_DEVELOPED_BY;
export const RECEIPT_FOOTER_THANKS = "Thank you for your order!";
export const RECEIPT_NA = "N/A";
export const WALK_IN_CUSTOMER = "Walk-in Customer";

export const RECEIPT_LBL_ORDER_NO = "Order #";
export const RECEIPT_LBL_DATE = "Date";
export const RECEIPT_LBL_TABLE = "Table";
export const RECEIPT_LBL_ORDER_TAKER = "Order taker";
export const RECEIPT_LBL_DELIVERY_BOY = "Delivery boy";
export const RECEIPT_LBL_PHONE = "Phone";
export const RECEIPT_LBL_CUSTOMER = "Customer";
export const RECEIPT_LBL_ADDRESS = "Address";
export const RECEIPT_LBL_STATUS = "Status";
export const RECEIPT_LBL_TYPE = "Type";

export type FastFoodKitchenLine = {
  name: string;
  quantity: number;
  sizeLabel?: string | null;
  description?: string | null;
  remarks?: string | null;
};

export type FastFoodKitchenReceiptInput = {
  orderNumber?: string | null;
  createdAt?: string | Date;
  serviceType?: string | null;
  tableName?: string | null;
  waiterName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  deliveryBoyPhone?: string | null;
  specialInstructions?: string | null;
  items: FastFoodKitchenLine[];
  /** Default: Kitchen Order */
  title?: string;
};

export type FastFoodPaymentLine = {
  name: string;
  size: string;
  quantity: number;
  lineTotal: number;
};

export type FastFoodPaymentReceiptInput = {
  orderNumber?: string | null;
  createdAt?: string | Date;
  serviceType?: string | null;
  tableName?: string | null;
  waiterName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  deliveryBoyPhone?: string | null;
  orderStatus?: string | null;
  companyName?: string;
  companyPhone?: string;
  companyAddress?: string;
  logoUrl?: string | null;
  items: FastFoodPaymentLine[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  deliveryFee: number;
  additionalCharges: number;
  netTotal: number;
  footerNote?: string | null;
  paymentModeLabel?: string | null;
  /** Cook Swift-only banner above header (revised bill, etc.) */
  headerBannerHtml?: string;
  /** After totals (received / change). */
  afterTotalsHtml?: string;
  /** Receipt Designer detail toggles (guest bill + payment). */
  showShopPhone?: boolean;
  showShopAddress?: boolean;
  showCustomerInfo?: boolean;
  showDiscount?: boolean;
  showTax?: boolean;
  showPaymentMode?: boolean;
  thankYouMessage?: string | null;
};

function htmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `fast_food_order_view.get_receipt_order_number` */
export function getReceiptOrderNumber(orderNumber?: string | null): string {
  if (!orderNumber) return "";
  const s = String(orderNumber).trim();
  if (s.includes("-")) return s.split("-").pop() || s;
  return s;
}

/** `fast_food_order_view.get_order_type_label` */
export function getOrderTypeLabel(serviceType?: string | null): string {
  const raw = (serviceType || "").trim();
  const ot = raw.toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
  if (ot === "dine_in" || ot === "dinein" || ot === "dining") return "Dine In";
  if (ot === "delivery") return "Delivery";
  return "Take Away";
}

function isDeliveryOrder(serviceType?: string | null): boolean {
  const raw = (serviceType || "").trim().toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
  return raw === "delivery";
}

/** `fast_food_display.clean_order_item_instructions_for_kitchen` */
export function cleanOrderItemInstructionsForKitchen(
  customInstructions?: string | null
): string {
  if (!customInstructions) return "";
  let cleaned = customInstructions.replace(/\s*\|\s*DEAL_ID:\d+/gi, "");
  cleaned = cleaned.replace(/\s*\|\s*ORIGINAL_PRICE:[0-9.]+/gi, "");
  cleaned = cleaned.replace(/\s*\|\s*DEAL_PRICE:[0-9.]+/gi, "");
  cleaned = cleaned.replace(/\s*\|\s*$/g, "");
  return cleaned.trim();
}

/** `fast_food_display.kitchen_order_items_table_rows` */
export function kitchenOrderItemsTableRows(items: FastFoodKitchenLine[]): string {
  if (!items.length) return "";
  return items
    .map((item) => {
      const sizeTxt = (item.sizeLabel || "").trim();
      const qty = item.quantity || 1;
      const rawCi = item.remarks || "";
      let note = cleanOrderItemInstructionsForKitchen(rawCi);
      if (note.toLowerCase().startsWith("deal:") && rawCi.toLowerCase().includes("deal_id:")) {
        note = "";
      }
      const sizePart = sizeTxt ? `Size: ${htmlEscape(sizeTxt)} | ` : "";
      const desc = (item.description || "").trim();
      const descHtml = desc
        ? `<div style="font-size:8px;color:#444;margin-top:2px;line-height:1.25;">${htmlEscape(desc)}</div>`
        : "";
      const noteHtml = note
        ? `<div style="font-size:8px;font-style:italic;color:#333;margin-top:2px;line-height:1.25;">Note: ${htmlEscape(note)}</div>`
        : "";
      return `
            <tr>
                <td colspan="3" style="text-align:left;padding:5px 6px;vertical-align:top;border-bottom:1px solid #ccc;">
                    <div style="font-weight:bold;font-size:10px;">${htmlEscape(item.name)}</div>
                    ${descHtml}
                    <div style="font-size:9px;margin-top:2px;">${sizePart}Qty: ${qty}</div>
                    ${noteHtml}
                </td>
            </tr>
            `;
    })
    .join("\n");
}

function formatCreatedKitchen(when?: string | Date): string {
  if (!when) return "N/A";
  const d = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(d.getTime())) return String(when);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatCreatedPayment(when?: string | Date): string {
  if (!when) return RECEIPT_NA;
  const d = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(d.getTime())) return String(when);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getReceiptCustomerName(name?: string | null): string {
  const n = (name || "Walk-in Customer").trim();
  if (n.toLowerCase() === "walk-in customer" || n.toLowerCase() === "walk in customer") {
    return WALK_IN_CUSTOMER;
  }
  return n;
}

/** `fast_food_order_view.format_payment_receipt_info_html` */
export function formatPaymentReceiptInfoHtml(
  input: {
  orderNumber?: string | null;
  createdAt?: string | Date;
  serviceType?: string | null;
  tableName?: string | null;
  waiterName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  deliveryBoyPhone?: string | null;
  orderStatus?: string | null;
  },
  opts?: { showCustomer?: boolean }
): string {
  const tableNo = (input.tableName || RECEIPT_NA).trim() || RECEIPT_NA;
  const waiter = (input.waiterName || "").trim() || RECEIPT_NA;
  const created = formatCreatedPayment(input.createdAt);
  const lines: string[] = [
    `<p>${RECEIPT_LBL_ORDER_NO}: ${getReceiptOrderNumber(input.orderNumber)} &nbsp;|&nbsp; ${RECEIPT_LBL_DATE}: ${htmlEscape(created)}</p>`,
    `<p>${RECEIPT_LBL_TABLE}: ${htmlEscape(tableNo)} | ${RECEIPT_LBL_ORDER_TAKER}: ${htmlEscape(waiter)}</p>`,
  ];
  if (isDeliveryOrder(input.serviceType)) {
    const dboy = (input.waiterName || "").trim() || RECEIPT_NA;
    const dphone = (input.deliveryBoyPhone || "").trim() || RECEIPT_NA;
    lines.push(
      `<p>${RECEIPT_LBL_DELIVERY_BOY}: ${htmlEscape(dboy)} | ${RECEIPT_LBL_PHONE}: ${htmlEscape(dphone)}</p>`
    );
  }
  const showCustomer = opts?.showCustomer !== false;
  if (showCustomer) {
    lines.push(
      `<p>${RECEIPT_LBL_CUSTOMER}: ${htmlEscape(getReceiptCustomerName(input.customerName))}</p>`
    );
    const addr = (input.customerAddress || "").trim();
    const phone = (input.customerPhone || "").trim();
    if (addr) {
      lines.push(`<p>${RECEIPT_LBL_ADDRESS}: ${htmlEscape(addr)}</p>`);
    }
    if (phone) {
      lines.push(`<p>${RECEIPT_LBL_PHONE}: ${htmlEscape(phone)}</p>`);
    }
  }
  const status = (input.orderStatus || RECEIPT_NA).toString().toUpperCase();
  const otype = getOrderTypeLabel(input.serviceType);
  lines.push(`<p>${RECEIPT_LBL_STATUS}: ${htmlEscape(status)} | ${RECEIPT_LBL_TYPE}: ${htmlEscape(otype)}</p>`);
  return lines.join("\n                        ");
}

/** `fast_food_display.company_footer_note` */
export function companyFooterNote(website?: string | null): string {
  const raw = (website || "").trim();
  if (!raw) return "";
  const key = raw.toLowerCase().replace(/_/g, " ").trim();
  if (key === "write your footer note here" || key === "write your footer note") return "";
  return raw;
}

function receiptFooterNoteLinesHtml(footerNote?: string | null): string {
  const raw = (footerNote || "").trim();
  if (!raw) return "";
  return raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => `<p class="receipt-footer-note">${htmlEscape(text)}</p>`)
    .join("\n                        ");
}

/** `fast_food_display.receipt_payment_footer_html` */
export function receiptPaymentFooterHtml(
  footerNote?: string | null,
  thankYou?: string | null
): string {
  const thanks = (thankYou || "").trim() || RECEIPT_FOOTER_THANKS;
  const chunks = [`<p>${htmlEscape(thanks)}</p>`];
  const noteBlock = receiptFooterNoteLinesHtml(footerNote);
  if (noteBlock) chunks.push(noteBlock);
  chunks.push(
    `<p class="receipt-developed-by">${htmlEscape(RECEIPT_DEVELOPED_BY)}</p>`
  );
  return chunks.join("\n                        ");
}

function receiptDevelopedByFooterHtml(): string {
  return `<p class="receipt-developed-by">${htmlEscape(RECEIPT_DEVELOPED_BY)}</p>`;
}

/** Kitchen slip meta block (order #, table, taker, customer). */
export function formatKitchenReceiptInfoHtml(input: {
  orderNumber?: string | null;
  createdAt?: string | Date;
  serviceType?: string | null;
  tableName?: string | null;
  waiterName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  deliveryBoyPhone?: string | null;
}): string {
  const created = formatCreatedKitchen(input.createdAt ?? new Date());
  const tableNo = (input.tableName || "").trim();
  const waiter = (input.waiterName || "").trim();
  const customer = getReceiptCustomerName(input.customerName);
  const phone = (input.customerPhone || "").trim();
  const lines: string[] = [
    `<p style="margin:0;padding:0;line-height:1.2;"><strong>${RECEIPT_LBL_ORDER_NO}:</strong> ${htmlEscape(getReceiptOrderNumber(input.orderNumber) || RECEIPT_NA)}</p>`,
    `<p style="margin:0;padding:0;line-height:1.2;"><strong>${RECEIPT_LBL_DATE}:</strong> ${htmlEscape(created)} &nbsp;|&nbsp; <strong>${RECEIPT_LBL_TYPE}:</strong> ${htmlEscape(getOrderTypeLabel(input.serviceType))}</p>`,
  ];
  if (tableNo) {
    lines.push(
      `<p style="margin:0;padding:0;line-height:1.2;"><strong>${RECEIPT_LBL_TABLE}:</strong> ${htmlEscape(tableNo)}${waiter ? ` &nbsp;|&nbsp; <strong>${RECEIPT_LBL_ORDER_TAKER}:</strong> ${htmlEscape(waiter)}` : ""}</p>`
    );
  } else if (waiter) {
    lines.push(
      `<p style="margin:0;padding:0;line-height:1.2;"><strong>${RECEIPT_LBL_ORDER_TAKER}:</strong> ${htmlEscape(waiter)}</p>`
    );
  }
  lines.push(
    `<p style="margin:0;padding:0;line-height:1.2;"><strong>${RECEIPT_LBL_CUSTOMER}:</strong> ${htmlEscape(customer)}${phone ? ` &nbsp;|&nbsp; <strong>${RECEIPT_LBL_PHONE}:</strong> ${htmlEscape(phone)}` : ""}</p>`
  );
  if (isDeliveryOrder(input.serviceType)) {
    const addr = (input.customerAddress || "").trim();
    const riderPhone = (input.deliveryBoyPhone || "").trim();
    if (addr) {
      lines.push(
        `<p style="margin:0;padding:0;line-height:1.2;"><strong>${RECEIPT_LBL_ADDRESS}:</strong> ${htmlEscape(addr)}</p>`
      );
    }
    if (riderPhone) {
      lines.push(
        `<p style="margin:0;padding:0;line-height:1.2;"><strong>${RECEIPT_LBL_DELIVERY_BOY} ${RECEIPT_LBL_PHONE}:</strong> ${htmlEscape(riderPhone)}</p>`
      );
    }
  }
  return lines.join("\n");
}

const THERMAL_HAIRLINE_CSS = `
hr {
  border: none;
  border-top: 0.45px solid #000;
  margin: 3px 0;
  height: 0;
}
.receipt-hairline {
  border: none;
  border-top: 0.45px solid #000;
  margin: 3px 0;
  height: 0;
}
`;

/** Blank feed after last line (incl. Falcon footer) — no inset at top of roll. */
export const THERMAL_RECEIPT_BOTTOM_MARGIN_MM = 3;

function thermalRollShellCss(_contentWidthMm: number, rollWidthMm: number): string {
  return `
html, body {
  width: ${rollWidthMm}mm;
  max-width: ${rollWidthMm}mm;
  margin: 0 !important;
  padding: 0 !important;
  overflow-x: hidden;
}
`;
}

/** Kitchen-order layout; readable 80mm thermal sizes (between old 7–8px POS and 15px THERMAL_80_FIT). */
function thermalKitchenReceiptLayoutCss(contentWidthMm: number): string {
  return `
body {
  font-family: Arial, Helvetica, sans-serif;
  margin: 0;
  padding: 0;
  background-color: #fff;
  color: #000;
}
.receipt-container {
  width: 100%;
  max-width: ${contentWidthMm}mm;
  background: #fff;
  padding: 0 2px ${THERMAL_RECEIPT_BOTTOM_MARGIN_MM}mm 0;
  margin: 0;
  box-sizing: border-box;
  overflow: visible;
}
.header {
  text-align: center;
  border-bottom: 0;
  padding-bottom: 0;
  margin: 0;
}
.header p {
  font-size: 11px;
  margin: 0;
  padding: 0;
  color: #000;
  line-height: 1.25;
}
.header .shop-name {
  font-size: 14px;
  font-weight: bold;
}
.kitchen-order-heading, .section-title {
  text-align: center;
  font-weight: 800;
  font-size: 15px;
  padding: 0 0 4px 0;
  margin-top: 0;
  text-transform: uppercase;
  color: #000;
}
.info, .totals, .footer {
  font-size: 11px;
  margin: 0;
  padding: 0;
  color: #000;
}
.info p, .totals p, .footer p, .footer .receipt-footer-note {
  margin: 0;
  padding: 0;
  line-height: 1.25;
  font-size: 11px;
  color: #000;
  overflow-wrap: anywhere;
  word-break: break-word;
}
${RESTAURANT_THERMAL_TABLE_ALIGN_CSS}
${RECEIPT_FOOTER_CSS}
${THERMAL_HAIRLINE_CSS}
`;
}

/** Dense black thermal output — guest bill, paid receipt, reprint KOT (same as kitchen slip). */
const THERMAL_HIGH_INK_CSS = `
*, *::before, *::after {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}
html, body, .receipt-container {
  -webkit-font-smoothing: none !important;
  -moz-osx-font-smoothing: grayscale !important;
  text-rendering: geometricPrecision !important;
  transform: none !important;
  filter: none !important;
}
th, td, p, span, div, strong, b, .info, .totals, .header, .footer,
.kitchen-order-heading, .section-title {
  color: #000 !important;
}
th {
  font-weight: 800 !important;
}
td, p, span, div, .info p, .totals p {
  font-weight: 700 !important;
}
strong, b, .shop-name, .kitchen-order-heading, .section-title {
  font-weight: 900 !important;
}
.receipt-developed-by {
  text-align: center;
  font-size: 10px;
  font-weight: 800;
  color: #000 !important;
  padding: 6px 0 2px;
  margin: 0;
  line-height: 1.2;
}
`;

/** Default hardcoded kitchen-order CSS (unchanged); 80mm roll / 78mm content. */
export function buildRestaurantKitchenReceiptHeadStyles(
  contentWidthMm = THERMAL_80_PRINTABLE_MM,
  rollWidthMm = THERMAL_ROLL_HARDWARE_MM
): string {
  return `
${thermalRollShellCss(contentWidthMm, rollWidthMm)}
${thermalKitchenReceiptLayoutCss(contentWidthMm)}
${THERMAL_HIGH_INK_CSS}
`;
}

export const THERMAL_RECEIPT_HEAD_STYLES = buildRestaurantKitchenReceiptHeadStyles();

export type RestaurantSlipDocumentStyle = {
  css: string;
  headMeta: string;
};

function defaultSlipDocumentStyle(): RestaurantSlipDocumentStyle {
  return {
    css: THERMAL_RECEIPT_HEAD_STYLES,
    headMeta: `<meta name="x-thermal-width-mm" content="${THERMAL_ROLL_HARDWARE_MM}" />
  <meta name="x-thermal-format" content="roll" />
  <meta name="x-thermal-ink-level" content="restaurant-high" />`,
  };
}

function slipDocumentStyle(
  documentStyle?: RestaurantSlipDocumentStyle | null
): RestaurantSlipDocumentStyle {
  return documentStyle?.css && documentStyle?.headMeta
    ? documentStyle
    : defaultSlipDocumentStyle();
}

/** Roti/kathi section slip — drop only the single full-width rule above the item table (not column rules). */
const KITCHEN_SECTION_TABLE_CSS = `
table.kitchen-section-items {
    border-top: none;
    border-bottom: none;
}
`;

function kitchenItemTableHead(twoCol: boolean, shortLabels = false): string {
  const itemHdr = shortLabels ? "Item" : "Item Description";
  const qtyHdr = shortLabels ? "Qty" : "Qty";
  if (twoCol) {
    return `<tr>
                                <th class="product">${itemHdr}</th>
                                <th class="qty">${qtyHdr}</th>
                            </tr>`;
  }
  return `<tr>
                                <th class="product">${itemHdr}</th>
                                <th class="size">Size</th>
                                <th class="qty">${qtyHdr}</th>
                            </tr>`;
}

function kitchenItemTableRows(
  items: FastFoodKitchenLine[],
  twoCol: boolean
): string {
  const parts: string[] = [];
  for (const item of items) {
    const displayName = mergeSizeIntoKitchenDisplayName(item.name, item.sizeLabel);
    const sizeCell = receiptSizeColumnValue(displayName, item.sizeLabel);
    if (twoCol) {
      parts.push(`<tr>
                            <td class="product">${htmlEscape(displayName)}</td>
                            <td class="qty">${item.quantity}</td>
                        </tr>`);
    } else {
      parts.push(`<tr>
                            <td class="product">${htmlEscape(displayName)}</td>
                            <td class="size">${htmlEscape(sizeCell)}</td>
                            <td class="qty">${item.quantity}</td>
                        </tr>`);
    }
  }
  if (!parts.length) {
    return `<tr><td colspan="${twoCol ? 2 : 3}" style="text-align:center;font-style:italic;"></td></tr>`;
  }
  return parts.join("");
}

const RESTAURANT_BILL_TABLE_INLINE_CSS = RESTAURANT_BILL_ITEMS_TABLE_CSS;

/** Size in item text when needed — table stays 4 columns on 80mm. */
function billItemDisplayName(item: FastFoodPaymentLine): string {
  const sizeCell = receiptSizeColumnValue(item.name, (item.size || "").trim());
  if (!sizeCell) return item.name;
  return `${item.name} (${sizeCell})`;
}

function billLineUnitPrice(item: FastFoodPaymentLine): number {
  const q = Math.max(1, Number(item.quantity) || 1);
  return (Number(item.lineTotal) || 0) / q;
}

/** One shared items table for guest bill + payment receipt. */
export function buildRestaurantBillItemsTableHtml(
  items: FastFoodPaymentLine[],
  netTotalFallback = 0
): string {
  const { item, qty, unitPrice, lineTotal } = RESTAURANT_BILL_COL_MM;
  const colgroup = `<colgroup>
      <col class="bill-col-item" style="width:${item}mm" />
      <col class="bill-col-qty" style="width:${qty}mm" />
      <col class="bill-col-unit" style="width:${unitPrice}mm" />
      <col class="bill-col-total" style="width:${lineTotal}mm" />
    </colgroup>`;
  const head = `<thead>
      <tr>
        <th class="bill-item">Item</th>
        <th class="bill-qty">Qty</th>
        <th class="bill-unit">Price</th>
        <th class="bill-line-total">Total</th>
      </tr>
    </thead>`;

  let bodyRows = "";
  if (items.length) {
    for (const line of items) {
      const label = billItemDisplayName(line);
      const unit = billLineUnitPrice(line);
      const amount = Number(line.lineTotal) || 0;
      bodyRows += `<tr>
        <td class="bill-item">${htmlEscape(label)}</td>
        <td class="bill-qty">${line.quantity}</td>
        <td class="bill-unit">${unit.toFixed(2)}</td>
        <td class="bill-line-total">${amount.toFixed(2)}</td>
      </tr>`;
    }
  } else {
    bodyRows = `<tr>
        <td colspan="4" class="bill-item" style="text-align: center; font-style: italic; color: #666;">
          Order Total: Rs. ${netTotalFallback.toFixed(2)}
        </td>
      </tr>`;
  }

  return `<table class="restaurant-bill-items">
      ${colgroup}
      ${head}
      <tbody>${bodyRows}</tbody>
    </table>`;
}

/**
 * Main kitchen: `generate_kitchen_receipt_html` — 80mm thermal + optional Size column.
 */
export function buildKitchenReceiptHtmlDocument(
  input: FastFoodKitchenReceiptInput,
  extra?: { amendmentHtml?: string; reprintBanner?: string; title?: string },
  documentStyle?: RestaurantSlipDocumentStyle | null
): string {
  const doc = slipDocumentStyle(documentStyle);
  const title = (extra?.title || input.title || "KITCHEN ORDER").trim();
  const twoCol = slipUsesTwoColumnItemTable(input.items);
  const tableClass = twoCol ? "cols-2" : "cols-3";
  const rows = kitchenItemTableRows(input.items, twoCol);

  const orderInstr = (input.specialInstructions || "").trim();
  const colSpan = twoCol ? 2 : 3;
  const noteRow = orderInstr
    ? `<tr><td colspan="${colSpan}" style="font-size: 10px; padding: 2px 8px; color: #000; font-style: italic; overflow-wrap: break-word; word-break: break-word; max-width: 0;">📝 Special Instructions: ${htmlEscape(orderInstr)}</td></tr>`
    : "";

  return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                ${doc.headMeta}
                <title>Receipt</title>
                <style>
                    ${doc.css}
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    ${extra?.reprintBanner || ""}
                    <div class="kitchen-order-heading">${htmlEscape(title)}</div>
                    ${extra?.amendmentHtml || ""}
                    <div class="info" style="margin: 0px; padding: 0px;">
                        ${formatKitchenReceiptInfoHtml(input)}
                    </div>
                    <table class="${tableClass}">
                        <thead>
                            ${kitchenItemTableHead(twoCol)}
                        </thead>
                        <tbody>
                        ${rows}
                        ${noteRow}
                         </tbody>
                    </table>
                    <div class="totals"></div>
                    <div class="footer">${receiptDevelopedByFooterHtml()}</div>
                    </div>
                </body>
                </html>`;
}

/**
 * Roti/naan section slip: `_generate_kitchen_section_receipt_html` layout.
 * Configured slip label (e.g. ROTI / NAN) is the first item row, not the document title.
 */
export function buildKitchenSectionReceiptHtmlDocument(
  input: FastFoodKitchenReceiptInput,
  extra?: { sectionTitle?: string | null; reprintBanner?: string },
  documentStyle?: RestaurantSlipDocumentStyle | null
): string {
  const doc = slipDocumentStyle(documentStyle);
  const twoCol = slipUsesTwoColumnItemTable(input.items);
  const tableClass = twoCol ? "cols-2" : "cols-3";
  const rows = kitchenItemTableRows(input.items, twoCol);
  const sectionTitle = (extra?.sectionTitle || "").trim();

  return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                ${doc.headMeta}
                <title>Kitchen Order</title>
                <style>
                    ${doc.css}
                    ${KITCHEN_SECTION_TABLE_CSS}
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    ${extra?.reprintBanner || ""}
                    ${
                      sectionTitle
                        ? `<div class="section-title">${htmlEscape(sectionTitle)}</div>`
                        : ""
                    }
                    <div class="info">
                        ${formatKitchenReceiptInfoHtml(input)}
                    </div>
                    <table class="${tableClass} kitchen-section-items">
                        <thead>
                            ${kitchenItemTableHead(twoCol, true)}
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="footer">${receiptDevelopedByFooterHtml()}</div>
                </div>
            </body>
            </html>`;
}

/**
 * `fast_food_order_view.generate_payment_receipt_content` shell (lines 4956–5191).
 */
export function buildPaymentReceiptHtmlDocument(
  input: FastFoodPaymentReceiptInput,
  documentStyle?: RestaurantSlipDocumentStyle | null
): string {
  const doc = slipDocumentStyle(documentStyle);
  const logoUrl = (input.logoUrl || "").trim();
  const logoHtml = logoUrl
    ? `<div style="text-align:center;margin:0 0 2px 0;"><img class="receipt-logo" src="${htmlEscape(logoUrl)}" alt="" style="height:28px;width:auto;max-width:100%;display:inline-block;" /></div>`
    : "";
  const billItemsTable = buildRestaurantBillItemsTableHtml(input.items, input.netTotal);

  const discount = input.discount || 0;
  const totalTax = input.taxAmount || 0;
  const deliveryFee = input.deliveryFee || 0;
  const additionalCharges = input.additionalCharges || 0;
  const totalAmount = input.netTotal || 0;
  const subtotal = input.subtotal || 0;

  const paymentFooter = receiptPaymentFooterHtml(
    input.footerNote,
    input.thankYouMessage
  );

  const showCustomer = input.showCustomerInfo !== false;
  const infoHtml = formatPaymentReceiptInfoHtml(input, { showCustomer });
  const paymentLine =
    input.showPaymentMode !== false && input.paymentModeLabel?.trim()
      ? `<p style="margin:0;padding:0;">Payment: ${htmlEscape(input.paymentModeLabel)}</p>`
      : "";

  return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                ${doc.headMeta}
                <title>Receipt</title>
                <style>
                    ${doc.css}
                    ${RESTAURANT_BILL_TABLE_INLINE_CSS}
                </style>
            </head>
            <body>
                <div class="receipt-container">
                    ${input.headerBannerHtml || ""}
                    <div class="header">
                        ${logoHtml}
                        ${input.companyName ? `<p class="shop-name"><strong>${htmlEscape(input.companyName)}</strong></p>` : ""}
                        ${input.showShopPhone !== false && input.companyPhone ? `<p><strong>Phone: ${htmlEscape(input.companyPhone)}</strong></p>` : ""}
                        ${input.showShopAddress !== false && input.companyAddress ? `<p style="text-align:left;">${htmlEscape(input.companyAddress)}</p>` : ""}
                    </div>
                    <div class="info" style="margin: 0px; padding: 0px;">
                        ${infoHtml}
                        ${paymentLine}
                    </div>

                    ${billItemsTable}
                   
                    
                    <div class="totals">
                    <p><strong><span class="total-label">Sub Total:</span><span class="total-value">${subtotal.toFixed(2)}</span></strong></p>
                    ${input.showDiscount !== false ? `<p><span class="total-label">Discount:</span><span class="total-value">${discount.toFixed(2)}</span></p>` : ""}
                    ${input.showTax !== false ? `<p><span class="total-label">Total Tax:</span><span class="total-value">${totalTax.toFixed(2)}</span></p>` : ""}
                    ${deliveryFee > 0 ? `<p><span class="total-label">Delivery Fee:</span><span class="total-value">${deliveryFee.toFixed(2)}</span></p>` : ""}
                    ${additionalCharges > 0 ? `<p><span class="total-label">Additional Charges:</span><span class="total-value">${additionalCharges.toFixed(2)}</span></p>` : ""}
                    <p class="total-amount-line"><strong><span class="total-label">Total:</span><span class="total-value">${totalAmount.toFixed(2)}</span></strong></p>
                    </div>
                    ${input.afterTotalsHtml || ""}
               
             <hr>
                    <div class="footer">
                        ${paymentFooter}
                            
                        </div>
                    </div>
                </body>
                </html>`;
}

export function isFastFoodOrderViewFullHtml(html: string): boolean {
  return html.trim().toLowerCase().startsWith("<!doctype");
}