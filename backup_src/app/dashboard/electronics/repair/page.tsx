"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Smartphone, Search, PlusCircle, Trash2, Edit, Calendar, 
  Loader2, Save, X, Phone, User, Wrench, ShieldCheck 
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RepairTicket = {
  id: string;
  party_id: string;
  device_model: string | null;
  imei_number: string | null;
  issue_description: string | null;
  estimated_cost: number;
  status: "pending" | "repairing" | "ready" | "delivered";
  created_at: string;
  parties?: any;
};

type Party = { id: string; name: string; phone: string | null };

export default function MobileRepairTicketsPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTicket, setEditingTicket] = useState<RepairTicket | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    party_id: "",
    device_model: "",
    imei_number: "",
    issue_description: "",
    estimated_cost: 0,
    status: "pending" as any
  });

  useEffect(() => {
    if (shopId) {
      fetchTickets();
      fetchCustomers();
    }
  }, [shopId]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("repair_tickets")
        .select(`
          id, party_id, device_model, imei_number, issue_description, estimated_cost, status, created_at,
          parties ( name, phone )
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err: any) {
      toast.error("Failed to load repair tickets: " + err.message);
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
    setEditingTicket(null);
    setFormData({
      party_id: customers[0]?.id || "",
      device_model: "",
      imei_number: "",
      issue_description: "",
      estimated_cost: 1500,
      status: "pending"
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: RepairTicket) => {
    setEditingTicket(t);
    setFormData({
      party_id: t.party_id,
      device_model: t.device_model || "",
      imei_number: t.imei_number || "",
      issue_description: t.issue_description || "",
      estimated_cost: Number(t.estimated_cost) || 0,
      status: t.status
    });
    setIsModalOpen(true);
  };

  const handleSaveTicket = async () => {
    if (!formData.party_id || !formData.device_model) {
      toast.error("Please select a customer and enter the device model.");
      return;
    }

    setIsSubmitting(true);
    try {
      const dbPayload = {
        shop_id: shopId,
        party_id: formData.party_id,
        device_model: formData.device_model,
        imei_number: formData.imei_number || null,
        issue_description: formData.issue_description || null,
        estimated_cost: formData.estimated_cost,
        status: formData.status
      };

      if (editingTicket) {
        const { error } = await supabase
          .from("repair_tickets")
          .update(dbPayload)
          .eq("id", editingTicket.id);

        if (error) throw error;
        toast.success("Repair ticket updated!");
      } else {
        const { error } = await supabase
          .from("repair_tickets")
          .insert(dbPayload);

        if (error) throw error;
        toast.success("Repair ticket opened!");
      }

      setIsModalOpen(false);
      fetchTickets();
    } catch (err: any) {
      toast.error("Error saving ticket: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: "pending" | "repairing" | "ready" | "delivered") => {
    try {
      const { error } = await supabase
        .from("repair_tickets")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Ticket status updated to ${status}`);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this repair ticket?")) return;
    try {
      const { error } = await supabase
        .from("repair_tickets")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Ticket deleted.");
      fetchTickets();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  const getCustomerDetails = (parties: any) => {
    if (!parties) return { name: "Unknown", phone: null };
    if (Array.isArray(parties)) {
      return parties[0] || { name: "Unknown", phone: null };
    }
    return parties;
  };

  const filtered = tickets.filter(t => {
    const customer = getCustomerDetails(t.parties);
    return customer.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (t.device_model && t.device_model.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.imei_number && t.imei_number.includes(searchQuery));
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Mobile & Device Repairing</h2>
          <p className="text-slate-500 mt-1">Book repair tickets, input fault diagnoses, trace IMEI numbers, and log ready alerts.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search model, IMEI..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Book Repair Job
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
            <span>Loading repair tickets...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            No active device repair tickets.
          </div>
        ) : (
          filtered.map(item => {
            const customer = getCustomerDetails(item.parties);

            return (
              <motion.div 
                whileHover={{ y: -3 }}
                key={item.id} 
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
              >
                <div className={`absolute top-0 left-0 w-full h-1.5 ${
                  item.status === 'delivered' 
                    ? 'bg-slate-400' 
                    : item.status === 'ready' 
                      ? 'bg-emerald-500' 
                      : item.status === 'repairing' 
                        ? 'bg-blue-500' 
                        : 'bg-amber-500'
                }`}></div>

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <Smartphone size={16} className="text-slate-400" /> {item.device_model}
                      </h3>
                      {item.imei_number && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">IMEI: {item.imei_number}</p>
                      )}
                    </div>
                    
                    <select
                      value={item.status}
                      onChange={(e) => updateStatus(item.id, e.target.value as any)}
                      className={`text-xs font-bold border rounded px-2 py-1 focus:outline-none ${
                        item.status === "delivered"
                          ? "bg-slate-50 border-slate-200 text-slate-600"
                          : item.status === "ready"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : item.status === "repairing"
                              ? "bg-blue-50 border-blue-200 text-blue-800"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                      }`}
                    >
                      <option value="pending">Pending Fault</option>
                      <option value="repairing">Repairing</option>
                      <option value="ready">Ready / Settle</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </div>

                  <p className="text-xs text-slate-500 mb-3 bg-slate-50 border border-slate-100 rounded-lg p-2.5 leading-relaxed">
                    Fault diagnosis: <strong>{item.issue_description || "Not specified."}</strong>
                  </p>

                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mt-2 font-mono">
                    <span className="font-sans text-slate-400">Customer: {customer.name}</span>
                    <span className="font-bold text-blue-600">Est: Rs {item.estimated_cost}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 mt-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleOpenEditModal(item)}
                    className="text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs font-bold"
                  >
                    <Edit size={14} className="mr-1" /> Edit Job
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
              </motion.div>
            );
          })
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
                  {editingTicket ? "Edit Repair Ticket" : "Book Repair Job"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Customer Selection</label>
                  <select
                    value={formData.party_id}
                    onChange={(e) => setFormData({...formData, party_id: e.target.value})}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Device Model</label>
                    <Input 
                      placeholder="e.g. iPhone 15 Pro" 
                      value={formData.device_model}
                      onChange={(e) => setFormData({...formData, device_model: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">IMEI Number (Optional)</label>
                    <Input 
                      placeholder="15-digit code..." 
                      value={formData.imei_number}
                      onChange={(e) => setFormData({...formData, imei_number: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fault Diagnostic Description</label>
                  <textarea
                    rows={3}
                    placeholder="Describe fault (e.g. Screen broken, charging port issue)..."
                    value={formData.issue_description}
                    onChange={(e) => setFormData({...formData, issue_description: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Estimated Cost (Rs)</label>
                    <Input 
                      type="number" 
                      value={formData.estimated_cost || ""}
                      onChange={(e) => setFormData({...formData, estimated_cost: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Repair Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="pending">Pending Fault</option>
                      <option value="repairing">Repairing</option>
                      <option value="ready">Ready / Settle</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </div>
                </div>

                <Button onClick={handleSaveTicket} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Repair Job
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
