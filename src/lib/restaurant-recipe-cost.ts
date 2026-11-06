import type { SupabaseClient } from "@supabase/supabase-js";

/** Mirrors POSRESTURANT `is_base_size_label` / Standard recipe rows. */
export function isBaseSizeLabel(sizeName: string | null | undefined): boolean {
  const s = (sizeName || "").trim().toLowerCase();
  return !s || s === "standard" || s === "std" || s === "deal package" || s === "deal";
}

export type ProductRecipeRow = {
  ingredient_product_id: string;
  quantity: number;
  menu_size_id?: string | null;
};

export type RestaurantCartCostLine = {
  productId: string;
  quantity: number;
  menuSizeId?: string | null;
  menuSizeName?: string | null;
};

export type InvoiceLineForCost = {
  product_id: string;
  quantity: number;
  menu_size_id?: string | null;
  menu_size_name?: string | null;
  packing_name?: string | null;
};

function sizeNameFromLine(line: InvoiceLineForCost): string | null {
  return line.menu_size_name || line.packing_name || null;
}

/** Pick recipe rows for a line (size-specific first, then base / NULL menu_size_id). */
export function pickRecipeRowsForSize(
  allRows: ProductRecipeRow[],
  menuSizeId: string | null | undefined,
  menuSizeName: string | null | undefined
): ProductRecipeRow[] {
  if (!allRows.length) return [];

  if (menuSizeId) {
    const sized = allRows.filter((r) => r.menu_size_id === menuSizeId);
    if (sized.length) return sized;
  }

  if (!isBaseSizeLabel(menuSizeName)) {
    const nameKey = (menuSizeName || "").trim().toLowerCase();
    if (nameKey) {
      // Name-only fallback when menu_size_id was not persisted on the line
      const byName = allRows.filter(
        (r) => r.menu_size_id && String(r.menu_size_id).toLowerCase() === nameKey
      );
      if (byName.length) return byName;
    }
  }

  return allRows.filter((r) => !r.menu_size_id);
}

export function lineIngredientCostPerUnit(
  recipeRows: ProductRecipeRow[],
  ingredientPrices: Record<string, number>
): number {
  let cost = 0;
  for (const row of recipeRows) {
    const qty = Number(row.quantity) || 0;
    if (qty <= 0) continue;
    const price = Number(ingredientPrices[row.ingredient_product_id] || 0);
    cost += qty * price;
  }
  return cost;
}

export async function loadIngredientPurchasePrices(
  supabase: SupabaseClient,
  ingredientIds: string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(ingredientIds.filter(Boolean))];
  if (!unique.length) return {};

  const { data } = await supabase
    .from("products")
    .select("id, purchase_price_single")
    .in("id", unique);

  const map: Record<string, number> = {};
  for (const row of data || []) {
    map[row.id] = Number(row.purchase_price_single || 0);
  }
  return map;
}

async function fetchRecipesForProducts(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<Record<string, ProductRecipeRow[]>> {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from("product_recipes")
    .select("parent_product_id, ingredient_product_id, quantity, menu_size_id")
    .in("parent_product_id", ids);

  let list: any[] = data || [];
  if (error) {
    const fb = await supabase
      .from("product_recipes")
      .select("parent_product_id, ingredient_product_id, quantity")
      .in("parent_product_id", ids);
    list = (fb.data || []).map((r) => ({ ...r, menu_size_id: null }));
  }

  const byParent: Record<string, ProductRecipeRow[]> = {};
  for (const r of list) {
    const pid = r.parent_product_id as string;
    if (!byParent[pid]) byParent[pid] = [];
    byParent[pid].push({
      ingredient_product_id: r.ingredient_product_id,
      quantity: Number(r.quantity),
      menu_size_id: r.menu_size_id ?? null,
    });
  }
  return byParent;
}

export async function computeCartIngredientCost(
  supabase: SupabaseClient,
  lines: RestaurantCartCostLine[]
): Promise<number> {
  if (!lines.length) return 0;

  const productIds = lines.map((l) => l.productId);
  const recipesByProduct = await fetchRecipesForProducts(supabase, productIds);

  const ingredientIds = Object.values(recipesByProduct)
    .flat()
    .map((r) => r.ingredient_product_id);
  const prices = await loadIngredientPurchasePrices(supabase, ingredientIds);

  let total = 0;
  for (const line of lines) {
    const all = recipesByProduct[line.productId] || [];
    const picked = pickRecipeRowsForSize(all, line.menuSizeId, line.menuSizeName);
    const perUnit = lineIngredientCostPerUnit(picked, prices);
    if (picked.length) {
      total += perUnit * line.quantity;
    } else {
      const { data: prod } = await supabase
        .from("products")
        .select("purchase_price_single")
        .eq("id", line.productId)
        .maybeSingle();
      total += Number(prod?.purchase_price_single || 0) * line.quantity;
    }
  }
  return total;
}

export async function computeInvoiceIngredientCost(
  supabase: SupabaseClient,
  lines: InvoiceLineForCost[]
): Promise<number> {
  if (!lines.length) return 0;

  const productIds = lines.map((l) => l.product_id);
  const recipesByProduct = await fetchRecipesForProducts(supabase, productIds);

  const ingredientIds = Object.values(recipesByProduct)
    .flat()
    .map((r) => r.ingredient_product_id);
  const prices = await loadIngredientPurchasePrices(supabase, ingredientIds);

  let total = 0;
  for (const line of lines) {
    const all = recipesByProduct[line.product_id] || [];
    const sizeName = sizeNameFromLine(line);
    const picked = pickRecipeRowsForSize(all, line.menu_size_id, sizeName);
    const perUnit = lineIngredientCostPerUnit(picked, prices);
    if (picked.length) {
      total += perUnit * line.quantity;
    } else {
      const { data: prod } = await supabase
        .from("products")
        .select("purchase_price_single")
        .eq("id", line.product_id)
        .maybeSingle();
      total += Number(prod?.purchase_price_single || 0) * line.quantity;
    }
  }
  return total;
}

export type StockRequirement = { ingredient_product_id: string; quantity: number };

export async function buildStockRequirementsForLine(
  supabase: SupabaseClient,
  productId: string,
  quantity: number,
  menuSizeId?: string | null,
  menuSizeName?: string | null
): Promise<StockRequirement[]> {
  const recipesByProduct = await fetchRecipesForProducts(supabase, [productId]);
  const all = recipesByProduct[productId] || [];
  const picked = pickRecipeRowsForSize(all, menuSizeId, menuSizeName);

  if (picked.length) {
    return picked.map((r) => ({
      ingredient_product_id: r.ingredient_product_id,
      quantity: Number(r.quantity) * quantity,
    }));
  }

  return [{ ingredient_product_id: productId, quantity }];
}

async function applyStockDeltaForInvoiceLines(
  supabase: SupabaseClient,
  lines: InvoiceLineForCost[],
  direction: "deduct" | "restore"
): Promise<void> {
  const rpc = direction === "deduct" ? "decrement_product_stock" : "increment_product_stock";
  for (const line of lines) {
    const reqs = await buildStockRequirementsForLine(
      supabase,
      line.product_id,
      line.quantity,
      line.menu_size_id,
      sizeNameFromLine(line)
    );
    for (const req of reqs) {
      await supabase.rpc(rpc, {
        p_id: req.ingredient_product_id,
        qty: req.quantity,
      });
    }
  }
}

export async function deductStockForInvoiceLines(
  supabase: SupabaseClient,
  lines: InvoiceLineForCost[]
): Promise<void> {
  await applyStockDeltaForInvoiceLines(supabase, lines, "deduct");
}

/** Restore BOM ingredients after a pending (not-started) cancel. */
export async function restoreStockForInvoiceLines(
  supabase: SupabaseClient,
  lines: InvoiceLineForCost[]
): Promise<void> {
  await applyStockDeltaForInvoiceLines(supabase, lines, "restore");
}
