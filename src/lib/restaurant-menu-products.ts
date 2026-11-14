import type { SupabaseClient } from "@supabase/supabase-js";

export const MENU_SIZE_SUGGESTIONS = [
  "Small",
  "Medium",
  "Large",
  "XL",
  "Personal",
  "Family",
  "Regular",
  "Standard",
  "Half",
  "Full",
  "Single",
  "Double",
] as const;

/** @deprecated use free-text size + MENU_SIZE_SUGGESTIONS */
export const MENU_SIZE_OPTIONS = ["Small", "Medium", "Large", "XL"] as const;

export type RestaurantMenuProductRow = {
  id: string;
  name: string;
  sale_price_single: number;
  is_ingredient?: boolean | string | null;
  show_in_restaurant_pos?: boolean | null;
};

export type FetchMenuProductsOptions = {
  /** When true, only dishes shown on Restaurant POS (default true). */
  posSaleOnly?: boolean;
};

/**
 * Menu dishes for restaurant (not raw ingredients). Handles missing DB columns on local SQLite.
 */
export async function fetchRestaurantMenuProducts(
  supabase: SupabaseClient,
  shopId: string,
  options: FetchMenuProductsOptions = {}
): Promise<{ products: RestaurantMenuProductRow[]; posSaleOnly: boolean }> {
  const posSaleOnly = options.posSaleOnly !== false;

  let { data, error } = await supabase
    .from("products")
    .select("id, name, sale_price_single, is_ingredient, show_in_restaurant_pos")
    .eq("shop_id", shopId)
    .order("name");

  if (
    error?.message?.includes("is_ingredient") ||
    error?.message?.includes("show_in_restaurant") ||
    error?.hint?.includes("is_ingredient")
  ) {
    const fb = await supabase
      .from("products")
      .select("id, name, sale_price_single")
      .eq("shop_id", shopId)
      .order("name");
    if (fb.error) throw fb.error;
    data = (fb.data || []).map((p) => ({
      ...p,
      is_ingredient: false,
      show_in_restaurant_pos: true,
    }));
  } else if (error) {
    throw error;
  }

  const menu = (data || []).filter(
    (p: RestaurantMenuProductRow) =>
      p.is_ingredient !== true && String(p.is_ingredient) !== "true"
  ) as RestaurantMenuProductRow[];

  if (!posSaleOnly) {
    return { products: menu, posSaleOnly: false };
  }

  const forPos = menu.filter((p) => p.show_in_restaurant_pos !== false);
  if (forPos.length > 0) {
    return { products: forPos, posSaleOnly: true };
  }
  return { products: menu, posSaleOnly: false };
}

export function buildProductNameMap(rows: { id: string; name: string }[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of rows) m[p.id] = p.name;
  return m;
}
