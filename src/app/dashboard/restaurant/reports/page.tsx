"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Calendar, AlertTriangle, FileText, Loader2, Info, Search,
  Plus, Percent, ShoppingBag, ArrowDownRight, RefreshCw, BarChart2, Trash2
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubscriptionBlocker } from "@/components/dashboard/SubscriptionBlocker";

type Product = {
  id: string;
  name: string;
  sale_price_single: number;
  purchase_price_single: number;
  unit: string | null;
  is_ingredient: boolean;
};

type RecipeItem = {
  parent_product_id: string;
  ingredient_product_id: string;
  quantity: number;
};

type WastageLog = {
  id: string;
  product_id: string;
  quantity: number;
  reason: string;
  cost_at_wastage: number;
  created_at: string;
  product?: {
    name: string;
    unit: string | null;
  };
};

export default function RestaurantReportsPage() {
  const { shopId, allowReports } = useShop();
  const { language } = useLanguage();
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // UI Tabs & Filters State
  const [activeTab, setActiveTab] = useState<"consumption" | "wastage" | "profitability">("consumption");
  const [dateRange, setDateRange] = useState<"today" | "yesterday" | "week" | "month" | "custom">("week");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Data State
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [salesItems, setSalesItems] = useState<any[]>([]);
  const [wastageLogs, setWastageLogs] = useState<WastageLog[]>([]);

  // Wastage Form State
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [wastageQty, setWastageQty] = useState<number>(0);
  const [wastageReason, setWastageReason] = useState("");
  const [submittingWastage, setSubmittingWastage] = useState(false);

  // Search Filter States
  const [searchQuery, setSearchQuery] = useState("");

  const getStartEndDates = () => {
    const now = new Date();
    let startStr = startDate;
    let endStr = endDate;

    if (dateRange === "today") {
      const today = new Date();
      startStr = today.toISOString().split("T")[0];
      endStr = today.toISOString().split("T")[0];
    } else if (dateRange === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      startStr = yesterday.toISOString().split("T")[0];
      endStr = yesterday.toISOString().split("T")[0];
    } else if (dateRange === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      startStr = weekAgo.toISOString().split("T")[0];
      endStr = now.toISOString().split("T")[0];
    } else if (dateRange === "month") {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      startStr = monthAgo.toISOString().split("T")[0];
      endStr = now.toISOString().split("T")[0];
    }

    return { start: startStr, end: endStr };
  };

  const loadData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const { start, end } = getStartEndDates();
      const startDateTime = `${start}T00:00:00.000Z`;
      const endDateTime = `${end}T23:59:59.999Z`;

      // 1. Fetch Products
      const { data: prodsData, error: prodsErr } = await supabase
        .from("products")
        .select("id, name, sale_price_single, purchase_price_single, unit, is_ingredient")
        .eq("shop_id", shopId);
      if (prodsErr) throw prodsErr;
      const prods = prodsData || [];
      setProducts(prods);

      // 2. Fetch Recipes
      const { data: recsData, error: recsErr } = await supabase
        .from("product_recipes")
        .select("parent_product_id, ingredient_product_id, quantity");
      if (recsErr && recsErr.code !== "PGRST205") throw recsErr; // Ignore table missing error during local sandbox startup if any
      setRecipes(recsData || []);

      // 3. Fetch Paid/Settled Invoice Items in date range
      const { data: invItemsData, error: invErr } = await supabase
        .from("invoices")
        .select(`
          id,
          status,
          created_at,
          invoice_items (
            product_id,
            quantity,
            unit_price,
            subtotal
          )
        `)
        .eq("shop_id", shopId)
        .eq("is_voided", false)
        .neq("status", "draft")
        .neq("status", "quotation")
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime);

      if (invErr) throw invErr;

      // Extract and flatten invoice items
      const flattenedItems: any[] = [];
      (invItemsData || []).forEach((inv: any) => {
        (inv.invoice_items || []).forEach((item: any) => {
          flattenedItems.push({
            product_id: item.product_id,
            quantity: Number(item.quantity || 0),
            unit_price: Number(item.unit_price || 0),
            subtotal: Number(item.subtotal || 0),
            created_at: inv.created_at
          });
        });
      });
      setSalesItems(flattenedItems);

      // 4. Fetch Wastage logs in date range
      const { data: wasteData, error: wasteErr } = await supabase
        .from("product_wastage")
        .select(`
          id,
          product_id,
          quantity,
          reason,
          cost_at_wastage,
          created_at,
          product:products (
            name,
            unit
          )
        `)
        .eq("shop_id", shopId)
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime)
        .order("created_at", { ascending: false });

      if (wasteErr && wasteErr.code !== "PGRST205") throw wasteErr;
      setWastageLogs(wasteData || []);

    } catch (err: any) {
      toast.error("Failed to load report data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [shopId, dateRange, startDate, endDate]);

  // Handle Wastage Logging Form Submission
  const handleLogWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    if (!selectedIngredientId) {
      toast.error("Please select an ingredient.");
      return;
    }
    if (wastageQty <= 0) {
      toast.error("Quantity must be greater than zero.");
      return;
    }

    const selectedProd = products.find(p => p.id === selectedIngredientId);
    if (!selectedProd) return;

    setSubmittingWastage(true);
    try {
      const { error } = await supabase.from("product_wastage").insert({
        shop_id: shopId,
        product_id: selectedIngredientId,
        quantity: wastageQty,
        reason: wastageReason || "Unspecified",
        cost_at_wastage: selectedProd.purchase_price_single || 0
      });

      if (error) throw error;

      // Adjust stock of raw material directly in background via decrement_product_stock RPC
      // Wastage is zaya, so we decrement stock
      const { error: stockErr } = await supabase.rpc("decrement_product_stock", {
        p_product_id: selectedIngredientId,
        p_qty: wastageQty
      });
      if (stockErr) console.error("Error decrementing stock for wastage:", stockErr);

      toast.success("Wastage logged successfully & inventory updated!");
      setSelectedIngredientId("");
      setWastageQty(0);
      setWastageReason("");
      loadData();
    } catch (err: any) {
      toast.error("Failed to log wastage: " + err.message);
    } finally {
      setSubmittingWastage(false);
    }
  };

  // Calculations for Consumption Report (BOM analysis)
  const getConsumptionReport = () => {
    const rawIngMap: Record<string, { product: Product; qtyNeeded: number; totalCost: number }> = {};

    // Initialize raw ingredients map
    products.forEach(p => {
      if (p.is_ingredient) {
        rawIngMap[p.id] = {
          product: p,
          qtyNeeded: 0,
          totalCost: 0
        };
      }
    });

    // Loop through sold invoice items
    salesItems.forEach(sale => {
      // Find parent's recipe list
      const matchingRecipes = recipes.filter(r => r.parent_product_id === sale.product_id);
      if (matchingRecipes.length > 0) {
        matchingRecipes.forEach(rec => {
          if (rawIngMap[rec.ingredient_product_id]) {
            const consumedQty = rec.quantity * sale.quantity;
            rawIngMap[rec.ingredient_product_id].qtyNeeded += consumedQty;
            rawIngMap[rec.ingredient_product_id].totalCost += consumedQty * (rawIngMap[rec.ingredient_product_id].product.purchase_price_single || 0);
          }
        });
      }
    });

    return Object.values(rawIngMap).filter(item => item.qtyNeeded > 0);
  };

  // Calculations for Item-wise Profitability
  const getItemWiseProfitability = () => {
    const menuItemsMap: Record<string, {
      product: Product;
      soldQty: number;
      revenue: number;
      recipeCost: number;
      totalCOGS: number;
      profit: number;
      profitPercent: number;
    }> = {};

    // Map all finished products (non-ingredients)
    products.forEach(p => {
      if (!p.is_ingredient) {
        // Calculate recipe cost for this finished item
        let calculatedRecipeCost = 0;
        const matchingRecipes = recipes.filter(r => r.parent_product_id === p.id);
        if (matchingRecipes.length > 0) {
          matchingRecipes.forEach(rec => {
            const ingProd = products.find(prod => prod.id === rec.ingredient_product_id);
            const ingCost = ingProd?.purchase_price_single || 0;
            calculatedRecipeCost += rec.quantity * ingCost;
          });
        } else {
          // If no recipe setup, fall back to its direct purchase price (e.g. cold drinks)
          calculatedRecipeCost = p.purchase_price_single || 0;
        }

        menuItemsMap[p.id] = {
          product: p,
          soldQty: 0,
          revenue: 0,
          recipeCost: calculatedRecipeCost,
          totalCOGS: 0,
          profit: 0,
          profitPercent: 0
        };
      }
    });

    // Populate actual sales
    salesItems.forEach(sale => {
      if (menuItemsMap[sale.product_id]) {
        const item = menuItemsMap[sale.product_id];
        item.soldQty += sale.quantity;
        item.revenue += sale.subtotal;
        item.totalCOGS += item.recipeCost * sale.quantity;
      }
    });

    // Calculate final net profit margins
    return Object.values(menuItemsMap)
      .map(item => {
        const profit = item.revenue - item.totalCOGS;
        const profitPercent = item.revenue > 0 ? (profit / item.revenue) * 100 : 0;
        return {
          ...item,
          profit,
          profitPercent
        };
      })
      .filter(item => item.soldQty > 0 || searchQuery === "") // filter out unsolds unless searching
      .sort((a, b) => b.soldQty - a.soldQty); // Order by most popular
  };

  const consumptionData = getConsumptionReport();
  const profitabilityData = getItemWiseProfitability().filter(it => 
    it.product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalWastageCost = wastageLogs.reduce((sum, item) => sum + (item.cost_at_wastage * item.quantity), 0);
  const totalConsumptionCost = consumptionData.reduce((sum, item) => sum + item.totalCost, 0);

  const rawMaterials = products.filter(p => p.is_ingredient);

  if (!mounted) return null;

  if (!allowReports) {
    return <SubscriptionBlocker featureName="Restaurant Analytics & Reports" requiredPlan="Starter" />;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-800 flex items-center gap-1.5 font-nastaleeq">
            <BarChart2 className="text-blue-600 animate-pulse" /> 
            {language === "en" ? "Restaurant Analytics & Reports" : "ریستوراں رپورٹس اور منافع کا حساب"}
          </h2>
          
        </div>

        {/* Date Filters Controls */}
        <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm">
          {(["today", "yesterday", "week", "month", "custom"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setDateRange(mode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase transition-all ${
                dateRange === mode
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors hover:text-slate-800"
              }`}
            >
              {mode === "today" ? (language === "en" ? "Today" : "آج") :
               mode === "yesterday" ? (language === "en" ? "Yesterday" : "گزشتہ روز") :
               mode === "week" ? (language === "en" ? "7 Days" : "اس ہفتے") :
               mode === "month" ? (language === "en" ? "30 Days" : "اس مہینے") :
               (language === "en" ? "Custom" : "اپنی مرضی")}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Picker Fields (if custom range selected) */}
      {dateRange === "custom" && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-wrap gap-4 items-end"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>
          </div>
          <Button onClick={loadData} className="bg-slate-900 text-white h-9 rounded-xl px-4 text-xs font-bold shadow-sm">
            <RefreshCw size={14} className="mr-1" /> {language === "en" ? "Apply Dates" : "تاریخ لاگو کریں"}
          </Button>
        </motion.div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-4">
        {(["consumption", "wastage", "profitability"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSearchQuery("");
            }}
            className={`pb-3 px-1 text-sm font-bold border-b-2 transition-all relative ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab === "consumption" && (language === "en" ? "Consumption Report (کھپت رپورٹ)" : "کھپت رپورٹ (Consumption)")}
            {tab === "wastage" && (language === "en" ? "Wastage Tracker (ضائع شدہ اشیاء)" : "ضائع شدہ اشیاء (Wastage)")}
            {tab === "profitability" && (language === "en" ? "Dish Profitability (آئٹم وار منافع)" : "آئٹم وار منافع (Profitability)")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          
        </div>
      ) : (
        <AnimatePresence mode="wait">
          
          {/* TAB 1: Consumption Report */}
          {activeTab === "consumption" && (
            <motion.div
              key="consumption"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {/* Consumption Overview Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-28">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                    Total Raw Ingredients Used (تھوریٹیکل کھپت)
                  </span>
                  <span className="text-2xl font-black text-slate-850 font-mono">
                    Rs {totalConsumptionCost.toFixed(2)}
                  </span>
                </div>
                
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-28">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                    Dishes Sold Count (فروخت شدہ ڈشز)
                  </span>
                  <span className="text-2xl font-black text-slate-850 font-mono">
                    {salesItems.length} items
                  </span>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-28">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                    Total Menu Revenue (کل فروخت)
                  </span>
                  <span className="text-2xl font-black text-slate-850 font-mono">
                    Rs {salesItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Consumption Details Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    {language === "en" ? "Theoretical Raw Material Consumed" : "مینو ڈشز کے فروخت کی بنیاد پر خام مال کا خرچ"}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500 font-nastaleeq">
                    {language === "en" ? "Calculated by mapping recipe formulas against paid sales." : "یہ رپورٹ ریسیپی (BOM) کی بنیاد پر نکالی گئی ہے۔"}
                  </span>
                </div>

                {consumptionData.length === 0 ? (
                  <div className="text-center py-14 border border-dashed border-slate-200 rounded-xl">
                    <ShoppingBag className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                    <p className="text-slate-500 text-sm">{language === "en" ? "No product consumption recorded in this timeframe." : "اس تاریخ کے درمیان کوئی بھی ڈش فروخت نہیں ہوئی یا ریسیپی لنک نہیں ہے۔"}</p>
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-inner">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="p-3.5">Raw Material (خام مال)</th>
                          <th className="p-3.5 text-center">Unit of Measure (پیمائش کا یونٹ)</th>
                          <th className="p-3.5 text-center">Theoretical Qty Consumed (استعمال شدہ مقدار)</th>
                          <th className="p-3.5 text-center">WAC Cost per Unit (خریداری قیمت)</th>
                          <th className="p-3.5 text-right">Computed Cost Sum (کل قیمت)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consumptionData.map(item => (
                          <tr key={item.product.id} className="border-b border-slate-50 text-xs text-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/40">
                            <td className="p-3.5 font-bold text-slate-800">{item.product.name}</td>
                            <td className="p-3.5 text-center font-semibold text-slate-500">{item.product.unit || "unit"}</td>
                            <td className="p-3.5 text-center font-extrabold text-blue-600 font-mono">{item.qtyNeeded.toFixed(3)}</td>
                            <td className="p-3.5 text-center font-mono font-medium text-slate-500">Rs {item.product.purchase_price_single}</td>
                            <td className="p-3.5 text-right font-black text-slate-800 font-mono">Rs {item.totalCost.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 2: Wastage Tracker */}
          {activeTab === "wastage" && (
            <motion.div
              key="wastage"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              {/* Left Form: Log new wastage (4 cols) */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center gap-1 text-slate-800">
                  <AlertTriangle className="text-amber-500 h-5 w-5" />
                  <h3 className="font-bold text-sm uppercase tracking-wide">
                    {language === "en" ? "Log Product Wastage" : "ضائع شدہ مال درج کریں"}
                  </h3>
                </div>

                <form onSubmit={handleLogWastage} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Select Raw Ingredient</label>
                    <select
                      value={selectedIngredientId}
                      onChange={e => setSelectedIngredientId(e.target.value)}
                      className="w-full text-xs border border-slate-200 p-2.5 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 h-10 cursor-pointer text-slate-700 font-semibold"
                      required
                    >
                      <option value="">-- Select Material --</option>
                      {rawMaterials.map(ing => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} (Unit: {ing.unit || 'unit'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                      Quantity Wasted ({rawMaterials.find(p => p.id === selectedIngredientId)?.unit || "units"})
                    </label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="e.g. 1.500"
                      value={wastageQty || ""}
                      onChange={e => setWastageQty(parseFloat(e.target.value) || 0)}
                      className="h-10 text-xs border-slate-200 rounded-xl"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Reason (وجہ)</label>
                    <select
                      value={wastageReason}
                      onChange={e => setWastageReason(e.target.value)}
                      className="w-full text-xs border border-slate-200 p-2.5 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 h-10 cursor-pointer text-slate-700 font-semibold"
                      required
                    >
                      <option value="">-- Choose Reason --</option>
                      <option value="Spoiled / Expired (خراب ہو گیا)">Spoiled / Expired (خراب ہو گیا)</option>
                      <option value="Spilled / Spillage (گر گیا)">Spilled / Spillage (گر گیا)</option>
                      <option value="Kitchen Mistake (کچن کی غلطی)">Kitchen Mistake (کچن کی غلطی)</option>
                      <option value="Customer Return (واپسی)">Customer Return (واپسی)</option>
                      <option value="Other (دیگر وجوہات)">Other (دیگر وجوہات)</option>
                    </select>
                  </div>

                  <Button
                    type="submit"
                    disabled={submittingWastage}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 text-xs shadow-md shadow-red-100 flex items-center justify-center gap-1.5"
                  >
                    {submittingWastage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    {language === "en" ? "Record Zaya / Wastage" : "ضائع شدہ اسٹاک شامل کریں"}
                  </Button>
                </form>
              </div>

              {/* Right List: Past wastage entries (8 cols) */}
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                      {language === "en" ? "Wastage History & Loss Summary" : "ضائع شدہ اشیاء کی تفصیل اور مالی نقصان"}
                    </h3>
                  </div>
                  <div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-xl border border-red-100 flex items-center gap-1 text-xs font-black">
                    <span>Total Loss:</span>
                    <span className="font-mono">Rs {totalWastageCost.toFixed(2)}</span>
                  </div>
                </div>

                {wastageLogs.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-slate-200 rounded-xl bg-slate-50/20">
                    <Info className="mx-auto h-9 w-9 text-slate-300 mb-2" />
                    <p className="text-slate-500 text-xs">{language === "en" ? "No wastage entries recorded during this date range." : "اس تاریخ کے درمیان ضائع شدہ اشیاء کا کوئی ریکارڈ نہیں ہے۔"}</p>
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-inner">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="p-3">Logged Date</th>
                          <th className="p-3">Product Name</th>
                          <th className="p-3 text-center">Qty Wasted</th>
                          <th className="p-3 text-center">Reason</th>
                          <th className="p-3 text-right">Estimated Cost Loss</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wastageLogs.map(log => {
                          const computedLoss = log.cost_at_wastage * log.quantity;
                          return (
                            <tr key={log.id} className="border-b border-slate-50 text-xs text-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/40">
                              <td className="p-3 text-slate-500 font-semibold font-mono">
                                {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="p-3 font-bold text-slate-800">{log.product?.name || "Unknown Product"}</td>
                              <td className="p-3 text-center font-extrabold text-red-600 font-mono">
                                {Number(log.quantity).toFixed(3)} <span className="text-[10px] text-slate-400 font-semibold uppercase">{log.product?.unit || 'unit'}</span>
                              </td>
                              <td className="p-3 text-center font-medium text-slate-600">{log.reason}</td>
                              <td className="p-3 text-right font-black text-slate-800 font-mono">Rs {computedLoss.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 3: Item-wise Profitability */}
          {activeTab === "profitability" && (
            <motion.div
              key="profitability"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {/* Profitability Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                      {language === "en" ? "Menu Dishes Profitability Breakdown" : "مینو ڈشز کے منافع اور لاگت کا موازنہ"}
                    </h3>
                  </div>
                  
                  {/* Search filter input */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder={language === "en" ? "Filter by dish name..." : "ڈش تلاش کریں..."}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-8 bg-slate-50 border-slate-200 h-9 text-xs rounded-xl"
                    />
                  </div>
                </div>

                {profitabilityData.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-slate-200 rounded-xl">
                    <Info className="mx-auto h-9 w-9 text-slate-300 mb-2" />
                    <p className="text-slate-500 text-sm">{language === "en" ? "No dishes matches your query or have been sold." : "کوئی ریکارڈ نہیں ملا یا اس دوران کوئی ڈش فروخت نہیں ہوئی ہے۔"}</p>
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-inner">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="p-3.5">Dish Name (ڈش کا نام)</th>
                          <th className="p-3.5 text-center">Sold Qty (تعداد)</th>
                          <th className="p-3.5 text-center">Unit Recipe Cost (لاگت)</th>
                          <th className="p-3.5 text-center">Unit Sale Price (قیمت فروخت)</th>
                          <th className="p-3.5 text-center">Total Revenue (آمدن)</th>
                          <th className="p-3.5 text-center">Total COGS (کل لاگت)</th>
                          <th className="p-3.5 text-right">Net Profit (کل منافع)</th>
                          <th className="p-3.5 text-center">Margin % (مارجن)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profitabilityData.map(item => {
                          const profitColor = item.profit >= 0 ? "text-emerald-600" : "text-red-500";
                          const marginColor = item.profitPercent >= 40 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : item.profitPercent >= 20 ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-red-50 text-red-700 border-red-100";
                          return (
                            <tr key={item.product.id} className="border-b border-slate-50 text-xs text-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/40">
                              <td className="p-3.5 font-bold text-slate-800">{item.product.name}</td>
                              <td className="p-3.5 text-center font-extrabold text-slate-700 font-mono">{item.soldQty}</td>
                              <td className="p-3.5 text-center text-slate-500 font-mono">Rs {item.recipeCost.toFixed(2)}</td>
                              <td className="p-3.5 text-center text-slate-500 font-mono">Rs {item.product.sale_price_single}</td>
                              <td className="p-3.5 text-center font-semibold text-slate-700 font-mono">Rs {item.revenue.toFixed(2)}</td>
                              <td className="p-3.5 text-center text-slate-500 font-mono">Rs {item.totalCOGS.toFixed(2)}</td>
                              <td className={`p-3.5 text-right font-black font-mono ${profitColor}`}>Rs {item.profit.toFixed(2)}</td>
                              <td className="p-3.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${marginColor}`}>
                                  {item.profitPercent.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      )}

    </div>
  );
}
