"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Car, Search, PlusCircle, Trash2, Edit, 
  Tag, Compass, Loader2, Save, X, Key, Info 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Vehicle = {
  id: string;
  make: string;
  model: string;
  year: number;
  plate_number: string;
  price: number;
  status: "available" | "reserved" | "sold";
};

const initialVehicles: Vehicle[] = [
  { id: "1", make: "Toyota", model: "Corolla Altis", year: 2023, plate_number: "LEC-7821", price: 6800000, status: "available" },
  { id: "2", make: "Honda", model: "Civic Oriel", year: 2022, plate_number: "AAA-9922", price: 7400000, status: "reserved" },
  { id: "3", make: "Suzuki", model: "Alto VXL", year: 2024, plate_number: "MNS-1100", price: 2950000, status: "available" },
];

export default function ShowroomVehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    make: "",
    model: "",
    year: 2024,
    plate_number: "",
    price: 3000000,
    status: "available" as any
  });

  const handleOpenAddModal = () => {
    setEditingVehicle(null);
    setFormData({ make: "", model: "", year: 2024, plate_number: "", price: 3000000, status: "available" });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setFormData({ ...v });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.make || !formData.model || !formData.plate_number) {
      toast.error("Please fill all required vehicle fields.");
      return;
    }

    if (editingVehicle) {
      setVehicles(prev => prev.map(v => v.id === editingVehicle.id ? { ...v, ...formData } : v));
      toast.success("Vehicle specs updated successfully!");
    } else {
      const newV: Vehicle = {
        id: Math.random().toString(),
        ...formData
      };
      setVehicles([newV, ...vehicles]);
      toast.success("New vehicle added to catalog!");
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Remove this vehicle from logs?")) return;
    setVehicles(prev => prev.filter(v => v.id !== id));
    toast.success("Vehicle entry deleted.");
  };

  const filtered = vehicles.filter(v => 
    v.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.plate_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Vehicle Showroom Fleet</h2>
          <p className="text-slate-500 mt-1">Manage showroom vehicle catalog, prices, registration files, and availability.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search vehicles..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Vehicle
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            No vehicles matching your query.
          </div>
        ) : (
          filtered.map(v => (
            <motion.div 
              whileHover={{ y: -3 }}
              key={v.id} 
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
            >
              <div className={`absolute top-0 left-0 w-full h-1.5 ${
                v.status === 'available' 
                  ? 'bg-emerald-500' 
                  : v.status === 'reserved' 
                    ? 'bg-amber-500' 
                    : 'bg-slate-400'
              }`}></div>

              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-1.5">
                      <Car size={20} className="text-slate-400" /> {v.make} {v.model}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Model Year: {v.year} • Plate: {v.plate_number}</p>
                  </div>
                  
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                    v.status === 'available' 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                      : v.status === 'reserved'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}>
                    {v.status}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Asking Price</span>
                    <p className="text-base font-black text-blue-600">Rs {v.price.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 block font-semibold">Taxes status</span>
                    <span className="text-xs font-bold text-slate-700">Tax Active</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleOpenEditModal(v)}
                  className="text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs font-bold"
                >
                  <Edit size={14} className="mr-1" /> Edit Vehicle
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDelete(v.id)}
                  className="text-slate-500 hover:text-red-600 hover:bg-slate-100 text-xs font-bold"
                >
                  <Trash2 size={14} className="mr-1" /> Delete
                </Button>
              </div>
            </motion.div>
          ))
        )}
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
                  {editingVehicle ? "Edit Vehicle Specs" : "Add Showroom Vehicle"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Make</label>
                    <Input 
                      placeholder="e.g. Toyota" 
                      value={formData.make}
                      onChange={(e) => setFormData({...formData, make: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Model Name</label>
                    <Input 
                      placeholder="e.g. Corolla" 
                      value={formData.model}
                      onChange={(e) => setFormData({...formData, model: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Year</label>
                    <Input 
                      type="number"
                      value={formData.year || ""}
                      onChange={(e) => setFormData({...formData, year: parseInt(e.target.value) || 2024})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Plate Number</label>
                    <Input 
                      placeholder="e.g. LEC-100" 
                      value={formData.plate_number}
                      onChange={(e) => setFormData({...formData, plate_number: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Price (Rs)</label>
                  <Input 
                    type="number"
                    value={formData.price || ""}
                    onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="sold">Sold</option>
                  </select>
                </div>

                <Button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  Save Vehicle Details
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
