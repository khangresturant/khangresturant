"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Factory, Search, PlusCircle, Trash2, Edit, 
  Loader2, Save, X, FileSpreadsheet, Beaker 
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Formulation = {
  id: string;
  name: string; // Generic composition
  description: string | null;
  created_at: string;
};

export default function FormulationsPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [formulations, setFormulations] = useState<Formulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingFormula, setEditingFormula] = useState<Formulation | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: ""
  });

  useEffect(() => {
    if (shopId) {
      fetchFormulations();
    }
  }, [shopId]);

  const fetchFormulations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("formulations")
        .select("id, name, description, created_at")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (error) throw error;
      setFormulations(data || []);
    } catch (err: any) {
      toast.error("Failed to load formulations: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingFormula(null);
    setFormData({ name: "", description: "" });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (f: Formulation) => {
    setEditingFormula(f);
    setFormData({
      name: f.name,
      description: f.description || ""
    });
    setIsModalOpen(true);
  };

  const handleSaveFormulation = async () => {
    if (!formData.name) {
      toast.error("Formulation salt/generic name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const dbPayload = {
        shop_id: shopId,
        name: formData.name,
        description: formData.description || null
      };

      if (editingFormula) {
        const { error } = await supabase
          .from("formulations")
          .update(dbPayload)
          .eq("id", editingFormula.id);

        if (error) throw error;
        toast.success("Formulation updated successfully!");
      } else {
        const { error } = await supabase
          .from("formulations")
          .insert(dbPayload);

        if (error) throw error;
        toast.success("Generic formulation added successfully!");
      }

      setIsModalOpen(false);
      fetchFormulations();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this formulation? Medicine references might be affected.")) return;
    try {
      const { error } = await supabase
        .from("formulations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Formulation deleted.");
      fetchFormulations();
    } catch (err: any) {
      toast.error("Failed to delete formulation: " + err.message);
    }
  };

  const filtered = formulations.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900">Generic Formulations (Salts)</h2>
          <p className="text-slate-500 mt-1">Configure generic salt compositions (e.g. Paracetamol) for quick alternative medicine matches.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search formulations..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Formulation
          </Button>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
            <span>Loading formulations...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            No generic salt formulations configured yet. Click "Add Formulation".
          </div>
        ) : (
          filtered.map(item => (
            <motion.div 
              whileHover={{ y: -3 }}
              key={item.id} 
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between h-44"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600"></div>
              
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Beaker size={18} className="text-blue-500" /> {item.name}
                </h3>
                <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed font-sans">
                  {item.description || "No salt description or precautions configured."}
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleOpenEditModal(item)}
                  className="text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs font-bold"
                >
                  <Edit size={14} className="mr-1" /> Edit Salt
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDelete(item.id)}
                  className="text-slate-500 hover:text-red-600 hover:bg-slate-100 text-xs font-bold"
                >
                  <Trash2 size={14} className="mr-1" /> Remove
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Modal: Add/Edit Formulation */}
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
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-lg">
                  {editingFormula ? "Edit Generic Salt" : "Add Generic Salt"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 font-sans">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Salt / Formula Name</label>
                  <Input 
                    placeholder="e.g. Paracetamol 500mg" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Formula description & Precautions</label>
                  <textarea
                    rows={4}
                    placeholder="Enter salt composition details, alternative salts, standard dosages, or side-effects warnings..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <Button onClick={handleSaveFormulation} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Formulation
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
