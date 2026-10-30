"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  AlertTriangle, Package, ShoppingCart, Download, RefreshCw, 
  Search, Filter, CheckSquare, Square, ArrowRight, Share2, 
  Layers, Tag, Star, TrendingDown, DollarSign, Clock, 
  Edit3, CheckCircle2, XCircle, ArrowUpRight, MessageCircle, 
  Boxes, FileSpreadsheet, Loader2, Sparkles, Building2, ChevronDown
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { SubscriptionBlocker } from "@/components/dashboard/SubscriptionBlocker";
import { motion, AnimatePresence } from "framer-motion";

interface LowStockProduct {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  current_stock: number;
  min_stock_level: number;
  purchase_price_single: number;
  sale_price_single: number;
  shelf_location: string | null;
  category_id: string | null;
  brand_id: string | null;
  categories?: { name: string } | null;
  brands?: { name: string } | null;
  formulations?: { name: string } | null;
}

export default function LowStockPage() {
  const { shopId, shopName, userId, canAccessDashboardPath } = useShop();
  const supabase = createClient();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [products, setProducts] = useState<LowStockProduct[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [filterTab, setFilterTab] = useState<"all" | "out_of_stock" | "low_stock">("all");
  const [sortBy, setSortBy] = useState<"deficit" | "stock_asc" | "cost_desc" | "name_asc">("deficit");

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Threshold Quick Edit Modal
  const [editingThresholdProduct, setEditingThresholdProduct] = useState<LowStockProduct | null>(null);
  const [newThresholdValue, setNewThresholdValue] = useState<number>(5);
  const [savingThreshold, setSavingThreshold] = useState(false);

  // WhatsApp Booker Modal
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [bookerPhone, setBookerPhone] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");

  useEffect(() => {
    if (shopId) {
      loadLowStockData();
    }
  }, [shopId]);

  async function loadLowStockData() {
    if (!shopId) return;
    setLoading(true);
    try {
      const [prodsRes, catsRes, brandsRes, suppsRes] = await Promise.all([
        supabase
          .from("products")
          .select(`
            id, name, code, unit, current_stock, min_stock_level, purchase_price_single, sale_price_single, shelf_location, category_id, brand_id,
            categories ( name ),
            brands ( name ),
            formulations ( name )
          `)
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),
        supabase
          .from("categories")
          .select("id, name")
          .eq("shop_id", shopId),
        supabase
          .from("brands")
          .select("id, name")
          .eq("shop_id", shopId),
        supabase
          .from("parties")
          .select("id, name, phone")
          .eq("shop_id", shopId)
          .in("type", ["supplier", "dual"])
          .order("name", { ascending: true })
      ]);

      if (prodsRes.error) throw prodsRes.error;

      // Filter products that are low stock or out of stock
      const rawList = (prodsRes.data || []) as any[];
      const lowStockList: LowStockProduct[] = rawList
        .map(p => ({
          ...p,
          current_stock: Number(p.current_stock ?? 0),
          min_stock_level: Number(p.min_stock_level ?? 10),
          purchase_price_single: Number(p.purchase_price_single ?? 0),
          sale_price_single: Number(p.sale_price_single ?? 0),
          unit: p.unit || "Pcs"
        }))
        .filter(p => p.current_stock <= p.min_stock_level);

      setProducts(lowStockList);
      setCategories(catsRes.data || []);
      setBrands(brandsRes.data || []);
      setSuppliers(suppsRes.data || []);
    } catch (err: any) {
      console.error("Failed to load low stock:", err);
      toast.error("Failed to load low stock inventory: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Filtered & Sorted list
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Tab filter
      if (filterTab === "out_of_stock" && p.current_stock > 0) return false;
      if (filterTab === "low_stock" && p.current_stock === 0) return false;

      // Category filter
      if (selectedCategory !== "all" && p.category_id !== selectedCategory) return false;

      // Brand filter
      if (selectedBrand !== "all" && p.brand_id !== selectedBrand) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCode = p.code && p.code.toLowerCase().includes(q);
        const matchesCat = p.categories?.name && p.categories.name.toLowerCase().includes(q);
        const matchesBrand = p.brands?.name && p.brands.name.toLowerCase().includes(q);
        const matchesFormula = p.formulations?.name && p.formulations.name.toLowerCase().includes(q);
        return matchesName || matchesCode || matchesCat || matchesBrand || matchesFormula;
      }

      return true;
    }).sort((a, b) => {
      const deficitA = Math.max(1, a.min_stock_level - a.current_stock);
      const deficitB = Math.max(1, b.min_stock_level - b.current_stock);
      const costA = deficitA * a.purchase_price_single;
      const costB = deficitB * b.purchase_price_single;

      if (sortBy === "deficit") return deficitB - deficitA;
      if (sortBy === "stock_asc") return a.current_stock - b.current_stock;
      if (sortBy === "cost_desc") return costB - costA;
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      return 0;
    });
  }, [products, filterTab, selectedCategory, selectedBrand, searchQuery, sortBy]);

  // High-level Metrics
  const metrics = useMemo(() => {
    const outOfStock = products.filter(p => p.current_stock <= 0);
    const lowStock = products.filter(p => p.current_stock > 0 && p.current_stock <= p.min_stock_level);
    
    let totalDeficitUnits = 0;
    let totalEstimatedInvestment = 0;

    products.forEach(p => {
      const deficit = Math.max(1, p.min_stock_level - p.current_stock);
      totalDeficitUnits += deficit;
      totalEstimatedInvestment += (deficit * p.purchase_price_single);
    });

    return {
      totalAlerts: products.length,
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      totalDeficitUnits,
      totalEstimatedInvestment
    };
  }, [products]);

  // Selection handlers
  function toggleSelectAll() {
    if (selectedIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  }

  function toggleSelectProduct(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  // Quick Threshold Update
  function openThresholdModal(product: LowStockProduct) {
    setEditingThresholdProduct(product);
    setNewThresholdValue(product.min_stock_level);
  }

  async function handleSaveThreshold(e: React.FormEvent) {
    e.preventDefault();
    if (!editingThresholdProduct) return;
    setSavingThreshold(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ min_stock_level: Math.max(0, newThresholdValue) })
        .eq("id", editingThresholdProduct.id);

      if (error) throw error;

      toast.success(`Reorder threshold for "${editingThresholdProduct.name}" updated to ${newThresholdValue}! ⚡`);
      setEditingThresholdProduct(null);
      loadLowStockData();
    } catch (err: any) {
      toast.error("Failed to update threshold: " + err.message);
    } finally {
      setSavingThreshold(false);
    }
  }

  // Navigate to Purchase Order with pre-selected items
  function handleGeneratePurchaseOrder(singleProduct?: LowStockProduct) {
    const targetProducts = singleProduct 
      ? [singleProduct] 
      : (selectedIds.size > 0 ? products.filter(p => selectedIds.has(p.id)) : filteredProducts);

    if (targetProducts.length === 0) {
      toast.warning("Please select at least one low-stock product to generate purchase order.");
      return;
    }

    const orderPayload = targetProducts.map(p => ({
      product_id: p.id,
      product_name: p.name,
      quantity: Math.max(1, p.min_stock_level - p.current_stock),
      purchase_price: p.purchase_price_single,
      unit: p.unit
    }));

    try {
      sessionStorage.setItem("theaccounts_draft_po_items", JSON.stringify(orderPayload));
      toast.success(`Transferring ${targetProducts.length} items to Purchase Order Desk... 🚚`);
      startTransition(() => {
        router.push("/dashboard/purchase?from=low-stock");
      });
    } catch (e) {
      router.push("/dashboard/purchase");
    }
  }

  // Generate WhatsApp text for bookers
  const whatsAppMessage = useMemo(() => {
    const targetItems = selectedIds.size > 0 
      ? filteredProducts.filter(p => selectedIds.has(p.id))
      : filteredProducts;

    if (targetItems.length === 0) return "";

    const dateStr = new Date().toLocaleDateString();
    let text = `📦 *URGENT STOCK DEMAND / REORDER SHEET*\n`;
    text += `🏥 *Store:* ${shopName || "Our Store"}\n`;
    text += `📅 *Date:* ${dateStr}\n\n`;
    text += `*Required Items:*\n`;

    targetItems.slice(0, 40).forEach((p, idx) => {
      const deficit = Math.max(1, p.min_stock_level - p.current_stock);
      text += `${idx + 1}. *${p.name}* — Req: *${deficit} ${p.unit}* (Current Stock: ${p.current_stock})\n`;
    });

    if (targetItems.length > 40) {
      text += `\n...and ${targetItems.length - 40} more items.\n`;
    }

    const totalReq = targetItems.reduce((s, p) => s + Math.max(1, p.min_stock_level - p.current_stock), 0);
    const estVal = targetItems.reduce((s, p) => s + (Math.max(1, p.min_stock_level - p.current_stock) * p.purchase_price_single), 0);

    text += `\n📊 *Total Items:* ${targetItems.length}`;
    text += `\n📦 *Total Units Needed:* ${totalReq}`;
    if (estVal > 0) text += `\n💰 *Est. Value:* Rs ${Math.round(estVal).toLocaleString()}`;
    text += `\n\n_Please confirm stock availability & delivery schedule. Thank you!_`;

    return text;
  }, [filteredProducts, selectedIds, shopName]);

  function handleSendWhatsApp() {
    let cleanPhone = bookerPhone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "92" + cleanPhone.slice(1);
    }
    const encoded = encodeURIComponent(whatsAppMessage);
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
    setIsWhatsAppOpen(false);
  }

  // Export PDF Demand Sheet
  async function handleDownloadDemandPDF() {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 28, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(shopName?.toUpperCase() || "THE ACCOUNTS", 14, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text("LOW STOCK & INVENTORY REPLENISHMENT DEMAND SHEET", 14, 19);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24);

      const tableRows = filteredProducts.map((p, idx) => {
        const deficit = Math.max(1, p.min_stock_level - p.current_stock);
        const estCost = deficit * p.purchase_price_single;

        return [
          idx + 1,
          p.name,
          p.code || "-",
          p.categories?.name || "-",
          `${p.current_stock} ${p.unit}`,
          `${p.min_stock_level} ${p.unit}`,
          `${deficit} ${p.unit}`,
          `Rs ${p.purchase_price_single.toLocaleString()}`,
          `Rs ${Math.round(estCost).toLocaleString()}`
        ];
      });

      autoTable(doc, {
        startY: 34,
        head: [["#", "Item Name", "Code", "Category", "In-Stock", "Min Level", "Order Qty", "Last Cost", "Est. Total"]],
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: [225, 29, 72],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold"
        },
        bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 48, fontStyle: "bold" },
          2: { cellWidth: 18 },
          3: { cellWidth: 20 },
          4: { cellWidth: 18, halign: "center" },
          5: { cellWidth: 18, halign: "center" },
          6: { cellWidth: 18, halign: "center", fontStyle: "bold", textColor: [225, 29, 72] },
          7: { cellWidth: 20, halign: "right" },
          8: { cellWidth: 22, halign: "right", fontStyle: "bold" }
        },
        margin: { left: 10, right: 10 }
      });

      doc.save(`low_stock_demand_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Low Stock Demand Sheet PDF downloaded! 📄");
    } catch (err: any) {
      toast.error("Failed to generate PDF: " + err.message);
    }
  }

  // Export CSV
  function handleDownloadCSV() {
    try {
      const headers = ["Index,Product Name,Code,Category,Brand,Current Stock,Min Stock Level,Deficit Needed,Unit,Purchase Price,Estimated Cost"];
      const rows = filteredProducts.map((p, idx) => {
        const deficit = Math.max(1, p.min_stock_level - p.current_stock);
        const estCost = deficit * p.purchase_price_single;
        return [
          idx + 1,
          `"${p.name.replace(/"/g, '""')}"`,
          `"${p.code || ""}"`,
          `"${p.categories?.name || ""}"`,
          `"${p.brands?.name || ""}"`,
          p.current_stock,
          p.min_stock_level,
          deficit,
          p.unit,
          p.purchase_price_single,
          estCost
        ].join(",");
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `low_stock_demand_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV file downloaded!");
    } catch (err: any) {
      toast.error("Failed to export CSV: " + err.message);
    }
  }

  if (canAccessDashboardPath && !canAccessDashboardPath("/dashboard/inventory/low-stock")) {
    return <SubscriptionBlocker featureName="Inventory & Stock Master" requiredPlan="Starter" />;
  }

  return (
    <div className="space-y-6 font-sans text-slate-800 max-w-[1600px] mx-auto pb-16">
      
      {/* ─── Top Bar & Actions ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 shadow-xs">
              <AlertTriangle size={22} className="animate-pulse" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                Low Stock Alert & Demand Console
                <span className="text-xs font-black bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full border border-rose-200">
                  {metrics.totalAlerts} Items Triggered
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Live monitoring of stock shortages, automatic reorder threshold deficits, and booker demands.
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Create Bulk PO button */}
          <button
            onClick={() => handleGeneratePurchaseOrder()}
            className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white rounded-xl text-xs font-black shadow-md shadow-rose-200 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Create Purchase Order for selected or all low stock items"
          >
            <ShoppingCart size={14} />
            <span>Generate Purchase Order {selectedIds.size > 0 ? `(${selectedIds.size} Selected)` : `(All Deficits)`}</span>
          </button>

          {/* WhatsApp Demand button */}
          <button
            onClick={() => setIsWhatsAppOpen(true)}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Share shortage demand list via WhatsApp"
          >
            <MessageCircle size={14} />
            <span className="hidden sm:inline">WhatsApp Booker</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={handleDownloadDemandPDF}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Download Demand Sheet PDF"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export PDF</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleDownloadCSV}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
            title="Export CSV"
          >
            <FileSpreadsheet size={16} />
          </button>

          {/* Refresh */}
          <button
            onClick={loadLowStockData}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
            title="Refresh Inventory"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-rose-600" : ""} />
          </button>
        </div>
      </div>

      {/* ─── 4 Summary Metric Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Out of Stock Card */}
        <div className="bg-gradient-to-br from-rose-500/10 via-rose-50/50 to-white p-4.5 rounded-3xl border border-rose-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest block">
              🚨 Out of Stock (0 Stock)
            </span>
            <span className="p-1.5 rounded-xl bg-rose-100 text-rose-700">
              <XCircle size={15} />
            </span>
          </div>
          <h3 className="text-2xl font-black text-rose-950 font-mono mt-1">
            {metrics.outOfStockCount} <span className="text-xs font-bold text-rose-600">Products Dry</span>
          </h3>
          <p className="text-[11px] text-rose-700/80 mt-0.5">Critical items currently with zero units</p>
        </div>

        {/* Low Stock Warning Card */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-50/50 to-white p-4.5 rounded-3xl border border-amber-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest block">
              ⚠️ Reorder Triggered
            </span>
            <span className="p-1.5 rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle size={15} />
            </span>
          </div>
          <h3 className="text-2xl font-black text-amber-950 font-mono mt-1">
            {metrics.lowStockCount} <span className="text-xs font-bold text-amber-600">Low Stock</span>
          </h3>
          <p className="text-[11px] text-amber-700/80 mt-0.5">Stock is at or below min reorder point</p>
        </div>

        {/* Total Deficit Units Card */}
        <div className="bg-gradient-to-br from-purple-500/10 via-purple-50/50 to-white p-4.5 rounded-3xl border border-purple-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest block">
              📦 Replenishment Deficit
            </span>
            <span className="p-1.5 rounded-xl bg-purple-100 text-purple-700">
              <Boxes size={15} />
            </span>
          </div>
          <h3 className="text-2xl font-black text-purple-950 font-mono mt-1">
            {metrics.totalDeficitUnits.toLocaleString()} <span className="text-xs font-bold text-purple-600">Units Needed</span>
          </h3>
          <p className="text-[11px] text-purple-700/80 mt-0.5">Total units to reach minimum safe inventory</p>
        </div>

        {/* Estimated Capital Investment */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-50/50 to-white p-4.5 rounded-3xl border border-emerald-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block">
              💰 Estimated Capital Required
            </span>
            <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-700">
              <DollarSign size={15} />
            </span>
          </div>
          <h3 className="text-2xl font-black text-emerald-950 font-mono mt-1">
            Rs {Math.round(metrics.totalEstimatedInvestment).toLocaleString()}
          </h3>
          <p className="text-[11px] text-emerald-700/80 mt-0.5">Based on last purchase cost rates</p>
        </div>
      </div>

      {/* ─── Filter & Toolbar ─── */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        
        {/* Tabs & Search Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Status Tabs */}
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200/80">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                filterTab === "all" ? "bg-white text-rose-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All Alerts ({products.length})
            </button>
            <button
              onClick={() => setFilterTab("out_of_stock")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                filterTab === "out_of_stock" ? "bg-white text-rose-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              🚨 Out of Stock ({metrics.outOfStockCount})
            </button>
            <button
              onClick={() => setFilterTab("low_stock")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                filterTab === "low_stock" ? "bg-white text-amber-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ⚠️ Low Stock ({metrics.lowStockCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product name, code, category, brand, formula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9.5 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:bg-white transition"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters & Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs font-bold">
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <Tag size={13} className="text-slate-400" />
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="h-8.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Brand Filter */}
            <div className="flex items-center gap-1.5">
              <Star size={13} className="text-slate-400" />
              <select
                value={selectedBrand}
                onChange={e => setSelectedBrand(e.target.value)}
                className="h-8.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Brands / Mfg</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-1.5">
              <TrendingDown size={13} className="text-slate-400" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="h-8.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="deficit">Sort: Highest Deficit Needed</option>
                <option value="stock_asc">Sort: Lowest Current Stock First</option>
                <option value="cost_desc">Sort: Highest Estimated Cost</option>
                <option value="name_asc">Sort: Alphabetical (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Quick Selection Summary */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs font-black text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? (
                <CheckSquare size={15} className="text-rose-600" />
              ) : (
                <Square size={15} className="text-slate-400" />
              )}
              <span>Select All ({filteredProducts.length})</span>
            </button>

            {selectedIds.size > 0 && (
              <span className="text-[11px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200">
                {selectedIds.size} Selected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Low Stock Items Table ─── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-9 w-9 animate-spin text-rose-600 mb-2" />
            <p className="text-xs font-bold text-slate-600">Analyzing stock levels & replenishment demand...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <div className="h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">All Stock Levels Healthy! 🎉</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No products are currently below their minimum threshold. Your inventory buffer is in optimal state.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] select-none">
                  <th className="py-3 px-3 text-center w-10">
                    <button onClick={toggleSelectAll} className="cursor-pointer">
                      {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? (
                        <CheckSquare size={14} className="text-rose-600" />
                      ) : (
                        <Square size={14} className="text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3.5">Product & SKU Details</th>
                  <th className="py-3 px-3">Category / Brand</th>
                  <th className="py-3 px-3 text-center">In-Stock</th>
                  <th className="py-3 px-3 text-center">Min Threshold</th>
                  <th className="py-3 px-3 text-center">Order Needed</th>
                  <th className="py-3 px-3 text-right">Last Cost</th>
                  <th className="py-3 px-3 text-right">Est. Investment</th>
                  <th className="py-3 px-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredProducts.map((product) => {
                  const isSelected = selectedIds.has(product.id);
                  const isOut = product.current_stock <= 0;
                  const deficit = Math.max(1, product.min_stock_level - product.current_stock);
                  const estCost = deficit * product.purchase_price_single;

                  return (
                    <tr 
                      key={product.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-rose-50/30" : isOut ? "bg-rose-50/15" : ""
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button 
                          onClick={() => toggleSelectProduct(product.id)}
                          className="cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare size={14} className="text-rose-600" />
                          ) : (
                            <Square size={14} className="text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                      </td>

                      {/* Product Details */}
                      <td className="py-3 px-3.5">
                        <div>
                          <p className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                            {product.name}
                            {isOut && (
                              <span className="bg-rose-100 text-rose-800 text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase border border-rose-200">
                                Dry (0)
                              </span>
                            )}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                            {product.code && (
                              <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 text-slate-600">
                                {product.code}
                              </span>
                            )}
                            <span>Unit: <strong>{product.unit}</strong></span>
                            {product.formulations?.name && (
                              <span className="text-indigo-600 font-bold">({product.formulations.name})</span>
                            )}
                            {product.shelf_location && (
                              <span className="text-slate-500 font-mono">Rack: {product.shelf_location}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category & Brand */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-bold text-slate-700 block">
                            {product.categories?.name || "General"}
                          </span>
                          {product.brands?.name && (
                            <span className="text-[10px] text-slate-400 block">
                              {product.brands.name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Current Stock Badge */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 font-mono font-black text-xs px-2.5 py-1 rounded-xl border ${
                          isOut 
                            ? "bg-rose-50 text-rose-700 border-rose-200" 
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}>
                          {product.current_stock} {product.unit}
                        </span>
                      </td>

                      {/* Min Threshold with Inline Edit */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1 group">
                          <span className="font-mono font-bold text-slate-600 text-xs">
                            {product.min_stock_level} {product.unit}
                          </span>
                          <button
                            onClick={() => openThresholdModal(product)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Quick Edit Minimum Threshold"
                          >
                            <Edit3 size={12} />
                          </button>
                        </div>
                      </td>

                      {/* Deficit Units Needed */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block font-mono font-black text-xs px-2.5 py-1 rounded-xl bg-rose-600 text-white shadow-xs">
                          +{deficit} {product.unit}
                        </span>
                      </td>

                      {/* Last Cost */}
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        Rs {product.purchase_price_single.toLocaleString()}
                      </td>

                      {/* Total Cost for this Deficit */}
                      <td className="py-3 px-3 text-right font-mono font-black text-rose-950 text-xs">
                        Rs {Math.round(estCost).toLocaleString()}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 1-Click PO */}
                          <button
                            onClick={() => handleGeneratePurchaseOrder(product)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-black transition-colors flex items-center gap-1 cursor-pointer"
                            title="Add item to Purchase Order"
                          >
                            <ShoppingCart size={13} />
                            <span>Order</span>
                          </button>

                          {/* Quick Threshold Edit */}
                          <button
                            onClick={() => openThresholdModal(product)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                            title="Edit Reorder Threshold"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Quick Threshold Edit Modal ─── */}
      <AnimatePresence>
        {editingThresholdProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0" onClick={() => setEditingThresholdProduct(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md relative z-10 border border-slate-100 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Edit3 size={16} className="text-rose-600" /> Adjust Minimum Stock Threshold
                </h3>
                <button
                  onClick={() => setEditingThresholdProduct(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs">
                <p className="font-bold text-slate-900">{editingThresholdProduct.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Current Stock: <strong>{editingThresholdProduct.current_stock} {editingThresholdProduct.unit}</strong>
                </p>
              </div>

              <form onSubmit={handleSaveThreshold} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Minimum Reorder Threshold ({editingThresholdProduct.unit})
                  </label>
                  <input
                    type="number"
                    value={newThresholdValue || ""}
                    onChange={e => setNewThresholdValue(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-mono"
                    min="0"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    When stock drops to or below this quantity, this product will trigger in this Low Stock panel.
                  </p>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingThresholdProduct(null)}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingThreshold}
                    className="flex-1 h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-200 disabled:opacity-50 cursor-pointer"
                  >
                    {savingThreshold && <Loader2 size={13} className="animate-spin" />} Save Threshold
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── WhatsApp Booker Sharing Modal ─── */}
      <AnimatePresence>
        {isWhatsAppOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0" onClick={() => setIsWhatsAppOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg relative z-10 border border-slate-100 shadow-xl space-y-4 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <MessageCircle size={18} className="text-emerald-600" /> WhatsApp Stock Demand to Booker
                </h3>
                <button
                  onClick={() => setIsWhatsAppOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {/* Select Supplier */}
                {suppliers.length > 0 && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Choose Registered Supplier / Booker (Optional)
                    </label>
                    <select
                      value={selectedSupplierId}
                      onChange={e => {
                        setSelectedSupplierId(e.target.value);
                        const supp = suppliers.find(s => s.id === e.target.value);
                        if (supp?.phone) setBookerPhone(supp.phone);
                      }}
                      className="w-full h-9.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Choose Booker / Distributor --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.phone || "No phone"})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Booker Phone */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Booker / Distributor WhatsApp Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 03001234567 or 923001234567"
                    value={bookerPhone}
                    onChange={e => setBookerPhone(e.target.value)}
                    className="w-full h-9.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  />
                </div>

                {/* Message Preview */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Demand Message Preview
                  </label>
                  <textarea
                    readOnly
                    rows={6}
                    value={whatsAppMessage}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-700 focus:outline-none resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWhatsAppOpen(false)}
                  className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200 cursor-pointer"
                >
                  <MessageCircle size={14} /> Send WhatsApp Demand
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
