"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Plus, DollarSign, TrendingUp, ShieldCheck, Tag, Layers, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface OneTimeItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (customItem: {
    productId: string;
    name: string;
    price: number;
    purchasePrice: number;
    quantity: number;
    stock: number;
    isCustomItem: boolean;
    warranty?: string;
    note?: string;
  }) => void;
  initialQuery?: string;
}

export function OneTimeItemModal({
  isOpen,
  onClose,
  onAddToCart,
  initialQuery = ""
}: OneTimeItemModalProps) {
  const [name, setName] = useState(initialQuery);
  const [purchasePrice, setPurchasePrice] = useState<number | "">("");
  const [salePrice, setSalePrice] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number>(1);
  const [warranty, setWarranty] = useState("");
  const [note, setNote] = useState("");

  const cost = Number(purchasePrice) || 0;
  const price = Number(salePrice) || 0;
  const qty = Number(quantity) || 1;
  const unitProfit = price - cost;
  const totalProfit = unitProfit * qty;
  const marginPct = price > 0 ? ((unitProfit / price) * 100).toFixed(1) : "0";

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter the item name.");
      return;
    }
    if (price <= 0) {
      toast.error("Please enter a valid customer sale price.");
      return;
    }

    onAddToCart({
      productId: `custom-${Date.now()}`,
      name: name.trim(),
      price: price,
      purchasePrice: cost,
      quantity: qty,
      stock: 9999,
      isCustomItem: true,
      warranty: warranty.trim() || undefined,
      note: note.trim() || undefined
    });

    toast.success(`"${name.trim()}" added to cart!`);
    // Reset
    setName("");
    setPurchasePrice("");
    setSalePrice("");
    setQuantity(1);
    setWarranty("");
    setNote("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-amber-50 text-amber-600">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  One-Time / Arranged Item Sale
                </h3>
                <p className="text-[11px] text-slate-500">
                  Sell arranged market stock without saving permanent product inventory
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleAdd} className="space-y-4 pt-4 text-xs">
            {/* 1. Item Name */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                Item / Product Name *
              </label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Gree 1.5 Ton Inverter AC (G10) / Haier 338L"
                className="h-9 text-xs font-bold rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                autoFocus
              />
            </div>

            {/* 2. Cost vs Sale Price & Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-[10px] font-black text-amber-800 uppercase tracking-wider mb-1">
                  Our Cost Price
                </label>
                <Input
                  type="number"
                  placeholder="Rs 45000"
                  value={purchasePrice}
                  onChange={e => setPurchasePrice(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-8 text-xs font-bold text-amber-900 bg-white rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">
                  Customer Sale Price *
                </label>
                <Input
                  type="number"
                  placeholder="Rs 52000"
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-8 text-xs font-black text-slate-900 bg-white rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Quantity
                </label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="h-8 text-xs font-bold text-center bg-white rounded-xl"
                />
              </div>
            </div>

            {/* 3. Live Profit Preview */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 p-3 rounded-2xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                  <TrendingUp size={13}/>
                  <span>Live Profit Margin:</span>
                </span>
                <p className="text-xs text-emerald-700 font-medium mt-0.5">
                  Rs {unitProfit.toLocaleString()} / unit · Margin: {marginPct}%
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase text-emerald-800">Total Net Profit</span>
                <p className="text-base font-black text-emerald-950 font-mono">
                  +Rs {totalProfit.toLocaleString()}
                </p>
              </div>
            </div>

            {/* 4. Warranty & Custom Serial Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Warranty
                </label>
                <Input
                  value={warranty}
                  onChange={e => setWarranty(e.target.value)}
                  placeholder="e.g. 1 Year Official / 10 Yr Compressor"
                  className="h-8 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Serial / IMEI / Notes
                </label>
                <Input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Arranged from Wholesale Market"
                  className="h-8 text-xs rounded-xl"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="rounded-xl h-9 text-xs font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-9 text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={14}/>
                Add to Cart
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
