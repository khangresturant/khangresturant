"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wallet, Plus, ArrowRightLeft, Landmark, Coins, RefreshCw, Loader2, 
  ArrowUpRight, ArrowDownLeft, Trash2, Download, Scale, Layers, 
  TrendingUp, Users, Package, DollarSign 
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface CashAccount {
  id: string;
  name: string;
  type: string; // 'cash' | 'bank' | 'wallet'
  current_balance: number;
  created_at: string;
}

interface AccountTransaction {
  id: string;
  account_id: string;
  type: string; // 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out'
  amount: number;
  ref_type: string | null;
  ref_id: string | null;
  remarks: string | null;
  created_at: string;
  account_name?: string;
}

export default function AccountsPage() {
  const { shopId, shopName, permissions } = useShop();
  const supabase = createClient();

  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  // Modals state
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // New account form
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<"cash" | "bank" | "wallet">("cash");
  const [newAccBalance, setNewAccBalance] = useState(0);
  const [submittingAccount, setSubmittingAccount] = useState(false);

  // Transfer form
  const [transferSource, setTransferSource] = useState("");
  const [transferDest, setTransferDest] = useState("");
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferRemarks, setTransferRemarks] = useState("");
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Selected account filter for ledger
  const [selectedAccFilter, setSelectedAccFilter] = useState<string>("all");

  // Tab state
  const [activeTab, setActiveTab] = useState<"wallets" | "chart" | "trial">("wallets");

  // General Ledger and Trial Balance data states
  const [totalSales, setTotalSales] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalReceivable, setTotalReceivable] = useState(0);
  const [totalPayable, setTotalPayable] = useState(0);
  const [inventoryValue, setInventoryValue] = useState(0);

  useEffect(() => {
    if (!shopId) return;

    loadData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`accounts-realtime-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_accounts", filter: `shop_id=eq.${shopId}` }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_transactions", filter: `shop_id=eq.${shopId}` }, loadData)
      .subscribe((status) => setIsLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId]);

  async function loadData() {
    if (!shopId) return;
    setLoading(true);
    try {
      // 1. Fetch cash accounts
      let { data: accs, error: accsErr } = await supabase
        .from("cash_accounts")
        .select("*")
        .eq("shop_id", shopId)
        .order("name");
      
      if (accsErr) throw accsErr;

      // 2. If no accounts exist, auto-seed defaults
      if (!accs || accs.length === 0) {
        const defaults = [
          { shop_id: shopId, name: "Cash in Hand", type: "cash", current_balance: 0.00 },
          { shop_id: shopId, name: "Bank Account", type: "bank", current_balance: 0.00 },
          { shop_id: shopId, name: "Mobile Wallet", type: "wallet", current_balance: 0.00 }
        ];
        const { data: inserted, error: insertErr } = await supabase
          .from("cash_accounts")
          .insert(defaults)
          .select();
        
        if (insertErr) throw insertErr;
        accs = inserted || [];
        toast.success("Seeded default cash & bank accounts! 🏦");
      }

      setAccounts(accs);

      // 3. Fetch account transactions
      const { data: txs, error: txsErr } = await supabase
        .from("account_transactions")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (txsErr) throw txsErr;

      // Map account names
      const accMap: Record<string, string> = {};
      accs.forEach(a => { accMap[a.id] = a.name; });

      setTransactions((txs || []).map((t: any) => ({
        ...t,
        amount: Number(t.amount),
        account_name: accMap[t.account_id] || "Unknown Account"
      })));

      // 4. Fetch sales revenue
      const { data: salesData } = await supabase
        .from("invoices")
        .select("total_amount")
        .eq("shop_id", shopId)
        .neq("is_voided", true);
      const salesSum = (salesData || []).reduce((sum, inv) => sum + Number(inv.total_amount), 0);
      setTotalSales(salesSum);

      // 5. Fetch purchase orders (COGS)
      const { data: purchaseData } = await supabase
        .from("purchase_orders")
        .select("total_amount")
        .eq("shop_id", shopId)
        .neq("is_voided", true);
      const purchasesSum = (purchaseData || []).reduce((sum, po) => sum + Number(po.total_amount), 0);
      setTotalPurchases(purchasesSum);

      // 6. Fetch expenses
      const { data: expenseData } = await supabase
        .from("expenses")
        .select("amount")
        .eq("shop_id", shopId);
      const expensesSum = (expenseData || []).reduce((sum, exp) => sum + Number(exp.amount), 0);
      setTotalExpenses(expensesSum);

      // 7. Fetch parties (Receivables & Payables)
      const { data: partiesData } = await supabase
        .from("parties")
        .select("type, current_balance")
        .eq("shop_id", shopId);
      const receivablesSum = (partiesData || [])
        .filter(p => p.type === "customer" && Number(p.current_balance) > 0)
        .reduce((sum, p) => sum + Number(p.current_balance), 0);
      const payablesSum = (partiesData || [])
        .filter(p => p.type === "supplier" && Number(p.current_balance) > 0)
        .reduce((sum, p) => sum + Number(p.current_balance), 0);
      setTotalReceivable(receivablesSum);
      setTotalPayable(payablesSum);

      // 8. Fetch products (Inventory Asset Value)
      const { data: productsData } = await supabase
        .from("products")
        .select("current_stock, purchase_price_single")
        .eq("shop_id", shopId);
      const inventorySum = (productsData || []).reduce(
        (sum, p) => sum + (Number(p.purchase_price_single || 0) * Number(p.current_stock || 0)),
        0
      );
      setInventoryValue(inventorySum);

    } catch (err: any) {
      toast.error("Failed to load accounts: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (permissions?.actions?.edit_account === false) {
      toast.error("Access Denied: You do not have permission to add/edit accounts.");
      return;
    }
    if (!newAccName.trim()) return;
    setSubmittingAccount(true);
    try {
      const { data: newAcc, error } = await supabase
        .from("cash_accounts")
        .insert({
          shop_id: shopId,
          name: newAccName.trim(),
          type: newAccType,
          current_balance: newAccBalance
        })
        .select()
        .single();

      if (error) throw error;

      // Log opening balance transaction if > 0
      if (newAccBalance > 0) {
        await supabase.from("account_transactions").insert({
          shop_id: shopId,
          account_id: newAcc.id,
          type: "deposit",
          amount: newAccBalance,
          remarks: "Opening Balance"
        });
      }

      toast.success("Account added successfully! 🎉");
      setIsAddAccountOpen(false);
      setNewAccName("");
      setNewAccBalance(0);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingAccount(false);
    }
  }

  async function handleDeleteAccount(accountId: string) {
    if (permissions?.actions?.delete_account === false) {
      toast.error("Access Denied: You do not have permission to delete accounts.");
      return;
    }
    const acc = accounts.find(a => a.id === accountId);
    if (acc && acc.name.toLowerCase() === "cash in hand") {
      toast.error("The default 'Cash in Hand' account is required for system operations and cannot be deleted! 🚫");
      return;
    }
    if (!confirm("Are you sure you want to delete this account? Associated ledger logs will be permanently deleted, and referencing invoice records will be unlinked.")) return;
    try {
      // Unlink references first to avoid foreign key violations
      await Promise.all([
        supabase.from("invoices").update({ account_id: null }).eq("account_id", accountId),
        supabase.from("purchase_orders").update({ account_id: null }).eq("account_id", accountId),
        supabase.from("expenses").update({ account_id: null }).eq("account_id", accountId),
        supabase.from("credit_transactions").update({ account_id: null }).eq("account_id", accountId)
      ]);

      const { error } = await supabase
        .from("cash_accounts")
        .delete()
        .eq("id", accountId);

      if (error) throw error;
      toast.success("Account deleted successfully! 🗑️");
      loadData();
    } catch (err: any) {
      toast.error("Failed to delete account: " + err.message);
    }
  }

  async function handleDownloadPDF() {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text("HISAB X", 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Cash & Bank Account Ledger Report", 15, 26);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      const accFilterName = selectedAccFilter === "all" ? "All Accounts" : accounts.find(a => a.id === selectedAccFilter)?.name || "Selected Account";
      doc.text(`Account: ${accFilterName}`, 130, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Date Generated: ${new Date().toLocaleString()}`, 130, 26);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(15, 30, 195, 30);

      const body = filteredTransactions.map(tx => {
        const isInflow = tx.type === "deposit" || tx.type === "transfer_in";
        return [
          new Date(tx.created_at).toLocaleString(),
          tx.account_name || "Unknown",
          tx.type.replace("_", " ").toUpperCase(),
          tx.remarks || "-",
          `${isInflow ? "+" : "-"} Rs ${tx.amount.toLocaleString()}`
        ];
      });

      autoTable(doc, {
        head: [["Date / Time", "Account Name", "Transaction Type", "Remarks", "Amount"]],
        body: body,
        startY: 35,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
        columnStyles: { 4: { halign: "right", fontStyle: "bold" } },
        margin: { left: 15, right: 15 }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Powered by Hisab X POS", 15, 285);

      doc.save(`account_ledger_${selectedAccFilter}.pdf`);
      toast.success("PDF statement downloaded! 📄");
    } catch (err: any) {
      toast.error("Failed to generate PDF: " + err.message);
    }
  }

  async function handleDownloadTrialBalancePDF() {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text(shopName || "HISAB X", 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Trial Balance Financial Statement", 15, 26);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Date Generated: ${new Date().toLocaleString()}`, 130, 26);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(15, 30, 195, 30);

      // Calculations
      const localAssets = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0) + totalReceivable + inventoryValue;
      const localLiabilities = totalPayable;
      const localExpenses = totalPurchases + totalExpenses;
      const localRevenue = totalSales;
      const localEquity = (localAssets + localExpenses) - (localLiabilities + localRevenue);

      const rows: any[] = [];

      // 1. Assets
      accounts.forEach(a => {
        rows.push([
          "1100", 
          `Cash/Bank - ${a.name}`, 
          "Asset", 
          `Rs ${Number(a.current_balance).toLocaleString()}`, 
          "-"
        ]);
      });
      rows.push(["1200", "Accounts Receivable (Khata Customers)", "Asset", `Rs ${totalReceivable.toLocaleString()}`, "-"]);
      rows.push(["1300", "Stock / Inventory Asset", "Asset", `Rs ${inventoryValue.toLocaleString()}`, "-"]);

      // 2. Liabilities
      rows.push(["2100", "Accounts Payable (Khata Suppliers)", "Liability", "-", `Rs ${totalPayable.toLocaleString()}`]);

      // 3. Equity
      rows.push(["3100", "Owner's Capital Account (Equity)", "Equity", "-", `Rs ${localEquity.toLocaleString()}`]);

      // 4. Revenue
      rows.push(["4100", "Sales Revenue", "Revenue", "-", `Rs ${totalSales.toLocaleString()}`]);

      // 5. Expenses
      rows.push(["5100", "Cost of Goods Sold (Purchases)", "Expense", `Rs ${totalPurchases.toLocaleString()}`, "-"]);
      rows.push(["5200", "Operating Expenses", "Expense", `Rs ${totalExpenses.toLocaleString()}`, "-"]);

      const sumDebits = localAssets + localExpenses;
      const sumCredits = localLiabilities + localEquity + localRevenue;

      // Append Total Row
      rows.push([
        "",
        "TOTAL BALANCE",
        "",
        `Rs ${sumDebits.toLocaleString()}`,
        `Rs ${sumCredits.toLocaleString()}`
      ]);

      autoTable(doc, {
        head: [["Account Code", "Account Name", "Classification", "Debit Balance", "Credit Balance"]],
        body: rows,
        startY: 35,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
        columnStyles: { 
          3: { halign: "right" }, 
          4: { halign: "right" } 
        },
        didParseCell: function (data) {
          if (data.row.index === rows.length - 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = [30, 41, 59];
          }
        },
        margin: { left: 15, right: 15 }
      });

      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Powered by Hisab X POS & ERP System", 15, 285);

      doc.save(`trial_balance_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Trial Balance PDF downloaded! 📄");
    } catch (err: any) {
      toast.error("Failed to generate Trial Balance PDF: " + err.message);
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (permissions?.actions?.edit_account === false) {
      toast.error("Access Denied: You do not have permission to perform account transfers.");
      return;
    }
    if (!transferSource || !transferDest || transferAmount <= 0) {
      toast.error("Please fill in all details correctly.");
      return;
    }
    if (transferSource === transferDest) {
      toast.error("Source and destination accounts cannot be the same.");
      return;
    }

    const srcAcc = accounts.find(a => a.id === transferSource);
    if (srcAcc && srcAcc.current_balance < transferAmount) {
      if (!confirm("Warning: Transfer amount exceeds current balance. Proceed anyway?")) {
        return;
      }
    }

    setSubmittingTransfer(true);
    try {
      // 1. Deduct from source
      const currentSrc = accounts.find(a => a.id === transferSource)?.current_balance || 0;
      await supabase.from("cash_accounts").update({ current_balance: currentSrc - transferAmount }).eq("id", transferSource);

      // 2. Add to destination
      const currentDest = accounts.find(a => a.id === transferDest)?.current_balance || 0;
      await supabase.from("cash_accounts").update({ current_balance: currentDest + transferAmount }).eq("id", transferDest);

      // 3. Log transactions
      const remarks = transferRemarks.trim() || `Transfer from ${accounts.find(a => a.id === transferSource)?.name} to ${accounts.find(a => a.id === transferDest)?.name}`;
      
      await supabase.from("account_transactions").insert([
        {
          shop_id: shopId,
          account_id: transferSource,
          type: "transfer_out",
          amount: transferAmount,
          remarks
        },
        {
          shop_id: shopId,
          account_id: transferDest,
          type: "transfer_in",
          amount: transferAmount,
          remarks
        }
      ]);

      toast.success("Transfer completed successfully! 💸");
      setIsTransferOpen(false);
      setTransferAmount(0);
      setTransferRemarks("");
      loadData();
    } catch (err: any) {
      toast.error("Transfer failed: " + err.message);
    } finally {
      setSubmittingTransfer(false);
    }
  }

  const filteredTransactions = transactions.filter(t => 
    selectedAccFilter === "all" ? true : t.account_id === selectedAccFilter
  );

  const totalAssetsVal = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0) + totalReceivable + inventoryValue;
  const totalLiabilitiesVal = totalPayable;
  const totalExpensesVal = totalPurchases + totalExpenses;
  const totalRevenueVal = totalSales;
  const ownersEquityVal = (totalAssetsVal + totalExpensesVal) - (totalLiabilitiesVal + totalRevenueVal);

  const sumDebitsVal = totalAssetsVal + totalExpensesVal;
  const sumCreditsVal = totalLiabilitiesVal + ownersEquityVal + totalRevenueVal;

  return (
    <div className="space-y-6 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl text-white shadow-md shadow-blue-200">
              <Wallet className="h-6 w-6" />
            </span>
            {activeTab === "wallets" ? "Cash & Bank Accounts" : activeTab === "chart" ? "General Ledger (Chart of Accounts)" : "Trial Balance Statement"}
          </h1>
          <p className="text-slate-500 text-xs mt-1 flex items-center gap-2">
            {activeTab === "wallets" 
              ? "Track register drawer, bank ledgers, and mobile wallet cash flow" 
              : activeTab === "chart" 
                ? "Unified accounting ledger classifications and live balances" 
                : "Double-entry accounting sheet with automatic balance matching"}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${isLive ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              {isLive ? "LIVE" : "Connecting..."}
            </span>
          </p>
        </div>
        {activeTab === "wallets" && permissions?.actions?.edit_account !== false && (
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setIsTransferOpen(true)}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all border border-slate-200 shadow-sm"
            >
              <ArrowRightLeft size={14} /> Transfer Cash
            </button>
            <button 
              type="button"
              onClick={() => setIsAddAccountOpen(true)}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-200"
            >
              <Plus size={14} /> Add Account
            </button>
          </div>
        )}
      </div>

      {/* Sub-Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-3xl p-1.5 shrink-0 select-none shadow-sm max-w-md">
        <button
          onClick={() => setActiveTab("wallets")}
          className={`flex-1 py-2 px-4 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "wallets"
              ? "bg-blue-600 text-white shadow-md shadow-blue-200"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Wallet size={14} /> Wallets & Ledgers
        </button>
        <button
          onClick={() => setActiveTab("chart")}
          className={`flex-1 py-2 px-4 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "chart"
              ? "bg-blue-600 text-white shadow-md shadow-blue-200"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Layers size={14} /> Chart of Accounts
        </button>
        <button
          onClick={() => setActiveTab("trial")}
          className={`flex-1 py-2 px-4 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "trial"
              ? "bg-blue-600 text-white shadow-md shadow-blue-200"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Scale size={14} /> Trial Balance
        </button>
      </div>

      {loading && accounts.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {activeTab === "wallets" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left panel - Accounts list */}
              <div className="lg:col-span-4 space-y-4">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">My Wallets & Accounts</h2>
                <div className="space-y-3">
                  {accounts.map(acc => (
                    <div 
                      key={acc.id} 
                      className={`p-5 rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all relative overflow-hidden`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                            {acc.type === "cash" ? "Cash Drawer" : acc.type === "bank" ? "Bank Ledger" : "Mobile Wallet"}
                          </p>
                          <h3 className="font-extrabold text-slate-800 text-sm mt-0.5">{acc.name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {permissions?.actions?.delete_account !== false && acc.name.toLowerCase() !== "cash in hand" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAccount(acc.id);
                              }}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-all border border-rose-100"
                              title="Delete account"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          <span className={`p-2 rounded-xl ${
                            acc.type === "cash" ? "bg-amber-50 text-amber-600" : acc.type === "bank" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                          }`}>
                            {acc.type === "cash" ? <Landmark size={16} /> : acc.type === "bank" ? <Landmark size={16} /> : <Wallet size={16} />}
                          </span>
                        </div>
                      </div>
                      <div className="mt-6 flex items-baseline justify-between">
                        <span className="text-slate-400 text-xs font-semibold">Available Balance</span>
                        <span className="text-lg font-black text-slate-900">Rs {Number(acc.current_balance).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right panel - Transaction history */}
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <h3 className="font-black text-slate-800 text-sm">Account Ledger</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">Recent cash updates and movements</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {filteredTransactions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 rounded-xl text-xs font-black text-slate-500 transition-all shadow-sm"
                      >
                        <Download size={13} /> Download PDF
                      </button>
                    )}
                    <select 
                      value={selectedAccFilter}
                      onChange={e => setSelectedAccFilter(e.target.value)}
                      className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="all">All Accounts</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                  {filteredTransactions.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 text-xs font-medium">No ledger entries found</div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-black uppercase text-[9px] tracking-wider">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Account</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Remarks</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map(tx => {
                          const isInflow = tx.type === "deposit" || tx.type === "transfer_in";
                          return (
                            <tr key={tx.id} className="border-b border-slate-55 hover:bg-slate-50/50">
                              <td className="py-3 px-3 text-slate-400 font-medium font-mono">{new Date(tx.created_at).toLocaleString()}</td>
                              <td className="py-3 px-3 font-bold text-slate-700">{tx.account_name}</td>
                              <td className="py-3 px-3">
                                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-black text-[9px] ${
                                  isInflow ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                }`}>
                                  {isInflow ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                                  {tx.type.replace("_", " ").toUpperCase()}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-500 font-semibold">{tx.remarks || "-"}</td>
                              <td className={`py-3 px-3 text-right font-black ${isInflow ? "text-emerald-600" : "text-red-500"}`}>
                                {isInflow ? "+" : "-"} Rs {tx.amount.toLocaleString()}
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
          )}

          {activeTab === "chart" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Category: ASSETS */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-500" />
                  <div>
                    <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
                      <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                        <Landmark size={15} />
                      </span>
                      Assets (1000)
                    </h3>
                    <div className="space-y-3">
                      {accounts.map(a => (
                        <div key={a.id} className="flex justify-between items-center py-2 border-b border-slate-100 border-dashed last:border-0">
                          <div>
                            <p className="text-xs font-bold text-slate-700">{a.name}</p>
                            <p className="text-[9px] text-slate-400 font-semibold uppercase">{a.type}</p>
                          </div>
                          <span className="text-xs font-black text-slate-800">Rs {Number(a.current_balance).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center py-2 border-b border-slate-100 border-dashed last:border-0">
                        <div>
                          <p className="text-xs font-bold text-slate-700">Accounts Receivable</p>
                          <p className="text-[9px] text-slate-400 font-semibold uppercase">Customers Khata</p>
                        </div>
                        <span className="text-xs font-black text-slate-800">Rs {totalReceivable.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100 border-dashed last:border-0">
                        <div>
                          <p className="text-xs font-bold text-slate-700">Stock / Inventory Asset</p>
                          <p className="text-[9px] text-slate-400 font-semibold uppercase">Products Stock Value</p>
                        </div>
                        <span className="text-xs font-black text-slate-800">Rs {inventoryValue.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-baseline">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Assets</span>
                    <span className="text-sm font-black text-blue-600">
                      Rs {totalAssetsVal.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Category: LIABILITIES */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />
                  <div>
                    <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
                      <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                        <Users size={15} />
                      </span>
                      Liabilities (2000)
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-100 border-dashed last:border-0">
                        <div>
                          <p className="text-xs font-bold text-slate-700">Accounts Payable</p>
                          <p className="text-[9px] text-slate-400 font-semibold uppercase">Suppliers Khata</p>
                        </div>
                        <span className="text-xs font-black text-slate-800">Rs {totalPayable.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-baseline">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Liabilities</span>
                    <span className="text-sm font-black text-rose-600">Rs {totalLiabilitiesVal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Category: EQUITY */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
                  <div>
                    <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
                      <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                        <Scale size={15} />
                      </span>
                      Equity (3000)
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-100 border-dashed last:border-0">
                        <div>
                          <p className="text-xs font-bold text-slate-700">Owner's Capital Account</p>
                          <p className="text-[9px] text-slate-400 font-semibold uppercase">Starting/Retained Equity</p>
                        </div>
                        <span className="text-xs font-black text-slate-800">
                          Rs {ownersEquityVal.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-baseline">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Equity</span>
                    <span className="text-sm font-black text-amber-600">
                      Rs {ownersEquityVal.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Category: REVENUE */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
                  <div>
                    <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
                      <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <TrendingUp size={15} />
                      </span>
                      Revenue (4000)
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-100 border-dashed last:border-0">
                        <div>
                          <p className="text-xs font-bold text-slate-700">Sales Income</p>
                          <p className="text-[9px] text-slate-400 font-semibold uppercase">Store Sales Invoices</p>
                        </div>
                        <span className="text-xs font-black text-slate-800">Rs {totalRevenueVal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-baseline">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Revenue</span>
                    <span className="text-sm font-black text-emerald-600">Rs {totalRevenueVal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Category: EXPENSES */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-violet-500" />
                  <div>
                    <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
                      <span className="p-1.5 bg-violet-50 text-violet-600 rounded-lg">
                        <Coins size={15} />
                      </span>
                      Expenses (5000)
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-100 border-dashed last:border-0">
                        <div>
                          <p className="text-xs font-bold text-slate-700">Cost of Goods Sold</p>
                          <p className="text-[9px] text-slate-400 font-semibold uppercase">Purchase Orders (Stock-In)</p>
                        </div>
                        <span className="text-xs font-black text-slate-800">Rs {totalPurchases.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-100 border-dashed last:border-0">
                        <div>
                          <p className="text-xs font-bold text-slate-700">Operating Expenses</p>
                          <p className="text-[9px] text-slate-400 font-semibold uppercase">Salaries, Rent, Bills, etc.</p>
                        </div>
                        <span className="text-xs font-black text-slate-800">Rs {totalExpenses.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-baseline">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Expenses</span>
                    <span className="text-sm font-black text-violet-600">Rs {totalExpensesVal.toLocaleString()}</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === "trial" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-black text-slate-800 text-sm">Trial Balance Sheet</h3>
                  <p className="text-[10px] text-slate-400 font-semibold">Double-entry balancing sheet with automatic settlement</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTrialBalancePDF}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-200"
                >
                  <Download size={13} /> Download Trial Balance PDF
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-black uppercase text-[9px] tracking-wider bg-slate-50/50">
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Account Name</th>
                      <th className="py-2.5 px-3">Classification</th>
                      <th className="py-2.5 px-3 text-right">Debit Balance (Rs)</th>
                      <th className="py-2.5 px-3 text-right">Credit Balance (Rs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                    {/* 1. Assets (Debits) */}
                    {accounts.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-mono font-semibold text-slate-400">1100</td>
                        <td className="py-3 px-3 font-bold text-slate-850">Cash/Bank - {a.name}</td>
                        <td className="py-3 px-3"><span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-600 border border-blue-100 uppercase leading-none">Asset</span></td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-750">Rs {Number(a.current_balance).toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-slate-400">-</td>
                      </tr>
                    ))}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono font-semibold text-slate-400">1200</td>
                      <td className="py-3 px-3 font-bold text-slate-850">Accounts Receivable (Khata Customers)</td>
                      <td className="py-3 px-3"><span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-600 border border-blue-100 uppercase leading-none">Asset</span></td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-750">Rs {totalReceivable.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-slate-400">-</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono font-semibold text-slate-400">1300</td>
                      <td className="py-3 px-3 font-bold text-slate-850">Stock / Inventory Asset</td>
                      <td className="py-3 px-3"><span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-600 border border-blue-100 uppercase leading-none">Asset</span></td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-750">Rs {inventoryValue.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-slate-400">-</td>
                    </tr>

                    {/* 2. Liabilities (Credits) */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono font-semibold text-slate-400">2100</td>
                      <td className="py-3 px-3 font-bold text-slate-850">Accounts Payable (Khata Suppliers)</td>
                      <td className="py-3 px-3"><span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-100 uppercase leading-none">Liability</span></td>
                      <td className="py-3 px-3 text-right text-slate-400">-</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-750">Rs {totalPayable.toLocaleString()}</td>
                    </tr>

                    {/* 3. Equity (Credits) */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono font-semibold text-slate-400">3100</td>
                      <td className="py-3 px-3 font-bold text-slate-850">Owner's Capital Account (Equity)</td>
                      <td className="py-3 px-3"><span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-amber-50 text-amber-600 border border-amber-100 uppercase leading-none">Equity</span></td>
                      <td className="py-3 px-3 text-right text-slate-400">-</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-750">
                        Rs {ownersEquityVal.toLocaleString()}
                      </td>
                    </tr>

                    {/* 4. Revenue (Credits) */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono font-semibold text-slate-400">4100</td>
                      <td className="py-3 px-3 font-bold text-slate-850">Sales Revenue</td>
                      <td className="py-3 px-3"><span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase leading-none">Revenue</span></td>
                      <td className="py-3 px-3 text-right text-slate-400">-</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-750">Rs {totalSales.toLocaleString()}</td>
                    </tr>

                    {/* 5. Expenses (Debits) */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono font-semibold text-slate-400">5100</td>
                      <td className="py-3 px-3 font-bold text-slate-850">Cost of Goods Sold (Purchases)</td>
                      <td className="py-3 px-3"><span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-violet-50 text-violet-600 border border-violet-100 uppercase leading-none">Expense</span></td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-750">Rs {totalPurchases.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-slate-400">-</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono font-semibold text-slate-400">5200</td>
                      <td className="py-3 px-3 font-bold text-slate-850">Operating Expenses</td>
                      <td className="py-3 px-3"><span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-violet-50 text-violet-600 border border-violet-100 uppercase leading-none">Expense</span></td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-750">Rs {totalExpenses.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-slate-400">-</td>
                    </tr>

                    {/* Totals balancing row */}
                    <tr className="bg-slate-50 font-black border-t border-slate-200 text-slate-850 text-xs">
                      <td className="py-3.5 px-3"></td>
                      <td className="py-3.5 px-3 uppercase tracking-wider">TOTAL BALANCE</td>
                      <td className="py-3.5 px-3"></td>
                      <td className="py-3.5 px-3 text-right text-blue-650 font-black">
                        Rs {sumDebitsVal.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3 text-right text-emerald-650 font-black">
                        Rs {sumCreditsVal.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: Add Account */}
      <AnimatePresence>
        {isAddAccountOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="absolute inset-0" onClick={() => setIsAddAccountOpen(false)}
            />
            <motion.div 
              initial={{ scale:0.95, y:10 }} animate={{ scale:1, y:0 }} exit={{ scale:0.95, y:10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm relative z-10 border border-slate-100 shadow-xl"
            >
              <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                <Plus size={16} className="text-blue-600" /> New Cash Account
              </h3>
              <form onSubmit={handleAddAccount} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Account Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Meezan Bank, JazzCash Drawer" 
                    value={newAccName}
                    onChange={e => setNewAccName(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Account Type</label>
                  <select 
                    value={newAccType}
                    onChange={e => setNewAccType(e.target.value as any)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-600"
                  >
                    <option value="cash">Cash / Drawer</option>
                    <option value="bank">Bank Account</option>
                    <option value="wallet">Mobile Wallet</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Opening Balance (Rs)</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={newAccBalance || ""}
                    onChange={e => setNewAccBalance(Number(e.target.value))}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsAddAccountOpen(false)}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingAccount}
                    className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-200 disabled:opacity-50"
                  >
                    {submittingAccount && <Loader2 size={13} className="animate-spin" />} Save Account
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Transfer Cash */}
      <AnimatePresence>
        {isTransferOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="absolute inset-0" onClick={() => setIsTransferOpen(false)}
            />
            <motion.div 
              initial={{ scale:0.95, y:10 }} animate={{ scale:1, y:0 }} exit={{ scale:0.95, y:10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm relative z-10 border border-slate-100 shadow-xl"
            >
              <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-blue-600" /> Transfer Cash / Funds
              </h3>
              <form onSubmit={handleTransfer} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Source Account (From)</label>
                  <select 
                    value={transferSource}
                    onChange={e => setTransferSource(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-600"
                    required
                  >
                    <option value="">Select source account...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (Rs {Number(a.current_balance).toLocaleString()})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Destination Account (To)</label>
                  <select 
                    value={transferDest}
                    onChange={e => setTransferDest(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-600"
                    required
                  >
                    <option value="">Select destination account...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (Rs {Number(a.current_balance).toLocaleString()})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Transfer Amount (Rs)</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={transferAmount || ""}
                    onChange={e => setTransferAmount(Number(e.target.value))}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Remarks / Note</label>
                  <input 
                    type="text" 
                    placeholder="Optional remarks..." 
                    value={transferRemarks}
                    onChange={e => setTransferRemarks(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsTransferOpen(false)}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingTransfer}
                    className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-200 disabled:opacity-50"
                  >
                    {submittingTransfer && <Loader2 size={13} className="animate-spin" />} Transfer
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
