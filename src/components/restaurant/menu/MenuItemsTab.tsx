"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Pencil,
  Search,
  ChefHat,
  ExternalLink,
  Ban,
  Eye,
  EyeOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { fetchStations, type RestaurantStation } from "@/lib/restaurant-ops";

type MenuProduct = {
  id: string;
  name: string;
  code: string | null;
  sale_price_single: number;
  category_id: string | null;
  note: string | null;
  kitchen_station_id?: string | null;
  not_discounted?: boolean | null;
  show_in_restaurant_pos?: boolean | null;
  categories?: { name: string } | null;
};

type Category = { id: string; name: string };

const PAGE_SIZE = 50;

export function MenuItemsTab() {
  const { shopId } = useShop();
  const { language } = useLanguage();
  const supabase = createClient();
  const isEn = language === "en";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MenuProduct[]>([]);
  const [sizeCounts, setSizeCounts] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [stations, setStations] = useState<RestaurantStation[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuProduct | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    sale_price_single: 0,
    category_id: "",
    description: "",
    kitchen_station_id: "",
    not_discounted: false,
    show_in_restaurant_pos: true,
  });

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      let prodQuery = supabase
        .from("products")
        .select(
          `id, name, code, sale_price_single, category_id, note, kitchen_station_id, not_discounted, show_in_restaurant_pos, is_ingredient, categories ( name )`
        )
        .eq("shop_id", shopId)
        .order("name");

      let { data: prods, error } = await prodQuery;
      if (error?.message?.includes("not_discounted") || error?.message?.includes("show_in_restaurant")) {
        const fb = await supabase
          .from("products")
          .select(
            `id, name, code, sale_price_single, category_id, note, kitchen_station_id, is_ingredient, categories ( name )`
          )
          .eq("shop_id", shopId)
          .order("name");
        if (fb.error) throw fb.error;
        prods = (fb.data || []).map((p: any) => ({
          ...p,
          not_discounted: false,
          show_in_restaurant_pos: true,
        }));
      } else if (error) {
        throw error;
      }

      const menuOnly = (prods || []).filter(
        (p: any) => p.is_ingredient !== true && String(p.is_ingredient) !== "true"
      ) as MenuProduct[];

      const [catRes, sizesRes, st] = await Promise.all([
        supabase.from("categories").select("id, name").eq("shop_id", shopId).order("name"),
        supabase.from("restaurant_menu_sizes").select("product_id").eq("shop_id", shopId),
        fetchStations(supabase, shopId),
      ]);

      const counts: Record<string, number> = {};
      for (const row of sizesRes.data || []) {
        const pid = row.product_id as string;
        counts[pid] = (counts[pid] || 0) + 1;
      }

      setItems(menuOnly);
      setSizeCounts(counts);
      setCategories(catRes.data || []);
      setStations(st);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [shopId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code || "").toLowerCase().includes(q) ||
        (p.categories?.name || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "",
      code: "",
      sale_price_single: 0,
      category_id: categories[0]?.id || "",
      description: "",
      kitchen_station_id: "",
      not_discounted: false,
      show_in_restaurant_pos: true,
    });
    setModalOpen(true);
  };

  const openEdit = (p: MenuProduct) => {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code || "",
      sale_price_single: Number(p.sale_price_single) || 0,
      category_id: p.category_id || "",
      description: p.note === "DYNAMIC_PRICE" ? "" : p.note || "",
      kitchen_station_id: p.kitchen_station_id || "",
      not_discounted: !!p.not_discounted,
      show_in_restaurant_pos: p.show_in_restaurant_pos !== false,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!shopId || !form.name.trim()) {
      toast.error(isEn ? "Name is required" : "نام درکار");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        shop_id: shopId,
        name: form.name.trim(),
        code: form.code.trim() || null,
        sale_price_single: form.sale_price_single,
        purchase_price_single: 0,
        category_id: form.category_id || null,
        note: form.description.trim() || null,
        is_ingredient: false,
        kitchen_station_id: form.kitchen_station_id || null,
        not_discounted: form.not_discounted,
        show_in_restaurant_pos: form.show_in_restaurant_pos,
      };

      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success(isEn ? "Menu item updated" : "اپڈیٹ");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success(isEn ? "Menu item created" : "آئٹم بن گیا");
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      if (e.message?.includes("not_discounted") || e.message?.includes("show_in_restaurant")) {
        toast.error(isEn ? "Run Restaurant DB Setup migration (menu flags SQL)" : "مائیگریشن چلائیں");
      } else {
        toast.error(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleFlag = async (p: MenuProduct, field: "not_discounted" | "show_in_restaurant_pos") => {
    try {
      const patch =
        field === "not_discounted"
          ? { not_discounted: !p.not_discounted }
          : { show_in_restaurant_pos: p.show_in_restaurant_pos !== false ? false : true };
      const { error } = await supabase.from("products").update(patch).eq("id", p.id);
      if (error) throw error;
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
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
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isEn ? "Search menu items…" : "تلاش…"}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button onClick={openNew} className="bg-blue-600 text-white">
          <Plus size={14} className="mr-1" /> {isEn ? "New menu item" : "نیا آئٹم"}
        </Button>
      </div>

      <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
        <table className="w-full text-xs min-w-[720px]">
          <thead>
            <tr className="bg-slate-900 text-white text-left">
              <th className="p-2.5">{isEn ? "Name" : "نام"}</th>
              <th className="p-2.5">{isEn ? "Category" : "کیٹگری"}</th>
              <th className="p-2.5 text-right">{isEn ? "Base price" : "قیمت"}</th>
              <th className="p-2.5 text-center">{isEn ? "Sizes" : "سائز"}</th>
              <th className="p-2.5 text-center">{isEn ? "POS" : "POS"}</th>
              <th className="p-2.5 text-center">{isEn ? "No disc." : "رعایت"}</th>
              <th className="p-2.5 text-right">{isEn ? "Actions" : "عمل"}</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                <td className="p-2.5">
                  <div className="font-bold text-slate-800">{p.name}</div>
                  {p.code && <div className="text-[10px] text-slate-400 font-mono">{p.code}</div>}
                </td>
                <td className="p-2.5 text-slate-600">{p.categories?.name || "-"}</td>
                <td className="p-2.5 text-right font-mono font-semibold">
                  Rs {Number(p.sale_price_single).toLocaleString()}
                </td>
                <td className="p-2.5 text-center">{sizeCounts[p.id] || 0}</td>
                <td className="p-2.5 text-center">
                  <button
                    type="button"
                    title={isEn ? "Show on Restaurant POS" : "POS پر دکھائیں"}
                    onClick={() => toggleFlag(p, "show_in_restaurant_pos")}
                    className={p.show_in_restaurant_pos === false ? "text-slate-400" : "text-emerald-600"}
                  >
                    {p.show_in_restaurant_pos === false ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </td>
                <td className="p-2.5 text-center">
                  <button
                    type="button"
                    title={isEn ? "Exclude from order discount" : "رعایت نہیں"}
                    onClick={() => toggleFlag(p, "not_discounted")}
                    className={p.not_discounted ? "text-amber-600" : "text-slate-300"}
                  >
                    <Ban size={14} />
                  </button>
                </td>
                <td className="p-2.5 text-right space-x-1">
                  <button type="button" onClick={() => openEdit(p)} className="p-1 text-blue-600">
                    <Pencil size={14} />
                  </button>
                  <Link
                    href={`/dashboard/restaurant/recipes?product=${p.id}`}
                    className="inline-flex p-1 text-violet-600"
                    title={isEn ? "Recipes / BOM" : "ریسیپی"}
                  >
                    <ChefHat size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-xs text-slate-500">
        <div>
          {filtered.length} {isEn ? "items" : "آئٹمز"} · {isEn ? "Page" : "صفحہ"} {page}/{totalPages}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">
              {editing ? (isEn ? "Edit menu item" : "ترمیم") : isEn ? "New menu item" : "نیا آئٹم"}
            </h3>
            <Input
              placeholder={isEn ? "Item name" : "نام"}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder={isEn ? "Code (optional)" : "کوڈ"}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <Input
                type="number"
                placeholder={isEn ? "Base sale price" : "قیمت"}
                value={form.sale_price_single || ""}
                onChange={(e) =>
                  setForm({ ...form, sale_price_single: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">{isEn ? "Category" : "کیٹگری"}</label>
              <SearchableSelect
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                value={form.category_id}
                onChange={(v) => setForm({ ...form, category_id: v })}
                placeholder={isEn ? "Select…" : "منتخب…"}
              />
            </div>
            {stations.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-500">{isEn ? "Kitchen station" : "کچن"}</label>
                <select
                  value={form.kitchen_station_id}
                  onChange={(e) => setForm({ ...form, kitchen_station_id: e.target.value })}
                  className="w-full mt-1 border rounded-lg px-2 py-2 text-sm"
                >
                  <option value="">{isEn ? "Default" : "ڈیفالٹ"}</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <textarea
              className="w-full border rounded-lg p-2 text-sm min-h-[60px]"
              placeholder={isEn ? "Description for kitchen / menu" : "تفصیل"}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={form.show_in_restaurant_pos}
                onChange={(e) => setForm({ ...form, show_in_restaurant_pos: e.target.checked })}
                className="mt-0.5"
              />
              <div>
                <strong>{isEn ? "Show on Restaurant POS" : "POS پر دکھائیں"}</strong>
                <div className="block text-slate-500">
                  {isEn ? "Off = manage-only (hidden from order screen)" : "بند = صرف انتظام"}
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={form.not_discounted}
                onChange={(e) => setForm({ ...form, not_discounted: e.target.checked })}
                className="mt-0.5"
              />
              <div>
                <strong>{isEn ? "Do not apply order discount" : "آرڈر رعایت نہ لگے"}</strong>
                <div className="block text-slate-500">
                  {isEn ? "Bill % / fixed discount skips this item (like POSRESTURANT)" : "فیصد/فکس رعایت اس آئٹم پر نہیں"}
                </div>
              </div>
            </label>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving} className="flex-1 bg-blue-600 text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEn ? "Save" : "محفوظ"}
              </Button>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                {isEn ? "Cancel" : "منسوخ"}
              </Button>
            </div>
            {editing && (
              <Link
                href={`/dashboard/restaurant/recipes?product=${editing.id}`}
                className="text-xs text-blue-600 flex items-center gap-1"
              >
                <ExternalLink size={12} /> {isEn ? "Open recipes & food cost" : "ریسیپی کھولیں"}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
