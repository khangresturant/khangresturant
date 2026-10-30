"use client";
import { motion, AnimatePresence } from "framer-motion";
import { User, X, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { toast } from "sonner";
import type { Supplier } from "./types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSupplierAdded: (supplier: Supplier) => void;
};

export function AddSupplierModal({ isOpen, onClose, onSupplierAdded }: Props) {
  const { shopId } = useShop();
  const supabase = createClient();
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !shopId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("parties").insert({
        shop_id: shopId, type: "supplier",
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        current_balance: 0,
      }).select().single();
      if (error) throw error;
      onSupplierAdded(data);
      setForm({ name: "", phone: "", address: "" });
      onClose();
      toast.success("Supplier added!");
    } catch (err: any) {
      toast.error("Failed to add supplier: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6"
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <User size={18} className="text-violet-600" /> Add New Supplier
              </h3>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Supplier Name *</label>
                <Input required placeholder="Enter supplier name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-violet-500/30" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Phone Number</label>
                <Input type="tel" placeholder="03xx-xxxxxxx" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-violet-500/30" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Address</label>
                <Input placeholder="City / Address (optional)" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-violet-500/30" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2.5 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 disabled:opacity-60">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {saving ? "Saving..." : "Add Supplier"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
