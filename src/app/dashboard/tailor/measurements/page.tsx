"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Scissors, Search, PlusCircle, CheckCircle, Clock, 
  Trash2, Edit, Loader2, Save, X, Phone, User, Image as ImageIcon,
  FileText, Clipboard, Pencil as PencilIcon
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SketchCanvas } from "@/components/tailor/SketchCanvas";

type CustomMeasurement = { name: string; value: string };

type Measurement = {
  id: string;
  party_id: string;
  length: number;
  chest: number;
  waist: number;
  shoulder: number | null;
  collar: number | null;
  shalwar: number | null;
  paincha: number | null;
  teera: number | null;
  big_teera: number | null;
  design_details: string | null;
  cloth_image_url: string | null;
  status: "cutting" | "stitching" | "ready";
  created_at: string;
  custom_measurements?: CustomMeasurement[] | null;
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

  const [sketchOpenId, setSketchOpenId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    party_id: "",
    length: 40,
    chest: 36,
    waist: 32,
    shoulder: 18,
    collar: 15,
    shalwar: 38,
    paincha: 8.5,
    teera: 17,
    big_teera: 19,
    design_details: "",
    cloth_image_url: "",
    status: "cutting" as "cutting" | "stitching" | "ready"
  });

  // Custom Measurements State
  const [customFields, setCustomFields] = useState<CustomMeasurement[]>([]);

  const handleAddCustomField = () => {
    setCustomFields(prev => [...prev, { name: "", value: "" }]);
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleCustomFieldChange = (index: number, field: "name" | "value", val: string) => {
    setCustomFields(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  // Quick Add Customer States
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerPhone, setQuickCustomerPhone] = useState("");
  const [quickCustomerLoading, setQuickCustomerLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 1500000) {
      toast.error("Sketch image file is too large! Maximum limit is 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, cloth_image_url: reader.result as string }));
      toast.success("Sketch image loaded successfully!");
    };
    reader.readAsDataURL(file);
  };

  const handleQuickAddCustomer = async () => {
    if (!quickCustomerName.trim()) {
      toast.error("Please enter a customer name.");
      return;
    }
    setQuickCustomerLoading(true);
    try {
      const { data, error } = await supabase
        .from("parties")
        .insert({
          shop_id: shopId,
          name: quickCustomerName.trim(),
          phone: quickCustomerPhone.trim() || null,
          type: "customer"
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Customer added successfully!");
      
      // Update local state list and sort alphabetically
      setCustomers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      // Set the select box value to new customer id
      setFormData(prev => ({ ...prev, party_id: data.id }));
      setQuickCustomerName("");
      setQuickCustomerPhone("");
      setShowQuickAddCustomer(false);
    } catch (e: any) {
      toast.error("Failed to add customer: " + e.message);
    } finally {
      setQuickCustomerLoading(false);
    }
  };

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
          id, party_id, length, chest, waist, shoulder, collar, shalwar, paincha, teera, big_teera, design_details, cloth_image_url, status, created_at, custom_measurements,
          parties ( name, phone )
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMeasurements((data as any) || []);
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
    setCustomFields([]);
    setFormData({
      party_id: customers[0]?.id || "",
      length: 40,
      chest: 36,
      waist: 32,
      shoulder: 18,
      collar: 15,
      shalwar: 38,
      paincha: 8.5,
      teera: 17,
      big_teera: 19,
      design_details: "",
      cloth_image_url: "",
      status: "cutting"
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (m: Measurement) => {
    setEditingMeasurement(m);
    setCustomFields(Array.isArray(m.custom_measurements) ? m.custom_measurements : []);
    setFormData({
      party_id: m.party_id,
      length: Number(m.length) || 0,
      chest: Number(m.chest) || 0,
      waist: Number(m.waist) || 0,
      shoulder: Number(m.shoulder) || 0,
      collar: Number(m.collar) || 0,
      shalwar: Number(m.shalwar) || 0,
      paincha: Number(m.paincha) || 0,
      teera: Number(m.teera) || 0,
      big_teera: Number(m.big_teera) || 0,
      design_details: m.design_details || "",
      cloth_image_url: m.cloth_image_url || "",
      status: m.status || "cutting"
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
        shop_id: shopId,
        party_id: formData.party_id,
        length: formData.length,
        chest: formData.chest,
        waist: formData.waist,
        shoulder: formData.shoulder,
        collar: formData.collar,
        shalwar: formData.shalwar,
        paincha: formData.paincha,
        teera: formData.teera,
        big_teera: formData.big_teera,
        design_details: formData.design_details || null,
        cloth_image_url: formData.cloth_image_url || null,
        status: formData.status,
        custom_measurements: customFields.filter(f => f.name.trim() !== "")
      };

      if (editingMeasurement) {
        const { error } = await supabase
          .from("tailor_measurements")
          .update(dbPayload)
          .eq("id", editingMeasurement.id)
          .eq("shop_id", shopId);

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
        .eq("id", id)
        .eq("shop_id", shopId);

      if (error) throw error;
      toast.success(`Status updated to ${status}`);
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
        .eq("id", id)
        .eq("shop_id", shopId);

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
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Scissors className="text-indigo-600" />
            Tailor Measurements (گاہک کا ناپ)
          </h2>
          <p className="text-slate-500 mt-1">Record and monitor client-wise sizes, teera, collar, shalwar, and tailoring stages.</p>
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
          <Button onClick={handleOpenAddModal} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md cursor-pointer">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Measurements (نیا ناپ)
          </Button>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-500" />
            <span>Loading measurements...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400 bg-white border border-dashed rounded-3xl">
            No measurements recorded yet. Click "Add Measurements" to get started.
          </div>
        ) : (
          filtered.map(item => (
            <motion.div 
              whileHover={{ y: -3 }}
              key={item.id} 
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
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
                    className={`text-xs font-bold border rounded-lg px-2 py-1 focus:outline-none cursor-pointer ${
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

                {/* Measurements Details Grid */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-mono text-center mb-4">
                  <div className="p-1">
                    <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Length</span>
                    <span className="text-xs text-slate-450 block font-sans">(لمبائی)</span>
                    <p className="text-sm font-black text-slate-800">{item.length}"</p>
                  </div>
                  <div className="p-1">
                    <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Chest</span>
                    <span className="text-xs text-slate-450 block font-sans">(چھاتی)</span>
                    <p className="text-sm font-black text-slate-800">{item.chest}"</p>
                  </div>
                  <div className="p-1">
                    <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Waist</span>
                    <span className="text-xs text-slate-450 block font-sans">(کمر)</span>
                    <p className="text-sm font-black text-slate-800">{item.waist}"</p>
                  </div>
                  <div className="p-1 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Shoulder</span>
                    <span className="text-xs text-slate-450 block font-sans">(موڈھا)</span>
                    <p className="text-sm font-black text-slate-800">{item.shoulder || 0}"</p>
                  </div>
                  <div className="p-1 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Collar</span>
                    <span className="text-xs text-slate-450 block font-sans">(بین/کالر)</span>
                    <p className="text-sm font-black text-slate-800">{item.collar || 0}"</p>
                  </div>
                  <div className="p-1 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Shalwar</span>
                    <span className="text-xs text-slate-450 block font-sans">(شلوار)</span>
                    <p className="text-sm font-black text-slate-800">{item.shalwar || 0}"</p>
                  </div>
                  <div className="p-1 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Paincha</span>
                    <span className="text-xs text-slate-450 block font-sans">(پائنچہ)</span>
                    <p className="text-sm font-black text-slate-800">{item.paincha || 0}"</p>
                  </div>
                  <div className="p-1 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Teera</span>
                    <span className="text-xs text-slate-450 block font-sans">(تیرا)</span>
                    <p className="text-sm font-black text-slate-800">{item.teera || 0}"</p>
                  </div>
                  <div className="p-1 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Big Teera</span>
                    <span className="text-xs text-slate-450 block font-sans">(بڑا تیرا)</span>
                    <p className="text-sm font-black text-slate-800">{item.big_teera || 0}"</p>
                  </div>
                </div>

                {/* Custom Measurements Badges */}
                {Array.isArray(item.custom_measurements) && item.custom_measurements.length > 0 && (
                  <div className="mb-4 bg-teal-50/60 border border-teal-100/80 rounded-2xl p-3 font-sans">
                    <span className="font-extrabold uppercase tracking-wide block mb-1.5 text-[9px] text-teal-700">Custom Measurements (دیگر پیمائشیں):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {item.custom_measurements.map((cm: any, idx: number) => (
                        <span key={idx} className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-white text-teal-900 border border-teal-200 shadow-sm">
                          <span className="text-teal-600 mr-1">{cm.name}:</span> {cm.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {item.design_details && (
                  <div className="mb-4 bg-indigo-50/50 border border-indigo-100/50 rounded-xl p-3 text-xs text-indigo-950 font-sans">
                    <span className="font-extrabold uppercase tracking-wide block mb-1 text-[9px] text-indigo-500">Design Instructions:</span>
                    <p className="text-[11px] leading-relaxed font-semibold">{item.design_details}</p>
                  </div>
                )}

                {item.cloth_image_url && (
                  <div className="mb-4 border border-slate-150 rounded-2xl overflow-hidden bg-slate-50">
                    <span className="text-[9px] font-black text-indigo-650 uppercase tracking-widest block p-2 bg-indigo-50/50 border-b border-slate-150">Reference Sketch / Cloth Pattern</span>
                    <div className="p-2 flex items-center justify-center max-h-48 overflow-hidden bg-white">
                      <img 
                        src={item.cloth_image_url} 
                        alt="Cloth Reference Sketch" 
                        className="max-h-44 max-w-full object-contain rounded-lg shadow-sm cursor-zoom-in hover:scale-[1.02] transition-transform duration-200"
                        onClick={() => {
                          const w = window.open();
                          w?.document.write(`<img src="${item.cloth_image_url}" style="max-width:100%; height:auto;" />`);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSketchOpenId(sketchOpenId === item.id ? null : item.id)}
                  className="text-slate-600 hover:text-violet-600 hover:bg-violet-50 text-xs font-bold"
                >
                  <PencilIcon size={14} className="mr-1" /> Sketch (خاکہ)
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleOpenEditModal(item)}
                  className="text-slate-600 hover:text-indigo-650 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-xs font-bold"
                >
                  <Edit size={14} className="mr-1" /> Edit (ترمیم)
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDelete(item.id)}
                  className="text-slate-600 hover:text-red-600 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-xs font-bold"
                >
                  <Trash2 size={14} className="mr-1" /> Delete (ختم کریں)
                </Button>
              </div>

              {/* Sketch Panel - collapsible */}
              {sketchOpenId === item.id && (
                <div className="mt-3 pt-3 border-t border-violet-100">
                  <SketchCanvas
                    existingSketchUrl={item.cloth_image_url || undefined}
                    onSave={async (base64: string) => {
                      // Convert base64 to Blob and upload to Supabase Storage
                      const res = await fetch(base64);
                      const blob = await res.blob();
                      const fileName = `sketches/${shopId}/${item.id}-${Date.now()}.png`;
                      const { data: uploadData, error: uploadError } = await supabase.storage
                        .from("tailor-assets")
                        .upload(fileName, blob, { upsert: true, contentType: "image/png" });
                      if (uploadError) throw new Error(uploadError.message);
                      const { data: urlData } = supabase.storage
                        .from("tailor-assets")
                        .getPublicUrl(fileName);
                      // Update measurement record with new sketch URL
                      await supabase
                        .from("measurements")
                        .update({ cloth_image_url: urlData.publicUrl })
                        .eq("id", item.id);
                      // Refresh local state
                      setMeasurements((prev) =>
                        prev.map((m) =>
                          m.id === item.id ? { ...m, cloth_image_url: urlData.publicUrl } : m
                        )
                      );
                    }}
                  />
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Modal: Add/Edit Measurements */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-10 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setIsModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg relative z-10 my-auto md:my-8"
            >
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <h3 className="font-extrabold text-slate-850 text-base">
                  {editingMeasurement ? "Edit Measurements (پیمائش میں ترمیم)" : "Add Measurements (پیمائش شامل کریں)"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Select Customer (گاہک منتخب کریں)</label>
                    {!editingMeasurement && (
                      <button
                        type="button"
                        onClick={() => setShowQuickAddCustomer(!showQuickAddCustomer)}
                        className="text-[10px] text-indigo-650 hover:underline font-black cursor-pointer bg-transparent border-none"
                      >
                        {showQuickAddCustomer ? "Cancel (منسوخ کریں)" : "+ Register New (نیا گاہک)"}
                      </button>
                    )}
                  </div>

                  {showQuickAddCustomer ? (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-3 mb-2.5 animate-in slide-in-from-top-3 duration-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-black text-slate-450 uppercase mb-1">Name (نام) *</label>
                          <Input 
                            value={quickCustomerName}
                            onChange={(e) => setQuickCustomerName(e.target.value)}
                            placeholder="Customer Name"
                            className="bg-white h-9 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-450 uppercase mb-1">Phone (موبائل نمبر)</label>
                          <Input 
                            value={quickCustomerPhone}
                            onChange={(e) => setQuickCustomerPhone(e.target.value)}
                            placeholder="03xxxxxxxxx"
                            className="bg-white h-9 text-xs"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        disabled={quickCustomerLoading}
                        onClick={handleQuickAddCustomer}
                        className="w-full bg-indigo-600 hover:bg-indigo-755 text-white font-bold h-9 text-xs cursor-pointer"
                      >
                        {quickCustomerLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : "Save Customer (گاہک محفوظ کریں)"}
                      </Button>
                    </div>
                  ) : (
                    <select
                      value={formData.party_id}
                      onChange={(e) => setFormData({...formData, party_id: e.target.value})}
                      className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none"
                      disabled={!!editingMeasurement}
                    >
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Length (لمبائی)</label>
                    <Input 
                      type="number" 
                      value={formData.length || ""} 
                      onChange={(e) => setFormData({...formData, length: parseFloat(e.target.value) || 0})}
                      className="text-center font-mono h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Chest (چھاتی)</label>
                    <Input 
                      type="number" 
                      value={formData.chest || ""} 
                      onChange={(e) => setFormData({...formData, chest: parseFloat(e.target.value) || 0})}
                      className="text-center font-mono h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Waist (کمر)</label>
                    <Input 
                      type="number" 
                      value={formData.waist || ""} 
                      onChange={(e) => setFormData({...formData, waist: parseFloat(e.target.value) || 0})}
                      className="text-center font-mono h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Shoulder (موڈھا)</label>
                    <Input 
                      type="number" 
                      value={formData.shoulder || ""} 
                      onChange={(e) => setFormData({...formData, shoulder: parseFloat(e.target.value) || 0})}
                      className="text-center font-mono h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Collar (بین/کالر)</label>
                    <Input 
                      type="number" 
                      value={formData.collar || ""} 
                      onChange={(e) => setFormData({...formData, collar: parseFloat(e.target.value) || 0})}
                      className="text-center font-mono h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Shalwar (شلوار)</label>
                    <Input 
                      type="number" 
                      value={formData.shalwar || ""} 
                      onChange={(e) => setFormData({...formData, shalwar: parseFloat(e.target.value) || 0})}
                      className="text-center font-mono h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Paincha (پائنچہ)</label>
                    <Input 
                      type="number" 
                      value={formData.paincha || ""} 
                      onChange={(e) => setFormData({...formData, paincha: parseFloat(e.target.value) || 0})}
                      className="text-center font-mono h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Teera (تیرا)</label>
                    <Input 
                      type="number" 
                      value={formData.teera || ""} 
                      onChange={(e) => setFormData({...formData, teera: parseFloat(e.target.value) || 0})}
                      className="text-center font-mono h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Big Teera (بڑا تیرا)</label>
                    <Input 
                      type="number" 
                      value={formData.big_teera || ""} 
                      onChange={(e) => setFormData({...formData, big_teera: parseFloat(e.target.value) || 0})}
                      className="text-center font-mono h-9"
                    />
                  </div>
                </div>

                {/* Custom Measurements Section */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                      Custom Measurements (مزید پیمائش کسٹم نام کے ساتھ)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-lg border border-indigo-200/80 cursor-pointer flex items-center gap-1 transition-colors"
                    >
                      <PlusCircle size={12} /> Add Custom Field (پیمائش شامل کریں)
                    </button>
                  </div>

                  {customFields.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic text-center py-1">
                      کوئی کسٹم پیمائش نہیں جوڑی گئی۔ (مثلاً آستین، کاف، گلا وغیرہ کے لیے Add پر کلک کریں)
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {customFields.map((field, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            placeholder="نام (e.g. Aasteen / Cuff)"
                            value={field.name}
                            onChange={(e) => handleCustomFieldChange(idx, "name", e.target.value)}
                            className="bg-white text-xs h-8 flex-1"
                          />
                          <Input
                            placeholder="پیمائش (e.g. 24.5)"
                            value={field.value}
                            onChange={(e) => handleCustomFieldChange(idx, "value", e.target.value)}
                            className="bg-white text-xs h-8 w-24 text-center font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(idx)}
                            className="text-rose-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Measurement Sketch / Reference Photo</label>
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-3">
                    {formData.cloth_image_url ? (
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 group">
                        <img 
                          src={formData.cloth_image_url} 
                          alt="Sketch preview" 
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, cloth_image_url: "" }))}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center shrink-0 text-slate-400">
                        <ImageIcon size={20} />
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <span className="text-[10px] text-slate-500 font-bold block mb-1">Upload sketch or fabric photo</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange}
                        className="text-[10px] file:mr-2 file:py-1 file:px-2.5 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSaveMeasurement} disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold h-11 cursor-pointer shadow-md rounded-2xl">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Measurement Size (پیمائش محفوظ کریں)
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
