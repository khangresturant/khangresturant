"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Layers, Loader2, Search, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { fetchRestaurantMenuProducts } from "@/lib/restaurant-deals";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { MenuItemSizesPanel } from "@/components/restaurant/menu/MenuItemSizesPanel";

type SizeRow = {
  id: string;
  product_id: string;
  size_name: string;
  price: number;
  sort_order: number;
};

export function MenuSizesTab() {
  const { shopId } = useShop();
  const { language } = useLanguage();
  const supabase = createClient();
  const isEn = language === "en";
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<{ id: string; name: string; sale_price_single: number }[]>([]);
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [sizesVersion, setSizesVersion] = useState(0);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [salePack, sizesRes] = await Promise.all([
        fetchRestaurantMenuProducts(supabase, shopId, { posSaleOnly: false }),
        supabase
          .from("restaurant_menu_sizes")
          .select("id, product_id, size_name, price, sort_order")
          .eq("shop_id", shopId)
          .order("sort_order"),
      ]);
      setProducts(
        salePack.products.map((p) => ({
          id: p.id,
          name: p.name,
          sale_price_single: Number(p.sale_price_single) || 0,
        }))
      );
      if (sizesRes.error && !sizesRes.error.message?.includes("does not exist")) {
        throw sizesRes.error;
      }
      setSizes((sizesRes.data as SizeRow[]) || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
      setProducts([]);
      setSizes([]);
    } finally {
      setLoading(false);
    }
  }, [shopId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const pid = searchParams.get("product");
    if (pid) setSelectedProductId(pid);
  }, [searchParams]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [products, search]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        {isEn ? (
          <>
            No menu items yet. Add dishes under{" "}
            <Link href="/dashboard/restaurant/menu?tab=items" className="font-bold underline">
              Menu Items
            </Link>{" "}
            tab first, then set sizes here per item.
          </>
        ) : (
          "پہلے Menu Items میں آئٹم بنائیں۔"
        )}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-4 space-y-3">
        <p className="text-xs text-slate-600 bg-slate-50 border rounded-xl px-3 py-2">
          {isEn
            ? "Pick one dish - sizes & prices are only for that item (not shared)."
            : "ایک آئٹم چنیں - سائز اسی کے ہیں۔"}
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isEn ? "Search items…" : "تلاش…"}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <ul className="border rounded-xl bg-white max-h-[420px] overflow-y-auto divide-y text-sm">
          {filteredProducts.map((p) => {
            const itemSizes = sizes
              .filter((s) => s.product_id === p.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            const active = p.id === selectedProductId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedProductId(p.id)}
                  className={`w-full text-left px-3 py-2.5 gap-2 ${
                    active ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-[10px] font-bold text-slate-500 shrink-0">
                      {itemSizes.length
                        ? `${itemSizes.length} ${isEn ? "sizes" : "سائز"}`
                        : isEn
                          ? "base only"
                          : "-"}
                    </div>
                  </div>
                  {itemSizes.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {itemSizes.map((s) => (
                        <div
                          key={s.id}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700"
                        >
                          {s.size_name} · Rs {Number(s.price).toLocaleString()}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[9px] text-amber-700 mt-1">
                      {isEn ? "No extra sizes - POS uses base price only" : "-"}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="lg:col-span-8 border rounded-xl bg-white p-4 min-h-[280px]">
        {!selectedProductId ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-2 py-12">
            <Layers className="text-blue-400" size={28} />
            {isEn ? "Select an item from the list" : "بائیں سے آئٹم چنیں"}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="font-bold text-slate-800">{selectedProduct?.name}</h3>
              <Link
                href={`/dashboard/restaurant/menu?tab=items&product=${selectedProductId}`}
                className="text-xs font-semibold text-violet-700 inline-flex items-center gap-1"
              >
                <Pencil size={12} />
                {isEn ? "Full edit (recipe per size)" : "مکمل ترمیم"}
              </Link>
            </div>
            <MenuItemSizesPanel
              key={`${selectedProductId}-${sizesVersion}`}
              productId={selectedProductId}
              basePrice={selectedProduct?.sale_price_single || 0}
              onSizesChanged={() => {
                setSizesVersion((v) => v + 1);
                load();
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
