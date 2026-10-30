"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Search, PlusCircle, Trash2, Edit, Calendar, 
  Loader2, Save, X, Phone, User, Landmark, Tag 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SeasonalLedger = {
  id: string;
  farmer_name: string;
  farmer_phone: string;
  crop_season: string; // e.g. Rabi 2026, Kharif 2026
  credit_limit: number;
  outstanding_balance: number;
  expected_harvest_payback: string; // date
  status: "active" | "due_harvest" | "settled";
};

const initialLedgers: SeasonalLedger[] = [
  { 
    id: "1", 
    farmer_name: "Chaudhary Niaz", 
    farmer_phone: "03007654321", 
    crop_season: "Rabi (Wheat) 2026", 
    credit_limit: 500000, 
    outstanding_balance: 380000, 
    expected_harvest_payback: "2026-05-15", 
    status: "due_harvest" 
  },
  { 
    id: "2", 
    farmer_name: "Mian Rafique", 
    farmer_phone: "03126549870", 
    crop_season: "Kharif (Cotton) 2026", 
    credit_limit: 800000, 
    outstanding_balance: 150000, 
    expected_harvest_payback: "2026-11-20", 
    status: "active" 
  }
];

export default function SeasonalKhataPage() {
  const [ledgers, setLedgers] = useState<SeasonalLedger[]>(initialLedgers);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [editingLedger, setEditingLedger] = useState<SeasonalLedger | null>(null);
  const [formData, setFormData] = useState({
    farmer_name: "",
    farmer_phone: "",
    crop_season: "Rabi (Wheat) 2026",
    credit_limit: 400000,
    outstanding_balance: 0,
    expected_harvest_payback: "",
    status: "active" as any
  });

  const handleOpenAddModal = () => {
    setEditingLedger(null);
    const harvestDate = new Date();
    harvestDate.setMonth(harvestDate.getMonth() + 6);
    
    setFormData({
      farmer_name: "",
      farmer_phone: "",
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
    setFormData({ ...l });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.farmer_name || !formData.crop_season || !formData.expected_harvest_payback) {
      toast.error("Please fill all required seasonal ledger fields.");
      return;
    }

    if (formData.outstanding_balance > formData.credit_limit) {
      toast.error("Outstanding balance cannot exceed credit limit.");
      return;
    }

    if (editingLedger) {
      setLedgers(prev => prev.map(l => l.id === editingLedger.id ? { ...l, ...formData } : l));
      toast.success("Seasonal ledger entry updated successfully!");
    } else {
      const newL: SeasonalLedger = {
        id: Math.random().toString(),
        ...formData
      };
      setLedgers([newL, ...ledgers]);
      toast.success("New seasonal farmer ledger registered!");
    }
    setIsModalOpen(false);
  };

  const updateStatus = (id: string, status: "active" | "due_harvest" | "settled") => {
    setLedgers(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    toast.success(`Farmer account status marked as ${status}`);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this seasonal account log?")) return;
    setLedgers(prev => prev.filter(l => l.id !== id));
    toast.success("Account record deleted.");
  };

  const filtered = ledgers.filter(l => 
    l.farmer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.crop_season.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Seasonal Farmer Khata</h2>
          <p className="text-slate-500 mt-1">Book credit for chemical bags/seeds and configure crop-wise payback deadlines.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search farmer or crop..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Open Account
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(item => {
          const limitPercentage = Math.round((item.outstanding_balance / item.credit_limit) * 100);

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
                      <User size={16} className="text-slate-400" /> {item.farmer_name}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone size={10} /> {item.farmer_phone}</p>
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
                    <span>Payback Due: {new Date(item.expected_harvest_payback).toLocaleDateString()}</span>
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
                <h3 className="font-bold text-slate-800 text-lg">
                  {editingLedger ? "Adjust Seasonal Balance" : "Open Farmer Seasonal Khata"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Farmer Name</label>
                  <Input 
                    placeholder="e.g. Chaudhary Liaqat Ali" 
                    value={formData.farmer_name}
                    onChange={(e) => setFormData({...formData, farmer_name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Phone Number</label>
                  <Input 
                    placeholder="e.g. 03001234567" 
                    value={formData.farmer_phone}
                    onChange={(e) => setFormData({...formData, farmer_phone: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Crop Season Cycle</label>
                  <select
                    value={formData.crop_season}
                    onChange={(e) => setFormData({...formData, crop_season: e.target.value})}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Rabi (Wheat) 2026">Rabi (Wheat) 2026</option>
                    <option value="Kharif (Cotton) 2026">Kharif (Cotton) 2026</option>
                    <option value="Rabi (Sugarcane) 2026">Rabi (Sugarcane) 2026</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Max Credit Limit</label>
                    <Input 
                      type="number"
                      value={formData.credit_limit || ""}
                      onChange={(e) => setFormData({...formData, credit_limit: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Expected Payback Date</label>
                    <Input 
                      type="date" 
                      value={formData.expected_harvest_payback}
                      onChange={(e) => setFormData({...formData, expected_harvest_payback: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Outstanding Outstanding Debt (Rs)</label>
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
