import type { RestaurantDeal } from "@/lib/restaurant-deals";

export type DealItemType = "fixed" | "choice";

export type RestaurantDealItemRow = {
  id: string;
  deal_id?: string;
  product_id: string | null;
  quantity: number;
  size_name: string | null;
  item_type: string;
  slot_label?: string | null;
  allowed_product_ids?: string[] | string | null;
  products?: { name: string } | null;
};

export type DealSlotForm = {
  slot_label: string;
  item_type: DealItemType;
  product_id: string;
  allowed_product_ids: string[];
  quantity: number;
  size_name: string;
};

export function parseAllowedProductIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function normalizeDealItem(row: RestaurantDealItemRow): RestaurantDealItemRow {
  const type = (row.item_type === "choice" ? "choice" : "fixed") as DealItemType;
  const allowed = parseAllowedProductIds(row.allowed_product_ids);
  return {
    ...row,
    item_type: type,
    allowed_product_ids: allowed,
    slot_label: row.slot_label?.trim() || null,
  };
}

export function dealItemToSlotForm(row: RestaurantDealItemRow): DealSlotForm {
  const n = normalizeDealItem(row);
  const isChoice = n.item_type === "choice";
  return {
    slot_label: n.slot_label || n.products?.name || (isChoice ? "Customer choice" : "Item"),
    item_type: isChoice ? "choice" : "fixed",
    product_id: n.product_id || "",
    allowed_product_ids: isChoice ? parseAllowedProductIds(n.allowed_product_ids) : n.product_id ? [n.product_id] : [],
    quantity: Number(n.quantity) || 1,
    size_name: n.size_name || "Standard",
  };
}

export function slotLabelDisplay(item: RestaurantDealItemRow): string {
  const n = normalizeDealItem(item);
  if (n.slot_label) return n.slot_label;
  if (n.products?.name) return n.products.name;
  if (n.item_type === "choice" && n.size_name) return `Choice (${n.size_name})`;
  return "Deal item";
}

export function dealIsPosReady(deal: RestaurantDeal): boolean {
  const items = (deal.restaurant_deal_items || []).map(normalizeDealItem);
  if (items.length === 0) return false;
  return items.every((it) => {
    if (it.item_type === "choice") {
      return parseAllowedProductIds(it.allowed_product_ids).length > 0;
    }
    return Boolean(it.product_id);
  });
}

export type DealSlotChoice = {
  productId: string;
  productName: string;
  sizeName?: string;
};

/** Stable key per deal line - id from DB, else index (saved in deal meta). */
export function dealSlotKey(slot: RestaurantDealItemRow, index: number): string {
  const id = (slot.id || "").trim();
  return id || `slot-${index}`;
}

export function resolveDealSlotChoice(
  choices: Record<string, DealSlotChoice>,
  slot: RestaurantDealItemRow,
  index: number
): DealSlotChoice | undefined {
  const primary = dealSlotKey(slot, index);
  if (choices[primary]) return choices[primary];
  const legacy = (slot.id || "").trim();
  return legacy ? choices[legacy] : undefined;
}

/** Machine-readable payload stored on invoice_items.packing_name for stock + COGS at settle. */
export function buildDealStockMeta(
  deal: RestaurantDeal,
  choices: Record<string, DealSlotChoice>
): string {
  const parts: string[] = [
    `DEAL_ID:${deal.id}`,
    `DEAL_NAME:${encodeURIComponent(deal.name || "Deal")}`,
  ];
  const choiceTokens: string[] = [];
  for (const [slotId, c] of Object.entries(choices)) {
    choiceTokens.push(
      `${slotId}=${c.productId}:${encodeURIComponent(c.sizeName || "")}:${encodeURIComponent(c.productName)}`
    );
  }
  if (choiceTokens.length) parts.push(`CHOICES:${choiceTokens.join(";")}`);
  return parts.join("|");
}

export function isDealInvoicePacking(packingName?: string | null): boolean {
  return (packingName || "").includes("DEAL_ID:");
}

/** Human-readable slot picks for receipts / reports (deal name stays the main title). */
export function buildDealReceiptIncludes(packingName?: string | null): string | null {
  const meta = parseDealStockMeta(packingName);
  if (!meta) return null;
  const parts = Object.values(meta.choices)
    .map((c) => {
      const size = c.sizeName?.trim();
      return size ? `${c.productName} (${size})` : c.productName;
    })
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export type RestaurantReceiptItemLabels = {
  /** Main line - deal name or dish name (never raw DEAL_ID meta). */
  title: string;
  /** Secondary line - chosen deal slots, comma-separated. */
  detail: string | null;
};

export function restaurantReceiptItemLabels(
  productName: string,
  packingName?: string | null,
  customName?: string | null,
  dealNameById?: Record<string, string>
): RestaurantReceiptItemLabels {
  const productBase = (productName || "Item").replace(/^\s*🎯\s*/, "").trim();
  const customBase = customName?.replace(/^\s*🎯\s*/, "").trim() || "";
  if (isDealInvoicePacking(packingName)) {
    const meta = parseDealStockMeta(packingName);
    const dealTitle =
      meta?.dealName?.trim() ||
      (meta?.dealId && dealNameById?.[meta.dealId]?.trim()) ||
      customBase ||
      "Deal";
    return {
      title: dealTitle,
      detail: buildDealReceiptIncludes(packingName),
    };
  }
  const base = customBase || productBase;
  const pack = (packingName || "").trim();
  if (pack) {
    const title =
      base.toLowerCase().includes(pack.toLowerCase()) ? base : `${base} (${pack})`;
    return { title, detail: null };
  }
  return { title: base || "Item", detail: null };
}

export function invoiceItemDisplayName(
  productName: string,
  packingName?: string | null
): string {
  return restaurantReceiptItemLabels(productName, packingName).title;
}

export function parseDealStockMeta(
  raw: string | null | undefined
): { dealId: string; dealName?: string; choices: Record<string, DealSlotChoice> } | null {
  const s = (raw || "").trim();
  if (!s.includes("DEAL_ID:")) return null;
  const dealId = s.match(/DEAL_ID:([^|]+)/)?.[1]?.trim();
  if (!dealId) return null;
  const dealNameRaw = s.match(/DEAL_NAME:([^|]*)/)?.[1];
  const dealName = dealNameRaw ? decodeURIComponent(dealNameRaw).trim() : undefined;
  const choices: Record<string, DealSlotChoice> = {};
  const choicesPart = s.match(/CHOICES:([^|]*)/)?.[1];
  if (choicesPart) {
    for (const token of choicesPart.split(";").filter(Boolean)) {
      const eq = token.indexOf("=");
      if (eq <= 0) continue;
      const slotId = token.slice(0, eq);
      const rest = token.slice(eq + 1);
      const segments = rest.split(":");
      const productId = segments[0];
      if (!productId) continue;
      if (segments.length >= 3) {
        choices[slotId] = {
          productId,
          sizeName: decodeURIComponent(segments[1] || "") || undefined,
          productName: decodeURIComponent(segments.slice(2).join(":")),
        };
      } else if (segments.length === 2) {
        choices[slotId] = {
          productId,
          productName: decodeURIComponent(segments[1] || ""),
        };
      }
    }
  }
  return { dealId, dealName, choices };
}

export function buildDealKitchenRemarks(
  deal: RestaurantDeal,
  choices: Record<string, DealSlotChoice>
): string {
  return (deal.restaurant_deal_items || [])
    .map((it, idx) => {
      const n = normalizeDealItem(it);
      const label = slotLabelDisplay(n);
      const chosen = resolveDealSlotChoice(choices, n, idx);
      if (chosen) {
        return `${Number(n.quantity)}x ${chosen.productName}${chosen.sizeName ? ` (${chosen.sizeName})` : ""}`;
      }
      if (n.item_type === "fixed" && n.products?.name) {
        return `${Number(n.quantity)}x ${n.products.name}${n.size_name ? ` (${n.size_name})` : ""}`;
      }
      return `${Number(n.quantity)}x ${label}`;
    })
    .join(", ");
}

export function buildDealCartRemarks(
  deal: RestaurantDeal,
  choices: Record<string, DealSlotChoice>
): string {
  return `${buildDealStockMeta(deal, choices)}|${buildDealKitchenRemarks(deal, choices)}`;
}

export type MenuSizeRow = { product_id: string; size_name: string; is_available?: boolean };

export type ProductSizeMap = Record<string, string[]>;

export function sizesForProduct(
  productId: string,
  byProduct: ProductSizeMap
): string[] {
  const list = byProduct[productId];
  if (list?.length) return [...list];
  return ["Standard"];
}

/** Size names usable for a deal slot - each option shows how many allowed items have that size. */
export function sizeOptionsForAllowedProducts(
  allowedIds: string[],
  byProduct: ProductSizeMap
): { value: string; label: string; allHave: boolean; count: number }[] {
  if (allowedIds.length === 0) {
    return [{ value: "Standard", label: "Standard - add items first", allHave: true, count: 0 }];
  }
  const counts = new Map<string, number>();
  for (const id of allowedIds) {
    for (const s of sizesForProduct(id, byProduct)) {
      counts.set(s, (counts.get(s) || 0) + 1);
    }
  }
  const n = allowedIds.length;
  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([size, count]) => ({
      value: size,
      label: count === n ? size : `${size} (${count}/${n} items have this size)`,
      allHave: count === n,
      count,
    }));
}

export function sizeOptionsForFixedProduct(
  productId: string,
  byProduct: ProductSizeMap
): { value: string; label: string }[] {
  return sizesForProduct(productId, byProduct).map((s) => ({
    value: s,
    label: s,
  }));
}

/** True when dish has this exact menu size (Strict - no cross-size mixing in one combo). */
export function productMatchesDealSize(
  productId: string,
  lockedSize: string,
  byProduct: ProductSizeMap
): boolean {
  const lock = (lockedSize || "Standard").trim();
  const sizes = byProduct[productId];
  if (!sizes?.length) {
    return lock === "Standard";
  }
  return sizes.includes(lock);
}

export function filterProductIdsForDealSize(
  ids: string[],
  lockedSize: string,
  byProduct: ProductSizeMap
): string[] {
  return ids.filter((id) => productMatchesDealSize(id, lockedSize, byProduct));
}

/** Size dropdown for slot 0 only (from first slot's product context). */
export function sizeOptionsForFirstSlot(
  slot: DealSlotForm,
  byProduct: ProductSizeMap
): { value: string; label: string }[] {
  if (slot.item_type === "fixed" && slot.product_id) {
    return sizeOptionsForFixedProduct(slot.product_id, byProduct);
  }
  if (slot.item_type === "choice" && slot.allowed_product_ids.length > 0) {
    return sizeOptionsForAllowedProducts(slot.allowed_product_ids, byProduct).map((o) => ({
      value: o.value,
      label: o.label,
    }));
  }
  return [{ value: "Standard", label: "Standard" }];
}

/** @deprecated Each deal slot keeps its own size_name; do not force slot 1 size onto other slots. */
export function applyDealComboSizeLock(
  items: DealSlotForm[],
  lockedSize: string,
  byProduct: ProductSizeMap
): DealSlotForm[] {
  const lock = (lockedSize || "Standard").trim();
  return items.map((slot, idx) => {
    const next: DealSlotForm = { ...slot, size_name: lock };
    if (idx === 0) return next;
    if (next.item_type === "choice") {
      next.allowed_product_ids = filterProductIdsForDealSize(
        next.allowed_product_ids,
        lock,
        byProduct
      );
    } else if (
      next.product_id &&
      !productMatchesDealSize(next.product_id, lock, byProduct)
    ) {
      next.product_id = "";
    }
    return next;
  });
}

/** Products allowed for a choice slot (optional size filter). */
export function resolveSlotProductOptions(
  allowedIds: string[],
  products: { id: string; name: string }[],
  menuSizes: MenuSizeRow[],
  sizeName?: string | null
): { id: string; name: string }[] {
  const set = new Set(allowedIds);
  let list = products.filter((p) => set.has(p.id));
  const sz = (sizeName || "").trim();
  if (sz && sz !== "Standard") {
    const withSize = new Set(
      menuSizes
        .filter((s) => s.is_available !== false && s.size_name === sz)
        .map((s) => s.product_id)
    );
    list = list.filter((p) => withSize.has(p.id));
  }
  return list;
}
