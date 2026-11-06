import { DEFAULT_RECEIPT_SETTINGS, type ReceiptSettings } from "@/components/ReceiptTemplate";
import { printReceiptDirect } from "@/lib/thermalPrinter";
import {
  resolvePrinterNameForRole,
  type RestaurantPrintRole,
} from "@/lib/restaurant-print-profile";
import { restaurantPaymentLabel } from "@/lib/restaurant-riders";
import {
  kotChangeTypeLabel,
  type RestaurantBillChangeLine,
} from "@/lib/restaurant-bill-edit";

export type RestaurantReceiptLine = {
  name: string;
  quantity: number;
  unit_price: number;
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

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printRestaurantThermalSlip(
  inner: string,
  settings: Partial<ReceiptSettings>,
  title: string,
  role: RestaurantPrintRole,
  companyRow?: Record<string, unknown> | null,
  callbacks?: { onError?: (message: string) => void }
): void {
  const merged = { ...DEFAULT_RECEIPT_SETTINGS, ...settings };
  const targetPrinterName = resolvePrinterNameForRole(role, merged, companyRow);
  printReceiptDirect({
    receiptHtml: inner,
    settings: merged,
    title,
    targetPrinterName: targetPrinterName || undefined,
    onError: (err) => {
      const base =
        err instanceof Error
          ? err.message
          : role === "kitchen"
            ? "KOT print failed - set Kitchen printer in Business Details."
            : "Customer slip print failed - set Customer printer in Business Details or Windows default.";
      const hint = targetPrinterName
        ? `${base} (Printer: ${targetPrinterName})`
        : base;
      callbacks?.onError?.(hint);
    },
  });
}

export function restaurantBillLabel(orderNumber: string | null | undefined, invoiceId: string): string {
  const n = orderNumber?.trim();
  if (n) return n.startsWith("#") ? n : `#${n}`;
  return `#${invoiceId.slice(0, 8).toUpperCase()}`;
}

export type RestaurantKOTLine = {
  name: string;
  quantity: number;
  sizeLabel?: string | null;
  remarks?: string | null;
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
    const base = i.products?.name || i.custom_name || "Item";
    const size = i.packing_name?.trim();
    const name = size && !base.includes(size) ? `${base} (${size})` : base;
    return {
      name,
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0,
    };
  });
}

function itemAmountRows(items: RestaurantReceiptLine[]): string {
  return items
    .map(
      (item, idx) => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:4px;font-size:11px;line-height:1.35;margin:3px 0;">
      <span style="flex:1;word-break:break-word;">${idx + 1}. ${esc(item.name)}</span>
      <span style="width:22px;text-align:center;flex-shrink:0;">${item.quantity}</span>
      <span style="width:58px;text-align:right;flex-shrink:0;font-weight:bold;">${Math.round(
        item.unit_price * item.quantity
      ).toLocaleString()}</span>
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

function metaRow(label: string, value: string, strong = false): string {
  return `<div style="display:flex;justify-content:space-between;gap:6px;align-items:flex-start;">
    <span>${esc(label)}</span>${
      strong
        ? `<strong style="text-align:right;">${esc(value)}</strong>`
        : `<span style="text-align:right;">${esc(value)}</span>`
    }
  </div>`;
}

/** POSRESTURANT-style guest / delivery / waiter block for KOT + customer slips. */
function guestDetailsBlock(
  input: RestaurantGuestDetails & {
    billLabel?: string;
    when?: string;
    serviceType?: string | null;
    tableName?: string | null;
    forKitchen?: boolean;
  }
): string {
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
      `<div style="margin-top:2px;"><span>Address:</span> <span>${esc(addr)}</span></div>`
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
    ? `<div style="font-size:10px;border:1px dashed #000;padding:4px;margin:6px 0;"><strong>Notes:</strong> ${esc(notes)}</div>`
    : "";

  return `<div style="font-size:10px;line-height:1.45;margin-bottom:6px;">${rows.join("")}</div>${notesHtml}`;
}

function extraChargeRows(input: RestaurantGuestDetails): string {
  const parts: string[] = [];
  if ((input.deliveryFee || 0) > 0) {
    parts.push(
      `<div style="display:flex;justify-content:space-between;"><span>Delivery</span><span>+${Math.round(Number(input.deliveryFee)).toLocaleString()}</span></div>`
    );
  }
  if ((input.additionalCharges || 0) > 0) {
    parts.push(
      `<div style="display:flex;justify-content:space-between;"><span>Extra charges</span><span>+${Math.round(Number(input.additionalCharges)).toLocaleString()}</span></div>`
    );
  }
  return parts.join("");
}

function shopHeaderBlock(
  shop: RestaurantPaidReceiptInput["shopDetails"],
  settings: Partial<ReceiptSettings>,
  opts?: { showLogo?: boolean }
): string {
  const merged = { ...DEFAULT_RECEIPT_SETTINGS, ...settings };
  const useLogo = opts?.showLogo !== false && merged.showLogo && merged.logoUrl;
  const logoBlock = useLogo
    ? `<div style="text-align:center;margin-bottom:5px;">
        <img src="${esc(merged.logoUrl)}" alt="" style="max-width:140px;max-height:64px;object-fit:contain;display:inline-block;" />
      </div>`
    : "";

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

function thermalFooterBlock(settings: Partial<ReceiptSettings>): string {
  const merged = { ...DEFAULT_RECEIPT_SETTINGS, ...settings };
  const lines: string[] = [];
  if (merged.customUrduNote?.trim()) {
    lines.push(`<div style="font-size:9px;margin-top:2px;">${esc(merged.customUrduNote.trim())}</div>`);
  }
  const thank = merged.thankYouMessage || merged.footerText;
  if (thank?.trim()) {
    lines.push(`<div style="font-size:10px;margin-top:4px;font-weight:600;">${esc(thank.trim())}</div>`);
  }
  if (lines.length === 0) return "";
  return `<div style="text-align:center;margin-top:10px;border-top:1px dashed #000;padding-top:6px;">${lines.join("")}</div>`;
}

/** Kitchen Order Ticket - matches POSRESTURANT KOT fields (table, waiter, sizes, notes). */
export function printRestaurantKOTSlip(
  input: RestaurantKOTInput,
  callbacks?: { onError?: (message: string) => void }
): void {
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, ...input.settings };
  const billLabel = input.orderNumber?.trim() ? restaurantBillLabel(input.orderNumber, "KOT") : "NEW";
  const when = new Date().toLocaleString();

  const amend = input.billAmendment;
  const prepareLines = amend?.prepareNow?.length ? amend.prepareNow : input.items;
  const isAmendment = !!amend?.changes?.length;
  const kotTitle = isAmendment
    ? "KOT AMENDMENT (PREPARE)"
    : "KITCHEN ORDER TICKET (KOT)";

  const rows = prepareLines
    .map((it) => {
      const size = it.sizeLabel?.trim();
      const title = size ? `${it.name} · ${size}` : it.name;
      return `
      <tr>
        <td style="padding:4px 0;vertical-align:top;border-bottom:1px dotted #ccc;">
          <div style="font-weight:bold;font-size:12px;">${esc(title)}</div>
          ${
            it.remarks
              ? `<div style="font-size:10px;font-style:italic;margin-top:2px;">Note: ${esc(it.remarks)}</div>`
              : ""
          }
        </td>
        <td style="padding:4px 0;text-align:right;font-weight:bold;font-size:13px;border-bottom:1px dotted #ccc;">${it.quantity}</td>
      </tr>`;
    })
    .join("");

  const guestBlock = guestDetailsBlock({
    ...input,
    billLabel,
    when,
    forKitchen: true,
  });
  const reprintBanner = input.isReprint
    ? `<div style="text-align:center;font-weight:bold;font-size:10px;margin:4px 0;border:1px solid #000;padding:2px;">REPRINT · KOT${input.kotTicketId ? ` #${input.kotTicketId.slice(0, 6).toUpperCase()}` : ""}</div>`
    : "";

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

  const headerShop = input.shopDetails
    ? shopHeaderBlock(input.shopDetails, settings, {
        showLogo: (settings as ReceiptSettings & { restaurantLogoOnKot?: boolean }).restaurantLogoOnKot !== false,
      })
    : "";

  const inner = `
    ${headerShop}
    <div style="text-align:center;font-weight:bold;font-size:14px;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:6px;">
      ${kotTitle}
    </div>
    ${reprintBanner}
    ${guestBlock}
    ${amendmentBlock}
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;font-size:10px;border-bottom:1px solid #000;padding-bottom:4px;">${
            isAmendment ? "Prepare now" : "Item"
          }</th>
          <th style="text-align:right;font-size:10px;border-bottom:1px solid #000;padding-bottom:4px;width:32px;">Qty</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="2" style="font-size:10px;">No items</td></tr>`}</tbody>
    </table>
    <div style="text-align:center;font-weight:bold;font-size:11px;margin-top:10px;border-top:2px dashed #000;padding-top:6px;">
      ${isAmendment ? "** AMENDED KOT - CHECK CHANGES **" : "** KOT DISPATCHED **"}
    </div>
  `;

  printRestaurantThermalSlip(
    inner,
    settings,
    isAmendment ? `KOT AMEND ${billLabel}` : `KOT ${billLabel}`,
    "kitchen",
    input.companyRow,
    callbacks
  );
}

/** Unpaid guest bill (before settlement) - thermal table slip. */
export function printRestaurantGuestBill(
  input: RestaurantGuestBillInput,
  callbacks?: { onError?: (message: string) => void }
): void {
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, ...input.settings };
  const billLabel = restaurantBillLabel(input.orderNumber, input.invoiceId);
  const when = input.createdAt ? new Date(input.createdAt) : new Date();

  const inner = `
    ${shopHeaderBlock(input.shopDetails, settings)}
    <div style="text-align:center;font-weight:bold;font-size:12px;border:2px solid #000;padding:5px 4px;margin:6px 0;">
      GUEST BILL (UNPAID) · مہمان بل
    </div>
    ${guestDetailsBlock({
      ...input,
      billLabel,
      when: when.toLocaleString(),
    })}
    <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 0;margin:4px 0;">
      <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:bold;margin-bottom:2px;">
        <span style="flex:1;">Item</span>
        <span style="width:22px;text-align:center;">Qty</span>
        <span style="width:58px;text-align:right;">Amount</span>
      </div>
      ${itemAmountRows(input.items) || `<div style="font-size:10px;">No line items</div>`}
    </div>
    <div style="font-size:11px;line-height:1.5;margin-top:4px;">
      <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${Math.round(input.subtotal).toLocaleString()}</span></div>
      ${extraChargeRows(input)}
      ${
        input.discount > 0
          ? `<div style="display:flex;justify-content:space-between;"><span>Discount</span><span>-${Math.round(input.discount).toLocaleString()}</span></div>`
          : ""
      }
      ${
        input.taxAmount > 0
          ? `<div style="display:flex;justify-content:space-between;"><span>Tax (${input.taxRate}%)</span><span>+${Math.round(input.taxAmount).toLocaleString()}</span></div>`
          : ""
      }
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;border-top:1px solid #000;margin-top:4px;padding-top:4px;">
        <span>NET PAYABLE</span><span>Rs ${Math.round(input.netTotal).toLocaleString()}</span>
      </div>
    </div>
    <div style="text-align:center;font-size:9px;margin-top:10px;border-top:1px dashed #000;padding-top:6px;">
      NOT A TAX INVOICE - PAY AT COUNTER
    </div>
    ${thermalFooterBlock(settings)}
  `;

  printRestaurantThermalSlip(
    inner,
    settings,
    `Guest Bill ${billLabel}`,
    "customer",
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
export function printRestaurantRevisedGuestBill(
  input: RestaurantRevisedGuestBillInput,
  callbacks?: { onError?: (message: string) => void }
): void {
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

  const inner = `
    ${shopHeaderBlock(input.shopDetails, settings)}
    <div style="text-align:center;font-weight:bold;font-size:12px;border:2px solid #000;padding:5px 4px;margin:6px 0;">
      REVISED GUEST BILL · نیا بل (v${input.revisionNumber})
    </div>
    <div style="font-size:9px;text-align:center;margin-bottom:4px;">
      Previous total: Rs ${Math.round(input.previousTotal).toLocaleString()} →
      New: Rs ${Math.round(input.netTotal).toLocaleString()}
    </div>
    ${
      input.editedAt
        ? `<div style="font-size:8px;text-align:center;margin-bottom:4px;">Edited: ${new Date(input.editedAt).toLocaleString()}${input.editedBy ? ` · ${esc(input.editedBy)}` : ""}</div>`
        : ""
    }
    ${changeBlock}
    ${guestDetailsBlock({
      ...input,
      billLabel,
      when: when.toLocaleString(),
    })}
    <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 0;margin:4px 0;">
      <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:bold;margin-bottom:2px;">
        <span style="flex:1;">Item (updated)</span>
        <span style="width:22px;text-align:center;">Qty</span>
        <span style="width:58px;text-align:right;">Amount</span>
      </div>
      ${itemAmountRows(input.items) || `<div style="font-size:10px;">No line items</div>`}
    </div>
    <div style="font-size:11px;line-height:1.5;margin-top:4px;">
      <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${Math.round(input.subtotal).toLocaleString()}</span></div>
      ${extraChargeRows(input)}
      ${
        input.discount > 0
          ? `<div style="display:flex;justify-content:space-between;"><span>Discount</span><span>-${Math.round(input.discount).toLocaleString()}</span></div>`
          : ""
      }
      ${
        input.taxAmount > 0
          ? `<div style="display:flex;justify-content:space-between;"><span>Tax (${input.taxRate}%)</span><span>+${Math.round(input.taxAmount).toLocaleString()}</span></div>`
          : ""
      }
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;border-top:1px solid #000;margin-top:4px;padding-top:4px;">
        <span>NET PAYABLE</span><span>Rs ${Math.round(input.netTotal).toLocaleString()}</span>
      </div>
    </div>
    <div style="text-align:center;font-size:9px;margin-top:10px;border-top:1px dashed #000;padding-top:6px;">
      REVISED SLIP - NOT A TAX INVOICE
    </div>
    ${thermalFooterBlock(settings)}
  `;

  printRestaurantThermalSlip(
    inner,
    settings,
    `Revised Bill ${billLabel} v${input.revisionNumber}`,
    "customer",
    input.companyRow,
    callbacks
  );
}

/** Thermal 58/80mm paid sales receipt (after settlement). */
export function printRestaurantPaidReceipt(
  input: RestaurantPaidReceiptInput,
  callbacks?: { onError?: (message: string) => void }
): void {
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, ...input.settings };
  const billLabel = restaurantBillLabel(input.orderNumber, input.invoiceId);
  const when = input.createdAt ? new Date(input.createdAt) : new Date();
  const changeGiven = Math.max(0, Number(input.paidAmount) - Number(input.netTotal));

  const inner = `
    ${shopHeaderBlock(input.shopDetails, settings)}
    <div style="text-align:center;font-weight:bold;font-size:12px;border:2px solid #000;padding:5px 4px;margin:6px 0;letter-spacing:0.5px;">
      PAYMENT RECEIPT · THERMAL BILL
    </div>
    ${guestDetailsBlock({
      ...input,
      billLabel,
      when: when.toLocaleString(),
    })}
    <div style="font-size:10px;margin-bottom:4px;">${metaRow("Payment", restaurantPaymentLabel(input.paymentMode), true)}</div>
    <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 0;margin:4px 0;">
      <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:bold;margin-bottom:2px;">
        <span style="flex:1;">Item</span>
        <span style="width:22px;text-align:center;">Qty</span>
        <span style="width:58px;text-align:right;">Amount</span>
      </div>
      ${itemAmountRows(input.items) || `<div style="font-size:10px;">No line items</div>`}
    </div>
    <div style="font-size:11px;line-height:1.5;margin-top:4px;">
      <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${Math.round(input.subtotal).toLocaleString()}</span></div>
      ${extraChargeRows(input)}
      ${
        input.discount > 0
          ? `<div style="display:flex;justify-content:space-between;"><span>Discount</span><span>-${Math.round(input.discount).toLocaleString()}</span></div>`
          : ""
      }
      ${
        input.taxAmount > 0
          ? `<div style="display:flex;justify-content:space-between;"><span>Tax (${input.taxRate}%)</span><span>+${Math.round(input.taxAmount).toLocaleString()}</span></div>`
          : ""
      }
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;border-top:1px solid #000;margin-top:4px;padding-top:4px;">
        <span>NET PAID</span><span>Rs ${Math.round(input.netTotal).toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:2px;"><span>Received</span><span>Rs ${Math.round(input.paidAmount).toLocaleString()}</span></div>
      ${
        changeGiven > 0 && input.remainingDue <= 0
          ? `<div style="display:flex;justify-content:space-between;"><span>Change</span><span>Rs ${Math.round(changeGiven).toLocaleString()}</span></div>`
          : ""
      }
      ${
        input.remainingDue > 0
          ? `<div style="display:flex;justify-content:space-between;font-weight:bold;"><span>Credit Due</span><span>Rs ${Math.round(input.remainingDue).toLocaleString()}</span></div>`
          : ""
      }
    </div>
    ${thermalFooterBlock(settings)}
    <div style="text-align:center;font-size:9px;margin-top:4px;">Powered by The Accounts</div>
  `;

  printRestaurantThermalSlip(
    inner,
    settings,
    `Paid Receipt ${billLabel}`,
    "customer",
    input.companyRow,
    callbacks
  );
}
