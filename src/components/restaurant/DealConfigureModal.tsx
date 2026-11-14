"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, Check, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RestaurantDeal } from "@/lib/restaurant-deals";
import {
  buildDealKitchenRemarks,
  buildDealStockMeta,
  dealSlotKey,
  normalizeDealItem,
  parseAllowedProductIds,
  resolveSlotProductOptions,
  resolveDealSlotChoice,
  slotLabelDisplay,
  type RestaurantDealItemRow,
} from "@/lib/restaurant-deal-slots";
import { filterAndRankProducts } from "@/utils/productSearch";
import { toast } from "sonner";
import {
  computeDealIngredientCost,
  type MenuSizePriceRow,
  salePriceForProductSize,
} from "@/lib/restaurant-deal-pricing";
import { roundMoney } from "@/lib/restaurant-recipe-cost";

export type DealCartConfirmPayload = {
  cartItemId: string;
  productId: string;
  name: string;
  price: number;
  purchasePrice: number;
  quantity: number;
  remarks: string;
  isDeal: boolean;
  dealId: string;
  dealMeta: string;
  dealCostLines: import("@/lib/restaurant-recipe-cost").RestaurantCartCostLine[];
  catalogSaleTotal?: number;
};

type Props = {
  deal: RestaurantDeal;
  onClose: () => void;
  onConfirm: (payload: DealCartConfirmPayload) => void;
};

export function DealConfigureModal({ deal, onClose, onConfirm }: Props) {
  const { shopId } = useShop();
  const supabase = createClient();
  const [products, setProducts] = useState<{ id: string; name: string; purchase_price_single?: number }[]>([]);
  const [menuSizes, setMenuSizes] = useState<MenuSizePriceRow[]>([]);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [catalogPickerTotal, setCatalogPickerTotal] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [choices, setChoices] = useState<Record<string, { productId: string; productName: string; sizeName?: string }>>({});
  const [slotSearch, setSlotSearch] = useState<Record<string, string>>({});

  const slots = useMemo(
    () => (deal.restaurant_deal_items || []).map((i) => normalizeDealItem(i as RestaurantDealItemRow)),
    [deal]
  );

  useEffect(() => {
    if (!shopId) return;
    (async () => {
      const [prodRes, szRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, purchase_price_single, is_ingredient, show_in_restaurant_pos")
          .eq("shop_id", shopId)
          .order("name"),
        supabase
          .from("restaurant_menu_sizes")
          .select("id, product_id, size_name, price, is_available")
          .eq("shop_id", shopId),
      ]);
      const rows = (prodRes.data || []).filter(
        (p: any) => p.is_ingredient !== true && p.show_in_restaurant_pos !== false
      );
      setProducts(rows);
      setMenuSizes(
        (szRes.data || [])
          .filter((s: any) => s.is_available !== false)
          .map((s: any) => ({
            id: s.id,
            product_id: s.product_id,
            size_name: s.size_name,
            price: Number(s.price) || 0,
          }))
      );
    })();
  }, [shopId, supabase]);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      const { total } = await computeDealIngredientCost(supabase, deal, choices, menuSizes);
      if (!cancelled) setEstimatedCost(roundMoney(total));
    })();
    let cat = 0;
    slots.forEach((s, idx) => {
      const n = normalizeDealItem(s);
      const qty = Number(n.quantity) || 1;
      const picked = resolveDealSlotChoice(choices, n, idx);
      const pid =
        n.item_type === "choice" ? picked?.productId : n.product_id || picked?.productId;
      const sz = picked?.sizeName || n.size_name;
      if (pid) {
        cat += qty * salePriceForProductSize(pid, sz, products, menuSizes);
      }
    });
    setCatalogPickerTotal(cat);
    return () => {
      cancelled = true;
    };
  }, [choices, deal, menuSizes, products, shopId, slots, supabase]);

  useEffect(() => {
    if (!products.length) return;
    setChoices((prev) => {
      let next = { ...prev };
      let changed = false;
      slots.forEach((s, idx) => {
        if (s.item_type !== "choice" && s.product_id) {
          const key = dealSlotKey(normalizeDealItem(s), idx);
          if (next[key]?.productId) return;
          const p = products.find((x) => x.id === s.product_id);
          next[key] = {
            productId: s.product_id,
            productName: p?.name || s.products?.name || "Item",
            sizeName: s.size_name || undefined,
          };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [slots, products]);

  const setSlotChoice = (slotId: string, productId: string, productName: string, sizeName?: string) => {
    setChoices((prev) => ({
      ...prev,
      [slotId]: { productId, productName, sizeName },
    }));
  };

  const slotHasChoice = (s: RestaurantDealItemRow, idx: number) =>
    Boolean(resolveDealSlotChoice(choices, normalizeDealItem(s), idx)?.productId);

  const confirm = async () => {
    for (let idx = 0; idx < slots.length; idx++) {
      const s = slots[idx]!;
      const n = normalizeDealItem(s);
      if (n.item_type === "choice" && !slotHasChoice(s, idx)) {
        toast.error(`Pick an item for: ${slotLabelDisplay(s)}`);
        return;
      }
    }
  let anchor: string | undefined;
  for (let idx = 0; idx < slots.length; idx++) {
    const picked = resolveDealSlotChoice(choices, normalizeDealItem(slots[idx]!), idx);
    if (picked?.productId) {
      anchor = picked.productId;
      break;
    }
  }
  anchor =
    anchor ||
    slots.find((s) => s.product_id)?.product_id ||
    products[0]?.id;
    if (!anchor) return;

    setConfirming(true);
    try {
      const { total, lines } = await computeDealIngredientCost(supabase, deal, choices, menuSizes);
      const dealMeta = buildDealStockMeta(deal, choices);
      const remarks = buildDealKitchenRemarks(deal, choices);

      onConfirm({
        cartItemId: `deal-${deal.id}-${Date.now()}`,
        productId: anchor,
        name: `🎯 ${deal.name}`,
        price: Number(deal.deal_price),
        purchasePrice: roundMoney(total),
        quantity: 1,
        remarks,
        isDeal: true,
        dealId: deal.id,
        dealMeta,
        dealCostLines: lines,
        catalogSaleTotal: catalogPickerTotal,
      });
    } finally {
      setConfirming(false);
    }
  };

  const anyChoiceMade = slots.some((s, idx) => slotHasChoice(s, idx));
  const allChoicesMade = slots.every((s, idx) => {
    const n = normalizeDealItem(s);
    if (n.item_type === "choice") return slotHasChoice(s, idx);
    return slotHasChoice(s, idx) || Boolean(n.product_id);
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-orange-100"
      >
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex justify-between items-start gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">{deal.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Pick each item in the combo, then add to order.</p>
            <p className="text-sm font-black text-orange-700 mt-1">Rs {Number(deal.deal_price).toLocaleString()}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {slots.map((slot, idx) => {
            const nSlot = normalizeDealItem(slot);
            const slotKey = dealSlotKey(nSlot, idx);
            const label = slotLabelDisplay(slot);
            const isChoice = slot.item_type === "choice";
            const allowed = parseAllowedProductIds(slot.allowed_product_ids);
            const options = resolveSlotProductOptions(allowed, products, menuSizes, slot.size_name);
            const q = slotSearch[slotKey] || "";
            const filtered = filterAndRankProducts(options as any, q, {}).slice(0, 15);
            const picked = resolveDealSlotChoice(choices, nSlot, idx);

            return (
              <div key={slot.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <div className="text-[10px] font-black text-orange-600 uppercase">Slot {idx + 1}</div>
                    <h4 className="font-bold text-slate-900">
                      {Number(slot.quantity)}× {label}
                      {slot.size_name && slot.size_name !== "Standard" ? (
                        <div className="text-slate-500 font-semibold"> - {slot.size_name}</div>
                      ) : null}
                    </h4>
                  </div>
                  {isChoice ? (
                    <div className="text-[9px] font-bold px-2 py-1 rounded-full bg-violet-100 text-violet-800">Customer picks</div>
                  ) : (
                    <div className="text-[9px] font-bold px-2 py-1 rounded-full bg-slate-200 text-slate-700">Fixed</div>
                  )}
                </div>

                {isChoice ? (
                  <>
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        className="pl-8 h-9 text-xs"
                        placeholder="Search flavors / items for this slot..."
                        value={q}
                        onChange={(e) => setSlotSearch((prev) => ({ ...prev, [slotKey]: e.target.value }))}
                      />
                    </div>
                    <motion.div layout="position" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filtered.map((p) => {
                        const selected = picked?.productId === p.id;
                        const pSizes = menuSizes
                          .filter((s) => s.product_id === p.id && s.is_available !== false)
                          .map((s) => s.size_name)
                          .join(" · ");
                        return (
                          <motion.button
                            layout
                            type="button"
                            key={p.id}
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                            onClick={() => setSlotChoice(slotKey, p.id!, p.name, slot.size_name || undefined)}
                            className={`text-left px-3 py-2 rounded-lg border text-xs font-bold transition ${
                              selected
                                ? "border-orange-500 bg-orange-50 text-orange-900 ring-1 ring-orange-400"
                                : "border-slate-200 bg-white hover:border-orange-300 text-slate-800"
                            }`}
                          >
                            <div className="block">{p.name}</div>
                            {pSizes ? (
                              <div className="block text-[9px] font-normal text-slate-500 mt-0.5">
                                This item: {pSizes}
                              </div>
                            ) : null}
                            {selected && <Check size={12} className="inline ml-1 text-orange-600" />}
                          </motion.button>
                        );
                      })}
                    </motion.div>
                    {filtered.length === 0 && (
                      <p className="text-[10px] text-red-600 font-semibold">No items configured for this slot - edit the deal in Deals & Combos.</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-semibold text-slate-700">
                    {slot.products?.name || products.find((x) => x.id === slot.product_id)?.name || "-"}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 border-t bg-white p-4 space-y-2">
          {anyChoiceMade && (
            <div className="text-[11px] flex flex-wrap gap-x-4 gap-y-1 text-slate-600 justify-center">
              <div>
                Menu value (picked): <strong className="text-slate-900">Rs {catalogPickerTotal.toLocaleString()}</strong>
              </div>
              <div>
                Est. ingredient cost:{" "}
                <strong className="text-emerald-800">
                  Rs {(estimatedCost ?? 0).toLocaleString()}
                </strong>
                {!allChoicesMade ? (
                  <div className="text-slate-400 font-normal"> - pick all slots</div>
                ) : null}
              </div>
              <div>
                Deal price: <strong className="text-orange-700">Rs {Number(deal.deal_price).toLocaleString()}</strong>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              disabled={!allChoicesMade || confirming}
              onClick={() => void confirm()}
            >
              {confirming ? "Calculating…" : "Add combo to order"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
