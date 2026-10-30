/**
 * Offline Reports Engine for The Accounts
 * Caches report data snapshots locally so reports can be viewed offline.
 */

export interface CachedReportSnapshot<T = any> {
  reportKey: string;
  timestamp: string;
  data: T;
}

const REPORT_CACHE_PREFIX = "The Accounts_report_cache_";

/**
 * Save report snapshot to local cache
 */
export function saveReportSnapshot<T = any>(reportKey: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const snapshot: CachedReportSnapshot<T> = {
      reportKey,
      timestamp: new Date().toISOString(),
      data,
    };
    localStorage.setItem(`${REPORT_CACHE_PREFIX}${reportKey}`, JSON.stringify(snapshot));
  } catch (err) {
    console.warn("[offlineReportsEngine] Failed to save report snapshot:", err);
  }
}

/**
 * Get report snapshot from local cache
 */
export function getReportSnapshot<T = any>(reportKey: string): CachedReportSnapshot<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${REPORT_CACHE_PREFIX}${reportKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as CachedReportSnapshot<T>;
  } catch (err) {
    console.warn("[offlineReportsEngine] Failed to load report snapshot:", err);
    return null;
  }
}

/**
 * Check if the browser is currently offline
 */
export function isBrowserOffline(): boolean {
  if (typeof window === "undefined") return false;
  return !navigator.onLine;
}
