"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Check, Calendar, Sparkles, Layers, Plus, Package, Loader2, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { ProductBatch } from "../types";

export function formatDetailedStock(
  stock: number,
  packSize?: number | null,
  unit?: string | null,
  packingName?: string | null
): {
  breakdown: string;
  totalWithUnit: string;
  fullBadgeText: string;
  packs: number;
  loose: number;
} {
  const baseUnit = (unit || "pcs").trim();
  const size = Number(packSize) || 0;
  const total = Number(stock) || 0;

  if (size > 1) {
    const packs = Math.floor(total / size);
    const loose = total % size;
    const packLabel = packingName ? packingName.replace(/\s*\(.*\)/, "").trim() : "Box/Pack";

    let breakdown = "";
    if (packs > 0 && loose > 0) {
      breakdown = `${packs} ${packLabel}${packs > 1 ? "s" : ""} + ${loose} ${baseUnit}`;
    } else if (packs > 0) {
      breakdown = `${packs} ${packLabel}${packs > 1 ? "s" : ""}`;
    } else {
      breakdown = `${loose} ${baseUnit}`;
    }

    return {
      breakdown,
      totalWithUnit: `${total} ${baseUnit}`,
      fullBadgeText: `${breakdown} (Total: ${total} ${baseUnit})`,
      packs,
      loose,
    };
  }

  return {
    breakdown: `${total} ${baseUnit}`,
    totalWithUnit: `${total} ${baseUnit}`,
    fullBadgeText: `${total} ${baseUnit}`,
    packs: 0,
    loose: total,
  };
}

interface BatchSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productId?: string;
  shopId?: string;
  packSize?: number | null;
  unit?: string | null;
  packingName?: string | null;
  totalStock?: number | null;
  currentBatchNumber: string | null;
  currentExpiryDate: string | null;
  availableBatches: ProductBatch[];
  onSelectBatch: (batchNumber: string | null, expiryDate: string | null, batchId?: string | null) => void;
}

export function BatchSelectorModal({
  isOpen,
  onClose,
  productName,
  productId,
  shopId,
  packSize: propPackSize,
  unit: propUnit,
  packingName: propPackingName,
  totalStock: propTotalStock,
  currentBatchNumber,
  currentExpiryDate,
  availableBatches,
  onSelectBatch,
}: BatchSelectorModalProps) {
  const supabase = createClient();
  const [liveBatches, setLiveBatches] = useState<ProductBatch[]>(availableBatches || []);
  const [loadingLive, setLoadingLive] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customBatch, setCustomBatch] = useState(currentBatchNumber || "");
  const [customExpiry, setCustomExpiry] = useState(currentExpiryDate || "");

  const [resolvedPackSize, setResolvedPackSize] = useState<number | null>(propPackSize ?? null);
  const [resolvedUnit, setResolvedUnit] = useState<string>(propUnit || "pcs");
  const [resolvedPackingName, setResolvedPackingName] = useState<string | null>(propPackingName ?? null);
  const [resolvedTotalStock, setResolvedTotalStock] = useState<number>(propTotalStock ?? 0);

  // Sync availableBatches on change or fetch if empty
  useEffect(() => {
    if (availableBatches && availableBatches.length > 0) {
      setLiveBatches(availableBatches);
    }
    if (productId && isOpen) {
      fetchLiveBatches();
    }
  }, [availableBatches, productId, isOpen]);

  const fetchLiveBatches = async () => {
    if (!productId) return;
    setLoadingLive(true);
    try {
      const [pbRes, poRes, stkRes, prodRes] = await Promise.all([
        supabase
          .from("product_batches")
          .select("id, product_id, variant_id, batch_number, expiry_date, stock_quantity, sale_price, purchase_price")
          .eq("product_id", productId)
          .order("expiry_date", { ascending: true }),
        supabase
          .from("purchase_order_items")
          .select("id, product_id, batch_number, expiry_date, quantity, bonus_quantity, purchase_price")
          .eq("product_id", productId)
          .not("batch_number", "is", null)
          .order("expiry_date", { ascending: true }),
        supabase
          .from("stock")
          .select("id, product_id, batch_number, expiry_date, quantity_pack, quantity_single")
          .eq("product_id", productId)
          .not("batch_number", "is", null)
          .order("expiry_date", { ascending: true }),
        supabase
          .from("products")
          .select("id, name, unit, current_stock, pack_size, product_variants(id, packing_name, pack_size, is_packing)")
          .eq("id", productId)
          .maybeSingle(),
      ]);

      if (prodRes.data) {
        const p = prodRes.data;
        const vPack = p.product_variants?.find((v: any) => v.is_packing && v.pack_size > 1);
        const pSize = p.pack_size || vPack?.pack_size || null;
        setResolvedPackSize(pSize);
        setResolvedUnit(p.unit || "pcs");
        setResolvedPackingName(vPack?.packing_name || (pSize ? `Pack (${pSize} ${p.unit || "pcs"})` : null));
        setResolvedTotalStock(Number(p.current_stock) || 0);
      }

      const map: Record<string, ProductBatch> = {};

      (pbRes.data || []).forEach((b: any) => {
        if (!b.batch_number) return;
        const bNum = b.batch_number.trim();
        map[bNum] = {
          id: b.id,
          product_id: b.product_id,
          batch_number: bNum,
          expiry_date: b.expiry_date || null,
          stock_quantity: Number(b.stock_quantity) || 0,
          sale_price: b.sale_price,
          purchase_price: b.purchase_price,
        };
      });

      (poRes.data || []).forEach((p: any) => {
        if (!p.batch_number) return;
        const bNum = p.batch_number.trim();
        if (!map[bNum]) {
          map[bNum] = {
            id: p.id,
            product_id: p.product_id,
            batch_number: bNum,
            expiry_date: p.expiry_date || null,
            stock_quantity: (Number(p.quantity) || 0) + (Number(p.bonus_quantity) || 0),
            purchase_price: p.purchase_price,
          };
        }
      });

      (stkRes.data || []).forEach((s: any) => {
        if (!s.batch_number) return;
        const bNum = s.batch_number.trim();
        if (!map[bNum]) {
          map[bNum] = {
            id: s.id,
            product_id: s.product_id,
            batch_number: bNum,
            expiry_date: s.expiry_date || null,
            stock_quantity: (Number(s.quantity_pack) || 0) + (Number(s.quantity_single) || 0),
          };
        }
      });

      const list = Object.values(map);
      setLiveBatches(list);
      if (list.length === 0) setShowCustomInput(true);
    } catch (e) {
      console.warn("Live batch fetch error:", e);
    } finally {
      setLoadingLive(false);
    }
  };

  if (!isOpen) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sort batches by FEFO (Earliest expiry date first)
  const sortedBatches = [...liveBatches].sort((a, b) => {
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
  });

  const totalStockDetail = formatDetailedStock(
    resolvedTotalStock,
    resolvedPackSize,
    resolvedUnit,
    resolvedPackingName
  );

  const getBatchStatus = (expiryDateStr: string | null) => {
    if (!expiryDateStr) return { text: "No Expiry", color: "bg-slate-100 text-slate-600 border-slate-200", isExpired: false, isNear: false };
    const exp = new Date(expiryDateStr);
    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Expired (${Math.abs(diffDays)}d ago)`, color: "bg-red-50 text-red-700 border-red-200 font-bold", isExpired: true, isNear: false };
    }
    if (diffDays <= 90) {
      return { text: `Near Expiry (${diffDays}d left)`, color: "bg-amber-50 text-amber-700 border-amber-200 font-bold", isExpired: false, isNear: true };
    }
    return { text: `Safe (${diffDays}d left)`, color: "bg-emerald-50 text-emerald-700 border-emerald-200", isExpired: false, isNear: false };
  };

  const handleApplyCustom = () => {
    if (!customBatch.trim()) return;
    onSelectBatch(customBatch.trim(), customExpiry || null, null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
              <Layers size={20} />
            </div>
            <div>
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-100/60 px-2 py-0.5 rounded-md">
                Batch & Expiry Selector (FEFO)
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-900 line-clamp-1 mt-0.5">
                {productName}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Total Stock Breakdown Banner */}
        <div className="px-5 py-2.5 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50 border-b border-indigo-100/60 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Boxes size={14} className="text-indigo-600 shrink-0" />
            <span className="text-slate-500 font-bold">Total Stock:</span>
            <span className="font-extrabold text-indigo-900 bg-white px-2 py-0.5 rounded-lg border border-indigo-200/80 shadow-2xs">
              {totalStockDetail.fullBadgeText}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400 font-medium">Cart:</span>
            <span className="font-mono font-black text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
              {currentBatchNumber || "FEFO Auto"}
            </span>
          </div>
        </div>

        {/* Batches List */}
        <div className="p-5 overflow-y-auto space-y-2.5 flex-1 custom-scrollbar">
          {loadingLive ? (
            <div className="text-center py-8 text-slate-400">
              <Loader2 className="mx-auto h-8 w-8 text-indigo-600 animate-spin mb-2" />
              <p className="text-xs font-bold text-slate-600">Loading registered batches for this product...</p>
            </div>
          ) : sortedBatches.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Package className="mx-auto h-10 w-10 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">No registered batches found for this product.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">You can manually input a physical batch below.</p>
            </div>
          ) : (
            sortedBatches.map((b, idx) => {
              const isSelected = (currentBatchNumber === b.batch_number) || (!currentBatchNumber && idx === 0);
              const status = getBatchStatus(b.expiry_date);
              const isFefoRecommended = idx === 0;

              const batchQty = Number(b.stock_quantity) || 0;
              // If batchQty is in pack units vs piece units
              const batchStockDetail = formatDetailedStock(
                batchQty,
                resolvedPackSize,
                resolvedUnit,
                resolvedPackingName
              );

              return (
                <div
                  key={b.id || idx}
                  onClick={() => {
                    onSelectBatch(b.batch_number, b.expiry_date, b.id);
                    onClose();
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs"
                      : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs text-slate-900">
                        Batch: {b.batch_number || "Unlabeled"}
                      </span>
                      {isFefoRecommended && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md border border-amber-200">
                          <Sparkles size={10} /> FEFO First
                        </span>
                      )}
                      <span className={`text-[9.5px] px-2 py-0.5 rounded-md border ${status.color}`}>
                        {status.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
                      {b.expiry_date && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          Exp: <strong className="text-slate-700 font-mono">{b.expiry_date}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center">
                    {isSelected ? (
                      <div className="h-7 w-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Check size={16} />
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs rounded-xl border-slate-200 hover:bg-indigo-50 hover:text-indigo-600"
                      >
                        Select
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Manual / Custom Batch Override Toggle */}
          <div className="pt-2">
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-50/50 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={14} /> Manually Enter Physical Pack Batch No
              </button>
            ) : (
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-black text-slate-850">Enter Custom Physical Batch</p>
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(false)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Batch Number *</label>
                    <Input
                      placeholder="e.g. BT-9024"
                      value={customBatch}
                      onChange={(e) => setCustomBatch(e.target.value)}
                      className="h-8 text-xs font-mono font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Expiry Date</label>
                    <Input
                      type="date"
                      value={customExpiry}
                      onChange={(e) => setCustomExpiry(e.target.value)}
                      className="h-8 text-xs font-mono bg-white"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleApplyCustom}
                  disabled={!customBatch.trim()}
                  className="w-full h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer"
                >
                  Apply Custom Batch to Cart Line
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs">
          <p className="text-[10px] text-slate-400">
            * FEFO auto-sorts batches by earliest expiration date.
          </p>
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="px-4 h-8 text-xs font-bold rounded-xl cursor-pointer"
          >
            Done
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
