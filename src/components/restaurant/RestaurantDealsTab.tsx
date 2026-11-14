"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { Button } from "@/components/ui/button";
import { type RestaurantDeal, dealSavingsPercent } from "@/lib/restaurant-deals";
import { dealIsPosReady, normalizeDealItem, parseAllowedProductIds, slotLabelDisplay } from "@/lib/restaurant-deal-slots";

type Props = {
  onConfigureDeal: (deal: RestaurantDeal) => void;
};

export function RestaurantDealsTab({ onConfigureDeal }: Props) {
  const { shopId } = useShop();
  const supabase = createClient();
  const [deals, setDeals] = useState<RestaurantDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    (async () => {
      const { data, error } = await supabase
        .from("restaurant_deals")
        .select(`*, restaurant_deal_items ( id, product_id, quantity, size_name, item_type, slot_label, allowed_product_ids, products ( name ) )`)
        .eq("shop_id", shopId)
        .eq("is_active", true)
        .order("name");
      if (!error) setDeals((data as RestaurantDeal[]) || []);
      setLoading(false);
    })();
  }, [shopId, supabase]);

  const openDeal = (deal: RestaurantDeal) => {
    if (!dealIsPosReady(deal)) return;
    onConfigureDeal(deal);
    setSelectedId(deal.id);
    setTimeout(() => setSelectedId(null), 800);
  };

  if (loading) {
    return <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-orange-600" /></div>;
  }

  if (deals.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        No active deals. Create combos in <Link href="/dashboard/restaurant/deals" className="text-orange-600 font-semibold">Deals</Link> or manage menu in{" "}
        <Link href="/dashboard/restaurant/menu" className="text-blue-600 font-semibold">Menu Management</Link>.
      </div>
    );
  }

  const dealsWithProducts = deals.filter((d) => dealIsPosReady(d));
  if (dealsWithProducts.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        Each deal needs slots with fixed items or customer-choice options. Edit in <strong>Deals & Combos</strong>.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {dealsWithProducts.map((deal) => (
        <button
          key={deal.id}
          onClick={() => openDeal(deal)}
          className={`w-full text-left bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 hover:border-orange-400 transition-all ${
            selectedId === deal.id ? "ring-2 ring-orange-500" : ""
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold text-slate-800">{deal.name}</h4>
              {deal.description && <p className="text-[10px] text-slate-500 mt-0.5">{deal.description}</p>}
              <ul className="mt-2 text-[10px] text-slate-600">
                {(deal.restaurant_deal_items || []).map((i) => {
                  const n = normalizeDealItem(i);
                  const label = slotLabelDisplay(n);
                  if (n.item_type === "choice") {
                    const nOpt = parseAllowedProductIds(n.allowed_product_ids).length;
                    return (
                      <li key={i.id}>
                        • {Number(i.quantity)}× {label}
                        {i.size_name ? ` (${i.size_name})` : ""} - <div className="text-violet-700">{nOpt} choices</div>
                      </li>
                    );
                  }
                  return (
                    <li key={i.id}>
                      • {Number(i.quantity)}× {n.products?.name || label}
                      {i.size_name ? ` (${i.size_name})` : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="text-right shrink-0 ml-2">
              <div className="text-xs line-through text-slate-400 block">Rs {Number(deal.original_price).toLocaleString()}</div>
              <div className="text-lg font-black text-orange-700">Rs {Number(deal.deal_price).toLocaleString()}</div>
              <div className="text-[9px] font-bold text-orange-600 block">SAVE {dealSavingsPercent(Number(deal.original_price), Number(deal.deal_price))}%</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-orange-700">
            <Plus size={12} /> Tap to configure & add
          </div>
        </button>
      ))}
    </div>
  );
}
