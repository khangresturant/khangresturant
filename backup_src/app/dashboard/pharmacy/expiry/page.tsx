"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Pill, AlertTriangle, CheckCircle, Search, Calendar, 
  Trash2, FileText, Loader2, RefreshCw, Archive 
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StockBatch = {
  id: string;
  batch_number: string | null;
  expiry_date: string | null;
  quantity_pack: number;
  quantity_single: number;
  products?: any;
};

export default function ExpiryTrackerPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (shopId) {
      fetchStockBatches();
    }
  }, [shopId]);

  const fetchStockBatches = async () => {
    setLoading(true);
    try {
      // Fetch stock entries that have expiry dates
      const { data, error } = await supabase
        .from("stock")
        .select(`
          id, batch_number, expiry_date, quantity_pack, quantity_single,
          products ( name )
        `)
        .eq("shop_id", shopId)
        .not("expiry_date", "is", null)
        .order("expiry_date", { ascending: true });

      if (error) throw error;
      setBatches(data || []);
    } catch (err: any) {
      toast.error("Failed to load expiry logs: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDispose = async (id: string) => {
    if (!confirm("Are you sure you want to dispose of this expired batch stock? This will delete the stock log.")) return;
    try {
      const { error } = await supabase
        .from("stock")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Expired medicine stock successfully disposed and removed from logs.");
      fetchStockBatches();
    } catch (err: any) {
      toast.error("Failed to dispose batch: " + err.message);
    }
  };

  const getExpiryStatus = (expiryDateStr: string | null) => {
    if (!expiryDateStr) return { text: "No Expiry", color: "text-slate-500 bg-slate-100 border-slate-200", days: 999 };
    
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: "Expired", color: "bg-red-50 border-red-200 text-red-700 shadow-sm shadow-red-50", days: diffDays };
    } else if (diffDays <= 90) {
      return { text: `Near Expiry (${diffDays}d)`, color: "bg-amber-50 border-amber-200 text-amber-700", days: diffDays };
    } else {
      return { text: "Safe", color: "bg-emerald-50 border-emerald-200 text-emerald-700", days: diffDays };
    }
  };

  const getProductName = (products: any) => {
    if (!products) return "Unknown";
    if (Array.isArray(products)) {
      return products[0]?.name || "Unknown";
    }
    return products.name || "Unknown";
  };

  const filtered = batches.filter(b => {
    const pName = getProductName(b.products);
    return pName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (b.batch_number && b.batch_number.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // Statistics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiredCount = batches.filter(b => b.expiry_date && new Date(b.expiry_date) < today).length;
  const nearExpiryCount = batches.filter(b => {
    if (!b.expiry_date) return false;
    const exp = new Date(b.expiry_date);
    const diff = exp.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 90;
  }).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Medicine Expiry Tracker</h2>
          <p className="text-slate-500 mt-1">Monitor pharmaceutical batch expiries, print warning reports, and discard expired inventory.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search medicine or batch..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={fetchStockBatches} variant="outline" className="border-slate-200">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expiry Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center border border-red-100">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Expired Batches</p>
            <p className="text-xl font-bold text-red-600 mt-0.5">{expiredCount} Batches</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100">
            <Calendar size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Near Expiry (90 Days)</p>
            <p className="text-xl font-bold text-amber-600 mt-0.5">{nearExpiryCount} Batches</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
            <CheckCircle size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Safe Batches</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{batches.length - expiredCount - nearExpiryCount} Batches</p>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-6 py-4">Medicine Name</th>
                <th className="px-6 py-4">Batch Number</th>
                <th className="px-6 py-4">Expiry Date</th>
                <th className="px-6 py-4 text-center">Remaining Stock</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400 font-sans">Loading batch data...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400 font-sans">
                    No batch logs with expiry dates found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const status = getExpiryStatus(item.expiry_date);
                  const isExpired = status.text === "Expired";

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isExpired ? 'bg-red-50/10' : ''}`}>
                      <td className="px-6 py-4 font-sans font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Pill size={16} className="text-slate-400" /> {getProductName(item.products)}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-semibold">{item.batch_number || "—"}</td>
                      <td className="px-6 py-4 font-semibold text-slate-600">
                        {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric'
                        }) : "—"}
                      </td>
                      <td className="px-6 py-4 text-center font-sans">
                        <span className="font-bold text-slate-700">
                          {item.quantity_pack} packs / {item.quantity_single} units
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-sans">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${status.color}`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-sans">
                        {isExpired ? (
                          <Button 
                            onClick={() => handleDispose(item.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs h-8 border border-red-200"
                          >
                            <Archive size={12} className="mr-1" /> Dispose
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No action</span>
                        )}
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
  );
}
