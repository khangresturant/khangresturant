"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Trash2, Loader2, ReceiptText, Edit } from "lucide-react";
import { StatusChip, PaymentModeChip } from "./StatusChips";
import type { PODetailItem } from "./types";

type PODetail = {
  id: string;
  created_at: string;
  total_amount: number;
  paid_amount: number;
  discount: number;
  tax_amount: number;
  status: string;
  payment_mode: string;
  notes: string | null;
  invoice_number: string | null;
  is_voided: boolean;
  supplierName: string;
  supplierPhone: string;
};

type Props = {
  isOpen: boolean;
  po: PODetail | null;
  items: PODetailItem[];
  loading: boolean;
  voidingId: string | null;
  shopName: string;
  onClose: () => void;
  onVoid: (id: string) => void;
  onEdit?: (id: string) => void;
  onDownloadPDF: (po: PODetail, items: PODetailItem[]) => void;
};

export function PODetailModal({ isOpen, po, items, loading, voidingId, shopName, onClose, onVoid, onEdit, onDownloadPDF }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div>
                <h3 className="font-black text-slate-900 flex items-center gap-2">
                  <ReceiptText size={17} className="text-violet-600" />
                  Purchase Detail
                  {po && <span className="font-mono text-violet-600 text-sm">#{po.id?.slice(0, 8).toUpperCase()}</span>}
                </h3>
                {po && <p className="text-xs text-slate-400 mt-0.5">{new Date(po.created_at).toLocaleString()}</p>}
              </div>
              <div className="flex items-center gap-2">
                {po && !po.is_voided && (
                  <>
                    <button onClick={() => onDownloadPDF(po, items)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer">
                      <Download size={12} /> PDF
                    </button>
                    {onEdit && (
                      <button onClick={() => onEdit(po.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-bold border border-amber-200 transition-all cursor-pointer">
                        <Edit size={12} /> Edit Bill
                      </button>
                    )}
                    <button onClick={() => onVoid(po.id)} disabled={!!voidingId}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold border border-rose-200 transition-all cursor-pointer">
                      {voidingId ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Void
                    </button>
                  </>
                )}
                <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"><X size={15} /></button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
            ) : po && (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Supplier + Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-violet-400 uppercase mb-1">Supplier</p>
                    <p className="font-black text-slate-800">{po.supplierName}</p>
                    {po.supplierPhone && <p className="text-xs text-slate-500 mt-0.5">{po.supplierPhone}</p>}
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Status & Mode</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <StatusChip status={po.status} isVoided={po.is_voided} />
                      <PaymentModeChip mode={po.payment_mode} />
                    </div>
                    {po.invoice_number && <p className="text-[10px] text-slate-400 mt-1.5">Inv #: {po.invoice_number}</p>}
                  </div>
                </div>

                {/* Items */}
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Purchased Items ({items.length})</p>
                    <span className="text-[9.5px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100">
                      Batch & Expiry Traceable
                    </span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-slate-400 font-black uppercase border-b border-slate-100">
                        <th className="py-2.5 px-4 text-left">Product & Batch Details</th>
                        <th className="py-2.5 px-4 text-left">Variant/Unit</th>
                        <th className="py-2.5 px-4 text-right">Qty</th>
                        <th className="py-2.5 px-4 text-right">Price</th>
                        <th className="py-2.5 px-4 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {items.map((it, i) => (
                        <tr key={i} className="font-medium text-slate-700 hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-4">
                            <p className="font-bold text-slate-900">{it.productName}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {it.batch_number && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Batch: {it.batch_number}
                                </span>
                              )}
                              {it.expiry_date && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                  Exp: {it.expiry_date}
                                </span>
                              )}
                              {it.bonus_quantity && it.bonus_quantity > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                                  🎁 +{it.bonus_quantity} Bonus Free
                                </span>
                              ) : null}
                              {it.discount_amount && it.discount_amount > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                                  -Rs {it.discount_amount} Disc
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 font-semibold">{it.variantName || it.unit || "—"}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className="font-bold text-slate-900">{it.quantity}</span>
                            {it.bonus_quantity && it.bonus_quantity > 0 ? (
                              <p className="text-[9.5px] text-purple-600 font-bold">+{it.bonus_quantity} Bonus</p>
                            ) : null}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-600">Rs {Number(it.unit_price).toLocaleString()}</td>
                          <td className="py-2.5 px-4 text-right font-black text-slate-900">Rs {Number(it.subtotal).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financials */}
                <div className="bg-slate-50 rounded-2xl p-4 space-y-1.5">
                  {po.discount > 0 && (
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Discount</span><span className="text-emerald-600">-Rs {Number(po.discount).toLocaleString()}</span>
                    </div>
                  )}
                  {po.tax_amount > 0 && (
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Tax</span><span className="text-blue-600">+Rs {Number(po.tax_amount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2 mt-2">
                    <span>Total</span><span>Rs {Math.round(Number(po.total_amount)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-emerald-600">
                    <span>Paid</span><span>Rs {Math.round(Number(po.paid_amount)).toLocaleString()}</span>
                  </div>
                  {Number(po.total_amount) - Number(po.paid_amount) > 0 && (
                    <div className="flex justify-between text-xs font-bold text-rose-600">
                      <span>Outstanding</span><span>Rs {Math.round(Number(po.total_amount) - Number(po.paid_amount)).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {po.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
                    <p className="text-[9px] font-black text-amber-500 uppercase mb-1">Notes</p>
                    <p className="text-xs text-amber-800">{po.notes}</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
