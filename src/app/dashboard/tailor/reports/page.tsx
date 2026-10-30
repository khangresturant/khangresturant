"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  BarChart3, Calendar, Scissors, Shirt, Users, Banknote, 
  TrendingUp, TrendingDown, Clock, CheckCircle2, AlertCircle, 
  Printer, Filter, RefreshCw, FileText, ChevronRight, Layers, DollarSign
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StitchingOrder = {
  id: string;
  customer_id: string;
  karigar_id: string | null;
  delivery_date: string;
  status: "pending" | "cutting" | "stitching" | "completed" | "delivered";
  total_amount: number;
  karigar_wage: number;
  created_at: string;
  garment_type: string | null;
  fabric: string | null;
  design_style: string | null;
  advance_payment: number;
  payment_status: string;
  suit_expense?: number;
  suit_code?: string | null;
  customers?: any;
  karigars?: any;
};

type Karigar = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
};

export default function TailorReportsPage() {
  const { shopId, shopName } = useShop();
  const supabase = createClient();

  const [orders, setOrders] = useState<StitchingOrder[]>([]);
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"financials" | "karigar" | "status" | "profit">("financials");

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "year" | "custom">("month");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Handle Preset Date Filter
  const applyDatePreset = (preset: "today" | "week" | "month" | "year") => {
    setDateFilter(preset);
    const now = new Date();
    let start = new Date();

    if (preset === "today") {
      start = new Date();
    } else if (preset === "week") {
      start.setDate(now.getDate() - 7);
    } else if (preset === "month") {
      start.setDate(1);
    } else if (preset === "year") {
      start.setMonth(0, 1);
    }

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  };

  const fetchReportData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      // 1. Fetch Stitching Orders
      const { data: orderData, error: orderErr } = await supabase
        .from("stitching_orders")
        .select(`
          id, customer_id, karigar_id, delivery_date, status, total_amount, karigar_wage, created_at,
          garment_type, fabric, design_style, advance_payment, payment_status, suit_expense, suit_code,
          customers:parties!stitching_orders_customer_id_fkey ( name, phone ),
          karigars ( name )
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (orderErr) throw orderErr;

      // 2. Fetch Karigars
      const { data: karigarData, error: karigarErr } = await supabase
        .from("karigars")
        .select("id, name, phone, balance")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (karigarErr) throw karigarErr;

      setOrders((orderData as any) || []);
      setKarigars((karigarData as any) || []);
    } catch (err: any) {
      toast.error("Failed to load report data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [shopId]);

  // Filter orders by selected date range
  const filteredOrders = useMemo(() => {
    if (!startDate || !endDate) return orders;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return orders.filter(o => {
      const created = new Date(o.created_at);
      return created >= start && created <= end;
    });
  }, [orders, startDate, endDate]);

  // Metrics Calculations
  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const totalAdvance = filteredOrders.reduce((sum, o) => sum + (Number(o.advance_payment) || 0), 0);
    const totalDue = Math.max(0, totalRevenue - totalAdvance);
    const totalKarigarWages = filteredOrders.reduce((sum, o) => sum + (Number(o.karigar_wage) || 0), 0);
    const totalSuitExpenses = filteredOrders.reduce((sum, o) => sum + (Number(o.suit_expense) || 0), 0);
    const netProfit = totalRevenue - totalKarigarWages - totalSuitExpenses;

    const statusCounts = {
      pending: filteredOrders.filter(o => o.status === "pending").length,
      cutting: filteredOrders.filter(o => o.status === "cutting").length,
      stitching: filteredOrders.filter(o => o.status === "stitching").length,
      completed: filteredOrders.filter(o => o.status === "completed").length,
      delivered: filteredOrders.filter(o => o.status === "delivered").length,
    };

    // Garment type breakdown
    const garmentMap: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const g = o.garment_type || "Shalwar Kameez";
      garmentMap[g] = (garmentMap[g] || 0) + 1;
    });

    return {
      totalOrders,
      totalRevenue,
      totalAdvance,
      totalDue,
      totalKarigarWages,
      totalSuitExpenses,
      netProfit,
      statusCounts,
      garmentMap
    };
  }, [filteredOrders]);

  // Karigar Performance Summary
  const karigarPerformance = useMemo(() => {
    return karigars.map(k => {
      const kOrders = filteredOrders.filter(o => o.karigar_id === k.id);
      const totalWages = kOrders.reduce((sum, o) => sum + (Number(o.karigar_wage) || 0), 0);
      const completedSuits = kOrders.filter(o => o.status === "completed" || o.status === "delivered").length;

      return {
        ...k,
        assignedSuits: kOrders.length,
        completedSuits,
        totalWages
      };
    });
  }, [karigars, filteredOrders]);

  // Printable Report Generation
  const handlePrintReport = () => {
    const sName = shopName || "The Accounts Tailors";
    const reportTitle = `TAILORING & STITCHING ANALYTICS REPORT (${startDate} to ${endDate})`;
    
    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${reportTitle}</title>
          <style>
            @media print { body { margin: 0; padding: 10mm; } }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4mm; margin-bottom: 6mm; }
            .shop-name { font-size: 22px; font-weight: 900; text-transform: uppercase; margin: 0; }
            .title { font-size: 13px; font-weight: 700; color: #475569; margin-top: 1mm; }
            
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; margin-bottom: 6mm; }
            .kpi-card { border: 1.5px solid #cbd5e1; padding: 3mm; border-radius: 8px; text-align: center; background: #f8fafc; }
            .kpi-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; }
            .kpi-val { font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 1mm; }

            table { width: 100%; border-collapse: collapse; margin-top: 4mm; }
            th, td { border: 1px solid #cbd5e1; padding: 2mm 2.5mm; text-align: left; }
            th { background: #f1f5f9; font-size: 10px; font-weight: 800; text-transform: uppercase; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: 700; }
            .font-black { font-weight: 900; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="shop-name">${sName}</h1>
            <p class="title">${reportTitle}</p>
            <p style="font-size: 10px; color: #64748b; margin-top: 1mm;">Generated on: ${new Date().toLocaleString()}</p>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-title">Booked Orders</div>
              <div class="kpi-val">${stats.totalOrders}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Total Revenue</div>
              <div class="kpi-val">Rs ${stats.totalRevenue.toLocaleString()}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Advance Received</div>
              <div class="kpi-val" style="color:#16a34a;">Rs ${stats.totalAdvance.toLocaleString()}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Pending Balance Due</div>
              <div class="kpi-val" style="color:#e11d48;">Rs ${stats.totalDue.toLocaleString()}</div>
            </div>
          </div>

          <h3 style="margin-top: 6mm; font-size: 14px; text-transform: uppercase;">Stitching Orders Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Suit Code</th>
                <th>Customer</th>
                <th>Garment / Fabric</th>
                <th>Karigar</th>
                <th>Delivery Date</th>
                <th>Status</th>
                <th class="text-right">Total (Rs)</th>
                <th class="text-right">Advance (Rs)</th>
              </tr>
            </thead>
            <tbody>
              ${filteredOrders.map(o => `
                <tr>
                  <td class="font-bold">#${o.id.slice(0, 8).toUpperCase()}</td>
                  <td>${o.suit_code || "-"}</td>
                  <td>${o.customers?.name || "Walk-in"}</td>
                  <td>${o.garment_type || "Suit"} (${o.fabric || "Std"})</td>
                  <td>${o.karigars?.name || "Unassigned"}</td>
                  <td class="text-center">${new Date(o.delivery_date).toLocaleDateString()}</td>
                  <td class="text-center font-bold">${o.status.toUpperCase()}</td>
                  <td class="text-right font-black">Rs ${o.total_amount}</td>
                  <td class="text-right">Rs ${o.advance_payment || 0}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <h3 style="margin-top: 8mm; font-size: 14px; text-transform: uppercase;">Karigar Performance Summary</h3>
          <table>
            <thead>
              <tr>
                <th>Karigar Name</th>
                <th>Assigned Suits</th>
                <th>Completed Suits</th>
                <th class="text-right">Total Wages Earned</th>
                <th class="text-right">Current Payable Balance</th>
              </tr>
            </thead>
            <tbody>
              ${karigarPerformance.map(k => `
                <tr>
                  <td class="font-bold">${k.name}</td>
                  <td class="text-center">${k.assignedSuits}</td>
                  <td class="text-center font-bold" style="color:#16a34a;">${k.completedSuits}</td>
                  <td class="text-right font-black">Rs ${k.totalWages.toLocaleString()}</td>
                  <td class="text-right font-bold" style="color:#d97706;">Rs ${(k.balance || 0).toLocaleString()}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const getCustomerName = (c: any) => c?.name || "Walk-in Customer";

  return (
    <div className="p-4 md:p-3.5 sm:p-4 md:p-5 space-y-4 max-w-[1600px] mx-auto max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <BarChart3 className="text-teal-600 animate-pulse" />
            Advanced Tailor Reports & Analytics (ایڈوانس سلائی رپورٹس)
          </h2>
          
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={fetchReportData} variant="outline" size="sm" className="h-9 border-slate-200">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button onClick={handlePrintReport} className="h-9 bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer">
            <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Report (رپورٹ پرنٹ کریں)
          </Button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-teal-400" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-300">Filter Date Period:</span>
          <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700 gap-1">
            {(["today", "week", "month", "year"] as const).map(p => (
              <button
                key={p}
                onClick={() => applyDatePreset(p)}
                className={`px-3 py-1 text-xs font-bold rounded-xl capitalize transition-all cursor-pointer ${
                  dateFilter === p ? "bg-teal-500 text-white shadow-md" : "text-slate-400 hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-2xl border border-slate-700">
            <span className="text-[10px] text-slate-400 font-bold uppercase">From:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => { setStartDate(e.target.value); setDateFilter("custom"); }}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            />
          </div>
          <span className="text-slate-500 font-mono">→</span>
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-2xl border border-slate-700">
            <span className="text-[10px] text-slate-400 font-bold uppercase">To:</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => { setEndDate(e.target.value); setDateFilter("custom"); }}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Booked Orders */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-teal-500 to-teal-700 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden"
        >
          <div className="absolute right-3 top-3 opacity-20"><Shirt size={60} /></div>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block">Booked Orders (کل آرڈرز)</span>
          <h3 className="text-3xl font-black mt-2">{stats.totalOrders} <span className="text-sm font-normal">suits</span></h3>
          
        </motion.div>

        {/* Card 2: Total Revenue */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden"
        >
          <div className="absolute right-3 top-3 opacity-20"><Banknote size={60} /></div>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block">Stitching Revenue (کل سلائی آمدن)</span>
          <h3 className="text-3xl font-black mt-2">Rs {stats.totalRevenue.toLocaleString()}</h3>
          <div className="flex items-center gap-2 text-xs mt-2 text-indigo-200">
            <span>Advance: Rs {stats.totalAdvance.toLocaleString()}</span>
          </div>
        </motion.div>

        {/* Card 3: Pending Balance Due */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-rose-500 to-rose-700 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden"
        >
          <div className="absolute right-3 top-3 opacity-20"><AlertCircle size={60} /></div>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block">Pending Due Balance (بقایا واجی الادا)</span>
          <h3 className="text-3xl font-black mt-2">Rs {stats.totalDue.toLocaleString()}</h3>
          
        </motion.div>

        {/* Card 4: Net Tailoring Profit */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden"
        >
          <div className="absolute right-3 top-3 opacity-20"><TrendingUp size={60} /></div>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block">Net Tailoring Profit (خالص منافع)</span>
          <h3 className="text-3xl font-black mt-2">Rs {stats.netProfit.toLocaleString()}</h3>
          
        </motion.div>
      </div>

      {/* Multi-Tab Navigation */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-2">
        <div className="flex border-b border-slate-150 gap-2 p-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("financials")}
            className={`px-5 py-2.5 rounded-2xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "financials" ? "bg-teal-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Banknote size={15} /> Financials & Orders (سلائی آمدن)
          </button>

          <button
            onClick={() => setActiveTab("karigar")}
            className={`px-5 py-2.5 rounded-2xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "karigar" ? "bg-teal-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users size={15} /> Karigar Performance (کاریگر کارکردگی)
          </button>

          <button
            onClick={() => setActiveTab("status")}
            className={`px-5 py-2.5 rounded-2xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "status" ? "bg-teal-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Layers size={15} /> Order Phase Status (آرڈر کی صورتحال)
          </button>

          <button
            onClick={() => setActiveTab("profit")}
            className={`px-5 py-2.5 rounded-2xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "profit" ? "bg-teal-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <TrendingUp size={15} /> Profitability Analysis (منافع و اخراجات)
          </button>
        </div>

        {/* TAB 1: FINANCIALS & ORDERS BREAKDOWN */}
        {activeTab === "financials" && (
          <div className="p-6 space-y-4">
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <Shirt size={18} className="text-teal-600" />
              Stitching Orders Itemized Record ({filteredOrders.length} orders found)
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-450 font-black border-b border-slate-200 uppercase tracking-wider text-[9px]">
                  <tr>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Suit Code</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Garment / Fabric</th>
                    <th className="p-3">Delivery Date</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Total Bill</th>
                    <th className="p-3 text-right">Advance Paid</th>
                    <th className="p-3 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {loading ? (
                    <tr><td colSpan={9} className="p-6 text-center text-slate-400">Loading orders data...</td></tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr><td colSpan={9} className="p-6 text-center text-slate-400">No stitching orders found in selected date period.</td></tr>
                  ) : (
                    filteredOrders.map(o => {
                      const due = Math.max(0, Number(o.total_amount) - Number(o.advance_payment || 0));
                      return (
                        <tr key={o.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-mono font-black text-slate-900">#{o.id.slice(0, 8).toUpperCase()}</td>
                          <td className="p-3 font-mono text-indigo-600 font-bold">{o.suit_code || "-"}</td>
                          <td className="p-3 font-extrabold text-slate-800">{getCustomerName(o.customers)}</td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block">{o.garment_type || "Suit"}</span>
                            <span className="text-[10px] text-slate-400 block">{o.fabric || "Standard"}</span>
                          </td>
                          <td className="p-3 font-mono text-slate-600">{new Date(o.delivery_date).toLocaleDateString()}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                              o.status === "delivered" || o.status === "completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : o.status === "stitching" || o.status === "cutting"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="p-3 text-right font-black text-slate-900">Rs {o.total_amount}</td>
                          <td className="p-3 text-right text-emerald-600 font-bold">Rs {o.advance_payment || 0}</td>
                          <td className="p-3 text-right font-black text-rose-600">Rs {due}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: KARIGAR PERFORMANCE REPORT */}
        {activeTab === "karigar" && (
          <div className="p-3.5 sm:p-4 md:p-5 space-y-4 max-w-[1600px] mx-auto">
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <Users size={18} className="text-teal-600" />
              Artisan & Karigar Performance & Wage Summary
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {karigarPerformance.map(k => (
                <div key={k.id} className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
                  <div className="flex justify-between items-center border-b pb-3">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base">{k.name}</h4>
                      <p className="text-xs text-slate-400 font-mono">{k.phone || "No phone registered"}</p>
                    </div>
                    <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-black text-xs px-3 py-1 rounded-xl">
                      {k.assignedSuits} Suits Assigned
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 font-mono text-center pt-1">
                    <div className="bg-white p-2.5 rounded-2xl border border-slate-200">
                      <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Completed</span>
                      <span className="text-sm font-black text-emerald-600">{k.completedSuits}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-2xl border border-slate-200">
                      <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Wages Earned</span>
                      <span className="text-sm font-black text-slate-900">Rs {k.totalWages}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-2xl border border-slate-200">
                      <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Payable Balance</span>
                      <span className="text-sm font-black text-amber-600">Rs {k.balance || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: ORDER STAGE BREAKDOWN */}
        {activeTab === "status" && (
          <div className="p-3.5 sm:p-4 md:p-5 space-y-4 max-w-[1600px] mx-auto">
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <Layers size={18} className="text-teal-600" />
              Tailoring Workflow Phase Breakdown
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(["pending", "cutting", "stitching", "completed", "delivered"] as const).map(st => (
                <div key={st} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                  <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">{st}</span>
                  <h4 className="text-2xl font-black text-slate-900 mt-1">{stats.statusCounts[st]}</h4>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {stats.totalOrders > 0 ? Math.round((stats.statusCounts[st] / stats.totalOrders) * 100) : 0}% of total
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PROFITABILITY ANALYSIS */}
        {activeTab === "profit" && (
          <div className="p-3.5 sm:p-4 md:p-5 space-y-4 max-w-[1600px] mx-auto">
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <TrendingUp size={18} className="text-teal-600" />
              Tailoring Net Profitability Statement
            </h3>

            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4 max-w-xl">
              <div className="flex justify-between items-center text-sm font-semibold border-b pb-3">
                <span className="text-slate-600">Total Stitching Revenue Billed:</span>
                <span className="font-black text-slate-900 text-base">Rs {stats.totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-semibold text-rose-600 border-b pb-3">
                <span>Less: Total Karigar Stitching Wages:</span>
                <span className="font-black text-base">- Rs {stats.totalKarigarWages.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-semibold text-rose-600 border-b pb-3">
                <span>Less: Suit Material / Accessories Expense:</span>
                <span className="font-black text-base">- Rs {stats.totalSuitExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-base font-black text-emerald-700 bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                <span>NET TAILORING PROFIT (خالص منافع):</span>
                <span className="text-xl">Rs {stats.netProfit.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
