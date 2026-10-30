"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Search, PlusCircle, Trash2, Edit, Calendar, 
  Loader2, X, Phone, User, Landmark
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";

type Farmer = {
  id: string;
  name: string;
  phone: string | null;
};

type SeasonalLedger = {
  id: string;
  party_id: string;
  crop_season: string; // e.g. Rabi 2026, Kharif 2026
  credit_limit: number;
  outstanding_balance: number;
  expected_harvest_payback: string; // date
  status: "active" | "due_harvest" | "settled";
  parties?: Farmer;
};

export default function SeasonalKhataPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [ledgers, setLedgers] = useState<SeasonalLedger[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cropSeasons, setCropSeasons] = useState<string[]>([
    "Rabi (Wheat) 2026",
    "Kharif (Cotton) 2026",
    "Kharif (Rice) 2026",
    "Rabi (Sugarcane) 2026-27"
  ]);

  // Form State
  const [editingLedger, setEditingLedger] = useState<SeasonalLedger | null>(null);
  const [formData, setFormData] = useState({
    party_id: "",
    crop_season: "Rabi (Wheat) 2026",
    credit_limit: 500000,
    outstanding_balance: 0,
    expected_harvest_payback: "",
    status: "active" as any
  });

  useEffect(() => {
    if (shopId) {
      fetchData();
    }
  }, [shopId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch farmers (parties)
      const { data: farmerData, error: farmerErr } = await supabase
        .from("parties")
        .select("id, name, phone")
        .eq("shop_id", shopId)
        .eq("type", "customer")
        .order("name");
      if (farmerErr) throw farmerErr;
      setFarmers(farmerData || []);

      // 2. Fetch seasonal khatas
      const { data: khataData, error: khataErr } = await supabase
        .from("seasonal_khata")
        .select(`
          id,
          party_id,
          crop_season,
          credit_limit,
          outstanding_balance,
          expected_harvest_payback,
          status,
          parties (id, name, phone)
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });
      if (khataErr) throw khataErr;

      const formatted = (khataData || []).map((k: any) => ({
        id: k.id,
        party_id: k.party_id,
        crop_season: k.crop_season,
        credit_limit: Number(k.credit_limit) || 0,
        outstanding_balance: Number(k.outstanding_balance) || 0,
        expected_harvest_payback: k.expected_harvest_payback || "",
        status: k.status || "active",
        parties: k.parties || { id: "", name: "Unknown Farmer", phone: "" }
      }));

      setLedgers(formatted);

      if (khataData) {
        const dbSeasons = Array.from(new Set(khataData.map((k: any) => String(k.crop_season)).filter(Boolean)));
        setCropSeasons(prev => {
          const combined = [...prev, ...dbSeasons];
          return Array.from(new Set(combined)) as string[];
        });
      }
    } catch (err: any) {
      toast.error("Failed to load seasonal ledger: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingLedger(null);
    const harvestDate = new Date();
    harvestDate.setMonth(harvestDate.getMonth() + 6);
    
    setFormData({
      party_id: farmers[0]?.id || "",
      crop_season: "Rabi (Wheat) 2026",
      credit_limit: 500000,
      outstanding_balance: 0,
      expected_harvest_payback: harvestDate.toISOString().split("T")[0],
      status: "active"
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (l: SeasonalLedger) => {
    setEditingLedger(l);
    setFormData({
      party_id: l.party_id,
      crop_season: l.crop_season,
      credit_limit: l.credit_limit,
      outstanding_balance: l.outstanding_balance,
      expected_harvest_payback: l.expected_harvest_payback,
      status: l.status
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.party_id || !formData.crop_season || !formData.expected_harvest_payback) {
      toast.error("Please select a farmer, season, and payback date.");
      return;
    }

    try {
      if (editingLedger) {
        const { error } = await supabase
          .from("seasonal_khata")
          .update({
            party_id: formData.party_id,
            crop_season: formData.crop_season,
            credit_limit: formData.credit_limit,
            outstanding_balance: formData.outstanding_balance,
            expected_harvest_payback: formData.expected_harvest_payback || null,
            status: formData.status
          })
          .eq("id", editingLedger.id);

        if (error) throw error;
        toast.success("Seasonal ledger entry updated!");
      } else {
        const { error } = await supabase
          .from("seasonal_khata")
          .insert({
            shop_id: shopId,
            party_id: formData.party_id,
            crop_season: formData.crop_season,
            credit_limit: formData.credit_limit,
            outstanding_balance: formData.outstanding_balance,
            expected_harvest_payback: formData.expected_harvest_payback || null,
            status: formData.status
          });

        if (error) throw error;
        toast.success("New seasonal farmer ledger registered!");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to save ledger: " + err.message);
    }
  };

  const updateStatus = async (id: string, status: "active" | "due_harvest" | "settled") => {
    try {
      const { error } = await supabase
        .from("seasonal_khata")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Farmer account status marked as ${status}`);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this seasonal account log?")) return;
    try {
      const { error } = await supabase
        .from("seasonal_khata")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Account record deleted.");
      fetchData();
    } catch (err: any) {
      toast.error("Failed to delete record: " + err.message);
    }
  };

  const filtered = ledgers.filter(l => 
    (l.parties?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.crop_season.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900">Seasonal Farmer Khata</h2>
          
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search farmer or crop..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200 text-slate-900"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Open Account
          </Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
          
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 border border-dashed rounded-2xl">
          
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(item => {
            const limitPercentage = item.credit_limit > 0 
              ? Math.min(100, Math.round((item.outstanding_balance / item.credit_limit) * 100))
              : 0;

            return (
              <motion.div 
                whileHover={{ y: -3 }}
                key={item.id} 
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
              >
                <div className={`absolute top-0 left-0 w-full h-1.5 ${
                  item.status === 'settled' 
                    ? 'bg-emerald-500' 
                    : item.status === 'due_harvest' 
                      ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]' 
                      : 'bg-blue-500'
                }`}></div>

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <User size={16} className="text-slate-400" /> {item.parties?.name}
                      </h3>
                      
                    </div>
                    
                    <select
                      value={item.status}
                      onChange={(e) => updateStatus(item.id, e.target.value as any)}
                      className={`text-xs font-bold border rounded px-2 py-1 focus:outline-none ${
                        item.status === "settled"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : item.status === "due_harvest"
                            ? "bg-amber-50 border-amber-200 text-amber-800"
                            : "bg-blue-50 border-blue-200 text-blue-800"
                      }`}
                    >
                      <option value="active">Active</option>
                      <option value="due_harvest">Due Harvest</option>
                      <option value="settled">Settled</option>
                    </select>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 mb-4">
                    <div className="flex justify-between text-xs text-slate-500 font-bold">
                      <span>Season: {item.crop_season}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-2 font-mono">
                      <span>Payback Due: {item.expected_harvest_payback ? new Date(item.expected_harvest_payback).toLocaleDateString() : "N/A"}</span>
                      <span className="font-black text-slate-800">Limit: Rs {item.credit_limit.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Credit Limit Usage Progress Bar */}
                  <div className="space-y-1 mb-4 text-xs font-sans">
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold uppercase">
                      <span>Credit Limit Usage</span>
                      <span>{limitPercentage}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${limitPercentage > 80 ? 'bg-red-500' : 'bg-blue-600'}`} 
                        style={{ width: `${limitPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Outstanding Debt</span>
                      <p className="text-base font-black text-rose-600">Rs {item.outstanding_balance.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 font-sans block">Remaining Limit</span>
                      <span className="font-bold text-slate-700">Rs {(item.credit_limit - item.outstanding_balance).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleOpenEditModal(item)}
                    className="text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs font-bold"
                  >
                    <Edit size={14} className="mr-1" /> Adjust Debt
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(item.id)}
                    className="text-slate-500 hover:text-red-600 hover:bg-slate-100 text-xs font-bold"
                  >
                    <Trash2 size={14} className="mr-1" /> Close Khata
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

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
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10 font-sans text-slate-800"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-lg">
                  {editingLedger ? "Adjust Seasonal Balance" : "Open Farmer Seasonal Khata"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Select Farmer</label>
                  <select
                    value={formData.party_id}
                    onChange={(e) => setFormData({...formData, party_id: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">-- Choose Farmer --</option>
                    {farmers.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Crop Season Cycle</label>
                  <select
                    value={formData.crop_season}
                    onChange={(e) => {
                      if (e.target.value === "add_custom") {
                        const name = prompt("Enter Custom Crop Season Name (e.g., Rabi (Maize) 2026):");
                        if (name && name.trim()) {
                          const trimmed = name.trim();
                          setCropSeasons(prev => {
                            if (prev.includes(trimmed)) return prev;
                            return [...prev, trimmed];
                          });
                          setFormData({ ...formData, crop_season: trimmed });
                        }
                      } else {
                        setFormData({ ...formData, crop_season: e.target.value });
                      }
                    }}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {cropSeasons.map(season => (
                      <option key={season} value={season}>{season}</option>
                    ))}
                    <option value="add_custom" className="text-emerald-600 font-bold">+ Add Custom Season...</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Max Credit Limit</label>
                    <Input 
                      type="number"
                      value={formData.credit_limit || ""}
                      onChange={(e) => setFormData({...formData, credit_limit: parseFloat(e.target.value) || 0})}
                      className="text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Expected Payback Date</label>
                    <Input 
                      type="date" 
                      value={formData.expected_harvest_payback}
                      onChange={(e) => setFormData({...formData, expected_harvest_payback: e.target.value})}
                      className="text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Outstanding Debt (Rs)</label>
                  <Input 
                    type="number"
                    value={formData.outstanding_balance || ""}
                    onChange={(e) => setFormData({...formData, outstanding_balance: parseFloat(e.target.value) || 0})}
                    className="text-lg font-bold text-rose-600"
                  />
                </div>

                <Button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  Save Account Book
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
