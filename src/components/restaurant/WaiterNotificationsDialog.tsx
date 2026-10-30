"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Bell, Loader2, X, Check, RefreshCw } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { WaiterCall } from "@/lib/restaurant-deals";

type WaiterOrder = {
  id: string;
  order_number: string | null;
  created_at: string;
  total_amount: number;
  restaurant_order_status: string | null;
  waiter_id: string | null;
  service_type: string | null;
  table_id: string | null;
  user_profiles?: { name: string } | null;
  restaurant_tables?: { name: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
};

export function WaiterNotificationsDialog({ open, onClose, onCountChange }: Props) {
  const { shopId, userId } = useShop();
  const supabase = createClient();
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [waiterOrders, setWaiterOrders] = useState<WaiterOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [callsRes, ordersRes] = await Promise.all([
        supabase
          .from("restaurant_waiter_calls")
          .select(`id, table_id, invoice_id, message, call_type, status, created_at, restaurant_tables ( name )`)
          .eq("shop_id", shopId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("invoices")
          .select(`
            id, order_number, created_at, total_amount, restaurant_order_status,
            waiter_id, service_type, table_id,
            user_profiles:waiter_id ( name ),
            restaurant_tables:table_id ( name )
          `)
          .eq("shop_id", shopId)
          .not("waiter_id", "is", null)
          .eq("status", "draft")
          .in("restaurant_order_status", ["pending", "preparing"])
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const callList = (callsRes.data as WaiterCall[]) || [];
      const orderList = (ordersRes.data as WaiterOrder[]) || [];
      setCalls(callList);
      setWaiterOrders(orderList);
      onCountChange?.(callList.length + orderList.length);
    } catch {
      /* tables may not exist yet */
    } finally {
      setLoading(false);
    }
  }, [shopId, supabase, onCountChange]);

  useEffect(() => {
    if (!open) return;
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [open, load]);

  const acknowledgeCall = async (id: string) => {
    await supabase
      .from("restaurant_waiter_calls")
      .update({ status: "acknowledged", acknowledged_at: new Date().toISOString(), acknowledged_by: userId })
      .eq("id", id);
    toast.success("Call acknowledged");
    load();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 max-h-[85vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-amber-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Bell className="text-amber-600" /> Waiter Calls & Pending Orders
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load}><RefreshCw size={12} /></Button>
            <button onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="overflow-y-auto p-4 space-y-6 flex-1">
          {loading && <Loader2 className="animate-spin mx-auto text-amber-600" />}

          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Table Calls ({calls.length})</h4>
            {calls.length === 0 ? (
              <p className="text-xs text-slate-400">No pending table calls</p>
            ) : (
              <div className="space-y-2">
                {calls.map((c) => (
                  <div key={c.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                    <div>
                      <span className="font-bold text-amber-900">{c.restaurant_tables?.name || "Table"}</span>
                      <span className="text-slate-600 block">{c.message} · {new Date(c.created_at).toLocaleTimeString()}</span>
                    </div>
                    <Button size="sm" className="bg-green-600 text-white h-7" onClick={() => acknowledgeCall(c.id)}>
                      <Check size={12} className="mr-1" /> Done
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Waiter Pending Orders ({waiterOrders.length})</h4>
            {waiterOrders.length === 0 ? (
              <p className="text-xs text-slate-400">No pending waiter orders</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="p-2 text-left">Order #</th>
                    <th className="p-2">Time</th>
                    <th className="p-2">Table</th>
                    <th className="p-2">Waiter</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {waiterOrders.map((o) => (
                    <tr key={o.id} className="border-b hover:bg-slate-50">
                      <td className="p-2 font-mono font-bold">{o.order_number || o.id.slice(0, 8)}</td>
                      <td className="p-2">{new Date(o.created_at).toLocaleTimeString()}</td>
                      <td className="p-2">{o.restaurant_tables?.name || o.service_type}</td>
                      <td className="p-2">{(o as any).user_profiles?.name || "—"}</td>
                      <td className="p-2 text-right font-mono">Rs {Number(o.total_amount).toLocaleString()}</td>
                      <td className="p-2">
                        <Link href={`/dashboard/restaurant/pos?reopen=${o.id}`}>
                          <Button size="sm" variant="outline" className="h-6 text-[10px]">Load</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </motion.div>
    </div>
  );
}

export function useWaiterNotificationCount() {
  const { shopId } = useShop();
  const supabase = createClient();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!shopId) return;
    const poll = async () => {
      try {
        const [c1, c2] = await Promise.all([
          supabase.from("restaurant_waiter_calls").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("status", "pending"),
          supabase.from("invoices").select("id", { count: "exact", head: true }).eq("shop_id", shopId).not("waiter_id", "is", null).eq("status", "draft").in("restaurant_order_status", ["pending", "preparing"]),
        ]);
        setCount((c1.count || 0) + (c2.count || 0));
      } catch { /* ignore */ }
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [shopId, supabase]);

  return count;
}
