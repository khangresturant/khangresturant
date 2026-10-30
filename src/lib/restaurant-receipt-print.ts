import { DEFAULT_RECEIPT_SETTINGS, type ReceiptSettings } from "@/components/ReceiptTemplate";
import { printReceiptDirect } from "@/lib/thermalPrinter";

export type RestaurantReceiptLine = {
  name: string;
  quantity: number;
  unit_price: number;
};

export type RestaurantPaidReceiptInput = {
  invoiceId: string;
  orderNumber?: string | null;
  tableName?: string | null;
  serviceType?: string | null;
  customerName?: string | null;
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
  };
  createdAt?: string;
};

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Thermal 58/80mm paid sales receipt (after settlement). */
export function printRestaurantPaidReceipt(
  input: RestaurantPaidReceiptInput,
  callbacks?: { onError?: (message: string) => void }
): void {
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, ...input.settings };
  const billLabel =
    input.orderNumber?.trim() ||
    `#${input.invoiceId.slice(0, 8).toUpperCase()}`;
  const when = input.createdAt ? new Date(input.createdAt) : new Date();
  const source =
    input.tableName ||
    (input.serviceType ? String(input.serviceType).toUpperCase() : "Restaurant");

  const itemRows = input.items
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

  const inner = `
    <div style="text-align:center;margin-bottom:6px;">
      <div style="font-size:15px;font-weight:bold;text-transform:uppercase;">${esc(input.shopDetails.name)}</div>
      ${
        input.shopDetails.address
          ? `<div style="font-size:10px;margin-top:2px;">${esc(input.shopDetails.address)}</div>`
          : ""
      }
      ${
        input.shopDetails.phone
          ? `<div style="font-size:10px;">Tel: ${esc(input.shopDetails.phone)}</div>`
          : ""
      }
    </div>
    <div style="text-align:center;font-weight:bold;font-size:12px;border:2px solid #000;padding:5px 4px;margin:6px 0;letter-spacing:0.5px;">
      PAYMENT RECEIPT · THERMAL BILL
    </div>
    <div style="font-size:10px;line-height:1.45;margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;"><span>Bill:</span><strong>${esc(billLabel)}</strong></div>
      <div style="display:flex;justify-content:space-between;"><span>Date:</span><span>${when.toLocaleString()}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Table/Type:</span><strong>${esc(source)}</strong></div>
      ${
        input.customerName
          ? `<div style="display:flex;justify-content:space-between;"><span>Guest:</span><span>${esc(input.customerName)}</span></div>`
          : ""
      }
      <div style="display:flex;justify-content:space-between;"><span>Payment:</span><strong>${esc(input.paymentMode.toUpperCase())}</strong></div>
    </div>
    <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 0;margin:4px 0;">
      <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:bold;margin-bottom:2px;">
        <span style="flex:1;">Item</span>
        <span style="width:22px;text-align:center;">Qty</span>
        <span style="width:58px;text-align:right;">Amount</span>
      </div>
      ${itemRows || `<div style="font-size:10px;">No line items</div>`}
    </div>
    <div style="font-size:11px;line-height:1.5;margin-top:4px;">
      <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${Math.round(input.subtotal).toLocaleString()}</span></div>
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
        input.remainingDue > 0
          ? `<div style="display:flex;justify-content:space-between;font-weight:bold;"><span>Credit Due</span><span>Rs ${Math.round(input.remainingDue).toLocaleString()}</span></div>`
          : ""
      }
    </div>
    <div style="text-align:center;font-size:10px;margin-top:10px;border-top:1px dashed #000;padding-top:6px;">
      ${esc(String(settings.thankYouMessage || settings.footerText || "Thank you — visit again!"))}
    </div>
    <div style="text-align:center;font-size:9px;margin-top:4px;">Powered by The Accounts</div>
  `;

  printReceiptDirect({
    receiptHtml: inner,
    settings,
    title: `Paid Receipt ${billLabel}`,
    onError: (err) => {
      const msg =
        err instanceof Error
          ? err.message
          : "Print failed. Set thermal printer as Windows default, then click Print in the dialog.";
      callbacks?.onError?.(msg);
    },
  });
}
