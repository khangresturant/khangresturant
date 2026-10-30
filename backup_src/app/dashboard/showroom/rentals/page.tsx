"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Key, Calendar, Search, PlusCircle, Trash2, Edit, 
  Loader2, Save, X, Phone, User, Clock, CheckCircle 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Rental = {
  id: string;
  customer_name: string;
  customer_phone: string;
  vehicle_name: string;
  start_date: string;
  end_date: string;
  daily_rate: number;
  security_deposit: number;
  status: "active" | "overdue" | "returned";
};

const initialRentals: Rental[] = [
  { 
    id: "1", 
    customer_name: "Adeel Ahmad", 
    customer_phone: "03009988776", 
    vehicle_name: "Toyota Corolla Altis (LEC-7821)", 
    start_date: "2026-06-20", 
    end_date: "2026-06-25", 
    daily_rate: 8000, 
    security_deposit: 20000, 
    status: "active" 
  },
  { 
    id: "2", 
    customer_name: "Kamran Khan", 
    customer_phone: "03217766554", 
    vehicle_name: "Suzuki Alto VXL (MNS-1100)", 
    start_date: "2026-06-15", 
    end_date: "2026-06-22", 
    daily_rate: 4000, 
    security_deposit: 10000, 
    status: "overdue" 
  }
];

export default function RentalTrackingPage() {
  const [rentals, setRentals] = useState<Rental[]>(initialRentals);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [editingRental, setEditingRental] = useState<Rental | null>(null);
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    vehicle_name: "",
    start_date: "",
    end_date: "",
    daily_rate: 5000,
    security_deposit: 15000,
    status: "active" as any
  });

  const handleOpenAddModal = () => {
    setEditingRental(null);
    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 5);
    
    setFormData({
      customer_name: "",
      customer_phone: "",
      vehicle_name: "Toyota Corolla Altis (LEC-7821)",
      start_date: today,
      end_date: nextWeek.toISOString().split("T")[0],
      daily_rate: 6000,
      security_deposit: 15000,
      status: "active"
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (r: Rental) => {
    setEditingRental(r);
    setFormData({ ...r });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.customer_name || !formData.vehicle_name || !formData.start_date || !formData.end_date) {
      toast.error("Please fill all required rental contract fields.");
      return;
    }

    if (editingRental) {
      setRentals(prev => prev.map(r => r.id === editingRental.id ? { ...r, ...formData } : r));
      toast.success("Rental contract updated successfully!");
    } else {
      const newR: Rental = {
        id: Math.random().toString(),
        ...formData
      };
      setRentals([newR, ...rentals]);
      toast.success("Rental contract logged successfully!");
    }
    setIsModalOpen(false);
  };

  const updateStatus = (id: string, status: "active" | "overdue" | "returned") => {
    setRentals(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    toast.success(`Rental agreement marked as ${status}`);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this rental record?")) return;
    setRentals(prev => prev.filter(r => r.id !== id));
    toast.success("Rental record removed.");
  };

  const filtered = rentals.filter(r => 
    r.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.vehicle_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Rental Tracking System</h2>
          <p className="text-slate-500 mt-1">Book rental sessions, trace vehicle returns, and manage security deposits.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search customer/vehicle..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Book Rental
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(item => {
          const daysTotal = Math.ceil(
            (new Date(item.end_date).getTime() - new Date(item.start_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          const totalRent = daysTotal * item.daily_rate;

          return (
            <motion.div 
              whileHover={{ y: -3 }}
              key={item.id} 
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
            >
              <div className={`absolute top-0 left-0 w-full h-1.5 ${
                item.status === 'returned' 
                  ? 'bg-emerald-500' 
                  : item.status === 'overdue' 
                    ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' 
                    : 'bg-blue-500'
              }`}></div>

              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <User size={16} className="text-slate-400" /> {item.customer_name}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone size={10} /> {item.customer_phone}</p>
                  </div>
                  
                  <select
                    value={item.status}
                    onChange={(e) => updateStatus(item.id, e.target.value as any)}
                    className={`text-xs font-bold border rounded px-2 py-1 focus:outline-none ${
                      item.status === "returned"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : item.status === "overdue"
                          ? "bg-red-50 border-red-200 text-red-800 animate-pulse"
                          : "bg-blue-50 border-blue-200 text-blue-800"
                    }`}
                  >
                    <option value="active">Active</option>
                    <option value="overdue">Overdue</option>
                    <option value="returned">Returned</option>
                  </select>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 mb-4">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 block truncate">{item.vehicle_name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-2 font-mono">
                    <span>Due: {new Date(item.end_date).toLocaleDateString()}</span>
                    <span className="font-black text-slate-800">Rs {item.daily_rate}/day</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center mb-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 font-mono text-xs">
                    <span className="text-[9px] text-slate-400 uppercase font-sans font-semibold block">Sec Deposit</span>
                    <span className="font-bold text-slate-700">Rs {item.security_deposit.toLocaleString()}</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 font-mono text-xs">
                    <span className="text-[9px] text-blue-500 uppercase font-sans font-semibold block">Est Rent ({daysTotal}d)</span>
                    <span className="font-bold text-blue-700">Rs {totalRent.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleOpenEditModal(item)}
                  className="text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs font-bold"
                >
                  <Edit size={14} className="mr-1" /> Edit Log
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
          );
        })}
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
                  {editingRental ? "Edit Rental Agreement" : "Book Rental Vehicle"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Customer Name</label>
                  <Input 
                    placeholder="Customer Name" 
                    value={formData.customer_name}
                    onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Customer Phone</label>
                  <Input 
                    placeholder="e.g. 03201234567" 
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Vehicle Selection</label>
                  <select
                    value={formData.vehicle_name}
                    onChange={(e) => setFormData({...formData, vehicle_name: e.target.value})}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Toyota Corolla Altis (LEC-7821)">Toyota Corolla Altis (LEC-7821)</option>
                    <option value="Honda Civic Oriel (AAA-9922)">Honda Civic Oriel (AAA-9922)</option>
                    <option value="Suzuki Alto VXL (MNS-1100)">Suzuki Alto VXL (MNS-1100)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Start Date</label>
                    <Input 
                      type="date" 
                      value={formData.start_date}
                      onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Return Due</label>
                    <Input 
                      type="date" 
                      value={formData.end_date}
                      onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Daily Rent (Rs)</label>
                    <Input 
                      type="number" 
                      value={formData.daily_rate || ""}
                      onChange={(e) => setFormData({...formData, daily_rate: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Security Deposit</label>
                    <Input 
                      type="number" 
                      value={formData.security_deposit || ""}
                      onChange={(e) => setFormData({...formData, security_deposit: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <Button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  Save Rental Contract
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
