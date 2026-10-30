"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, X, Send, Loader2, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuickShortBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  initialMedicineName?: string;
  initialCustomerName?: string;
  initialCustomerPhone?: string;
}

export const QuickShortBookModal: React.FC<QuickShortBookModalProps> = ({
  isOpen,
  onClose,
  shopId,
  initialMedicineName = "",
  initialCustomerName = "",
  initialCustomerPhone = "",
}) => {
  const supabase = createClient();

  const [medicineName, setMedicineName] = useState("");
  const [genericSalt, setGenericSalt] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [qtyDemanded, setQtyDemanded] = useState("1");
  const [priority, setPriority] = useState<"urgent" | "normal">("normal");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMedicineName(initialMedicineName || "");
      setGenericSalt("");
      setCompanyName("");
      setQtyDemanded("1");
      setPriority("normal");
      setCustomerName(initialCustomerName || "");
      setCustomerPhone(initialCustomerPhone || "");
      setNotes("");
    }
  }, [isOpen, initialMedicineName, initialCustomerName, initialCustomerPhone]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicineName.trim()) {
      toast.error("Please enter medicine name");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        shop_id: shopId,
        medicine_name: medicineName.trim(),
        generic_salt: genericSalt.trim() || null,
        company_distributor: companyName.trim() || null,
        pack_qty_demanded: Number(qtyDemanded) || 1,
        priority,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        notes: notes.trim() || null,
        status: "pending",
        demand_count: 1,
      };

      // Try inserting into Supabase
      const { error } = await supabase.from("pharmacy_short_book").insert(payload);
      
      // Also update local storage for offline and fast local caching
      const storageKey = `pharmacy_short_book_${shopId || "default"}`;
      try {
        const saved = localStorage.getItem(storageKey);
        const list = saved ? JSON.parse(saved) : [];
        list.unshift({
          ...payload,
          id: `sb-${Date.now()}`,
          created_at: new Date().toISOString(),
        });
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch (storageErr) {
        console.error("Local storage update error:", storageErr);
      }

      if (error && !error.message?.includes("does not exist")) {
        console.warn("Short book supabase insert warning:", error);
      }

      toast.success(`"${medicineName.trim()}" added to Short Book / ڈیمانڈ رجسٹر! 📝`);
      onClose();
    } catch (err: any) {
      toast.error("Failed to add to Short Book: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-white/20 rounded-lg">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                Add to Short Book
              </h3>
              <p className="text-[10px] text-amber-100 font-medium">Record out-of-stock medicine for distributor purchase</p>
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
        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          {/* Medicine Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Medicine / Item Name <span className="text-rose-500">*</span>
            </label>
            <Input
              value={medicineName}
              onChange={(e) => setMedicineName(e.target.value)}
              placeholder="e.g. Augmentin 625mg Tab"
              required
              autoFocus
              className="h-9 text-xs font-bold bg-amber-50/40 border-amber-200 rounded-xl"
            />
          </div>

          {/* Qty & Priority */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                Packs Demanded
              </label>
              <Input
                type="number"
                min="1"
                value={qtyDemanded}
                onChange={(e) => setQtyDemanded(e.target.value)}
                className="h-8.5 text-xs font-bold bg-slate-50 border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className={`w-full h-8.5 rounded-xl px-2.5 text-xs font-bold border focus:outline-none ${
                  priority === "urgent" 
                    ? "bg-red-50 text-red-700 border-red-200" 
                    : "bg-slate-50 text-slate-700 border-slate-200"
                }`}
              >
                <option value="normal">Normal</option>
                <option value="urgent">🚨 Urgent</option>
              </select>
            </div>
          </div>

          {/* Customer info (Optional) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                Patient / Customer
              </label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Optional"
                className="h-8.5 text-xs bg-slate-50 border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                Phone No
              </label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="03xx-xxxxxxx"
                className="h-8.5 text-xs bg-slate-50 border-slate-200 rounded-xl"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
              Remarks / Supplier / Company Note
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. GSK / Muller & Phipps"
              className="h-8.5 text-xs bg-slate-50 border-slate-200 rounded-xl"
            />
          </div>

          {/* Actions */}
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
              className="h-9 px-5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BookOpen className="h-3.5 w-3.5" />
              )}
              Add to Short Book
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
