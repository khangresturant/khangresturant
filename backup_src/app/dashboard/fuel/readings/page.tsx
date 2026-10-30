"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Fuel, Search, PlusCircle, Calendar, DollarSign, 
  Trash2, Edit, Loader2, Save, X, Activity, Calculator, AlertTriangle 
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ShiftReading = {
  id: string;
  nozzle_number: number;
  fuel_type: string;
  opening_reading: number;
  closing_reading: number;
  cash_collected: number;
  shortage_amount: number;
  shift_date: string;
  created_at: string;
};

export default function FuelShiftReadingsPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [readings, setReadings] = useState<ShiftReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingReading, setEditingReading] = useState<ShiftReading | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    nozzle_number: 1,
    fuel_type: "Petrol",
    opening_reading: 105423.5,
    closing_reading: 105820.2,
    cash_collected: 90000,
    shortage_amount: 0,
    shift_date: new Date().toISOString().split("T")[0]
  });

  // Dynamic helper states for shortage auto-calculation
  const [fuelSalePrice, setFuelSalePrice] = useState<number>(270); // Average price per liter in PKR

  useEffect(() => {
    if (shopId) {
      fetchReadings();
    }
  }, [shopId]);

  // Recalculate shortage on changes
  useEffect(() => {
    const soldLiters = Math.max(0, formData.closing_reading - formData.opening_reading);
    const expectedCash = soldLiters * fuelSalePrice;
    const shortage = expectedCash - formData.cash_collected;
    setFormData(prev => ({ ...prev, shortage_amount: Number(shortage.toFixed(2)) }));
  }, [formData.opening_reading, formData.closing_reading, formData.cash_collected, fuelSalePrice]);

  const fetchReadings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fuel_shift_readings")
        .select("id, nozzle_number, fuel_type, opening_reading, closing_reading, cash_collected, shortage_amount, shift_date, created_at")
        .eq("shop_id", shopId)
        .order("shift_date", { ascending: false });

      if (error) throw error;
      setReadings(data || []);
    } catch (err: any) {
      toast.error("Failed to load shift readings: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingReading(null);
    setFormData({
      nozzle_number: 1,
      fuel_type: "Petrol",
      opening_reading: readings[0]?.closing_reading || 50000,
      closing_reading: (readings[0]?.closing_reading || 50000) + 100,
      cash_collected: 27000,
      shortage_amount: 0,
      shift_date: new Date().toISOString().split("T")[0]
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (r: ShiftReading) => {
    setEditingReading(r);
    setFormData({
      nozzle_number: r.nozzle_number,
      fuel_type: r.fuel_type,
      opening_reading: Number(r.opening_reading) || 0,
      closing_reading: Number(r.closing_reading) || 0,
      cash_collected: Number(r.cash_collected) || 0,
      shortage_amount: Number(r.shortage_amount) || 0,
      shift_date: r.shift_date
    });
    setIsModalOpen(true);
  };

  const handleSaveReading = async () => {
    if (formData.closing_reading < formData.opening_reading) {
      toast.error("Closing reading cannot be lower than opening reading.");
      return;
    }

    setIsSubmitting(true);
    try {
      const dbPayload = {
        shop_id: shopId,
        nozzle_number: formData.nozzle_number,
        fuel_type: formData.fuel_type,
        opening_reading: formData.opening_reading,
        closing_reading: formData.closing_reading,
        cash_collected: formData.cash_collected,
        shortage_amount: formData.shortage_amount,
        shift_date: formData.shift_date
      };

      if (editingReading) {
        const { error } = await supabase
          .from("fuel_shift_readings")
          .update(dbPayload)
          .eq("id", editingReading.id);

        if (error) throw error;
        toast.success("Shift reading updated!");
      } else {
        const { error } = await supabase
          .from("fuel_shift_readings")
          .insert(dbPayload);

        if (error) throw error;
        toast.success("Shift reading saved!");
      }

      setIsModalOpen(false);
      fetchReadings();
    } catch (err: any) {
      toast.error("Failed to save shift reading: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shift log?")) return;
    try {
      const { error } = await supabase
        .from("fuel_shift_readings")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Shift log deleted.");
      fetchReadings();
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    }
  };

  const filtered = readings.filter(r => 
    r.fuel_type.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.nozzle_number.toString() === searchQuery
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Shift Readings & Nozzles</h2>
          <p className="text-slate-500 mt-1">Record nozzle meter sessions, verify cash counters, and compute sales shortages.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by fuel or nozzle..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Record Shift Reading
          </Button>
        </div>
      </div>

      {/* Readings Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-6 py-4">Shift Date</th>
                <th className="px-6 py-4 text-center">Nozzle</th>
                <th className="px-6 py-4">Fuel Type</th>
                <th className="px-6 py-4 text-right">Meter Session (Ltrs)</th>
                <th className="px-6 py-4 text-right">Liters Sold</th>
                <th className="px-6 py-4 text-right">Cash Collected</th>
                <th className="px-6 py-4 text-right">Shortage</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">Loading shift entries...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                    No shift nozzle readings recorded yet.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const soldLiters = item.closing_reading - item.opening_reading;
                  const isShort = item.shortage_amount > 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors font-mono text-xs">
                      <td className="px-6 py-4 font-sans text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-slate-400" />
                          {new Date(item.shift_date).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-sans font-bold">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                          Nozzle {item.nozzle_number}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-sans font-bold text-slate-700">{item.fuel_type}</td>
                      <td className="px-6 py-4 text-right text-slate-500">
                        {item.opening_reading.toFixed(1)} → {item.closing_reading.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-800">
                        {soldLiters.toFixed(1)} Ltrs
                      </td>
                      <td className="px-6 py-4 text-right font-black text-emerald-600">
                        Rs {item.cash_collected.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.shortage_amount !== 0 ? (
                          <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            isShort 
                              ? "bg-red-50 text-red-700 border border-red-100" 
                              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}>
                            {isShort ? `Short: Rs ${item.shortage_amount}` : `Excess: Rs ${Math.abs(item.shortage_amount)}`}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Nil</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleOpenEditModal(item)}
                          className="text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(item.id)}
                          className="text-slate-500 hover:text-red-600 hover:bg-slate-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add/Edit Reading */}
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
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-lg">
                  {editingReading ? "Edit Shift Reading" : "Record Shift Session"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Nozzle Number</label>
                    <Input 
                      type="number" 
                      value={formData.nozzle_number || ""}
                      onChange={(e) => setFormData({...formData, nozzle_number: parseInt(e.target.value) || 1})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Fuel Type</label>
                    <select
                      value={formData.fuel_type}
                      onChange={(e) => setFormData({...formData, fuel_type: e.target.value})}
                      className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Petrol">Petrol</option>
                      <option value="Diesel">Diesel</option>
                      <option value="Hi-Octane">Hi-Octane</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Opening Meter (L)</label>
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={formData.opening_reading || ""}
                      onChange={(e) => setFormData({...formData, opening_reading: parseFloat(e.target.value) || 0})}
                      className="font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Closing Meter (L)</label>
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={formData.closing_reading || ""}
                      onChange={(e) => setFormData({...formData, closing_reading: parseFloat(e.target.value) || 0})}
                      className="font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Current Fuel Price (Rs)</label>
                    <Input 
                      type="number" 
                      value={fuelSalePrice || ""} 
                      onChange={(e) => setFuelSalePrice(parseFloat(e.target.value) || 0)}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cash Collected (Rs)</label>
                    <Input 
                      type="number" 
                      value={formData.cash_collected || ""} 
                      onChange={(e) => setFormData({...formData, cash_collected: parseFloat(e.target.value) || 0})}
                      className="font-mono font-bold text-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Shift Date</label>
                  <Input 
                    type="date" 
                    value={formData.shift_date} 
                    onChange={(e) => setFormData({...formData, shift_date: e.target.value})}
                  />
                </div>

                {/* Auto Shortage Calculator Box */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2 space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Calculator size={13} /> Liters Sold:</span>
                    <span className="font-bold text-slate-700 font-mono">
                      {(formData.closing_reading - formData.opening_reading).toFixed(1)} L
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>Expected Cash:</span>
                    <span className="font-bold text-slate-700 font-mono">
                      Rs {((formData.closing_reading - formData.opening_reading) * fuelSalePrice).toLocaleString(undefined, {maximumFractionDigits: 2})}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-2 font-bold">
                    <span className="text-slate-600">Expected Shortage:</span>
                    <span className={`font-mono text-sm ${formData.shortage_amount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      Rs {formData.shortage_amount}
                    </span>
                  </div>
                </div>

                <Button onClick={handleSaveReading} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Shift Log
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
