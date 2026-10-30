"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wrench, Search, PlusCircle, Trash2, Edit, Calculator, 
  Loader2, Save, X, Layers, Ruler, DollarSign 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DimensionItem = {
  id: string;
  name: string;
  unit: "ft" | "in" | "m" | "mm";
  length: number;
  width: number;
  area: number; // Length * Width
  rate_per_sq_unit: number;
  total_price: number;
};

const initialItems: DimensionItem[] = [
  { id: "1", name: "Glass Sheet Clear 5mm", unit: "ft", length: 6, width: 4, area: 24, rate_per_sq_unit: 250, total_price: 6000 },
  { id: "2", name: "Iron Sheet Galvanized", unit: "ft", length: 8, width: 3, area: 24, rate_per_sq_unit: 450, total_price: 10800 },
  { id: "3", name: "Plywood Laser Board", unit: "ft", length: 4, width: 4, area: 16, rate_per_sq_unit: 180, total_price: 2880 }
];

export default function HardwareDimensionsPage() {
  const [items, setItems] = useState<DimensionItem[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [editingItem, setEditingItem] = useState<DimensionItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    unit: "ft" as "ft" | "in" | "m" | "mm",
    length: 1,
    width: 1,
    rate_per_sq_unit: 100
  });

  // Calculate area & price dynamically
  const calculatedArea = formData.length * formData.width;
  const calculatedPrice = calculatedArea * formData.rate_per_sq_unit;

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
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
      unit: item.unit,
      length: item.length,
      width: item.width,
      rate_per_sq_unit: item.rate_per_sq_unit
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      toast.error("Please enter a name for the hardware sheet/material.");
      return;
    }

    const payload: DimensionItem = {
      id: editingItem ? editingItem.id : Math.random().toString(),
      name: formData.name,
      unit: formData.unit,
      length: formData.length,
      width: formData.width,
      area: calculatedArea,
      rate_per_sq_unit: formData.rate_per_sq_unit,
      total_price: calculatedPrice
    };

    if (editingItem) {
      setItems(prev => prev.map(i => i.id === editingItem.id ? payload : i));
      toast.success("Dimension calculations updated!");
    } else {
      setItems([payload, ...items]);
      toast.success("New dimension item calculated and added!");
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this dimension calculation?")) return;
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Item deleted.");
  };

  const filtered = items.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Hardware Bulk Dimensions</h2>
          <p className="text-slate-500 mt-1">Compute area/length-wise pricing on the fly for iron sheets, timber, and glass.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search hardware materials..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Calculate Material
          </Button>
        </div>
      </div>

      {/* Dimension Calculations Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(item => (
          <motion.div 
            whileHover={{ y: -3 }}
            key={item.id} 
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>

            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <Wrench size={16} className="text-blue-500" /> {item.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Dimensions: <strong>{item.length}</strong> x <strong>{item.width}</strong> {item.unit}</p>
                </div>
                <span className="bg-blue-50 text-blue-800 text-[10px] px-2 py-0.5 rounded font-black uppercase">
                  Area Computed
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between mb-4 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Total Area</span>
                  <p className="text-base font-black text-slate-800">{item.area} sq {item.unit}</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 font-sans block">Rate / sq {item.unit}</span>
                  <span className="font-bold text-slate-700">Rs {item.rate_per_sq_unit}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <div>
                <span className="text-[9px] text-slate-400 font-semibold uppercase block leading-none">Net Pricing</span>
                <span className="text-base font-black text-blue-600 font-mono">Rs {item.total_price.toLocaleString()}</span>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleOpenEditModal(item)}
                  className="text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs font-bold"
                >
                  <Edit size={14} className="mr-1" /> Adjust
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
                  {editingItem ? "Edit Dimension Specs" : "Calculate Hardware Sheet"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Material Description</label>
                  <Input 
                    placeholder="e.g. Iron Sheet Galvanized 3mm" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Measurement Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value as any})}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="ft">Feet (ft)</option>
                    <option value="in">Inches (in)</option>
                    <option value="m">Meters (m)</option>
                    <option value="mm">Millimeters (mm)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Length</label>
                    <Input 
                      type="number"
                      value={formData.length || ""}
                      onChange={(e) => setFormData({...formData, length: parseFloat(e.target.value) || 0})}
                      className="font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Width</label>
                    <Input 
                      type="number"
                      value={formData.width || ""}
                      onChange={(e) => setFormData({...formData, width: parseFloat(e.target.value) || 0})}
                      className="font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Rate per sq {formData.unit} (Rs)</label>
                  <Input 
                    type="number"
                    value={formData.rate_per_sq_unit || ""}
                    onChange={(e) => setFormData({...formData, rate_per_sq_unit: parseFloat(e.target.value) || 0})}
                    className="font-mono text-slate-800"
                  />
                </div>

                {/* Live Area and Total Price Calculator Box */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-500">
                    <span className="flex items-center gap-1"><Ruler size={13} /> Total Area:</span>
                    <span className="font-bold text-slate-700 font-mono">
                      {calculatedArea} sq {formData.unit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-200 pt-2 font-bold text-sm">
                    <span className="text-slate-600">Calculated Net Price:</span>
                    <span className="font-mono text-blue-600">
                      Rs {calculatedPrice.toLocaleString()}
                    </span>
                  </div>
                </div>

                <Button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  Save Dimensions Entry
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
