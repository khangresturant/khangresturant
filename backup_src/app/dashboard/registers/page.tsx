"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calculator, Search, Calendar, Filter, Eye, X, Loader2, ArrowLeftRight,
  TrendingUp, AlertCircle, CheckCircle, FileText, User, ShoppingCart, DollarSign,
  Download, ArrowDownLeft, ArrowUpRight, Plus, Minus
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

type RegisterSession = {
  id: string;
  shop_id: string;
  user_id: string;
  session_type: string | null;
  opening_balance: number;
  closing_balance: number | null;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  cashierName?: string;
};

type Invoice = {
  id: string;
  created_at: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  payment_mode: "cash" | "card" | "credit";
  register_session_id: string | null;
  party_id: string | null;
  customerName?: string;
};

type CreditTransaction = {
  id: string;
  created_at: string;
  amount: number;
  transaction_type: "payment" | "charge";
  remarks: string | null;
  customer_id: string;
  partyName?: string;
  partyType?: "customer" | "supplier";
};

type Expense = {
  id: string;
  created_at: string;
  name: string;
  amount: number;
  remarks: string | null;
  register_session_id: string | null;
};

type DaybookTransaction = {
  id: string;
  time: string;
  type: "Sale" | "Khata In" | "Khata Out" | "Expense";
  description: string;
  cashIn: number;
  cashOut: number;
  runningBalance: number;
  sourceId: string;
};

export default function RegisterLedgerPage() {
  const { shopId, shopName } = useShop();
  const supabase = createClient();

  const [sessions, setSessions] = useState<RegisterSession[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [parties, setParties] = useState<{ id: string; name: string; type: "customer" | "supplier" }[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Real-time live indicator
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const channelRef = useRef<any>(null);

  // View Mode: "shift" vs "daybook"
  const [viewMode, setViewMode] = useState<"shift" | "daybook">("daybook");

  // Daily Daybook filters
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - (offset*60*1000));
    return localDate.toISOString().split("T")[0];
  });

  // Shift Session filter
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");

  // Search inside daybook table
  const [searchQuery, setSearchQuery] = useState("");

  // Detailed Modal for invoice popup inside daybook
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<any[]>([]);
  const [loadingInvoiceDetails, setLoadingInvoiceDetails] = useState(false);

  useEffect(() => {
    if (!shopId) return;

    fetchData();

    // --- Real-time subscriptions ---
    // Clean up any previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`daybook-realtime-${shopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices", filter: `shop_id=eq.${shopId}` },
        () => { fetchData(); setLastUpdated(new Date()); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "credit_transactions", filter: `shop_id=eq.${shopId}` },
        () => { fetchData(); setLastUpdated(new Date()); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `shop_id=eq.${shopId}` },
        () => { fetchData(); setLastUpdated(new Date()); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "register_sessions", filter: `shop_id=eq.${shopId}` },
        () => { fetchData(); setLastUpdated(new Date()); }
      )
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [shopId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Register Sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("register_sessions")
        .select("*")
        .eq("shop_id", shopId)
        .order("opened_at", { ascending: false });

      if (sessionsError) throw sessionsError;

      // 2. Fetch Invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("id, created_at, total_amount, paid_amount, status, payment_mode, register_session_id, party_id")
        .eq("shop_id", shopId)
        .eq("is_voided", false);

      if (invoicesError) throw invoicesError;

      // 3. Fetch Credit Transactions (Khata manual payments/charges)
      const { data: txsData, error: txsError } = await supabase
        .from("credit_transactions")
        .select("id, created_at, amount, transaction_type, remarks, customer_id")
        .eq("shop_id", shopId);

      if (txsError) throw txsError;

      // 4. Fetch Expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("id, created_at, name, amount, remarks, register_session_id")
        .eq("shop_id", shopId);

      if (expensesError) throw expensesError;

      // 5. Fetch Cashier Profiles
      const { data: profilesData } = await supabase
        .from("user_profiles")
        .select("id, name")
        .eq("shop_id", shopId);

      // 6. Fetch Parties (Customers/Suppliers)
      const { data: partiesData } = await supabase
        .from("parties")
        .select("id, name, type")
        .eq("shop_id", shopId);

      const rawSessions = sessionsData || [];
      const rawInvoices = invoicesData || [];
      const rawTxs = txsData || [];
      const rawExpenses = expensesData || [];
      const rawProfiles = profilesData || [];
      const rawParties = partiesData || [];

      setProfiles(rawProfiles);
      setParties(rawParties);

      // Map and format Invoices
      const mappedInvoices = rawInvoices.map((inv: any) => ({
        ...inv,
        total_amount: Number(inv.total_amount),
        paid_amount: Number(inv.paid_amount || 0),
        customerName: rawParties.find(p => p.id === inv.party_id)?.name || "Walk-in Customer"
      }));
      setInvoices(mappedInvoices);

      // Map and format Sessions
      const mappedSessions = rawSessions.map((sess: any) => ({
        ...sess,
        opening_balance: Number(sess.opening_balance),
        closing_balance: sess.closing_balance !== null ? Number(sess.closing_balance) : null,
        cashierName: rawProfiles.find(p => p.id === sess.user_id)?.name || "Unknown Cashier"
      }));
      setSessions(mappedSessions);
      if (mappedSessions.length > 0) {
        setSelectedSessionId(mappedSessions[0].id);
      }

      // Map and format Credit Transactions
      const mappedTxs = rawTxs.map((tx: any) => {
        const party = rawParties.find(p => p.id === tx.customer_id);
        return {
          ...tx,
          amount: Number(tx.amount),
          partyName: party?.name || "Manual Party",
          partyType: party?.type || "customer"
        };
      });
      setCreditTransactions(mappedTxs);

      // Format Expenses
      const mappedExpenses = rawExpenses.map((exp: any) => ({
        ...exp,
        amount: Number(exp.amount)
      }));
      setExpenses(mappedExpenses);

    } catch (err: any) {
      toast.error("Failed to load Rojnamcha daybook data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Determine active daybook time window or active shift time window
  const activeTimeWindow = useMemo(() => {
    if (viewMode === "daybook") {
      if (!selectedDate) return null;
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: `Date: ${new Date(selectedDate).toLocaleDateString()}` };
    } else {
      // shift mode
      const session = sessions.find(s => s.id === selectedSessionId);
      if (!session) return null;
      const start = new Date(session.opened_at);
      const end = session.closed_at ? new Date(session.closed_at) : new Date(); // if open, up to now
      return { 
        start, 
        end, 
        label: `Shift: ${session.cashierName} (${new Date(session.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        session
      };
    }
  }, [viewMode, selectedDate, selectedSessionId, sessions]);

  // Generate unified Daybook transactions list chronologically
  const daybookData = useMemo(() => {
    if (!activeTimeWindow) return { transactions: [], openingFloat: 0, cashInTotal: 0, cashOutTotal: 0, cashInHand: 0 };
    const { start, end } = activeTimeWindow;

    const startTime = start.getTime();
    const endTime = end.getTime();

    // 1. Determine opening float
    let openingFloat = 0;
    if (viewMode === "shift" && activeTimeWindow.session) {
      openingFloat = activeTimeWindow.session.opening_balance;
    } else {
      // For daily daybook, opening cash is the opening float of the first shift of that day
      const dayShifts = sessions.filter(s => {
        const opened = new Date(s.opened_at).getTime();
        return opened >= startTime && opened <= endTime;
      });
      if (dayShifts.length > 0) {
        // Sort ascending to find the earliest shift of the day
        dayShifts.sort((a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime());
        openingFloat = dayShifts[0].opening_balance;
      }
    }

    const txList: Omit<DaybookTransaction, "runningBalance">[] = [];

    // 2. Fetch Sales cash payments
    invoices.forEach(inv => {
      const created = new Date(inv.created_at).getTime();
      if (created >= startTime && created <= endTime) {
        // Cash collected from sales:
        // Cash or Card invoice pays paid_amount. Credit invoice pays paid_amount.
        // We only track cash drawer flows, so payment_mode !== 'card'
        if (inv.payment_mode !== "card" && inv.paid_amount > 0) {
          txList.push({
            id: `sale-${inv.id}`,
            time: inv.created_at,
            type: "Sale",
            description: `POS Sale #${inv.id.slice(0, 8).toUpperCase()} to ${inv.customerName} (Payment: ${inv.payment_mode.toUpperCase()})`,
            cashIn: inv.paid_amount,
            cashOut: 0,
            sourceId: inv.id
          });
        }
      }
    });

    // 3. Fetch Khata cash payments (Credit Transactions)
    creditTransactions.forEach(tx => {
      const created = new Date(tx.created_at).getTime();
      if (created >= startTime && created <= endTime) {
        // Inflow: Customer pays us (payment), or Supplier refunds us (payment)
        // Outflow: We refund/give customer cash (charge), or We pay supplier cash (charge)
        const isCustomer = tx.partyType === "customer";
        
        if (tx.transaction_type === "payment") {
          // Cash Inflow
          txList.push({
            id: `khata-${tx.id}`,
            time: tx.created_at,
            type: "Khata In",
            description: isCustomer 
              ? `Khata Cash Received from Customer: ${tx.partyName}${tx.remarks ? ` (${tx.remarks})` : ""}`
              : `Khata Supplier Refund Received: ${tx.partyName}${tx.remarks ? ` (${tx.remarks})` : ""}`,
            cashIn: tx.amount,
            cashOut: 0,
            sourceId: tx.id
          });
        } else {
          // Cash Outflow
          txList.push({
            id: `khata-${tx.id}`,
            time: tx.created_at,
            type: "Khata Out",
            description: isCustomer
              ? `Khata Cash Refunded/Paid to Customer: ${tx.partyName}${tx.remarks ? ` (${tx.remarks})` : ""}`
              : `Khata Cash Paid to Supplier: ${tx.partyName}${tx.remarks ? ` (${tx.remarks})` : ""}`,
            cashIn: 0,
            cashOut: tx.amount,
            sourceId: tx.id
          });
        }
      }
    });

    // 4. Fetch Expenses
    expenses.forEach(exp => {
      const created = new Date(exp.created_at).getTime();
      if (created >= startTime && created <= endTime) {
        txList.push({
          id: `exp-${exp.id}`,
          time: exp.created_at,
          type: "Expense",
          description: `Business Expense: ${exp.name}${exp.remarks ? ` (${exp.remarks})` : ""}`,
          cashIn: 0,
          cashOut: exp.amount,
          sourceId: exp.id
        });
      }
    });

    // Sort chronologically (oldest first) to calculate running balance
    txList.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    let balance = openingFloat;
    let cashInTotal = 0;
    let cashOutTotal = 0;

    const transactionsWithBalance = txList.map(tx => {
      cashInTotal += tx.cashIn;
      cashOutTotal += tx.cashOut;
      balance = balance + tx.cashIn - tx.cashOut;
      return {
        ...tx,
        runningBalance: balance
      } as DaybookTransaction;
    });

    // Filter by search query if any
    const filteredTxList = transactionsWithBalance.filter(t => 
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Display newest first in the UI
    const reversedList = [...filteredTxList].reverse();

    return {
      transactions: reversedList,
      openingFloat,
      cashInTotal,
      cashOutTotal,
      cashInHand: balance
    };

  }, [activeTimeWindow, invoices, creditTransactions, expenses, sessions, viewMode, searchQuery]);

  // View Invoice detail popup
  const handleViewInvoiceDetails = async (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setLoadingInvoiceDetails(true);
    try {
      const { data: invData, error: invErr } = await supabase
        .from("invoices")
        .select("*, parties(name, phone)")
        .eq("id", invoiceId)
        .single();

      if (invErr) throw invErr;
      setSelectedInvoice(invData);

      const { data: items, error: itemsErr } = await supabase
        .from("invoice_items")
        .select("*, products(name, unit)")
        .eq("invoice_id", invoiceId);

      if (itemsErr) throw itemsErr;

      // Populate items with variants packing name if variant_id exists
      const populatedItems = [];
      for (const it of (items || [])) {
        let variantName = "";
        if (it.variant_id) {
          const { data: vData } = await supabase
            .from("product_variants")
            .select("packing_name")
            .eq("id", it.variant_id)
            .maybeSingle();
          variantName = vData?.packing_name || "";
        }
        populatedItems.push({
          ...it,
          productName: it.products?.name || "Unknown Product",
          unit: it.products?.unit || "unit",
          variantName
        });
      }
      setSelectedInvoiceItems(populatedItems);

    } catch (err: any) {
      toast.error("Failed to load invoice items: " + err.message);
    } finally {
      setLoadingInvoiceDetails(false);
    }
  };

  // Download Daybook PDF Report
  const handleDownloadDaybookPDF = async () => {
    if (!activeTimeWindow) return;

    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Business Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.text(shopName || "HISAB X", 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(viewMode === "daybook" ? "Daily Rojnamcha / Daybook Report" : "Register Shift Summary Report", 15, 25);

      // Statement Metadata
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(viewMode === "daybook" ? "DAILY CASH BOOK" : "SHIFT REGISTER CASH FLOW", 130, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 130, 25);
      doc.text(`${activeTimeWindow.label}`, 130, 30);

      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setLineWidth(0.4);
      doc.line(15, 33, 195, 33);

      // Financial Summary Block
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text("CASH BALANCE SUMMARY", 15, 41);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(`Opening Float (Cash): Rs ${daybookData.openingFloat.toLocaleString()}`, 15, 47);
      doc.text(`Total Cash In (+): Rs ${daybookData.cashInTotal.toLocaleString()}`, 15, 52);
      doc.text(`Total Cash Out (-): Rs ${daybookData.cashOutTotal.toLocaleString()}`, 15, 57);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(79, 70, 229); // Indigo 600
      doc.text(`Net Cash in Hand: Rs ${daybookData.cashInHand.toLocaleString()}`, 15, 63);

      // If shift session, show expected vs actual drawer closing cash
      if (viewMode === "shift" && activeTimeWindow.session) {
        const session = activeTimeWindow.session as RegisterSession;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105);
        doc.text("DRAWER VERIFICATION", 120, 41);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(`Expected Drawer Cash: Rs ${daybookData.cashInHand.toLocaleString()}`, 120, 47);
        doc.text(`Actual Counted Cash: ${session.status === "open" ? "Shift Active" : `Rs ${Number(session.closing_balance).toLocaleString()}`}`, 120, 52);
        
        if (session.status === "closed") {
          const diff = Number(session.closing_balance) - daybookData.cashInHand;
          if (diff > 0) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(5, 150, 105); // Emerald 600
            doc.text(`Overage (+): Rs ${diff.toLocaleString()}`, 120, 57);
          } else if (diff < 0) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(220, 38, 38); // Red 600
            doc.text(`Shortage (-): Rs ${Math.abs(diff).toLocaleString()}`, 120, 57);
          } else {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(71, 85, 105);
            doc.text("Drawer Status: Balanced (Rs 0)", 120, 57);
          }
        }
      }

      // Generate Table
      const headers = [["Time / Date", "Transaction Type", "Details / Remarks", "Cash In (+)", "Cash Out (-)", "Drawer Balance"]];
      
      // Sort chronologically for PDF output (oldest first)
      const pdfTxList = [...daybookData.transactions].reverse();
      const tableRows = pdfTxList.map(t => [
        new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " " + new Date(t.time).toLocaleDateString(),
        t.type,
        t.description,
        t.cashIn > 0 ? `Rs ${t.cashIn.toLocaleString()}` : "-",
        t.cashOut > 0 ? `Rs ${t.cashOut.toLocaleString()}` : "-",
        `Rs ${t.runningBalance.toLocaleString()}`
      ]);

      autoTable(doc, {
        head: headers,
        body: tableRows,
        startY: 70,
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59], // Slate 800
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: "bold"
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85]
        },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 25 },
          2: { cellWidth: 70 },
          3: { halign: "right", fontStyle: "bold", textColor: [5, 150, 105] }, // Emerald
          4: { halign: "right", fontStyle: "bold", textColor: [220, 38, 38] }, // Red
          5: { halign: "right", fontStyle: "bold", textColor: [30, 41, 59] }
        },
        margin: { left: 15, right: 15 }
      });

      // Footer note
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Powered by Hisab X POS - Page ${i} of ${pageCount}`, 15, 287);
      }

      const filename = viewMode === "daybook" 
        ? `rojnamcha_daybook_${selectedDate}.pdf`
        : `shift_register_session_${selectedSessionId.slice(0, 8)}.pdf`;
      doc.save(filename);
      toast.success("PDF Daybook downloaded successfully!");
    } catch (err: any) {
      toast.error("Failed to generate PDF Daybook: " + err.message);
    }
  };

  return (
    <div className="space-y-6 p-1 font-sans text-slate-800">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-650 rounded-2xl text-white shadow-md shadow-indigo-200">
              <Calculator className="h-6 w-6" />
            </span>
            Daily Register (Rojnamcha / Daybook)
          </h1>
          <p className="text-slate-500 text-xs mt-1 flex items-center gap-2">
            Real-time tracking of cash drawer transactions, manual Khata collections, expenses, and final cash-in-hand.
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${isLive ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              {isLive ? "LIVE" : "Connecting..."}
            </span>
            {lastUpdated && (
              <span className="text-[10px] text-slate-400 font-semibold">
                Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleDownloadDaybookPDF}
            className="bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-slate-900/10 flex items-center gap-1.5"
          >
            <Download size={14} /> Download PDF Daybook
          </Button>
          <Link href="/dashboard/pos">
            <Button className="bg-indigo-600 hover:bg-indigo-755 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/10">
              Open POS / Billing
            </Button>
          </Link>
        </div>
      </div>

      {/* Mode Selector Tab Controls */}
      <div className="flex border-b border-slate-200 bg-white rounded-3xl p-1.5 border border-slate-200/80 max-w-sm shrink-0 select-none shadow-sm">
        <button
          onClick={() => setViewMode("daybook")}
          className={`flex-1 py-2 px-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
            viewMode === "daybook"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <Calendar size={14} />
          Daily Daybook
        </button>
        <button
          onClick={() => setViewMode("shift")}
          className={`flex-1 py-2 px-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
            viewMode === "shift"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <User size={14} />
          Shift Session
        </button>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { 
            label: "Opening Cash Float", 
            val: `Rs ${Math.round(daybookData.openingFloat).toLocaleString()}`, 
            icon: FileText, 
            bg: "bg-slate-50 text-slate-700 border-slate-100",
            desc: viewMode === "daybook" ? "Starting cash of the day" : "Float registered on shift open"
          },
          { 
            label: "Total Cash Received (In)", 
            val: `Rs ${Math.round(daybookData.cashInTotal).toLocaleString()}`, 
            icon: ArrowDownLeft, 
            bg: "bg-emerald-50 text-emerald-700 border-emerald-100",
            desc: "POS Cash Sales + Khata Collections (+)"
          },
          { 
            label: "Total Cash Paid (Out)", 
            val: `Rs ${Math.round(daybookData.cashOutTotal).toLocaleString()}`, 
            icon: ArrowUpRight, 
            bg: "bg-rose-50 text-rose-700 border-rose-100",
            desc: "Supplier Payments + Expenses (-)"
          },
          { 
            label: "Final Cash in Drawer (Hand)", 
            val: `Rs ${Math.round(daybookData.cashInHand).toLocaleString()}`, 
            icon: DollarSign, 
            bg: "bg-indigo-50 text-indigo-700 border-indigo-100",
            desc: "Expected cash balance in till drawer"
          }
        ].map((stat, i) => (
          <motion.div 
            key={i}
            whileHover={{ y: -2 }}
            className={`p-5 bg-white border rounded-3xl shadow-sm flex items-center justify-between transition-all ${stat.bg}`}
          >
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-xl font-black mt-1 leading-none">{stat.val}</h3>
              <p className="text-[9px] text-slate-400 mt-1.5 font-bold leading-relaxed">{stat.desc}</p>
            </div>
            <div className="p-3 rounded-2xl bg-white shadow-sm border border-slate-50">
              <stat.icon className="h-5 w-5" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Advanced Filter Panel */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-1">
          <Filter size={16} className="text-slate-500" />
          <h4 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider">Daybook Filter Settings</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mode-Specific Input Selection */}
          {viewMode === "daybook" ? (
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5">Select Daybook Date</label>
              <Input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9.5 text-xs bg-slate-50 border-slate-200 rounded-xl"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5">Select Cashier Shift Session</label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="w-full h-9.5 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 text-slate-655 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold cursor-pointer"
              >
                {sessions.length === 0 ? (
                  <option value="all">No shift sessions logged</option>
                ) : (
                  sessions.map(sess => (
                    <option key={sess.id} value={sess.id}>
                      {sess.cashierName} - {new Date(sess.opened_at).toLocaleDateString()} ({sess.status.toUpperCase()})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Search bar inside Daybook list */}
          <div>
            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5">Search Description / Remarks</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input 
                placeholder="Search transaction log..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9.5 text-xs bg-slate-50 border-slate-200 focus-visible:ring-indigo-500/20 rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Daybook Transaction Ledger table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden p-1.5 font-sans">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-2 text-indigo-500" />
            <span className="text-xs font-semibold">Loading daily transactions ledger...</span>
          </div>
        ) : daybookData.transactions.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-xs font-medium">
            No transactions recorded in the Daybook for this period.
          </div>
        ) : (
          <div className="overflow-x-auto animate-in fade-in duration-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-black uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-5">Time & Date</th>
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-5">Transaction Details / Remarks</th>
                  <th className="py-3 px-5 text-right font-semibold">Cash In (+)</th>
                  <th className="py-3 px-5 text-right font-semibold">Cash Out (-)</th>
                  <th className="py-3 px-5 text-right font-semibold">Running Cash Drawer Balance</th>
                  <th className="py-3 px-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {/* Prepend opening balance forward row */}
                <tr className="bg-slate-50/30 text-[11px] font-bold text-slate-500 border-b border-dashed border-slate-200">
                  <td className="py-3 px-5 font-mono">
                    {viewMode === "daybook" ? `${new Date(selectedDate + "T00:00:00").toLocaleDateString()}` : "Shift Opened"}
                  </td>
                  <td className="py-3 px-5 text-indigo-600">FLOAT</td>
                  <td className="py-3 px-5">Day/Shift Starting Cash Balance Forward</td>
                  <td className="py-3 px-5 text-right text-emerald-650">Rs {daybookData.openingFloat.toLocaleString()}</td>
                  <td className="py-3 px-5 text-right">-</td>
                  <td className="py-3 px-5 text-right font-extrabold text-slate-800">Rs {daybookData.openingFloat.toLocaleString()}</td>
                  <td className="py-3 px-5 text-center">-</td>
                </tr>

                {daybookData.transactions.map((tx) => {
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/40 transition-all font-medium text-slate-700">
                      <td className="py-3.5 px-5 font-mono text-slate-400">
                        {new Date(tx.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &nbsp; 
                        <span className="text-[10px]">{new Date(tx.time).toLocaleDateString()}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border ${
                          tx.type === "Sale"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : tx.type === "Khata In"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                              : tx.type === "Khata Out"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : "bg-rose-50 text-rose-700 border-rose-100"
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-700 font-semibold max-w-[320px] truncate" title={tx.description}>
                        {tx.description}
                      </td>
                      <td className="py-3.5 px-5 text-right font-bold text-emerald-650">
                        {tx.cashIn > 0 ? `Rs ${tx.cashIn.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-3.5 px-5 text-right font-bold text-rose-650">
                        {tx.cashOut > 0 ? `Rs ${tx.cashOut.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-3.5 px-5 text-right font-extrabold text-slate-850">
                        Rs {tx.runningBalance.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {tx.type === "Sale" ? (
                          <button
                            onClick={() => handleViewInvoiceDetails(tx.sourceId)}
                            className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-650 rounded-xl transition-all border border-slate-100 shadow-sm"
                            title="View POS invoice details"
                          >
                            <Eye size={12} />
                          </button>
                        ) : (
                          <span className="text-slate-400 font-semibold">-</span>
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

      {/* MODAL: POS Invoice Details Popup */}
      <AnimatePresence>
        {selectedInvoiceId && selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg relative z-10 border border-slate-200"
            >
              <button 
                onClick={() => setSelectedInvoiceId(null)} 
                className="absolute top-4.5 right-4.5 text-slate-400 hover:text-slate-655"
              >
                <X size={16} />
              </button>

              <h3 className="font-black text-slate-800 text-sm mb-1">Invoice Receipt Breakdown</h3>
              <p className="text-[10px] text-slate-400 mb-4">Invoice: #{selectedInvoice.id.slice(0, 8).toUpperCase()} • Date: {new Date(selectedInvoice.created_at).toLocaleString()}</p>

              {loadingInvoiceDetails ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mb-2 text-indigo-500" />
                  <span className="text-xs font-semibold font-sans">Loading receipt items...</span>
                </div>
              ) : (
                <div className="space-y-4 font-sans text-xs">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-wrap gap-x-6 gap-y-1 justify-between">
                    <div>
                      <span className="text-slate-400 font-bold text-[9px] uppercase">Customer Account</span>
                      <p className="font-bold text-slate-800 capitalize mt-0.5">{selectedInvoice.parties?.name || "Walk-in Customer"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold text-[9px] uppercase">Payment Mode</span>
                      <p className="font-bold text-slate-800 uppercase mt-0.5">{selectedInvoice.payment_mode}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold text-[9px] uppercase">Payment status</span>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase mt-0.5 ${
                        selectedInvoice.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>{selectedInvoice.status}</span>
                    </div>
                  </div>

                  {/* Items list */}
                  <div>
                    <span className="text-slate-400 font-bold text-[9px] uppercase block mb-1.5">Items Purchased</span>
                    <div className="max-h-[180px] overflow-y-auto border border-slate-100 rounded-xl custom-scrollbar">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-100 font-bold text-slate-400 bg-slate-50/50 sticky top-0">
                            <th className="py-2 px-3">Item name</th>
                            <th className="py-2 px-2 text-center">Qty</th>
                            <th className="py-2 px-3 text-right">Price</th>
                            <th className="py-2 px-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-slate-700">
                          {selectedInvoiceItems.map(item => (
                            <tr key={item.id}>
                              <td className="py-2 px-3">
                                <p className="font-bold">{item.productName}</p>
                                {item.variantName && <span className="text-[9px] text-indigo-650">Packing: {item.variantName}</span>}
                              </td>
                              <td className="py-2 px-2 text-center font-mono">{item.quantity}</td>
                              <td className="py-2 px-3 text-right font-mono">Rs {Math.round(item.unit_price)}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">Rs {Math.round(item.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="border-t border-slate-100 pt-3 space-y-1 font-semibold text-slate-655 text-right">
                    {selectedInvoice.tax_amount > 0 && <p className="text-[10px]">Tax (+): Rs {Math.round(selectedInvoice.tax_amount)}</p>}
                    {selectedInvoice.discount > 0 && <p className="text-[10px] text-red-500">Discount (-): Rs {Math.round(selectedInvoice.discount)}</p>}
                    <p className="font-black text-slate-900">Grand Total: Rs {Math.round(selectedInvoice.total_amount).toLocaleString()}</p>
                    <p className="text-emerald-650 font-bold">Cash Received: Rs {Math.round(selectedInvoice.paid_amount).toLocaleString()}</p>
                    {selectedInvoice.total_amount - selectedInvoice.paid_amount > 0 && (
                      <p className="text-amber-650 font-bold">Udhaar Added to Khata: Rs {Math.round(selectedInvoice.total_amount - selectedInvoice.paid_amount).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-4 pt-3 border-t border-slate-150">
                <Button onClick={() => setSelectedInvoiceId(null)} className="bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-xs h-9.5 rounded-xl">
                  Close Receipt
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
