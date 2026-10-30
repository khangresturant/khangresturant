// Direct ESC/POS Web Thermal Printing Engine
// Communicates directly with USB / Serial Thermal Printers (FIT FP-1100, Xprinter, Epson, Black Copper, Rongta)
// Bypasses Chrome Print Dialog completely for 0.1s instant silent receipt printing.

export interface EscPosInvoiceData {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  invoiceId: string;
  dateStr: string;
  customerName?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    sale_price?: number;
    unit_price?: number;
    subtotal?: number;
    batchNumber?: string;
    expiryDate?: string;
  }>;
  grossSubtotal?: number;
  discount?: number;
  taxAmount?: number;
  totalAmount: number;
  paymentMode?: string;
  receivedAmount?: number;
  thankYouMessage?: string;
  footerText?: string;
  currency?: string;
}

let cachedPort: any = null;

/**
 * Checks if Web Serial API is available in the current browser (Chrome/Edge/Opera).
 */
export function isDirectSerialPrintingSupported(): boolean {
  return typeof window !== "undefined" && "serial" in navigator;
}

/**
 * Connects to a USB / Serial thermal receipt printer and caches the port.
 */
export async function connectThermalPrinter(): Promise<any> {
  if (!isDirectSerialPrintingSupported()) {
    throw new Error("Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
  }

  const serial = (navigator as any).serial;
  const port = await serial.requestPort();
  await port.open({ baudRate: 9600 });
  cachedPort = port;
  return port;
}

/**
 * Encodes an invoice into standard ESC/POS binary buffer for 80mm/58mm thermal printers.
 */
export function generateEscPosBuffer(data: EscPosInvoiceData, paperWidth: "80mm" | "58mm" = "80mm"): Uint8Array {
  const encoder = new TextEncoder();
  const bytes: number[] = [];

  const addBytes = (...b: number[]) => bytes.push(...b);
  const addText = (text: string) => {
    const encoded = encoder.encode(text);
    for (let i = 0; i < encoded.length; i++) {
      bytes.push(encoded[i]);
    }
  };

  const lineCols = paperWidth === "58mm" ? 32 : 48;
  const cur = data.currency || "Rs";

  // ESC @: Initialize printer
  addBytes(0x1B, 0x40);

  // Character set: PC437 (USA, Standard Europe)
  addBytes(0x1B, 0x74, 0x00);

  // 1. Header (Centered, Bold, Double Height/Width)
  addBytes(0x1B, 0x61, 0x01); // Center align
  addBytes(0x1B, 0x21, 0x30); // Double height + Double width + Bold
  addText((data.shopName || "THE ACCOUNTS STORE").toUpperCase() + "\n");
  addBytes(0x1B, 0x21, 0x00); // Normal text

  if (data.shopAddress) {
    addText(data.shopAddress + "\n");
  }
  if (data.shopPhone) {
    addText(`Ph: ${data.shopPhone}\n`);
  }

  // Divider
  addText("-".repeat(lineCols) + "\n");

  // 2. Invoice Details (Left align)
  addBytes(0x1B, 0x61, 0x00); // Left align
  addText(`Date: ${data.dateStr}\n`);
  addText(`Invoice #: ${data.invoiceId}\n`);
  if (data.customerName && data.customerName !== "Walk-in Customer") {
    addText(`Customer: ${data.customerName}\n`);
  }

  // Table Divider
  addText("=".repeat(lineCols) + "\n");

  // 3. Items Header
  if (paperWidth === "58mm") {
    // 32 cols: Item (13) Qty (4) Price (6) Total (9)
    addText("ITEM         QTY  PRICE   TOTAL\n");
    addText("-".repeat(lineCols) + "\n");
  } else {
    // 48 cols: Item (20) Qty (5) Price (10) Total (13)
    addText("ITEM                 QTY     PRICE      TOTAL\n");
    addText("-".repeat(lineCols) + "\n");
  }

  // 4. Item Rows
  for (const item of data.items) {
    const unitPrice = Number(item.price !== undefined ? item.price : (item.sale_price !== undefined ? item.sale_price : (item.unit_price || 0)));
    const total = item.subtotal !== undefined ? item.subtotal : (unitPrice * item.quantity);
    const priceStr = unitPrice.toFixed(0);
    const totalStr = total.toFixed(2);
    const qtyStr = item.quantity.toString();

    if (paperWidth === "58mm") {
      let name = item.name;
      if (name.length > 12) name = name.substring(0, 11) + ".";
      const line = name.padEnd(13, " ") + qtyStr.padStart(4, " ") + priceStr.padStart(6, " ") + totalStr.padStart(9, " ");
      addText(line + "\n");
    } else {
      let name = item.name;
      if (name.length > 19) name = name.substring(0, 18) + ".";
      const line = name.padEnd(20, " ") + qtyStr.padStart(5, " ") + priceStr.padStart(10, " ") + totalStr.padStart(13, " ");
      addText(line + "\n");
    }

    if (item.batchNumber || item.expiryDate) {
      addText(`  Batch: ${item.batchNumber || '-'} Exp: ${item.expiryDate || '-'}\n`);
    }
  }

  // Divider
  addText("-".repeat(lineCols) + "\n");

  // 5. Totals (Right Aligned)
  addBytes(0x1B, 0x61, 0x02); // Right align

  if (data.grossSubtotal && data.discount && data.discount > 0) {
    addText(`Subtotal: ${cur} ${data.grossSubtotal.toFixed(2)}\n`);
    addText(`Discount: -${cur} ${data.discount.toFixed(2)}\n`);
  }

  if (data.taxAmount && data.taxAmount > 0) {
    addText(`Tax: ${cur} ${data.taxAmount.toFixed(2)}\n`);
  }

  // Grand Total in Bold
  addBytes(0x1B, 0x21, 0x20); // Double height bold
  addText(`TOTAL: ${cur} ${data.totalAmount.toFixed(2)}\n`);
  addBytes(0x1B, 0x21, 0x00); // Normal

  if (data.paymentMode) {
    addText(`Payment: ${data.paymentMode.toUpperCase()}\n`);
  }
  if (data.receivedAmount !== undefined && data.receivedAmount > 0) {
    addText(`Paid: ${cur} ${data.receivedAmount.toFixed(2)}\n`);
  }

  // 6. Footer (Centered)
  addBytes(0x1B, 0x61, 0x01); // Center align
  addText("\n");
  addText((data.thankYouMessage || "Thank you for shopping with us!") + "\n");
  if (data.footerText) {
    addText(data.footerText + "\n");
  }
  addText("Powered by The Accounts POS\n");

  // 7. Feed 4 lines and Full Cut
  addText("\n\n\n\n");
  addBytes(0x1D, 0x56, 0x00); // GS V 0 (Full cut)

  return new Uint8Array(bytes);
}

/**
 * Sends ESC/POS binary stream directly to thermal printer over WebSerial without any browser print popup.
 */
export async function printDirectEscPos(data: EscPosInvoiceData, paperWidth: "80mm" | "58mm" = "80mm"): Promise<void> {
  let port = cachedPort;

  if (!port || !port.writable) {
    port = await connectThermalPrinter();
  }

  const buffer = generateEscPosBuffer(data, paperWidth);
  const writer = port.writable.getWriter();
  await writer.write(buffer);
  writer.releaseLock();
}
