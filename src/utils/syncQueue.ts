// ─────────────────────────────────────────────────────────────────────────────
// The Accounts Offline Database — IndexedDB Manager (Phase 3)
// Local caches + shop-scoped sync queue + dead-letter management
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = "The Accounts_Offline_DB";
const DB_VERSION = 5; // v5: showroom offline stores (vehicles, installments, schedules, sales, parties, investors, rentals, expenses)

export type SyncAction =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "CHECKOUT"
  | "VOID"
  | "PURCHASE"
  | "PARTY_PAYMENT";

export type SyncStatus = "pending" | "synced" | "dead";

export interface SyncEvent {
  id?: number;
  action: SyncAction;
  tableName: string;
  payload: any;
  timestamp: string;
  retryCount: number;
  status: SyncStatus;
  lastError?: string;
  /** Tenant isolation — never flush under a different shop session */
  shopId: string;
  /** Client device id for diagnostics */
  deviceId?: string;
  /** Optional human label for dead-letter UI */
  label?: string;
}

const MAX_RETRIES = 5;
const LOCK_KEY = "The Accounts_sync_flush_lock";
const LOCK_TTL_MS = 30_000;
const DEVICE_KEY = "hx_device_id";

// ─── Device id ───────────────────────────────────────────────────────────────

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

// ─── Multi-tab flush lock ────────────────────────────────────────────────────

export function acquireSyncLock(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    const now = Date.now();
    if (raw) {
      const parsed = JSON.parse(raw) as { ts: number; tab: string };
      if (now - parsed.ts < LOCK_TTL_MS && parsed.tab !== getDeviceId()) {
        return false;
      }
    }
    localStorage.setItem(
      LOCK_KEY,
      JSON.stringify({ ts: now, tab: getDeviceId() })
    );
    return true;
  } catch {
    return true;
  }
}

export function releaseSyncLock(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { tab: string };
    if (parsed.tab === getDeviceId()) localStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
}

// ─── DB Open ─────────────────────────────────────────────────────────────────

export function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (ev) => {
      const db = request.result;
      const oldVersion = ev.oldVersion;

      const cacheStores = [
        "products",
        "product_variants",
        "parties",
        "stock_movements",
        "invoices",
        "invoice_items",
        "credit_transactions",
        "account_transactions",
        "product_barcodes",
        "cash_accounts",
        "catalog_meta",
        "categories",
        "units",
        "purchase_orders",
        // Showroom offline stores
        "showroom_vehicles",
        "showroom_parties",
        "showroom_installments",
        "showroom_installment_schedules",
        "showroom_sales",
        "showroom_investors",
        "showroom_investor_transactions",
        "showroom_rentals",
        "showroom_vehicle_expenses",
      ];

      for (const store of cacheStores) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      }

      if (!db.objectStoreNames.contains("sync_queue")) {
        const qStore = db.createObjectStore("sync_queue", {
          keyPath: "id",
          autoIncrement: true,
        });
        qStore.createIndex("by_status", "status", { unique: false });
        qStore.createIndex("by_shop", "shopId", { unique: false });
        qStore.createIndex("by_shop_status", ["shopId", "status"], {
          unique: false,
        });
      } else if (oldVersion < 3) {
        const tx = request.transaction!;
        const qStore = tx.objectStore("sync_queue");
        if (!qStore.indexNames.contains("by_shop")) {
          qStore.createIndex("by_shop", "shopId", { unique: false });
        }
        if (!qStore.indexNames.contains("by_shop_status")) {
          qStore.createIndex("by_shop_status", ["shopId", "status"], {
            unique: false,
          });
        }
      }
    };
  });
}

// ─── Generic Cache CRUD ───────────────────────────────────────────────────────

export async function putOfflineData(storeName: string, data: any): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const request = tx.objectStore(storeName).put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function putManyOfflineData(
  storeName: string,
  rows: any[]
): Promise<void> {
  if (!rows.length) return;
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    for (const row of rows) store.put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineData(storeName: string, id: string): Promise<any> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllOfflineData(storeName: string): Promise<any[]> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineData(storeName: string, id: string): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const request = tx.objectStore(storeName).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearOfflineStore(storeName: string): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const request = tx.objectStore(storeName).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearShopOfflineData(storeName: string, shopId: string): Promise<void> {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.openCursor();
      request.onsuccess = (ev) => {
        const cursor = (ev.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const val = cursor.value;
          if (val && (val.shopId === shopId || val._shop_id === shopId || val.shop_id === shopId)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    /* ignore if store not present */
  }
}

// ─── Catalog snapshot ─────────────────────────────────────────────────────────

export interface ShopSnapshotInput {
  shopId: string;
  products: any[];
  parties: any[];
  cashAccounts?: any[];
  categories?: any[];
  units?: any[];
  invoices?: any[];
  creditTransactions?: any[];
  purchaseOrders?: any[];
  // Showroom offline snapshot collections
  showroomVehicles?: any[];
  showroomParties?: any[];
  showroomInstallments?: any[];
  showroomInstallmentSchedules?: any[];
  showroomSales?: any[];
  showroomInvestors?: any[];
  showroomInvestorTransactions?: any[];
  showroomRentals?: any[];
  showroomVehicleExpenses?: any[];
}

export async function saveCatalogSnapshot(args: ShopSnapshotInput): Promise<void> {
  await saveShopSnapshot(args);
}

export async function saveShopSnapshot(args: ShopSnapshotInput): Promise<void> {
  const {
    shopId,
    products,
    parties,
    cashAccounts = [],
    categories = [],
    units = [],
    invoices = [],
    creditTransactions = [],
    purchaseOrders = [],
    showroomVehicles = [],
    showroomParties = [],
    showroomInstallments = [],
    showroomInstallmentSchedules = [],
    showroomSales = [],
    showroomInvestors = [],
    showroomInvestorTransactions = [],
    showroomRentals = [],
    showroomVehicleExpenses = [],
  } = args;

  // Prune existing records for this shop so deleted items/parties don't persist
  await Promise.all([
    clearShopOfflineData("products", shopId),
    clearShopOfflineData("parties", shopId),
    clearShopOfflineData("cash_accounts", shopId),
    clearShopOfflineData("categories", shopId),
    clearShopOfflineData("units", shopId),
  ]);

  const tag = <T extends Record<string, unknown>>(rows: T[]) =>
    rows.map((r) => ({ ...r, shopId, _shop_id: shopId }));

  await putManyOfflineData("products", tag(products));
  await putManyOfflineData("parties", tag(parties));
  if (cashAccounts.length) await putManyOfflineData("cash_accounts", tag(cashAccounts));
  if (categories.length) await putManyOfflineData("categories", tag(categories));
  if (units.length) await putManyOfflineData("units", tag(units));
  if (invoices.length) await putManyOfflineData("invoices", tag(invoices));
  if (creditTransactions.length) {
    await putManyOfflineData("credit_transactions", tag(creditTransactions));
  }
  if (purchaseOrders.length) await putManyOfflineData("purchase_orders", tag(purchaseOrders));

  // Showroom caching
  if (showroomVehicles.length) await putManyOfflineData("showroom_vehicles", tag(showroomVehicles));
  if (showroomParties.length) await putManyOfflineData("showroom_parties", tag(showroomParties));
  if (showroomInstallments.length) await putManyOfflineData("showroom_installments", tag(showroomInstallments));
  if (showroomInstallmentSchedules.length) {
    await putManyOfflineData("showroom_installment_schedules", tag(showroomInstallmentSchedules));
  }
  if (showroomSales.length) await putManyOfflineData("showroom_sales", tag(showroomSales));
  if (showroomInvestors.length) await putManyOfflineData("showroom_investors", tag(showroomInvestors));
  if (showroomInvestorTransactions.length) {
    await putManyOfflineData("showroom_investor_transactions", tag(showroomInvestorTransactions));
  }
  if (showroomRentals.length) await putManyOfflineData("showroom_rentals", tag(showroomRentals));
  if (showroomVehicleExpenses.length) {
    await putManyOfflineData("showroom_vehicle_expenses", tag(showroomVehicleExpenses));
  }

  await putOfflineData("catalog_meta", {
    id: shopId,
    shopId,
    savedAt: new Date().toISOString(),
    productCount: products.length,
    partyCount: parties.length,
    invoiceCount: invoices.length,
    purchaseOrderCount: purchaseOrders.length,
    showroomVehicleCount: showroomVehicles.length,
    showroomInstallmentCount: showroomInstallments.length,
  });
}

export interface ShopSnapshot {
  products: any[];
  parties: any[];
  cashAccounts: any[];
  categories: any[];
  units: any[];
  invoices: any[];
  creditTransactions: any[];
  purchaseOrders: any[];
  showroomVehicles?: any[];
  showroomParties?: any[];
  showroomInstallments?: any[];
  showroomInstallmentSchedules?: any[];
  showroomSales?: any[];
  showroomInvestors?: any[];
  showroomInvestorTransactions?: any[];
  showroomRentals?: any[];
  showroomVehicleExpenses?: any[];
  savedAt: string | null;
}

function filterByShop(rows: any[], shopId: string): any[] {
  return rows.filter((r) => r.shopId === shopId || r.shop_id === shopId);
}

export async function loadCatalogSnapshot(shopId: string): Promise<ShopSnapshot | null> {
  return loadShopSnapshot(shopId);
}

export async function loadShopSnapshot(shopId: string): Promise<ShopSnapshot | null> {
  try {
    const meta = await getOfflineData("catalog_meta", shopId);
    if (!meta) return null;
    const [
      products,
      parties,
      cashAccounts,
      categories,
      units,
      invoices,
      creditTransactions,
      purchaseOrders,
      showroomVehicles,
      showroomParties,
      showroomInstallments,
      showroomInstallmentSchedules,
      showroomSales,
      showroomInvestors,
      showroomInvestorTransactions,
      showroomRentals,
      showroomVehicleExpenses,
    ] = await Promise.all([
      getAllOfflineData("products"),
      getAllOfflineData("parties"),
      getAllOfflineData("cash_accounts"),
      getAllOfflineData("categories"),
      getAllOfflineData("units"),
      getAllOfflineData("invoices"),
      getAllOfflineData("credit_transactions"),
      getAllOfflineData("purchase_orders"),
      getAllOfflineData("showroom_vehicles"),
      getAllOfflineData("showroom_parties"),
      getAllOfflineData("showroom_installments"),
      getAllOfflineData("showroom_installment_schedules"),
      getAllOfflineData("showroom_sales"),
      getAllOfflineData("showroom_investors"),
      getAllOfflineData("showroom_investor_transactions"),
      getAllOfflineData("showroom_rentals"),
      getAllOfflineData("showroom_vehicle_expenses"),
    ]);
    return {
      products: filterByShop(products, shopId),
      parties: filterByShop(parties, shopId),
      cashAccounts: filterByShop(cashAccounts, shopId),
      categories: filterByShop(categories, shopId),
      units: filterByShop(units, shopId),
      invoices: filterByShop(invoices, shopId),
      creditTransactions: filterByShop(creditTransactions, shopId),
      purchaseOrders: filterByShop(purchaseOrders, shopId),
      showroomVehicles: filterByShop(showroomVehicles, shopId),
      showroomParties: filterByShop(showroomParties, shopId),
      showroomInstallments: filterByShop(showroomInstallments, shopId),
      showroomInstallmentSchedules: filterByShop(showroomInstallmentSchedules, shopId),
      showroomSales: filterByShop(showroomSales, shopId),
      showroomInvestors: filterByShop(showroomInvestors, shopId),
      showroomInvestorTransactions: filterByShop(showroomInvestorTransactions, shopId),
      showroomRentals: filterByShop(showroomRentals, shopId),
      showroomVehicleExpenses: filterByShop(showroomVehicleExpenses, shopId),
      savedAt: meta.savedAt || null,
    };
  } catch {
    return null;
  }
}

// ─── Sync Queue: Write ────────────────────────────────────────────────────────

export async function pushToSyncQueue(
  action: SyncAction,
  tableName: string,
  payload: any,
  shopId: string,
  label?: string
): Promise<number> {
  if (!shopId) throw new Error("shopId is required for offline queue entries");

  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    // Ensure payload carries shop_id for server validation
    const safePayload = {
      ...payload,
      shop_id: payload?.shop_id || shopId,
    };
    const event: SyncEvent = {
      action,
      tableName,
      payload: safePayload,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status: "pending",
      shopId,
      deviceId: getDeviceId(),
      label,
    };
    const request = tx.objectStore("sync_queue").add(event);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

/** Queue a POS checkout payload (Phase 2 pos_checkout shape). */
export async function queueOfflineCheckout(
  shopId: string,
  posPayload: any
): Promise<number> {
  return pushToSyncQueue(
    "CHECKOUT",
    "invoices",
    {
      ...posPayload,
      shop_id: shopId,
      client_meta: {
        ...(posPayload.client_meta || {}),
        is_offline_creation: true,
        queued_at: new Date().toISOString(),
        device_id: getDeviceId(),
      },
    },
    shopId,
    `Offline sale ${String(posPayload.invoice_id || "").slice(0, 8).toUpperCase()}`
  );
}

// ─── Sync Queue: Read ─────────────────────────────────────────────────────────

export async function getSyncQueueByStatus(status: SyncStatus): Promise<SyncEvent[]> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readonly");
    const store = tx.objectStore("sync_queue");
    try {
      const index = store.index("by_status");
      const request = index.getAll(IDBKeyRange.only(status));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch {
      const request = store.getAll();
      request.onsuccess = () =>
        resolve((request.result || []).filter((e: SyncEvent) => e.status === status));
      request.onerror = () => reject(request.error);
    }
  });
}

/** Pending events for a shop only (cross-shop isolation). */
export async function getPendingEventsForShop(shopId: string): Promise<SyncEvent[]> {
  const all = await getPendingEvents();
  return all.filter((e) => e.shopId === shopId || e.payload?.shop_id === shopId);
}

export async function getPendingEvents(): Promise<SyncEvent[]> {
  return getSyncQueueByStatus("pending");
}

export async function getDeadLetterQueue(shopId?: string): Promise<SyncEvent[]> {
  const dead = await getSyncQueueByStatus("dead");
  if (!shopId) return dead;
  return dead.filter((e) => e.shopId === shopId || e.payload?.shop_id === shopId);
}

export async function getSyncQueue(): Promise<SyncEvent[]> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readonly");
    const request = tx.objectStore("sync_queue").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ─── Sync Queue: Update Status ────────────────────────────────────────────────

export async function markEventSynced(eventId: number): Promise<void> {
  await _updateEventFields(eventId, { status: "synced" });
}

/** Force an event into dead-letter (e.g. shop isolation skip). */
export async function markEventDead(
  eventId: number,
  errorMessage: string
): Promise<void> {
  await _updateEventFields(eventId, {
    status: "dead",
    retryCount: MAX_RETRIES,
    lastError: errorMessage,
  });
}

export async function incrementRetryOrMarkDead(
  eventId: number,
  errorMessage: string
): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const getReq = store.get(eventId);

    getReq.onsuccess = () => {
      const event: SyncEvent = getReq.result;
      if (!event) {
        resolve();
        return;
      }

      const newRetryCount = (event.retryCount || 0) + 1;
      const newStatus: SyncStatus =
        newRetryCount >= MAX_RETRIES ? "dead" : "pending";

      const putReq = store.put({
        ...event,
        retryCount: newRetryCount,
        status: newStatus,
        lastError: errorMessage,
      });
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function retryDeadEvent(eventId: number): Promise<void> {
  await _updateEventFields(eventId, {
    status: "pending",
    retryCount: 0,
    lastError: undefined,
  });
}

export async function deleteDeadEvent(eventId: number): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const request = tx.objectStore("sync_queue").delete(eventId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearSyncedEvents(): Promise<void> {
  const db = await openOfflineDB();
  const synced = await getSyncQueueByStatus("synced");
  return new Promise((resolve, reject) => {
    if (synced.length === 0) {
      resolve();
      return;
    }
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    let count = 0;
    for (const event of synced) {
      const req = store.delete(event.id!);
      req.onsuccess = () => {
        count++;
        if (count === synced.length) resolve();
      };
      req.onerror = () => reject(req.error);
    }
  });
}

/** Export dead-letter (or all) events as JSON string for backup/support. */
export async function exportQueueJson(
  shopId?: string,
  status?: SyncStatus
): Promise<string> {
  let events = await getSyncQueue();
  if (shopId) {
    events = events.filter(
      (e) => e.shopId === shopId || e.payload?.shop_id === shopId
    );
  }
  if (status) {
    events = events.filter((e) => e.status === status);
  }
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      device_id: getDeviceId(),
      shop_id: shopId || null,
      count: events.length,
      events,
    },
    null,
    2
  );
}

async function _updateEventFields(
  eventId: number,
  fields: Partial<SyncEvent>
): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const getReq = store.get(eventId);
    getReq.onsuccess = () => {
      const event = getReq.result;
      if (!event) {
        resolve();
        return;
      }
      const putReq = store.put({ ...event, ...fields });
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/** @deprecated Use getPendingEvents() */
export const getSyncQueueAll = getSyncQueue;
