/** Restaurant draft bill edit history (same shape as retail POS edit_history). */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyRestaurantOrderCostAndStock,
  invoiceLinesForCost,
} from "@/lib/restaurant-orders";
import { restoreStockForInvoiceLines } from "@/lib/restaurant-recipe-cost";
import { restaurantReceiptItemLabels } from "@/lib/restaurant-deal-slots";

export type RestaurantBillHistoryItem = {
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  packing_name?: string | null;
};

export type RestaurantBillChangeLine = {
  type: "added" | "removed" | "qty_increased" | "qty_decreased" | "price_changed";
  name: string;
  detail: string;
};

export type RestaurantBillEditHistoryEntry = {
  total_amount: number;
  tax_amount: number;
  discount: number;
  tax_rate?: number;
  status: string;
  paid_amount?: number;
  /** Bill lines immediately before this edit */
  items: RestaurantBillHistoryItem[];
  /** Bill lines after this edit (saved on new edits; older logs use version chain) */
  items_after?: RestaurantBillHistoryItem[];
  edited_at: string;
  edited_by?: string;
  changes?: RestaurantBillChangeLine[];
};

export type RestaurantBillEditPrefs = {
  autoReprintAfterEdit: boolean;
  showChangeDetailsOnReceipt: boolean;
  /** Print amendment KOT to kitchen printer after bill edit (POSRESTURANT-style kitchen notice). */
  autoPrintKotAfterBillEdit: boolean;
  showChangeDetailsOnKot: boolean;
  /** Send delta lines to kitchen_orders queue when bill is edited. */
  dispatchKitchenTicketOnBillEdit: boolean;
};

export const DEFAULT_RESTAURANT_BILL_EDIT_PREFS: RestaurantBillEditPrefs = {
  autoReprintAfterEdit: true,
  showChangeDetailsOnReceipt: true,
  autoPrintKotAfterBillEdit: true,
  showChangeDetailsOnKot: true,
  dispatchKitchenTicketOnBillEdit: true,
};

const PREFS_KEY = "restaurant_bill_edit_prefs";

export function loadRestaurantBillEditPrefs(shopId: string | null | undefined): RestaurantBillEditPrefs {
  if (!shopId || typeof window === "undefined") return { ...DEFAULT_RESTAURANT_BILL_EDIT_PREFS };
  try {
    const raw = localStorage.getItem(`${PREFS_KEY}_${shopId}`);
    if (!raw) return { ...DEFAULT_RESTAURANT_BILL_EDIT_PREFS };
    return { ...DEFAULT_RESTAURANT_BILL_EDIT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_RESTAURANT_BILL_EDIT_PREFS };
  }
}

export function saveRestaurantBillEditPrefs(shopId: string, prefs: RestaurantBillEditPrefs): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${PREFS_KEY}_${shopId}`, JSON.stringify(prefs));
}

export function parseRestaurantEditHistory(raw: unknown): RestaurantBillEditHistoryEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as RestaurantBillEditHistoryEntry[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function lineKey(item: { product_id?: string; packing_name?: string | null; product_name?: string }) {
  return `${item.product_id || item.product_name || "?"}::${item.packing_name || ""}`;
}

export function mapInvoiceRowsToHistoryItems(
  rows: {
    product_id?: string;
    quantity: number;
    unit_price: number;
    subtotal?: number;
    packing_name?: string | null;
    products?: { name: string } | null;
    custom_name?: string | null;
  }[]
): RestaurantBillHistoryItem[] {
  return rows.map((r) => {
    const base = r.products?.name || "Item";
    const labels = restaurantReceiptItemLabels(base, r.packing_name, r.custom_name);
    const name = labels.detail ? `${labels.title} (${labels.detail})` : labels.title;
    const qty = Number(r.quantity) || 0;
    const price = Number(r.unit_price) || 0;
    return {
      product_id: r.product_id,
      product_name: name,
      quantity: qty,
      unit_price: price,
      subtotal: r.subtotal != null ? Number(r.subtotal) : qty * price,
      packing_name: r.packing_name,
    };
  });
}

/** Diff previous snapshot vs new bill lines (by product + size). */
export function computeRestaurantBillChanges(
  previous: RestaurantBillHistoryItem[],
  next: RestaurantBillHistoryItem[]
): RestaurantBillChangeLine[] {
  const changes: RestaurantBillChangeLine[] = [];
  const prevMap = new Map<string, RestaurantBillHistoryItem>();
  const nextMap = new Map<string, RestaurantBillHistoryItem>();

  for (const p of previous) prevMap.set(lineKey(p), p);
  for (const n of next) nextMap.set(lineKey(n), n);

  for (const [key, oldLine] of prevMap) {
    const newLine = nextMap.get(key);
    if (!newLine) {
      changes.push({
        type: "removed",
        name: oldLine.product_name,
        detail: `Removed · was ${oldLine.quantity} × Rs ${Math.round(oldLine.unit_price)}`,
      });
      continue;
    }
    if (newLine.quantity > oldLine.quantity) {
      changes.push({
        type: "qty_increased",
        name: newLine.product_name,
        detail: `Qty ${oldLine.quantity} → ${newLine.quantity}`,
      });
    } else if (newLine.quantity < oldLine.quantity) {
      changes.push({
        type: "qty_decreased",
        name: newLine.product_name,
        detail: `Qty ${oldLine.quantity} → ${newLine.quantity}`,
      });
    }
    if (Math.round(newLine.unit_price) !== Math.round(oldLine.unit_price)) {
      changes.push({
        type: "price_changed",
        name: newLine.product_name,
        detail: `Price Rs ${Math.round(oldLine.unit_price)} → Rs ${Math.round(newLine.unit_price)}`,
      });
    }
  }

  for (const [key, newLine] of nextMap) {
    if (!prevMap.has(key)) {
      changes.push({
        type: "added",
        name: newLine.product_name,
        detail: `Added · ${newLine.quantity} × Rs ${Math.round(newLine.unit_price)}`,
      });
    }
  }

  return changes;
}

export type KitchenDispatchDeltaLine = {
  product_id: string;
  quantity: number;
  name: string;
  packing_name?: string | null;
};

/** Items kitchen must prepare after a bill edit (new lines + qty increases only). */
export function computeKitchenDispatchDelta(
  previous: RestaurantBillHistoryItem[],
  next: RestaurantBillHistoryItem[]
): KitchenDispatchDeltaLine[] {
  const prevMap = new Map<string, RestaurantBillHistoryItem>();
  for (const p of previous) prevMap.set(lineKey(p), p);

  const deltas: KitchenDispatchDeltaLine[] = [];
  for (const n of next) {
    if (!n.product_id) continue;
    const prev = prevMap.get(lineKey(n));
    const oldQty = prev?.quantity ?? 0;
    const diff = n.quantity - oldQty;
    if (diff > 0) {
      deltas.push({
        product_id: n.product_id,
        quantity: diff,
        name: n.product_name,
        packing_name: n.packing_name,
      });
    }
  }
  return deltas;
}

export function kotChangeTypeLabel(type: RestaurantBillChangeLine["type"], en = true): string {
  if (en) {
    switch (type) {
      case "added":
        return "ADD";
      case "removed":
        return "CANCEL";
      case "qty_increased":
        return "QTY +";
      case "qty_decreased":
        return "QTY −";
      case "price_changed":
        return "PRICE";
      default:
        return type;
    }
  }
  switch (type) {
    case "added":
      return "نیا";
    case "removed":
      return "منسوخ";
    case "qty_increased":
      return "مقدار +";
    case "qty_decreased":
      return "مقدار −";
    case "price_changed":
      return "قیمت";
    default:
      return type;
  }
}

export function buildRestaurantEditHistoryEntry(opts: {
  invoice: {
    total_amount: number;
    tax_amount?: number | null;
    discount?: number | null;
    tax_rate?: number | null;
    status: string;
    paid_amount?: number | null;
  };
  previousItems: RestaurantBillHistoryItem[];
  nextItems: RestaurantBillHistoryItem[];
  editedBy?: string | null;
}): RestaurantBillEditHistoryEntry {
  const changes = computeRestaurantBillChanges(opts.previousItems, opts.nextItems);
  return {
    total_amount: Number(opts.invoice.total_amount) || 0,
    tax_amount: Number(opts.invoice.tax_amount || 0),
    discount: Number(opts.invoice.discount || 0),
    tax_rate: Number(opts.invoice.tax_rate || 0),
    status: opts.invoice.status,
    paid_amount: Number(opts.invoice.paid_amount || 0),
    items: opts.previousItems,
    items_after: opts.nextItems,
    edited_at: new Date().toISOString(),
    edited_by: opts.editedBy || "Operator",
    changes,
  };
}

export function mapCurrentItemsToHistoryItems(
  rows: { name: string; quantity: number; unit_price: number }[]
): RestaurantBillHistoryItem[] {
  return rows.map((r) => {
    const qty = Number(r.quantity) || 0;
    const price = Number(r.unit_price) || 0;
    return {
      product_name: r.name,
      quantity: qty,
      unit_price: price,
      subtotal: qty * price,
    };
  });
}

/** Lines on the bill after version `versionIndex` (0 = most recent edit). */
export function billItemsAfterVersion(
  history: RestaurantBillEditHistoryEntry[],
  versionIndex: number,
  currentItems: RestaurantBillHistoryItem[]
): RestaurantBillHistoryItem[] {
  const entry = history[versionIndex];
  if (!entry) return [];
  if (entry.items_after && entry.items_after.length > 0) return entry.items_after;
  if (versionIndex === 0) return currentItems;
  return history[versionIndex - 1]?.items ?? [];
}

export function billTotalsAfterVersion(
  history: RestaurantBillEditHistoryEntry[],
  versionIndex: number,
  currentBill: { total_amount: number; tax_amount?: number; discount?: number } | null
): { total_amount: number; tax_amount: number; discount: number } {
  if (versionIndex === 0 && currentBill) {
    return {
      total_amount: Number(currentBill.total_amount) || 0,
      tax_amount: Number(currentBill.tax_amount || 0),
      discount: Number(currentBill.discount || 0),
    };
  }
  const prev = history[versionIndex - 1];
  if (!prev) {
    const afterItems = billItemsAfterVersion(history, versionIndex, []);
    const sub = afterItems.reduce((s, i) => s + (i.subtotal ?? i.quantity * i.unit_price), 0);
    return { total_amount: sub, tax_amount: 0, discount: 0 };
  }
  return {
    total_amount: Number(prev.total_amount) || 0,
    tax_amount: Number(prev.tax_amount || 0),
    discount: Number(prev.discount || 0),
  };
}

export function historyItemLineTotal(item: RestaurantBillHistoryItem): number {
  if (item.subtotal != null) return Number(item.subtotal);
  return (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
}

export type RestaurantBillEditPersistLine = {
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
  packing_name?: string | null;
  menu_size_id?: string | null;
  products?: { name: string; purchase_price_single?: number } | null;
};

/** True when invoice already had lines and cart differs - auto-append edit version on KOT/sync. */
export function shouldAutoAppendBillVersion(
  previousItemRows: RestaurantBillEditPersistLine[],
  nextItemRows: RestaurantBillEditPersistLine[]
): boolean {
  if (previousItemRows.length === 0) return false;
  const changes = computeRestaurantBillChanges(
    mapInvoiceRowsToHistoryItems(previousItemRows),
    mapInvoiceRowsToHistoryItems(nextItemRows)
  );
  return changes.length > 0;
}

export type PersistRestaurantBillEditResult = {
  historyEntry: RestaurantBillEditHistoryEntry;
  updatedHistory: RestaurantBillEditHistoryEntry[];
  newSubtotal: number;
  newTaxAmount: number;
  newNetTotal: number;
  nextOrderStatus: string | null;
  previousItems: RestaurantBillHistoryItem[];
  nextItems: RestaurantBillHistoryItem[];
};

/** Replace draft invoice lines and append version history (POS or Billing Desk queue). */
export async function persistRestaurantDraftBillEdit(
  supabase: SupabaseClient,
  args: {
    invoiceId: string;
    previousItemRows: RestaurantBillEditPersistLine[];
    nextItemRows: RestaurantBillEditPersistLine[];
    discount: number;
    taxRate: number;
    editedBy?: string;
    /** POS KOT after bill edit → kitchen queue again */
    nextOrderStatus?: string | null;
    clearBillPrintedAt?: boolean;
  }
): Promise<PersistRestaurantBillEditResult> {
  const {
    invoiceId,
    previousItemRows,
    nextItemRows,
    discount,
    taxRate,
    editedBy,
    nextOrderStatus: statusOverride,
    clearBillPrintedAt,
  } = args;

  const { data: prevInv, error: loadErr } = await supabase
    .from("invoices")
    .select(
      "total_amount, tax_amount, discount, tax_rate, status, paid_amount, edit_history, stock_deducted, restaurant_order_status, bill_printed_at"
    )
    .eq("id", invoiceId)
    .single();

  if (loadErr) throw loadErr;

  const previousItems = mapInvoiceRowsToHistoryItems(previousItemRows);
  const nextItems = mapInvoiceRowsToHistoryItems(nextItemRows);

  const changes = computeRestaurantBillChanges(previousItems, nextItems);
  if (changes.length === 0) {
    return {
      historyEntry: buildRestaurantEditHistoryEntry({
        invoice: prevInv || { total_amount: 0, status: "draft" },
        previousItems,
        nextItems,
        editedBy,
      }),
      updatedHistory: parseRestaurantEditHistory(prevInv?.edit_history),
      newSubtotal: previousItems.reduce((s, i) => s + i.subtotal, 0),
      newTaxAmount: Number(prevInv?.tax_amount || 0),
      newNetTotal: Number(prevInv?.total_amount || 0),
      nextOrderStatus: prevInv?.restaurant_order_status || null,
      previousItems,
      nextItems,
    };
  }

  const historyEntry = buildRestaurantEditHistoryEntry({
    invoice: prevInv || { total_amount: 0, status: "draft" },
    previousItems,
    nextItems,
    editedBy,
  });

  const oldHistory = parseRestaurantEditHistory(prevInv?.edit_history);
  const updatedHistory = [historyEntry, ...oldHistory];

  if (prevInv?.stock_deducted && previousItemRows.length) {
    await restoreStockForInvoiceLines(
      supabase,
      invoiceLinesForCost(
        previousItemRows.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          packing_name: it.packing_name,
          menu_size_id: it.menu_size_id,
        }))
      )
    );
  }

  await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

  const itemsToInsert = nextItemRows.map((item) => ({
    invoice_id: invoiceId,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.subtotal != null ? item.subtotal : item.unit_price * item.quantity,
    packing_name: item.packing_name || null,
    menu_size_id: item.menu_size_id || null,
  }));

  const { error: insertErr } = await supabase.from("invoice_items").insert(itemsToInsert);
  if (insertErr) throw insertErr;

  const newSubtotal = nextItemRows.reduce(
    (sum, item) => sum + (item.subtotal != null ? item.subtotal : item.unit_price * item.quantity),
    0
  );
  const newTaxAmount = (newSubtotal * (taxRate || 0)) / 100;
  const newNetTotal = Math.max(0, newSubtotal + newTaxAmount - (discount || 0));

  const wasBillPrinted = prevInv?.restaurant_order_status === "bill_printed";
  const nextOrderStatus =
    statusOverride !== undefined
      ? statusOverride
      : wasBillPrinted || prevInv?.bill_printed_at
        ? "ready"
        : prevInv?.restaurant_order_status || null;

  const clearPrinted = clearBillPrintedAt === true || wasBillPrinted;

  const { error: invErr } = await supabase
    .from("invoices")
    .update({
      total_amount: newNetTotal,
      tax_amount: newTaxAmount,
      is_edited: true,
      edit_history: updatedHistory,
      restaurant_order_status: nextOrderStatus,
      bill_printed_at: clearPrinted ? null : prevInv?.bill_printed_at,
      stock_deducted: false,
    })
    .eq("id", invoiceId);

  if (invErr) throw invErr;

  await applyRestaurantOrderCostAndStock(
    supabase,
    invoiceId,
    invoiceLinesForCost(
      itemsToInsert.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
        packing_name: it.packing_name,
        menu_size_id: it.menu_size_id,
      }))
    ),
    newNetTotal,
    { deductStock: false }
  );

  return {
    historyEntry,
    updatedHistory,
    newSubtotal,
    newTaxAmount,
    newNetTotal,
    nextOrderStatus,
    previousItems,
    nextItems,
  };
}
