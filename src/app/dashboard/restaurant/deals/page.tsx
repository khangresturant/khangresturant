"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, Plus, Loader2, Trash2, Save, X, Edit, Pizza, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { type RestaurantDeal, dealSavingsPercent } from "@/lib/restaurant-deals";
import { DealSlotProductPicker } from "@/components/restaurant/DealSlotProductPicker";
import {
  type DealSlotForm,
  dealItemToSlotForm,
  normalizeDealItem,
  parseAllowedProductIds,
  sizeOptionsForAllowedProducts,
  sizeOptionsForFixedProduct,
  slotLabelDisplay,
  productMatchesDealSize,
  sizeOptionsForFirstSlot,
} from "@/lib/restaurant-deal-slots";
import {
  computeDealCatalogOriginal,
  type MenuSizePriceRow,
} from "@/lib/restaurant-deal-pricing";

type Product = { id: string; name: string; sale_price_single: number };

export default function RestaurantDealsPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [deals, setDeals] = useState<RestaurantDeal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<RestaurantDeal | null>(null);
  const [saving, setSaving] = useState(false);
  const [sizeNamesByProduct, setSizeNamesByProduct] = useState<Record<string, string[]>>({});
  const [menuSizeRows, setMenuSizeRows] = useState<MenuSizePriceRow[]>([]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    original_price: 0,
    deal_price: 0,
    discount_percentage: 0,
    is_active: true,
    items: [] as DealSlotForm[],
  });

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [dealsRes, prodRes, sizesRes] = await Promise.all([
        supabase.from("restaurant_deals").select(`
          *, restaurant_deal_items ( id, product_id, quantity, size_name, item_type, slot_label, allowed_product_ids, products ( name ) )
        `).eq("shop_id", shopId).order("name"),
        supabase.from("products").select("id, name, sale_price_single, is_ingredient").eq("shop_id", shopId).order("name"),
        supabase
          .from("restaurant_menu_sizes")
          .select("id, product_id, size_name, price")
          .eq("shop_id", shopId)
          .eq("is_available", true),
      ]);

      if (dealsRes.error && !dealsRes.error.message.includes("does not exist")) throw dealsRes.error;
      setDeals((dealsRes.data as RestaurantDeal[]) || []);
      setProducts(
        (prodRes.data || []).filter(
          (p: any) => p.is_ingredient !== true && String(p.is_ingredient) !== "true"
        )
      );
      const byProduct: Record<string, string[]> = {};
      for (const row of sizesRes.data || []) {
        const pid = row.product_id as string;
        const name = String(row.size_name || "").trim();
        if (!pid || !name) continue;
        if (!byProduct[pid]) byProduct[pid] = [];
        if (!byProduct[pid].includes(name)) byProduct[pid].push(name);
      }
      setSizeNamesByProduct(byProduct);
      setMenuSizeRows(
        (sizesRes.data || []).map((row: any) => ({
          id: row.id,
          product_id: row.product_id,
          size_name: String(row.size_name || "").trim(),
          price: Number(row.price) || 0,
        }))
      );
    } catch (e: any) {
      if (e.message?.includes("does not exist")) {
        toast.error("Run restaurant_extended_schema.sql migration first");
      } else {
        toast.error(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [shopId, supabase]);

  useEffect(() => { load(); }, [load]);

  const openNewDeal = () => {
    setEditingDeal(null);
    setForm({ name: "", description: "", original_price: 0, deal_price: 0, discount_percentage: 0, is_active: true, items: [] });
    setIsModalOpen(true);
  };

  const openEditDeal = (deal: RestaurantDeal) => {
    setEditingDeal(deal);
    setForm({
      name: deal.name,
      description: deal.description || "",
      original_price: Number(deal.original_price),
      deal_price: Number(deal.deal_price),
      discount_percentage: Number(deal.discount_percentage),
      is_active: deal.is_active,
      items: (deal.restaurant_deal_items || []).map((i) => dealItemToSlotForm(normalizeDealItem(i))),
    });
    setIsModalOpen(true);
  };

  const sizeChoicesForProduct = (productId: string) => {
    return sizeOptionsForFixedProduct(productId, sizeNamesByProduct).map((o) => o.value);
  };

  const pickSizeOptionsForSlot = (it: DealSlotForm) => {
    if (it.item_type === "fixed" && it.product_id) {
      return sizeOptionsForFixedProduct(it.product_id, sizeNamesByProduct).map((o) => ({
        ...o,
        allHave: true,
        count: 1,
      }));
    }
    return sizeOptionsForAllowedProducts(it.allowed_product_ids, sizeNamesByProduct);
  };

  const syncSlotSizeAfterProductsChange = (items: DealSlotForm[], idx: number) => {
    const opts = pickSizeOptionsForSlot(items[idx]);
    const current = items[idx].size_name;
    if (opts.some((o) => o.value === current)) return items;
    const preferred = opts.find((o) => o.allHave) || opts[0];
    items[idx].size_name = preferred?.value || "Standard";
    return items;
  };

  const addItemToDeal = () => {
    if (!products.length) {
      toast.error("Add menu items first (Menu Management)");
      return;
    }
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          slot_label: `Slot ${f.items.length + 1}`,
          item_type: "choice",
          product_id: "",
          allowed_product_ids: [],
          quantity: 1,
          size_name: "Standard",
        },
      ],
    }));
  };

  const removeSlot = (idx: number) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const suggestedCatalogTotal = React.useMemo(
    () => computeDealCatalogOriginal(form.items, products, menuSizeRows),
    [form.items, products, menuSizeRows]
  );

  const productsForDealSize = React.useCallback(
    (slotIndex: number) => {
      const slot = form.items[slotIndex];
      if (!slot) return products;
      const sz = (slot.size_name || "Standard").trim();
      if (sz === "Standard") return products;
      return products.filter((p) => productMatchesDealSize(p.id, sz, sizeNamesByProduct));
    },
    [form.items, products, sizeNamesByProduct]
  );

  const setSlotSize = (idx: number, size: string) => {
    setForm((f) => {
      const items = [...f.items];
      const slot = { ...items[idx], size_name: size };
      if (slot.item_type === "choice") {
        slot.allowed_product_ids = slot.allowed_product_ids.filter((id) =>
          productMatchesDealSize(id, size, sizeNamesByProduct)
        );
      } else if (
        slot.product_id &&
        !productMatchesDealSize(slot.product_id, size, sizeNamesByProduct)
      ) {
        slot.product_id = "";
      }
      items[idx] = slot;
      return { ...f, items };
    });
  };

  const recalcFromDiscount = (pct: number) => {
    const orig = suggestedCatalogTotal || form.original_price;
    setForm((f) => ({
      ...f,
      discount_percentage: pct,
      original_price: orig,
      deal_price: Math.max(0, orig - (orig * pct) / 100),
    }));
  };

  const saveDeal = async () => {
    if (!form.name.trim()) { toast.error("Deal name required"); return; }
    for (const it of form.items) {
      if (it.item_type === "fixed" && !it.product_id) {
        toast.error(`Fixed slot "${it.slot_label}" needs a menu item`);
        return;
      }
      if (it.item_type === "choice") {
        if (!it.slot_label.trim()) {
          toast.error("Every customer-choice slot needs a label (e.g. Medium Pizza)");
          return;
        }
        if (it.allowed_product_ids.length === 0) {
          toast.error(`Add at least one searchable item for "${it.slot_label}"`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const orig =
        form.original_price > 0
          ? form.original_price
          : computeDealCatalogOriginal(form.items, products, menuSizeRows);
      const payload = {
        shop_id: shopId,
        name: form.name.trim(),
        description: form.description || null,
        original_price: orig,
        deal_price: form.deal_price,
        discount_percentage: form.discount_percentage,
        is_active: form.is_active,
      };

      let dealId = editingDeal?.id;
      if (editingDeal) {
        const { error } = await supabase.from("restaurant_deals").update(payload).eq("id", editingDeal.id);
        if (error) throw error;
        await supabase.from("restaurant_deal_items").delete().eq("deal_id", editingDeal.id);
      } else {
        const { data, error } = await supabase.from("restaurant_deals").insert(payload).select().single();
        if (error) throw error;
        dealId = data.id;
      }

      if (dealId && form.items.length) {
        await supabase.from("restaurant_deal_items").insert(
          form.items.map((it) => ({
            deal_id: dealId,
            product_id: it.item_type === "fixed" ? it.product_id : null,
            quantity: it.quantity,
            size_name: it.size_name,
            item_type: it.item_type,
            slot_label: it.slot_label.trim() || null,
            allowed_product_ids: it.item_type === "choice" ? it.allowed_product_ids : null,
          }))
        );
      }

      toast.success(editingDeal ? "Deal updated" : "Deal created");
      setIsModalOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteDeal = async (id: string) => {
    if (!confirm("Delete this deal?")) return;
    await supabase.from("restaurant_deals").delete().eq("id", id);
    toast.success("Deal deleted");
    load();
  };

  const toggleDeal = async (deal: RestaurantDeal) => {
    await supabase.from("restaurant_deals").update({ is_active: !deal.is_active }).eq("id", deal.id);
    load();
  };

  return (
    <div className="space-y-6 font-sans animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <p>
          Sizes are <strong>per menu item</strong> (pizza ≠ drink). Set them in{" "}
          <Link href="/dashboard/restaurant/menu?tab=sizes" className="text-blue-600 font-semibold inline-flex items-center gap-1">
            Menu → Sizes &amp; Pricing <ExternalLink size={12} />
          </Link>
          , then pick a size on each combo slot that matches those items.
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
      ) : (
        <div className="space-y-4">
          <Button onClick={openNewDeal} className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus size={14} className="mr-1" /> New Deal / Combo
          </Button>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {deals.map((deal) => (
              <div key={deal.id} className={`bg-white border rounded-xl p-4 shadow-sm ${!deal.is_active ? "opacity-60" : ""}`}>
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-slate-800">{deal.name}</h3>
                  <div className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                    -{dealSavingsPercent(Number(deal.original_price), Number(deal.deal_price))}%
                  </div>
                </div>
                {deal.description && <p className="text-xs text-slate-500 mt-1">{deal.description}</p>}
                <div className="mt-3 flex items-baseline gap-2">
                  <div className="text-sm line-through text-slate-400">Rs {Number(deal.original_price).toLocaleString()}</div>
                  <div className="text-lg font-black text-orange-700">Rs {Number(deal.deal_price).toLocaleString()}</div>
                </div>
                <ul className="mt-2 text-[10px] text-slate-600 space-y-0.5">
                  {(deal.restaurant_deal_items || []).map((i) => {
                    const n = normalizeDealItem(i);
                    const label = slotLabelDisplay(n);
                    if (n.item_type === "choice") {
                      const nOpt = parseAllowedProductIds(n.allowed_product_ids).length;
                      return (
                        <li key={i.id}>
                          {Number(i.quantity)}× {label}
                          {i.size_name ? ` (${i.size_name})` : ""} - {nOpt} options
                        </li>
                      );
                    }
                    return (
                      <li key={i.id}>
                        {Number(i.quantity)}× {n.products?.name || label}
                        {i.size_name ? ` (${i.size_name})` : ""}
                      </li>
                    );
                  })}
                </ul>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => openEditDeal(deal)}><Edit size={12} /></Button>
                  <Button size="sm" variant="outline" onClick={() => toggleDeal(deal)}>{deal.is_active ? "Disable" : "Enable"}</Button>
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteDeal(deal.id)}><Trash2 size={12} /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><Pizza size={18} />{editingDeal ? "Edit Deal" : "New Deal / Combo"}</h3>
                <button type="button" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
              </div>
              <Input placeholder="Deal name e.g. Family Pack" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg p-2 text-sm min-h-[60px]" />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500">Original Rs</label>
                  <Input type="number" value={form.original_price || ""} onChange={(e) => setForm({ ...form, original_price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500">Discount %</label>
                  <Input type="number" value={form.discount_percentage || ""} onChange={(e) => recalcFromDiscount(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500">Deal Price Rs</label>
                  <Input type="number" value={form.deal_price || ""} onChange={(e) => setForm({ ...form, deal_price: parseFloat(e.target.value) || 0 })} />
                </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
                Menu total by slot sizes (choice slots use highest allowed price at that size):{" "}
                <strong className="text-slate-900">Rs {suggestedCatalogTotal.toLocaleString()}</strong>
                <button
                  type="button"
                  className="ml-2 text-orange-700 font-bold underline"
                  onClick={() => setForm((f) => ({ ...f, original_price: suggestedCatalogTotal }))}
                >
                  Apply as Original
                </button>
              </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <div className="text-xs font-bold text-slate-600">Combo slots</div>
                    <p className="text-[10px] text-slate-500">Each slot = one line in the combo. Use <strong>Customer picks</strong> for flavors (e.g. Medium pizza).</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={addItemToDeal}><Plus size={12} className="mr-1" /> Add slot</Button>
                </div>
                {form.items.length === 0 && (
                  <div className="border border-dashed rounded-xl p-6 text-center text-xs text-slate-500">
                    Each slot has its <strong>own size</strong> (Half pizza + Full drink, etc.). Pick allowed items for that slot, then choose size for that slot only.
                  </div>
                )}
                {form.items.map((it, idx) => (
                  <motion.div
                    key={idx}
                    layout="position"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="mb-3 rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/80"
                  >
                    <div className="flex flex-wrap gap-2 items-center justify-between">
                      <div className="text-[10px] font-black text-orange-700">SLOT {idx + 1}</div>
                      <button type="button" onClick={() => removeSlot(idx)} className="text-[10px] text-red-600 font-bold">
                        Remove
                      </button>
                    </div>
                    <Input
                      placeholder="Slot label e.g. Medium Pizza"
                      value={it.slot_label}
                      onChange={(e) => {
                        const items = [...form.items];
                        items[idx].slot_label = e.target.value;
                        setForm({ ...form, items });
                      }}
                      className="text-sm font-semibold"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={it.item_type}
                        onChange={(e) => {
                          const items = [...form.items];
                          items[idx].item_type = e.target.value as "fixed" | "choice";
                          if (items[idx].item_type === "choice") items[idx].product_id = "";
                          setForm({ ...form, items });
                        }}
                        className="border rounded text-xs p-2 font-bold"
                      >
                        <option value="choice">Customer picks (search at POS)</option>
                        <option value="fixed">Fixed item</option>
                      </select>
                      <Input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => {
                          const items = [...form.items];
                          items[idx].quantity = parseFloat(e.target.value) || 1;
                          setForm({ ...form, items });
                        }}
                        className="text-xs"
                        placeholder="Qty"
                      />
                      <select
                        value={it.size_name}
                        onChange={(e) => setSlotSize(idx, e.target.value)}
                        className="border rounded text-xs p-2 font-bold text-violet-900"
                        title={`Size for slot ${idx + 1} only`}
                      >
                        {sizeOptionsForFirstSlot(it, sizeNamesByProduct).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {it.size_name && it.size_name !== "Standard" ? (
                        <>
                          This slot uses size <strong>{it.size_name}</strong> - search shows items that have this size on the menu.
                        </>
                      ) : (
                        <>
                          <strong>Standard</strong> size for this slot (items with no extra sizes). Add menu picks below, or change size when Half/Full apply.
                        </>
                      )}
                    </p>
                    {it.item_type === "fixed" ? (
                      <SearchableSelect
                        options={productsForDealSize(idx).map((p) => ({ value: p.id, label: p.name }))}
                        value={it.product_id}
                        onChange={(pid) => {
                          const items = [...form.items];
                          items[idx].product_id = pid;
                          syncSlotSizeAfterProductsChange(items, idx);
                          setForm({ ...form, items });
                        }}
                        placeholder="Search fixed menu item…"
                        className="text-xs"
                      />
                    ) : (
                      <DealSlotProductPicker
                        products={productsForDealSize(idx)}
                        selectedIds={it.allowed_product_ids}
                        applySizeFilter={(it.size_name || "Standard") !== "Standard"}
                        onChange={(ids) => {
                          const items = [...form.items];
                          const sz = items[idx].size_name || "Standard";
                          items[idx].allowed_product_ids =
                            sz === "Standard"
                              ? ids
                              : ids.filter((id) =>
                                  productMatchesDealSize(id, sz, sizeNamesByProduct)
                                );
                          syncSlotSizeAfterProductsChange(items, idx);
                          setForm({ ...form, items });
                        }}
                        sizeHint={
                          (it.size_name || "Standard") !== "Standard" ? it.size_name : undefined
                        }
                        sizeNamesByProduct={sizeNamesByProduct}
                      />
                    )}
                  </motion.div>
                ))}
              </div>
              <Button onClick={saveDeal} disabled={saving} className="w-full bg-orange-600 text-white">
                {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <><Save size={14} className="mr-1" /> Save Deal</>}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
