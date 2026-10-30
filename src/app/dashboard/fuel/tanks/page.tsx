"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  const [activeTab, setActiveTab] = useState<"catalog" | "reconciliation">("catalog");

  // Reconciliation form states
  const [reconTankId, setReconTankId] = useState("");
  const [fuelReceived, setFuelReceived] = useState(0);
  const [nozzleSales, setNozzleSales] = useState(0);
  const [endingDipStick, setEndingDipStick] = useState(0);
  const [fuelRate, setFuelRate] = useState(270);
  const [isPostingRecon, setIsPostingRecon] = useState(false);

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

  const handlePostReconciliation = async () => {
    if (!reconTankId) {
      toast.error("Please select a storage tank to reconcile.");
      return;
    }
    const tank = tanks.find(t => t.id === reconTankId);
    if (!tank) return;

    const expectedEnding = Number(tank.current_dip) + fuelReceived - nozzleSales;
    const discrepancy = expectedEnding - endingDipStick;

    if (discrepancy < 0) {
      toast.error("Physical dip level cannot be higher than expected book stock!");
      return;
    }

    setIsPostingRecon(true);
    try {
      // 1. Update Tank Dip level to the physical stick level
      const { error: tankErr } = await supabase
        .from("fuel_tanks")
        .update({ current_dip: endingDipStick })
        .eq("id", reconTankId);

      if (tankErr) throw tankErr;

      // 2. If shortage exists, post evaporation loss expense
      if (discrepancy > 0) {
        const lossAmount = Math.round(discrepancy * fuelRate);

        // Fetch first cash account to post from
        const { data: accs } = await supabase
          .from("cash_accounts")
          .select("id, current_balance")
          .eq("shop_id", shopId)
          .limit(1);

        const primaryAcc = accs?.[0];
        
        // Insert expense
        const { data: exp, error: expErr } = await supabase
          .from("expenses")
          .insert({
            shop_id: shopId,
            name: "Evaporation / Wet Stock Shortage Loss",
            expense_type: "Miscellaneous",
            amount: lossAmount,
            remarks: `Wet Stock Reconciliation Loss: ${discrepancy.toFixed(2)} Liters of ${tank.fuel_type} (Rate: Rs ${fuelRate}/Ltr)`,
            account_id: primaryAcc ? primaryAcc.id : null
          })
          .select()
          .single();

        if (expErr) throw expErr;

        // Update cash account balance
        if (primaryAcc) {
          await supabase
            .from("cash_accounts")
            .update({ current_balance: Number(primaryAcc.current_balance) - lossAmount })
            .eq("id", primaryAcc.id);
        }

        // Log transaction
        await supabase.from("account_transactions").insert({
          shop_id: shopId,
          account_id: primaryAcc ? primaryAcc.id : null,
          type: "withdrawal",
          amount: lossAmount,
          ref_type: "expense",
          ref_id: exp.id,
          remarks: `Evaporation Shortage: ${discrepancy.toFixed(2)} Liters`
        });

        toast.success(`Wet stock reconciled! Posted Rs ${lossAmount.toLocaleString()} evaporation loss as expense.`);
      } else {
        toast.success("Wet stock reconciled! No evaporation loss detected.");
      }

      setFuelReceived(0);
      setNozzleSales(0);
      setEndingDipStick(0);
      setReconTankId("");
      fetchTanks();
    } catch (err: any) {
      toast.error("Reconciliation failed: " + err.message);
    } finally {
      setIsPostingRecon(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <span className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl text-white shadow-md">
              <Fuel className="h-6 w-6" />
            </span>
            Fuel Storage Tanks & Wet Stock
          </h2>
          
        </div>
        
        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex border border-slate-200 bg-white rounded-2xl p-1 shadow-sm gap-1 h-9 items-center shrink-0">
            <button 
              onClick={() => setActiveTab("catalog")}
              className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === "catalog" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              }`}
            >
              Tanks Inventory
            </button>
            <button 
              onClick={() => setActiveTab("reconciliation")}
              className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === "reconciliation" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              }`}
            >
              Wet Stock Dip Reconciliation
            </button>
          </div>

          {activeTab === "catalog" && (
            <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 self-start md:self-auto h-9 rounded-2xl text-xs font-bold">
              <PlusCircle className="mr-1.5 h-4 w-4" /> Add Fuel Tank
            </Button>
          )}
        </div>
      </div>

      {activeTab === "catalog" && (
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
      )}

      {activeTab === "reconciliation" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <Droplet size={14} className="text-blue-500 animate-pulse" /> Enter Daily Readings
            </h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider mb-1.5">Select Fuel Storage Tank</label>
                <select
                  value={reconTankId}
                  onChange={e => {
                    setReconTankId(e.target.value);
                    const t = tanks.find(x => x.id === e.target.value);
                    if (t) setEndingDipStick(t.current_dip);
                  }}
                  className="w-full bg-white border border-slate-200 h-10 rounded-xl px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold cursor-pointer"
                >
                  <option value="">-- Select Storage Tank --</option>
                  {tanks.map(t => (
                    <option key={t.id} value={t.id}>{t.fuel_type} Tank (Current: {t.current_dip.toLocaleString()} Ltrs)</option>
                  ))}
                </select>
              </div>

              {reconTankId && (() => {
                const selectedTank = tanks.find(t => t.id === reconTankId);
                if (!selectedTank) return null;

                return (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider mb-1">Fuel Received / Decanted (Liters)</label>
                      <Input
                        type="number"
                        min="0"
                        value={fuelReceived || ""}
                        onChange={e => setFuelReceived(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="h-10 rounded-xl bg-slate-50 border-slate-200 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider mb-1">Sales Meter nozzle count (Liters)</label>
                      <Input
                        type="number"
                        min="0"
                        value={nozzleSales || ""}
                        onChange={e => setNozzleSales(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="h-10 rounded-xl bg-slate-50 border-slate-200 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider mb-1">Ending DIP manual stick reading (Liters)</label>
                      <Input
                        type="number"
                        min="0"
                        value={endingDipStick || ""}
                        onChange={e => setEndingDipStick(parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 11500"
                        className="h-10 rounded-xl bg-blue-50 border-blue-200 text-blue-800 font-black text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider mb-1">Active Fuel Rate (PKR / Litre)</label>
                      <Input
                        type="number"
                        min="0"
                        value={fuelRate || ""}
                        onChange={e => setFuelRate(parseFloat(e.target.value) || 0)}
                        placeholder="270"
                        className="h-10 rounded-xl bg-slate-50 border-slate-200 font-bold"
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        onClick={handlePostReconciliation}
                        disabled={isPostingRecon}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-1.5"
                      >
                        {isPostingRecon ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={14} />}
                        Reconcile & Update Wet Stock
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Computations Card */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm h-full flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 pb-3 border-b mb-4">
                  <Layers size={14} className="text-blue-500" /> Stock Shortage & Loss Calculations
                </h3>

                {!reconTankId ? (
                  <div className="text-center py-20 text-slate-450 text-xs font-semibold">
                    Please select a fuel storage tank on the left to show real-time evaporation and dip reconciliation report.
                  </div>
                ) : (() => {
                  const selectedTank = tanks.find(t => t.id === reconTankId);
                  if (!selectedTank) return null;
                  const startingDip = Number(selectedTank.current_dip);
                  const expectedEnding = startingDip + fuelReceived - nozzleSales;
                  const discrepancy = Math.max(0, expectedEnding - endingDipStick);
                  const estimatedLoss = Math.round(discrepancy * fuelRate);

                  return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-bold text-slate-655">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">1. Opening Dip</span>
                          <span className="text-lg font-black text-slate-800">{startingDip.toLocaleString()} Ltrs</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">2. Fuel Decanted (+)</span>
                          <span className="text-lg font-black text-emerald-600">+{fuelReceived.toLocaleString()} Ltrs</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">3. Nozzle Sales (-)</span>
                          <span className="text-lg font-black text-rose-600">-{nozzleSales.toLocaleString()} Ltrs</span>
                        </div>
                      </div>

                      <div className="bg-blue-50/30 border border-blue-100 rounded-3xl p-5 space-y-4">
                        <div className="flex justify-between items-center text-xs font-black">
                          <span className="text-slate-655">Expected Ending Book Stock:</span>
                          <span className="text-slate-800 text-sm">{expectedEnding.toLocaleString()} Liters</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-black">
                          <span className="text-slate-655">Actual Physical Dip Stick:</span>
                          <span className="text-blue-700 text-sm">{endingDipStick.toLocaleString()} Liters</span>
                        </div>
                      </div>

                      <div className={`border rounded-3xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                        discrepancy > 0 ? "bg-amber-50 border-amber-250" : "bg-emerald-50 border-emerald-250"
                      }`}>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 uppercase">Wet Stock Shortage (Evaporation Loss)</h4>
                          <p className="text-[10.5px] text-slate-500 font-semibold mt-1">
                            {discrepancy > 0 
                              ? `Evaporation, leaks, or temperature shortage detected in storage tank.`
                              : `Physical dip matches expected closing book levels.`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-2xl font-black block text-slate-900">{discrepancy.toFixed(2)} Ltrs</span>
                          {discrepancy > 0 && (
                            <span className="text-[10.5px] font-black text-amber-700 block mt-0.5">Est. Loss: Rs {estimatedLoss.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold mt-4">
                * Note: Wet stock reconciliation logs the evaporation discrepancy as operational expenses in the cash ledger, adjusting the tank volume balance.
              </div>
            </div>
          </div>
        </div>
      )}

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
