"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MenuSizeNameField, normalizeSizeName } from "@/components/restaurant/menu/MenuSizeNameField";

type SizeRow = {
  id: string;
  size_name: string;
  size_description: string | null;
  price: number;
  is_available: boolean;
  sort_order: number;
};

type Props = {
  productId: string;
  basePrice: number;
  onSizesChanged?: () => void;
};

export function MenuItemSizesPanel({ productId, basePrice, onSizesChanged }: Props) {
  const { shopId } = useShop();
  const { language } = useLanguage();
  const supabase = createClient();
  const isEn = language === "en";

  const [loading, setLoading] = useState(true);
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [sizeForm, setSizeForm] = useState({
    size_name: "Medium",
    price: basePrice || 0,
    size_description: "",
    crust_options: "",
  });

  useEffect(() => {
    setSizeForm((f) => ({ ...f, price: basePrice || f.price }));
  }, [basePrice]);

  const loadSizes = useCallback(async () => {
    if (!shopId || !productId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("restaurant_menu_sizes")
        .select("id, size_name, size_description, price, is_available, sort_order")
        .eq("shop_id", shopId)
        .eq("product_id", productId)
        .order("sort_order");
      if (error?.message?.includes("does not exist")) {
        toast.error(isEn ? "Run Restaurant DB Setup migration first" : "مائیگریشن چلائیں");
        return;
      }
      if (error) throw error;
      setSizes((data as SizeRow[]) || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [shopId, productId, supabase, isEn]);

  useEffect(() => {
    loadSizes();
  }, [loadSizes]);

  const notify = () => {
    onSizesChanged?.();
    loadSizes();
  };

  const addSize = async () => {
    if (!shopId || !productId) return;
    const sizeName = normalizeSizeName(sizeForm.size_name);
    if (!sizeName) {
      toast.error(isEn ? "Enter a size name" : "سائز کا نام لکھیں");
      return;
    }
    try {
      const { error } = await supabase.from("restaurant_menu_sizes").insert({
      shop_id: shopId,
      product_id: productId,
      size_name: sizeName,
      size_description: sizeForm.size_description || null,
      price: sizeForm.price,
      crust_options: sizeForm.crust_options || null,
      is_available: true,
      sort_order: sizes.length,
    });
      if (error) throw error;
      toast.success(isEn ? "Size added for this item" : "سائز شامل");
      notify();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const deleteSize = async (id: string) => {
    await supabase.from("restaurant_menu_sizes").delete().eq("id", id);
    toast.success(isEn ? "Removed" : "حذف");
    notify();
  };

  const quickAddStandardSizes = async () => {
    if (!shopId || !productId) return;
    const base = basePrice || 0;
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
          product_id: productId,
          size_name: s.size_name,
          price: s.price,
          is_available: true,
        },
        { onConflict: "shop_id,product_id,size_name", ignoreDuplicates: false }
      );
    }
    toast.success(isEn ? "Standard sizes added for this item" : "سائز بن گئے");
    notify();
  };

  return (
    <div className="border-t border-slate-200 pt-4 mt-2 space-y-3">
      <h4 className="text-xs font-black uppercase tracking-wide text-slate-600 flex items-center gap-1.5">
        <Layers size={14} className="text-blue-600" />
        {isEn ? "Sizes & prices (this item only)" : "اس آئٹم کے سائز"}
      </h4>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        {isEn
          ? "POS shows these when staff taps this dish. Base price above is used only when you add no sizes (single price)."
          : "POS پر یہی سائز نظر آئیں گے۔ اگر کوئی سائز نہ ہو تو بیس قیمت لگے گی۔"}
      </p>

      {loading ? (
        <div className="py-4 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
            <div className="md:col-span-2">
              <MenuSizeNameField
                id={`size-name-${productId}`}
                isEn={isEn}
                value={sizeForm.size_name}
                onChange={(v) => setSizeForm({ ...sizeForm, size_name: v })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500">{isEn ? "Sell price Rs" : "قیمت"}</label>
              <Input
                type="number"
                value={sizeForm.price || ""}
                onChange={(e) => setSizeForm({ ...sizeForm, price: parseFloat(e.target.value) || 0 })}
                className="mt-0.5 h-8 text-xs"
              />
            </div>
            <div className="flex gap-1 col-span-2">
              <Button type="button" size="sm" onClick={addSize} className="bg-blue-600 text-white text-xs h-8">
                <Plus size={12} className="mr-0.5" /> {isEn ? "Add size" : "شامل"}
              </Button>
              <Button type="button" size="sm" variant="outline" className="text-xs h-8" onClick={quickAddStandardSizes}>
                S-XL
              </Button>
            </div>
          </div>

          {sizes.length === 0 ? (
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
              {isEn ? "No sizes yet - dish sells at base price only." : "ابھی کوئی سائز نہیں۔"}
            </p>
          ) : (
            <table className="w-full text-[11px] border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-1.5">{isEn ? "Size" : "سائز"}</th>
                  <th className="p-1.5 text-right">{isEn ? "Price" : "قیمت"}</th>
                  <th className="p-1.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {sizes.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-1.5 font-semibold">{s.size_name}</td>
                    <td className="p-1.5 text-right font-mono">Rs {Number(s.price).toLocaleString()}</td>
                    <td className="p-1.5 text-right">
                      <button type="button" onClick={() => deleteSize(s.id)} className="text-red-500">
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
