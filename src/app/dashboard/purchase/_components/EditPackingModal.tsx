"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Plus, Trash2, Check, Package, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { DBProduct, CartItem } from "./types";

interface EditPackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: DBProduct | null;
  currentCartItem?: CartItem | null;
  shopId: string;
  onPackingUpdated: (
    updatedProduct: DBProduct,
    selectedVariant?: {
      id: string;
      packing_name: string;
      pack_size: number;
      purchase_price: number;
      sale_price: number;
    }
  ) => void;
}

type VariantRow = {
  id?: string;
  packing_name: string;
  pack_size: number;
  purchase_price: number;
  sale_price: number;
  is_packing?: boolean;
  isNew?: boolean;
  isDeleted?: boolean;
};

export default function EditPackingModal({
  isOpen,
  onClose,
  product,
  currentCartItem,
  shopId,
  onPackingUpdated,
}: EditPackingModalProps) {
  const supabase = createClient();

  const [baseUnit, setBaseUnit] = useState<string>("unit");
  const [singlePurchasePrice, setSinglePurchasePrice] = useState<number>(0);
  const [singleSalePrice, setSingleSalePrice] = useState<number>(0);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number>(-1); // -1 = base unit
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveToMaster, setSaveToMaster] = useState<boolean>(true);

  useEffect(() => {
    if (!product) return;

    setBaseUnit(product.unit || "unit");
    setSinglePurchasePrice(Number(product.purchase_price_single) || 0);
    setSingleSalePrice(Number(product.sale_price_single) || 0);

    const existingVars: VariantRow[] = (product.product_variants || []).map((v) => ({
      id: v.id,
      packing_name: v.packing_name,
      pack_size: Number(v.pack_size) || (Number(product.pack_size) > 1 ? Number(product.pack_size) : 10),
      purchase_price: Number(v.purchase_price) || 0,
      sale_price: Number(v.sale_price) || 0,
      is_packing: true,
    }));

    // If no variants exist but product has pack_size > 1, generate default packing suggestion
    if (existingVars.length === 0 && (product.pack_size || 0) > 1) {
      const pSize = Number(product.pack_size);
      const sCost = Number(product.purchase_price_single) || 0;
      const sRetail = Number(product.sale_price_single) || 0;
      existingVars.push({
        packing_name: `Pack of ${pSize}`,
        pack_size: pSize,
        purchase_price: sCost * pSize,
        sale_price: sRetail * pSize,
        is_packing: true,
        isNew: true,
      });
    }

    setVariants(existingVars);

    // Identify current selected variant
    if (currentCartItem?.variantId) {
      const matchIdx = existingVars.findIndex((v) => v.id === currentCartItem.variantId);
      setSelectedVariantIdx(matchIdx !== -1 ? matchIdx : 0);
    } else if (existingVars.length > 0) {
      setSelectedVariantIdx(0);
    } else {
      setSelectedVariantIdx(-1);
    }
  }, [product, currentCartItem, isOpen]);

  if (!isOpen || !product) return null;

  const handleAddPreset = (packSize: number, labelPrefix = "Pack") => {
    const sCost = singlePurchasePrice || 0;
    const sRetail = singleSalePrice || 0;
    const name = `${labelPrefix} of ${packSize}`;

    // Check if already exists
    const exists = variants.find((v) => !v.isDeleted && v.pack_size === packSize);
    if (exists) {
      toast.info(`A packing with size ${packSize} already exists.`);
      return;
    }

    const newRow: VariantRow = {
      packing_name: name,
      pack_size: packSize,
      purchase_price: Math.round(sCost * packSize * 100) / 100,
      sale_price: Math.round(sRetail * packSize * 100) / 100,
      is_packing: true,
      isNew: true,
    };

    setVariants((prev) => [...prev, newRow]);
    setSelectedVariantIdx(variants.length); // Select newly added
  };

  const handleAddNewCustomRow = () => {
    const sCost = singlePurchasePrice || 0;
    const sRetail = singleSalePrice || 0;
    const nextSize = 10;

    const newRow: VariantRow = {
      packing_name: `Pack of ${nextSize}`,
      pack_size: nextSize,
      purchase_price: Math.round(sCost * nextSize * 100) / 100,
      sale_price: Math.round(sRetail * nextSize * 100) / 100,
      is_packing: true,
      isNew: true,
    };

    setVariants((prev) => [...prev, newRow]);
    setSelectedVariantIdx(variants.length);
  };

  const handleUpdateVariantField = (idx: number, field: keyof VariantRow, value: any) => {
    setVariants((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const updated = { ...row, [field]: value };

        // If pack_size changed, auto-adjust prices if purchase_price was proportional
        if (field === "pack_size" && Number(value) > 0) {
          const newSize = Number(value);
          if (singlePurchasePrice > 0) {
            updated.purchase_price = Math.round(singlePurchasePrice * newSize * 100) / 100;
          }
          if (singleSalePrice > 0) {
            updated.sale_price = Math.round(singleSalePrice * newSize * 100) / 100;
          }
          if (!row.packing_name || row.packing_name.startsWith("Pack of") || row.packing_name.startsWith("Box of") || row.packing_name.startsWith("Strip of")) {
            const prefix = row.packing_name.split(" ")[0] || "Pack";
            updated.packing_name = `${prefix} of ${newSize}`;
          }
        }

        return updated;
      })
    );
  };

  const handleDeleteVariant = (idx: number) => {
    setVariants((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        return { ...row, isDeleted: true };
      })
    );
    if (selectedVariantIdx === idx) {
      setSelectedVariantIdx(-1);
    }
  };

  const handleSaveAndApply = async () => {
    setIsSaving(true);
    try {
      const activeRows = variants.filter((v) => !v.isDeleted);

      // 1. If saveToMaster is enabled, sync to Supabase database permanently
      if (saveToMaster && shopId) {
        // Update product base unit & single prices if modified
        const maxPackSize = activeRows.length > 0 ? Math.max(...activeRows.map((r) => r.pack_size || 1)) : 1;
        await supabase
          .from("products")
          .update({
            unit: baseUnit.trim() || "unit",
            purchase_price_single: singlePurchasePrice,
            sale_price_single: singleSalePrice,
            pack_size: maxPackSize,
          })
          .eq("id", product.id)
          .eq("shop_id", shopId);

        // Delete removed variants
        const deletedIds = variants.filter((v) => v.isDeleted && v.id).map((v) => v.id!);
        if (deletedIds.length > 0) {
          await supabase.from("product_variants").delete().in("id", deletedIds);
        }

        // Upsert / Insert active variants
        for (const row of activeRows) {
          if (row.id && !row.isNew) {
            await supabase
              .from("product_variants")
              .update({
                packing_name: row.packing_name.trim(),
                pack_size: row.pack_size,
                purchase_price: row.purchase_price,
                sale_price: row.sale_price,
                is_packing: true,
              })
              .eq("id", row.id);
          } else {
            const { data: newVar } = await supabase
              .from("product_variants")
              .insert({
                shop_id: shopId,
                product_id: product.id,
                packing_name: row.packing_name.trim(),
                pack_size: row.pack_size,
                purchase_price: row.purchase_price,
                sale_price: row.sale_price,
                is_packing: true,
                stock_quantity: Math.floor((product.current_stock || 0) / (row.pack_size || 1)),
              })
              .select()
              .single();

            if (newVar) {
              row.id = newVar.id;
              row.isNew = false;
            }
          }
        }
      }

      // 2. Build updated DBProduct object
      const updatedProductVariants = activeRows.map((r) => ({
        id: r.id || `temp-${Math.random()}`,
        packing_name: r.packing_name,
        pack_size: r.pack_size,
        purchase_price: r.purchase_price,
        sale_price: r.sale_price,
        stock_quantity: Math.floor((product.current_stock || 0) / (r.pack_size || 1)),
        is_packing: true,
      }));

      const updatedProduct: DBProduct = {
        ...product,
        unit: baseUnit,
        purchase_price_single: singlePurchasePrice,
        sale_price_single: singleSalePrice,
        pack_size: activeRows.length > 0 ? activeRows[0].pack_size : 1,
        product_variants: updatedProductVariants,
      };

      // 3. Determine selected variant for cart item
      let chosenVariant: any = undefined;
      if (selectedVariantIdx >= 0 && activeRows[selectedVariantIdx]) {
        const v = activeRows[selectedVariantIdx];
        chosenVariant = {
          id: v.id || updatedProductVariants[selectedVariantIdx]?.id,
          packing_name: v.packing_name,
          pack_size: v.pack_size,
          purchase_price: v.purchase_price,
          sale_price: v.sale_price,
        };
      }

      onPackingUpdated(updatedProduct, chosenVariant);
      toast.success(
        saveToMaster
          ? `Packing & Catalog updated for "${product.name}"!`
          : `Packing applied to current purchase invoice!`
      );
      onClose();
    } catch (err: any) {
      console.error("Error saving packing:", err);
      toast.error("Failed to update packing: " + (err.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  const activeVariants = variants.filter((v) => !v.isDeleted);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-violet-900/10 via-indigo-900/10 to-slate-900/5 dark:from-violet-950/40 dark:via-zinc-900 dark:to-zinc-950 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-600 flex items-center justify-center shrink-0">
              <Package size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate max-w-[280px] sm:max-w-md">
                  {product.name}
                </h3>
                {product.code && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                    {product.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Fix or configure pack sizes, strip sizes, and purchase/retail pricing for this item.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Base Unit & Single Prices */}
          <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                <span>1. Single Unit (Base Level)</span>
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                Current Stock: <strong className="text-slate-800 dark:text-zinc-200">{product.current_stock || 0} {baseUnit}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1 block">
                  Base Unit Name
                </Label>
                <Input
                  value={baseUnit}
                  onChange={(e) => setBaseUnit(e.target.value)}
                  placeholder="e.g. tablet, capsule, ml, piece"
                  className="h-9 text-xs font-bold bg-white dark:bg-zinc-950"
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1 block">
                  Single Cost (Rs)
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={singlePurchasePrice || ""}
                  onChange={(e) => setSinglePurchasePrice(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="h-9 text-xs font-bold font-mono bg-white dark:bg-zinc-950"
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1 block">
                  Single Sale Retail (Rs)
                </Label>
                <Input
                  type="number"
                  step="any"
                  value={singleSalePrice || ""}
                  onChange={(e) => setSingleSalePrice(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="h-9 text-xs font-bold font-mono bg-white dark:bg-zinc-950"
                />
              </div>
            </div>
          </div>

          {/* Packings & Variations Manager */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-200">
                  2. Packings & Variations (Packs / Boxes / Strips)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Select which packing to purchase in this invoice, or add new pack sizes.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddNewCustomRow}
                  className="h-8 px-2.5 text-xs font-bold gap-1 text-violet-700 dark:text-violet-400 border-violet-300 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                >
                  <Plus size={13} />
                  <span>+ Custom Pack</span>
                </Button>
              </div>
            </div>

            {/* Quick Preset Badges */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10.5px] font-bold text-slate-400 dark:text-zinc-500">Quick add:</span>
              {[
                { size: 10, label: "Strip of 10" },
                { size: 20, label: "Box of 20" },
                { size: 30, label: "Box of 30" },
                { size: 50, label: "Box of 50" },
                { size: 100, label: "Box of 100" },
                { size: 200, label: "Box of 200" },
              ].map((p) => (
                <button
                  key={p.size}
                  type="button"
                  onClick={() => handleAddPreset(p.size, p.label.split(" ")[0])}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 hover:bg-violet-100 dark:bg-zinc-900 dark:hover:bg-violet-950/60 text-slate-700 hover:text-violet-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 transition-colors cursor-pointer"
                >
                  + {p.label}
                </button>
              ))}
            </div>

            {/* Packings List Table */}
            {activeVariants.length === 0 ? (
              <div className="p-6 border border-dashed border-slate-300 dark:border-zinc-800 rounded-xl text-center space-y-2 bg-slate-50/50 dark:bg-zinc-900/30">
                <AlertCircle className="mx-auto text-amber-500" size={24} />
                <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  No packings configured yet for this product.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  This product is currently sold only as single &quot;{baseUnit}&quot;. Click the presets above to add packings.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Base selection option */}
                <div
                  onClick={() => setSelectedVariantIdx(-1)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    selectedVariantIdx === -1
                      ? "bg-violet-50 dark:bg-violet-950/40 border-violet-500 dark:border-violet-600 shadow-xs"
                      : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedVariantIdx === -1
                          ? "border-violet-600 bg-violet-600 text-white"
                          : "border-slate-300 dark:border-zinc-700"
                      }`}
                    >
                      {selectedVariantIdx === -1 && <Check size={10} />}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                        Single Base Unit ({baseUnit})
                      </div>
                      <div className="text-[10.5px] text-slate-500 dark:text-zinc-400">
                        Purchase Cost: <strong className="font-mono text-slate-700 dark:text-zinc-300">Rs {singlePurchasePrice}</strong> | Sale Retail: <strong className="font-mono text-slate-700 dark:text-zinc-300">Rs {singleSalePrice}</strong>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                    1 {baseUnit}
                  </span>
                </div>

                {/* Variant rows */}
                {activeVariants.map((row, idx) => {
                  const isSelected = selectedVariantIdx === idx;
                  return (
                    <div
                      key={row.id || idx}
                      onClick={() => setSelectedVariantIdx(idx)}
                      className={`p-3 rounded-xl border transition-all space-y-2 cursor-pointer ${
                        isSelected
                          ? "bg-violet-50/70 dark:bg-violet-950/40 border-violet-500 dark:border-violet-600 shadow-xs"
                          : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "border-violet-600 bg-violet-600 text-white"
                                : "border-slate-300 dark:border-zinc-700"
                            }`}
                          >
                            {isSelected && <Check size={10} />}
                          </div>
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            Packing Option #{idx + 1}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVariant(idx);
                          }}
                          className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Remove this packing from directory"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Inputs row */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        <div>
                          <Label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 mb-0.5 block">
                            Packing Name
                          </Label>
                          <Input
                            value={row.packing_name}
                            onChange={(e) => handleUpdateVariantField(idx, "packing_name", e.target.value)}
                            placeholder="e.g. Box of 20"
                            className="h-8 text-xs font-bold bg-white dark:bg-zinc-950"
                          />
                        </div>

                        <div>
                          <Label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 mb-0.5 block">
                            Pack Size ({baseUnit}s)
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            value={row.pack_size || ""}
                            onChange={(e) => handleUpdateVariantField(idx, "pack_size", parseInt(e.target.value) || 1)}
                            placeholder="10"
                            className="h-8 text-xs font-bold font-mono bg-white dark:bg-zinc-950"
                          />
                        </div>

                        <div>
                          <Label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 mb-0.5 block">
                            Pack Cost (Rs)
                          </Label>
                          <Input
                            type="number"
                            step="any"
                            value={row.purchase_price || ""}
                            onChange={(e) => handleUpdateVariantField(idx, "purchase_price", parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="h-8 text-xs font-bold font-mono bg-white dark:bg-zinc-950"
                          />
                        </div>

                        <div>
                          <Label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 mb-0.5 block">
                            Pack Retail (Rs)
                          </Label>
                          <Input
                            type="number"
                            step="any"
                            value={row.sale_price || ""}
                            onChange={(e) => handleUpdateVariantField(idx, "sale_price", parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="h-8 text-xs font-bold font-mono bg-white dark:bg-zinc-950"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-zinc-900/80 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveToMaster}
              onChange={(e) => setSaveToMaster(e.target.checked)}
              className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-slate-300 dark:border-zinc-700 cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
              <Sparkles size={13} className="text-violet-600" />
              <span>Save & update product directory permanently</span>
            </span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs font-bold h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveAndApply}
              disabled={isSaving}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-xs h-9 px-4 rounded-xl shadow-md gap-1.5 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="animate-spin" size={13} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Apply & Save Packing</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
