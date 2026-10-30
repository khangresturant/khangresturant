/**
 * Phase 3 — offline POS helpers.
 * Queue checkout when offline / network fails; flush via useSyncEngine + /api/sync.
 */

import {
  queueOfflineCheckout,
  loadCatalogSnapshot,
  saveCatalogSnapshot,
} from "@/utils/syncQueue";
import type { PosCheckoutPayload } from "@/lib/money/types";

export function isBrowserOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return !navigator.onLine;
}

/** True when error looks like a network/connectivity failure (queue-worthy). */
export function isNetworkError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || "").toLowerCase();
  if (isBrowserOffline()) return true;
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("offline") ||
    msg.includes("timeout") ||
    msg.includes("net::") ||
    msg.includes("load failed") ||
    msg.includes("networkerror")
  );
}

/**
 * Persist checkout for later sync. Returns queue event id.
 * Ensures invoice_id is set for idempotent pos_checkout.
 */
export async function enqueueOfflinePosCheckout(
  shopId: string,
  payload: PosCheckoutPayload
): Promise<{ queueId: number; invoiceId: string }> {
  const invoiceId = payload.invoice.id || crypto.randomUUID();
  const full: PosCheckoutPayload = {
    ...payload,
    invoice: {
      ...payload.invoice,
      id: invoiceId,
      shop_id: shopId,
    },
  };

  const queueId = await queueOfflineCheckout(shopId, full);
  return { queueId, invoiceId };
}


export { loadCatalogSnapshot, saveCatalogSnapshot };
