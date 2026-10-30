"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Coffee, Search, PlusCircle, Trash2, Edit, Users, 
  Loader2, Save, X, Receipt 
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RestTable = {
  id: string;
  name: string;
  capacity: number;
  status: "available" | "occupied" | "cleaning";
  floor_name?: string | null;
  section_name?: string | null;
  active_invoice_id?: string | null;
  invoices?: {
    total_amount: number;
  } | null;
};

export default function RestaurantTablesPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [tables, setTables] = useState<RestTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [editingTable, setEditingTable] = useState<RestTable | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    capacity: 4,
    status: "available" as "available" | "occupied" | "cleaning",
    floor_name: "Ground",
    section_name: "",
  });
  const [floorFilter, setFloorFilter] = useState<string>("all");

  const fetchTables = async () => {
    try {
      // Prefer P1 columns + unambiguous FK (active_invoice_id → invoices)
      let { data, error } = await supabase
        .from("restaurant_tables")
        .select(`
          id,
          name,
          capacity,
          status,
          floor_name,
          section_name,
          active_invoice_id,
          invoices!active_invoice_id ( total_amount )
        `)
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      // Fallback when floor/section columns not migrated yet
      if (
        error &&
        (error.message?.includes("floor_name") ||
          error.message?.includes("section_name") ||
          error.message?.includes("schema cache"))
      ) {
        ({ data, error } = await supabase
          .from("restaurant_tables")
          .select(`
            id,
            name,
            capacity,
            status,
            active_invoice_id,
            invoices!active_invoice_id ( total_amount )
          `)
          .eq("shop_id", shopId)
          .order("name", { ascending: true }));
      }

      // Last resort: no invoice embed
      if (error && error.message?.includes("relationship")) {
        ({ data, error } = await supabase
          .from("restaurant_tables")
          .select("id, name, capacity, status, active_invoice_id")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }));
      }

      if (error) throw error;
      setTables(data || []);
    } catch (err: any) {
      toast.error("Failed to load tables: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!shopId) return;
    fetchTables();

    // Setup Postgres real-time channel
    const channel = supabase
      .channel("restaurant_tables_db_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurant_tables", filter: `shop_id=eq.${shopId}` },
        () => {
          fetchTables();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId]);

  const handleOpenAddModal = () => {
    setEditingTable(null);
    setFormData({ name: "", capacity: 4, status: "available", floor_name: "Ground", section_name: "" });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: RestTable) => {
    setEditingTable(t);
    setFormData({
      name: t.name,
      capacity: t.capacity,
      status: t.status,
      floor_name: t.floor_name || "Ground",
      section_name: t.section_name || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Please enter a name or number for the table.");
      return;
    }

    setIsSubmitting(true);
    try {
      const withFloors = {
        name: formData.name,
        capacity: formData.capacity,
        status: formData.status,
        floor_name: formData.floor_name || "Ground",
        section_name: formData.section_name || null,
      };
      const baseOnly = {
        name: formData.name,
        capacity: formData.capacity,
        status: formData.status,
      };

      if (editingTable) {
        let { error } = await supabase
          .from("restaurant_tables")
          .update(withFloors)
          .eq("id", editingTable.id);
        if (error && (error.message?.includes("floor_name") || error.message?.includes("section_name"))) {
          ({ error } = await supabase
            .from("restaurant_tables")
            .update(baseOnly)
            .eq("id", editingTable.id));
        }
        if (error) throw error;
        toast.success("Table layout updated!");
      } else {
        let { error } = await supabase
          .from("restaurant_tables")
          .insert({ shop_id: shopId, ...withFloors });
        if (error && (error.message?.includes("floor_name") || error.message?.includes("section_name"))) {
          ({ error } = await supabase
            .from("restaurant_tables")
            .insert({ shop_id: shopId, ...baseOnly }));
        }
        if (error) throw error;
        toast.success("New dining table registered!");
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error("Failed to save table: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: "available" | "occupied" | "cleaning") => {
    try {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Table status changed to ${status}`);
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this table layout?")) return;
    try {
      const { error } = await supabase
        .from("restaurant_tables")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Table deleted successfully.");
    } catch (err: any) {
      toast.error("Failed to delete table: " + err.message);
    }
  };

  const floors = Array.from(new Set(tables.map((t) => t.floor_name || "Ground")));
  const filtered = tables.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFloor = floorFilter === "all" || (t.floor_name || "Ground") === floorFilter;
    return matchesSearch && matchesFloor;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900">Table Management</h2>
          
        </div>
        <div className="flex items-center gap-3">
          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="border rounded-lg h-10 px-2 text-xs font-semibold"
          >
            <option value="all">All floors</option>
            {floors.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
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

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-xl mx-auto shadow-sm">
          <Coffee className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800">No tables defined</h3>
          
          <Button onClick={handleOpenAddModal} className="mt-5 bg-blue-600 hover:bg-blue-700 text-white">
            <PlusCircle className="mr-2 h-4 w-4" /> Register First Table
          </Button>
        </div>
      ) : (
        /* Grid */
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
                    
                  </div>
                  
                  <select
                    value={item.status}
                    onChange={(e) => updateStatus(item.id, e.target.value as any)}
                    className={`text-xs font-bold border rounded px-2 py-1 focus:outline-none cursor-pointer ${
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

                {item.status === "occupied" && item.invoices?.total_amount ? (
                  <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-lg flex items-center justify-between text-xs font-semibold mb-4">
                    <span className="flex items-center gap-1 text-blue-700"><Receipt size={13} /> Active Bill:</span>
                    <span className="font-bold text-blue-800 font-mono">Rs {Number(item.invoices.total_amount).toLocaleString()}</span>
                  </div>
                ) : item.status === "occupied" ? (
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-xs font-semibold mb-4 text-slate-500">
                    <span className="flex items-center gap-1"><Receipt size={13} /> Taking Order...</span>
                  </div>
                ) : null}
              </div>

              {/* Actions */}
              {/* Actions */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <a
                  href={`/dashboard/restaurant/pos`}
                  className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  Open in POS →
                </a>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleOpenEditModal(item)}
                    className="text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs font-bold h-7 px-2"
                  >
                    <Edit size={13} className="mr-1" /> Edit
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(item.id)}
                    className="text-slate-500 hover:text-red-600 hover:bg-slate-100 text-xs font-bold h-7 px-2"
                  >
                    <Trash2 size={13} />
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

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Floor</label>
                    <Input
                      placeholder="Ground / 1st"
                      value={formData.floor_name}
                      onChange={(e) => setFormData({ ...formData, floor_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Section</label>
                    <Input
                      placeholder="Patio / VIP"
                      value={formData.section_name}
                      onChange={(e) => setFormData({ ...formData, section_name: e.target.value })}
                    />
                  </div>
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

                <Button 
                  onClick={handleSave} 
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-1"><Loader2 className="animate-spin h-4 w-4" /> Saving...</span>
                  ) : "Save Dining Layout"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
