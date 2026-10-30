"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Search, Plus, Check, Loader2, Tag, Smartphone, FolderPlus, Lock, ChevronDown, ChevronUp, Barcode, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { toast } from "sonner";

interface ElectronicsRegistryTabProps {
  shopId: string;
  onRefresh: () => void;
  categories: Array<{ id: string; name: string }>;
}

interface RegistryVariant {
  packing_name: string;
  purchase_price: number;
  sale_price: number;
  barcode: string;
  is_packing: boolean;
  pack_size: number;
}

interface RegistryProduct {
  name: string;
  category: string;
  brand: string;
  unit: string;
  has_imei: boolean;
  warranty: string;
  variants: RegistryVariant[];
}

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  "Smartphones": "Smartphones",
  "Home Appliances": "Home Appliances",
  "Computers & Laptops": "Laptops & Computers",
  "Air Conditioners": "Air Conditioners",
  "Smart Accessories": "Smart Watches & Accessories"
};

// 1. Preload common Pakistani Mobile & Electronics Items with their variants
export const MASTER_ELECTRONICS_ITEMS: RegistryProduct[] = [
  {
    name: "iPhone 15 Pro",
    category: "Smartphones",
    brand: "Apple",
    unit: "pcs",
    has_imei: true,
    warranty: "1 Year Official Apple Warranty",
    variants: [
      { packing_name: "128GB Storage", purchase_price: 320000, sale_price: 345000, barcode: "195949000010", is_packing: false, pack_size: 1 },
      { packing_name: "256GB Storage", purchase_price: 350000, sale_price: 375000, barcode: "195949000027", is_packing: true, pack_size: 1 },
      { packing_name: "512GB Storage", purchase_price: 395000, sale_price: 425000, barcode: "195949000034", is_packing: true, pack_size: 1 },
      { packing_name: "1TB Storage", purchase_price: 440000, sale_price: 475000, barcode: "195949000041", is_packing: true, pack_size: 1 }
    ]
  },
  {
    name: "Samsung Galaxy S24 Ultra",
    category: "Smartphones",
    brand: "Samsung",
    unit: "pcs",
    has_imei: true,
    warranty: "1 Year Official Airlink Warranty",
    variants: [
      { packing_name: "256GB / 12GB RAM", purchase_price: 335000, sale_price: 360000, barcode: "880609000018", is_packing: false, pack_size: 1 },
      { packing_name: "512GB / 12GB RAM", purchase_price: 365000, sale_price: 390000, barcode: "880609000025", is_packing: true, pack_size: 1 }
    ]
  },
  {
    name: "Infinix Hot 40 Pro",
    category: "Smartphones",
    brand: "Infinix",
    unit: "pcs",
    has_imei: true,
    warranty: "1 Year Carlcare Warranty",
    variants: [
      { packing_name: "128GB / 8GB RAM", purchase_price: 41000, sale_price: 45000, barcode: "8901030910014", is_packing: false, pack_size: 1 },
      { packing_name: "256GB / 8GB RAM", purchase_price: 45000, sale_price: 49500, barcode: "8901030910021", is_packing: true, pack_size: 1 }
    ]
  },
  {
    name: "Dawlance Refrigerator Chrome",
    category: "Home Appliances",
    brand: "Dawlance",
    unit: "pcs",
    has_imei: false,
    warranty: "12 Years Compressor Warranty",
    variants: [
      { packing_name: "12 Cubic Feet (Medium)", purchase_price: 82000, sale_price: 89000, barcode: "690000000012", is_packing: false, pack_size: 1 },
      { packing_name: "15 Cubic Feet (Large)", purchase_price: 96000, sale_price: 105000, barcode: "690000000015", is_packing: true, pack_size: 1 },
      { packing_name: "18 Cubic Feet (Extra Large)", purchase_price: 112000, sale_price: 122000, barcode: "690000000018", is_packing: true, pack_size: 1 }
    ]
  },
  {
    name: "Haier Inverter AC Triple Inverter",
    category: "Air Conditioners",
    brand: "Haier",
    unit: "pcs",
    has_imei: false,
    warranty: "10 Years Compressor, 4 Years PCB Warranty",
    variants: [
      { packing_name: "1.0 Ton Inverter AC", purchase_price: 105000, sale_price: 115000, barcode: "690000000104", is_packing: false, pack_size: 1 },
      { packing_name: "1.5 Ton Inverter AC", purchase_price: 135000, sale_price: 148000, barcode: "690000000159", is_packing: true, pack_size: 1 },
      { packing_name: "2.0 Ton Inverter AC", purchase_price: 175000, sale_price: 192000, barcode: "690000000203", is_packing: true, pack_size: 1 }
    ]
  },
  {
    name: "Xiaomi Redmi Note 13",
    category: "Smartphones",
    brand: "Xiaomi",
    unit: "pcs",
    has_imei: true,
    warranty: "1 Year Smartlink Warranty",
    variants: [
      { packing_name: "128GB / 6GB RAM", purchase_price: 52000, sale_price: 56500, barcode: "697165000101", is_packing: false, pack_size: 1 },
      { packing_name: "256GB / 8GB RAM", purchase_price: 58000, sale_price: 63000, barcode: "697165000102", is_packing: true, pack_size: 1 }
    ]
  },
  {
    name: "Orient Smart LED TV",
    category: "Home Appliances",
    brand: "Orient",
    unit: "pcs",
    has_imei: false,
    warranty: "1 Year Panel Warranty",
    variants: [
      { packing_name: "32 inch Smart LED", purchase_price: 36000, sale_price: 39900, barcode: "690000000326", is_packing: false, pack_size: 1 },
      { packing_name: "40 inch Smart LED", purchase_price: 49000, sale_price: 54900, barcode: "690000000401", is_packing: true, pack_size: 1 },
      { packing_name: "55 inch Smart LED 4K", purchase_price: 88000, sale_price: 98000, barcode: "690000000555", is_packing: true, pack_size: 1 }
    ]
  }
];

export function ElectronicsRegistryTab({ shopId, onRefresh, categories }: ElectronicsRegistryTabProps) {
  const supabase = createClient();
  const { subscriptionTier, subscriptionExpiresAt } = useShop();
  const [search, setSearch] = useState("");
  const [importingName, setImportingName] = useState<string | null>(null);
  const [importedItems, setImportedItems] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const isPremium = useMemo(() => {
    const isExpired = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) < new Date() : true;
    return !isExpired && subscriptionTier === "premium";
  }, [subscriptionTier, subscriptionExpiresAt]);

  // Bulk Import State
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [importAllStep, setImportAllStep] = useState("");
  const [importAllProgress, setImportAllProgress] = useState(0);

  // Load imported products
  useEffect(() => {
    const loadAlreadyImported = async () => {
      try {
        let allNames: string[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("products")
            .select("name")
            .eq("shop_id", shopId)
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) throw error;
          allNames.push(...(data || []).map((p: any) => p.name));
          if ((data || []).length < pageSize) break;
          page++;
        }
        setImportedItems(allNames);
      } catch (e) {
        console.error("Error loading imported items list", e);
      }
    };
    loadAlreadyImported();
  }, [shopId]);

  const toggleRow = (productName: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [productName]: !prev[productName]
    }));
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return MASTER_ELECTRONICS_ITEMS;
    const query = search.toLowerCase();
    return MASTER_ELECTRONICS_ITEMS.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.brand.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  }, [search]);

  // Import single product and all configurations/variations
  const handleImportProduct = async (product: RegistryProduct) => {
    if (!isPremium) {
      toast.error("یہ فیچر صرف پریمیم سبسکرپشن پلان میں دستیاب ہے۔", {
        description: "This feature is only available in the Premium plan. Please upgrade."
      });
      return;
    }
    setImportingName(product.name);
    try {
      // 1. Category
      const targetCategoryName = CATEGORY_TRANSLATIONS[product.category] || product.category;
      let categoryId = categories.find(c => c.name.toLowerCase() === targetCategoryName.toLowerCase())?.id;
      if (!categoryId) {
        const { data: newCat, error: catError } = await supabase
          .from("categories")
          .insert({ name: targetCategoryName, shop_id: shopId })
          .select()
          .single();
        if (catError) throw catError;
        categoryId = newCat.id;
      }

      // 2. Brand
      let brandId = null;
      if (product.brand) {
        const { data: existingBrand } = await supabase
          .from("brands")
          .select("id")
          .eq("shop_id", shopId)
          .eq("name", product.brand)
          .maybeSingle();

        if (existingBrand) {
          brandId = existingBrand.id;
        } else {
          const { data: newBrand, error: brandError } = await supabase
            .from("brands")
            .insert({ name: product.brand, shop_id: shopId })
            .select()
            .single();
          if (!brandError && newBrand) brandId = newBrand.id;
        }
      }

      const defaultVar = product.variants[0];

      // 3. Insert Parent Product with IMEI option and Warranty Info
      const { data: insertedProduct, error: prodError } = await supabase
        .from("products")
        .insert({
          shop_id: shopId,
          name: product.name,
          unit: product.unit,
          purchase_price_single: defaultVar.purchase_price,
          sale_price_single: defaultVar.sale_price,
          current_stock: 0,
          min_stock_level: 2,
          category_id: categoryId,
          brand_id: brandId,
          measurement_type: "standard",
          code: defaultVar.barcode || null,
          has_imei: product.has_imei,
          warranty: product.warranty
        })
        .select()
        .single();

      if (prodError) throw prodError;

      // 4. Insert variations
      if (insertedProduct && product.variants.length > 0) {
        for (const v of product.variants) {
          const { data: insertedVar, error: varError } = await supabase
            .from("product_variants")
            .insert({
              product_id: insertedProduct.id,
              shop_id: shopId,
              packing_name: v.packing_name,
              purchase_price: v.purchase_price,
              sale_price: v.sale_price,
              stock_quantity: 0,
              is_packing: v.is_packing,
              pack_size: v.pack_size
            })
            .select()
            .single();

          if (varError) {
            console.error("Error inserting variant:", varError);
            continue;
          }

          // Register barcode
          if (v.barcode && insertedVar) {
            await supabase
              .from("product_barcodes")
              .insert({
                product_id: insertedProduct.id,
                variant_id: insertedVar.id,
                shop_id: shopId,
                barcode: v.barcode
              });
          }
        }
      }

      setImportedItems(prev => [...prev, product.name]);
      toast.success(`🎉 ${product.name} successfully added (with ${product.variants.length} configurations)!`);
      onRefresh();
    } catch (err: any) {
      console.error("Electronics Import Error:", err);
      toast.error("Import failed: " + (err.message || "Unknown error"));
    } finally {
      setImportingName(null);
    }
  };

  // Bulk import all preloaded items
  const handleImportAllItems = async () => {
    if (!isPremium) {
      toast.error("یہ فیچر صرف پریمیم سبسکرپشن پلان میں دستیاب ہے۔", {
        description: "This feature is only available in the Premium plan. Please upgrade."
      });
      return;
    }
    const itemsToImport = MASTER_ELECTRONICS_ITEMS.filter(
      item => !importedItems.some(n => n.toLowerCase().trim() === item.name.toLowerCase().trim())
    );

    if (itemsToImport.length === 0) {
      toast.info("All electronics configurations are already imported!");
      return;
    }

    const consent = window.confirm(`Kya aap sabhi remaining ${itemsToImport.length} devices ko variants ke sath import karna chahte hain?`);
    if (!consent) return;

    setIsImportingAll(true);
    setImportAllProgress(10);
    setImportAllStep("Step 1/5: Loading Categories...");

    try {
      // 1. Categories
      const targetCats = Array.from(new Set(itemsToImport.map(i => CATEGORY_TRANSLATIONS[i.category] || i.category)));
      const catLookup: Record<string, string> = {};
      
      for (const catName of targetCats) {
        let existingCatId = categories.find(c => c.name.toLowerCase() === catName.toLowerCase())?.id;
        if (!existingCatId) {
          const { data: newCat, error } = await supabase
            .from("categories")
            .insert({ name: catName, shop_id: shopId })
            .select()
            .single();
          if (!error && newCat) existingCatId = newCat.id;
        }
        if (existingCatId) catLookup[catName.toLowerCase()] = existingCatId;
      }

      setImportAllProgress(30);
      setImportAllStep("Step 2/5: Loading Brands...");

      // 2. Brands
      const targetBrands = Array.from(new Set(itemsToImport.map(i => i.brand).filter(Boolean)));
      const brandLookup: Record<string, string> = {};
      
      for (const bName of targetBrands) {
        const { data: existingBrand } = await supabase
          .from("brands")
          .select("id")
          .eq("shop_id", shopId)
          .eq("name", bName)
          .maybeSingle();

        if (existingBrand) {
          brandLookup[bName.toLowerCase()] = existingBrand.id;
        } else {
          const { data: newBrand, error } = await supabase
            .from("brands")
            .insert({ name: bName, shop_id: shopId })
            .select()
            .single();
          if (!error && newBrand) brandLookup[bName.toLowerCase()] = newBrand.id;
        }
      }

      setImportAllProgress(50);
      setImportAllStep("Step 3/5: Importing Devices catalog...");

      // 3. Loop and import
      let counter = 0;
      for (const item of itemsToImport) {
        const targetCategoryName = CATEGORY_TRANSLATIONS[item.category] || item.category;
        const categoryId = catLookup[targetCategoryName.toLowerCase()] || null;
        const brandId = brandLookup[item.brand.toLowerCase()] || null;
        const defaultVar = item.variants[0];

        const { data: insertedProduct, error: prodError } = await supabase
          .from("products")
          .insert({
            shop_id: shopId,
            name: item.name,
            unit: item.unit,
            purchase_price_single: defaultVar.purchase_price,
            sale_price_single: defaultVar.sale_price,
            current_stock: 0,
            min_stock_level: 2,
            category_id: categoryId,
            brand_id: brandId,
            measurement_type: "standard",
            code: defaultVar.barcode || null,
            has_imei: item.has_imei,
            warranty: item.warranty
          })
          .select()
          .single();

        if (!prodError && insertedProduct) {
          for (const v of item.variants) {
            const { data: insertedVar, error: varError } = await supabase
              .from("product_variants")
              .insert({
                product_id: insertedProduct.id,
                shop_id: shopId,
                packing_name: v.packing_name,
                purchase_price: v.purchase_price,
                sale_price: v.sale_price,
                stock_quantity: 0,
                is_packing: v.is_packing,
                pack_size: v.pack_size
              })
              .select()
              .single();

            if (!varError && insertedVar && v.barcode) {
              await supabase
                .from("product_barcodes")
                .insert({
                  product_id: insertedProduct.id,
                  variant_id: insertedVar.id,
                  shop_id: shopId,
                  barcode: v.barcode
                });
            }
          }
        }

        counter++;
        setImportAllProgress(50 + Math.round((counter / itemsToImport.length) * 50));
        setImportAllStep(`Step 4/5: Processed ${counter}/${itemsToImport.length} devices...`);
      }

      setImportAllProgress(100);
      toast.success(`🎉 Successful! All ${itemsToImport.length} devices imported with serial settings!`);
      setImportedItems(prev => [...prev, ...itemsToImport.map(i => i.name)]);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error("Bulk import failed: " + (err.message || "Unknown error"));
    } finally {
      setIsImportingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Registry Intro */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
            <Smartphone size={16} className="text-blue-500 animate-pulse" /> Mobile & Electronics Registry ({MASTER_ELECTRONICS_ITEMS.length} Devices preloaded)
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
            Pre-configured smart phones, tablets, and home appliances. Auto-configures IMEI tracking and official manufacturer warranties on import.
          </p>
        </div>

        <div className="flex w-full md:w-auto items-center gap-2">
          <button
            onClick={handleImportAllItems}
            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer transition"
          >
            <FolderPlus size={14} />
            <span>Import All Devices</span>
            {!isPremium && <Lock size={10} className="text-emerald-200" />}
          </button>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product name, brand, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* Registry Table */}
      <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-xs overflow-x-auto w-full custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider select-none">
              <th className="py-3 px-4 w-8"></th>
              <th className="py-3 px-4">Device Name</th>
              <th className="py-3 px-4">Brand</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 text-center">Serial/IMEI Track</th>
              <th className="py-3 px-4 text-center">Specs/Variants</th>
              <th className="py-3 px-4 text-right">Price Range</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-bold">
            {filteredItems.map((item) => {
              const isAlreadyImported = importedItems.some(
                n => n.toLowerCase().trim() === item.name.toLowerCase().trim()
              );
              const isExpanded = !!expandedRows[item.name];

              // Price range string
              const salePrices = item.variants.map(v => v.sale_price);
              const minPrice = Math.min(...salePrices);
              const maxPrice = Math.max(...salePrices);
              const priceRangeStr = salePrices.length > 1 
                ? `Rs ${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}` 
                : `Rs ${minPrice.toLocaleString()}`;

              return (
                <React.Fragment key={item.name}>
                  <tr className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => toggleRow(item.name)}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-800">
                      <div>
                        {item.name}
                        <span className="md:hidden block text-[9px] text-slate-400 font-semibold">{item.brand} · {item.category}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-semibold hidden md:table-cell">{item.brand}</td>
                    <td className="py-3.5 px-4 text-slate-455 font-medium hidden md:table-cell">{item.category}</td>
                    <td className="py-3.5 px-4 text-center">
                      {item.has_imei ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[9px] font-black tracking-wider uppercase">
                          IMEI Enabled
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal">Standard</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black">
                        {item.variants.length} Specs
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 font-black">{priceRangeStr}</td>
                    <td className="py-3.5 px-4 text-center">
                      {isAlreadyImported ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-650 rounded-xl text-[10px] font-black">
                          <Check size={11} /> Added
                        </span>
                      ) : (
                        <button
                          onClick={() => handleImportProduct(item)}
                          disabled={importingName !== null}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50 transition"
                        >
                          <Plus size={11} />
                          <span>Import Device</span>
                          {!isPremium && <Lock size={9} className="text-blue-200" />}
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded configurations drawer */}
                  {isExpanded && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={8} className="p-4 border-t border-b border-slate-100">
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden max-w-3xl mx-auto shadow-xs space-y-3 p-4 overflow-x-auto w-full custom-scrollbar">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Specifications & Pricing Models</span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-650 font-black bg-slate-100 px-2.5 py-0.5 rounded-lg">
                              <Shield size={11} className="text-blue-600" /> {item.warranty}
                            </span>
                          </div>

                          <table className="w-full text-left text-[11px] border-collapse min-w-[500px]">
                            <thead>
                              <tr className="bg-slate-50 text-slate-400 font-black text-[9px] uppercase tracking-wider border-b border-slate-150">
                                <th className="py-2 px-3">Configuration Variant</th>
                                <th className="py-2 px-3"><span className="flex items-center gap-1"><Barcode size={12} /> Model EAN/UPC Barcode</span></th>
                                <th className="py-2 px-3 text-right">Dealer Price (Pur)</th>
                                <th className="py-2 px-3 text-right">Retail Price (MRP)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-650 font-bold">
                              {item.variants.map((v, i) => (
                                <tr key={i} className="hover:bg-slate-50/40">
                                  <td className="py-2 px-3 text-slate-800 font-extrabold">{v.packing_name}</td>
                                  <td className="py-2 px-3 font-mono text-slate-500 text-[10px]">{v.barcode}</td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-500">Rs {v.purchase_price.toLocaleString()}</td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-900 font-black">Rs {v.sale_price.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400 font-semibold">
                  No devices matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: Bulk Import Progress Tracker */}
      {isImportingAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-650">
                <Loader2 size={24} className="animate-spin text-emerald-600" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Bulk Importing Devices</h4>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Please wait, setting up devices catalog...</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>{importAllStep}</span>
                <span>{importAllProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${importAllProgress}%` }}
                />
              </div>
            </div>
            
            <p className="text-[9.5px] text-center text-slate-400 font-semibold italic">
              Do not close this page or refresh until import finishes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
