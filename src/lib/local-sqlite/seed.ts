import { readTableRows, tableIsEmpty, writeTableRows } from "@/lib/local-sqlite/database";
import {
  FLAME9_SQLITE_TABLES,
  getFlame9SeedData,
} from "@/lib/local-sqlite/seed-data";

export {
  FLAME9_LOCAL_LOGINS,
  FLAME9_LOCAL_SHOP_ID,
  FLAME9_LOCAL_USER_ID,
  FLAME9_STAFF_USER_ID,
  getFlame9SeedData,
} from "@/lib/local-sqlite/seed-data";

function mergeMissingSeedRows(tableName: string): void {
  const existing = readTableRows(tableName) as Record<string, unknown>[];
  const seed = getFlame9SeedData(tableName) as Record<string, unknown>[];
  if (!seed.length) return;
  const existingIds = new Set(existing.map((r) => String(r.id ?? "")));
  const toAdd = seed.filter((s) => s.id && !existingIds.has(String(s.id)));
  if (toAdd.length) writeTableRows(tableName, [...existing, ...toAdd]);
}

function patchProductsFromSeed(): void {
  const products = readTableRows("products") as Record<string, unknown>[];
  if (!products.length) return;
  const seedProducts = getFlame9SeedData("products") as Record<string, unknown>[];
  const byId = new Map(seedProducts.map((p) => [String(p.id), p]));
  let changed = false;
  const patched = products.map((p) => {
    const seed = byId.get(String(p.id));
    let next = { ...p };
    if (seed?.kitchen_station_id && !p.kitchen_station_id) {
      next.kitchen_station_id = seed.kitchen_station_id;
      changed = true;
    }
    if (p.is_ingredient === undefined && seed?.is_ingredient !== undefined) {
      next.is_ingredient = seed.is_ingredient;
      changed = true;
    } else if (p.is_ingredient === undefined && !String(p.id).startsWith("ing-")) {
      next.is_ingredient = false;
      changed = true;
    }
    return next;
  });
  if (changed) writeTableRows("products", patched);
}

let kitchenBootstrapDone = false;
let inventoryBootstrapDone = false;

/** Ensures kitchen tables exist in older SQLite files and product→station links. */
export function ensureFlame9KitchenBootstrap(): void {
  if (kitchenBootstrapDone) return;
  kitchenBootstrapDone = true;
  for (const t of ["restaurant_stations", "kitchen_orders", "kitchen_order_items"]) {
    if (tableIsEmpty(t)) {
      const seed = getFlame9SeedData(t);
      if (seed.length) writeTableRows(t, seed);
    }
  }
  patchProductsFromSeed();
}

/** Ingredients, recipes, cash register - merged into existing DBs without wiping data. */
export function ensureFlame9InventoryBootstrap(): void {
  if (inventoryBootstrapDone) return;
  inventoryBootstrapDone = true;
  ensureFlame9KitchenBootstrap();
  for (const t of [
    "categories",
    "products",
    "product_recipes",
    "cash_accounts",
    "register_sessions",
    "restaurant_modifiers",
    "restaurant_menu_sizes",
    "restaurant_reservations",
    "restaurant_deals",
    "restaurant_deal_items",
    "restaurant_waiter_calls",
    "payment_submissions",
  ]) {
    if (tableIsEmpty(t)) {
      const seed = getFlame9SeedData(t);
      if (seed.length) writeTableRows(t, seed);
    } else {
      mergeMissingSeedRows(t);
    }
  }
  patchProductsFromSeed();
}

export function ensureTableSeeded(tableName: string): unknown[] {
  ensureFlame9InventoryBootstrap();
  if (!tableIsEmpty(tableName)) {
    return readTableRows(tableName);
  }
  const seed = getFlame9SeedData(tableName);
  if (seed.length) writeTableRows(tableName, seed);
  return seed.length ? seed : readTableRows(tableName);
}

export function resetFlame9Database(): void {
  for (const t of FLAME9_SQLITE_TABLES) {
    writeTableRows(t, getFlame9SeedData(t));
  }
}
