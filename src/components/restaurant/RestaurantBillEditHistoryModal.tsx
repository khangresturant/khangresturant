"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import type { RestaurantBillEditHistoryEntry } from "@/lib/restaurant-bill-edit";

type CurrentBill = {
  total_amount: number;
  discount?: number;
  paid_amount?: number;
  tax_amount?: number;
};

type CurrentItem = {
  name: string;
  quantity: number;
  unit_price: number;
};

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  history: RestaurantBillEditHistoryEntry[];
  currentBill: CurrentBill | null;
  currentItems: CurrentItem[];
  loadingItems?: boolean;
  language?: "en" | "ur";
};

export function RestaurantBillEditHistoryModal({
  open,
  title,
  onClose,
  history,
  currentBill,
  currentItems,
  loadingItems,
  language = "en",
}: Props) {
  const isEn = language === "en";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl relative z-10 max-h-[85vh] flex flex-col border border-slate-100"
          >
            <div className="p-4 border-b flex justify-between items-center shrink-0">
              <h3 className="font-bold text-slate-800">{title}</h3>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
              {loadingItems ? (
                <div className="flex justify-center py-16 text-slate-500 text-xs">
                  <Loader2 className="animate-spin mr-2" size={16} /> Loading…
                </div>
              ) : history.length === 0 ? (
                <p className="text-center text-slate-400 py-12 text-xs">
                  {isEn ? "No bill edits recorded yet." : "ابھی کوئی بل ایڈٹ لاگ نہیں۔"}
                </p>
              ) : (
                history.map((hist, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex flex-wrap justify-between gap-2 text-[10px] font-bold text-slate-500 uppercase">
                      <div>
                        {isEn ? "Version" : "ورژن"} #{history.length - idx}{" "}
                        ({isEn ? "before this edit" : "اس edit سے پہلے"})
                      </div>
                      <div className="normal-case font-medium">
                        {new Date(hist.edited_at).toLocaleString()}
                        {hist.edited_by ? ` · ${hist.edited_by}` : ""}
                      </div>
                    </div>
                    {hist.changes && hist.changes.length > 0 && (
                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-[11px] space-y-1">
                        <div className="font-bold text-amber-800">
                          {isEn ? "What changed in this edit:" : "اس edit میں تبدیلیاں:"}
                        </div>
                        {hist.changes.map((c, i) => (
                          <div key={i} className="text-slate-700">
                            • {c.name} - {c.detail}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-3 text-xs">
                        <div className="font-black text-amber-800 text-[10px] uppercase mb-2">
                          {isEn ? "Old bill" : "پurana بل"}
                        </div>
                        <div className="flex justify-between">
                          <div>{isEn ? "Total" : "کل"}</div>
                          <div className="font-bold">Rs {Math.round(hist.total_amount).toLocaleString()}</div>
                        </div>
                        {hist.items?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-amber-100 max-h-28 overflow-y-auto space-y-1">
                            {hist.items.map((it, i) => (
                              <div key={i} className="flex justify-between text-[10px]">
                                <div className="truncate max-w-[140px]">{it.product_name}</div>
                                <div className="font-mono">
                                  {it.quantity}×{Math.round(it.unit_price)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-3 text-xs">
                        <div className="font-black text-emerald-800 text-[10px] uppercase mb-2">
                          {idx === 0 && currentBill
                            ? isEn
                              ? "Current bill (latest)"
                              : "موجودہ بل"
                            : isEn
                              ? "After that edit"
                              : "اس کے بعد"}
                        </div>
                        {idx === 0 && currentBill ? (
                          <>
                            <div className="flex justify-between">
                              <div>{isEn ? "Total" : "کل"}</div>
                              <div className="font-bold">
                                Rs {Math.round(currentBill.total_amount).toLocaleString()}
                              </div>
                            </div>
                            {currentItems.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-emerald-100 max-h-28 overflow-y-auto space-y-1">
                                {currentItems.map((it, i) => (
                                  <div key={i} className="flex justify-between text-[10px]">
                                    <div className="truncate max-w-[140px]">{it.name}</div>
                                    <div className="font-mono">
                                      {it.quantity}×{Math.round(it.unit_price)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-[10px] text-slate-500">
                            {isEn ? "See newer version above." : "تفصیل اوپر نئے ورژن میں۔"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
