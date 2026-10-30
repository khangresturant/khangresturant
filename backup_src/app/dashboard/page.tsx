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

type ChartPoint = {
  label: string;
  amount: number;
};

type CategorySaleItem = {
  name: string;
  value: number;
};

export default function DashboardPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
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
  const [salesTrend, setSalesTrend] = useState<ChartPoint[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySaleItem[]>([]);

  useEffect(() => {
    if (shopId) {
      fetchDashboardData();
    }
  }, [shopId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Invoices for Revenue, Daily Count & Trend
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("total_amount, paid_amount, created_at, status, payment_mode")
        .eq("shop_id", shopId)
        .eq("is_voided", false);

      if (invoicesError) throw invoicesError;

      // 2. Fetch Customers Count & Total Udhaar
      const { data: customersData, error: customersError } = await supabase
        .from("parties")
        .select("type, current_balance, created_at")
        .eq("shop_id", shopId)
        .eq("type", "customer");

      if (customersError) throw customersError;

      // 3. Fetch Recent Transactions
      const { data: recent, error: recentError } = await supabase
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
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentError) throw recentError;

      // 4. Fetch Low Stock Alerts
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, current_stock, min_stock_level, unit")
        .eq("shop_id", shopId);

      const lowStock: LowStockItem[] = (productsData || [])
        .filter((p: any) => Number(p.current_stock) <= Number(p.min_stock_level))
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          current_stock: Number(p.current_stock),
          min_stock_level: Number(p.min_stock_level),
          unit: p.unit
        }))
        .slice(0, 4);

      setLowStockAlerts(lowStock);

      // 5. Fetch Recent Invoice Items for Category breakdown
      const { data: recentItems } = await supabase
        .from("invoice_items")
        .select(`
          quantity, subtotal,
          products ( name, category_id, categories ( name ) )
        `)
        .limit(100);

      const catTotals: Record<string, number> = {};
      (recentItems || []).forEach((item: any) => {
        const catName = item.products?.categories?.name || item.products?.category?.name || "General Sales";
        catTotals[catName] = (catTotals[catName] || 0) + Number(item.subtotal || 0);
      });

      const catBreakdown = Object.entries(catTotals)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 4);
      
      setCategorySales(catBreakdown);

      // Calculations for Stats
      const totalRevenue = (invoices || []).reduce((sum: number, inv: any) => sum + Number(inv.total_amount), 0);
      const totalInvoicesCount = (invoices || []).length;

      const activeUdhaar = (customersData || [])
        .filter((c: any) => Number(c.current_balance) > 0)
        .reduce((sum: number, c: any) => sum + Number(c.current_balance), 0);
      const outstandingAccountsCount = (customersData || []).filter((c: any) => Number(c.current_balance) > 0).length;

      const totalCustomers = (customersData || []).length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dailyInvoices = (invoices || []).filter((inv: any) => new Date(inv.created_at) >= today).length;
      const newCustomersToday = (customersData || []).filter((c: any) => new Date(c.created_at) >= today).length;

      setStats({
        totalRevenue,
        activeUdhaar,
        totalCustomers,
        dailyInvoices,
        totalInvoicesCount,
        outstandingAccountsCount,
        newCustomersToday
      });

      // Calculate 7-day sales trend
      const trendData: ChartPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);

        const daySales = (invoices || [])
          .filter((inv: any) => {
            const date = new Date(inv.created_at);
            return date >= d && date <= dayEnd;
          })
          .reduce((sum: number, inv: any) => sum + Number(inv.total_amount), 0);

        trendData.push({
          label: d.toLocaleDateString([], { weekday: "short" }),
          amount: daySales
        });
      }
      setSalesTrend(trendData);

      // Format recent transactions
      const formattedRecent = (recent || []).map((inv: any) => {
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
          amount: Number(inv.total_amount),
          paymentMode: inv.payment_mode || "cash"
        };
      });
      setRecentTx(formattedRecent);

    } catch (err: any) {
      console.error("Dashboard statistics loading failed:", err.message);
    } finally {
      setLoading(false);
    }
  };

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
    <div className="space-y-6 animate-in fade-in duration-500 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Executive Command Center
          </h2>
          <p className="text-slate-500 mt-1">Real-time analytical monitoring, branch sales insights, and operational metrics.</p>
        </div>
        
        {/* Quick Sync Button */}
        <button 
          onClick={fetchDashboardData}
          disabled={loading}
          className="self-start md:self-auto flex items-center gap-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 font-bold text-xs px-3.5 py-2 rounded-xl transition-all border border-slate-200 cursor-pointer disabled:opacity-60"
        >
          <Activity size={14} className={loading ? "animate-spin text-blue-500" : "text-slate-500"} />
          Refresh Stats
        </button>
      </div>

      {loading ? (
        <div className="h-[60vh] flex flex-col justify-center items-center text-slate-400">
          <Loader2 className="h-10 w-10 animate-spin mb-3 text-indigo-600" />
          <p className="font-semibold text-sm">Aggregating live store analytical profiles...</p>
        </div>
      ) : (
        <>
          {/* Top Analytical Cards */}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            
            {/* Card 1: Revenue */}
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-5 rounded-3xl text-white shadow-lg shadow-blue-500/15 relative overflow-hidden transition-transform hover:-translate-y-0.5 duration-300">
              <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-15">
                <DollarSign size={100} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-100">Net Gross Revenue</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-black uppercase">Live</span>
              </div>
              <div className="text-3xl font-black mt-3">
                Rs {stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-blue-100/90 font-medium mt-3 flex items-center gap-1.5">
                <TrendingUp size={14} /> {stats.totalInvoicesCount} invoices recorded in ledger
              </p>
            </div>

            {/* Card 2: Active Udhaar */}
            <div className="bg-gradient-to-br from-rose-500 to-red-600 p-5 rounded-3xl text-white shadow-lg shadow-rose-500/15 relative overflow-hidden transition-transform hover:-translate-y-0.5 duration-300">
              <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-15">
                <CreditCard size={100} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-100">Outstanding Udhaar</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-black uppercase">Khata</span>
              </div>
              <div className="text-3xl font-black mt-3">
                Rs {stats.activeUdhaar.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-rose-100/90 font-medium mt-3 flex items-center gap-1.5">
                <AlertTriangle size={14} className="animate-pulse" /> {stats.outstandingAccountsCount} customer accounts pending settlement
              </p>
            </div>

            {/* Card 3: Total Customers */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-3xl text-white shadow-lg shadow-emerald-500/15 relative overflow-hidden transition-transform hover:-translate-y-0.5 duration-300">
              <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-15">
                <Users size={100} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Registered Parties</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-black uppercase">Profiles</span>
              </div>
              <div className="text-3xl font-black mt-3">
                {stats.totalCustomers}
              </div>
              <p className="text-xs text-emerald-100/90 font-medium mt-3 flex items-center gap-1.5">
                <PlusCircle size={14} /> +{stats.newCustomersToday} newly registered today
              </p>
            </div>

            {/* Card 4: Daily Invoices */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-5 rounded-3xl text-white shadow-lg shadow-amber-500/15 relative overflow-hidden transition-transform hover:-translate-y-0.5 duration-300">
              <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-15">
                <Activity size={100} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-100">Sales Transactions</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-black uppercase">Today</span>
              </div>
              <div className="text-3xl font-black mt-3">
                +{stats.dailyInvoices}
              </div>
              <p className="text-xs text-amber-100/90 font-medium mt-3 flex items-center gap-1.5">
                <TrendingUp size={14} /> Daily register invoice traffic active
              </p>
            </div>
          </div>

          {/* Quick Actions Hub */}
          <div className="bg-white p-4.5 rounded-3xl border border-slate-200/80 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Quick Terminal Operations</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link href="/dashboard/pos" className="flex items-center gap-3 p-3 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-2xl transition-colors">
                <span className="p-2 bg-blue-600 text-white rounded-xl"><ShoppingBag size={15} /></span>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800">POS Billing</p>
                  <p className="text-[10px] text-slate-400">Launch Register Terminal</p>
                </div>
              </Link>
              <Link href="/dashboard/products" className="flex items-center gap-3 p-3 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 rounded-2xl transition-colors">
                <span className="p-2 bg-indigo-600 text-white rounded-xl"><PlusCircle size={15} /></span>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800">Add Inventory</p>
                  <p className="text-[10px] text-slate-400">Manage Catalog Stocks</p>
                </div>
              </Link>
              <Link href="/dashboard/expenses" className="flex items-center gap-3 p-3 bg-amber-50/50 hover:bg-amber-50 border border-amber-100 rounded-2xl transition-colors">
                <span className="p-2 bg-amber-600 text-white rounded-xl"><ArrowRightLeft size={15} /></span>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800">Log Expense</p>
                  <p className="text-[10px] text-slate-400">Record Operations Outflow</p>
                </div>
              </Link>
              <Link href="/dashboard/reports" className="flex items-center gap-3 p-3 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 rounded-2xl transition-colors">
                <span className="p-2 bg-emerald-600 text-white rounded-xl"><FileText size={15} /></span>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800">Reports Center</p>
                  <p className="text-[10px] text-slate-400">Print & PDF Statements</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Main Visual Panels */}
          <div className="grid gap-6 lg:grid-cols-12">
            
            {/* Sales Trend SVG Area Chart */}
            <Card className="lg:col-span-8 shadow-sm border-slate-200 rounded-3xl bg-white overflow-hidden flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="text-blue-500" size={18} /> Sales Trend Analysis
                  </CardTitle>
                  <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2.5 py-0.5 rounded-full uppercase">Last 7 Days</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end pt-4 pb-2">
                <div className="w-full relative h-[180px]">
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
                      <path d={linePathD} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                      {/* Interactive Point Markers */}
                      {chartPoints.map((p, idx) => (
                        <g key={idx} className="group cursor-pointer">
                          <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                          {/* Value display on top of point */}
                          <text x={p.x} y={p.y - 8} textAnchor="middle" className="text-[8px] font-black fill-slate-700 bg-white opacity-0 group-hover:opacity-100 transition-opacity">
                            Rs {Math.round(p.amount).toLocaleString()}
                          </text>
                          {/* Bottom X Axis Labels */}
                          <text x={p.x} y={svgHeight - 3} textAnchor="middle" className="text-[9px] font-bold fill-slate-500">
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
            <Card className="lg:col-span-4 shadow-sm border-slate-200 rounded-3xl bg-white flex flex-col justify-between">
              <CardHeader className="pb-1">
                <CardTitle className="text-base font-bold text-slate-800">Category breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-3 flex-1 flex flex-col justify-center">
                {categorySales.length === 0 ? (
                  <p className="text-xs text-slate-400 font-semibold py-8 text-center">No categories sales yet.</p>
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
                      <div key={cat.name} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span className="truncate pr-2">{cat.name}</span>
                          <span>Rs {Math.round(cat.value).toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
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
          <div className="grid gap-6 lg:grid-cols-12">
            
            {/* Left Box: Recent Transactions */}
            <Card className="lg:col-span-7 shadow-sm border-slate-200 rounded-3xl bg-white">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-800">Recent Transactions</CardTitle>
                <Link href="/dashboard/sales" className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-0.5">
                  View Ledger <ArrowUpRight size={14} />
                </Link>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="divide-y divide-slate-100">
                  {recentTx.length === 0 ? (
                    <p className="text-xs text-slate-400 font-semibold py-8 text-center">
                      No invoices recorded yet in the database.
                    </p>
                  ) : (
                    recentTx.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-3 hover:bg-slate-50/50 rounded-xl px-1.5 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                            <span className="text-[10px] font-black text-slate-600 uppercase">INV</span>
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-800 capitalize truncate max-w-[120px] sm:max-w-[200px]">
                              {tx.customerName}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                              {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(tx.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            tx.paymentMode === "credit" 
                              ? "bg-rose-50 text-rose-700 border border-rose-100" 
                              : tx.paymentMode === "card" 
                                ? "bg-amber-50 text-amber-700 border border-amber-100" 
                                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}>
                            {tx.paymentMode === "credit" ? "Udhaar" : tx.paymentMode}
                          </span>
                          <span className="text-sm font-black text-slate-800 text-right min-w-[70px]">
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
            <Card className="lg:col-span-5 shadow-sm border-slate-200 rounded-3xl bg-white flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={18} /> Critical stock alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between gap-4">
                
                {/* Warnings List */}
                <div className="space-y-2.5">
                  {lowStockAlerts.length === 0 ? (
                    <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-100 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
                      All product stock quantities are healthy!
                    </div>
                  ) : (
                    lowStockAlerts.map(prod => (
                      <div key={prod.id} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-slate-800 truncate">{prod.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">Min level: {prod.min_stock_level} {prod.unit || "units"}</p>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          prod.current_stock <= 0
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {prod.current_stock} {prod.unit || "left"}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Database cloud status */}
                <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                      Supabase Cloud Sync
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Data syncing globally secure</p>
                  </div>
                  <Link href="/dashboard/backup" className="text-[10px] text-blue-400 hover:text-blue-300 font-black uppercase">
                    Backups
                  </Link>
                </div>

              </CardContent>
            </Card>

          </div>
        </>
      )}

    </div>
  );
}
