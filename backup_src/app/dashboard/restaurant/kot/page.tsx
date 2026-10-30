"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChefHat, Search, Check, Trash2, Clock, 
  Loader2, Save, X, PlusCircle, Coffee 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type KOTOrder = {
  id: string;
  table_name: string;
  items: string[];
  order_time: string; // e.g. 10 mins ago
  status: "cooking" | "ready";
};

const initialOrders: KOTOrder[] = [
  { id: "1", table_name: "Table 1", items: ["2x Chicken Biryani (Spicy)", "1x Raita", "1x Salad", "3x Soft Drink 250ml"], order_time: "8 mins ago", status: "cooking" },
  { id: "2", table_name: "Table 4 (VIP)", items: ["1x Mutton Karahi (Full)", "4x Roti", "2x Mint Margarita"], order_time: "15 mins ago", status: "cooking" },
  { id: "3", table_name: "Table 1", items: ["1x French Fries (L)", "1x Garlic Mayo Dip"], order_time: "22 mins ago", status: "ready" }
];

export default function KitchenOrdersPage() {
  const [orders, setOrders] = useState<KOTOrder[]>(initialOrders);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    table_name: "Table 1",
    itemInput: "",
    items: [] as string[]
  });

  const handleAddItemToForm = () => {
    if (!formData.itemInput.trim()) return;
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, prev.itemInput.trim()],
      itemInput: ""
    }));
  };

  const handleRemoveItemFromForm = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleSaveKOT = () => {
    if (formData.items.length === 0) {
      toast.error("Please add at least one food item.");
      return;
    }

    const newOrder: KOTOrder = {
      id: Math.random().toString(),
      table_name: formData.table_name,
      items: formData.items,
      order_time: "Just now",
      status: "cooking"
    };

    setOrders([newOrder, ...orders]);
    toast.success("KOT sent to Kitchen Chef successfully!");
    setIsModalOpen(false);
    setFormData({ table_name: "Table 1", itemInput: "", items: [] });
  };

  const markAsReady = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "ready" as const } : o));
    toast.success("KOT marked as READY! Service staff notified.");
  };

  const handleDismiss = (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
    toast.success("Order dispatched and cleared from KOT screen.");
  };

  const filtered = orders.filter(o => 
    o.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.items.some(item => item.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Kitchen Order Tickets (KOT)</h2>
          <p className="text-slate-500 mt-1">Real-time KOT screen for chefs to view cooking queue, timers, and serving statuses.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search table/items..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Place New KOT
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filtered.map(order => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={order.id} 
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="font-black text-slate-800 text-base">{order.table_name}</span>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
                    order.status === 'ready' 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                      : 'bg-amber-50 border border-amber-200 text-amber-800 animate-pulse'
                  }`}>
                    <ChefHat size={12} /> {order.status === 'ready' ? 'Ready to Serve' : 'Cooking'}
                  </span>
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-1 mb-4 border-b border-slate-100 pb-2">
                  <Clock size={12} /> Sent: {order.order_time}
                </div>

                {/* Ordered Items List */}
                <div className="space-y-2 mb-6">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs font-bold text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 border-t border-slate-100 pt-4">
                {order.status === "cooking" ? (
                  <Button 
                    onClick={() => markAsReady(order.id)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 shadow-sm shadow-blue-200"
                  >
                    <Check size={14} className="mr-1.5" /> Mark Ready
                  </Button>
                ) : (
                  <Button 
                    onClick={() => handleDismiss(order.id)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 shadow-sm shadow-emerald-200"
                  >
                    <Check size={14} className="mr-1.5" /> Dispatch / Serve
                  </Button>
                )}
                <Button 
                  variant="outline"
                  onClick={() => handleDismiss(order.id)}
                  className="text-slate-400 hover:text-red-500 hover:border-red-200 p-2"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modal: New KOT */}
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
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-1.5">
                  <ChefHat className="text-blue-600" /> Send KOT to Kitchen
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Dining Table</label>
                  <select
                    value={formData.table_name}
                    onChange={(e) => setFormData({...formData, table_name: e.target.value})}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Table 1">Table 1 (Family)</option>
                    <option value="Table 2">Table 2 (Window)</option>
                    <option value="Table 3">Table 3 (Main)</option>
                    <option value="Table 4 (VIP)">Table 4 (VIP Cabin)</option>
                  </select>
                </div>

                {/* Add Item Row */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Add Food Item</label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="e.g. 2x Biryani, 1x Coke" 
                      value={formData.itemInput}
                      onChange={(e) => setFormData({...formData, itemInput: e.target.value})}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddItemToForm();
                        }
                      }}
                    />
                    <Button onClick={handleAddItemToForm} className="bg-slate-800 text-white font-bold h-10 shrink-0">
                      Add
                    </Button>
                  </div>
                </div>

                {/* Added Items List */}
                {formData.items.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                    {formData.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs font-semibold text-slate-700 bg-white p-2 rounded-md border border-slate-150 shadow-sm">
                        <span>{item}</span>
                        <button onClick={() => handleRemoveItemFromForm(idx)} className="text-slate-400 hover:text-red-500">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={handleSaveKOT} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  Send KOT to Kitchen
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
