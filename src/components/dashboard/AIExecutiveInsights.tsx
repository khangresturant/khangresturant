"use client";

import React, { useState, useEffect } from "react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, AlertTriangle, TrendingUp, DollarSign, MessageSquare,
  ChevronUp, ChevronDown, ShoppingCart, Scale, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function AIExecutiveInsights() {
  const { shopId, shopName } = useShop();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalReceivables, setTotalReceivables] = useState(0);
  const [topCustomer, setTopCustomer] = useState<{ name: string; phone: string; balance: number } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("ai_copilot_collapsed");
    if (saved === "true") setIsCollapsed(true);
  }, []);

  useEffect(() => {
    if (!shopId) return;
    fetchInsightsData();
  }, [shopId]);

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("ai_copilot_collapsed", String(next));
      return next;
    });
  };

  const fetchInsightsData = async () => {
    setLoading(true);
    try {
      // 1. Low stock count
      const [prodsRes, vehiclesRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, current_stock, min_stock_level")
          .eq("shop_id", shopId),
        supabase
          .from("showroom_vehicles")
          .select("id, status")
          .eq("shop_id", shopId)
          .eq("status", "available")
      ]);

      const prods = prodsRes.data || [];
      const lowCount = prods.filter((p: any) => (p.current_stock || 0) <= (p.min_stock_level || 5)).length;
      setLowStockCount(lowCount);

      // 2. Customer Receivables & Top Khata Balance
      const [partiesRes, showroomPartiesRes, installmentsRes] = await Promise.all([
        supabase
          .from("parties")
          .select("name, phone, current_balance")
          .eq("shop_id", shopId)
          .eq("type", "customer")
          .gt("current_balance", 0),
        supabase
          .from("showroom_parties")
          .select("name, phone, current_balance")
          .eq("shop_id", shopId)
          .gt("current_balance", 0),
        supabase
          .from("showroom_installments")
          .select("customer_name, customer_phone, remaining_balance, total_price, total_paid")
          .eq("shop_id", shopId)
          .in("status", ["active", "overdue"])
      ]);

      const candidateDebtors: Array<{ name: string; phone: string; balance: number }> = [];

      (partiesRes.data || []).forEach((p: any) => {
        candidateDebtors.push({
          name: p.name,
          phone: p.phone || "",
          balance: Number(p.current_balance || 0)
        });
      });

      (showroomPartiesRes.data || []).forEach((sp: any) => {
        candidateDebtors.push({
          name: `${sp.name} (Showroom)`,
          phone: sp.phone || "",
          balance: Number(sp.current_balance || 0)
        });
      });

      (installmentsRes.data || []).forEach((inst: any) => {
        const rem = inst.remaining_balance !== null && inst.remaining_balance !== undefined
          ? Number(inst.remaining_balance)
          : Math.max(0, Number(inst.total_price || 0) - Number(inst.total_paid || 0));
        if (rem > 0) {
          candidateDebtors.push({
            name: `${inst.customer_name} (اقساط)`,
            phone: inst.customer_phone || "",
            balance: rem
          });
        }
      });

      candidateDebtors.sort((a, b) => b.balance - a.balance);

      const total = candidateDebtors.reduce((sum, d) => sum + d.balance, 0);
      setTotalReceivables(total);
      if (candidateDebtors.length > 0) {
        setTopCustomer(candidateDebtors[0]);
      } else {
        setTopCustomer(null);
      }
    } catch (err) {
      console.error("AI Insights fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendKhataWhatsApp = () => {
    if (!topCustomer) return;
    const phone = topCustomer.phone.replace(/[^0-9]/g, "");
    const msg = `السلام علیکم!
محترم *${topCustomer.name}* صاحب،
آپ کے ذمہ ڈیو واؤچر پر بقایا رقم: *Rs ${topCustomer.balance.toLocaleString()}* واجب الادا ہے۔
برائے مہربانی اپنا کھاتہ کلیئر کروا دیں۔ شکریہ!
منجانب: *${shopName || "ہمارا کاروبار"}*`;

    const encoded = encodeURIComponent(msg);
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, "_blank");
  };

  if (loading) return null;

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl text-white shadow-md border border-indigo-900/60 overflow-hidden transition-all">
      {/* Widget Header Strip */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/40 border-b border-indigo-900/40">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Sparkles size={13} className="text-amber-400 animate-pulse" />
          </div>
          <span className="text-xs font-black tracking-wider text-slate-100 uppercase">
            AI Executive Copilot
          </span>
          <span className="hidden sm:inline-flex items-center text-[10px] font-bold text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded-full border border-indigo-800/40">
            Realtime Advisory
          </span>
        </div>

        {/* Collapsed summary pill + toggle */}
        <div className="flex items-center gap-2">
          {isCollapsed && (
            <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-300 font-semibold pr-2">
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle size={11} /> {lowStockCount} Low Stock
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <DollarSign size={11} /> Rs {totalReceivables.toLocaleString()} Receivables
              </span>
            </div>
          )}

          <button
            onClick={toggleCollapsed}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 px-2 py-1 rounded-lg border border-white/10 transition cursor-pointer"
            title={isCollapsed ? "Expand Copilot Insights" : "Collapse Copilot Insights"}
          >
            {isCollapsed ? (
              <>
                <span>Expand</span>
                <ChevronDown size={12} />
              </>
            ) : (
              <>
                <span>Compact</span>
                <ChevronUp size={12} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded 3-Card High-Density Grid */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* Card 1: Low Stock Warning */}
              <div className="bg-white/5 border border-white/10 hover:border-indigo-500/50 p-2.5 rounded-xl flex flex-col justify-between transition gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 rounded-md bg-amber-500/20 text-amber-400">
                      <AlertTriangle size={13} />
                    </span>
                    <span className="text-[11px] font-black text-slate-200 truncate">
                      {lowStockCount > 0 ? `${lowStockCount} Low Stock Items` : "Stock Healthy"}
                    </span>
                  </div>
                  <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800/50">
                    Reorder
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 line-clamp-2 leading-tight">
                  {lowStockCount > 0
                    ? "Items hit safety threshold. Launch Auto-PO to prevent stockout."
                    : "Catalog inventory levels are well within safety bounds."}
                </p>

                <Link
                  href="/dashboard/purchase"
                  className="inline-flex w-full items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg h-7 px-2.5 transition active:scale-98"
                >
                  <ShoppingCart size={12} /> Launch AI Auto-PO
                </Link>
              </div>

              {/* Card 2: Khata Recovery Advisory */}
              <div className="bg-white/5 border border-white/10 hover:border-emerald-500/50 p-2.5 rounded-xl flex flex-col justify-between transition gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400">
                      <DollarSign size={13} />
                    </span>
                    <span className="text-[11px] font-black text-slate-200 truncate">
                      Rs {totalReceivables.toLocaleString()} Udhaar
                    </span>
                  </div>
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/50">
                    Khata
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 truncate leading-tight">
                  {topCustomer
                    ? `Top dues: ${topCustomer.name} (Rs ${topCustomer.balance.toLocaleString()})`
                    : "No pending customer receivables recorded."}
                </p>

                {topCustomer ? (
                  <Button
                    onClick={handleSendKhataWhatsApp}
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg h-7 px-2.5 cursor-pointer"
                  >
                    <MessageSquare size={12} className="mr-1" /> WhatsApp Reminder
                  </Button>
                ) : (
                  <Link
                    href="/dashboard/khata"
                    className="inline-flex w-full items-center justify-center bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] rounded-lg h-7 px-2.5"
                  >
                    View Customer Khata
                  </Link>
                )}
              </div>

              {/* Card 3: Demand & Margin Insight */}
              <div className="bg-white/5 border border-white/10 hover:border-purple-500/50 p-2.5 rounded-xl flex flex-col justify-between transition gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 rounded-md bg-purple-500/20 text-purple-400">
                      <TrendingUp size={13} />
                    </span>
                    <span className="text-[11px] font-black text-slate-200 truncate">
                      Demand Optimization
                    </span>
                  </div>
                  <span className="text-[9px] font-black text-purple-400 uppercase tracking-wider bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/50">
                    Forecast
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 line-clamp-2 leading-tight">
                  Maintain 20% safety margin on fast movers to maximize sales velocity.
                </p>

                <Link
                  href="/dashboard/reports/gl"
                  className="inline-flex w-full items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] rounded-lg h-7 px-2.5 transition active:scale-98"
                >
                  <Scale size={12} /> Audit P&L & Balance
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
