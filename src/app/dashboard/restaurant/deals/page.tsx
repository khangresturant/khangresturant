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

type Product = { id: string; name: string; sale_price_single: number };
type DealItemForm = { product_id: string; quantity: number; size_name: string; item_type: string };

export default function RestaurantDealsPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [deals, setDeals] = useState<RestaurantDeal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<RestaurantDeal | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    original_price: 0,
    deal_price: 0,
    discount_percentage: 0,
    is_active: true,
    items: [] as DealItemForm[],
  });

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [dealsRes, prodRes] = await Promise.all([
        supabase.from("restaurant_deals").select(`
          *, restaurant_deal_items ( id, product_id, quantity, size_name, item_type, products ( name ) )
        `).eq("shop_id", shopId).order("name"),
        supabase.from("products").select("id, name, sale_price_single, is_ingredient").eq("shop_id", shopId).order("name"),
      ]);

      if (dealsRes.error && !dealsRes.error.message.includes("does not exist")) throw dealsRes.error;
      setDeals((dealsRes.data as RestaurantDeal[]) || []);
      setProducts(
        (prodRes.data || []).filter(
          (p: any) => p.is_ingredient !== true && String(p.is_ingredient) !== "true"
        )
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
      items: (deal.restaurant_deal_items || []).map((i) => ({
        product_id: i.product_id || "",
        quantity: Number(i.quantity),
        size_name: i.size_name || "Medium",
        item_type: i.item_type || "item",
      })),
    });
    setIsModalOpen(true);
  };

  const addItemToDeal = () => {
    if (!products.length) return;
    setForm((f) => ({
      ...f,
      items: [...f.items, { product_id: products[0].id, quantity: 1, size_name: "Medium", item_type: "item" }],
    }));
  };

  const recalcFromDiscount = (pct: number) => {
    const orig = form.original_price || form.items.reduce((s, it) => {
      const p = products.find((x) => x.id === it.product_id);
      return s + (p?.sale_price_single || 0) * it.quantity;
    }, 0);
    setForm((f) => ({
      ...f,
      discount_percentage: pct,
      original_price: orig,
      deal_price: Math.max(0, orig - (orig * pct) / 100),
    }));
  };

  const saveDeal = async () => {
    if (!form.name.trim()) { toast.error("Deal name required"); return; }
    setSaving(true);
    try {
      const orig = form.original_price || form.items.reduce((s, it) => {
        const p = products.find((x) => x.id === it.product_id);
        return s + (p?.sale_price_single || 0) * it.quantity;
      }, 0);
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
            product_id: it.product_id,
            quantity: it.quantity,
            size_name: it.size_name,
            item_type: it.item_type,
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
          Combo deals for Restaurant POS. Menu items, categories, and size prices live in{" "}
          <Link href="/dashboard/restaurant/menu" className="text-blue-600 font-semibold inline-flex items-center gap-1">
            Menu Management <ExternalLink size={12} />
          </Link>
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
                  {(deal.restaurant_deal_items || []).map((i) => (
                    <li key={i.id}>{Number(i.quantity)}x {i.products?.name}{i.size_name ? ` (${i.size_name})` : ""}</li>
                  ))}
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
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 max-h-[90vh] overflow-y-auto p-6 space-y-4">
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
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs font-bold text-slate-600">Deal Items</div>
                  <Button size="sm" variant="outline" onClick={addItemToDeal}><Plus size={12} className="mr-1" /> Add Item</Button>
                </div>
                {form.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 mb-2">
                    <select value={it.product_id} onChange={(e) => {
                      const items = [...form.items];
                      items[idx].product_id = e.target.value;
                      setForm({ ...form, items });
                    }} className="col-span-2 border rounded text-xs p-1.5">
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <Input type="number" value={it.quantity} onChange={(e) => {
                      const items = [...form.items];
                      items[idx].quantity = parseFloat(e.target.value) || 1;
                      setForm({ ...form, items });
                    }} className="text-xs" />
                    <Input value={it.size_name} onChange={(e) => {
                      const items = [...form.items];
                      items[idx].size_name = e.target.value;
                      setForm({ ...form, items });
                    }} className="text-xs" placeholder="Size" />
                  </div>
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
