import { DEFAULT_RECEIPT_SETTINGS, type ReceiptSettings } from "@/components/ReceiptTemplate";
import { printThermalReceipt } from "@/lib/thermalPrinter";
import {
  resolvePosRestaurantPrintDispatches,
  resolvePrinterNameForRole,
  resolveSecondarySimpleKotPrintDispatch,
  resolveSimpleKotPrintDispatch,
  type RestaurantPrintDispatch,
  type RestaurantPrintJobType,
  type RestaurantPrintRole,
} from "@/lib/restaurant-print-profile";
import {
  RECEIPT_INFO_FONT_PX,
  RECEIPT_ITEMS_TABLE_CELL_PX,
  RECEIPT_ITEMS_TABLE_HEADER_PX,
  RECEIPT_KITCHEN_INFO_FONT_PX,
  RECEIPT_KITCHEN_TITLE_PX,
  RECEIPT_TOTAL_AMOUNT_FONT_PX,
  RECEIPT_TOTAL_LINE_BASE_PX,
} from "@/lib/posrestaurant-receipt-template";
import {
  buildKitchenReceiptHtmlDocument,
  buildKitchenSectionReceiptHtmlDocument,
  buildPaymentReceiptHtmlDocument,
  companyFooterNote,
  getReceiptOrderNumber,
  type FastFoodKitchenLine,
  type FastFoodPaymentLine,
  type RestaurantSlipDocumentStyle,
} from "@/lib/fast-food-order-view-receipts";
import { mergeRestaurantReceiptPrintSettings } from "@/lib/receipt-template-default";
import {
  resolveRestaurantReceiptDocumentStyle,
  restaurantSlipHeadMetaTags,
} from "@/lib/restaurant-receipt-styling";
import { mergeSizeIntoKitchenDisplayName } from "@/lib/restaurant-kot-display";
import { receiptSizeColumnValue } from "@/lib/restaurant-receipt-size";
import {
  isSimpleKotCategoryConfigured,
  secondaryKotSlipTitle,
  simpleKotSlipTitle,
  consolidateKotLines,
  splitKotLinesForPrint,
  type KotLineWithMeta,
} from "@/lib/restaurant-kot-split";
import { restaurantPaymentLabel } from "@/lib/restaurant-riders";
import {
  kotChangeTypeLabel,
  type RestaurantBillChangeLine,
} from "@/lib/restaurant-bill-edit";
import { restaurantReceiptItemLabels } from "@/lib/restaurant-deal-slots";
import {
  buildDesignerReceiptDocument,
  renderDesignerReceiptMarkup,
} from "@/lib/designer-receipt-document";
import { usesRestaurantDefaultPrintLayout } from "@/lib/receipt-template-default";

export type RestaurantReceiptLine = {
  name: string;
  quantity: number;
  unit_price: number;
  /** Deal slot picks - shown under the deal name on customer slips. */
  detail?: string | null;
};

export type RestaurantGuestDetails = {
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  waiterName?: string | null;
  riderName?: string | null;
  riderPhone?: string | null;
  specialInstructions?: string | null;
  deliveryFee?: number | null;
  additionalCharges?: number | null;
};

export type RestaurantPaidReceiptInput = RestaurantGuestDetails & {
  invoiceId: string;
  orderNumber?: string | null;
  tableName?: string | null;
  serviceType?: string | null;
  paymentMode: string;
  items: RestaurantReceiptLine[];
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  netTotal: number;
  paidAmount: number;
  remainingDue: number;
  settings?: Partial<ReceiptSettings>;
  shopDetails: {
    name: string;
    phone?: string | null;
    address?: string | null;
    email?: string | null;
    website?: string | null;
  };
  companyRow?: Record<string, unknown> | null;
  createdAt?: string;
};

function designerSlipHtml(
  input: RestaurantGuestBillInput | RestaurantPaidReceiptInput,
  title: string,
  extra?: { paymentMode?: string; received?: number; remaining?: number }
): string | null {
  const settings = mergeRestaurantReceiptPrintSettings({
    ...DEFAULT_RECEIPT_SETTINGS,
    ...input.settings,
  });
  if (usesRestaurantDefaultPrintLayout(settings.templateId)) {
    return null;
  }
  const markup = renderDesignerReceiptMarkup({
    settings,
    invoice: {
      id: input.invoiceId,
      order_number: input.orderNumber,
      created_at: input.createdAt || new Date().toISOString(),
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      payment_mode: extra?.paymentMode || "",
      received_amount: extra?.received ?? 0,
      tax_amount: input.taxAmount,
      discount: input.discount,
      total_amount: input.netTotal,
      remaining_due: extra?.remaining ?? 0,
      items: input.items.map((item) => ({
        name: item.detail?.trim() ? `${item.name} · ${item.detail.trim()}` : item.name,
        quantity: item.quantity,
        price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
      })),
    },
    shopDetails: {
      name: input.shopDetails.name,
      phone: input.shopDetails.phone || undefined,
      address: input.shopDetails.address || undefined,
      email: input.shopDetails.email || undefined,
      website: input.shopDetails.website || undefined,
    },
  });
  if (!markup) return null;
  return buildDesignerReceiptDocument(markup, settings, title);
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Receipt Designer selection → KOT / guest / payment slip CSS + 80mm meta. */
function buildRestaurantSlipDocumentStyle(
  settings: Partial<ReceiptSettings>
): RestaurantSlipDocumentStyle {
  const merged = mergeRestaurantReceiptPrintSettings(settings);
  const resolved = resolveRestaurantReceiptDocumentStyle(merged);
  return {
    css: resolved.css,
    headMeta: restaurantSlipHeadMetaTags(merged),
  };
}

/** Same HTML the guest bill and payment receipt send to the printer. */
export function buildRestaurantBillPreviewHtml(
  settings: Partial<ReceiptSettings>,
  shop?: { name?: string; phone?: string | null; address?: string | null }
): string {
  const merged = mergeRestaurantReceiptPrintSettings({
    ...DEFAULT_RECEIPT_SETTINGS,
    ...settings,
  });
  const items = [
    { name: "Chicken Karahi", quantity: 1, unit_price: 1200 },
    { name: "Naan", quantity: 4, unit_price: 40 },
    { name: "Cold Drink", quantity: 2, unit_price: 80 },
  ];
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const discount = merged.showDiscount === false ? 0 : 50;
  const taxAmount = merged.showTax === false ? 0 : 45.5;
  const netTotal = subtotal - discount + taxAmount;
  return buildPaymentReceiptHtmlDocument(
    {
      orderNumber: "1042",
      createdAt: new Date(),
      serviceType: "dine_in",
      tableName: "T-4",
      waiterName: "Ali",
      customerName: "Walk-in Customer",
      customerPhone: "0300-1234567",
      orderStatus: "BILL",
      companyName: shop?.name || "Cook Swift",
      companyPhone: shop?.phone || undefined,
      companyAddress: shop?.address || undefined,
      items: items.map((i) => ({
        name: i.name,
        size: "",
        quantity: i.quantity,
        lineTotal: i.unit_price * i.quantity,
      })),
      subtotal,
      discount,
      taxAmount,
      deliveryFee: 0,
      additionalCharges: 0,
      netTotal,
      footerNote: merged.footerText,
      thankYouMessage: merged.thankYouMessage,
      showShopPhone: merged.showPhone !== false,
      showShopAddress: merged.showAddress !== false,
      showCustomerInfo: merged.showCustomerInfo !== false,
      showDiscount: merged.showDiscount !== false,
      showTax: merged.showTax !== false,
      showPaymentMode: merged.showPaymentMode !== false,
      paymentModeLabel: merged.showPaymentMode === false ? undefined : "Cash",
    },
    {
      css: resolveRestaurantReceiptDocumentStyle(merged).css,
      headMeta: restaurantSlipHeadMetaTags(merged),
    }
  );
}

function kotReprintBannerHtml(input: RestaurantKOTInput): string {
  if (!input.isReprint) return "";
  return `<div style="text-align:center;font-weight:bold;font-size:10px;margin:0 0 4px 0;border:1px solid #000;padding:2px;">REPRINT · KOT${input.kotTicketId ? ` #${input.kotTicketId.slice(0, 6).toUpperCase()}` : ""}</div>`;
}

/** POSRESTURANT kitchen KOT: Arial 320px layout via `buildPosRestaurantThermalPrintHtml`. */
function thermalSettingsForKitchenSlip(
  settings: Partial<ReceiptSettings>
): Partial<ReceiptSettings> {
  return {
    ...settings,
    pageSize: settings.pageSize === "MM58" ? "MM58" : "MM80",
    fontFamily: "sans-serif",
    fontSize: RECEIPT_ITEMS_TABLE_CELL_PX,
    billingLanguage: "en",
    customUrduNote: "",
    showHeaderTagline: false,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
    marginBottom: 0,
  };
}

function thermalSettingsForPaymentSlip(
  settings: Partial<ReceiptSettings>
): Partial<ReceiptSettings> {
  return {
    ...settings,
    pageSize: settings.pageSize === "MM58" ? "MM58" : "MM80",
    billingLanguage: settings.billingLanguage || "en",
    showLogo: settings.showLogo === true,
  };
}

async function printRestaurantThermalSlip(
  inner: string,
  settings: Partial<ReceiptSettings>,
  title: string,
  job: RestaurantPrintJobType,
  companyRow?: Record<string, unknown> | null,
  callbacks?: { onError?: (message: string) => void },
  customDispatches?: RestaurantPrintDispatch[]
): Promise<void> {
  let merged = { ...DEFAULT_RECEIPT_SETTINGS, ...settings };
  const posSlipKind = job === "kot" ? "kitchen" : "payment";
  if (job === "kot") {
    merged = { ...merged, ...thermalSettingsForKitchenSlip(merged) };
  } else {
    merged = { ...merged, ...thermalSettingsForPaymentSlip(merged) };
  }
  let dispatches =
    customDispatches ??
    resolvePosRestaurantPrintDispatches(job, merged, companyRow);

  if (dispatches.length === 0) {
    const legacyRole: RestaurantPrintRole =
      job === "kot" ? "kitchen" : "customer";
    const fallback = resolvePrinterNameForRole(legacyRole, merged, companyRow);
    dispatches = [{ printerName: fallback || "", copies: 1 }];
  }

  const failHint =
    job === "kot"
      ? "KOT print failed - set printer copy counts in Business Details."
      : job === "paidReceipt"
        ? "Payment receipt print failed - check printer settings."
        : "Guest bill print failed - check printer settings.";

  if (dispatches.length === 0) {
    callbacks?.onError?.(failHint);
    return;
  }
  for (const { printerName, copies } of dispatches) {
    try {
      console.info(
        `[RestaurantPrint] ${title} → "${printerName || "default"}" ×${copies}`
      );
      await printThermalReceipt({
        receiptHtml: inner,
        settings: merged,
        title,
        targetPrinterName: printerName,
        copies,
        layout: "posrestaurant",
        posSlipKind,
      });
      console.info(`[RestaurantPrint] done: ${title}`);
    } catch (err) {
      const base = err instanceof Error ? err.message : failHint;
      const hint = `${base} (Printer: ${printerName}, copies: ${copies})`;
      console.error(`[RestaurantPrint] failed: ${hint}`);
      callbacks?.onError?.(hint);
    }
  }
}

/** How many distinct KOT slips this order line split produces (1–3). */
export function kotSlipJobsForSplit(split: {
  main: unknown[];
  simple: unknown[];
  secondary: unknown[];
}): number {
  let n = 0;
  if (split.simple.length > 0) n += 1;
  if (split.secondary.length > 0) n += 1;
  if (split.main.length > 0) n += 1;
  return n;
}

export function restaurantBillLabel(orderNumber: string | null | undefined, invoiceId: string): string {
  const n = orderNumber?.trim();
  if (n) return n.startsWith("#") ? n : `#${n}`;
  return `#${invoiceId.slice(0, 8).toUpperCase()}`;
}

function mapKotLines(lines: RestaurantKOTLine[]): FastFoodKitchenLine[] {
  return lines.map((it) => {
    const name = mergeSizeIntoKitchenDisplayName(it.name, it.sizeLabel);
    const sizeLabel = receiptSizeColumnValue(name, it.sizeLabel) || null;
    return {
      name,
      quantity: it.quantity,
      sizeLabel,
      description: it.description,
      remarks: it.remarks,
    };
  });
}

function toFastFoodPaymentLines(items: RestaurantReceiptLine[]): FastFoodPaymentLine[] {
  return items.map((item) => {
    const { name, size } = paymentLineParts(item);
    return {
      name,
      size,
      quantity: item.quantity,
      lineTotal: item.unit_price * item.quantity,
    };
  });
}

function paymentReceiptPayload(
  input: RestaurantGuestBillInput | RestaurantPaidReceiptInput,
  opts: {
    orderStatus: string;
    paymentModeLabel?: string;
    headerBannerHtml?: string;
    afterTotalsHtml?: string;
  },
  items: RestaurantReceiptLine[]
) {
  const merged = mergeRestaurantReceiptPrintSettings({
    ...DEFAULT_RECEIPT_SETTINGS,
    ...input.settings,
  });
  const footerNote = companyFooterNote(
    pickFooterNote(input.shopDetails.website, input.companyRow, merged)
  );
  return {
    orderNumber: input.orderNumber,
    createdAt: input.createdAt || new Date(),
    serviceType: input.serviceType,
    tableName: input.tableName,
    waiterName: input.waiterName,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerAddress: input.customerAddress,
    deliveryBoyPhone: input.riderPhone,
    orderStatus: opts.orderStatus,
    companyName: input.shopDetails.name,
    companyPhone: input.shopDetails.phone || undefined,
    companyAddress: input.shopDetails.address || undefined,
    logoUrl: merged.showLogo && merged.logoUrl ? merged.logoUrl : null,
    items: toFastFoodPaymentLines(items),
    subtotal: input.subtotal,
    discount: input.discount,
    taxAmount: input.taxAmount,
    deliveryFee: input.deliveryFee ?? 0,
    additionalCharges: input.additionalCharges ?? 0,
    netTotal: input.netTotal,
    footerNote,
    thankYouMessage: merged.thankYouMessage,
    showShopPhone: merged.showPhone !== false,
    showShopAddress: merged.showAddress !== false,
    showCustomerInfo: merged.showCustomerInfo !== false,
    showDiscount: merged.showDiscount !== false,
    showTax: merged.showTax !== false,
    showPaymentMode: merged.showPaymentMode !== false,
    paymentModeLabel: opts.paymentModeLabel,
    headerBannerHtml: opts.headerBannerHtml,
    afterTotalsHtml: opts.afterTotalsHtml,
  };
}

function pickFooterNote(
  website?: string | null,
  companyRow?: Record<string, unknown> | null,
  merged?: Partial<ReceiptSettings>
): string | null {
  const fromCompany = typeof companyRow?.website === "string" ? companyRow.website : "";
  const note =
    [website, fromCompany, merged?.customUrduNote, merged?.footerText].find(
      (v) => typeof v === "string" && v.trim()
    ) || "";
  return companyFooterNote(note || null);
}

function posRestaurantOrderTypeLabel(serviceType?: string | null): string {
  const s = String(serviceType || "").toLowerCase().replace(/-/g, "_");
  if (s === "dining" || s === "dine_in") return "Dine In";
  if (s === "delivery") return "Delivery";
  return "Take Away";
}

function posRestaurantHr(): string {
  return `<hr style="border:none;border-top:1px solid #000;margin:6px 0;">`;
}

export type RestaurantKOTLine = {
  name: string;
  quantity: number;
  sizeLabel?: string | null;
  remarks?: string | null;
  description?: string | null;
};

export type RestaurantGuestBillInput = RestaurantGuestDetails & {
  invoiceId: string;
  orderNumber?: string | null;
  tableName?: string | null;
  serviceType?: string | null;
  items: RestaurantReceiptLine[];
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  netTotal: number;
  settings?: Partial<ReceiptSettings>;
  shopDetails: RestaurantPaidReceiptInput["shopDetails"];
  companyRow?: Record<string, unknown> | null;
  createdAt?: string;
};

export type RestaurantKOTInput = RestaurantGuestDetails & {
  orderNumber?: string | null;
  tableName?: string | null;
  serviceType?: string | null;
  items: RestaurantKOTLine[];
  settings?: Partial<ReceiptSettings>;
  shopDetails?: RestaurantPaidReceiptInput["shopDetails"];
  /** Optional company_details row for printer name fallback (pn / kitchen_printer_name). */
  companyRow?: Record<string, unknown> | null;
  /** Thermal reprint from KDS / order history */
  isReprint?: boolean;
  kotTicketId?: string | null;
  /** After bill edit - full change log + optional delta prep list for kitchen. */
  billAmendment?: {
    revisionNumber?: number;
    editedAt?: string;
    editedBy?: string | null;
    changes?: RestaurantBillChangeLine[];
    showChangeDetails?: boolean;
    /** Lines kitchen should still prepare (qty added / new items). */
    prepareNow?: RestaurantKOTLine[];
  };
};

/** Map invoice_items rows (with products join) to thermal line items. */
export function mapDbInvoiceItemsToReceiptLines(
  items: {
    quantity: number;
    unit_price: number;
    packing_name?: string | null;
    custom_name?: string | null;
    products?: { name: string } | null;
  }[]
): RestaurantReceiptLine[] {
  return items.map((i) => {
    const labels = restaurantReceiptItemLabels(
      i.products?.name || "Item",
      i.packing_name,
      i.custom_name
    );
    return {
      name: labels.title,
      detail: labels.detail,
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0,
    };
  });
}

/** Guest bill = deal name only; paid receipt / exports keep slot detail. */
export function compactReceiptLinesForGuestBill(
  items: RestaurantReceiptLine[]
): RestaurantReceiptLine[] {
  return items.map((item) => ({ ...item, detail: null }));
}

function itemAmountRows(items: RestaurantReceiptLine[]): string {
  return items
    .map(
      (item, idx) => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:4px;font-size:${THERMAL_ITEM_PX}px;line-height:1.4;margin:4px 0;font-weight:600;">
      <div style="flex:1;word-break:break-word;">${idx + 1}. ${esc(item.name)}${
        item.detail
          ? `<div style="font-size:${THERMAL_ITEM_DETAIL_PX}px;font-weight:600;color:#000;margin-top:2px;padding-left:6px;">↳ ${esc(item.detail)}</div>`
          : ""
      }</div>
      <div style="width:26px;text-align:center;flex-shrink:0;font-size:${THERMAL_QTY_PX}px;font-weight:800;">${item.quantity}</div>
      <div style="width:62px;text-align:right;flex-shrink:0;font-weight:800;font-size:${THERMAL_ITEM_PX}px;">${Math.round(
        item.unit_price * item.quantity
      ).toLocaleString()}</div>
    </div>`
    )
    .join("");
}

function serviceTypeLabel(serviceType?: string | null, tableName?: string | null): string {
  const s = String(serviceType || "").toLowerCase();
  if (s === "dining" || s === "dine_in" || s === "dine-in") {
    return tableName ? `Dine-In · ${tableName}` : "Dine-In";
  }
  if (s === "delivery") return "Delivery";
  if (s === "takeaway") return tableName || "Takeaway";
  return tableName || serviceType || "Restaurant";
}

/** Font sizes from POSRESTURANT `fast_food_display.py`. */
const THERMAL_META_PX = RECEIPT_INFO_FONT_PX;
const THERMAL_ITEM_PX = RECEIPT_ITEMS_TABLE_CELL_PX;
const THERMAL_ITEM_DETAIL_PX = RECEIPT_INFO_FONT_PX;
const THERMAL_QTY_PX = RECEIPT_ITEMS_TABLE_CELL_PX;
const THERMAL_HEAD_PX = RECEIPT_KITCHEN_TITLE_PX;
const THERMAL_TABLE_HEAD_PX = RECEIPT_ITEMS_TABLE_HEADER_PX;

function metaRow(label: string, value: string, strong = false): string {
  return `<div style="display:flex;justify-content:space-between;gap:6px;align-items:flex-start;">
    <div>${esc(label)}</div>${
      strong
        ? `<strong style="text-align:right;">${esc(value)}</strong>`
        : `<div style="text-align:right;">${esc(value)}</div>`
    }
  </div>`;
}

/** Kitchen `.info` from `build_kitchen_receipt_html`. */
function posRestaurantKitchenMetaBlock(
  input: RestaurantGuestDetails & {
    orderNumber?: string | null;
    when?: string;
    serviceType?: string | null;
    tableName?: string | null;
  }
): string {
  const isDelivery = String(input.serviceType || "").toLowerCase() === "delivery";
  const orderNo = getReceiptOrderNumber(input.orderNumber);
  const created = input.when || new Date().toLocaleString();
  const table = (input.tableName || "N/A").trim() || "N/A";
  const taker = (input.waiterName || "N/A").trim() || "N/A";
  const customer = (input.customerName || "Walk-in Customer").trim();
  const otype = posRestaurantOrderTypeLabel(input.serviceType);
  const addr = (input.customerAddress || "").trim();
  const addrBlock =
    addr && addr !== "N/A"
      ? `<p style="margin:0;padding:0;line-height:1.2;"><strong>Address:</strong> ${esc(addr)}</p>`
      : "";
  const deliveryBlock = isDelivery
    ? `<p style="margin:0;padding:0;line-height:1.2;"><strong>Delivery:</strong> ${esc(taker)} | <strong>Phone:</strong> ${esc(input.riderPhone?.trim() || "N/A")}</p>`
    : "";

  return `<div class="info" style="padding:0 4px 6px 4px;font-size:${RECEIPT_KITCHEN_INFO_FONT_PX}px;">
    <p><strong>Order #:</strong> ${esc(orderNo)}</p>
    <p><strong>Date &amp; Time:</strong> ${esc(created)}</p>
    <p><strong>Type:</strong> ${esc(otype)}</p>
    <p><strong>Table:</strong> ${esc(table)} | <strong>Order taker:</strong> ${esc(taker)}</p>
    ${deliveryBlock}
    <p><strong>Customer:</strong> ${esc(customer)}</p>
    ${addrBlock}
  </div>`;
}

/** Payment `.info` from `generate_payment_receipt_content`. */
function posRestaurantMetaBlock(
  input: RestaurantGuestDetails & {
    orderNumber?: string | null;
    when?: string;
    serviceType?: string | null;
    tableName?: string | null;
    orderStatus?: string | null;
  }
): string {
  const isDelivery = String(input.serviceType || "").toLowerCase() === "delivery";
  const orderNo = getReceiptOrderNumber(input.orderNumber);
  const created = input.when || new Date().toLocaleString();
  const table = (input.tableName || "N/A").trim() || "N/A";
  const taker = (input.waiterName || "N/A").trim() || "N/A";
  const customer = (input.customerName || "Walk-in Customer").trim();
  const phone = (input.customerPhone || "N/A").trim() || "N/A";
  const address = (input.customerAddress || "N/A").trim() || "N/A";
  const otype = posRestaurantOrderTypeLabel(input.serviceType);
  const status = (input.orderStatus || "OPEN").toString().toUpperCase();

  const deliveryRow = isDelivery
    ? `<p style="margin:0;padding:0;">Delivery boy: ${esc(taker)} | Phone: ${esc(input.riderPhone?.trim() || "N/A")}</p>`
    : "";

  return `<div class="info" style="margin:0;padding:0;">
    <p style="margin:0;padding:0;display:flex;justify-content:space-between;">
      <span>Order #: ${esc(orderNo)}</span>
      <span>&nbsp;&nbsp;&nbsp;Date: ${esc(created)}</span>
    </p>
    <p style="margin:0;padding:0;">Table: ${esc(table)} | Order taker: ${esc(taker)}</p>
    ${deliveryRow}
    <p style="margin:0;padding:0;">Customer: ${esc(customer)}</p>
    <p style="margin:0;padding:0;">Address: ${esc(address)}</p>
    <p style="margin:0;padding:0;">Phone no: ${esc(phone)}</p>
    <p style="margin:0;padding:0;display:flex;justify-content:space-between;">
      <span>Status: ${esc(status)}</span>
      <span>&nbsp;&nbsp;Type: ${esc(otype)}</span>
    </p>
  </div>`;
}

function posRestaurantKitchenItemRows(lines: RestaurantKOTLine[]): string {
  return lines
    .map((it) => {
      const sizePart = it.sizeLabel?.trim()
        ? `Size: ${esc(it.sizeLabel.trim())} | `
        : "";
      const note =
        it.remarks?.trim() && !String(it.remarks).includes("DEAL_ID:")
          ? `<div style="font-size:8px;font-style:italic;color:#333;margin-top:2px;line-height:1.25;">Note: ${esc(it.remarks.trim())}</div>`
          : "";
      const desc =
        it.description?.trim()
          ? `<div style="font-size:8px;color:#444;margin-top:2px;line-height:1.25;">${esc(it.description.trim())}</div>`
          : "";
      return `
      <tr>
        <td colspan="3" style="text-align:left;padding:5px 6px;vertical-align:top;border-bottom:1px solid #ccc;">
          <div style="font-weight:bold;font-size:10px;">${esc(it.name)}</div>
          ${desc}
          <div style="font-size:9px;margin-top:2px;">${sizePart}Qty: ${it.quantity}</div>
          ${note}
        </td>
      </tr>`;
    })
    .join("");
}

function paymentLineParts(item: RestaurantReceiptLine): {
  name: string;
  size: string;
} {
  const dot = item.name.match(/^(.+?) · (.+)$/);
  let name = item.name;
  let size = "";
  if (dot) {
    name = dot[1]!.trim();
    size = dot[2]!.trim();
  } else if (item.detail?.trim() && item.detail.length <= 24) {
    size = item.detail.trim();
  } else {
    size = "Std";
  }
  size = receiptSizeColumnValue(name, size);
  return { name, size };
}

function posRestaurantPaymentItemsTable(items: RestaurantReceiptLine[]): string {
  const rows = items
    .map((item) => {
      const { name, size } = paymentLineParts(item);
      const lineTotal = item.unit_price * item.quantity;
      return `
      <tr>
        <td class="product">${esc(name)}</td>
        <td class="size">${esc(size)}</td>
        <td class="qty">${item.quantity}</td>
        <td class="price">${lineTotal.toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  return `
    <table class="items-table">
      <thead>
        <tr>
          <th class="product">Item Description</th>
          <th class="size">Size</th>
          <th class="qty">Qty</th>
          <th class="price">Price</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="4" style="text-align:center;font-style:italic;">No items</td></tr>`}</tbody>
    </table>`;
}

function posRestaurantTotalsBlock(input: {
  subtotal: number;
  discount: number;
  taxAmount: number;
  deliveryFee?: number;
  additionalCharges?: number;
  netTotal: number;
}): string {
  const sub = Number(input.subtotal) || 0;
  const disc = Number(input.discount) || 0;
  const tax = Number(input.taxAmount) || 0;
  const del = Number(input.deliveryFee) || 0;
  const addl = Number(input.additionalCharges) || 0;
  const total = Number(input.netTotal) || 0;
  return `
    <div class="totals">
      <p class="subtotal-line"><span><strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Sub Total:&nbsp;&nbsp; ${sub.toFixed(2)}</strong></span></p>
      <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Discount:&nbsp;&nbsp; ${disc.toFixed(2)}</p>
      <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Total Tax:&nbsp;&nbsp; ${tax.toFixed(2)}</p>
      <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Delivery Fee:&nbsp;&nbsp; ${del.toFixed(2)}</p>
      <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Additional Charges:&nbsp;&nbsp; ${addl.toFixed(2)}</p>
      <p class="total-amount-line"><span style="font-size:${RECEIPT_TOTAL_AMOUNT_FONT_PX}px;"><strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Total:&nbsp;&nbsp; ${total.toFixed(2)}</strong></span></p>
    </div>`;
}

/** Legacy flex layout — prefer posRestaurantMetaBlock for new slips. */
function guestDetailsBlock(
  input: RestaurantGuestDetails & {
    billLabel?: string;
    when?: string;
    serviceType?: string | null;
    tableName?: string | null;
    forKitchen?: boolean;
    fontSizePx?: number;
  }
): string {
  const metaPx = input.fontSizePx ?? THERMAL_META_PX;
  const isDelivery = String(input.serviceType || "").toLowerCase() === "delivery";
  const typeLabel = serviceTypeLabel(input.serviceType, input.tableName);
  const rows: string[] = [];
  if (input.billLabel) rows.push(metaRow("Order", input.billLabel, true));
  if (input.when) rows.push(metaRow("Date", input.when));
  rows.push(metaRow("Type", typeLabel, true));

  const name = input.customerName?.trim();
  if (name) rows.push(metaRow("Guest", name));
  else if (!input.forKitchen) rows.push(metaRow("Guest", "Walk-in"));

  const phone = input.customerPhone?.trim();
  if (phone) rows.push(metaRow("Phone", phone));

  const addr = input.customerAddress?.trim();
  if (addr) {
    rows.push(
      `<div style="margin-top:2px;"><div>Address:</div> <div>${esc(addr)}</div></div>`
    );
  }

  const waiter = input.waiterName?.trim();
  if (waiter) rows.push(metaRow(isDelivery ? "Order taker" : "Waiter", waiter));

  const rider = input.riderName?.trim();
  const riderPhone = input.riderPhone?.trim();
  if (rider || isDelivery) {
    rows.push(metaRow("Rider", rider || "Unassigned", true));
  }
  if (riderPhone) {
    rows.push(metaRow("Rider phone", riderPhone));
  }

  const notes = input.specialInstructions?.trim();
  const notesHtml = notes
    ? `<div style="font-size:${Math.max(10, metaPx - 1)}px;border:1px solid #000;padding:4px;margin:6px 0;"><strong>Notes:</strong> ${esc(notes)}</div>`
    : "";

  return `<div style="font-size:${metaPx}px;line-height:1.45;margin-bottom:6px;font-weight:600;">${rows.join("")}</div>${notesHtml}`;
}

function extraChargeRows(input: RestaurantGuestDetails): string {
  const parts: string[] = [];
  if ((input.deliveryFee || 0) > 0) {
    parts.push(
      `<div style="display:flex;justify-content:space-between;"><div>Delivery</div><div>+${Math.round(Number(input.deliveryFee)).toLocaleString()}</div></div>`
    );
  }
  if ((input.additionalCharges || 0) > 0) {
    parts.push(
      `<div style="display:flex;justify-content:space-between;"><div>Extra charges</div><div>+${Math.round(Number(input.additionalCharges)).toLocaleString()}</div></div>`
    );
  }
  return parts.join("");
}

function shopHeaderBlock(
  shop: RestaurantPaidReceiptInput["shopDetails"],
  settings: Partial<ReceiptSettings>,
  opts?: { showLogo?: boolean; posStyle?: boolean }
): string {
  const merged = { ...DEFAULT_RECEIPT_SETTINGS, ...settings };
  const logoBlock = "";

  if (opts?.posStyle) {
    return `
    <div class="header">
      ${logoBlock}
      ${shop.name ? `<p style="font-size:12px;font-weight:bold;"><strong>${esc(shop.name)}</strong></p>` : ""}
      ${shop.phone && merged.showPhone !== false ? `<p><strong>Phone: ${esc(shop.phone)}</strong></p>` : ""}
      ${shop.address && merged.showAddress !== false ? `<p style="text-align:left;">${esc(shop.address)}</p>` : ""}
      <hr>
    </div>`;
  }

  const contact: string[] = [];
  if (merged.showAddress !== false && shop.address) {
    contact.push(`<div style="font-size:10px;margin-top:2px;">${esc(shop.address)}</div>`);
  }
  if (merged.showPhone !== false && shop.phone) {
    contact.push(`<div style="font-size:10px;">Tel: ${esc(shop.phone)}</div>`);
  }
  if (merged.showEmail && shop.email) {
    contact.push(`<div style="font-size:10px;">${esc(shop.email)}</div>`);
  }
  if (merged.showWebsite && shop.website) {
    contact.push(`<div style="font-size:10px;">${esc(shop.website)}</div>`);
  }

  const tagline =
    merged.showHeaderTagline && merged.headerTagline
      ? `<div style="font-size:9px;margin-top:3px;font-style:italic;">${esc(merged.headerTagline)}</div>`
      : "";

  return `
    ${logoBlock}
    <div style="text-align:center;margin-bottom:6px;">
      <div style="font-size:15px;font-weight:bold;text-transform:uppercase;">${esc(shop.name)}</div>
      ${contact.join("")}
      ${tagline}
    </div>`;
}

function thermalFooterBlock(settings: Partial<ReceiptSettings>, posStyle = false): string {
  const merged = { ...DEFAULT_RECEIPT_SETTINGS, ...settings };
  const lines: string[] = [];
  if (merged.customUrduNote?.trim()) {
    lines.push(
      posStyle
        ? `<p class="receipt-footer-note">${esc(merged.customUrduNote.trim())}</p>`
        : `<div style="font-size:9px;margin-top:2px;">${esc(merged.customUrduNote.trim())}</div>`
    );
  }
  const thank = merged.thankYouMessage || merged.footerText;
  if (thank?.trim()) {
    lines.push(
      posStyle
        ? `<p>${esc(thank.trim())}</p>`
        : `<div style="font-size:10px;margin-top:4px;font-weight:600;">${esc(thank.trim())}</div>`
    );
  }
  if (lines.length === 0) return "";
  if (posStyle) {
    return `<hr><div class="footer">${lines.join("")}</div>`;
  }
  return `<div style="text-align:center;margin-top:10px;border-top:1px dashed #000;padding-top:6px;">${lines.join("")}</div>`;
}

async function printRestaurantSectionKOTSlip(
  input: RestaurantKOTInput,
  slipLabel: string,
  dispatch: RestaurantPrintDispatch | null,
  missingPrinterMessage: string,
  callbacks?: { onError?: (message: string) => void }
): Promise<void> {
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, ...input.settings };
  const billLabel = input.orderNumber?.trim()
    ? restaurantBillLabel(input.orderNumber, "KOT")
    : "NEW";

  const slipStyle = buildRestaurantSlipDocumentStyle(settings);
  const inner = buildKitchenSectionReceiptHtmlDocument(
    {
      orderNumber: input.orderNumber,
      createdAt: new Date(),
      serviceType: input.serviceType,
      tableName: input.tableName,
      waiterName: input.waiterName,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerAddress: input.customerAddress,
      deliveryBoyPhone: input.riderPhone,
      specialInstructions: input.specialInstructions,
      items: mapKotLines(consolidateKotLines(input.items)),
    },
    { sectionTitle: slipLabel, reprintBanner: kotReprintBannerHtml(input) },
    slipStyle
  );

  if (!dispatch) {
    callbacks?.onError?.(missingPrinterMessage);
    return;
  }

  await printRestaurantThermalSlip(
    inner,
    settings,
    `${slipLabel} ${billLabel}`,
    "kot",
    input.companyRow,
    callbacks,
    [dispatch]
  );
}

/** Minimal roti / nan style ticket — item + qty only. */
export async function printRestaurantSimpleKOTSlip(
  input: RestaurantKOTInput,
  callbacks?: { onError?: (message: string) => void }
): Promise<void> {
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, ...input.settings };
  await printRestaurantSectionKOTSlip(
    input,
    simpleKotSlipTitle(settings),
    resolveSimpleKotPrintDispatch(settings, input.companyRow),
    "Roti KOT: pick Printer 1 or 2 and set KOT copies in Business Settings.",
    callbacks
  );
}

export async function printRestaurantSecondaryKOTSlip(
  input: RestaurantKOTInput,
  callbacks?: { onError?: (message: string) => void }
): Promise<void> {
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, ...input.settings };
  await printRestaurantSectionKOTSlip(
    input,
    secondaryKotSlipTitle(settings),
    resolveSecondarySimpleKotPrintDispatch(settings, input.companyRow),
    "Kathi KOT: pick Printer 1 or 2 and set KOT copies in Business Settings.",
    callbacks
  );
}

export type RestaurantKOTDispatchOptions = {
  productIdToCategoryId?: Map<string, string>;
  /** Lines with product/category meta; defaults to items only. */
  lineMeta?: KotLineWithMeta[];
};

/** Main kitchen KOT + optional simple category KOT (e.g. roti) on Send KOT. */
export async function printRestaurantKOTDispatch(
  input: RestaurantKOTInput,
  options?: RestaurantKOTDispatchOptions,
  callbacks?: { onError?: (message: string) => void }
): Promise<void> {
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, ...input.settings };
  if (!isSimpleKotCategoryConfigured(settings)) {
    await printRestaurantKOTSlip(input, callbacks);
    return;
  }

  const productMap = options?.productIdToCategoryId;
  const meta: KotLineWithMeta[] =
    options?.lineMeta?.length && options.lineMeta.length > 0
      ? options.lineMeta
      : input.items.map((it) => ({ ...it }));

  const split = splitKotLinesForPrint(meta, settings, productMap);
  const { main, simple, secondary } = split;
  const slipCount = kotSlipJobsForSplit(split);

  if (slipCount === 0 && input.items.length > 0) {
    await printRestaurantKOTSlip(input, callbacks);
    return;
  }

  const orderRef = input.orderNumber?.trim() || "NEW";

  if (simple.length > 0) {
    console.info(`[RestaurantPrint] KOT dispatch ${orderRef}: roti slip`);
    await printRestaurantSimpleKOTSlip(
      { ...input, items: consolidateKotLines(simple) },
      callbacks
    );
  }
  if (secondary.length > 0) {
    console.info(`[RestaurantPrint] KOT dispatch ${orderRef}: kathi slip`);
    await printRestaurantSecondaryKOTSlip(
      { ...input, items: consolidateKotLines(secondary) },
      callbacks
    );
  }

  if (main.length > 0) {
    console.info(`[RestaurantPrint] KOT dispatch ${orderRef}: main kitchen slip`);
    const next: RestaurantKOTInput = { ...input, items: main };
    const amend = input.billAmendment;
    if (amend?.prepareNow?.length) {
      const prepMeta: KotLineWithMeta[] = amend.prepareNow.map((line) => {
        const hit =
          meta.find(
            (m) => m.name === line.name && m.quantity === line.quantity
          ) || meta.find((m) => m.name === line.name);
        return {
          ...line,
          product_id: hit?.product_id,
          category_id: hit?.category_id,
        };
      });
      const { main: prepMain } = splitKotLinesForPrint(
        prepMeta,
        settings,
        productMap
      );
      next.billAmendment = { ...amend, prepareNow: prepMain.length ? prepMain : undefined };
    }
    await printRestaurantKOTSlip(next, callbacks);
  }
}

/** Kitchen Order Ticket - matches POSRESTURANT KOT fields (table, waiter, sizes, notes). */
export async function printRestaurantKOTSlip(
  input: RestaurantKOTInput,
  callbacks?: { onError?: (message: string) => void }
): Promise<void> {
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, ...input.settings };
  const billLabel = input.orderNumber?.trim() ? restaurantBillLabel(input.orderNumber, "KOT") : "NEW";
  const when = new Date().toLocaleString();

  const amend = input.billAmendment;
  const prepareLines = amend?.prepareNow?.length ? amend.prepareNow : input.items;
  const isAmendment = !!amend?.changes?.length;
  const kotTitle = isAmendment ? "KOT AMENDMENT (PREPARE)" : "KITCHEN ORDER";

  const reprintBanner = kotReprintBannerHtml(input);

  let amendmentBlock = "";
  if (amend && amend.showChangeDetails !== false && amend.changes?.length) {
    const changeRows = amend.changes
      .map((c) => {
        const tag = kotChangeTypeLabel(c.type, true);
        return `<div style="margin:2px 0;font-size:9px;line-height:1.35;">
          <strong>[${tag}]</strong> ${esc(c.name)} - ${esc(c.detail)}
        </div>`;
      })
      .join("");
    amendmentBlock = `
    <div style="border:2px solid #000;padding:5px;margin:6px 0;background:#fff;">
      <div style="text-align:center;font-weight:bold;font-size:11px;margin-bottom:4px;">
        BILL EDIT · KOT UPDATE / بل میں تبدیلی
      </div>
      ${
        amend.revisionNumber
          ? `<div style="font-size:9px;text-align:center;margin-bottom:3px;">Revision #${amend.revisionNumber}${
              amend.editedAt
                ? ` · ${new Date(amend.editedAt).toLocaleString()}`
                : ""
            }${amend.editedBy ? ` · ${esc(amend.editedBy)}` : ""}</div>`
          : ""
      }
      <div style="border-top:1px dashed #000;padding-top:4px;">${changeRows}</div>
    </div>`;
  }

  const slipStyle = buildRestaurantSlipDocumentStyle(settings);
  const inner = buildKitchenReceiptHtmlDocument(
    {
      orderNumber: input.orderNumber,
      createdAt: when,
      serviceType: input.serviceType,
      tableName: input.tableName,
      waiterName: input.waiterName,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerAddress: input.customerAddress,
      deliveryBoyPhone: input.riderPhone,
      specialInstructions: input.specialInstructions,
      items: mapKotLines(prepareLines),
    },
    {
      title: kotTitle,
      reprintBanner,
      amendmentHtml: amendmentBlock,
    },
    slipStyle
  );

  await printRestaurantThermalSlip(
    inner,
    settings,
    isAmendment ? `KOT AMEND ${billLabel}` : `KOT ${billLabel}`,
    "kot",
    input.companyRow,
    callbacks
  );
}

/** Unpaid guest bill (before settlement) - thermal table slip. */
export async function printRestaurantGuestBill(
  input: RestaurantGuestBillInput,
  callbacks?: { onError?: (message: string) => void }
): Promise<void> {
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, ...input.settings };
  const billLabel = restaurantBillLabel(input.orderNumber, input.invoiceId);
  const designerHtml = designerSlipHtml(input, `Guest Bill ${billLabel}`);
  const inner =
    designerHtml ||
    buildPaymentReceiptHtmlDocument(
      paymentReceiptPayload(
        input,
        { orderStatus: "BILL" },
        compactReceiptLinesForGuestBill(input.items)
      ),
      buildRestaurantSlipDocumentStyle(settings)
    );

  await printRestaurantThermalSlip(
    inner,
    settings,
    `Guest Bill ${billLabel}`,
    "guestBill",
    input.companyRow,
    callbacks
  );
}

export type RestaurantRevisedGuestBillInput = RestaurantGuestBillInput & {
  revisionNumber: number;
  previousTotal: number;
  editedAt?: string;
  editedBy?: string | null;
  changes?: RestaurantBillChangeLine[];
  showChangeDetails?: boolean;
};

/** Reprint after bill edit - shows revision #, old vs new total, and item changes. */
export async function printRestaurantRevisedGuestBill(
  input: RestaurantRevisedGuestBillInput,
  callbacks?: { onError?: (message: string) => void }
): Promise<void> {
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, ...input.settings };
  const billLabel = restaurantBillLabel(input.orderNumber, input.invoiceId);
  const when = input.createdAt ? new Date(input.createdAt) : new Date();

  const changeBlock =
    input.showChangeDetails !== false && input.changes && input.changes.length > 0
      ? `
    <div style="border:1px dashed #000;padding:5px;margin:6px 0;font-size:9px;line-height:1.4;">
      <div style="font-weight:bold;text-align:center;margin-bottom:4px;">BILL CHANGES / بل میں تبدیلی</div>
      ${input.changes
        .map(
          (c) =>
            `<div style="margin:2px 0;">• ${esc(c.name)} - ${esc(c.detail)}</div>`
        )
        .join("")}
    </div>`
      : "";

  const headerBannerHtml = `
    <div style="text-align:center;font-weight:bold;font-size:11px;margin:4px 0;">
      REVISED GUEST BILL (v${input.revisionNumber})
    </div>
    <div style="font-size:9px;text-align:center;margin-bottom:4px;">
      Previous total: Rs ${input.previousTotal.toFixed(2)} → New: Rs ${input.netTotal.toFixed(2)}
    </div>
    ${
      input.editedAt
        ? `<div style="font-size:8px;text-align:center;margin-bottom:4px;">Edited: ${new Date(input.editedAt).toLocaleString()}${input.editedBy ? ` · ${esc(input.editedBy)}` : ""}</div>`
        : ""
    }
    ${changeBlock}`;

  const slipStyle = buildRestaurantSlipDocumentStyle(settings);
  const inner = buildPaymentReceiptHtmlDocument(
    paymentReceiptPayload(
      input,
      { orderStatus: "REVISED", headerBannerHtml },
      compactReceiptLinesForGuestBill(input.items)
    ),
    slipStyle
  );

  await printRestaurantThermalSlip(
    inner,
    settings,
    `Revised Bill ${billLabel} v${input.revisionNumber}`,
    "guestBill",
    input.companyRow,
    callbacks
  );
}

/** Thermal 58/80mm paid sales receipt (after settlement). */
export async function printRestaurantPaidReceipt(
  input: RestaurantPaidReceiptInput,
  callbacks?: { onError?: (message: string) => void }
): Promise<void> {
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, ...input.settings };
  const billLabel = restaurantBillLabel(input.orderNumber, input.invoiceId);
  const designerHtml = designerSlipHtml(input, `Paid Receipt ${billLabel}`, {
    paymentMode: restaurantPaymentLabel(input.paymentMode),
    received: input.paidAmount,
    remaining: input.remainingDue,
  });
  const changeGiven = Math.max(0, Number(input.paidAmount) - Number(input.netTotal));
  const tenderHtml = `
    <div class="totals">
      <p><strong><span class="total-label">Received:</span><span class="total-value">Rs ${input.paidAmount.toFixed(2)}</span></strong></p>
      ${
        changeGiven > 0 && input.remainingDue <= 0
          ? `<p><span class="total-label">Change:</span><span class="total-value">Rs ${changeGiven.toFixed(2)}</span></p>`
          : ""
      }
      ${
        input.remainingDue > 0
          ? `<p><strong><span class="total-label">Credit Due:</span><span class="total-value">Rs ${input.remainingDue.toFixed(2)}</span></strong></p>`
          : ""
      }
    </div>`;
  const inner =
    designerHtml ||
    buildPaymentReceiptHtmlDocument(
      paymentReceiptPayload(
        input,
        {
          orderStatus: "PAID",
          paymentModeLabel: restaurantPaymentLabel(input.paymentMode),
          afterTotalsHtml: tenderHtml,
        },
        compactReceiptLinesForGuestBill(input.items)
      ),
      buildRestaurantSlipDocumentStyle(settings)
    );

  await printRestaurantThermalSlip(
    inner,
    settings,
    `Paid Receipt ${billLabel}`,
    "paidReceipt",
    input.companyRow,
    callbacks
  );
}
