import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildDealReceiptIncludes,
  restaurantReceiptItemLabels,
} from "@/lib/restaurant-deal-slots";
import type { RestaurantKOTLine } from "@/lib/restaurant-receipt-print";

export function restaurantBillLineKey(parts: {
  product_id?: string;
  packing_name?: string | null;
}): string {
  return `${parts.product_id || "?"}::${parts.packing_name || ""}`;
}

export function restaurantCartBillLineKey(c: {
  productId: string;
  isDeal?: boolean;
  dealMeta?: string | null;
  sizeLabel?: string | null;
}): string {
  const pack = c.isDeal ? c.dealMeta || "" : c.sizeLabel || "";
  return `${c.productId}::${pack}`;
}

export type KitchenKotLineOpts = {
  dealTitleById?: Record<string, string>;
  category_id?: string | null;
};

/** Same item name / size / notes as POS cart + guest bill. */
export function cartItemToKitchenKotLine(
  item: {
    productId: string;
    name: string;
    sizeLabel?: string | null;
    isDeal?: boolean;
    dealMeta?: string | null;
    remarks?: string;
  },
  printQuantity: number,
  opts?: KitchenKotLineOpts
): RestaurantKOTLine & { product_id: string; category_id?: string | null } {
  const labels = restaurantReceiptItemLabels(
    item.name,
    item.dealMeta || item.sizeLabel || null,
    null,
    opts?.dealTitleById
  );
  const kitchenNote = item.isDeal
    ? item.remarks?.trim() || labels.detail || ""
    : item.remarks?.trim() || "";
  return {
    product_id: item.productId,
    category_id: opts?.category_id ?? null,
    name: item.isDeal ? labels.title : item.name,
    quantity: printQuantity,
    remarks: kitchenNote,
    sizeLabel: item.isDeal ? null : item.sizeLabel || null,
  };
}

export function invoiceDbItemToKitchenKotLine(
  row: {
    product_id?: string;
    quantity: number;
    packing_name?: string | null;
    custom_name?: string | null;
    products?: { name: string } | null;
  },
  printQuantity: number,
  opts?: KitchenKotLineOpts
): RestaurantKOTLine & { product_id: string; category_id?: string | null } {
  const baseName = row.products?.name || "Item";
  const dealMeta =
    typeof row.packing_name === "string" && row.packing_name.includes("DEAL_ID:")
      ? row.packing_name
      : undefined;
  if (dealMeta) {
    const labels = restaurantReceiptItemLabels(
      baseName,
      dealMeta,
      row.custom_name,
      opts?.dealTitleById
    );
    const includes = buildDealReceiptIncludes(dealMeta);
    return cartItemToKitchenKotLine(
      {
        productId: row.product_id || "",
        name: `🎯 ${labels.title}`,
        isDeal: true,
        dealMeta,
        remarks: includes || "",
      },
      printQuantity,
      opts
    );
  }
  const displayName = row.packing_name
    ? `${baseName} (${row.packing_name})`
    : baseName;
  return cartItemToKitchenKotLine(
    {
      productId: row.product_id || "",
      name: displayName,
      sizeLabel: row.packing_name || undefined,
      isDeal: false,
    },
    printQuantity,
    opts
  );
}

export type InvoiceItemKitchenRow = {
  product_id?: string;
  quantity: number;
  unit_price?: number;
  packing_name?: string | null;
  custom_name?: string | null;
  menu_size_id?: string | null;
  products?: { name: string; category_id?: string | null } | null;
};

/** Match guest bill lines — full qty, size in name/column. */
export function invoiceItemsToKitchenKotLines(
  rows: InvoiceItemKitchenRow[],
  opts?: KitchenKotLineOpts & { productCategoryById?: Map<string, string> }
): (RestaurantKOTLine & { product_id: string; category_id?: string | null })[] {
  return rows.map((row) => {
    const pid = row.product_id || "";
    const category_id =
      opts?.productCategoryById?.get(pid) ??
      row.products?.category_id ??
      null;
    return invoiceDbItemToKitchenKotLine(row, Number(row.quantity) || 0, {
      ...opts,
      category_id,
    });
  });
}

export async function fetchInvoiceKitchenKotLines(
  supabase: SupabaseClient,
  invoiceId: string,
  opts?: KitchenKotLineOpts
): Promise<(RestaurantKOTLine & { product_id: string; category_id?: string | null })[]> {
  const { data: rows, error } = await supabase
    .from("invoice_items")
    .select(
      `
      product_id,
      quantity,
      unit_price,
      packing_name,
      custom_name,
      menu_size_id,
      products ( name, category_id )
    `
    )
    .eq("invoice_id", invoiceId);
  if (error || !rows?.length) return [];
  const productCategoryById = new Map<string, string>();
  for (const row of rows) {
    const pid = row.product_id;
    const cid = (row.products as { category_id?: string } | null)?.category_id;
    if (pid && cid) productCategoryById.set(pid, cid);
  }
  return invoiceItemsToKitchenKotLines(rows as InvoiceItemKitchenRow[], {
    ...opts,
    productCategoryById,
  });
}