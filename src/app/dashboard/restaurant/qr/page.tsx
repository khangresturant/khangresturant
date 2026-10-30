"use client";

import React, { useEffect, useMemo, useState } from "react";
import { QrCode, Copy, Loader2 } from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type TableRow = { id: string; name: string; floor_name?: string | null };

export default function RestaurantQrPage() {
  const { shopId } = useShop();
  const supabase = createClient();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const origin = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    []
  );

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    const [tRes, qRes] = await Promise.all([
      supabase.from("restaurant_tables").select("id, name, floor_name").eq("shop_id", shopId).order("name"),
      supabase
        .from("restaurant_qr_orders")
        .select("*, restaurant_tables(name)")
        .eq("shop_id", shopId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setTables(tRes.data || []);
    if (!qRes.error) setPending(qRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const copyLink = (tableId: string) => {
    const url = `${origin}/public/restaurant-order?shop=${shopId}&table=${tableId}`;
    navigator.clipboard.writeText(url);
    toast.success("QR order link copied");
  };

  const markDone = async (id: string) => {
    await supabase.from("restaurant_qr_orders").update({ status: "accepted" }).eq("id", id);
    load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 font-sans">
      <div>
        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <QrCode className="text-violet-600" /> QR Table Ordering
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Copy a guest link per table. Guests submit requests; staff accepts into POS/KOT flow.
        </p>
      </div>

      {loading ? (
        <Loader2 className="animate-spin" />
      ) : (
        <div className="rounded-2xl border bg-white divide-y">
          {tables.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs text-slate-500">{t.floor_name || "Ground"}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyLink(t.id)}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy link
              </Button>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="font-bold text-sm mb-2">Pending guest requests</h3>
        <div className="rounded-2xl border bg-white divide-y">
          {pending.map((p) => (
            <div key={p.id} className="p-4 text-sm flex justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {p.restaurant_tables?.name || "Table"} · {p.guest_name || "Guest"}
                </p>
                <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{p.items_json}</p>
                {p.notes && <p className="text-xs text-amber-700 mt-1">{p.notes}</p>}
              </div>
              <Button size="sm" onClick={() => markDone(p.id)} className="bg-emerald-600 text-white shrink-0">
                Accept
              </Button>
            </div>
          ))}
          {pending.length === 0 && (
            <p className="p-6 text-center text-slate-500 text-sm">No pending QR orders</p>
          )}
        </div>
      </div>
    </div>
  );
}
