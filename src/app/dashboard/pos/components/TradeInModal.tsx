"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Smartphone, ArrowRightLeft, DollarSign, Check, ShieldCheck, User, Phone, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export type TradeInItem = {
  brandModel: string;
  imei1: string;
  imei2?: string;
  ptaStatus: "approved" | "non_pta" | "jv";
  condition: string;
  agreedValue: number;
  sellerCnic?: string;
  sellerPhone?: string;
  notes?: string;
};

interface TradeInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTradeIn: (tradeIn: TradeInItem) => void;
  currentTradeIn?: TradeInItem | null;
  onRemoveTradeIn?: () => void;
}

export const TradeInModal: React.FC<TradeInModalProps> = ({
  isOpen,
  onClose,
  onApplyTradeIn,
  currentTradeIn,
  onRemoveTradeIn,
}) => {
  const [brandModel, setBrandModel] = useState(currentTradeIn?.brandModel || "");
  const [imei1, setImei1] = useState(currentTradeIn?.imei1 || "");
  const [imei2, setImei2] = useState(currentTradeIn?.imei2 || "");
  const [ptaStatus, setPtaStatus] = useState<"approved" | "non_pta" | "jv">(currentTradeIn?.ptaStatus || "approved");
  const [condition, setCondition] = useState(currentTradeIn?.condition || "Good Condition (8/10)");
  const [agreedValue, setAgreedValue] = useState(currentTradeIn?.agreedValue ? String(currentTradeIn.agreedValue) : "");
  const [sellerCnic, setSellerCnic] = useState(currentTradeIn?.sellerCnic || "");
  const [sellerPhone, setSellerPhone] = useState(currentTradeIn?.sellerPhone || "");
  const [notes, setNotes] = useState(currentTradeIn?.notes || "");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandModel.trim()) {
      toast.error("Please enter the handset brand & model (e.g. iPhone 11 Pro 64GB).");
      return;
    }
    const val = parseFloat(agreedValue);
    if (isNaN(val) || val <= 0) {
      toast.error("Please enter a valid agreed exchange value in Rs.");
      return;
    }

    onApplyTradeIn({
      brandModel: brandModel.trim(),
      imei1: imei1.trim(),
      imei2: imei2.trim() || undefined,
      ptaStatus,
      condition,
      agreedValue: val,
      sellerCnic: sellerCnic.trim() || undefined,
      sellerPhone: sellerPhone.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    toast.success(`Exchange applied! Rs ${val.toLocaleString()} deducted from total.`);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-slate-900 p-4 text-white flex justify-between items-center px-6">
            <div className="flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-amber-400" />
              <div>
                <h3 className="font-bold text-sm">Mobile Phone Exchange / Trade-In</h3>
                <p className="text-[11px] text-slate-400">Accept customer's old phone and adjust value in bill</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
              <X size={18} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
            
            {/* Handset Model */}
            <div>
              <label className="block text-slate-700 font-bold uppercase text-[10px] tracking-wider mb-1">
                Handset Brand &amp; Model *
              </label>
              <Input
                placeholder="e.g. iPhone 12 128GB Blue / Samsung S21"
                value={brandModel}
                onChange={e => setBrandModel(e.target.value)}
                className="h-9 font-bold text-slate-800"
                required
                autoFocus
              />
            </div>

            {/* IMEI 1 & 2 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold uppercase text-[10px] tracking-wider mb-1">
                  IMEI 1 (Primary)
                </label>
                <Input
                  placeholder="15-digit IMEI"
                  value={imei1}
                  onChange={e => setImei1(e.target.value)}
                  className="h-9 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold uppercase text-[10px] tracking-wider mb-1">
                  IMEI 2 (Optional)
                </label>
                <Input
                  placeholder="Secondary IMEI"
                  value={imei2}
                  onChange={e => setImei2(e.target.value)}
                  className="h-9 font-mono"
                />
              </div>
            </div>

            {/* PTA Status & Condition */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold uppercase text-[10px] tracking-wider mb-1">
                  PTA Compliance
                </label>
                <select
                  value={ptaStatus}
                  onChange={e => setPtaStatus(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="approved">PTA Approved</option>
                  <option value="non_pta">Non-PTA</option>
                  <option value="jv">JV / Gevey Unlock</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase text-[10px] tracking-wider mb-1">
                  Physical Condition
                </label>
                <select
                  value={condition}
                  onChange={e => setCondition(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Pin Pack / Like New (10/10)">Pin Pack / Like New (10/10)</option>
                  <option value="Good Condition (8-9/10)">Good Condition (8-9/10)</option>
                  <option value="Minor Scratches (7/10)">Minor Scratches (7/10)</option>
                  <option value="Faulty / Screen Shade / Body Damage">Faulty / Screen Shade / Body Damage</option>
                </select>
              </div>
            </div>

            {/* Agreed Trade-In Value (Rs) */}
            <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 space-y-1">
              <label className="block text-amber-900 font-black uppercase text-[10px] tracking-wider">
                Agreed Trade-In Exchange Value (Rs) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-700 font-bold text-sm">Rs</span>
                <Input
                  type="number"
                  placeholder="e.g. 45000"
                  value={agreedValue}
                  onChange={e => setAgreedValue(e.target.value)}
                  className="pl-9 h-10 bg-white border-amber-300 font-black text-amber-950 text-base"
                  required
                />
              </div>
              <p className="text-[10px] text-amber-700">
                * This amount will be deducted directly from the customer's POS checkout invoice.
              </p>
            </div>

            {/* Seller CNIC & Phone (For record & legal security) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold uppercase text-[10px] tracking-wider mb-1">
                  Customer CNIC No
                </label>
                <Input
                  placeholder="e.g. 35201-xxxxxxx-x"
                  value={sellerCnic}
                  onChange={e => setSellerCnic(e.target.value)}
                  className="h-8 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold uppercase text-[10px] tracking-wider mb-1">
                  Customer Phone
                </label>
                <Input
                  placeholder="0300-xxxxxxx"
                  value={sellerPhone}
                  onChange={e => setSellerPhone(e.target.value)}
                  className="h-8 font-mono"
                />
              </div>
            </div>

            {/* Remarks / Accessories */}
            <div>
              <label className="block text-slate-700 font-bold uppercase text-[10px] tracking-wider mb-1">
                Accessories &amp; Notes
              </label>
              <Input
                placeholder="e.g. Box & Original Charger included, Battery health 84%"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="h-8"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4">
              {currentTradeIn && onRemoveTradeIn ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onRemoveTradeIn();
                    toast.info("Trade-in exchange removed from cart.");
                    onClose();
                  }}
                  className="border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold h-9 px-3 rounded-xl"
                >
                  Remove Exchange
                </Button>
              ) : <div></div>}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold h-9 px-4 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 px-5 rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  <Check size={15} />
                  <span>Apply Trade-In (Deduct Rs {parseFloat(agreedValue) ? parseFloat(agreedValue).toLocaleString() : "0"})</span>
                </Button>
              </div>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
