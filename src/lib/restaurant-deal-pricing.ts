import type { SupabaseClient } from "@supabase/supabase-js";
import type { RestaurantDeal } from "@/lib/restaurant-deals";
import { type DealSlotChoice, type DealSlotForm } from "@/lib/restaurant-deal-slots";
import {
  computeCartIngredientCost,
  type RestaurantCartCostLine,
} from "@/lib/restaurant-recipe-cost";
import {
  buildDealCostLines,
  type MenuSizePriceRow,
} from "@/lib/restaurant-deal-cost-lines";

export type { MenuSizePriceRow } from "@/lib/restaurant-deal-cost-lines";
export { buildDealCostLines } from "@/lib/restaurant-deal-cost-lines";

type ProductPriceRow = { id: string; sale_price_single?: number };

/** Sell price for one dish at a menu size (falls back to base price). */
export function salePriceForProductSize(
  productId: string,
  sizeName: string | null | undefined,
  products: ProductPriceRow[],
  menuSizes: MenuSizePriceRow[]
): number {
  const sz = (sizeName || "").trim();
  if (sz && sz !== "Standard") {
    const row = menuSizes.find(
      (r) => r.product_id === productId && r.size_name === sz
    );
    if (row) return Number(row.price) || 0;
  }
  const p = products.find((x) => x.id === productId);
  return Number(p?.sale_price_single || 0);
}

/** Reference catalog total for deal setup (choice slots = max price among allowed at that size). */
export function slotReferenceSaleTotal(
  slot: DealSlotForm,
  products: ProductPriceRow[],
  menuSizes: MenuSizePriceRow[]
): number {
  const qty = Number(slot.quantity) || 1;
  if (slot.item_type === "fixed" && slot.product_id) {
    return qty * salePriceForProductSize(slot.product_id, slot.size_name, products, menuSizes);
  }
  if (slot.item_type === "choice" && slot.allowed_product_ids.length > 0) {
    const prices = slot.allowed_product_ids.map((id) =>
      salePriceForProductSize(id, slot.size_name, products, menuSizes)
    );
    return qty * Math.max(0, ...prices);
  }
  return 0;
}

export function computeDealCatalogOriginal(
  items: DealSlotForm[],
  products: ProductPriceRow[],
  menuSizes: MenuSizePriceRow[]
): number {
  return items.reduce((s, it) => s + slotReferenceSaleTotal(it, products, menuSizes), 0);
}

export type { DealSlotChoice } from "@/lib/restaurant-deal-slots";

export async function computeDealIngredientCost(
  supabase: SupabaseClient,
  deal: RestaurantDeal,
  choices: Record<string, DealSlotChoice>,
  menuSizes: MenuSizePriceRow[]
): Promise<{ total: number; lines: RestaurantCartCostLine[] }> {
  const lines = buildDealCostLines(deal, choices, menuSizes);
  const total = lines.length ? await computeCartIngredientCost(supabase, lines) : 0;
  return { total, lines };
}
