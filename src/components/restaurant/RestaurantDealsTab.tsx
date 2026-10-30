"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { Button } from "@/components/ui/button";
import { type RestaurantDeal, dealSavingsPercent } from "@/lib/restaurant-deals";

type CartDealPayload = {
  cartItemId: string;
  productId: string;
  name: string;
  price: number;
  purchasePrice: number;
  quantity: number;
  remarks: string;
  isDeal: boolean;
  dealId: string;
};

type Props = {
  onAddDeal: (item: CartDealPayload) => void;
};

export function RestaurantDealsTab({ onAddDeal }: Props) {
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
        .select(`*, restaurant_deal_items ( id, product_id, quantity, size_name, products ( name ) )`)
        .eq("shop_id", shopId)
        .eq("is_active", true)
        .order("name");
      if (!error) setDeals((data as RestaurantDeal[]) || []);
      setLoading(false);
    })();
  }, [shopId, supabase]);

  const addDeal = (deal: RestaurantDeal) => {
    const firstItem = deal.restaurant_deal_items?.[0];
    const anchorProductId = firstItem?.product_id;
    if (!anchorProductId) {
      return;
    }
    const itemsDesc = (deal.restaurant_deal_items || [])
      .map((i) => `${Number(i.quantity)}x ${i.products?.name}${i.size_name ? ` (${i.size_name})` : ""}`)
      .join(", ");
    onAddDeal({
      cartItemId: `deal-${deal.id}-${Date.now()}`,
      productId: anchorProductId,
      name: `🎯 ${deal.name}`,
      price: Number(deal.deal_price),
      purchasePrice: 0,
      quantity: 1,
      remarks: `DEAL_ID:${deal.id}|${itemsDesc}`,
      isDeal: true,
      dealId: deal.id,
    });
    setSelectedId(deal.id);
    setTimeout(() => setSelectedId(null), 800);
  };

  if (loading) {
    return <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-orange-600" /></div>;
  }

  if (deals.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        No active deals. Create combos in <strong>Deals & Sizes</strong> menu.
      </div>
    );
  }

  const dealsWithProducts = deals.filter((d) => d.restaurant_deal_items?.some((i) => i.product_id));
  if (dealsWithProducts.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        Deals need at least one menu item. Edit deals in <strong>Deals & Sizes</strong>.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {dealsWithProducts.map((deal) => (
        <button
          key={deal.id}
          onClick={() => addDeal(deal)}
          className={`w-full text-left bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 hover:border-orange-400 transition-all ${
            selectedId === deal.id ? "ring-2 ring-orange-500" : ""
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold text-slate-800">{deal.name}</h4>
              {deal.description && <p className="text-[10px] text-slate-500 mt-0.5">{deal.description}</p>}
              <ul className="mt-2 text-[10px] text-slate-600">
                {(deal.restaurant_deal_items || []).map((i) => (
                  <li key={i.id}>• {Number(i.quantity)}x {i.products?.name}{i.size_name ? ` (${i.size_name})` : ""}</li>
                ))}
              </ul>
            </div>
            <div className="text-right shrink-0 ml-2">
              <span className="text-xs line-through text-slate-400 block">Rs {Number(deal.original_price).toLocaleString()}</span>
              <span className="text-lg font-black text-orange-700">Rs {Number(deal.deal_price).toLocaleString()}</span>
              <span className="text-[9px] font-bold text-orange-600 block">SAVE {dealSavingsPercent(Number(deal.original_price), Number(deal.deal_price))}%</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-orange-700">
            <Plus size={12} /> Tap to add to order
          </div>
        </button>
      ))}
    </div>
  );
}
