"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { 
  Barcode as BarcodeIcon, Search, Printer, Plus, Minus, 
  Loader2, Eye, Sliders, Layout, Type, HelpCircle, RefreshCw
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import JsBarcode from "jsbarcode";

type BarcodePrintItem = {
  id: string;
  name: string;
  packingName?: string;
  barcode: string;
  price: number;
  printCount: number;
};

// Real Barcode SVG Component using jsbarcode
function BarcodeSVG({ value, height = 30, fontSize = 8 }: { value: string; height?: number; fontSize?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width: 1.3,
          height: height,
          displayValue: false, // We render the number manually below to allow custom font sizes
          margin: 0,
        });
      } catch (err) {
        console.error("Barcode generation error:", err);
      }
    }
  }, [value, height]);

  return (
    <div className="flex flex-col items-center">
      <svg ref={svgRef} className="max-w-full" />
      <p style={{ fontSize: `${fontSize}px` }} className="font-mono font-bold tracking-widest mt-0.5 uppercase">{value}</p>
    </div>
  );
}

export default function BarcodePrintingPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLeftTab, setActiveLeftTab] = useState<"catalog" | "settings">("catalog");
  const [printQueue, setPrintQueue] = useState<BarcodePrintItem[]>([]);
  const [dbItems, setDbItems] = useState<BarcodePrintItem[]>([]);

  // Advanced Layout Configurations
  const [printPreset, setPrintPreset] = useState("A4_3x8");
  const [printConfig, setPrintConfig] = useState({
    pageSize: "A4",
    pageWidth: 210, // mm
    pageHeight: 297, // mm
    labelWidth: 62, // mm
    labelHeight: 32, // mm
    cols: 3,
    marginTop: 12, // mm
    marginBottom: 12, // mm
    marginLeft: 10, // mm
    marginRight: 10, // mm
    gapX: 4, // mm
    gapY: 4, // mm
    showName: true,
    showPrice: true,
    showPacking: true,
    fontSizeName: 9, // pt
    fontSizePrice: 10, // pt
    fontSizeBarcode: 8, // pt
    barcodeHeight: 30, // px
  });

  useEffect(() => {
    if (shopId) {
      fetchBarcodesCatalog();
    }
  }, [shopId]);

  const fetchBarcodesCatalog = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("product_barcodes")
        .select(`
          id, barcode, pack_type,
          products ( id, name, sale_price_single ),
          product_variants ( id, packing_name, sale_price )
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted: BarcodePrintItem[] = (data || []).map((b: any) => {
        const name = b.products?.name || "Unknown Product";
        const packingName = b.product_variants?.packing_name || undefined;
        const price = b.product_variants 
          ? Number(b.product_variants.sale_price) 
          : Number(b.products?.sale_price_single || 0);

        return {
          id: b.id,
          name,
          packingName,
          barcode: b.barcode,
          price,
          printCount: 0
        };
      });

      setDbItems(formatted);
    } catch (err: any) {
      toast.error("Failed to load barcodes: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Presets configuration applier
  const applyPreset = (presetName: string) => {
    setPrintPreset(presetName);
    if (presetName === "A4_3x8") {
      setPrintConfig({
        pageSize: "A4",
        pageWidth: 210,
        pageHeight: 297,
        labelWidth: 62,
        labelHeight: 32,
        cols: 3,
        marginTop: 12,
        marginBottom: 12,
        marginLeft: 10,
        marginRight: 10,
        gapX: 4,
        gapY: 4,
        showName: true,
        showPrice: true,
        showPacking: true,
        fontSizeName: 9,
        fontSizePrice: 10,
        fontSizeBarcode: 8,
        barcodeHeight: 30,
      });
    } else if (presetName === "A4_4x10") {
      setPrintConfig({
        pageSize: "A4",
        pageWidth: 210,
        pageHeight: 297,
        labelWidth: 48,
        labelHeight: 25,
        cols: 4,
        marginTop: 10,
        marginBottom: 10,
        marginLeft: 8,
        marginRight: 8,
        gapX: 3,
        gapY: 3,
        showName: true,
        showPrice: true,
        showPacking: true,
        fontSizeName: 8,
        fontSizePrice: 9,
        fontSizeBarcode: 7,
        barcodeHeight: 22,
      });
    } else if (presetName === "single_50x30") {
      setPrintConfig({
        pageSize: "custom",
        pageWidth: 50,
        pageHeight: 30,
        labelWidth: 48,
        labelHeight: 28,
        cols: 1,
        marginTop: 1,
        marginBottom: 1,
        marginLeft: 1,
        marginRight: 1,
        gapX: 0,
        gapY: 0,
        showName: true,
        showPrice: true,
        showPacking: true,
        fontSizeName: 8,
        fontSizePrice: 9,
        fontSizeBarcode: 7,
        barcodeHeight: 26,
      });
    } else if (presetName === "single_38x25") {
      setPrintConfig({
        pageSize: "custom",
        pageWidth: 38,
        pageHeight: 25,
        labelWidth: 36,
        labelHeight: 23,
        cols: 1,
        marginTop: 1,
        marginBottom: 1,
        marginLeft: 1,
        marginRight: 1,
        gapX: 0,
        gapY: 0,
        showName: true,
        showPrice: true,
        showPacking: true,
        fontSizeName: 7,
        fontSizePrice: 8,
        fontSizeBarcode: 6,
        barcodeHeight: 18,
      });
    } else if (presetName === "double_38x25") {
      setPrintConfig({
        pageSize: "custom",
        pageWidth: 80,
        pageHeight: 25,
        labelWidth: 38,
        labelHeight: 23,
        cols: 2,
        marginTop: 1,
        marginBottom: 1,
        marginLeft: 1,
        marginRight: 1,
        gapX: 2,
        gapY: 0,
        showName: true,
        showPrice: true,
        showPacking: true,
        fontSizeName: 7,
        fontSizePrice: 8,
        fontSizeBarcode: 6,
        barcodeHeight: 18,
      });
    }
  };

  const updatePrintCount = (index: number, change: number) => {
    const updated = [...dbItems];
    const newCount = Math.max(0, updated[index].printCount + change);
    updated[index].printCount = newCount;
    setDbItems(updated);

    const queue = updated.filter(item => item.printCount > 0);
    setPrintQueue(queue);
  };

  const clearQueue = () => {
    setDbItems(prev => prev.map(item => ({ ...item, printCount: 0 })));
    setPrintQueue([]);
  };

  const handlePrint = () => {
    if (printQueue.length === 0) {
      toast.error("Print queue is empty. Add quantities to items first!");
      return;
    }
    window.print();
  };

  const filteredItems = dbItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.barcode.includes(searchQuery)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 print:p-0 font-sans">
      
      {/* Dynamic Printing Style Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: ${printConfig.pageSize === "A4" ? "A4" : `${printConfig.pageWidth}mm ${printConfig.pageHeight}mm`};
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background: white !important;
          }
          /* Hide non-printable elements */
          header, footer, nav, aside, .print\\:hidden, div[role="dialog"], .sonner {
            display: none !important;
          }
          /* Setup main print container */
          .print-sheet-container {
            width: ${printConfig.pageWidth}mm !important;
            min-height: ${printConfig.pageHeight}mm !important;
            padding-top: ${printConfig.marginTop}mm !important;
            padding-bottom: ${printConfig.marginBottom}mm !important;
            padding-left: ${printConfig.marginLeft}mm !important;
            padding-right: ${printConfig.marginRight}mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            background: white !important;
            display: grid !important;
            grid-template-columns: repeat(${printConfig.cols}, minmax(0, 1fr)) !important;
            column-gap: ${printConfig.gapX}mm !important;
            row-gap: ${printConfig.gapY}mm !important;
            box-sizing: border-box !important;
          }
          .print-label-item {
            width: ${printConfig.labelWidth}mm !important;
            height: ${printConfig.labelHeight}mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            page-break-inside: avoid !important;
          }
        }
      `}} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Advanced Barcode Sheet Generator</h2>
          <p className="text-slate-500 mt-1">Select items, specify quantity, configure sheet label layouts, and print.</p>
        </div>
        
        <div className="flex items-center gap-3 self-start md:self-auto">
          <Button 
            variant="outline" 
            onClick={clearQueue} 
            disabled={printQueue.length === 0}
            className="text-slate-500"
          >
            Clear Sheet
          </Button>
          <Button 
            onClick={handlePrint} 
            disabled={printQueue.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
          >
            <Printer className="mr-2 h-4 w-4" /> Print Labels
          </Button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 print:block">
        
        {/* Left Side: Tabs Catalog vs Layout Config */}
        <div className="xl:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-16rem)] overflow-hidden print:hidden">
          
          {/* Tab buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4 shrink-0">
            <button
              onClick={() => setActiveLeftTab("catalog")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeLeftTab === "catalog"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layout size={14} /> Catalog ({printQueue.reduce((acc, c) => acc + c.printCount, 0)})
            </button>
            <button
              onClick={() => setActiveLeftTab("settings")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeLeftTab === "settings"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Sliders size={14} /> Label Customizer
            </button>
          </div>

          {/* Tab Content 1: Catalog */}
          {activeLeftTab === "catalog" ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="relative mb-4 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search by product or barcode..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-50 border-slate-200"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {loading ? (
                  <div className="flex justify-center items-center py-10 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading catalog...</span>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    No barcodes registered. Please link barcodes in variations first.
                  </div>
                ) : (
                  filteredItems.map((item, idx) => {
                    const catalogIdx = dbItems.findIndex(dbItem => dbItem.id === item.id);
                    return (
                      <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center hover:bg-blue-50/20 transition-colors">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-slate-800 text-sm truncate">{item.name}</h4>
                          {item.packingName && (
                            <p className="text-[10px] text-blue-600 font-bold uppercase mt-0.5">{item.packingName}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-1 font-mono">{item.barcode} • Rs {item.price}</p>
                        </div>

                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm shrink-0">
                          <button 
                            onClick={() => updatePrintCount(catalogIdx, -1)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center text-xs font-black text-slate-800">
                            {item.printCount}
                          </span>
                          <button 
                            onClick={() => updatePrintCount(catalogIdx, 1)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Tab Content 2: Settings Controls */
            <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar text-slate-700 text-xs font-medium">
              
              {/* Presets Row */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Size Preset (پرنٹر پری سیٹ)</label>
                <select
                  value={printPreset}
                  onChange={(e) => applyPreset(e.target.value)}
                  className="w-full bg-white border border-slate-200 h-9 rounded-lg px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                >
                  <option value="A4_3x8">A4 Sheet - 3 Columns x 8 Rows (Standard)</option>
                  <option value="A4_4x10">A4 Sheet - 4 Columns x 10 Rows (Compact)</option>
                  <option value="single_50x30">Thermal Sticker - 50mm x 30mm (Single)</option>
                  <option value="single_38x25">Thermal Sticker - 38mm x 25mm (Single)</option>
                  <option value="double_38x25">Thermal Sticker - Double Column (80mm width)</option>
                  <option value="custom">Custom Size (خود ترتیب دیں)</option>
                </select>
              </div>

              {/* Dimensions: Width, Height, Columns */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Page / Sheet Layout (mm)</h4>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Page Width</label>
                    <Input 
                      type="number" 
                      value={printConfig.pageWidth} 
                      disabled={printPreset !== "custom"}
                      onChange={(e) => setPrintConfig({ ...printConfig, pageWidth: Number(e.target.value) || 210 })}
                      className="h-8 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Page Height</label>
                    <Input 
                      type="number" 
                      value={printConfig.pageHeight} 
                      disabled={printPreset !== "custom"}
                      onChange={(e) => setPrintConfig({ ...printConfig, pageHeight: Number(e.target.value) || 297 })}
                      className="h-8 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Columns</label>
                    <Input 
                      type="number" 
                      value={printConfig.cols} 
                      disabled={printPreset !== "custom"}
                      onChange={(e) => setPrintConfig({ ...printConfig, cols: Number(e.target.value) || 3 })}
                      className="h-8 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Sticker details */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sticker Dimensions (mm)</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Sticker Width</label>
                    <Input 
                      type="number" 
                      value={printConfig.labelWidth} 
                      disabled={printPreset !== "custom"}
                      onChange={(e) => setPrintConfig({ ...printConfig, labelWidth: Number(e.target.value) || 62 })}
                      className="h-8 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Sticker Height</label>
                    <Input 
                      type="number" 
                      value={printConfig.labelHeight} 
                      disabled={printPreset !== "custom"}
                      onChange={(e) => setPrintConfig({ ...printConfig, labelHeight: Number(e.target.value) || 32 })}
                      className="h-8 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Margins */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Page Margins (mm)</h4>
                
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-400 block mb-0.5">Top</label>
                    <Input 
                      type="number" 
                      value={printConfig.marginTop} 
                      disabled={printPreset !== "custom"}
                      onChange={(e) => setPrintConfig({ ...printConfig, marginTop: Number(e.target.value) || 0 })}
                      className="h-8 text-xs px-1 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 block mb-0.5">Bottom</label>
                    <Input 
                      type="number" 
                      value={printConfig.marginBottom} 
                      disabled={printPreset !== "custom"}
                      onChange={(e) => setPrintConfig({ ...printConfig, marginBottom: Number(e.target.value) || 0 })}
                      className="h-8 text-xs px-1 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 block mb-0.5">Left</label>
                    <Input 
                      type="number" 
                      value={printConfig.marginLeft} 
                      disabled={printPreset !== "custom"}
                      onChange={(e) => setPrintConfig({ ...printConfig, marginLeft: Number(e.target.value) || 0 })}
                      className="h-8 text-xs px-1 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-400 block mb-0.5">Right</label>
                    <Input 
                      type="number" 
                      value={printConfig.marginRight} 
                      disabled={printPreset !== "custom"}
                      onChange={(e) => setPrintConfig({ ...printConfig, marginRight: Number(e.target.value) || 0 })}
                      className="h-8 text-xs px-1 font-bold text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Gaps */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Spacing / Gap between Stickers (mm)</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Horizontal Gap</label>
                    <Input 
                      type="number" 
                      value={printConfig.gapX} 
                      disabled={printPreset !== "custom"}
                      onChange={(e) => setPrintConfig({ ...printConfig, gapX: Number(e.target.value) || 0 })}
                      className="h-8 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Vertical Gap</label>
                    <Input 
                      type="number" 
                      value={printConfig.gapY} 
                      disabled={printPreset !== "custom"}
                      onChange={(e) => setPrintConfig({ ...printConfig, gapY: Number(e.target.value) || 0 })}
                      className="h-8 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Contents & Visibility */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Type size={12} /> Sticker Content Details</h4>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Show Product Name</span>
                    <input 
                      type="checkbox" 
                      checked={printConfig.showName} 
                      onChange={(e) => setPrintConfig({ ...printConfig, showName: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Show Price (Rs)</span>
                    <input 
                      type="checkbox" 
                      checked={printConfig.showPrice} 
                      onChange={(e) => setPrintConfig({ ...printConfig, showPrice: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Show Packing Type</span>
                    <input 
                      type="checkbox" 
                      checked={printConfig.showPacking} 
                      onChange={(e) => setPrintConfig({ ...printConfig, showPacking: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                  </div>
                </div>

                {/* Font Sizes & Barcode Height */}
                <div className="space-y-3 border-t border-slate-50 pt-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Product Name Font Size ({printConfig.fontSizeName}pt)</label>
                    <input 
                      type="range" min="6" max="14" 
                      value={printConfig.fontSizeName}
                      onChange={(e) => setPrintConfig({ ...printConfig, fontSizeName: Number(e.target.value) })}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Price Font Size ({printConfig.fontSizePrice}pt)</label>
                    <input 
                      type="range" min="7" max="16" 
                      value={printConfig.fontSizePrice}
                      onChange={(e) => setPrintConfig({ ...printConfig, fontSizePrice: Number(e.target.value) })}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Barcode Height ({printConfig.barcodeHeight}px)</label>
                    <input 
                      type="range" min="15" max="60" 
                      value={printConfig.barcodeHeight}
                      onChange={(e) => setPrintConfig({ ...printConfig, barcodeHeight: Number(e.target.value) })}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Right Side: Sticker Sheet Live Preview */}
        <div className="xl:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 flex flex-col h-[calc(100vh-16rem)] overflow-hidden">
          
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3 print:hidden shrink-0">
            <Eye size={18} className="text-blue-600" />
            <h3 className="font-bold text-slate-800">Print Sticker Preview</h3>
            <span className="text-xs text-slate-400 font-medium ml-auto">
              Page: {printConfig.pageWidth}x{printConfig.pageHeight}mm ({printPreset.replace("_", " ")})
            </span>
          </div>

          {/* Printable Labels Grid */}
          <div className="flex-1 bg-slate-100 p-4 md:p-6 rounded-xl overflow-auto flex items-start justify-center print:bg-white print:p-0">
            {printQueue.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-sm print:hidden my-auto">
                <BarcodeIcon size={48} className="mx-auto text-slate-300 mb-2 animate-pulse" />
                <p className="font-semibold">Your sticker sheet is empty.</p>
                <p className="text-xs text-slate-400 mt-1">Select items in the catalog tab and set sticker count to preview.</p>
              </div>
            ) : (
              /* A scaled container that matches printed page dimensions */
              <div 
                className="bg-white shadow-lg print:shadow-none print:p-0 font-sans text-slate-800 print-sheet-container"
                style={{
                  width: `${printConfig.pageWidth}mm`,
                  minHeight: `${printConfig.pageHeight}mm`,
                  paddingTop: `${printConfig.marginTop}mm`,
                  paddingBottom: `${printConfig.marginBottom}mm`,
                  paddingLeft: `${printConfig.marginLeft}mm`,
                  paddingRight: `${printConfig.marginRight}mm`,
                  display: "grid",
                  gridTemplateColumns: `repeat(${printConfig.cols}, minmax(0, 1fr))`,
                  columnGap: `${printConfig.gapX}mm`,
                  rowGap: `${printConfig.gapY}mm`,
                  alignContent: "start",
                  boxSizing: "border-box",
                }}
              >
                {printQueue.flatMap(item => 
                  Array.from({ length: item.printCount }).map((_, i) => (
                    <div 
                      key={`${item.id}-${i}`}
                      className="border border-zinc-200 print:border-zinc-400 rounded text-center flex flex-col justify-between p-1 bg-white print-label-item select-none relative overflow-hidden"
                      style={{ 
                        width: `${printConfig.labelWidth}mm`,
                        height: `${printConfig.labelHeight}mm`,
                        boxSizing: "border-box",
                      }}
                    >
                      {/* Product details */}
                      <div className="space-y-0.5 overflow-hidden">
                        {printConfig.showName && (
                          <p 
                            style={{ fontSize: `${printConfig.fontSizeName}pt` }} 
                            className="font-black uppercase tracking-tight truncate leading-tight"
                          >
                            {item.name}
                          </p>
                        )}
                        {printConfig.showPacking && item.packingName && (
                          <p className="text-[6.5pt] text-blue-600 uppercase font-black tracking-wider leading-none">
                            {item.packingName}
                          </p>
                        )}
                      </div>
                      
                      {/* Real Vector Barcode renderer using jsbarcode */}
                      <div className="my-0.5 flex flex-col items-center justify-center">
                        <BarcodeSVG 
                          value={item.barcode} 
                          height={printConfig.barcodeHeight} 
                          fontSize={printConfig.fontSizeBarcode} 
                        />
                      </div>

                      {/* Price */}
                      {printConfig.showPrice && (
                        <p 
                          style={{ fontSize: `${printConfig.fontSizePrice}pt` }} 
                          className="font-black text-slate-900 leading-none"
                        >
                          Rs {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

      </div>
      
    </div>
  );
}
