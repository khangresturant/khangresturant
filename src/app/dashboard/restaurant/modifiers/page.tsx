"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_RESTAURANT_MODIFIERS,
  seedDefaultModifiers,
} from "@/lib/restaurant-modifiers";

type ModifierRow = {
  id: string;
  name: string;
  price_add: number;
  is_active: boolean;
  sort_order: number;
};

export default function RestaurantModifiersPage() {
  const { shopId } = useShop();
  const supabase = createClient();
  const [rows, setRows] = useState<ModifierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("restaurant_modifiers")
        .select("id, name, price_add, is_active, sort_order")
        .eq("shop_id", shopId)
        .order("sort_order", { ascending: true });

      if (error) {
        if (error.message?.includes("does not exist")) {
          toast.error("Run Restaurant DB Setup - modifiers table missing");
          setRows([]);
        } else {
          throw error;
        }
      } else {
        setRows((data as ModifierRow[]) || []);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load modifiers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const addRow = async () => {
    if (!shopId || !name.trim()) {
      toast.error("Enter add-on name");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("restaurant_modifiers").insert({
        shop_id: shopId,
        name: name.trim(),
        price_add: Number(price) || 0,
        is_active: true,
        sort_order: rows.length + 1,
        applies_to: "all",
      });
      if (error) throw error;
      setName("");
      setPrice("0");
      toast.success("Add-on saved");
      load();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: ModifierRow) => {
    const { error } = await supabase
      .from("restaurant_modifiers")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("restaurant_modifiers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removed");
      load();
    }
  };

  const seedDefaults = async () => {
    if (!shopId) return;
    setSaving(true);
    try {
      const n = await seedDefaultModifiers(supabase, shopId);
      toast.success(n ? `Seeded ${n} default add-ons` : "Defaults already present");
      load();
    } catch (e: any) {
      toast.error(e.message || "Seed failed - run DB migration first");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 font-sans">
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={seedDefaults} disabled={saving}>
          Seed defaults ({DEFAULT_RESTAURANT_MODIFIERS.length})
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Add-on name (e.g. Extra Cheese)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          type="number"
          className="sm:w-36"
          placeholder="Price +"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Button onClick={addRow} disabled={saving} className="bg-slate-900 text-white">
          {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4 mr-1" />}
          Add
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="animate-spin h-5 w-5" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
          No modifiers yet. Seed defaults or add your own. POS will use built-in fallback until then.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white divide-y">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <p className={`font-semibold ${row.is_active ? "text-slate-900" : "text-slate-400 line-through"}`}>
                  {row.name}
                </p>
                <p className="text-xs text-slate-500">
                  +Rs {Number(row.price_add).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleActive(row)}>
                  {row.is_active ? "Active" : "Off"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => remove(row.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
