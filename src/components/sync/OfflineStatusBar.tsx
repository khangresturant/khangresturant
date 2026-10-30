"use client";

import React from "react";
import {
  Wifi, WifiOff, RefreshCw, AlertTriangle,
  Loader2, CloudOff, UploadCloud,
} from "lucide-react";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { DeadLetterDrawer } from "./DeadLetterDrawer";

// ─── Small count badge ────────────────────────────────────────────────────────
function Badge({ count, variant = "white" }: { count: number; variant?: "white" | "red" }) {
  const base = "inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[9px] font-black tabular-nums leading-none";
  const colour =
    variant === "red"
      ? "bg-red-100 text-red-700"
      : "bg-white/25 text-white";
  return <span className={`${base} ${colour}`}>{count}</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function OfflineStatusBar() {
  const {
    isOnline, pendingCount, deadCount,
    isFlushing, lastSyncAt,
    deadEvents, flush, refreshCounts,
    retryOne, discardOne, retryAll,
  } = useSyncEngine();

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [visible, setVisible]       = React.useState(false);

  // Decide visibility: show whenever offline OR there is something to show
  const shouldShow = !isOnline || pendingCount > 0 || deadCount > 0;

  // Animate in/out with a small delay so it doesn't flash on quick reconnect
  React.useEffect(() => {
    if (shouldShow) {
      setVisible(true);
    } else {
      const t = setTimeout(() => setVisible(false), 800);
      return () => clearTimeout(t);
    }
  }, [shouldShow]);

  if (!visible) return null;

  // ── Appearance ─────────────────────────────────────────────────────────────
  const isError   = deadCount > 0;
  const isOffline = !isOnline;

  const barStyle = isOffline
    ? { bg: "bg-rose-600",   border: "border-rose-700",   text: "text-rose-50"  }
    : isError
    ? { bg: "bg-amber-500",  border: "border-amber-600",  text: "text-amber-50" }
    : { bg: "bg-blue-600",   border: "border-blue-700",   text: "text-blue-50"  };

  const Icon = isOffline   ? WifiOff
             : isFlushing  ? Loader2
             : isError     ? AlertTriangle
             : pendingCount > 0 ? UploadCloud
             : RefreshCw;

  const label = isOffline
    ? "You are offline"
    : isFlushing
    ? "Syncing…"
    : isError
    ? `${deadCount} sync failure${deadCount !== 1 ? "s" : ""}`
    : `${pendingCount} pending sync${pendingCount !== 1 ? "s" : ""}`;

  const sub = isOffline
    ? pendingCount > 0
      ? `${pendingCount} change${pendingCount !== 1 ? "s" : ""} queued locally`
      : "Changes will sync when reconnected"
    : lastSyncAt
    ? `Last synced ${lastSyncAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : null;

  return (
    <>
      {/* ── Bar ── */}
      <div
        className={`
          ${barStyle.bg} border-b ${barStyle.border}
          text-white text-[11px] font-semibold
          px-4 py-1.5
          flex items-center justify-between gap-3
          z-50 shrink-0
          transition-all duration-300
        `}
        role="status"
        aria-live="polite"
      >
        {/* Left: icon + message */}
        <div className="flex items-center gap-2 min-w-0">
          <Icon
            size={13}
            className={`shrink-0 ${isFlushing ? "animate-spin" : isOffline ? "animate-pulse" : ""}`}
          />
          <div className="flex flex-col leading-tight min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black whitespace-nowrap">{label}</span>
              {pendingCount > 0 && !isOffline && !isFlushing && (
                <Badge count={pendingCount} />
              )}
              {deadCount > 0 && (
                <Badge count={deadCount} variant="red" />
              )}
            </div>
            {sub && (
              <span className="opacity-70 text-[9.5px] font-medium truncate">{sub}</span>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Connectivity icon on far right */}
          {isOnline ? (
            <Wifi size={11} className="opacity-50" />
          ) : (
            <CloudOff size={11} className="opacity-70 animate-pulse" />
          )}

          {deadCount > 0 && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="
                bg-white/15 hover:bg-white/25
                border border-white/20
                text-white text-[9.5px] font-black
                px-2.5 py-0.5 rounded-full
                transition-all cursor-pointer
                whitespace-nowrap
              "
            >
              View {deadCount} error{deadCount !== 1 ? "s" : ""}
            </button>
          )}

          {pendingCount > 0 && isOnline && !isFlushing && (
            <button
              type="button"
              onClick={flush}
              className="
                bg-white/20 hover:bg-white/30
                border border-white/20
                text-white text-[9.5px] font-black
                px-2.5 py-0.5 rounded-full
                transition-all cursor-pointer
                flex items-center gap-1
                whitespace-nowrap
              "
            >
              <UploadCloud size={10} />
              Sync now
            </button>
          )}
        </div>
      </div>

      {/* ── Dead-letter drawer ── */}
      <DeadLetterDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        events={deadEvents}
        onRetryOne={retryOne}
        onDiscardOne={discardOne}
        onRetryAll={retryAll}
        onChanged={refreshCounts}
      />
    </>
  );
}
