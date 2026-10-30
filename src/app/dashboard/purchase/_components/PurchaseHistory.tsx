"use client";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Eye, Trash2, Package, Loader2, Search, Filter, RefreshCcw, TrendingDown, AlertTriangle, FileText, Edit } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BadgeCheck } from "lucide-react";
import { StatusChip, PaymentModeChip } from "./StatusChips";
import type { PurchaseOrder, Supplier } from "./types";

type Props = {
  orders: PurchaseOrder[];
  suppliers: Supplier[];
  loading: boolean;
  voidingId: string | null;
  onView: (poId: string) => void;
  onVoid: (poId: string) => void;
  onEdit?: (poId: string) => void;
};

export function PurchaseHistory({ orders, suppliers, loading, voidingId, onView, onVoid, onEdit }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentModeFilter, setPaymentModeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== "all") list = list.filter(p => p.status === statusFilter);
    if (paymentModeFilter !== "all") list = list.filter(p => p.payment_mode === paymentModeFilter);
    if (supplierFilter !== "all") list = list.filter(p => p.supplier_id === supplierFilter);
    if (dateFilter === "today") {
      const t = new Date().toDateString();
      list = list.filter(p => new Date(p.created_at).toDateString() === t);
    } else if (dateFilter === "week") {
      const w = new Date(); w.setDate(w.getDate() - 7);
      list = list.filter(p => new Date(p.created_at) >= w);
    } else if (dateFilter === "month") {
      const m = new Date(); m.setMonth(m.getMonth() - 1);
      list = list.filter(p => new Date(p.created_at) >= m);
    } else if (dateFilter === "custom" && startDate && endDate) {
      const s = new Date(startDate); s.setHours(0, 0, 0, 0);
      const e = new Date(endDate); e.setHours(23, 59, 59, 999);
      list = list.filter(p => { const d = new Date(p.created_at); return d >= s && d <= e; });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.supplierName?.toLowerCase().includes(q) ||
        p.invoice_number?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, statusFilter, paymentModeFilter, supplierFilter, dateFilter, startDate, endDate, search]);

  const stats = useMemo(() => {
    const active = filtered.filter(p => !p.is_voided);
    return {
      total: active.reduce((a, p) => a + p.total_amount, 0),
      paid: active.reduce((a, p) => a + p.paid_amount, 0),
      outstanding: active.reduce((a, p) => a + (p.total_amount - p.paid_amount), 0),
      count: active.length,
    };
  }, [filtered]);

  const resetFilters = () => {
    setSearch(""); setStatusFilter("all"); setPaymentModeFilter("all");
    setDateFilter("all"); setSupplierFilter("all"); setStartDate(""); setEndDate("");
  };

  return (
    <div className="space-y-5">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Purchases", val: `Rs ${Math.round(stats.total).toLocaleString()}`, icon: TrendingDown, bg: "bg-violet-50 text-violet-700" },
          { label: "Total Paid", val: `Rs ${Math.round(stats.paid).toLocaleString()}`, icon: BadgeCheck, bg: "bg-emerald-50 text-emerald-700" },
          { label: "Outstanding", val: `Rs ${Math.round(stats.outstanding).toLocaleString()}`, icon: AlertTriangle, bg: "bg-rose-50 text-rose-700" },
          { label: "Total Entries", val: stats.count, icon: FileText, bg: "bg-blue-50 text-blue-700" },
        ].map((s, i) => (
          <motion.div key={i} whileHover={{ y: -2 }} className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
              <h3 className="text-xl font-black mt-1">{s.val}</h3>
            </div>
            <div className={`p-3 rounded-2xl ${s.bg}`}><s.icon className="h-5 w-5" /></div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
          <Filter size={15} className="text-slate-400" />
          <h4 className="font-black text-slate-700 text-xs uppercase tracking-wider">Filter Purchases</h4>
          <button onClick={resetFilters} className="ml-auto text-[10px] font-bold text-slate-400 hover:text-violet-600 flex items-center gap-1">
            <RefreshCcw size={10} /> Reset
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="col-span-2">
            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input placeholder="Supplier / Inv #..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 focus-visible:ring-violet-500/20 rounded-xl" />
            </div>
          </div>
          {([
            { label: "Status", state: statusFilter, setter: setStatusFilter, options: [["all","All Status"],["PAID","Paid"],["PARTIAL","Partial"],["CREDIT","Credit"],["VOIDED","Voided"]] },
            { label: "Mode", state: paymentModeFilter, setter: setPaymentModeFilter, options: [["all","All Modes"],["cash","Cash"],["bank","Bank"],["credit","Credit"]] },
            { label: "Date", state: dateFilter, setter: setDateFilter, options: [["all","All Time"],["today","Today"],["week","This Week"],["month","This Month"],["custom","Custom"]] },
            { label: "Supplier", state: supplierFilter, setter: setSupplierFilter, options: [["all","All Suppliers"],...suppliers.map(s=>[s.id,s.name])] },
          ] as { label: string; state: string; setter: (v: string) => void; options: [string, string][] }[]).map(f => (
            <div key={f.label}>
              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">{f.label}</label>
              <select value={f.state} onChange={e => f.setter(e.target.value)}
                className="w-full h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-semibold">
                {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
        </div>
        {dateFilter === "custom" && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">From</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl" />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">To</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl" />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500 mb-2" />
            <span className="text-xs text-slate-400 font-semibold">Loading...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-xs font-medium">No purchases found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-black uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3.5 px-5">Date</th>
                  <th className="py-3.5 px-5">PO # / Inv #</th>
                  <th className="py-3.5 px-5">Supplier</th>
                  <th className="py-3.5 px-5">Items</th>
                  <th className="py-3.5 px-5 text-right">Total</th>
                  <th className="py-3.5 px-5 text-right">Paid</th>
                  <th className="py-3.5 px-5 text-right">Outstanding</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Mode</th>
                  <th className="py-3.5 px-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filtered.map(po => (
                  <tr key={po.id} className={`hover:bg-slate-50/50 transition-all font-medium ${po.is_voided ? "opacity-50" : ""}`}>
                    <td className="py-3.5 px-5 font-mono text-slate-400 text-[11px]">
                      {new Date(po.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      <span className="block text-[10px]">{new Date(po.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="py-3.5 px-5">
                      <button 
                        onClick={() => onView(po.id)}
                        className="font-black text-violet-700 hover:text-violet-900 hover:underline font-mono text-[11px] text-left"
                      >
                        #{po.id.slice(0, 8).toUpperCase()}
                      </button>
                      {po.invoice_number && <span className="block text-[10px] text-slate-400 font-medium">Inv: {po.invoice_number}</span>}
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-slate-700">{po.supplierName}</td>
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">
                        <Package size={10} /> {po.itemCount}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-black text-slate-800">Rs {Math.round(po.total_amount).toLocaleString()}</td>
                    <td className="py-3.5 px-5 text-right font-bold text-emerald-600">Rs {Math.round(po.paid_amount).toLocaleString()}</td>
                    <td className="py-3.5 px-5 text-right font-bold text-rose-500">
                      {po.total_amount - po.paid_amount > 0
                        ? `Rs ${Math.round(po.total_amount - po.paid_amount).toLocaleString()}`
                        : <span className="text-emerald-500">—</span>}
                    </td>
                    <td className="py-3.5 px-5"><StatusChip status={po.status} isVoided={po.is_voided} /></td>
                    <td className="py-3.5 px-5"><PaymentModeChip mode={po.payment_mode} /></td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => onView(po.id)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-violet-100 hover:text-violet-700 text-slate-500 transition-all cursor-pointer" title="View Details">
                          <Eye size={13} />
                        </button>
                        {onEdit && !po.is_voided && (
                          <button 
                            onClick={() => onEdit(po.id)} 
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 hover:text-amber-700 text-slate-500 transition-all cursor-pointer"
                            title="Edit Purchase Bill (پرچیز بل تبدیل کریں)"
                          >
                            <Edit size={13} />
                          </button>
                        )}
                        {!po.is_voided && (
                          <button onClick={() => onVoid(po.id)} disabled={!!voidingId}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-400 transition-all cursor-pointer" title="Void Purchase">
                            {voidingId === po.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
