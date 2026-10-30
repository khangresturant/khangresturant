"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getPendingEventsForShop,
  getDeadLetterQueue,
  getSyncQueue,
  markEventSynced,
  markEventDead,
  incrementRetryOrMarkDead,
  clearSyncedEvents,
  acquireSyncLock,
  releaseSyncLock,
  retryDeadEvent,
  deleteDeadEvent,
  SyncEvent,
} from "@/utils/syncQueue";
import { useShop } from "@/context/ShopContext";

const FLUSH_INTERVAL_MS = 5_000;

interface SyncEngineState {
  isOnline: boolean;
  pendingCount: number;
  deadCount: number;
  totalCount: number;
  isFlushing: boolean;
  lastSyncAt: Date | null;
  deadEvents: SyncEvent[];
  flush: () => Promise<void>;
  refreshCounts: () => Promise<void>;
  retryOne: (id: number) => Promise<void>;
  discardOne: (id: number) => Promise<void>;
  retryAll: () => Promise<void>;
}

/**
 * Auto-flushes shop-scoped offline queue when network is restored.
 * Exposes retryOne / discardOne so UI components don't need direct
 * IndexedDB access.
 */
export function useSyncEngine(): SyncEngineState {
  const { shopId } = useShop();
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [deadCount, setDeadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [deadEvents, setDeadEvents] = useState<SyncEvent[]>([]);
  const flushLockRef = useRef(false);

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const refreshCounts = useCallback(async () => {
    if (!shopId) {
      setPendingCount(0);
      setDeadCount(0);
      setTotalCount(0);
      setDeadEvents([]);
      return;
    }
    try {
      const [pending, dead, all] = await Promise.all([
        getPendingEventsForShop(shopId),
        getDeadLetterQueue(shopId),
        getSyncQueue(),
      ]);
      const shopAll = all.filter(
        (e) => e.shopId === shopId || e.payload?.shop_id === shopId
      );
      setPendingCount(pending.length);
      setDeadCount(dead.length);
      setTotalCount(shopAll.filter((e) => e.status !== "synced").length);
      setDeadEvents(dead);
    } catch {
      /* IndexedDB unavailable */
    }
  }, [shopId]);

  const flush = useCallback(async () => {
    if (!shopId || flushLockRef.current || !navigator.onLine) return;
    if (!acquireSyncLock()) return;

    flushLockRef.current = true;
    setIsFlushing(true);

    try {
      const pending = await getPendingEventsForShop(shopId);
      if (pending.length === 0) return;

      // Never send events for another shop (defense in depth)
      const safeEvents = pending.filter(
        (e) => e.shopId === shopId || e.payload?.shop_id === shopId
      );
      if (safeEvents.length === 0) return;

      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, events: safeEvents }),
      });

      if (!res.ok) return;

      const json = await res.json();
      const results: { event_id: number; status: string; error?: string }[] =
        json?.data?.results || [];

      await Promise.all(
        results.map(async (result) => {
          if (result.status === "synced") {
            await markEventSynced(result.event_id);
          } else if (result.status === "skipped" || result.status === "dead") {
            await markEventDead(result.event_id, result.error || "Sync failed");
          } else {
            await incrementRetryOrMarkDead(result.event_id, result.error || "Server error");
          }
        })
      );

      await clearSyncedEvents();
      setLastSyncAt(new Date());
    } catch {
      /* network — retry later */
    } finally {
      flushLockRef.current = false;
      releaseSyncLock();
      setIsFlushing(false);
      await refreshCounts();
    }
  }, [shopId, refreshCounts]);

  /** Re-queue a single dead event and immediately attempt flush */
  const retryOne = useCallback(async (id: number) => {
    await retryDeadEvent(id);
    await refreshCounts();
    if (navigator.onLine) await flush();
  }, [flush, refreshCounts]);

  /** Re-queue all dead events and immediately attempt flush */
  const retryAll = useCallback(async () => {
    if (!shopId) return;
    const dead = await getDeadLetterQueue(shopId);
    await Promise.all(
      dead
        .filter((e) => e.id != null)
        .map((e) => retryDeadEvent(e.id!))
    );
    await refreshCounts();
    if (navigator.onLine) await flush();
  }, [shopId, flush, refreshCounts]);

  /** Permanently remove a single dead event */
  const discardOne = useCallback(async (id: number) => {
    await deleteDeadEvent(id);
    await refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    refreshCounts();
    if (!isOnline || !shopId) return;

    const interval = setInterval(async () => {
      await refreshCounts();
      const pending = await getPendingEventsForShop(shopId);
      if (pending.length > 0) await flush();
    }, FLUSH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isOnline, shopId, flush, refreshCounts]);

  useEffect(() => {
    if (isOnline && shopId) flush();
  }, [isOnline, shopId, flush]);

  return {
    isOnline,
    pendingCount,
    deadCount,
    totalCount,
    isFlushing,
    lastSyncAt,
    deadEvents,
    flush,
    refreshCounts,
    retryOne,
    discardOne,
    retryAll,
  };
}
