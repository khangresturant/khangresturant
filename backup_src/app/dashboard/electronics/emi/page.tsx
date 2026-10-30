"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CreditCard, Search, PlusCircle, Trash2, Edit, Calendar, 
  Loader2, Save, X, Phone, User, Landmark, DollarSign, Check 
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EMISchedule = {
  id: string;
  invoice_id: string;
  due_date: string;
  installment_amount: number;
  late_fee: number;
  status: "unpaid" | "paid";
  created_at: string;
  invoices?: any;
};

export default function EMISchedulesPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [schedules, setSchedules] = useState<EMISchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (shopId) {
      fetchSchedules();
    }
  }, [shopId]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      // Query emi_schedules, joining invoices and customer parties
      const { data, error } = await supabase
        .from("emi_schedules")
        .select(`
          id, invoice_id, due_date, installment_amount, late_fee, status, created_at,
          invoices (
            total_amount,
            parties ( name, phone )
          )
        `)
        .order("due_date", { ascending: true });

      if (error) throw error;
      setSchedules(data || []);
    } catch (err: any) {
      toast.error("Failed to load installments data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      const { error } = await supabase
        .from("emi_schedules")
        .update({ status: "paid" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Installment marked as PAID!");
      
      // Update local state directly
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, status: "paid" } : s));
    } catch (err: any) {
      toast.error("Failed to record payment: " + err.message);
    }
  };

  const getCustomerDetails = (inv: any) => {
    if (!inv) return { name: "Walk-in Customer", phone: null };
    const actualInv = Array.isArray(inv) ? inv[0] : inv;
    if (!actualInv || !actualInv.parties) return { name: "Walk-in Customer", phone: null };
    const party = Array.isArray(actualInv.parties) ? actualInv.parties[0] : actualInv.parties;
    return { name: party.name, phone: party.phone };
  };

  const filtered = schedules.filter(s => {
    const customer = getCustomerDetails(s.invoices);
    return customer.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (customer.phone && customer.phone.includes(searchQuery));
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">EMI / Installment Book</h2>
          <p className="text-slate-500 mt-1">Trace monthly mobile/electronic product installment plans and payments.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search customer name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
            <span>Loading installments book...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            No EMI / Installment plans registered in the system.
          </div>
        ) : (
          filtered.map(item => {
            const customer = getCustomerDetails(item.invoices);
            const isPaid = item.status === "paid";
            const isOverdue = new Date(item.due_date) < new Date() && !isPaid;

            return (
              <motion.div 
                whileHover={{ y: -3 }}
                key={item.id} 
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
              >
                <div className={`absolute top-0 left-0 w-full h-1.5 ${
                  isPaid 
                    ? 'bg-emerald-500' 
                    : isOverdue 
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' 
                      : 'bg-blue-500'
                }`}></div>

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <User size={16} className="text-slate-400" /> {customer.name}
                      </h3>
                      {customer.phone && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone size={10} /> {customer.phone}</p>
                      )}
                    </div>
                    
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      isPaid
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : isOverdue
                          ? "bg-red-50 border-red-200 text-red-800 animate-pulse"
                          : "bg-blue-50 border-blue-200 text-blue-800"
                    }`}>
                      {isPaid ? "Paid" : isOverdue ? "Overdue" : "Pending"}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 mb-4 font-mono text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Monthly Installment:</span>
                      <span className="font-black text-slate-800">Rs {item.installment_amount}</span>
                    </div>
                    {item.late_fee > 0 && (
                      <div className="flex justify-between text-red-600 font-bold">
                        <span>Late Penalty Surcharge:</span>
                        <span>+Rs {item.late_fee}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-2">
                      <span className="font-sans text-slate-400 flex items-center gap-1"><Calendar size={12} /> Due Date:</span>
                      <span className="font-bold text-slate-700">{new Date(item.due_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  {!isPaid ? (
                    <Button 
                      onClick={() => markAsPaid(item.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9"
                    >
                      <Check size={14} className="mr-1" /> Mark as Paid
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400 italic font-bold">Payment Settled</span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

    </div>
  );
}
