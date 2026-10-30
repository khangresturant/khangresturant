"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Leaf, Search, PlusCircle, Calendar, Trash2, Edit, 
  Loader2, Save, X, Beaker, FileText, Activity 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FertBatch = {
  id: string;
  name: string;
  batch_number: string;
  strength: string; // e.g. 46% Nitrogen
  mfg_date: string;
  expiry_date: string;
  stock_bags: number;
};

const initialBatches: FertBatch[] = [
  { id: "1", name: "Sona Urea (Engro)", batch_number: "UR-2026-09", strength: "46% Nitrogen Nitrogenous", mfg_date: "2026-01-10", expiry_date: "2029-01-10", stock_bags: 450 },
  { id: "2", name: "Sarsabz DAP", batch_number: "DP-2026-11", strength: "18% Nitrogen, 46% Phosphorus", mfg_date: "2026-02-15", expiry_date: "2028-02-15", stock_bags: 120 },
  { id: "3", name: "Pioneer 30T60 Corn Seeds", batch_number: "SD-SEED-55", strength: "F1 Hybrid Seed Germination 98%", mfg_date: "2026-03-01", expiry_date: "2027-03-01", stock_bags: 85 }
];

export default function FertilizerBatchesPage() {
  const [batches, setBatches] = useState<FertBatch[]>(initialBatches);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [editingBatch, setEditingBatch] = useState<FertBatch | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    batch_number: "",
    strength: "",
    mfg_date: "",
    expiry_date: "",
    stock_bags: 100
  });

  const handleOpenAddModal = () => {
    setEditingBatch(null);
    const today = new Date().toISOString().split("T")[0];
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 2);
    
    setFormData({
      name: "",
      batch_number: "",
      strength: "46% Nitrogenous Urea",
      mfg_date: today,
      expiry_date: exp.toISOString().split("T")[0],
      stock_bags: 150
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (b: FertBatch) => {
    setEditingBatch(b);
    setFormData({ ...b });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.batch_number) {
      toast.error("Please fill all required batch catalog fields.");
      return;
    }

    if (editingBatch) {
      setBatches(prev => prev.map(b => b.id === editingBatch.id ? { ...b, ...formData } : b));
      toast.success("Batch credentials updated!");
    } else {
      const newB: FertBatch = {
        id: Math.random().toString(),
        ...formData
      };
      setBatches([newB, ...batches]);
      toast.success("Fertilizer seed batch cataloged!");
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this chemical/seed batch from logs?")) return;
    setBatches(prev => prev.filter(b => b.id !== id));
    toast.success("Batch profile deleted.");
  };

  const filtered = batches.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.batch_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Seeds & Fertilizer Batches</h2>
          <p className="text-slate-500 mt-1">Audit chemical properties, trace manufacturer serial keys, and log stock sacks.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search batches..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Batch
          </Button>
        </div>
      </div>

      {/* Batches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(item => (
          <motion.div 
            whileHover={{ y: -3 }}
            key={item.id} 
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>

            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                    <Leaf size={18} className="text-emerald-500" /> {item.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Batch: {item.batch_number} • MFG: {item.mfg_date}</p>
                </div>
                <span className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-black uppercase">
                  Chemical Verified
                </span>
              </div>

              <p className="text-xs text-slate-500 flex items-center gap-1 mb-4">
                <Beaker size={12} className="text-blue-500" /> Strength: <strong>{item.strength}</strong>
              </p>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between mb-4 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Total Stock</span>
                  <p className="text-base font-black text-slate-800">{item.stock_bags} Bags</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 font-sans font-semibold block">Expiry Date</span>
                  <span className="font-bold text-slate-700">{new Date(item.expiry_date).toLocaleDateString()}</span>
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
                <Edit size={14} className="mr-1" /> Edit specs
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleDelete(item.id)}
                className="text-slate-500 hover:text-red-600 hover:bg-slate-100 text-xs font-bold"
              >
                <Trash2 size={14} className="mr-1" /> Delete
              </Button>
            </div>
          </motion.div>
        ))}
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
                  {editingBatch ? "Edit Batch Specs" : "Add Fertilizer/Seed Batch"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Product Name</label>
                  <Input 
                    placeholder="e.g. Sona Urea Sacks" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Batch Code / Serial</label>
                  <Input 
                    placeholder="e.g. UR-100-26" 
                    value={formData.batch_number}
                    onChange={(e) => setFormData({...formData, batch_number: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Composition / Germination Rate</label>
                  <Input 
                    placeholder="e.g. 46% Nitrogen, 98% Germination" 
                    value={formData.strength}
                    onChange={(e) => setFormData({...formData, strength: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Manufacture Date</label>
                    <Input 
                      type="date" 
                      value={formData.mfg_date}
                      onChange={(e) => setFormData({...formData, mfg_date: e.target.value})}
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

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Opening Stock (Bags / Sacks)</label>
                  <Input 
                    type="number"
                    value={formData.stock_bags || ""}
                    onChange={(e) => setFormData({...formData, stock_bags: parseInt(e.target.value) || 0})}
                  />
                </div>

                <Button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  Save Batch Specifications
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
