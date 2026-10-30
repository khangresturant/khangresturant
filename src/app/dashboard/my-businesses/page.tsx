"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { toast } from "sonner";
import {
  Building2, TrendingUp, ShoppingCart, AlertCircle, Package,
  Users, CreditCard, Clock, Trash2, ArrowRight,
  RefreshCw, Store, Loader2, CheckCircle2,
  BarChart3, Wallet, Crown, XCircle, Plus, Zap,
  TrendingDown, PieChart, Calendar, ChevronDown, Tag, Calculator
} from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────
interface BusinessStats {
  shopId: string;
  name: string;
  industryType: string;
  createdAt: string;
  subscriptionTier: string;
  subscriptionExpiresAt: string | null;
  totalRevenue: number;
  totalInvoices: number;
  outstanding: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  totalCogs: number;
  totalDiscount: number;
  totalTax: number;
  productCount: number;
  staffCount: number;
}

// ─── Time Filter Presets ──────────────────────────────────────────────────────
type TimePreset = "today" | "yesterday" | "this_week" | "this_month" | "this_year" | "all_time" | "custom";

function getDateRange(preset: TimePreset, customFrom?: string, customTo?: string): { from: string; to: string } | null {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === "all_time") return null;
  if (preset === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };

  const today = fmt(now);
  if (preset === "today") return { from: today, to: today };

  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (preset === "yesterday") return { from: fmt(yesterday), to: fmt(yesterday) };

  if (preset === "this_week") {
    const dow = now.getDay(); // 0=Sun
    const mon = new Date(now); mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    return { from: fmt(mon), to: today };
  }
  if (preset === "this_month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: fmt(first), to: today };
  }
  if (preset === "this_year") {
    const first = new Date(now.getFullYear(), 0, 1);
    return { from: fmt(first), to: today };
  }
  return null;
}

const TIME_FILTERS: { key: TimePreset; label: string; short: string }[] = [
  { key: "today", label: "Today", short: "Today" },
  { key: "yesterday", label: "Yesterday", short: "Yesterday" },
  { key: "this_week", label: "This Week", short: "Week" },
  { key: "this_month", label: "This Month", short: "Month" },
  { key: "this_year", label: "This Year", short: "Year" },
  { key: "all_time", label: "All Time", short: "All" },
  { key: "custom", label: "Custom Range", short: "Custom" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function industryLabel(type: string) {
  const map: Record<string, string> = {
    general: "General Store", karyana: "Grocery / Supermarket",
    pharmacy: "Pharmacy", electronics: "Electronics / Mobile",
    hardware: "Hardware / Auto Parts", restaurant: "Restaurant / Food",
    tailor: "Tailor Shop", fertilizer: "Fertilizer / Agri",
    fuel: "Fuel Station", showroom: "Showroom / Vehicles",
    garments: "Garments / Clothing", crockery: "Crockery / Ceramics",
  };
  return map[type] || type;
}

function industryColor(type: string) {
  const map: Record<string, string> = {
    general: "from-slate-500 to-slate-700",
    karyana: "from-green-500 to-emerald-700",
    pharmacy: "from-blue-500 to-blue-700",
    electronics: "from-violet-500 to-purple-700",
    hardware: "from-orange-500 to-amber-700",
    restaurant: "from-red-500 to-rose-700",
    tailor: "from-pink-500 to-fuchsia-700",
    fertilizer: "from-lime-500 to-green-700",
    fuel: "from-yellow-500 to-orange-700",
    showroom: "from-sky-500 to-cyan-700",
    garments: "from-indigo-500 to-violet-700",
    crockery: "from-teal-500 to-cyan-700",
  };
  return map[type] || "from-slate-500 to-slate-700";
}

function subBadge(tier: string, expiresAt: string | null) {
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : true;
  if (tier === "premium" && !isExpired)
    return { label: "Premium", color: "bg-amber-400/20 text-amber-300 border-amber-400/30", icon: Crown };
  if (tier === "free" || isExpired)
    return { label: isExpired ? "Expired" : "Free", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: XCircle };
  return { label: tier, color: "bg-blue-400/20 text-blue-300 border-blue-400/30", icon: Zap };
}

function daysLeft(expiresAt: string | null) {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MyBusinessesPage() {
  const router = useRouter();
  const { userId, shopId } = useShop();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<BusinessStats[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);
  const [terminating, setTerminating] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [terminateTarget, setTerminateTarget] = useState<BusinessStats | null>(null);

  // Time filter state
  const [timePreset, setTimePreset] = useState<TimePreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: userShops, error: usErr } = await supabase
        .from("user_shops")
        .select("shop_id, role, shops(id, name, industry_type, created_at, subscription_tier, subscription_expires_at)")
        .eq("user_id", user.id);

      if (usErr) throw usErr;
      if (!userShops || userShops.length < 2) {
        router.push("/dashboard"); return;
      }

      const dateRange = getDateRange(timePreset, customFrom, customTo);

      const statsPromises = userShops
        .filter((us: any) => us.shops)
        .map(async (us: any) => {
          const shop = us.shops;

          // ── Step 1: Build cost dictionaries (same as Reports page) ──────
          // Fetch all products for this shop with purchase prices
          const { data: prodData } = await supabase
            .from("products")
            .select("id, purchase_price_single, product_variants(id, purchase_price)")
            .eq("shop_id", shop.id);

          const productCostDict: Record<string, number> = {};
          const variantCostDict: Record<string, number> = {};
          (prodData || []).forEach((p: any) => {
            productCostDict[p.id] = Number(p.purchase_price_single || 0);
            (p.product_variants || []).forEach((v: any) => {
              variantCostDict[v.id] = Number(v.purchase_price || 0);
            });
          });

          // ── Step 2: Fetch invoices with items (quantity only) ────────────
          let invQuery = supabase
            .from("invoices")
            .select(`id, total_amount, paid_amount, status, discount, tax_amount,
              invoice_items ( product_id, variant_id, quantity )`)
            .eq("shop_id", shop.id)
            .eq("is_voided", false)
            .not("status", "in", '("quotation","draft")');

          if (dateRange) {
            invQuery = invQuery
              .gte("created_at", `${dateRange.from}T00:00:00.000Z`)
              .lte("created_at", `${dateRange.to}T23:59:59.999Z`);
          }

          // ── Step 3: Expenses with date filter ────────────────────────────
          let expQuery = supabase
            .from("expenses")
            .select("amount")
            .eq("shop_id", shop.id);

          if (dateRange) {
            expQuery = expQuery
              .gte("created_at", `${dateRange.from}T00:00:00.000Z`)
              .lte("created_at", `${dateRange.to}T23:59:59.999Z`);
          }

          const [invoiceRes, expenseRes, productCountRes, staffRes] = await Promise.all([
            invQuery,
            expQuery,
            supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
            supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
          ]);

          const invoices = invoiceRes.data || [];
          const expenses = expenseRes.data || [];

          let totalRevenue = 0;
          let totalCogs = 0;
          let totalDiscount = 0;
          let totalTax = 0;
          let outstanding = 0;

          invoices.forEach((inv: any) => {
            const amt = Number(inv.total_amount || 0);
            const paid = Number(inv.paid_amount || 0);
            totalRevenue += amt;
            totalDiscount += Number(inv.discount || 0);
            totalTax += Number(inv.tax_amount || 0);
            if (inv.status !== "paid") outstanding += Math.max(0, amt - paid);

            // COGS: lookup cost from dictionaries (same logic as Reports page)
            (inv.invoice_items || []).forEach((item: any) => {
              const cost =
                item.variant_id && variantCostDict[item.variant_id]
                  ? variantCostDict[item.variant_id]
                  : (productCostDict[item.product_id] || 0);
              totalCogs += cost * Number(item.quantity || 0);
            });
          });

          const grossProfit = totalRevenue - totalCogs;
          const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
          const netProfit = grossProfit - totalExpenses;

          return {
            shopId: shop.id, name: shop.name, industryType: shop.industry_type,
            createdAt: shop.created_at, subscriptionTier: shop.subscription_tier,
            subscriptionExpiresAt: shop.subscription_expires_at,
            totalRevenue, totalInvoices: invoices.length, outstanding,
            grossProfit, totalExpenses, netProfit, totalCogs, totalDiscount, totalTax,
            productCount: productCountRes.count || 0, staffCount: staffRes.count || 0,
          } as BusinessStats;
        });

      setBusinesses(await Promise.all(statsPromises));
    } catch (err: any) {
      toast.error("Failed to load businesses: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, timePreset, customFrom, customTo]);

  useEffect(() => {
    if (userId) loadBusinesses();
  }, [userId, loadBusinesses]);

  const handleSwitch = async (targetShopId: string) => {
    if (targetShopId === shopId) { router.push("/dashboard"); return; }
    setSwitching(targetShopId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (typeof window !== "undefined") {
        localStorage.removeItem("hisabx_shop_context");
        localStorage.removeItem("The Accounts_shop_context");
        localStorage.removeItem("is_impersonating");
        localStorage.removeItem("impersonated_shop_id");
        localStorage.removeItem("impersonated_shop_name");
        localStorage.removeItem("impersonated_user_name");
      }
      await supabase.from("user_profiles").update({ shop_id: targetShopId }).eq("id", user.id);
      window.location.href = "/dashboard";
    } catch (e: any) {
      toast.error("Switch failed: " + e.message);
      setSwitching(null);
    }
  };

  const handleTerminate = async () => {
    if (!terminateTarget || confirmName !== terminateTarget.name) {
      toast.error("Business name does not match!"); return;
    }
    setTerminating(terminateTarget.shopId);
    try {
      const sid = terminateTarget.shopId;
      const invIds = ((await supabase.from("invoices").select("id").eq("shop_id", sid)).data || []).map((i: any) => i.id);
      if (invIds.length > 0) await supabase.from("invoice_items").delete().in("invoice_id", invIds);
      await supabase.from("invoices").delete().eq("shop_id", sid);
      await supabase.from("products").delete().eq("shop_id", sid);
      await supabase.from("parties").delete().eq("shop_id", sid);
      await supabase.from("expenses").delete().eq("shop_id", sid);
      await supabase.from("account_transactions").delete().eq("shop_id", sid);
      await supabase.from("cash_accounts").delete().eq("shop_id", sid);
      await supabase.from("user_shops").delete().eq("shop_id", sid);
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("user_profiles").delete().eq("shop_id", sid).neq("id", user?.id || "");
      await supabase.from("shops").delete().eq("id", sid);

      toast.success(`"${terminateTarget.name}" permanently terminated.`);
      setTerminateTarget(null); setConfirmName("");

      if (sid === shopId) {
        const remaining = businesses.find(b => b.shopId !== sid);
        if (remaining && user) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("hisabx_shop_context");
            localStorage.removeItem("The Accounts_shop_context");
          }
          await supabase.from("user_profiles").update({ shop_id: remaining.shopId }).eq("id", user.id);
        }
        window.location.href = "/dashboard";
      } else {
        loadBusinesses();
      }
    } catch (e: any) {
      toast.error("Termination failed: " + e.message);
    } finally {
      setTerminating(null);
    }
  };

  // ── Aggregates ─────────────────────────────────────────────────────────────
  const totalRevenue = businesses.reduce((s, b) => s + b.totalRevenue, 0);
  const totalInvoices = businesses.reduce((s, b) => s + b.totalInvoices, 0);
  const totalOutstanding = businesses.reduce((s, b) => s + b.outstanding, 0);
  const totalProfit = businesses.reduce((s, b) => s + b.netProfit, 0);
  const totalExpenses = businesses.reduce((s, b) => s + b.totalExpenses, 0);
  const totalCogs = businesses.reduce((s, b) => s + b.totalCogs, 0);
  const totalDiscount = businesses.reduce((s, b) => s + b.totalDiscount, 0);

  const activeFilter = TIME_FILTERS.find(f => f.key === timePreset);

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4 md:p-8">

      {/* ── Terminate Confirmation Modal ──────────────────────────────── */}
      {terminateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
              <Trash2 size={24} className="text-red-400" />
            </div>
            <h2 className="text-xl font-black text-white text-center mb-2">Terminate Business</h2>
            <p className="text-slate-400 text-sm text-center mb-6">
              This will <span className="text-red-400 font-bold">permanently delete ALL data</span> for{" "}
              <span className="text-white font-bold">&quot;{terminateTarget.name}&quot;</span> — invoices, products, staff, records. Cannot be undone.
            </p>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
              Type the business name to confirm:
            </label>
            <input
              type="text" value={confirmName} onChange={e => setConfirmName(e.target.value)}
              placeholder={terminateTarget.name}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder:text-slate-600 focus:outline-none focus:border-red-500 mb-5"
            />
            <div className="flex gap-3">
              <button onClick={() => { setTerminateTarget(null); setConfirmName(""); }}
                className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 transition-colors font-bold text-sm cursor-pointer">
                Cancel
              </button>
              <button onClick={handleTerminate} disabled={confirmName !== terminateTarget.name || !!terminating}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-900/50 disabled:text-red-700 text-white font-black text-sm transition-colors cursor-pointer flex items-center justify-center gap-2">
                {terminating ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Terminate
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Building2 size={18} className="text-indigo-400" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">My Businesses</h1>
            </div>
            <p className="text-slate-400 text-sm font-semibold pl-11">
              Unified control panel for all your registered businesses
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadBusinesses} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors text-xs font-bold cursor-pointer disabled:opacity-50">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <Link href="/register?new=true"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-colors">
              <Plus size={13} /> Add Business
            </Link>
          </div>
        </div>

        {/* ── Time Filter Bar ───────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 rounded-2xl p-1.5">
              {TIME_FILTERS.filter(f => f.key !== "custom").map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setTimePreset(f.key); setShowCustomPicker(false); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    timePreset === f.key && !showCustomPicker
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                  }`}
                >
                  {f.short}
                </button>
              ))}
              <button
                onClick={() => { setTimePreset("custom"); setShowCustomPicker(true); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  timePreset === "custom"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                }`}
              >
                <Calendar size={11} /> Custom
              </button>
            </div>

            {/* Custom date pickers */}
            {showCustomPicker && (
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-2xl px-3 py-2">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer" />
                <span className="text-slate-500 text-xs">→</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer" />
                <button
                  onClick={() => { if (customFrom && customTo) loadBusinesses(); }}
                  disabled={!customFrom || !customTo}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black disabled:opacity-50 cursor-pointer"
                >
                  Apply
                </button>
              </div>
            )}

            <span className="text-slate-500 text-xs font-semibold">
              Showing: <span className="text-slate-300">{activeFilter?.label}</span>
            </span>
          </div>
        </div>

        {/* ── Summary Strip ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {[
            { label: "Businesses", value: businesses.length, icon: Building2, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
            { label: "Total Revenue", value: `Rs ${fmt(totalRevenue)}`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
            { label: "Total Cost", value: `Rs ${fmt(totalCogs)}`, icon: Package, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
            { label: "Total Discount", value: `Rs ${fmt(totalDiscount)}`, icon: Tag, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
            { label: "Net Profit", value: `Rs ${fmt(totalProfit)}`, icon: PieChart, color: totalProfit >= 0 ? "text-green-400" : "text-red-400", bg: totalProfit >= 0 ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20" },
            { label: "Expenses", value: `Rs ${fmt(totalExpenses)}`, icon: TrendingDown, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
            { label: "Outstanding", value: `Rs ${fmt(totalOutstanding)}`, icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-2xl border p-4 ${stat.bg} transition-all`}>
              <stat.icon size={18} className={`${stat.color} mb-2`} />
              <p className="text-white text-base font-black leading-tight">{stat.value}</p>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3 animate-pulse">
                <Building2 size={22} className="text-indigo-400" />
              </div>
              <p className="text-slate-400 text-sm font-semibold">Loading stats…</p>
            </div>
          </div>
        )}

        {/* ── Business Cards ─────────────────────────────────────────────── */}
        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {businesses.map((biz) => {
              const badge = subBadge(biz.subscriptionTier, biz.subscriptionExpiresAt);
              const days = daysLeft(biz.subscriptionExpiresAt);
              const isCurrent = biz.shopId === shopId;
              const gradClass = industryColor(biz.industryType);
              const profitPct = biz.totalRevenue > 0 ? ((biz.netProfit / biz.totalRevenue) * 100) : 0;

              return (
                <div key={biz.shopId}
                  className={`relative rounded-3xl border overflow-hidden transition-all duration-300 ${
                    isCurrent ? "border-indigo-500/50 shadow-lg shadow-indigo-500/10" : "border-slate-700/50 hover:border-slate-600/70"
                  } bg-slate-800/60 backdrop-blur-sm`}
                >
                  {/* Top gradient bar */}
                  <div className={`h-1.5 w-full bg-gradient-to-r ${gradClass}`} />

                  {/* Card Header */}
                  <div className="p-5 pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradClass} flex items-center justify-center shrink-0`}>
                          <Store size={20} className="text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-white font-black text-base leading-tight truncate">{biz.name}</h2>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[9px] font-black uppercase tracking-wider shrink-0">
                                <CheckCircle2 size={8} /> Active
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 text-xs font-semibold mt-0.5">{industryLabel(biz.industryType)}</p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black shrink-0 ${badge.color}`}>
                        <badge.icon size={10} /> {badge.label}
                      </div>
                    </div>
                    {days !== null && (
                      <div className={`mt-2 ml-14 flex items-center gap-1.5 text-[10px] font-semibold ${days <= 0 ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-slate-500"}`}>
                        <Clock size={10} />
                        {days <= 0 ? "Subscription expired" : `Expires in ${days} day${days === 1 ? "" : "s"}`}
                      </div>
                    )}
                  </div>

                  {/* Profit Meter */}
                  <div className="mx-5 mt-4 mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Profit Margin</span>
                      <span className={`text-xs font-black ${biz.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {profitPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${biz.netProfit >= 0 ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-red-500 to-rose-400"}`}
                        style={{ width: `${Math.min(100, Math.abs(profitPct))}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats Grid — 12 cards */}
                  <div className="grid grid-cols-3 gap-px mx-5 mb-4 rounded-2xl overflow-hidden border border-slate-700/40">
                    {[
                      { label: "Revenue", value: `Rs ${fmt(biz.totalRevenue)}`, icon: Wallet, color: "text-emerald-400" },
                      { label: "Gross Profit", value: `Rs ${fmt(biz.grossProfit)}`, icon: TrendingUp, color: biz.grossProfit >= 0 ? "text-green-400" : "text-red-400" },
                      { label: "Net Profit", value: `Rs ${fmt(biz.netProfit)}`, icon: PieChart, color: biz.netProfit >= 0 ? "text-green-400" : "text-red-400" },
                      { label: "COGS (Cost)", value: `Rs ${fmt(biz.totalCogs)}`, icon: Package, color: "text-violet-400" },
                      { label: "Expenses", value: `Rs ${fmt(biz.totalExpenses)}`, icon: TrendingDown, color: "text-rose-400" },
                      { label: "Discount", value: `Rs ${fmt(biz.totalDiscount)}`, icon: Tag, color: "text-red-400" },
                      { label: "Tax Collected", value: `Rs ${fmt(biz.totalTax)}`, icon: Calculator, color: "text-sky-400" },
                      { label: "Outstanding", value: `Rs ${fmt(biz.outstanding)}`, icon: AlertCircle, color: biz.outstanding > 0 ? "text-amber-400" : "text-slate-500" },
                      { label: "Invoices", value: biz.totalInvoices.toLocaleString(), icon: ShoppingCart, color: "text-blue-400" },
                      { label: "Products", value: biz.productCount.toLocaleString(), icon: BarChart3, color: "text-sky-400" },
                      { label: "Staff", value: biz.staffCount.toLocaleString(), icon: Users, color: "text-orange-400" },
                      { label: "Registered", value: new Date(biz.createdAt).toLocaleDateString("en-PK", { month: "short", year: "numeric" }), icon: Clock, color: "text-slate-400" },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-slate-900/40 p-2.5">
                        <stat.icon size={12} className={`${stat.color} mb-1.5`} />
                        <p className="text-white text-xs font-black leading-tight">{stat.value}</p>
                        <p className="text-slate-600 text-[9px] font-bold uppercase tracking-wide mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 px-5 pb-5">
                    {isCurrent ? (
                      <button onClick={() => router.push("/dashboard")}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-colors cursor-pointer">
                        <ArrowRight size={13} /> Go to Dashboard
                      </button>
                    ) : (
                      <button onClick={() => handleSwitch(biz.shopId)} disabled={!!switching}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                        {switching === biz.shopId ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                        Switch to This
                      </button>
                    )}
                    <button onClick={() => handleSwitch(biz.shopId)}
                      title="Manage Subscription"
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer shrink-0">
                      <CreditCard size={15} />
                    </button>
                    <button onClick={() => { setTerminateTarget(biz); setConfirmName(""); }}
                      title="Terminate Business"
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer shrink-0">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-slate-600 text-xs font-semibold mt-10">
          The Accounts Business Owner Portal · Real-time data · {activeFilter?.label} view
        </p>
      </div>
    </div>
  );
}
