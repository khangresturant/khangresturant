"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Scissors, Search, PlusCircle, CheckCircle, Clock, 
  Trash2, Edit, Loader2, Save, X, Phone, User, Image as ImageIcon 
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Measurement = {
  id: string;
  party_id: string;
  length: number;
  chest: number;
  waist: number;
  cloth_image_url: string | null;
  status: "cutting" | "stitching" | "ready";
  created_at: string;
  parties?: any;
};

type Party = {
  id: string;
  name: string;
  phone: string | null;
};

export default function TailorMeasurementsPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    party_id: "",
    length: 0,
    chest: 0,
    waist: 0,
    cloth_image_url: "",
    status: "cutting" as "cutting" | "stitching" | "ready"
  });

  useEffect(() => {
    if (shopId) {
      fetchMeasurements();
      fetchCustomers();
    }
  }, [shopId]);

  const fetchMeasurements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tailor_measurements")
        .select(`
          id, party_id, length, chest, waist, cloth_image_url, status, created_at,
          parties ( name, phone )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMeasurements(data || []);
    } catch (err: any) {
      toast.error("Failed to load measurements: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("parties")
        .select("id, name, phone")
        .eq("shop_id", shopId)
        .eq("type", "customer")
        .order("name", { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const handleOpenAddModal = () => {
    setEditingMeasurement(null);
    setFormData({
      party_id: customers[0]?.id || "",
      length: 40,
      chest: 36,
      waist: 32,
      cloth_image_url: "",
      status: "cutting"
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (m: Measurement) => {
    setEditingMeasurement(m);
    setFormData({
      party_id: m.party_id,
      length: Number(m.length) || 0,
      chest: Number(m.chest) || 0,
      waist: Number(m.waist) || 0,
      cloth_image_url: m.cloth_image_url || "",
      status: m.status
    });
    setIsModalOpen(true);
  };

  const handleSaveMeasurement = async () => {
    if (!formData.party_id) {
      toast.error("Please select a customer.");
      return;
    }

    setIsSubmitting(true);
    try {
      const dbPayload = {
        party_id: formData.party_id,
        length: formData.length,
        chest: formData.chest,
        waist: formData.waist,
        cloth_image_url: formData.cloth_image_url || null,
        status: formData.status
      };

      if (editingMeasurement) {
        const { error } = await supabase
          .from("tailor_measurements")
          .update(dbPayload)
          .eq("id", editingMeasurement.id);

        if (error) throw error;
        toast.success("Measurement record updated!");
      } else {
        const { error } = await supabase
          .from("tailor_measurements")
          .insert(dbPayload);

        if (error) throw error;
        toast.success("Measurement record saved!");
      }

      setIsModalOpen(false);
      fetchMeasurements();
    } catch (err: any) {
      toast.error("Error saving measurements: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: "cutting" | "stitching" | "ready") => {
    try {
      const { error } = await supabase
        .from("tailor_measurements")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Status updated to ${status}`);
      
      // Update local state directly
      setMeasurements(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this measurement?")) return;
    try {
      const { error } = await supabase
        .from("tailor_measurements")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Measurement deleted.");
      fetchMeasurements();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  const getPartyDetails = (parties: any) => {
    if (!parties) return { name: "Unknown", phone: null };
    if (Array.isArray(parties)) {
      return parties[0] || { name: "Unknown", phone: null };
    }
    return parties;
  };

  const filtered = measurements.filter(m => {
    const party = getPartyDetails(m.parties);
    return party.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (party.phone && party.phone.includes(searchQuery));
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Tailor Measurements</h2>
          <p className="text-slate-500 mt-1">Record and monitor client-wise sizes and tailoring stages.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by customer..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Measurements
          </Button>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
            <span>Loading measurements...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            No measurements recorded yet. Click "Add Measurements" to get started.
          </div>
        ) : (
          filtered.map(item => (
            <motion.div 
              whileHover={{ y: -3 }}
              key={item.id} 
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
            >
              {/* Top Accent line based on Status */}
              <div className={`absolute top-0 left-0 w-full h-1.5 ${
                item.status === 'ready' 
                  ? 'bg-emerald-500' 
                  : item.status === 'stitching' 
                    ? 'bg-blue-500' 
                    : 'bg-amber-500'
              }`}></div>

              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                      <User size={16} className="text-slate-400" /> {getPartyDetails(item.parties).name}
                    </h3>
                    {getPartyDetails(item.parties).phone && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone size={10} /> {getPartyDetails(item.parties).phone}</p>
                    )}
                  </div>
                  
                  {/* Status Picker */}
                  <select
                    value={item.status}
                    onChange={(e) => updateStatus(item.id, e.target.value as any)}
                    className={`text-xs font-bold border rounded px-2 py-1 focus:outline-none ${
                      item.status === "ready"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : item.status === "stitching"
                          ? "bg-blue-50 border-blue-200 text-blue-800"
                          : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}
                  >
                    <option value="cutting">Cutting</option>
                    <option value="stitching">Stitching</option>
                    <option value="ready">Ready</option>
                  </select>
                </div>

                {/* Measurements Details */}
                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-center mb-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-sans font-bold">Length</span>
                    <p className="text-sm font-black text-slate-800">{item.length}"</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-sans font-bold">Chest</span>
                    <p className="text-sm font-black text-slate-800">{item.chest}"</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-sans font-bold">Waist</span>
                    <p className="text-sm font-black text-slate-800">{item.waist}"</p>
                  </div>
                </div>

                {item.cloth_image_url && (
                  <div className="mb-4 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 p-2 text-xs flex items-center gap-2 text-slate-500">
                    <ImageIcon size={14} /> Link: <span className="truncate underline font-mono cursor-pointer">{item.cloth_image_url}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleOpenEditModal(item)}
                  className="text-slate-600 hover:text-blue-600 hover:bg-slate-100 text-xs"
                >
                  <Edit size={14} className="mr-1" /> Edit
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDelete(item.id)}
                  className="text-slate-600 hover:text-red-600 hover:bg-slate-100 text-xs"
                >
                  <Trash2 size={14} className="mr-1" /> Delete
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Modal: Add/Edit Measurements */}
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
                  {editingMeasurement ? "Edit Measurements" : "Add Measurements"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Select Customer</label>
                  <select
                    value={formData.party_id}
                    onChange={(e) => setFormData({...formData, party_id: e.target.value})}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    disabled={!!editingMeasurement}
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Length (in)</label>
                    <Input 
                      type="number" 
                      value={formData.length || ""} 
                      onChange={(e) => setFormData({...formData, length: parseFloat(e.target.value) || 0})}
                      className="text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Chest (in)</label>
                    <Input 
                      type="number" 
                      value={formData.chest || ""} 
                      onChange={(e) => setFormData({...formData, chest: parseFloat(e.target.value) || 0})}
                      className="text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Waist (in)</label>
                    <Input 
                      type="number" 
                      value={formData.waist || ""} 
                      onChange={(e) => setFormData({...formData, waist: parseFloat(e.target.value) || 0})}
                      className="text-center font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cloth Style Image URL (Optional)</label>
                  <Input 
                    placeholder="https://example.com/cloth.jpg" 
                    value={formData.cloth_image_url} 
                    onChange={(e) => setFormData({...formData, cloth_image_url: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Tailor Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="cutting">Cutting</option>
                    <option value="stitching">Stitching</option>
                    <option value="ready">Ready</option>
                  </select>
                </div>

                <Button onClick={handleSaveMeasurement} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Measurement Size
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
