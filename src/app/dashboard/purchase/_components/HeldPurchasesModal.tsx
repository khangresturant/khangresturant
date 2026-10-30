"use client";

import React from "react";
import { X, Play, Trash2, ShoppingCart, Calendar, Building2, Receipt, AlertCircle, Clock } from "lucide-react";
import type { CartItem, Supplier } from "./types";

export type HeldPurchase = {
  id: string;
  tag: string;
  cart: CartItem[];
  selectedSupplierId: string;
  invoiceNumber: string;
  discount: number;
  discountType: "flat" | "percentage";
  taxRate: number;
  taxType: "flat" | "percentage";
  paymentMode: "cash" | "bank" | "credit";
  paidNow: number;
  notes: string;
  selectedAccountId: string;
  created_at: string;
  total: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  heldList: HeldPurchase[];
  suppliers: Supplier[];
  onResume: (held: HeldPurchase) => void;
  onDelete: (id: string) => void;
};

export function HeldPurchasesModal({
  isOpen,
  onClose,
  heldList,
  suppliers,
  onResume,
  onDelete,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600/30 border border-violet-400/30 flex items-center justify-center text-violet-300">
              <Clock size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide flex items-center gap-2">
                <span>Held / Parked Purchases</span>
                <span className="text-[10px] font-extrabold bg-violet-500/30 text-violet-200 px-2 py-0.5 rounded-full border border-violet-400/30">
                  {heldList.length} Draft{heldList.length === 1 ? "" : "s"}
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Resume any held supplier invoice or switch between multiple purchase orders
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
          {heldList.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-300">
                <ShoppingCart size={28} />
              </div>
              <p className="text-sm font-extrabold text-slate-700">No Held Purchases</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                You can hold any active purchase order anytime by pressing <kbd className="font-mono bg-slate-100 border border-slate-200 px-1 py-0.5 rounded text-[10px] text-slate-600">F6</kbd> or clicking &quot;Hold Bill&quot;.
              </p>
            </div>
          ) : (
            heldList.map((held) => {
              const supplier = suppliers.find((s) => s.id === held.selectedSupplierId);
              const itemCount = held.cart?.reduce((acc, c) => acc + (c.quantity || 1), 0) || 0;
              const dateFormatted = new Date(held.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              });

              return (
                <div
                  key={held.id}
                  className="bg-white border border-slate-200 hover:border-violet-300 rounded-2xl p-4 shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-slate-900 truncate">
                        {held.tag || "Untitled Purchase"}
                      </span>
                      {held.invoiceNumber && (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1">
                          <Receipt size={10} /> Inv #{held.invoiceNumber}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <Calendar size={10} /> {dateFormatted}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-violet-700">
                        <Building2 size={12} className="text-violet-500" />
                        {supplier ? supplier.name : "Cash / Walk-in"}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="font-semibold text-slate-700">
                        {held.cart?.length || 0} Products ({itemCount} Total Qty)
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="font-black text-slate-900 font-mono">
                        Rs {Math.round(held.total || 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Quick Items Preview */}
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      {held.cart?.slice(0, 3).map((item, i) => (
                        <span
                          key={i}
                          className="text-[9.5px] font-bold bg-slate-50 text-slate-600 border border-slate-200/80 px-2 py-0.5 rounded-md truncate max-w-[140px]"
                        >
                          {item.name} × {item.quantity}
                        </span>
                      ))}
                      {(held.cart?.length || 0) > 3 && (
                        <span className="text-[9px] font-bold text-slate-400">
                          +{(held.cart?.length || 0) - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <button
                      type="button"
                      onClick={() => onResume(held)}
                      className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Play size={12} className="fill-current" />
                      <span>Resume</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(held.id)}
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                      title="Delete Draft"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <AlertCircle size={12} className="text-amber-500" />
            Held purchases are safely stored on this computer.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
