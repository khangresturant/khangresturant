"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calculator, Search, Calendar, Filter, Eye, X, Loader2, ArrowLeftRight,
  TrendingUp, AlertCircle, CheckCircle, FileText, User, ShoppingCart, DollarSign,
  Download, ArrowDownLeft, ArrowUpRight, Plus, Minus, RefreshCw, Car, Landmark,
  Layers, BadgeCheck, FileSpreadsheet, Sparkles, CheckCircle2, ShieldCheck, ChevronRight
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { formatDateTime, formatDate, formatTime, getTodayDateString } from "@/lib/timezone";
import {
  vehicleLabel,
  formatPKR,
  type ShowroomVehicle,
  type ShowroomInstallment,
  type ShowroomInstallmentSchedule,
  type ShowroomParty,
  type ShowroomRental,
  type ShowroomInvestor,
  type ShowroomInvestorTx,
  loadShowroomOfflineEntities,
  isShowroomOffline,
} from "@/lib/showroom-ops";

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

type PurchasePO = {
  id: string;
  created_at: string;
  total_amount: number;
  paid_amount: number;
  payment_mode: string;
  supplier_id: string | null;
  supplierName?: string;
};

type CashAccount = {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  opening_balance?: number;
};

type AccountTx = {
  id: string;
  account_id: string | null;
  amount: number;
  created_at: string;
  ref_id: string | null;
  ref_type: string | null;
  remarks: string | null;
  shop_id: string | null;
  type: string;
};

export type DaybookTxType = 
  | "Sale" 
  | "Installment Advance" 
  | "Installment Qist" 
  | "Khata In" 
  | "Khata Out" 
  | "Expense" 
  | "Purchase" 
  | "Investor In" 
  | "Investor Out" 
  | "Rental"
  | "Account Tx";

export type DaybookTransaction = {
  id: string;
  time: string;
  type: DaybookTxType;
  categoryBadge: string;
  description: string;
  partyName?: string;
  cashIn: number;
  cashOut: number;
  runningBalance: number;
  sourceId: string;
  sourceType: "pos_invoice" | "credit_tx" | "expense" | "purchase_po" | "showroom_vehicle" | "showroom_installment" | "showroom_qist" | "showroom_expense" | "showroom_rental" | "showroom_investor" | "account_tx";
  metadata?: any;
};

export default function RegisterLedgerPage() {
  const { shopId, shopName, activeClosingBook, timezone } = useShop();
  const supabase = createClient();

  const [sessions, setSessions] = useState<RegisterSession[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchasePO[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [parties, setParties] = useState<{ id: string; name: string; type: "customer" | "supplier" }[]>([]);

  // Showroom domain state
  const [showroomVehicles, setShowroomVehicles] = useState<ShowroomVehicle[]>([]);
  const [showroomInstallments, setShowroomInstallments] = useState<ShowroomInstallment[]>([]);
  const [showroomSchedules, setShowroomSchedules] = useState<ShowroomInstallmentSchedule[]>([]);
  const [showroomExpenses, setShowroomExpenses] = useState<any[]>([]);
  const [showroomRentals, setShowroomRentals] = useState<ShowroomRental[]>([]);
  const [showroomInvestors, setShowroomInvestors] = useState<ShowroomInvestor[]>([]);
  const [showroomInvestorTxs, setShowroomInvestorTxs] = useState<ShowroomInvestorTx[]>([]);
  const [accountTransactions, setAccountTransactions] = useState<AccountTx[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Real-time live indicator
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const channelRef = useRef<any>(null);

  // View Mode: "daybook" vs "shift"
  const [viewMode, setViewMode] = useState<"daybook" | "shift">("daybook");

  // Date Presets: "all" | "today" | "yesterday" | "7days" | "month" | "single_date" | "custom_range"
  const [datePreset, setDatePreset] = useState<"all" | "today" | "yesterday" | "7days" | "month" | "single_date" | "custom_range">("all");
  
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - (offset*60*1000));
    return localDate.toISOString().split("T")[0];
  });
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Filter by category
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Shift Session filter
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");

  // Search inside daybook table
  const [searchQuery, setSearchQuery] = useState("");

  // Detailed Modal for invoice or showroom transaction popup
  const [selectedTxDetail, setSelectedTxDetail] = useState<DaybookTransaction | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<any[]>([]);
  const [loadingInvoiceDetails, setLoadingInvoiceDetails] = useState(false);

  useEffect(() => {
    if (!shopId) return;

    fetchData();

    // --- Real-time subscriptions ---
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "purchase_orders", filter: `shop_id=eq.${shopId}` },
        () => { fetchData(); setLastUpdated(new Date()); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "showroom_vehicles", filter: `shop_id=eq.${shopId}` },
        () => { fetchData(); setLastUpdated(new Date()); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "showroom_installments", filter: `shop_id=eq.${shopId}` },
        () => { fetchData(); setLastUpdated(new Date()); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "showroom_installment_schedules" },
        () => { fetchData(); setLastUpdated(new Date()); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "showroom_vehicle_expenses", filter: `shop_id=eq.${shopId}` },
        () => { fetchData(); setLastUpdated(new Date()); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "showroom_investor_transactions", filter: `shop_id=eq.${shopId}` },
        () => { fetchData(); setLastUpdated(new Date()); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "account_transactions", filter: `shop_id=eq.${shopId}` },
        () => { fetchData(); setLastUpdated(new Date()); }
      )
      .subscribe((status: string) => {
        setIsLive(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [shopId, activeClosingBook]);

  const fetchData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      if (isShowroomOffline()) {
        const [offVeh, offInst, offSched, offRent, offInv, offTx] = await Promise.all([
          loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId),
          loadShowroomOfflineEntities<ShowroomInstallment>("showroom_installments", shopId),
          loadShowroomOfflineEntities<ShowroomInstallmentSchedule>("showroom_installment_schedules", shopId),
          loadShowroomOfflineEntities<ShowroomRental>("showroom_rentals", shopId),
          loadShowroomOfflineEntities<ShowroomInvestor>("showroom_investors", shopId),
          loadShowroomOfflineEntities<ShowroomInvestorTx>("showroom_investor_transactions", shopId),
        ]);
        setShowroomVehicles(offVeh);
        setShowroomInstallments(offInst);
        setShowroomSchedules(offSched);
        setShowroomRentals(offRent);
        setShowroomInvestors(offInv);
        setShowroomInvestorTxs(offTx);
        setLoading(false);
        return;
      }

      // Parallel Data Fetching across Standard and Showroom systems
      const [
        sessionsRes,
        invRes,
        txsRes,
        expRes,
        poRes,
        profRes,
        partRes,
        vehRes,
        instRes,
        schedRes,
        sExpRes,
        rentRes,
        invstRes,
        invstTxRes,
        accTxRes,
        cashAccRes
      ] = await Promise.all([
        supabase.from("register_sessions").select("*").eq("shop_id", shopId).order("opened_at", { ascending: false }),
        supabase.from("invoices").select("id, created_at, total_amount, paid_amount, status, payment_mode, register_session_id, party_id").eq("shop_id", shopId).eq("is_voided", false).neq("status", "draft"),
        supabase.from("credit_transactions").select("id, created_at, amount, transaction_type, remarks, customer_id").eq("shop_id", shopId),
        supabase.from("expenses").select("id, created_at, name, amount, remarks, register_session_id").eq("shop_id", shopId),
        supabase.from("purchase_orders").select("id, created_at, total_amount, paid_amount, payment_mode, supplier_id").eq("shop_id", shopId).eq("is_voided", false),
        supabase.from("user_profiles").select("id, name").eq("shop_id", shopId),
        supabase.from("parties").select("id, name, type").eq("shop_id", shopId),
        supabase.from("showroom_vehicles").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
        supabase.from("showroom_installments").select("*, showroom_vehicles(*)").eq("shop_id", shopId).order("created_at", { ascending: false }),
        supabase.from("showroom_installment_schedules").select("*, showroom_installments(id, customer_name, customer_phone, vehicle_id, showroom_vehicles(*))").order("due_date", { ascending: false }),
        supabase.from("showroom_vehicle_expenses").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
        supabase.from("showroom_rentals").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
        supabase.from("showroom_investors").select("*").eq("shop_id", shopId),
        supabase.from("showroom_investor_transactions").select("*").eq("shop_id", shopId).order("date", { ascending: false }),
        supabase.from("account_transactions").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
        supabase.from("cash_accounts").select("*").eq("shop_id", shopId)
      ]);

      const rawSessions = sessionsRes.data || [];
      const rawInvoices = invRes.data || [];
      const rawTxs = txsRes.data || [];
      const rawExpenses = expRes.data || [];
      const rawPos = poRes.data || [];
      const rawProfiles = profRes.data || [];
      const rawParties = partRes.data || [];

      setProfiles(rawProfiles);
      setParties(rawParties);

      // Map and format Invoices
      const mappedInvoices = rawInvoices.map((inv: any) => ({
        ...inv,
        total_amount: Number(inv.total_amount || 0),
        paid_amount: Number(inv.paid_amount || 0),
        customerName: rawParties.find((p: any) => p.id === inv.party_id)?.name || "Walk-in Customer"
      }));
      setInvoices(mappedInvoices);

      // Map and format Sessions
      const mappedSessions = rawSessions.map((sess: any) => ({
        ...sess,
        opening_balance: Number(sess.opening_balance || 0),
        closing_balance: sess.closing_balance !== null ? Number(sess.closing_balance) : null,
        cashierName: rawProfiles.find((p: any) => p.id === sess.user_id)?.name || "Unknown Cashier"
      }));
      setSessions(mappedSessions);
      if (mappedSessions.length > 0 && selectedSessionId === "all") {
        setSelectedSessionId(mappedSessions[0].id);
      }

      // Map and format Credit Transactions
      const mappedTxs = rawTxs.map((tx: any) => {
        const party = rawParties.find((p: any) => p.id === tx.customer_id);
        return {
          ...tx,
          amount: Number(tx.amount || 0),
          partyName: party?.name || "Manual Party",
          partyType: party?.type || "customer"
        };
      });
      setCreditTransactions(mappedTxs);

      // Format Expenses
      const mappedExpenses = rawExpenses.map((exp: any) => ({
        ...exp,
        amount: Number(exp.amount || 0)
      }));
      setExpenses(mappedExpenses);

      // Format Purchase Orders
      const mappedPos = rawPos.map((po: any) => ({
        ...po,
        total_amount: Number(po.total_amount || 0),
        paid_amount: Number(po.paid_amount || 0),
        supplierName: rawParties.find((p: any) => p.id === po.supplier_id)?.name || "Cash Purchase"
      }));
      setPurchaseOrders(mappedPos);

      // Set Showroom Domain Data
      setShowroomVehicles(vehRes.data || []);
      setShowroomInstallments(instRes.data || []);
      setShowroomSchedules(schedRes.data || []);
      setShowroomExpenses(sExpRes.data || []);
      setShowroomRentals(rentRes.data || []);
      setShowroomInvestors(invstRes.data || []);
      setShowroomInvestorTxs(invstTxRes.data || []);
      setAccountTransactions(accTxRes.data || []);
      setCashAccounts(
        (cashAccRes.data || []).map((acc: any) => ({
          ...acc,
          current_balance: Number(acc.current_balance || 0),
          opening_balance: Number(acc.opening_balance || 0)
        }))
      );

    } catch (err: any) {
      toast.error("Failed to load Rojnamcha daybook data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Determine active time window based on preset or custom date
  const activeTimeWindow = useMemo(() => {
    if (viewMode === "shift") {
      const session = sessions.find(s => s.id === selectedSessionId);
      if (!session) return null;
      const start = new Date(session.opened_at);
      const end = session.closed_at ? new Date(session.closed_at) : new Date();
      return { 
        start, 
        end, 
        label: `Shift: ${session.cashierName} (${new Date(session.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        session,
        isAllTime: false
      };
    }

    // Daybook Mode
    if (datePreset === "all") {
      return {
        start: new Date(0), // 1970
        end: new Date(8640000000000000), // Max date
        label: "All Recorded Transactions",
        isAllTime: true
      };
    }

    if (datePreset === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { start, end, label: `Today (${start.toLocaleDateString()})`, isAllTime: false };
    }

    if (datePreset === "yesterday") {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: `Yesterday (${start.toLocaleDateString()})`, isAllTime: false };
    }

    if (datePreset === "7days") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { start, end, label: `Last 7 Days (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`, isAllTime: false };
    }

    if (datePreset === "month") {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { start, end, label: `This Month (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`, isAllTime: false };
    }

    if (datePreset === "single_date") {
      if (!selectedDate) return null;
      const start = new Date(selectedDate + "T00:00:00");
      const end = new Date(selectedDate + "T23:59:59.999");
      return { start, end, label: `Date: ${start.toLocaleDateString()}`, isAllTime: false };
    }

    if (datePreset === "custom_range") {
      if (!startDate || !endDate) return null;
      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T23:59:59.999");
      return { start, end, label: `Range: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`, isAllTime: false };
    }

    return null;
  }, [viewMode, datePreset, selectedDate, startDate, endDate, selectedSessionId, sessions]);

  // Unified Master Daybook Ledger Calculation
  const daybookData = useMemo(() => {
    // 1. Collect ALL transactions across the entire history first
    const allRawTxs: Omit<DaybookTransaction, "runningBalance">[] = [];

    // A. POS Invoices (Standard cash sales)
    invoices.forEach(inv => {
      if (inv.payment_mode !== "card" && inv.status !== "quotation" && Number(inv.paid_amount || 0) > 0) {
        allRawTxs.push({
          id: `pos-${inv.id}`,
          time: inv.created_at,
          type: "Sale",
          categoryBadge: "POS Sale",
          description: `POS Sale Receipt #${inv.id.slice(0, 8).toUpperCase()} to ${inv.customerName}`,
          partyName: inv.customerName,
          cashIn: Number(inv.paid_amount),
          cashOut: 0,
          sourceId: inv.id,
          sourceType: "pos_invoice",
          metadata: inv
        });
      }
    });

    // B. Showroom Vehicle Cash Sales (Direct full cash sales)
    showroomVehicles.forEach(v => {
      // If vehicle is marked sold (or has sold_price & not active installment)
      const isInstallment = showroomInstallments.some(inst => inst.vehicle_id === v.id);
      if (v.status === "sold" && !isInstallment && Number(v.sold_price || 0) > 0) {
        const vTitle = `${v.make || ""} ${v.model || ""} ${v.variant || ""} ${v.year ? `(${v.year})` : ""}`.trim();
        allRawTxs.push({
          id: `veh-sale-${v.id}`,
          time: v.sold_at || v.created_at || new Date().toISOString(),
          type: "Sale",
          categoryBadge: "Vehicle Sale",
          description: `Vehicle Cash Sale: ${vTitle} (${v.plate_number || "Unregistered"}) - Buyer: ${v.buyer_name || "Walk-in"}`,
          partyName: v.buyer_name || "Customer",
          cashIn: Number(v.sold_price || 0),
          cashOut: 0,
          sourceId: v.id,
          sourceType: "showroom_vehicle",
          metadata: v
        });
      }

      // Vehicle Purchase Cash Outflow
      const purchaseAmt = Number(v.purchase_cost || v.purchase_price || 0);
      if (purchaseAmt > 0) {
        const vTitle = `${v.make || ""} ${v.model || ""} ${v.variant || ""} ${v.year ? `(${v.year})` : ""}`.trim();
        allRawTxs.push({
          id: `veh-purchase-${v.id}`,
          time: v.purchase_date || v.created_at || new Date().toISOString(),
          type: "Purchase",
          categoryBadge: "Vehicle Purchase",
          description: `Vehicle Purchase (Stock): ${vTitle} (${v.plate_number || "Unregistered"}) - Seller: ${v.seller_name || "Direct Purchase"}`,
          partyName: v.seller_name || "Seller",
          cashIn: 0,
          cashOut: purchaseAmt,
          sourceId: v.id,
          sourceType: "showroom_vehicle",
          metadata: v
        });
      }
    });

    // C. Showroom Installment Advance (Down Payments)
    showroomInstallments.forEach(inst => {
      if (Number(inst.down_payment || 0) > 0) {
        const veh = (inst as any).showroom_vehicles;
        const vTitle = veh ? `${veh.make || ""} ${veh.model || ""} (${veh.plate_number || "Vehicle"})` : "Vehicle";
        allRawTxs.push({
          id: `inst-down-${inst.id}`,
          time: inst.start_date || inst.created_at || new Date().toISOString(),
          type: "Installment Advance",
          categoryBadge: "Advance / Biyana",
          description: `Installment Advance (Down Payment): ${vTitle} - Customer: ${inst.customer_name}`,
          partyName: inst.customer_name,
          cashIn: Number(inst.down_payment || 0),
          cashOut: 0,
          sourceId: inst.id,
          sourceType: "showroom_installment",
          metadata: inst
        });
      }
    });

    // D. Showroom Installment Qist Payments (Monthly Wasooli)
    showroomSchedules.forEach(sched => {
      if (sched.status === "paid" || Number(sched.paid_amount || 0) > 0) {
        const inst = (sched as any).showroom_installments;
        const veh = inst?.showroom_vehicles;
        const vTitle = veh ? `${veh.make || ""} ${veh.model || ""}` : "Vehicle";
        const cName = inst?.customer_name || "Customer";
        allRawTxs.push({
          id: `inst-qist-${sched.id}`,
          time: sched.paid_date || sched.created_at || new Date().toISOString(),
          type: "Installment Qist",
          categoryBadge: "Qist Wasooli",
          description: `Installment Qist #${sched.installment_no} Received: ${vTitle} - Customer: ${cName}`,
          partyName: cName,
          cashIn: Number(sched.paid_amount || sched.amount || 0),
          cashOut: 0,
          sourceId: sched.id,
          sourceType: "showroom_qist",
          metadata: sched
        });
      }
    });

    // E. Khata Manual Credit Transactions (Customer & Supplier wasooli)
    creditTransactions.forEach(tx => {
      if (tx.transaction_type === "payment" && Number(tx.amount || 0) > 0) {
        const isCustomer = tx.partyType === "customer";
        allRawTxs.push({
          id: `khata-${tx.id}`,
          time: tx.created_at,
          type: "Khata In",
          categoryBadge: isCustomer ? "Khata Wasooli" : "Supplier Refund",
          description: `${isCustomer ? "Khata Cash Received from Customer" : "Supplier Cash Refund"}: ${tx.partyName}${tx.remarks ? ` (${tx.remarks})` : ""}`,
          partyName: tx.partyName,
          cashIn: Number(tx.amount || 0),
          cashOut: 0,
          sourceId: tx.id,
          sourceType: "credit_tx",
          metadata: tx
        });
      }
    });

    // F. General Business Expenses
    expenses.forEach(exp => {
      if (Number(exp.amount || 0) > 0) {
        allRawTxs.push({
          id: `exp-${exp.id}`,
          time: exp.created_at,
          type: "Expense",
          categoryBadge: "Business Expense",
          description: `Business Expense: ${exp.name}${exp.remarks ? ` (${exp.remarks})` : ""}`,
          cashIn: 0,
          cashOut: Number(exp.amount || 0),
          sourceId: exp.id,
          sourceType: "expense",
          metadata: exp
        });
      }
    });

    // G. Showroom Vehicle Expenses (Maintenance, Detailing, Registration)
    showroomExpenses.forEach(exp => {
      if (Number(exp.amount || 0) > 0) {
        allRawTxs.push({
          id: `sexp-${exp.id}`,
          time: exp.date || exp.created_at || new Date().toISOString(),
          type: "Expense",
          categoryBadge: "Vehicle Expense",
          description: `Vehicle Expense: ${exp.title || exp.expense_type || "Maintenance"}${exp.remarks ? ` (${exp.remarks})` : ""}`,
          cashIn: 0,
          cashOut: Number(exp.amount || 0),
          sourceId: exp.id,
          sourceType: "showroom_expense",
          metadata: exp
        });
      }
    });

    // H. Purchase Orders (POS Stock Purchases)
    purchaseOrders.forEach(po => {
      if (Number(po.paid_amount || 0) > 0 && po.payment_mode !== "credit") {
        allRawTxs.push({
          id: `purchase-${po.id}`,
          time: po.created_at,
          type: "Purchase",
          categoryBadge: "POS Purchase",
          description: `Stock Purchase from ${po.supplierName} (PO #${po.id.slice(0, 8).toUpperCase()})`,
          partyName: po.supplierName,
          cashIn: 0,
          cashOut: Number(po.paid_amount),
          sourceId: po.id,
          sourceType: "purchase_po",
          metadata: po
        });
      }
    });

    // I. Showroom Rentals
    showroomRentals.forEach(rent => {
      if (Number(rent.advance_amount || 0) > 0) {
        allRawTxs.push({
          id: `rent-${rent.id}`,
          time: rent.created_at || new Date().toISOString(),
          type: "Rental",
          categoryBadge: "Rental Advance",
          description: `Rental Booking Advance: ${rent.customer_name} (Rental #${rent.id.slice(0, 6)})`,
          partyName: rent.customer_name,
          cashIn: Number(rent.advance_amount || 0),
          cashOut: 0,
          sourceId: rent.id,
          sourceType: "showroom_rental",
          metadata: rent
        });
      }
    });

    // J. Showroom Investors
    showroomInvestorTxs.forEach(itx => {
      const inv = showroomInvestors.find(i => i.id === itx.investor_id);
      const invName = inv?.name || "Investor";
      if (itx.tx_type === "capital_inflow" && Number(itx.amount || 0) > 0) {
        allRawTxs.push({
          id: `inv-in-${itx.id}`,
          time: itx.date || itx.created_at || new Date().toISOString(),
          type: "Investor In",
          categoryBadge: "Investor Deposit",
          description: `Investor Capital Deposit from ${invName}${itx.description ? ` (${itx.description})` : ""}`,
          partyName: invName,
          cashIn: Number(itx.amount || 0),
          cashOut: 0,
          sourceId: itx.id,
          sourceType: "showroom_investor",
          metadata: itx
        });
      } else if ((itx.tx_type === "profit_payout" || itx.tx_type === "capital_withdrawal") && Number(itx.amount || 0) > 0) {
        allRawTxs.push({
          id: `inv-out-${itx.id}`,
          time: itx.date || itx.created_at || new Date().toISOString(),
          type: "Investor Out",
          categoryBadge: "Investor Payout",
          description: `Investor Payout / Withdrawal to ${invName}${itx.description ? ` (${itx.description})` : ""}`,
          partyName: invName,
          cashIn: 0,
          cashOut: Number(itx.amount || 0),
          sourceId: itx.id,
          sourceType: "showroom_investor",
          metadata: itx
        });
      }
    });

    // Sort all historical transactions strictly chronologically (oldest first)
    allRawTxs.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    // 2. Compute Window Boundaries & Opening Balance
    if (!activeTimeWindow) {
      return { transactions: [], openingFloat: 0, cashInTotal: 0, cashOutTotal: 0, cashInHand: 0 };
    }

    const startTime = activeTimeWindow.start.getTime();
    const endTime = activeTimeWindow.end.getTime();

    // Default opening cash from Cash Account setup if any
    const primaryCashAcc = cashAccounts.find(a => a.type === "cash" || a.name.toLowerCase().includes("cash")) || cashAccounts[0];
    const initialOpeningBal = primaryCashAcc ? Number(primaryCashAcc.opening_balance || 0) : 0;

    let cumulativeBeforeWindow = initialOpeningBal;

    if (viewMode === "shift" && activeTimeWindow.session) {
      cumulativeBeforeWindow = activeTimeWindow.session.opening_balance;
    } else if (!activeTimeWindow.isAllTime) {
      // Calculate cumulative net cash flow strictly BEFORE the start of this window
      allRawTxs.forEach(tx => {
        const txTime = new Date(tx.time).getTime();
        if (txTime < startTime) {
          cumulativeBeforeWindow += (tx.cashIn - tx.cashOut);
        }
      });
    }

    const openingFloat = cumulativeBeforeWindow;

    // Filter transactions within the active window
    const windowTxs = allRawTxs.filter(tx => {
      const txTime = new Date(tx.time).getTime();
      return txTime >= startTime && txTime <= endTime;
    });

    // Calculate running balance within the active window
    let currentBal = openingFloat;
    let cashInTotal = 0;
    let cashOutTotal = 0;

    const transactionsWithBalance: DaybookTransaction[] = windowTxs.map(tx => {
      cashInTotal += tx.cashIn;
      cashOutTotal += tx.cashOut;
      currentBal = currentBal + tx.cashIn - tx.cashOut;
      return {
        ...tx,
        runningBalance: currentBal
      };
    });

    // Apply category & search query filters
    const filteredList = transactionsWithBalance.filter(tx => {
      // Category filter
      if (categoryFilter === "inflow" && tx.cashIn <= 0) return false;
      if (categoryFilter === "outflow" && tx.cashOut <= 0) return false;
      if (categoryFilter === "sales" && tx.type !== "Sale" && tx.type !== "Installment Advance") return false;
      if (categoryFilter === "qist" && tx.type !== "Installment Qist" && tx.type !== "Khata In") return false;
      if (categoryFilter === "expenses" && tx.type !== "Expense" && tx.type !== "Purchase") return false;
      if (categoryFilter === "investors" && tx.type !== "Investor In" && tx.type !== "Investor Out") return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          tx.description.toLowerCase().includes(q) ||
          tx.categoryBadge.toLowerCase().includes(q) ||
          tx.type.toLowerCase().includes(q) ||
          (tx.partyName && tx.partyName.toLowerCase().includes(q))
        );
      }
      return true;
    });

    // Display newest transactions first in the UI
    const reversedList = [...filteredList].reverse();

    return {
      transactions: reversedList,
      openingFloat,
      cashInTotal,
      cashOutTotal,
      cashInHand: currentBal
    };

  }, [
    activeTimeWindow,
    invoices,
    showroomVehicles,
    showroomInstallments,
    showroomSchedules,
    creditTransactions,
    expenses,
    showroomExpenses,
    purchaseOrders,
    showroomRentals,
    showroomInvestorTxs,
    showroomInvestors,
    cashAccounts,
    viewMode,
    categoryFilter,
    searchQuery
  ]);

  // View Invoice or Showroom detail popup
  const handleViewDetails = async (tx: DaybookTransaction) => {
    setSelectedTxDetail(tx);
    if (tx.sourceType === "pos_invoice") {
      setSelectedInvoiceId(tx.sourceId);
      setLoadingInvoiceDetails(true);
      try {
        const { data: invData, error: invErr } = await supabase
          .from("invoices")
          .select("*, parties(name, phone)")
          .eq("id", tx.sourceId)
          .single();

        if (invErr) throw invErr;
        setSelectedInvoice(invData);

        const { data: items, error: itemsErr } = await supabase
          .from("invoice_items")
          .select("*, products(name, unit)")
          .eq("invoice_id", tx.sourceId);

        if (itemsErr) throw itemsErr;

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
            productName: it.products?.name || "Product",
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
      doc.setTextColor(30, 41, 59);
      doc.text(shopName || "THE ACCOUNTS", 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("Official Rojnamcha / Daybook Cash Ledger", 15, 25);

      // Statement Metadata
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text("DAILY CASH BOOK", 130, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Generated: ${formatDateTime(new Date(), timezone)}`, 130, 25);
      doc.text(`${activeTimeWindow.label}`, 130, 30);

      doc.setDrawColor(226, 232, 240);
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
      doc.text(`Opening Balance (Float): Rs ${daybookData.openingFloat.toLocaleString()}`, 15, 47);
      doc.text(`Total Cash In (+): Rs ${daybookData.cashInTotal.toLocaleString()}`, 15, 52);
      doc.text(`Total Cash Out (-): Rs ${daybookData.cashOutTotal.toLocaleString()}`, 15, 57);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(79, 70, 229);
      doc.text(`Net Cash in Drawer / Hand: Rs ${daybookData.cashInHand.toLocaleString()}`, 15, 63);

      // Generate Table
      const headers = [["Time / Date", "Category", "Details / Remarks", "Cash In (+)", "Cash Out (-)", "Drawer Balance"]];
      
      const pdfTxList = [...daybookData.transactions].reverse();
      const tableRows = pdfTxList.map(t => [
        formatDateTime(t.time, timezone),
        t.categoryBadge,
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
          fillColor: [30, 41, 59],
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
          3: { halign: "right", fontStyle: "bold", textColor: [5, 150, 105] },
          4: { halign: "right", fontStyle: "bold", textColor: [220, 38, 38] },
          5: { halign: "right", fontStyle: "bold", textColor: [30, 41, 59] }
        },
        margin: { left: 15, right: 15 }
      });

      // Footer note
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`The Accounts POS & Showroom ERP - Page ${i} of ${pageCount}`, 15, 287);
      }

      const filename = `rojnamcha_daybook_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(filename);
      toast.success("PDF Daybook downloaded successfully!");
    } catch (err: any) {
      toast.error("Failed to generate PDF Daybook: " + err.message);
    }
  };

  return (
    <div className="space-y-3 font-sans text-slate-800">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2.5 pb-2.5 border-b border-slate-200/80">
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button 
            onClick={handleDownloadDaybookPDF}
            className="bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs h-8 px-3 rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer"
          >
            <Download size={13} /> PDF Daybook
          </Button>
          <Link href="/dashboard/showroom/sales">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-3 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1">
              <Car size={13} /> Showroom Desk
            </Button>
          </Link>
        </div>
      </div>

      {/* Mode Selector & Date Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex bg-white rounded-xl p-1 border border-slate-200/80 max-w-sm shrink-0 select-none shadow-2xs gap-1">
          <button
            onClick={() => setViewMode("daybook")}
            className={`py-1.5 px-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              viewMode === "daybook"
                ? "bg-slate-900 text-white shadow-2xs font-black"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Calendar size={13} />
            Daily Daybook
          </button>
          <button
            onClick={() => setViewMode("shift")}
            className={`py-1.5 px-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              viewMode === "shift"
                ? "bg-slate-900 text-white shadow-2xs font-black"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <User size={13} />
            Daybook Sessions
          </button>
        </div>

        {/* Date Filter Quick Presets */}
        {viewMode === "daybook" && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: "All Time" },
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "7days", label: "Last 7 Days" },
              { id: "month", label: "This Month" },
              { id: "single_date", label: "Specific Date" },
              { id: "custom_range", label: "Range" },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id as any)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                  datePreset === p.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { 
            label: "Opening Float / Forward", 
            val: `Rs ${Math.round(daybookData.openingFloat).toLocaleString()}`, 
            icon: FileText, 
            bg: "bg-slate-50 text-slate-700 border-slate-100",
            desc: "Starting cash balance"
          },
          { 
            label: "Cash Received (+)", 
            val: `Rs ${Math.round(daybookData.cashInTotal).toLocaleString()}`, 
            icon: ArrowDownLeft, 
            bg: "bg-emerald-50 text-emerald-700 border-emerald-100",
            desc: "Sales + Down Payments + Qists"
          },
          { 
            label: "Cash Paid (-)", 
            val: `Rs ${Math.round(daybookData.cashOutTotal).toLocaleString()}`, 
            icon: ArrowUpRight, 
            bg: "bg-rose-50 text-rose-700 border-rose-100",
            desc: "Purchases + Expenses + Payouts"
          },
          { 
            label: "Net Cash in Hand / Drawer", 
            val: `Rs ${Math.round(daybookData.cashInHand).toLocaleString()}`, 
            icon: DollarSign, 
            bg: "bg-indigo-50 text-indigo-700 border-indigo-100",
            desc: "Current drawer & cash balance"
          }
        ].map((stat, i) => (
          <div 
            key={i}
            className={`p-3 bg-white border rounded-2xl shadow-2xs flex items-center justify-between transition-all ${stat.bg}`}
          >
            <div>
              <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-base font-black mt-0.5 leading-none">{stat.val}</h3>
              <p className="text-[8.5px] text-slate-400 mt-1 font-semibold">{stat.desc}</p>
            </div>
            <div className="p-2 rounded-xl bg-white shadow-2xs border border-slate-100 shrink-0">
              <stat.icon className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Advanced Filter Panel */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-indigo-600" />
            <h4 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider">
              {activeTimeWindow?.label || "Daybook Filters"}
            </h4>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto text-[10px]">
            {[
              { id: "all", label: "All Types" },
              { id: "inflow", label: "Cash In (+)" },
              { id: "outflow", label: "Cash Out (-)" },
              { id: "sales", label: "Sales & Advance" },
              { id: "qist", label: "Qist & Wasooli" },
              { id: "expenses", label: "Expenses" },
              { id: "investors", label: "Investors" },
            ].map(c => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                  categoryFilter === c.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Date Picker (Single Date) */}
          {viewMode === "daybook" && datePreset === "single_date" && (
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Select Daybook Date</label>
              <Input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg shadow-2xs"
              />
            </div>
          )}

          {/* Date Picker (Custom Range) */}
          {viewMode === "daybook" && datePreset === "custom_range" && (
            <div className="flex items-center gap-2 col-span-1 md:col-span-2">
              <div className="flex-1">
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
                <Input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg shadow-2xs"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">End Date</label>
                <Input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg shadow-2xs"
                />
              </div>
            </div>
          )}

          {/* Shift Session Selector */}
          {viewMode === "shift" && (
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Select Daybook Session</label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="w-full h-8 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer shadow-2xs"
              >
                {sessions.length === 0 ? (
                  <option value="all">No sessions logged</option>
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
          <div className="col-span-1 md:col-span-2">
            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Search Details / Vehicle / Customer / Remarks</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input 
                placeholder="Search transaction description, customer, vehicle make/plate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 rounded-lg shadow-2xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Daybook Transaction Ledger table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden font-sans">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mb-1.5 text-indigo-500" />
            <div className="text-xs font-semibold">Loading unified daybook ledger...</div>
          </div>
        ) : daybookData.transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-medium space-y-2">
            <p>No transactions recorded in the Daybook for this period.</p>
            {datePreset !== "all" && (
              <Button
                onClick={() => setDatePreset("all")}
                variant="outline"
                size="sm"
                className="h-7 text-xs font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              >
                View All Time Transactions
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] text-slate-700 font-extrabold uppercase tracking-wider bg-slate-100 select-none">
                  <th className="py-2.5 px-3">Time & Date</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Transaction Details / Remarks</th>
                  <th className="py-2.5 px-3 text-right font-black text-emerald-700">Cash In (+)</th>
                  <th className="py-2.5 px-3 text-right font-black text-rose-700">Cash Out (-)</th>
                  <th className="py-2.5 px-3 text-right font-black text-slate-900">Drawer Balance</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {/* Prepend opening balance forward row */}
                <tr className="bg-slate-50/70 text-[11px] font-bold text-slate-500 border-b border-dashed border-slate-200">
                  <td className="py-1.5 px-3 font-mono">
                    {activeTimeWindow?.isAllTime ? "START" : "OPENING"}
                  </td>
                  <td className="py-1.5 px-3">
                    <div className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      FLOAT
                    </div>
                  </td>
                  <td className="py-1.5 px-3 font-semibold text-slate-600">Starting Cash Balance Brought Forward</td>
                  <td className="py-1.5 px-3 text-right text-emerald-600 font-mono">Rs {daybookData.openingFloat.toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-right font-mono">-</td>
                  <td className="py-1.5 px-3 text-right font-black text-slate-800 font-mono">Rs {daybookData.openingFloat.toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-center font-mono">-</td>
                </tr>

                {daybookData.transactions.map((tx) => {
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors font-medium text-slate-700">
                      <td className="py-1.5 px-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        {formatDateTime(tx.time, timezone)}
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <div className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase border ${
                          tx.type === "Sale" || tx.type === "Installment Advance"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : tx.type === "Installment Qist" || tx.type === "Khata In"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : tx.type === "Khata Out" || tx.type === "Rental"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : tx.type === "Purchase" || tx.type === "Investor Out"
                                  ? "bg-violet-50 text-violet-700 border-violet-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {tx.categoryBadge}
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-slate-700 font-semibold max-w-[320px] truncate text-xs" title={tx.description}>
                        {tx.description}
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold text-emerald-600 font-mono">
                        {tx.cashIn > 0 ? `Rs ${tx.cashIn.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold text-rose-600 font-mono">
                        {tx.cashOut > 0 ? `Rs ${tx.cashOut.toLocaleString()}` : "-"}
                      </td>
                      <td className="py-1.5 px-3 text-right font-extrabold text-slate-900 font-mono">
                        Rs {tx.runningBalance.toLocaleString()}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <button
                          onClick={() => handleViewDetails(tx)}
                          className="p-1 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-md transition-all border border-slate-200 shadow-2xs cursor-pointer"
                          title="View transaction breakdown"
                        >
                          <Eye size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: POS Invoice or Showroom Transaction Details Popup */}
      <AnimatePresence>
        {selectedTxDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg relative z-10 border border-slate-200"
            >
              <button 
                onClick={() => { setSelectedTxDetail(null); setSelectedInvoiceId(null); }} 
                className="absolute top-4.5 right-4.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Transaction Breakdown</h3>
                  <p className="text-[10px] text-slate-400">
                    {formatDateTime(selectedTxDetail.time, timezone)} • Category: {selectedTxDetail.categoryBadge}
                  </p>
                </div>
              </div>

              {/* Showroom Vehicle / Installment Detail View */}
              {selectedTxDetail.sourceType !== "pos_invoice" && (
                <div className="mt-4 space-y-3 font-sans text-xs">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                    <div>
                      <div className="text-slate-400 font-bold text-[9px] uppercase">Details</div>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedTxDetail.description}</p>
                    </div>
                    {selectedTxDetail.partyName && (
                      <div>
                        <div className="text-slate-400 font-bold text-[9px] uppercase">Customer / Party</div>
                        <p className="font-bold text-slate-700">{selectedTxDetail.partyName}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                    <div>
                      <div className="text-indigo-600 font-bold text-[9px] uppercase">Cash Flow</div>
                      <p className="font-black text-sm text-indigo-900">
                        {selectedTxDetail.cashIn > 0 ? `+ Rs ${selectedTxDetail.cashIn.toLocaleString()} (IN)` : `- Rs ${selectedTxDetail.cashOut.toLocaleString()} (OUT)`}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-500 font-bold text-[9px] uppercase">Drawer Running Balance</div>
                      <p className="font-black text-sm text-slate-900">Rs {selectedTxDetail.runningBalance.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button 
                      onClick={() => setSelectedTxDetail(null)} 
                      className="bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs h-8 px-4 rounded-xl"
                    >
                      Close Details
                    </Button>
                  </div>
                </div>
              )}

              {/* POS Invoice Receipt View */}
              {selectedTxDetail.sourceType === "pos_invoice" && (
                loadingInvoiceDetails ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mb-2 text-indigo-500" />
                    <div className="text-xs font-semibold font-sans">Loading receipt items...</div>
                  </div>
                ) : selectedInvoice ? (
                  <div className="space-y-4 font-sans text-xs mt-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-wrap gap-x-6 gap-y-1 justify-between">
                      <div>
                        <div className="text-slate-400 font-bold text-[9px] uppercase">Customer Account</div>
                        <p className="font-bold text-slate-800 capitalize mt-0.5">{selectedInvoice.parties?.name || "Walk-in Customer"}</p>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold text-[9px] uppercase">Payment Mode</div>
                        <p className="font-bold text-slate-800 uppercase mt-0.5">{selectedInvoice.payment_mode}</p>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold text-[9px] uppercase">Payment Status</div>
                        <div className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase mt-0.5 ${
                          selectedInvoice.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>{selectedInvoice.status}</div>
                      </div>
                    </div>

                    {/* Items list */}
                    <div>
                      <div className="text-slate-400 font-bold text-[9px] uppercase block mb-1.5">Items Purchased</div>
                      <div className="max-h-[180px] overflow-y-auto border border-slate-100 rounded-xl">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="border-b border-slate-200 font-extrabold text-slate-700 bg-slate-100 uppercase text-[10px] tracking-wider sticky top-0 select-none">
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
                                  {item.variantName && <div className="text-[9px] text-indigo-600">Packing: {item.variantName}</div>}
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
                    <div className="border-t border-slate-100 pt-3 space-y-1 font-semibold text-slate-600 text-right">
                      <p className="font-black text-slate-900">Grand Total: Rs {Math.round(selectedInvoice.total_amount).toLocaleString()}</p>
                      <p className="text-emerald-600 font-bold">Cash Received: Rs {Math.round(selectedInvoice.paid_amount).toLocaleString()}</p>
                      {selectedInvoice.total_amount - selectedInvoice.paid_amount > 0 && (
                        <p className="text-amber-600 font-bold">Udhaar Added to Khata: Rs {Math.round(selectedInvoice.total_amount - selectedInvoice.paid_amount).toLocaleString()}</p>
                      )}
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button 
                        onClick={() => setSelectedTxDetail(null)} 
                        className="bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs h-8 px-4 rounded-xl cursor-pointer"
                      >
                        Close Receipt
                      </Button>
                    </div>
                  </div>
                ) : null
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
