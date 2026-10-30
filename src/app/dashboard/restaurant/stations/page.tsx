"use client";

import React, { useEffect, useState } from "react";
import { ChefHat, Loader2, Plus, Trash2 } from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_STATIONS,
  seedDefaultStations,
  type RestaurantStation,
} from "@/lib/restaurant-ops";

export default function RestaurantStationsPage() {
  const { shopId } = useShop();
  const supabase = createClient();
  const [rows, setRows] = useState<RestaurantStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [hub, setHub] = useState("Main Kitchen");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("restaurant_stations")
      .select("*")
      .eq("shop_id", shopId)
      .order("sort_order");
    if (error?.message?.includes("does not exist")) {
      toast.error("Run Restaurant DB Setup (P1 SQL) first");
      setRows([]);
    } else if (error) {
      toast.error(error.message);
    } else {
      setRows((data as RestaurantStation[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const add = async () => {
    if (!shopId || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("restaurant_stations").insert({
      shop_id: shopId,
      name: name.trim(),
      kitchen_hub: hub.trim() || "Main Kitchen",
      sort_order: rows.length + 1,
      is_active: true,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      setName("");
      toast.success("Station added");
      load();
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("restaurant_stations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const seed = async () => {
    if (!shopId) return;
    setSaving(true);
    try {
      const n = await seedDefaultStations(supabase, shopId);
      toast.success(n ? `Seeded ${n} stations` : "Stations already exist");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 font-sans">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ChefHat className="text-amber-600" /> Kitchen Stations
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Grill / Fry / Oven / Bar — route KOTs and filter KDS. Kitchen hub = multi-kitchen grouping.
          </p>
        </div>
        <Button variant="outline" onClick={seed} disabled={saving}>
          Seed defaults ({DEFAULT_STATIONS.length})
        </Button>
      </div>

      <div className="rounded-2xl border bg-white p-4 flex flex-col sm:flex-row gap-2">
        <Input placeholder="Station name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Kitchen hub" value={hub} onChange={(e) => setHub(e.target.value)} className="sm:w-48" />
        <Button onClick={add} disabled={saving} className="bg-slate-900 text-white">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {loading ? (
        <Loader2 className="animate-spin text-slate-400" />
      ) : (
        <div className="rounded-2xl border bg-white divide-y">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{r.name}</p>
                <p className="text-xs text-slate-500">Hub: {r.kitchen_hub || "Main Kitchen"}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => remove(r.id)}>
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              </Button>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500">No stations yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
