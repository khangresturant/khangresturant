"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, Plus, Search, Filter, Calendar, 
  ShoppingCart, Send, CheckCircle2, AlertCircle, 
  Trash2, Edit, Clock, MapPin, Building2, 
  RefreshCw, FileText, Loader2, Sparkles, Phone,
  Share2, ArrowUpRight, Check, PackagePlus, X
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export interface ShortBookEntry {
  id: string;
  shop_id: string;
  medicine_name: string;
  generic_salt?: string;
  company_distributor?: string;
  pack_qty_demanded: number;
  priority: "urgent" | "normal";
  customer_name?: string;
  customer_phone?: string;
  status: "pending" | "ordered" | "received" | "cancelled";
  demand_count: number; // Increment if multiple customers asked for it
  notes?: string;
  created_at: string;
}

export default function ShortBookPage() {
  const { shopId, shopName, industryType } = useShop();
  const supabase = createClient();

  const [entries, setEntries] = useState<ShortBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ShortBookEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    medicine_name: "",
    generic_salt: "",
    company_distributor: "",
    pack_qty_demanded: "1",
    priority: "normal" as "urgent" | "normal",
    customer_name: "",
    customer_phone: "",
    notes: ""
  });

  const storageKey = `pharmacy_short_book_${shopId || "default"}`;

  useEffect(() => {
    if (shopId) {
      fetchEntries();
    }
  }, [shopId]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pharmacy_short_book")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        setEntries(data);
        localStorage.setItem(storageKey, JSON.stringify(data));
      } else {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            setEntries(JSON.parse(saved));
          } catch {
            setEntries([]);
          }
        } else {
          // Sample Initial Short Book Demands
          const sampleData: ShortBookEntry[] = [
            {
              id: "sb-1",
              shop_id: shopId || "",
              medicine_name: "Augmentin 625mg Tab 14s",
              generic_salt: "Amoxicillin + Clavulanic Acid",
              company_distributor: "GlaxoSmithKline (GSK) / Muller & Phipps",
              pack_qty_demanded: 10,
              priority: "urgent",
              customer_name: "Chaudhry Rashid",
              customer_phone: "0300-1234567",
              status: "pending",
              demand_count: 4,
              notes: "3 customers asked today. High demand!",
              created_at: new Date().toISOString()
            },
            {
              id: "sb-2",
              shop_id: shopId || "",
              medicine_name: "Nexum 40mg Cap 14s",
              generic_salt: "Esomeprazole",
              company_distributor: "Getz Pharma / Premier Agencies",
              pack_qty_demanded: 15,
              priority: "urgent",
              customer_name: "Haji Munir",
              customer_phone: "0321-7654321",
              status: "pending",
              demand_count: 5,
              notes: "Stock exhausted yesterday.",
              created_at: new Date(Date.now() - 3600000).toISOString()
            },
            {
              id: "sb-3",
              shop_id: shopId || "",
              medicine_name: "Ventolin Inhaler 200 Dose",
              generic_salt: "Salbutamol",
              company_distributor: "GSK / M&P",
              pack_qty_demanded: 6,
              priority: "normal",
              customer_name: "",
              customer_phone: "",
              status: "ordered",
              demand_count: 2,
              notes: "Order placed with Booker Imran.",
              created_at: new Date(Date.now() - 86400000).toISOString()
            }
          ];
          setEntries(sampleData);
          localStorage.setItem(storageKey, JSON.stringify(sampleData));
        }
      }
    } catch {
      const saved = localStorage.getItem(storageKey);
      if (saved) setEntries(JSON.parse(saved));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingEntry(null);
    setFormData({
      medicine_name: "",
      generic_salt: "",
      company_distributor: "",
      pack_qty_demanded: "1",
      priority: "normal",
      customer_name: "",
      customer_phone: "",
      notes: ""
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ShortBookEntry) => {
    setEditingEntry(item);
    setFormData({
      medicine_name: item.medicine_name,
      generic_salt: item.generic_salt || "",
      company_distributor: item.company_distributor || "",
      pack_qty_demanded: String(item.pack_qty_demanded),
      priority: item.priority,
      customer_name: item.customer_name || "",
      customer_phone: item.customer_phone || "",
      notes: item.notes || ""
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.medicine_name.trim()) {
      toast.error("Please enter medicine name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ShortBookEntry = {
        id: editingEntry ? editingEntry.id : `sb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        shop_id: shopId || "",
        medicine_name: formData.medicine_name.trim(),
        generic_salt: formData.generic_salt.trim() || undefined,
        company_distributor: formData.company_distributor.trim() || "Local / Standard",
        pack_qty_demanded: parseFloat(formData.pack_qty_demanded) || 1,
        priority: formData.priority,
        customer_name: formData.customer_name.trim() || undefined,
        customer_phone: formData.customer_phone.trim() || undefined,
        status: editingEntry ? editingEntry.status : "pending",
        demand_count: editingEntry ? editingEntry.demand_count : 1,
        notes: formData.notes.trim() || undefined,
        created_at: editingEntry ? editingEntry.created_at : new Date().toISOString()
      };

      try {
        if (editingEntry) {
          await supabase.from("pharmacy_short_book").upsert([payload]);
        } else {
          await supabase.from("pharmacy_short_book").insert([payload]);
        }
      } catch {}

      let updated: ShortBookEntry[];
      if (editingEntry) {
        updated = entries.map(x => x.id === editingEntry.id ? payload : x);
      } else {
        // Check if item with same medicine already exists in pending list
        const existingIdx = entries.findIndex(x => x.status === "pending" && x.medicine_name.toLowerCase() === payload.medicine_name.toLowerCase());
        if (existingIdx >= 0) {
          const clone = [...entries];
          clone[existingIdx].demand_count = (clone[existingIdx].demand_count || 1) + 1;
          clone[existingIdx].pack_qty_demanded += payload.pack_qty_demanded;
          updated = clone;
          toast.success(`Demand count increased for "${payload.medicine_name}"! Total requests: ${clone[existingIdx].demand_count}`);
        } else {
          updated = [payload, ...entries];
          toast.success("Medicine added to Short Book!");
        }
      }
      setEntries(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: "pending" | "ordered" | "received" | "cancelled") => {
    try {
      await supabase.from("pharmacy_short_book").update({ status: newStatus }).eq("id", id);
    } catch {}
    const updated = entries.map(x => x.id === id ? { ...x, status: newStatus } : x);
    setEntries(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    toast.success(`Status updated to ${newStatus}!`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this demand from Short Book?")) return;
    try {
      await supabase.from("pharmacy_short_book").delete().eq("id", id);
    } catch {}
    const updated = entries.filter(x => x.id !== id);
    setEntries(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    toast.success("Entry removed.");
  };

  // WhatsApp Order to Distributor
  const handleSendWhatsAppOrder = (distributorFilter?: string) => {
    const pendingItems = entries.filter(x => x.status === "pending");
    if (pendingItems.length === 0) {
      toast.error("No pending short medicines to order.");
      return;
    }

    let text = `📦 *${shopName?.toUpperCase() || "PHARMACY"} - SHORT BOOK PURCHASE DEMAND*\n`;
    text += `📅 Date: ${new Date().toLocaleDateString()}\n`;
    text += `------------------------------------\n`;
    pendingItems.forEach((item, idx) => {
      text += `${idx + 1}. *${item.medicine_name}* - Qty: ${item.pack_qty_demanded} packs`;
      if (item.company_distributor) text += ` (${item.company_distributor})`;
      if (item.priority === "urgent") text += ` ⚠️ *URGENT*`;
      text += `\n`;
    });
    text += `------------------------------------\n`;
    text += `Please confirm booking and supply earliest. Thank you!`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  // Customer Alert WhatsApp
  const handleNotifyCustomer = (item: ShortBookEntry) => {
    if (!item.customer_phone) {
      toast.error("No customer phone recorded for this item.");
      return;
    }
    const cleanPhone = item.customer_phone.replace(/[^0-9]/g, "");
    const waPhone = cleanPhone.startsWith("0") ? `92${cleanPhone.slice(1)}` : cleanPhone;
    const msg = `Assalam-o-Alaikum ${item.customer_name || "Dear Customer"}! Aap ki matlooba dawa *"${item.medicine_name}"* ${shopName || "Pharmacy"} par dastiyab hai. Aap tashreef la kar receive kar saktay hain. Shukriya!`;
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Metrics
  const metrics = useMemo(() => {
    const pending = entries.filter(x => x.status === "pending");
    const urgentCount = pending.filter(x => x.priority === "urgent").length;
    const totalPacks = pending.reduce((acc, x) => acc + (Number(x.pack_qty_demanded) || 0), 0);
    const orderedCount = entries.filter(x => x.status === "ordered").length;
    const receivedCount = entries.filter(x => x.status === "received").length;

    return {
      pendingTotal: pending.length,
      urgentCount,
      totalPacks,
      orderedCount,
      receivedCount
    };
  }, [entries]);

  // Filtered
  const filteredEntries = useMemo(() => {
    return entries.filter(x => {
      if (statusFilter !== "all" && x.status !== statusFilter) return false;
      if (priorityFilter !== "all" && x.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          x.medicine_name.toLowerCase().includes(q) ||
          (x.generic_salt && x.generic_salt.toLowerCase().includes(q)) ||
          (x.company_distributor && x.company_distributor.toLowerCase().includes(q)) ||
          (x.customer_name && x.customer_name.toLowerCase().includes(q)) ||
          (x.customer_phone && x.customer_phone.includes(q))
        );
      }
      return true;
    });
  }, [entries, statusFilter, priorityFilter, searchQuery]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-950 via-slate-900 to-yellow-950 p-5 sm:p-6 rounded-3xl text-white shadow-xl border border-amber-900/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-amber-500/30 text-amber-300 border border-amber-400/30 shadow-inner">
              <BookOpen size={26} className="animate-pulse" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Short Book & Customer Demand Register
            </h1>
            <span className="bg-amber-500/20 text-amber-300 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-amber-400/40">
              Evening Order Dispatcher
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Log missing, low stock, and customer requested medicines on-the-fly and dispatch purchase orders directly to distributors.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => handleSendWhatsAppOrder()}
            size="sm"
            className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <Share2 size={15} />
            Send Order on WhatsApp
          </Button>

          <Link href="/dashboard/purchase">
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl font-bold text-xs cursor-pointer"
            >
              <ShoppingCart size={15} className="mr-1.5" />
              Open Purchase Screen
            </Button>
          </Link>

          <Button
            onClick={handleOpenAdd}
            size="sm"
            className="h-10 px-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/30 border border-amber-400/40 cursor-pointer"
          >
            <Plus size={16} className="mr-1.5 stroke-[3]" />
            + Add Short Medicine
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Pending Short Items</span>
            <BookOpen size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics.pendingTotal}</p>
          <p className="text-[11px] text-amber-600 font-bold">{metrics.totalPacks} packs total demanded</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Urgent Demands</span>
            <AlertCircle size={16} className="text-red-500" />
          </div>
          <p className="text-2xl font-black text-red-600">{metrics.urgentCount}</p>
          <p className="text-[11px] text-slate-500 font-medium">Customer waiting urgently</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Ordered to Booker</span>
            <Clock size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics.orderedCount}</p>
          <p className="text-[11px] text-blue-600 font-bold">In transit / Booking done</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Received & Fulfilled</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics.receivedCount}</p>
          <p className="text-[11px] text-emerald-600 font-bold">Customer notified</p>
        </div>
      </div>

      {/* Search & Tabs Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter("pending")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "pending"
                ? "bg-amber-600 text-white shadow-xs font-black"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Pending ({metrics.pendingTotal})
          </button>
          <button
            onClick={() => setStatusFilter("ordered")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "ordered"
                ? "bg-blue-600 text-white shadow-xs font-black"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Ordered ({metrics.orderedCount})
          </button>
          <button
            onClick={() => setStatusFilter("received")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "received"
                ? "bg-emerald-600 text-white shadow-xs font-black"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Received ({metrics.receivedCount})
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-slate-900 text-white shadow-xs font-black"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Demands
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search medicine, customer, company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-slate-50 border-slate-200 text-xs font-semibold rounded-xl"
          />
        </div>
      </div>

      {/* Main Demands Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Medicine & Generic</th>
                <th className="py-3.5 px-4">Distributor / Company</th>
                <th className="py-3.5 px-4 text-center">Demanded Qty</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Customer Contact</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action / Booker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-600" />
                    <p className="font-bold">Loading short book items...</p>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 text-sm">No short medicines in this list!</p>
                    <p className="text-xs text-slate-400 mt-1">All customer demands are satisfied or ordered.</p>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{item.medicine_name}</span>
                        {item.demand_count > 1 && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.2 rounded-full border border-amber-200">
                            {item.demand_count}x Requests
                          </span>
                        )}
                      </div>
                      {item.generic_salt && (
                        <div className="text-[10px] text-slate-500 font-bold">Salt: {item.generic_salt}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-700">{item.company_distributor || "General Distributor"}</span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="font-black text-sm px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 inline-block">
                        {item.pack_qty_demanded} Packs
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                        item.priority === "urgent"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}>
                        {item.priority === "urgent" ? "⚠️ Urgent" : "Routine"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {item.customer_name ? (
                        <div>
                          <div className="font-bold text-slate-900">{item.customer_name}</div>
                          {item.customer_phone && (
                            <button
                              onClick={() => handleNotifyCustomer(item)}
                              className="text-[10px] text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer mt-0.5"
                            >
                              <Phone size={10} /> {item.customer_phone}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">General Restock</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <select
                        value={item.status}
                        onChange={(e) => handleUpdateStatus(item.id, e.target.value as any)}
                        className={`h-7 px-2 text-[10.5px] font-bold rounded-lg border cursor-pointer ${
                          item.status === "pending"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : item.status === "ordered"
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : item.status === "received"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <option value="pending">⏳ Pending</option>
                        <option value="ordered">📦 Ordered</option>
                        <option value="received">✅ Received</option>
                        <option value="cancelled">❌ Cancelled</option>
                      </select>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.customer_phone && (
                          <button
                            onClick={() => handleNotifyCustomer(item)}
                            className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg cursor-pointer transition-colors"
                            title="WhatsApp Customer Alert"
                          >
                            <Send size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                          title="Edit Entry"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
            >
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-yellow-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-200">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      {editingEntry ? "Edit Short Book Demand" : "Add Medicine to Short Book"}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Fast counter staff restock logger</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Medicine Name & Dosage *</label>
                  <Input
                    value={formData.medicine_name}
                    onChange={(e) => setFormData({ ...formData, medicine_name: e.target.value })}
                    placeholder="e.g. Augmentin 625mg Tab 14s, Panadol Syrup..."
                    required
                    className="h-9 bg-white text-xs font-bold rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Generic Formula / Salt</label>
                    <Input
                      value={formData.generic_salt}
                      onChange={(e) => setFormData({ ...formData, generic_salt: e.target.value })}
                      placeholder="e.g. Amoxicillin + Clav"
                      className="h-9 bg-white text-xs font-medium rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Company / Distributor</label>
                    <Input
                      value={formData.company_distributor}
                      onChange={(e) => setFormData({ ...formData, company_distributor: e.target.value })}
                      placeholder="e.g. GSK / M&P, Getz, OBS"
                      className="h-9 bg-white text-xs font-medium rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Demanded Pack Qty *</label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.pack_qty_demanded}
                      onChange={(e) => setFormData({ ...formData, pack_qty_demanded: e.target.value })}
                      required
                      className="h-9 bg-white text-xs font-black rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-full h-9 px-2 bg-white border border-slate-200 text-xs font-bold rounded-xl"
                    >
                      <option value="normal">Routine Restock</option>
                      <option value="urgent">⚠️ Urgent Customer Demand</option>
                    </select>
                  </div>
                </div>

                {/* Customer Notification Details */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                  <span className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider block">
                    Optional: Customer Notification Details
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Customer Name</label>
                      <Input
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        placeholder="e.g. Chaudhry Aslam"
                        className="h-8 bg-white text-xs font-medium rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">WhatsApp / Phone</label>
                      <Input
                        value={formData.customer_phone}
                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        placeholder="e.g. 0300-1234567"
                        className="h-8 bg-white text-xs font-mono font-medium rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Notes / Instructions</label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Customer will collect at 6 PM"
                    className="h-9 bg-white text-xs font-medium rounded-xl"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="h-10 px-4 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-10 px-5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={14} className="animate-spin" /> Saving...
                      </span>
                    ) : (
                      editingEntry ? "Update Demand" : "Add to Short Book"
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
