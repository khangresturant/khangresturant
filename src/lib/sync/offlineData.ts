/**
 * Full-system offline helpers — extends POS IndexedDB + sync queue to all dashboard modules.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  saveShopSnapshot,
  loadShopSnapshot,
  pushToSyncQueue,
  putOfflineData,
  type SyncAction,
  type ShopSnapshot,
} from "@/utils/syncQueue";
import { isBrowserOffline, isNetworkError } from "@/lib/sync/offlineCheckout";

export { isBrowserOffline, isNetworkError, loadShopSnapshot, type ShopSnapshot };

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 min background refresh when online

/** Fetch all essential shop tables from Supabase and persist to IndexedDB. */
export async function syncShopDataOnline(
  supabase: SupabaseClient,
  shopId: string
): Promise<{ savedAt: string }> {
  const pageSize = 1000;

  const productSelectFull = `
    id, name, code, unit, sale_price_single, purchase_price_single, current_stock,
    min_stock_level, category_id, brand_id, shelf_location, note, image_url,
    pack_size, purchase_price_pack, sale_price_pack, measurement_type, warranty,
    has_imei, is_ingredient, translated_names, shop_id, created_at,
    categories ( name ), brands ( name ), formulations ( name ),
    product_barcodes ( barcode ),
    product_variants (
      id, packing_name, sale_price, purchase_price, stock_quantity, is_packing, pack_size,
      product_barcodes ( barcode )
    )
  `;

  const productSelectBase = `
    id, name, code, unit, sale_price_single, purchase_price_single, current_stock,
    min_stock_level, category_id, brand_id, shelf_location, note, image_url,
    pack_size, purchase_price_pack, sale_price_pack, measurement_type, warranty,
    has_imei, translated_names, shop_id, created_at,
    categories ( name ), brands ( name ), formulations ( name ),
    product_barcodes ( barcode ),
    product_variants (
      id, packing_name, sale_price, purchase_price, stock_quantity, is_packing, pack_size,
      product_barcodes ( barcode )
    )
  `;

  async function fetchProductPage(
    selectStr: string,
    pageIndex: number
  ): Promise<{ data: any[] | null; error: { message: string; hint?: string | null } | null }> {
    return supabase
      .from("products")
      .select(selectStr)
      .eq("shop_id", shopId)
      .order("name", { ascending: true })
      .range(pageIndex * pageSize, (pageIndex + 1) * pageSize - 1);
  }

  // Products (paginated) — retry with reduced columns when optional fields are missing in DB
  const products: any[] = [];
  let page = 0;
  let hasMore = true;
  let productSelect = productSelectFull;
  while (hasMore) {
    let { data, error } = await fetchProductPage(productSelect, page);

    if (error) {
      const msg = error.message || "";
      const hint = error.hint || "";
      const missingOptionalColumn =
        msg.includes("is_ingredient") ||
        hint.includes("is_ingredient") ||
        msg.includes("translated_names") ||
        hint.includes("translated_names");

      if (missingOptionalColumn && productSelect === productSelectFull) {
        productSelect = productSelectBase;
        ({ data, error } = await fetchProductPage(productSelect, page));
      }

      if (error) throw error;

      products.push(
        ...(data || []).map((p) => ({
          ...p,
          is_ingredient: p.is_ingredient ?? false,
        }))
      );
    } else {
      products.push(...(data || []));
    }

    hasMore = (data || []).length === pageSize;
    page++;
  }

  const [
    partiesRes,
    cashRes,
    categoriesRes,
    unitsRes,
    invoicesRes,
    creditRes,
    purchaseRes,
    vehiclesRes,
    shPartiesRes,
    installmentsRes,
    schedulesRes,
    salesRes,
    investorsRes,
    investorTxRes,
    rentalsRes,
    expensesRes,
  ] = await Promise.all([
    supabase
      .from("parties")
      .select(
        "id, name, phone, type, current_balance, created_at, cnic_number, father_name, address, note, credit_limit, shop_id"
      )
      .eq("shop_id", shopId)
      .eq("is_deleted", false)
      .order("name"),
    supabase
      .from("cash_accounts")
      .select("id, name, current_balance, shop_id")
      .eq("shop_id", shopId)
      .order("name"),
    supabase.from("categories").select("id, name, shop_id").eq("shop_id", shopId).order("name"),
    supabase.from("units").select("id, name, code, shop_id").eq("shop_id", shopId).order("name"),
    supabase
      .from("invoices")
      .select(`
        id, created_at, total_amount, tax_amount, discount, status, paid_amount,
        is_edited, is_voided, party_id, edit_history, remarks, payment_mode, shop_id,
        parties ( name, phone )
      `)
      .eq("shop_id", shopId)
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("credit_transactions")
      .select("id, customer_id, amount, transaction_type, remarks, created_at, shop_id")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("purchase_orders")
      .select(
        "id, created_at, total_amount, paid_amount, discount, tax_amount, status, payment_mode, notes, invoice_number, is_voided, supplier_id, shop_id"
      )
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(200),
    // Showroom Online Snapshot Fetchers
    supabase
      .from("showroom_vehicles")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false }),
    supabase
      .from("showroom_parties")
      .select("*")
      .eq("shop_id", shopId)
      .order("name", { ascending: true }),
    supabase
      .from("showroom_installments")
      .select(`
        *,
        showroom_vehicles ( id, make, model, year, plate_number, is_applied_for, color, price, chassis_number, engine_number, photos )
      `)
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false }),
    supabase
      .from("showroom_installment_schedules")
      .select("*")
      .eq("shop_id", shopId)
      .order("installment_no", { ascending: true }),
    supabase
      .from("showroom_sales")
      .select("*")
      .eq("shop_id", shopId)
      .order("sale_date", { ascending: false }),
    supabase
      .from("showroom_investors")
      .select("*")
      .eq("shop_id", shopId)
      .order("name", { ascending: true }),
    supabase
      .from("showroom_investor_transactions")
      .select("*")
      .eq("shop_id", shopId)
      .order("date", { ascending: false }),
    supabase
      .from("showroom_rentals")
      .select(`
        *,
        showroom_vehicles ( make, model, plate_number )
      `)
      .eq("shop_id", shopId)
      .order("start_date", { ascending: false }),
    supabase
      .from("showroom_vehicle_expenses")
      .select("*")
      .eq("shop_id", shopId)
      .order("date", { ascending: false }),
  ]);

  if (partiesRes.error) throw partiesRes.error;

  const savedAt = new Date().toISOString();
  await saveShopSnapshot({
    shopId,
    products,
    parties: partiesRes.data || [],
    cashAccounts: cashRes.data || [],
    categories: categoriesRes.data || [],
    units: unitsRes.data || [],
    invoices: invoicesRes.data || [],
    creditTransactions: creditRes.data || [],
    purchaseOrders: purchaseRes.data || [],
    showroomVehicles: vehiclesRes.data || [],
    showroomParties: shPartiesRes.data || [],
    showroomInstallments: installmentsRes.data || [],
    showroomInstallmentSchedules: schedulesRes.data || [],
    showroomSales: salesRes.data || [],
    showroomInvestors: investorsRes.data || [],
    showroomInvestorTransactions: investorTxRes.data || [],
    showroomRentals: rentalsRes.data || [],
    showroomVehicleExpenses: expensesRes.data || [],
  });

  return { savedAt };
}

/** Try online fetch; on offline/network error return cached snapshot slice. */
export async function withOfflineRead<T>(opts: {
  shopId: string;
  online: () => Promise<T>;
  offline: (snap: ShopSnapshot) => T | null;
  onOfflineUsed?: (savedAt: string | null) => void;
}): Promise<T> {
  if (isBrowserOffline()) {
    const snap = await loadShopSnapshot(opts.shopId);
    if (snap) {
      const result = opts.offline(snap);
      if (result != null) {
        opts.onOfflineUsed?.(snap.savedAt);
        return result;
      }
    }
    throw new Error("Offline — no cached data. Connect once while online to download your shop data.");
  }

  try {
    return await opts.online();
  } catch (err) {
    if (isNetworkError(err)) {
      const snap = await loadShopSnapshot(opts.shopId);
      if (snap) {
        const result = opts.offline(snap);
        if (result != null) {
          opts.onOfflineUsed?.(snap.savedAt);
          return result;
        }
      }
    }
    throw err;
  }
}

/** Execute online mutation or queue for sync when offline / network fails. */
export async function executeOrQueue<T>(opts: {
  shopId: string;
  action: SyncAction;
  tableName: string;
  payload: Record<string, unknown>;
  label?: string;
  online: () => Promise<T>;
  onQueued?: () => void;
}): Promise<{ queued: false; result: T } | { queued: true }> {
  if (isBrowserOffline()) {
    await pushToSyncQueue(
      opts.action,
      opts.tableName,
      opts.payload,
      opts.shopId,
      opts.label
    );
    // Optimistic local cache update for reads across all entities
    if (opts.action === "DELETE" && opts.payload.id) {
      const { deleteOfflineData } = await import("@/utils/syncQueue");
      await deleteOfflineData(opts.tableName, String(opts.payload.id)).catch(() => {});
    } else if (opts.payload.id) {
      await putOfflineData(opts.tableName, {
        ...opts.payload,
        shopId: opts.shopId,
        _shop_id: opts.shopId,
      }).catch(() => {});
    }
    opts.onQueued?.();
    return { queued: true };
  }

  try {
    const result = await opts.online();
    return { queued: false, result };
  } catch (err) {
    if (isNetworkError(err)) {
      await pushToSyncQueue(
        opts.action,
        opts.tableName,
        opts.payload,
        opts.shopId,
        opts.label
      );
      if (opts.action === "DELETE" && opts.payload.id) {
        const { deleteOfflineData } = await import("@/utils/syncQueue");
        await deleteOfflineData(opts.tableName, String(opts.payload.id)).catch(() => {});
      } else if (opts.payload.id) {
        await putOfflineData(opts.tableName, {
          ...opts.payload,
          shopId: opts.shopId,
          _shop_id: opts.shopId,
        }).catch(() => {});
      }
      opts.onQueued?.();
      return { queued: true };
    }
    throw err;
  }
}

export { SYNC_INTERVAL_MS };
