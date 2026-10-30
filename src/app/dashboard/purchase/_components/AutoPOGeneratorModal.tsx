"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, X, Check, ShoppingCart, MessageSquare, AlertTriangle,
  RefreshCw, PackageCheck, Truck, ArrowRight, Loader2, Download,
  Filter, Building2, TrendingUp, Boxes, Calendar, FileText, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { DBProduct, Supplier, CartItem } from "./types";

interface AutoPOGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: DBProduct[];
  suppliers: Supplier[];
  shopId?: string;
  shopName: string;
  onLoadCart: (items: CartItem[], supplierId?: string) => void;
}

type SupplierMemory = {
  supplierId: string;
  supplierName: string;
  supplierPhone: string | null;
  lastPurchasePrice: number;
  lastPurchaseDate: string | null;
};

type SalesVelocity = {
  totalSold30d: number;
  dailyAvg: number;
};

export function AutoPOGeneratorModal({
  isOpen,
  onClose,
  products,
  suppliers,
  shopId,
  shopName,
  onLoadCart,
}: AutoPOGeneratorModalProps) {
  const supabase = createClient();

  const [loadingData, setLoadingData] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("all");
  const [targetDays, setTargetDays] = useState<number>(15); // 7, 15, or 30 days buffer
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Mappings
  const [supplierMemoryMap, setSupplierMemoryMap] = useState<Record<string, SupplierMemory>>({});
  const [salesVelocityMap, setSalesVelocityMap] = useState<Record<string, SalesVelocity>>({});

  useEffect(() => {
    if (isOpen && shopId) {
      fetchHistoricalData();
    }
  }, [isOpen, shopId]);

  const fetchHistoricalData = async () => {
    if (!shopId) return;
    setLoadingData(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysIso = thirtyDaysAgo.toISOString();

      // 1. Fetch past purchase order items joined with purchase orders & parties
      const [poRes, salesRes] = await Promise.all([
        supabase
          .from("purchase_order_items")
          .select(`
            product_id,
            unit_price,
            purchase_price,
            created_at,
            purchase_orders!inner (
              id,
              supplier_id,
              created_at,
              shop_id,
              parties (
                id,
                name,
                phone,
                address
              )
            )
          `)
          .eq("purchase_orders.shop_id", shopId)
          .order("created_at", { ascending: false })
          .limit(1000),

        // 2. Fetch sales velocity for past 30 days
        supabase
          .from("invoice_items")
          .select(`
            product_id,
            quantity,
            invoices!inner (
              id,
              shop_id,
              created_at,
              is_voided
            )
          `)
          .eq("invoices.shop_id", shopId)
          .eq("invoices.is_voided", false)
          .gte("invoices.created_at", thirtyDaysIso)
      ]);

      // Process Supplier Memory (most recent purchase per product)
      const supMem: Record<string, SupplierMemory> = {};
      if (poRes.data) {
        poRes.data.forEach((row: any) => {
          const pId = row.product_id;
          if (!pId) return;
          // Keep only the most recent purchase
          if (!supMem[pId]) {
            const po = row.purchase_orders;
            const party = po?.parties;
            supMem[pId] = {
              supplierId: po?.supplier_id || "unassigned",
              supplierName: party?.name || "Cash / Direct Supplier",
              supplierPhone: party?.phone || null,
              lastPurchasePrice: Number(row.purchase_price || row.unit_price || 0),
              lastPurchaseDate: row.created_at || po?.created_at || null,
            };
          }
        });
      }
      setSupplierMemoryMap(supMem);

      // Process Sales Velocity (sum of quantities over 30 days)
      const salesMap: Record<string, SalesVelocity> = {};
      if (salesRes.data) {
        salesRes.data.forEach((row: any) => {
          const pId = row.product_id;
          if (!pId) return;
          const qty = Number(row.quantity) || 0;
          if (!salesMap[pId]) {
            salesMap[pId] = { totalSold30d: 0, dailyAvg: 0 };
          }
          salesMap[pId].totalSold30d += qty;
        });
        // Calculate daily averages
        Object.keys(salesMap).forEach((pId) => {
          salesMap[pId].dailyAvg = Math.round((salesMap[pId].totalSold30d / 30) * 10) / 10;
        });
      }
      setSalesVelocityMap(salesMap);
    } catch (err) {
      console.warn("Historical purchase/sales load error:", err);
    } finally {
      setLoadingData(false);
    }
  };

  // Identify low-stock products (current_stock <= min_stock or <= 5)
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => {
      const minStock = p.min_stock !== undefined && p.min_stock !== null ? p.min_stock : 5;
      return (p.current_stock || 0) <= minStock;
    });
  }, [products]);

  // Calculate reorder quantity for a product
  const getCalculatedQty = (p: DBProduct) => {
    if (customQuantities[p.id] !== undefined) {
      return customQuantities[p.id];
    }
    const vel = salesVelocityMap[p.id];
    const minStock = p.min_stock || 5;
    const currentStock = p.current_stock || 0;

    let baseRecommended = 0;
    if (vel && vel.dailyAvg > 0) {
      // Sales velocity based demand: (dailyAvg * targetDays) - currentStock
      const targetDemand = Math.ceil(vel.dailyAvg * targetDays);
      baseRecommended = Math.max(targetDemand - currentStock, 1);
    } else {
      // Threshold fallback: (minStock * 2) - currentStock
      baseRecommended = Math.max((minStock * 2) - currentStock, 5);
    }

    // If pack size exists, round up to full packs for pharmacy convenience
    const pSize = p.pack_size || 1;
    if (pSize > 1) {
      const neededPacks = Math.max(Math.ceil(baseRecommended / pSize), 1);
      return neededPacks * pSize;
    }

    return Math.max(baseRecommended, 1);
  };

  // Group low stock products by supplier
  const supplierGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        supplierId: string;
        supplierName: string;
        supplierPhone: string | null;
        products: DBProduct[];
        totalEstCost: number;
      }
    > = {};

    lowStockProducts.forEach((prod) => {
      // Priority: 1. supplierMemoryMap, 2. prod.supplier_id, 3. "unassigned"
      const mem = supplierMemoryMap[prod.id];
      const supObj = suppliers.find((s) => s.id === (mem?.supplierId || prod.supplier_id));

      const supId = supObj?.id || mem?.supplierId || prod.supplier_id || "unassigned";
      const supName = supObj?.name || mem?.supplierName || "General / Wholesaler";
      const supPhone = supObj?.phone || mem?.supplierPhone || null;

      if (!groups[supId]) {
        groups[supId] = {
          supplierId: supId,
          supplierName: supName,
          supplierPhone: supPhone,
          products: [],
          totalEstCost: 0,
        };
      }

      groups[supId].products.push(prod);

      const qty = getCalculatedQty(prod);
      const rate = mem?.lastPurchasePrice || prod.purchase_price_single || 0;
      groups[supId].totalEstCost += qty * rate;
    });

    return groups;
  }, [lowStockProducts, supplierMemoryMap, suppliers, salesVelocityMap, customQuantities, targetDays]);

  // Filtered list based on selected supplier tab
  const displayedProducts = useMemo(() => {
    if (selectedSupplierId === "all") {
      return lowStockProducts;
    }
    const grp = supplierGroups[selectedSupplierId];
    return grp ? grp.products : [];
  }, [selectedSupplierId, lowStockProducts, supplierGroups]);

  // Format Pack & Piece breakdown helper
  const formatPackQty = (qty: number, packSize?: number | null, unit?: string | null) => {
    const size = Number(packSize) || 1;
    const baseUnit = unit || "Pcs";
    if (size > 1) {
      const packs = Math.floor(qty / size);
      const loose = qty % size;
      if (packs > 0 && loose > 0) return `${packs} Pack (${packs * size}) + ${loose} ${baseUnit}`;
      if (packs > 0) return `${packs} Pack${packs > 1 ? "s" : ""} (${qty} ${baseUnit})`;
      return `${loose} ${baseUnit}`;
    }
    return `${qty} ${baseUnit}`;
  };

  // 1-Click WhatsApp PO Text Message
  const handleSendWhatsAppPO = (supplierId?: string) => {
    let targetProds: DBProduct[] = [];
    let targetSupName = "All Suppliers";
    let phone = "";

    if (supplierId && supplierId !== "all" && supplierGroups[supplierId]) {
      const grp = supplierGroups[supplierId];
      targetProds = grp.products;
      targetSupName = grp.supplierName;
      phone = grp.supplierPhone ? grp.supplierPhone.replace(/[^0-9]/g, "") : "";
    } else {
      targetProds = lowStockProducts;
    }

    if (targetProds.length === 0) {
      toast.error("No items to order.");
      return;
    }

    let text = `📦 *PURCHASE DEMAND & ORDER SHEET*\n`;
    text += `*Pharmacy:* ${shopName}\n`;
    text += `*Distributor:* ${targetSupName}\n`;
    text += `*Date:* ${new Date().toLocaleDateString()}\n`;
    text += `*Buffer Target:* ${targetDays} Days Demand\n`;
    text += `────────────────────\n`;
    text += `*REQUIRED REORDER ITEMS:*\n\n`;

    let totalEst = 0;
    targetProds.forEach((p, idx) => {
      const qty = getCalculatedQty(p);
      const packStr = formatPackQty(qty, p.pack_size, p.unit);
      const mem = supplierMemoryMap[p.id];
      const rate = mem?.lastPurchasePrice || p.purchase_price_single || 0;
      totalEst += qty * rate;

      text += `${idx + 1}. *${p.name}*\n`;
      text += `   • Order Qty: *${packStr}*\n`;
      text += `   • Current Stock: ${p.current_stock || 0} ${p.unit || "Pcs"}\n`;
      if (rate > 0) text += `   • Last TP: Rs ${rate.toLocaleString()}\n`;
      text += `\n`;
    });

    text += `────────────────────\n`;
    text += `*Total Items:* ${targetProds.length}\n`;
    if (totalEst > 0) text += `*Est. Amount:* Rs ${Math.round(totalEst).toLocaleString()}\n`;
    text += `\nPlease confirm availability, invoice rate, and dispatch time. Thank you!`;

    const encodedText = encodeURIComponent(text);
    const whatsappUrl = phone
      ? `https://wa.me/${phone}?text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    window.open(whatsappUrl, "_blank");
    toast.success("WhatsApp Purchase Order message opened!");
  };

  // 1-Click Distributor Order PDF Download (using jsPDF & autoTable)
  const handleDownloadDistributorPDF = async (supplierId?: string) => {
    setIsGeneratingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      let targetProds: DBProduct[] = [];
      let targetSupName = "All Suppliers";
      let targetSupPhone = "";

      if (supplierId && supplierId !== "all" && supplierGroups[supplierId]) {
        const grp = supplierGroups[supplierId];
        targetProds = grp.products;
        targetSupName = grp.supplierName;
        targetSupPhone = grp.supplierPhone || "";
      } else {
        targetProds = lowStockProducts;
      }

      if (targetProds.length === 0) {
        toast.error("No items to generate PDF.");
        return;
      }

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Header Banner
      doc.setFillColor(15, 23, 42); // Slate 900
      doc.rect(0, 0, 210, 32, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(shopName?.toUpperCase() || "THE ACCOUNTS PHARMACY", 14, 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text("PURCHASE ORDER & DISTRIBUTOR DEMAND SHEET", 14, 21);
      doc.text(`Generated: ${new Date().toLocaleString()} · Target: ${targetDays} Days Demand`, 14, 27);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(129, 140, 248); // Indigo 400
      doc.text("PO DEMAND SLIP", 160, 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text(`Ref: PO-DEM-${Date.now().toString().slice(-6)}`, 160, 22);

      // Target Supplier Info Card
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 38, 182, 20, 3, 3, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text("DISTRIBUTOR / SUPPLIER:", 18, 45);

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(targetSupName, 18, 52);

      if (targetSupPhone) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Contact / Booker: ${targetSupPhone}`, 120, 50);
      }

      // Table of Items
      let grandTotalEst = 0;
      const tableRows = targetProds.map((p, index) => {
        const qty = getCalculatedQty(p);
        const mem = supplierMemoryMap[p.id];
        const vel = salesVelocityMap[p.id];
        const rate = mem?.lastPurchasePrice || p.purchase_price_single || 0;
        const subtotal = qty * rate;
        grandTotalEst += subtotal;

        const packInfo = p.pack_size && p.pack_size > 1 ? `Pack (${p.pack_size}s)` : p.unit || "Pcs";
        const packBreakdown = formatPackQty(qty, p.pack_size, p.unit);
        const salesVelText = vel && vel.totalSold30d > 0 ? `${vel.totalSold30d} sold / 30d` : "-";

        return [
          index + 1,
          p.name,
          packInfo,
          `${p.current_stock || 0} ${p.unit || "Pcs"}`,
          salesVelText,
          packBreakdown,
          rate > 0 ? `Rs ${rate.toLocaleString()}` : "-",
          subtotal > 0 ? `Rs ${Math.round(subtotal).toLocaleString()}` : "-",
        ];
      });

      autoTable(doc, {
        head: [
          [
            "#",
            "Medicine / Item Description",
            "Packing",
            "Current Stock",
            "30d Sales",
            "Order Qty (Required)",
            "Last TP Rate",
            "Est. Amount",
          ],
        ],
        body: tableRows,
        startY: 63,
        theme: "striped",
        headStyles: {
          fillColor: [79, 70, 229], // Indigo 600
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          halign: "left",
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59],
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 50, fontStyle: "bold" },
          2: { cellWidth: 20 },
          3: { cellWidth: 22, halign: "center", textColor: [220, 38, 38] },
          4: { cellWidth: 22, halign: "center", textColor: [100, 116, 139] },
          5: { cellWidth: 32, fontStyle: "bold", textColor: [79, 70, 229] },
          6: { cellWidth: 20, halign: "right" },
          7: { cellWidth: 20, halign: "right", fontStyle: "bold" },
        },
        margin: { left: 14, right: 14 },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 8;

      // Summary Card
      if (finalY < 250) {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(120, finalY, 76, 22, 2, 2, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Total Order Items: ${targetProds.length}`, 124, finalY + 7);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`Est. Total Value: Rs ${Math.round(grandTotalEst).toLocaleString()}`, 124, finalY + 16);

        // Signatures
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("Authorized Pharmacist Signature: _______________________", 14, finalY + 16);
      }

      // Footer
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Generated by The Accounts Pharmacy ERP & Intelligent Demand Forecast Engine", 14, 287);

      const safeFileName = targetSupName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      doc.save(`order_demand_${safeFileName}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Distributor Order PDF downloaded successfully!");
    } catch (err: any) {
      toast.error("PDF generation failed: " + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Convert low stock products to Cart items for 1-click loading into Purchase Checkout
  const handleLoadIntoCart = (prods: DBProduct[], supplierId?: string) => {
    const cartItems: CartItem[] = prods.map((p) => {
      const qty = getCalculatedQty(p);
      const mem = supplierMemoryMap[p.id];
      const purchasePrice = mem?.lastPurchasePrice || p.purchase_price_single || 0;

      return {
        productId: p.id,
        name: p.name,
        stock: p.current_stock || 0,
        quantity: qty,
        salePrice: p.sale_price_single || 0,
        purchasePrice: purchasePrice,
      };
    });

    const targetSupId = supplierId && supplierId !== "all" && supplierId !== "unassigned" ? supplierId : undefined;
    onLoadCart(cartItems, targetSupId);
    toast.success(`Loaded ${cartItems.length} items into Purchase Checkout!`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto"
        >
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white flex justify-between items-start shrink-0">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-[11px] uppercase tracking-widest bg-indigo-950/80 border border-indigo-800/60 px-2.5 py-0.5 rounded-md inline-flex mb-1.5">
                <Sparkles size={13} /> Pharmacy Short-Book & AI Demand Engine
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Intelligent Purchase Order & Short-Book
              </h2>
              <p className="text-slate-300 text-xs mt-1">
                Historical supplier rates, 30-day sales velocity forecast, and 1-Click Distributor PDF / WhatsApp.
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Controls & Distributor Tabs */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Distributor Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar max-w-full pb-1">
              <button
                onClick={() => setSelectedSupplierId("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedSupplierId === "all"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                All Low Stock ({lowStockProducts.length})
              </button>

              {Object.entries(supplierGroups).map(([supId, grp]) => (
                <button
                  key={supId}
                  onClick={() => setSelectedSupplierId(supId)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    selectedSupplierId === supId
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <Building2 size={12} className="text-indigo-400" />
                  {grp.supplierName} ({grp.products.length})
                </button>
              ))}
            </div>

            {/* Target Demand Days Selector */}
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-bold flex items-center gap-1">
                <Calendar size={12} /> Forecast Buffer:
              </span>
              {[7, 15, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setTargetDays(days)}
                  className={`px-2 py-0.5 rounded-lg font-black text-[11px] transition-all cursor-pointer ${
                    targetDays === days
                      ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50 custom-scrollbar">
            {loadingData ? (
              <div className="text-center py-16 text-slate-400">
                <Loader2 className="mx-auto h-9 w-9 text-indigo-600 animate-spin mb-3" />
                <p className="text-sm font-bold text-slate-700">Analyzing past purchases and 30-day sales velocity...</p>
                <p className="text-xs text-slate-400 mt-1">Matching suppliers, trade prices (TP), and calculating optimal box reorders.</p>
              </div>
            ) : lowStockProducts.length === 0 ? (
              <div className="text-center p-12 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <PackageCheck size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-800">Inventory Stock Level Healthy!</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  All medicines currently have sufficient stock above minimum threshold levels. No urgent distributor purchase orders required right now.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Group Banner & Quick 1-Click Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">
                        {selectedSupplierId === "all"
                          ? `All Low Stock Items (${lowStockProducts.length})`
                          : `${supplierGroups[selectedSupplierId]?.supplierName} (${displayedProducts.length} Items)`}
                      </span>
                      {selectedSupplierId !== "all" && supplierGroups[selectedSupplierId]?.supplierPhone && (
                        <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                          📞 {supplierGroups[selectedSupplierId].supplierPhone}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      Calculated using 30-day sales burn rate for {targetDays} days stock buffer.
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* 1-Click PDF Download */}
                    <Button
                      onClick={() => handleDownloadDistributorPDF(selectedSupplierId)}
                      disabled={isGeneratingPdf}
                      size="sm"
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                      {isGeneratingPdf ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Download size={13} className="mr-1.5" />}
                      Download Order PDF
                    </Button>

                    {/* 1-Click WhatsApp Order */}
                    <Button
                      onClick={() => handleSendWhatsAppPO(selectedSupplierId)}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                      <MessageSquare size={13} className="mr-1.5" /> WhatsApp Order
                    </Button>

                    {/* 1-Click Load into Cart */}
                    <Button
                      onClick={() => handleLoadIntoCart(displayedProducts, selectedSupplierId)}
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                      <ShoppingCart size={13} className="mr-1.5" /> Load to Cart
                    </Button>
                  </div>
                </div>

                {/* Table of Reorder Items */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-100/80 text-[11px] font-black uppercase text-slate-700 border-b border-slate-200">
                          <th className="p-3.5">Medicine / Item</th>
                          <th className="p-3.5">Linked Distributor</th>
                          <th className="p-3.5">Current Stock</th>
                          <th className="p-3.5">30d Velocity</th>
                          <th className="p-3.5">Suggested Reorder Qty</th>
                          <th className="p-3.5">Last TP Rate</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                        {displayedProducts.map((p) => {
                          const mem = supplierMemoryMap[p.id];
                          const vel = salesVelocityMap[p.id];
                          const calculatedQty = getCalculatedQty(p);
                          const rate = mem?.lastPurchasePrice || p.purchase_price_single || 0;
                          const packStr = formatPackQty(calculatedQty, p.pack_size, p.unit);

                          return (
                            <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                              {/* Medicine Name */}
                              <td className="p-3.5 font-bold text-slate-900">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                                  <div>
                                    <p className="font-extrabold text-slate-900">{p.name}</p>
                                    {p.pack_size && p.pack_size > 1 && (
                                      <p className="text-[10px] text-slate-400">
                                        Packing: {p.pack_size} {p.unit || "pcs"}/pack
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Linked Distributor */}
                              <td className="p-3.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                  <Building2 size={11} className="text-slate-500" />
                                  {mem?.supplierName || "General Wholesaler"}
                                </span>
                              </td>

                              {/* Current Stock */}
                              <td className="p-3.5">
                                <span className="text-rose-600 font-extrabold font-mono text-xs">
                                  {p.current_stock || 0} {p.unit || "Pcs"}
                                </span>
                              </td>

                              {/* 30d Sales Velocity */}
                              <td className="p-3.5">
                                {vel && vel.totalSold30d > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[10.5px] font-extrabold">
                                    <TrendingUp size={11} /> {vel.totalSold30d} sold ({vel.dailyAvg}/day)
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[11px] italic">Low Sales History</span>
                                )}
                              </td>

                              {/* Suggested Reorder Qty (Editable) */}
                              <td className="p-3.5">
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min={1}
                                    value={calculatedQty}
                                    onChange={(e) => {
                                      const val = Math.max(Number(e.target.value) || 1, 1);
                                      setCustomQuantities((prev) => ({ ...prev, [p.id]: val }));
                                    }}
                                    className="w-20 h-7 text-xs font-black font-mono text-indigo-700 bg-indigo-50/50 border-indigo-200 text-center"
                                  />
                                  <span className="text-[11px] font-extrabold text-indigo-900 bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                                    {packStr}
                                  </span>
                                </div>
                              </td>

                              {/* Last TP Rate */}
                              <td className="p-3.5 font-mono font-bold text-slate-700">
                                {rate > 0 ? `Rs ${rate.toLocaleString()}` : "-"}
                              </td>

                              {/* Actions */}
                              <td className="p-3.5 text-right">
                                <Button
                                  onClick={() => handleLoadIntoCart([p], mem?.supplierId)}
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs font-bold rounded-lg cursor-pointer hover:bg-indigo-50 border-indigo-200 text-indigo-700"
                                >
                                  + Order This
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info size={14} className="text-indigo-600" />
              <span>Smart Demand forecasts are updated live based on your billing history.</span>
            </div>

            <Button
              onClick={onClose}
              variant="outline"
              className="text-xs font-bold rounded-xl px-6 cursor-pointer"
            >
              Close Studio
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
