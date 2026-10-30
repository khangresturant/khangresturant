"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car,
  Banknote,
  CreditCard,
  TrendingUp,
  Users,
  Calendar,
  Download,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  PieChart,
  FileSpreadsheet,
  FileText,
  Loader2,
  Share2,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Sparkles,
  LayoutDashboard,
  Layers,
  ChevronRight,
  Building,
  RefreshCcw,
  Scale,
  BookOpen,
  Wallet,
  ArrowRightLeft,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
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
  formatInvestorShareBadge,
  calculateInvestorProfitShare,
  loadShowroomOfflineEntities,
  isShowroomOffline,
} from "@/lib/showroom-ops";
import { ShowroomOfflineBar } from "@/components/showroom/ShowroomOfflineBar";
import {
  fetchShowroomSubLedgerBalances,
  fetchShowroomProductFlow,
  syncHistoricalShowroomJournals,
  type ShowroomSubLedgerBalances,
} from "@/lib/showroom-accounting";
import { ShowroomCapitalFloatWizard } from "@/components/showroom/ShowroomCapitalFloatWizard";
import { Landmark } from "lucide-react";

type ReportTab = "valuation" | "sales_pl" | "installments" | "dealers_khata" | "rentals" | "investors" | "accounting_gl";

export default function ShowroomReportsPage() {
  const { shopId, shopName, timezone } = useShop();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<ReportTab>("valuation");
  const [loading, setLoading] = useState(true);

  // Date Range Filters
  const [datePreset, setDatePreset] = useState<"all" | "today" | "7days" | "month" | "last_month" | "year" | "custom">("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Search & Type Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "car" | "bike" | "commercial">("all");

  // Raw Database Data States
  const [vehicles, setVehicles] = useState<ShowroomVehicle[]>([]);
  const [installments, setInstallments] = useState<ShowroomInstallment[]>([]);
  const [schedules, setSchedules] = useState<ShowroomInstallmentSchedule[]>([]);
  const [parties, setParties] = useState<ShowroomParty[]>([]);
  const [rentals, setRentals] = useState<ShowroomRental[]>([]);
  const [investors, setInvestors] = useState<ShowroomInvestor[]>([]);
  const [transactions, setTransactions] = useState<ShowroomInvestorTx[]>([]);

  // Showroom Double-Entry Accounting & Sub-Ledger States
  const [accountingSubTab, setAccountingSubTab] = useState<"trial" | "balance_sheet" | "money_flow" | "product_flow">("trial");
  const [subledgerBalances, setSubledgerBalances] = useState<ShowroomSubLedgerBalances>({
    receivables: 0,
    payables: 0,
    inventoryValue: 0,
    cashInHand: 0,
    totalVehiclesInStock: 0,
    totalActiveInstallments: 0,
    totalReceivables: 0,
    totalPayables: 0,
    vehicleStockValue: 0,
    availableVehicleCount: 0,
    receivablesBreakdown: { installmentsRemaining: 0, partiesReceivable: 0, total: 0 },
    payablesBreakdown: { vehiclePurchaseRemaining: 0, dealersPayable: 0, total: 0 },
  });
  const [glLoading, setGlLoading] = useState(false);
  const [syncingJournals, setSyncingJournals] = useState(false);
  const [isCapitalFloatOpen, setIsCapitalFloatOpen] = useState(false);
  const [currentCashBalance, setCurrentCashBalance] = useState<number>(0);
  const [showroomAccountsSummary, setShowroomAccountsSummary] = useState<Record<string, any>>({});
  const [showroomMoneyFlow, setShowroomMoneyFlow] = useState<any[]>([]);
  const [showroomProductFlow, setShowroomProductFlow] = useState<any[]>([]);

  // Load all showroom data
  const fetchReportData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      if (isShowroomOffline()) {
        const [offVeh, offInst, offSched, offPart, offRent, offInv, offTx] = await Promise.all([
          loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId),
          loadShowroomOfflineEntities<ShowroomInstallment>("showroom_installments", shopId),
          loadShowroomOfflineEntities<ShowroomInstallmentSchedule>("showroom_installment_schedules", shopId),
          loadShowroomOfflineEntities<ShowroomParty>("showroom_parties", shopId),
          loadShowroomOfflineEntities<ShowroomRental>("showroom_rentals", shopId),
          loadShowroomOfflineEntities<ShowroomInvestor>("showroom_investors", shopId),
          loadShowroomOfflineEntities<ShowroomInvestorTx>("showroom_investor_transactions", shopId),
        ]);
        setVehicles(offVeh);
        setInstallments(offInst);
        setSchedules(offSched);
        setParties(offPart);
        setRentals(offRent);
        setInvestors(offInv);
        setTransactions(offTx);
        setLoading(false);
        return;
      }

      const [vRes, iRes, sRes, pRes, rRes, invRes, txRes] = await Promise.all([
        supabase
          .from("showroom_vehicles")
          .select("*, purchase_party:showroom_parties!purchase_party_id(*), buyer_party:showroom_parties!buyer_party_id(*)")
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false }),
        supabase
          .from("showroom_installments")
          .select("*, showroom_vehicles(*)")
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false }),
        supabase
          .from("showroom_installment_schedules")
          .select("*, showroom_installments(*)")
          .eq("shop_id", shopId)
          .order("due_date", { ascending: true }),
        supabase
          .from("showroom_parties")
          .select("*")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),
        supabase
          .from("showroom_rentals")
          .select("*, showroom_vehicles(*)")
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false }),
        supabase
          .from("showroom_investors")
          .select("*")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),
        supabase
          .from("showroom_investor_transactions")
          .select("*, investor:showroom_investors(*), vehicle:showroom_vehicles(*)")
          .eq("shop_id", shopId)
          .order("date", { ascending: false }),
      ]);

      if (vRes.data) {
        setVehicles(vRes.data as ShowroomVehicle[]);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_vehicles", (vRes.data as any[]).map((r: any) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
      if (iRes.data) {
        setInstallments(iRes.data as ShowroomInstallment[]);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_installments", (iRes.data as any[]).map((r: any) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
      if (sRes.data) {
        setSchedules(sRes.data as ShowroomInstallmentSchedule[]);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_installment_schedules", (sRes.data as any[]).map((r: any) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
      if (pRes.data) {
        setParties(pRes.data as ShowroomParty[]);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_parties", (pRes.data as any[]).map((r: any) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
      if (rRes.data) {
        setRentals(rRes.data as ShowroomRental[]);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_rentals", (rRes.data as any[]).map((r: any) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
      if (invRes.data) {
        setInvestors((invRes.data as ShowroomInvestor[]) || []);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_investors", (invRes.data as any[]).map((r: any) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
      if (txRes.data) {
        setTransactions((txRes.data as ShowroomInvestorTx[]) || []);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_investor_transactions", (txRes.data as any[]).map((r: any) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
    } catch (err: any) {
      try {
        const [offVeh, offInst, offSched, offPart, offRent, offInv, offTx] = await Promise.all([
          loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId),
          loadShowroomOfflineEntities<ShowroomInstallment>("showroom_installments", shopId),
          loadShowroomOfflineEntities<ShowroomInstallmentSchedule>("showroom_installment_schedules", shopId),
          loadShowroomOfflineEntities<ShowroomParty>("showroom_parties", shopId),
          loadShowroomOfflineEntities<ShowroomRental>("showroom_rentals", shopId),
          loadShowroomOfflineEntities<ShowroomInvestor>("showroom_investors", shopId),
          loadShowroomOfflineEntities<ShowroomInvestorTx>("showroom_investor_transactions", shopId),
        ]);
        if (offVeh.length > 0 || offInst.length > 0) {
          setVehicles(offVeh);
          setInstallments(offInst);
          setSchedules(offSched);
          setParties(offPart);
          setRentals(offRent);
          setInvestors(offInv);
          setTransactions(offTx);
        } else {
          toast.error("Failed to load showroom reporting data: " + err.message);
        }
      } catch {
        toast.error("Failed to load showroom reporting data: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load Showroom Double-Entry Accounting & Sub-Ledger Sync
  const fetchShowroomAccountingData = async () => {
    if (!shopId) return;
    setGlLoading(true);
    try {
      // 1. Fetch live sub-ledger balances (syncs Parties Rs 958k receivables & Rs 288k payables, plus vehicle stock)
      const subledger = await fetchShowroomSubLedgerBalances(supabase, shopId);
      setSubledgerBalances(subledger);

      // 2. Fetch journal entries for this showroom
      let jQuery = supabase
        .from("journal_entries")
        .select(`
          id, entry_date, narration, ref_type, ref_id,
          journal_lines ( id, account_code, account_name, debit, credit )
        `)
        .eq("shop_id", shopId)
        .order("entry_date", { ascending: true });

      if (startDate) jQuery = jQuery.gte("entry_date", startDate);
      if (endDate) jQuery = jQuery.lte("entry_date", endDate);

      const { data: jData } = await jQuery;
      const entries = jData || [];

      // 3. Summarize accounts with double-entry rules
      const summary: Record<string, any> = {
        "1001": { code: "1001", name: "Cash in Hand & Bank Accounts", debit: 0, credit: 0, balance: 0, type: "Asset" },
        "1002": { code: "1002", name: "Accounts Receivable (Showroom Installments)", debit: 0, credit: 0, balance: 0, type: "Asset" },
        "1003": { code: "1003", name: "Vehicle Stock / Inventory Asset", debit: 0, credit: 0, balance: 0, type: "Asset" },
        "2001": { code: "2001", name: "Accounts Payable (Vehicle Sellers / Dealers)", debit: 0, credit: 0, balance: 0, type: "Liability" },
        "3100": { code: "3100", name: "Owner's Capital Account", debit: 0, credit: 0, balance: 0, type: "Equity" },
        "3300": { code: "3300", name: "Retained Earnings & Reserves", debit: 0, credit: 0, balance: 0, type: "Equity" },
        "4001": { code: "4001", name: "Vehicle Sales Revenue", debit: 0, credit: 0, balance: 0, type: "Revenue" },
        "5001": { code: "5001", name: "Cost of Goods Sold (Vehicles)", debit: 0, credit: 0, balance: 0, type: "Expense" },
      };

      const mFlow: any[] = [];
      let runningCash = 0;

      entries.forEach((e: any) => {
        (e.journal_lines || []).forEach((line: any) => {
          const code = line.account_code;
          const db = Number(line.debit || 0);
          const cr = Number(line.credit || 0);

          if (!summary[code]) {
            summary[code] = {
              code,
              name: line.account_name || `Account ${code}`,
              debit: 0,
              credit: 0,
              balance: 0,
              type: code.startsWith("1") ? "Asset" : code.startsWith("2") ? "Liability" : code.startsWith("3") ? "Equity" : code.startsWith("4") ? "Revenue" : "Expense",
            };
          }

          summary[code].debit += db;
          summary[code].credit += cr;

          if (code === "1001") {
            runningCash += (db - cr);
            mFlow.push({
              id: line.id,
              date: e.entry_date,
              narration: e.narration,
              ref_type: e.ref_type,
              debit: db,
              credit: cr,
              balance: runningCash,
            });
          }
        });
      });

      // Calculate net balances based on natural account types:
      // Assets & Expenses: debit - credit (natural debit)
      // Liabilities, Equity, Revenue: credit - debit (natural credit)
      Object.keys(summary).forEach((code) => {
        const acc = summary[code];
        if (acc.type === "Asset" || acc.type === "Expense") {
          acc.balance = acc.debit - acc.credit;
        } else {
          acc.balance = acc.credit - acc.debit;
        }
      });

      // Dynamic Retained Earnings from Revenue (4000) - Cost of Goods Sold / Expenses (5000)
      const dynamicRev = Number(summary["4001"]?.balance || 0);
      const dynamicCogs = Number(summary["5001"]?.balance || 0);
      const dynamicProfit = dynamicRev - dynamicCogs;
      if (summary["3300"].debit === 0 && summary["3300"].credit === 0) {
        if (dynamicProfit >= 0) {
          summary["3300"].credit = dynamicProfit;
          summary["3300"].balance = dynamicProfit;
        } else {
          summary["3300"].debit = Math.abs(dynamicProfit);
          summary["3300"].balance = dynamicProfit;
        }
      }

      // Sub-Ledger auto-sync: if no journal lines posted yet, reflect sub-ledger balances directly
      if (summary["1002"].debit === 0 && subledger.receivables > 0) {
        summary["1002"].debit = subledger.receivables;
        summary["1002"].balance = subledger.receivables;
      }
      if (summary["2001"].credit === 0 && subledger.payables > 0) {
        summary["2001"].credit = subledger.payables;
        summary["2001"].balance = subledger.payables;
      }
      if (summary["1003"].balance === 0 && subledger.inventoryValue > 0) {
        summary["1003"].debit = subledger.inventoryValue;
        summary["1003"].balance = subledger.inventoryValue;
      }

      setShowroomAccountsSummary(summary);
      setCurrentCashBalance(summary["1001"].balance);
      setShowroomMoneyFlow(mFlow.reverse());

      // 4. Fetch vehicle product flow (stock cardex)
      const pFlow = await fetchShowroomProductFlow(supabase, shopId, startDate, endDate);
      setShowroomProductFlow(pFlow);
    } catch (err: any) {
      console.error("fetchShowroomAccountingData error:", err);
      toast.error("Failed to load Showroom GL data: " + err.message);
    } finally {
      setGlLoading(false);
    }
  };

  const handleSyncHistoricalJournals = async () => {
    if (!shopId) return;
    setSyncingJournals(true);
    try {
      const res = await syncHistoricalShowroomJournals(supabase, shopId);
      toast.success(`Historical Showroom Journals Synced! Created: ${res.created}, Already Present: ${res.skipped}`);
      await fetchShowroomAccountingData();
      await fetchReportData();
    } catch (err: any) {
      console.error("Historical sync error:", err);
      toast.error("Failed to sync historical showroom journals: " + err.message);
    } finally {
      setSyncingJournals(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [shopId]);

  useEffect(() => {
    if (activeTab === "accounting_gl") {
      fetchShowroomAccountingData();
    }
  }, [shopId, startDate, endDate, activeTab]);

  const glTrialTotals = useMemo(() => {
    let debits = 0;
    let credits = 0;
    Object.values(showroomAccountsSummary).forEach((acc: any) => {
      debits += Number(acc.debit || 0);
      credits += Number(acc.credit || 0);
    });
    const isBalanced = Math.abs(debits - credits) < 0.01;
    const diff = Math.abs(debits - credits);
    return { debits, credits, isBalanced, diff };
  }, [showroomAccountsSummary]);

  const glBalanceSheet = useMemo(() => {
    const assetsList: any[] = [];
    const liabilitiesList: any[] = [];
    const equityList: any[] = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    let revenue = 0;
    let cogs = 0;

    Object.values(showroomAccountsSummary).forEach((acc: any) => {
      if (acc.type === "Asset") {
        assetsList.push(acc);
        totalAssets += Number(acc.balance || 0);
      } else if (acc.type === "Liability") {
        liabilitiesList.push(acc);
        totalLiabilities += Number(acc.balance || 0);
      } else if (acc.type === "Equity") {
        equityList.push(acc);
        totalEquity += Number(acc.balance || 0);
      } else if (acc.type === "Revenue") {
        revenue += Number(acc.balance || 0);
      } else if (acc.type === "Expense") {
        cogs += Number(acc.balance || 0);
      }
    });

    const netProfit = revenue - cogs;
    const hasRetainedEarningsInEquity = equityList.some((e: any) => e.code === "3300" && Number(e.balance || 0) !== 0);
    const currentPLToAppend = hasRetainedEarningsInEquity ? 0 : netProfit;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + currentPLToAppend;
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;
    const diff = Math.abs(totalAssets - totalLiabilitiesAndEquity);

    return {
      assetsList,
      liabilitiesList,
      equityList,
      totalAssets,
      totalLiabilities,
      totalEquity: totalEquity + currentPLToAppend,
      revenue,
      cogs,
      netProfit,
      totalLiabilitiesAndEquity,
      isBalanced,
      diff,
    };
  }, [showroomAccountsSummary]);

  // Handle Preset Changes
  const handlePresetChange = (preset: typeof datePreset) => {
    setDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "7days") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (preset === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (preset === "last_month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(lastDay.toISOString().split("T")[0]);
    } else if (preset === "year") {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (preset === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  // Helper date filter
  const isWithinDateRange = (dateStr?: string | null) => {
    if (!dateStr || (!startDate && !endDate)) return true;
    const d = new Date(dateStr).toISOString().split("T")[0];
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  // === CALCULATIONS & METRICS ===

  // 1. Stock Valuation Metrics
  const availableVehicles = useMemo(
    () => vehicles.filter((v) => v.status === "available"),
    [vehicles]
  );
  const totalCostValuation = useMemo(
    () => availableVehicles.reduce((sum, v) => sum + Number(v.purchase_cost || 0), 0),
    [availableVehicles]
  );
  const totalExpectedCashRevenue = useMemo(
    () => availableVehicles.reduce((sum, v) => sum + Number(v.cash_price || v.price || 0), 0),
    [availableVehicles]
  );
  const totalExpectedInstallmentRevenue = useMemo(
    () =>
      availableVehicles.reduce(
        (sum, v) => sum + Number(v.installment_price || v.cash_price || v.price || 0),
        0
      ),
    [availableVehicles]
  );
  const totalUnrealizedProfit = totalExpectedCashRevenue - totalCostValuation;

  // 2. Sales & Realized Profit/Loss
  const soldVehicles = useMemo(() => {
    return vehicles
      .filter((v) => v.status === "sold" || v.status === "installment_active")
      .filter((v) => isWithinDateRange(v.sold_at || v.created_at))
      .filter((v) => {
        if (typeFilter !== "all" && v.vehicle_type !== typeFilter) return false;
        const q = searchQuery.toLowerCase();
        if (!q) return true;
        return (
          vehicleLabel(v).toLowerCase().includes(q) ||
          (v.plate_number || "").toLowerCase().includes(q) ||
          (v.chassis_number || "").toLowerCase().includes(q) ||
          (v.buyer_name || "").toLowerCase().includes(q)
        );
      });
  }, [vehicles, startDate, endDate, typeFilter, searchQuery]);

  const totalRealizedSalesRevenue = useMemo(
    () => soldVehicles.reduce((sum, v) => sum + Number(v.sold_price || v.cash_price || v.price || 0), 0),
    [soldVehicles]
  );
  const totalRealizedSourcingCost = useMemo(
    () => soldVehicles.reduce((sum, v) => sum + Number(v.purchase_cost || 0), 0),
    [soldVehicles]
  );
  const totalRealizedGrossProfit = totalRealizedSalesRevenue - totalRealizedSourcingCost;
  const overallProfitMarginPct =
    totalRealizedSalesRevenue > 0
      ? ((totalRealizedGrossProfit / totalRealizedSalesRevenue) * 100).toFixed(1)
      : "0.0";

  // 3. Installments Portfolio & Recovery Performance
  const activeInstallments = useMemo(
    () => installments.filter((i) => i.status === "active" || i.status === "overdue"),
    [installments]
  );
  const totalInstallmentPortfolio = useMemo(
    () => installments.reduce((sum, i) => sum + Number(i.total_price || 0), 0),
    [installments]
  );
  const totalInstallmentCollected = useMemo(
    () => installments.reduce((sum, i) => sum + Number(i.total_paid || 0), 0),
    [installments]
  );
  const totalInstallmentPending = totalInstallmentPortfolio - totalInstallmentCollected;

  const nowStr = new Date().toISOString().split("T")[0];
  const overdueSchedules = useMemo(() => {
    return schedules.filter(
      (s) => s.status !== "paid" && s.due_date < nowStr
    );
  }, [schedules, nowStr]);

  const totalOverdueAmount = useMemo(
    () =>
      overdueSchedules.reduce(
        (sum, s) => sum + Math.max(0, Number(s.due_amount) - Number(s.paid_amount || 0)),
        0
      ),
    [overdueSchedules]
  );

  // 4. Dealer & Customer Khata Balances
  const totalKhataReceivables = useMemo(
    () =>
      parties
        .filter((p) => Number(p.current_balance || 0) > 0)
        .reduce((sum, p) => sum + Number(p.current_balance), 0),
    [parties]
  );
  const totalKhataPayables = useMemo(
    () =>
      parties
        .filter((p) => Number(p.current_balance || 0) < 0)
        .reduce((sum, p) => sum + Math.abs(Number(p.current_balance)), 0),
    [parties]
  );

  // 5. Rental Performance
  const filteredRentals = useMemo(() => {
    return rentals.filter((r) => isWithinDateRange(r.start_date || r.created_at));
  }, [rentals, startDate, endDate]);

  const totalRentalRevenue = useMemo(
    () =>
      filteredRentals.reduce(
        (sum, r) => sum + Number(r.daily_rate || 0) + Number(r.late_fee_per_day || 0),
        0
      ),
    [filteredRentals]
  );

  // Export CSV Function
  const handleExportCSV = () => {
    let rows: string[][] = [];
    let filename = `showroom_${activeTab}_report.csv`;

    if (activeTab === "valuation") {
      rows.push(["Make", "Model", "Year", "Type", "Plate / Reg", "Chassis No", "Engine No", "Cost Price", "Cash Price", "Installment Price", "Estimated Margin"]);
      availableVehicles.forEach((v) => {
        const cost = Number(v.purchase_cost || 0);
        const cash = Number(v.cash_price || v.price || 0);
        const margin = cash - cost;
        rows.push([
          v.make,
          v.model,
          String(v.year || ""),
          v.vehicle_type || "car",
          v.is_applied_for ? "Applied For" : v.plate_number || "",
          v.chassis_number || "",
          v.engine_number || "",
          String(cost),
          String(cash),
          String(v.installment_price || 0),
          String(margin),
        ]);
      });
    } else if (activeTab === "sales_pl") {
      rows.push(["Sale Date", "Vehicle", "Buyer Name", "Buyer Phone", "Sourcing Cost", "Sold Price", "Net Profit", "Margin %"]);
      soldVehicles.forEach((v) => {
        const cost = Number(v.purchase_cost || 0);
        const price = Number(v.sold_price || v.cash_price || v.price || 0);
        const profit = price - cost;
        const marginPct = price > 0 ? ((profit / price) * 100).toFixed(1) : "0";
        rows.push([
          v.sold_at ? new Date(v.sold_at).toLocaleDateString() : "—",
          vehicleLabel(v),
          v.buyer_name || "Cash Buyer",
          v.buyer_phone || "",
          String(cost),
          String(price),
          String(profit),
          `${marginPct}%`,
        ]);
      });
    } else if (activeTab === "installments") {
      rows.push(["Agreement No", "Customer Name", "Phone", "Vehicle", "Total Price", "Down Payment", "Total Paid", "Remaining Balance", "Status"]);
      installments.forEach((i) => {
        rows.push([
          i.agreement_number || i.id.slice(0, 8),
          i.customer_name,
          i.customer_phone || "",
          i.showroom_vehicles ? vehicleLabel(i.showroom_vehicles) : "Vehicle",
          String(i.total_price || 0),
          String(i.down_payment || 0),
          String(i.total_paid || 0),
          String(i.remaining_balance || 0),
          i.status,
        ]);
      });
    } else if (activeTab === "dealers_khata") {
      rows.push(["Party Name", "Type", "Phone", "CNIC", "City", "Current Balance (Rs)"]);
      parties.forEach((p) => {
        rows.push([
          p.name,
          p.party_type,
          p.phone || "",
          p.cnic || "",
          p.city || "",
          String(p.current_balance || 0),
        ]);
      });
    } else if (activeTab === "investors") {
      rows.push(["Investor Name", "Phone", "CNIC", "City", "Sharing Model", "Total Invested (Rs)", "Profit Earned (Rs)", "Total Withdrawn (Rs)", "Current Balance (Rs)"]);
      investors.forEach((inv) => {
        rows.push([
          inv.name,
          inv.phone || "",
          inv.cnic || "",
          inv.city || "",
          formatInvestorShareBadge(inv.default_share_type, inv.default_share_value),
          String(inv.total_invested || 0),
          String(inv.total_profit_earned || 0),
          String(inv.total_withdrawn || 0),
          String(inv.current_balance || 0),
        ]);
      });
    }

    if (rows.length <= 1) {
      toast.info("No data available to export.");
      return;
    }

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Report downloaded successfully!");
  };

  // Printable Report Trigger
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 font-sans animate-in fade-in duration-500 pb-16">
      <ShowroomOfflineBar onSyncSuccess={fetchReportData} />

      {/* Top Header (Print Hidden Header) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-violet-600 text-white rounded-2xl shadow-sm">
              <PieChart size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                <span>Showroom Reports & Analytics</span>
                <span className="font-urdu text-base text-violet-800 font-bold">(شوروم بزنس و مالیاتی رپورٹس)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Comprehensive valuation, profit/loss audit, installment recoveries, dealer khatas, and rental insights.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={fetchReportData}
            variant="outline"
            size="sm"
            className="font-bold text-xs border-slate-200 h-9 rounded-xl gap-1.5"
          >
            <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </Button>

          <Button
            onClick={handleExportCSV}
            variant="outline"
            size="sm"
            className="font-bold text-xs border-slate-200 h-9 rounded-xl gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          >
            <FileSpreadsheet size={14} />
            <span>Export CSV</span>
          </Button>

          <Button
            onClick={handlePrintReport}
            size="sm"
            className="bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs h-9 rounded-xl shadow-sm gap-1.5"
          >
            <Printer size={14} />
            <span>Print Report (پرنٹ)</span>
          </Button>
        </div>
      </div>

      {/* Print Document Header (Visible only on print) */}
      <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-6">
        <h1 className="text-2xl font-black text-slate-950 uppercase">{shopName || "Showroom Auto Sales"}</h1>
        <p className="text-sm font-bold text-slate-700 font-urdu mt-1">شوروم فنانشل و انوینٹری رپورٹ — {new Date().toLocaleDateString()}</p>
      </div>

      {/* Showroom Financial Executive KPIs Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Stock Valuation */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10.5px] uppercase font-bold">Available Stock (انوینٹری لاگت)</span>
            <Car size={16} className="text-violet-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900">{formatPKR(totalCostValuation)}</p>
          <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
            {availableVehicles.length} Vehicles • Worth: {formatPKR(totalExpectedCashRevenue)}
          </p>
        </div>

        {/* Realized Gross Profit */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10.5px] uppercase font-bold">Realized Net Profit (خالص منافع)</span>
            <TrendingUp size={16} className="text-emerald-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-emerald-600">{formatPKR(totalRealizedGrossProfit)}</p>
          <p className="text-[10px] text-slate-500 font-bold mt-0.5">
            Sales: {formatPKR(totalRealizedSalesRevenue)} ({overallProfitMarginPct}% Margin)
          </p>
        </div>

        {/* Installment Recovery Portfolio */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10.5px] uppercase font-bold">Installment Portfolio (قسطوں کا حجم)</span>
            <CreditCard size={16} className="text-sky-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900">{formatPKR(totalInstallmentPending)}</p>
          <p className="text-[10px] text-slate-500 font-bold mt-0.5">
            Collected: {formatPKR(totalInstallmentCollected)} of {formatPKR(totalInstallmentPortfolio)}
          </p>
        </div>

        {/* Overdue / Late Qist Alerts */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10.5px] uppercase font-bold">Overdue / Defaulters (لیٹ اقساط)</span>
            <ShieldAlert size={16} className="text-rose-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-rose-600">{formatPKR(totalOverdueAmount)}</p>
          <p className="text-[10px] text-rose-500 font-bold mt-0.5">
            {overdueSchedules.length} Late Schedules Pending Recovery
          </p>
        </div>
      </div>

      {/* Filter & Date Selection Bar (Print Hidden) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-3 print:hidden">
        {/* Preset Date Range Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/70">
            <button
              onClick={() => handlePresetChange("all")}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition ${
                datePreset === "all" ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => handlePresetChange("today")}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition ${
                datePreset === "today" ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handlePresetChange("7days")}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition ${
                datePreset === "7days" ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => handlePresetChange("month")}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition ${
                datePreset === "month" ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => handlePresetChange("last_month")}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition ${
                datePreset === "last_month" ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => handlePresetChange("year")}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition ${
                datePreset === "year" ? "bg-white text-slate-900 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              This Year
            </button>
          </div>

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold text-[10px]">From:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("custom");
                }}
                className="h-8.5 text-xs rounded-xl w-34 bg-slate-50"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold text-[10px]">To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("custom");
                }}
                className="h-8.5 text-xs rounded-xl w-34 bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* Secondary Search & Type Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports by vehicle, plate #, chassis, customer / dealer name..."
              className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e: any) => setTypeFilter(e.target.value)}
              className="h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">🚗 All Types</option>
              <option value="car">Cars (کاریں)</option>
              <option value="bike">Bikes (موٹرسائیکل)</option>
              <option value="commercial">Commercial (کمرشل)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Report Navigation Tabs */}
      <div className="flex flex-wrap items-center border-b border-slate-200 bg-white rounded-t-3xl border-t border-x p-1.5 pb-0 print:hidden select-none">
        <button
          onClick={() => setActiveTab("valuation")}
          className={`py-2.5 px-4 font-extrabold text-xs transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "valuation"
              ? "border-violet-600 text-violet-700 font-black"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Car size={15} />
          <span>اسٹاک و مالیت (Stock Valuation)</span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-mono font-bold">
            {availableVehicles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("sales_pl")}
          className={`py-2.5 px-4 font-extrabold text-xs transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "sales_pl"
              ? "border-emerald-600 text-emerald-700 font-black"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <TrendingUp size={15} />
          <span>سیلز و نفع/نقصان (Sales & Profit)</span>
          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded-full font-mono font-bold">
            {soldVehicles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("installments")}
          className={`py-2.5 px-4 font-extrabold text-xs transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "installments"
              ? "border-sky-600 text-sky-700 font-black"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CreditCard size={15} />
          <span>اقساط و ریکوری (Installment Recovery)</span>
          <span className="text-[10px] bg-sky-50 text-sky-700 px-1.5 py-0.2 rounded-full font-mono font-bold">
            {installments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("dealers_khata")}
          className={`py-2.5 px-4 font-extrabold text-xs transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "dealers_khata"
              ? "border-amber-600 text-amber-700 font-black"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users size={15} />
          <span>ڈیلرز و کسٹمرز کھاتہ (Dealers Khata)</span>
          <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded-full font-mono font-bold">
            {parties.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("investors")}
          className={`py-2.5 px-4 font-extrabold text-xs transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "investors"
              ? "border-amber-500 text-amber-800 font-black"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Landmark size={15} />
          <span>انویسٹرز و منافع شراکت (Investors)</span>
          <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded-full font-mono font-bold">
            {investors.length}
          </span>
        </button>

        {rentals.length > 0 && (
          <button
            onClick={() => setActiveTab("rentals")}
            className={`py-2.5 px-4 font-extrabold text-xs transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "rentals"
                ? "border-purple-600 text-purple-700 font-black"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Banknote size={15} />
            <span>رینٹل آمدن (Rentals)</span>
            <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded-full font-mono font-bold">
              {rentals.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("accounting_gl")}
          className={`py-2.5 px-4 font-extrabold text-xs transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "accounting_gl"
              ? "border-indigo-600 text-indigo-700 font-black"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Scale size={15} />
          <span>اکاؤنٹنگ و ٹرائل بیلنس (Trial Balance & Flow Ledgers)</span>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded-full font-mono font-bold">
            Double-Entry
          </span>
        </button>
      </div>

      {/* Main Report Table Content Card */}
      <div className="bg-white border border-slate-200/80 rounded-b-3xl rounded-tr-3xl shadow-xs overflow-hidden p-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-2 text-violet-600" />
            <span className="text-xs font-semibold">Generating showroom report...</span>
          </div>
        ) : (
          <>
            {/* === TAB 1: STOCK VALUATION REPORT === */}
            {activeTab === "valuation" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] text-slate-700 font-extrabold uppercase tracking-wider bg-slate-100 select-none">
                      <th className="py-3 px-4">Vehicle Specs</th>
                      <th className="py-3 px-3">Type & Color</th>
                      <th className="py-3 px-3">Chassis & Engine</th>
                      <th className="py-3 px-3 text-right">Sourcing Cost (لاگت)</th>
                      <th className="py-3 px-3 text-right">Cash Price (نقد قیمت)</th>
                      <th className="py-3 px-3 text-right">Installment Price</th>
                      <th className="py-3 px-4 text-right">Expected Margin (متوقع منافع)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {availableVehicles.map((v) => {
                      const cost = Number(v.purchase_cost || 0);
                      const cash = Number(v.cash_price || v.price || 0);
                      const inst = Number(v.installment_price || 0);
                      const margin = cash - cost;
                      const marginPct = cost > 0 ? ((margin / cost) * 100).toFixed(1) : "0.0";

                      return (
                        <tr key={v.id} className="hover:bg-slate-50/80 transition-all font-medium text-slate-700">
                          <td className="py-3 px-4">
                            <span className="font-extrabold text-slate-900 block">
                              {v.make} {v.model} {v.year ? `(${v.year})` : ""}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {v.is_applied_for ? "Applied For" : v.plate_number || "No Plate"}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-100 uppercase">
                              {v.vehicle_type || "Car"}
                            </span>
                            {v.color && <p className="text-[10px] text-slate-400 mt-0.5">{v.color}</p>}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px]">
                            <p className="text-slate-800 font-semibold">{v.chassis_number || "—"}</p>
                            <p className="text-[10px] text-slate-400">{v.engine_number || "—"}</p>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-700">{formatPKR(cost)}</td>
                          <td className="py-3 px-3 text-right font-black text-emerald-600">{formatPKR(cash)}</td>
                          <td className="py-3 px-3 text-right font-bold text-violet-700">
                            {inst > 0 ? formatPKR(inst) : "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`font-black ${
                                margin >= 0 ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {formatPKR(margin)}
                            </span>
                            <span className="text-[9.5px] text-slate-400 block font-semibold">({marginPct}%)</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Footer Totals */}
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                      <td colSpan={3} className="py-3 px-4">
                        TOTAL AVAILABLE STOCK ({availableVehicles.length} Vehicles)
                      </td>
                      <td className="py-3 px-3 text-right text-slate-800">{formatPKR(totalCostValuation)}</td>
                      <td className="py-3 px-3 text-right text-emerald-700">{formatPKR(totalExpectedCashRevenue)}</td>
                      <td className="py-3 px-3 text-right text-violet-700">
                        {formatPKR(totalExpectedInstallmentRevenue)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700">{formatPKR(totalUnrealizedProfit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* === TAB 2: SALES & PROFIT/LOSS REPORT === */}
            {activeTab === "sales_pl" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] text-slate-700 font-extrabold uppercase tracking-wider bg-slate-100 select-none">
                      <th className="py-3 px-4">Sale Date</th>
                      <th className="py-3 px-4">Vehicle Details</th>
                      <th className="py-3 px-3 text-center">Sale Type</th>
                      <th className="py-3 px-4">Buyer Customer</th>
                      <th className="py-3 px-3 text-right">Sourcing Cost</th>
                      <th className="py-3 px-3 text-right">Sold / Financed Price</th>
                      <th className="py-3 px-4 text-right">Gross Profit (خالص منافع)</th>
                      <th className="py-3 px-3 text-center">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {soldVehicles.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400 font-semibold">
                          No sold vehicle records found for selected period.
                        </td>
                      </tr>
                    ) : (
                      soldVehicles.map((v) => {
                        const cost = Number(v.purchase_cost || 0);
                        const sold = Number(v.sold_price || v.cash_price || v.price || 0);
                        const profit = sold - cost;
                        const marginPct = sold > 0 ? ((profit / sold) * 100).toFixed(1) : "0.0";
                        const isInstallment = v.status === "installment_active";

                        return (
                          <tr key={v.id} className="hover:bg-slate-50/80 transition-all font-medium text-slate-700">
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                              {v.sold_at ? new Date(v.sold_at).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-slate-900 block">{vehicleLabel(v)}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {v.is_applied_for ? "Applied For" : v.plate_number || "—"}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                  isInstallment
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}
                              >
                                {isInstallment ? "🟣 اقساط (Installment)" : "🟢 نقد (Cash Sale)"}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-slate-800 block">
                                {v.buyer_name || (isInstallment ? "Installment Buyer" : "Cash Buyer")}
                              </span>
                              {v.buyer_phone && (
                                <span className="text-[10px] text-slate-400 font-mono">{v.buyer_phone}</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-slate-600">{formatPKR(cost)}</td>
                            <td className="py-3 px-3 text-right font-black text-slate-900">{formatPKR(sold)}</td>
                            <td className="py-3 px-4 text-right font-black text-emerald-600">
                              {formatPKR(profit)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  profit >= 0
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {marginPct}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {/* Totals */}
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                      <td colSpan={4} className="py-3 px-4">
                        TOTAL SOLD VEHICLES ({soldVehicles.length})
                      </td>
                      <td className="py-3 px-3 text-right text-slate-800">{formatPKR(totalRealizedSourcingCost)}</td>
                      <td className="py-3 px-3 text-right text-slate-900">{formatPKR(totalRealizedSalesRevenue)}</td>
                      <td className="py-3 px-4 text-right text-emerald-700">{formatPKR(totalRealizedGrossProfit)}</td>
                      <td className="py-3 px-3 text-center text-emerald-700">{overallProfitMarginPct}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* === TAB 3: INSTALLMENTS RECOVERY REPORT === */}
            {activeTab === "installments" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] text-slate-700 font-extrabold uppercase tracking-wider bg-slate-100 select-none">
                      <th className="py-3 px-4">Agreement No</th>
                      <th className="py-3 px-4">Customer Details</th>
                      <th className="py-3 px-4">Vehicle</th>
                      <th className="py-3 px-3 text-right">Agreed Total</th>
                      <th className="py-3 px-3 text-right">Advance Paid</th>
                      <th className="py-3 px-3 text-right">Total Recovered</th>
                      <th className="py-3 px-3 text-right">Remaining Due (بقایا)</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {installments.map((i) => {
                      const total = Number(i.total_price || 0);
                      const paid = Number(i.total_paid || 0);
                      const rem = Number(i.remaining_balance ?? total - paid);

                      return (
                        <tr key={i.id} className="hover:bg-slate-50/80 transition-all font-medium text-slate-700">
                          <td className="py-3 px-4 font-mono font-bold text-violet-700">
                            {i.agreement_number || i.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-extrabold text-slate-900 block">{i.customer_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{i.customer_phone || "—"}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-800">
                              {i.showroom_vehicles ? vehicleLabel(i.showroom_vehicles) : "Vehicle"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-800">{formatPKR(total)}</td>
                          <td className="py-3 px-3 text-right text-emerald-600 font-bold">
                            {formatPKR(i.down_payment)}
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-600 font-black">{formatPKR(paid)}</td>
                          <td className="py-3 px-3 text-right text-rose-600 font-black">{formatPKR(rem)}</td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase border ${
                                i.status === "completed"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : i.status === "overdue"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-sky-50 text-sky-700 border-sky-200"
                              }`}
                            >
                              {i.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals */}
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                      <td colSpan={3} className="py-3 px-4">
                        TOTAL INSTALLMENT PORTFOLIO ({installments.length} Agreements)
                      </td>
                      <td className="py-3 px-3 text-right text-slate-900">{formatPKR(totalInstallmentPortfolio)}</td>
                      <td colSpan={1} />
                      <td className="py-3 px-3 text-right text-emerald-700">{formatPKR(totalInstallmentCollected)}</td>
                      <td className="py-3 px-3 text-right text-rose-700">{formatPKR(totalInstallmentPending)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* === TAB 4: DEALERS & CUSTOMERS KHATA REPORT === */}
            {activeTab === "dealers_khata" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] text-slate-700 font-extrabold uppercase tracking-wider bg-slate-100 select-none">
                      <th className="py-3 px-4">Party / Dealer Name</th>
                      <th className="py-3 px-3">Role Type</th>
                      <th className="py-3 px-3">Phone & CNIC</th>
                      <th className="py-3 px-3">City</th>
                      <th className="py-3 px-4 text-right">Current Ledger Balance (کھاتہ بیلنس)</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {parties.map((p) => {
                      const bal = Number(p.current_balance || 0);
                      const isReceivable = bal > 0;
                      const isPayable = bal < 0;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-all font-medium text-slate-700">
                          <td className="py-3 px-4">
                            <span className="font-extrabold text-slate-900 block">{p.name}</span>
                            {p.father_name && (
                              <span className="text-[10px] text-slate-400">S/O {p.father_name}</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                              {p.party_type} {p.is_dealer_showroom ? "(Dealer)" : ""}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px]">
                            <p className="text-slate-800">{p.phone || "—"}</p>
                            <p className="text-[10px] text-slate-400">{p.cnic || "—"}</p>
                          </td>
                          <td className="py-3 px-3 text-slate-600">{p.city || "—"}</td>
                          <td className="py-3 px-4 text-right font-black text-sm">
                            <span className={isReceivable ? "text-emerald-600" : isPayable ? "text-rose-600" : "text-slate-500"}>
                              {formatPKR(Math.abs(bal))}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase border ${
                                isReceivable
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : isPayable
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}
                            >
                              {isReceivable ? "Receivable (لینے ہیں)" : isPayable ? "Payable (دینے ہیں)" : "Settled (0)"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals */}
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                      <td colSpan={4} className="py-3 px-4">
                        TOTAL PARTIES & DEALERS POSITION ({parties.length} Records)
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-emerald-700 block">Total Receivables: {formatPKR(totalKhataReceivables)}</span>
                        <span className="text-rose-700 block">Total Payables: {formatPKR(totalKhataPayables)}</span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* === TAB 5: RENTALS REPORT === */}
            {activeTab === "rentals" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] text-slate-700 font-extrabold uppercase tracking-wider bg-slate-100 select-none">
                      <th className="py-3 px-4">Rental Dates</th>
                      <th className="py-3 px-4">Vehicle</th>
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-3 text-right">Daily Rate</th>
                      <th className="py-3 px-3 text-right">Security Deposit</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredRentals.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-all font-medium text-slate-700">
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {r.start_date} to {r.end_date}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {r.showroom_vehicles ? vehicleLabel(r.showroom_vehicles) : "Vehicle"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-slate-800 block">{r.customer_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{r.customer_phone}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600">{formatPKR(r.daily_rate)}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-700">
                          {formatPKR(r.security_deposit)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-100 uppercase">
                            {r.returned_at ? "Returned" : "Active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                      <td colSpan={3} className="py-3 px-4">
                        TOTAL RENTALS ({filteredRentals.length})
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-700">{formatPKR(totalRentalRevenue)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* === TAB 6: INVESTORS & CAPITAL PARTNERS REPORT === */}
            {activeTab === "investors" && (
              <div className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] text-slate-700 font-extrabold uppercase tracking-wider bg-slate-100 select-none">
                        <th className="py-3 px-4">Investor Name</th>
                        <th className="py-3 px-4">Phone / City</th>
                        <th className="py-3 px-4">Sharing Formula</th>
                        <th className="py-3 px-3 text-right">Injected Capital</th>
                        <th className="py-3 px-3 text-right">Profit Earned</th>
                        <th className="py-3 px-3 text-right">Withdrawn / Paid</th>
                        <th className="py-3 px-3 text-right">Current Payable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {investors.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                            No registered investors found.
                          </td>
                        </tr>
                      ) : (
                        investors.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/80 transition-all font-medium text-slate-700">
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-slate-900 block">{inv.name}</span>
                              {inv.father_name && (
                                <span className="text-[10px] text-slate-400 font-urdu">ولد: {inv.father_name}</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono text-xs block">{inv.phone}</span>
                              <span className="text-[10px] text-slate-400">{inv.city || "Lahore"}</span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-amber-800 text-[11px]">
                              {formatInvestorShareBadge(inv.default_share_type, inv.default_share_value)}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-emerald-600">
                              {formatPKR(inv.total_invested)}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-yellow-600">
                              {formatPKR(inv.total_profit_earned)}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-rose-600">
                              {formatPKR(inv.total_withdrawn)}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-blue-700">
                              {formatPKR(inv.current_balance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                        <td colSpan={3} className="py-3 px-4">
                          TOTAL INVESTORS POSITION ({investors.length} Investors)
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-700">
                          {formatPKR(investors.reduce((sum, i) => sum + Number(i.total_invested || 0), 0))}
                        </td>
                        <td className="py-3 px-3 text-right text-yellow-700">
                          {formatPKR(investors.reduce((sum, i) => sum + Number(i.total_profit_earned || 0), 0))}
                        </td>
                        <td className="py-3 px-3 text-right text-rose-700">
                          {formatPKR(investors.reduce((sum, i) => sum + Number(i.total_withdrawn || 0), 0))}
                        </td>
                        <td className="py-3 px-3 text-right text-blue-700 font-black">
                          {formatPKR(investors.reduce((sum, i) => sum + Number(i.current_balance || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Co-funded Vehicles Section */}
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">
                    Co-Funded & Partnered Vehicles Portfolio (مشترکہ خریدی گئی گاڑیاں)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] text-slate-700 font-extrabold uppercase tracking-wider bg-slate-50">
                          <th className="py-2.5 px-3">Vehicle</th>
                          <th className="py-2.5 px-3">Partner Investor</th>
                          <th className="py-2.5 px-3 text-right">Total Cost</th>
                          <th className="py-2.5 px-3 text-right">Investor Capital</th>
                          <th className="py-2.5 px-3 text-right">Sale Price</th>
                          <th className="py-2.5 px-3 text-right">Realized Net Profit</th>
                          <th className="py-2.5 px-3 text-right">Investor Share</th>
                          <th className="py-2.5 px-3 text-center">Settlement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vehicles.filter((v) => v.investor_id).length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-400">
                              No vehicles tagged with investors yet.
                            </td>
                          </tr>
                        ) : (
                          vehicles
                            .filter((v) => v.investor_id)
                            .map((v) => {
                              const inv = investors.find((i) => i.id === v.investor_id);
                              const cost = Number(v.purchase_cost || 0);
                              const sold = Number(v.sold_price || 0);
                              const netProfit = sold > 0 ? sold - cost : 0;
                              
                              const calculatedShare = inv && sold > 0
                                ? calculateInvestorProfitShare(
                                    cost,
                                    sold,
                                    v.investor_share_type || inv.default_share_type || "profit_only",
                                    v.investor_share_value ?? inv.default_share_value ?? 50
                                  ).investorProfit
                                : 0;

                              return (
                                <tr key={v.id} className="hover:bg-slate-50 font-medium text-slate-700">
                                  <td className="py-2.5 px-3 font-bold text-slate-900">{vehicleLabel(v)}</td>
                                  <td className="py-2.5 px-3 font-semibold text-amber-800">{inv?.name || "Investor"}</td>
                                  <td className="py-2.5 px-3 text-right">{formatPKR(cost)}</td>
                                  <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                                    {formatPKR(v.investor_investment_amount || cost)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">{sold > 0 ? formatPKR(sold) : "In Stock"}</td>
                                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                    {sold > 0 ? formatPKR(netProfit) : "—"}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-yellow-700">
                                    {v.investor_profit_settled
                                      ? formatPKR(v.investor_profit_amount || 0)
                                      : sold > 0
                                      ? `${formatPKR(calculatedShare)} (متوقع)`
                                      : "—"}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        v.status !== "sold"
                                          ? "bg-slate-100 text-slate-600"
                                          : v.investor_profit_settled
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                          : "bg-amber-50 text-amber-700 border border-amber-100"
                                      }`}
                                    >
                                      {v.status !== "sold"
                                        ? "Available"
                                        : v.investor_profit_settled
                                        ? "Settled ✓"
                                        : "Unsettled"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Accounting GL & Double-Entry Trial Balance Tab */}
            {activeTab === "accounting_gl" && (
              <div className="p-4 space-y-4">
                {/* Live Sub-Ledger Sync & Actions Header */}
                <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 border border-indigo-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        Sub-Ledger Auto-Sync Active
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        Parties & Dealers Engine Synced
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Real-time auto-synchronization: Receivables <span className="font-mono font-black text-blue-700">{formatPKR(subledgerBalances.totalReceivables)}</span> • Payables <span className="font-mono font-black text-rose-700">{formatPKR(subledgerBalances.totalPayables)}</span> • Vehicle Stock <span className="font-mono font-black text-slate-900">{formatPKR(subledgerBalances.vehicleStockValue)}</span> ({subledgerBalances.availableVehicleCount} Vehicles)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => setIsCapitalFloatOpen(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8.5 rounded-xl gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Wallet size={13} />
                      <span>Opening Capital Float (سرمایہ)</span>
                    </Button>

                    <Button
                      size="sm"
                      disabled={syncingJournals}
                      onClick={handleSyncHistoricalJournals}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8.5 rounded-xl gap-1.5 shadow-sm cursor-pointer"
                    >
                      <RefreshCcw size={13} className={syncingJournals ? "animate-spin" : ""} />
                      <span>{syncingJournals ? "Syncing..." : "1-Click Auto-Sync Historical Journals"}</span>
                    </Button>
                  </div>
                </div>

                {/* Sub-Tab Navigation Bar */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold">
                  <button
                    onClick={() => setAccountingSubTab("trial")}
                    className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                      accountingSubTab === "trial" ? "bg-slate-900 text-white shadow-xs font-black" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    ⚖️ Trial Balance (ٹرائل بیلنس)
                  </button>
                  <button
                    onClick={() => setAccountingSubTab("balance_sheet")}
                    className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                      accountingSubTab === "balance_sheet" ? "bg-slate-900 text-white shadow-xs font-black" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    📑 Balance Sheet (بیلنس شیٹ)
                  </button>
                  <button
                    onClick={() => setAccountingSubTab("money_flow")}
                    className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                      accountingSubTab === "money_flow" ? "bg-slate-900 text-white shadow-xs font-black" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    💵 Money Flow Ledger (1001 کیش فلو)
                  </button>
                  <button
                    onClick={() => setAccountingSubTab("product_flow")}
                    className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                      accountingSubTab === "product_flow" ? "bg-slate-900 text-white shadow-xs font-black" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    🚗 Vehicle Stock Cardex (گاڑیوں کا اسٹاک فلو)
                  </button>
                </div>

                {/* SUB-TAB 1: Trial Balance */}
                {accountingSubTab === "trial" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Strict Double-Entry General Ledger Accounts Summary</span>
                      <div className="flex items-center gap-2">
                        {glTrialTotals.isBalanced ? (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full font-bold">
                            <CheckCircle2 size={13} className="text-emerald-600" /> Balanced (Debits = Credits)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-full font-bold">
                            <AlertCircle size={13} className="text-rose-600" /> Out of Balance: {formatPKR(glTrialTotals.diff)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 text-[10.5px] font-extrabold uppercase border-b border-slate-200">
                            <th className="py-2.5 px-3">Code</th>
                            <th className="py-2.5 px-3">Account Name</th>
                            <th className="py-2.5 px-3">Classification</th>
                            <th className="py-2.5 px-3 text-right">Debit Balance</th>
                            <th className="py-2.5 px-3 text-right">Credit Balance</th>
                            <th className="py-2.5 px-3 text-right">Net Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Object.values(showroomAccountsSummary).map((acc: any) => (
                            <tr key={acc.code} className="hover:bg-slate-50 font-medium">
                              <td className="py-2 px-3 font-mono font-bold text-indigo-600">{acc.code}</td>
                              <td className="py-2 px-3 font-bold text-slate-900">{acc.name}</td>
                              <td className="py-2 px-3">
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {acc.type}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700">
                                {acc.debit > 0 ? formatPKR(acc.debit) : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700">
                                {acc.credit > 0 ? formatPKR(acc.credit) : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-black text-slate-900">
                                {formatPKR(acc.balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-xs">
                          <tr>
                            <td colSpan={3} className="py-3 px-3 text-slate-900">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold tracking-wide">TOTALS:</span>
                                {glTrialTotals.isBalanced ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                    <CheckCircle2 size={13} /> Strict Equality Validated
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">
                                    <AlertCircle size={13} /> Out of Balance by {formatPKR(glTrialTotals.diff)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-900 font-bold">{formatPKR(glTrialTotals.debits)}</td>
                            <td className="py-3 px-3 text-right font-mono text-slate-900 font-bold">{formatPKR(glTrialTotals.credits)}</td>
                            <td className="py-3 px-3 text-right font-mono text-slate-900 font-bold">{formatPKR(Math.abs(glTrialTotals.debits - glTrialTotals.credits))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUB-TAB 2: Balance Sheet */}
                {accountingSubTab === "balance_sheet" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* ASSETS COLUMN */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h4 className="font-black text-slate-900 text-sm">ASSETS (اثاثہ جات)</h4>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                            Live Synced
                          </span>
                        </div>
                        <div className="space-y-2 text-xs">
                          {glBalanceSheet.assetsList.map((acc: any) => (
                            <div key={acc.code} className="flex justify-between py-1.5 border-b border-slate-100">
                              <div>
                                <span className="font-bold text-slate-800">{acc.name}</span>
                                <span className="text-[10px] font-mono text-slate-400 ml-1.5">({acc.code})</span>
                              </div>
                              <span className="font-mono font-bold text-slate-900">{formatPKR(acc.balance)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between pt-3 border-t-2 border-slate-300 font-black text-sm text-slate-900">
                          <span>Total Assets</span>
                          <span className="font-mono text-emerald-700">{formatPKR(glBalanceSheet.totalAssets)}</span>
                        </div>
                      </div>

                      {/* LIABILITIES & EQUITY COLUMN */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h4 className="font-black text-slate-900 text-sm">LIABILITIES & EQUITY (واجبات و سرمایہ)</h4>
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">
                            Double-Entry
                          </span>
                        </div>
                        <div className="space-y-2 text-xs">
                          <p className="text-[10px] font-extrabold uppercase text-slate-400">Liabilities</p>
                          {glBalanceSheet.liabilitiesList.map((acc: any) => (
                            <div key={acc.code} className="flex justify-between py-1.5 border-b border-slate-100">
                              <div>
                                <span className="font-bold text-slate-800">{acc.name}</span>
                                <span className="text-[10px] font-mono text-slate-400 ml-1.5">({acc.code})</span>
                              </div>
                              <span className="font-mono font-bold text-slate-900">{formatPKR(acc.balance)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-slate-500 font-bold py-1">
                            <span>Total Liabilities</span>
                            <span className="font-mono">{formatPKR(glBalanceSheet.totalLiabilities)}</span>
                          </div>

                          <p className="text-[10px] font-extrabold uppercase text-slate-400 pt-2">Owner's Equity & Retained Earnings</p>
                          {glBalanceSheet.equityList.length === 0 ? (
                            <div className="flex justify-between py-1 text-slate-400 italic">
                              <span>Owner's Capital (3100)</span>
                              <span className="font-mono">{formatPKR(0)}</span>
                            </div>
                          ) : (
                            glBalanceSheet.equityList.map((acc: any) => (
                              <div key={acc.code} className="flex justify-between py-1 border-b border-slate-100">
                                <div>
                                  <span className="font-bold text-slate-800">{acc.name}</span>
                                  <span className="text-[10px] font-mono text-slate-400 ml-1.5">({acc.code})</span>
                                </div>
                                <span className="font-mono font-bold text-slate-900">{formatPKR(acc.balance)}</span>
                              </div>
                            ))
                          )}
                          {!glBalanceSheet.equityList.some((e: any) => e.code === "3300") && (
                            <div className="flex justify-between py-1 text-slate-600 font-bold">
                              <span>Retained Net Earnings (Vehicle Margins)</span>
                              <span className="font-mono">{formatPKR(glBalanceSheet.netProfit)}</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t-2 border-slate-300 space-y-2">
                          <div className="flex justify-between font-black text-sm text-slate-900">
                            <span>Total Liabilities & Equity</span>
                            <span className="font-mono text-indigo-700">{formatPKR(glBalanceSheet.totalLiabilitiesAndEquity)}</span>
                          </div>

                          <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between ${
                            glBalanceSheet.isBalanced ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-900 border border-amber-200"
                          }`}>
                            <span className="flex items-center gap-1.5">
                              {glBalanceSheet.isBalanced ? <CheckCircle2 size={14} className="text-emerald-600" /> : <AlertCircle size={14} className="text-amber-600" />}
                              {glBalanceSheet.isBalanced ? "Strict Accounting Equality Validated" : `Difference: ${formatPKR(glBalanceSheet.diff)}`}
                            </span>
                            <span className="font-mono text-[11px]">
                              {glBalanceSheet.isBalanced ? "Assets = Liab + Equity" : "Adjust via Capital Float"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SUB-TAB 3: Money Flow Ledger */}
                {accountingSubTab === "money_flow" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Real-Time Cash Inflow & Outflow Log (Account Code 1001)</span>
                      <span className="font-mono font-bold text-slate-800">
                        Current Cash: {formatPKR(currentCashBalance)}
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 text-[10.5px] font-extrabold uppercase border-b border-slate-200">
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Ref Type</th>
                            <th className="py-2.5 px-3">Narration</th>
                            <th className="py-2.5 px-3 text-right">Inflow (Debit)</th>
                            <th className="py-2.5 px-3 text-right">Outflow (Credit)</th>
                            <th className="py-2.5 px-3 text-right">Cash Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {showroomMoneyFlow.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400">
                                No cash transactions logged in selected range. Use "1-Click Auto-Sync Historical Journals" to backfill.
                              </td>
                            </tr>
                          ) : (
                            showroomMoneyFlow.map((flow: any) => (
                              <tr key={flow.id} className="hover:bg-slate-50 font-medium">
                                <td className="py-2 px-3 font-mono text-slate-600">{flow.date}</td>
                                <td className="py-2 px-3">
                                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                                    {flow.ref_type?.replace("showroom_", "")}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-800 font-semibold">{flow.narration}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                                  {flow.debit > 0 ? `+${formatPKR(flow.debit)}` : "-"}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                                  {flow.credit > 0 ? `-${formatPKR(flow.credit)}` : "-"}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-black text-slate-900">
                                  {formatPKR(flow.balance)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUB-TAB 4: Vehicle Stock Cardex (Product Flow) */}
                {accountingSubTab === "product_flow" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Vehicle Stock Cardex — Inventory Inflows (Purchases) & Outflows (Sales & Installments)</span>
                      <span className="font-mono font-bold text-slate-800">
                        {showroomProductFlow.length} Flow Records
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 text-[10.5px] font-extrabold uppercase border-b border-slate-200">
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Vehicle</th>
                            <th className="py-2.5 px-3">Party / Dealer</th>
                            <th className="py-2.5 px-3">Flow Type</th>
                            <th className="py-2.5 px-3 text-center">Qty In</th>
                            <th className="py-2.5 px-3 text-center">Qty Out</th>
                            <th className="py-2.5 px-3 text-right">Value</th>
                            <th className="py-2.5 px-3">Reference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {showroomProductFlow.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-400">
                                No vehicle product flows in selected range.
                              </td>
                            </tr>
                          ) : (
                            showroomProductFlow.map((flow: any) => (
                              <tr key={flow.id} className="hover:bg-slate-50 font-medium">
                                <td className="py-2 px-3 font-mono text-slate-600">{flow.date}</td>
                                <td className="py-2 px-3 font-bold text-slate-900">{flow.productName}</td>
                                <td className="py-2 px-3 font-semibold text-slate-700">{flow.partyName}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    flow.type === "Purchase" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                                  }`}>
                                    {flow.type === "Purchase" ? "Stock In (Purchase)" : "Stock Out (Sale / Agr)"}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-emerald-600">
                                  {flow.qtyIn > 0 ? `+${flow.qtyIn}` : "-"}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-rose-600">
                                  {flow.qtyOut > 0 ? `-${flow.qtyOut}` : "-"}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-black text-slate-900">
                                  {formatPKR(flow.value)}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{flow.ref}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Opening Capital Float Wizard Modal */}
      <ShowroomCapitalFloatWizard
        isOpen={isCapitalFloatOpen}
        onClose={() => setIsCapitalFloatOpen(false)}
        shopId={shopId || ""}
        onSuccess={() => {
          fetchShowroomAccountingData();
          fetchReportData();
        }}
        currentCashBalance={currentCashBalance}
      />
    </div>
  );
}
