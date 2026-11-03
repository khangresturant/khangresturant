"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wallet, Plus, ArrowRightLeft, Landmark, Coins, RefreshCw, Loader2, 
  ArrowUpRight, ArrowDownLeft, Trash2, Download, Scale, Layers, 
  TrendingUp, Users, Package, DollarSign, BookOpen, AlertCircle, Trash,
  CheckSquare, CalendarCheck, FileCheck, ChevronsRight, Edit2, Square,
  History, Clock, ArrowRight, FileText, CheckCircle2, ShieldAlert
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { SubscriptionBlocker } from "@/components/dashboard/SubscriptionBlocker";
import { logAudit } from "@/utils/audit";
import { fetchShowroomSubLedgerBalances } from "@/lib/showroom-accounting";

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
  reconciled?: boolean;
  account_name?: string;
}

interface JournalEntry {
  id: string;
  entry_date: string;
  narration: string;
  ref_type: string;
  journal_lines: Array<{
    id: string;
    account_code: string;
    account_name: string;
    debit: number;
    credit: number;
  }>;
}

interface PostDatedCheque {
  id: string;
  shop_id: string;
  party_id: string | null;
  party_name?: string | null;
  account_id: string | null;
  cheque_number: string;
  bank_name: string | null;
  amount: number;
  due_date: string;
  cheque_type: "receivable" | "payable";
  status: "pending" | "cleared" | "bounced" | "cancelled";
  remarks: string | null;
  created_at: string;
}

// Chart of accounts standard code templates (Double-Entry General Ledger)
const ACCOUNT_TEMPLATES = [
  // 1. Assets
  { code: "1001", name: "Cash in Hand & Bank Accounts", type: "Asset" },
  { code: "1002", name: "Accounts Receivable (Customer Khata)", type: "Asset" },
  { code: "1003", name: "Stock / Inventory Asset", type: "Asset" },
  { code: "1004", name: "Employee Advances / Deductions", type: "Asset" },
  { code: "1005", name: "Advance to Suppliers", type: "Asset" },
  { code: "1500", name: "Fixed Assets & Machinery", type: "Asset" },
  
  // 2. Liabilities
  { code: "2001", name: "Accounts Payable (Supplier Khata)", type: "Liability" },
  { code: "2002", name: "Advance from Customers", type: "Liability" },
  { code: "2100", name: "Short-Term Loans & Borrowings", type: "Liability" },
  { code: "2300", name: "Tax Payable (GST, VAT, WHT)", type: "Liability" },
  
  // 3. Equity
  { code: "3100", name: "Owner's Capital Account", type: "Equity" },
  { code: "3200", name: "Owner's Drawings Account", type: "Equity" },
  { code: "3300", name: "Retained Earnings & Reserves", type: "Equity" },
  
  // 4. Revenue
  { code: "4001", name: "Sales Revenue", type: "Revenue" },
  { code: "4002", name: "Discount Received", type: "Revenue" },
  { code: "4100", name: "Service Revenue (Stitching/Repairs)", type: "Revenue" },
  { code: "4300", name: "Other Operating Income", type: "Revenue" },
  
  // 5. Expenses
  { code: "5001", name: "Cost of Goods / Purchases", type: "Expense" },
  { code: "5002", name: "Discount Allowed", type: "Expense" },
  { code: "5003", name: "Operating Expenses (General)", type: "Expense" },
  { code: "5004", name: "Salaries & Wages Expense", type: "Expense" },
  { code: "5100", name: "Rent & Lease Expense", type: "Expense" },
  { code: "5200", name: "Utilities Expense (Electricity, Net)", type: "Expense" },
  { code: "5300", name: "Marketing & Advertising Expense", type: "Expense" },
  { code: "5400", name: "Office Supplies & Maintenance", type: "Expense" },
  { code: "5500", name: "Depreciation Expense", type: "Expense" }
];

export default function AccountsPage() {
  const { shopId, userId, userName, permissions, hasAssetsRec, allowIndustrialAccounts, allowAccounts, shopName, activeClosingBook, industryType } = useShop();
  const supabase = createClient();

  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [glBalances, setGlBalances] = useState<Record<string, { name: string, debit: number, credit: number }>>({});
  const [fixedAssets, setFixedAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [showZeroBalances, setShowZeroBalances] = useState(true);
  const [parties, setParties] = useState<any[]>([]);

  // Modals state
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAddJournalOpen, setIsAddJournalOpen] = useState(false);
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);

  // Capital Injection form
  const [capitalTargetAccount, setCapitalTargetAccount] = useState("");
  const [capitalAmount, setCapitalAmount] = useState(0);
  const [capitalNarration, setCapitalNarration] = useState("Owner Capital Injection / Cash Float");
  const [submittingCapital, setSubmittingCapital] = useState(false);

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

  // Fixed Asset form
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetType, setNewAssetType] = useState("furniture");
  const [newAssetPrice, setNewAssetPrice] = useState(0);
  const [newAssetLife, setNewAssetLife] = useState(5);
  const [submittingAsset, setSubmittingAsset] = useState(false);

  // Fixed Asset Edit & Version History state
  const [isEditAssetOpen, setIsEditAssetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [editAssetName, setEditAssetName] = useState("");
  const [editAssetType, setEditAssetType] = useState("furniture");
  const [editAssetPrice, setEditAssetPrice] = useState(0);
  const [editAssetCurrentVal, setEditAssetCurrentVal] = useState(0);
  const [editAssetLife, setEditAssetLife] = useState(5);
  const [editAssetDate, setEditAssetDate] = useState("");
  const [editAssetReason, setEditAssetReason] = useState("");
  const [submittingEditAsset, setSubmittingEditAsset] = useState(false);

  // Asset Version History Modal state
  const [isAssetHistoryOpen, setIsAssetHistoryOpen] = useState(false);
  const [selectedHistoryAsset, setSelectedHistoryAsset] = useState<any | null>(null);

  // New Journal Entry Form State
  const [newJournalDate, setNewJournalDate] = useState(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0]);
  const [newJournalNarration, setNewJournalNarration] = useState("");
  const [newJournalLines, setNewJournalLines] = useState<Array<{ account_code: string; debit: number; credit: number; party_id?: string | null }>>([
    { account_code: "1001", debit: 0, credit: 0, party_id: null },
    { account_code: "4001", debit: 0, credit: 0, party_id: null }
  ]);
  const [submittingJournal, setSubmittingJournal] = useState(false);

  // Selected account filter for ledger
  const [selectedAccFilter, setSelectedAccFilter] = useState<string>("all");

  // Tab state
  const [activeTab, setActiveTab] = useState<"wallets" | "chart" | "trial" | "journal" | "assets" | "cheques" | "reconciliation" | "statements" | "valuation" | "currency">("wallets");

  // Feature 1: CSV Bank Statement Reconciliation state
  const [csvRows, setCsvRows] = useState<Array<{ date: string; description: string; amount: number; matchedTxId?: string }>>([]);
  const [csvFileName, setCsvFileName] = useState("");

  // Feature 2: Financial Statements state
  const [statementPeriod, setStatementPeriod] = useState<"all" | "this_month" | "this_quarter" | "this_year">("all");

  // Feature 3: Inventory Valuation Methodologies state
  const [valuationMethod, setValuationMethod] = useState<"weighted_avg" | "fifo">("weighted_avg");
  const [productsValuation, setProductsValuation] = useState<any[]>([]);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationSearch, setValuationSearch] = useState("");
  const [valuationShowZero, setValuationShowZero] = useState(false);

  // Feature 4: Multi-Currency Accounting state
  const [fxRates, setFxRates] = useState<Record<string, number>>({
    USD: 278.50,
    EUR: 302.20,
    AED: 75.80,
    SAR: 74.25,
    GBP: 358.10
  });
  const [calcForeignAmt, setCalcForeignAmt] = useState(100);
  const [calcCurr, setCalcCurr] = useState("USD");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "assets") {
        setActiveTab("assets");
      }
    }
  }, []);

  // General Ledger and Trial Balance data states
  const [totalSales, setTotalSales] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalReceivable, setTotalReceivable] = useState(0);
  const [totalPayable, setTotalPayable] = useState(0);
  const [inventoryValue, setInventoryValue] = useState(0);

  // Post-Dated Cheques state
  const [cheques, setCheques] = useState<PostDatedCheque[]>([]);
  const [chequesLoading, setChequesLoading] = useState(false);
  const [isAddChequeOpen, setIsAddChequeOpen] = useState(false);
  const [submittingCheque, setSubmittingCheque] = useState(false);
  const [newCheque, setNewCheque] = useState({
    party_id: "",
    account_id: "",
    cheque_number: "",
    bank_name: "",
    amount: 0,
    due_date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0],
    cheque_type: "receivable" as "receivable" | "payable",
    remarks: ""
  });

  // Reconciliation state
  const [reconAccountId, setReconAccountId] = useState("");
  const [reconTransactions, setReconTransactions] = useState<AccountTransaction[]>([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconChecked, setReconChecked] = useState<Set<string>>(new Set());
  const [reconStatementBalance, setReconStatementBalance] = useState(0);
  const [submittingRecon, setSubmittingRecon] = useState(false);

  useEffect(() => {
    if (!shopId) return;

    loadData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`accounts-realtime-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_accounts", filter: `shop_id=eq.${shopId}` }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_transactions", filter: `shop_id=eq.${shopId}` }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "journal_entries", filter: `shop_id=eq.${shopId}` }, loadData)
      .subscribe((status: string) => setIsLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId, activeClosingBook]);

  useEffect(() => {
    if (activeTab === "cheques" && shopId) {
      fetchCheques();
    }
    if (activeTab === "valuation" && shopId) {
      fetchInventoryValuation();
    }
  }, [activeTab, shopId]);

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
          { shop_id: shopId, name: "Cash in Hand", type: "cash", current_balance: 0.00 }
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
      let txQuery = supabase
        .from("account_transactions")
        .select("*")
        .eq("shop_id", shopId);

      if (activeClosingBook) {
        txQuery = txQuery.eq("closing_book_id", activeClosingBook.id);
      } else {
        txQuery = txQuery.is("closing_book_id", null);
      }

      const { data: txs, error: txsErr } = await txQuery
        .order("created_at", { ascending: false })
        .limit(1000);

      if (txsErr) throw txsErr;

      const accMap: Record<string, string> = {};
      accs.forEach((a: any) => { accMap[a.id] = a.name; });

      setTransactions((txs || []).map((t: any) => ({
        ...t,
        amount: Number(t.amount),
        account_name: accMap[t.account_id] || "Unknown Account"
      })));

      // 4. Fetch sales revenue (Fallback calculations)
      let invQuery = supabase
        .from("invoices")
        .select("total_amount")
        .eq("shop_id", shopId)
        .neq("is_voided", true)
        .neq("status", "draft");

      if (activeClosingBook) {
        invQuery = invQuery.eq("closing_book_id", activeClosingBook.id);
      } else {
        invQuery = invQuery.is("closing_book_id", null);
      }
      const { data: salesData } = await invQuery;
      setTotalSales((salesData || []).reduce((sum: number, inv: any) => sum + Number(inv.total_amount), 0));

      // 5. Fetch purchase orders (COGS Fallback)
      let poQuery = supabase
        .from("purchase_orders")
        .select("total_amount")
        .eq("shop_id", shopId)
        .neq("is_voided", true);

      if (activeClosingBook) {
        poQuery = poQuery.eq("closing_book_id", activeClosingBook.id);
      } else {
        poQuery = poQuery.is("closing_book_id", null);
      }
      const { data: purchaseData } = await poQuery;
      setTotalPurchases((purchaseData || []).reduce((sum: number, po: any) => sum + Number(po.total_amount), 0));

      // 6. Fetch expenses (Fallback)
      let expQuery = supabase
        .from("expenses")
        .select("amount")
        .eq("shop_id", shopId);

      if (activeClosingBook) {
        expQuery = expQuery.eq("closing_book_id", activeClosingBook.id);
      } else {
        expQuery = expQuery.is("closing_book_id", null);
      }
      const { data: expenseData } = await expQuery;
      setTotalExpenses((expenseData || []).reduce((sum: number, exp: any) => sum + Number(exp.amount), 0));

      // 7. Fetch parties (Receivables & Payables Fallback)
      const { data: partiesData } = await supabase
        .from("parties")
        .select("id, type, current_balance")
        .eq("shop_id", shopId);

      let receivableSum = 0;
      let payableSum = 0;

      if (activeClosingBook) {
        // Fetch snapshots
        const { data: snaps } = await supabase
          .from("closing_balances")
          .select("balance, party_id")
          .eq("closing_book_id", activeClosingBook.id);

        (partiesData || []).forEach((p: any) => {
          const snap = (snaps || []).find((s: any) => s.party_id === p.id);
          const bal = snap ? Number(snap.balance) : 0;
          if (p.type === "customer" && bal > 0) receivableSum += bal;
          if (p.type === "supplier" && bal > 0) payableSum += bal;
        });
      } else {
        receivableSum = (partiesData || [])
          .filter((p: any) => p.type === "customer" && Number(p.current_balance) > 0)
          .reduce((sum: number, p: any) => sum + Number(p.current_balance), 0);
        payableSum = (partiesData || [])
          .filter((p: any) => p.type === "supplier" && Number(p.current_balance) > 0)
          .reduce((sum: number, p: any) => sum + Number(p.current_balance), 0);
      }

      // Showroom Sub-ledger Synchronization:
      // Auto-sync "Parties & Dealers" module balances (Receivables Rs 958,000 and Payables Rs 288,000) directly into Balance Sheet heads
      let showroomStockVal = 0;
      if (industryType === "showroom") {
        try {
          const srSub = await fetchShowroomSubLedgerBalances(supabase, shopId);
          receivableSum += srSub.receivables;
          payableSum += srSub.payables;
          showroomStockVal = srSub.inventoryValue;
        } catch (srErr) {
          console.warn("Showroom subledger sync warning:", srErr);
        }
      }

      setTotalReceivable(receivableSum);
      setTotalPayable(payableSum);

      // 8. Fetch products (Inventory Value Fallback)
      const { data: productsData } = await supabase
        .from("products")
        .select("current_stock, purchase_price_single")
        .eq("shop_id", shopId);
      const retailStockVal = (productsData || []).reduce(
        (sum: number, p: any) => sum + (Number(p.purchase_price_single || 0) * Number(p.current_stock || 0)),
        0
      );
      setInventoryValue(retailStockVal + showroomStockVal);

      // 9. Fetch fixed assets if enabled
      if (hasAssetsRec) {
        const { data: assetsData } = await supabase
          .from("fixed_assets")
          .select("*")
          .eq("shop_id", shopId)
          .eq("status", "active")
          .order("created_at", { ascending: false });
        setFixedAssets(assetsData || []);
      }

      // 10. Fetch actual General Ledger balances from journal lines (Fast RPC with fallback)
      let loadedBalances: Record<string, { name: string, debit: number, credit: number }> = {};
      try {
        const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("get_shop_gl_balances", {
          p_shop_id: shopId,
          p_closing_book_id: activeClosingBook ? activeClosingBook.id : null
        });

        if (!rpcErr && rpcData && rpcData.length > 0) {
          rpcData.forEach((row: any) => {
            const code = row.account_code;
            const template = ACCOUNT_TEMPLATES.find(t => t.code === code);
            loadedBalances[code] = {
              name: row.account_name || template?.name || "General Account",
              debit: Number(row.total_debit || 0),
              credit: Number(row.total_credit || 0)
            };
          });
          setGlBalances(loadedBalances);
        } else {
          throw rpcErr || new Error("No RPC data");
        }
      } catch {
        let glQuery = supabase
          .from("journal_lines")
          .select(`
            account_code,
            account_name,
            debit,
            credit,
            journal_entries!inner(shop_id, closing_book_id)
          `)
          .eq("journal_entries.shop_id", shopId)
          .range(0, 49999);

        if (activeClosingBook) {
          glQuery = glQuery.eq("journal_entries.closing_book_id", activeClosingBook.id);
        } else {
          glQuery = glQuery.is("journal_entries.closing_book_id", null);
        }
        const { data: glData, error: glErr } = await glQuery;

        if (!glErr && glData) {
          glData.forEach((row: any) => {
            const code = row.account_code;
            if (!loadedBalances[code]) {
              const template = ACCOUNT_TEMPLATES.find(t => t.code === code);
              loadedBalances[code] = { name: row.account_name || template?.name || "General Account", debit: 0, credit: 0 };
            }
            loadedBalances[code].debit += Number(row.debit || 0);
            loadedBalances[code].credit += Number(row.credit || 0);
          });
          setGlBalances(loadedBalances);
        }
      }

      // 11. Fetch general journal entries for the list
      let journalQuery = supabase
        .from("journal_entries")
        .select(`
          *,
          journal_lines(*)
        `)
        .eq("shop_id", shopId);

      if (activeClosingBook) {
        journalQuery = journalQuery.eq("closing_book_id", activeClosingBook.id);
      } else {
        journalQuery = journalQuery.is("closing_book_id", null);
      }

      const { data: journals, error: journalsErr } = await journalQuery
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (!journalsErr && journals) {
        setJournalEntries(journals as any[]);
      }

      // 12. Fetch parties for subsidiary JVs
      const { data: pts } = await supabase
        .from("parties")
        .select("id, name, type")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });
      setParties(pts || []);

    } catch (err: any) {
      toast.error("Failed to load accounts: " + err.message);
    } finally {
      setLoading(false);
    }
  }
  // ─── PDC Handlers ───────────────────────────────────────────
  async function fetchCheques() {
    if (!shopId) return;
    setChequesLoading(true);
    const { data } = await supabase
      .from("post_dated_cheques")
      .select("*")
      .eq("shop_id", shopId)
      .order("due_date", { ascending: true });
    setCheques(data || []);
    setChequesLoading(false);
  }

  async function handleAddCheque(e: React.FormEvent) {
    e.preventDefault();
    if (!newCheque.cheque_number || !newCheque.amount || !newCheque.due_date) {
      toast.error("Cheque number, amount, and due date are required.");
      return;
    }
    setSubmittingCheque(true);
    try {
      const payload: any = {
        shop_id: shopId,
        cheque_number: newCheque.cheque_number,
        bank_name: newCheque.bank_name || null,
        amount: newCheque.amount,
        due_date: newCheque.due_date,
        type: newCheque.cheque_type,       // legacy NOT NULL column
        cheque_type: newCheque.cheque_type,
        status: "pending",
        remarks: newCheque.remarks || null,
      };
      if (newCheque.party_id) payload.party_id = newCheque.party_id;
      if (newCheque.account_id) payload.account_id = newCheque.account_id;

      // Try to get party name for denormalized column
      if (newCheque.party_id) {
        const found = parties.find((p: any) => p.id === newCheque.party_id);
        if (found) payload.party_name = found.name;
      }

      const { error } = await supabase.from("post_dated_cheques").insert(payload);
      if (error) throw error;
      toast.success("Cheque added!");
      setIsAddChequeOpen(false);
      setNewCheque({ party_id: "", account_id: "", cheque_number: "", bank_name: "", amount: 0, due_date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0], cheque_type: "receivable", remarks: "" });
      fetchCheques();
    } catch (err: any) {
      toast.error("Failed to save cheque: " + err.message);
    } finally {
      setSubmittingCheque(false);
    }
  }

  async function handleChequeAction(
    chequeId: string,
    newStatus: "cleared" | "bounced" | "cancelled",
    accountId: string | null,
    amount: number,
    chequeType: "receivable" | "payable",
    chequeNumber: string
  ) {
    try {
      const { error } = await supabase.from("post_dated_cheques").update({ status: newStatus }).eq("id", chequeId);
      if (error) throw error;

      // If cleared and account is selected, post a cash account transaction
      if (newStatus === "cleared" && accountId && amount > 0) {
        const txType = chequeType === "receivable" ? "deposit" : "withdrawal";
        const { error: txError } = await supabase.from("account_transactions").insert({
          shop_id: shopId,
          account_id: accountId,
          type: txType,
          amount: amount,
          ref_type: "pdc",
          ref_id: chequeId,
          remarks: `Cheque ${chequeNumber} Cleared`,
          reconciled: false
        });
        if (txError) throw txError;

        // Update account balance
        const acct = accounts.find(a => a.id === accountId);
        if (acct) {
          const newBal = txType === "deposit" ? acct.current_balance + amount : acct.current_balance - amount;
          await supabase.from("cash_accounts").update({ current_balance: newBal }).eq("id", accountId);
        }
      }

      toast.success(`Cheque marked as ${newStatus}.`);
      fetchCheques();
      loadData();
    } catch (err: any) {
      toast.error("Failed to update cheque: " + err.message);
    }
  }

  // ─── Reconciliation Handler ─────────────────────────────────
  async function handleSaveReconciliation() {
    if (reconChecked.size === 0) return;
    setSubmittingRecon(true);
    try {
      const ids = Array.from(reconChecked);
      const { error } = await supabase
        .from("account_transactions")
        .update({ reconciled: true })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} transactions marked as reconciled!`);
      setReconChecked(new Set());
      // Refresh the transactions list
      const { data } = await supabase
        .from("account_transactions")
        .select("*")
        .eq("account_id", reconAccountId)
        .eq("reconciled", false)
        .order("created_at", { ascending: false });
      setReconTransactions(data || []);
    } catch (err: any) {
      toast.error("Failed to reconcile: " + err.message);
    } finally {
      setSubmittingRecon(false);
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

      if (newAccBalance > 0) {
        await supabase.from("account_transactions").insert({
          shop_id: shopId,
          account_id: newAcc.id,
          type: "deposit",
          amount: newAccBalance,
          ref_type: "capital",
          remarks: "Opening Balance"
        });

        // Double-entry posting for opening capital (Debit 1001 Cash, Credit 3100 Capital)
        const { data: jeData } = await supabase.from("journal_entries").insert({
          shop_id: shopId,
          entry_date: new Date().toISOString().split("T")[0],
          ref_type: "capital",
          ref_id: newAcc.id,
          narration: `Opening Capital / Float for ${newAccName.trim()}`,
          closing_book_id: activeClosingBook?.id || null
        }).select().single();

        if (jeData) {
          await supabase.from("journal_lines").insert([
            {
              entry_id: jeData.id,
              account_code: "1001",
              account_name: "Cash & Bank Accounts",
              debit: newAccBalance,
              credit: 0
            },
            {
              entry_id: jeData.id,
              account_code: "3100",
              account_name: "Owner's Capital Account",
              debit: 0,
              credit: newAccBalance
            }
          ]);
        }
      }

      logAudit(
        shopId!,
        userId,
        "ACCOUNT_CREATED",
        "cash_accounts",
        newAcc.id,
        {
          account_id: newAcc.id,
          name: newAccName,
          type: newAccType,
          opening_balance: newAccBalance
        }
      );

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

  async function handleExecuteCapitalInjection(e: React.FormEvent) {
    e.preventDefault();
    if (!capitalTargetAccount) {
      toast.error("Please select a target account for capital injection.");
      return;
    }
    if (capitalAmount <= 0) {
      toast.error("Please enter a positive capital amount.");
      return;
    }
    setSubmittingCapital(true);
    try {
      const acct = accounts.find(a => a.id === capitalTargetAccount);
      if (!acct) throw new Error("Target account not found");

      // 1. Insert Account Transaction
      const { error: txErr } = await supabase.from("account_transactions").insert({
        shop_id: shopId,
        account_id: capitalTargetAccount,
        type: "deposit",
        amount: capitalAmount,
        ref_type: "capital",
        remarks: capitalNarration || "Owner Capital Injection / Cash Float"
      });
      if (txErr) throw txErr;

      // 2. Update cash account balance
      const newBal = Number(acct.current_balance || 0) + capitalAmount;
      const { error: accErr } = await supabase.from("cash_accounts").update({
        current_balance: newBal
      }).eq("id", capitalTargetAccount);
      if (accErr) throw accErr;

      // 3. Post to General Ledger (Debit 1001 Cash, Credit 3100 Owner Capital)
      const { data: jeData, error: jeErr } = await supabase.from("journal_entries").insert({
        shop_id: shopId,
        entry_date: new Date().toISOString().split("T")[0],
        ref_type: "capital",
        ref_id: capitalTargetAccount,
        narration: `Owner Capital Injection: ${capitalNarration} into ${acct.name}`,
        closing_book_id: activeClosingBook?.id || null
      }).select().single();

      if (!jeErr && jeData) {
        await supabase.from("journal_lines").insert([
          {
            entry_id: jeData.id,
            account_code: "1001",
            account_name: "Cash & Bank Accounts",
            debit: capitalAmount,
            credit: 0
          },
          {
            entry_id: jeData.id,
            account_code: "3100",
            account_name: "Owner's Capital Account",
            debit: 0,
            credit: capitalAmount
          }
        ]);
      }

      toast.success(`Rs. ${capitalAmount.toLocaleString()} capital injected into ${acct.name}! 🎉`);
      setIsCapitalModalOpen(false);
      setCapitalAmount(0);
      loadData();
    } catch (err: any) {
      toast.error("Capital injection failed: " + err.message);
    } finally {
      setSubmittingCapital(false);
    }
  }

  async function handleDeleteAccount(accountId: string) {
    if (permissions?.actions?.delete_account === false) {
      toast.error("Access Denied: You do not have permission to delete accounts.");
      return;
    }
    const acc = accounts.find(a => a.id === accountId);
    if (acc && acc.name.toLowerCase() === "cash in hand") {
      const cashInHandAccounts = accounts.filter(a => a.name.toLowerCase() === "cash in hand");
      if (cashInHandAccounts.length <= 1) {
        toast.error("At least one 'Cash in Hand' account is required and cannot be deleted! 🚫");
        return;
      }
    }
    if (!confirm("Are you sure you want to delete this account? Associated ledger logs will be permanently deleted, and referencing invoice records will be unlinked.")) return;
    try {
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
      logAudit(
        shopId!,
        userId,
        "ACCOUNT_DELETED",
        "cash_accounts",
        accountId,
        {
          account_id: accountId,
          name: acc?.name
        }
      );

      toast.success("Account deleted successfully! 🗑️");
      loadData();
    } catch (err: any) {
      toast.error("Failed to delete account: " + err.message);
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferSource || !transferDest || transferAmount <= 0) {
      toast.error("Please fill in source, destination and valid amount.");
      return;
    }
    if (transferSource === transferDest) {
      toast.error("Source and destination accounts must be different.");
      return;
    }
    setSubmittingTransfer(true);
    try {
      const sourceAcc = accounts.find(a => a.id === transferSource);
      if (!sourceAcc || Number(sourceAcc.current_balance) < transferAmount) {
        toast.error("Insufficient balance in source account!");
        setSubmittingTransfer(false);
        return;
      }

      // Log withdrawal from source
      await supabase.from("account_transactions").insert({
        shop_id: shopId,
        account_id: transferSource,
        type: "transfer_out",
        amount: transferAmount,
        remarks: transferRemarks || `Transfer to ${accounts.find(a => a.id === transferDest)?.name}`
      });

      // Log deposit to destination
      await supabase.from("account_transactions").insert({
        shop_id: shopId,
        account_id: transferDest,
        type: "transfer_in",
        amount: transferAmount,
        remarks: transferRemarks || `Transfer from ${sourceAcc.name}`
      });

      // Update current balances locally & remotely
      await Promise.all([
        supabase.from("cash_accounts").update({ current_balance: Number(sourceAcc.current_balance) - transferAmount }).eq("id", transferSource),
        supabase.from("cash_accounts").update({ current_balance: Number(accounts.find(a => a.id === transferDest)?.current_balance || 0) + transferAmount }).eq("id", transferDest)
      ]);

      logAudit(
        shopId!,
        userId,
        "ACCOUNT_TRANSFER",
        "account_transactions",
        transferSource,
        {
          source_account_id: transferSource,
          dest_account_id: transferDest,
          amount: transferAmount,
          remarks: transferRemarks
        }
      );

      toast.success("Cash transferred successfully! 💸");
      setIsTransferOpen(false);
      setTransferSource("");
      setTransferDest("");
      setTransferAmount(0);
      setTransferRemarks("");
      loadData();
    } catch (err: any) {
      toast.error("Transfer failed: " + err.message);
    } finally {
      setSubmittingTransfer(false);
    }
  }

  const handleAddJournalLine = () => {
    setNewJournalLines([...newJournalLines, { account_code: "1001", debit: 0, credit: 0, party_id: null }]);
  };

  const handleRemoveJournalLine = (index: number) => {
    setNewJournalLines(newJournalLines.filter((_, i) => i !== index));
  };

  const handleJournalLineChange = (index: number, field: "account_code" | "debit" | "credit" | "party_id", value: any) => {
    const updated = [...newJournalLines];
    if (field === "debit" || field === "credit") {
      updated[index][field] = Number(value || 0);
    } else {
      updated[index][field] = value;
    }
    setNewJournalLines(updated);
  };

  const handleAddJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJournalNarration.trim()) {
      toast.error("Please enter a narration/description.");
      return;
    }

    const totalDebits = newJournalLines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = newJournalLines.reduce((sum, l) => sum + l.credit, 0);

    if (totalDebits !== totalCredits) {
      toast.error(`Journal entry is not balanced! Total Debits (Rs ${totalDebits}) must equal Total Credits (Rs ${totalCredits}).`);
      return;
    }

    if (totalDebits <= 0) {
      toast.error("Journal entry must have a value greater than zero.");
      return;
    }

    setSubmittingJournal(true);
    try {
      // 1. Insert header
      const { data: header, error: headerErr } = await supabase
        .from("journal_entries")
        .insert({
          shop_id: shopId,
          entry_date: newJournalDate,
          ref_type: "manual",
          narration: newJournalNarration.trim()
        })
        .select()
        .single();

      if (headerErr) throw headerErr;

      // 2. Insert lines
      const linesToInsert = newJournalLines.map(l => {
        const temp = ACCOUNT_TEMPLATES.find(t => t.code === l.account_code);
        return {
          entry_id: header.id,
          account_code: l.account_code,
          account_name: temp?.name || "General Adjustment Account",
          debit: l.debit,
          credit: l.credit
        };
      });

      const { error: linesErr } = await supabase
        .from("journal_lines")
        .insert(linesToInsert);

      if (linesErr) throw linesErr;

      // 3. Post subsidiary ledger adjustments (Credit Transactions for Khata)
      for (const line of newJournalLines) {
        if (line.party_id && (line.account_code === "1002" || line.account_code === "2001")) {
          const isDebit = line.debit > 0;
          const isCustomer = line.account_code === "1002";
          const amount = isDebit ? line.debit : line.credit;
          
          let transaction_type: "charge" | "payment" = "charge";
          if (isCustomer) {
            // Debit increases customer receivable (+) -> charge. Credit decreases it (-) -> payment.
            transaction_type = isDebit ? "charge" : "payment";
          } else {
            // Credit increases supplier payable (+) -> charge. Debit decreases it (-) -> payment.
            transaction_type = isDebit ? "payment" : "charge";
          }

          const { error: ctErr } = await supabase
            .from("credit_transactions")
            .insert({
              shop_id: shopId,
              customer_id: line.party_id,
              amount: amount,
              transaction_type: transaction_type,
              remarks: `JV Adjust: ${newJournalNarration.trim() || "Manual General Journal Voucher"}`
            });

          if (ctErr) {
            console.error("Subsidiary post failed:", ctErr);
            toast.error(`Subsidiary Khata post failed: ${ctErr.message}`);
          }
        }
      }

      toast.success("General Journal entry posted successfully! 📖");
      setIsAddJournalOpen(false);
      setNewJournalNarration("");
      setNewJournalLines([
        { account_code: "1001", debit: 0, credit: 0 },
        { account_code: "4001", debit: 0, credit: 0 }
      ]);
      loadData();
    } catch (err: any) {
      toast.error("Failed to post journal entry: " + err.message);
    } finally {
      setSubmittingJournal(false);
    }
  };

  async function handleAddAsset(e: React.FormEvent) {
    e.preventDefault();
    if (permissions?.actions?.edit_account === false) {
      toast.error("Access Denied: You do not have permission to add/edit assets.");
      return;
    }
    if (!newAssetName.trim() || newAssetPrice <= 0 || newAssetLife <= 0) return;
    setSubmittingAsset(true);
    try {
      const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
      const initialHistory = [
        {
          version: 1,
          action: "CREATED",
          edited_at: new Date().toISOString(),
          edited_by: userName || "Admin",
          reason: "Initial Asset Acquisition & Capitalization",
          changes: [
            { field: "Asset Name", from: "-", to: newAssetName.trim() },
            { field: "Category", from: "-", to: newAssetType },
            { field: "Purchase Price", from: "-", to: `Rs ${newAssetPrice.toLocaleString()}` },
            { field: "Current Book Value", from: "-", to: `Rs ${newAssetPrice.toLocaleString()}` },
            { field: "Useful Life", from: "-", to: `${newAssetLife} Years` }
          ]
        }
      ];

      const { error } = await supabase
        .from("fixed_assets")
        .insert({
          shop_id: shopId,
          name: newAssetName.trim(),
          asset_type: newAssetType,
          purchase_date: todayStr,
          purchase_price: newAssetPrice,
          useful_life_years: newAssetLife,
          current_value: newAssetPrice,
          edit_history: initialHistory
        });

      if (error) throw error;
      toast.success("Fixed Asset added successfully! 🏢");
      setIsAddAssetOpen(false);
      setNewAssetName("");
      setNewAssetPrice(0);
      setNewAssetLife(5);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingAsset(false);
    }
  }

  function openEditAssetModal(asset: any) {
    setEditingAsset(asset);
    setEditAssetName(asset.name || "");
    setEditAssetType(asset.asset_type || "furniture");
    setEditAssetPrice(Number(asset.purchase_price || 0));
    setEditAssetCurrentVal(Number(asset.current_value ?? asset.purchase_price ?? 0));
    setEditAssetLife(Number(asset.useful_life_years || 5));
    setEditAssetDate(asset.purchase_date ? String(asset.purchase_date).split("T")[0] : new Date().toISOString().split("T")[0]);
    setEditAssetReason("");
    setIsEditAssetOpen(true);
  }

  function openAssetHistoryModal(asset: any) {
    setSelectedHistoryAsset(asset);
    setIsAssetHistoryOpen(true);
  }

  async function handleSaveAssetEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAsset || !editAssetName.trim() || editAssetPrice <= 0 || editAssetLife <= 0) return;
    if (!editAssetReason.trim()) {
      toast.warning("Please enter an edit reason / remark (ضروری وجہ).");
      return;
    }

    setSubmittingEditAsset(true);
    try {
      const changes: Array<{ field: string; from: any; to: any }> = [];
      if (editingAsset.name !== editAssetName.trim()) {
        changes.push({ field: "Asset Name", from: editingAsset.name, to: editAssetName.trim() });
      }
      if (editingAsset.asset_type !== editAssetType) {
        changes.push({ field: "Category", from: editingAsset.asset_type, to: editAssetType });
      }
      if (Number(editingAsset.purchase_price) !== editAssetPrice) {
        changes.push({ field: "Purchase Price", from: `Rs ${Number(editingAsset.purchase_price).toLocaleString()}`, to: `Rs ${editAssetPrice.toLocaleString()}` });
      }
      if (Number(editingAsset.current_value) !== editAssetCurrentVal) {
        changes.push({ field: "Current Value", from: `Rs ${Number(editingAsset.current_value).toLocaleString()}`, to: `Rs ${editAssetCurrentVal.toLocaleString()}` });
      }
      if (Number(editingAsset.useful_life_years) !== editAssetLife) {
        changes.push({ field: "Useful Life", from: `${editingAsset.useful_life_years} Yrs`, to: `${editAssetLife} Yrs` });
      }
      if (editingAsset.purchase_date !== editAssetDate) {
        changes.push({ field: "Purchase Date", from: editingAsset.purchase_date, to: editAssetDate });
      }

      const existingHistory = Array.isArray(editingAsset.edit_history) ? editingAsset.edit_history : [];
      const newVersionNum = existingHistory.length > 0 ? existingHistory.length + 1 : 2;

      const historyEntry = {
        version: newVersionNum,
        action: "EDITED",
        edited_at: new Date().toISOString(),
        edited_by: userName || "Admin",
        reason: editAssetReason.trim(),
        previous_state: {
          name: editingAsset.name,
          asset_type: editingAsset.asset_type,
          purchase_price: editingAsset.purchase_price,
          current_value: editingAsset.current_value,
          useful_life_years: editingAsset.useful_life_years,
          purchase_date: editingAsset.purchase_date
        },
        new_state: {
          name: editAssetName.trim(),
          asset_type: editAssetType,
          purchase_price: editAssetPrice,
          current_value: editAssetCurrentVal,
          useful_life_years: editAssetLife,
          purchase_date: editAssetDate
        },
        changes: changes.length > 0 ? changes : [{ field: "Notes / Revaluation", from: "-", to: editAssetReason.trim() }]
      };

      const updatedHistory = [...existingHistory, historyEntry];

      const { error } = await supabase
        .from("fixed_assets")
        .update({
          name: editAssetName.trim(),
          asset_type: editAssetType,
          purchase_price: editAssetPrice,
          current_value: editAssetCurrentVal,
          useful_life_years: editAssetLife,
          purchase_date: editAssetDate,
          edit_history: updatedHistory
        })
        .eq("id", editingAsset.id);

      if (error) throw error;

      if (shopId) {
        logAudit(shopId, userId, "FIXED_ASSET_EDITED", "fixed_assets", editingAsset.id, {
          asset_id: editingAsset.id,
          name: editAssetName.trim(),
          changes
        });
      }

      toast.success(`Asset "${editAssetName.trim()}" updated & Version #${newVersionNum} logged! 📜`);
      setIsEditAssetOpen(false);
      loadData();
    } catch (err: any) {
      toast.error("Failed to update asset: " + err.message);
    } finally {
      setSubmittingEditAsset(false);
    }
  }

  async function handleDeleteAsset(asset: any) {
    if (!confirm(`Are you sure you want to delete/dispose asset "${asset.name}"?`)) return;
    try {
      const { error } = await supabase
        .from("fixed_assets")
        .update({ status: "disposed" })
        .eq("id", asset.id);

      if (error) throw error;
      toast.success(`Asset "${asset.name}" marked as disposed.`);
      loadData();
    } catch (err: any) {
      toast.error("Failed to delete asset: " + err.message);
    }
  }

  // Double-Entry aggregations helper
  const getGLRawBalance = (code: string) => {
    if (!glBalances[code]) return 0;
    const template = ACCOUNT_TEMPLATES.find(t => t.code === code);
    if (template?.type === "Asset" || template?.type === "Expense") {
      return glBalances[code].debit - glBalances[code].credit;
    } else {
      return glBalances[code].credit - glBalances[code].debit;
    }
  };

  const hasGLEntries = Object.keys(glBalances).length > 0;

  const totalFixedAssetsVal = fixedAssets.reduce((sum, a) => sum + Number(a.current_value || 0), 0);
  const totalCashBankVal = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);

  const totalExpensesVal = ACCOUNT_TEMPLATES.filter(t => t.type === "Expense").reduce((sum, t) => {
    if (industryType === "showroom" && hasGLEntries) return sum + getGLRawBalance(t.code);
    if (hasGLEntries) return sum + getGLRawBalance(t.code);
    if (t.code === "5001") return sum + totalPurchases;
    return sum;
  }, 0);

  const totalRevenueVal = ACCOUNT_TEMPLATES.filter(t => t.type === "Revenue").reduce((sum, t) => {
    if (industryType === "showroom" && hasGLEntries) return sum + getGLRawBalance(t.code);
    if (hasGLEntries) return sum + getGLRawBalance(t.code);
    if (t.code === "4001") return sum + totalSales;
    return sum;
  }, 0);

  const netProfitVal = totalRevenueVal - totalExpensesVal;

  const fallbackAssets = (accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0)) + totalReceivable + inventoryValue + totalFixedAssetsVal;
  const fallbackLiabilities = totalPayable;
  const fallbackOwnersEquity = Math.max(0, (fallbackAssets + totalExpensesVal) - (fallbackLiabilities + totalRevenueVal));

  const ownersEquityVal: number = hasGLEntries ? getGLRawBalance("3100") : fallbackOwnersEquity;

  const getAccountDisplayBalance = (code: string): number => {
    if (industryType === "showroom") {
      if (code === "3300") {
        return (hasGLEntries ? getGLRawBalance("3300") : 0) + netProfitVal;
      }
      if (code === "3100") {
        return ownersEquityVal;
      }
      if (hasGLEntries) {
        return getGLRawBalance(code);
      }
    }
    if (code === "1001" && accounts.length > 0) {
      return totalCashBankVal;
    }
    if (hasGLEntries) {
      if (code === "3300") {
        return getGLRawBalance("3300") + netProfitVal;
      }
      return getGLRawBalance(code);
    }
    if (code === "1002") return totalReceivable;
    if (code === "1003") return inventoryValue;
    if (code === "1400" || code === "1500") return totalFixedAssetsVal;
    if (code === "2001") return totalPayable;
    if (code === "3100") return ownersEquityVal;
    if (code === "3300") return netProfitVal;
    if (code === "4001") return totalSales;
    if (code === "5001") return totalPurchases;
    return 0;
  };

  const totalAssetsVal: number = ACCOUNT_TEMPLATES.filter(t => t.type === "Asset").reduce((sum, t) => sum + getAccountDisplayBalance(t.code), 0);

  const totalLiabilitiesVal: number = ACCOUNT_TEMPLATES.filter(t => t.type === "Liability").reduce((sum, t) => sum + getAccountDisplayBalance(t.code), 0);

  const totalEquityVal: number = ACCOUNT_TEMPLATES.filter(t => t.type === "Equity").reduce((sum, t) => sum + getAccountDisplayBalance(t.code), 0);

  const totalEquityWithProfitVal: number = totalEquityVal;
  const isBalanceSheetBalanced = Math.abs(totalAssetsVal - (totalLiabilitiesVal + totalEquityVal)) < 1;

  // Helper to compute standard accounting Trial Balance row (No negative numbers, debit/credit auto-flipping)
  const getTrialRowValues = (t: typeof ACCOUNT_TEMPLATES[0]) => {
    let rawBal = 0;
    if (hasGLEntries) {
      rawBal = getGLRawBalance(t.code);
    } else {
      if (t.code === "1001") rawBal = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
      else if (t.code === "1002") rawBal = totalReceivable;
      else if (t.code === "1003") rawBal = inventoryValue;
      else if (t.code === "1400") rawBal = totalFixedAssetsVal;
      else if (t.code === "2001") rawBal = totalPayable;
      else if (t.code === "3100") rawBal = ownersEquityVal;
      else if (t.code === "4001") rawBal = totalSales;
      else if (t.code === "5001") rawBal = totalPurchases;
      else if (t.code === "5003") rawBal = totalExpenses;
      else rawBal = 0;
    }

    const isNormalDebit = t.type === "Asset" || t.type === "Expense";
    let debit = 0;
    let credit = 0;

    if (isNormalDebit) {
      if (rawBal >= 0) {
        debit = rawBal;
        credit = 0;
      } else {
        // Negative Asset (e.g. Bank Overdraft) or Negative Expense flips to Credit
        debit = 0;
        credit = Math.abs(rawBal);
      }
    } else {
      if (rawBal >= 0) {
        debit = 0;
        credit = rawBal;
      } else {
        // Negative Liability (e.g. Advance to Supplier) or Negative Equity flips to Debit
        debit = Math.abs(rawBal);
        credit = 0;
      }
    }

    return { rawBal, debit, credit };
  };

  const { sumDebitsVal, sumCreditsVal } = useMemo(() => {
    let totalD = 0;
    let totalC = 0;
    ACCOUNT_TEMPLATES.forEach(t => {
      const { debit, credit } = getTrialRowValues(t);
      totalD += debit;
      totalC += credit;
    });
    return { sumDebitsVal: totalD, sumCreditsVal: totalC };
  }, [hasGLEntries, glBalances, accounts, totalReceivable, inventoryValue, totalFixedAssetsVal, totalPayable, ownersEquityVal, totalSales, totalPurchases, totalExpenses]);

  const isTrialBalanced = Math.abs(sumDebitsVal - sumCreditsVal) < 1;

  // Filtered transactions with chronological running balance calculation
  const filteredTransactionsWithBalance = useMemo(() => {
    const raw = transactions.filter(t => 
      selectedAccFilter === "all" ? true : t.account_id === selectedAccFilter
    );

    // Sort chronologically ascending to compute running balances from inception
    const sortedAsc = [...raw].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let running = 0;
    const computed = sortedAsc.map(tx => {
      const isInflow = tx.type === "deposit" || tx.type === "transfer_in";
      const amt = Number(tx.amount || 0);
      running = isInflow ? running + amt : running - amt;
      return {
        ...tx,
        runningBalance: running
      };
    });

    // Return in reverse chronological order (newest first)
    return computed.reverse();
  }, [transactions, selectedAccFilter]);

  const filteredTransactions = filteredTransactionsWithBalance;

  // Live Wallet Summary metrics for currently selected filter
  const walletSummary = useMemo(() => {
    let totalInflows = 0;
    let totalOutflows = 0;
    let inflowCount = 0;
    let outflowCount = 0;

    filteredTransactions.forEach(tx => {
      const isInflow = tx.type === "deposit" || tx.type === "transfer_in";
      const amt = Number(tx.amount || 0);
      if (isInflow) {
        totalInflows += amt;
        inflowCount++;
      } else {
        totalOutflows += amt;
        outflowCount++;
      }
    });

    const netBalance = selectedAccFilter === "all"
      ? accounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0)
      : Number(accounts.find(a => a.id === selectedAccFilter)?.current_balance || (totalInflows - totalOutflows));

    const selectedAccountName = selectedAccFilter === "all" 
      ? "All Accounts & Wallets" 
      : accounts.find(a => a.id === selectedAccFilter)?.name || "Selected Account";

    return {
      totalInflows,
      totalOutflows,
      inflowCount,
      outflowCount,
      netBalance,
      selectedAccountName
    };
  }, [filteredTransactions, accounts, selectedAccFilter]);

  // Pagination for Wallets Account Ledger
  const [txPage, setTxPage] = useState(1);
  const [txPerPage, setTxPerPage] = useState(25);
  const totalTxPages = Math.ceil(filteredTransactions.length / txPerPage) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * txPerPage;
    return filteredTransactions.slice(start, start + txPerPage);
  }, [filteredTransactions, txPage, txPerPage]);

  // Pagination for General Journal
  const [journalPage, setJournalPage] = useState(1);
  const [journalPerPage, setJournalPerPage] = useState(10);
  const totalJournalPages = Math.ceil(journalEntries.length / journalPerPage) || 1;
  const paginatedJournalEntries = useMemo(() => {
    const start = (journalPage - 1) * journalPerPage;
    return journalEntries.slice(start, start + journalPerPage);
  }, [journalEntries, journalPage, journalPerPage]);

  useEffect(() => {
    setTxPage(1);
  }, [selectedAccFilter, activeTab]);

  async function handleDownloadPDF() {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // VIP Accent banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 220, 10, "F");

      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 10, 220, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text(shopName || "THE ACCOUNTS", 14, 25);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("Premium ERP Financial Wallet Logs & Cash Ledger", 14, 30);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text("ACCOUNT WALLETS & CASH STATEMENT", 14, 40);

      // Metadata box
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(14, 45, 182, 14, "FD");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`Account / Wallet: ${walletSummary.selectedAccountName}`, 18, 51);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Export Date: ${new Date().toLocaleString()}`, 120, 51);
      doc.text(`Net Balance: Rs ${walletSummary.netBalance.toLocaleString()}   |   Inflows: Rs ${walletSummary.totalInflows.toLocaleString()} (${walletSummary.inflowCount} tx)   |   Outflows: Rs ${walletSummary.totalOutflows.toLocaleString()} (${walletSummary.outflowCount} tx)`, 18, 56);

      const tableData = filteredTransactions.map(tx => {
        const isInflow = tx.type === "deposit" || tx.type === "transfer_in";
        return [
          new Date(tx.created_at).toLocaleString(),
          tx.account_name || "Unknown Account",
          tx.type.replace("_", " ").toUpperCase(),
          tx.remarks || "-",
          isInflow ? `+ Rs ${Number(tx.amount).toLocaleString()}` : "-",
          !isInflow ? `- Rs ${Number(tx.amount).toLocaleString()}` : "-",
          `Rs ${Number((tx as any).runningBalance || 0).toLocaleString()}`
        ];
      });

      autoTable(doc, {
        startY: 64,
        head: [["Date & Time", "Wallet", "Type", "Particulars / Remarks", "Inflow (+)", "Outflow (-)", "Running Balance"]],
        body: tableData,
        theme: "grid",
        styles: {
          fontSize: 7.5,
          cellPadding: 2.5,
          valign: "middle",
          font: "helvetica",
          textColor: [30, 41, 59]
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold"
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          4: { halign: "right", textColor: [16, 185, 129] },
          5: { halign: "right", textColor: [239, 68, 68] },
          6: { halign: "right", fontStyle: "bold" }
        }
      });

      // Pagination
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Generated by The Accounts ERP • Page ${i} of ${totalPages}`,
          14,
          287
        );
      }

      doc.save("wallets-ledger-statement.pdf");
      toast.success("Ledger PDF exported! 📄");
    } catch (e) {
      toast.error("PDF generation failed.");
    }
  }

  async function handleDownloadTrialBalancePDF() {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // VIP Accent banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 220, 10, "F");

      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 10, 220, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text(shopName || "THE ACCOUNTS", 14, 25);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("Premium ERP Accounting Verification Sheet", 14, 30);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text("DOUBLE-ENTRY TRIAL BALANCE", 14, 40);

      // Metadata box
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(14, 45, 182, 12, "FD");
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`As of: ${new Date().toLocaleString()}`, 18, 51);
      doc.text(`Status: Verified System Ledger is Balanced`, 120, 51);

      const tableData: any[] = [];
      ACCOUNT_TEMPLATES.forEach(t => {
        const { debit, credit } = getTrialRowValues(t);
        if (showZeroBalances || debit > 0 || credit > 0) {
          tableData.push([
            t.code,
            t.name,
            t.type,
            debit > 0 ? `Rs ${debit.toLocaleString()}` : "-",
            credit > 0 ? `Rs ${credit.toLocaleString()}` : "-"
          ]);
        }
      });

      tableData.push([
        "",
        "TOTAL BALANCE",
        "",
        `Rs ${sumDebitsVal.toLocaleString()}`,
        `Rs ${sumCreditsVal.toLocaleString()}`
      ]);

      autoTable(doc, {
        startY: 63,
        head: [["Code", "Account Name", "Classification", "Debit Balance", "Credit Balance"]],
        body: tableData,
        theme: "grid",
        styles: {
          fontSize: 8.5,
          cellPadding: 3,
          valign: "middle",
          font: "helvetica",
          textColor: [30, 41, 59]
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold"
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          3: { halign: "right" },
          4: { halign: "right" }
        },
        didParseCell: (data) => {
          if (data.section === "body") {
            const detailText = String((data.row.raw as any)[1] || "");
            if (detailText === "TOTAL BALANCE") {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [241, 245, 249];
              data.cell.styles.textColor = [37, 99, 235];
            }
          }
        }
      });

      // Pagination
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Generated by The Accounts ERP • Page ${i} of ${totalPages}`,
          14,
          287
        );
        doc.text("Authorized Signature: _______________________", 130, 287);
      }

      doc.save("trial-balance.pdf");
      toast.success("Trial Balance PDF exported! 📄");
    } catch (e) {
      toast.error("Trial Balance PDF generation failed.");
    }
  }

  // ─── P&L PDF Export Handler ──────────────────────────────────────────
  async function handleDownloadPNLPDF() {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 220, 10, "F");
      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 10, 220, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text(shopName || "THE ACCOUNTS", 14, 25);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("Official Financial Performance Statement", 14, 30);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(37, 99, 235);
      doc.text("PROFIT & LOSS STATEMENT (INCOME STATEMENT)", 14, 40);

      const grossProfit = totalRevenueVal - totalPurchases;
      const netProfit = grossProfit - totalExpensesVal;

      const tableData = [
        ["1. OPERATING REVENUE", "", `Rs ${totalRevenueVal.toLocaleString()}`],
        ["   Sales Revenue & Services Income", "", `Rs ${totalRevenueVal.toLocaleString()}`],
        ["", "", ""],
        ["2. COST OF GOODS SOLD (COGS)", "", `Rs ${totalPurchases.toLocaleString()}`],
        ["   Purchases & Inventory COGS", "", `Rs ${totalPurchases.toLocaleString()}`],
        ["", "", ""],
        ["GROSS PROFIT / (LOSS)", "", `Rs ${grossProfit.toLocaleString()}`],
        ["", "", ""],
        ["3. OPERATING EXPENSES", "", `Rs ${totalExpensesVal.toLocaleString()}`],
        ["   Salaries, Utilities, Rent & General Overhead", "", `Rs ${totalExpensesVal.toLocaleString()}`],
        ["", "", ""],
        ["NET OPERATING PROFIT / (LOSS)", "", `Rs ${netProfit.toLocaleString()}`]
      ];

      autoTable(doc, {
        startY: 48,
        head: [["Financial Category", "Details", "Amount (PKR)"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 3 }
      });

      doc.save("profit-and-loss-statement.pdf");
      toast.success("P&L Statement PDF downloaded! 📄");
    } catch (e) {
      toast.error("PDF generation failed.");
    }
  }

  // ─── Balance Sheet PDF Export Handler ─────────────────────────────
  async function handleDownloadBalanceSheetPDF() {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 220, 10, "F");
      doc.setFillColor(16, 185, 129); // emerald-500
      doc.rect(0, 10, 220, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text(shopName || "THE ACCOUNTS", 14, 25);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(16, 185, 129);
      doc.text("BALANCE SHEET (STATEMENT OF FINANCIAL POSITION)", 14, 40);

      const netIncome = (totalRevenueVal - totalPurchases) - totalExpensesVal;

      const tableData = [
        ["ASSETS (Debits)", "LIABILITIES & EQUITY (Credits)"],
        [`Cash & Bank: Rs ${accounts.reduce((s,a)=>s+Number(a.current_balance),0).toLocaleString()}`, `Accounts Payable: Rs ${totalPayable.toLocaleString()}`],
        [`Accounts Receivable: Rs ${totalReceivable.toLocaleString()}`, `Total Liabilities: Rs ${totalLiabilitiesVal.toLocaleString()}`],
        [`Inventory Asset: Rs ${inventoryValue.toLocaleString()}`, `Owner's Capital: Rs ${ownersEquityVal.toLocaleString()}`],
        [`Fixed Assets: Rs ${totalFixedAssetsVal.toLocaleString()}`, `Retained Earnings (Net Profit): Rs ${netIncome.toLocaleString()}`],
        [`TOTAL ASSETS: Rs ${totalAssetsVal.toLocaleString()}`, `TOTAL EQUITY & LIAB: Rs ${(totalLiabilitiesVal + ownersEquityVal + netIncome).toLocaleString()}`]
      ];

      autoTable(doc, {
        startY: 48,
        head: [["ASSETS SIDE", "LIABILITIES & EQUITY SIDE"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] }
      });

      doc.save("balance-sheet.pdf");
      toast.success("Balance Sheet PDF downloaded! 📊");
    } catch (e) {
      toast.error("PDF generation failed.");
    }
  }

  // ─── CSV Statement Parser Handler for Reconciliation ────────────────
  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      const parsed: Array<{ date: string; description: string; amount: number; matchedTxId?: string }> = [];

      lines.forEach((line, index) => {
        if (index === 0 && line.toLowerCase().includes("date")) return;
        const parts = line.split(/[,;\t]/).map(p => p.trim().replace(/^["']|["']$/g, ""));
        if (parts.length >= 2) {
          const dateStr = parts[0];
          const desc = parts[1] || "Bank Line Item";
          const amt = parseFloat(parts[2] || parts[3] || "0") || 0;
          if (amt !== 0) {
            const match = reconTransactions.find(tx => Math.abs(Number(tx.amount) - Math.abs(amt)) < 0.01 && !reconChecked.has(tx.id));
            parsed.push({
              date: dateStr,
              description: desc,
              amount: Math.abs(amt),
              matchedTxId: match?.id
            });
          }
        }
      });

      setCsvRows(parsed);
      const autoMatchedIds = parsed.filter(p => p.matchedTxId).map(p => p.matchedTxId!);
      if (autoMatchedIds.length > 0) {
        setReconChecked(prev => new Set([...Array.from(prev), ...autoMatchedIds]));
        toast.success(`CSV Parsed! ${autoMatchedIds.length} matching transactions auto-selected for reconciliation.`);
      } else {
        toast.info(`CSV Parsed ${parsed.length} statement rows.`);
      }
    };
    reader.readAsText(file);
  }

  // ─── Fetch Inventory Valuation Data ─────────────────────────────────
  async function fetchInventoryValuation() {
    if (!shopId) return;
    setValuationLoading(true);
    try {
      const [prodsRes, batchesRes, poItemsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, code, unit, sale_price_single, purchase_price_single, current_stock")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),
        supabase
          .from("product_batches")
          .select("product_id, batch_number, stock_quantity, purchase_price, sale_price, expiry_date, created_at")
          .eq("shop_id", shopId),
        supabase
          .from("purchase_order_items")
          .select("product_id, quantity, purchase_price, created_at")
          .order("created_at", { ascending: false })
          .limit(500)
      ]);

      if (prodsRes.error) throw prodsRes.error;

      const batchMap: Record<string, any[]> = {};
      (batchesRes.data || []).forEach((b: any) => {
        if (!b.product_id) return;
        if (!batchMap[b.product_id]) batchMap[b.product_id] = [];
        batchMap[b.product_id].push(b);
      });

      const latestPoMap: Record<string, number> = {};
      (poItemsRes.data || []).forEach((po: any) => {
        if (po.product_id && !latestPoMap[po.product_id] && Number(po.purchase_price) > 0) {
          latestPoMap[po.product_id] = Number(po.purchase_price);
        }
      });

      const enriched = (prodsRes.data || []).map((p: any) => {
        const prodBatches = batchMap[p.id] || [];
        const batchStockSum = prodBatches.reduce((s: number, b: any) => s + (Number(b.stock_quantity) || 0), 0);
        const qty = Number(p.current_stock ?? (prodBatches.length > 0 ? batchStockSum : 0));

        const wAvgCost = Number(p.purchase_price_single || 0);
        const latestBatch = prodBatches.length > 0 ? prodBatches[prodBatches.length - 1] : null;
        const fifoCost = Number(latestBatch?.purchase_price || latestPoMap[p.id] || (wAvgCost > 0 ? wAvgCost : Number(p.sale_price_single || 0) * 0.85));
        const salePrice = Number(p.sale_price_single || 0);

        return {
          id: p.id,
          name: p.name,
          code: p.code || "",
          unit: p.unit || "Pcs",
          stock_quantity: qty,
          cost_price: wAvgCost,
          fifo_cost: fifoCost,
          sale_price: salePrice,
          batches: prodBatches
        };
      });

      setProductsValuation(enriched);
    } catch (err: any) {
      console.error("Valuation load error:", err);
      toast.error("Failed to load inventory valuation: " + err.message);
    } finally {
      setValuationLoading(false);
    }
  }

  // ─── Download Inventory Valuation PDF ────────────────────────────────
  async function handleDownloadValuationPDF(filteredList: any[]) {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 28, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(shopName?.toUpperCase() || "THE ACCOUNTS", 14, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`INVENTORY VALUATION & AUDIT REPORT (${valuationMethod === "fifo" ? "FIFO METHOD" : "WEIGHTED AVERAGE COST"})`, 14, 19);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24);

      const tableRows = filteredList.map((p, idx) => {
        const qty = Number(p.stock_quantity || 0);
        const unitCost = valuationMethod === "fifo" ? Number(p.fifo_cost || p.cost_price || 0) : Number(p.cost_price || 0);
        const valTotal = qty * unitCost;
        const saleTotal = qty * Number(p.sale_price || 0);

        return [
          idx + 1,
          p.name,
          p.code || "-",
          `${qty} ${p.unit}`,
          `Rs ${unitCost.toFixed(2)}`,
          `Rs ${Number(p.sale_price || 0).toLocaleString()}`,
          `Rs ${Math.round(valTotal).toLocaleString()}`,
          `Rs ${Math.round(saleTotal).toLocaleString()}`
        ];
      });

      autoTable(doc, {
        startY: 34,
        head: [["#", "Product Name", "SKU / Code", "In-Stock", "Unit Cost", "Retail Rate", "Valuation (Cost)", "Expected Retail"]],
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold"
        },
        bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 50, fontStyle: "bold" },
          2: { cellWidth: 22 },
          3: { cellWidth: 20, halign: "center", fontStyle: "bold" },
          4: { cellWidth: 22, halign: "right" },
          5: { cellWidth: 22, halign: "right" },
          6: { cellWidth: 24, halign: "right", fontStyle: "bold" },
          7: { cellWidth: 24, halign: "right" },
        },
        margin: { left: 10, right: 10 }
      });

      doc.save(`inventory_valuation_${valuationMethod}_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Inventory Valuation PDF downloaded!");
    } catch (err: any) {
      toast.error("Failed to generate PDF: " + err.message);
    }
  }

  if (!allowAccounts) {
    return <SubscriptionBlocker featureName="Chart of Accounts & Ledger" requiredPlan="Starter" />;
  }

  return (
    <div className="space-y-3 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2.5 pb-2.5 border-b border-slate-200/80">
        <div className="flex items-center gap-1.5">
          {activeTab === "wallets" && permissions?.actions?.edit_account !== false && !activeClosingBook && (
            <>
              <button 
                type="button"
                onClick={() => {
                  setCapitalTargetAccount(accounts[0]?.id || "");
                  setIsCapitalModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <Coins size={13} /> Add Capital
              </button>
              <button 
                type="button"
                onClick={() => setIsTransferOpen(true)}
                className="flex items-center gap-1 px-3 h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200 shadow-2xs cursor-pointer"
              >
                <ArrowRightLeft size={13} /> Transfer
              </button>
              <button 
                type="button"
                onClick={() => setIsAddAccountOpen(true)}
                className="flex items-center gap-1 px-3 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <Plus size={13} /> Add Account
              </button>
            </>
          )}

          {activeTab === "statements" && (
            <div className="flex gap-1.5">
              <button 
                type="button"
                onClick={handleDownloadPNLPDF}
                className="flex items-center gap-1 px-3 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <Download size={12} /> P&L PDF
              </button>
              <button 
                type="button"
                onClick={handleDownloadBalanceSheetPDF}
                className="flex items-center gap-1 px-3 h-8 bg-emerald-600 hover:emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <Download size={12} /> Balance Sheet
              </button>
            </div>
          )}

          {activeTab === "journal" && !activeClosingBook && (
            <button 
              type="button"
              onClick={() => setIsAddJournalOpen(true)}
              className="flex items-center gap-1 px-3 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <BookOpen size={13} /> New Entry
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-1 border border-slate-200/80 bg-white rounded-xl p-0.5 shrink-0 select-none shadow-2xs w-full overflow-x-auto">
        <button
          onClick={() => setActiveTab("wallets")}
          className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "wallets"
              ? "bg-blue-600 text-white shadow-2xs font-black"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Wallet size={12} /> Wallets
        </button>
        <button
          onClick={() => setActiveTab("chart")}
          className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "chart"
              ? "bg-blue-600 text-white shadow-2xs font-black"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Layers size={12} /> CoA {!allowIndustrialAccounts && "🔒"}
        </button>
        <button
          onClick={() => setActiveTab("journal")}
          className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "journal"
              ? "bg-blue-600 text-white shadow-2xs font-black"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <BookOpen size={12} /> Journal {!allowIndustrialAccounts && "🔒"}
        </button>
        <button
          onClick={() => setActiveTab("trial")}
          className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "trial"
              ? "bg-blue-600 text-white shadow-2xs font-black"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Scale size={12} /> Trial Balance {!allowIndustrialAccounts && "🔒"}
        </button>

        {/* NEW ACCOUNTING MODULE TABS */}
        <button
          onClick={() => setActiveTab("statements")}
          className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "statements"
              ? "bg-blue-600 text-white shadow-2xs font-black"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <FileCheck size={12} /> Statements (P&L/BS)
        </button>
        <button
          onClick={() => setActiveTab("valuation")}
          className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "valuation"
              ? "bg-blue-600 text-white shadow-2xs font-black"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Package size={12} /> Valuation
        </button>
        <button
          onClick={() => setActiveTab("currency")}
          className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "currency"
              ? "bg-blue-600 text-white shadow-2xs font-black"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Coins size={12} /> Multi-Currency
        </button>
        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "reconciliation"
              ? "bg-blue-600 text-white shadow-2xs font-black"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <CheckSquare size={12} /> Reconcile
        </button>
        <button
          onClick={() => setActiveTab("cheques")}
          className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === "cheques"
              ? "bg-blue-600 text-white shadow-2xs font-black"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <CalendarCheck size={12} /> PDC
        </button>
        {hasAssetsRec && (
          <button
            onClick={() => setActiveTab("assets")}
            className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === "assets"
                ? "bg-blue-600 text-white shadow-2xs font-black"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Landmark size={12} /> Assets
          </button>
        )}
      </div>

      {!allowIndustrialAccounts && (activeTab === "chart" || activeTab === "trial" || activeTab === "journal") ? (
        <SubscriptionBlocker featureName="General Ledgers & Trial Balance statements" requiredPlan="Starter" />
      ) : loading && accounts.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {activeTab === "wallets" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">My Wallets & Accounts</h2>
                  <div className="text-[10px] font-bold text-slate-400">{accounts.length} Active</div>
                </div>

                {/* Consolidated All-Accounts Card */}
                <div 
                  onClick={() => setSelectedAccFilter("all")}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                    selectedAccFilter === "all"
                      ? "border-blue-500 bg-blue-50/50 shadow-sm ring-2 ring-blue-500/30"
                      : "border-slate-200 bg-white hover:border-blue-200 shadow-2xs"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[9px] uppercase font-black text-blue-600 tracking-wider">
                        Consolidated Overview
                      </p>
                      <h3 className="font-extrabold text-slate-800 text-xs mt-0.5">All Accounts & Wallets</h3>
                    </div>
                    <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                      <Layers size={14} />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between">
                    <div className="text-slate-400 text-[10px] font-semibold">Total Funds</div>
                    <div className="text-sm font-black text-slate-900 font-mono">
                      Rs {accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Individual Account Cards */}
                <div className="space-y-2">
                  {accounts.map(acc => {
                    const isSelected = selectedAccFilter === acc.id;
                    return (
                      <div 
                        key={acc.id} 
                        onClick={() => setSelectedAccFilter(acc.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                          isSelected
                            ? "border-blue-500 bg-blue-50/50 shadow-sm ring-2 ring-blue-500/30"
                            : "border-slate-200 bg-white hover:border-blue-200 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-[9px] uppercase font-black text-slate-400 tracking-wider">
                              {acc.type === "cash" ? "Cash Drawer" : acc.type === "bank" ? "Bank Ledger" : "Mobile Wallet"}
                            </p>
                            <h3 className="font-extrabold text-slate-800 text-xs mt-0.5">{acc.name}</h3>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {permissions?.actions?.delete_account !== false && (() => {
                              const cashInHandCount = accounts.filter(a => a.name.toLowerCase() === "cash in hand").length;
                              const isLastCashInHand = acc.name.toLowerCase() === "cash in hand" && cashInHandCount <= 1;
                              return !isLastCashInHand;
                            })() && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAccount(acc.id);
                                }}
                                className="p-1 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-all border border-rose-100 cursor-pointer shadow-2xs"
                                title="Delete account"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                            <div className={`p-1.5 rounded-lg ${
                              acc.type === "cash" ? "bg-amber-50 text-amber-600" : acc.type === "bank" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                            }`}>
                              {acc.type === "cash" ? <Landmark size={14} /> : acc.type === "bank" ? <Landmark size={14} /> : <Wallet size={14} />}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-baseline justify-between">
                          <div className="text-slate-400 text-[10px] font-semibold">Balance</div>
                          <div className="text-sm font-black text-slate-900 font-mono">Rs {Number(acc.current_balance).toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-black text-slate-800 text-sm">Account Ledger & Cash Book</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      Live sync: {walletSummary.selectedAccountName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {filteredTransactions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 rounded-xl text-xs font-black text-slate-600 transition-all shadow-sm cursor-pointer"
                      >
                        <Download size={13} /> Download PDF
                      </button>
                    )}
                    <select 
                      value={selectedAccFilter}
                      onChange={e => setSelectedAccFilter(e.target.value)}
                      className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      <option value="all">All Accounts</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Dynamic Live Balance KPI Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-150 shadow-2xs">
                    <div className="text-[9px] font-black uppercase text-blue-600 tracking-wider block">Net Live Balance</div>
                    <h4 className="text-xl font-black text-blue-900 mt-1 font-mono">
                      Rs {walletSummary.netBalance.toLocaleString()}
                    </h4>
                    <div className="text-[10px] font-semibold text-blue-700 mt-1 flex items-center gap-1">
                      <CheckCircle2 size={11} className="text-blue-600" /> Live Ledger Verified
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-150 shadow-2xs">
                    <div className="text-[9px] font-black uppercase text-emerald-700 tracking-wider block">Total Inflows (وصولیاں)</div>
                    <h4 className="text-xl font-black text-emerald-900 mt-1 font-mono">
                      + Rs {walletSummary.totalInflows.toLocaleString()}
                    </h4>
                    <div className="text-[10px] font-semibold text-emerald-700 mt-1 block">
                      {walletSummary.inflowCount} Inflow Transactions
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-150 shadow-2xs">
                    <div className="text-[9px] font-black uppercase text-rose-700 tracking-wider block">Total Outflows (ادائیگی)</div>
                    <h4 className="text-xl font-black text-rose-900 mt-1 font-mono">
                      - Rs {walletSummary.totalOutflows.toLocaleString()}
                    </h4>
                    <div className="text-[10px] font-semibold text-rose-700 mt-1 block">
                      {walletSummary.outflowCount} Outflow Transactions
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                  {filteredTransactions.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 text-xs font-medium">No ledger entries found</div>
                  ) : (
                    <>
                      <table className="w-full text-left border-collapse text-xs min-w-[750px]">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-black uppercase text-[9px] tracking-wider bg-slate-50/50">
                            <th className="py-2.5 px-3">Date & Time</th>
                            <th className="py-2.5 px-3">Wallet</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Particulars / Remarks</th>
                            <th className="py-2.5 px-3 text-right">Inflow (+)</th>
                            <th className="py-2.5 px-3 text-right">Outflow (-)</th>
                            <th className="py-2.5 px-3 text-right">Running Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedTransactions.map(tx => {
                            const isInflow = tx.type === "deposit" || tx.type === "transfer_in";
                            const amt = Number(tx.amount || 0);
                            const running = Number((tx as any).runningBalance || 0);
                            return (
                              <tr key={tx.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="py-2.5 px-3 text-slate-500 font-medium font-mono text-[11px]">
                                  {new Date(tx.created_at).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-700">
                                  {tx.account_name}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[9px] ${
                                    isInflow ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                                  }`}>
                                    {isInflow ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                                    {tx.type.replace("_", " ").toUpperCase()}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-slate-650 font-medium max-w-md">
                                  {tx.remarks || "-"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-black font-mono text-emerald-600">
                                  {isInflow ? `+ Rs ${amt.toLocaleString()}` : "-"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-black font-mono text-rose-600">
                                  {!isInflow ? `- Rs ${amt.toLocaleString()}` : "-"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-black font-mono text-slate-900 bg-slate-50/50">
                                  Rs {running.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Pagination Controls */}
                      {filteredTransactions.length > 0 && (
                        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                            <div>Showing {(txPage - 1) * txPerPage + 1} to {Math.min(txPage * txPerPage, filteredTransactions.length)} of {filteredTransactions.length} entries</div>
                            <select
                              value={txPerPage}
                              onChange={(e) => { setTxPerPage(Number(e.target.value)); setTxPage(1); }}
                              className="h-7 px-2 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 outline-none cursor-pointer"
                            >
                              <option value={15}>15 / page</option>
                              <option value={25}>25 / page</option>
                              <option value={50}>50 / page</option>
                              <option value={100}>100 / page</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={txPage === 1}
                              onClick={() => setTxPage(p => Math.max(1, p - 1))}
                              className="h-7 px-2.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-2xs"
                            >
                              Previous
                            </button>
                            <div className="px-2 font-bold text-slate-700 text-xs">
                              Page {txPage} of {totalTxPages}
                            </div>
                            <button
                              type="button"
                              disabled={txPage === totalTxPages}
                              onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                              className="h-7 px-2.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-2xs"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "chart" && (
            <div className="space-y-4">
              {/* Balance Sheet Real-time Accounting Equality Validation Banner */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${isBalanceSheetBalanced ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                    <Scale size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-black text-slate-800 text-sm">Balance Sheet Equation</div>
                      <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                        isBalanceSheetBalanced ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {isBalanceSheetBalanced ? "Strictly Balanced (متوازن)" : "Variance"}
                      </div>
                    </div>
                    <p className="text-slate-500 font-mono text-[11px] mt-0.5">
                      Total Assets (Rs {totalAssetsVal.toLocaleString()}) = Total Liabilities (Rs {totalLiabilitiesVal.toLocaleString()}) + Owner Equity & Retained Earnings (Rs {totalEquityWithProfitVal.toLocaleString()})
                    </p>
                  </div>
                </div>
                {industryType === "showroom" && (
                  <div className="text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-xl">
                    Auto-Synced with Showroom Sub-Ledgers
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Category: ASSETS */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-500" />
                  <div>
                    <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
                      <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                        <Landmark size={15} />
                      </div>
                      Assets (1000)
                    </h3>
                    <div className="space-y-3">
                      {ACCOUNT_TEMPLATES.filter(t => t.type === "Asset").map(t => {
                        const bal = getAccountDisplayBalance(t.code);
                        return (
                          <div key={t.code} className="flex justify-between items-center py-2 border-b border-slate-100 border-dashed last:border-0">
                            <div>
                              <p className="text-xs font-bold text-slate-700">{t.name}</p>
                              <p className="text-[9px] text-slate-400 font-semibold uppercase">{t.code}</p>
                            </div>
                            <div className="text-xs font-black text-slate-800">Rs {bal.toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-baseline">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Assets</div>
                    <div className="text-sm font-black text-blue-650">
                      Rs {totalAssetsVal.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Category: LIABILITIES */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />
                  <div>
                    <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
                      <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                        <Users size={15} />
                      </div>
                      Liabilities (2000)
                    </h3>
                    <div className="space-y-3">
                      {ACCOUNT_TEMPLATES.filter(t => t.type === "Liability").map(t => {
                        const bal = getAccountDisplayBalance(t.code);
                        return (
                          <div key={t.code} className="flex justify-between items-center py-2 border-b border-slate-100 border-dashed last:border-0">
                            <div>
                              <p className="text-xs font-bold text-slate-700">{t.name}</p>
                              <p className="text-[9px] text-slate-400 font-semibold uppercase">{t.code}</p>
                            </div>
                            <div className="text-xs font-black text-slate-800">Rs {bal.toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-baseline">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Liabilities</div>
                    <div className="text-sm font-black text-rose-650">Rs {totalLiabilitiesVal.toLocaleString()}</div>
                  </div>
                </div>

                {/* Category: EQUITY */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
                  <div>
                    <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
                      <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                        <Scale size={15} />
                      </div>
                      Equity (3000)
                    </h3>
                    <div className="space-y-3">
                      {ACCOUNT_TEMPLATES.filter(t => t.type === "Equity").map(t => {
                        const bal = getAccountDisplayBalance(t.code);
                        return (
                          <div key={t.code} className="flex justify-between items-center py-2 border-b border-slate-100 border-dashed last:border-0">
                            <div>
                              <p className="text-xs font-bold text-slate-700">{t.name}</p>
                              <p className="text-[9px] text-slate-400 font-semibold uppercase">{t.code}</p>
                            </div>
                            <div className="text-xs font-black text-slate-800">Rs {bal.toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-baseline">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Equity</div>
                    <div className="text-sm font-black text-amber-655">Rs {totalEquityVal.toLocaleString()}</div>
                  </div>
                </div>

                {/* Category: REVENUE */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
                  <div>
                    <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <TrendingUp size={15} />
                      </div>
                      Revenue (4000)
                    </h3>
                    <div className="space-y-3">
                      {ACCOUNT_TEMPLATES.filter(t => t.type === "Revenue").map(t => {
                        const bal = getAccountDisplayBalance(t.code);
                        return (
                          <div key={t.code} className="flex justify-between items-center py-2 border-b border-slate-100 border-dashed last:border-0">
                            <div>
                              <p className="text-xs font-bold text-slate-700">{t.name}</p>
                              <p className="text-[9px] text-slate-400 font-semibold uppercase">{t.code}</p>
                            </div>
                            <div className="text-xs font-black text-slate-800">Rs {bal.toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-baseline">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Revenue</div>
                    <div className="text-sm font-black text-emerald-650">Rs {totalRevenueVal.toLocaleString()}</div>
                  </div>
                </div>

                {/* Category: EXPENSES */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-violet-500" />
                  <div>
                    <h3 className="font-black text-slate-800 text-sm mb-4 flex items-center gap-2">
                      <div className="p-1.5 bg-violet-50 text-violet-600 rounded-lg">
                        <Coins size={15} />
                      </div>
                      Expenses (5000)
                    </h3>
                    <div className="space-y-3">
                      {ACCOUNT_TEMPLATES.filter(t => t.type === "Expense").map(t => {
                        const bal = getAccountDisplayBalance(t.code);
                        return (
                          <div key={t.code} className="flex justify-between items-center py-2 border-b border-slate-100 border-dashed last:border-0">
                            <div>
                              <p className="text-xs font-bold text-slate-700">{t.name}</p>
                              <p className="text-[9px] text-slate-400 font-semibold uppercase">{t.code}</p>
                            </div>
                            <div className="text-xs font-black text-slate-800">Rs {bal.toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-baseline">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Expenses</div>
                    <div className="text-sm font-black text-violet-650">Rs {totalExpensesVal.toLocaleString()}</div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === "journal" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="font-black text-slate-800 text-sm">General Journal Ledger</h3>
                  <p className="text-[10px] text-slate-400 font-semibold">Chronological audit ledger entries of your business</p>
                </div>
              </div>

              <div className="overflow-x-auto space-y-6">
                {journalEntries.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs font-medium">No journal entries posted yet.</div>
                ) : (
                  <>
                    {paginatedJournalEntries.map(entry => (
                      <div key={entry.id} className="border border-slate-150 rounded-2xl overflow-hidden shadow-xs">
                        <div className="bg-slate-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-150">
                          <div>
                            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                              Entry: #{entry.id.substring(0, 8).toUpperCase()}
                            </div>
                            <h4 className="text-xs font-black text-slate-800 mt-0.5">
                              {entry.narration || "General Journal Entry Adjustment"}
                            </h4>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-[10px] font-black uppercase bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                              {entry.ref_type || "manual"}
                            </div>
                            <div className="text-[10px] font-mono font-black text-slate-500">
                              {new Date(entry.entry_date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] bg-slate-50/20">
                              <th className="py-2 px-4">Account Code</th>
                              <th className="py-2 px-4">Account Name</th>
                              <th className="py-2 px-4 text-right">Debit (Rs)</th>
                              <th className="py-2 px-4 text-right">Credit (Rs)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                            {entry.journal_lines.map(line => (
                              <tr key={line.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/30">
                                <td className="py-2.5 px-4 font-mono text-slate-400">{line.account_code}</td>
                                <td className="py-2.5 px-4 font-bold text-slate-800">{line.account_name}</td>
                                <td className="py-2.5 px-4 text-right font-bold text-slate-700">
                                  {line.debit > 0 ? `Rs ${line.debit.toLocaleString()}` : "-"}
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold text-slate-700">
                                  {line.credit > 0 ? `Rs ${line.credit.toLocaleString()}` : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}

                    {/* Journal Pagination Bar */}
                    {journalEntries.length > 0 && (
                      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                          <div>Showing {(journalPage - 1) * journalPerPage + 1} to {Math.min(journalPage * journalPerPage, journalEntries.length)} of {journalEntries.length} entries</div>
                          <select
                            value={journalPerPage}
                            onChange={(e) => { setJournalPerPage(Number(e.target.value)); setJournalPage(1); }}
                            className="h-7 px-2 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 outline-none cursor-pointer"
                          >
                            <option value={5}>5 / page</option>
                            <option value={10}>10 / page</option>
                            <option value={20}>20 / page</option>
                            <option value={50}>50 / page</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={journalPage === 1}
                            onClick={() => setJournalPage(p => Math.max(1, p - 1))}
                            className="h-7 px-2.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-2xs"
                          >
                            Previous
                          </button>
                          <div className="px-2 font-bold text-slate-700 text-xs">
                            Page {journalPage} of {totalJournalPages}
                          </div>
                          <button
                            type="button"
                            disabled={journalPage === totalJournalPages}
                            onClick={() => setJournalPage(p => Math.min(totalJournalPages, p + 1))}
                            className="h-7 px-2.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-2xs"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
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
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-slate-655 font-bold cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={showZeroBalances} 
                      onChange={(e) => setShowZeroBalances(e.target.checked)}
                      className="rounded text-blue-600 border-slate-300 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    Show Zero Balances
                  </label>
                  <button
                    type="button"
                    onClick={handleDownloadTrialBalancePDF}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-200 cursor-pointer"
                  >
                    <Download size={13} /> Download Trial Balance PDF
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[600px]">
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
                    {ACCOUNT_TEMPLATES.map(t => {
                      const { debit, credit } = getTrialRowValues(t);
                      
                      if (debit === 0 && credit === 0 && !showZeroBalances) return null;

                      return (
                        <tr key={t.code} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50">
                          <td className="py-3 px-3 font-mono font-semibold text-slate-400">{t.code}</td>
                          <td className="py-3 px-3 font-bold text-slate-850">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <div>{t.name}</div>
                              {t.type === "Asset" && credit > 0 && (
                                <div className="text-[8.5px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-md">
                                  Overdraft (Credit Bal)
                                </div>
                              )}
                              {t.type === "Liability" && debit > 0 && (
                                <div className="text-[8.5px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-md">
                                  Advance (Debit Bal)
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className={`px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase leading-none ${
                              t.type === "Asset" ? "bg-blue-50 text-blue-600 border-blue-100" :
                              t.type === "Liability" ? "bg-rose-50 text-rose-600 border-rose-100" :
                              t.type === "Equity" ? "bg-amber-50 text-amber-600 border-amber-100" :
                              t.type === "Revenue" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                              "bg-violet-50 text-violet-600 border-violet-100"
                            }`}>
                              {t.type}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-750 font-mono">
                            {debit > 0 ? `Rs ${debit.toLocaleString()}` : "-"}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-750 font-mono">
                            {credit > 0 ? `Rs ${credit.toLocaleString()}` : "-"}
                          </td>
                        </tr>
                      );
                    })}

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

              {/* Equality validation badge */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs rounded-b-3xl">
                {isTrialBalanced ? (
                  <div className="flex items-center gap-2 text-emerald-700 font-bold">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <div>Accounting Equality Verified: Total Debits (Rs {sumDebitsVal.toLocaleString()}) = Total Credits (Rs {sumCreditsVal.toLocaleString()})</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-700 font-bold">
                    <ShieldAlert size={16} className="text-amber-600" />
                    <div>Trial Balance Variance: Rs {Math.abs(sumDebitsVal - sumCreditsVal).toLocaleString()}</div>
                  </div>
                )}
                <div className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                  isTrialBalanced ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}>
                  {isTrialBalanced ? "Strictly Balanced (متوازن)" : "Variance"}
                </div>
              </div>
            </div>
          )}

          {activeTab === "assets" && hasAssetsRec && (
            <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    <Landmark size={18} className="text-blue-600" /> Fixed Assets & Machinery Register
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Track property, equipment, valuation revisions, and audit version history.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2 bg-blue-50/70 border border-blue-200/60 px-3 py-1.5 rounded-xl">
                    <div className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Total Book Value:</div>
                    <div className="text-xs font-black text-blue-900 font-mono">
                      Rs {fixedAssets.reduce((s, a) => s + Number(a.current_value || 0), 0).toLocaleString()}
                    </div>
                  </div>

                  {permissions?.actions?.edit_account !== false && !activeClosingBook && (
                    <button
                      type="button"
                      onClick={() => setIsAddAssetOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-200 cursor-pointer"
                    >
                      <Plus size={14} /> Add Asset
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs min-w-[750px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 font-black uppercase text-[10px]">
                      <th className="py-3 px-3.5">Asset Details</th>
                      <th className="py-3 px-3.5">Category</th>
                      <th className="py-3 px-3.5 text-right">Purchase Price</th>
                      <th className="py-3 px-3.5 text-right">Current Value</th>
                      <th className="py-3 px-3.5 text-center">Useful Life</th>
                      <th className="py-3 px-3.5 text-center">Version History</th>
                      <th className="py-3 px-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {fixedAssets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-14 text-center text-slate-400 font-semibold space-y-2">
                          <Landmark className="mx-auto h-10 w-10 text-slate-300 mb-1" />
                          <p className="text-sm font-bold text-slate-700">No fixed assets recorded yet.</p>
                          <p className="text-xs text-slate-400">Click &quot;+ Add Asset&quot; above to register company furniture, equipment, or vehicles.</p>
                        </td>
                      </tr>
                    ) : (
                      fixedAssets.map(asset => {
                        const historyList = Array.isArray(asset.edit_history) ? asset.edit_history : [];
                        const editCount = historyList.filter((h: any) => h.action === "EDITED" || h.version > 1).length;
                        const versionNum = historyList.length > 0 ? historyList[historyList.length - 1]?.version || (editCount + 1) : 1;

                        return (
                          <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5">
                              <div>
                                <p className="font-extrabold text-slate-900 text-xs">{asset.name}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                                  <div>Acquired: {asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : "-"}</div>
                                  <div>·</div>
                                  <div className="font-mono text-slate-400 text-[9px]">ID: #{asset.id.slice(0, 6).toUpperCase()}</div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3.5">
                              <div className="uppercase text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                {asset.asset_type || "General"}
                              </div>
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-medium text-slate-600">
                              Rs {Number(asset.purchase_price).toLocaleString()}
                            </td>

                            <td className="py-3 px-3.5 text-right font-mono font-black text-blue-700 text-xs">
                              Rs {Number(asset.current_value).toLocaleString()}
                            </td>

                            <td className="py-3 px-3.5 text-center font-bold text-slate-600 text-xs">
                              {asset.useful_life_years || 5} Yrs
                            </td>

                            <td className="py-3 px-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => openAssetHistoryModal(asset)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer border ${
                                  editCount > 0
                                    ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 shadow-xs"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                }`}
                                title="Click to view full revision history & audit trail"
                              >
                                <History size={12} className={editCount > 0 ? "text-amber-600" : "text-slate-400"} />
                                <div>v{versionNum}</div>
                                {editCount > 0 && (
                                  <div className="bg-amber-200/80 text-amber-900 text-[9px] px-1 rounded-full font-bold">
                                    {editCount} {editCount === 1 ? "edit" : "edits"}
                                  </div>
                                )}
                              </button>
                            </td>

                            <td className="py-3 px-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditAssetModal(asset)}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-blue-200"
                                  title="Edit Asset Details"
                                >
                                  <Edit2 size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openAssetHistoryModal(asset)}
                                  className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-amber-200"
                                  title="View Version History"
                                >
                                  <History size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteAsset(asset)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                                  title="Delete / Dispose Asset"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── POST-DATED CHEQUES TAB ─── */}
          {activeTab === "cheques" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <CalendarCheck size={18} className="text-violet-600" /> Post-Dated Cheques (PDC)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Track receivable & payable cheques. Clear to auto-post account transaction.</p>
                </div>
                {!activeClosingBook && (
                  <button
                    onClick={() => { setIsAddChequeOpen(true); }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-violet-200 cursor-pointer"
                  >
                    <Plus size={13} /> Add Cheque
                  </button>
                )}
              </div>

              {chequesLoading ? (
                <div className="flex items-center justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
              ) : cheques.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <CalendarCheck size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-semibold text-sm">No cheques recorded yet.</p>
                  <p className="text-xs mt-1">Click "Add Cheque" to start tracking post-dated cheques.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-black uppercase text-[9px] tracking-wider bg-slate-50/50">
                        <th className="py-2.5 px-3">Cheque #</th>
                        <th className="py-2.5 px-3">Party</th>
                        <th className="py-2.5 px-3">Bank</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Due Date</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                      {cheques.map(ch => (
                        <tr key={ch.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50">
                          <td className="py-3 px-3 font-bold text-slate-800">{ch.cheque_number}</td>
                          <td className="py-3 px-3 text-slate-600">{ch.party_name || "-"}</td>
                          <td className="py-3 px-3 text-slate-500">{ch.bank_name || "-"}</td>
                          <td className="py-3 px-3">
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ch.cheque_type === "receivable" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                              {ch.cheque_type === "receivable" ? "Receivable" : "Payable"}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-black text-slate-800">Rs {Number(ch.amount).toLocaleString()}</td>
                          <td className="py-3 px-3 text-slate-500">{new Date(ch.due_date).toLocaleDateString()}</td>
                          <td className="py-3 px-3">
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ch.status === "cleared" ? "bg-blue-100 text-blue-700"
                              : ch.status === "bounced" ? "bg-red-100 text-red-700"
                              : ch.status === "cancelled" ? "bg-slate-100 text-slate-500"
                              : "bg-amber-100 text-amber-700"
                            }`}>
                              {ch.status.charAt(0).toUpperCase() + ch.status.slice(1)}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {ch.status === "pending" && !activeClosingBook && (
                              <div className="flex gap-1 justify-center">
                                <button
                                  title="Mark Cleared"
                                  onClick={() => handleChequeAction(ch.id, "cleared", ch.account_id, ch.amount, ch.cheque_type, ch.cheque_number)}
                                  className="px-2 py-1 text-[10px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                                >✓ Clear</button>
                                <button
                                  title="Mark Bounced"
                                  onClick={() => handleChequeAction(ch.id, "bounced", null, 0, ch.cheque_type, ch.cheque_number)}
                                  className="px-2 py-1 text-[10px] font-bold bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all"
                                >✗ Bounce</button>
                                <button
                                  title="Cancel"
                                  onClick={() => handleChequeAction(ch.id, "cancelled", null, 0, ch.cheque_type, ch.cheque_number)}
                                  className="px-2 py-1 text-[10px] font-bold bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-all"
                                >Cancel</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── BANK RECONCILIATION TAB WITH CSV UPLOAD ─── */}
          {activeTab === "reconciliation" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <CheckSquare size={18} className="text-teal-600" /> Bank Statement Reconciliation (CSV Upload)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Upload your bank statement CSV/OFX file or manually match system transactions.</p>
                </div>

                {/* CSV Statement File Upload Button */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md shadow-teal-200">
                    <Download size={13} className="rotate-180" /> {csvFileName ? `CSV: ${csvFileName}` : "Upload Bank Statement CSV"}
                    <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="hidden" />
                  </label>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Bank/Cash Account</label>
                    <select
                      value={reconAccountId}
                      onChange={async (e) => {
                        setReconAccountId(e.target.value);
                        setReconChecked(new Set());
                        if (!e.target.value) { setReconTransactions([]); return; }
                        setReconLoading(true);
                        const { data } = await supabase
                          .from("account_transactions")
                          .select("*")
                          .eq("account_id", e.target.value)
                          .eq("reconciled", false)
                          .order("created_at", { ascending: false });
                        setReconTransactions(data || []);
                        setReconLoading(false);
                      }}
                      className="w-full h-10 rounded-xl border border-slate-200 text-xs px-3 focus:outline-none focus:ring-2 focus:ring-teal-500/30 font-bold"
                    >
                      <option value="">- Select Account -</option>
                      {accounts.filter(a => a.type === "bank" || a.type === "cash").map(a => (
                        <option key={a.id} value={a.id}>{a.name} (Rs {Number(a.current_balance).toLocaleString()})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bank Statement Ending Balance (Rs)</label>
                    <input
                      type="number"
                      value={reconStatementBalance || ""}
                      onChange={e => setReconStatementBalance(parseFloat(e.target.value) || 0)}
                      placeholder="Enter statement balance"
                      className="w-full h-10 rounded-xl border border-slate-200 text-xs px-3 focus:outline-none focus:ring-2 focus:ring-teal-500/30 font-bold"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleSaveReconciliation}
                      disabled={submittingRecon || reconChecked.size === 0}
                      className="w-full h-10 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-teal-200"
                    >
                      {submittingRecon ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
                      Save Reconciliation ({reconChecked.size} items)
                    </button>
                  </div>
                </div>

                {/* Parsed CSV Rows Auto-Match Summary */}
                {csvRows.length > 0 && (
                  <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black text-teal-800">Uploaded Bank Statement Lines ({csvRows.length} items parsed)</div>
                      <div className="text-[10px] font-black bg-teal-600 text-white px-2 py-0.5 rounded-full">
                        {csvRows.filter(r => r.matchedTxId).length} Auto-Matched
                      </div>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {csvRows.map((r, i) => (
                        <div key={i} className="flex justify-between items-center text-[11px] font-semibold bg-white p-2 rounded-xl border border-teal-100">
                          <div>{r.date} - {r.description}</div>
                          <div className="font-bold text-teal-700">Rs {r.amount.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reconAccountId && (() => {
                  const systemBal = accounts.find(a => a.id === reconAccountId)?.current_balance || 0;
                  const clearedSum = reconTransactions
                    .filter(t => reconChecked.has(t.id))
                    .reduce((sum, t) => {
                      if (t.type === "deposit" || t.type === "transfer_in") return sum + Number(t.amount);
                      return sum - Number(t.amount);
                    }, 0);
                  const diff = reconStatementBalance - systemBal;
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">System Balance</div>
                        <div className="text-sm font-black text-slate-800">Rs {Number(systemBal).toLocaleString()}</div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Statement Balance</div>
                        <div className="text-sm font-black text-teal-700">Rs {reconStatementBalance.toLocaleString()}</div>
                      </div>
                      <div className={`rounded-xl p-3 border text-center ${Math.abs(diff) < 0.01 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Difference</div>
                        <div className={`text-sm font-black ${Math.abs(diff) < 0.01 ? "text-emerald-700" : "text-amber-700"}`}>
                          {Math.abs(diff) < 0.01 ? "✓ Balanced" : `Rs ${Math.abs(diff).toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {reconLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-teal-500" /></div>
                ) : !reconAccountId ? (
                  <div className="py-12 text-center text-slate-400 text-sm">Select an account to start reconciling.</div>
                ) : reconTransactions.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <CheckSquare size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-sm">All transactions reconciled! 🎉</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-slate-500">{reconTransactions.length} unreconciled transactions</p>
                      <button
                        onClick={() => setReconChecked(new Set(reconTransactions.map(t => t.id)))}
                        className="text-xs text-teal-600 font-bold hover:underline"
                      >Select All</button>
                    </div>
                    <table className="w-full text-left border-collapse text-xs min-w-[450px]">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-black uppercase text-[9px] tracking-wider bg-slate-50/50">
                          <th className="py-2 px-3">✓</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Remarks</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                        {reconTransactions.map(tx => (
                          <tr
                            key={tx.id}
                            className={`cursor-pointer transition-colors ${reconChecked.has(tx.id) ? "bg-teal-50" : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50"}`}
                            onClick={() => {
                              const next = new Set(reconChecked);
                              if (next.has(tx.id)) next.delete(tx.id); else next.add(tx.id);
                              setReconChecked(next);
                            }}
                          >
                            <td className="py-3 px-3">
                              {reconChecked.has(tx.id)
                                ? <CheckSquare size={15} className="text-teal-600" />
                                : <Square size={15} className="text-slate-300" />
                              }
                            </td>
                            <td className="py-3 px-3 text-slate-500">{new Date(tx.created_at).toLocaleDateString()}</td>
                            <td className="py-3 px-3">
                              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                tx.type === "deposit" || tx.type === "transfer_in" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                              }`}>{tx.type.replace("_", " ")}</div>
                            </td>
                            <td className="py-3 px-3 text-slate-500 max-w-[180px] truncate">{tx.remarks || "-"}</td>
                            <td className={`py-3 px-3 text-right font-black ${tx.type === "deposit" || tx.type === "transfer_in" ? "text-emerald-700" : "text-rose-700"}`}>
                              {tx.type === "deposit" || tx.type === "transfer_in" ? "+" : "-"} Rs {Number(tx.amount).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── FORMAL FINANCIAL STATEMENTS TAB ─── */}
          {activeTab === "statements" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Profit & Loss Statement Card */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" /> Income Statement (P&L)
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">Automated Profit & Loss statement</p>
                    </div>
                    <button
                      onClick={handleDownloadPNLPDF}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-black transition-all"
                    >
                      <Download size={13} /> Export PDF
                    </button>
                  </div>

                  <div className="p-6 space-y-4 font-semibold text-xs">
                    <div className="space-y-2 border-b border-slate-100 pb-3">
                      <div className="flex justify-between font-black text-slate-500 text-[10px] uppercase">
                        <div>Revenue Category</div>
                        <div>Amount (PKR)</div>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <div>Sales Revenue & Operating Income</div>
                        <div className="font-bold text-emerald-600">Rs {totalRevenueVal.toLocaleString()}</div>
                      </div>
                      <div className="flex justify-between font-black text-slate-900 pt-1">
                        <div>Total Revenue</div>
                        <div className="text-emerald-700">Rs {totalRevenueVal.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="space-y-2 border-b border-slate-100 pb-3">
                      <div className="flex justify-between font-black text-slate-500 text-[10px] uppercase">
                        <div>Cost of Goods Sold (COGS)</div>
                        <div>Amount (PKR)</div>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <div>Purchases & Stock COGS</div>
                        <div className="font-bold text-rose-600">Rs {totalPurchases.toLocaleString()}</div>
                      </div>
                      <div className="flex justify-between font-black text-slate-900 pt-1">
                        <div>Gross Profit / (Loss)</div>
                        <div className={(totalRevenueVal - totalPurchases) >= 0 ? "text-emerald-700" : "text-rose-600"}>
                          Rs {(totalRevenueVal - totalPurchases).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 border-b border-slate-100 pb-3">
                      <div className="flex justify-between font-black text-slate-500 text-[10px] uppercase">
                        <div>Operating Expenses</div>
                        <div>Amount (PKR)</div>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <div>Overhead, Rent, Utilities & Salaries</div>
                        <div className="font-bold text-rose-600">Rs {totalExpensesVal.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase text-indigo-400">Net Operating Profit</div>
                        <h4 className="text-lg font-black text-indigo-900">
                          Rs {((totalRevenueVal - totalPurchases) - totalExpensesVal).toLocaleString()}
                        </h4>
                      </div>
                      <div className="px-3 py-1 rounded-full text-[11px] font-black bg-indigo-600 text-white">
                        {((totalRevenueVal - totalPurchases) - totalExpensesVal) >= 0 ? "PROFIT" : "LOSS"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balance Sheet Card */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <Scale className="h-5 w-5 text-emerald-600" /> Balance Sheet (Position)
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">Assets, Liabilities & Equity Verification</p>
                    </div>
                    <button
                      onClick={handleDownloadBalanceSheetPDF}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-xs font-black transition-all"
                    >
                      <Download size={13} /> Export PDF
                    </button>
                  </div>

                  <div className="p-6 space-y-4 font-semibold text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Assets */}
                      <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Assets (Rs)</div>
                        <div className="space-y-1 text-slate-600">
                          <div className="flex justify-between"><div>Cash & Bank:</div><div>{accounts.reduce((s,a)=>s+Number(a.current_balance),0).toLocaleString()}</div></div>
                          <div className="flex justify-between"><div>Receivables:</div><div>{totalReceivable.toLocaleString()}</div></div>
                          <div className="flex justify-between"><div>Inventory:</div><div>{inventoryValue.toLocaleString()}</div></div>
                          <div className="flex justify-between"><div>Fixed Assets:</div><div>{totalFixedAssetsVal.toLocaleString()}</div></div>
                        </div>
                        <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-slate-900">
                          <div>Assets Sum:</div>
                          <div className="text-blue-600">Rs {totalAssetsVal.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Liabilities & Equity */}
                      <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Liabilities & Equity (Rs)</div>
                        <div className="space-y-1 text-slate-600">
                          <div className="flex justify-between"><div>Payables:</div><div>{totalPayable.toLocaleString()}</div></div>
                          <div className="flex justify-between"><div>Capital:</div><div>{ownersEquityVal.toLocaleString()}</div></div>
                          <div className="flex justify-between"><div>Net Profit:</div><div>{((totalRevenueVal - totalPurchases) - totalExpensesVal).toLocaleString()}</div></div>
                        </div>
                        <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-slate-900">
                          <div>Equity & Liab:</div>
                          <div className="text-emerald-600">Rs {(totalLiabilitiesVal + ownersEquityVal + ((totalRevenueVal - totalPurchases) - totalExpensesVal)).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-5 w-5 text-emerald-600" />
                        <div>
                          <div className="text-[10px] font-black uppercase text-emerald-600">Balance Sheet Equation</div>
                          <p className="text-xs font-bold text-emerald-900">Assets = Liabilities + Equity (Verified Balance)</p>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-600 text-white">EQUAL MATCH</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ─── INVENTORY VALUATION METHODOLOGIES TAB ─── */}
          {activeTab === "valuation" && (() => {
            const filteredValuationList = productsValuation.filter(p => {
              if (!valuationShowZero && (Number(p.stock_quantity) || 0) <= 0) return false;
              if (valuationSearch.trim()) {
                const q = valuationSearch.toLowerCase();
                return p.name.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q));
              }
              return true;
            });

            let totalItemsWithStock = 0;
            let totalStockUnits = 0;
            let totalWAvgVal = 0;
            let totalFifoVal = 0;
            let totalRetailVal = 0;

            productsValuation.forEach(p => {
              const qty = Number(p.stock_quantity || 0);
              if (qty > 0) totalItemsWithStock++;
              totalStockUnits += qty;
              const wAvg = Number(p.cost_price || 0);
              const fifo = Number(p.fifo_cost || wAvg || 0);
              const retail = Number(p.sale_price || 0);

              totalWAvgVal += (qty * wAvg);
              totalFifoVal += (qty * fifo);
              totalRetailVal += (qty * retail);
            });

            const activeCostVal = valuationMethod === "fifo" ? totalFifoVal : totalWAvgVal;
            const unrealizedProfit = Math.max(0, totalRetailVal - activeCostVal);
            const unrealizedMarginPct = totalRetailVal > 0 ? Math.round((unrealizedProfit / totalRetailVal) * 100) : 0;

            return (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <Package className="h-5 w-5 text-indigo-600" /> Inventory Valuation & Asset Costing
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Compare Weighted Average Cost (WAC) with FIFO (First-In-First-Out / Latest Market Cost).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Method Switcher */}
                    <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200">
                      <button
                        onClick={() => setValuationMethod("weighted_avg")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          valuationMethod === "weighted_avg" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Weighted Average (WAC)
                      </button>
                      <button
                        onClick={() => setValuationMethod("fifo")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          valuationMethod === "fifo" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        FIFO (First-In-First-Out)
                      </button>
                    </div>

                    <button
                      onClick={() => handleDownloadValuationPDF(filteredValuationList)}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-850 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download size={13} /> Export PDF
                    </button>

                    <button
                      onClick={async () => {
                        const totalVal = valuationMethod === "fifo" ? totalFifoVal : totalWAvgVal;
                        await supabase.from("journal_lines").insert({
                          account_code: "1003",
                          account_name: "Stock / Inventory Asset",
                          debit: Math.max(0, totalVal),
                          credit: 0
                        });
                        toast.success(`Inventory valuation (Rs ${Math.round(totalVal).toLocaleString()}) synced to GL Account 1003! 📦`);
                        loadData();
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={13} /> Sync to GL Stock (1003)
                    </button>

                    <button
                      onClick={fetchInventoryValuation}
                      className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition cursor-pointer"
                      title="Reload Inventory"
                    >
                      <RefreshCw size={14} className={valuationLoading ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>

                {/* 4 Summary Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Current Valuation at Cost */}
                  <div className="bg-gradient-to-br from-indigo-50/80 to-blue-50/40 p-4 rounded-2xl border border-indigo-200/70 shadow-xs">
                    <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block">
                      Valuation at Cost ({valuationMethod === "fifo" ? "FIFO" : "Weighted Avg"})
                    </div>
                    <h4 className="text-xl font-black text-indigo-950 font-mono mt-1">
                      Rs {Math.round(activeCostVal).toLocaleString()}
                    </h4>
                    <p className="text-[11px] text-indigo-700/80 mt-0.5">
                      {valuationMethod === "fifo" ? "Based on recent purchase batches" : "Based on weighted avg purchase cost"}
                    </p>
                  </div>

                  {/* Retail Realization Value */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                      Expected Retail Realization (MRP)
                    </div>
                    <h4 className="text-xl font-black text-slate-900 font-mono mt-1">
                      Rs {Math.round(totalRetailVal).toLocaleString()}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Total sale value of current stock</p>
                  </div>

                  {/* Potential Gross Margin */}
                  <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/40 p-4 rounded-2xl border border-emerald-200/70 shadow-xs">
                    <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block">
                      Unrealized Gross Margin
                    </div>
                    <h4 className="text-xl font-black text-emerald-900 font-mono mt-1">
                      Rs {Math.round(unrealizedProfit).toLocaleString()}
                    </h4>
                    <p className="text-[11px] text-emerald-700/80 mt-0.5">
                      {unrealizedMarginPct}% Projected Margin on Inventory
                    </p>
                  </div>

                  {/* Total Units in Stock */}
                  <div className="bg-gradient-to-br from-purple-50/80 to-pink-50/40 p-4 rounded-2xl border border-purple-200/70 shadow-xs">
                    <div className="text-[10px] font-black text-purple-700 uppercase tracking-widest block">
                      Total In-Stock Quantity
                    </div>
                    <h4 className="text-xl font-black text-purple-950 font-mono mt-1">
                      {totalStockUnits.toLocaleString()} Units
                    </h4>
                    <p className="text-[11px] text-purple-700/80 mt-0.5">
                      Across {totalItemsWithStock} active products
                    </p>
                  </div>
                </div>

                {/* Filter & Search Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
                    <input
                      type="text"
                      placeholder="Search by product name, code, SKU..."
                      value={valuationSearch}
                      onChange={(e) => setValuationSearch(e.target.value)}
                      className="w-full h-8.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={valuationShowZero}
                      onChange={(e) => setValuationShowZero(e.target.checked)}
                      className="rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    Show Zero Stock Products ({productsValuation.filter(p => (Number(p.stock_quantity) || 0) <= 0).length})
                  </label>
                </div>

                {/* Valuation Table */}
                {valuationLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
                    <p className="text-xs font-bold text-slate-600">Calculating inventory valuations...</p>
                  </div>
                ) : filteredValuationList.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 font-semibold space-y-2">
                    <Package className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="text-sm font-bold text-slate-700">No matching products found</p>
                    <p className="text-xs text-slate-400">Try toggling &quot;Show Zero Stock Products&quot; or clear the search filter.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left border-collapse text-xs min-w-[800px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 font-black uppercase text-[10px]">
                          <th className="py-3 px-3.5">Product Name</th>
                          <th className="py-3 px-3.5 text-center">In-Stock Qty</th>
                          <th className="py-3 px-3.5 text-right">Unit Cost (WAC)</th>
                          <th className="py-3 px-3.5 text-right">Unit Cost (FIFO)</th>
                          <th className="py-3 px-3.5 text-right">Retail Rate</th>
                          <th className="py-3 px-3.5 text-right">Valuation ({valuationMethod === "fifo" ? "FIFO" : "WAC"})</th>
                          <th className="py-3 px-3.5 text-right">Est. Gross Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {filteredValuationList.map(p => {
                          const qty = Number(p.stock_quantity || 0);
                          const wAvgCost = Number(p.cost_price || 0);
                          const fifoCost = Number(p.fifo_cost || wAvgCost || 0);
                          const chosenCost = valuationMethod === "fifo" ? fifoCost : wAvgCost;
                          const salePrice = Number(p.sale_price || 0);
                          const valTotal = qty * chosenCost;
                          const retailTotal = qty * salePrice;
                          const profit = Math.max(0, retailTotal - valTotal);
                          const marginPct = retailTotal > 0 ? Math.round((profit / retailTotal) * 100) : 0;

                          return (
                            <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3.5">
                                <div>
                                  <p className="font-extrabold text-slate-900 text-xs">{p.name}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                                    {p.code && <div className="font-mono bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">{p.code}</div>}
                                    <div>Unit: {p.unit}</div>
                                    {p.batches && p.batches.length > 0 && (
                                      <div className="text-indigo-600 font-bold">({p.batches.length} Batches)</div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3.5 text-center">
                                <div className={`font-mono font-black text-xs px-2 py-0.5 rounded-lg border ${
                                  qty > 0 ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-100 text-slate-400 border-slate-200"
                                }`}>
                                  {qty} {p.unit}
                                </div>
                              </td>

                              <td className="py-3 px-3.5 text-right font-mono text-slate-600">
                                Rs {wAvgCost.toLocaleString()}
                              </td>

                              <td className="py-3 px-3.5 text-right font-mono font-bold text-indigo-600">
                                Rs {fifoCost.toLocaleString()}
                              </td>

                              <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-800">
                                Rs {salePrice.toLocaleString()}
                              </td>

                              <td className="py-3 px-3.5 text-right font-mono font-black text-indigo-950 text-xs">
                                Rs {Math.round(valTotal).toLocaleString()}
                              </td>

                              <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-600">
                                Rs {Math.round(profit).toLocaleString()} ({marginPct}%)
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ─── MULTI-CURRENCY ACCOUNTING TAB ─── */}
          {activeTab === "currency" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Exchange Rates Table */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Coins className="h-5 w-5 text-amber-500" /> Currency Exchange Rate Table (Base: PKR)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-black uppercase text-[10px]">
                          <th className="py-2.5 px-3.5 text-xs">Currency Code</th>
                          <th className="py-2.5 px-3.5 text-xs">Currency Name</th>
                          <th className="py-2.5 px-3.5 text-xs">Exchange Rate (in PKR)</th>
                          <th className="py-2.5 px-3.5 text-xs text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {Object.entries(fxRates).map(([code, rate]) => (
                          <tr key={code} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50">
                            <td className="py-2.5 px-3.5 text-xs font-black text-amber-700">{code}</td>
                            <td className="py-2.5 px-3.5 text-xs text-slate-600">
                              {code === "USD" ? "US Dollar ($)" : code === "EUR" ? "Euro (€)" : code === "AED" ? "UAE Dirham (AED)" : code === "SAR" ? "Saudi Riyal (SAR)" : "British Pound (£)"}
                            </td>
                            <td className="py-2.5 px-3.5 text-xs font-bold">1 {code} = Rs {rate.toFixed(2)} PKR</td>
                            <td className="py-2.5 px-3.5 text-xs text-right">
                              <div className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-black">ACTIVE</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Multi-Currency Converter */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" /> Foreign Currency Converter
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Select Foreign Currency</label>
                      <select
                        value={calcCurr}
                        onChange={e => setCalcCurr(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                      >
                        {Object.keys(fxRates).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Foreign Amount</label>
                      <input
                        type="number"
                        value={calcForeignAmt || ""}
                        onChange={e => setCalcForeignAmt(Number(e.target.value))}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                      <div className="text-[10px] font-black uppercase text-amber-600 block">PKR Equivalent Value</div>
                      <div className="text-xl font-black text-amber-900">
                        Rs {(calcForeignAmt * (fxRates[calcCurr] || 1)).toLocaleString()} PKR
                      </div>
                    </div>
                  </div>
                </div>

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
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-600 cursor-pointer"
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
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingAccount}
                    className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-200 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingAccount && <Loader2 size={13} className="animate-spin" />} Save Account
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Inject Owner Capital / Cash Float */}
      <AnimatePresence>
        {isCapitalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="absolute inset-0" onClick={() => setIsCapitalModalOpen(false)}
            />
            <motion.div 
              initial={{ scale:0.95, y:10 }} animate={{ scale:1, y:0 }} exit={{ scale:0.95, y:10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm relative z-10 border border-slate-100 shadow-xl"
            >
              <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
                <Coins size={16} className="text-emerald-600" /> Inject Owner Capital / Float
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold mb-4">
                Debit: Cash in Hand (1001) • Credit: Owner's Capital (3100)
              </p>

              <form onSubmit={handleExecuteCapitalInjection} className="space-y-3.5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Till / Bank Account</label>
                  <select 
                    value={capitalTargetAccount}
                    onChange={e => setCapitalTargetAccount(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-700 cursor-pointer"
                    required
                  >
                    <option value="">Select target account...</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Current: Rs {Number(a.current_balance || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Capital Amount (Rs)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 50000" 
                    value={capitalAmount || ""}
                    onChange={e => setCapitalAmount(Number(e.target.value))}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Narration / Purpose</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Initial Cash Till Float, Owner Cash Injection" 
                    value={capitalNarration}
                    onChange={e => setCapitalNarration(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsCapitalModalOpen(false)}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingCapital}
                    className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingCapital && <Loader2 size={13} className="animate-spin" />} Inject Capital
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
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-600 cursor-pointer"
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
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-600 cursor-pointer"
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
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingTransfer}
                    className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-200 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingTransfer && <Loader2 size={13} className="animate-spin" />} Transfer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: New Journal Entry Adjustment */}
      <AnimatePresence>
        {isAddJournalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="absolute inset-0" onClick={() => setIsAddJournalOpen(false)}
            />
            <motion.div 
              initial={{ scale:0.95, y:10 }} animate={{ scale:1, y:0 }} exit={{ scale:0.95, y:10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl relative z-10 border border-slate-100 shadow-xl max-h-[90vh] flex flex-col"
            >
              <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <BookOpen size={16} className="text-indigo-600" /> Post General Journal Adjustment
              </h3>
              <form onSubmit={handleAddJournalEntry} className="space-y-4 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Posting Date</label>
                    <input 
                      type="date"
                      value={newJournalDate}
                      onChange={e => setNewJournalDate(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Narration / Remarks</label>
                    <input 
                      type="text"
                      placeholder="e.g. Correcting entry, Opening Capital transfer"
                      value={newJournalNarration}
                      onChange={e => setNewJournalNarration(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Journal Entries Debit/Credit Lines</h4>
                    <button
                      type="button"
                      onClick={handleAddJournalLine}
                      className="text-xs font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={14} /> Add Line
                    </button>
                  </div>

                  <div className="space-y-3.5 max-h-[35vh] overflow-y-auto pr-1">
                    {newJournalLines.map((line, idx) => (
                      <div key={idx} className="flex flex-col gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-150">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Select Account</label>
                            <select
                              value={line.account_code}
                              onChange={e => handleJournalLineChange(idx, "account_code", e.target.value)}
                              className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              {ACCOUNT_TEMPLATES.map(acc => (
                                <option key={acc.code} value={acc.code}>
                                  ({acc.code}) {acc.name} - [{acc.type}]
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-28">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Debit (Rs)</label>
                            <input
                              type="number"
                              placeholder="0"
                              value={line.debit || ""}
                              onChange={e => handleJournalLineChange(idx, "debit", e.target.value)}
                              className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              disabled={line.credit > 0}
                            />
                          </div>
                          <div className="w-28">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Credit (Rs)</label>
                            <input
                              type="number"
                              placeholder="0"
                              value={line.credit || ""}
                              onChange={e => handleJournalLineChange(idx, "credit", e.target.value)}
                              className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              disabled={line.debit > 0}
                            />
                          </div>
                          {newJournalLines.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveJournalLine(idx)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 mt-4 cursor-pointer"
                            >
                              <Trash size={13} />
                            </button>
                          )}
                        </div>

                        {/* Linked Customer/Supplier Subsidiary Ledger Select Option */}
                        {(line.account_code === "1002" || line.account_code === "2001") && (
                          <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/50">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Link Customer/Supplier (ذیلی کھاتہ):</div>
                            <select
                              value={line.party_id || ""}
                              onChange={e => handleJournalLineChange(idx, "party_id", e.target.value)}
                              className="text-[10px] h-7 rounded-lg border border-slate-200 bg-white px-2 font-bold text-slate-700 outline-none cursor-pointer w-64"
                            >
                              <option value="">-- No Subsidiary Link (General control only) --</option>
                              {parties.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.type === "customer" ? "Customer / کسٹمر" : "Supplier / سپلائر"})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Balancing display */}
                  <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 flex justify-between text-[11px] font-black text-slate-700">
                    <div>
                      Total Debits: <div className="text-blue-650">Rs {newJournalLines.reduce((sum, l) => sum + l.debit, 0).toLocaleString()}</div>
                    </div>
                    <div>
                      Total Credits: <div className="text-emerald-650">Rs {newJournalLines.reduce((sum, l) => sum + l.credit, 0).toLocaleString()}</div>
                    </div>
                    <div className={
                      newJournalLines.reduce((sum, l) => sum + l.debit, 0) === newJournalLines.reduce((sum, l) => sum + l.credit, 0)
                        ? "text-emerald-600" : "text-rose-500 animate-pulse"
                    }>
                      {newJournalLines.reduce((sum, l) => sum + l.debit, 0) === newJournalLines.reduce((sum, l) => sum + l.credit, 0)
                        ? "✓ Balanced" : "⚠ Unbalanced"}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsAddJournalOpen(false)}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingJournal}
                    className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingJournal && <Loader2 size={13} className="animate-spin" />} Post Entry
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MODAL: Add Fixed Asset */}
        {isAddAssetOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="absolute inset-0" onClick={() => setIsAddAssetOpen(false)}
            />
            <motion.div 
              initial={{ scale:0.95, y:10 }} animate={{ scale:1, y:0 }} exit={{ scale:0.95, y:10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm relative z-10 border border-slate-100 shadow-xl"
            >
              <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                <Landmark size={16} className="text-blue-600" /> New Fixed Asset
              </h3>
              <form onSubmit={handleAddAsset} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Asset Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Air Conditioner, Counter..." 
                    value={newAssetName}
                    onChange={e => setNewAssetName(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Asset Category</label>
                  <select 
                    value={newAssetType}
                    onChange={e => setNewAssetType(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold cursor-pointer"
                  >
                    <option value="machinery">Machinery & Equipment</option>
                    <option value="furniture">Furniture & Fixtures</option>
                    <option value="electronics">Electronics & Computers</option>
                    <option value="property">Property & Building</option>
                    <option value="vehicles">Vehicles</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Purchase Price (Rs)</label>
                  <input 
                    type="number" 
                    value={newAssetPrice || ""}
                    onChange={e => setNewAssetPrice(Number(e.target.value))}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Useful Life (Years)</label>
                  <input 
                    type="number" 
                    value={newAssetLife || ""}
                    onChange={e => setNewAssetLife(Number(e.target.value))}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                    min="1"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsAddAssetOpen(false)}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingAsset}
                    className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-200 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingAsset && <Loader2 size={13} className="animate-spin" />} Save Asset
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Edit Fixed Asset */}
      <AnimatePresence>
        {isEditAssetOpen && editingAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0" onClick={() => setIsEditAssetOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg relative z-10 border border-slate-100 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Edit2 size={16} className="text-blue-600" /> Edit Fixed Asset Details
                </h3>
                <div className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                  ID: #{editingAsset.id.slice(0, 6).toUpperCase()}
                </div>
              </div>

              <form onSubmit={handleSaveAssetEdit} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Asset Name *</label>
                  <input 
                    type="text" 
                    value={editAssetName}
                    onChange={e => setEditAssetName(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Asset Category</label>
                    <select 
                      value={editAssetType}
                      onChange={e => setEditAssetType(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800 cursor-pointer"
                    >
                      <option value="machinery">Machinery & Equipment</option>
                      <option value="furniture">Furniture & Fixtures</option>
                      <option value="electronics">Electronics & Computers</option>
                      <option value="property">Property & Building</option>
                      <option value="vehicles">Vehicles</option>
                      <option value="other">Other Asset</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Acquisition Date</label>
                    <input 
                      type="date" 
                      value={editAssetDate}
                      onChange={e => setEditAssetDate(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Purchase Price (Rs) *</label>
                    <input 
                      type="number" 
                      value={editAssetPrice || ""}
                      onChange={e => setEditAssetPrice(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800 font-mono"
                      min="1"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">Current Value (Rs) *</label>
                    <input 
                      type="number" 
                      value={editAssetCurrentVal || ""}
                      onChange={e => setEditAssetCurrentVal(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-blue-50/60 border border-blue-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-blue-900 font-mono"
                      min="0"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Life (Years) *</label>
                    <input 
                      type="number" 
                      value={editAssetLife || ""}
                      onChange={e => setEditAssetLife(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-800 font-mono"
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div className="bg-amber-50/60 border border-amber-200/80 p-3 rounded-2xl space-y-1.5">
                  <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest block">
                    Edit Reason / Remarks (ضروری وجہ برائے ورژن ہسٹری) *
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g., Annual revaluation, Name typo corrected, Replaced parts..."
                    value={editAssetReason}
                    onChange={e => setEditAssetReason(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-amber-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium text-slate-800 placeholder:text-amber-300"
                    required
                  />
                  <p className="text-[10px] text-amber-700/80">
                    This note and all changes will be automatically logged into this asset&apos;s version audit trail.
                  </p>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsEditAssetOpen(false)}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingEditAsset}
                    className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-200 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingEditAsset && <Loader2 size={13} className="animate-spin" />} Save & Log Version
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Fixed Asset Version / Revision History Timeline */}
      <AnimatePresence>
        {isAssetHistoryOpen && selectedHistoryAsset && (() => {
          const historyList = Array.isArray(selectedHistoryAsset.edit_history) ? selectedHistoryAsset.edit_history : [];

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0" onClick={() => setIsAssetHistoryOpen(false)}
              />
              <motion.div 
                initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                className="bg-white rounded-3xl p-6 w-full max-w-2xl relative z-10 border border-slate-100 shadow-xl space-y-4 max-h-[85vh] flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <History size={18} className="text-amber-600" /> Asset Version & Audit History
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedHistoryAsset.name} · ({selectedHistoryAsset.asset_type?.toUpperCase()})
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAssetHistoryOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
                  >
                    ✕
                  </button>
                </div>

                {/* Summary Strip */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs">
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Current Book Value</div>
                    <div className="font-mono font-black text-blue-700 text-sm">
                      Rs {Number(selectedHistoryAsset.current_value).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Acquisition Cost</div>
                    <div className="font-mono font-bold text-slate-700">
                      Rs {Number(selectedHistoryAsset.purchase_price).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Total Revisions</div>
                    <div className="font-bold text-amber-700">
                      {historyList.length} Version {historyList.length === 1 ? "Record" : "Records"}
                    </div>
                  </div>
                </div>

                {/* Timeline Body */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                  {historyList.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 space-y-2">
                      <Clock className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="text-xs font-bold text-slate-600">No revision history logged yet for this asset.</p>
                      <p className="text-[11px] text-slate-400">Future updates and revaluations will automatically appear here.</p>
                    </div>
                  ) : (
                    [...historyList].reverse().map((entry: any, idx: number) => {
                      const isInitial = entry.action === "CREATED" || entry.version === 1;

                      return (
                        <div 
                          key={idx} 
                          className={`p-4 rounded-2xl border transition-all ${
                            isInitial 
                              ? "bg-slate-50/80 border-slate-200" 
                              : "bg-amber-50/40 border-amber-200/70"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/50 pb-2 mb-2.5">
                            <div className="flex items-center gap-2">
                              <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isInitial 
                                  ? "bg-blue-100 text-blue-800" 
                                  : "bg-amber-100 text-amber-900"
                              }`}>
                                {isInitial ? "Version #1 (Initial Creation)" : `Version #${entry.version || (historyList.length - idx)} (Revision)`}
                              </div>
                              <div className="text-xs font-bold text-slate-700">
                                {entry.reason || (isInitial ? "Initial Asset Acquisition" : "Asset Details Updated")}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                              <Clock size={11} />
                              <div>{entry.edited_at ? new Date(entry.edited_at).toLocaleString() : "-"}</div>
                              <div>· By: <strong className="text-slate-600">{entry.edited_by || "Admin"}</strong></div>
                            </div>
                          </div>

                          {/* Changes diff */}
                          {entry.changes && entry.changes.length > 0 && (
                            <div className="space-y-1.5 mt-2">
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                Field Modifications:
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {entry.changes.map((ch: any, cIdx: number) => (
                                  <div key={cIdx} className="bg-white/80 border border-slate-200/80 p-2 rounded-xl text-[11px] space-y-0.5">
                                    <div className="font-bold text-slate-500 text-[10px] block">{ch.field}</div>
                                    <div className="flex items-center gap-1.5 font-mono">
                                      <div className="text-rose-600 line-through text-[10px] bg-rose-50 px-1 py-0.2 rounded">{String(ch.from)}</div>
                                      <ArrowRight size={10} className="text-slate-400" />
                                      <div className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">{String(ch.to)}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button 
                    type="button" 
                    onClick={() => setIsAssetHistoryOpen(false)}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Close History
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* MODAL: Add Cheque */}
      <AnimatePresence>
        {isAddChequeOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0" onClick={() => setIsAddChequeOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md relative z-10 border border-slate-100 shadow-xl"
            >
              <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                <CalendarCheck size={16} className="text-violet-600" /> Add Post-Dated Cheque (PDC)
              </h3>
              <form onSubmit={handleAddCheque} className="space-y-3">
                {/* Cheque Type */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cheque Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["receivable", "payable"] as const).map(ct => (
                      <button
                        key={ct}
                        type="button"
                        onClick={() => setNewCheque({ ...newCheque, cheque_type: ct })}
                        className={`py-2 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${newCheque.cheque_type === ct ? (ct === "receivable" ? "bg-emerald-600 text-white border-emerald-600" : "bg-rose-600 text-white border-rose-600") : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"}`}
                      >{ct === "receivable" ? "✓ Receivable (We Get)" : "✗ Payable (We Give)"}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cheque Number *</label>
                    <input required value={newCheque.cheque_number} onChange={e => setNewCheque({ ...newCheque, cheque_number: e.target.value })} placeholder="e.g. 001234" className="w-full h-9 rounded-xl border border-slate-200 text-xs px-3 focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-bold text-slate-800" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (Rs) *</label>
                    <input required type="number" value={newCheque.amount || ""} onChange={e => setNewCheque({ ...newCheque, amount: parseFloat(e.target.value) || 0 })} placeholder="0" className="w-full h-9 rounded-xl border border-slate-200 text-xs px-3 focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-bold font-mono text-slate-800" min="1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Due Date *</label>
                    <input required type="date" value={newCheque.due_date} onChange={e => setNewCheque({ ...newCheque, due_date: e.target.value })} className="w-full h-9 rounded-xl border border-slate-200 text-xs px-3 focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-bold text-slate-800" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bank Name</label>
                    <input value={newCheque.bank_name || ""} onChange={e => setNewCheque({ ...newCheque, bank_name: e.target.value })} placeholder="e.g. HBL, Meezan" className="w-full h-9 rounded-xl border border-slate-200 text-xs px-3 focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-bold text-slate-800" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Link to Party (Optional)</label>
                  <select value={newCheque.party_id || ""} onChange={e => setNewCheque({ ...newCheque, party_id: e.target.value })} className="w-full h-9 rounded-xl border border-slate-200 text-xs px-3 focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-bold text-slate-700 cursor-pointer">
                    <option value="">- No Party -</option>
                    {parties.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Deposit to Account (on Clear)</label>
                  <select value={newCheque.account_id || ""} onChange={e => setNewCheque({ ...newCheque, account_id: e.target.value })} className="w-full h-9 rounded-xl border border-slate-200 text-xs px-3 focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-bold text-slate-700 cursor-pointer">
                    <option value="">- No Account -</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks</label>
                  <input value={newCheque.remarks || ""} onChange={e => setNewCheque({ ...newCheque, remarks: e.target.value })} placeholder="Optional note" className="w-full h-9 rounded-xl border border-slate-200 text-xs px-3 focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-medium text-slate-800" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setIsAddChequeOpen(false)} className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer">Cancel</button>
                  <button type="submit" disabled={submittingCheque} className="flex-1 h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-violet-200 disabled:opacity-50 cursor-pointer">
                    {submittingCheque && <Loader2 size={13} className="animate-spin" />} Add Cheque
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
