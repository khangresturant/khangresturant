'use client';

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Store, FileText, ShoppingCart, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  Truck, 
  XCircle, 
  Phone, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  MapPin, 
  User, 
  DollarSign, 
  MessageSquare,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface OnlineOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  total_amount: number;
  delivery_fee: number;
  payment_mode: string;
  status: string;
  items: any[];
  notes?: string;
  invoice_id?: string | null;
  created_at: string;
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  pending: { label: "Incoming Pending", bg: "bg-amber-100 dark:bg-amber-950/80", text: "text-amber-800 dark:text-amber-300", icon: Clock },
  accepted: { label: "Accepted & Packing", bg: "bg-blue-100 dark:bg-blue-950/80", text: "text-blue-800 dark:text-blue-300", icon: CheckCircle2 },
  out_for_delivery: { label: "Out for Delivery", bg: "bg-purple-100 dark:bg-purple-950/80", text: "text-purple-800 dark:text-purple-300", icon: Truck },
  delivered: { label: "Delivered & Closed", bg: "bg-emerald-100 dark:bg-emerald-950/80", text: "text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", bg: "bg-rose-100 dark:bg-rose-950/80", text: "text-rose-800 dark:text-rose-300", icon: XCircle },
};

export default function MerchantEcommerceDeskPage() {
  const { shopId, shopName } = useShop();
  const supabase = createClient();

  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [shopDetails, setShopDetails] = useState<any>(null);

  useEffect(() => {
    if (shopId) {
      fetchOrders();
      fetchShopMeta();

      // Realtime subscription for incoming online orders
      const channel = supabase
        .channel("online_orders_changes")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "online_orders", filter: `shop_id=eq.${shopId}` },
          (payload: any) => {
            toast.success("🔔 NEW INCOMING ONLINE ORDER RECEIVED!", { duration: 8000 });
            setOrders((prev) => [payload.new as OnlineOrder, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [shopId]);

  const fetchShopMeta = async () => {
    const { data } = await supabase
      .from("shops")
      .select("has_ecommerce, store_slug, delivery_charges")
      .eq("id", shopId)
      .maybeSingle();
    if (data) setShopDetails(data);
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("online_orders")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setOrders(data);
      }
    } catch (err) {
      console.error("Error fetching online orders:", err);
    } finally {
      setLoading(false);
    }
  };

    const handleProcessInPosTerminal = (order: any) => {
    if (typeof window !== "undefined" && shopId) {
      localStorage.setItem(`pos_ecommerce_incoming_cart_${shopId}`, JSON.stringify(order));
      toast.success("Redirecting to POS Terminal with order items...");
      window.location.href = "/dashboard/pos";
    }
  };

  const handleCreatePosBillDirectly = async (order: any) => {
    try {
      const { data: invData, error: invErr } = await supabase
        .from("invoices")
        .insert([{
          shop_id: shopId,
          total_amount: order.total_amount,
          paid_amount: order.total_amount,
          payment_mode: order.payment_mode || "cash",
          status: "paid",
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_address: order.delivery_address,
          delivery_fee: order.delivery_fee || 0,
          remarks: `🛒 [E-Commerce Order] ${order.customer_name} (${order.customer_phone})`
        }])
        .select("id")
        .single();

      if (invErr) throw invErr;

      if (invData && Array.isArray(order.items)) {
        const invItemsPayload = order.items.map((item: any) => ({
          invoice_id: invData.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal || (item.unit_price * item.quantity)
        }));

        await supabase.from("invoice_items").insert(invItemsPayload);

        // Deduct stock
        for (const item of order.items) {
          if (item.product_id) {
            const { data: prod } = await supabase
              .from("products")
              .select("current_stock")
              .eq("id", item.product_id)
              .single();

            if (prod) {
              const newStock = Math.max(0, (Number(prod.current_stock) || 0) - Number(item.quantity));
              await supabase
                .from("products")
                .update({ current_stock: newStock })
                .eq("id", item.product_id);
            }
          }
        }
      }

      await supabase
        .from("online_orders")
        .update({ status: "accepted", invoice_id: invData?.id })
        .eq("id", order.id);

      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "accepted" } : o)));
      toast.success("🎉 POS Invoice Created & Stock Deducted! Check Sales Register.");
    } catch (err: any) {
      toast.error("Failed to create POS bill: " + err.message);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const targetOrder = orders.find(o => o.id === orderId);

      // If accepting order, automatically create POS Invoice & deduct stock
      if (newStatus === "accepted" && targetOrder) {
        // 1. Insert into invoices table
        const { data: invData, error: invErr } = await supabase
          .from("invoices")
          .insert([{
            shop_id: shopId,
            total_amount: targetOrder.total_amount,
            paid_amount: targetOrder.total_amount,
            payment_mode: targetOrder.payment_mode || "cash",
            status: "paid",
            customer_name: targetOrder.customer_name,
            customer_phone: targetOrder.customer_phone,
            customer_address: targetOrder.delivery_address,
            delivery_fee: targetOrder.delivery_fee || 0,
            remarks: `🛒 [E-Commerce Sale] Online Order #${orderId.slice(0, 8)}`
          }])
          .select("id")
          .single();

        if (invErr) throw invErr;

        // 2. Insert invoice items and update product stock
        if (invData && Array.isArray(targetOrder.items)) {
          const invItemsPayload = targetOrder.items.map((item: any) => ({
            invoice_id: invData.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal || (item.unit_price * item.quantity)
          }));

          await supabase.from("invoice_items").insert(invItemsPayload);

          // Deduct stock for each product
          for (const item of targetOrder.items) {
            if (item.product_id) {
              const { data: prod } = await supabase
                .from("products")
                .select("current_stock")
                .eq("id", item.product_id)
                .single();

              if (prod) {
                const newStock = Math.max(0, (Number(prod.current_stock) || 0) - Number(item.quantity));
                await supabase
                  .from("products")
                  .update({ current_stock: newStock })
                  .eq("id", item.product_id);
              }
            }
          }
        }
      }

      const { error } = await supabase
        .from("online_orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      toast.success(`Order status updated to ${newStatus}!`);
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  const filteredOrders = orders.filter((o) =>
    activeTab === "all" ? true : o.status === activeTab
  );

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Merchant E-Commerce Desk
            </div>
            {pendingCount > 0 && (
              <div className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 animate-pulse">
                {pendingCount} Pending Orders
              </div>
            )}
          </div>
          <div className="text-xs text-slate-300 font-bold flex items-center gap-1.5 pt-1">
            <Store className="text-emerald-400" size={16} /> Real-time Storefront Order Desk
          </div>
          <p className="text-xs text-slate-400">
            Real-time incoming order desk for your E-Commerce storefront
          </p>
        </div>

        <div className="flex items-center gap-3">
          {shopDetails?.store_slug && (
            <a
              href={`/store/${shopDetails.store_slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20"
            >
              <ExternalLink size={14} /> Open Live Store
            </a>
          )}
          <Button onClick={fetchOrders} variant="outline" className="h-9 px-3 border-slate-700 text-slate-200">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: "all", label: "All Orders" },
          { id: "pending", label: `Pending (${pendingCount})` },
          { id: "accepted", label: "Accepted" },
          { id: "out_for_delivery", label: "Out for Delivery" },
          { id: "delivered", label: "Delivered" },
          { id: "cancelled", label: "Cancelled" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === tab.id
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-slate-100 dark:bg-slate-900 rounded-3xl animate-pulse p-6 border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md mx-auto">
          <ShoppingBag size={44} className="mx-auto text-slate-400 mb-2" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Online Orders Found</h3>
          <p className="text-xs text-slate-500 mt-1">Orders placed on your storefront will appear here instantly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map((order) => {
            const badge = STATUS_BADGES[order.status] || STATUS_BADGES.pending;
            const StatusIcon = badge.icon;

            return (
              <div
                key={order.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                      <StatusIcon size={12} /> {badge.label}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    Rs {order.total_amount.toLocaleString()}
                  </div>
                </div>

                {/* Customer Details */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <User size={14} className="text-emerald-500" />
                    <div>{order.customer_name}</div>
                    <a href={`tel:${order.customer_phone}`} className="ml-auto flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
                      <Phone size={12} /> {order.customer_phone}
                    </a>
                  </div>

                  <div className="flex items-start gap-2 text-slate-500">
                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <div className="line-clamp-2">{order.delivery_address}</div>
                  </div>
                </div>

                {/* Ordered Items Summary */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1 text-xs">
                  {Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-medium">
                      <div>• {item.name} <strong className="text-emerald-600 dark:text-emerald-400">(x{item.quantity})</strong></div>
                      <div>Rs {(item.subtotal || item.unit_price * item.quantity).toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                {/* Actions Bar */}
                <div className="flex flex-wrap items-center justify-between pt-2 gap-2 border-t border-slate-100 dark:border-slate-800/80">
                  {order.invoice_id ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-black border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 size={14} className="text-emerald-500" /> POS Bill Processed (بل بن چکا ہے)
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleCreatePosBillDirectly(order)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] h-8 rounded-xl shadow-sm"
                      >
                        <FileText size={12} className="mr-1" /> Create POS Bill (POS بل بنائیں)
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handleProcessInPosTerminal(order)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] h-8 rounded-xl shadow-sm"
                      >
                        <ShoppingCart size={12} className="mr-1" /> Open in POS (POS Cart me Load Karein)
                      </Button>
                    </div>
                  )}
                  <a
                    href={`https://wa.me/${order.customer_phone.replace(/[^0-9]/g, "")}?text=Hi%20${encodeURIComponent(order.customer_name)},%20your%20order%20from%20${encodeURIComponent(shopName || "")}%20is%20${order.status}.`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl text-[11px] font-bold hover:bg-emerald-100"
                  >
                    <MessageSquare size={12} /> WhatsApp
                  </a>

                  <div className="flex items-center gap-1.5">
                    {order.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(order.id, "accepted")}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] h-8 rounded-xl"
                      >
                        Accept Order
                      </Button>
                    )}

                    {order.status === "accepted" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(order.id, "out_for_delivery")}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] h-8 rounded-xl"
                      >
                        Dispatch Rider
                      </Button>
                    )}

                    {order.status === "out_for_delivery" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(order.id, "delivered")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] h-8 rounded-xl"
                      >
                        Mark Delivered
                      </Button>
                    )}

                    {order.status !== "delivered" && order.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(order.id, "cancelled")}
                        className="border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 text-[11px] h-8 rounded-xl"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
