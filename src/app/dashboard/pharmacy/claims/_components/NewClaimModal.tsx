"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Plus, Trash2, Check, AlertTriangle, Building2,
  Calendar, Layers, Sparkles, Loader2, Package, ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
};

export type AvailableBatch = {
  id: string;
  product_id: string;
  product_name: string;
  batch_number: string;
  expiry_date: string | null;
  stock_quantity: number;
  purchase_price: number;
  pack_size?: number | null;
  unit?: string | null;
  isExpired: boolean;
  isNearExpiry: boolean;
  daysRemaining: number;
};

type ClaimCartItem = {
  batchId?: string;
  productId: string;
  productName: string;
  batchNumber: string;
  expiryDate: string | null;
  quantity: number;
  packSize?: number | null;
  unit: string;
  purchasePrice: number;
  subtotal: number;
};

interface NewClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  shopName: string;
  onClaimCreated: () => void;
}

export function NewClaimModal({
  isOpen,
  onClose,
  shopId,
  shopName,
  onClaimCreated,
}: NewClaimModalProps) {
  const supabase = createClient();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [availableBatches, setAvailableBatches] = useState<AvailableBatch[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [bookerName, setBookerName] = useState("");
  const [bookerPhone, setBookerPhone] = useState("");
  const [returnReason, setReturnReason] = useState("Near Expiry / Expired");
  const [claimNotes, setClaimNotes] = useState("");
  const [claimCart, setClaimCart] = useState<ClaimCartItem[]>([]);

  // Filter / Search inside modal
  const [batchSearch, setBatchSearch] = useState("");
  const [showOnlyExpiring, setShowOnlyExpiring] = useState(true);

  useEffect(() => {
    if (isOpen && shopId) {
      loadInitialData();
    }
  }, [isOpen, shopId]);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [supRes, batchRes] = await Promise.all([
        supabase
          .from("parties")
          .select("id, name, phone, address")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),

        supabase
          .from("product_batches")
          .select(`
            id, product_id, batch_number, expiry_date, stock_quantity, purchase_price,
            products ( id, name, unit, pack_size )
          `)
          .eq("shop_id", shopId)
          .gt("stock_quantity", 0)
          .order("expiry_date", { ascending: true })
      ]);

      setSuppliers(supRes.data || []);

      const list: AvailableBatch[] = [];
      (batchRes.data || []).forEach((b: any) => {
        const prod = b.products;
        if (!prod || !b.batch_number) return;

        let isExpired = false;
        let isNearExpiry = false;
        let daysRemaining = 9999;

        if (b.expiry_date) {
          const exp = new Date(b.expiry_date);
          const diffTime = exp.getTime() - today.getTime();
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (daysRemaining < 0) isExpired = true;
          else if (daysRemaining <= 90) isNearExpiry = true;
        }

        list.push({
          id: b.id,
          product_id: b.product_id,
          product_name: prod.name,
          batch_number: b.batch_number,
          expiry_date: b.expiry_date || null,
          stock_quantity: Number(b.stock_quantity) || 0,
          purchase_price: Number(b.purchase_price) || 0,
          pack_size: prod.pack_size || 1,
          unit: prod.unit || "Pcs",
          isExpired,
          isNearExpiry,
          daysRemaining,
        });
      });

      setAvailableBatches(list);
    } catch (e: any) {
      toast.error("Failed to load batches: " + e.message);
    } finally {
      setLoadingData(false);
    }
  };

  // Filter batches
  const filteredBatches = useMemo(() => {
    return availableBatches.filter((b) => {
      if (showOnlyExpiring && !b.isExpired && !b.isNearExpiry) return false;
      if (batchSearch.trim()) {
        const q = batchSearch.toLowerCase();
        return (
          b.product_name.toLowerCase().includes(q) ||
          b.batch_number.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [availableBatches, showOnlyExpiring, batchSearch]);

  const handleAddBatchToClaim = (batch: AvailableBatch) => {
    const existingIdx = claimCart.findIndex(
      (item) => item.productId === batch.product_id && item.batchNumber === batch.batch_number
    );

    if (existingIdx >= 0) {
      toast.info("Item already in claim list. You can adjust quantity on the right.");
      return;
    }

    setClaimCart((prev) => [
      ...prev,
      {
        batchId: batch.id,
        productId: batch.product_id,
        productName: batch.product_name,
        batchNumber: batch.batch_number,
        expiryDate: batch.expiry_date,
        quantity: batch.stock_quantity,
        packSize: batch.pack_size,
        unit: batch.unit || "Pcs",
        purchasePrice: batch.purchase_price,
        subtotal: batch.stock_quantity * batch.purchase_price,
      },
    ]);
  };

  const handleUpdateCartQty = (idx: number, qty: number) => {
    setClaimCart((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      if (!item) return prev;
      const cleanQty = Math.max(qty, 1);
      updated[idx] = {
        ...item,
        quantity: cleanQty,
        subtotal: cleanQty * item.purchasePrice,
      };
      return updated;
    });
  };

  const handleRemoveCartItem = (idx: number) => {
    setClaimCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalClaimAmount = useMemo(() => {
    return claimCart.reduce((sum, it) => sum + it.subtotal, 0);
  }, [claimCart]);

  const handleSubmitClaim = async () => {
    if (!selectedSupplierId) {
      toast.error("Please select a Distributor / Supplier.");
      return;
    }
    if (claimCart.length === 0) {
      toast.error("Please select at least 1 batch to return.");
      return;
    }

    setIsSubmitting(true);
    try {
      const sup = suppliers.find((s) => s.id === selectedSupplierId);
      const claimNo = `CLM-${Date.now().toString().slice(-6)}`;

      // 1. Insert into supplier_expiry_claims
      const { data: claimRow, error: claimError } = await supabase
        .from("supplier_expiry_claims")
        .insert({
          shop_id: shopId,
          claim_number: claimNo,
          supplier_id: selectedSupplierId,
          supplier_name: sup?.name || "Distributor",
          booker_name: bookerName.trim() || null,
          booker_phone: bookerPhone.trim() || null,
          status: "submitted",
          total_items: claimCart.length,
          total_claimed_amount: totalClaimAmount,
          approved_amount: 0,
          notes: claimNotes.trim() || null,
          return_reason: returnReason,
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (claimError) throw claimError;

      // 2. Insert items
      const itemsPayload = claimCart.map((item) => ({
        claim_id: claimRow.id,
        product_id: item.productId,
        product_name: item.productName,
        batch_number: item.batchNumber,
        expiry_date: item.expiryDate || null,
        quantity: item.quantity,
        pack_size: item.packSize || 1,
        unit: item.unit,
        purchase_price: item.purchasePrice,
        subtotal: item.subtotal,
        status: "pending",
      }));

      const { error: itemsError } = await supabase
        .from("supplier_expiry_claim_items")
        .insert(itemsPayload);

      if (itemsError) throw itemsError;

      // 3. Quarantine / Deduct from product_batches so it cannot be sold at POS
      for (const item of claimCart) {
        if (item.batchId) {
          const { data: bRow } = await supabase
            .from("product_batches")
            .select("id, stock_quantity")
            .eq("id", item.batchId)
            .maybeSingle();

          if (bRow) {
            const newQty = Math.max(0, (bRow.stock_quantity || 0) - item.quantity);
            await supabase
              .from("product_batches")
              .update({ stock_quantity: newQty })
              .eq("id", bRow.id);
          }
        }
      }

      toast.success(`Claim #${claimNo} created! Stock quarantined from POS.`);
      onClaimCreated();
      onClose();
    } catch (err: any) {
      toast.error("Failed to create claim: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
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
          <div className="p-5 bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 text-white flex justify-between items-center shrink-0">
            <div>
              <div className="flex items-center gap-2 text-rose-400 font-extrabold text-[11px] uppercase tracking-widest bg-rose-950/80 border border-rose-800/60 px-2.5 py-0.5 rounded-md inline-flex mb-1">
                <ShieldAlert size={13} /> Distributor Expiry Claim / Gate Pass
              </div>
              <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Create Return Claim Note
              </h2>
              <p className="text-slate-300 text-xs mt-0.5">
                Select distributor & near-expiry batches. Stock is automatically quarantined from POS.
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body: Two Column Grid */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
            {/* Left: Supplier & Batch Selector (7 cols) */}
            <div className="lg:col-span-7 p-5 border-r border-slate-200 overflow-y-auto space-y-4 bg-slate-50/50 custom-scrollbar">
              {/* Supplier Selector */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={14} className="text-indigo-600" />
                  1. Select Target Distributor / Supplier *
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    setSelectedSupplierId(e.target.value);
                    const found = suppliers.find((s) => s.id === e.target.value);
                    if (found?.phone) setBookerPhone(found.phone);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">-- Choose Distributor / Wholesaler --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ""}
                    </option>
                  ))}
                </select>

                {/* Booker & Reason Inputs */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600">Delivery Boy / Booker Name</label>
                    <Input
                      placeholder="e.g. Aslam / Farhan"
                      value={bookerName}
                      onChange={(e) => setBookerName(e.target.value)}
                      className="h-8 text-xs font-bold bg-slate-50/80"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600">Booker Phone Number</label>
                    <Input
                      placeholder="0300-1234567"
                      value={bookerPhone}
                      onChange={(e) => setBookerPhone(e.target.value)}
                      className="h-8 text-xs font-mono font-bold bg-slate-50/80"
                    />
                  </div>
                </div>
              </div>

              {/* Batches Search & Picker */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={14} className="text-rose-600" />
                    2. Select Expired / Near-Expiry Batches
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowOnlyExpiring(!showOnlyExpiring)}
                    className={`text-[10.5px] font-black px-2.5 py-0.5 rounded-full border transition cursor-pointer ${
                      showOnlyExpiring
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {showOnlyExpiring ? "Showing: Near/Expired (<90d)" : "Showing: All Batches"}
                  </button>
                </div>

                <Input
                  placeholder="Search medicine name or batch #..."
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  className="h-8 text-xs bg-slate-50"
                />

                {loadingData ? (
                  <div className="text-center py-8 text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 text-indigo-600 animate-spin mb-1.5" />
                    <p className="text-xs font-bold text-slate-600">Scanning inventory batches...</p>
                  </div>
                ) : filteredBatches.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Package className="mx-auto h-8 w-8 text-slate-300 mb-1" />
                    <p className="text-xs font-bold text-slate-600">No matching batches found.</p>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {filteredBatches.map((b) => {
                      const isAdded = claimCart.some(
                        (it) => it.productId === b.product_id && it.batchNumber === b.batch_number
                      );

                      return (
                        <div
                          key={b.id}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                            isAdded
                              ? "bg-indigo-50/60 border-indigo-200 opacity-75"
                              : "bg-white hover:bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-extrabold text-xs text-slate-900 line-clamp-1">
                                {b.product_name}
                              </p>
                              <span className="font-mono text-[10px] font-black bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                #{b.batch_number}
                              </span>
                              {b.isExpired ? (
                                <span className="text-[9px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                                  Expired
                                </span>
                              ) : b.isNearExpiry ? (
                                <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                  {b.daysRemaining}d left
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-3 text-[10.5px] text-slate-500 mt-1">
                              <span>Exp: <strong className="text-slate-700 font-mono">{b.expiry_date || "N/A"}</strong></span>
                              <span>Avail Stock: <strong className="text-indigo-700 font-mono">{b.stock_quantity} {b.unit}</strong></span>
                              {b.purchase_price > 0 && <span>TP: Rs {b.purchase_price}</span>}
                            </div>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            disabled={isAdded}
                            onClick={() => handleAddBatchToClaim(b)}
                            className={`h-7 text-xs font-bold rounded-lg cursor-pointer ${
                              isAdded
                                ? "bg-slate-100 text-slate-400 border border-slate-200"
                                : "bg-rose-600 hover:bg-rose-700 text-white"
                            }`}
                          >
                            {isAdded ? "Added" : "+ Return"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Claim Sheet / Cart (5 cols) */}
            <div className="lg:col-span-5 p-5 flex flex-col justify-between bg-white overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-black text-sm text-slate-900">Claim Summary Sheet</h3>
                    <p className="text-[11px] text-slate-400">Items to give to delivery boy</p>
                  </div>
                  <span className="font-black text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md">
                    {claimCart.length} Items Selected
                  </span>
                </div>

                {claimCart.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <Package className="mx-auto h-10 w-10 text-slate-200 mb-2" />
                    <p className="text-xs font-bold text-slate-600">No items in claim note yet.</p>
                    <p className="text-[11px] text-slate-400">Click &quot;+ Return&quot; from the batch list on the left.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[38vh] overflow-y-auto pr-1 custom-scrollbar">
                    {claimCart.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-extrabold text-xs text-slate-900">{item.productName}</p>
                            <p className="font-mono text-[10px] text-slate-500">
                              Batch: {item.batchNumber} {item.expiryDate ? `· Exp: ${item.expiryDate}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(idx)}
                            className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-bold">Qty:</span>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleUpdateCartQty(idx, Number(e.target.value) || 1)}
                              className="w-16 h-7 text-xs font-black font-mono bg-white text-center"
                            />
                            <span className="text-[10px] text-slate-500 font-bold">{item.unit}</span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">@ Rs {item.purchasePrice}</span>
                            <span className="font-black text-xs text-slate-900">Rs {Math.round(item.subtotal).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Additional Notes */}
                <div className="pt-2">
                  <label className="text-[10.5px] font-bold text-slate-600">Special Instructions / Booker Notes</label>
                  <Input
                    placeholder="e.g. Return against Gate Pass #902, replacement in next bill"
                    value={claimNotes}
                    onChange={(e) => setClaimNotes(e.target.value)}
                    className="h-8 text-xs bg-slate-50"
                  />
                </div>
              </div>

              {/* Total & Submit Action */}
              <div className="pt-4 border-t border-slate-100 space-y-3 mt-4">
                <div className="flex justify-between items-center bg-slate-900 text-white p-3.5 rounded-2xl">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Total Claim Value</span>
                    <span className="text-base font-black font-mono text-emerald-400">Rs {Math.round(totalClaimAmount).toLocaleString()}</span>
                  </div>
                  <span className="text-xs text-slate-300 font-medium">{claimCart.length} Lines</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="flex-1 h-9 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmitClaim}
                    disabled={isSubmitting || claimCart.length === 0}
                    className="flex-1 h-9 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
                  >
                    {isSubmitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
                    Create Claim & Gate Pass
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
