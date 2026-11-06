"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Layers, Plus, Trash2, Save, Loader2, Info, Search, 
  ChevronRight, ArrowRight, Percent, Check
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isSupabaseMissingColumnError,
  recipeRowsRequireMenuSizeColumn,
} from "@/lib/restaurant-ops";
import { isLocalSqliteEnabled } from "@/lib/config";

type Product = {
  id: string;
  name: string;
  sale_price_single: number;
  purchase_price_single: number;
  unit: string | null;
  is_ingredient?: boolean;
};

type RecipeItem = {
  id?: string;
  ingredient_product_id: string;
  quantity: number;
  menu_size_id?: string | null;
  ingredientName?: string;
  ingredientUnit?: string | null;
  ingredientCost?: number;
};

type MenuSizeRow = {
  id: string;
  size_name: string;
  price: number;
};

export default function RecipesPage() {
  const { shopId } = useShop();
  const { t, language } = useLanguage();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const productFromUrl = searchParams.get("product");

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishedProducts, setFinishedProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Product[]>([]);
  
  // Selected Parent & Current Recipe
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [parentSearch, setParentSearch] = useState("");
  const [ingredientSearch, setIngredientSearch] = useState("");

  // New Ingredient selector state
  const [selectedIngId, setSelectedIngId] = useState("");
  const [ingQuantity, setIngQuantity] = useState<number>(1);
  const [menuSizes, setMenuSizes] = useState<MenuSizeRow[]>([]);
  /** null = Standard/base recipe (no size row) */
  const [selectedRecipeSizeId, setSelectedRecipeSizeId] = useState<string | null>(null);
  const [allRecipeRows, setAllRecipeRows] = useState<RecipeItem[]>([]);
  const [menuSizeColumnReady, setMenuSizeColumnReady] = useState(true);

  const migrationHint =
    "Run Restaurant → Setup / Migration in Supabase SQL Editor (RESTAURANT_RECIPE_COST_SQL). After adding menu_size_id, reload the Supabase API schema if your project uses schema cache reload.";

  useEffect(() => {
    if (isLocalSqliteEnabled()) {
      setMenuSizeColumnReady(true);
      return;
    }
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      const { error } = await supabase.from("product_recipes").select("menu_size_id").limit(1);
      if (cancelled) return;
      if (error && isSupabaseMissingColumnError(error.message, "menu_size_id")) {
        setMenuSizeColumnReady(false);
      } else {
        setMenuSizeColumnReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopId, supabase]);

  const loadData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      // 1. Fetch finished products (exclude is_ingredient = true)
      const { data: allProds, error: prodErr } = await supabase
        .from("products")
        .select("id, name, sale_price_single, purchase_price_single, unit, is_ingredient")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (prodErr) throw prodErr;

      const finished = (allProds || []).filter((p: any) => !p.is_ingredient);
      const rawIngs = (allProds || []).filter((p: any) => p.is_ingredient);

      setFinishedProducts(finished);
      setIngredients(rawIngs);

      if (finished.length > 0) {
        const preferred = productFromUrl && finished.some((p: Product) => p.id === productFromUrl)
          ? productFromUrl
          : finished[0].id;
        setSelectedParentId(preferred);
      }
    } catch (err: any) {
      toast.error("Failed to load products: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [shopId]);

  // Load Recipe when selectedParentId changes
  const loadRecipe = async (parentId: string) => {
    if (!parentId) return;
    try {
      const { data, error } = await supabase
        .from("product_recipes")
        .select(`
          id,
          ingredient_product_id,
          quantity,
          menu_size_id,
          ingredients:products!product_recipes_ingredient_product_id_fkey (
            name,
            unit,
            purchase_price_single
          )
        `)
        .eq("parent_product_id", parentId);

      let rows = data;
      if (error) {
        const fallback = await supabase
          .from("product_recipes")
          .select("id, ingredient_product_id, quantity, menu_size_id")
          .eq("parent_product_id", parentId);
        if (fallback.error) {
          const fb2 = await supabase
            .from("product_recipes")
            .select("id, ingredient_product_id, quantity")
            .eq("parent_product_id", parentId);
          if (fb2.error) throw fb2.error;
          rows = (fb2.data || []).map((r: any) => ({ ...r, menu_size_id: null }));
        } else {
          rows = fallback.data;
        }
      }

      const formatted: RecipeItem[] = (rows || []).map((r: any) => ({
        id: r.id,
        ingredient_product_id: r.ingredient_product_id,
        quantity: Number(r.quantity),
        menu_size_id: r.menu_size_id ?? null,
        ingredientName: r.ingredients?.name || ingredients.find((p) => p.id === r.ingredient_product_id)?.name || "Unknown Ingredient",
        ingredientUnit: r.ingredients?.unit || ingredients.find((p) => p.id === r.ingredient_product_id)?.unit || "unit",
        ingredientCost: Number(
          r.ingredients?.purchase_price_single ??
            ingredients.find((p) => p.id === r.ingredient_product_id)?.purchase_price_single ??
            0
        ),
      }));

      setAllRecipeRows(formatted);
    } catch (err: any) {
      toast.error("Failed to load recipe: " + err.message);
      setAllRecipeRows([]);
    }
  };

  useEffect(() => {
    if (selectedParentId) {
      loadRecipe(selectedParentId);
      loadMenuSizes(selectedParentId);
    } else {
      setRecipeItems([]);
      setAllRecipeRows([]);
      setMenuSizes([]);
    }
  }, [selectedParentId]);

  const loadMenuSizes = async (parentId: string) => {
    if (!shopId) return;
    try {
      const { data } = await supabase
        .from("restaurant_menu_sizes")
        .select("id, size_name, price")
        .eq("shop_id", shopId)
        .eq("product_id", parentId)
        .eq("is_available", true)
        .order("sort_order", { ascending: true });
      setMenuSizes((data || []) as MenuSizeRow[]);
    } catch {
      setMenuSizes([]);
    }
  };

  useEffect(() => {
    setRecipeItems(
      allRecipeRows.filter((r) => (r.menu_size_id || null) === (selectedRecipeSizeId || null))
    );
  }, [allRecipeRows, selectedRecipeSizeId]);

  const handleAddIngredient = () => {
    if (!selectedIngId) {
      toast.error("Please select an ingredient!");
      return;
    }
    if (ingQuantity <= 0) {
      toast.error("Quantity must be greater than zero.");
      return;
    }

    const exists = recipeItems.find(
      (it) =>
        it.ingredient_product_id === selectedIngId &&
        (it.menu_size_id || null) === (selectedRecipeSizeId || null)
    );
    if (exists) {
      toast.info("Ingredient already added. Quantities can be adjusted below.");
      return;
    }

    const ingProduct = ingredients.find(p => p.id === selectedIngId);
    if (!ingProduct) return;

    setAllRecipeRows((prev) => [
      ...prev,
      {
        ingredient_product_id: selectedIngId,
        quantity: ingQuantity,
        menu_size_id: selectedRecipeSizeId,
        ingredientName: ingProduct.name,
        ingredientUnit: ingProduct.unit,
        ingredientCost: ingProduct.purchase_price_single,
      },
    ]);

    setSelectedIngId("");
    setIngQuantity(1);
    toast.success("Ingredient added to staging list.");
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
    if (!selectedParentId) return;
    const needsSizeColumn = recipeRowsRequireMenuSizeColumn(allRecipeRows);
    if (needsSizeColumn && !menuSizeColumnReady) {
      toast.error(migrationHint, { duration: 10000 });
      return;
    }

    setSaving(true);
    try {
      // 1. Delete previous recipe items
      const { error: delErr } = await supabase
        .from("product_recipes")
        .delete()
        .eq("parent_product_id", selectedParentId);

      if (delErr) throw delErr;

      // 2. Insert new recipe items (all sizes kept in allRecipeRows)
      if (allRecipeRows.length > 0) {
        const payload = allRecipeRows.map((item) => ({
          parent_product_id: selectedParentId,
          ingredient_product_id: item.ingredient_product_id,
          quantity: item.quantity,
          menu_size_id: item.menu_size_id || null,
        }));

        const insertLegacy = async () => {
          const { error: insErr2 } = await supabase.from("product_recipes").insert(
            allRecipeRows.map((item) => ({
              parent_product_id: selectedParentId,
              ingredient_product_id: item.ingredient_product_id,
              quantity: item.quantity,
            }))
          );
          if (insErr2) throw insErr2;
        };

        if (!menuSizeColumnReady) {
          await insertLegacy();
        } else {
          const { error: insErr } = await supabase.from("product_recipes").insert(payload);

          if (insErr) {
            const msg = insErr.message || "";
            if (isSupabaseMissingColumnError(msg, "menu_size_id")) {
              setMenuSizeColumnReady(false);
              if (needsSizeColumn) {
                throw new Error(migrationHint);
              }
              await insertLegacy();
            } else if (
              msg.includes("product_recipes_parent_product_id_ingredient_product_id_key") ||
              msg.includes("product_recipes_parent_ingredient_size_uniq") ||
              msg.includes("duplicate key")
            ) {
              throw new Error(
                "Database still uses the old recipe rule (one ingredient per dish only). Run Restaurant → Setup / Migration SQL - drop product_recipes_parent_product_id_ingredient_product_id_key and add per-size uniqueness."
              );
            } else {
              throw insErr;
            }
          }
        }
      }

      toast.success(
        !menuSizeColumnReady
          ? "Recipe saved (Standard/base only). Run Setup / Migration for per-size BOM."
          : "Recipe saved successfully!"
      );
      loadRecipe(selectedParentId);
    } catch (err: any) {
      toast.error("Failed to save recipe: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Calculations
  const selectedParent = finishedProducts.find(p => p.id === selectedParentId);
  const selectedSize = menuSizes.find((s) => s.id === selectedRecipeSizeId);
  const salePrice = selectedSize
    ? Number(selectedSize.price)
    : selectedParent?.sale_price_single || 0;
  
  // Total cost of all ingredients in recipe
  const totalCost = recipeItems.reduce((sum, item) => sum + (Number(item.ingredientCost || 0) * item.quantity), 0);
  const profitMargin = salePrice - totalCost;
  const marginPercentage = salePrice > 0 ? (profitMargin / salePrice) * 100 : 0;

  const filteredParents = finishedProducts.filter(p => 
    p.name.toLowerCase().includes(parentSearch.toLowerCase())
  );

  const filteredIngredients = ingredients.filter(p => 
    p.name.toLowerCase().includes(ingredientSearch.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-100">
        <p>
          {language === "en" 
            ? "Map menu dishes to raw ingredients per size. Set sizes under Restaurant -> Deals & Sizes, then pick a size here for size-specific BOM." 
            : "مینو ڈشز کو سائز کے حساب سے خام مال سے منسلک کریں۔ سائز Restaurant -> Deals & Sizes میں سیٹ کریں۔"}
        </p>
      </div>

      {!menuSizeColumnReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center gap-2">
          <div>
            Per-size recipes need the <code className="font-mono">menu_size_id</code> column on{" "}
            <code className="font-mono">product_recipes</code>. Run the recipe migration in Supabase, then reload the API schema if prompted.
          </div>
          <Link
            href="/dashboard/restaurant/setup-migration"
            className="shrink-0 font-bold text-blue-700 hover:underline"
          >
            Open Setup / Migration →
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Menu Items list (4 columns) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col max-h-[600px] overflow-hidden">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-3">
              {language === "en" ? "Finished Menu Items" : "تیار مینو آئٹمز"}
            </h3>
            
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder={language === "en" ? "Search dishes..." : "ڈش تلاش کریں..."}
                value={parentSearch}
                onChange={e => setParentSearch(e.target.value)}
                className="pl-8 bg-slate-50 border-slate-200 h-9 text-xs rounded-xl"
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
              {filteredParents.map(p => {
                const isSelected = p.id === selectedParentId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedParentId(p.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex justify-between items-center ${
                      isSelected 
                        ? "bg-slate-900 text-white font-bold shadow-md shadow-slate-900/10" 
                        : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-slate-700 font-semibold"
                    }`}
                  >
                    <div className="text-xs truncate">{p.name}</div>
                    <div className={`text-[10px] font-mono ${isSelected ? "text-blue-300" : "text-blue-600"}`}>Rs {p.sale_price_single}</div>
                  </button>
                );
              })}
              {filteredParents.length === 0 && (
                <p className="text-center text-slate-500 text-xs py-10">No items match your search.</p>
              )}
            </div>
          </div>

          {/* Right Column: Recipe Editor Form (8 columns) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* selected parent details */}
            {selectedParent ? (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3.5 sm:p-4 md:p-5 space-y-4 max-w-[1600px] mx-auto">
                
                {/* Header Information */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-3">
                  <div>
                    <div className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">
                      Selected Item
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mt-1">{selectedParent.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="text-xs text-slate-500 font-bold uppercase">Sale Price:</div>
                    <div className="text-sm font-black font-mono text-slate-800">Rs {salePrice}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Recipe for size:</div>
                  <button
                    type="button"
                    onClick={() => setSelectedRecipeSizeId(null)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-bold ${
                      selectedRecipeSizeId === null
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    Standard / Base
                  </button>
                  {menuSizes.map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => setSelectedRecipeSizeId(sz.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-bold ${
                        selectedRecipeSizeId === sz.id
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      {sz.size_name} (Rs {Number(sz.price).toFixed(0)})
                    </button>
                  ))}
                  {menuSizes.length === 0 && (
                    <div className="text-[10px] text-slate-400">
                      No extra sizes - only base recipe. Add sizes in Deals &amp; Sizes.
                    </div>
                  )}
                </div>

                {/* Profit Margin analysis cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-3.5 border border-slate-150 rounded-2xl flex flex-col justify-between h-20 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Estimated Recipe Cost</div>
                    <div className="text-base font-black text-slate-800 font-mono">Rs {totalCost.toFixed(2)}</div>
                  </div>
                  
                  <div className="bg-slate-50 p-3.5 border border-slate-150 rounded-2xl flex flex-col justify-between h-20 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Estimated Net Profit</div>
                    <div className={`text-base font-black font-mono ${profitMargin >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      Rs {profitMargin.toFixed(2)}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 border border-slate-150 rounded-2xl flex flex-col justify-between h-20 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Food Cost Profit Margin</div>
                    <div className={`text-base font-black font-mono flex items-center gap-0.5 ${marginPercentage >= 40 ? "text-emerald-600" : marginPercentage >= 20 ? "text-amber-500" : "text-red-500"}`}>
                      <Percent size={15} /> {marginPercentage.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Add Raw material ingredient drawer */}
                <div className="p-4 bg-slate-50/50 border border-slate-200/60 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                    {language === "en" ? "Map Raw Ingredient" : "خام مال کا جز شامل کریں"}
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* Ingredient select */}
                    <div className="sm:col-span-6">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Select Raw Material (خام مال)</label>
                      <select
                        value={selectedIngId}
                        onChange={e => setSelectedIngId(e.target.value)}
                        className="w-full text-xs border border-slate-200 p-2 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 h-9 cursor-pointer text-slate-700"
                      >
                        <option value="">-- Choose Ingredient --</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} (Cost: Rs {ing.purchase_price_single}/{ing.unit || 'unit'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity input */}
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Quantity Needed ({ingredients.find(p => p.id === selectedIngId)?.unit || "unit"})
                      </label>
                      <Input
                        type="number"
                        step="any"
                        value={ingQuantity}
                        onChange={e => setIngQuantity(parseFloat(e.target.value) || 0)}
                        className="h-9 text-xs border-slate-200 rounded-xl"
                      />
                    </div>

                    {/* Add button */}
                    <div className="sm:col-span-2">
                      <Button
                        onClick={handleAddIngredient}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-9 text-xs shadow-sm flex items-center justify-center gap-1"
                      >
                        <Plus size={14} /> Add
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Recipe Mapping Items List */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                      {language === "en" ? "Recipe Ingredients List" : "ریسیپی کے اجزاء کی تفصیل"}
                    </h4>
                    <div className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold font-mono">
                      Ingredients Count: {recipeItems.length}
                    </div>
                  </div>

                  {recipeItems.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
                      <Info className="mx-auto h-8 w-8 text-slate-300 mb-1" />
                      <p className="text-slate-500 text-xs">No ingredients mapped yet. Add raw materials above.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-xl overflow-hidden shadow-inner bg-white overflow-x-auto w-full custom-scrollbar">
                      <table className="w-full text-left border-collapse min-w-[500px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="p-3">Raw Material</th>
                            <th className="p-3 text-center">Unit Price (WAC)</th>
                            <th className="p-3 text-center">Quantity Needed</th>
                            <th className="p-3 text-right">Computed Cost</th>
                            <th className="p-3 text-center w-[60px]">Delete</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recipeItems.map((item, index) => {
                            const subCost = Number(item.ingredientCost || 0) * item.quantity;
                            return (
                              <tr key={item.ingredient_product_id} className="border-b border-slate-50 text-xs text-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/40">
                                <td className="p-3 font-semibold text-slate-800">{item.ingredientName}</td>
                                <td className="p-3 text-center font-mono font-medium text-slate-500">Rs {item.ingredientCost}</td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Input
                                      type="number"
                                      step="any"
                                      value={item.quantity}
                                      onChange={e => handleUpdateQty(index, parseFloat(e.target.value) || 0)}
                                      className="w-16 h-7 text-center text-xs font-bold border-slate-200 rounded-md p-1 font-mono"
                                    />
                                    <div className="text-[10px] text-slate-500 font-semibold">{item.ingredientUnit || "unit"}</div>
                                  </div>
                                </td>
                                <td className="p-3 text-right font-extrabold text-slate-800 font-mono">Rs {subCost.toFixed(2)}</td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => handleRemoveItem(index)}
                                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-md transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Form Save Action Buttons */}
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button
                    onClick={handleSaveRecipe}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-100 flex items-center justify-center gap-1.5"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {language === "en" ? "Save Recipe Mapping" : "ریسیپی سیو کریں"}
                  </Button>
                </div>

              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                <Info className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                <p className="text-slate-500 text-xs">Please select a menu item from the left panel to configure its ingredients.</p>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
