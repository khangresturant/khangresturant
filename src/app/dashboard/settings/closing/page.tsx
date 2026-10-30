"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Calendar, ShieldAlert, Award, FileText, CheckCircle,
  ArrowRight, Loader2, Sparkles, Plus, Clock, HelpCircle
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SubscriptionBlocker } from "@/components/dashboard/SubscriptionBlocker";

export default function FiscalClosingPage() {
  const { shopId, userId, activeClosingBook, closingBooks, fetchClosingBooks, switchClosingBook, allowIndustrialAccounts } = useShop();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [closingName, setClosingName] = useState("");
  const [closingType, setClosingType] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [closingRemarks, setClosingRemarks] = useState("");

  // Preview stats
  const [previewStats, setPreviewStats] = useState({
    totalCustomers: 0,
    netOutstanding: 0,
    totalProducts: 0,
    totalStockValuation: 0
  });

  useEffect(() => {
    if (shopId) {
      loadPreviewStats();
    }
  }, [shopId]);

  const loadPreviewStats = async () => {
    try {
      // 1. Fetch Customers and Balances
      const { data: parties } = await supabase
        .from("parties")
        .select("current_balance")
        .eq("shop_id", shopId);

      const totalCustomers = parties?.length || 0;
      const netOutstanding = (parties || []).reduce((acc: number, p: { current_balance: number | null }) => acc + Number(p.current_balance || 0), 0);

      // 2. Fetch Products
      const { data: products } = await supabase
        .from("products")
        .select("current_stock, purchase_price_single")
        .eq("shop_id", shopId);

      const totalProducts = products?.length || 0;
      const totalStockValuation = (products || []).reduce((acc: number, p: { current_stock: number | null; purchase_price_single: number | null }) => acc + (Number(p.current_stock || 0) * Number(p.purchase_price_single || 0)), 0);

      setPreviewStats({
        totalCustomers,
        netOutstanding,
        totalProducts,
        totalStockValuation
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handlePerformClosing = async () => {
    if (!closingName.trim()) {
      toast.error("Please enter a name for the Closing Book!");
      return;
    }

    setLoading(true);
    try {
      // Call the single atomic stored procedure (RPC) on the database
      const { data: bookId, error: closingErr } = await supabase
        .rpc("perform_period_closing", {
          p_shop_id: shopId,
          p_name: closingName.trim(),
          p_type: closingType,
          p_closed_by: userId,
          p_remarks: closingRemarks.trim() || null
        });

      if (closingErr) throw closingErr;

      toast.success("Closing Book executed successfully! Previous period archived.");
      setIsWizardOpen(false);
      setClosingName("");
      setClosingRemarks("");

      // Update global context list
      await fetchClosingBooks();

    } catch (err: any) {
      toast.error("Closing execution failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!allowIndustrialAccounts) {
    return (
      <SubscriptionBlocker 
        featureName="Fiscal Period Closings" 
        requiredPlan="Starter" 
        description="Requires a Starter or Premium plan to lock seasonal books, archive ledgers and roll forward balances." 
      />
    );
  }

  return (
    <div className="p-3.5 sm:p-4 md:p-5 space-y-4 max-w-[1600px] mx-auto font-sans max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="text-indigo-600" />
            Fiscal Period Closings
          </h1>
          
        </div>

        <Button
          onClick={() => {
            loadPreviewStats();
            setIsWizardOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 shadow-md shadow-indigo-100 rounded-xl"
        >
          <Plus size={16} className="mr-2" /> Start Period Closing
        </Button>
      </div>

      {/* Switch Warning */}
      {activeClosingBook && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="font-bold text-amber-800 text-xs">Read-Only View Enabled</h4>
            <p className="text-[11px] text-amber-700/90 mt-0.5 leading-relaxed">
              You are currently viewing historical records for <strong>{activeClosingBook.name}</strong>. Writing, editing, or creating new sales, purchases, or ledger entries is locked until you switch back.
            </p>
            <button
              onClick={() => switchClosingBook(null)}
              className="text-[10px] font-extrabold text-indigo-700 hover:underline mt-1.5 uppercase tracking-wider block"
            >
              ← Back to Active Period
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Explainer Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
            <h3 className="font-bold text-slate-800 text-sm">How Period Closing Works?</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">1</div>
                <h4 className="font-bold text-slate-800 text-xs">Snapshot Data</h4>
                <p className="text-[10px] text-slate-450 leading-relaxed">
                  System saves the exact balances of all customers and quantities of all stocks at the closing moment.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">2</div>
                <h4 className="font-bold text-slate-800 text-xs">Archive Transactions</h4>
                <p className="text-[10px] text-slate-450 leading-relaxed">
                  All current invoices, bills, and expenses are tagged with the closing book, clearing the active ledger tables.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">3</div>
                <h4 className="font-bold text-slate-800 text-xs">Set Openings</h4>
                <p className="text-[10px] text-slate-450 leading-relaxed">
                  Current customer credits become their new initial opening balances, allowing you to start fresh.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex items-center gap-2.5 text-slate-500 text-xs font-semibold bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
              <HelpCircle className="text-slate-400" size={16} />
              <span>Have questions about tax closings? Please refer to the manual or consult your auditor.</span>
            </div>
          </div>

          {/* Past Closing Books List */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Past Closing History</h3>

            {closingBooks.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-2xl border-slate-200">
                <Clock className="mx-auto text-slate-300 mb-2" size={24} />
                <p className="text-xs text-slate-400">No closing history records found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-black uppercase tracking-wider bg-slate-50/50">
                      <th className="py-2.5 px-4">Closing Name</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Closed Date</th>
                      <th className="py-2.5 px-4">Remarks</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {closingBooks.map((book) => {
                      const isActiveView = activeClosingBook?.id === book.id;
                      return (
                        <tr key={book.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/40 font-medium text-slate-700">
                          <td className="py-2.5 px-3.5 text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            📖 {book.name}
                          </td>
                          <td className="py-2.5 px-3.5 text-xs capitalize font-semibold text-slate-500">
                            {book.type}
                          </td>
                          <td className="py-2.5 px-3.5 text-xs text-slate-450 font-mono">
                            {new Date(book.closed_at).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-xs text-slate-500 max-w-[150px] truncate" title={book.remarks}>
                            {book.remarks || "—"}
                          </td>
                          <td className="py-2.5 px-3.5 text-xs text-center">
                            {isActiveView ? (
                              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold border border-amber-200">
                                Viewing Current
                              </span>
                            ) : (
                              <button
                                onClick={() => switchClosingBook(book)}
                                className="bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-slate-600 hover:text-indigo-650 px-2 py-0.5 rounded-lg text-[9px] font-black cursor-pointer transition-colors shadow-xs"
                              >
                                Switch view
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active Period Status */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Active Book Overview</h3>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs border-b pb-2">
                <span className="text-slate-400 font-semibold">Active Period:</span>
                <span className="font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  OPEN
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">TOTAL OUTSTANDING UDHAAR:</span>
                  <span className="text-lg font-black text-rose-600 font-mono">Rs {previewStats.netOutstanding.toLocaleString()}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">STOCK VALUATION AT COST:</span>
                  <span className="text-lg font-black text-indigo-600 font-mono">Rs {previewStats.totalStockValuation.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                <div className="bg-slate-50/70 p-2.5 rounded-xl text-center border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold block">CUSTOMERS</span>
                  <span className="text-sm font-black text-slate-800">{previewStats.totalCustomers}</span>
                </div>
                <div className="bg-slate-50/70 p-2.5 rounded-xl text-center border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold block">PRODUCTS</span>
                  <span className="text-sm font-black text-slate-800">{previewStats.totalProducts}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Closing Book Execution Wizard Dialog */}
      <AnimatePresence>
        {isWizardOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setIsWizardOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg relative z-10 font-sans border border-slate-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b pb-3.5">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Perform Period Closing</h3>
                  <p className="text-[11px] text-slate-450 mt-0.5">Start the snapshot wizard to archive the current period</p>
                </div>
                <button onClick={() => setIsWizardOpen(false)} className="text-slate-400 hover:text-slate-650 cursor-pointer">
                  &times;
                </button>
              </div>

              {/* Warnings and Checklist */}
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-[10.5px] text-rose-700 font-semibold space-y-1.5">
                <span className="font-black text-rose-800 block mb-1">⚠️ CRITICAL CAUTION & CONFIRMATION:</span>
                <p>1. Performing a closing will archive all current active sales, payments and expenses.</p>
                <p>2. The closing snapshots CANNOT be edited afterward.</p>
                <p>3. Active ledgers will start fresh with zero active transaction entries.</p>
              </div>

              {/* Form Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Closing Title / Book Name</label>
                  <Input
                    placeholder="e.g. June 2026 Monthly Closing, Season 2026 Closing"
                    value={closingName}
                    onChange={(e) => setClosingName(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(["weekly", "monthly", "yearly"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setClosingType(type)}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${closingType === type
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Remarks / Note (Optional)</label>
                  <Input
                    placeholder="Provide any additional closing notes"
                    value={closingRemarks}
                    onChange={(e) => setClosingRemarks(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>

                {/* Confirm Action */}
                <Button
                  onClick={handlePerformClosing}
                  disabled={loading}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold h-11 shadow-md shadow-rose-100 rounded-xl"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Confirm & Archive Period
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
