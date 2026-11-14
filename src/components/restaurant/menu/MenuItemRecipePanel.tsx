"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ChefHat, Info, Loader2, Percent, Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  isSupabaseMissingColumnError,
  recipeRowsRequireMenuSizeColumn,
} from "@/lib/restaurant-ops";
import { isLocalSqliteEnabled } from "@/lib/config";

type IngredientProduct = {
  id: string;
  name: string;
  purchase_price_single: number;
  unit: string | null;
};

type RecipeItem = {
  ingredient_product_id: string;
  quantity: number;
  menu_size_id?: string | null;
  ingredientName?: string;
  ingredientUnit?: string | null;
  ingredientCost?: number;
};

type MenuSizeRow = { id: string; size_name: string; price: number };

type Props = {
  productId: string;
  productName: string;
  basePrice: number;
  sizesVersion?: number;
};

const migrationHint =
  "Run Restaurant → Setup / Migration (menu_size_id on product_recipes).";

export function MenuItemRecipePanel({ productId, productName, basePrice, sizesVersion = 0 }: Props) {
  const { shopId } = useShop();
  const { language } = useLanguage();
  const supabase = createClient();
  const isEn = language === "en";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientProduct[]>([]);
  const [menuSizes, setMenuSizes] = useState<MenuSizeRow[]>([]);
  const [selectedRecipeSizeId, setSelectedRecipeSizeId] = useState<string | null>(null);
  const [allRecipeRows, setAllRecipeRows] = useState<RecipeItem[]>([]);
  const [selectedIngId, setSelectedIngId] = useState("");
  const [ingQuantity, setIngQuantity] = useState(1);
  const [menuSizeColumnReady, setMenuSizeColumnReady] = useState(true);

  const hasMenuSizes = menuSizes.length > 0;

  const recipeItems = allRecipeRows.filter(
    (r) => (r.menu_size_id || null) === (selectedRecipeSizeId || null)
  );

  useEffect(() => {
    if (hasMenuSizes) {
      setSelectedRecipeSizeId((prev) =>
        prev && menuSizes.some((s) => s.id === prev) ? prev : menuSizes[0].id
      );
    } else {
      setSelectedRecipeSizeId(null);
    }
  }, [hasMenuSizes, menuSizes]);

  const selectedSize = menuSizes.find((s) => s.id === selectedRecipeSizeId);
  const salePrice = selectedSize ? Number(selectedSize.price) : basePrice;
  const totalCost = recipeItems.reduce(
    (sum, item) => sum + Number(item.ingredientCost || 0) * item.quantity,
    0
  );
  const profitMargin = salePrice - totalCost;
  const marginPercentage = salePrice > 0 ? (profitMargin / salePrice) * 100 : 0;

  useEffect(() => {
    if (isLocalSqliteEnabled()) {
      setMenuSizeColumnReady(true);
      return;
    }
    if (!shopId) return;
    (async () => {
      const { error } = await supabase.from("product_recipes").select("menu_size_id").limit(1);
      if (error && isSupabaseMissingColumnError(error.message, "menu_size_id")) {
        setMenuSizeColumnReady(false);
      } else {
        setMenuSizeColumnReady(true);
      }
    })();
  }, [shopId, supabase]);

  const loadAll = useCallback(async () => {
    if (!shopId || !productId) return;
    setLoading(true);
    try {
      const [ingRes, sizesRes, recipeRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, purchase_price_single, unit")
          .eq("shop_id", shopId)
          .eq("is_ingredient", true)
          .order("name"),
        supabase
          .from("restaurant_menu_sizes")
          .select("id, size_name, price")
          .eq("shop_id", shopId)
          .eq("product_id", productId)
          .eq("is_available", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("product_recipes")
          .select(
            `id, ingredient_product_id, quantity, menu_size_id,
            ingredients:products!product_recipes_ingredient_product_id_fkey ( name, unit, purchase_price_single )`
          )
          .eq("parent_product_id", productId),
      ]);

      setIngredients((ingRes.data || []) as IngredientProduct[]);
      setMenuSizes((sizesRes.data || []) as MenuSizeRow[]);

      let rows = recipeRes.data;
      if (recipeRes.error) {
        const fb = await supabase
          .from("product_recipes")
          .select("id, ingredient_product_id, quantity")
          .eq("parent_product_id", productId);
        rows = (fb.data || []).map((r: { id: string; ingredient_product_id: string; quantity: number }) => ({
          ...r,
          menu_size_id: null,
        }));
      }

      const ingList = (ingRes.data || []) as IngredientProduct[];
      const formatted: RecipeItem[] = (rows || []).map((r: any) => ({
        ingredient_product_id: r.ingredient_product_id,
        quantity: Number(r.quantity),
        menu_size_id: r.menu_size_id ?? null,
        ingredientName:
          r.ingredients?.name ||
          ingList.find((p) => p.id === r.ingredient_product_id)?.name ||
          "Ingredient",
        ingredientUnit: r.ingredients?.unit || "unit",
        ingredientCost: Number(
          r.ingredients?.purchase_price_single ??
            ingList.find((p) => p.id === r.ingredient_product_id)?.purchase_price_single ??
            0
        ),
      }));
      setAllRecipeRows(formatted);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
      setAllRecipeRows([]);
    } finally {
      setLoading(false);
    }
  }, [shopId, productId, supabase]);

  useEffect(() => {
    loadAll();
  }, [loadAll, sizesVersion]);

  const handleAddIngredient = () => {
    if (!selectedIngId) {
      toast.error(isEn ? "Select an ingredient" : "خام مال منتخب کریں");
      return;
    }
    if (ingQuantity <= 0) {
      toast.error(isEn ? "Quantity must be > 0" : "مقدار درست کریں");
      return;
    }
    const exists = recipeItems.find(
      (it) =>
        it.ingredient_product_id === selectedIngId &&
        (it.menu_size_id || null) === (selectedRecipeSizeId || null)
    );
    if (exists) {
      toast.info(isEn ? "Already on this size - change qty in the list" : "پہلے سے ہے");
      return;
    }
    const ing = ingredients.find((p) => p.id === selectedIngId);
    if (!ing) return;
    setAllRecipeRows((prev) => [
      ...prev,
      {
        ingredient_product_id: selectedIngId,
        quantity: ingQuantity,
        menu_size_id: selectedRecipeSizeId,
        ingredientName: ing.name,
        ingredientUnit: ing.unit,
        ingredientCost: ing.purchase_price_single,
      },
    ]);
    setSelectedIngId("");
    setIngQuantity(1);
  };

  const handleRemoveItem = (index: number) => {
    const target = recipeItems[index];
    if (!target) return;
    setAllRecipeRows((prev) =>
      prev.filter(
        (r) =>
          !(
            r.ingredient_product_id === target.ingredient_product_id &&
            (r.menu_size_id || null) === (target.menu_size_id || null)
          )
      )
    );
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    const target = recipeItems[index];
    if (!target) return;
    setAllRecipeRows((prev) =>
      prev.map((item) =>
        item.ingredient_product_id === target.ingredient_product_id &&
        (item.menu_size_id || null) === (target.menu_size_id || null)
          ? { ...item, quantity: newQty }
          : item
      )
    );
  };

  const handleSaveRecipe = async () => {
    if (!productId) return;
    const needsSizeColumn = recipeRowsRequireMenuSizeColumn(allRecipeRows);
    if (needsSizeColumn && !menuSizeColumnReady) {
      toast.error(migrationHint, { duration: 8000 });
      return;
    }
    setSaving(true);
    try {
      const { error: delErr } = await supabase.from("product_recipes").delete().eq("parent_product_id", productId);
      if (delErr) throw delErr;

      if (allRecipeRows.length > 0) {
        const payload = allRecipeRows.map((item) => ({
          parent_product_id: productId,
          ingredient_product_id: item.ingredient_product_id,
          quantity: item.quantity,
          menu_size_id: item.menu_size_id || null,
        }));
        const { error: insErr } = await supabase.from("product_recipes").insert(payload);
        if (insErr) throw insErr;
      }
      toast.success(isEn ? "Recipe / stock mapping saved" : "ریسیپی محفوظ");
      loadAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const sizeLabel = (id: string | null) => {
    if (!id) return isEn ? "Standard / base" : "اسٹینڈرڈ";
    return menuSizes.find((s) => s.id === id)?.size_name || "?";
  };

  return (
    <div className="border-t border-slate-200 pt-4 mt-2 space-y-3">
      <h4 className="text-xs font-black uppercase tracking-wide text-slate-600 flex items-center gap-1.5">
        <ChefHat size={14} className="text-violet-600" />
        {isEn ? "Ingredients / recipe (per size)" : "سائز کے حساب سے خام مال"}
      </h4>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        {isEn
          ? hasMenuSizes
            ? `Sizes exist - base/Standard is hidden. Set BOM per size; POS cost & stock use the sold size. Dish: ${productName}.`
            : `No sizes yet - one base recipe. Add sizes above and Standard hides automatically.`
          : hasMenuSizes
            ? "سائز ہیں - ہر سائز کی الگ ریسپی۔ POS اسٹاک اسی کے حساب سے۔"
            : "بیس ریسپی - سائز شامل کریں تو بیس چھپ جائے گا۔"}
      </p>

      {!menuSizeColumnReady && (
        <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
          {migrationHint}{" "}
          <Link href="/dashboard/restaurant/setup-migration" className="font-bold text-blue-700 underline">
            Setup →
          </Link>
        </p>
      )}

      {loading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase">{isEn ? "Recipe for:" : "سائز:"}</div>
            {!hasMenuSizes && (
              <button
                type="button"
                onClick={() => setSelectedRecipeSizeId(null)}
                className={`text-[10px] px-2.5 py-1 rounded-full border font-bold ${
                  selectedRecipeSizeId === null ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200"
                }`}
              >
                {isEn ? "Standard / base" : "بیس"}
              </button>
            )}
            {menuSizes.map((sz) => (
              <button
                key={sz.id}
                type="button"
                onClick={() => setSelectedRecipeSizeId(sz.id)}
                className={`text-[10px] px-2.5 py-1 rounded-full border font-bold ${
                  selectedRecipeSizeId === sz.id ? "bg-violet-600 text-white border-violet-600" : "bg-white border-slate-200"
                }`}
              >
                {sz.size_name} · Rs {Number(sz.price).toLocaleString()}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="bg-slate-50 rounded-lg p-2 border">
              <div className="text-slate-500 font-bold block">{isEn ? "Sale price" : "فروخت"}</div>
              <div className="font-mono font-black">Rs {salePrice.toFixed(0)}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 border">
              <div className="text-slate-500 font-bold block">{isEn ? "Recipe cost" : "لاگت"}</div>
              <div className="font-mono font-black">Rs {totalCost.toFixed(2)}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 border flex items-center gap-1">
              <Percent size={12} className="text-slate-400" />
              <div className="font-mono font-black">{marginPercentage.toFixed(1)}%</div>
            </div>
          </div>

          {ingredients.length === 0 ? (
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
              {isEn ? (
                <>
                  Mark purchase items as <strong>ingredients</strong> in Products, then reload.
                </>
              ) : (
                "Products میں خام مال (ingredient) بنائیں۔"
              )}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-6">
                <label className="text-[10px] font-bold text-slate-500">{isEn ? "Raw ingredient" : "خام مال"}</label>
                <select
                  value={selectedIngId}
                  onChange={(e) => setSelectedIngId(e.target.value)}
                  className="w-full mt-0.5 border rounded-lg px-2 py-1.5 text-xs h-8"
                >
                  <option value="">{isEn ? "Choose…" : "منتخب…"}</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} (Rs {ing.purchase_price_single}/{ing.unit || "unit"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="text-[10px] font-bold text-slate-500">{isEn ? "Qty" : "مقدار"}</label>
                <Input
                  type="number"
                  step="any"
                  value={ingQuantity}
                  onChange={(e) => setIngQuantity(parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div className="sm:col-span-3">
                <Button type="button" size="sm" onClick={handleAddIngredient} className="w-full h-8 text-xs bg-slate-900 text-white">
                  <Plus size={12} className="mr-0.5" /> {isEn ? "Add" : "شامل"}
                </Button>
              </div>
            </div>
          )}

          {recipeItems.length === 0 ? (
            <div className="text-center py-4 border border-dashed rounded-lg text-[10px] text-slate-500">
              <Info className="mx-auto h-5 w-5 text-slate-300 mb-1" />
              {isEn
                ? `No ingredients for ${sizeLabel(selectedRecipeSizeId)} yet.`
                : "ابھی خام مال نہیں۔"}
            </div>
          ) : (
            <table className="w-full text-[11px] border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-1.5">{isEn ? "Ingredient" : "خام"}</th>
                  <th className="p-1.5 text-center">{isEn ? "Qty" : "مقدار"}</th>
                  <th className="p-1.5 text-right">{isEn ? "Cost" : "لاگت"}</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {recipeItems.map((item, index) => (
                  <tr key={`${item.ingredient_product_id}-${item.menu_size_id}`} className="border-t">
                    <td className="p-1.5 font-semibold">{item.ingredientName}</td>
                    <td className="p-1.5 text-center">
                      <Input
                        type="number"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => handleUpdateQty(index, parseFloat(e.target.value) || 0)}
                        className="h-7 w-14 text-center text-[10px] mx-auto"
                      />
                    </td>
                    <td className="p-1.5 text-right font-mono">
                      Rs {(Number(item.ingredientCost) * item.quantity).toFixed(2)}
                    </td>
                    <td className="p-1.5">
                      <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="text-[9px] text-slate-400">
            {isEn ? "All sizes for this dish:" : "تمام سائز:"}{" "}
            {allRecipeRows.length
              ? Array.from(
                  new Set(allRecipeRows.map((r) => sizeLabel(r.menu_size_id || null)))
                ).join(", ")
              : "-"}
          </p>

          <Button
            type="button"
            size="sm"
            onClick={handleSaveRecipe}
            disabled={saving}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={14} className="mr-1" />}
            {isEn ? "Save recipe (stock deduction)" : "ریسیپی محفوظ"}
          </Button>
        </>
      )}
    </div>
  );
}
