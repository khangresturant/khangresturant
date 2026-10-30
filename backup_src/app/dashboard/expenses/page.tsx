"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingDown, Plus, Loader2, Calendar, FileText, ArrowRight, DollarSign, Wallet, Tag } from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Expense {
  id: string;
  name: string; // Description/Category
  amount: number;
  expense_type: string; // Category string
  remarks: string | null;
  created_at: string;
  account_id: string | null;
  account_name?: string;
}

interface CashAccount {
  id: string;
  name: string;
  current_balance: number;
}

const defaultCategories = [
  "Utilities (Electricity/Water)",
  "Staff Salaries",
  "Shop Rent",
  "Tea & Refreshment",
  "Marketing & Ads",
  "Miscellaneous"
];

export default function ExpensesPage() {
  const { shopId, userId } = useShop();
  const supabase = createClient();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  // New expense form
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState(defaultCategories[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [expenseRemarks, setExpenseRemarks] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Date filters
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    if (!shopId) return;

    loadData();

    // Realtime subscription
    const channel = supabase
      .channel(`expenses-realtime-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `shop_id=eq.${shopId}` }, loadData)
      .subscribe((status) => setIsLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId]);

  async function loadData() {
    if (!shopId) return;
    setLoading(true);
    try {
      // 1. Fetch expenses
      const { data: exps, error: expsErr } = await supabase
        .from("expenses")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (expsErr) throw expsErr;

      // 2. Fetch cash accounts for dropdown
      const { data: accs, error: accsErr } = await supabase
        .from("cash_accounts")
        .select("id,name,current_balance")
        .eq("shop_id", shopId);

      if (accsErr) throw accsErr;

      setAccounts(accs || []);
      if (accs && accs.length > 0 && !selectedAccountId) {
        const cashInHandAcc = accs.find(a => a.name.toLowerCase() === "cash in hand");
        setSelectedAccountId(cashInHandAcc ? cashInHandAcc.id : accs[0].id);
      }

      // Map account names to expenses
      const accMap: Record<string, string> = {};
      (accs || []).forEach(a => { accMap[a.id] = a.name; });

      setExpenses((exps || []).map((e: any) => ({
        ...e,
        amount: Number(e.amount),
        account_name: e.account_id ? (accMap[e.account_id] || "Unknown Account") : "Cash in Hand"
      })));

    } catch (err: any) {
      toast.error("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (expenseAmount <= 0 || !selectedAccountId) {
      toast.error("Please enter a valid amount and select an account.");
      return;
    }

    const finalCategory = expenseCategory === "Custom" ? customCategory.trim() : expenseCategory;
    if (!finalCategory) {
      toast.error("Please specify a category.");
      return;
    }

    setSubmittingExpense(true);
    try {
      // 1. Get active register session if exists
      const { data: session } = await supabase
        .from("register_sessions")
        .select("id")
        .eq("shop_id", shopId)
        .eq("status", "open")
        .maybeSingle();

      // 2. Insert expense record
      const { data: exp, error: expErr } = await supabase
        .from("expenses")
        .insert({
          shop_id: shopId,
          register_session_id: session?.id || null,
          user_id: userId || null,
          name: finalCategory,
          expense_type: finalCategory,
          amount: expenseAmount,
          remarks: expenseRemarks.trim() || null,
          account_id: selectedAccountId
        })
        .select()
        .single();

      if (expErr) throw expErr;

      // 3. Update account balance (Subtract)
      const currentAcc = accounts.find(a => a.id === selectedAccountId);
      if (currentAcc) {
        await supabase
          .from("cash_accounts")
          .update({ current_balance: currentAcc.current_balance - expenseAmount })
          .eq("id", selectedAccountId);
      }

      // 4. Log in account_transactions
      await supabase.from("account_transactions").insert({
        shop_id: shopId,
        account_id: selectedAccountId,
        type: "withdrawal",
        amount: expenseAmount,
        ref_type: "expense",
        ref_id: exp.id,
        remarks: `Expense: ${finalCategory} ${expenseRemarks ? `| ${expenseRemarks}` : ""}`
      });

      toast.success("Expense added successfully! 💸");
      setIsAddExpenseOpen(false);
      setExpenseAmount(0);
      setExpenseRemarks("");
      setCustomCategory("");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingExpense(false);
    }
  }

  // Filter expenses by date if selected
  const filteredExpenses = expenses.filter(e => {
    if (!filterDate) return true;
    const expDate = new Date(e.created_at).toISOString().split("T")[0];
    return expDate === filterDate;
  });

  const totalExpenseSum = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2.5 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl text-white shadow-md shadow-rose-200">
              <TrendingDown className="h-6 w-6" />
            </span>
            Daily Expenses
          </h1>
          <p className="text-slate-500 text-xs mt-1 flex items-center gap-2">
            Record utilities, bills, salary payouts and shop maintenance costs
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${isLive ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              {isLive ? "LIVE" : "Connecting..."}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="text-xs bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          />
          {filterDate && (
            <button 
              onClick={() => setFilterDate("")}
              className="text-xs px-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-all"
            >
              Clear Filter
            </button>
          )}
          <button 
            onClick={() => {
              if (accounts.length === 0) {
                toast.error("Please add a Cash/Bank account first in Accounts Ledger!");
                return;
              }
              setIsAddExpenseOpen(true);
            }}
            className="flex items-center gap-1.5 px-4.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-rose-200"
          >
            <Plus size={14} /> Add Expense
          </button>
        </div>
      </div>

      {loading && expenses.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left panel - Expense summary cards */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Expense Summary</h2>
            <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-50/20 to-transparent" />
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Total Expenses</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1">Rs {totalExpenseSum.toLocaleString()}</h3>
              <p className="text-[10px] text-slate-450 mt-4 leading-normal">
                {filterDate ? `For date: ${filterDate}` : "All-time recorded expenses in this shop"}
              </p>
            </div>

            {/* Quick stats on top categories */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Top Categories</h3>
              {Array.from(new Set(filteredExpenses.map(e => e.expense_type))).slice(0, 5).map(cat => {
                const catSum = filteredExpenses.filter(e => e.expense_type === cat).reduce((sum, e) => sum + e.amount, 0);
                return (
                  <div key={cat} className="flex justify-between items-center text-xs">
                    <span className="text-slate-655 font-bold flex items-center gap-1.5"><Tag size={12} className="text-rose-500" /> {cat}</span>
                    <span className="font-extrabold text-slate-800">Rs {catSum.toLocaleString()}</span>
                  </div>
                );
              })}
              {filteredExpenses.length === 0 && <p className="text-slate-400 text-center py-4 text-xs font-medium">No stats available</p>}
            </div>
          </div>

          {/* Right panel - Expense ledger log */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col">
            <h3 className="font-black text-slate-800 text-sm mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
              <FileText size={16} className="text-rose-500" /> Expense Ledger Table
            </h3>
            <div className="flex-1 overflow-x-auto">
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-20 text-slate-400 text-xs font-medium">No expenses logged for this period</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-black uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Source Account</th>
                      <th className="py-2.5 px-3">Remarks</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map(exp => (
                      <tr key={exp.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-3 px-3 text-slate-400 font-medium font-mono">{new Date(exp.created_at).toLocaleDateString()}</td>
                        <td className="py-3 px-3 font-bold text-slate-800">{exp.expense_type}</td>
                        <td className="py-3 px-3 text-slate-600 font-semibold flex items-center gap-1"><Wallet size={12} className="text-slate-400" /> {exp.account_name}</td>
                        <td className="py-3 px-3 text-slate-500 font-semibold">{exp.remarks || "-"}</td>
                        <td className="py-3 px-3 text-right font-black text-rose-600">Rs {exp.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      )}

      {/* MODAL: Add Expense */}
      <AnimatePresence>
        {isAddExpenseOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="absolute inset-0" onClick={() => setIsAddExpenseOpen(false)}
            />
            <motion.div 
              initial={{ scale:0.95, y:10 }} animate={{ scale:1, y:0 }} exit={{ scale:0.95, y:10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm relative z-10 border border-slate-100 shadow-xl"
            >
              <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                <Plus size={16} className="text-rose-600" /> Record Shop Expense
              </h3>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Expense Category</label>
                  <select 
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-bold text-slate-600"
                  >
                    {defaultCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="Custom">Custom Category...</option>
                  </select>
                </div>

                {expenseCategory === "Custom" && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Custom Category Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Generator Fuel, Water Dispenser" 
                      value={customCategory}
                      onChange={e => setCustomCategory(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-bold"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Source Account / Wallet</label>
                  <select 
                    value={selectedAccountId}
                    onChange={e => setSelectedAccountId(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-bold text-slate-600"
                    required
                  >
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (Rs {Number(a.current_balance).toLocaleString()})</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Expense Amount (Rs)</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={expenseAmount || ""}
                    onChange={e => setExpenseAmount(Number(e.target.value))}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-bold"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Remarks / Details</label>
                  <input 
                    type="text" 
                    placeholder="Brief description..." 
                    value={expenseRemarks}
                    onChange={e => setExpenseRemarks(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-bold"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsAddExpenseOpen(false)}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingExpense}
                    className="flex-1 h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-200 disabled:opacity-50"
                  >
                    {submittingExpense && <Loader2 size={13} className="animate-spin" />} Save Expense
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
