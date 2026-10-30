"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Scissors, Search, PlusCircle, Calendar, 
  Trash2, Edit, Loader2, Save, X, User, DollarSign, Clock, CheckCircle2 
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StitchingOrder = {
  id: string;
  customer_id: string;
  karigar_id: string | null;
  delivery_date: string;
  status: "pending" | "cutting" | "stitching" | "completed" | "delivered";
  total_amount: number;
  karigar_wage: number;
  created_at: string;
  customers?: any;
  karigars?: any;
};

type Customer = { id: string; name: string };
type Karigar = { id: string; name: string };

export default function StitchingOrdersPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [orders, setOrders] = useState<StitchingOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [karigars, setKarigars] = useState<Karigar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOrder, setEditingOrder] = useState<StitchingOrder | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    customer_id: "",
    karigar_id: "",
    delivery_date: "",
    status: "pending" as any,
    total_amount: 0,
    karigar_wage: 0
  });

  useEffect(() => {
    if (shopId) {
      fetchOrders();
      fetchCustomers();
      fetchKarigars();
    }
  }, [shopId]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Query stitching_orders, joining customers (parties) and karigars
      const { data, error } = await supabase
        .from("stitching_orders")
        .select(`
          id, customer_id, karigar_id, delivery_date, status, total_amount, karigar_wage, created_at,
          customers:parties!stitching_orders_customer_id_fkey ( name ),
          karigars ( name )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      toast.error("Failed to load stitching orders: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("parties")
        .select("id, name")
        .eq("shop_id", shopId)
        .eq("type", "customer")
        .order("name", { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const fetchKarigars = async () => {
    try {
      const { data, error } = await supabase
        .from("karigars")
        .select("id, name")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (error) throw error;
      setKarigars(data || []);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const handleOpenAddModal = () => {
    setEditingOrder(null);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    
    setFormData({
      customer_id: customers[0]?.id || "",
      karigar_id: karigars[0]?.id || "",
      delivery_date: tomorrow.toISOString().split("T")[0],
      status: "pending",
      total_amount: 1500,
      karigar_wage: 600
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (order: StitchingOrder) => {
    setEditingOrder(order);
    setFormData({
      customer_id: order.customer_id,
      karigar_id: order.karigar_id || "",
      delivery_date: order.delivery_date,
      status: order.status,
      total_amount: Number(order.total_amount) || 0,
      karigar_wage: Number(order.karigar_wage) || 0
    });
    setIsModalOpen(true);
  };

  const handleSaveOrder = async () => {
    if (!formData.customer_id) {
      toast.error("Please select a customer.");
      return;
    }

    setIsSubmitting(true);
    try {
      const dbPayload = {
        shop_id: shopId,
        customer_id: formData.customer_id,
        karigar_id: formData.karigar_id || null,
        delivery_date: formData.delivery_date,
        status: formData.status,
        total_amount: formData.total_amount,
        karigar_wage: formData.karigar_wage
      };

      if (editingOrder) {
        // If order status changes to completed and we are editing, we can update karigar balance
        // To keep it simple: normal update
        const { error } = await supabase
          .from("stitching_orders")
          .update(dbPayload)
          .eq("id", editingOrder.id);

        if (error) throw error;
        
        // If status changed to completed, add wage to Karigar's balance
        if (formData.status === "completed" && editingOrder.status !== "completed" && formData.karigar_id) {
          await supabase.rpc("increment_karigar_balance", {
            k_id: formData.karigar_id,
            wage: formData.karigar_wage
          });
        }

        toast.success("Stitching order updated successfully!");
      } else {
        const { data, error } = await supabase
          .from("stitching_orders")
          .insert(dbPayload)
          .select()
          .single();

        if (error) throw error;

        // If created directly in completed status
        if (formData.status === "completed" && formData.karigar_id) {
          await supabase.rpc("increment_karigar_balance", {
            k_id: formData.karigar_id,
            wage: formData.karigar_wage
          });
        }

        toast.success("Stitching order registered successfully!");
      }

      setIsModalOpen(false);
      fetchOrders();
    } catch (err: any) {
      toast.error("Error saving stitching order: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateOrderStatus = async (id: string, karigarId: string | null, wage: number, oldStatus: string, newStatus: "pending" | "cutting" | "stitching" | "completed" | "delivered") => {
    try {
      const { error } = await supabase
        .from("stitching_orders")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      
      // If status changed to completed, credit Karigar's balance
      if (newStatus === "completed" && oldStatus !== "completed" && karigarId) {
        const { error: rpcError } = await supabase.rpc("increment_karigar_balance", {
          k_id: karigarId,
          wage: wage
        });
        if (rpcError) throw rpcError;
        toast.success(`Wage of Rs ${wage} credited to Karigar!`);
      }

      toast.success(`Order status updated to ${newStatus}`);
      fetchOrders();
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this order?")) return;
    try {
      const { error } = await supabase
        .from("stitching_orders")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Order deleted.");
      fetchOrders();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  const getCustomerName = (customers: any) => {
    if (!customers) return "Walk-in Customer";
    if (Array.isArray(customers)) {
      return customers[0]?.name || "Walk-in Customer";
    }
    return customers.name || "Walk-in Customer";
  };

  const getKarigarName = (karigars: any) => {
    if (!karigars) return null;
    if (Array.isArray(karigars)) {
      return karigars[0]?.name || null;
    }
    return karigars.name || null;
  };

  const filtered = orders.filter(o => {
    const cName = getCustomerName(o.customers);
    const kName = getKarigarName(o.karigars);
    return cName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (kName && kName.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Stitching Orders</h2>
          <p className="text-slate-500 mt-1">Allocate tasks to Karigars, specify wages, and track delivery timelines.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search customer/karigar..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
            <PlusCircle className="mr-2 h-4 w-4" /> Book New Order
          </Button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">Assigned Karigar</th>
                <th className="px-6 py-4">Delivery Date</th>
                <th className="px-6 py-4 text-right">Bill Total</th>
                <th className="px-6 py-4 text-right">Karigar Wage</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">Loading orders...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                    No stitching orders booked yet.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{getCustomerName(order.customers)}</td>
                    <td className="px-6 py-4">
                      {getKarigarName(order.karigars) ? (
                        <span className="font-semibold text-slate-700">{getKarigarName(order.karigars)}</span>
                      ) : (
                        <span className="text-xs text-red-500 italic font-bold">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 flex items-center gap-1.5 mt-1.5 border-none">
                      <Calendar size={14} className="text-slate-400" />
                      <span>{new Date(order.delivery_date).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-800">Rs {order.total_amount}</td>
                    <td className="px-6 py-4 text-right font-bold text-blue-600">Rs {order.karigar_wage}</td>
                    <td className="px-6 py-4 text-center">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, order.karigar_id, order.karigar_wage, order.status, e.target.value as any)}
                        className={`text-xs font-bold border rounded px-2 py-1 focus:outline-none ${
                          order.status === "delivered" || order.status === "completed"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : order.status === "stitching" || order.status === "cutting"
                              ? "bg-blue-50 border-blue-200 text-blue-800"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="cutting">Cutting</option>
                        <option value="stitching">Stitching</option>
                        <option value="completed">Completed</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleOpenEditModal(order)}
                        className="text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDelete(order.id)}
                        className="text-slate-500 hover:text-red-600 hover:bg-slate-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add/Edit Order */}
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
                  {editingOrder ? "Edit Stitching Order" : "Book Stitching Order"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Customer</label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    disabled={!!editingOrder}
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Assign Karigar (Worker)</label>
                  <select
                    value={formData.karigar_id}
                    onChange={(e) => setFormData({...formData, karigar_id: e.target.value})}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Unassigned</option>
                    {karigars.map(k => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Delivery Date</label>
                    <Input 
                      type="date" 
                      value={formData.delivery_date} 
                      onChange={(e) => setFormData({...formData, delivery_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Order Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="pending">Pending</option>
                      <option value="cutting">Cutting</option>
                      <option value="stitching">Stitching</option>
                      <option value="completed">Completed</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Total Bill (Rs)</label>
                    <Input 
                      type="number" 
                      value={formData.total_amount || ""} 
                      onChange={(e) => setFormData({...formData, total_amount: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Karigar Wage (Rs)</label>
                    <Input 
                      type="number" 
                      value={formData.karigar_wage || ""} 
                      onChange={(e) => setFormData({...formData, karigar_wage: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <Button onClick={handleSaveOrder} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Confirm Stitching Order
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
