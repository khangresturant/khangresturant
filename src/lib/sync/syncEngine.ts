/**
 * Legacy localStorage offline engine — kept for backward compatibility.
 * Phase 3 primary path: IndexedDB via @/utils/syncQueue + useSyncEngine.
 * New code should use queueOfflineCheckout / pushToSyncQueue.
 */

import {
  pushToSyncQueue,
  getPendingEventsForShop,
  type SyncAction,
} from "@/utils/syncQueue";

export interface OfflineTransaction {
  id: string;
  shopId: string;
  payload: any;
  endpoint: string;
  createdAt: string;
  attempts: number;
}

class OfflineSyncEngine {
  private queueKey = "The Accounts_offline_queue";

  public isOnline(): boolean {
    if (typeof window !== "undefined") {
      return window.navigator.onLine;
    }
    return true;
  }

  /**
   * Prefer IndexedDB queue (shop-scoped). Falls back to localStorage if IDB fails.
   */
  public async queueTransaction(
    endpoint: string,
    shopId: string,
    payload: any
  ): Promise<OfflineTransaction> {
    const id = payload.id || payload.invoice_id || crypto.randomUUID();
    const transaction: OfflineTransaction = {
      id,
      shopId,
      payload: { ...payload, id, shop_id: shopId },
      endpoint,
      createdAt: new Date().toISOString(),
      attempts: 0,
    };

    try {
      const action: SyncAction =
        endpoint === "invoices" || endpoint === "pos_checkout"
          ? "CHECKOUT"
          : endpoint === "purchase_orders"
            ? "PURCHASE"
            : "INSERT";
      await pushToSyncQueue(action, endpoint, transaction.payload, shopId);
    } catch (e) {
      console.warn("[syncEngine] IndexedDB queue failed, using localStorage", e);
      const queue = this.getLocalQueue();
      queue.push(transaction);
      localStorage.setItem(this.queueKey, JSON.stringify(queue));
    }

    return transaction;
  }

  public getLocalQueue(): OfflineTransaction[] {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(this.queueKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /** @deprecated Flush is handled by useSyncEngine → /api/sync */
  public async syncAll(shopId?: string): Promise<{
    successCount: number;
    failedCount: number;
  }> {
    if (shopId) {
      const pending = await getPendingEventsForShop(shopId);
      return { successCount: 0, failedCount: pending.length };
    }
    return { successCount: 0, failedCount: 0 };
  }

  public clearQueue() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(this.queueKey);
    }
  }
}

export const syncEngine = new OfflineSyncEngine();
