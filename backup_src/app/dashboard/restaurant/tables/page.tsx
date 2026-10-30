"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Coffee, Search, PlusCircle, Trash2, Edit, Users, 
  Loader2, Save, X, ChefHat, Receipt, ToggleLeft 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RestTable = {
  id: string;
  name: string;
  capacity: number;
  status: "available" | "occupied" | "cleaning";
  active_bill?: number;
};

const initialTables: RestTable[] = [
  { id: "1", name: "Table 1 (Family)", capacity: 6, status: "occupied", active_bill: 4200 },
  { id: "2", name: "Table 2 (Window)", capacity: 2, status: "available" },
  { id: "3", name: "Table 3 (Main)", capacity: 4, status: "cleaning" },
  { id: "4", name: "Table 4 (VIP Cabin)", capacity: 8, status: "occupied", active_bill: 9800 }
];

export default function RestaurantTablesPage() {
  const [tables, setTables] = useState<RestTable[]>(initialTables);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [editingTable, setEditingTable] = useState<RestTable | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    capacity: 4,
    status: "available" as any,
    active_bill: 0
  });

  const handleOpenAddModal = () => {
    setEditingTable(null);
    setFormData({ name: "", capacity: 4, status: "available", active_bill: 0 });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: RestTable) => {
    setEditingTable(t);
    setFormData({
      name: t.name,
      capacity: t.capacity,
      status: t.status,
      active_bill: t.active_bill || 0
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      toast.error("Please enter a name or number for the table.");
      return;
    }

    const payload: RestTable = {
      id: editingTable ? editingTable.id : Math.random().toString(),
      name: formData.name,
      capacity: formData.capacity,
      status: formData.status,
      active_bill: formData.status === "occupied" ? formData.active_bill || 1500 : undefined
    };

    if (editingTable) {
      setTables(prev => prev.map(t => t.id === editingTable.id ? payload : t));
      toast.success("Table specifications updated!");
    } else {
      setTables([payload, ...tables]);
      toast.success("New dining table registered!");
    }
    setIsModalOpen(false);
  };

  const updateStatus = (id: string, status: "available" | "occupied" | "cleaning") => {
    setTables(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status,
          active_bill: status === "occupied" ? 1500 : undefined
        };
      }
      return t;
    }));
    toast.success(`Table status changed to ${status}`);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this table?")) return;
    setTables(prev => prev.filter(t => t.id !== id));
    toast.success("Table deleted.");
  };

  const filtered = tables.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Table Management</h2>
          <p className="text-slate-500 mt-1">Configure layout tables, trace guest orders, and control dining status.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search tables..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Table
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {filtered.map(item => (
          <motion.div 
            whileHover={{ y: -3 }}
            key={item.id} 
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between h-48"
          >
            <div className={`absolute top-0 left-0 w-full h-1.5 ${
              item.status === 'available' 
                ? 'bg-emerald-500' 
                : item.status === 'occupied' 
                  ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse' 
                  : 'bg-amber-500'
            }`}></div>

            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                    <Coffee size={18} className="text-slate-400" /> {item.name}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Users size={12} className="text-slate-400" /> Seating: {item.capacity} guests</p>
                </div>
                
                <select
                  value={item.status}
                  onChange={(e) => updateStatus(item.id, e.target.value as any)}
                  className={`text-xs font-bold border rounded px-2 py-1 focus:outline-none ${
                    item.status === "available"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : item.status === "occupied"
                        ? "bg-blue-50 border-blue-200 text-blue-800"
                        : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="cleaning">Cleaning</option>
                </select>
              </div>

              {item.status === "occupied" && item.active_bill && (
                <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg flex items-center justify-between text-xs font-semibold mb-4">
                  <span className="flex items-center gap-1 text-blue-700"><Receipt size={13} /> Active Bill:</span>
                  <span className="font-bold text-blue-800 font-mono">Rs {item.active_bill.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleOpenEditModal(item)}
                className="text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs font-bold"
              >
                <Edit size={14} className="mr-1" /> Edit Layout
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
                  {editingTable ? "Edit Table Layout" : "Add Dining Table"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Table Name/Number</label>
                  <Input 
                    placeholder="e.g. Table 5 VIP Cabin" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Seating Capacity (Guests)</label>
                  <Input 
                    type="number" 
                    value={formData.capacity || ""}
                    onChange={(e) => setFormData({...formData, capacity: parseInt(e.target.value) || 0})}
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
                    <option value="occupied">Occupied</option>
                    <option value="cleaning">Cleaning</option>
                  </select>
                </div>

                {formData.status === "occupied" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Active Bill Amount (Rs)</label>
                    <Input 
                      type="number" 
                      value={formData.active_bill || ""}
                      onChange={(e) => setFormData({...formData, active_bill: parseFloat(e.target.value) || 0})}
                      className="font-mono text-blue-600 font-bold"
                    />
                  </div>
                )}

                <Button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  Save Dining Layout
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
