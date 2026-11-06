"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReservationRow } from "@/lib/restaurant-ops";

export default function RestaurantReservationsPage() {
  const { shopId } = useShop();
  const supabase = createClient();
  const router = useRouter();
  const [rows, setRows] = useState<(ReservationRow & { restaurant_tables?: { name: string } | null })[]>([]);
  const [tables, setTables] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    guest_name: "",
    guest_phone: "",
    party_size: 2,
    reserved_at: "",
    table_id: "",
    notes: "",
  });

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    const [rRes, tRes] = await Promise.all([
      supabase
        .from("restaurant_reservations")
        .select("*, restaurant_tables(name)")
        .eq("shop_id", shopId)
        .order("reserved_at", { ascending: true })
        .limit(100),
      supabase.from("restaurant_tables").select("id, name").eq("shop_id", shopId).order("name"),
    ]);
    if (rRes.error?.message?.includes("does not exist")) {
      toast.error("Run P1/P2 SQL from Restaurant DB Setup");
    } else if (rRes.error) {
      toast.error(rRes.error.message);
    } else {
      setRows((rRes.data as any) || []);
    }
    setTables(tRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const add = async () => {
    if (!shopId || !form.guest_name || !form.reserved_at) {
      toast.error("Guest name and time required");
      return;
    }
    const { error } = await supabase.from("restaurant_reservations").insert({
      shop_id: shopId,
      guest_name: form.guest_name,
      guest_phone: form.guest_phone || null,
      party_size: form.party_size,
      reserved_at: new Date(form.reserved_at).toISOString(),
      table_id: form.table_id || null,
      notes: form.notes || null,
      status: "booked",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Reservation booked");
      setForm({ guest_name: "", guest_phone: "", party_size: 2, reserved_at: "", table_id: "", notes: "" });
      load();
    }
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("restaurant_reservations")
      .update({ status })
      .eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const seatAndOpenPos = async (r: (typeof rows)[number]) => {
    const { error } = await supabase
      .from("restaurant_reservations")
      .update({ status: "seated" })
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const params = new URLSearchParams();
    if (r.table_id) params.set("table", r.table_id);
    if (r.guest_name) params.set("guest", r.guest_name);
    if (r.guest_phone) params.set("phone", r.guest_phone);
    router.push(`/dashboard/restaurant/pos?${params.toString()}`);
  };

  const remove = async (id: string) => {
    await supabase.from("restaurant_reservations").delete().eq("id", id);
    load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 font-sans">
      <div className="text-xs text-slate-500">
        <p>Book dining tables in advance for guest reservations.</p>
      </div>

      <div className="rounded-2xl border bg-white p-4 grid sm:grid-cols-2 gap-2">
        <Input placeholder="Guest name" value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} />
        <Input placeholder="Phone" value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} />
        <Input type="number" placeholder="Party size" value={form.party_size} onChange={(e) => setForm({ ...form, party_size: Number(e.target.value) || 2 })} />
        <Input type="datetime-local" value={form.reserved_at} onChange={(e) => setForm({ ...form, reserved_at: e.target.value })} />
        <select
          className="border rounded-md h-10 px-3 text-sm"
          value={form.table_id}
          onChange={(e) => setForm({ ...form, table_id: e.target.value })}
        >
          <option value="">Any table</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <Input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <Button onClick={add} className="bg-slate-900 text-white sm:col-span-2">
          <Plus className="h-4 w-4 mr-1" /> Book
        </Button>
      </div>

      {loading ? (
        <Loader2 className="animate-spin" />
      ) : (
        <div className="rounded-2xl border bg-white divide-y">
          {rows.map((r) => (
            <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-semibold">{r.guest_name} · {r.party_size} guests</p>
                <p className="text-xs text-slate-500">
                  {new Date(r.reserved_at).toLocaleString()} · {r.restaurant_tables?.name || "Any"} · {r.status}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" className="bg-slate-900 text-white" onClick={() => seatAndOpenPos(r)}>
                  <UtensilsCrossed className="h-3.5 w-3.5 mr-1" /> Seat & POS
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "completed")}>Done</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "cancelled")}>Cancel</Button>
                <Button size="sm" variant="outline" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="p-6 text-center text-slate-500 text-sm">No reservations</p>}
        </div>
      )}
    </div>
  );
}
