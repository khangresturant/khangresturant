"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Search, Edit2, Trash2, Layers, 
  Scale, ArrowRight, Loader2, Save, X, Info, Sparkles, RefreshCw
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Unit = {
  id: string;
  name: string;
  code: string;
  parent_unit_id: string | null;
  conversion_factor: number;
  created_at: string;
  parent_unit?: any;
};

export default function UnitsPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPrepopulating, setIsPrepopulating] = useState(false);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    isSecondary: false,
    parent_unit_id: "",
    conversion_factor: 1
  });

  const getParentUnitDetails = (parentUnit: any) => {
    if (!parentUnit) return { name: "Base", code: "base" };
    if (Array.isArray(parentUnit)) {
      return parentUnit[0] || { name: "Base", code: "base" };
    }
    return parentUnit;
  };

  useEffect(() => {
    if (shopId) {
      fetchUnits();
    }
  }, [shopId]);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("units")
        .select(`
          id, name, code, parent_unit_id, conversion_factor, created_at,
          parent_unit:units!parent_unit_id ( name, code )
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setUnits(data || []);
    } catch (err: any) {
      toast.error("Failed to load units: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingUnit(null);
    setFormData({
      name: "",
      code: "",
      isSecondary: false,
      parent_unit_id: "",
      conversion_factor: 1
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name,
      code: unit.code,
      isSecondary: !!unit.parent_unit_id,
      parent_unit_id: unit.parent_unit_id || "",
      conversion_factor: unit.conversion_factor
    });
    setIsModalOpen(true);
  };

  const handleSaveUnit = async () => {
    if (!formData.name || !formData.code) {
      toast.error("Unit name and code are required.");
      return;
    }

    if (formData.isSecondary) {
      if (!formData.parent_unit_id) {
        toast.error("Please select a base unit.");
        return;
      }
      if (formData.conversion_factor <= 1) {
        toast.error("Conversion factor must be greater than 1.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const dbPayload = {
        shop_id: shopId,
        name: formData.name,
        code: formData.code.toLowerCase(),
        parent_unit_id: formData.isSecondary ? formData.parent_unit_id : null,
        conversion_factor: formData.isSecondary ? formData.conversion_factor : 1
      };

      if (editingUnit) {
        // Prevent setting a unit as its own parent
        if (formData.isSecondary && formData.parent_unit_id === editingUnit.id) {
          toast.error("A unit cannot be its own base unit.");
          setIsSubmitting(false);
          return;
        }

        const { error } = await supabase
          .from("units")
          .update(dbPayload)
          .eq("id", editingUnit.id);

        if (error) throw error;
        toast.success("Unit updated successfully!");
      } else {
        const { error } = await supabase
          .from("units")
          .insert(dbPayload);

        if (error) throw error;
        toast.success("Unit created successfully!");
      }

      setIsModalOpen(false);
      fetchUnits();
    } catch (err: any) {
      toast.error("Error saving unit: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUnit = async (id: string) => {
    // Check if other units reference this one as a parent
    const hasChildren = units.some(u => u.parent_unit_id === id);
    const confirmMsg = hasChildren
      ? "Warning: Other secondary units use this as a base. Deleting this will reset those secondary units to base units. Continue?"
      : "Are you sure you want to delete this unit?";

    if (!confirm(confirmMsg)) return;

    try {
      const { error } = await supabase
        .from("units")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Unit deleted successfully!");
      fetchUnits();
    } catch (err: any) {
      toast.error("Failed to delete unit: " + err.message);
    }
  };

  const handlePrepopulate = async () => {
    setIsPrepopulating(true);
    try {
      // 1. Insert Base Units
      const baseUnits = [
        { shop_id: shopId, name: "Piece", code: "pcs", parent_unit_id: null, conversion_factor: 1 },
        { shop_id: shopId, name: "Kilogram", code: "kg", parent_unit_id: null, conversion_factor: 1 },
        { shop_id: shopId, name: "Gram", code: "g", parent_unit_id: null, conversion_factor: 1 },
        { shop_id: shopId, name: "Liter", code: "ltr", parent_unit_id: null, conversion_factor: 1 },
        { shop_id: shopId, name: "Milliliter", code: "ml", parent_unit_id: null, conversion_factor: 1 }
      ];

      const { data: insertedBases, error: baseError } = await supabase
        .from("units")
        .insert(baseUnits)
        .select();

      if (baseError) throw baseError;

      // Find IDs for secondary linkages
      const pcsUnit = insertedBases?.find(u => u.code === "pcs");
      const kgUnit = insertedBases?.find(u => u.code === "kg");
      const ltrUnit = insertedBases?.find(u => u.code === "ltr");

      // 2. Insert Secondary Units linked to parents
      const secondaryUnits = [];
      
      if (pcsUnit) {
        secondaryUnits.push(
          { shop_id: shopId, name: "Box (Dozen)", code: "box", parent_unit_id: pcsUnit.id, conversion_factor: 12 },
          { shop_id: shopId, name: "Carton (24)", code: "ctn", parent_unit_id: pcsUnit.id, conversion_factor: 24 },
          { shop_id: shopId, name: "Pack (6)", code: "pack", parent_unit_id: pcsUnit.id, conversion_factor: 6 }
        );
      }
      if (kgUnit) {
        secondaryUnits.push(
          { shop_id: shopId, name: "Bag (50kg)", code: "bag", parent_unit_id: kgUnit.id, conversion_factor: 50 },
          { shop_id: shopId, name: "Half Bag (25kg)", code: "half_bag", parent_unit_id: kgUnit.id, conversion_factor: 25 }
        );
      }
      if (ltrUnit) {
        secondaryUnits.push(
          { shop_id: shopId, name: "Crate (12 ltr)", code: "crate", parent_unit_id: ltrUnit.id, conversion_factor: 12 }
        );
      }

      if (secondaryUnits.length > 0) {
        const { error: secError } = await supabase
          .from("units")
          .insert(secondaryUnits);
        if (secError) throw secError;
      }

      toast.success("Standard Units loaded successfully!");
      fetchUnits();
    } catch (err: any) {
      toast.error("Prepopulation failed: " + err.message);
    } finally {
      setIsPrepopulating(false);
    }
  };

  const baseUnitsList = units.filter(u => !u.parent_unit_id);
  const secondaryUnitsList = units.filter(u => u.parent_unit_id);

  const filteredUnits = units.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Units & Packings</h2>
          <p className="text-slate-500 mt-1">Manage main stock units, define sub-units, and set multipliers/conversion factors.</p>
        </div>
        <div className="flex items-center gap-3">
          {units.length === 0 && (
            <Button 
              onClick={handlePrepopulate} 
              disabled={isPrepopulating} 
              variant="outline" 
              className="border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-50"
            >
              {isPrepopulating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4 text-blue-500" />
              )}
              Load Standard Units
            </Button>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search units..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <Plus className="mr-2 h-4 w-4" /> Add Unit
          </Button>
        </div>
      </div>

      {/* Info Alert Box */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 flex items-start gap-3 text-sm text-blue-800">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-bold">What are Units & Conversion Factors?</p>
          <p className="text-blue-700/90 leading-relaxed">
            Create <strong>Base Units</strong> first (like <em>Piece</em>, <em>Kilogram</em>, or <em>Liter</em>). 
            Then, create <strong>Secondary/Sub-units</strong> (like <em>Box</em> or <em>Carton</em>) and link them to their base units with a <strong>Conversion Factor</strong>. 
            For example, 1 Box (ctn) of biscuits containing 12 Pieces (pcs) has a conversion factor of <strong>12</strong>.
          </p>
        </div>
      </div>

      {/* Visual Unit Conversion Flows */}
      {secondaryUnitsList.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Packaging Conversions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {secondaryUnitsList.map((unit) => {
              const parentDetails = getParentUnitDetails(unit.parent_unit);
              const baseName = parentDetails.name;
              const baseCode = parentDetails.code;
              return (
                <motion.div
                  whileHover={{ y: -2 }}
                  key={unit.id}
                  className="bg-white px-5 py-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Multi-Pack Unit</span>
                    <span className="text-sm font-black text-slate-800 mt-1">{unit.name} ({unit.code})</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">x{unit.conversion_factor}</span>
                    <ArrowRight size={14} className="text-blue-500 animate-pulse" />
                  </div>

                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Resolves To</span>
                    <span className="text-sm font-black text-blue-600 mt-1">{unit.conversion_factor} × {baseName} ({baseCode})</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid: Base Units & Secondary Units */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Table of all configured units */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Layers className="text-blue-500" size={18} /> Configured Units & Packings List
            </h3>
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {units.length} Total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-4">Unit Name</th>
                  <th className="px-6 py-4">Symbol / Code</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Base Mapping Relation</th>
                  <th className="px-6 py-4 text-center">Conversion Factor</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">Loading units config...</td>
                  </tr>
                ) : filteredUnits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400 flex flex-col items-center">
                      <Scale className="h-10 w-10 text-slate-300 mb-2" />
                      <p>No units found. Create one or load standard templates.</p>
                    </td>
                  </tr>
                ) : (
                  filteredUnits.map((unit) => {
                    const isBase = !unit.parent_unit_id;

                    return (
                      <tr key={unit.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{unit.name}</td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500 font-semibold uppercase">{unit.code}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${
                            isBase 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                              : "bg-blue-50 text-blue-700 border-blue-100"
                          }`}>
                            {isBase ? "Base Unit" : "Secondary packing"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {isBase ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span className="text-slate-700 font-medium">
                              Maps to {getParentUnitDetails(unit.parent_unit).name} ({getParentUnitDetails(unit.parent_unit).code})
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-800">
                          {isBase ? "1.0" : `${unit.conversion_factor}.0`}
                        </td>
                        <td className="px-6 py-4 text-right space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleOpenEditModal(unit)}
                            className="text-slate-600 hover:text-blue-600 hover:bg-slate-100"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteUnit(unit.id)}
                            className="text-slate-600 hover:text-red-600 hover:bg-slate-100"
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

      </div>

      {/* Modal: Add/Edit Unit */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingUnit ? "Edit Unit" : "Add New Unit"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Unit Name</label>
                  <Input 
                    placeholder="e.g. Carton, Box, Kilogram" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Unit Symbol / Code</label>
                  <Input 
                    placeholder="e.g. ctn, box, kg, pcs" 
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                  />
                </div>

                {/* Sub-unit toggle */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-150 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Is this a secondary packing unit?</p>
                    <p className="text-xs text-slate-500 mt-0.5">Calculates multiplier of another base unit.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isSecondary}
                    onChange={(e) => setFormData({...formData, isSecondary: e.target.checked})}
                    className="h-4.5 w-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                {/* Secondary fields (Base selection and conversion factor) */}
                <AnimatePresence>
                  {formData.isSecondary && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-4 overflow-hidden border-l-2 border-blue-500 pl-4 py-1"
                    >
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Base Unit</label>
                        <select
                          value={formData.parent_unit_id}
                          onChange={(e) => setFormData({...formData, parent_unit_id: e.target.value})}
                          className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">Select Base Unit</option>
                          {baseUnitsList.map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Conversion Factor / Multiplier</label>
                        <div className="relative">
                          <Input 
                            type="number"
                            placeholder="e.g. 12" 
                            value={formData.conversion_factor || ""}
                            onChange={(e) => setFormData({...formData, conversion_factor: parseFloat(e.target.value) || 1})}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                            Units per Base
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 leading-normal">
                          How many base units does 1 unit of this contain? (e.g. if 1 Carton contains 24 Pieces, factor is 24)
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveUnit} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Unit
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
