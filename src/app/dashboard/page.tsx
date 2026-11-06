"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, CreditCard, DollarSign, Users, Loader2, 
  TrendingUp, AlertTriangle, ArrowUpRight, ShoppingBag, 
  PlusCircle, FileText, ArrowRightLeft, UserPlus, Wallet,
  ChevronDown, Truck, Scale, TrendingDown, Percent, Boxes, Coins, ShieldAlert,
  Bike, PieChart, CalendarCheck, CheckCircle2, Clock, UtensilsCrossed, UserCheck, Sparkles
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
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
import { DashboardFloatingQuickActions } from "@/components/dashboard/DashboardFloatingQuickActions";
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

type TopSellingItem = {
  name: string;
  quantity: number;
  revenue: number;
  category: string;
};

type RiderFleetItem = {
  id: string;
  name: string;
  role: string;
  phone?: string | null;
  isOnRide: boolean;
  activeOrder?: any;
};

type StaffAttendanceItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
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

  const [showAuditCards, setShowAuditCards] = useState(false);
  const [rawExpenses, setRawExpenses] = useState<any[]>([]);
  const [rawCashAccounts, setRawCashAccounts] = useState<any[]>([]);
  const [rawAllParties, setRawAllParties] = useState<any[]>([]);

  const [auditStats, setAuditStats] = useState({
    accountsPayable: 0,
    accountsPayableCount: 0,
    netWorkingCapital: 0,
    totalExpenses: 0,
    grossProfit: 0,
    grossMarginPercent: 35,
    cashInHand: 0,
    digitalRevenue: 0,
    inventoryCostValue: 0,
    lowStockCount: 0,
    averageOrderValue: 0,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dashboard_show_audit_cards");
      if (saved === "true") {
        setShowAuditCards(true);
      }
    }
  }, []);

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
  const [topSellingItems, setTopSellingItems] = useState<TopSellingItem[]>([]);
  const [pieChartTab, setPieChartTab] = useState<"profit" | "category" | "products">("profit");
  const [rawStaffList, setRawStaffList] = useState<any[]>([]);
  const [rawActiveDeliveries, setRawActiveDeliveries] = useState<any[]>([]);
  const [ridersFleet, setRidersFleet] = useState<RiderFleetItem[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<StaffAttendanceItem[]>([]);

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

          toast.message("Offline mode - dashboard using cached data", {
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
        partiesRes,
        recentRes,
        productsRes,
        expiryRes,
        recentItemsRes,
        showroomVehiclesRes,
        showroomInstallmentsRes,
        showroomPartiesRes,
        expensesRes,
        cashAccountsRes,
        staffRes,
        activeDeliveriesRes,
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select("total_amount, paid_amount, created_at, status, payment_mode, party_id")
          .eq("shop_id", shopId)
          .eq("is_voided", false)
          .neq("status", "draft"),
        supabase
          .from("parties")
          .select("id, name, type, current_balance, created_at")
          .eq("shop_id", shopId),
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
          .limit(8),
        supabase
          .from("products")
          .select("id, name, current_stock, min_stock_level, unit, purchase_price_single, sale_price_single")
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
        supabase
          .from("expenses")
          .select("id, amount, created_at")
          .eq("shop_id", shopId)
          .then((r: any) => r, () => ({ data: [], error: null })),
        supabase
          .from("cash_accounts")
          .select("id, name, current_balance, type")
          .eq("shop_id", shopId)
          .then((r: any) => r, () => ({ data: [], error: null })),
        supabase
          .from("user_profiles")
          .select("id, name, email, role, phone, permissions, is_offline")
          .eq("shop_id", shopId)
          .order("name")
          .then((r: any) => r, () => ({ data: [], error: null })),
        supabase
          .from("invoices")
          .select("id, invoice_number, status, payment_mode, service_type, rider_id, total_amount, created_at")
          .eq("shop_id", shopId)
          .eq("is_voided", false)
          .not("rider_id", "is", null)
          .in("status", ["pending", "preparing", "ready", "delivered", "out_for_delivery"])
          .then((r: any) => r, () => ({ data: [], error: null })),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (partiesRes.error) throw partiesRes.error;
      if (recentRes.error) throw recentRes.error;

      const allParties = partiesRes.data || [];
      const customersOnly = allParties.filter((p: any) => p.type === "customer" || !p.type);
      setRawInvoices(invoicesRes.data || []);
      setRawCustomers(customersOnly);
      setRawAllParties(allParties);
      setRawRecent(recentRes.data || []);
      setRawProducts(productsRes.data || []);
      setRawExpiry(expiryRes.data || []);
      setRawRecentItems(recentItemsRes.data || []);
      setRawShowroomVehicles(showroomVehiclesRes.data || []);
      setRawShowroomInstallments(showroomInstallmentsRes.data || []);
      setRawShowroomParties(showroomPartiesRes.data || []);
      setRawExpenses(expensesRes?.data || []);
      setRawCashAccounts(cashAccountsRes?.data || []);
      setRawStaffList(staffRes?.data || []);
      setRawActiveDeliveries(activeDeliveriesRes?.data || []);

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

    // ── CA Audit & Executive Controls Calculations ───────────────────────
    // 1. Accounts Payable (money owed to suppliers/vendors)
    const suppliers = (rawAllParties || []).filter((p: any) => p.type === "supplier");
    const accountsPayable = suppliers
      .filter((s: any) => safeNum(s.current_balance) > 0)
      .reduce((sum: number, s: any) => sum + safeNum(s.current_balance), 0);
    const accountsPayableCount = suppliers.filter((s: any) => safeNum(s.current_balance) > 0).length;

    // 2. Net Working Capital (Accounts Receivable - Accounts Payable)
    const netWorkingCapital = activeUdhaar - accountsPayable;

    // 3. Operating Expenses logged in selected timeframe
    const totalExpenses = (rawExpenses || [])
      .filter((e: any) => isInTimeframe(e.created_at, timeFilter))
      .reduce((sum: number, e: any) => sum + safeNum(e.amount), 0);

    // 4. Total Inventory Asset Valuation at Cost (stock * purchase_cost)
    const inventoryCostValue = (rawProducts || []).reduce(
      (sum: number, p: any) =>
        sum +
        Math.max(0, safeNum(p.current_stock)) *
          safeNum(p.purchase_price_single || (p.sale_price_single ? p.sale_price_single * 0.7 : 0)),
      0
    );

    // 5. Critical Stockout / Low stock deficit count
    const lowStockCount = (rawProducts || []).filter(
      (p: any) => safeNum(p.current_stock) <= safeNum(p.min_stock_level)
    ).length;

    // 6. Digital & Card Volume (non-cash, non-credit)
    const digitalRevenue = realInvoices
      .filter((inv: any) => {
        const mode = (inv.payment_mode || "").toLowerCase();
        return (
          mode === "card" ||
          mode === "bank" ||
          mode === "online" ||
          mode === "digital" ||
          mode === "pos" ||
          mode === "qr"
        );
      })
      .reduce((sum: number, inv: any) => sum + safeNum(inv.total_amount), 0);

    // 7. Liquid Cash in Hand (till drawer cash)
    const cashInAccounts = (rawCashAccounts || [])
      .filter((a: any) => !a.type || a.type.toLowerCase() === "cash")
      .reduce((sum: number, a: any) => sum + safeNum(a.current_balance), 0);
    const cashCollected = realInvoices
      .filter((inv: any) => (inv.payment_mode || "").toLowerCase() === "cash")
      .reduce((sum: number, inv: any) => sum + safeNum(inv.total_amount), 0);
    const cashInHand = cashInAccounts > 0 ? cashInAccounts : Math.max(0, cashCollected - totalExpenses);

    // 8. Estimated Gross Profit & Margin %
    const estimatedCogs = totalRevenue * 0.65;
    const grossProfit = Math.max(0, totalRevenue - estimatedCogs);
    const grossMarginPercent = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 35;
    const averageOrderValue = totalInvoicesCount > 0 ? Math.round(totalRevenue / totalInvoicesCount) : 0;

    setAuditStats({
      accountsPayable,
      accountsPayableCount,
      netWorkingCapital,
      totalExpenses,
      grossProfit,
      grossMarginPercent,
      cashInHand,
      digitalRevenue,
      inventoryCostValue,
      lowStockCount,
      averageOrderValue,
    });

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
      .slice(0, 8);

    setRecentTx(combinedRecent);

    // 7. Top Selling Products, Deals & Packages
    const productMap: Record<string, TopSellingItem> = {};
    (filteredRecentItems || []).forEach((item: any) => {
      const prodName = item.products?.name || "Standard Item";
      const catName = item.products?.categories?.name || item.products?.category?.name || "General";
      if (!productMap[prodName]) {
        productMap[prodName] = { name: prodName, quantity: 0, revenue: 0, category: catName };
      }
      productMap[prodName].quantity += safeNum(item.quantity) || 1;
      productMap[prodName].revenue += safeNum(item.subtotal);
    });

    const sortedTopItems = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    setTopSellingItems(sortedTopItems);

    // 8. Staff Attendance Roster for Today
    const todayDateStr = new Date().toISOString().split("T")[0];
    const staffAtt = (rawStaffList || []).map((s: any) => {
      const perms = (s.permissions || {}) as any;
      const attMap = perms.attendance || {};
      const status = attMap[todayDateStr] || "present";
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role || "salesman",
        status,
      };
    });
    setStaffAttendance(staffAtt);

    // 9. Delivery Fleet & Rider Status
    const activeRiderOrderMap: Record<string, any> = {};
    (rawActiveDeliveries || []).forEach((inv: any) => {
      if (inv.rider_id) {
        activeRiderOrderMap[inv.rider_id] = inv;
      }
    });

    const candidateRiders = (rawStaffList || []).filter((s: any) => {
      const r = (s.role || "").toLowerCase();
      const n = (s.name || "").toLowerCase();
      return r.includes("rider") || r.includes("delivery") || n.includes("rider") || !!activeRiderOrderMap[s.id];
    });

    const finalRiders = (candidateRiders.length > 0 ? candidateRiders : (rawStaffList || []).slice(0, 4)).map((s: any) => {
      const activeOrder = activeRiderOrderMap[s.id];
      return {
        id: s.id,
        name: s.name,
        role: s.role || "Rider",
        phone: s.phone || s.permissions?.phone || null,
        isOnRide: !!activeOrder,
        activeOrder: activeOrder || null,
      };
    });
    setRidersFleet(finalRiders);

    // 10. Calculate 7-day sales trend (combines retail invoices + showroom vehicle sales)
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

  }, [rawInvoices, rawCustomers, rawRecent, rawProducts, rawExpiry, rawRecentItems, rawShowroomVehicles, rawShowroomInstallments, rawShowroomParties, rawStaffList, rawActiveDeliveries, timeFilter, industryType, shopId]);

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
      
      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-2.5 border-b border-slate-200/80 pb-2.5">
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto w-full sm:w-auto justify-end">
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
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <DollarSign size={14} className="text-blue-600 shrink-0" />
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                    {t("net_gross_revenue")}
                  </p>
                </div>
                <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                  Live
                </div>
              </div>
              <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1.5 truncate">
                Rs {stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1 truncate flex items-center gap-1">
                <TrendingUp size={12} className="text-blue-600 shrink-0" /> {stats.totalInvoicesCount} {t("invoices_recorded_ledger")}
              </p>
            </div>

            {/* Card 2: Active Udhaar */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CreditCard size={14} className="text-rose-600 shrink-0" />
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                    {t("outstanding_udhaar")}
                  </p>
                </div>
                <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 shrink-0">
                  Khata
                </div>
              </div>
              <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1.5 truncate">
                Rs {stats.activeUdhaar.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1 truncate flex items-center gap-1">
                <AlertTriangle size={12} className="text-rose-600 shrink-0" /> {stats.outstandingAccountsCount} {t("customer_accounts_pending")}
              </p>
            </div>

            {/* Card 3: Total Customers */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Users size={14} className="text-emerald-600 shrink-0" />
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                    {t("registered_parties")}
                  </p>
                </div>
                <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                  Profiles
                </div>
              </div>
              <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1.5 truncate">
                {stats.totalCustomers}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1 truncate flex items-center gap-1">
                <PlusCircle size={12} className="text-emerald-600 shrink-0" /> +{stats.newCustomersToday} {t("newly_registered_today")}
              </p>
            </div>

            {/* Card 4: Daily Invoices */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Activity size={14} className="text-amber-600 shrink-0" />
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                    {t("sales_transactions")}
                  </p>
                </div>
                <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 shrink-0">
                  Today
                </div>
              </div>
              <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1.5 truncate">
                +{stats.dailyInvoices}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1 truncate flex items-center gap-1">
                <TrendingUp size={12} className="text-amber-600 shrink-0" /> {t("daily_invoice_traffic")}
              </p>
            </div>
          </div>

          {/* Section Dropdown Bar: Expand / Collapse 8 Professional Audit Cards */}
          <div className="flex items-center justify-between px-1 py-1">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                Executive Audit & Financial Controls
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAuditCards((prev) => {
                  const next = !prev;
                  if (typeof window !== "undefined") {
                    localStorage.setItem("dashboard_show_audit_cards", String(next));
                  }
                  return next;
                });
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/90 shadow-2xs transition-all active:scale-95 cursor-pointer"
              aria-expanded={showAuditCards}
            >
              <p>{showAuditCards ? "Collapse Audit Cards" : "Expand 8 Audit Cards (CA Deck)"}</p>
              <ChevronDown
                size={14}
                className={`text-slate-500 transition-transform duration-200 ${
                  showAuditCards ? "rotate-180 text-sky-600" : ""
                }`}
              />
            </button>
          </div>

          {/* 8 Expanded Professional CA Financial & Audit Cards */}
          <AnimatePresence>
            {showAuditCards && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3.5 pt-0.5">
                  {/* Audit Card 1: Accounts Payable */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Truck size={14} className="text-slate-500 shrink-0" />
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                          Accounts Payable (AP)
                        </p>
                      </div>
                      <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 shrink-0">
                        Liabilities
                      </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1.5 truncate">
                      Rs {auditStats.accountsPayable.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                      {auditStats.accountsPayableCount} vendor balances pending
                    </p>
                  </div>

                  {/* Audit Card 2: Net Working Capital */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Scale size={14} className="text-slate-500 shrink-0" />
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                          Net Working Capital
                        </p>
                      </div>
                      <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                        Solvency
                      </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1.5 truncate">
                      Rs {auditStats.netWorkingCapital.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                      Receivables vs Vendor Payables
                    </p>
                  </div>

                  {/* Audit Card 3: Operating Expenses */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <TrendingDown size={14} className="text-slate-500 shrink-0" />
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                          Operating Expenses
                        </p>
                      </div>
                      <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-100 shrink-0">
                        Opex
                      </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1.5 truncate">
                      Rs {auditStats.totalExpenses.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                      Logged operational costs & overheads
                    </p>
                  </div>

                  {/* Audit Card 4: Estimated Gross Profit */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Percent size={14} className="text-slate-500 shrink-0" />
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                          Est. Gross Profit
                        </p>
                      </div>
                      <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                        {auditStats.grossMarginPercent}% Margin
                      </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1.5 truncate">
                      Rs {auditStats.grossProfit.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                      Turnover net of estimated goods cost
                    </p>
                  </div>

                  {/* Audit Card 5: Liquid Cash in Hand */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Coins size={14} className="text-slate-500 shrink-0" />
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                          Cash in Hand & Till
                        </p>
                      </div>
                      <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                        Liquidity
                      </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1.5 truncate">
                      Rs {auditStats.cashInHand.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                      Physical liquid cash in till/registers
                    </p>
                  </div>

                  {/* Audit Card 6: Digital & Card Volume */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CreditCard size={14} className="text-slate-500 shrink-0" />
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                          Digital & Card Volume
                        </p>
                      </div>
                      <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100 shrink-0">
                        Bank / POS
                      </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1.5 truncate">
                      Rs {auditStats.digitalRevenue.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                      Card, Online & QR collections
                    </p>
                  </div>

                  {/* Audit Card 7: Total Inventory Valuation at Cost */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Boxes size={14} className="text-slate-500 shrink-0" />
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                          Inventory Asset Value
                        </p>
                      </div>
                      <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-100 shrink-0">
                        Asset
                      </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1.5 truncate">
                      Rs {auditStats.inventoryCostValue.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                      Current warehouse stock worth at cost
                    </p>
                  </div>

                  {/* Audit Card 8: Critical Stock Deficit */}
                  <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ShieldAlert size={14} className="text-slate-500 shrink-0" />
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                          Critical Stock Alerts
                        </p>
                      </div>
                      <div className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${
                        auditStats.lowStockCount > 0
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}>
                        {auditStats.lowStockCount > 0 ? "Reorder Needed" : "Optimal"}
                      </div>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1.5 truncate">
                      {auditStats.lowStockCount} Products
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                      Items below minimum safety threshold
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

                    {/* Row 1: Sales Trend Analysis + Animated Donut Chart (CA P&L, Categories, Top Deals) & Delivery Fleet (Riders) */}
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
            
            {/* Left: Sales Trend SVG Area Chart & CA Executive Financial Strip */}
            <Card className="w-full min-w-0 lg:col-span-7 shadow-2xs border-slate-200 rounded-2xl bg-white overflow-hidden flex flex-col justify-between">
              <CardHeader className="pb-2 pt-3.5 px-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <TrendingUp className="text-blue-600" size={16} /> {t("sales_trend_analysis")}
                  </CardTitle>
                  <div className="text-[9px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-md uppercase self-start sm:self-auto">
                    {t("last_7_days")}
                  </div>
                </div>

                {/* CA Executive P&L Financial Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 mt-2">
                  <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Gross Sales</p>
                    <p className="text-xs font-black text-slate-900 mt-0.5">Rs {stats.totalRevenue.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Est. COGS</p>
                    <p className="text-xs font-black text-amber-700 mt-0.5">Rs {Math.round(stats.totalRevenue * 0.65).toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Gross Profit</p>
                    <p className="text-xs font-black text-emerald-700 mt-0.5">Rs {auditStats.grossProfit.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Net Margin</p>
                    <p className="text-xs font-black text-indigo-700 mt-0.5">{auditStats.grossMarginPercent}%</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col justify-end pt-1 pb-3 px-4">
                <div className="w-full relative h-[145px]">
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
                          <text x={p.x} y={p.y - 7} textAnchor="middle" className="text-[8px] font-black fill-slate-700 bg-white opacity-0 group-hover:opacity-100 transition-opacity">
                            Rs {Math.round(p.amount).toLocaleString()}
                          </text>
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

            {/* Right: Modern Animated Donut / Pie Chart + Delivery Fleet (Riders) */}
            <Card className="w-full min-w-0 lg:col-span-5 shadow-2xs border-slate-200 rounded-2xl bg-white flex flex-col justify-between">
              <CardHeader className="pb-2 pt-3.5 px-4 border-b border-slate-100">
                <div className="flex items-center justify-between gap-1.5">
                  <CardTitle className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                    <PieChart className="text-purple-600" size={16} /> Financial & Sales Distribution
                  </CardTitle>
                </div>

                {/* Tab Switcher: P&L vs Category vs Top Products */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg mt-2">
                  <button
                    type="button"
                    onClick={() => setPieChartTab("profit")}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                      pieChartTab === "profit"
                        ? "bg-white text-slate-900 shadow-2xs font-black"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    CA P&L Split
                  </button>
                  <button
                    type="button"
                    onClick={() => setPieChartTab("category")}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                      pieChartTab === "category"
                        ? "bg-white text-slate-900 shadow-2xs font-black"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Categories
                  </button>
                  <button
                    type="button"
                    onClick={() => setPieChartTab("products")}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                      pieChartTab === "products"
                        ? "bg-white text-slate-900 shadow-2xs font-black"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Top Deals
                  </button>
                </div>
              </CardHeader>

              <CardContent className="pt-3 pb-3 px-4 flex-1 flex flex-col justify-between space-y-3">
                {/* SVG Donut Chart + Legend */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  {/* Modern Donut SVG */}
                  <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      {/* Background circle track */}
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />

                      {/* Donut Segments */}
                      {pieChartTab === "profit" && (() => {
                        const total = Math.max(stats.totalRevenue, 1);
                        const cogsVal = Math.round(stats.totalRevenue * 0.65);
                        const profitVal = auditStats.grossProfit;
                        const expVal = Math.min(auditStats.totalExpenses, stats.totalRevenue);
                        const circ = 2 * Math.PI * 38; // ~238.76

                        const pProfit = profitVal / total;
                        const pCogs = cogsVal / total;
                        const pExp = expVal / total;

                        const offProfit = 0;
                        const offCogs = -(pProfit * circ);
                        const offExp = -((pProfit + pCogs) * circ);

                        return (
                          <>
                            {/* Profit Segment */}
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              fill="transparent"
                              stroke="#10b981"
                              strokeWidth="12"
                              strokeDasharray={`${pProfit * circ} ${circ}`}
                              strokeDashoffset={offProfit}
                              className="transition-all duration-500"
                            />
                            {/* COGS Segment */}
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              fill="transparent"
                              stroke="#f59e0b"
                              strokeWidth="12"
                              strokeDasharray={`${pCogs * circ} ${circ}`}
                              strokeDashoffset={offCogs}
                              className="transition-all duration-500"
                            />
                            {/* Expenses Segment */}
                            {pExp > 0 && (
                              <circle
                                cx="50"
                                cy="50"
                                r="38"
                                fill="transparent"
                                stroke="#f43f5e"
                                strokeWidth="12"
                                strokeDasharray={`${pExp * circ} ${circ}`}
                                strokeDashoffset={offExp}
                                className="transition-all duration-500"
                              />
                            )}
                          </>
                        );
                      })()}

                      {pieChartTab === "category" && (() => {
                        const total = categorySales.reduce((sum, c) => sum + c.value, 0) || 1;
                        const circ = 2 * Math.PI * 38;
                        const colors = ["#3b82f6", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b"];
                        let cumm = 0;

                        return categorySales.map((cat, idx) => {
                          const pct = cat.value / total;
                          const offset = -(cumm * circ);
                          cumm += pct;
                          return (
                            <circle
                              key={cat.name}
                              cx="50"
                              cy="50"
                              r="38"
                              fill="transparent"
                              stroke={colors[idx % colors.length]}
                              strokeWidth="12"
                              strokeDasharray={`${pct * circ} ${circ}`}
                              strokeDashoffset={offset}
                              className="transition-all duration-500"
                            />
                          );
                        });
                      })()}

                      {pieChartTab === "products" && (() => {
                        const total = topSellingItems.reduce((sum, p) => sum + p.revenue, 0) || 1;
                        const circ = 2 * Math.PI * 38;
                        const colors = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];
                        let cumm = 0;

                        return topSellingItems.map((prod, idx) => {
                          const pct = prod.revenue / total;
                          const offset = -(cumm * circ);
                          cumm += pct;
                          return (
                            <circle
                              key={prod.name}
                              cx="50"
                              cy="50"
                              r="38"
                              fill="transparent"
                              stroke={colors[idx % colors.length]}
                              strokeWidth="12"
                              strokeDasharray={`${pct * circ} ${circ}`}
                              strokeDashoffset={offset}
                              className="transition-all duration-500"
                            />
                          );
                        });
                      })()}
                    </svg>

                    {/* Donut Center Display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-[11px] font-black text-slate-900 leading-none">
                        {pieChartTab === "profit" 
                          ? `${auditStats.grossMarginPercent}%` 
                          : pieChartTab === "category" 
                            ? `${categorySales.length}` 
                            : `${topSellingItems.length}`}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 leading-none">
                        {pieChartTab === "profit" ? "Margin" : pieChartTab === "category" ? "Categories" : "Deals"}
                      </p>
                    </div>
                  </div>

                  {/* Donut Slices Breakdown Details */}
                  <div className="flex-1 w-full space-y-1.5 min-w-0">
                    {pieChartTab === "profit" && (
                      <>
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                            <p className="font-bold text-slate-700 truncate">Est. Gross Profit</p>
                          </div>
                          <p className="font-black text-emerald-700 shrink-0">Rs {auditStats.grossProfit.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                            <p className="font-bold text-slate-700 truncate">Cost of Goods (COGS)</p>
                          </div>
                          <p className="font-black text-amber-700 shrink-0">Rs {Math.round(stats.totalRevenue * 0.65).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                            <p className="font-bold text-slate-700 truncate">Operating Expenses</p>
                          </div>
                          <p className="font-black text-rose-700 shrink-0">Rs {auditStats.totalExpenses.toLocaleString()}</p>
                        </div>
                      </>
                    )}

                    {pieChartTab === "category" && (
                      categorySales.length === 0 ? (
                        <p className="text-[11px] text-slate-400 font-medium py-2 text-center">No category sales recorded yet</p>
                      ) : (
                        categorySales.slice(0, 3).map((cat, idx) => {
                          const colors = ["bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-emerald-500"];
                          return (
                            <div key={cat.name} className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className={`h-2 w-2 rounded-full ${colors[idx % colors.length]} shrink-0`} />
                                <p className="font-bold text-slate-700 truncate">{cat.name}</p>
                              </div>
                              <p className="font-black text-slate-900 shrink-0">Rs {Math.round(cat.value).toLocaleString()}</p>
                            </div>
                          );
                        })
                      )
                    )}

                    {pieChartTab === "products" && (
                      topSellingItems.length === 0 ? (
                        <p className="text-[11px] text-slate-400 font-medium py-2 text-center">No product orders recorded yet</p>
                      ) : (
                        topSellingItems.slice(0, 3).map((prod, idx) => {
                          const colors = ["bg-indigo-500", "bg-cyan-500", "bg-emerald-500"];
                          return (
                            <div key={prod.name} className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className={`h-2 w-2 rounded-full ${colors[idx % colors.length]} shrink-0`} />
                                <p className="font-bold text-slate-700 truncate">{prod.name}</p>
                              </div>
                              <p className="font-black text-slate-900 shrink-0">
                                {prod.quantity} sold (Rs {Math.round(prod.revenue).toLocaleString()})
                              </p>
                            </div>
                          );
                        })
                      )
                    )}
                  </div>
                </div>

                {/* Delivery Fleet / Rider Live Status Monitor */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Bike size={14} className="text-sky-600" />
                      <p className="text-[11px] font-black text-slate-800">Delivery Fleet (Riders)</p>
                    </div>
                    <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">
                      {ridersFleet.filter(r => r.isOnRide).length} Delivering • {ridersFleet.filter(r => !r.isOnRide).length} Free
                    </div>
                  </div>

                  <div className="space-y-1 max-h-[85px] overflow-y-auto scrollbar-none">
                    {ridersFleet.length === 0 ? (
                      <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                        <p className="text-[10px] text-slate-400 font-medium">
                          No delivery riders configured yet. Staff can be assigned as riders in POS delivery mode.
                        </p>
                      </div>
                    ) : (
                      ridersFleet.map((rider) => (
                        <div key={rider.id} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50/80 hover:bg-slate-100/80 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-5 w-5 rounded-md bg-slate-200 flex items-center justify-center text-[9px] font-black text-slate-700 shrink-0">
                              {rider.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{rider.name}</p>
                              {rider.phone ? (
                                <p className="text-[9px] text-slate-400 truncate">{rider.phone}</p>
                              ) : null}
                            </div>
                          </div>

                          <div>
                            {rider.isOnRide ? (
                              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                On Delivery
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Available
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Row 2: Recent Transactions + Staff Attendance in One Row */}
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
            
            {/* Left: Recent Invoices & Transactions */}
            <Card className="w-full min-w-0 lg:col-span-7 shadow-2xs border-slate-200 rounded-2xl bg-white flex flex-col justify-between">
              <CardHeader className="pb-1.5 pt-3.5 px-4 flex flex-row items-center justify-between border-b border-slate-100">
                <CardTitle className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <FileText className="text-blue-600" size={15} /> {t("recent_transactions")}
                </CardTitle>
                <Link href="/dashboard/sales" className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-0.5">
                  {t("view_ledger")} <ArrowUpRight size={13} />
                </Link>
              </CardHeader>
              <CardContent className="pt-2 pb-3 px-3 flex-1 flex flex-col justify-between">
                <div className="divide-y divide-slate-100">
                  {recentTx.length === 0 ? (
                    <p className="text-xs text-slate-400 font-semibold py-8 text-center">
                      {t("no_invoices_recorded")}
                    </p>
                  ) : (
                    recentTx.slice(0, 7).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-2 hover:bg-slate-50/80 rounded-lg px-2 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                            <div className="text-[9px] font-black text-slate-600 uppercase">INV</div>
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
                          <div className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            tx.paymentMode === "credit" 
                              ? "bg-rose-50 text-rose-700 border border-rose-100" 
                              : tx.paymentMode === "card" 
                                ? "bg-amber-50 text-amber-700 border border-amber-100" 
                                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}>
                            {tx.paymentMode === "credit" ? t("udhaar_label") : tx.paymentMode}
                          </div>
                          <div className="text-xs font-black text-slate-800 text-right min-w-[65px]">
                            Rs {Math.round(tx.amount).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right: Staff Attendance & Shift Roster */}
            <Card className="w-full min-w-0 lg:col-span-5 shadow-2xs border-slate-200 rounded-2xl bg-white flex flex-col justify-between">
              <CardHeader className="pb-2 pt-3.5 px-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                    <CalendarCheck className="text-emerald-600" size={16} /> Staff Attendance & Shift Roster
                  </CardTitle>
                  <Link href="/dashboard/staff?tab=attendance" className="text-blue-600 hover:text-blue-700 text-[11px] font-bold flex items-center gap-0.5">
                    Manage <ArrowUpRight size={12} />
                  </Link>
                </div>

                {/* Quick Attendance Counters */}
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                    Present: {staffAttendance.filter(s => s.status === "present" || s.status === "late").length}
                  </div>
                  <div className="text-[9px] font-black px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100">
                    Absent: {staffAttendance.filter(s => s.status === "absent").length}
                  </div>
                  <div className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
                    Leave: {staffAttendance.filter(s => s.status === "leave" || s.status === "halfday").length}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-2 pb-3 px-3 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  {staffAttendance.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-xs text-slate-400 font-semibold">No staff profiles registered yet.</p>
                      <Link href="/dashboard/staff" className="inline-block mt-2 text-xs font-bold text-blue-600 hover:underline">
                        + Add Staff Members
                      </Link>
                    </div>
                  ) : (
                    staffAttendance.slice(0, 6).map((staff) => (
                      <div key={staff.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 hover:bg-slate-100/70 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-black text-xs shrink-0">
                            {staff.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-slate-800 truncate">{staff.name}</p>
                            <p className="text-[9px] text-slate-400 capitalize font-medium">{staff.role}</p>
                          </div>
                        </div>

                        <div>
                          {staff.status === "present" && (
                            <div className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Present
                            </div>
                          )}
                          {staff.status === "late" && (
                            <div className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              Late
                            </div>
                          )}
                          {staff.status === "halfday" && (
                            <div className="text-[9px] font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                              Half Day
                            </div>
                          )}
                          {staff.status === "absent" && (
                            <div className="text-[9px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                              Absent
                            </div>
                          )}
                          {staff.status === "leave" && (
                            <div className="text-[9px] font-black px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                              On Leave
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 mt-2 flex items-center justify-between text-[10px] text-slate-400 font-medium px-1">
                  <p>Daily Roster Active</p>
                  <p>Auto Sync Enabled</p>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Row 3: Critical Stock Deficit Alarms & Cloud Backup Status */}
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
            <Card className="w-full min-w-0 lg:col-span-12 shadow-2xs border-slate-200 rounded-2xl bg-white">
              <CardHeader className="pb-1.5 pt-3 px-4 flex flex-row items-center justify-between border-b border-slate-100">
                <CardTitle className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle className="text-amber-500" size={14} /> {t("critical_stock_alerts")}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></div>
                  <p className="text-[10px] text-slate-400 font-bold">{t("supabase_cloud_sync")}</p>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {lowStockAlerts.length === 0 ? (
                    <div className="col-span-full p-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-100 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></div>
                      <p>{t("all_stock_healthy")}</p>
                    </div>
                  ) : (
                    lowStockAlerts.slice(0, 4).map(prod => (
                      <div key={prod.id} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-slate-800 truncate">{prod.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold">{t("min_level")}: {prod.min_stock_level} {prod.unit || "units"}</p>
                        </div>
                        <div className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          prod.current_stock <= 0
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {prod.current_stock} {prod.unit || t("left_units")}
                        </div>
                      </div>
                    ))
                  )}
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
                                  <div>Batch: <div className="text-slate-700">{alert.batch_number}</div></div>
                                  <div>•</div>
                                  <div>Stock: <div className="text-slate-700">{alert.stock_quantity}</div></div>
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                              <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isExpired ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                                {formatDateTime(alert.expiry_date, timezone)}
                              </div>
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

      <DashboardFloatingQuickActions />
    </div>
  );
}