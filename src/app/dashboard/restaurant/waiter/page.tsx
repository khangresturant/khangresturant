"use client";

import React, { useEffect, useState } from "react";
import {
  Bell,
  Check,
  ChefHat,
  ClipboardList,
  Coffee,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WaiterNotificationsDialog, useWaiterNotificationCount } from "@/components/restaurant/WaiterNotificationsDialog";

type TableRow = {
  id: string;
  name: string;
  status: string;
  floor_name?: string | null;
  capacity: number;
  active_invoice_id?: string | null;
};

type ReadyKot = {
  id: string;
  table_name: string;
  status: string;
  created_at: string;
};

export default function RestaurantWaiterPage() {
  const { shopId } = useShop();
  const supabase = createClient();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [readyKots, setReadyKots] = useState<ReadyKot[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const badge = useWaiterNotificationCount();

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [tRes, kRes] = await Promise.all([
        supabase
          .from("restaurant_tables")
          .select("id, name, status, floor_name, capacity, active_invoice_id")
          .eq("shop_id", shopId)
          .order("name"),
        supabase
          .from("kitchen_orders")
          .select("id, status, created_at, restaurant_tables(name)")
          .eq("shop_id", shopId)
          .eq("status", "ready")
          .order("created_at", { ascending: true }),
      ]);
      setTables((tRes.data as TableRow[]) || []);
      setReadyKots(
        (kRes.data || []).map((k: any) => ({
          id: k.id,
          status: k.status,
          created_at: k.created_at,
          table_name: k.restaurant_tables?.name || "Counter",
        }))
      );
    } catch (e: any) {
      toast.error(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (!shopId) return;
    const ch = supabase
      .channel(`waiter_${shopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurant_tables", filter: `shop_id=eq.${shopId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kitchen_orders", filter: `shop_id=eq.${shopId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [shopId]);

  const bumpServed = async (id: string) => {
    const { error } = await supabase
      .from("kitchen_orders")
      .update({ status: "served" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Marked served");
      load();
    }
  };

  const statusColor = (s: string) =>
    s === "occupied"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : s === "cleaning"
        ? "bg-slate-100 text-slate-600 border-slate-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 font-sans max-w-lg mx-auto">
      <div className="flex items-center justify-between gap-2 mb-5">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Coffee className="text-amber-600" /> Waiter
          </h1>
          <p className="text-[11px] text-slate-500 font-semibold">Mobile-first floor run</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} className="relative">
            <Bell size={14} />
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-rose-500 text-[9px] text-white flex items-center justify-center px-1">
                {badge}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Link href="/dashboard/restaurant/pos">
          <Button className="w-full bg-slate-900 text-white h-11 text-xs font-bold">
            <ClipboardList size={14} className="mr-1" /> Open POS
          </Button>
        </Link>
        <Link href="/dashboard/restaurant/kds">
          <Button variant="outline" className="w-full h-11 text-xs font-bold">
            <ChefHat size={14} className="mr-1" /> KDS
          </Button>
        </Link>
      </div>

      <h2 className="text-xs font-black uppercase text-slate-500 mb-2">Ready to serve</h2>
      <div className="space-y-2 mb-6">
        {readyKots.length === 0 ? (
          <p className="text-sm text-slate-400 border border-dashed rounded-xl p-4 text-center">
            No ready KOTs
          </p>
        ) : (
          readyKots.map((k) => (
            <div
              key={k.id}
              className="bg-white border rounded-xl p-3 flex items-center justify-between gap-2"
            >
              <div>
                <p className="font-bold text-sm text-slate-900">{k.table_name}</p>
                <p className="text-[10px] text-slate-500">
                  KOT #{k.id.slice(0, 6).toUpperCase()}
                </p>
              </div>
              <Button size="sm" className="bg-emerald-600 text-white" onClick={() => bumpServed(k.id)}>
                <Check size={14} className="mr-1" /> Served
              </Button>
            </div>
          ))
        )}
      </div>

      <h2 className="text-xs font-black uppercase text-slate-500 mb-2">Floor tables</h2>
      {loading ? (
        <Loader2 className="animate-spin text-slate-400 mx-auto" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {tables.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/restaurant/pos`}
              className={`rounded-xl border p-3 ${statusColor(t.status)}`}
            >
              <p className="font-black text-sm">{t.name}</p>
              <p className="text-[10px] opacity-80">
                {t.floor_name || "Ground"} · {t.capacity} seats
              </p>
              <p className="text-[10px] font-bold uppercase mt-1">{t.status}</p>
            </Link>
          ))}
        </div>
      )}

      <WaiterNotificationsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
