"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, CreditCard, DollarSign, Users, Loader2, 
  TrendingUp, AlertTriangle, ArrowUpRight, ShoppingBag, 
  PlusCircle, FileText, ArrowRightLeft, UserPlus, Wallet
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { AIExecutiveInsights } from "@/components/dashboard/AIExecutiveInsights";
import { isBrowserOffline } from "@/lib/sync/offlineData";
import { loadShopSnapshot } from "@/utils/syncQueue";
import { toast } from "sonner";
import { MobileQuickActionsStrip } from "@/components/mobile/MobileQuickActionsStrip";
import { formatDateTime } from "@/lib/timezone";

type RecentTxItem = {
  id: string;
  date: string;
  customerName: string;
  amount: number;
  paymentMode: string;
};

type LowStockItem = {
  id: string;
  name: string;
  current_stock: number;
  min_stock_level: number;
  unit: string | null;
};

type ExpiryAlertItem = {
  id: string;
  product_name: string;
  batch_number: string;
  expiry_date: string;
  stock_quantity: number;
};

type ChartPoint = {
  label: string;
  amount: number;
};

type CategorySaleItem = {
  name: string;
  value: number;
};

export default function DashboardPage() {
  const { shopId, industryType, timezone } = useShop();
  const supabase = createClient();
  const { t, language } = useLanguage();

  const safeNum = (val: any, fallback = 0): number => {
    if (val === null || val === undefined) return fallback;
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  };


  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"today" | "yesterday" | "week" | "month" | "all">("all");

  // Raw Database Data Stores
  const [rawInvoices, setRawInvoices] = useState<any[]>([]);
  const [rawCustomers, setRawCustomers] = useState<any[]>([]);
  const [rawRecent, setRawRecent] = useState<any[]>([]);
  const [rawProducts, setRawProducts] = useState<any[]>([]);
  const [rawExpiry, setRawExpiry] = useState<any[]>([]);
  const [rawRecentItems, setRawRecentItems] = useState<any[]>([]);
  const [rawShowroomVehicles, setRawShowroomVehicles] = useState<any[]>([]);
  const [rawShowroomInstallments, setRawShowroomInstallments] = useState<any[]>([]);
  const [rawShowroomParties, setRawShowroomParties] = useState<any[]>([]);

  // Calculated UI States
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeUdhaar: 0,
    totalCustomers: 0,
    dailyInvoices: 0,
    totalInvoicesCount: 0,
    outstandingAccountsCount: 0,
    newCustomersToday: 0
  });

  const [recentTx, setRecentTx] = useState<RecentTxItem[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockItem[]>([]);
  const [nearExpiryAlerts, setNearExpiryAlerts] = useState<ExpiryAlertItem[]>([]);
  const [salesTrend, setSalesTrend] = useState<ChartPoint[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySaleItem[]>([]);

  useEffect(() => {
    if (!shopId) return;
    fetchDashboardData();
  }, [shopId, industryType]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (isBrowserOffline() && shopId) {
        const cached = await loadShopSnapshot(shopId);
        if (cached) {
          const invoices = cached.invoices.filter((i) => !i.is_voided && i.status !== "draft");
          setRawInvoices(invoices);
          setRawCustomers(
            cached.parties.filter((p) => p.type === "customer").map((p) => ({
              type: p.type,
              current_balance: p.current_balance,
              created_at: p.created_at,
            }))
          );
          setRawRecent(invoices.slice(0, 5));
          setRawProducts(
            cached.products.map((p) => ({
              id: p.id,
              name: p.name,
              current_stock: p.current_stock,
              min_stock_level: p.min_stock_level,
              unit: p.unit,
            }))
          );
          setRawExpiry([]);
          setRawRecentItems([]);

          // Load showroom offline entities if available
          import("@/lib/showroom-ops").then(async ({ loadShowroomOfflineEntities }) => {
            try {
              const [offV, offI, offP] = await Promise.all([
                loadShowroomOfflineEntities<any>("showroom_vehicles", shopId),
                loadShowroomOfflineEntities<any>("showroom_installments", shopId),
                loadShowroomOfflineEntities<any>("showroom_parties", shopId),
              ]);
              setRawShowroomVehicles(offV || []);
              setRawShowroomInstallments(offI || []);
              setRawShowroomParties(offP || []);
            } catch {}
          });

          toast.message("Offline mode — dashboard using cached data", {
            description: cached.savedAt
              ? `Last synced ${new Date(cached.savedAt).toLocaleString()}`
              : undefined,
          });
          return;
        }
      }

      const sixtyDaysFromNow = new Date();
      sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

      // Fetch all independent queries in parallel to drastically improve loading speeds (AUTH-03)
      const [
        invoicesRes,
        customersRes,
        recentRes,
        productsRes,
        expiryRes,
        recentItemsRes,
        showroomVehiclesRes,
        showroomInstallmentsRes,
        showroomPartiesRes,
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select("total_amount, paid_amount, created_at, status, payment_mode, party_id")
          .eq("shop_id", shopId)
          .eq("is_voided", false)
          .neq("status", "draft"),
        supabase
          .from("parties")
          .select("type, current_balance, created_at")
          .eq("shop_id", shopId)
          .eq("type", "customer"),
        supabase
          .from("invoices")
          .select(`
            id,
            created_at,
            total_amount,
            payment_mode,
            party_id,
            parties ( name )
          `)
          .eq("shop_id", shopId)
          .eq("is_voided", false)
          .neq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("products")
          .select("id, name, current_stock, min_stock_level, unit")
          .eq("shop_id", shopId),
        industryType === "pharmacy"
          ? supabase
              .from("product_batches")
              .select("id, batch_number, expiry_date, stock_quantity, products(name)")
              .eq("shop_id", shopId)
              .gt("stock_quantity", 0)
              .lte("expiry_date", sixtyDaysFromNow.toISOString().split("T")[0])
              .order("expiry_date", { ascending: true })
              .limit(4)
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("invoice_items")
          .select(`
            quantity, subtotal,
            products ( name, category_id, categories ( name ) ),
            invoices!inner ( shop_id, status, payment_mode, is_voided, created_at )
          `)
          .eq("invoices.shop_id", shopId)
          .eq("invoices.is_voided", false)
          .neq("invoices.status", "quotation")
          .neq("invoices.payment_mode", "quotation")
          .limit(200),
        supabase
          .from("showroom_vehicles")
          .select("id, make, model, year, vehicle_type, status, purchase_cost, cash_price, price, installment_price, sold_price, sold_at, buyer_name, created_at")
          .eq("shop_id", shopId),
        supabase
          .from("showroom_installments")
          .select("id, agreement_number, customer_name, customer_phone, total_price, down_payment, total_paid, remaining_balance, status, start_date, created_at")
          .eq("shop_id", shopId),
        supabase
          .from("showroom_parties")
          .select("id, name, phone, party_type, current_balance, created_at")
          .eq("shop_id", shopId),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (customersRes.error) throw customersRes.error;
      if (recentRes.error) throw recentRes.error;

      setRawInvoices(invoicesRes.data || []);
      setRawCustomers(customersRes.data || []);
      setRawRecent(recentRes.data || []);
      setRawProducts(productsRes.data || []);
      setRawExpiry(expiryRes.data || []);
      setRawRecentItems(recentItemsRes.data || []);
      setRawShowroomVehicles(showroomVehiclesRes.data || []);
      setRawShowroomInstallments(showroomInstallmentsRes.data || []);
      setRawShowroomParties(showroomPartiesRes.data || []);

    } catch (err: any) {
      console.error("Dashboard statistics loading failed:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to filter dates by selected timeframe
  const isInTimeframe = (dateStr: string, filter: typeof timeFilter) => {
    const date = new Date(dateStr);
    const now = new Date();
    
    if (filter === "all") return true;
    
    if (filter === "today") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return date >= todayStart;
    }
    
    if (filter === "yesterday") {
      const yesterdayStart = new Date();
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date();
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      yesterdayEnd.setHours(23, 59, 59, 999);
      return date >= yesterdayStart && date <= yesterdayEnd;
    }
    
    if (filter === "week") {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7); // last 7 days
      weekStart.setHours(0, 0, 0, 0);
      return date >= weekStart;
    }
    
    if (filter === "month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      return date >= monthStart;
    }
    
    return true;
  };

  useEffect(() => {
    if (!shopId) return;

    // 1. Filter raw data based on timeframe
    const filteredInvoices = rawInvoices.filter((inv) => isInTimeframe(inv.created_at, timeFilter));
    const filteredCustomers = rawCustomers.filter((c) => isInTimeframe(c.created_at, timeFilter));
    const filteredRecent = rawRecent.filter((inv) => isInTimeframe(inv.created_at, timeFilter));
    const filteredRecentItems = rawRecentItems.filter((item) => {
      const invDate = item.invoices?.created_at;
      return invDate ? isInTimeframe(invDate, timeFilter) : true;
    });

    const filteredVehicles = (rawShowroomVehicles || []).filter((v: any) => {
      const isSold = v.status === "sold" || v.status === "installment_active";
      if (!isSold) return false;
      const saleDate = v.sold_at || v.created_at;
      return saleDate ? isInTimeframe(saleDate, timeFilter) : true;
    });

    // 2. Process Low Stock Alerts (independent of timefilter)
    const lowStock: LowStockItem[] = (rawProducts || [])
      .filter((p: any) => safeNum(p.current_stock) <= safeNum(p.min_stock_level))
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        current_stock: safeNum(p.current_stock),
        min_stock_level: safeNum(p.min_stock_level),
        unit: p.unit
      }))
      .slice(0, 4);
    setLowStockAlerts(lowStock);

    // 3. Pharmacy Expiry Alerts (independent of timefilter)
    if (industryType === "pharmacy" && rawExpiry) {
      setNearExpiryAlerts(rawExpiry.map((b: any) => ({
        id: b.id,
        batch_number: b.batch_number,
        expiry_date: b.expiry_date,
        stock_quantity: b.stock_quantity,
        product_name: b.products?.name || "Unknown Product"
      })));
    }

    // 4. Category breakdown
    const catTotals: Record<string, number> = {};
    (filteredRecentItems || []).forEach((item: any) => {
      const catName = item.products?.categories?.name || item.products?.category?.name || "General Sales";
      catTotals[catName] = (catTotals[catName] || 0) + safeNum(item.subtotal);
    });

    // Add Showroom Vehicles categories
    filteredVehicles.forEach((v: any) => {
      const vType = v.vehicle_type === "bike" 
        ? "🏍️ Motorbikes (موٹرسائیکل)" 
        : v.vehicle_type === "commercial" 
        ? "🚚 Commercial (کمرشل)" 
        : "🚗 Cars (کاریں)";
      catTotals[vType] = (catTotals[vType] || 0) + safeNum(v.sold_price || v.cash_price || v.price);
    });

    const catBreakdown = Object.entries(catTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
    setCategorySales(catBreakdown);

    // 5. Calculations for Stats Cards
    const realInvoices = filteredInvoices.filter((inv: any) => inv.status !== "quotation" && inv.payment_mode !== "quotation");
    const retailRevenue = realInvoices.reduce((sum: number, inv: any) => sum + safeNum(inv.total_amount), 0);
    const showroomRevenue = filteredVehicles.reduce(
      (sum: number, v: any) => sum + safeNum(v.sold_price || v.cash_price || v.price),
      0
    );
    const totalRevenue = retailRevenue + showroomRevenue;
    const totalInvoicesCount = realInvoices.length + filteredVehicles.length;

    let activeUdhaar = 0;
    let outstandingAccountsCount = 0;
    if (timeFilter === "all") {
      const retailUdhaar = rawCustomers
        .filter((c: any) => safeNum(c.current_balance) > 0)
        .reduce((sum: number, c: any) => sum + safeNum(c.current_balance), 0);
      const retailDebtors = rawCustomers.filter((c: any) => safeNum(c.current_balance) > 0).length;

      const showroomInstUdhaar = (rawShowroomInstallments || [])
        .filter((i: any) => i.status === "active" || i.status === "overdue")
        .reduce((sum: number, i: any) => {
          const rem = i.remaining_balance !== null && i.remaining_balance !== undefined
            ? safeNum(i.remaining_balance)
            : Math.max(0, safeNum(i.total_price) - safeNum(i.total_paid));
          return sum + rem;
        }, 0);
      const showroomInstDebtors = (rawShowroomInstallments || [])
        .filter((i: any) => (i.status === "active" || i.status === "overdue") && (safeNum(i.remaining_balance ?? (safeNum(i.total_price) - safeNum(i.total_paid))) > 0)).length;

      const showroomPartyUdhaar = (rawShowroomParties || [])
        .filter((p: any) => safeNum(p.current_balance) > 0)
        .reduce((sum: number, p: any) => sum + safeNum(p.current_balance), 0);
      const showroomPartyDebtors = (rawShowroomParties || [])
        .filter((p: any) => safeNum(p.current_balance) > 0).length;

      activeUdhaar = retailUdhaar + showroomInstUdhaar + showroomPartyUdhaar;
      outstandingAccountsCount = retailDebtors + showroomInstDebtors + showroomPartyDebtors;
    } else {
      const creditInvoices = realInvoices.filter((inv: any) => inv.payment_mode === "credit" || inv.payment_mode === "emi");
      const retailCreditDue = creditInvoices.reduce((sum: number, inv: any) => sum + (safeNum(inv.total_amount) - safeNum(inv.paid_amount)), 0);

      const timeInstallments = (rawShowroomInstallments || []).filter((i: any) => {
        const dt = i.start_date || i.created_at;
        return dt ? isInTimeframe(dt, timeFilter) : false;
      });
      const timeInstDue = timeInstallments.reduce((sum: number, i: any) => {
        return sum + Math.max(0, safeNum(i.total_price) - safeNum(i.down_payment));
      }, 0);

      activeUdhaar = retailCreditDue + timeInstDue;
      outstandingAccountsCount = new Set(creditInvoices.map((inv: any) => inv.party_id).filter(Boolean)).size + timeInstallments.length;
    }

    const totalCustomers = rawCustomers.length + (rawShowroomParties || []).length + (rawShowroomInstallments || []).length;
    const dailyInvoices = realInvoices.length + filteredVehicles.length;
    const newCustomersToday = filteredCustomers.length + 
      (rawShowroomParties || []).filter((p: any) => isInTimeframe(p.created_at, timeFilter)).length +
      (rawShowroomInstallments || []).filter((i: any) => isInTimeframe(i.created_at, timeFilter)).length;

    setStats({
      totalRevenue,
      activeUdhaar,
      totalCustomers,
      dailyInvoices,
      totalInvoicesCount,
      outstandingAccountsCount,
      newCustomersToday
    });

    // 6. Format recent transactions
    const retailRecent = (filteredRecent || [])
      .filter((inv: any) => inv.payment_mode !== "quotation")
      .map((inv: any) => {
        let customerName = "Walk-in Customer";
        if (inv.parties) {
          if (Array.isArray(inv.parties)) {
            customerName = inv.parties[0]?.name || "Walk-in Customer";
          } else {
            customerName = inv.parties.name;
          }
        }
        return {
          id: inv.id,
          date: inv.created_at,
          customerName,
          amount: safeNum(inv.total_amount),
          paymentMode: inv.payment_mode || "cash"
        };
      });

    const showroomRecent = filteredVehicles.map((v: any) => ({
      id: v.id,
      date: v.sold_at || v.created_at,
      customerName: `${v.buyer_name || "Customer"} (${v.make} ${v.model})`,
      amount: safeNum(v.sold_price || v.cash_price || v.price),
      paymentMode: v.status === "installment_active" ? "اقساط (Installment)" : "نقد فروخت (Cash Sale)"
    }));

    const combinedRecent = [...retailRecent, ...showroomRecent]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    setRecentTx(combinedRecent);

    // 7. Calculate 7-day sales trend (combines retail invoices + showroom vehicle sales)
    const trendData: ChartPoint[] = [];
    const trendInvoices = rawInvoices.filter((inv: any) => inv.status !== "quotation" && inv.payment_mode !== "quotation");
    const trendVehicles = (rawShowroomVehicles || []).filter((v: any) => v.status === "sold" || v.status === "installment_active");

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const daySales = trendInvoices
        .filter((inv: any) => {
          const date = new Date(inv.created_at);
          return date >= d && date <= dayEnd;
        })
        .reduce((sum: number, inv: any) => sum + safeNum(inv.total_amount), 0);

      const dayVehSales = trendVehicles
        .filter((v: any) => {
          const date = new Date(v.sold_at || v.created_at);
          return date >= d && date <= dayEnd;
        })
        .reduce((sum: number, v: any) => sum + safeNum(v.sold_price || v.cash_price || v.price), 0);

      trendData.push({
        label: d.toLocaleDateString([], { weekday: "short" }),
        amount: daySales + dayVehSales
      });
    }
    setSalesTrend(trendData);

  }, [rawInvoices, rawCustomers, rawRecent, rawProducts, rawExpiry, rawRecentItems, rawShowroomVehicles, rawShowroomInstallments, rawShowroomParties, timeFilter, industryType, shopId]);

  // Rendering SVG line chart coordinates helper
  const maxTrendAmount = Math.max(...salesTrend.map(t => t.amount), 1000);
  const svgHeight = 160;
  const svgWidth = 500;
  const chartPoints = salesTrend.map((t, idx) => {
    const x = (idx / 6) * (svgWidth - 40) + 20;
    const y = svgHeight - (t.amount / maxTrendAmount) * (svgHeight - 60) - 20;
    return { x, y, label: t.label, amount: t.amount };
  });

  const linePathD = chartPoints.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPathD = chartPoints.length > 0 
    ? `${linePathD} L ${chartPoints[chartPoints.length - 1].x} ${svgHeight - 10} L ${chartPoints[0].x} ${svgHeight - 10} Z`
    : "";

  return (
    <div className="space-y-3.5 md:space-y-4 animate-in fade-in duration-300 font-sans text-slate-800">
      <MobileQuickActionsStrip />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 border-b border-slate-200/80 pb-2.5">
        <div>
          <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-900">
            {t("executive_command_center")}
          </h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto w-full sm:w-auto">
          {/* Time Filter Segmented Control */}
          <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200 overflow-x-auto max-w-full scrollbar-none shadow-2xs">
            {(["today", "yesterday", "week", "month", "all"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer capitalize ${
                  timeFilter === filter
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-250/50 font-black"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {filter === "all" ? "All" : filter === "week" ? "Week" : filter === "month" ? "Month" : filter}
              </button>
            ))}
          </div>

          {/* Quick Sync Button */}
          <button 
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition-all border border-slate-200 cursor-pointer disabled:opacity-60 shadow-2xs"
          >
            <Activity size={12} className={loading ? "animate-spin text-blue-500" : "text-slate-500"} />
            {t("refresh_stats")}
          </button>
        </div>
      </div>

      {/* AI Business Executive Copilot Widget */}
      <AIExecutiveInsights />

      {loading ? (
        <div className="h-[50vh] flex flex-col justify-center items-center text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin mb-2 text-indigo-600" />
          <p className="font-semibold text-xs">{t("loading_analytics")}</p>
        </div>
      ) : (
        <>
          {/* Top Analytical Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            
            {/* Card 1: Revenue */}
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-3.5 rounded-2xl text-white shadow-md shadow-blue-500/10 relative overflow-hidden transition-all hover:shadow-lg">
              <div className="absolute right-0 top-0 translate-x-2 -translate-y-2 opacity-15">
                <DollarSign size={58} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-100">{t("net_gross_revenue")}</span>
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">Live</span>
              </div>
              <div className="text-xl md:text-2xl font-black mt-1.5">
                Rs {stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-[11px] text-blue-100/90 font-medium mt-2 flex items-center gap-1">
                <TrendingUp size={12} /> {stats.totalInvoicesCount} {t("invoices_recorded_ledger")}
              </p>
            </div>

            {/* Card 2: Active Udhaar */}
            <div className="bg-gradient-to-br from-rose-500 to-red-600 p-3.5 rounded-2xl text-white shadow-md shadow-rose-500/10 relative overflow-hidden transition-all hover:shadow-lg">
              <div className="absolute right-0 top-0 translate-x-2 -translate-y-2 opacity-15">
                <CreditCard size={58} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-100">{t("outstanding_udhaar")}</span>
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">Khata</span>
              </div>
              <div className="text-xl md:text-2xl font-black mt-1.5">
                Rs {stats.activeUdhaar.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-[11px] text-rose-100/90 font-medium mt-2 flex items-center gap-1">
                <AlertTriangle size={12} className="animate-pulse" /> {stats.outstandingAccountsCount} {t("customer_accounts_pending")}
              </p>
            </div>

            {/* Card 3: Total Customers */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3.5 rounded-2xl text-white shadow-md shadow-emerald-500/10 relative overflow-hidden transition-all hover:shadow-lg">
              <div className="absolute right-0 top-0 translate-x-2 -translate-y-2 opacity-15">
                <Users size={58} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">{t("registered_parties")}</span>
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">Profiles</span>
              </div>
              <div className="text-xl md:text-2xl font-black mt-1.5">
                {stats.totalCustomers}
              </div>
              <p className="text-[11px] text-emerald-100/90 font-medium mt-2 flex items-center gap-1">
                <PlusCircle size={12} /> +{stats.newCustomersToday} {t("newly_registered_today")}
              </p>
            </div>

            {/* Card 4: Daily Invoices */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-3.5 rounded-2xl text-white shadow-md shadow-amber-500/10 relative overflow-hidden transition-all hover:shadow-lg">
              <div className="absolute right-0 top-0 translate-x-2 -translate-y-2 opacity-15">
                <Activity size={58} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-100">{t("sales_transactions")}</span>
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">Today</span>
              </div>
              <div className="text-xl md:text-2xl font-black mt-1.5">
                +{stats.dailyInvoices}
              </div>
              <p className="text-[11px] text-amber-100/90 font-medium mt-2 flex items-center gap-1">
                <TrendingUp size={12} /> {t("daily_invoice_traffic")}
              </p>
            </div>
          </div>

          {/* Quick Actions Hub — desktop; mobile uses strip above */}
          <div className="hidden md:block bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
            {industryType === "showroom" ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <Link href="/dashboard/showroom/sales" className="flex items-center gap-2.5 p-2 bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-100/80 rounded-xl transition-colors">
                  <span className="p-1.5 bg-emerald-600 text-white rounded-lg"><DollarSign size={13} /></span>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">Vehicle Sales Desk</p>
                    <p className="text-[10px] text-slate-400 truncate">نقد و بیع نامہ فروخت</p>
                  </div>
                </Link>
                <Link href="/dashboard/showroom/installments" className="flex items-center gap-2.5 p-2 bg-purple-50/60 hover:bg-purple-50 border border-purple-100/80 rounded-xl transition-colors">
                  <span className="p-1.5 bg-purple-600 text-white rounded-lg"><CreditCard size={13} /></span>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">Installments & EMI</p>
                    <p className="text-[10px] text-slate-400 truncate">اقساط و معاہدات پلان</p>
                  </div>
                </Link>
                <Link href="/dashboard/showroom/vehicles" className="flex items-center gap-2.5 p-2 bg-indigo-50/60 hover:bg-indigo-50 border border-indigo-100/80 rounded-xl transition-colors">
                  <span className="p-1.5 bg-indigo-600 text-white rounded-lg"><PlusCircle size={13} /></span>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">Vehicle Inventory</p>
                    <p className="text-[10px] text-slate-400 truncate">گاڑی و موٹر سائیکل اسٹاک</p>
                  </div>
                </Link>
                <Link href="/dashboard/showroom/reports" className="flex items-center gap-2.5 p-2 bg-blue-50/60 hover:bg-blue-50 border border-blue-100/80 rounded-xl transition-colors">
                  <span className="p-1.5 bg-blue-600 text-white rounded-lg"><FileText size={13} /></span>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">Showroom Reports</p>
                    <p className="text-[10px] text-slate-400 truncate">مالیت، سیلز و نفع/نقصان</p>
                  </div>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <Link href="/dashboard/pos" className="flex items-center gap-2.5 p-2 bg-blue-50/50 hover:bg-blue-50 border border-blue-100/80 rounded-xl transition-colors">
                  <span className="p-1.5 bg-blue-600 text-white rounded-lg"><ShoppingBag size={13} /></span>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{t("pos_billing")}</p>
                    <p className="text-[10px] text-slate-400 truncate">{t("launch_register_terminal")}</p>
                  </div>
                </Link>
                <Link href="/dashboard/products" className="flex items-center gap-2.5 p-2 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100/80 rounded-xl transition-colors">
                  <span className="p-1.5 bg-indigo-600 text-white rounded-lg"><PlusCircle size={13} /></span>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{t("add_inventory")}</p>
                    <p className="text-[10px] text-slate-400 truncate">{t("manage_catalog_stocks")}</p>
                  </div>
                </Link>
                <Link href="/dashboard/expenses" className="flex items-center gap-2.5 p-2 bg-amber-50/50 hover:bg-amber-50 border border-amber-100/80 rounded-xl transition-colors">
                  <span className="p-1.5 bg-amber-600 text-white rounded-lg"><ArrowRightLeft size={13} /></span>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{t("log_expense")}</p>
                    <p className="text-[10px] text-slate-400 truncate">{t("record_operations_outflow")}</p>
                  </div>
                </Link>
                <Link href="/dashboard/reports" className="flex items-center gap-2.5 p-2 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100/80 rounded-xl transition-colors">
                  <span className="p-1.5 bg-emerald-600 text-white rounded-lg"><FileText size={13} /></span>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{t("reports_center")}</p>
                    <p className="text-[10px] text-slate-400 truncate">{t("print_pdf_statements")}</p>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Main Visual Panels */}
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
            
            {/* Sales Trend SVG Area Chart */}
            <Card className="w-full min-w-0 lg:col-span-8 shadow-2xs border-slate-200 rounded-2xl bg-white overflow-hidden flex flex-col justify-between">
              <CardHeader className="pb-1 pt-3.5 px-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <TrendingUp className="text-blue-500" size={16} /> {t("sales_trend_analysis")}
                  </CardTitle>
                  <span className="text-[9px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-md uppercase">{t("last_7_days")}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end pt-2 pb-2 px-4">
                <div className="w-full relative h-[140px]">
                  {salesTrend.length === 0 ? (
                    <div className="absolute inset-0 flex justify-center items-center text-xs text-slate-400">No chart data</div>
                  ) : (
                    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Y Axis Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                        const y = svgHeight - (ratio * (svgHeight - 60)) - 20;
                        const amt = Math.round(ratio * maxTrendAmount);
                        return (
                          <g key={idx} className="opacity-40">
                            <line x1="20" y1={y} x2={svgWidth - 20} y2={y} stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="3 3" />
                            <text x="25" y={y - 3} className="text-[8px] font-bold fill-slate-400">Rs {amt.toLocaleString()}</text>
                          </g>
                        );
                      })}

                      {/* Area Path */}
                      <path d={areaPathD} fill="url(#chartGradient)" />

                      {/* Line Path */}
                      <path d={linePathD} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                      {/* Interactive Point Markers */}
                      {chartPoints.map((p, idx) => (
                        <g key={idx} className="group cursor-pointer">
                          <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                          {/* Value display on top of point */}
                          <text x={p.x} y={p.y - 7} textAnchor="middle" className="text-[8px] font-black fill-slate-700 bg-white opacity-0 group-hover:opacity-100 transition-opacity">
                            Rs {Math.round(p.amount).toLocaleString()}
                          </text>
                          {/* Bottom X Axis Labels */}
                          <text x={p.x} y={svgHeight - 3} textAnchor="middle" className="text-[8.5px] font-bold fill-slate-500">
                            {p.label}
                          </text>
                        </g>
                      ))}
                    </svg>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Category Breakouts Bar Chart */}
            <Card className="w-full min-w-0 lg:col-span-4 shadow-2xs border-slate-200 rounded-2xl bg-white flex flex-col justify-between">
              <CardHeader className="pb-1 pt-3.5 px-4">
                <CardTitle className="text-sm font-black text-slate-800">{t("category_breakdown")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-2 pb-3 px-4 flex-1 flex flex-col justify-center">
                {categorySales.length === 0 ? (
                  <p className="text-xs text-slate-400 font-semibold py-6 text-center">{t("no_category_sales")}</p>
                ) : (
                  categorySales.map((cat, idx) => {
                    const maxVal = categorySales[0].value || 1;
                    const pct = (cat.value / maxVal) * 100;
                    const colors = [
                      "bg-blue-600",
                      "bg-indigo-600",
                      "bg-emerald-600",
                      "bg-amber-600"
                    ];
                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span className="truncate pr-2">{cat.name}</span>
                          <span>Rs {Math.round(cat.value).toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${colors[idx % colors.length]}`} 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom Operational Panels */}
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
            
            {/* Left Box: Recent Transactions */}
            <Card className="w-full min-w-0 lg:col-span-7 shadow-2xs border-slate-200 rounded-2xl bg-white">
              <CardHeader className="pb-1.5 pt-3.5 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black text-slate-800">{t("recent_transactions")}</CardTitle>
                <Link href="/dashboard/sales" className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-0.5">
                  {t("view_ledger")} <ArrowUpRight size={13} />
                </Link>
              </CardHeader>
              <CardContent className="pt-1 pb-3 px-3">
                <div className="divide-y divide-slate-100">
                  {recentTx.length === 0 ? (
                    <p className="text-xs text-slate-400 font-semibold py-6 text-center">
                      {t("no_invoices_recorded")}
                    </p>
                  ) : (
                    recentTx.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-2 hover:bg-slate-50/80 rounded-lg px-2 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                            <span className="text-[9px] font-black text-slate-600 uppercase">INV</span>
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-extrabold text-slate-800 capitalize truncate max-w-[120px] sm:max-w-[200px]">
                              {tx.customerName}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-medium">
                              {formatDateTime(tx.date, timezone)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            tx.paymentMode === "credit" 
                              ? "bg-rose-50 text-rose-700 border border-rose-100" 
                              : tx.paymentMode === "card" 
                                ? "bg-amber-50 text-amber-700 border border-amber-100" 
                                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}>
                            {tx.paymentMode === "credit" ? t("udhaar_label") : tx.paymentMode}
                          </span>
                          <span className="text-xs font-black text-slate-800 text-right min-w-[65px]">
                            Rs {Math.round(tx.amount).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right Box: Low Stock Warnings & System Status */}
            <Card className="w-full min-w-0 lg:col-span-5 shadow-2xs border-slate-200 rounded-2xl bg-white flex flex-col justify-between">
              <CardHeader className="pb-1.5 pt-3.5 px-4">
                <CardTitle className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle className="text-amber-500" size={16} /> {t("critical_stock_alerts")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between gap-3 pt-1 pb-3 px-3">
                
                {/* Warnings List */}
                <div className="space-y-1.5">
                  {lowStockAlerts.length === 0 ? (
                    <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-100 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                      {t("all_stock_healthy")}
                    </div>
                  ) : (
                    lowStockAlerts.slice(0, 4).map(prod => (
                      <div key={prod.id} className="flex justify-between items-center p-2 bg-slate-50 border border-slate-200/60 rounded-lg">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-slate-800 truncate">{prod.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold">{t("min_level")}: {prod.min_stock_level} {prod.unit || "units"}</p>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          prod.current_stock <= 0
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {prod.current_stock} {prod.unit || t("left_units")}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Database cloud status */}
                <div className="p-2.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-[11px] font-bold flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      {t("supabase_cloud_sync")}
                    </h4>
                    <p className="text-[9px] text-slate-400">{t("data_syncing_secure")}</p>
                  </div>
                  <Link href="/dashboard/backup" className="text-[9px] text-blue-400 hover:text-blue-300 font-black uppercase">
                    {t("backups_btn")}
                  </Link>
                </div>

              </CardContent>
            </Card>

            {industryType === "pharmacy" && (
              <Card className="w-full min-w-0 lg:col-span-12 rounded-2xl border-orange-100 shadow-2xs bg-white overflow-hidden">
                <CardHeader className="bg-orange-50/50 border-b border-orange-100 py-2 px-3 text-xs flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-black text-orange-900 flex items-center gap-1.5">
                      <AlertTriangle className="text-orange-500" size={14} />
                      {t("near_expiry_alerts")}
                    </CardTitle>
                    <p className="text-[10px] text-orange-600/80 font-medium">{t("expiring_60_days")}</p>
                  </div>
                  <Link href="/dashboard/products?tab=products">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-orange-600 hover:bg-orange-100 font-bold px-2 rounded">
                      {t("check_all")}
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent className="p-0">
                  {nearExpiryAlerts.length === 0 ? (
                    <div className="py-6 px-4 text-center flex flex-col items-center justify-center">
                      <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center mb-1.5">
                        <ShoppingBag className="text-emerald-500" size={15} />
                      </div>
                      <p className="text-xs text-emerald-600 font-semibold">{t("no_near_expiry")}</p>
                      <p className="text-[10px] text-slate-400">Stock is fresh.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-orange-50">
                      {nearExpiryAlerts.map(alert => {
                        const daysLeft = Math.ceil((new Date(alert.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                        const isExpired = daysLeft < 0;
                        return (
                          <div key={alert.id} className="p-2.5 px-4 flex items-center justify-between hover:bg-orange-50/30 transition-colors">
                            <div className="flex gap-2.5 items-center">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[9px] ${isExpired ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                {isExpired ? 'EXP' : `${daysLeft}d`}
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{alert.product_name}</h4>
                                <div className="flex gap-2 text-[9px] text-slate-500 font-medium">
                                  <span>Batch: <span className="text-slate-700">{alert.batch_number}</span></span>
                                  <span>•</span>
                                  <span>Stock: <span className="text-slate-700">{alert.stock_quantity}</span></span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isExpired ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                                {formatDateTime(alert.expiry_date, timezone)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

          </div>
        </>
      )}

    </div>
  );
}
