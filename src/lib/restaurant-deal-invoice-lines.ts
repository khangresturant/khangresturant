import type { SupabaseClient } from "@supabase/supabase-js";
import type { RestaurantDeal } from "@/lib/restaurant-deals";
import { parseDealStockMeta, restaurantReceiptItemLabels } from "@/lib/restaurant-deal-slots";
import { buildDealCostLines, type MenuSizePriceRow } from "@/lib/restaurant-deal-cost-lines";
import type { InvoiceLineForCost } from "@/lib/restaurant-recipe-cost";

/**
 * Expands deal invoice rows into per-dish lines for recipe stock (settle / restore / COGS).
 * Non-deal lines pass through unchanged.
 */
export async function expandInvoiceLinesForRestaurantStock(
  supabase: SupabaseClient,
  lines: InvoiceLineForCost[]
): Promise<InvoiceLineForCost[]> {
  if (!lines.length) return lines;

  const dealIds = new Set<string>();
  for (const line of lines) {
    const meta = parseDealStockMeta(line.packing_name);
    if (meta) dealIds.add(meta.dealId);
  }
  if (!dealIds.size) return lines;

  const { data: dealRows, error: dealErr } = await supabase
    .from("restaurant_deals")
    .select("*, restaurant_deal_items ( * )")
    .in("id", [...dealIds]);
  if (dealErr) throw dealErr;

  const dealsById = new Map<string, RestaurantDeal>();
  for (const row of dealRows || []) {
    dealsById.set(row.id, row as RestaurantDeal);
  }

  const { data: sizeRows } = await supabase
    .from("restaurant_menu_sizes")
    .select("id, product_id, size_name, price, is_available");
  const menuSizes: MenuSizePriceRow[] = (sizeRows || [])
    .filter((s: any) => s.is_available !== false)
    .map((s: any) => ({
      id: s.id,
      product_id: s.product_id,
      size_name: s.size_name,
      price: Number(s.price) || 0,
    }));

  const out: InvoiceLineForCost[] = [];
  for (const line of lines) {
    const meta = parseDealStockMeta(line.packing_name);
    if (!meta) {
      out.push(line);
      continue;
    }
    const deal = dealsById.get(meta.dealId);
    if (!deal) {
      out.push(line);
      continue;
    }
    const orderQty = Number(line.quantity) || 1;
    const costLines = buildDealCostLines(deal, meta.choices, menuSizes);
    if (!costLines.length) {
      out.push(line);
      continue;
    }
    for (const cl of costLines) {
      out.push({
        product_id: cl.productId,
        quantity: cl.quantity * orderQty,
        menu_size_id: cl.menuSizeId ?? null,
        menu_size_name: cl.menuSizeName ?? null,
        packing_name: cl.menuSizeName ?? null,
      });
    }
  }
  return out;
}

/** Rebuild deal COGS lines from saved invoice packing_name (DEAL_ID meta). */
export async function dealCostLinesFromInvoiceMeta(
  supabase: SupabaseClient,
  dealMeta: string
): Promise<import("@/lib/restaurant-recipe-cost").RestaurantCartCostLine[]> {
  const meta = parseDealStockMeta(dealMeta);
  if (!meta) return [];

  const { data: deal, error } = await supabase
    .from("restaurant_deals")
    .select("*, restaurant_deal_items ( * )")
    .eq("id", meta.dealId)
    .maybeSingle();
  if (error || !deal) return [];

  const { data: sizeRows } = await supabase
    .from("restaurant_menu_sizes")
    .select("id, product_id, size_name, price, is_available");
  const menuSizes: MenuSizePriceRow[] = (sizeRows || [])
    .filter((s: any) => s.is_available !== false)
    .map((s: any) => ({
      id: s.id,
      product_id: s.product_id,
      size_name: s.size_name,
      price: Number(s.price) || 0,
    }));

  return buildDealCostLines(deal as RestaurantDeal, meta.choices, menuSizes);
}

/** Deal display title for receipts when only packing_name + product anchor exist on invoice line. */
export async function resolveDealTitleFromPacking(
  supabase: SupabaseClient,
  packingName: string,
  customName?: string | null
): Promise<string> {
  const quick = restaurantReceiptItemLabels("Deal", packingName, customName);
  if (quick.title !== "Deal") return quick.title;
  const meta = parseDealStockMeta(packingName);
  if (!meta?.dealId) return customName?.replace(/^\s*🎯\s*/, "").trim() || "Deal";
  const { data } = await supabase
    .from("restaurant_deals")
    .select("name")
    .eq("id", meta.dealId)
    .maybeSingle();
  return (
    (data?.name || customName || "Deal").replace(/^\s*🎯\s*/, "").trim() || "Deal"
  );
}
