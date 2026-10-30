"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Fuel, PlusCircle, Search, Edit, Trash2, 
  Loader2, Save, X, Layers, AlertCircle, Droplet 
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FuelTank = {
  id: string;
  fuel_type: string; // Petrol, Diesel, Hi-Octane
  capacity: number; // in liters
  current_dip: number; // in liters
  created_at: string;
};

export default function FuelTanksPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [tanks, setTanks] = useState<FuelTank[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTank, setEditingTank] = useState<FuelTank | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fuel_type: "Petrol",
    capacity: 25000,
    current_dip: 12000
  });

  useEffect(() => {
    if (shopId) {
      fetchTanks();
    }
  }, [shopId]);

  const fetchTanks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fuel_tanks")
        .select("id, fuel_type, capacity, current_dip, created_at")
        .eq("shop_id", shopId)
        .order("fuel_type", { ascending: true });

      if (error) throw error;
      setTanks(data || []);
    } catch (err: any) {
      toast.error("Failed to load fuel tanks: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingTank(null);
    setFormData({
      fuel_type: "Petrol",
      capacity: 20000,
      current_dip: 10000
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: FuelTank) => {
    setEditingTank(t);
    setFormData({
      fuel_type: t.fuel_type,
      capacity: t.capacity,
      current_dip: t.current_dip
    });
    setIsModalOpen(true);
  };

  const handleSaveTank = async () => {
    if (formData.current_dip > formData.capacity) {
      toast.error("Current dip cannot exceed total tank capacity.");
      return;
    }

    setIsSubmitting(true);
    try {
      const dbPayload = {
        shop_id: shopId,
        fuel_type: formData.fuel_type,
        capacity: formData.capacity,
        current_dip: formData.current_dip
      };

      if (editingTank) {
        const { error } = await supabase
          .from("fuel_tanks")
          .update(dbPayload)
          .eq("id", editingTank.id);

        if (error) throw error;
        toast.success("Fuel tank configuration updated!");
      } else {
        const { error } = await supabase
          .from("fuel_tanks")
          .insert(dbPayload);

        if (error) throw error;
        toast.success("New fuel tank added successfully!");
      }

      setIsModalOpen(false);
      fetchTanks();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tank? Nozzles linked to it may be affected.")) return;
    try {
      const { error } = await supabase
        .from("fuel_tanks")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Tank configuration deleted.");
      fetchTanks();
    } catch (err: any) {
      toast.error("Failed to delete tank: " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Tank Dips (Fuel Stock)</h2>
          <p className="text-slate-500 mt-1">Configure physical tanks, record dip levels, and track remaining volumes.</p>
        </div>
        <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 self-start md:self-auto">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Fuel Tank
        </Button>
      </div>

      {/* Tanks List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
            <span>Loading tanks catalog...</span>
          </div>
        ) : tanks.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            No fuel storage tanks registered. Click "Add Fuel Tank" to create.
          </div>
        ) : (
          tanks.map(tank => {
            const fillPercentage = Math.round((tank.current_dip / tank.capacity) * 100);
            const isLow = fillPercentage < 20;

            return (
              <motion.div 
                whileHover={{ y: -3 }}
                key={tank.id} 
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <Fuel size={20} className="text-blue-500" /> {tank.fuel_type} Storage Tank
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">ID: {tank.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      isLow 
                        ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm shadow-rose-50' 
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                      {isLow ? 'Critical Low' : 'Stock OK'}
                    </span>
                  </div>

                  {/* Cylinder Stock Visualization */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-24 bg-slate-100 rounded-2xl border-2 border-slate-300 relative overflow-hidden shadow-inner flex flex-col justify-end shrink-0">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${fillPercentage}%` }}
                        transition={{ duration: 1 }}
                        className={`w-full rounded-b-xl ${
                          tank.fuel_type.toLowerCase() === 'petrol' 
                            ? 'bg-gradient-to-t from-amber-500 to-yellow-400' 
                            : tank.fuel_type.toLowerCase() === 'diesel'
                              ? 'bg-gradient-to-t from-emerald-600 to-teal-400'
                              : 'bg-gradient-to-t from-blue-600 to-indigo-400'
                        }`}
                      />
                      <span className="absolute inset-0 flex items-center justify-center font-mono font-black text-xs text-slate-800 z-10">
                        {fillPercentage}%
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Remaining Fuel</span>
                        <p className="text-xl font-black text-slate-800 flex items-center gap-1">
                          {tank.current_dip.toLocaleString()} <span className="text-xs font-medium text-slate-500">Ltrs</span>
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Capacity</span>
                        <p className="text-sm font-bold text-slate-600">
                          {tank.capacity.toLocaleString()} Ltrs
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleOpenEditModal(tank)}
                    className="text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs"
                  >
                    <Edit size={14} className="mr-1" /> Log New Dip
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(tank.id)}
                    className="text-slate-500 hover:text-red-600 hover:bg-slate-100 text-xs"
                  >
                    <Trash2 size={14} className="mr-1" /> Delete
                  </Button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Modal: Add/Edit Tank */}
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
                  {editingTank ? "Log Tank Dip Level" : "Configure Fuel Tank"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Fuel Type</label>
                  <select
                    value={formData.fuel_type}
                    onChange={(e) => setFormData({...formData, fuel_type: e.target.value})}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    disabled={!!editingTank}
                  >
                    <option value="Petrol">Petrol (Super)</option>
                    <option value="Diesel">Diesel (HSD)</option>
                    <option value="Hi-Octane">Hi-Octane (RON 97)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Total Capacity (Liters)</label>
                  <Input 
                    type="number" 
                    value={formData.capacity || ""} 
                    onChange={(e) => setFormData({...formData, capacity: parseFloat(e.target.value) || 0})}
                    disabled={!!editingTank}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Current Dip Reading (Liters)</label>
                  <Input 
                    type="number" 
                    value={formData.current_dip || ""} 
                    onChange={(e) => setFormData({...formData, current_dip: parseFloat(e.target.value) || 0})}
                    className="text-lg font-bold text-blue-600"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Usually checked daily with a physical dip stick measurement.</span>
                </div>

                <Button onClick={handleSaveTank} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Tank Configuration
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
