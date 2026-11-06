"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MENU_SIZE_OPTIONS } from "@/lib/restaurant-deals";

type Product = { id: string; name: string; sale_price_single: number };

export function MenuSizesTab() {
  const { shopId } = useShop();
  const { language } = useLanguage();
  const supabase = createClient();
  const isEn = language === "en";

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [sizeSearch, setSizeSearch] = useState("");
  const [sizeProductId, setSizeProductId] = useState("");
  const [sizeForm, setSizeForm] = useState({
    size_name: "Medium",
    price: 0,
    size_description: "",
    crust_options: "Regular, Thin Crust, Pan, Cheese Burst",
  });

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [prodRes, sizesRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, sale_price_single, is_ingredient")
          .eq("shop_id", shopId)
          .order("name"),
        supabase
          .from("restaurant_menu_sizes")
          .select(
            `id, product_id, size_name, size_description, price, is_available, sort_order, products ( name )`
          )
          .eq("shop_id", shopId)
          .order("sort_order"),
      ]);

      if (sizesRes.error?.message?.includes("does not exist")) {
        toast.error(isEn ? "Run Restaurant DB Setup migration first" : "مائیگریشن چلائیں");
        return;
      }

      const menuProducts = (prodRes.data || []).filter(
        (p: any) => p.is_ingredient !== true && String(p.is_ingredient) !== "true"
      );
      setProducts(menuProducts);
      setSizes(sizesRes.data || []);
      if (menuProducts.length && !sizeProductId) setSizeProductId(menuProducts[0].id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [shopId, supabase, sizeProductId, isEn]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredSizes = sizes.filter((s: any) => {
    const q = sizeSearch.toLowerCase();
    if (!q) return true;
    const item = (s.products?.name || "").toLowerCase();
    const sz = (s.size_name || "").toLowerCase();
    return item.includes(q) || sz.includes(q) || String(s.price).includes(q);
  });

  const addSize = async () => {
    if (!sizeProductId || !shopId) return;
    try {
      const { error } = await supabase.from("restaurant_menu_sizes").insert({
        shop_id: shopId,
        product_id: sizeProductId,
        size_name: sizeForm.size_name,
        size_description: sizeForm.size_description || null,
        price: sizeForm.price,
        crust_options: sizeForm.crust_options || null,
        is_available: true,
        sort_order: sizes.length,
      });
      if (error) throw error;
      toast.success(isEn ? "Size added" : "سائز شامل");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteSize = async (id: string) => {
    await supabase.from("restaurant_menu_sizes").delete().eq("id", id);
    toast.success(isEn ? "Removed" : "حذف");
    load();
  };

  const quickAddStandardSizes = async () => {
    if (!sizeProductId || !shopId) return;
    const base = products.find((p) => p.id === sizeProductId)?.sale_price_single || 0;
    const presets = [
      { size_name: "Small", price: Math.round(base * 0.85) },
      { size_name: "Medium", price: base || 0 },
      { size_name: "Large", price: Math.round(base * 1.25) || 0 },
      { size_name: "XL", price: Math.round(base * 1.5) || 0 },
    ];
    for (const s of presets) {
      await supabase.from("restaurant_menu_sizes").upsert(
        {
          shop_id: shopId,
          product_id: sizeProductId,
          size_name: s.size_name,
          price: s.price,
          is_available: true,
        },
        { onConflict: "shop_id,product_id,size_name", ignoreDuplicates: false }
      );
    }
    toast.success(isEn ? "Standard sizes created" : "سائز بن گئے");
    load();
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        {isEn
          ? "Selling prices per size. POS uses these when staff picks a size; base price on the menu item is used for Standard when no size row applies."
          : "ہر سائز کی فروخت قیمت۔"}
      </p>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Layers size={16} className="text-blue-600" />
          {isEn ? "Add size & price" : "سائز اور قیمت"}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs font-bold text-slate-500">{isEn ? "Menu item" : "آئٹم"}</label>
            <div className="mt-1">
              <SearchableSelect
                options={products.map((p) => ({ value: p.id, label: p.name }))}
                value={sizeProductId}
                onChange={setSizeProductId}
                placeholder={isEn ? "Select item…" : "منتخب…"}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">{isEn ? "Size" : "سائز"}</label>
            <select
              value={sizeForm.size_name}
              onChange={(e) => setSizeForm({ ...sizeForm, size_name: e.target.value })}
              className="w-full mt-1 border rounded-lg px-2 py-2 text-sm"
            >
              {MENU_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">{isEn ? "Price (Rs)" : "قیمت"}</label>
            <Input
              type="number"
              value={sizeForm.price || ""}
              onChange={(e) => setSizeForm({ ...sizeForm, price: parseFloat(e.target.value) || 0 })}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={addSize} className="bg-blue-600 text-white flex-1">
              <Plus size={14} className="mr-1" /> {isEn ? "Add" : "شامل"}
            </Button>
            <Button variant="outline" onClick={quickAddStandardSizes}>
              S-XL
            </Button>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">{isEn ? "Description (optional)" : "تفصیل"}</label>
          <Input
            value={sizeForm.size_description}
            onChange={(e) => setSizeForm({ ...sizeForm, size_description: e.target.value })}
            className="mt-1"
            placeholder={isEn ? "Family size, 12 slices…" : ""}
          />
        </div>
      </div>

      <Input
        placeholder={isEn ? "Search sizes (item / size / price)…" : "تلاش…"}
        value={sizeSearch}
        onChange={(e) => setSizeSearch(e.target.value)}
        className="max-w-md h-9 text-sm"
      />

      <div className="overflow-x-auto border rounded-xl bg-white">
        <table className="w-full text-xs min-w-[480px]">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="p-2">{isEn ? "Item" : "آئٹم"}</th>
              <th className="p-2">{isEn ? "Size" : "سائز"}</th>
              <th className="p-2">{isEn ? "Description" : "تفصیل"}</th>
              <th className="p-2 text-right">{isEn ? "Price" : "قیمت"}</th>
              <th className="p-2 w-12" />
            </tr>
          </thead>
          <tbody>
            {filteredSizes.map((s: any) => (
              <tr key={s.id} className="border-t">
                <td className="p-2 font-semibold">{s.products?.name}</td>
                <td className="p-2">{s.size_name}</td>
                <td className="p-2 text-slate-500">{s.size_description || "-"}</td>
                <td className="p-2 text-right font-mono">Rs {Number(s.price).toLocaleString()}</td>
                <td className="p-2 text-right">
                  <button type="button" onClick={() => deleteSize(s.id)} className="text-red-500">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
