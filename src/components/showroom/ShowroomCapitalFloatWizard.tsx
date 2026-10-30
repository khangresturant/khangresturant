"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins,
  ShieldAlert,
  CheckCircle2,
  Building2,
  X,
  Loader2,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { autoPostShowroomCapitalFloat } from "@/lib/showroom-accounting";
import { formatPKR } from "@/lib/showroom-ops";

interface ShowroomCapitalFloatWizardProps {
  isOpen: boolean;
  onClose: () => void;
  shopId?: string;
  accounts?: { id: string; name: string; current_balance?: number | null; type?: string | null }[];
  currentCashInHand?: number;
  currentCashBalance?: number;
  onSuccess?: () => void;
}

export function ShowroomCapitalFloatWizard({
  isOpen,
  onClose,
  shopId = "",
  accounts = [],
  currentCashInHand,
  currentCashBalance,
  onSuccess,
}: ShowroomCapitalFloatWizardProps) {
  const supabase = createClient();
  const [internalAccounts, setInternalAccounts] = useState(accounts);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || "");

  const effectiveCash = currentCashInHand !== undefined ? currentCashInHand : currentCashBalance !== undefined ? currentCashBalance : 0;
  const isNegative = effectiveCash < 0;

  const [amount, setAmount] = useState<number | string>(
    isNegative ? Math.abs(effectiveCash) + 100000 : 500000
  );
  const [narration, setNarration] = useState(
    "ابتدائی شو روم سرمایہ کاری (Opening Showroom Capital Float)"
  );
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (accounts && accounts.length > 0) {
      setInternalAccounts(accounts);
      if (!selectedAccountId) setSelectedAccountId(accounts[0].id);
    } else if (shopId && isOpen) {
      supabase
        .from("cash_accounts")
        .select("id, name, current_balance, type")
        .eq("shop_id", shopId)
        .then(({ data }: { data: any }) => {
          if (data && data.length > 0) {
            setInternalAccounts(data);
            setSelectedAccountId(data[0].id);
          }
        });
    }
  }, [accounts, shopId, isOpen]);

  if (!isOpen) return null;

  const targetAccount = internalAccounts.find((a) => a.id === selectedAccountId) || internalAccounts[0];

  const handleApplyPreset = (val: number) => {
    setAmount(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0) {
      toast.error("Please enter a valid capital amount greater than zero.");
      return;
    }
    if (!targetAccount) {
      toast.error("Please select a target cash/bank account.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await autoPostShowroomCapitalFloat(
        supabase,
        shopId,
        targetAccount.id,
        numAmount,
        narration
      );

      if (!res.success) {
        throw new Error(res.error || "Failed to inject capital float");
      }

      toast.success(
        `🎉 Successfully injected ${formatPKR(numAmount)} Capital Float into ${targetAccount.name}! Double-entry voucher posted (Debit 1001 Cash, Credit 3100 Capital).`
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to post opening capital.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 p-6 text-white relative">
            <button
              onClick={onClose}
              className="absolute right-5 top-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-md shadow-inner">
                <Coins size={26} className="text-amber-300" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-violet-200 bg-white/10 px-2.5 py-0.5 rounded-full">
                  Accounting Float Wizard
                </span>
                <h2 className="text-xl font-black mt-1">
                  Showroom Capital Float & Cash Normalization
                </h2>
                <p className="text-xs text-violet-100">
                  ابتدائی سرمایہ کاری و کیش نارملائزیشن وزرڈ
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Status Alert */}
            {isNegative ? (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-black text-amber-800 dark:text-amber-300 text-sm">
                  <ShieldAlert size={18} className="text-amber-600" />
                  <span>Negative Asset Balance Anomaly Detected</span>
                </div>
                <p className="leading-relaxed">
                  Your current Cash in Hand is{" "}
                  <strong className="text-rose-600 font-mono">
                    {formatPKR(currentCashInHand)}
                  </strong>
                  . When vehicles are purchased in cash without an initial capital float, the cash asset drops into an abnormal negative balance.
                </p>
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  Injecting Owner&apos;s Capital restores a natural <strong>Debit</strong> balance in Cash in Hand (1001) and establishes <strong>Credit</strong> in Owner&apos;s Capital (3100).
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Current Cash in Hand:{" "}
                    <span className="font-mono">{formatPKR(effectiveCash)}</span>
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                    Add additional operating capital float or investment to fund upcoming vehicle sourcing and dealership transactions.
                  </p>
                </div>
              </div>
            )}

            {/* Account Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                Target Cash / Bank Account (کھاتہ منتخب کریں)
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
              >
                {internalAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type || "Cash"}) — Current: {formatPKR(acc.current_balance)}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                Capital Injection Amount (سرمایہ کی رقم PKR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                  Rs
                </span>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 1000000"
                  className="pl-10 h-11 text-base font-black font-mono border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400">Quick Presets:</span>
                {isNegative && (
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(Math.abs(effectiveCash))}
                    className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                  >
                    Exact Deficit ({formatPKR(Math.abs(effectiveCash))})
                  </button>
                )}
                {isNegative && (
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(Math.abs(effectiveCash) + 200000)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 cursor-pointer"
                  >
                    Deficit + 200k Buffer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleApplyPreset(500000)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  500,000
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(1000000)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  1,000,000
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(2000000)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  2,000,000
                </button>
              </div>
            </div>

            {/* Narration */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                Journal Voucher Narration (تفصیل / ریمارکس)
              </label>
              <Input
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Narration for general ledger"
                className="h-10 text-xs font-bold"
              />
            </div>

            {/* Accounting Impact Preview */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-150 dark:border-slate-700 text-xs space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Double-Entry Posting Preview (جرنل واؤچر پریویو)
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[9px] text-emerald-600 font-bold uppercase">Debit (Increase Asset)</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">1001 - Cash in Hand</p>
                  <p className="font-black text-emerald-600">+{formatPKR(amount)}</p>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[9px] text-blue-600 font-bold uppercase">Credit (Increase Equity)</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">3100 - Owner&apos;s Capital</p>
                  <p className="font-black text-blue-600">+{formatPKR(amount)}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="rounded-xl font-bold text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || Number(amount) <= 0}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs gap-2 rounded-xl shadow-lg shadow-violet-600/25 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Posting Balanced Voucher...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Post Capital Float</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
