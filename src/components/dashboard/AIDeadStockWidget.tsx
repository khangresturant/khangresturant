"use client";

import React, { useState, useEffect } from "react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Flame, Snowflake, Sparkles, TrendingUp, AlertTriangle, ArrowRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AIDeadStockWidget() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [hotItems, setHotItems] = useState<any[]>([]);
  const [deadStockItems, setDeadStockItems] = useState<any[]>([]);

  useEffect(() => {
    if (!shopId) return;
    fetchStockAnalytics();
  }, [shopId]);

  const fetchStockAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch all products
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, sale_price_single, current_stock, min_stock_level, unit")
        .eq("shop_id", shopId)
        .gt("current_stock", 0);

      if (!prods) return;

      // Query sales items in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: sales } = await supabase
        .from("invoice_items")
        .select("product_id, quantity, created_at")
        .gte("created_at", thirtyDaysAgo.toISOString());

      const salesQtyMap: Record<string, number> = {};
      (sales || []).forEach((s: any) => {
        salesQtyMap[s.product_id] = (salesQtyMap[s.product_id] || 0) + Number(s.quantity || 0);
      });

      // Classify items
      const hotList: any[] = [];
      const deadList: any[] = [];

      prods.forEach((p: any) => {
        const soldQty = salesQtyMap[p.id] || 0;
        if (soldQty >= 10) {
          hotList.push({ ...p, soldQty });
        } else if (soldQty === 0 && (p.current_stock || 0) > 5) {
          deadList.push({ ...p, soldQty: 0 });
        }
      });

      hotList.sort((a, b) => b.soldQty - a.soldQty);
      setHotItems(hotList.slice(0, 5));
      setDeadStockItems(deadList.slice(0, 5));
    } catch (err) {
      console.error("Stock analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyClearanceDiscount = async (item: any) => {
    const discountedPrice = Math.round((item.sale_price_single || 0) * 0.85); // 15% Clearance discount
    try {
      const { error } = await supabase
        .from("products")
        .update({ sale_price_single: discountedPrice })
        .eq("id", item.id);

      if (error) throw error;

      toast.success(`15% Clearance Price applied to "${item.name}" (New Price: Rs ${discountedPrice})!`);
      fetchStockAnalytics();
    } catch (err: any) {
      toast.error("Failed to apply discount: " + err.message);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs uppercase tracking-widest">
            <Sparkles size={16} /> AI Predictive Inventory Velocity Classifier
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
            Hot-Selling Winners vs Dead Stock Analytics
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hot Selling Winners Panel */}
        <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/30 p-5 rounded-2xl border border-amber-200/80 space-y-4">
          <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm uppercase tracking-wider">
            <span className="p-2 bg-amber-500 text-white rounded-xl shadow-md">
              <Flame size={18} />
            </span>
            Top Hot-Selling Winners (30 Days)
          </div>

          <div className="space-y-2">
            {hotItems.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No sales activity recorded yet in last 30 days.</p>
            ) : (
              hotItems.map((item) => (
                <div key={item.id} className="bg-white p-3 rounded-xl border border-amber-100 flex items-center justify-between shadow-xs">
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 block">{item.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">Stock Left: {item.current_stock} {item.unit || "Pcs"}</span>
                  </div>
                  <span className="font-black text-xs text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">
                    🔥 {item.soldQty} Sold
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dead Stock Classifier Panel */}
        <div className="bg-gradient-to-br from-cyan-50/50 to-sky-50/30 p-5 rounded-2xl border border-sky-200/80 space-y-4">
          <div className="flex items-center gap-2 text-sky-900 font-extrabold text-sm uppercase tracking-wider">
            <span className="p-2 bg-sky-500 text-white rounded-xl shadow-md">
              <Snowflake size={18} />
            </span>
            Unsold Dead Stock (30+ Days Unmoved)
          </div>

          <div className="space-y-2">
            {deadStockItems.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Zero dead stock! All inventory is moving cleanly.</p>
            ) : (
              deadStockItems.map((item) => (
                <div key={item.id} className="bg-white p-3 rounded-xl border border-sky-100 flex items-center justify-between shadow-xs">
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 block">{item.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Unmoved Stock: {item.current_stock} {item.unit || "Pcs"} • Price: Rs {item.sale_price_single}
                    </span>
                  </div>
                  <Button
                    onClick={() => handleApplyClearanceDiscount(item)}
                    size="sm"
                    className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] h-7 rounded-lg shadow-sm cursor-pointer"
                  >
                    <Tag size={12} className="mr-1" /> 15% Clearance
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
