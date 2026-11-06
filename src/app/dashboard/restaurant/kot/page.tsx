"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChefHat, Search, Check, Clock, 
  Loader2, Save, X, PlusCircle, Coffee, MessageSquare, Printer
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { syncRestaurantOrderStatus } from "@/lib/restaurant-orders";
import {
  KITCHEN_POLL_INTERVAL_MS,
  shouldPollKitchenLive,
  loadKitchenTicketForPrint,
} from "@/lib/restaurant-kitchen";
import { DEFAULT_RECEIPT_SETTINGS } from "@/components/ReceiptTemplate";
import { mergePrintSettingsFromRow } from "@/lib/merge-print-settings";
import { printRestaurantKOTSlip } from "@/lib/restaurant-receipt-print";

type KOTOrderItem = {
  id: string;
  quantity: number;
  remarks: string | null;
  product_name: string;
};

type KOTOrder = {
  id: string;
  table_id: string | null;
  table_name: string;
  items: KOTOrderItem[];
  order_time: string; // e.g. "10 mins ago" or "Just now"
  raw_created_at: string;
  status: "cooking" | "ready";
};

type DBTable = {
  id: string;
  name: string;
};

type DBProduct = {
  id: string;
  name: string;
};

export default function KitchenOrdersPage() {
  const { shopId, shopName, shopPhone, shopAddress, shopEmail } = useShop();
  const supabase = createClient();

  const [orders, setOrders] = useState<KOTOrder[]>([]);
  const [receiptSettings, setReceiptSettings] = useState(DEFAULT_RECEIPT_SETTINGS);
  const [companyDetails, setCompanyDetails] = useState<{
    name?: string;
    phone?: string;
    address?: string;
    email?: string;
  } | null>(null);
  const [tables, setTables] = useState<DBTable[]>([]);
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Time tracker state to refresh minutes ago display every minute
  const [timeTick, setTimeTick] = useState(0);

  // Form State
  const [formData, setFormData] = useState({
    table_id: "",
    selectedProductId: "",
    quantity: 1,
    remarks: "",
    items: [] as { product_id: string; name: string; quantity: number; remarks: string }[]
  });

  const getMinutesAgo = (timeStr: string) => {
    const diffMs = new Date().getTime() - new Date(timeStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins <= 0) return "Just now";
    return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("kitchen_orders")
        .select(`
          id,
          status,
          created_at,
          table_id,
          restaurant_tables ( name ),
          kitchen_order_items (
            id,
            quantity,
            remarks,
            product_id,
            products ( name )
          )
        `)
        .eq("shop_id", shopId)
        .in("status", ["cooking", "ready"])
        .order("created_at", { ascending: true });

      if (error) throw error;

      const mapped: KOTOrder[] = (data || []).map((o: any) => {
        const itemsList: KOTOrderItem[] = (o.kitchen_order_items || []).map((item: any) => ({
          id: item.id,
          quantity: Number(item.quantity),
          remarks: item.remarks || null,
          product_name: item.products?.name || "Unknown Item"
        }));

        return {
          id: o.id,
          table_id: o.table_id,
          table_name: o.restaurant_tables?.name || "Takeaway Order",
          items: itemsList,
          order_time: getMinutesAgo(o.created_at),
          raw_created_at: o.created_at,
          status: o.status as "cooking" | "ready"
        };
      });

      setOrders(mapped);
    } catch (err: any) {
      toast.error("Failed to load kitchen orders: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("id, name")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });
      if (!error && data) {
        setTables(data);
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, table_id: data[0].id }));
        }
      }
    } catch (e) {}
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });
      if (!error && data) {
        setProducts(data);
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, selectedProductId: data[0].id }));
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (!shopId) return;
    (async () => {
      const [printRes, companyRes] = await Promise.all([
        supabase.from("print_settings").select("*").eq("shop_id", shopId).maybeSingle(),
        supabase.from("company_details").select("name, phone, address, email").eq("shop_id", shopId).maybeSingle(),
      ]);
      if (printRes.data) setReceiptSettings(mergePrintSettingsFromRow(printRes.data as Record<string, unknown>));
      if (companyRes.data) setCompanyDetails(companyRes.data);
    })();
  }, [shopId, supabase]);

  const reprintKot = async (orderId: string) => {
    const payload = await loadKitchenTicketForPrint(supabase, orderId);
    if (!payload) {
      toast.error("Could not load KOT for print.");
      return;
    }
    printRestaurantKOTSlip(
      {
        orderNumber: payload.orderNumber,
        tableName: payload.tableName,
        serviceType: payload.serviceType,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        customerAddress: payload.customerAddress,
        waiterName: payload.waiterName,
        riderName: payload.riderName,
        riderPhone: payload.riderPhone,
        specialInstructions: payload.specialInstructions,
        items: payload.items,
        settings: receiptSettings,
        shopDetails: {
          name: companyDetails?.name || shopName || "Restaurant",
          phone: companyDetails?.phone || shopPhone,
          address: companyDetails?.address || shopAddress,
          email: companyDetails?.email || shopEmail,
        },
        isReprint: true,
        kotTicketId: payload.kotId,
      },
      { onError: (msg) => toast.error(msg) }
    );
    toast.success("KOT reprint sent to thermal printer");
  };

  useEffect(() => {
    if (!shopId) return;
    fetchOrders();
    fetchTables();
    fetchProducts();

    let pollId: ReturnType<typeof setInterval> | undefined;
    if (shouldPollKitchenLive()) {
      pollId = setInterval(() => fetchOrders(), KITCHEN_POLL_INTERVAL_MS);
    }

    // Setup Postgres real-time channel
    const channel = supabase
      .channel("kitchen_orders_db_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kitchen_orders", filter: `shop_id=eq.${shopId}` },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    // Auto-update order timers every 30 seconds
    const interval = setInterval(() => {
      setTimeTick(prev => prev + 1);
    }, 30000);

    return () => {
      if (pollId) clearInterval(pollId);
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [shopId]);

  // Recalculate human-readable timers on tick
  useEffect(() => {
    if (orders.length === 0) return;
    setOrders(prev => prev.map(o => ({
      ...o,
      order_time: getMinutesAgo(o.raw_created_at)
    })));
  }, [timeTick]);

  const handleAddItemToForm = () => {
    const selectedProd = products.find(p => p.id === formData.selectedProductId);
    if (!selectedProd) return;

    // Check if item already exists, if so merge quantity
    const exists = formData.items.find(it => it.product_id === selectedProd.id);
    if (exists) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(it => it.product_id === selectedProd.id 
          ? { ...it, quantity: it.quantity + prev.quantity, remarks: prev.remarks || it.remarks } 
          : it
        ),
        quantity: 1,
        remarks: ""
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, {
          product_id: selectedProd.id,
          name: selectedProd.name,
          quantity: prev.quantity,
          remarks: prev.remarks
        }],
        quantity: 1,
        remarks: ""
      }));
    }
  };

  const handleRemoveItemFromForm = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleSaveKOT = async () => {
    if (formData.items.length === 0) {
      toast.error("Please add at least one food item.");
      return;
    }

    setIsSubmitting(true);
    try {
      let invoiceId: string | null = null;
      if (formData.table_id) {
        const { data: tableRow } = await supabase
          .from("restaurant_tables")
          .select("active_invoice_id")
          .eq("id", formData.table_id)
          .maybeSingle();
        invoiceId = tableRow?.active_invoice_id || null;
      }

      // 1. Insert KOT
      const { data: newKot, error: kotErr } = await supabase
        .from("kitchen_orders")
        .insert({
          shop_id: shopId,
          table_id: formData.table_id || null,
          invoice_id: invoiceId,
          status: "cooking"
        })
        .select()
        .single();

      if (kotErr) throw kotErr;

      // 2. Insert items
      const itemsToInsert = formData.items.map(it => ({
        kitchen_order_id: newKot.id,
        product_id: it.product_id,
        quantity: it.quantity,
        remarks: it.remarks || null
      }));

      const { error: itemsErr } = await supabase
        .from("kitchen_order_items")
        .insert(itemsToInsert);

      if (itemsErr) throw itemsErr;

      if (invoiceId) {
        await syncRestaurantOrderStatus(supabase, invoiceId);
      }

      // 3. Mark table occupied if table is assigned
      if (formData.table_id) {
        await supabase
          .from("restaurant_tables")
          .update({ status: "occupied" })
          .eq("id", formData.table_id);
      }

      toast.success("KOT sent to Kitchen Chef successfully!");
      setIsModalOpen(false);
      
      // Reset Form
      setFormData({
        table_id: tables[0]?.id || "",
        selectedProductId: products[0]?.id || "",
        quantity: 1,
        remarks: "",
        items: []
      });
      fetchOrders();
    } catch (err: any) {
      toast.error("Failed to send KOT: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const markAsReady = async (id: string) => {
    try {
      const { data: kot } = await supabase
        .from("kitchen_orders")
        .select("invoice_id")
        .eq("id", id)
        .maybeSingle();

      const { error } = await supabase
        .from("kitchen_orders")
        .update({ status: "ready" })
        .eq("id", id);
      if (error) throw error;
      if (kot?.invoice_id) await syncRestaurantOrderStatus(supabase, kot.invoice_id);
      toast.success("KOT marked as READY! Waitstaff notified.");
      fetchOrders();
    } catch (err: any) {
      toast.error("Failed to mark KOT as ready: " + err.message);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const { data: kot } = await supabase
        .from("kitchen_orders")
        .select("invoice_id")
        .eq("id", id)
        .maybeSingle();

      const { error } = await supabase
        .from("kitchen_orders")
        .update({ status: "served" })
        .eq("id", id);
      if (error) throw error;
      if (kot?.invoice_id) await syncRestaurantOrderStatus(supabase, kot.invoice_id);
      toast.success("Order served and cleared from KOT display.");
      fetchOrders();
    } catch (err: any) {
      toast.error("Failed to complete order: " + err.message);
    }
  };

  const filtered = orders.filter(o => 
    o.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.items.some(item => item.product_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3">
        <div className="flex items-center gap-3 flex-wrap">
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
            <PlusCircle className="mr-2 h-4 w-4" /> Place KOT
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-xl mx-auto shadow-sm">
          <ChefHat className="h-12 w-12 text-slate-400 mx-auto mb-4 animate-bounce" />
          <h3 className="text-lg font-bold text-slate-800">Kitchen Queue is Clear!</h3>
          
        </div>
      ) : (
        /* Grid */
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
                    <div className="font-black text-slate-800 text-base">{order.table_name}</div>
                    <div className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
                      order.status === 'ready' 
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                        : 'bg-amber-50 border border-amber-200 text-amber-800 animate-pulse'
                    }`}>
                      <ChefHat size={12} /> {order.status === 'ready' ? 'Ready to Serve' : 'Cooking'}
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-1 mb-4 border-b border-slate-100 pb-2">
                    <Clock size={12} /> Sent: {order.order_time}
                  </div>

                  {/* Ordered Items List */}
                  <div className="space-y-2 mb-6">
                    {order.items.map((item) => (
                      <div key={item.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs font-bold text-slate-700 flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <div>{item.quantity}x {item.product_name}</div>
                        </div>
                        {item.remarks && (
                          <div className="text-[10px] text-amber-600 font-semibold flex items-center gap-1 bg-amber-50/50 p-1 rounded border border-amber-100 mt-1">
                            <MessageSquare size={10} /> Note: {item.remarks}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t border-slate-100 pt-4 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => reprintKot(order.id)}
                    className="h-10 px-3 text-xs font-bold border-slate-200"
                  >
                    <Printer size={14} className="mr-1" /> Reprint KOT
                  </Button>
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
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

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
                    value={formData.table_id}
                    onChange={(e) => setFormData({...formData, table_id: e.target.value})}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="">Takeaway / Walk-in (No Table)</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Select Food Item</label>
                  <select
                    value={formData.selectedProductId}
                    onChange={(e) => setFormData({...formData, selectedProductId: e.target.value})}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    {products.length === 0 ? (
                      <option value="">No products found</option>
                    ) : (
                      products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Qty</label>
                    <Input 
                      type="number"
                      min={1}
                      value={formData.quantity}
                      onChange={(e) => setFormData({...formData, quantity: Math.max(1, parseInt(e.target.value) || 1)})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cooking Note / Remarks</label>
                    <Input 
                      placeholder="e.g. Extra spicy, no oil"
                      value={formData.remarks}
                      onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleAddItemToForm} 
                  type="button" 
                  className="w-full bg-slate-800 text-white font-bold h-10 shrink-0"
                >
                  Add Item to List
                </Button>

                {/* Added Items List */}
                {formData.items.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                    {formData.items.map((item, idx) => (
                      <div key={idx} className="flex flex-col gap-1 text-xs font-semibold text-slate-700 bg-white p-2 rounded-md border border-slate-150 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>{item.quantity}x {item.name}</div>
                          <button onClick={() => handleRemoveItemFromForm(idx)} className="text-slate-400 hover:text-red-500">
                            <X size={12} />
                          </button>
                        </div>
                        {item.remarks && (
                          <div className="text-[10px] text-amber-600 font-semibold bg-amber-50/50 p-0.5 rounded px-1">Note: {item.remarks}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <Button 
                  onClick={handleSaveKOT} 
                  disabled={isSubmitting || formData.items.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-1"><Loader2 className="animate-spin h-4 w-4" /> Placing KOT...</div>
                  ) : "Send KOT to Kitchen"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
