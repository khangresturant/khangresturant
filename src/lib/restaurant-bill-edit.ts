/** Restaurant draft bill edit history (same shape as retail POS edit_history). */

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
  items: RestaurantBillHistoryItem[];
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
    const name = r.products?.name || r.custom_name || "Item";
    const qty = Number(r.quantity) || 0;
    const price = Number(r.unit_price) || 0;
    return {
      product_id: r.product_id,
      product_name: r.packing_name ? `${name} (${r.packing_name})` : name,
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
    edited_at: new Date().toISOString(),
    edited_by: opts.editedBy || "Operator",
    changes,
  };
}
