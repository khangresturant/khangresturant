"use client";

import React, { useState, useEffect } from "react";
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
  ingredientName?: string;
  ingredientUnit?: string | null;
  ingredientCost?: number;
};

export default function RecipesPage() {
  const { shopId } = useShop();
  const { t, language } = useLanguage();
  const supabase = createClient();

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
        setSelectedParentId(finished[0].id);
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
          .select("id, ingredient_product_id, quantity")
          .eq("parent_product_id", parentId);
        if (fallback.error) throw fallback.error;
        rows = (fallback.data || []).map((r: any) => {
          const ing = ingredients.find((p) => p.id === r.ingredient_product_id);
          return {
            ...r,
            ingredients: ing
              ? {
                  name: ing.name,
                  unit: ing.unit,
                  purchase_price_single: ing.purchase_price_single,
                }
              : null,
          };
        });
      }

      const formatted: RecipeItem[] = (rows || []).map((r: any) => ({
        id: r.id,
        ingredient_product_id: r.ingredient_product_id,
        quantity: Number(r.quantity),
        ingredientName: r.ingredients?.name || "Unknown Ingredient",
        ingredientUnit: r.ingredients?.unit || "unit",
        ingredientCost: Number(r.ingredients?.purchase_price_single || 0),
      }));

      setRecipeItems(formatted);
    } catch (err: any) {
      toast.error("Failed to load recipe: " + err.message);
    }
  };

  useEffect(() => {
    if (selectedParentId) {
      loadRecipe(selectedParentId);
    } else {
      setRecipeItems([]);
    }
  }, [selectedParentId]);

  const handleAddIngredient = () => {
    if (!selectedIngId) {
      toast.error("Please select an ingredient!");
      return;
    }
    if (ingQuantity <= 0) {
      toast.error("Quantity must be greater than zero.");
      return;
    }

    const exists = recipeItems.find(it => it.ingredient_product_id === selectedIngId);
    if (exists) {
      toast.info("Ingredient already added. Quantities can be adjusted below.");
      return;
    }

    const ingProduct = ingredients.find(p => p.id === selectedIngId);
    if (!ingProduct) return;

    setRecipeItems(prev => [
      ...prev,
      {
        ingredient_product_id: selectedIngId,
        quantity: ingQuantity,
        ingredientName: ingProduct.name,
        ingredientUnit: ingProduct.unit,
        ingredientCost: ingProduct.purchase_price_single
      }
    ]);

    setSelectedIngId("");
    setIngQuantity(1);
    toast.success("Ingredient added to staging list.");
  };

  const handleRemoveItem = (index: number) => {
    setRecipeItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    setRecipeItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: newQty } : item));
  };

  const handleSaveRecipe = async () => {
    if (!selectedParentId) return;
    setSaving(true);
    try {
      // 1. Delete previous recipe items
      const { error: delErr } = await supabase
        .from("product_recipes")
        .delete()
        .eq("parent_product_id", selectedParentId);

      if (delErr) throw delErr;

      // 2. Insert new recipe items
      if (recipeItems.length > 0) {
        const { error: insErr } = await supabase
          .from("product_recipes")
          .insert(recipeItems.map(item => ({
            parent_product_id: selectedParentId,
            ingredient_product_id: item.ingredient_product_id,
            quantity: item.quantity
          })));

        if (insErr) throw insErr;
      }

      toast.success("Recipe saved successfully!");
      loadRecipe(selectedParentId);
    } catch (err: any) {
      toast.error("Failed to save recipe: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Calculations
  const selectedParent = finishedProducts.find(p => p.id === selectedParentId);
  const salePrice = selectedParent?.sale_price_single || 0;
  
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
      
      {/* Title Header */}
      <div>
        <h2 className="text-lg font-black tracking-tight text-slate-800 flex items-center gap-1.5 font-nastaleeq">
          <Layers className="text-blue-600" /> {language === "en" ? "Recipe & BOM Management" : "ریسیپی اور خام مال کی انوینٹری (BOM)"}
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          {language === "en" 
            ? "Map finished menu dishes to raw ingredients to calculate food cost margins and automatically decrement stock levels." 
            : "مینو ڈشز کو خام مال کے ساتھ منسلک کریں تا کہ اصل کاسٹ معلوم ہو سکے اور فروخت پر اسٹاک خودکار وضع ہو سکے۔"}
        </p>
      </div>

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
                    <span className="text-xs truncate">{p.name}</span>
                    <span className={`text-[10px] font-mono ${isSelected ? "text-blue-300" : "text-blue-600"}`}>Rs {p.sale_price_single}</span>
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
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">
                      Selected Item
                    </span>
                    <h3 className="text-lg font-bold text-slate-800 mt-1">{selectedParent.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-500 font-bold uppercase">Sale Price:</span>
                    <span className="text-sm font-black font-mono text-slate-800">Rs {salePrice}</span>
                  </div>
                </div>

                {/* Profit Margin analysis cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-3.5 border border-slate-150 rounded-2xl flex flex-col justify-between h-20 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Estimated Recipe Cost</span>
                    <span className="text-base font-black text-slate-800 font-mono">Rs {totalCost.toFixed(2)}</span>
                  </div>
                  
                  <div className="bg-slate-50 p-3.5 border border-slate-150 rounded-2xl flex flex-col justify-between h-20 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Estimated Net Profit</span>
                    <span className={`text-base font-black font-mono ${profitMargin >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      Rs {profitMargin.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3.5 border border-slate-150 rounded-2xl flex flex-col justify-between h-20 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Food Cost Profit Margin</span>
                    <span className={`text-base font-black font-mono flex items-center gap-0.5 ${marginPercentage >= 40 ? "text-emerald-600" : marginPercentage >= 20 ? "text-amber-500" : "text-red-500"}`}>
                      <Percent size={15} /> {marginPercentage.toFixed(1)}%
                    </span>
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
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold font-mono">
                      Ingredients Count: {recipeItems.length}
                    </span>
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
                                    <span className="text-[10px] text-slate-500 font-semibold">{item.ingredientUnit || "unit"}</span>
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
