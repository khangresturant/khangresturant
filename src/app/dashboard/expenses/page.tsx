"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingDown, Plus, Loader2, Calendar, FileText, ArrowRight, Target, AlertTriangle, ShieldCheck, Edit3, 
  DollarSign, Wallet, Tag, Search, BarChart3, Filter, Trash2, 
  ArrowUpRight, AlertCircle, CheckCircle2, ChevronRight, Clock, History, Edit2, X, RefreshCw, Layers
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { SubscriptionBlocker } from "@/components/dashboard/SubscriptionBlocker";

interface ExpenseHistoryEntry {
  version: number;
  action: "CREATED" | "EDITED";
  edited_at: string;
  edited_by: string;
  reason: string;
  changes?: Array<{ field: string; from: any; to: any }>;
  snapshot?: {
    category?: string;
    amount?: number;
    account_id?: string | null;
    account_name?: string;
    remarks?: string | null;
  };
}

interface Expense {
  id: string;
  name: string; // Description/Category
  amount: number;
  expense_type: string; // Category string
  remarks: string | null;
  created_at: string;
  account_id: string | null;
  account_name?: string;
  edit_history?: ExpenseHistoryEntry[];
}

interface CashAccount {
  id: string;
  name: string;
  current_balance: number;
  type: string; // cash, bank, etc.
}

const defaultCategories = [
  "Utilities (Electricity/Water)",
  "Staff Salaries",
  "Shop Rent",
  "Tea & Refreshment",
  "Marketing & Ads",
  "Miscellaneous"
];

// Helper to get category colors
const getCategoryStyle = (cat: string) => {
  const c = cat.toLowerCase();
  if (c.includes("utility") || c.includes("electricity")) return { bg: "bg-violet-50", text: "text-violet-750", border: "border-violet-100", dot: "bg-violet-500" };
  if (c.includes("salary") || c.includes("staff")) return { bg: "bg-sky-50", text: "text-sky-750", border: "border-sky-100", dot: "bg-sky-500" };
  if (c.includes("rent") || c.includes("shop")) return { bg: "bg-amber-50", text: "text-amber-750", border: "border-amber-100", dot: "bg-amber-500" };
  if (c.includes("tea") || c.includes("refreshment")) return { bg: "bg-emerald-50", text: "text-emerald-750", border: "border-emerald-100", dot: "bg-emerald-500" };
  if (c.includes("marketing") || c.includes("ads")) return { bg: "bg-rose-50", text: "text-rose-750", border: "border-rose-100", dot: "bg-rose-500" };
  return { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-150", dot: "bg-slate-500" };
};

export default function ExpensesPage() {
  const { shopId, userId, userName, allowExpenses, activeClosingBook, industryType } = useShop();
  const supabase = createClient();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  // New expense form states
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState(defaultCategories[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [expenseRemarks, setExpenseRemarks] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "budget">("logs");

  // Edit Expense states
  const [isEditExpenseOpen, setIsEditExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editCategory, setEditCategory] = useState(defaultCategories[0]);
  const [editCustomCategory, setEditCustomCategory] = useState("");
  const [editAmount, setEditAmount] = useState(0);
  const [editAccountId, setEditAccountId] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [editReason, setEditReason] = useState("");
  const [submittingEditExpense, setSubmittingEditExpense] = useState(false);

  // Version History Modal states
  const [isExpenseHistoryOpen, setIsExpenseHistoryOpen] = useState(false);
  const [selectedHistoryExpense, setSelectedHistoryExpense] = useState<Expense | null>(null);

  // Deleting State
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({
    "Utilities (Electricity/Water)": 30000,
    "Staff Salaries": 150000,
    "Shop Rent": 60000,
    "Tea & Refreshment": 15000,
    "Marketing & Ads": 25000,
    "Miscellaneous": 20000
  });

  const [isEditBudgetOpen, setIsEditBudgetOpen] = useState(false);
  const [editBudgetCat, setEditBudgetCat] = useState("");
  const [editBudgetAmount, setEditBudgetAmount] = useState(0);

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    if (!shopId) return;
    try {
      const saved = localStorage.getItem(`budget_limits_${shopId}`);
      if (saved) setCategoryBudgets(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    }
  }, [shopId]);

  const saveBudgetLimit = (cat: string, amt: number) => {
    const updated = { ...categoryBudgets, [cat]: amt };
    setCategoryBudgets(updated);
    if (shopId) localStorage.setItem(`budget_limits_${shopId}`, JSON.stringify(updated));
    toast.success(`Monthly budget limit for ${cat} set to Rs ${amt.toLocaleString()}!`);
    setIsEditBudgetOpen(false);
  };

  useEffect(() => {
    if (!shopId) return;

    loadData();

    // Realtime subscription (only if in active book view)
    let channel: any = null;
    if (!activeClosingBook) {
      channel = supabase
        .channel(`expenses-realtime-${shopId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `shop_id=eq.${shopId}` }, loadData)
        .subscribe((status: string) => setIsLive(status === "SUBSCRIBED"));
    } else {
      setIsLive(false);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [shopId, activeClosingBook]);

  async function loadData() {
    if (!shopId) return;
    setLoading(true);
    try {
      // Build expense query
      let expQuery = supabase
        .from("expenses")
        .select("*")
        .eq("shop_id", shopId);

      if (activeClosingBook) {
        expQuery = expQuery.eq("closing_book_id", activeClosingBook.id);
      } else {
        expQuery = expQuery.is("closing_book_id", null);
      }

      // Execute all 3 database fetches in parallel
      const [expsRes, accsRes, vehiclesRes] = await Promise.all([
        expQuery.order("created_at", { ascending: false }),
        supabase
          .from("cash_accounts")
          .select("id,name,current_balance,type")
          .eq("shop_id", shopId),
        industryType === "showroom"
          ? supabase
              .from("showroom_vehicles")
              .select("id, make, model, plate_number")
              .eq("shop_id", shopId)
          : Promise.resolve({ data: null, error: null })
      ]);

      if (expsRes.error) throw expsRes.error;
      if (accsRes.error) throw accsRes.error;

      const accs = accsRes.data || [];
      const exps = expsRes.data || [];
      const rawVh = vehiclesRes.data || [];

      // Map to vehicles format expected by the frontend
      const vh = rawVh.map((v: any) => ({
        id: v.id,
        name: `${v.make} ${v.model}`,
        registration_number: v.plate_number
      }));

      setAccounts(accs);
      if (accs.length > 0 && !selectedAccountId) {
        const cashInHandAcc = accs.find((a: any) => a.name.toLowerCase() === "cash in hand");
        setSelectedAccountId(cashInHandAcc ? cashInHandAcc.id : accs[0].id);
      }

      // Map account names
      const accMap: Record<string, string> = {};
      accs.forEach((a: any) => { accMap[a.id] = a.name; });

      setExpenses(exps.map((e: any) => ({
        ...e,
        amount: Number(e.amount),
        account_name: e.account_id ? (accMap[e.account_id] || "Unknown Wallet") : "Cash Account",
        edit_history: Array.isArray(e.edit_history) ? e.edit_history : []
      })));

      if (industryType === "showroom") {
        setVehicles(vh);
      }

    } catch (err: any) {
      toast.error("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (expenseAmount <= 0 || !selectedAccountId) {
      toast.error("Please enter a valid amount and select a funding wallet.");
      return;
    }

    const finalCategory = expenseCategory === "Custom" ? customCategory.trim() : expenseCategory;
    if (!finalCategory) {
      toast.error("Please specify an expense category.");
      return;
    }

    // Check account limit
    const currentAcc = accounts.find(a => a.id === selectedAccountId);
    if (currentAcc && currentAcc.current_balance < expenseAmount) {
      const confirmProceed = window.confirm(`Selected wallet has Rs ${currentAcc.current_balance.toLocaleString()}, which is less than the expense of Rs ${expenseAmount.toLocaleString()}. Proceeding will make the wallet negative. Do you want to continue?`);
      if (!confirmProceed) return;
    }

    let finalRemarks = expenseRemarks.trim();
    if (industryType === "showroom" && selectedVehicleId) {
      const matchedVeh = vehicles.find(v => v.id === selectedVehicleId);
      if (matchedVeh) {
        const vehStr = `[Vehicle: ${matchedVeh.registration_number || matchedVeh.name}]`;
        finalRemarks = finalRemarks ? `${vehStr} - ${finalRemarks}` : vehStr;
      }
    }

    setSubmittingExpense(true);
    try {
      // 1. Get active register session
      const { data: session } = await supabase
        .from("register_sessions")
        .select("id")
        .eq("shop_id", shopId)
        .eq("status", "open")
        .maybeSingle();

      const initialHistory: ExpenseHistoryEntry[] = [{
        version: 1,
        action: "CREATED",
        edited_at: new Date().toISOString(),
        edited_by: userName || "Admin",
        reason: "Initial Expense Entry",
        snapshot: {
          category: finalCategory,
          amount: expenseAmount,
          account_id: selectedAccountId,
          account_name: currentAcc?.name || "Wallet",
          remarks: finalRemarks || null
        }
      }];

      // 2. Insert expense
      const { data: exp, error: expErr } = await supabase
        .from("expenses")
        .insert({
          shop_id: shopId,
          register_session_id: session?.id || null,
          user_id: userId || null,
          name: finalCategory,
          expense_type: finalCategory,
          amount: expenseAmount,
          remarks: finalRemarks || null,
          account_id: selectedAccountId,
          edit_history: initialHistory
        })
        .select()
        .single();

      if (expErr) throw expErr;

      // 3. Update cash account balance
      if (currentAcc) {
        await supabase
          .from("cash_accounts")
          .update({ current_balance: Number(currentAcc.current_balance) - expenseAmount })
          .eq("id", selectedAccountId);
      }

      // 4. Log in account transactions (with links)
      await supabase.from("account_transactions").insert({
        shop_id: shopId,
        account_id: selectedAccountId,
        type: "withdrawal",
        amount: expenseAmount,
        ref_type: "expense",
        ref_id: exp.id,
        remarks: `Expense: ${finalCategory} ${finalRemarks ? `| ${finalRemarks}` : ""}`
      });

      toast.success("Expense recorded and synced to GL ledger! 💸");
      setIsAddExpenseOpen(false);
      setExpenseAmount(0);
      setExpenseRemarks("");
      setCustomCategory("");
      setSelectedVehicleId("");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingExpense(false);
    }
  }

  // ─── EDIT & HISTORY HANDLERS ────────────────────────────────
  function openEditExpenseModal(exp: Expense) {
    setEditingExpense(exp);
    const isDefault = defaultCategories.includes(exp.expense_type);
    setEditCategory(isDefault ? exp.expense_type : "Custom");
    setEditCustomCategory(isDefault ? "" : exp.expense_type);
    setEditAmount(exp.amount);
    setEditAccountId(exp.account_id || (accounts[0] ? accounts[0].id : ""));
    setEditRemarks(exp.remarks || "");
    setEditReason("");
    setIsEditExpenseOpen(true);
  }

  function openExpenseHistoryModal(exp: Expense) {
    setSelectedHistoryExpense(exp);
    setIsExpenseHistoryOpen(true);
  }

  async function handleSaveExpenseEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingExpense) return;
    if (editAmount <= 0) {
      toast.error("Please enter a valid expense amount.");
      return;
    }
    if (!editReason.trim()) {
      toast.error("Please specify a reason for editing this expense (required for version audit history).");
      return;
    }

    const finalCategory = editCategory === "Custom" ? editCustomCategory.trim() : editCategory;
    if (!finalCategory) {
      toast.error("Please specify an expense category.");
      return;
    }

    setSubmittingEditExpense(true);
    try {
      // 1. Detect field-level changes
      const changes: Array<{ field: string; from: any; to: any }> = [];
      if (editingExpense.expense_type !== finalCategory) {
        changes.push({ field: "Category", from: editingExpense.expense_type, to: finalCategory });
      }
      if (editingExpense.amount !== editAmount) {
        changes.push({ field: "Amount", from: `Rs ${editingExpense.amount.toLocaleString()}`, to: `Rs ${editAmount.toLocaleString()}` });
      }
      if (editingExpense.account_id !== editAccountId) {
        const oldAccName = accounts.find(a => a.id === editingExpense.account_id)?.name || "Previous Wallet";
        const newAccName = accounts.find(a => a.id === editAccountId)?.name || "New Wallet";
        changes.push({ field: "Funding Wallet", from: oldAccName, to: newAccName });
      }
      if ((editingExpense.remarks || "") !== editRemarks.trim()) {
        changes.push({ field: "Remarks", from: editingExpense.remarks || "-", to: editRemarks.trim() || "-" });
      }

      const existingHistory: ExpenseHistoryEntry[] = Array.isArray(editingExpense.edit_history) ? [...editingExpense.edit_history] : [];
      
      // If initial creation is not yet in history array, prepend version 1
      if (existingHistory.length === 0) {
        existingHistory.push({
          version: 1,
          action: "CREATED",
          edited_at: editingExpense.created_at,
          edited_by: "Initial Creator",
          reason: "Initial Expense Record",
          snapshot: {
            category: editingExpense.expense_type,
            amount: editingExpense.amount,
            account_id: editingExpense.account_id,
            account_name: editingExpense.account_name,
            remarks: editingExpense.remarks
          }
        });
      }

      const newVersionNumber = existingHistory.length + 1;
      const targetAccName = accounts.find(a => a.id === editAccountId)?.name || "Wallet";

      // Append new version entry
      const updatedHistory: ExpenseHistoryEntry[] = [
        ...existingHistory,
        {
          version: newVersionNumber,
          action: "EDITED",
          edited_at: new Date().toISOString(),
          edited_by: userName || "Admin",
          reason: editReason.trim(),
          changes: changes.length > 0 ? changes : [{ field: "Details Updated", from: "Previous", to: "Modified" }],
          snapshot: {
            category: finalCategory,
            amount: editAmount,
            account_id: editAccountId,
            account_name: targetAccName,
            remarks: editRemarks.trim()
          }
        }
      ];

      // 2. Adjust Cash Accounts if amount or wallet changed
      const oldAmt = editingExpense.amount;
      const newAmt = editAmount;
      const oldAccId = editingExpense.account_id;
      const newAccId = editAccountId;

      if (oldAccId === newAccId) {
        const delta = newAmt - oldAmt;
        if (delta !== 0 && oldAccId) {
          const targetAcc = accounts.find(a => a.id === oldAccId);
          if (targetAcc) {
            await supabase
              .from("cash_accounts")
              .update({ current_balance: Number(targetAcc.current_balance) - delta })
              .eq("id", oldAccId);
          }
        }
      } else {
        // Wallet changed: Refund old wallet, debit new wallet
        if (oldAccId) {
          const oldAcc = accounts.find(a => a.id === oldAccId);
          if (oldAcc) {
            await supabase
              .from("cash_accounts")
              .update({ current_balance: Number(oldAcc.current_balance) + oldAmt })
              .eq("id", oldAccId);
          }
        }
        if (newAccId) {
          const newAcc = accounts.find(a => a.id === newAccId);
          if (newAcc) {
            await supabase
              .from("cash_accounts")
              .update({ current_balance: Number(newAcc.current_balance) - newAmt })
              .eq("id", newAccId);
          }
        }
      }

      // 3. Update account transactions record
      await supabase
        .from("account_transactions")
        .update({
          account_id: newAccId || null,
          amount: newAmt,
          remarks: `Expense: ${finalCategory} ${editRemarks.trim() ? `| ${editRemarks.trim()}` : ""} (v${newVersionNumber})`
        })
        .eq("ref_id", editingExpense.id);

      // 4. Update expenses table
      const { error: expUpdateErr } = await supabase
        .from("expenses")
        .update({
          name: finalCategory,
          expense_type: finalCategory,
          amount: newAmt,
          account_id: newAccId || null,
          remarks: editRemarks.trim() || null,
          edit_history: updatedHistory
        })
        .eq("id", editingExpense.id);

      if (expUpdateErr) throw expUpdateErr;

      toast.success(`Expense updated & Version #${newVersionNumber} logged! 📜⚡`);
      setIsEditExpenseOpen(false);
      setEditingExpense(null);
      loadData();
    } catch (err: any) {
      console.error("Save expense edit error:", err);
      toast.error("Failed to save expense edit: " + err.message);
    } finally {
      setSubmittingEditExpense(false);
    }
  }

  async function handleDeleteExpense(exp: Expense) {
    if (!window.confirm(`Are you sure you want to delete expense "${exp.expense_type}" of Rs ${exp.amount.toLocaleString()}? This will refund the cash wallet and reverse ledger entries.`)) {
      return;
    }

    setDeletingExpenseId(exp.id);
    try {
      // 1. Refund the cash account
      if (exp.account_id) {
        const acc = accounts.find(a => a.id === exp.account_id);
        if (acc) {
          await supabase
            .from("cash_accounts")
            .update({ current_balance: Number(acc.current_balance) + exp.amount })
            .eq("id", exp.account_id);
        }
      }

      // 2. Delete linked account transaction
      await supabase.from("account_transactions").delete().eq("ref_id", exp.id);

      // 3. Delete expense
      const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
      if (error) throw error;

      toast.success("Expense deleted & wallet balance refunded.");
      loadData();
    } catch (err: any) {
      toast.error("Failed to delete expense: " + err.message);
    } finally {
      setDeletingExpenseId(null);
    }
  }

  // Filter logic
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.remarks?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.expense_type?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategoryFilter === "all" || e.expense_type === selectedCategoryFilter;
    
    const matchesDate = !filterDate || new Date(e.created_at).toISOString().split("T")[0] === filterDate;
    
    return matchesSearch && matchesCategory && matchesDate;
  });

  const totalExpenseSum = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Compute category breakdown percentages
  const categoriesBreakdown = Array.from(new Set(expenses.map(e => e.expense_type))).map(cat => {
    const sum = expenses.filter(e => e.expense_type === cat).reduce((s, e) => s + e.amount, 0);
    const overallSum = expenses.reduce((s, e) => s + e.amount, 0) || 1;
    return {
      name: cat,
      amount: sum,
percentage: Math.round((sum / overallSum) * 100)
    };
  }).sort((a, b) => b.amount - a.amount);

  if (!allowExpenses) {
    return <SubscriptionBlocker featureName="Enterprise Advanced Expenses Tracker" requiredPlan="Premium" description="Requires premium plan subscription tier" />;
  }

  return (
    <div className="space-y-3 text-slate-800 font-sans">
      
      {/* Top Title Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200/80 bg-white p-3 rounded-2xl border shadow-2xs">
        <div>
          <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl text-white shadow-2xs">
              <TrendingDown className="h-4 w-4" />
            </span>
            Enterprise Expense Tracker
          </h1>
          <p className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1.5">
            GL Synced posting for utilities, payroll, and overheads.
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8.5px] font-black border ${isLive ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
              <span className={`w-1 h-1 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              {isLive ? "CONNECTED" : "OFFLINE"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {!activeClosingBook && (
            <button 
              onClick={() => setIsAddExpenseOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Plus size={13} className="stroke-[3]" /> Add Expense Log
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-1">
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "logs"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
          }`}
        >
          <FileText size={13} /> Expense Logs & History
        </button>
        <button
          onClick={() => setActiveTab("budget")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "budget"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
          }`}
        >
          <Target size={13} /> Budget & Limit Controls
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === "logs" && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        
        {/* Left Side: Stats & Wallet Breakdown */}
        <div className="lg:col-span-4 space-y-3">
          
          {/* Card: Total Expenses */}
          <div className="bg-gradient-to-br from-slate-900 to-zinc-950 text-white rounded-2xl p-3.5 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-600/10 rounded-full blur-xl" />
            
            <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block">Total Expense Volume</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl md:text-2xl font-black tracking-tight">Rs {totalExpenseSum.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 font-bold">PKR</span>
            </div>
            
            <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
              <span>Recorded Entries:</span>
              <span className="font-bold text-white">{filteredExpenses.length} logs</span>
            </div>
          </div>

          {/* Card: Category Breakdown Percentage */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 size={13} className="text-slate-400" /> Category Breakdown
              </span>
              <span className="text-[9.5px] font-bold text-slate-400">{categoriesBreakdown.length} categories</span>
            </div>

            <div className="space-y-2">
              {categoriesBreakdown.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">No categorised logs</div>
              ) : (
                categoriesBreakdown.map(cat => {
                  const pill = getCategoryStyle(cat.name);
                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 truncate max-w-[150px]">{cat.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">Rs {cat.amount.toLocaleString()}</span>
                          <span className="text-[9.5px] text-slate-400 w-6 text-right">{cat.percentage}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${pill.dot}`} style={{ width: `${cat.percentage}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Card: Linked Accounts / Funding Wallets */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet size={13} className="text-slate-400" /> Payment Wallets
              </span>
            </div>

            <div className="space-y-1.5">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-white rounded-lg shadow-2xs border border-slate-100 text-slate-600">
                      <Wallet size={11} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{acc.name}</p>
                      <p className="text-[8.5px] text-slate-400 capitalize">{acc.type}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-black ${acc.current_balance < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    Rs {Number(acc.current_balance).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Side: Log Feed Table & Filters */}
        <div className="lg:col-span-8 space-y-2.5">
          
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="relative w-full sm:w-56">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search remark, category..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 h-8 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-medium shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              <select 
                value={selectedCategoryFilter}
                onChange={e => setSelectedCategoryFilter(e.target.value)}
                className="text-xs px-2.5 h-8 bg-slate-50 border border-slate-200 rounded-lg font-bold cursor-pointer focus:outline-none shadow-2xs"
              >
                <option value="all">All Categories</option>
                {Array.from(new Set(expenses.map(e => e.expense_type))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <input 
                type="date" 
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="text-xs px-2 h-8 bg-slate-50 border border-slate-200 rounded-lg font-bold cursor-pointer focus:outline-none shadow-2xs"
              />

              {(filterDate || searchQuery || selectedCategoryFilter !== "all") && (
                <button 
                  onClick={() => { setFilterDate(""); setSearchQuery(""); setSelectedCategoryFilter("all"); }}
                  className="text-xs px-2.5 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold transition-all shrink-0 cursor-pointer shadow-2xs"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Premium Logs Table Container */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-1.5">
              <div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Posted Expense Ledger</span>
              </div>
              <span className="text-[9px] text-slate-400 font-bold bg-slate-50 px-2 py-0.2 rounded border border-slate-200">GL Double-entry</span>
            </div>

            <div className="overflow-x-auto">
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-medium">No recorded expenses found.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200 select-none">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Wallet</th>
                      <th className="py-2.5 px-3">Remarks</th>
                      <th className="py-2.5 px-3 text-right">Amount (Rs)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Version</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium">
                    {filteredExpenses.map(exp => {
                      const pill = getCategoryStyle(exp.expense_type);
                      const historyCount = Array.isArray(exp.edit_history) ? exp.edit_history.length : 0;
                      const hasBeenEdited = historyCount > 1;

                      return (
                        <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-2.5 text-slate-400 font-mono text-[11px]">{new Date(exp.created_at).toLocaleDateString()}</td>
                          <td className="py-2 px-2.5">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-black border uppercase tracking-wider ${pill.bg} ${pill.text} ${pill.border}`}>
                              <span className={`w-1 h-1 rounded-full ${pill.dot}`} />
                              {exp.expense_type}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-slate-700 font-bold text-xs">
                            <span className="inline-flex items-center gap-1">
                              <Wallet size={10} className="text-slate-400" /> {exp.account_name}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-slate-500 text-xs">{exp.remarks || "Shop overhead"}</td>
                          <td className="py-2 px-2.5 text-right font-black text-rose-600 font-mono text-xs">Rs {exp.amount.toLocaleString()}</td>
                          <td className="py-2 px-2.5 text-center">
                            <span className="inline-flex items-center gap-0.5 text-[8.5px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                              GL Synced
                            </span>
                          </td>
                          
                          {/* Version Badge */}
                          <td className="py-2 px-2.5 text-center">
                            {hasBeenEdited ? (
                              <button 
                                onClick={() => openExpenseHistoryModal(exp)}
                                className="inline-flex items-center gap-0.5 text-[9px] font-black text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded cursor-pointer transition-all shadow-2xs"
                                title="Click to view full revision history"
                              >
                                <History size={10} className="text-amber-600" />
                                v{historyCount}
                              </button>
                            ) : (
                              <button 
                                onClick={() => openExpenseHistoryModal(exp)}
                                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded cursor-pointer transition-all shadow-2xs"
                                title="Click to view history details"
                              >
                                <Clock size={9} className="text-slate-400" />
                                v1
                              </button>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="py-2 px-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditExpenseModal(exp)}
                                className="p-1 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-md transition-all cursor-pointer border border-slate-200 shadow-2xs"
                                title="Edit Expense"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(exp)}
                                disabled={deletingExpenseId === exp.id}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all cursor-pointer disabled:opacity-50"
                                title="Delete Expense"
                              >
                                {deletingExpenseId === exp.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

      </div>

      )}

      {/* Budget Controls Tab */}
      {activeTab === "budget" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Total Monthly Budget Cap</span>
              <p className="text-xl font-black text-slate-900 dark:text-white">
                Rs {Object.values(categoryBudgets).reduce((a, b) => a + b, 0).toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-500 font-semibold mt-1 block">Allocated across {Object.keys(categoryBudgets).length} categories</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Total Spent This Month</span>
              <p className="text-xl font-black text-rose-600 dark:text-rose-400">
                Rs {totalExpenseSum.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-500 font-semibold mt-1 block">
                {Math.round((totalExpenseSum / (Object.values(categoryBudgets).reduce((a, b) => a + b, 0) || 1)) * 100)}% of total budget consumed
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Remaining Safety Cushion</span>
              <p className={`text-xl font-black ${
                (Object.values(categoryBudgets).reduce((a, b) => a + b, 0) - totalExpenseSum) < 0 ? "text-red-600" : "text-emerald-600 dark:text-emerald-400"
              }`}>
                Rs {(Object.values(categoryBudgets).reduce((a, b) => a + b, 0) - totalExpenseSum).toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-500 font-semibold mt-1 block">Real-time dynamic calculation</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Category Budget Limits</h3>
                <p className="text-xs text-slate-500">Monitor monthly allocations vs live recorded expenses per category</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {defaultCategories.map(cat => {
                const limit = categoryBudgets[cat] || 0;
                const spent = expenses.filter(e => e.expense_type === cat).reduce((sum, e) => sum + e.amount, 0);
                const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                const isOver = spent > limit && limit > 0;

                return (
                  <div key={cat} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 relative overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white line-clamp-1">{cat}</span>
                        <button
                          onClick={() => {
                            setEditBudgetCat(cat);
                            setEditBudgetAmount(limit);
                            setIsEditBudgetOpen(true);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                          title="Set Limit"
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>

                      <div className="flex items-baseline justify-between text-xs mb-2">
                        <span className="text-slate-500">Spent: <b className="text-slate-900 dark:text-white">Rs {spent.toLocaleString()}</b></span>
                        <span className="text-slate-400">Limit: Rs {limit.toLocaleString()}</span>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOver ? "bg-rose-500" : percent > 80 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                      <span className={`font-bold ${isOver ? "text-rose-600 dark:text-rose-400" : "text-slate-500"}`}>
                        {isOver ? `Over by Rs ${(spent - limit).toLocaleString()}` : `Left: Rs ${(limit - spent).toLocaleString()}`}
                      </span>
                      <span className={`font-extrabold px-2 py-0.5 rounded-full text-[10px] ${
                        isOver
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                          : percent > 80
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                      }`}>
                        {percent}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD EXPENSE ──────────────────────────────────── */}
      <AnimatePresence>
        {isAddExpenseOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <Plus size={16} />
                  </span>
                  <h2 className="text-sm font-black text-slate-900">Record New Shop Expense</h2>
                </div>
                <button 
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-3.5">
                <div>
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1.5">1. Category Classification</label>
                  <select 
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-bold cursor-pointer"
                  >
                    {defaultCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="Custom">+ Custom Expense Category</option>
                  </select>
                </div>

                {expenseCategory === "Custom" && (
                  <div>
                    <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1.5">Specify Custom Category</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Generator Fuel, AC Repair, Legal Fees..." 
                      value={customCategory}
                      onChange={e => setCustomCategory(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-bold"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1.5">2. Funding Wallet / Cash Account</label>
                  <select 
                    value={selectedAccountId}
                    onChange={e => setSelectedAccountId(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-bold cursor-pointer"
                    required
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Balance: Rs {Number(acc.current_balance).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1.5">3. Expense Amount (PKR)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">Rs</span>
                    <input 
                      type="number" 
                      placeholder="0" 
                      value={expenseAmount || ""}
                      onChange={e => setExpenseAmount(Number(e.target.value))}
                      className="w-full h-10 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1.5">4. Remarks / Details</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Utility bill payment for June 2026..." 
                    value={expenseRemarks}
                    onChange={e => setExpenseRemarks(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-bold"
                  />
                </div>

                {industryType === "showroom" && vehicles.length > 0 && (
                  <div>
                    <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1.5">Link to Showroom Vehicle</label>
                    <select
                      value={selectedVehicleId}
                      onChange={e => setSelectedVehicleId(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-bold cursor-pointer"
                    >
                      <option value="">-- No Vehicle Selected --</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.registration_number || "No Plate"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsAddExpenseOpen(false)}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingExpense}
                    className="flex-1 h-10 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/10 disabled:opacity-50"
                  >
                    {submittingExpense && <Loader2 size={13} className="animate-spin" />} Save & Synced
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: EDIT EXPENSE (WITH VERSION HISTORY AUDIT) ─────── */}
      <AnimatePresence>
        {isEditExpenseOpen && editingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                    <Edit2 size={16} />
                  </span>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Edit Expense & Log Revision</h2>
                    <p className="text-[10px] text-slate-450 font-medium">All modifications are preserved in immutable version history</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setIsEditExpenseOpen(false); setEditingExpense(null); }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveExpenseEdit} className="space-y-3.5">
                <div>
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1.5">1. Category Classification</label>
                  <select 
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold cursor-pointer"
                  >
                    {defaultCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="Custom">+ Custom Expense Category</option>
                  </select>
                </div>

                {editCategory === "Custom" && (
                  <div>
                    <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1.5">Specify Custom Category</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Generator Fuel, AC Repair, Legal Fees..." 
                      value={editCustomCategory}
                      onChange={e => setEditCustomCategory(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1.5">2. Funding Wallet / Cash Account</label>
                  <select 
                    value={editAccountId}
                    onChange={e => setEditAccountId(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold cursor-pointer"
                    required
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Balance: Rs {Number(acc.current_balance).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1.5">3. Expense Amount (PKR)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">Rs</span>
                    <input 
                      type="number" 
                      placeholder="0" 
                      value={editAmount || ""}
                      onChange={e => setEditAmount(Number(e.target.value))}
                      className="w-full h-10 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1.5">4. Remarks / Details</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Utility bill payment for June 2026..." 
                    value={editRemarks}
                    onChange={e => setEditRemarks(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold"
                  />
                </div>

                {/* Mandatory Reason for Audit Version History */}
                <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/80">
                  <label className="text-[9px] font-black text-amber-900 uppercase tracking-widest block mb-1 flex items-center gap-1">
                    <History size={11} className="text-amber-700" />
                    5. Reason for Editing (Required for Version History) *
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Amount corrected according to official bill receipt..." 
                    value={editReason}
                    onChange={e => setEditReason(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-amber-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-medium text-slate-800"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => { setIsEditExpenseOpen(false); setEditingExpense(null); }}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingEditExpense}
                    className="flex-1 h-10 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50"
                  >
                    {submittingEditExpense && <Loader2 size={13} className="animate-spin" />} Save & Log Version
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: VERSION REVISION HISTORY TIMELINE ───────────── */}
      <AnimatePresence>
        {isExpenseHistoryOpen && selectedHistoryExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                    <History size={18} />
                  </span>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Expense Version History & Audit Trail</h2>
                    <p className="text-[10px] text-slate-450 font-medium">
                      Category: <span className="font-bold text-slate-700">{selectedHistoryExpense.expense_type}</span> | Current Amount: <span className="font-bold text-rose-600 font-mono">Rs {selectedHistoryExpense.amount.toLocaleString()}</span>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setIsExpenseHistoryOpen(false); setSelectedHistoryExpense(null); }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Timeline Container */}
              <div className="overflow-y-auto pr-1 space-y-4 flex-1">
                {(() => {
                  const history = Array.isArray(selectedHistoryExpense.edit_history) && selectedHistoryExpense.edit_history.length > 0
                    ? selectedHistoryExpense.edit_history
                    : [
                        {
                          version: 1,
                          action: "CREATED" as const,
                          edited_at: selectedHistoryExpense.created_at,
                          edited_by: "Initial Creator",
                          reason: "Initial Expense Record",
                          snapshot: {
                            category: selectedHistoryExpense.expense_type,
                            amount: selectedHistoryExpense.amount,
                            account_name: selectedHistoryExpense.account_name,
                            remarks: selectedHistoryExpense.remarks
                          }
                        }
                      ];

                  return (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {history.map((ver, idx) => {
                        const isLatest = idx === history.length - 1;
                        const isCreation = ver.action === "CREATED" || ver.version === 1;

                        return (
                          <div key={idx} className="relative group">
                            {/* Dot on timeline */}
                            <span className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
                              isLatest ? "bg-amber-600 ring-2 ring-amber-200" : isCreation ? "bg-emerald-500" : "bg-slate-400"
                            }`} />

                            {/* Revision Card */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 hover:border-slate-300 transition-all">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                    isCreation ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                  }`}>
                                    Version #{ver.version} {isCreation ? "(Created)" : "(Modified)"}
                                  </span>
                                  {isLatest && history.length > 1 && (
                                    <span className="px-2 py-0.5 bg-slate-900 text-white rounded-full text-[9px] font-bold">
                                      Active Version
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-450 font-mono">
                                  {new Date(ver.edited_at).toLocaleString()}
                                </span>
                              </div>

                              <div className="text-xs text-slate-600 flex items-center gap-2">
                                <span className="font-semibold text-slate-500">By:</span>
                                <span className="font-bold text-slate-800">{ver.edited_by || "Admin"}</span>
                                <span className="text-slate-300">•</span>
                                <span className="font-semibold text-slate-500">Reason:</span>
                                <span className="italic text-slate-700">&quot;{ver.reason}&quot;</span>
                              </div>

                              {/* Field Diffs */}
                              {ver.changes && ver.changes.length > 0 && (
                                <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                                  <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider block">Changed Attributes:</span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {ver.changes.map((chg, cIdx) => (
                                      <div key={cIdx} className="bg-white p-2 rounded-xl border border-slate-200 text-[11px] space-y-0.5">
                                        <span className="font-bold text-slate-500 block text-[10px] uppercase">{chg.field}</span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="line-through text-slate-400 font-medium">{String(chg.from)}</span>
                                          <ArrowRight size={10} className="text-amber-600 shrink-0" />
                                          <span className="font-bold text-slate-900">{String(chg.to)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Snapshot view if creation */}
                              {isCreation && ver.snapshot && (
                                <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                                  <div>
                                    <span className="text-slate-400 block">Category:</span>
                                    <span className="font-bold text-slate-800">{ver.snapshot.category}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block">Amount:</span>
                                    <span className="font-black text-rose-600 font-mono">Rs {Number(ver.snapshot.amount || 0).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block">Wallet:</span>
                                    <span className="font-bold text-slate-800">{ver.snapshot.account_name || "Cash Wallet"}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => { setIsExpenseHistoryOpen(false); setSelectedHistoryExpense(null); }}
                  className="px-5 h-9 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all"
                >
                  Close History
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: EDIT CATEGORY BUDGET ───────────────────────── */}
      <AnimatePresence>
        {isEditBudgetOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl">
                    <Target size={16} />
                  </span>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">Set Budget Limit</h2>
                </div>
                <button 
                  onClick={() => setIsEditBudgetOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Category</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{editBudgetCat}</p>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Monthly Limit (PKR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs</span>
                    <input
                      type="number"
                      value={editBudgetAmount || ""}
                      onChange={e => setEditBudgetAmount(Number(e.target.value))}
                      placeholder="e.g. 50000"
                      className="w-full pl-8 pr-3 h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                      min="0"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditBudgetOpen(false)}
                    className="flex-1 h-9 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => saveBudgetLimit(editBudgetCat, editBudgetAmount)}
                    className="flex-1 h-9 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    Save Limit
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
