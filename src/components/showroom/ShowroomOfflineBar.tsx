"use client";

import React from "react";
import { Wifi, WifiOff, RefreshCw, Database, CloudUpload } from "lucide-react";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { Button } from "@/components/ui/button";

interface ShowroomOfflineBarProps {
  className?: string;
  onSyncSuccess?: () => void | Promise<void>;
}

export function ShowroomOfflineBar({ className = "" }: ShowroomOfflineBarProps) {
  const { isOnline, pendingCount, isFlushing, flush, lastSyncAt } = useSyncEngine();

  if (isOnline && pendingCount === 0) {
    return null; // Clean UI when everything is normal and online
  }

  return (
    <div
      className={`p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold shadow-sm transition-all ${
        !isOnline
          ? "bg-amber-50 border border-amber-200 text-amber-900"
          : "bg-violet-50 border border-violet-200 text-violet-900"
      } ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`p-2 rounded-xl flex items-center justify-center ${
            !isOnline ? "bg-amber-200/70 text-amber-950" : "bg-violet-200/70 text-violet-950"
          }`}
        >
          {!isOnline ? <WifiOff className="w-4 h-4 animate-pulse" /> : <CloudUpload className="w-4 h-4 animate-bounce" />}
        </div>
        <div>
          <div className="font-bold flex items-center gap-1.5">
            {!isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
                <span>آف لائن موڈ فعال ہے (Offline Mode Active)</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span>انٹرنیٹ بحال ہے • کلاؤڈ سنک جاری ہے</span>
              </>
            )}
          </div>
          <p className="text-[11px] font-normal opacity-85 mt-0.5">
            {!isOnline
              ? "آپ انٹرنیٹ کے بغیر بھی تمام گاڑیاں، اقساط، نقد فروخت اور کھاتہ رجسٹر کر سکتے ہیں۔ تمام ڈیٹا محفوظ رہے گا۔"
              : `آف لائن کی گئی ${pendingCount} تبدیلیاں کلاؤڈ پر منتقل کی جا رہی ہیں۔`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {pendingCount > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-white/80 border border-current text-[11px] font-mono font-bold">
            {pendingCount} Pending Sync
          </span>
        )}

        {isOnline && (
          <Button
            size="sm"
            onClick={() => flush()}
            disabled={isFlushing}
            className="h-7.5 px-3 text-xs font-bold rounded-xl bg-violet-600 hover:bg-violet-700 text-white cursor-pointer shadow-xs gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFlushing ? "animate-spin" : ""}`} />
            <span>{isFlushing ? "Syncing..." : "Sync Now"}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
