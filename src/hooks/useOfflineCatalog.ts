"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { syncShopDataOnline, SYNC_INTERVAL_MS, isBrowserOffline } from "@/lib/sync/offlineData";
import { loadShopSnapshot } from "@/utils/syncQueue";

/**
 * Keeps IndexedDB shop snapshot fresh when online.
 * Mounted once in dashboard layout — all pages read from the same cache when offline.
 */
export function useOfflineCatalog() {
  const { shopId } = useShop();
  const supabase = createClient();
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const syncLock = useRef(false);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Load last sync time from IndexedDB meta on shop change
  useEffect(() => {
    if (!shopId) {
      setLastSyncedAt(null);
      return;
    }
    loadShopSnapshot(shopId).then((snap) => {
      if (snap?.savedAt) setLastSyncedAt(snap.savedAt);
    });
  }, [shopId]);

  const syncNow = useCallback(async () => {
    if (!shopId || syncLock.current || isBrowserOffline()) return;
    syncLock.current = true;
    setSyncing(true);
    try {
      const { savedAt } = await syncShopDataOnline(supabase, shopId);
      setLastSyncedAt(savedAt);
    } catch (err: any) {
      if (err?.name !== "AbortError" && err?.message !== "AbortError: The user aborted a request.") {
        console.warn("[useOfflineCatalog] sync failed:", err);
      }
    } finally {
      syncLock.current = false;
      setSyncing(false);
    }
  }, [shopId, supabase]);

  // Defer sync on mount to avoid competing with critical page queries, then sync periodically
  useEffect(() => {
    if (!shopId || isOffline) return;
    
    // Give active page 2.5s to finish its high-priority initial fetch
    const initialTimer = setTimeout(() => {
      syncNow();
    }, 2500);

    const interval = setInterval(syncNow, SYNC_INTERVAL_MS);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [shopId, isOffline, syncNow]);

  return { isOffline, lastSyncedAt, syncing, syncNow };
}
