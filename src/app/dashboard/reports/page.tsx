"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Calculator, Download, TrendingDown,
  ShoppingBag, Truck, Package, Users, ChevronRight,
  CreditCard, Layers, Clock, RotateCcw, AlertTriangle,
  Pill, ThermometerSnowflake, BookOpen, Stethoscope,
  Building2, Zap, DollarSign, UserX, ShieldAlert,
  CheckCircle, FileText, ArrowUpDown, Filter, Sparkles, MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SubscriptionBlocker } from "@/components/dashboard/SubscriptionBlocker";
import { AIDeadStockWidget } from "@/components/dashboard/AIDeadStockWidget";
import { saveReportSnapshot, getReportSnapshot, isBrowserOffline } from "@/lib/sync/offlineReportsEngine";
import { isControlledDrug } from "@/lib/pharmacy/controlledDrugs";

export type ReportTab =
  | "sales"
  | "sales_by_product"
  | "sales_by_customer"
  | "sales_by_payment"
  | "hourly_rush"
  | "returns_damage"
  | "pharmacy_controlled"
  | "pharmacy_expiry_aging"
  | "pharmacy_temperature"
  | "pharmacy_short_book"
  | "pharmacy_doctors"
  | "pharma_company_margin"
  | "inventory"
  | "dead_stock_abc"
  | "purchases"
  | "purchases_by_supplier"
  | "expenses"
  | "expense_category"
  | "pl"
  | "balance_sheet"
  | "tax"
  | "khata"
  | "inactive_khata"
  | "aging"
  | "salesman"
  | "register_shifts";

export default function ReportsPage() {
  const { shopId, userName, shopName, allowReports, industryType } = useShop();
  const { t, language } = useLanguage();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<ReportTab>(() => {
    return industryType === "pharmacy" ? "pharmacy_controlled" : "sales";
  });
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // Core Data States
  const [salesData, setSalesData] = useState<any[]>([]);
  const [purchasesData, setPurchasesData] = useState<any[]>([]);
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [partiesData, setPartiesData] = useState<any[]>([]);
  const [cashAccountsData, setCashAccountsData] = useState<any[]>([]);
  const [sessionsData, setSessionsData] = useState<any[]>([]);
  const [usersData, setUsersData] = useState<any[]>([]);

  // Advanced & Pharmacy Data States
  const [controlledLogs, setControlledLogs] = useState<any[]>([]);
  const [productBatches, setProductBatches] = useState<any[]>([]);
  const [temperatureLogs, setTemperatureLogs] = useState<any[]>([]);
  const [shortBookItems, setShortBookItems] = useState<any[]>([]);
  const [doctorCommissions, setDoctorCommissions] = useState<any[]>([]);

  // Comparison State
  const [comparePeriod, setComparePeriod] = useState<"none" | "previous">("none");
  const [compareSalesData, setCompareSalesData] = useState<any[]>([]);
  const [compareExpensesData, setCompareExpensesData] = useState<any[]>([]);

  const [plSummary, setPlSummary] = useState({
    revenue: 0, cogs: 0, expenses: 0, grossProfit: 0, netProfit: 0, marginPct: 0, discount: 0,
    hasCompare: false, compRevenue: 0, compNetProfit: 0, revDiffPct: 0, npDiffPct: 0
  });
  const [stockSummary, setStockSummary] = useState({
    totalItems: 0, totalQuantity: 0, valuationCost: 0, valuationRetail: 0,
    expectedProfit: 0, lowStockCount: 0
  });

  useEffect(() => {
    if (industryType !== "pharmacy" && (activeTab.startsWith("pharmacy_") || activeTab === "pharma_company_margin")) {
      setActiveTab("sales");
    }
  }, [industryType, activeTab]);

  useEffect(() => {
    if (shopId) fetchReportData();
  }, [shopId, activeTab, startDate, endDate, comparePeriod]);

  const fetchReportData = async () => {
    setLoading(true);
    const cacheKey = `reports_${shopId}_${activeTab}_${startDate}_${endDate}`;

    if (isBrowserOffline()) {
      const cached = getReportSnapshot(cacheKey);
      if (cached) {
        if (cached.data.productsData) setProductsData(cached.data.productsData);
        if (cached.data.salesData) setSalesData(cached.data.salesData);
        if (cached.data.purchasesData) setPurchasesData(cached.data.purchasesData);
        if (cached.data.expensesData) setExpensesData(cached.data.expensesData);
        if (cached.data.partiesData) setPartiesData(cached.data.partiesData);
        if (cached.data.cashAccountsData) setCashAccountsData(cached.data.cashAccountsData);
        toast.info("⚡ Viewing Offline Reports Snapshot");
        setLoading(false);
        return;
      }
    }

    try {
      const startDateTime = `${startDate}T00:00:00.000Z`;
      const endDateTime   = `${endDate}T23:59:59.999Z`;

      // Always fetch products (needed for COGS / valuation / ABC dead stock / brand margins)
      const { data: products, error: prodErr } = await supabase
        .from("products")
        .select(`id, name, note, purchase_price_single, sale_price_single, current_stock, min_stock_level, unit, brand_id, brands ( name ), formulations ( name ),
          product_variants ( id, packing_name, purchase_price, sale_price, stock_quantity )`)
        .eq("shop_id", shopId);
      if (prodErr) throw prodErr;
      setProductsData(products || []);

      const productCostDict: Record<string, number> = {};
      const variantCostDict: Record<string, number> = {};
      (products || []).forEach((p: any) => {
        productCostDict[p.id] = Number(p.purchase_price_single || 0);
        (p.product_variants || []).forEach((v: any) => { variantCostDict[v.id] = Number(v.purchase_price || 0); });
      });

      const needSales = [
        "sales", "sales_by_product", "sales_by_customer", "sales_by_payment",
        "hourly_rush", "returns_damage", "pharma_company_margin", "dead_stock_abc",
        "pl", "aging", "balance_sheet", "tax", "salesman", "inactive_khata"
      ].includes(activeTab);

      const needPurchases = ["purchases", "purchases_by_supplier", "pl", "aging"].includes(activeTab);
      const needExpenses  = ["expenses", "expense_category", "pl"].includes(activeTab);
      const needParties   = ["khata", "inactive_khata", "sales_by_customer", "purchases_by_supplier", "aging", "balance_sheet"].includes(activeTab);

      let fetchedSales: any[] = [];
      let fetchedPurchases: any[] = [];
      let fetchedExpenses: any[] = [];
      let fetchedParties: any[] = [];
      let fetchedAccounts: any[] = [];

      if (needSales) {
        const { data: sales, error: sErr } = await supabase
          .from("invoices")
          .select(`id, total_amount, paid_amount, status, payment_mode, created_at, party_id, tax_amount, discount, register_session_id, is_voided,
            parties ( name, phone ),
            invoice_items ( id, product_id, variant_id, quantity, unit_price, subtotal, purchase_price, products ( name, brand_id, brands ( name ) ) )`)
          .eq("shop_id", shopId)
          .gte("created_at", startDateTime).lte("created_at", endDateTime)
          .order("created_at", { ascending: false });
        if (sErr) throw sErr;

        fetchedSales = (sales || [])
          .filter((inv: any) => activeTab === "returns_damage" ? true : (inv.status !== "quotation" && inv.status !== "draft" && inv.payment_mode !== "quotation" && !inv.is_voided))
          .map((inv: any) => {
            let cogs = 0;
            (inv.invoice_items || []).forEach((it: any) => {
              const c = Number(it.purchase_price || 0) || (it.variant_id && variantCostDict[it.variant_id] ? variantCostDict[it.variant_id] : (productCostDict[it.product_id] || 0));
              cogs += c * Number(it.quantity || 0);
            });
            return { ...inv, cogs, profit: Number(inv.total_amount || 0) - cogs };
          });
        setSalesData(fetchedSales);
      }

      if (needPurchases) {
        const { data: purchases, error: pErr } = await supabase
          .from("purchase_orders")
          .select(`id, total_amount, status, created_at, supplier_id, parties ( name )`)
          .eq("shop_id", shopId)
          .gte("created_at", startDateTime).lte("created_at", endDateTime)
          .order("created_at", { ascending: false });
        if (pErr) throw pErr;
        fetchedPurchases = purchases || [];
        setPurchasesData(fetchedPurchases);
      }

      if (needExpenses) {
        const { data: expenses, error: eErr } = await supabase
          .from("expenses")
          .select("id, name, amount, expense_type, remarks, created_at")
          .eq("shop_id", shopId)
          .gte("created_at", startDateTime).lte("created_at", endDateTime)
          .order("created_at", { ascending: false });
        if (eErr) throw eErr;
        fetchedExpenses = expenses || [];
        setExpensesData(fetchedExpenses);
      }

      if (needParties) {
        const { data: parties, error: ptErr } = await supabase
          .from("parties")
          .select("id, name, phone, type, current_balance, created_at")
          .eq("shop_id", shopId)
          .order("name", { ascending: true });
        if (ptErr) throw ptErr;
        fetchedParties = parties || [];
        setPartiesData(fetchedParties);
      }

      if (["balance_sheet"].includes(activeTab)) {
        const { data: accs, error: accErr } = await supabase
          .from("cash_accounts")
          .select("id, name, current_balance")
          .eq("shop_id", shopId);
        if (accErr) throw accErr;
        fetchedAccounts = accs || [];
        setCashAccountsData(fetchedAccounts);
      }

      if (["salesman", "register_shifts"].includes(activeTab)) {
        try {
          const { data: sess } = await supabase
            .from("register_sessions")
            .select("*")
            .eq("shop_id", shopId)
            .order("opened_at", { ascending: false });
          setSessionsData(sess || []);
        } catch (e) {
          console.warn("register_sessions query notice:", e);
        }

        try {
          const { data: uData } = await supabase
            .from("user_profiles")
            .select("id, name");
          if (uData) setUsersData(uData || []);
        } catch (e) {
          console.warn("user_profiles query notice:", e);
        }
      }

      // Pharmacy Logs Fetching with Local/Cloud fallback
      if (activeTab === "pharmacy_controlled") {
        let merged: any[] = [];
        try {
          const { data: cLogs } = await supabase
            .from("pharmacy_controlled_logs")
            .select("*")
            .eq("shop_id", shopId)
            .gte("prescription_date", startDate)
            .lte("prescription_date", endDate)
            .order("prescription_date", { ascending: false });
          if (cLogs) merged = cLogs;
        } catch (e) {}

        try {
          const localStr = localStorage.getItem(`pharmacy_controlled_logs_${shopId}`);
          if (localStr) {
            const localArr = JSON.parse(localStr);
            const dbIds = new Set(merged.map((x: any) => x.id));
            localArr.forEach((l: any) => {
              if (!dbIds.has(l.id) && l.prescription_date >= startDate && l.prescription_date <= endDate) {
                merged.unshift(l);
              }
            });
          }
        } catch (e) {}
        setControlledLogs(merged);
      }

      if (activeTab === "pharmacy_expiry_aging") {
        try {
          const { data: batches } = await supabase
            .from("product_batches")
            .select("id, product_id, batch_number, expiry_date, stock_quantity, purchase_price, products ( name, unit, shelf_location, brands ( name ), sale_price_single )")
            .eq("shop_id", shopId)
            .gt("stock_quantity", 0)
            .order("expiry_date", { ascending: true });
          const formattedBatches = (batches || []).map((b: any) => ({
            ...b,
            quantity: b.stock_quantity ?? b.quantity ?? 0,
            sale_price: b.products?.sale_price_single ?? 0
          }));
          setProductBatches(formattedBatches);
        } catch (e) {
          console.warn("product_batches query notice:", e);
        }
      }

      if (activeTab === "pharmacy_temperature") {
        let merged: any[] = [];
        try {
          const { data: tLogs } = await supabase
            .from("pharmacy_temperature_logs")
            .select("*")
            .eq("shop_id", shopId)
            .gte("date", startDate)
            .lte("date", endDate)
            .order("date", { ascending: false });
          if (tLogs) merged = tLogs;
        } catch (e) {}

        try {
          const localStr = localStorage.getItem(`pharmacy_temp_logs_${shopId}`);
          if (localStr) {
            const localArr = JSON.parse(localStr);
            const dbIds = new Set(merged.map((x: any) => x.id));
            localArr.forEach((l: any) => {
              if (!dbIds.has(l.id) && l.date >= startDate && l.date <= endDate) {
                merged.unshift(l);
              }
            });
          }
        } catch (e) {}
        setTemperatureLogs(merged);
      }

      if (activeTab === "pharmacy_short_book") {
        let merged: any[] = [];
        try {
          const { data: sBook } = await supabase
            .from("pharmacy_short_book")
            .select("*")
            .eq("shop_id", shopId)
            .order("request_count", { ascending: false });
          if (sBook) merged = sBook;
        } catch (e) {}

        try {
          const localStr = localStorage.getItem(`pharmacy_short_book_${shopId}`);
          if (localStr) {
            const localArr = JSON.parse(localStr);
            const dbIds = new Set(merged.map((x: any) => x.id));
            localArr.forEach((l: any) => {
              if (!dbIds.has(l.id)) merged.unshift(l);
            });
          }
        } catch (e) {}
        setShortBookItems(merged);
      }

      if (activeTab === "pharmacy_doctors") {
        let merged: any[] = [];
        try {
          const { data: docs } = await supabase
            .from("doctor_commissions")
            .select("*")
            .eq("shop_id", shopId)
            .order("balance_due", { ascending: false });
          if (docs) merged = docs;
        } catch (e) {}

        try {
          const localStr = localStorage.getItem(`pharmacy_doctor_commissions_${shopId}`);
          if (localStr) {
            const localArr = JSON.parse(localStr);
            const dbIds = new Set(merged.map((x: any) => x.id));
            localArr.forEach((l: any) => {
              if (!dbIds.has(l.id)) merged.unshift(l);
            });
          }
        } catch (e) {}
        setDoctorCommissions(merged);
      }

      if (comparePeriod === "previous") {
        const durDays = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
        const compEnd   = new Date(new Date(startDate).getTime() - 86400000);
        const compStart = new Date(compEnd.getTime() - durDays * 86400000);

        const compStartStr = compStart.toISOString().split("T")[0] + "T00:00:00.000Z";
        const compEndStr   = compEnd.toISOString().split("T")[0] + "T23:59:59.999Z";

        const [{ data: cSales }, { data: cExp }] = await Promise.all([
          supabase.from("invoices").select("total_amount, invoice_items(purchase_price, quantity, product_id, variant_id)").eq("shop_id", shopId).eq("is_voided", false).gte("created_at", compStartStr).lte("created_at", compEndStr),
          supabase.from("expenses").select("amount").eq("shop_id", shopId).gte("created_at", compStartStr).lte("created_at", compEndStr)
        ]);

        const cSalesFormatted = (cSales || []).map((inv: any) => {
          let cogs = 0;
          (inv.invoice_items || []).forEach((it: any) => {
            const c = Number(it.purchase_price || 0) || (it.variant_id && variantCostDict[it.variant_id] ? variantCostDict[it.variant_id] : (productCostDict[it.product_id] || 0));
            cogs += c * Number(it.quantity || 0);
          });
          return { ...inv, cogs };
        });

        setCompareSalesData(cSalesFormatted);
        setCompareExpensesData(cExp || []);
      } else {
        setCompareSalesData([]);
        setCompareExpensesData([]);
      }

      saveReportSnapshot(cacheKey, {
        productsData: products || [],
        salesData: fetchedSales,
        purchasesData: fetchedPurchases,
        expensesData: fetchedExpenses,
        partiesData: fetchedParties,
        cashAccountsData: fetchedAccounts,
      });

    } catch (err: any) {
      const cached = getReportSnapshot(cacheKey);
      if (cached) {
        if (cached.data.productsData) setProductsData(cached.data.productsData);
        if (cached.data.salesData) setSalesData(cached.data.salesData);
        if (cached.data.purchasesData) setPurchasesData(cached.data.purchasesData);
        if (cached.data.expensesData) setExpensesData(cached.data.expensesData);
        if (cached.data.partiesData) setPartiesData(cached.data.partiesData);
        if (cached.data.cashAccountsData) setCashAccountsData(cached.data.cashAccountsData);
        toast.info("⚡ Viewing Offline Reports Snapshot");
      } else {
        toast.error("Failed to load report data: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Lookup maps from productsData ──────────────────────────────────────────
  const { productCostMap, variantCostMap, productNameMap, variantNameMap, productBrandMap } = useMemo(() => {
    const pCost: Record<string, number> = {};
    const vCost: Record<string, number> = {};
    const pName: Record<string, string> = {};
    const vName: Record<string, string> = {};
    const pBrand: Record<string, string> = {};
    productsData.forEach((p: any) => {
      pCost[p.id] = Number(p.purchase_price_single || 0);
      pName[p.id] = p.name;
      pBrand[p.id] = p.brands?.name || "Generic / Other";
      (p.product_variants || []).forEach((v: any) => {
        vCost[v.id] = Number(v.purchase_price || 0);
        vName[v.id] = `${p.name} (${v.packing_name})`;
      });
    });
    return { productCostMap: pCost, variantCostMap: vCost, productNameMap: pName, variantNameMap: vName, productBrandMap: pBrand };
  }, [productsData]);

  // ── P&L Summary ────────────────────────────────────────────────────────────
  useEffect(() => {
    const rev  = salesData.reduce((s, x) => s + Number(x.total_amount || 0), 0);
    const cogs = salesData.reduce((s, x) => s + Number(x.cogs || 0), 0);
    const exp  = expensesData.reduce((s, x) => s + Number(x.amount || 0), 0);
    const disc = salesData.reduce((s, x) => s + Number(x.discount || 0), 0);
    const gp   = rev - cogs;
    const np   = gp - exp;

    let compRev = 0, compCogs = 0, compExp = 0, compNp = 0;
    if (comparePeriod === "previous") {
      compRev  = compareSalesData.reduce((s, x) => s + Number(x.total_amount || 0), 0);
      compCogs = compareSalesData.reduce((s, x) => s + Number(x.cogs || 0), 0);
      compExp  = compareExpensesData.reduce((s, x) => s + Number(x.amount || 0), 0);
      compNp   = (compRev - compCogs) - compExp;
    }

    setPlSummary({
      revenue: rev, cogs, expenses: exp, grossProfit: gp, netProfit: np, discount: disc,
      marginPct: rev > 0 ? (np / rev) * 100 : 0,
      hasCompare: comparePeriod === "previous",
      compRevenue: compRev,
      compNetProfit: compNp,
      revDiffPct: compRev > 0 ? ((rev - compRev) / compRev) * 100 : 0,
      npDiffPct: compNp !== 0 ? ((np - compNp) / Math.abs(compNp)) * 100 : 0
    });
  }, [salesData, expensesData, compareSalesData, compareExpensesData, comparePeriod]);

  // ── Stock Summary ──────────────────────────────────────────────────────────
  useEffect(() => {
    let ti = 0, tq = 0, cv = 0, rv = 0, lc = 0;
    productsData.forEach((p: any) => {
      ti++;
      const s = Number(p.current_stock || 0);
      tq += s;
      if (p.product_variants?.length > 0) {
        let variantStockSum = 0;
        p.product_variants.forEach((v: any) => {
          const vs = Number(v.stock_quantity || 0);
          cv += vs * Number(v.purchase_price || 0);
          rv += vs * Number(v.sale_price || 0);
          variantStockSum += vs;
        });
        const parentDirectStock = s - variantStockSum;
        if (Math.abs(parentDirectStock) > 0.001) {
          cv += parentDirectStock * Number(p.purchase_price_single || 0);
          rv += parentDirectStock * Number(p.sale_price_single || 0);
        }
      } else {
        cv += s * Number(p.purchase_price_single || 0);
        rv += s * Number(p.sale_price_single || 0);
      }
      if (s <= Number(p.min_stock_level || 0)) lc++;
    });
    setStockSummary({ totalItems: ti, totalQuantity: tq, valuationCost: cv, valuationRetail: rv, expectedProfit: rv - cv, lowStockCount: lc });
  }, [productsData]);

  // ── Advanced Client-Side Report Aggregations ──────────────────────────────
  const salesByProduct = useMemo(() => {
    const agg: Record<string, { name: string; qty: number; revenue: number; cost: number; profit: number }> = {};
    salesData.forEach((inv: any) => {
      const invoiceTotal = Number(inv.total_amount || 0);
      const itemsSubtotal = (inv.invoice_items || []).reduce((s: number, it: any) => s + Number(it.subtotal || 0), 0);
      const discountRatio = itemsSubtotal > 0 ? invoiceTotal / itemsSubtotal : 1;

      (inv.invoice_items || []).forEach((it: any) => {
        const key = it.variant_id || it.product_id || "unknown";
        if (key === "unknown") return;
        const name = (it.variant_id && variantNameMap[it.variant_id]) ? variantNameMap[it.variant_id] : (productNameMap[it.product_id] || "Unknown");
        const cp   = Number(it.purchase_price || 0) || ((it.variant_id && variantCostMap[it.variant_id]) ? variantCostMap[it.variant_id] : (productCostMap[it.product_id] || 0));
        const qty  = Number(it.quantity || 0);
        const rev  = Number(it.subtotal || 0) * discountRatio;
        const cost = qty * cp;
        if (!agg[key]) agg[key] = { name, qty: 0, revenue: 0, cost: 0, profit: 0 };
        agg[key].qty     += qty;
        agg[key].revenue += rev;
        agg[key].cost    += cost;
        agg[key].profit  += rev - cost;
      });
    });
    return Object.values(agg).sort((a, b) => b.revenue - a.revenue);
  }, [salesData, productNameMap, variantNameMap, productCostMap, variantCostMap]);

  // 1. Hourly Peak Rush Analysis
  const hourlyRushData = useMemo(() => {
    const hours: Record<number, { hour: number; label: string; count: number; total: number }> = {};
    for (let h = 0; h < 24; h++) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      hours[h] = {
        hour: h,
        label: `${displayHour}:00 ${period} - ${displayHour}:59 ${period}`,
        count: 0,
        total: 0
      };
    }

    salesData.forEach((inv: any) => {
      const date = new Date(inv.created_at);
      const h = date.getHours();
      if (hours[h]) {
        hours[h].count += 1;
        hours[h].total += Number(inv.total_amount || 0);
      }
    });

    const activeList = Object.values(hours).filter(h => h.count > 0);
    return activeList.sort((a, b) => b.total - a.total);
  }, [salesData]);

  // 2. Returns, Damage & Voids Report
  const returnsDamageData = useMemo(() => {
    return salesData.filter((inv: any) => inv.is_voided || inv.status === "returned" || Number(inv.total_amount || 0) < 0);
  }, [salesData]);

  // 3. ABC Velocity & Dead Stock Analysis
  const abcDeadStockData = useMemo(() => {
    const soldMap: Record<string, { qty: number; revenue: number }> = {};
    salesData.forEach((inv: any) => {
      (inv.invoice_items || []).forEach((it: any) => {
        const pId = it.product_id;
        if (!pId) return;
        if (!soldMap[pId]) soldMap[pId] = { qty: 0, revenue: 0 };
        soldMap[pId].qty += Number(it.quantity || 0);
        soldMap[pId].revenue += Number(it.subtotal || 0);
      });
    });

    const totalRevenue = Object.values(soldMap).reduce((s, x) => s + x.revenue, 0);

    const items = productsData.map((p: any) => {
      const sold = soldMap[p.id] || { qty: 0, revenue: 0 };
      const currentStock = Number(p.current_stock || 0);
      const cost = Number(p.purchase_price_single || 0);
      const trappedCapital = currentStock * cost;

      let classification: "A" | "B" | "C" = "C";
      if (sold.revenue > 0 && totalRevenue > 0) {
        const share = (sold.revenue / totalRevenue) * 100;
        if (share >= 1.5) classification = "A";
        else classification = "B";
      } else {
        classification = "C"; // Dead Stock
      }

      return {
        id: p.id,
        name: p.name,
        classification,
        unitsSold: sold.qty,
        revenue: sold.revenue,
        currentStock,
        unit: p.unit || "pcs",
        cost,
        trappedCapital
      };
    });

    return items.sort((a, b) => {
      if (a.classification !== b.classification) {
        return a.classification.localeCompare(b.classification);
      }
      return b.trappedCapital - a.trappedCapital;
    });
  }, [productsData, salesData]);

  // 4. Pharma Company Turnover & Margins
  const pharmaCompanyMarginData = useMemo(() => {
    const compMap: Record<string, { name: string; units: number; revenue: number; cost: number; profit: number }> = {};

    salesData.forEach((inv: any) => {
      (inv.invoice_items || []).forEach((it: any) => {
        const pId = it.product_id;
        const brand = productBrandMap[pId] || it.products?.brands?.name || "Generic / Local Pharma";
        const qty = Number(it.quantity || 0);
        const rev = Number(it.subtotal || 0);
        const cp = Number(it.purchase_price || 0) || (productCostMap[pId] || 0);
        const cost = qty * cp;

        if (!compMap[brand]) {
          compMap[brand] = { name: brand, units: 0, revenue: 0, cost: 0, profit: 0 };
        }
        compMap[brand].units += qty;
        compMap[brand].revenue += rev;
        compMap[brand].cost += cost;
        compMap[brand].profit += rev - cost;
      });
    });

    return Object.values(compMap).sort((a, b) => b.revenue - a.revenue);
  }, [salesData, productBrandMap, productCostMap]);

  // 5. Inactive Khata Recovery Report
  const inactiveKhataData = useMemo(() => {
    const customerLastSale: Record<string, string> = {};
    salesData.forEach((inv: any) => {
      if (inv.party_id) {
        if (!customerLastSale[inv.party_id] || new Date(inv.created_at) > new Date(customerLastSale[inv.party_id])) {
          customerLastSale[inv.party_id] = inv.created_at;
        }
      }
    });

    const now = new Date();
    const debtors = partiesData
      .filter((p: any) => p.type === "customer" && Number(p.current_balance || 0) > 0)
      .map((p: any) => {
        const lastDateStr = customerLastSale[p.id];
        let daysInactive = 999;
        if (lastDateStr) {
          daysInactive = Math.floor((now.getTime() - new Date(lastDateStr).getTime()) / (1000 * 3600 * 24));
        }
        return {
          id: p.id,
          name: p.name,
          phone: p.phone,
          balance: Number(p.current_balance || 0),
          lastVisit: lastDateStr ? new Date(lastDateStr).toLocaleDateString() : "No recent visit",
          daysInactive,
          risk: daysInactive > 60 ? "High Risk" : daysInactive > 30 ? "Medium Risk" : "Recent / Normal"
        };
      });

    return debtors.sort((a, b) => b.balance - a.balance);
  }, [partiesData, salesData]);

  // 6. Aging Statement
  const agingReport = useMemo(() => {
    const receivables: any[] = [];
    const payables: any[] = [];
    const now = new Date();

    partiesData.forEach((party: any) => {
      if (party.type === "customer") {
        const partyInvoices = salesData.filter((inv: any) => inv.party_id === party.id);
        let b0_30 = 0, b31_60 = 0, b61_90 = 0, b90_plus = 0, totalUnpaid = 0;

        partyInvoices.forEach((inv: any) => {
          const unpaid = Number(inv.total_amount || 0) - Number(inv.paid_amount || 0);
          if (unpaid > 0) {
            const ageDays = Math.floor((now.getTime() - new Date(inv.created_at).getTime()) / (1000 * 3600 * 24));
            if (ageDays <= 30) b0_30 += unpaid;
            else if (ageDays <= 60) b31_60 += unpaid;
            else if (ageDays <= 90) b61_90 += unpaid;
            else b90_plus += unpaid;
            totalUnpaid += unpaid;
          }
        });

        const diff = Number(party.current_balance || 0) - totalUnpaid;
        if (diff > 0) {
          b90_plus += diff;
          totalUnpaid += diff;
        }

        if (totalUnpaid > 0) {
          receivables.push({ name: party.name, total: totalUnpaid, b0_30, b31_60, b61_90, b90_plus });
        }
      } else {
        const balance = Number(party.current_balance || 0);
        if (balance > 0) {
          payables.push({ name: party.name, total: balance, b0_30: balance, b31_60: 0, b61_90: 0, b90_plus: 0 });
        }
      }
    });

    receivables.sort((a, b) => b.total - a.total);
    payables.sort((a, b) => b.total - a.total);

    return { receivables, payables };
  }, [salesData, partiesData]);

  // 7. Balance Sheet
  const balanceSheetReport = useMemo(() => {
    const cashTotal = cashAccountsData.reduce((s, x) => s + Number(x.current_balance || 0), 0);
    const inventoryVal = stockSummary.valuationCost;
    const receivables = partiesData.filter(p => p.type === "customer").reduce((s, x) => s + Number(x.current_balance || 0), 0);
    const payables = partiesData.filter(p => p.type === "supplier").reduce((s, x) => s + Number(x.current_balance || 0), 0);
    const totalAssets = cashTotal + inventoryVal + receivables;
    const totalLiabilities = payables;
    const equity = totalAssets - totalLiabilities;

    return { cashTotal, inventoryVal, receivables, payables, totalAssets, totalLiabilities, equity };
  }, [cashAccountsData, stockSummary, partiesData]);

  const taxReportData = useMemo(() => {
    return salesData.filter(inv => Number(inv.tax_amount || 0) > 0);
  }, [salesData]);

  const salesmanPerformanceData = useMemo(() => {
    const sessionToUser: Record<string, string> = {};
    sessionsData.forEach((s: any) => {
      const u = usersData.find((usr: any) => usr.id === s.user_id);
      sessionToUser[s.id] = u ? u.name : "System / Admin";
    });

    const agg: Record<string, { name: string; count: number; total: number; average: number }> = {};
    salesData.forEach((inv: any) => {
      const name = sessionToUser[inv.register_session_id] || "System / Admin";
      const total = Number(inv.total_amount || 0);

      if (!agg[name]) {
        agg[name] = { name, count: 0, total: 0, average: 0 };
      }
      agg[name].count += 1;
      agg[name].total += total;
    });

    Object.keys(agg).forEach(k => {
      agg[k].average = agg[k].total / (agg[k].count || 1);
    });

    return Object.values(agg).sort((a, b) => b.total - a.total);
  }, [salesData, sessionsData, usersData]);

  const salesByCustomer = useMemo(() => {
    const agg: Record<string, { name: string; count: number; total: number; paid: number; balance: number }> = {};
    salesData.forEach((inv: any) => {
      const key  = inv.party_id || "walk-in";
      const name = inv.parties?.name || "Walk-in Customer";
      const tot  = Number(inv.total_amount || 0);
      const paid = Number(inv.paid_amount || 0);
      if (!agg[key]) agg[key] = { name, count: 0, total: 0, paid: 0, balance: 0 };
      agg[key].count++;
      agg[key].total   += tot;
      agg[key].paid    += paid;
      agg[key].balance += tot - paid;
    });
    return Object.values(agg).sort((a, b) => b.total - a.total);
  }, [salesData]);

  const salesByPayment = useMemo(() => {
    const agg: Record<string, { mode: string; count: number; total: number }> = {};
    salesData.forEach((inv: any) => {
      const mode = inv.payment_mode || "cash";
      const tot  = Number(inv.total_amount || 0);
      if (!agg[mode]) agg[mode] = { mode, count: 0, total: 0 };
      agg[mode].count++;
      agg[mode].total += tot;
    });
    return Object.values(agg).sort((a, b) => b.total - a.total);
  }, [salesData]);

  const purchasesBySupplier = useMemo(() => {
    const agg: Record<string, { name: string; count: number; total: number }> = {};
    purchasesData.forEach((po: any) => {
      const key  = po.supplier_id || "generic";
      const name = po.parties?.name || "Generic Supplier";
      const tot  = Number(po.total_amount || 0);
      if (!agg[key]) agg[key] = { name, count: 0, total: 0 };
      agg[key].count++;
      agg[key].total += tot;
    });
    return Object.values(agg).sort((a, b) => b.total - a.total);
  }, [purchasesData]);

  const expenseByCategory = useMemo(() => {
    const agg: Record<string, { category: string; count: number; total: number }> = {};
    expensesData.forEach((e: any) => {
      const cat = e.expense_type || "general";
      const amt = Number(e.amount || 0);
      if (!agg[cat]) agg[cat] = { category: cat, count: 0, total: 0 };
      agg[cat].count++;
      agg[cat].total += amt;
    });
    return Object.values(agg).sort((a, b) => b.total - a.total);
  }, [expensesData]);

  const setPreset = (days: number, type: "days" | "month" | "year") => {
    const end = new Date(), start = new Date();
    if (type === "days")  start.setDate(end.getDate() - days);
    else if (type === "month") start.setDate(1);
    else if (type === "year")  start.setMonth(0, 1);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  // ── PDF Generation ─────────────────────────────────────────────────────────
  const generatePDF = () => {
    setDownloading(true);
    try {
      const doc  = new jsPDF();
      const pm   = 15;
      const blue = [30, 41, 59] as [number, number, number];

      doc.setFillColor(...blue); doc.rect(0, 0, 210, 40, "F");
      doc.setTextColor(255,255,255);
      doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.text(shopName || "THE ACCOUNTS", pm, 16);
      doc.setFont("helvetica","normal"); doc.setFontSize(9);
      doc.text("Official Business Audit & Operations Statement", pm, 24);
      doc.text(`Generated By: ${userName || "Operator"} | Date Range: ${startDate} to ${endDate}`, pm, 32);
      doc.text(`Exported: ${new Date().toLocaleString()}`, 135, 18);
      doc.text(`Report: ${activeTab.toUpperCase().replace(/_/g," ")}`, 135, 26);

      const y = 48;
      let head: string[][] = [];
      let rows: any[][] = [];

      if (activeTab === "sales") {
        head = [["Date","Invoice ID","Customer","Mode","Received (Rs)","Total (Rs)","Profit (Rs)"]];
        rows = salesData.map(s => [
          new Date(s.created_at).toLocaleDateString(),
          s.id.substring(0,8).toUpperCase(),
          s.parties?.name || "Walk-in",
          (s.payment_mode || "cash").toUpperCase(),
          Math.round(s.paid_amount || 0).toLocaleString(),
          Math.round(s.total_amount || 0).toLocaleString(),
          Math.round(s.profit || 0).toLocaleString()
        ]);
      } else if (activeTab === "sales_by_product") {
        head = [["Product Name", "Units Sold", "Avg Price (Rs)", "Revenue (Rs)", "COGS Cost (Rs)", "Profit (Rs)", "Margin %"]];
        rows = salesByProduct.map(p => [
          p.name,
          p.qty.toLocaleString(),
          Math.round(p.revenue / (p.qty || 1)).toLocaleString(),
          Math.round(p.revenue).toLocaleString(),
          Math.round(p.cost).toLocaleString(),
          Math.round(p.profit).toLocaleString(),
          `${(p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0).toFixed(1)}%`
        ]);
      } else if (activeTab === "sales_by_customer") {
        head = [["Customer Name", "Invoices Count", "Total Billing (Rs)", "Paid Amount (Rs)", "Balance Due (Rs)"]];
        rows = salesByCustomer.map(c => [
          c.name,
          c.count.toString(),
          Math.round(c.total).toLocaleString(),
          Math.round(c.paid).toLocaleString(),
          Math.round(c.balance).toLocaleString()
        ]);
      } else if (activeTab === "sales_by_payment") {
        const totPay = salesByPayment.reduce((s: number, p: any) => s + p.total, 0);
        head = [["Payment Mode", "Invoices Count", "Total Collected (Rs)", "Share %"]];
        rows = salesByPayment.map(p => [
          (p.mode || "cash").toUpperCase(),
          p.count.toString(),
          Math.round(p.total).toLocaleString(),
          `${totPay > 0 ? ((p.total / totPay) * 100).toFixed(1) : 0}%`
        ]);
      } else if (activeTab === "hourly_rush") {
        head = [["Time Slot (Hour)", "Invoices Count", "Sales Revenue (Rs)", "Avg Basket Size (Rs)"]];
        rows = hourlyRushData.map(h => [
          h.label,
          h.count.toString(),
          Math.round(h.total).toLocaleString(),
          Math.round(h.total / (h.count || 1)).toLocaleString()
        ]);
      } else if (activeTab === "returns_damage") {
        head = [["Date", "Invoice ID", "Customer / Party", "Status / Reason", "Refunded Amount (Rs)"]];
        rows = returnsDamageData.map(r => [
          new Date(r.created_at).toLocaleDateString(),
          r.id.substring(0,8).toUpperCase(),
          r.parties?.name || "Walk-in",
          r.is_voided ? "VOIDED INVOICE" : (r.status || "Returned"),
          Math.round(Math.abs(r.total_amount || 0)).toLocaleString()
        ]);
      } else if (activeTab === "pharmacy_controlled") {
        head = [["Date", "Rx Ref", "Controlled Medicine", "Quantity", "Doctor & PMDC", "Patient & CNIC", "Phone / Instructions"]];
        rows = controlledLogs.map(c => [
          c.prescription_date,
          c.prescription_ref || "Direct",
          c.product_name,
          `${c.quantity} ${c.unit || "tab"}`,
          `${c.doctor_name || "N/A"} (${c.doctor_pmdc || "-"})`,
          `${c.patient_name} (${c.patient_cnic || "-"})`,
          `${c.patient_phone || "-"} ${c.dosage_instructions ? `[${c.dosage_instructions}]` : ""}`
        ]);
      } else if (activeTab === "pharmacy_expiry_aging") {
        const now = new Date();
        head = [["Medicine Name", "Batch Number", "Expiry Date", "Days Left", "Stock Qty", "Unit Cost (Rs)", "Trapped Loss (Rs)", "Status"]];
        rows = productBatches.map(b => {
          const exp = new Date(b.expiry_date);
          const days = Math.floor((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
          const val = Number(b.quantity || 0) * Number(b.purchase_price || 0);
          const statusStr = days < 0 ? "EXPIRED" : days <= 30 ? "<=30d Return" : days <= 90 ? "<=90d Warning" : "Good (>90d)";
          return [
            b.products?.name || "Medicine",
            b.batch_number || "BATCH",
            b.expiry_date,
            days < 0 ? `${Math.abs(days)}d Overdue` : `${days}d`,
            `${b.quantity} ${b.products?.unit || "pcs"}`,
            Math.round(b.purchase_price || 0).toLocaleString(),
            Math.round(val).toLocaleString(),
            statusStr
          ];
        });
      } else if (activeTab === "pharmacy_temperature") {
        head = [["Date", "Fridge Unit", "Morning Temp (8 AM)", "Evening Temp (8 PM)", "Compliance", "Power Outage", "Verified By"]];
        rows = temperatureLogs.map(t => {
          const isWarn = (Number(t.morning_temp) < 2 || Number(t.morning_temp) > 8 || Number(t.evening_temp) < 2 || Number(t.evening_temp) > 8);
          return [
            t.date,
            t.fridge_name || "Main Fridge",
            `${t.morning_temp || "-"} °C`,
            `${t.evening_temp || "-"} °C`,
            isWarn ? "ALERT (Out of 2-8°C)" : "SAFE (2°C - 8°C)",
            `${t.power_outage_hours || 0} Hours`,
            t.verified_by || "Pharmacist"
          ];
        });
      } else if (activeTab === "pharmacy_short_book") {
        head = [["Medicine Name", "Generic Formula", "Demand Requests", "Urgency", "Customer Info", "Distributor"]];
        rows = shortBookItems.map(s => [
          s.medicine_name,
          s.formula || "-",
          `${s.request_count || 1} Requests`,
          s.urgency === "urgent" ? "Urgent Need" : "Routine Order",
          `${s.customer_name || "Customer"} (${s.customer_phone || "-"})`,
          s.distributor_name || "Generic Distributor"
        ]);
      } else if (activeTab === "pharmacy_doctors") {
        head = [["Doctor Name", "Specialization", "PMDC No", "Prescriptions", "Total Bill (Rs)", "Commission Earned (Rs)", "Balance Due (Rs)"]];
        rows = doctorCommissions.map(d => [
          d.doctor_name,
          d.specialization || "General Physician",
          d.pmdc_no || "-",
          `${d.total_prescriptions || 0} Rx`,
          Math.round(d.total_bill_amount || 0).toLocaleString(),
          Math.round(d.commission_earned || 0).toLocaleString(),
          Math.round(d.balance_due || 0).toLocaleString()
        ]);
      } else if (activeTab === "pharma_company_margin") {
        head = [["Manufacturer / Brand", "Units Sold", "Sales (Rs)", "COGS Cost (Rs)", "Gross Profit (Rs)", "Margin %"]];
        rows = pharmaCompanyMarginData.map(c => [
          c.name,
          c.units.toLocaleString(),
          Math.round(c.revenue).toLocaleString(),
          Math.round(c.cost).toLocaleString(),
          Math.round(c.profit).toLocaleString(),
          `${(c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0).toFixed(1)}%`
        ]);
      } else if (activeTab === "inventory") {
        head = [["Code", "Product Name", "Brand", "Current Stock", "Min Alert Level", "Cost Valuation (Rs)", "Retail Valuation (Rs)"]];
        rows = productsData.map(p => {
          const stock = Number(p.current_stock || 0);
          const cost = Number(p.purchase_price_single || 0);
          const retail = Number(p.sale_price_single || 0);
          return [
            p.id.substring(0, 8).toUpperCase(),
            p.name,
            p.brands?.name || "-",
            `${stock} ${p.unit || "pcs"}`,
            `${p.min_stock_level || 0} ${p.unit || "pcs"}`,
            Math.round(cost * stock).toLocaleString(),
            Math.round(retail * stock).toLocaleString()
          ];
        });
      } else if (activeTab === "dead_stock_abc") {
        head = [["Class", "Product Name", "Units Sold", "Current Stock", "Unit Cost (Rs)", "Trapped Capital (Rs)", "Action"]];
        rows = abcDeadStockData.map(a => [
          `Class ${a.classification}`,
          a.name,
          `${a.unitsSold.toLocaleString()} ${a.unit}`,
          `${a.currentStock.toLocaleString()} ${a.unit}`,
          Math.round(a.cost).toLocaleString(),
          Math.round(a.trappedCapital).toLocaleString(),
          a.classification === "C" ? "Clearance / Return" : "Keep Stocked"
        ]);
      } else if (activeTab === "purchases") {
        head = [["Date", "PO Number", "Supplier Name", "Status", "Total Amount (Rs)"]];
        rows = purchasesData.map(p => [
          new Date(p.created_at).toLocaleDateString(),
          p.id.substring(0, 8).toUpperCase(),
          p.parties?.name || "Generic Supplier",
          p.status || "completed",
          Math.round(p.total_amount || 0).toLocaleString()
        ]);
      } else if (activeTab === "purchases_by_supplier") {
        head = [["Supplier Name", "Orders Count", "Total Procurement (Rs)"]];
        rows = purchasesBySupplier.map(s => [
          s.name,
          s.count.toString(),
          Math.round(s.total).toLocaleString()
        ]);
      } else if (activeTab === "expenses") {
        head = [["Date", "Expense Title", "Category", "Remarks", "Amount (Rs)"]];
        rows = expensesData.map(e => [
          new Date(e.created_at).toLocaleDateString(),
          e.name,
          (e.expense_type || "general").toUpperCase(),
          e.remarks || "-",
          Math.round(e.amount || 0).toLocaleString()
        ]);
      } else if (activeTab === "expense_category") {
        const totExp = expenseByCategory.reduce((s: number, c: any) => s + c.total, 0);
        head = [["Expense Category", "Transactions Count", "Total Spent (Rs)", "Share %"]];
        rows = expenseByCategory.map(c => [
          c.category.toUpperCase(),
          c.count.toString(),
          Math.round(c.total).toLocaleString(),
          `${totExp > 0 ? ((c.total / totExp) * 100).toFixed(1) : 0}%`
        ]);
      } else if (activeTab === "pl") {
        head = [["Statement Line Item (P&L Account)", "Amount (Rs)"]];
        rows = [
          ["Gross Sales Revenue", `Rs ${Math.round(plSummary.revenue + plSummary.discount).toLocaleString()}`],
          ["Discount Allowed (-)", `-Rs ${Math.round(plSummary.discount).toLocaleString()}`],
          ["Net Sales Revenue", `Rs ${Math.round(plSummary.revenue).toLocaleString()}`],
          ["Cost of Goods Sold / COGS (-)", `-Rs ${Math.round(plSummary.cogs).toLocaleString()}`],
          [plSummary.grossProfit >= 0 ? "Gross Profit" : "Gross Loss", `${plSummary.grossProfit < 0 ? "-" : ""}Rs ${Math.round(Math.abs(plSummary.grossProfit)).toLocaleString()}`],
          ["Operating Expenses (-)", `-Rs ${Math.round(plSummary.expenses).toLocaleString()}`],
          [plSummary.netProfit >= 0 ? "Net Profit" : "Net Loss", `${plSummary.netProfit < 0 ? "-" : ""}Rs ${Math.round(Math.abs(plSummary.netProfit)).toLocaleString()}`],
        ];
      } else if (activeTab === "balance_sheet") {
        head = [["Account Category", "Assets (Debit) (Rs)", "Liabilities & Capital (Credit) (Rs)"]];
        rows = [
          ["--- ASSETS (DEBIT ACCOUNTS) ---", "", ""],
          ["Cash & Bank Accounts", `Rs ${Math.round(balanceSheetReport.cashTotal).toLocaleString()}`, "-"],
          ["Inventory Valuation (At Cost)", `Rs ${Math.round(balanceSheetReport.inventoryVal).toLocaleString()}`, "-"],
          ["Customer Receivables (Khata)", `Rs ${Math.round(balanceSheetReport.receivables).toLocaleString()}`, "-"],
          ["TOTAL ASSETS (A)", `Rs ${Math.round(balanceSheetReport.totalAssets).toLocaleString()}`, "-"],
          ["--- LIABILITIES & CAPITAL (CREDIT ACCOUNTS) ---", "", ""],
          ["Supplier Payables (Restock)", "-", `Rs ${Math.round(balanceSheetReport.payables).toLocaleString()}`],
          ["Owner's Equity & Retained Surplus", "-", `Rs ${Math.round(balanceSheetReport.equity).toLocaleString()}`],
          ["TOTAL LIABILITIES & CAPITAL (B)", "-", `Rs ${Math.round(balanceSheetReport.totalLiabilities + balanceSheetReport.equity).toLocaleString()}`]
        ];
      } else if (activeTab === "tax") {
        head = [["Date", "Invoice ID", "Customer", "Taxable Base (Rs)", "Tax Amount (Rs)", "Total Gross (Rs)"]];
        rows = taxReportData.map(inv => [
          new Date(inv.created_at).toLocaleDateString(),
          inv.id.substring(0, 8).toUpperCase(),
          inv.parties?.name || "Walk-in Customer",
          Math.round(Number(inv.total_amount || 0) - Number(inv.tax_amount || 0)).toLocaleString(),
          Math.round(Number(inv.tax_amount || 0)).toLocaleString(),
          Math.round(Number(inv.total_amount || 0)).toLocaleString()
        ]);
      } else if (activeTab === "khata") {
        head = [["Party Name", "Phone", "Account Type", "Outstanding Balance (Rs)", "Status"]];
        rows = partiesData.map(p => {
          const bal = Number(p.current_balance || 0);
          return [
            p.name,
            p.phone || "-",
            p.type === "customer" ? "Customer" : "Supplier",
            Math.round(bal).toLocaleString(),
            bal > 0 ? (p.type === "customer" ? "Debit Due (Receivable)" : "Credit Due (Payable)") : bal < 0 ? "Advance / Credit" : "Cleared (0)"
          ];
        });
      } else if (activeTab === "inactive_khata") {
        head = [["Customer Name", "Phone", "Udhaar Balance (Rs)", "Last Purchase Visit", "Days Inactive", "Risk Status"]];
        rows = inactiveKhataData.map(k => [
          k.name,
          k.phone || "-",
          Math.round(k.balance).toLocaleString(),
          k.lastVisit,
          `${k.daysInactive} days`,
          k.risk
        ]);
      } else if (activeTab === "aging") {
        head = [["Party Name", "Account Type", "0-30 Days (Rs)", "31-60 Days (Rs)", "61-90 Days (Rs)", "90+ Days (Rs)", "Total Balance (Rs)"]];
        rows = [
          ...agingReport.receivables.map(r => [
            r.name,
            "Customer (Receivable)",
            Math.round(r.b0_30).toLocaleString(),
            Math.round(r.b31_60).toLocaleString(),
            Math.round(r.b61_90).toLocaleString(),
            Math.round(r.b90_plus).toLocaleString(),
            Math.round(r.total).toLocaleString()
          ]),
          ...agingReport.payables.map(p => [
            p.name,
            "Supplier (Payable)",
            Math.round(p.b0_30).toLocaleString(),
            Math.round(p.b31_60).toLocaleString(),
            Math.round(p.b61_90).toLocaleString(),
            Math.round(p.b90_plus).toLocaleString(),
            Math.round(p.total).toLocaleString()
          ])
        ];
      } else if (activeTab === "salesman") {
        head = [["Staff / Salesman Name", "Invoices Created", "Total Turnover (Rs)", "Avg Invoice Size (Rs)"]];
        rows = salesmanPerformanceData.map(row => [
          row.name,
          row.count.toString(),
          Math.round(row.total).toLocaleString(),
          Math.round(row.average).toLocaleString()
        ]);
      } else if (activeTab === "register_shifts") {
        head = [["Shift Started", "Cashier / Operator", "Opening Float (Rs)", "Counted Cash (Rs)", "Variance Diff (Rs)", "Shift Status"]];
        rows = sessionsData.map(s => {
          const u = usersData.find(usr => usr.id === s.user_id);
          const diff = Number(s.cash_difference || 0);
          const shiftDate = s.opened_at || s.created_at || s.started_at || new Date();
          return [
            new Date(shiftDate).toLocaleString(),
            u?.name || "Operator",
            Math.round(s.opening_cash || s.opening_balance || 0).toLocaleString(),
            Math.round(s.closing_cash || s.closing_balance || s.expected_cash || 0).toLocaleString(),
            diff === 0 ? "Balanced (0)" : diff < 0 ? `-Rs ${Math.abs(Math.round(diff)).toLocaleString()} (Short)` : `+Rs ${Math.round(diff).toLocaleString()} (Surplus)`,
            (s.status || "closed").toUpperCase()
          ];
        });
      } else {
        head = [["Statement Metric", "Value"]];
        rows = [["Total Statement Records", (salesData.length || purchasesData.length || expensesData.length || 0).toString()]];
      }

      autoTable(doc, {
        head,
        body: rows,
        startY: y,
        theme: "grid",
        headStyles: { fillColor: blue, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.5 },
        didDrawPage: () => {
          doc.setFontSize(8);
          doc.setTextColor(130);
          doc.text(`Page ${doc.getNumberOfPages()} | TheAccounts Cloud ERP`, 195, 290, { align: "right" });
        }
      });

      doc.save(`theaccounts_${activeTab}_report_${startDate}_to_${endDate}.pdf`);
      toast.success("PDF Report generated and downloaded! 📄");
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to generate PDF: " + e.message);
    } finally {
      setDownloading(false);
    }
  };

  // ── CSV Generation ─────────────────────────────────────────────────────────
  const generateCSV = () => {
    try {
      let headers: string[] = [];
      let rows: string[][] = [];

      if (activeTab === "sales") {
        headers = ["Date", "Invoice ID", "Customer", "Payment Mode", "Paid Amount (Rs)", "Total Amount (Rs)", "Profit (Rs)"];
        rows = salesData.map(s => [
          new Date(s.created_at).toLocaleDateString(),
          s.id.substring(0, 8).toUpperCase(),
          s.parties?.name || "Walk-in",
          s.payment_mode || "cash",
          Math.round(s.paid_amount || 0).toString(),
          Math.round(s.total_amount || 0).toString(),
          Math.round(s.profit || 0).toString()
        ]);
      } else if (activeTab === "sales_by_product") {
        headers = ["Product Name", "Units Sold", "Average Price (Rs)", "Revenue (Rs)", "Cost (Rs)", "Gross Profit (Rs)", "Margin %"];
        rows = salesByProduct.map(p => [
          p.name,
          p.qty.toString(),
          Math.round(p.revenue / (p.qty || 1)).toString(),
          Math.round(p.revenue).toString(),
          Math.round(p.cost).toString(),
          Math.round(p.profit).toString(),
          `${(p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0).toFixed(1)}%`
        ]);
      } else if (activeTab === "sales_by_customer") {
        headers = ["Customer Name", "Invoices Count", "Total Billing (Rs)", "Paid Amount (Rs)", "Balance Due (Rs)"];
        rows = salesByCustomer.map(c => [
          c.name,
          c.count.toString(),
          Math.round(c.total).toString(),
          Math.round(c.paid).toString(),
          Math.round(c.balance).toString()
        ]);
      } else if (activeTab === "sales_by_payment") {
        const totPay = salesByPayment.reduce((s: number, p: any) => s + p.total, 0);
        headers = ["Payment Mode", "Transactions Count", "Total Collected (Rs)", "Share %"];
        rows = salesByPayment.map(p => [
          (p.mode || "cash").toUpperCase(),
          p.count.toString(),
          Math.round(p.total).toString(),
          `${totPay > 0 ? ((p.total / totPay) * 100).toFixed(1) : 0}%`
        ]);
      } else if (activeTab === "hourly_rush") {
        headers = ["Time Slot", "Invoices Count", "Total Revenue (Rs)", "Average Basket Size (Rs)"];
        rows = hourlyRushData.map(h => [
          h.label,
          h.count.toString(),
          Math.round(h.total).toString(),
          Math.round(h.total / (h.count || 1)).toString()
        ]);
      } else if (activeTab === "returns_damage") {
        headers = ["Date", "Invoice ID", "Customer / Party", "Status / Reason", "Refunded Amount (Rs)"];
        rows = returnsDamageData.map(r => [
          new Date(r.created_at).toLocaleDateString(),
          r.id.substring(0, 8).toUpperCase(),
          r.parties?.name || "Walk-in",
          r.is_voided ? "VOIDED INVOICE" : (r.status || "Returned"),
          Math.round(Math.abs(r.total_amount || 0)).toString()
        ]);
      } else if (activeTab === "pharmacy_controlled") {
        headers = ["Prescription Date", "Rx Ref", "Medicine Name", "Quantity", "Doctor Name", "Doctor PMDC", "Patient Name", "Patient CNIC", "Patient Phone", "Dosage Instructions"];
        rows = controlledLogs.map(c => [
          c.prescription_date,
          c.prescription_ref || "Direct",
          c.product_name,
          `${c.quantity} ${c.unit || "tab"}`,
          c.doctor_name || "",
          c.doctor_pmdc || "",
          c.patient_name || "",
          c.patient_cnic || "",
          c.patient_phone || "",
          c.dosage_instructions || ""
        ]);
      } else if (activeTab === "pharmacy_expiry_aging") {
        const now = new Date();
        headers = ["Medicine Name", "Batch Number", "Expiry Date", "Days Left", "Current Stock", "Unit Cost (Rs)", "Total Trapped Loss (Rs)", "Status"];
        rows = productBatches.map(b => {
          const exp = new Date(b.expiry_date);
          const days = Math.floor((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
          const val = Number(b.quantity || 0) * Number(b.purchase_price || 0);
          return [
            b.products?.name || "Medicine",
            b.batch_number || "BATCH",
            b.expiry_date,
            days < 0 ? `${Math.abs(days)}d Overdue` : `${days}d`,
            `${b.quantity} ${b.products?.unit || "pcs"}`,
            Math.round(b.purchase_price || 0).toString(),
            Math.round(val).toString(),
            days < 0 ? "EXPIRED" : days <= 30 ? "<=30d Return" : days <= 90 ? "<=90d Warning" : "Good (>90d)"
          ];
        });
      } else if (activeTab === "pharmacy_temperature") {
        headers = ["Date", "Fridge Unit", "Morning Temp (8 AM)", "Evening Temp (8 PM)", "Compliance Status", "Power Outage Hours", "Verified By"];
        rows = temperatureLogs.map(t => {
          const isWarn = (Number(t.morning_temp) < 2 || Number(t.morning_temp) > 8 || Number(t.evening_temp) < 2 || Number(t.evening_temp) > 8);
          return [
            t.date,
            t.fridge_name || "Main Fridge",
            `${t.morning_temp || "-"} °C`,
            `${t.evening_temp || "-"} °C`,
            isWarn ? "Alert (Out of 2-8°C)" : "Safe (2°C - 8°C)",
            `${t.power_outage_hours || 0} Hours`,
            t.verified_by || "Pharmacist"
          ];
        });
      } else if (activeTab === "pharmacy_short_book") {
        headers = ["Medicine Name", "Generic Formula", "Demand Requests", "Urgency", "Customer Name", "Customer Phone", "Distributor"];
        rows = shortBookItems.map(s => [
          s.medicine_name,
          s.formula || "-",
          (s.request_count || 1).toString(),
          s.urgency === "urgent" ? "Urgent Need" : "Routine Order",
          s.customer_name || "Customer",
          s.customer_phone || "-",
          s.distributor_name || "Generic Distributor"
        ]);
      } else if (activeTab === "pharmacy_doctors") {
        headers = ["Doctor Name", "Specialization", "PMDC No", "Hospital / Clinic", "Prescriptions", "Total Bill (Rs)", "Commission Earned (Rs)", "Balance Due (Rs)"];
        rows = doctorCommissions.map(d => [
          d.doctor_name,
          d.specialization || "General Physician",
          d.pmdc_no || "-",
          d.hospital_clinic || "-",
          (d.total_prescriptions || 0).toString(),
          Math.round(d.total_bill_amount || 0).toString(),
          Math.round(d.commission_earned || 0).toString(),
          Math.round(d.balance_due || 0).toString()
        ]);
      } else if (activeTab === "pharma_company_margin") {
        headers = ["Manufacturer Company", "Units Sold", "Total Sales (Rs)", "Total Cost (Rs)", "Gross Profit (Rs)", "Profit Margin %"];
        rows = pharmaCompanyMarginData.map(c => [
          c.name,
          c.units.toString(),
          Math.round(c.revenue).toString(),
          Math.round(c.cost).toString(),
          Math.round(c.profit).toString(),
          `${(c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0).toFixed(1)}%`
        ]);
      } else if (activeTab === "inventory") {
        headers = ["Product Code", "Product Name", "Brand", "Current Stock", "Min Alert Level", "Cost Valuation (Rs)", "Retail Valuation (Rs)"];
        rows = productsData.map(p => {
          const stock = Number(p.current_stock || 0);
          const cost = Number(p.purchase_price_single || 0);
          const retail = Number(p.sale_price_single || 0);
          return [
            p.id.substring(0, 8).toUpperCase(),
            p.name,
            p.brands?.name || "-",
            `${stock} ${p.unit || "pcs"}`,
            `${p.min_stock_level || 0} ${p.unit || "pcs"}`,
            Math.round(cost * stock).toString(),
            Math.round(retail * stock).toString()
          ];
        });
      } else if (activeTab === "dead_stock_abc") {
        headers = ["Classification", "Product Name", "Units Sold in Period", "Revenue Generated (Rs)", "Current Stock", "Unit Cost (Rs)", "Trapped Capital (Rs)", "Action"];
        rows = abcDeadStockData.map(a => [
          `Class ${a.classification}`,
          a.name,
          a.unitsSold.toString(),
          Math.round(a.revenue).toString(),
          a.currentStock.toString(),
          Math.round(a.cost).toString(),
          Math.round(a.trappedCapital).toString(),
          a.classification === "C" ? "Clearance / Return" : "Keep Stocked"
        ]);
      } else if (activeTab === "purchases") {
        headers = ["Date", "PO Number", "Supplier Name", "Status", "Total Amount (Rs)"];
        rows = purchasesData.map(p => [
          new Date(p.created_at).toLocaleDateString(),
          p.id.substring(0, 8).toUpperCase(),
          p.parties?.name || "Generic Supplier",
          p.status || "completed",
          Math.round(p.total_amount || 0).toString()
        ]);
      } else if (activeTab === "purchases_by_supplier") {
        headers = ["Supplier Name", "Orders Count", "Total Procurement (Rs)"];
        rows = purchasesBySupplier.map(s => [
          s.name,
          s.count.toString(),
          Math.round(s.total).toString()
        ]);
      } else if (activeTab === "expenses") {
        headers = ["Date", "Expense Title", "Category", "Remarks", "Amount (Rs)"];
        rows = expensesData.map(e => [
          new Date(e.created_at).toLocaleDateString(),
          e.name,
          (e.expense_type || "general").toUpperCase(),
          e.remarks || "-",
          Math.round(e.amount || 0).toString()
        ]);
      } else if (activeTab === "expense_category") {
        const totExp = expenseByCategory.reduce((s: number, c: any) => s + c.total, 0);
        headers = ["Expense Category", "Logs Count", "Total Outflow (Rs)", "Share %"];
        rows = expenseByCategory.map(c => [
          c.category.toUpperCase(),
          c.count.toString(),
          Math.round(c.total).toString(),
          `${totExp > 0 ? ((c.total / totExp) * 100).toFixed(1) : 0}%`
        ]);
      } else if (activeTab === "pl") {
        headers = ["Statement Line Item (P&L Account)", "Amount (Rs)"];
        rows = [
          ["Gross Sales Revenue", Math.round(plSummary.revenue + plSummary.discount).toString()],
          ["Discount Allowed (-)", `-${Math.round(plSummary.discount)}`],
          ["Net Sales Revenue", Math.round(plSummary.revenue).toString()],
          ["Cost of Goods Sold / COGS (-)", `-${Math.round(plSummary.cogs)}`],
          [plSummary.grossProfit >= 0 ? "Gross Profit" : "Gross Loss", Math.round(plSummary.grossProfit).toString()],
          ["Operating Expenses (-)", `-${Math.round(plSummary.expenses)}`],
          [plSummary.netProfit >= 0 ? "Net Profit" : "Net Loss", Math.round(plSummary.netProfit).toString()],
        ];
      } else if (activeTab === "balance_sheet") {
        headers = ["Account Category", "Assets (Debit) (Rs)", "Liabilities & Capital (Credit) (Rs)"];
        rows = [
          ["Cash & Bank Accounts", Math.round(balanceSheetReport.cashTotal).toString(), "-"],
          ["Inventory Valuation (At Cost)", Math.round(balanceSheetReport.inventoryVal).toString(), "-"],
          ["Customer Receivables (Khata)", Math.round(balanceSheetReport.receivables).toString(), "-"],
          ["TOTAL ASSETS (A)", Math.round(balanceSheetReport.totalAssets).toString(), "-"],
          ["Supplier Payables (Restock)", "-", Math.round(balanceSheetReport.payables).toString()],
          ["Owner's Equity & Retained Surplus", "-", Math.round(balanceSheetReport.equity).toString()],
          ["TOTAL LIABILITIES & CAPITAL (B)", "-", Math.round(balanceSheetReport.totalLiabilities + balanceSheetReport.equity).toString()]
        ];
      } else if (activeTab === "tax") {
        headers = ["Date", "Invoice ID", "Customer", "Taxable Base (Rs)", "Tax Amount (Rs)", "Total Gross (Rs)"];
        rows = taxReportData.map(inv => [
          new Date(inv.created_at).toLocaleDateString(),
          inv.id.substring(0, 8).toUpperCase(),
          inv.parties?.name || "Walk-in Customer",
          Math.round(Number(inv.total_amount || 0) - Number(inv.tax_amount || 0)).toString(),
          Math.round(Number(inv.tax_amount || 0)).toString(),
          Math.round(Number(inv.total_amount || 0)).toString()
        ]);
      } else if (activeTab === "khata") {
        headers = ["Party Name", "Phone", "Account Type", "Outstanding Balance (Rs)", "Status"];
        rows = partiesData.map(p => {
          const bal = Number(p.current_balance || 0);
          return [
            p.name,
            p.phone || "-",
            p.type === "customer" ? "Customer" : "Supplier",
            Math.round(bal).toString(),
            bal > 0 ? (p.type === "customer" ? "Debit Due (Receivable)" : "Credit Due (Payable)") : bal < 0 ? "Advance / Credit" : "Cleared (0)"
          ];
        });
      } else if (activeTab === "inactive_khata") {
        headers = ["Customer Name", "Phone", "Outstanding Udhaar Balance (Rs)", "Last Purchase Visit", "Days Inactive", "Risk Category"];
        rows = inactiveKhataData.map(k => [
          k.name,
          k.phone || "-",
          Math.round(k.balance).toString(),
          k.lastVisit,
          k.daysInactive.toString(),
          k.risk
        ]);
      } else if (activeTab === "aging") {
        headers = ["Party Name", "Account Type", "0-30 Days (Rs)", "31-60 Days (Rs)", "61-90 Days (Rs)", "90+ Days (Rs)", "Total Balance (Rs)"];
        rows = [
          ...agingReport.receivables.map(r => [
            r.name,
            "Customer (Receivable)",
            Math.round(r.b0_30).toString(),
            Math.round(r.b31_60).toString(),
            Math.round(r.b61_90).toString(),
            Math.round(r.b90_plus).toString(),
            Math.round(r.total).toString()
          ]),
          ...agingReport.payables.map(p => [
            p.name,
            "Supplier (Payable)",
            Math.round(p.b0_30).toString(),
            Math.round(p.b31_60).toString(),
            Math.round(p.b61_90).toString(),
            Math.round(p.b90_plus).toString(),
            Math.round(p.total).toString()
          ])
        ];
      } else if (activeTab === "salesman") {
        headers = ["Staff / Salesman Name", "Invoices Created", "Total Turnover (Rs)", "Avg Invoice Size (Rs)"];
        rows = salesmanPerformanceData.map(row => [
          row.name,
          row.count.toString(),
          Math.round(row.total).toString(),
          Math.round(row.average).toString()
        ]);
      } else if (activeTab === "register_shifts") {
        headers = ["Shift Started", "Cashier / Operator", "Opening Float (Rs)", "Counted Cash (Rs)", "Variance Diff (Rs)", "Shift Status"];
        rows = sessionsData.map(s => {
          const u = usersData.find(usr => usr.id === s.user_id);
          const diff = Number(s.cash_difference || 0);
          const shiftDate = s.opened_at || s.created_at || s.started_at || new Date();
          return [
            new Date(shiftDate).toLocaleString(),
            u?.name || "Operator",
            Math.round(s.opening_cash || s.opening_balance || 0).toString(),
            Math.round(s.closing_cash || s.closing_balance || s.expected_cash || 0).toString(),
            diff === 0 ? "Balanced (0)" : diff < 0 ? `-Rs ${Math.abs(Math.round(diff)).toLocaleString()} (Short)` : `+Rs ${Math.round(diff).toLocaleString()} (Surplus)`,
            (s.status || "closed").toUpperCase()
          ];
        });
      } else {
        headers = ["Item Name", "Value"];
        rows = [["Report Type", activeTab], ["Generated Date", new Date().toISOString()]];
      }

      const csvRows = [
        headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","),
        ...rows.map(r => r.map(v => `"${(v || "").toString().replace(/"/g, '""')}"`).join(","))
      ];

      const csvString = csvRows.join("\n");
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `theaccounts_${activeTab}_report_${startDate}_to_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Excel/CSV Report downloaded successfully! 📊");
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to generate CSV: " + e.message);
    }
  };

  // ── Navigation Tabs Configuration ──────────────────────────────────────────
  const tabs: { id: ReportTab; labelEn: string; icon: React.ReactNode; groupKey: string }[] = [
    // 1. Pharmacy Special Registers (ONLY FOR PHARMACY SHOPS)
    ...(industryType === "pharmacy" ? [
      { id: "pharmacy_controlled" as ReportTab, labelEn: "Controlled & Narcotics Form-7", icon: <ShieldAlert size={13} className="text-red-500"/>, groupKey: "rep_group_pharmacy" },
      { id: "pharmacy_expiry_aging" as ReportTab, labelEn: "Batch Expiry & Near-Expiry", icon: <AlertTriangle size={13} className="text-amber-500"/>, groupKey: "rep_group_pharmacy" },
      { id: "pharmacy_temperature" as ReportTab, labelEn: "Cold Chain & Refrigerator Log", icon: <ThermometerSnowflake size={13} className="text-blue-500"/>, groupKey: "rep_group_pharmacy" },
      { id: "pharmacy_short_book" as ReportTab, labelEn: "Short Book & Lost Demand", icon: <BookOpen size={13} className="text-purple-500"/>, groupKey: "rep_group_pharmacy" },
      { id: "pharmacy_doctors" as ReportTab, labelEn: "Doctor Referral & Incentives", icon: <Stethoscope size={13} className="text-emerald-500"/>, groupKey: "rep_group_pharmacy" },
      { id: "pharma_company_margin" as ReportTab, labelEn: "Pharma Company Turnover", icon: <Building2 size={13} className="text-indigo-500"/>, groupKey: "rep_group_pharmacy" },
    ] : []),

    // 2. Sales & Billing
    { id: "sales", labelEn: "Sales Invoices Summary", icon: <ShoppingBag size={13}/>, groupKey: "rep_group_sales" },
    { id: "sales_by_product", labelEn: "Product Sales & Margin", icon: <Layers size={13}/>, groupKey: "rep_group_sales" },
    { id: "sales_by_customer", labelEn: "Customer Billing History", icon: <Users size={13}/>, groupKey: "rep_group_sales" },
    { id: "sales_by_payment", labelEn: "Payment Modes Breakdown", icon: <CreditCard size={13}/>, groupKey: "rep_group_sales" },
    { id: "hourly_rush", labelEn: "Hourly Peak Rush & Traffic", icon: <Clock size={13} className="text-amber-600"/>, groupKey: "rep_group_sales" },
    { id: "returns_damage", labelEn: "Customer Returns & Breakage", icon: <RotateCcw size={13} className="text-rose-500"/>, groupKey: "rep_group_sales" },

    // 3. Stock & Inventory Velocity
    { id: "inventory", labelEn: "Stock Valuation & Low Stock", icon: <Package size={13}/>, groupKey: "rep_group_inventory" },
    { id: "dead_stock_abc", labelEn: "ABC Velocity & Dead Stock", icon: <Zap size={13} className="text-amber-500"/>, groupKey: "rep_group_inventory" },

    // 4. Purchases & Restock
    { id: "purchases", labelEn: "Purchase Orders Summary", icon: <Truck size={13}/>, groupKey: "rep_group_purchases" },
    { id: "purchases_by_supplier", labelEn: "Supplier Procurement", icon: <Truck size={13}/>, groupKey: "rep_group_purchases" },

    // 5. Operating Expenses
    { id: "expenses", labelEn: "Operating Expense Entries", icon: <TrendingDown size={13}/>, groupKey: "rep_group_expenses" },
    { id: "expense_category", labelEn: "Expenses by Category", icon: <Layers size={13}/>, groupKey: "rep_group_expenses" },

    // 6. Financial & Auditing Statements
    { id: "pl", labelEn: "Profit & Loss Statement (P&L)", icon: <Calculator size={13}/>, groupKey: "rep_group_financial" },
    { id: "balance_sheet", labelEn: "Balance Sheet (Assets/Liabilities)", icon: <Calculator size={13}/>, groupKey: "rep_group_financial" },
    { id: "tax", labelEn: "FBR & Tax Collections", icon: <CreditCard size={13}/>, groupKey: "rep_group_financial" },
    { id: "khata", labelEn: "Khata Customer & Supplier Ledger", icon: <Users size={13}/>, groupKey: "rep_group_financial" },
    { id: "inactive_khata", labelEn: "Inactive Debtors Recovery", icon: <UserX size={13} className="text-rose-500"/>, groupKey: "rep_group_financial" },
    { id: "aging", labelEn: "Accounts Aging (30-60-90+ Days)", icon: <TrendingDown size={13}/>, groupKey: "rep_group_financial" },
    { id: "salesman", labelEn: "Salesman & Staff Performance", icon: <Users size={13}/>, groupKey: "rep_group_financial" },
    { id: "register_shifts", labelEn: "Cash Register Shifts & Variance", icon: <DollarSign size={13} className="text-emerald-500"/>, groupKey: "rep_group_financial" },
  ];

  const GROUP_TITLES: Record<string, { en: string }> = {
    rep_group_pharmacy: { en: "Pharmacy Statutory Registers" },
    rep_group_sales: { en: "Sales & Billing Analytics" },
    rep_group_inventory: { en: "Stock & Inventory Velocity" },
    rep_group_purchases: { en: "Purchases & Suppliers" },
    rep_group_expenses: { en: "Expenses & Outflow" },
    rep_group_financial: { en: "Financial & Auditing Statements" },
  };

  const groups = [...new Set(tabs.map(t => t.groupKey))];

  return (
    <div className="space-y-3 font-sans text-slate-800">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2.5 pb-2.5 border-b border-slate-200/80">
        <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap justify-end">
          <Button
            onClick={generateCSV}
            disabled={loading || downloading}
            variant="outline"
            className="border-slate-200 text-slate-700 hover:bg-slate-50 font-bold h-8 text-xs px-3 rounded-xl cursor-pointer shadow-2xs"
          >
            <Download className="mr-1.5 h-3.5 w-3.5"/>
            Export CSV / Excel
          </Button>
          <Button
            onClick={generatePDF}
            disabled={loading || downloading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-xs px-3 rounded-xl shadow-2xs cursor-pointer"
          >
            {downloading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <Download className="mr-1.5 h-3.5 w-3.5"/>}
            Print PDF Report
          </Button>
        </div>
      </div>

      {/* ── Date & Filter Controls ── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider">From</div>
            <Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="h-8 text-xs w-32 font-bold shadow-2xs rounded-xl"/>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider">To</div>
            <Input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="h-8 text-xs w-32 font-bold shadow-2xs rounded-xl"/>
          </div>
          <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
            {[
              { label: "Today", days: 0 },
              { label: "7 Days", days: 7 },
              { label: "30 Days", days: 30 },
              { label: "This Month", days: -1 },
            ].map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  const now = new Date();
                  if (preset.days === -1) {
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
                    const lastDay = new Date().toISOString().split("T")[0];
                    setStartDate(firstDay);
                    setEndDate(lastDay);
                  } else if (preset.days === 0) {
                    const today = now.toISOString().split("T")[0];
                    setStartDate(today);
                    setEndDate(today);
                  } else {
                    const past = new Date(Date.now() - preset.days * 86400000).toISOString().split("T")[0];
                    setStartDate(past);
                    setEndDate(now.toISOString().split("T")[0]);
                  }
                }}
                className="px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {["sales", "pl"].includes(activeTab) && (
          <div className="flex items-center gap-2">
            <div className="text-[10px] text-slate-500 font-bold">Compare:</div>
            <select
              value={comparePeriod}
              onChange={(e: any) => setComparePeriod(e.target.value)}
              className="h-8 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2 font-bold text-slate-700 focus:outline-none"
            >
              <option value="none">No Comparison</option>
              <option value="previous">Previous Matching Period</option>
            </select>
          </div>
        )}
      </div>

      {/* ── Main Layout: Sidebar & Content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        {/* ── Sidebar Navigation Tabs ── */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-2.5 shadow-sm space-y-4 max-h-[calc(100vh-210px)] overflow-y-auto custom-scrollbar">
          {groups.map(gKey => {
            const gTabs = tabs.filter(t => t.groupKey === gKey);
            const titles = GROUP_TITLES[gKey] || { en: gKey };

            return (
              <div key={gKey} className="space-y-1">
                <div className="px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between border-b border-slate-100/80 mb-1">
                  <div>{titles.en}</div>
                </div>
                {gTabs.map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 font-black"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={isActive ? "text-white" : "text-slate-400"}>{tab.icon}</div>
                        <div className="text-left truncate">
                          <p className="truncate text-xs leading-tight font-bold">{tab.labelEn}</p>
                        </div>
                      </div>
                      <ChevronRight size={12} className={isActive ? "text-white/80" : "text-slate-300"}/>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* ── Main Report Content Area ── */}
        <div className="lg:col-span-3 space-y-3">
          {loading ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-xs">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-3" />
              <p className="text-xs font-bold text-slate-500">Calculating statement analytics &amp; auditing tables...</p>
            </div>
          ) : (
            <>
              {/* Dynamic KPI Cards per Report */}
              <ReportKpiSection
                activeTab={activeTab}
                salesData={salesData}
                salesByProduct={salesByProduct}
                salesByCustomer={salesByCustomer}
                salesByPayment={salesByPayment}
                purchasesData={purchasesData}
                purchasesBySupplier={purchasesBySupplier}
                expensesData={expensesData}
                expenseByCategory={expenseByCategory}
                plSummary={plSummary}
                stockSummary={stockSummary}
                partiesData={partiesData}
                agingReport={agingReport}
                balanceSheetReport={balanceSheetReport}
                taxReportData={taxReportData}
                salesmanPerformanceData={salesmanPerformanceData}
                controlledLogs={controlledLogs}
                productBatches={productBatches}
                temperatureLogs={temperatureLogs}
                shortBookItems={shortBookItems}
                doctorCommissions={doctorCommissions}
                hourlyRushData={hourlyRushData}
                returnsDamageData={returnsDamageData}
                abcDeadStockData={abcDeadStockData}
                pharmaCompanyMarginData={pharmaCompanyMarginData}
                inactiveKhataData={inactiveKhataData}
                sessionsData={sessionsData}
              />

              {/* Data Table */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <FileText size={14} className="text-blue-600" />
                    <div>Statement Table &amp; Audit Log</div>
                  </h3>
                  <div className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs">
                    {startDate} → {endDate}
                  </div>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-xs text-left text-slate-600">
                    <thead className="bg-slate-100/80 text-[10px] uppercase font-black text-slate-700 border-b border-slate-200 select-none">
                      <ReportTableHead activeTab={activeTab}/>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      <ReportTableBody
                        activeTab={activeTab}
                        salesData={salesData}
                        salesByProduct={salesByProduct}
                        salesByCustomer={salesByCustomer}
                        salesByPayment={salesByPayment}
                        purchasesData={purchasesData}
                        purchasesBySupplier={purchasesBySupplier}
                        expensesData={expensesData}
                        expenseByCategory={expenseByCategory}
                        plSummary={plSummary}
                        productsData={productsData}
                        partiesData={partiesData}
                        agingReport={agingReport}
                        balanceSheetReport={balanceSheetReport}
                        taxReportData={taxReportData}
                        salesmanPerformanceData={salesmanPerformanceData}
                        controlledLogs={controlledLogs}
                        productBatches={productBatches}
                        temperatureLogs={temperatureLogs}
                        shortBookItems={shortBookItems}
                        doctorCommissions={doctorCommissions}
                        hourlyRushData={hourlyRushData}
                        returnsDamageData={returnsDamageData}
                        abcDeadStockData={abcDeadStockData}
                        pharmaCompanyMarginData={pharmaCompanyMarginData}
                        inactiveKhataData={inactiveKhataData}
                        sessionsData={sessionsData}
                        usersData={usersData}
                      />
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helper KPI Card ────────────────────────────────────────────────────────
function KpiCard({ 
  label, 
  value, 
  sub, 
  color = "blue",
  icon
}: { 
  label: string; 
  value: string; 
  sub?: React.ReactNode; 
  color?: string;
  icon?: React.ReactNode;
}) {
  const colorMap: Record<string, { bg: string; border: string; label: string; text: string; subText: string; iconBg: string }> = {
    blue: {
      bg: "bg-blue-50/70 hover:bg-blue-50/90",
      border: "border-blue-200/80",
      label: "text-blue-700",
      text: "text-blue-950",
      subText: "text-blue-800/80",
      iconBg: "bg-blue-100 text-blue-700"
    },
    green: {
      bg: "bg-emerald-50/70 hover:bg-emerald-50/90",
      border: "border-emerald-200/80",
      label: "text-emerald-700",
      text: "text-emerald-950",
      subText: "text-emerald-800/80",
      iconBg: "bg-emerald-100 text-emerald-700"
    },
    red: {
      bg: "bg-rose-50/70 hover:bg-rose-50/90",
      border: "border-rose-200/80",
      label: "text-rose-700",
      text: "text-rose-950",
      subText: "text-rose-800/80",
      iconBg: "bg-rose-100 text-rose-700"
    },
    amber: {
      bg: "bg-amber-50/70 hover:bg-amber-50/90",
      border: "border-amber-200/80",
      label: "text-amber-800",
      text: "text-amber-950",
      subText: "text-amber-800/80",
      iconBg: "bg-amber-100 text-amber-800"
    },
    purple: {
      bg: "bg-purple-50/70 hover:bg-purple-50/90",
      border: "border-purple-200/80",
      label: "text-purple-700",
      text: "text-purple-950",
      subText: "text-purple-800/80",
      iconBg: "bg-purple-100 text-purple-700"
    },
    indigo: {
      bg: "bg-indigo-50/70 hover:bg-indigo-50/90",
      border: "border-indigo-200/80",
      label: "text-indigo-700",
      text: "text-indigo-950",
      subText: "text-indigo-800/80",
      iconBg: "bg-indigo-100 text-indigo-700"
    },
    slate: {
      bg: "bg-slate-50 hover:bg-slate-100/70",
      border: "border-slate-200",
      label: "text-slate-600",
      text: "text-slate-900",
      subText: "text-slate-500",
      iconBg: "bg-slate-200 text-slate-700"
    }
  };

  const scheme = colorMap[color] || colorMap.blue;

  return (
    <div className={`p-4 rounded-3xl border shadow-2xs transition-all space-y-1.5 ${scheme.bg} ${scheme.border}`}>
      <div className="flex items-center justify-between">
        <div className={`text-[10px] font-black uppercase tracking-wider ${scheme.label}`}>
          {label}
        </div>
        {icon && <div className={`p-1.5 rounded-xl text-xs ${scheme.iconBg}`}>{icon}</div>}
      </div>
      <p className={`text-xl md:text-2xl font-black tracking-tight ${scheme.text}`}>
        {value}
      </p>
      {sub && (
        <div className={`text-[11px] font-semibold ${scheme.subText} pt-0.5`}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Dynamic KPI Cards Section ──────────────────────────────────────────────
function ReportKpiSection({ activeTab, salesData, salesByProduct, salesByCustomer, salesByPayment, purchasesData, purchasesBySupplier, expensesData, expenseByCategory, plSummary, stockSummary, partiesData, agingReport, balanceSheetReport, taxReportData, salesmanPerformanceData, controlledLogs, productBatches, temperatureLogs, shortBookItems, doctorCommissions, hourlyRushData, returnsDamageData, abcDeadStockData, pharmaCompanyMarginData, inactiveKhataData, sessionsData }: any) {
  if (activeTab === "sales") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Total Invoices" value={`${salesData.length}`} sub="Confirmed billing transactions" color="slate" icon={<ShoppingBag size={13}/>}/>
        <KpiCard label="Total Gross Revenue" value={`Rs ${Math.round(plSummary.revenue).toLocaleString()}`} sub="Total sales billing" color="blue" icon={<CreditCard size={13}/>}/>
        <KpiCard label="Estimated Gross Profit" value={`Rs ${Math.round(plSummary.grossProfit).toLocaleString()}`} sub={`Margin: ${plSummary.marginPct.toFixed(1)}%`} color="green" icon={<TrendingDown size={13} className="rotate-180"/>}/>
      </div>
    );
  }

  if (activeTab === "pharmacy_controlled") {
    const totalDoses = controlledLogs.reduce((s: number, x: any) => s + Number(x.quantity || 0), 0);
    const uniqueDoctors = new Set(controlledLogs.map((c: any) => c.doctor_name)).size;
    const uniquePatients = new Set(controlledLogs.map((c: any) => c.patient_cnic || c.patient_name)).size;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Controlled Log Entries" value={`${controlledLogs.length}`} sub="Schedule G statutory dispenses" color="red" icon={<ShieldAlert size={13}/>}/>
        <KpiCard label="Total Doses Dispensed" value={`${totalDoses.toLocaleString()}`} sub="Tablets, capsules & ampoules" color="amber" icon={<Pill size={13}/>}/>
        <KpiCard label="Prescribing Doctors" value={`${uniqueDoctors}`} sub="Registered PMDC practitioners" color="blue" icon={<Stethoscope size={13}/>}/>
        <KpiCard label="Verified Patients" value={`${uniquePatients}`} sub="CNIC recorded buyers" color="green" icon={<Users size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "pharmacy_expiry_aging") {
    const now = new Date();
    let expiredLoss = 0, urgent30 = 0, near90 = 0;
    productBatches.forEach((b: any) => {
      const exp = new Date(b.expiry_date);
      const days = Math.floor((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
      const val = Number(b.quantity || 0) * Number(b.purchase_price || 0);
      if (days < 0) expiredLoss += val;
      else if (days <= 30) urgent30 += val;
      else if (days <= 90) near90 += val;
    });

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="🔴 Expired Stock Loss" value={`Rs ${Math.round(expiredLoss).toLocaleString()}`} sub="Immediate scrap/claim loss" color="red" icon={<AlertTriangle size={13}/>}/>
        <KpiCard label="🟠 Expiring in ≤ 30 Days" value={`Rs ${Math.round(urgent30).toLocaleString()}`} sub="Urgent return to distributor" color="amber" icon={<Clock size={13}/>}/>
        <KpiCard label="🟡 Expiring in 31-90 Days" value={`Rs ${Math.round(near90).toLocaleString()}`} sub="Discount or sales push stock" color="purple" icon={<Layers size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "pharmacy_temperature") {
    const warnings = temperatureLogs.filter((t: any) => (Number(t.morning_temp) < 2 || Number(t.morning_temp) > 8 || Number(t.evening_temp) < 2 || Number(t.evening_temp) > 8)).length;
    const powerOutages = temperatureLogs.reduce((s: number, t: any) => s + Number(t.power_outage_hours || 0), 0);

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Monthly Inspection Logs" value={`${temperatureLogs.length}`} sub="Daily morning & evening logs" color="blue" icon={<ThermometerSnowflake size={13}/>}/>
        <KpiCard label="Temperature Deviations" value={`${warnings}`} sub="Deviations outside 2°C - 8°C" color={warnings > 0 ? "red" : "green"} icon={<AlertTriangle size={13}/>}/>
        <KpiCard label="Total Power Outage" value={`${powerOutages} Hours`} sub="Generator / backup required" color="amber" icon={<Zap size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "pharmacy_short_book") {
    const urgentCount = shortBookItems.filter((s: any) => s.urgency === "urgent").length;
    const totalRequests = shortBookItems.reduce((s: number, x: any) => s + Number(x.request_count || 1), 0);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Short Medicines Logged" value={`${shortBookItems.length}`} sub="Out of stock customer inquiries" color="purple" icon={<BookOpen size={13}/>}/>
        <KpiCard label="🚨 Urgent Customer Demands" value={`${urgentCount}`} sub="Life-saving / immediate needs" color="red" icon={<AlertTriangle size={13}/>}/>
        <KpiCard label="Total Demand Requests" value={`${totalRequests.toLocaleString()}`} sub="Cumulative customer requests" color="blue" icon={<Users size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "pharmacy_doctors") {
    const totalTurnover = doctorCommissions.reduce((s: number, d: any) => s + Number(d.total_bill_amount || 0), 0);
    const totalDue = doctorCommissions.reduce((s: number, d: any) => s + Number(d.balance_due || 0), 0);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Affiliated Doctors" value={`${doctorCommissions.length}`} sub="Registered clinics & specialists" color="blue" icon={<Stethoscope size={13}/>}/>
        <KpiCard label="Prescription Sales Turnover" value={`Rs ${Math.round(totalTurnover).toLocaleString()}`} sub="Medicine sales from prescriptions" color="green" icon={<CreditCard size={13}/>}/>
        <KpiCard label="Net Commission Due" value={`Rs ${Math.round(totalDue).toLocaleString()}`} sub="Outstanding incentive to pay" color="purple" icon={<DollarSign size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "pharma_company_margin") {
    const top = pharmaCompanyMarginData[0];
    const totalPharmaSales = pharmaCompanyMarginData.reduce((s: number, x: any) => s + x.revenue, 0);
    const totalPharmaProfit = pharmaCompanyMarginData.reduce((s: number, x: any) => s + x.profit, 0);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Top Pharma Manufacturer" value={top ? top.name : "N/A"} sub={top ? `Rs ${Math.round(top.revenue).toLocaleString()} sales` : "No sales logged"} color="indigo" icon={<Building2 size={13}/>}/>
        <KpiCard label="Total Pharma Turnover" value={`Rs ${Math.round(totalPharmaSales).toLocaleString()}`} sub="Aggregated manufacturer revenue" color="blue" icon={<Layers size={13}/>}/>
        <KpiCard label="Pharma Gross Profit" value={`Rs ${Math.round(totalPharmaProfit).toLocaleString()}`} sub={`Overall Margin: ${(totalPharmaSales > 0 ? (totalPharmaProfit / totalPharmaSales) * 100 : 0).toFixed(1)}%`} color="green" icon={<TrendingDown size={13} className="rotate-180"/>}/>
      </div>
    );
  }

  if (activeTab === "dead_stock_abc") {
    const deadItems = abcDeadStockData.filter((a: any) => a.classification === "C");
    const trappedCapital = deadItems.reduce((s: number, x: any) => s + x.trappedCapital, 0);
    const fastCount = abcDeadStockData.filter((a: any) => a.classification === "A").length;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="⚠️ Dead Stock Items (0 Sales)" value={`${deadItems.length}`} sub="No sales in selected period" color="red" icon={<AlertTriangle size={13}/>}/>
        <KpiCard label="Trapped Capital in Dead Stock" value={`Rs ${Math.round(trappedCapital).toLocaleString()}`} sub="Blocked procurement capital" color="amber" icon={<DollarSign size={13}/>}/>
        <KpiCard label="🚀 Class A Fast Movers" value={`${fastCount}`} sub="Top revenue-generating items" color="green" icon={<Zap size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "hourly_rush") {
    const top = hourlyRushData[0];
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="🌟 Peak Rush Hour" value={top ? top.label : "N/A"} sub={top ? `${top.count} invoices | Rs ${Math.round(top.total).toLocaleString()}` : "No activity"} color="amber" icon={<Clock size={13}/>}/>
        <KpiCard label="Total Active Trading Hours" value={`${hourlyRushData.length} Hours`} sub="Hours with registered sales" color="blue" icon={<Layers size={13}/>}/>
        <KpiCard label="Average Peak Ticket Size" value={top ? `Rs ${Math.round(top.total / (top.count || 1)).toLocaleString()}` : "Rs 0"} sub="Mean invoice value during rush" color="slate" icon={<CreditCard size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "inactive_khata") {
    const totalDue = inactiveKhataData.reduce((s: number, x: any) => s + x.balance, 0);
    const urgentFollowup = inactiveKhataData.filter((x: any) => x.daysInactive > 30).length;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Total Inactive Debtors" value={`${inactiveKhataData.length}`} sub="Khata customers with pending balance" color="red" icon={<UserX size={13}/>}/>
        <KpiCard label="Total Blocked Udhaar" value={`Rs ${Math.round(totalDue).toLocaleString()}`} sub="Outstanding capital to recover" color="amber" icon={<DollarSign size={13}/>}/>
        <KpiCard label="Urgent Follow-up (>30 Days)" value={`${urgentFollowup}`} sub="Customers overdue for recovery" color="purple" icon={<Clock size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "register_shifts") {
    const totalVariance = sessionsData.reduce((s: number, x: any) => s + Number(x.cash_difference || 0), 0);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Total Register Shifts" value={`${sessionsData.length}`} sub="Cashier register sessions" color="blue" icon={<Layers size={13}/>}/>
        <KpiCard label="Net Cash Drawer Variance" value={`Rs ${Math.round(Math.abs(totalVariance)).toLocaleString()}`} sub={totalVariance < 0 ? "🔴 Net Cash Shortage" : "🟢 Net Cash Surplus"} color={totalVariance < 0 ? "red" : "green"} icon={<DollarSign size={13}/>}/>
        <KpiCard label="Cash Handled" value={`Rs ${Math.round(sessionsData.reduce((s: number, x: any) => s + Number(x.expected_cash || 0), 0)).toLocaleString()}`} sub="Total expected turnover in drawers" color="slate" icon={<CreditCard size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "pl") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Gross Sales Revenue" value={`Rs ${Math.round(plSummary.revenue).toLocaleString()}`} sub="Total customer billings" color="slate" icon={<CreditCard size={13}/>}/>
        <KpiCard label="Total COGS" value={`Rs ${Math.round(plSummary.cogs).toLocaleString()}`} sub="Procurement cost of goods sold" color="amber" icon={<Truck size={13}/>}/>
        <KpiCard label="Net Profit" value={`Rs ${Math.round(plSummary.netProfit).toLocaleString()}`} sub={`Net Margin: ${plSummary.marginPct.toFixed(1)}%`} color={plSummary.netProfit >= 0 ? "green" : "red"} icon={<TrendingDown size={13} className={plSummary.netProfit >= 0 ? "rotate-180" : ""}/>}/>
      </div>
    );
  }

  if (activeTab === "inventory") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Inventory at Cost" value={`Rs ${Math.round(stockSummary.valuationCost).toLocaleString()}`} sub="Asset valuation at purchase price" color="slate" icon={<Package size={13}/>}/>
        <KpiCard label="Inventory at Retail" value={`Rs ${Math.round(stockSummary.valuationRetail).toLocaleString()}`} sub="Expected sale revenue" color="blue" icon={<CreditCard size={13}/>}/>
        <KpiCard label="Expected Stock Profit" value={`Rs ${Math.round(stockSummary.expectedProfit).toLocaleString()}`} sub={`${stockSummary.lowStockCount} items below alert level`} color="green" icon={<TrendingDown size={13} className="rotate-180"/>}/>
      </div>
    );
  }

  if (activeTab === "expenses" || activeTab === "expense_category") {
    const totalExpenses = expensesData.reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
    const topCat = expenseByCategory && expenseByCategory[0];
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Total Expense Entries" value={`${expensesData.length}`} sub="Audited range logs" color="red" icon={<TrendingDown size={13}/>}/>
        <KpiCard label="Total Expense Outflow" value={`Rs ${Math.round(totalExpenses).toLocaleString()}`} sub="Total recorded operational cost" color="amber" icon={<DollarSign size={13}/>}/>
        <KpiCard label="Top Expense Head" value={topCat ? topCat.name : "N/A"} sub={topCat ? `Rs ${Math.round(topCat.total).toLocaleString()} (${topCat.count} entries)` : "No expenses recorded"} color="purple" icon={<Layers size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "purchases" || activeTab === "purchases_by_supplier") {
    const totalPurchases = purchasesData.reduce((s: number, x: any) => s + Number(x.total_amount || 0), 0);
    const topSupplier = purchasesBySupplier && purchasesBySupplier[0];
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Total Purchase Orders" value={`${purchasesData.length}`} sub="Supplier stock-in invoices" color="blue" icon={<Truck size={13}/>}/>
        <KpiCard label="Total Capital Spent" value={`Rs ${Math.round(totalPurchases).toLocaleString()}`} sub="Procurement inventory cost" color="slate" icon={<CreditCard size={13}/>}/>
        <KpiCard label="Top Supplier" value={topSupplier ? topSupplier.name : "N/A"} sub={topSupplier ? `Rs ${Math.round(topSupplier.total).toLocaleString()} (${topSupplier.count} orders)` : "No restock logged"} color="green" icon={<Users size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "sales_by_product") {
    const topProd = salesByProduct && salesByProduct[0];
    const totalQty = (salesByProduct || []).reduce((s: number, x: any) => s + Number(x.quantity || 0), 0);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Unique Products Sold" value={`${(salesByProduct || []).length}`} sub="Different items billed" color="blue" icon={<Package size={13}/>}/>
        <KpiCard label="Total Units Sold" value={`${Math.round(totalQty).toLocaleString()}`} sub="Total volume moved" color="slate" icon={<Layers size={13}/>}/>
        <KpiCard label="Top Selling Item" value={topProd ? topProd.name : "N/A"} sub={topProd ? `${topProd.quantity} units | Rs ${Math.round(topProd.revenue).toLocaleString()}` : "No items sold"} color="green" icon={<Zap size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "sales_by_customer") {
    const topCust = salesByCustomer && salesByCustomer[0];
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KpiCard label="Unique Customers Billed" value={`${(salesByCustomer || []).length}`} sub="Billed client base" color="blue" icon={<Users size={13}/>}/>
        <KpiCard label="Top Customer" value={topCust ? topCust.name : "N/A"} sub={topCust ? `Rs ${Math.round(topCust.total).toLocaleString()} (${topCust.count} invoices)` : "No customers"} color="green" icon={<ShoppingBag size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "sales_by_payment") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KpiCard label="Payment Methods" value={`${(salesByPayment || []).length}`} sub="Active payment channels" color="blue" icon={<CreditCard size={13}/>}/>
        <KpiCard label="Total Payment Volume" value={`Rs ${Math.round((salesByPayment || []).reduce((s: number, x: any) => s + Number(x.total || 0), 0)).toLocaleString()}`} sub="Reconciled collections" color="green" icon={<DollarSign size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "returns_damage") {
    const totalRefund = (returnsDamageData || []).reduce((s: number, x: any) => s + Number(x.total_amount || 0), 0);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KpiCard label="Total Return Invoices" value={`${(returnsDamageData || []).length}`} sub="Customer return / damage claims" color="red" icon={<RotateCcw size={13}/>}/>
        <KpiCard label="Total Refund Value" value={`Rs ${Math.round(totalRefund).toLocaleString()}`} sub="Total capital refunded" color="amber" icon={<DollarSign size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "khata" || activeTab === "aging") {
    const customerUdhaar = (partiesData || []).filter((p: any) => p.type === "customer" && Number(p.current_balance || 0) > 0).reduce((s: number, x: any) => s + Number(x.current_balance || 0), 0);
    const supplierPayables = (partiesData || []).filter((p: any) => p.type === "supplier" && Number(p.current_balance || 0) < 0).reduce((s: number, x: any) => s + Math.abs(Number(x.current_balance || 0)), 0);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Total Active Parties" value={`${(partiesData || []).length}`} sub="Customers & Suppliers in ledger" color="blue" icon={<Users size={13}/>}/>
        <KpiCard label="Total Customer Udhaar" value={`Rs ${Math.round(customerUdhaar).toLocaleString()}`} sub="Receivable from clients" color="amber" icon={<DollarSign size={13}/>}/>
        <KpiCard label="Total Supplier Payables" value={`Rs ${Math.round(supplierPayables).toLocaleString()}`} sub="Payable to vendors" color="purple" icon={<CreditCard size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "tax") {
    const totalTax = (taxReportData || []).reduce((s: number, x: any) => s + Number(x.taxAmount || 0), 0);
    const totalBase = (taxReportData || []).reduce((s: number, x: any) => s + Number(x.taxableBase || 0), 0);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Tax Invoices" value={`${(taxReportData || []).length}`} sub="FBR / Taxable sales" color="blue" icon={<CreditCard size={13}/>}/>
        <KpiCard label="Total Tax Collected" value={`Rs ${Math.round(totalTax).toLocaleString()}`} sub="Collected sales tax" color="green" icon={<DollarSign size={13}/>}/>
        <KpiCard label="Taxable Sales Base" value={`Rs ${Math.round(totalBase).toLocaleString()}`} sub="Base sales before tax" color="slate" icon={<Layers size={13}/>}/>
      </div>
    );
  }

  if (activeTab === "salesman") {
    const topStaff = salesmanPerformanceData && salesmanPerformanceData[0];
    const totalTurnover = (salesmanPerformanceData || []).reduce((s: number, x: any) => s + Number(x.revenue || 0), 0);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Active Staff Members" value={`${(salesmanPerformanceData || []).length}`} sub="Sales operators logged" color="blue" icon={<Users size={13}/>}/>
        <KpiCard label="Top Performing Staff" value={topStaff ? topStaff.name : "N/A"} sub={topStaff ? `Rs ${Math.round(topStaff.revenue).toLocaleString()} (${topStaff.count} bills)` : "No records"} color="green" icon={<Zap size={13}/>}/>
        <KpiCard label="Total Staff Turnover" value={`Rs ${Math.round(totalTurnover).toLocaleString()}`} sub="Aggregated staff billing" color="indigo" icon={<CreditCard size={13}/>}/>
      </div>
    );
  }

  const fallbackCount = 
    activeTab.startsWith("sales") ? (salesData || []).length :
    activeTab.startsWith("purchases") ? (purchasesData || []).length :
    activeTab.startsWith("expense") ? (expensesData || []).length :
    activeTab === "khata" || activeTab === "aging" ? (partiesData || []).length :
    0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <KpiCard label="Total Statement Records" value={`${fallbackCount}`} sub="Active ledger entries" color="blue" icon={<Layers size={13}/>}/>
      <KpiCard label="Report Scope" value={`${activeTab.toUpperCase().replace(/_/g, " ")}`} sub="Audited range statement" color="slate" icon={<FileText size={13}/>}/>
    </div>
  );
}

// ── Table Header ───────────────────────────────────────────────────────────
function ReportTableHead({ activeTab }: { activeTab: ReportTab }) {
  const th = (label: string, right = false) => (
    <th className={`py-3 px-3.5 ${right ? "text-right" : ""}`}>{label}</th>
  );

  switch (activeTab) {
    case "sales":
      return <tr>{th("Date")}{th("Invoice ID")}{th("Customer")}{th("Mode")}{th("Received", true)}{th("Total Amount", true)}{th("Profit", true)}</tr>;
    case "sales_by_product":
      return <tr>{th("Product Name")}{th("Units Sold", true)}{th("Avg Price", true)}{th("Revenue", true)}{th("COGS", true)}{th("Profit", true)}{th("Margin %", true)}</tr>;
    case "sales_by_customer":
      return <tr>{th("Customer Name")}{th("Invoices", true)}{th("Total Billing", true)}{th("Paid Amount", true)}{th("Balance Due", true)}</tr>;
    case "sales_by_payment":
      return <tr>{th("Payment Mode")}{th("Invoices Count", true)}{th("Total Revenue", true)}{th("Share %", true)}</tr>;
    case "hourly_rush":
      return <tr>{th("Time Slot (Hour)")}{th("Invoices Count", true)}{th("Sales Revenue (Rs)", true)}{th("Avg Basket Size", true)}</tr>;
    case "returns_damage":
      return <tr>{th("Date")}{th("Invoice ID")}{th("Customer")}{th("Status / Note")}{th("Refunded Amount (Rs)", true)}</tr>;
    case "pharmacy_controlled":
      return <tr>{th("Date")}{th("Rx Ref")}{th("Controlled Medicine")}{th("Quantity")}{th("Doctor & PMDC")}{th("Patient & CNIC")}{th("Dosage / Phone")}</tr>;
    case "pharmacy_expiry_aging":
      return <tr>{th("Medicine Name")}{th("Batch Number")}{th("Expiry Date")}{th("Days Left", true)}{th("Stock Qty")}{th("Unit Cost", true)}{th("Trapped Capital", true)}{th("Status")}</tr>;
    case "pharmacy_temperature":
      return <tr>{th("Date")}{th("Refrigerator Unit")}{th("Morning Temp (8 AM)")}{th("Evening Temp (8 PM)")}{th("Compliance")}{th("Power Outage")}{th("Verified By")}</tr>;
    case "pharmacy_short_book":
      return <tr>{th("Medicine Name")}{th("Generic Formula")}{th("Demand Requests", true)}{th("Urgency")}{th("Customer Info")}{th("Distributor")}</tr>;
    case "pharmacy_doctors":
      return <tr>{th("Doctor Name")}{th("PMDC No")}{th("Hospital / Clinic")}{th("Prescriptions", true)}{th("Total Medicine Bill", true)}{th("Commission Earned", true)}{th("Net Due", true)}</tr>;
    case "pharma_company_margin":
      return <tr>{th("Manufacturer / Company")}{th("Units Sold", true)}{th("Total Sales (Rs)", true)}{th("Procurement Cost", true)}{th("Gross Profit (Rs)", true)}{th("Margin %", true)}</tr>;
    case "dead_stock_abc":
      return <tr>{th("Class")}{th("Product Name")}{th("Units Sold in Range", true)}{th("Current Stock")}{th("Unit Cost", true)}{th("Trapped Capital (Rs)", true)}{th("Action")}</tr>;
    case "inactive_khata":
      return <tr>{th("Customer Name")}{th("Phone")}{th("Udhaar Balance (Rs)", true)}{th("Last Purchase Visit")}{th("Days Inactive", true)}{th("Risk Status")}{th("Action")}</tr>;
    case "purchases":
      return <tr>{th("Date")}{th("PO Number")}{th("Supplier Name")}{th("Status")}{th("Total Amount (Rs)", true)}</tr>;
    case "purchases_by_supplier":
      return <tr>{th("Supplier Name")}{th("Orders Count", true)}{th("Total Capital Spent (Rs)", true)}</tr>;
    case "expenses":
      return <tr>{th("Date")}{th("Expense Title")}{th("Category")}{th("Remarks")}{th("Amount (Rs)", true)}</tr>;
    case "expense_category":
      return <tr>{th("Expense Category")}{th("Logs Count", true)}{th("Total Outflow (Rs)", true)}{th("Share %", true)}</tr>;
    case "pl":
      return <tr>{th("Statement Line Item")}{th("Amount (Rs)", true)}</tr>;
    case "inventory":
      return <tr>{th("Product Code")}{th("Product Name")}{th("Current Stock")}{th("Alert Level")}{th("Cost Valuation (Rs)", true)}{th("Retail Valuation (Rs)", true)}</tr>;
    case "khata":
      return <tr>{th("Party Name")}{th("Phone")}{th("Type")}{th("Outstanding Balance (Rs)", true)}</tr>;
    case "aging":
      return <tr>{th("Party Name")}{th("0-30 Days", true)}{th("31-60 Days", true)}{th("61-90 Days", true)}{th("90+ Days", true)}{th("Total Balance", true)}</tr>;
    case "balance_sheet":
      return <tr>{th("Account Category")}{th("Assets (Debit)", true)}{th("Liabilities & Equity (Credit)", true)}</tr>;
    case "tax":
      return <tr>{th("Date")}{th("Invoice ID")}{th("Customer")}{th("Taxable Base", true)}{th("Tax Amount", true)}{th("Total Gross", true)}</tr>;
    case "salesman":
      return <tr>{th("Staff / Salesman Name")}{th("Invoices Created", true)}{th("Total Turnover (Rs)", true)}{th("Avg Invoice Size (Rs)", true)}</tr>;
    case "register_shifts":
      return <tr>{th("Shift Started")}{th("Cashier / Operator")}{th("Opening Float", true)}{th("Counted Cash", true)}{th("Variance (Diff)", true)}{th("Status")}</tr>;
    default:
      return <tr>{th("Item")}{th("Value", true)}</tr>;
  }
}

// ── Table Body ─────────────────────────────────────────────────────────────
function ReportTableBody({ activeTab, salesData, salesByProduct, salesByCustomer, salesByPayment, purchasesData, purchasesBySupplier, expensesData, expenseByCategory, plSummary, productsData, partiesData, agingReport, balanceSheetReport, taxReportData, salesmanPerformanceData, controlledLogs, productBatches, temperatureLogs, shortBookItems, doctorCommissions, hourlyRushData, returnsDamageData, abcDeadStockData, pharmaCompanyMarginData, inactiveKhataData, sessionsData, usersData }: any) {
  const td = (v: React.ReactNode, right = false, bold = false, cls = "") => (
    <td className={`py-2 px-3.5 text-xs ${right ? "text-right" : ""} ${bold ? "font-bold" : ""} ${cls}`}>{v}</td>
  );
  const badge = (text: string, color: string) => (
    <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${color}`}>{text}</div>
  );
  const empty = (cols: number, msg: string) => (
    <tr><td colSpan={cols} className="py-8 text-center text-slate-400 text-xs font-semibold">{msg}</td></tr>
  );

  if (activeTab === "sales") {
    if (!salesData.length) return empty(7, "No invoices in selected date range.");
    return <>{salesData.map((s: any) => (
      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
        {td(new Date(s.created_at).toLocaleDateString(), false, false, "text-slate-500")}
        {td(<div className="font-mono text-[10px] text-slate-600 font-bold">{s.id.substring(0,8).toUpperCase()}</div>)}
        {td(s.parties?.name || "Walk-in", false, true)}
        {td(badge(s.payment_mode || "cash", s.payment_mode === "credit" ? "bg-rose-50 text-rose-700" : s.payment_mode === "card" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"))}
        {td(`Rs ${Math.round(s.paid_amount || 0).toLocaleString()}`, true)}
        {td(`Rs ${Math.round(s.total_amount || 0).toLocaleString()}`, true, true)}
        {td(<div className="font-bold text-emerald-600">Rs {Math.round(s.profit || 0).toLocaleString()}</div>, true)}
      </tr>
    ))}</>;
  }

  if (activeTab === "pharmacy_controlled") {
    if (!controlledLogs.length) return empty(7, "No Schedule G / Controlled Drug entries found.");
    return <>{controlledLogs.map((c: any) => (
      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
        {td(c.prescription_date, false, false, "text-slate-500 font-mono text-[11px]")}
        {td(<div className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">{c.prescription_ref || "Direct"}</div>)}
        {td(
          <div className="space-y-0.5">
            <div className="font-black text-slate-800 flex items-center gap-1">
              🚨 {c.product_name}
            </div>
          </div>
        )}
        {td(<div className="font-black text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded">{c.quantity} {c.unit || "tab"}</div>)}
        {td(
          <div>
            <p className="font-bold text-slate-800">{c.doctor_name || "N/A"}</p>
            <p className="text-[10px] text-slate-400 font-mono">PMDC: {c.doctor_pmdc || "-"}</p>
          </div>
        )}
        {td(
          <div>
            <p className="font-bold text-slate-800">{c.patient_name}</p>
            <p className="text-[10px] text-slate-500 font-mono">CNIC: {c.patient_cnic || "-"}</p>
          </div>
        )}
        {td(
          <div>
            <p className="text-[10.5px] font-semibold text-slate-700">{c.dosage_instructions || "As Prescribed"}</p>
            <p className="text-[10px] text-slate-400 font-mono">{c.patient_phone || "-"}</p>
          </div>
        )}
      </tr>
    ))}</>;
  }

  if (activeTab === "pharmacy_expiry_aging") {
    if (!productBatches.length) return empty(8, "No active product batches in stock.");
    const now = new Date();
    return <>{productBatches.map((b: any) => {
      const exp = new Date(b.expiry_date);
      const days = Math.floor((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
      const val = Number(b.quantity || 0) * Number(b.purchase_price || 0);

      let statusBadge = badge("🟢 Good (>90d)", "bg-emerald-50 text-emerald-700 border border-emerald-200");
      if (days < 0) statusBadge = badge("🔴 EXPIRED", "bg-red-100 text-red-800 border border-red-200 animate-pulse font-black");
      else if (days <= 30) statusBadge = badge("🟠 ≤30d Return", "bg-amber-100 text-amber-800 border border-amber-200 font-black");
      else if (days <= 90) statusBadge = badge("🟡 ≤90d Warning", "bg-purple-50 text-purple-700 border border-purple-200");

      return (
        <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
          {td(
            <div>
              <p className="font-black text-slate-800">{b.products?.name || "Medicine"}</p>
              {b.products?.shelf_location && <p className="text-[10px] text-slate-400">Shelf: {b.products.shelf_location}</p>}
            </div>
          )}
          {td(<div className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{b.batch_number || "BATCH"}</div>)}
          {td(b.expiry_date, false, false, "font-mono font-bold text-[11px]")}
          {td(<div className={`font-mono font-black ${days < 0 ? "text-rose-600" : days <= 30 ? "text-amber-600" : "text-slate-600"}`}>{days < 0 ? `${Math.abs(days)}d Overdue` : `${days}d`}</div>, true)}
          {td(`${b.quantity} ${b.products?.unit || "pcs"}`)}
          {td(`Rs ${Math.round(b.purchase_price || 0).toLocaleString()}`, true)}
          {td(<div className="font-black text-slate-800">Rs {Math.round(val).toLocaleString()}</div>, true)}
          {td(statusBadge)}
        </tr>
      );
    })}</>;
  }

  if (activeTab === "pharmacy_temperature") {
    if (!temperatureLogs.length) return empty(7, "No refrigerator temperature logs recorded.");
    return <>{temperatureLogs.map((t: any) => {
      const isWarn = (Number(t.morning_temp) < 2 || Number(t.morning_temp) > 8 || Number(t.evening_temp) < 2 || Number(t.evening_temp) > 8);
      return (
        <tr key={t.id} className={`hover:bg-slate-50/70 transition-colors ${isWarn ? "bg-rose-50/30" : ""}`}>
          {td(t.date, false, false, "font-mono text-[11px] text-slate-500")}
          {td(t.fridge_name || "Vaccine Main Fridge", false, true)}
          {td(<div className={`font-mono font-black ${Number(t.morning_temp) < 2 || Number(t.morning_temp) > 8 ? "text-rose-600 font-bold" : "text-emerald-700"}`}>{t.morning_temp || "-"} °C</div>)}
          {td(<div className={`font-mono font-black ${Number(t.evening_temp) < 2 || Number(t.evening_temp) > 8 ? "text-rose-600 font-bold" : "text-emerald-700"}`}>{t.evening_temp || "-"} °C</div>)}
          {td(isWarn ? badge("⚠️ Alert (Out of 2-8°C)", "bg-rose-100 text-rose-800 border border-rose-200") : badge("✅ Safe (2°C - 8°C)", "bg-emerald-50 text-emerald-700 border border-emerald-200"))}
          {td(`${t.power_outage_hours || 0} Hours`)}
          {td(t.verified_by || "Pharmacist Incharge", false, false, "text-slate-500 font-semibold")}
        </tr>
      );
    })}</>;
  }

  if (activeTab === "pharmacy_short_book") {
    if (!shortBookItems.length) return empty(6, "Short Book is clear! No missing demands logged.");
    return <>{shortBookItems.map((s: any) => (
      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
        {td(<div className="font-black text-slate-800">{s.medicine_name}</div>)}
        {td(s.formula || "-", false, false, "italic text-slate-500")}
        {td(<div className="font-mono font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{s.request_count || 1}x Requests</div>, true)}
        {td(s.urgency === "urgent" ? badge("🚨 Urgent Need", "bg-rose-100 text-rose-800 border border-rose-200 font-black") : badge("Routine Order", "bg-slate-100 text-slate-700"))}
        {td(
          <div>
            <p className="font-bold text-slate-700">{s.customer_name || "Customer"}</p>
            <p className="text-[10px] text-slate-400 font-mono">{s.customer_phone || "-"}</p>
          </div>
        )}
        {td(s.distributor_name || "Generic Distributor", false, false, "text-slate-600 font-semibold")}
      </tr>
    ))}</>;
  }

  if (activeTab === "pharmacy_doctors") {
    if (!doctorCommissions.length) return empty(7, "No affiliated doctors or prescription incentives recorded.");
    return <>{doctorCommissions.map((d: any) => (
      <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
        {td(
          <div>
            <p className="font-black text-slate-800">Dr. {d.doctor_name}</p>
            <p className="text-[10px] text-slate-400">{d.specialization || "General Physician"}</p>
          </div>
        )}
        {td(<div className="font-mono text-[10px] text-slate-500">{d.pmdc_no || "-"}</div>)}
        {td(d.hospital_clinic || "-", false, false, "text-slate-600")}
        {td(`${d.total_prescriptions || 0} Rx`, true, false, "font-mono font-bold")}
        {td(`Rs ${Math.round(d.total_bill_amount || 0).toLocaleString()}`, true)}
        {td(`Rs ${Math.round(d.commission_earned || 0).toLocaleString()}`, true, false, "text-emerald-700 font-bold")}
        {td(<div className="font-black text-purple-700">Rs {Math.round(d.balance_due || 0).toLocaleString()}</div>, true)}
      </tr>
    ))}</>;
  }

  if (activeTab === "pharma_company_margin") {
    if (!pharmaCompanyMarginData.length) return empty(6, "No pharmaceutical manufacturer sales data in range.");
    return <>{pharmaCompanyMarginData.map((c: any) => (
      <tr key={c.name} className="hover:bg-slate-50/70 transition-colors">
        {td(<div className="font-black text-slate-800">{c.name}</div>)}
        {td(`${c.units.toLocaleString()} units`, true, false, "font-mono text-slate-500")}
        {td(`Rs ${Math.round(c.revenue).toLocaleString()}`, true, true)}
        {td(`Rs ${Math.round(c.cost).toLocaleString()}`, true, false, "text-slate-400")}
        {td(<div className="font-black text-emerald-600">Rs {Math.round(c.profit).toLocaleString()}</div>, true)}
        {td(<div className="font-bold text-slate-600">{(c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0).toFixed(1)}%</div>, true)}
      </tr>
    ))}</>;
  }

  if (activeTab === "dead_stock_abc") {
    if (!abcDeadStockData.length) return empty(7, "No products registered.");
    return <>{abcDeadStockData.map((a: any) => {
      let classBadge = badge("🚀 Class A (Fast)", "bg-emerald-50 text-emerald-700 border border-emerald-200 font-black");
      if (a.classification === "B") classBadge = badge("🔄 Class B (Steady)", "bg-blue-50 text-blue-700 border border-blue-200");
      else if (a.classification === "C") classBadge = badge("⚠️ Class C (Dead Stock)", "bg-rose-100 text-rose-800 border border-rose-200 font-black");

      return (
        <tr key={a.id} className={`hover:bg-slate-50/70 transition-colors ${a.classification === "C" ? "bg-rose-50/20" : ""}`}>
          {td(classBadge)}
          {td(<div className="font-black text-slate-800">{a.name}</div>)}
          {td(`${a.unitsSold.toLocaleString()} ${a.unit}`, true, false, "font-mono font-bold")}
          {td(`${a.currentStock.toLocaleString()} ${a.unit}`)}
          {td(`Rs ${Math.round(a.cost).toLocaleString()}`, true)}
          {td(<div className={`font-black ${a.classification === "C" ? "text-rose-700 font-extrabold" : "text-slate-800"}`}>Rs {Math.round(a.trappedCapital).toLocaleString()}</div>, true)}
          {td(a.classification === "C" ? <div className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Clearance / Return</div> : <div className="text-[10px] text-emerald-600 font-bold">Keep Stocked</div>)}
        </tr>
      );
    })}</>;
  }

  if (activeTab === "hourly_rush") {
    if (!hourlyRushData.length) return empty(4, "No sales traffic in range.");
    return <>{hourlyRushData.map((h: any) => (
      <tr key={h.hour} className="hover:bg-slate-50/70 transition-colors">
        {td(<div className="font-black text-slate-800">{h.label}</div>)}
        {td(`${h.count} invoices`, true, false, "font-mono font-bold text-slate-600")}
        {td(`Rs ${Math.round(h.total).toLocaleString()}`, true, true)}
        {td(<div className="font-bold text-amber-700">Rs {Math.round(h.total / (h.count || 1)).toLocaleString()}</div>, true)}
      </tr>
    ))}</>;
  }

  if (activeTab === "inactive_khata") {
    if (!inactiveKhataData.length) return empty(7, "No outstanding inactive khata debtors.");
    return <>{inactiveKhataData.map((k: any) => (
      <tr key={k.id} className="hover:bg-slate-50/70 transition-colors">
        {td(<div className="font-black text-slate-800">{k.name}</div>)}
        {td(k.phone || "-", false, false, "font-mono text-slate-500")}
        {td(<div className="font-black text-rose-600">Rs {Math.round(k.balance).toLocaleString()}</div>, true)}
        {td(k.lastVisit, false, false, "text-slate-500 text-[11px]")}
        {td(<div className="font-mono font-bold text-slate-600">{k.daysInactive} days</div>, true)}
        {td(k.daysInactive > 60 ? badge("🚨 Severe Delay (>60d)", "bg-rose-100 text-rose-800 border border-rose-200") : badge("⚠️ Overdue (>30d)", "bg-amber-100 text-amber-800 border border-amber-200"))}
        {td(
          k.phone ? (
            <a
              href={`https://wa.me/${k.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Assalam o Alaikum ${k.name} bhai, aap ke khata ka baqaya Rs ${Math.round(k.balance).toLocaleString()} hai. Baraye meherbani is ki adaigi farmayein. Shukriya!`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold border border-emerald-200"
            >
              <MessageCircle size={10} /> WhatsApp
            </a>
          ) : "-"
        )}
      </tr>
    ))}</>;
  }

  if (activeTab === "register_shifts") {
    if (!sessionsData.length) return empty(6, "No cashier register shift logs found.");
    return <>{sessionsData.map((s: any) => {
      const u = usersData.find((usr: any) => usr.id === s.user_id);
      const diff = Number(s.cash_difference || 0);
      const shiftDate = s.opened_at || s.created_at || s.started_at || new Date();
      return (
        <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
          {td(new Date(shiftDate).toLocaleString(), false, false, "font-mono text-[10.5px] text-slate-500")}
          {td(u?.name || "Operator", false, true)}
          {td(`Rs ${Math.round(s.opening_cash || s.opening_balance || 0).toLocaleString()}`, true)}
          {td(`Rs ${Math.round(s.closing_cash || s.closing_balance || s.expected_cash || 0).toLocaleString()}`, true, true)}
          {td(
            <div className={`font-mono font-black ${diff < 0 ? "text-rose-600" : diff > 0 ? "text-emerald-600" : "text-slate-600"}`}>
              {diff === 0 ? "Balanced (0)" : diff < 0 ? `-Rs ${Math.abs(Math.round(diff)).toLocaleString()} (Short)` : `+Rs ${Math.round(diff).toLocaleString()} (Surplus)`}
            </div>,
            true
          )}
          {td(badge(s.status || "closed", s.status === "open" ? "bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse" : "bg-slate-100 text-slate-600"))}
        </tr>
      );
    })}</>;
  }

  if (activeTab === "returns_damage") {
    if (!returnsDamageData.length) return empty(5, "No returns or damaged items recorded in date range.");
    return <>{returnsDamageData.map((r: any) => (
      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
        {td(new Date(r.created_at).toLocaleDateString(), false, false, "text-slate-500")}
        {td(<div className="font-mono text-[10px] text-slate-500 font-bold">{r.id.substring(0, 8).toUpperCase()}</div>)}
        {td(r.parties?.name || "Walk-in", false, true)}
        {td(badge(r.is_voided ? "VOIDED INVOICE" : (r.status || "Returned"), "bg-rose-50 text-rose-700 border border-rose-100 font-bold"))}
        {td(<div className="font-black text-rose-600">Rs {Math.round(Math.abs(r.total_amount || 0)).toLocaleString()}</div>, true)}
      </tr>
    ))}</>;
  }

  if (activeTab === "sales_by_product") {
    if (!salesByProduct.length) return empty(7, "No product sales in selected date range.");
    return <>{salesByProduct.map((p: any) => (
      <tr key={p.name} className="hover:bg-slate-50/70 transition-colors">
        {td(p.name, false, true)}
        {td(`${p.qty.toLocaleString()} units`, true, false, "text-slate-500 font-mono text-[10px]")}
        {td(`Rs ${Math.round(p.revenue / (p.qty || 1)).toLocaleString()}`, true)}
        {td(`Rs ${Math.round(p.revenue).toLocaleString()}`, true, true)}
        {td(`Rs ${Math.round(p.cost).toLocaleString()}`, true, false, "text-slate-400")}
        {td(<div className="font-black text-emerald-600">Rs {Math.round(p.profit).toLocaleString()}</div>, true)}
        {td(`${(p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0).toFixed(1)}%`, true, false, "text-slate-500 font-bold")}
      </tr>
    ))}</>;
  }

  if (activeTab === "sales_by_customer") {
    if (!salesByCustomer.length) return empty(5, "No customer data in range.");
    return <>{salesByCustomer.map((c: any) => (
      <tr key={c.name} className="hover:bg-slate-50/70 transition-colors">
        {td(c.name, false, true)}
        {td(`${c.count} bills`, true, false, "text-slate-500 font-mono text-[10px]")}
        {td(`Rs ${Math.round(c.total).toLocaleString()}`, true, true)}
        {td(`Rs ${Math.round(c.paid).toLocaleString()}`, true, false, "text-emerald-600")}
        {td(<div className={`font-black ${c.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>Rs {Math.round(c.balance).toLocaleString()}</div>, true)}
      </tr>
    ))}</>;
  }

  if (activeTab === "sales_by_payment") {
    if (!salesByPayment.length) return empty(4, "No payment data in range.");
    const tot = salesByPayment.reduce((s: number, p: any) => s + p.total, 0);
    return <>{salesByPayment.map((p: any) => (
      <tr key={p.mode} className="hover:bg-slate-50/70 transition-colors">
        {td(<div className="font-black uppercase">{p.mode}</div>)}
        {td(`${p.count} invoices`, true, false, "text-slate-500 font-mono text-[10px]")}
        {td(`Rs ${Math.round(p.total).toLocaleString()}`, true, true)}
        {td(`${tot > 0 ? ((p.total / tot) * 100).toFixed(1) : 0}%`, true, false, "text-slate-500 font-bold")}
      </tr>
    ))}</>;
  }

  if (activeTab === "purchases") {
    if (!purchasesData.length) return empty(5, "No purchase orders in range.");
    return <>{purchasesData.map((p: any) => (
      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
        {td(new Date(p.created_at).toLocaleDateString(), false, false, "text-slate-500")}
        {td(<div className="font-mono text-[10px] text-slate-400">{p.id.substring(0,8).toUpperCase()}</div>)}
        {td(p.parties?.name || "Generic Supplier", false, true)}
        {td(badge(p.status || "completed", "bg-emerald-50 text-emerald-700"))}
        {td(`Rs ${Math.round(p.total_amount || 0).toLocaleString()}`, true, true)}
      </tr>
    ))}</>;
  }

  if (activeTab === "purchases_by_supplier") {
    if (!purchasesBySupplier.length) return empty(3, "No supplier procurement data.");
    return <>{purchasesBySupplier.map((s: any) => (
      <tr key={s.name} className="hover:bg-slate-50/70 transition-colors">
        {td(s.name, false, true)}
        {td(`${s.count} orders`, true, false, "text-slate-500 font-mono text-[10px]")}
        {td(`Rs ${Math.round(s.total).toLocaleString()}`, true, true)}
      </tr>
    ))}</>;
  }

  if (activeTab === "expenses") {
    if (!expensesData.length) return empty(5, "No expenses logged in range.");
    return <>{expensesData.map((e: any) => (
      <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
        {td(new Date(e.created_at).toLocaleDateString(), false, false, "text-slate-500")}
        {td(e.name, false, true)}
        {td(<div className="text-[9px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{e.expense_type || "general"}</div>)}
        {td(e.remarks || "-", false, false, "truncate max-w-[120px] text-slate-400")}
        {td(<div className="font-bold text-rose-600">Rs {Math.round(e.amount || 0).toLocaleString()}</div>, true)}
      </tr>
    ))}</>;
  }

  if (activeTab === "expense_category") {
    if (!expenseByCategory.length) return empty(4, "No expense categories found.");
    const tot = expenseByCategory.reduce((s: number, c: any) => s + c.total, 0);
    return <>{expenseByCategory.map((c: any) => (
      <tr key={c.category} className="hover:bg-slate-50/70 transition-colors">
        {td(<div className="font-black uppercase">{c.category}</div>)}
        {td(`${c.count} logs`, true, false, "text-slate-500 font-mono text-[10px]")}
        {td(<div className="font-bold text-rose-600">Rs {Math.round(c.total).toLocaleString()}</div>, true)}
        {td(`${tot > 0 ? ((c.total / tot) * 100).toFixed(1) : 0}%`, true, false, "text-slate-500 font-bold")}
      </tr>
    ))}</>;
  }

  if (activeTab === "pl") {
    const rows = [
      { label: "Gross Sales Revenue", val: plSummary.revenue + plSummary.discount, cls: "text-slate-800", isNegative: false },
      { label: "Discount Allowed (-)", val: plSummary.discount, cls: "text-rose-600", isNegative: true },
      { label: "Net Sales Revenue", val: plSummary.revenue, cls: "text-slate-700 font-bold", isNegative: false },
      { label: "Cost of Goods Sold / COGS (-)", val: plSummary.cogs, cls: "text-slate-500", isNegative: true },
      { label: plSummary.grossProfit >= 0 ? "Gross Profit" : "Gross Loss", val: plSummary.grossProfit, cls: plSummary.grossProfit >= 0 ? "text-blue-700 bg-blue-50/60" : "text-rose-700 bg-rose-50/60", bold: true, isNegative: plSummary.grossProfit < 0 },
      { label: "Operating Expenses (-)", val: plSummary.expenses, cls: "text-slate-500", isNegative: true },
      { label: plSummary.netProfit >= 0 ? "Net Profit" : "Net Loss", val: plSummary.netProfit, cls: plSummary.netProfit >= 0 ? "text-emerald-700 bg-emerald-50 font-black text-sm" : "text-rose-700 bg-rose-50 font-black text-sm", bold: true, isNegative: plSummary.netProfit < 0 },
    ];
    return <>{rows.map((r, i) => {
      const displayVal = r.isNegative ? `-Rs ${Math.round(Math.abs(r.val)).toLocaleString()}` : `Rs ${Math.round(Math.abs(r.val)).toLocaleString()}`;
      return (
        <tr key={i} className={r.cls.includes("bg-") ? "" : "hover:bg-slate-50/70 transition-colors"}>
          <td className={`py-2.5 px-3.5 text-xs font-bold ${r.cls}`}>{r.label}</td>
          <td className={`py-2.5 px-3.5 text-xs text-right font-black ${r.cls}`}>{displayVal}</td>
        </tr>
      );
    })}</>;
  }

  if (activeTab === "inventory") {
    if (!productsData.length) return empty(6, "No products in database.");
    return <>{productsData.map((p: any) => {
      const stock = Number(p.current_stock || 0);
      const alert = stock <= Number(p.min_stock_level || 0);
      const cost = Number(p.purchase_price_single || 0);
      const retail = Number(p.sale_price_single || 0);

      return (
        <tr key={p.id} className={`hover:bg-slate-50/70 transition-colors ${alert ? "bg-amber-50/30" : ""}`}>
          {td(<div className="font-mono text-[10px] text-slate-400">{p.id.substring(0, 8).toUpperCase()}</div>)}
          {td(
            <div>
              <p className="font-bold text-slate-800">{p.name}</p>
              {p.brands?.name && <p className="text-[10px] text-slate-400 font-semibold">{p.brands.name}</p>}
            </div>
          )}
          {td(
            <div className={`font-bold px-2 py-0.5 rounded ${alert ? "bg-amber-100 text-amber-800 font-black" : "text-slate-700"}`}>
              {stock} {p.unit || "pcs"}
            </div>
          )}
          {td(`${p.min_stock_level || 0} ${p.unit || "pcs"}`, false, false, "text-slate-400")}
          {td(`Rs ${Math.round(cost * stock).toLocaleString()}`, true)}
          {td(`Rs ${Math.round(retail * stock).toLocaleString()}`, true, true)}
        </tr>
      );
    })}</>;
  }

  if (activeTab === "khata") {
    if (!partiesData.length) return empty(4, "No parties registered.");
    return <>{partiesData.map((p: any) => {
      const bal = Number(p.current_balance || 0);
      return (
        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
          {td(p.name, false, true)}
          {td(p.phone || "-", false, false, "font-mono text-slate-500")}
          {td(badge(p.type === "customer" ? "Customer" : "Supplier", p.type === "customer" ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-orange-50 text-orange-700 border border-orange-100"))}
          {td(<div className={`font-black ${bal > 0 ? (p.type === "customer" ? "text-rose-600" : "text-slate-700") : "text-emerald-600"}`}>Rs {Math.round(bal).toLocaleString()}</div>, true)}
        </tr>
      );
    })}</>;
  }

  if (activeTab === "aging") {
    if (!agingReport.receivables.length && !agingReport.payables.length) return empty(6, "No outstanding balances to age.");
    return (
      <>
        {agingReport.receivables.length > 0 && (
          <tr className="bg-slate-100"><td colSpan={6} className="py-2 px-4 text-[10px] font-black text-slate-500 tracking-widest uppercase">Accounts Receivable (Customer Udhaar)</td></tr>
        )}
        {agingReport.receivables.map((r: any) => (
          <tr key={`r_${r.name}`} className="hover:bg-slate-50/70 transition-colors">
            {td(r.name, false, true)}
            {td(`Rs ${Math.round(r.b0_30).toLocaleString()}`, true)}
            {td(`Rs ${Math.round(r.b31_60).toLocaleString()}`, true)}
            {td(`Rs ${Math.round(r.b61_90).toLocaleString()}`, true)}
            {td(<div className={r.b90_plus > 0 ? "text-rose-600 font-bold" : ""}>Rs {Math.round(r.b90_plus).toLocaleString()}</div>, true)}
            {td(<div className="font-black text-emerald-600">Rs {Math.round(r.total).toLocaleString()}</div>, true)}
          </tr>
        ))}
        {agingReport.payables.length > 0 && (
          <tr className="bg-slate-100"><td colSpan={6} className="py-2 px-4 text-[10px] font-black text-slate-500 tracking-widest uppercase">Accounts Payable (Supplier Udhaar)</td></tr>
        )}
        {agingReport.payables.map((p: any) => (
          <tr key={`p_${p.name}`} className="hover:bg-slate-50/70 transition-colors">
            {td(p.name, false, true)}
            {td(`Rs ${Math.round(p.b0_30).toLocaleString()}`, true)}
            {td(`Rs ${Math.round(p.b31_60).toLocaleString()}`, true)}
            {td(`Rs ${Math.round(p.b61_90).toLocaleString()}`, true)}
            {td(<div className={p.b90_plus > 0 ? "text-amber-600 font-bold" : ""}>Rs {Math.round(p.b90_plus).toLocaleString()}</div>, true)}
            {td(<div className="font-black text-slate-800">Rs {Math.round(p.total).toLocaleString()}</div>, true)}
          </tr>
        ))}
      </>
    );
  }

  if (activeTab === "balance_sheet") {
    return (
      <>
        <tr className="bg-slate-100"><td colSpan={3} className="py-2 px-4 text-[10px] font-black text-slate-500 tracking-widest uppercase">ASSETS (DEBIT ACCOUNTS)</td></tr>
        <tr className="hover:bg-slate-50/70 transition-colors">
          {td("Cash & Bank Accounts", false, true)}
          {td(`Rs ${Math.round(balanceSheetReport.cashTotal).toLocaleString()}`, true, true)}
          {td("-", true, false, "text-slate-350")}
        </tr>
        <tr className="hover:bg-slate-50/70 transition-colors">
          {td("Inventory Valuation (At Cost)", false, true)}
          {td(`Rs ${Math.round(balanceSheetReport.inventoryVal).toLocaleString()}`, true, true)}
          {td("-", true, false, "text-slate-350")}
        </tr>
        <tr className="hover:bg-slate-50/70 transition-colors">
          {td("Customer Receivables (Khata)", false, true)}
          {td(`Rs ${Math.round(balanceSheetReport.receivables).toLocaleString()}`, true, true)}
          {td("-", true, false, "text-slate-350")}
        </tr>
        <tr className="bg-emerald-50/80 font-black text-emerald-800">
          {td("TOTAL ASSETS (A)", false, true)}
          {td(`Rs ${Math.round(balanceSheetReport.totalAssets).toLocaleString()}`, true, true)}
          {td("-", true, false, "text-emerald-700/60")}
        </tr>
        <tr className="bg-slate-100"><td colSpan={3} className="py-2 px-4 text-[10px] font-black text-slate-500 tracking-widest uppercase">LIABILITIES &amp; CAPITAL (CREDIT ACCOUNTS)</td></tr>
        <tr className="hover:bg-slate-50/70 transition-colors">
          {td("Supplier Payables (Restock)", false, true)}
          {td("-", true, false, "text-slate-350")}
          {td(`Rs ${Math.round(balanceSheetReport.payables).toLocaleString()}`, true, true)}
        </tr>
        <tr className="hover:bg-slate-50/70 transition-colors">
          {td("Owner's Equity & Retained Surplus", false, true)}
          {td("-", true, false, "text-slate-350")}
          {td(`Rs ${Math.round(balanceSheetReport.equity).toLocaleString()}`, true, true)}
        </tr>
        <tr className="bg-blue-50/80 font-black text-blue-800">
          {td("TOTAL LIABILITIES & CAPITAL (B)", false, true)}
          {td("-", true, false, "text-blue-700/60")}
          {td(`Rs ${Math.round(balanceSheetReport.totalLiabilities + balanceSheetReport.equity).toLocaleString()}`, true, true)}
        </tr>
      </>
    );
  }

  if (activeTab === "tax") {
    if (!taxReportData.length) return empty(6, "No tax transactions found in date range.");
    return <>{taxReportData.map((inv: any) => (
      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
        {td(new Date(inv.created_at).toLocaleDateString(), false, false, "text-slate-500")}
        {td(<div className="font-mono text-[10px] text-slate-500">{inv.id.substring(0,8).toUpperCase()}</div>)}
        {td(inv.parties?.name || "Walk-in Customer", false, true)}
        {td(`Rs ${Math.round(Number(inv.total_amount || 0) - Number(inv.tax_amount || 0)).toLocaleString()}`, true)}
        {td(<div className="text-amber-700 font-bold">Rs {Math.round(Number(inv.tax_amount || 0)).toLocaleString()}</div>, true)}
        {td(`Rs ${Math.round(Number(inv.total_amount || 0)).toLocaleString()}`, true, true)}
      </tr>
    ))}</>;
  }

  if (activeTab === "salesman") {
    if (!salesmanPerformanceData.length) return empty(4, "No salesman billing activities logged.");
    return <>{salesmanPerformanceData.map((row: any) => (
      <tr key={row.name} className="hover:bg-slate-50/70 transition-colors">
        {td(row.name, false, true)}
        {td(`${row.count} invoices`, true, false, "text-slate-500 font-mono text-[10px]")}
        {td(`Rs ${Math.round(row.total).toLocaleString()}`, true, true)}
        {td(<div className="text-blue-700 font-bold">Rs {Math.round(row.average).toLocaleString()}</div>, true)}
      </tr>
    ))}</>;
  }

  return null;
}
