"use client";

import React, { useState, useEffect } from "react";
import { 
  Plus, X, Package, DollarSign, Tag, Layers, 
  Loader2, MapPin, Calendar, Pill, ShieldAlert, Sparkles 
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Category, DBProduct } from "../types";

interface QuickAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  categories: Category[];
  initialName?: string;
  isPharmacy?: boolean;
  onProductCreated: (newProduct: DBProduct, addToCart?: boolean) => void;
}

export const QuickAddProductModal: React.FC<QuickAddProductModalProps> = ({
  isOpen,
  onClose,
  shopId,
  categories,
  initialName = "",
  isPharmacy = false,
  onProductCreated,
}) => {
  const supabase = createClient();

  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState(isPharmacy ? "Box" : "Pcs");
  const [packSize, setPackSize] = useState("1");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [initialStock, setInitialStock] = useState("10");
  const [minStockLevel, setMinStockLevel] = useState("5");
  const [shelfLocation, setShelfLocation] = useState("");
  const [genericFormula, setGenericFormula] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      let defaultCat = "";
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(`last_selected_category_${shopId}`) || localStorage.getItem("last_selected_category");
          if (saved && categories.some(c => c.id === saved)) {
            defaultCat = saved;
          }
        } catch (e) {}
      }
      if (!defaultCat && categories.length > 0) {
        defaultCat = categories[0].id;
      }

      setName(initialName || "");
      setBarcode("");
      setCategoryId(defaultCat);
      setUnit(isPharmacy ? "Box" : "Pcs");
      setPackSize("1");
      setPurchasePrice("");
      setSalePrice("");
      setInitialStock("10");
      setMinStockLevel("5");
      setShelfLocation("");
      setGenericFormula("");
      setBatchNumber("");
      setExpiryDate("");
    }
  }, [isOpen, initialName, categories, isPharmacy, shopId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter product name");
      return;
    }
    if (!salePrice || Number(salePrice) < 0) {
      toast.error("Please enter a valid sale price");
      return;
    }

    setIsSubmitting(true);
    try {
      const pPrice = Number(purchasePrice) || 0;
      const sPrice = Number(salePrice) || 0;
      const stock = Number(initialStock) || 0;
      const pSize = Number(packSize) || 1;
      const minStock = Number(minStockLevel) || 5;
      const effectiveBatchNumber = batchNumber.trim() || (isPharmacy ? "BATCH-01" : "");

      const productPayload: any = {
        shop_id: shopId,
        name: name.trim(),
        code: barcode.trim() || null,
        barcode: barcode.trim() || null,
        category_id: categoryId || null,
        unit: unit.trim() || (isPharmacy ? "Box" : "Pcs"),
        pack_size: pSize,
        purchase_price_single: pPrice,
        sale_price_single: sPrice,
        base_price: sPrice,
        current_stock: stock,
        min_stock_level: minStock,
        shelf_location: shelfLocation.trim() || null,
        note: genericFormula.trim() ? `[FORMULA: ${genericFormula.trim()}]` : null,
      };

      const { data: createdProduct, error: prodErr } = await supabase
        .from("products")
        .insert(productPayload)
        .select()
        .single();

      if (prodErr) throw prodErr;

      let createdBarcodes: any[] = [];
      let createdVariants: any[] = [];

      // If barcode provided, also register in product_barcodes
      if (barcode.trim()) {
        const { data: bcData } = await supabase.from("product_barcodes").insert({
          shop_id: shopId,
          product_id: createdProduct.id,
          barcode: barcode.trim(),
        }).select();
        if (bcData) createdBarcodes = bcData;
      }

      // If pack_size > 1, register packing variant for seamless Pack/Single POS selling
      if (pSize > 1) {
        const { data: varData } = await supabase.from("product_variants").insert({
          shop_id: shopId,
          product_id: createdProduct.id,
          packing_name: `${unit.trim() || "Pack"} (${pSize}s)`,
          pack_size: pSize,
          is_packing: true,
          purchase_price: pPrice * pSize,
          sale_price: sPrice * pSize,
          stock_quantity: Math.floor(stock / pSize),
        }).select();
        if (varData) createdVariants = varData;
      }

      // If Pharmacy or batch number entered, guarantee product_batches entry for instant POS sale
      if (isPharmacy || effectiveBatchNumber) {
        await supabase.from("product_batches").insert({
          shop_id: shopId,
          product_id: createdProduct.id,
          batch_number: effectiveBatchNumber || "BATCH-01",
          expiry_date: expiryDate || null,
          stock_quantity: stock,
          purchase_price: pPrice,
          sale_price: sPrice,
        });
      }

      const fullProduct: DBProduct = {
        ...(createdProduct as any),
        product_barcodes: createdBarcodes,
        product_variants: createdVariants,
        batchNumber: effectiveBatchNumber,
        expiryDate: expiryDate || null,
      };

      toast.success(`"${createdProduct.name}" added to inventory & cart! 🎉`);
      onProductCreated(fullProduct, true);
      onClose();
    } catch (err: any) {
      toast.error("Failed to add product: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-white/20 rounded-lg">
              {isPharmacy ? <Pill className="h-4 w-4" /> : <Package className="h-4 w-4" />}
            </span>
            <div>
              <h3 className="text-sm font-black tracking-tight">
                {isPharmacy ? "Quick Add Medicine" : "Quick Add Product"}
              </h3>
              <p className="text-[10px] text-indigo-100 font-medium">Add directly to inventory and POS cart</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1 text-xs custom-scrollbar">
          {/* Name & Barcode */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              {isPharmacy ? "Medicine Name" : "Product Name"} <span className="text-rose-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isPharmacy ? "e.g. Panadol Extra Tab 100s" : "e.g. Samsung 25W Fast Charger"}
              required
              autoFocus
              className="h-9 text-xs font-bold bg-slate-50 border-slate-200 rounded-xl"
            />
          </div>

          {/* Generic Salt / Formula (For Pharmacy) */}
          {isPharmacy && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Generic Salt / Formula
              </label>
              <Input
                value={genericFormula}
                onChange={(e) => setGenericFormula(e.target.value)}
                placeholder="e.g. Paracetamol + Caffeine"
                className="h-8.5 text-xs bg-slate-50 border-slate-200 rounded-xl"
              />
            </div>
          )}

          {/* Pricing & Stock */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                Sale Price <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                step="any"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00"
                required
                className="h-8.5 text-xs font-bold text-emerald-700 bg-emerald-50/50 border-emerald-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                Cost Price
              </label>
              <Input
                type="number"
                step="any"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0.00"
                className="h-8.5 text-xs bg-slate-50 border-slate-200 rounded-xl"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                Initial Stock
              </label>
              <Input
                type="number"
                step="any"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                placeholder="10"
                className="h-8.5 text-xs font-bold bg-slate-50 border-slate-200 rounded-xl"
              />
            </div>
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => {
                  const val = e.target.value;
                  setCategoryId(val);
                  if (typeof window !== "undefined") {
                    try {
                      if (val) {
                        localStorage.setItem(`last_selected_category_${shopId}`, val);
                        localStorage.setItem("last_selected_category", val);
                      }
                    } catch (err) {}
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 h-8.5 rounded-xl px-2.5 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="">General</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Unit / Packing</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 h-8.5 rounded-xl px-2.5 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="Box">Box</option>
                <option value="Strip">Strip</option>
                <option value="Pcs">Pcs</option>
                <option value="Tablet">Tablet</option>
                <option value="Bottle">Bottle</option>
                <option value="Syrup">Syrup</option>
                <option value="Tube">Tube</option>
                <option value="Vial">Vial</option>
                <option value="Ampoule">Ampoule</option>
                <option value="Sachet">Sachet</option>
                <option value="Pack">Pack</option>
                <option value="Kg">Kg</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Shelf / Rack</label>
              <Input
                value={shelfLocation}
                onChange={(e) => setShelfLocation(e.target.value)}
                placeholder="e.g. Rack A-3"
                className="h-8.5 text-xs bg-slate-50 border-slate-200 rounded-xl font-bold text-indigo-900"
              />
            </div>
          </div>

          {/* Barcode & Batch (Optional) */}
          <div className={`grid gap-2.5 ${isPharmacy ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Barcode / SKU</label>
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type barcode..."
                className="h-8.5 text-xs font-mono bg-slate-50 border-slate-200 rounded-xl"
              />
            </div>
            {isPharmacy && (
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Batch Number</label>
                <Input
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g. BATCH-01"
                  className="h-8.5 text-xs font-bold uppercase bg-slate-50 border-slate-200 rounded-xl"
                />
              </div>
            )}
            {isPharmacy && (
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Expiry Date</label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="h-8.5 text-xs bg-slate-50 border-slate-200 rounded-xl"
                />
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-slate-150 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-3.5 text-xs font-bold rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 px-5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Save &amp; Add to Cart
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
