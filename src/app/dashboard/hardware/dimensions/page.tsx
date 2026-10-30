"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wrench, Search, PlusCircle, Trash2, Edit, Calculator, 
  Loader2, Save, X, Layers, Ruler, DollarSign, User, Phone, CheckCircle2 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";

type DimensionItem = {
  id: string;
  name: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  unit: "ft" | "in" | "m" | "mm";
  length: number;
  width: number;
  area: number; // Length * Width
  rate_per_sq_unit: number;
  total_price: number;
  status?: string;
  created_at?: string;
};

export default function HardwareDimensionsPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [items, setItems] = useState<DimensionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [editingItem, setEditingItem] = useState<DimensionItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    customer_name: "",
    customer_phone: "",
    unit: "ft" as "ft" | "in" | "m" | "mm",
    length: 8,
    width: 4,
    rate_per_sq_unit: 150
  });

  useEffect(() => {
    if (shopId) {
      fetchQuotes();
    }
  }, [shopId]);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("hardware_dimension_quotes")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        setItems(data.map((d: any) => ({
          id: d.id,
          name: d.item_name,
          customer_name: d.customer_name,
          customer_phone: d.customer_phone,
          unit: d.unit || "ft",
          length: Number(d.length) || 1,
          width: Number(d.width) || 1,
          area: Number(d.area) || 1,
          rate_per_sq_unit: Number(d.rate_per_sq_unit) || 0,
          total_price: Number(d.total_price) || 0,
          status: d.status || "quoted",
          created_at: d.created_at
        })));
      } else {
        // Sample starter items if table is empty
        const defaultSample: DimensionItem[] = [
          { id: "sample-1", name: "Glass Sheet Clear 5mm", unit: "ft", length: 6, width: 4, area: 24, rate_per_sq_unit: 250, total_price: 6000, customer_name: "Walk-in" },
          { id: "sample-2", name: "Iron Sheet Galvanized", unit: "ft", length: 8, width: 3, area: 24, rate_per_sq_unit: 450, total_price: 10800, customer_name: "Walk-in" }
        ];
        setItems(defaultSample);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  // Calculate area & price dynamically
  const calculatedArea = formData.length * formData.width;
  const calculatedPrice = calculatedArea * formData.rate_per_sq_unit;

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      customer_name: "",
      customer_phone: "",
      unit: "ft",
      length: 8,
      width: 4,
      rate_per_sq_unit: 150
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: DimensionItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      customer_name: item.customer_name || "",
      customer_phone: item.customer_phone || "",
      unit: item.unit,
      length: item.length,
      width: item.width,
      rate_per_sq_unit: item.rate_per_sq_unit
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Please enter a name for the hardware sheet/material.");
      return;
    }

    setIsSubmitting(true);
    try {
      const dbPayload = {
        shop_id: shopId,
        item_name: formData.name.trim(),
        customer_name: formData.customer_name.trim() || null,
        customer_phone: formData.customer_phone.trim() || null,
        unit: formData.unit,
        length: formData.length,
        width: formData.width,
        area: calculatedArea,
        rate_per_sq_unit: formData.rate_per_sq_unit,
        total_price: calculatedPrice,
        status: "quoted"
      };

      if (editingItem && !editingItem.id.startsWith("sample-")) {
        const { error } = await supabase
          .from("hardware_dimension_quotes")
          .update(dbPayload)
          .eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Dimension calculation updated!");
      } else {
        const { error } = await supabase
          .from("hardware_dimension_quotes")
          .insert([dbPayload]);
        if (error) throw error;
        toast.success("Dimension entry saved to database!");
      }

      setIsModalOpen(false);
      fetchQuotes();
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this dimension calculation?")) return;
    try {
      if (!id.startsWith("sample-")) {
        await supabase.from("hardware_dimension_quotes").delete().eq("id", id);
      }
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success("Item deleted.");
    } catch (err: any) {
      toast.error("Delete failed: " + err.message);
    }
  };

  const filtered = items.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.customer_name && i.customer_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Wrench className="h-6 w-6 text-blue-600" /> Hardware Dimensions & Sheet Cutting
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Compute area, square-feet and meter pricing on the fly for iron sheets, timber, glass, and tiles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search materials or customers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[260px] bg-white border-slate-200 text-xs h-9"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 shadow-md shadow-blue-200">
            <PlusCircle className="mr-1.5 h-4 w-4" /> Calculate Material
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400">
          <Loader2 className="animate-spin h-6 w-6 mr-2" /> Loading dimension calculations...
        </div>
      ) : (
        /* Dimension Calculations Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(item => (
            <motion.div 
              whileHover={{ y: -3 }}
              key={item.id} 
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600"></div>

              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                      <Wrench size={15} className="text-blue-600 shrink-0" /> {item.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Dimensions: <strong className="text-slate-700">{item.length}</strong> x <strong className="text-slate-700">{item.width}</strong> {item.unit}
                    </p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider">
                    Calculated
                  </span>
                </div>

                {item.customer_name && (
                  <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                    <User size={12} className="text-slate-400" /> Customer: <span className="font-semibold text-slate-700">{item.customer_name}</span>
                  </p>
                )}

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between mb-3 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Total Area</span>
                    <p className="text-sm font-black text-slate-800">{item.area} sq {item.unit}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-sans block">Rate / sq {item.unit}</span>
                    <span className="font-bold text-slate-700">Rs {item.rate_per_sq_unit.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase block leading-none">Net Total</span>
                  <span className="text-base font-black text-blue-600 font-mono">Rs {item.total_price.toLocaleString()}</span>
                </div>
                
                <div className="flex gap-1.5">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleOpenEditModal(item)}
                    className="text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs font-bold h-8 px-2"
                  >
                    <Edit size={13} className="mr-1" /> Edit
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(item.id)}
                    className="text-slate-500 hover:text-red-600 hover:bg-slate-100 text-xs font-bold h-8 px-2"
                  >
                    <Trash2 size={13} className="mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
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
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10 font-sans"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-blue-600" />
                  {editingItem ? "Edit Dimension Specs" : "Calculate Hardware Material"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Material Description</label>
                  <Input 
                    placeholder="e.g. Iron Sheet Galvanized 3mm, Marble Slab" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="text-xs h-9"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Customer Name</label>
                    <Input 
                      placeholder="e.g. Aslam Builder" 
                      value={formData.customer_name}
                      onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                      className="text-xs h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Customer Phone</label>
                    <Input 
                      placeholder="0300-1234567" 
                      value={formData.customer_phone}
                      onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
                      className="text-xs h-9 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Measurement Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value as any})}
                    className="w-full bg-white border border-slate-200 h-9 rounded-lg px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="ft">Feet (ft) / Sq Ft</option>
                    <option value="in">Inches (in)</option>
                    <option value="m">Meters (m) / Sq Meter</option>
                    <option value="mm">Millimeters (mm)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Length</label>
                    <Input 
                      type="number"
                      value={formData.length || ""}
                      onChange={(e) => setFormData({...formData, length: parseFloat(e.target.value) || 0})}
                      className="font-mono text-slate-800 text-xs h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Width</label>
                    <Input 
                      type="number"
                      value={formData.width || ""}
                      onChange={(e) => setFormData({...formData, width: parseFloat(e.target.value) || 0})}
                      className="font-mono text-slate-800 text-xs h-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Rate per sq {formData.unit} (Rs)</label>
                  <Input 
                    type="number"
                    value={formData.rate_per_sq_unit || ""}
                    onChange={(e) => setFormData({...formData, rate_per_sq_unit: parseFloat(e.target.value) || 0})}
                    className="font-mono text-slate-800 text-xs h-9"
                  />
                </div>

                {/* Live Area and Total Price Calculator Box */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-slate-500">
                    <span className="flex items-center gap-1 font-semibold"><Ruler size={13} /> Total Area:</span>
                    <span className="font-black text-slate-800 font-mono">
                      {calculatedArea} sq {formData.unit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-200 pt-1.5 font-bold">
                    <span className="text-slate-600">Calculated Net Price:</span>
                    <span className="font-mono text-blue-600 text-base">
                      Rs {calculatedPrice.toLocaleString()}
                    </span>
                  </div>
                </div>

                <Button 
                  disabled={isSubmitting} 
                  onClick={handleSave} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 text-xs"
                >
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Dimension Quote
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
