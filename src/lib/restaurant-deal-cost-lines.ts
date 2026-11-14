import type { RestaurantDeal } from "@/lib/restaurant-deals";
import {
  normalizeDealItem,
  resolveDealSlotChoice,
  type DealSlotChoice,
  type RestaurantDealItemRow,
} from "@/lib/restaurant-deal-slots";
import type { RestaurantCartCostLine } from "@/lib/restaurant-recipe-cost";

export type MenuSizePriceRow = {
  id: string;
  product_id: string;
  size_name: string;
  price: number;
  is_available?: boolean;
};

export function menuSizeIdForProduct(
  productId: string,
  sizeName: string | null | undefined,
  menuSizes: MenuSizePriceRow[]
): string | null {
  const sz = (sizeName || "").trim();
  if (!sz || sz === "Standard") return null;
  return menuSizes.find((r) => r.product_id === productId && r.size_name === sz)?.id ?? null;
}

/** COGS lines for each resolved slot (recipe uses menu_size_id when set). */
export function buildDealCostLines(
  deal: RestaurantDeal,
  choices: Record<string, DealSlotChoice>,
  menuSizes: MenuSizePriceRow[]
): RestaurantCartCostLine[] {
  const lines: RestaurantCartCostLine[] = [];
  const items = deal.restaurant_deal_items || [];
  for (let idx = 0; idx < items.length; idx++) {
    const slot = normalizeDealItem(items[idx] as RestaurantDealItemRow);
    const qty = Number(slot.quantity) || 1;
    let productId: string | undefined;
    let sizeName = slot.size_name || undefined;

    if (slot.item_type === "choice") {
      const picked = resolveDealSlotChoice(choices, slot, idx);
      if (!picked?.productId) continue;
      productId = picked.productId;
      sizeName = picked.sizeName || sizeName;
    } else if (slot.product_id) {
      productId = slot.product_id;
    }
    if (!productId) continue;

    const menuSizeId = menuSizeIdForProduct(productId, sizeName, menuSizes);
    lines.push({
      productId,
      quantity: qty,
      menuSizeId,
      menuSizeName: sizeName || null,
    });
  }
  return lines;
}
