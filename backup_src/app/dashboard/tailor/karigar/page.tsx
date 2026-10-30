"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Search, PlusCircle, CreditCard, Banknote, 
  Trash2, Edit, Loader2, Save, X, Phone, User, Activity 
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Karigar = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  created_at: string;
};

export default function KarigarsPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals State
  const [isKarigarModalOpen, setIsKarigarModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedKarigar, setSelectedKarigar] = useState<Karigar | null>(null);

  // Forms State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingKarigar, setEditingKarigar] = useState<Karigar | null>(null);
  
  const [newKarigar, setNewKarigar] = useState({
    name: "",
    phone: ""
  });

  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  useEffect(() => {
    if (shopId) {
      fetchKarigars();
    }
  }, [shopId]);

  const fetchKarigars = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("karigars")
        .select("id, name, phone, balance, created_at")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (error) throw error;
      setKarigars(data || []);
    } catch (err: any) {
      toast.error("Failed to load Karigars: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingKarigar(null);
    setNewKarigar({ name: "", phone: "" });
    setIsKarigarModalOpen(true);
  };

  const handleOpenEditModal = (k: Karigar) => {
    setEditingKarigar(k);
    setNewKarigar({
      name: k.name,
      phone: k.phone || ""
    });
    setIsKarigarModalOpen(true);
  };

  const handleSaveKarigar = async () => {
    if (!newKarigar.name) {
      toast.error("Karigar Name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const dbPayload = {
        shop_id: shopId,
        name: newKarigar.name,
        phone: newKarigar.phone || null
      };

      if (editingKarigar) {
        const { error } = await supabase
          .from("karigars")
          .update(dbPayload)
          .eq("id", editingKarigar.id);

        if (error) throw error;
        toast.success("Karigar profile updated!");
      } else {
        const { error } = await supabase
          .from("karigars")
          .insert({ ...dbPayload, balance: 0 });

        if (error) throw error;
        toast.success("New Karigar added!");
      }

      setIsKarigarModalOpen(false);
      fetchKarigars();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayKarigar = async () => {
    if (!selectedKarigar || paymentAmount <= 0) {
      toast.error("Please enter a valid payout amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Decrement Karigar balance in DB
      const { error } = await supabase.rpc("decrement_karigar_balance", {
        k_id: selectedKarigar.id,
        amount: paymentAmount
      });

      if (error) throw error;

      // 2. Also register this payout in expenses table if we want, or just log
      // For now, simple notification
      toast.success(`Wage payout of Rs ${paymentAmount} recorded!`);
      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
      fetchKarigars();
    } catch (err: any) {
      toast.error("Failed to post payout: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this Karigar profile?")) return;
    try {
      const { error } = await supabase
        .from("karigars")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Karigar removed.");
      fetchKarigars();
    } catch (err: any) {
      toast.error("Failed to delete profile: " + err.message);
    }
  };

  const filtered = karigars.filter(k => 
    k.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (k.phone && k.phone.includes(searchQuery))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Karigar Ledger & Wages</h2>
          <p className="text-slate-500 mt-1">Track pending stitching wages, payouts, and worker contact sheets.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search Karigars..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Karigar
          </Button>
        </div>
      </div>

      {/* Karigars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
            <span>Loading karigar data...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            No Karigars added yet. Click "Add Karigar" to create worker files.
          </div>
        ) : (
          filtered.map(item => (
            <motion.div 
              whileHover={{ y: -3 }}
              key={item.id} 
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
              
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                      <User size={16} className="text-slate-400" /> {item.name}
                    </h3>
                    {item.phone && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone size={10} /> {item.phone}</p>
                    )}
                  </div>
                  <span className="bg-blue-50 text-blue-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                    Karigar Active
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Payable Wage</span>
                    <p className="text-lg font-black text-slate-800">Rs {item.balance.toLocaleString()}</p>
                  </div>
                  <Button 
                    onClick={() => { setSelectedKarigar(item); setIsPaymentModalOpen(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9"
                    disabled={item.balance <= 0}
                  >
                    <Banknote size={14} className="mr-1" /> Pay Wage
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleOpenEditModal(item)}
                  className="text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs"
                >
                  <Edit size={14} className="mr-1" /> Edit Profile
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDelete(item.id)}
                  className="text-slate-500 hover:text-red-600 hover:bg-slate-100 text-xs"
                >
                  <Trash2 size={14} className="mr-1" /> Remove
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Modal: Add/Edit Karigar */}
      <AnimatePresence>
        {isKarigarModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsKarigarModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-lg">
                  {editingKarigar ? "Edit Karigar Details" : "Add New Karigar"}
                </h3>
                <button onClick={() => setIsKarigarModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Karigar Name</label>
                  <Input 
                    placeholder="e.g. Master Shabbir" 
                    value={newKarigar.name}
                    onChange={(e) => setNewKarigar({...newKarigar, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Phone Number</label>
                  <Input 
                    placeholder="e.g. 03211234567" 
                    value={newKarigar.phone}
                    onChange={(e) => setNewKarigar({...newKarigar, phone: e.target.value})}
                  />
                </div>

                <Button onClick={handleSaveKarigar} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Profile
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Pay Wage */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedKarigar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsPaymentModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Disburse Karigar Wage</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Pay to: {selectedKarigar.name}</p>
                </div>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">Outstanding balance:</span>
                  <span className="font-black text-slate-800">Rs {selectedKarigar.balance.toLocaleString()}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Wage Amount to Pay (Rs)</label>
                  <Input 
                    type="number" 
                    placeholder="Enter amount..." 
                    value={paymentAmount || ""} 
                    onChange={(e) => setPaymentAmount(Math.min(selectedKarigar.balance, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="text-lg font-bold"
                  />
                </div>

                <Button onClick={handlePayKarigar} disabled={isSubmitting || paymentAmount <= 0} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="mr-2 h-4 w-4" />}
                  Confirm Cash Payment
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
