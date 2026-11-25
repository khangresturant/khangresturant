"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, ListOrdered, FileText } from "lucide-react";
import type { RestaurantBillEditHistoryEntry } from "@/lib/restaurant-bill-edit";
import {
  billItemsAfterVersion,
  billTotalsAfterVersion,
  historyItemLineTotal,
  mapCurrentItemsToHistoryItems,
} from "@/lib/restaurant-bill-edit";

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

function BillItemsTable({
  items,
  isEn,
  emptyLabel,
}: {
  items: RestaurantBillEditHistoryEntry["items"];
  isEn: boolean;
  emptyLabel: string;
}) {
  if (!items.length) {
    return <p className="text-[10px] text-slate-400 italic py-2">{emptyLabel}</p>;
  }
  const subtotal = items.reduce((s, it) => s + historyItemLineTotal(it), 0);
  return (
  <motion.div initial={{ opacity: 1 }} className="border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="bg-slate-100 text-[9px] font-bold uppercase text-slate-500">
            <th className="p-2 pl-3">{isEn ? "Item" : "آئٹم"}</th>
            <th className="p-2 text-center w-14">{isEn ? "Qty" : "تعداد"}</th>
            <th className="p-2 text-right w-20">{isEn ? "Rate" : "قیمت"}</th>
            <th className="p-2 text-right w-24 pr-3">{isEn ? "Amount" : "رقم"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((it, i) => (
            <tr key={i} className="text-slate-700">
              <td className="p-2 pl-3 font-semibold">{it.product_name}</td>
              <td className="p-2 text-center font-mono font-bold">{it.quantity}</td>
              <td className="p-2 text-right font-mono">Rs {Math.round(it.unit_price).toLocaleString()}</td>
              <td className="p-2 text-right font-mono font-bold pr-3">
                Rs {Math.round(historyItemLineTotal(it)).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
            <td colSpan={3} className="p-2 pl-3 text-[10px] uppercase">
              {isEn ? "Items subtotal" : "اشیاء کا کل"}
            </td>
            <td className="p-2 text-right font-mono pr-3">Rs {Math.round(subtotal).toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    </motion.div>
  );
}

function formatHistoryWhen(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function BillTotalsFooter({
  totals,
  isEn,
  tone,
}: {
  totals: { total_amount: number; tax_amount: number; discount: number };
  isEn: boolean;
  tone: "amber" | "emerald";
}) {
  const border = tone === "amber" ? "border-amber-200 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/50";
  return (
    <div className={`mt-2 rounded-lg border ${border} p-2.5 space-y-1 text-[11px]`}>
      {totals.discount > 0 && (
        <div className="flex justify-between text-slate-600">
          <div>{isEn ? "Discount" : "رعایت"}</div>
          <div className="font-mono">− Rs {Math.round(totals.discount).toLocaleString()}</div>
        </div>
      )}
      {totals.tax_amount > 0 && (
        <div className="flex justify-between text-slate-600">
          <div>{isEn ? "Tax" : "ٹیکس"}</div>
          <div className="font-mono">+ Rs {Math.round(totals.tax_amount).toLocaleString()}</div>
        </div>
      )}
      <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200/80">
        <div>{isEn ? "Bill total" : "بل کا کل"}</div>
        <div className="font-mono">Rs {Math.round(totals.total_amount).toLocaleString()}</div>
      </div>
    </div>
  );
}

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
  const [viewTab, setViewTab] = useState<"changes" | "billwise">("billwise");
  const [versionIndex, setVersionIndex] = useState(0);

  const currentHistoryItems = useMemo(
    () => mapCurrentItemsToHistoryItems(currentItems),
    [currentItems]
  );

  useEffect(() => {
    if (open) setVersionIndex(0);
  }, [open, history.length]);

  const versionCount = history.length;
  const safeVersion = Math.min(versionIndex, Math.max(0, versionCount - 1));
  const selected = history[safeVersion];
  const afterItems = billItemsAfterVersion(history, safeVersion, currentHistoryItems);
  const beforeTotals = selected
    ? {
        total_amount: selected.total_amount,
        tax_amount: selected.tax_amount,
        discount: selected.discount,
      }
    : { total_amount: 0, tax_amount: 0, discount: 0 };
  const afterTotals = billTotalsAfterVersion(history, safeVersion, currentBill);

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
            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl relative z-10 max-h-[90vh] flex flex-col border border-slate-100"
          >
            <div className="p-4 border-b flex flex-wrap justify-between items-center gap-2 shrink-0">
              <h3 className="font-bold text-slate-800">{title}</h3>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setViewTab("billwise")}
                    className={`px-3 py-1.5 rounded-md flex items-center gap-1 ${
                      viewTab === "billwise" ? "bg-white shadow text-blue-700" : "text-slate-500"
                    }`}
                  >
                    <FileText size={12} />
                    {isEn ? "Bill-wise" : "بل وار"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewTab("changes")}
                    className={`px-3 py-1.5 rounded-md flex items-center gap-1 ${
                      viewTab === "changes" ? "bg-white shadow text-blue-700" : "text-slate-500"
                    }`}
                  >
                    <ListOrdered size={12} />
                    {isEn ? "Changes" : "تبدیلیاں"}
                  </button>
                </div>
                <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
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
              ) : viewTab === "billwise" ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {history.map((hist, idx) => {
                      const vNum = versionCount - idx;
                      const active = idx === safeVersion;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setVersionIndex(idx)}
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all ${
                            active
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                          }`}
                        >
                          {isEn ? `Version v${vNum}` : `ورژن v${vNum}`}
                          <span className="block opacity-80 font-normal">
                            {formatHistoryWhen(hist.edited_at).split(",")[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selected && (
                    <div className="text-[10px] text-slate-500 font-medium">
                      {formatHistoryWhen(selected.edited_at)}
                      {selected.edited_by ? ` · ${selected.edited_by}` : ""}
                    </div>
                  )}

                  <div className="grid lg:grid-cols-2 gap-4">
                    <div>
                      <div className="font-black text-amber-800 text-[10px] uppercase mb-2 tracking-wider">
                        {isEn ? "Previous bill (before edit)" : "پرانا بل (edit سے پہلے)"}
                      </div>
                      <BillItemsTable
                        items={selected?.items ?? []}
                        isEn={isEn}
                        emptyLabel={isEn ? "No lines." : "کوئی لائن نہیں۔"}
                      />
                      <BillTotalsFooter totals={beforeTotals} isEn={isEn} tone="amber" />
                    </div>
                    <div>
                      <div className="font-black text-emerald-800 text-[10px] uppercase mb-2 tracking-wider">
                        {isEn ? "New bill (after edit)" : "نیا بل (edit کے بعد)"}
                      </div>
                      <BillItemsTable
                        items={afterItems}
                        isEn={isEn}
                        emptyLabel={isEn ? "No lines." : "کوئی لائن نہیں۔"}
                      />
                      <BillTotalsFooter totals={afterTotals} isEn={isEn} tone="emerald" />
                    </div>
                  </div>

                  {selected?.changes && selected.changes.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px]">
                      <div className="font-bold text-slate-700 mb-1.5">
                        {isEn ? "Quick diff for this version" : "اس ورژن کی مختصر تبدیلی"}
                      </div>
                      <motion.div className="space-y-0.5">
                        {selected.changes.map((c, i) => (
                          <div key={i} className="text-slate-600">
                            • {c.name} - {c.detail}
                          </div>
                        ))}
                      </motion.div>
                    </div>
                  )}
                </>
              ) : (
                history.map((hist, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex flex-wrap justify-between gap-2 text-[10px] font-bold text-slate-500 uppercase">
                      <div>
                        {isEn ? "Version" : "ورژن"} #{history.length - idx}{" "}
                        ({isEn ? "before this edit" : "اس edit سے پہلے"})
                      </div>
                      <div className="normal-case font-medium">
                        {formatHistoryWhen(hist.edited_at)}
                        {hist.edited_by ? ` · ${hist.edited_by}` : ""}
                      </div>
                    </div>
                    {hist.changes && hist.changes.length > 0 && (
                      <motion.div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-[11px] space-y-1">
                        <motion.div className="font-bold text-amber-800">
                          {isEn ? "What changed in this edit:" : "اس edit میں تبدیلیاں:"}
                        </motion.div>
                        {hist.changes.map((c, i) => (
                          <motion.div key={i} className="text-slate-700">
                            • {c.name} - {c.detail}
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                    <motion.div className="grid md:grid-cols-2 gap-3">
                      <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-3 text-xs">
                        <div className="font-black text-amber-800 text-[10px] uppercase mb-2">
                          {isEn ? "Old bill" : "پرانا بل"}
                        </div>
                        <div className="flex justify-between">
                          <div>{isEn ? "Total" : "کل"}</div>
                          <div className="font-bold">Rs {Math.round(hist.total_amount).toLocaleString()}</div>
                        </div>
                        {hist.items?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-amber-100 max-h-40 overflow-y-auto space-y-1">
                            {hist.items.map((it, i) => (
                              <div key={i} className="flex justify-between text-[10px] gap-2">
                                <div className="truncate flex-1">{it.product_name}</div>
                                <div className="font-mono shrink-0">
                                  {it.quantity}×{Math.round(it.unit_price)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <motion.div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-3 text-xs">
                        <div className="font-black text-emerald-800 text-[10px] uppercase mb-2">
                          {isEn ? "After this edit" : "اس edit کے بعد"}
                        </div>
                        {(() => {
                          const after = billItemsAfterVersion(
                            history,
                            idx,
                            idx === 0 ? currentHistoryItems : []
                          );
                          const totals = billTotalsAfterVersion(
                            history,
                            idx,
                            idx === 0 ? currentBill : null
                          );
                          return (
                            <>
                              <div className="flex justify-between">
                                <div>{isEn ? "Total" : "کل"}</div>
                                <div className="font-bold">
                                  Rs {Math.round(totals.total_amount).toLocaleString()}
                                </div>
                              </div>
                              {after.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-emerald-100 max-h-40 overflow-y-auto space-y-1">
                                  {after.map((it, i) => (
                                    <motion.div key={i} className="flex justify-between text-[10px] gap-2">
                                      <div className="truncate flex-1">{it.product_name}</div>
                                      <div className="font-mono shrink-0">
                                        {it.quantity}×{Math.round(it.unit_price)}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </motion.div>
                    </motion.div>
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
