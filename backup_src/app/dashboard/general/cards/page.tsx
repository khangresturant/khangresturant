"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Gift, Search, PlusCircle, Trash2, CheckCircle, 
  Loader2, Save, X, Calendar, User, RefreshCw, Key 
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type GiftCard = {
  id: string;
  code: string;
  balance: number;
  issued_to: string | null;
  expiry_date: string | null;
  created_at: string;
};

export default function GiftCardsPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    code: "",
    balance: 5000,
    issued_to: "",
    expiry_date: ""
  });

  useEffect(() => {
    if (shopId) {
      fetchGiftCards();
    }
  }, [shopId]);

  const fetchGiftCards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("gift_cards")
        .select("id, code, balance, issued_to, expiry_date, created_at")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCards(data || []);
    } catch (err: any) {
      toast.error("Failed to load gift cards: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateRandomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let block1 = "";
    let block2 = "";
    for (let i = 0; i < 4; i++) {
      block1 += chars.charAt(Math.floor(Math.random() * chars.length));
      block2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code: `GC-${block1}-${block2}` }));
  };

  const handleOpenAddModal = () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    
    setFormData({
      code: "",
      balance: 2000,
      issued_to: "",
      expiry_date: nextYear.toISOString().split("T")[0]
    });
    setIsModalOpen(true);
  };

  const handleSaveGiftCard = async () => {
    if (!formData.code || !formData.issued_to) {
      toast.error("Please enter a card code and recipient name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("gift_cards")
        .insert({
          shop_id: shopId,
          code: formData.code,
          balance: formData.balance,
          issued_to: formData.issued_to,
          expiry_date: formData.expiry_date || null
        });

      if (error) throw error;
      toast.success("Gift card generated and registered successfully!");
      setIsModalOpen(false);
      fetchGiftCards();
    } catch (err: any) {
      toast.error("Failed to save gift card: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate and delete this gift card?")) return;
    try {
      const { error } = await supabase
        .from("gift_cards")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Gift card deleted.");
      fetchGiftCards();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  const filtered = cards.filter(c => 
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.issued_to && c.issued_to.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Gift Cards & Vouchers</h2>
          <p className="text-slate-500 mt-1">Issue unique loyalty vouchers, configure balances, and audit redeems.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by code or customer..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Issue Gift Card
          </Button>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
            <span>Loading active vouchers...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            No gift cards currently active. Click "Issue Gift Card" to create.
          </div>
        ) : (
          filtered.map(card => {
            const isExpired = card.expiry_date && new Date(card.expiry_date) < new Date();

            return (
              <motion.div 
                whileHover={{ y: -3 }}
                key={card.id} 
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
              >
                <div className={`absolute top-0 left-0 w-full h-1.5 ${
                  isExpired 
                    ? 'bg-slate-400' 
                    : card.balance <= 0 
                      ? 'bg-amber-400'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                }`}></div>

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                        <Gift size={18} className="text-indigo-500 animate-bounce" /> {card.issued_to}
                      </h3>
                      <p className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-widest">{card.code}</p>
                    </div>
                    
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      isExpired
                        ? "bg-slate-50 border-slate-200 text-slate-400"
                        : card.balance <= 0
                          ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm"
                    }`}>
                      {isExpired ? "Expired" : card.balance <= 0 ? "Redeemed" : "Active"}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between mb-4 font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Available Credit</span>
                      <p className="text-base font-black text-slate-800">Rs {card.balance.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 font-sans block">Expiry Date</span>
                      <span className="font-bold text-slate-700">
                        {card.expiry_date ? new Date(card.expiry_date).toLocaleDateString() : "Lifetime"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(card.id)}
                    className="text-slate-500 hover:text-red-600 hover:bg-slate-100 text-xs font-bold"
                  >
                    <Trash2 size={14} className="mr-1" /> Deactivate Card
                  </Button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10 font-sans"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-lg">Generate Gift Card Voucher</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Customer / Recipient Name</label>
                  <Input 
                    placeholder="e.g. Zainab Bibi" 
                    value={formData.issued_to}
                    onChange={(e) => setFormData({...formData, issued_to: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5 flex items-center justify-between">
                    Gift Voucher Code
                    <button onClick={generateRandomCode} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                      <RefreshCw size={11} /> Auto Generate
                    </button>
                  </label>
                  <Input 
                    placeholder="e.g. GC-ABCD-1234" 
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    className="font-mono text-center tracking-widest font-black uppercase text-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Voucher Balance (Rs)</label>
                    <Input 
                      type="number" 
                      value={formData.balance || ""}
                      onChange={(e) => setFormData({...formData, balance: parseFloat(e.target.value) || 0})}
                      className="font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Expiry Date</label>
                    <Input 
                      type="date" 
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                    />
                  </div>
                </div>

                <Button onClick={handleSaveGiftCard} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Confirm Card Issuance
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
