import type { SupabaseClient } from "@supabase/supabase-js";
import { expandInvoiceLinesForRestaurantStock } from "@/lib/restaurant-deal-invoice-lines";

/** Money / COGS display (4 dp - recipe floats stay full precision until here). */
export function roundMoney(value: number, decimals = 4): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Ingredient stock qty - keeps recipe fractions (e.g. 0.25 kg) without drift. */
export function roundStockQty(value: number, decimals = 6): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

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

  const baseRows = allRows.filter((r) => !r.menu_size_id);
  const sizedRows = allRows.filter((r) => r.menu_size_id);
  const hasPerSizeRecipes = sizedRows.length > 0;
  const sellingSized =
    Boolean(menuSizeId) || (!isBaseSizeLabel(menuSizeName) && Boolean(menuSizeName?.trim()));

  if (menuSizeId) {
    const match = sizedRows.filter((r) => r.menu_size_id === menuSizeId);
    if (match.length) return match;
    if (hasPerSizeRecipes) return [];
  }

  if (hasPerSizeRecipes && sellingSized) {
    return [];
  }

  if (baseRows.length) return baseRows;

  return allRows;
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

export function invoiceLineCostKey(line: InvoiceLineForCost): string {
  return `${line.product_id}:${line.menu_size_id || ""}:${line.packing_name || ""}`;
}

/** Per-unit COGS for each invoice line at current ingredient prices (snapshot at settle). */
export async function computeLineUnitCogsMap(
  supabase: SupabaseClient,
  lines: InvoiceLineForCost[]
): Promise<Record<string, number>> {
  if (!lines.length) return {};

  const productIds = [...new Set(lines.map((l) => l.product_id).filter(Boolean))];
  const recipesByProduct = await fetchRecipesForProducts(supabase, productIds);
  const ingredientIds = Object.values(recipesByProduct)
    .flat()
    .map((r) => r.ingredient_product_id);
  const prices = await loadIngredientPurchasePrices(supabase, ingredientIds);

  const map: Record<string, number> = {};
  for (const line of lines) {
    const key = invoiceLineCostKey(line);
    const all = recipesByProduct[line.product_id] || [];
    const sizeName = sizeNameFromLine(line);
    const picked = pickRecipeRowsForSize(all, line.menu_size_id, sizeName);
    let unit = lineIngredientCostPerUnit(picked, prices);
    if (!picked.length) {
      const { data: prod } = await supabase
        .from("products")
        .select("purchase_price_single")
        .eq("id", line.product_id)
        .maybeSingle();
      unit = Number(prod?.purchase_price_single || 0);
    }
    map[key] = roundMoney(unit);
  }
  return map;
}

export function isRestaurantInvoiceCostFrozen(invoice: {
  status?: string | null;
  restaurant_order_status?: string | null;
}): boolean {
  if (invoice.restaurant_order_status === "settled") return true;
  const st = (invoice.status || "").toLowerCase();
  return st === "paid" || st === "partial" || st === "unpaid";
}

export async function computeInvoiceIngredientCost(
  supabase: SupabaseClient,
  lines: InvoiceLineForCost[]
): Promise<number> {
  if (!lines.length) return 0;

  const expanded = await expandInvoiceLinesForRestaurantStock(supabase, lines);
  const productIds = expanded.map((l) => l.product_id);
  const recipesByProduct = await fetchRecipesForProducts(supabase, productIds);

  const ingredientIds = Object.values(recipesByProduct)
    .flat()
    .map((r) => r.ingredient_product_id);
  const prices = await loadIngredientPurchasePrices(supabase, ingredientIds);

  let total = 0;
  for (const line of expanded) {
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
  return roundMoney(total);
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
      quantity: roundStockQty(Number(r.quantity) * quantity),
    }));
  }

  return [{ ingredient_product_id: productId, quantity: roundStockQty(quantity) }];
}

async function applyStockDeltaForInvoiceLines(
  supabase: SupabaseClient,
  lines: InvoiceLineForCost[],
  direction: "deduct" | "restore"
): Promise<void> {
  const expanded = await expandInvoiceLinesForRestaurantStock(supabase, lines);
  const rpc = direction === "deduct" ? "decrement_product_stock" : "increment_product_stock";
  for (const line of expanded) {
    const reqs = await buildStockRequirementsForLine(
      supabase,
      line.product_id,
      line.quantity,
      line.menu_size_id,
      sizeNameFromLine(line)
    );
    for (const req of reqs) {
      const qty = roundStockQty(req.quantity);
      if (qty <= 0) continue;
      await supabase.rpc(rpc, {
        p_id: req.ingredient_product_id,
        qty,
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
