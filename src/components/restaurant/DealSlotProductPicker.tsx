"use client";

import React, { useMemo, useState } from "react";
import { Search, X, Plus } from "lucide-react";
import { filterAndRankProducts } from "@/utils/productSearch";
import { Input } from "@/components/ui/input";

type ProductRow = { id: string; name: string; sale_price_single?: number };

type Props = {
  products: ProductRow[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  sizeHint?: string;
  /** When false (e.g. slot size Standard), search shows full menu - no size filter. */
  applySizeFilter?: boolean;
  /** Per-item sizes from Menu → Sizes (not shared across items). */
  sizeNamesByProduct?: Record<string, string[]>;
};

export function DealSlotProductPicker({
  products,
  selectedIds,
  onChange,
  placeholder = "Search menu items to allow in this slot…",
  sizeHint,
  applySizeFilter = true,
  sizeNamesByProduct = {},
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const ranked = filterAndRankProducts(products as any, query, {});
    let list = ranked.filter((p) => !selectedIds.includes(p.id!));
    if (applySizeFilter) {
      const sz = (sizeHint || "").trim();
      if (sz) {
        list = list.filter((p) => {
          const sizes = sizeNamesByProduct[p.id!];
          if (sz === "Standard") {
            return !sizes?.length;
          }
          if (!sizes?.length) return false;
          return sizes.includes(sz);
        });
      }
    }
    const q = query.trim();
    if (!q) return [];
    return list.slice(0, 12);
  }, [products, query, selectedIds, sizeHint, applySizeFilter, sizeNamesByProduct]);

  const selected = useMemo(
    () => selectedIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as ProductRow[],
    [selectedIds, products]
  );

  const add = (id: string) => {
    if (selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setQuery("");
  };

  const remove = (id: string) => onChange(selectedIds.filter((x) => x !== id));

  return (
    <div className="space-y-2 rounded-xl border border-orange-100 bg-orange-50/40 p-3">
      {applySizeFilter && sizeHint ? (
        <p className="text-[10px] font-bold text-orange-800">
          Size filter: <div className="font-black">{sizeHint}</div> - only items with this size on the menu.
        </p>
      ) : selected.length === 0 ? (
        <p className="text-[10px] text-slate-600">
          Search and add items - full menu while this slot is on Standard size.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {selected.length === 0 ? (
          <div className="text-[10px] text-slate-500 italic">No items yet - search and add below.</div>
        ) : (
          selected.map((p) => (
            <div
              key={p.id}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg bg-white border border-orange-200 text-[10px] font-bold text-slate-800"
            >
              <div>
                {p.name}
                <div className="block text-[9px] font-normal text-slate-500 mt-0.5">
                  Sizes: {(sizeNamesByProduct[p.id]?.length
                    ? sizeNamesByProduct[p.id].join(", ")
                    : "Standard only - set in Menu → Sizes")}
                </div>
              </div>
              <button type="button" onClick={() => remove(p.id)} className="p-0.5 rounded hover:bg-orange-100">
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-8 h-9 text-xs"
        />
      </div>
      {query.trim() && filtered.length === 0 && (
        <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
          No menu items match. Try another name, or set this slot&apos;s size to Standard if you need items without sizes.
        </p>
      )}
      {query.trim() && filtered.length > 0 && (
        <ul className="max-h-36 overflow-y-auto border border-slate-100 rounded-lg bg-white divide-y text-xs">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => add(p.id!)}
                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-orange-50 text-left"
              >
                <div>
                  <div className="font-semibold text-slate-800 block">{p.name}</div>
                  <div className="text-[9px] text-slate-500">
                    {sizeNamesByProduct[p.id!]?.length
                      ? sizeNamesByProduct[p.id!].join(" · ")
                      : "No extra sizes on this item"}
                  </div>
                </div>
                <Plus size={14} className="text-orange-600 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
