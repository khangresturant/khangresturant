"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Category = { id: string; name: string };

export function MenuCategoriesTab() {
  const { shopId } = useShop();
  const { language } = useLanguage();
  const supabase = createClient();
  const isEn = language === "en";

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("shop_id", shopId)
        .order("name");
      if (error) throw error;
      setCategories(data || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [shopId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setName("");
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
  };

  const save = async () => {
    if (!shopId || !name.trim()) {
      toast.error(isEn ? "Category name is required" : "کیٹگری کا نام درکار ہے");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("categories").update({ name: name.trim() }).eq("id", editing.id);
        if (error) throw error;
        toast.success(isEn ? "Category updated" : "کیٹگری اپڈیٹ");
      } else {
        const { error } = await supabase.from("categories").insert({ shop_id: shopId, name: name.trim() });
        if (error) throw error;
        toast.success(isEn ? "Category created" : "کیٹگری بن گئی");
      }
      setEditing(null);
      setName("");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(isEn ? "Delete this category? Menu items may become uncategorized." : "کیٹگری حذف کریں؟")) return;
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      toast.success(isEn ? "Deleted" : "حذف");
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
      <div className="flex flex-wrap gap-2 items-end justify-between">
        <Input
          placeholder={isEn ? "Search categories…" : "تلاش…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9 text-sm"
        />
        <Button size="sm" onClick={openNew} className="bg-blue-600 text-white">
          <Plus size={14} className="mr-1" /> {isEn ? "New category" : "نئی کیٹگری"}
        </Button>
      </div>

      {(editing !== null || name) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap gap-2 items-center">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isEn ? "Category name e.g. Main Course" : "نام"}
            className="max-w-sm h-9"
          />
          <Button size="sm" onClick={save} disabled={saving} className="bg-emerald-600 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={14} className="mr-1" />}
            {isEn ? "Save" : "محفوظ"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setName("");
            }}
          >
            <X size={14} />
          </Button>
        </div>
      )}

      <div className="overflow-x-auto border rounded-xl bg-white">
        <table className="w-full text-sm min-w-[320px]">
          <thead>
            <tr className="bg-slate-100 text-left text-xs uppercase text-slate-600">
              <th className="p-3">{isEn ? "Name" : "نام"}</th>
              <th className="p-3 w-28 text-right">{isEn ? "Actions" : "عمل"}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="p-3 font-semibold text-slate-800">{c.name}</td>
                <td className="p-3 text-right space-x-1">
                  <button type="button" onClick={() => openEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => remove(c.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={2} className="p-8 text-center text-slate-500 text-xs">
                  {isEn ? "No categories yet." : "کوئی کیٹگری نہیں۔"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
