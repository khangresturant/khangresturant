"use client";

import React from "react";
import {
  X, AlertTriangle, RefreshCw, Download,
  Trash2, RotateCcw, InboxIcon, ChevronRight,
  Clock, ServerCrash,
} from "lucide-react";
import { exportQueueJson, type SyncEvent } from "@/utils/syncQueue";
import { useShop } from "@/context/ShopContext";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDiscard({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-end pb-4 px-4 bg-black/30 rounded-b-2xl">
      <div className="w-full bg-white rounded-2xl shadow-xl p-4 space-y-3 border border-rose-100">
        <div className="flex items-center gap-2 text-rose-700">
          <AlertTriangle size={15} />
          <span className="text-xs font-black">Discard this event?</span>
        </div>
        <p className="text-[10.5px] text-slate-500 leading-relaxed">
          This will permanently delete the failed sync event. The data will
          <strong className="text-slate-700"> not</strong> be sent to the server.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-9 rounded-xl border border-slate-200 text-[11px] font-black text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black transition-colors cursor-pointer"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Single event card ────────────────────────────────────────────────────────

function EventCard({
  event,
  onRetry,
  onDiscard,
  isBusy,
}: {
  event:     SyncEvent;
  onRetry:   () => void;
  onDiscard: () => void;
  isBusy:    boolean;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const actionLabel = event.action || "EVENT";
  const tableLabel  = event.label || event.tableName || "";
  const errorMsg    = event.lastError || (event as any).error;
  const ts          = event.timestamp || (event as any).created_at;

  return (
    <div className="relative rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/60 to-amber-50/40 overflow-hidden shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0 h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center">
            <ServerCrash size={13} className="text-amber-700" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black text-slate-800 truncate">
              {actionLabel}
              {tableLabel && (
                <span className="font-semibold text-slate-500 ml-1">· {tableLabel}</span>
              )}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock size={9} className="text-slate-400 shrink-0" />
              <span className="text-[9.5px] text-slate-400 font-medium">
                {relativeTime(ts)}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-[9.5px] text-slate-400 font-medium">
                {event.retryCount ?? 0} retr{event.retryCount === 1 ? "y" : "ies"}
              </span>
            </div>
          </div>
        </div>
        {/* Shop id chip */}
        <span className="shrink-0 text-[8.5px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
          {String(event.shopId || event.payload?.shop_id || "").slice(0, 8)}…
        </span>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="mx-3.5 mb-2 rounded-xl bg-rose-100/70 border border-rose-200/60 px-2.5 py-1.5">
          <p className="text-[10px] font-semibold text-rose-700 break-words leading-relaxed">
            {errorMsg}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-3.5 pb-3">
        <button
          type="button"
          disabled={isBusy}
          onClick={onRetry}
          className="
            flex-1 h-8 rounded-xl
            bg-white border border-slate-200
            hover:border-blue-300 hover:bg-blue-50
            text-[10px] font-black text-slate-700 hover:text-blue-700
            flex items-center justify-center gap-1
            transition-all cursor-pointer disabled:opacity-40
          "
        >
          <RotateCcw size={11} />
          Re-queue
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setConfirmOpen(true)}
          className="
            h-8 px-3 rounded-xl
            bg-white border border-rose-200
            hover:bg-rose-50
            text-[10px] font-black text-rose-600
            flex items-center gap-1
            transition-all cursor-pointer disabled:opacity-40
          "
        >
          <Trash2 size={11} />
          Discard
        </button>
      </div>

      {/* Inline confirm overlay */}
      {confirmOpen && (
        <ConfirmDiscard
          onConfirm={() => { setConfirmOpen(false); onDiscard(); }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
      <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
        <InboxIcon size={24} className="text-emerald-500" />
      </div>
      <p className="text-sm font-black text-slate-700">All clear!</p>
      <p className="text-xs text-slate-400 font-medium mt-1">
        No failed sync events. Everything synced successfully.
      </p>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  isOpen:       boolean;
  onClose:      () => void;
  events:       SyncEvent[];
  onRetryOne?:  (id: number) => Promise<void>;
  onDiscardOne?: (id: number) => Promise<void>;
  onRetryAll?:  () => Promise<void>;
  onChanged?:   () => void;
  /** @deprecated Pass onRetryOne / onDiscardOne instead */
  onRetry?:     () => void;
};

// ─── Drawer ───────────────────────────────────────────────────────────────────

export function DeadLetterDrawer({
  isOpen,
  onClose,
  events,
  onRetryOne,
  onDiscardOne,
  onRetryAll,
  onChanged,
}: Props) {
  const { shopId } = useShop();
  const [busyId, setBusyId]        = React.useState<number | null>(null);
  const [retryingAll, setRetryAll] = React.useState(false);

  if (!isOpen) return null;

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      const json = await exportQueueJson(shopId || undefined, "dead");
      const blob  = new Blob([json], { type: "application/json" });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href      = url;
      a.download  = `theaccounts-failed-sync-${shopId?.slice(0, 8) ?? "all"}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Dead-letter queue exported");
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    }
  };

  // ── Retry one ───────────────────────────────────────────────────────────────
  const handleRetryOne = async (id?: number) => {
    if (id == null) return;
    setBusyId(id);
    try {
      await onRetryOne?.(id);
      toast.success("Event re-queued — syncing now…");
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  // ── Discard one ─────────────────────────────────────────────────────────────
  const handleDiscardOne = async (id?: number) => {
    if (id == null) return;
    setBusyId(id);
    try {
      await onDiscardOne?.(id);
      toast.success("Event discarded");
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  // ── Retry all ───────────────────────────────────────────────────────────────
  const handleRetryAll = async () => {
    if (!onRetryAll) return;
    setRetryAll(true);
    try {
      await onRetryAll();
      toast.success("All events re-queued");
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRetryAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] cursor-pointer"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative h-full w-full max-w-[420px] bg-white shadow-2xl border-l border-slate-100 flex flex-col animate-in slide-in-from-right duration-300">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-amber-50/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={15} className="text-amber-700" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">Failed Sync Events</p>
              <p className="text-[10px] text-slate-500 font-medium">
                {events.length === 0
                  ? "Nothing failed"
                  : `${events.length} event${events.length !== 1 ? "s" : ""} need attention`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        {events.length > 0 && (
          <div className="flex gap-2 px-4 py-2.5 border-b border-slate-50 bg-slate-50/50 shrink-0">
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 h-8 rounded-xl border border-slate-200 bg-white text-[10px] font-black text-slate-600 flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Download size={11} />
              Export JSON
            </button>
            {onRetryAll && (
              <button
                type="button"
                disabled={retryingAll}
                onClick={handleRetryAll}
                className="flex-1 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {retryingAll ? (
                  <RefreshCw size={11} className="animate-spin" />
                ) : (
                  <RefreshCw size={11} />
                )}
                Re-queue all
              </button>
            )}
          </div>
        )}

        {/* ── Event list ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {events.length === 0 ? (
            <EmptyState />
          ) : (
            events.map((ev, idx) => (
              <EventCard
                key={String(ev.id ?? idx)}
                event={ev}
                isBusy={busyId === ev.id}
                onRetry={() => handleRetryOne(ev.id)}
                onDiscard={() => handleDiscardOne(ev.id)}
              />
            ))
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <ChevronRight size={13} className="rotate-180" />
            Close panel
          </button>
        </div>
      </div>
    </div>
  );
}
