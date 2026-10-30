"use client";

import React, { useState } from "react";
import { 
  X, FileText, Download, Printer, CheckSquare, Square, 
  Layers, Building, AlertTriangle, DollarSign, Filter, 
  Eye, SlidersHorizontal, ArrowUpDown, Table, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ExportProduct = {
  id: string;
  name: string;
  code?: string | null;
  unit?: string | null;
  sale_price_single: number;
  purchase_price_single: number;
  current_stock: number;
  min_stock_level?: number;
  category_id?: string;
  categories?: any;
  brand_id?: string | null;
  brands?: any;
  shelf_location?: string | null;
  pack_size?: number | null;
  translated_names?: any;
};

export type ExportCategory = {
  id: string;
  name: string;
};

export type ExportBrand = {
  id: string;
  name: string;
};

interface ProductExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ExportProduct[];
  categories: ExportCategory[];
  brands: ExportBrand[];
  shopName: string;
  selectedCurrency?: string;
  industryType?: string | null;
}

export type ReportPreset = "master" | "pricelist" | "lowstock" | "valuation" | "custom";

export function ProductExportReportModal({
  isOpen,
  onClose,
  products,
  categories,
  brands,
  shopName,
  selectedCurrency = "PKR",
  industryType = "general",
}: ProductExportReportModalProps) {
  // Preset
  const [activePreset, setActivePreset] = useState<ReportPreset>("master");
  
  // Custom Filter State inside modal
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterStockStatus, setFilterStockStatus] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "stock_desc" | "stock_asc" | "price_desc" | "cost_desc">("name_asc");
  const [groupBy, setGroupBy] = useState<"none" | "category" | "brand">("none");

  // Report Formatting & Title
  const [reportTitle, setReportTitle] = useState("Product Catalog & Stock Report");
  const [pageOrientation, setPageOrientation] = useState<"portrait" | "landscape">("portrait");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Column Selectors
  const [columns, setColumns] = useState({
    serialNo: true,
    name: true,
    translatedName: false,
    code: true,
    category: true,
    brand: true,
    purchasePrice: true,
    salePrice: true,
    margin: false,
    stock: true,
    minStock: false,
    costValuation: true,
    saleValuation: true,
    shelfLocation: false,
    packSize: false,
  });

  // Apply Preset configurations
  const applyPreset = (preset: ReportPreset) => {
    setActivePreset(preset);
    if (preset === "master") {
      setReportTitle("Master Inventory & Catalog Report");
      setPageOrientation("landscape");
      setFilterStockStatus("all");
      setColumns({
        serialNo: true,
        name: true,
        translatedName: true,
        code: true,
        category: true,
        brand: true,
        purchasePrice: true,
        salePrice: true,
        margin: true,
        stock: true,
        minStock: true,
        costValuation: true,
        saleValuation: true,
        shelfLocation: true,
        packSize: true,
      });
    } else if (preset === "pricelist") {
      setReportTitle("Customer Price List / Rate Sheet");
      setPageOrientation("portrait");
      setFilterStockStatus("in_stock");
      setColumns({
        serialNo: true,
        name: true,
        translatedName: true,
        code: true,
        category: true,
        brand: true,
        purchasePrice: false, // Hidden for customer price list
        salePrice: true,
        margin: false,
        stock: true,
        minStock: false,
        costValuation: false,
        saleValuation: false,
        shelfLocation: false,
        packSize: true,
      });
    } else if (preset === "lowstock") {
      setReportTitle("Low Stock & Reorder Requirement Schedule");
      setPageOrientation("portrait");
      setFilterStockStatus("low_stock");
      setColumns({
        serialNo: true,
        name: true,
        translatedName: false,
        code: true,
        category: true,
        brand: true,
        purchasePrice: true,
        salePrice: true,
        margin: false,
        stock: true,
        minStock: true,
        costValuation: true,
        saleValuation: false,
        shelfLocation: true,
        packSize: false,
      });
    } else if (preset === "valuation") {
      setReportTitle("Financial Inventory Valuation & Audit Summary");
      setPageOrientation("landscape");
      setFilterStockStatus("all");
      setColumns({
        serialNo: true,
        name: true,
        translatedName: false,
        code: true,
        category: true,
        brand: true,
        purchasePrice: true,
        salePrice: true,
        margin: true,
        stock: true,
        minStock: false,
        costValuation: true,
        saleValuation: true,
        shelfLocation: false,
        packSize: false,
      });
    }
  };

  const getCategoryName = (p: ExportProduct) => {
    if (!p.categories) return "Uncategorized";
    if (Array.isArray(p.categories)) return p.categories[0]?.name || "Uncategorized";
    return p.categories.name || "Uncategorized";
  };

  const getBrandName = (p: ExportProduct) => {
    if (!p.brands) return "No Brand";
    if (Array.isArray(p.brands)) return p.brands[0]?.name || "No Brand";
    return p.brands.name || "No Brand";
  };

  // Filtered & Sorted items
  const processedProducts = products.filter((p) => {
    // Keyword search
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      const matchesName = p.name?.toLowerCase().includes(q);
      const matchesCode = p.code?.toLowerCase().includes(q);
      const catName = getCategoryName(p).toLowerCase();
      const brandName = getBrandName(p).toLowerCase();
      if (!matchesName && !matchesCode && !catName.includes(q) && !brandName.includes(q)) {
        return false;
      }
    }

    // Category filter
    if (filterCategory !== "all") {
      if (p.category_id !== filterCategory) return false;
    }

    // Brand filter
    if (filterBrand !== "all") {
      if (p.brand_id !== filterBrand) return false;
    }

    // Stock status filter
    const stock = Number(p.current_stock) || 0;
    const minStock = Number(p.min_stock_level) || 0;
    if (filterStockStatus === "in_stock" && stock <= 0) return false;
    if (filterStockStatus === "out_of_stock" && stock > 0) return false;
    if (filterStockStatus === "low_stock" && (stock > minStock || stock <= 0)) return false;

    return true;
  }).sort((a, b) => {
    if (sortBy === "name_asc") return a.name.localeCompare(b.name);
    if (sortBy === "name_desc") return b.name.localeCompare(a.name);
    if (sortBy === "stock_desc") return (b.current_stock || 0) - (a.current_stock || 0);
    if (sortBy === "stock_asc") return (a.current_stock || 0) - (b.current_stock || 0);
    if (sortBy === "price_desc") return (b.sale_price_single || 0) - (a.sale_price_single || 0);
    if (sortBy === "cost_desc") return (b.purchase_price_single || 0) - (a.purchase_price_single || 0);
    return 0;
  });

  // Aggregates for summary
  const totalCount = processedProducts.length;
  const totalStock = processedProducts.reduce((acc, p) => acc + (Number(p.current_stock) || 0), 0);
  const totalCostValuation = processedProducts.reduce(
    (acc, p) => acc + (Number(p.purchase_price_single || 0) * (Number(p.current_stock) || 0)),
    0
  );
  const totalSaleValuation = processedProducts.reduce(
    (acc, p) => acc + (Number(p.sale_price_single || 0) * (Number(p.current_stock) || 0)),
    0
  );
  const potentialProfit = Math.max(0, totalSaleValuation - totalCostValuation);
  const overallMargin = totalCostValuation > 0 ? (potentialProfit / totalCostValuation) * 100 : 0;

  const summary = {
    totalCount,
    totalStock,
    totalCostValuation,
    totalSaleValuation,
    potentialProfit,
    overallMargin,
  };

  // Helper toggle column
  const toggleColumn = (key: keyof typeof columns) => {
    setColumns((prev) => ({ ...prev, [key]: !prev[key] }));
    setActivePreset("custom");
  };

  // Generate & Download PDF
  const handleDownloadPDF = async () => {
    if (processedProducts.length === 0) {
      toast.error("No products matching the selected filters to export.");
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading("Generating customized PDF report...");

    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: pageOrientation,
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const isLandscape = pageOrientation === "landscape";

      // Brand Header & Colors
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 28, "F");

      // Title & Subtitle
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text(shopName.toUpperCase() || "THE ACCOUNTS", 14, 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text(reportTitle, 14, 18);

      // Date / Time stamp
      const nowStr = new Date().toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      doc.setFontSize(8);
      doc.text(`Generated: ${nowStr} | Items: ${processedProducts.length}`, pageWidth - 14, 18, { align: "right" });

      let currentY = 34;

      // Optional Executive Summary Banner Box
      if (includeSummary) {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.roundedRect(14, currentY, pageWidth - 28, columns.purchasePrice ? 18 : 13, 3, 3, "FD");

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(51, 65, 85);

        const colW = (pageWidth - 28) / (columns.purchasePrice ? 4 : 3);

        doc.text("TOTAL PRODUCTS", 18, currentY + 6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.text(`${summary.totalCount.toLocaleString()} items`, 18, currentY + 12);

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(51, 65, 85);
        doc.text("TOTAL STOCK INVENTORY", 18 + colW, currentY + 6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.text(`${summary.totalStock.toLocaleString()} Units`, 18 + colW, currentY + 12);

        if (columns.purchasePrice) {
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(51, 65, 85);
          doc.text("TOTAL COST VALUATION", 18 + colW * 2, currentY + 6);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(15, 23, 42);
          doc.setFontSize(10);
          doc.text(`${selectedCurrency} ${summary.totalCostValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 18 + colW * 2, currentY + 12);

          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(51, 65, 85);
          doc.text("TOTAL SALE VALUATION", 18 + colW * 3, currentY + 6);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(2, 132, 199);
          doc.setFontSize(10);
          doc.text(`${selectedCurrency} ${summary.totalSaleValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 18 + colW * 3, currentY + 12);
          currentY += 24;
        } else {
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(51, 65, 85);
          doc.text("TOTAL ESTIMATED RETAIL", 18 + colW * 2, currentY + 6);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(2, 132, 199);
          doc.setFontSize(10);
          doc.text(`${selectedCurrency} ${summary.totalSaleValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 18 + colW * 2, currentY + 12);
          currentY += 19;
        }
      }

      // Prepare Table Headers & Data based on active column switches
      const tableHeaders: string[] = [];
      if (columns.serialNo) tableHeaders.push("#");
      if (columns.name) tableHeaders.push("Product Name");
      if (columns.translatedName) tableHeaders.push("Translated / Alt");
      if (columns.code) tableHeaders.push("Barcode / SKU");
      if (columns.category) tableHeaders.push("Category");
      if (columns.brand) tableHeaders.push("Brand / Company");
      if (columns.packSize) tableHeaders.push("Pack Size");
      if (columns.purchasePrice) tableHeaders.push(`Cost (${selectedCurrency})`);
      if (columns.salePrice) tableHeaders.push(`Sale Price (${selectedCurrency})`);
      if (columns.margin) tableHeaders.push("Margin %");
      if (columns.stock) tableHeaders.push("Stock");
      if (columns.minStock) tableHeaders.push("Min Alert");
      if (columns.costValuation) tableHeaders.push(`Cost Val (${selectedCurrency})`);
      if (columns.saleValuation) tableHeaders.push(`Sale Val (${selectedCurrency})`);
      if (columns.shelfLocation) tableHeaders.push("Rack / Shelf");

      const tableRows = processedProducts.map((p, idx) => {
        const row: any[] = [];
        const cost = Number(p.purchase_price_single) || 0;
        const sale = Number(p.sale_price_single) || 0;
        const stock = Number(p.current_stock) || 0;
        const margin = cost > 0 ? (((sale - cost) / cost) * 100).toFixed(1) + "%" : "—";
        const costVal = (cost * stock).toLocaleString(undefined, { minimumFractionDigits: 2 });
        const saleVal = (sale * stock).toLocaleString(undefined, { minimumFractionDigits: 2 });

        if (columns.serialNo) row.push(idx + 1);
        if (columns.name) row.push(p.name);
        if (columns.translatedName) {
          const alt = p.translated_names?.ur || p.translated_names?.ar || Object.values(p.translated_names || {})[0] || "—";
          row.push(String(alt));
        }
        if (columns.code) row.push(p.code || "—");
        if (columns.category) row.push(getCategoryName(p));
        if (columns.brand) row.push(getBrandName(p));
        if (columns.packSize) row.push(p.pack_size ? `${p.pack_size} ${p.unit || "pcs"}` : "—");
        if (columns.purchasePrice) row.push(cost > 0 ? cost.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00");
        if (columns.salePrice) row.push(sale.toLocaleString(undefined, { minimumFractionDigits: 2 }));
        if (columns.margin) row.push(margin);
        if (columns.stock) row.push(`${stock} ${p.unit || "pcs"}`);
        if (columns.minStock) row.push(p.min_stock_level ?? 0);
        if (columns.costValuation) row.push(costVal);
        if (columns.saleValuation) row.push(saleVal);
        if (columns.shelfLocation) row.push(p.shelf_location || "—");

        return row;
      });

      // Build AutoTable
      autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY: currentY,
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59], // slate-800
          textColor: [255, 255, 255],
          fontSize: isLandscape ? 8 : 7.5,
          fontStyle: "bold",
          halign: "left",
          cellPadding: 2.5,
        },
        bodyStyles: {
          fontSize: isLandscape ? 7.5 : 7,
          textColor: [30, 41, 59],
          cellPadding: 2,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252], // slate-50
        },
        columnStyles: {
          // Right align numerical columns
          ...(columns.purchasePrice ? { [tableHeaders.indexOf(`Cost (${selectedCurrency})`)]: { halign: "right" } } : {}),
          ...(columns.salePrice ? { [tableHeaders.indexOf(`Sale Price (${selectedCurrency})`)]: { halign: "right", fontStyle: "bold" } } : {}),
          ...(columns.stock ? { [tableHeaders.indexOf("Stock")]: { halign: "center", fontStyle: "bold" } } : {}),
          ...(columns.costValuation ? { [tableHeaders.indexOf(`Cost Val (${selectedCurrency})`)]: { halign: "right" } } : {}),
          ...(columns.saleValuation ? { [tableHeaders.indexOf(`Sale Val (${selectedCurrency})`)]: { halign: "right", fontStyle: "bold" } } : {}),
        },
        margin: { left: 14, right: 14, bottom: 20 },
        didDrawPage: (data: any) => {
          // Footer page number
          const str = `Page ${doc.getNumberOfPages()} | ${shopName} - Confidential`;
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(148, 163, 184); // slate-400
          doc.text(str, pageWidth / 2, pageHeight - 8, { align: "center" });
        },
      });

      // Optional Signature Block on the last page
      if (includeSignature) {
        const finalY = (doc as any).lastAutoTable.finalY + 12;
        if (finalY < pageHeight - 25) {
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);

          doc.line(14, finalY + 10, 65, finalY + 10);
          doc.text("Prepared By (Signature)", 14, finalY + 14);

          doc.line(pageWidth - 65, finalY + 10, pageWidth - 14, finalY + 10);
          doc.text("Authorized Manager / Owner", pageWidth - 65, finalY + 14);
        }
      }

      // Save PDF
      const sanitizedTitle = reportTitle.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const filename = `${sanitizedTitle}_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(filename);

      toast.dismiss(toastId);
      toast.success(`PDF report downloaded: ${filename}`);
    } catch (err: any) {
      console.error(err);
      toast.dismiss(toastId);
      toast.error("Failed to generate PDF: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Export CSV / Excel
  const handleExportCSV = () => {
    if (processedProducts.length === 0) {
      toast.error("No products matching the selected filters to export.");
      return;
    }

    const headers = [
      "Product Name",
      "Barcode / SKU",
      "Category",
      "Brand / Company",
      `Cost Price (${selectedCurrency})`,
      `Sale Price (${selectedCurrency})`,
      "Current Stock",
      "Unit",
      "Min Stock Alert",
      `Cost Valuation (${selectedCurrency})`,
      `Estimated Sale Valuation (${selectedCurrency})`,
      "Shelf Location",
      "Pack Size"
    ];

    const rows = processedProducts.map(p => {
      const cost = Number(p.purchase_price_single) || 0;
      const sale = Number(p.sale_price_single) || 0;
      const stock = Number(p.current_stock) || 0;
      return [
        `"${(p.name || "").replace(/"/g, '""')}"`,
        `"${(p.code || "").replace(/"/g, '""')}"`,
        `"${getCategoryName(p).replace(/"/g, '""')}"`,
        `"${getBrandName(p).replace(/"/g, '""')}"`,
        cost,
        sale,
        stock,
        `"${p.unit || "pcs"}"`,
        p.min_stock_level ?? 0,
        (cost * stock).toFixed(2),
        (sale * stock).toFixed(2),
        `"${(p.shelf_location || "").replace(/"/g, '""')}"`,
        p.pack_size || 1
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `products_catalog_export_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Excel CSV export downloaded successfully!");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-800">Advanced Catalog Report & PDF Exporter</h2>
                <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                  {processedProducts.length} Items Match
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold">Customize columns, filter by brand/category, and export professional PDF or Excel sheets.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
          
          {/* Quick Presets Strip */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
              ⚡ Quick Report Templates (1-Click Presets)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: "master", label: "Master Inventory Report", desc: "Full catalog with cost & valuations" },
                { id: "pricelist", label: "Customer Rate Card", desc: "Hides cost, retail prices only" },
                { id: "lowstock", label: "Low Stock & Reorder", desc: "Items below min reorder level" },
                { id: "valuation", label: "Stock Valuation Audit", desc: "Financial summary & margins" },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id as ReportPreset)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    activePreset === preset.id
                      ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950 font-bold"
                      : "bg-white border-slate-200 hover:border-slate-350 text-slate-600"
                  }`}
                >
                  <span className="font-black text-xs block">{preset.label}</span>
                  <span className="text-[9.5px] text-slate-400 font-semibold mt-1">{preset.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Filter Bar Controls */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-700 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <Filter size={13} className="text-indigo-600" />
                Report Filters & Criteria
              </span>
              <button
                type="button"
                onClick={() => {
                  setFilterCategory("all");
                  setFilterBrand("all");
                  setFilterStockStatus("all");
                  setSearchKeyword("");
                }}
                className="text-[10px] text-indigo-600 hover:underline font-bold"
              >
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Category Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full bg-white border border-slate-200 h-9 rounded-xl px-2.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Categories ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Brand Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Brand / Company</label>
                <select
                  value={filterBrand}
                  onChange={(e) => setFilterBrand(e.target.value)}
                  className="w-full bg-white border border-slate-200 h-9 rounded-xl px-2.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Brands ({brands.length})</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock Status Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Stock Status</label>
                <select
                  value={filterStockStatus}
                  onChange={(e) => setFilterStockStatus(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 h-9 rounded-xl px-2.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Items (No Stock Filter)</option>
                  <option value="in_stock">In Stock Only (&gt; 0)</option>
                  <option value="low_stock">Low Stock Alerts Only (≤ Reorder)</option>
                  <option value="out_of_stock">Out of Stock Only (0 Qty)</option>
                </select>
              </div>

              {/* Sort Order */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Sort Order</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 h-9 rounded-xl px-2.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="name_asc">Name (A to Z)</option>
                  <option value="name_desc">Name (Z to A)</option>
                  <option value="stock_desc">Highest Stock First</option>
                  <option value="stock_asc">Lowest Stock First</option>
                  <option value="price_desc">Highest Sale Price</option>
                  <option value="cost_desc">Highest Cost Price</option>
                </select>
              </div>
            </div>
          </div>

          {/* Column Customizer Checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                📋 Select Columns to Include in PDF / Table
              </label>
              <div className="flex gap-2 text-[10px] font-bold text-indigo-600">
                <button
                  type="button"
                  onClick={() => {
                    setColumns({
                      serialNo: true,
                      name: true,
                      translatedName: true,
                      code: true,
                      category: true,
                      brand: true,
                      purchasePrice: true,
                      salePrice: true,
                      margin: true,
                      stock: true,
                      minStock: true,
                      costValuation: true,
                      saleValuation: true,
                      shelfLocation: true,
                      packSize: true,
                    });
                  }}
                  className="hover:underline"
                >
                  Select All
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    setColumns({
                      serialNo: true,
                      name: true,
                      translatedName: false,
                      code: true,
                      category: true,
                      brand: false,
                      purchasePrice: false,
                      salePrice: true,
                      margin: false,
                      stock: true,
                      minStock: false,
                      costValuation: false,
                      saleValuation: false,
                      shelfLocation: false,
                      packSize: false,
                    });
                  }}
                  className="hover:underline"
                >
                  Minimal
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
              {[
                { key: "serialNo", label: "S.No (#)" },
                { key: "name", label: "Product Name" },
                { key: "translatedName", label: "Urdu / Alt Name" },
                { key: "code", label: "Barcode / SKU" },
                { key: "category", label: "Category" },
                { key: "brand", label: "Brand / Company" },
                { key: "purchasePrice", label: "Purchase Cost" },
                { key: "salePrice", label: "Sale Price" },
                { key: "margin", label: "Profit Margin %" },
                { key: "stock", label: "Stock Quantity" },
                { key: "minStock", label: "Min Stock Alert" },
                { key: "costValuation", label: "Cost Valuation" },
                { key: "saleValuation", label: "Sale Valuation" },
                { key: "shelfLocation", label: "Shelf / Rack" },
                { key: "packSize", label: "Pack Size Info" },
              ].map(({ key, label }) => {
                const isChecked = !!columns[key as keyof typeof columns];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleColumn(key as keyof typeof columns)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      isChecked
                        ? "bg-white border-indigo-300 text-indigo-950 font-bold shadow-2xs"
                        : "bg-transparent border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                      isChecked ? "bg-indigo-600 text-white font-bold" : "border border-slate-300 bg-white"
                    }`}>
                      {isChecked ? "✓" : ""}
                    </div>
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Report Layout & Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Report Heading Title</label>
              <Input
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="h-9 text-xs border-slate-200 font-bold"
                placeholder="Report title..."
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Page Orientation</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPageOrientation("portrait")}
                  className={`h-9 rounded-xl border font-bold text-xs cursor-pointer ${
                    pageOrientation === "portrait"
                      ? "bg-indigo-50 border-indigo-500 text-indigo-900"
                      : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  📄 Portrait
                </button>
                <button
                  type="button"
                  onClick={() => setPageOrientation("landscape")}
                  className={`h-9 rounded-xl border font-bold text-xs cursor-pointer ${
                    pageOrientation === "landscape"
                      ? "bg-indigo-50 border-indigo-500 text-indigo-900"
                      : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  📜 Landscape
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={includeSummary}
                  onChange={(e) => setIncludeSummary(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Include KPI Summary</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={includeSignature}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Signature Line</span>
              </label>
            </div>
          </div>

          {/* Quick Summary Banner Preview */}
          <div className="bg-indigo-900 text-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Filtered Items Count</p>
              <p className="text-xl font-black">{summary.totalCount} Products</p>
            </div>
            <div>
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Total Stock Quantity</p>
              <p className="text-xl font-black">{summary.totalStock.toLocaleString()} Units</p>
            </div>
            {columns.purchasePrice && (
              <div>
                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Cost Valuation</p>
                <p className="text-xl font-black">Rs {summary.totalCostValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Estimated Retail Revenue</p>
              <p className="text-xl font-black text-emerald-300">Rs {summary.totalSaleValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 font-semibold">
            {processedProducts.length} items will be rendered into the final document.
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCSV}
              className="rounded-xl font-bold text-xs h-10 border-slate-200 hover:bg-slate-100 flex-1 sm:flex-none cursor-pointer"
            >
              <Download size={14} className="mr-1.5 text-emerald-600" />
              Export to Excel (CSV)
            </Button>
            <Button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isExporting || processedProducts.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-10 px-5 rounded-xl shadow-lg shadow-indigo-500/20 flex-1 sm:flex-none cursor-pointer"
            >
              <Download size={14} className="mr-1.5" />
              Download PDF Report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
