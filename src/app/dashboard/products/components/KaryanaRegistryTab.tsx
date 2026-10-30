"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Search, Plus, Check, Loader2, Tag, ShoppingBag, FolderPlus, Trash2, Lock, ChevronDown, ChevronUp, Barcode } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { toast } from "sonner";

interface KaryanaRegistryTabProps {
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
  variants: RegistryVariant[];
}

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  "Hair Care": "Hair Care",
  "Beverages": "Beverages & Tea",
  "Cooking Oil & Ghee": "Cooking Oil & Ghee",
  "Drinks & Beverages": "Drinks & Sodas",
  "Spices & Masala": "Spices & Masalas",
  "Laundry Care": "Laundry & Washing",
  "Personal Care": "Personal Hygiene",
  "Confectionery": "Snacks & Sweets",
  "Dairy & Milk": "Dairy Products",
  "Flour & Grains": "Flour & Rice",
  "Snacks & Noodles": "Noodles & Chips",
  "Sauces & Condiments": "Sauces & Ketchup"
};

// Deterministic helpers for realistic data simulation
const getDeterministicBarcode = (seed: string, index: number): string => {
  let hash = 0;
  const str = seed + index;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash).toString().padEnd(10, "0").substring(0, 10);
  return `890${positiveHash}`;
};

const getDeterministicPrice = (seed: string, min: number, max: number): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const percent = Math.abs(hash % 100) / 100;
  return Math.round(min + percent * (max - min));
};

const generateMasterKaryanaItems = (): RegistryProduct[] => {
  const list: RegistryProduct[] = [];
  
  const configs = [
    {
      category: "Hair Care",
      brands: ["Lifebuoy", "Sunsilk", "Pantene", "Head & Shoulders", "Dove", "Clear", "Bio Amla", "L'Oreal", "English Bold", "Samsol"],
      types: ["Shampoo", "Conditioner", "Hair Nourishing Cream", "Anti-Dandruff Active"],
      unit: "bottle",
      variants: [
        { name: "Sachet 10ml", size: 1, min_price: 9, max_price: 12, is_packing: false },
        { name: "Bottle 100ml", size: 1, min_price: 110, max_price: 150, is_packing: false },
        { name: "Bottle 200ml", size: 1, min_price: 210, max_price: 280, is_packing: false },
        { name: "Bottle 360ml", size: 1, min_price: 340, max_price: 490, is_packing: false }
      ]
    },
    {
      category: "Beverages",
      brands: ["Tapal", "Lipton", "Supreme", "Vital", "Meezan", "Alokozay", "Tez Dum Tea", "Tetley", "Karak Chai"],
      types: ["Danedar Tea", "Elaichi Rich Tea", "Green Tea Jasmine", "Strong Black Tea Mix", "Lemon Green Tea"],
      unit: "pack",
      variants: [
        { name: "50g Pack", size: 1, min_price: 110, max_price: 140, is_packing: false },
        { name: "95g Pack", size: 1, min_price: 180, max_price: 230, is_packing: false },
        { name: "190g Pack", size: 1, min_price: 350, max_price: 430, is_packing: false },
        { name: "475g Pack", size: 1, min_price: 850, max_price: 990, is_packing: false },
        { name: "950g Pack", size: 1, min_price: 1680, max_price: 1950, is_packing: false }
      ]
    },
    {
      category: "Cooking Oil & Ghee",
      brands: ["Dalda", "Meezan", "Kashmir", "Habib", "Sufi", "Eva Oil", "Tullo", "Mehran Ghee", "Kausar", "Shera"],
      types: ["Banaspati Ghee", "Premium Cooking Oil", "Pure Canola Oil", "Sunflower Healthy Oil"],
      unit: "pack",
      variants: [
        { name: "1 Litre Pouch", size: 1, min_price: 450, max_price: 540, is_packing: false },
        { name: "5 Litre Tin", size: 1, min_price: 2350, max_price: 2750, is_packing: false },
        { name: "10 Litre Jerry Can", size: 1, min_price: 4600, max_price: 5300, is_packing: false }
      ]
    },
    {
      category: "Drinks & Beverages",
      brands: ["Coca Cola", "Sprite", "Fanta", "Pepsi", "Dew", "7Up", "Pakola", "Gourmet Cola", "Next Cola", "RC Cola"],
      types: ["Soda Premium Bottle", "Diet Zero Can", "Zero Sugar Bottle", "Club Soda Active"],
      unit: "bottle",
      variants: [
        { name: "250ml Can", size: 1, min_price: 65, max_price: 80, is_packing: false },
        { name: "500ml Bottle", size: 1, min_price: 80, max_price: 100, is_packing: false },
        { name: "1.0 Litre Bottle", size: 1, min_price: 110, max_price: 130, is_packing: false },
        { name: "1.5 Litre Bottle", size: 1, min_price: 145, max_price: 180, is_packing: false },
        { name: "2.25 Litre Bottle", size: 1, min_price: 180, max_price: 220, is_packing: false }
      ]
    },
    {
      category: "Spices & Masala",
      brands: ["Shan", "National Foods", "Mehran Spices", "Chef's Pride", "Habib Spices", "Local Spice Master"],
      types: [
        "Biryani Masala", "Korma Masala", "Karahi Masala", "Tikka Masala", "Nihari Masala", 
        "Haleem Masala", "Chat Masala Premium", "Red Chili Powder", "Turmeric Powder", 
        "Coriander Powder", "Garam Masala Powder", "Black Pepper Powder", "Fish Fry Masala", 
        "Ginger Powder", "Garlic Powder", "Kasuri Methi aromatic"
      ],
      unit: "pack",
      variants: [
        { name: "50g Pack", size: 1, min_price: 85, max_price: 110, is_packing: false },
        { name: "100g Pack", size: 1, min_price: 160, max_price: 215, is_packing: false },
        { name: "200g Pack", size: 1, min_price: 300, max_price: 395, is_packing: false }
      ]
    },
    {
      category: "Laundry Care",
      brands: ["Ariel", "Surf Excel", "Bonus Active", "Express Power", "Sufi Safe", "Bright Max", "Gai Soap", "Sunlight"],
      types: ["Washing Powder Cleanse", "Laundry Soap Bar Extra", "Fabric Liquid Softener", "Bleach Whitening Liquid"],
      unit: "pack",
      variants: [
        { name: "50g Sachet", size: 1, min_price: 25, max_price: 35, is_packing: false },
        { name: "500g Pack", size: 1, min_price: 240, max_price: 310, is_packing: false },
        { name: "1kg Pack", size: 1, min_price: 490, max_price: 590, is_packing: false },
        { name: "5kg Mega Pack", size: 1, min_price: 2200, max_price: 2700, is_packing: false }
      ]
    },
    {
      category: "Personal Care",
      brands: ["Lux Beauty", "Safeguard Active", "Dettol Liquid", "Lifebuoy Care", "Capri Cream", "Tibetan Beauty", "Imperial Leather", "Palmolive Shower"],
      types: ["Beauty Fragrant Soap", "Antibacterial Safe Soap", "Liquid Hand Wash Active", "Body Wash Moisture Gel"],
      unit: "pcs",
      variants: [
        { name: "Single Bar 100g", size: 1, min_price: 80, max_price: 110, is_packing: false },
        { name: "Single Bar 150g", size: 1, min_price: 125, max_price: 160, is_packing: false },
        { name: "Pack of 3 Bars", size: 1, min_price: 230, max_price: 320, is_packing: false }
      ]
    },
    {
      category: "Confectionery",
      brands: ["LU Sooper Biscuits", "EBM Peek Freans", "Candi Caramel Biscuits", "Rio Cream Biscuits", "Prince Chocolate Cookies", "Tiger Energy Biscuits", "Gala Milk Biscuits", "Bakeri Shortbread", "Wheatable High Fiber"],
      types: ["Standard Biscuits Pack", "Half Roll Crunch Pack", "Family Treat Pack", "Tikky Party Pack"],
      unit: "pack",
      variants: [
        { name: "Tikky Pack", size: 1, min_price: 15, max_price: 25, is_packing: false },
        { name: "Half Roll Pack", size: 1, min_price: 50, max_price: 70, is_packing: false },
        { name: "Family Pack", size: 1, min_price: 100, max_price: 130, is_packing: false }
      ]
    },
    {
      category: "Dairy & Milk",
      brands: ["Olper's Dairy", "MilkPak Creamy", "Everyday Milk", "Tarang Tea Mix", "Dairy Pure Milk UHT", "Nestle Nido", "Anlene Extra"],
      types: ["Full Cream Milk", "Tea Whitener Pack", "Skimmed Healthy Milk", "Powdered Instant Milk"],
      unit: "pack",
      variants: [
        { name: "250ml Pack", size: 1, min_price: 70, max_price: 90, is_packing: false },
        { name: "1 Litre Pack", size: 1, min_price: 260, max_price: 310, is_packing: false },
        { name: "390g Powder Pouch", size: 1, min_price: 780, max_price: 950, is_packing: false },
        { name: "900g Family Tin", size: 1, min_price: 1750, max_price: 2100, is_packing: false }
      ]
    },
    {
      category: "Flour & Grains",
      brands: ["National Premium Grains", "Sufi Atta", "Guard Rice Mills", "Mehran Basmati Pack", "Local Desi Chakki Mills"],
      types: ["Super Basmati Premium Rice", "Desi Chakki Pure Atta", "Fine Wheat Flour Maida", "White Sugar Crystal Pack", "Iodized Refined Table Salt", "Suji Grains Pack"],
      unit: "pack",
      variants: [
        { name: "1kg Premium Pack", size: 1, min_price: 180, max_price: 260, is_packing: false },
        { name: "5kg Premium Bag", size: 1, min_price: 850, max_price: 1250, is_packing: false },
        { name: "10kg Economy Bag", size: 1, min_price: 1650, max_price: 2350, is_packing: false }
      ]
    },
    {
      category: "Snacks & Noodles",
      brands: ["Knorr Instant Noodles", "Shoop Instant Noodles", "Indomie Premium Noodles", "Lays Potato Chips", "Kurkure Spicy Snacks", "Wavy Ribbed Chips", "Cheetos Cheese Balls"],
      types: ["Chatpatta Tangy Noodles", "Chicken Classic Noodles", "Masala Spicy Noodles", "Classic Salted Chips", "Spicy Tikka Snacks", "Mayo Garlic Chips"],
      unit: "pack",
      variants: [
        { name: "Single Snack Pack", size: 1, min_price: 45, max_price: 60, is_packing: false },
        { name: "Family Pack of 4", size: 1, min_price: 170, max_price: 220, is_packing: false }
      ]
    },
    {
      category: "Sauces & Condiments",
      brands: ["National Foods", "Mitchell's Ketchup", "Shezan Fruit Preserves", "Young's Mayo", "Shangrila Sauces", "Knorr Sauces"],
      types: ["Tomato Ketchup Pouch", "Chili Garlic Sauce Pouch", "Egg Mayonnaise Creamy", "French Garlic Mayo Sauce", "Spicy Mango Pickle Jar"],
      unit: "pack",
      variants: [
        { name: "100g Small Pouch", size: 1, min_price: 80, max_price: 110, is_packing: false },
        { name: "500g Medium Pouch", size: 1, min_price: 290, max_price: 350, is_packing: false },
        { name: "1kg Family Bottle", size: 1, min_price: 520, max_price: 610, is_packing: false }
      ]
    }
  ];

  configs.forEach(c => {
    c.brands.forEach(b => {
      c.types.forEach(t => {
        let name = `${b} ${t}`;
        name = name.replace(/\s+/g, " ").trim();
        
        const variants = c.variants.map((v, idx) => {
          const purchase_price = getDeterministicPrice(name + "_" + v.name + "_pur", v.min_price, v.max_price);
          const sale_price = Math.round(purchase_price * 1.12); // standard 12% margin
          const barcode = getDeterministicBarcode(name + "_" + v.name, idx);
          
          return {
            packing_name: v.name,
            purchase_price,
            sale_price,
            barcode,
            is_packing: v.is_packing,
            pack_size: v.size
          };
        });
        
        const cleanBrand = b.replace(/\s(Foods|Milk|Instant|Biscuits|Ketchup|Noodles|Grains|Soap|Premium|Pure|UHT|danedar|AC|Inverter|Soda|Liquid|Creamy|Spices|Rich|Jasmine|Safe|Active|Plus)/gi, "").trim();

        list.push({
          name,
          category: c.category,
          brand: cleanBrand,
          unit: c.unit,
          variants
        });
      });
    });
  });
  
  return list;
};

export const MASTER_KARYANA_ITEMS = generateMasterKaryanaItems();

export function KaryanaRegistryTab({ shopId, onRefresh, categories }: KaryanaRegistryTabProps) {
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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

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

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    setCurrentPage(1);
    if (!search.trim()) return MASTER_KARYANA_ITEMS;
    const query = search.toLowerCase();
    return MASTER_KARYANA_ITEMS.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.brand.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  }, [search]);

  // Paginated View
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Single Product Import
  const handleImportProduct = async (product: RegistryProduct) => {
    if (!isPremium) {
      toast.error("یہ فیچر صرف پریمیم سبسکرپشن پلان میں دستیاب ہے۔", {
        description: "This feature is only available in the Premium plan. Please upgrade."
      });
      return;
    }
    setImportingName(product.name);
    try {
      // 1. Get or create category
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

      // 2. Get or create Brand
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
      const purchasePriceSingle = defaultVar.purchase_price;
      const salePriceSingle = defaultVar.sale_price;

      // 3. Insert Parent Product
      const { data: insertedProduct, error: prodError } = await supabase
        .from("products")
        .insert({
          shop_id: shopId,
          name: product.name,
          unit: product.unit,
          purchase_price_single: purchasePriceSingle,
          sale_price_single: salePriceSingle,
          current_stock: 0,
          min_stock_level: 5,
          category_id: categoryId,
          brand_id: brandId,
          measurement_type: "standard",
          code: defaultVar.barcode || null
        })
        .select()
        .single();

      if (prodError) throw prodError;

      // 4. Insert all variants
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

          if (varError) continue;

          // Link barcodes
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
      toast.success(`${product.name} with ${product.variants.length} variations added successfully!`);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error("Import failed: " + (err.message || "Unknown error"));
    } finally {
      setImportingName(null);
    }
  };

  // Bulk Import
  const handleImportAllItems = async () => {
    if (!isPremium) {
      toast.error("یہ فیچر صرف پریمیم سبسکرپشن پلان میں دستیاب ہے۔", {
        description: "This feature is only available in the Premium plan. Please upgrade."
      });
      return;
    }
    const itemsToImport = MASTER_KARYANA_ITEMS.filter(
      item => !importedItems.some(n => n.toLowerCase().trim() === item.name.toLowerCase().trim())
    );

    if (itemsToImport.length === 0) {
      toast.info("All items are already in your inventory!");
      return;
    }

    const consent = window.confirm(`Kya aap sabhi remaining ${itemsToImport.length} products ko variants aur barcodes ke sath import karna chahte hain? isme thoda time lag sakta hai.`);
    if (!consent) return;

    setIsImportingAll(true);
    setImportAllProgress(5);
    setImportAllStep("Step 1/5: Compiling Categories...");

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

      setImportAllProgress(15);
      setImportAllStep("Step 2/5: Compiling Brands...");

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

      setImportAllProgress(30);
      setImportAllStep("Step 3/5: Running batch import...");

      // 3. Import in loop
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
            min_stock_level: 5,
            category_id: categoryId,
            brand_id: brandId,
            measurement_type: "standard",
            code: defaultVar.barcode || null
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
        setImportAllProgress(30 + Math.round((counter / itemsToImport.length) * 70));
        setImportAllStep(`Step 4/5: Processed ${counter}/${itemsToImport.length} items...`);
      }

      setImportAllProgress(100);
      toast.success(`🎉 Successful! ${itemsToImport.length} products with variations successfully imported!`);
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
            <ShoppingBag size={16} className="text-blue-500 animate-pulse" /> Karyana Registry ({MASTER_KARYANA_ITEMS.length} Products preloaded)
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
            Complete database of Pakistani grocery brands, volumes, weights, sachet packs, bottles, and cartons mapped with barcodes.
          </p>
        </div>

        <div className="flex w-full md:w-auto items-center gap-2">
          <button
            onClick={handleImportAllItems}
            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer transition"
          >
            <FolderPlus size={14} />
            <span>Import All Grocery ({filteredItems.length})</span>
            {!isPremium && <Lock size={10} className="text-emerald-200" />}
          </button>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product, brand, or category..."
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
              <th className="py-3 px-4">Product Name</th>
              <th className="py-3 px-4">Brand</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 text-center">Base Unit</th>
              <th className="py-3 px-4 text-center">Variations</th>
              <th className="py-3 px-4 text-right">Price Range</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-bold">
            {paginatedItems.map((item) => {
              const isAlreadyImported = importedItems.some(
                n => n.toLowerCase().trim() === item.name.toLowerCase().trim()
              );
              const isExpanded = !!expandedRows[item.name];

              // Price range
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
                    <td className="py-3.5 px-4 text-center text-slate-600 font-black uppercase text-[10px]">{item.unit}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black">
                        {item.variants.length} Packings
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700">{priceRangeStr}</td>
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
                          <span>Import Product</span>
                          {!isPremium && <Lock size={9} className="text-blue-200" />}
                        </button>
                      )}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={8} className="p-4 border-t border-b border-slate-100">
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden max-w-2xl mx-auto shadow-xs">
                          <div className="bg-slate-50/60 px-4 py-2 border-b border-slate-150 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Packings & Barcode Variations</span>
                            <span className="text-[9.5px] text-slate-400 font-bold">Linked to parent: {item.name}</span>
                          </div>
                          <table className="w-full text-left text-[11px] border-collapse min-w-[500px]">
                            <thead>
                              <tr className="bg-slate-50/20 text-slate-400 font-black text-[9px] uppercase tracking-wider border-b border-slate-100">
                                <th className="py-2 px-4">Packing/Variant Name</th>
                                <th className="py-2 px-4"><span className="flex items-center gap-1"><Barcode size={12} /> Barcode</span></th>
                                <th className="py-2 px-4 text-center">Conversion</th>
                                <th className="py-2 px-4 text-right">Purchase (Rs)</th>
                                <th className="py-2 px-4 text-right">Sale (Rs)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-650">
                              {item.variants.map((v, i) => (
                                <tr key={i} className="hover:bg-slate-50/40">
                                  <td className="py-2 px-4 font-bold text-slate-800">{v.packing_name}</td>
                                  <td className="py-2 px-4 font-mono text-slate-500 text-[10px]">{v.barcode}</td>
                                  <td className="py-2 px-4 text-center font-semibold text-slate-500">{v.pack_size} x {item.unit}</td>
                                  <td className="py-2 px-4 text-right font-mono">Rs {v.purchase_price.toLocaleString()}</td>
                                  <td className="py-2 px-4 text-right font-mono text-slate-800 font-bold">Rs {v.sale_price.toLocaleString()}</td>
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
                  No grocery items matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-slate-50 border border-slate-200/60 p-3 rounded-2xl text-xs font-bold text-slate-600">
          <div>
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} products
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3.5 py-1.5 bg-white border rounded-xl hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-slate-700 transition"
            >
              Previous
            </button>
            <span className="font-black text-slate-800">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3.5 py-1.5 bg-white border rounded-xl hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-slate-700 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Bulk Import Progress Tracker */}
      {isImportingAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-650">
                <Loader2 size={24} className="animate-spin text-emerald-600" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Bulk Importing Grocery</h4>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Please wait, setting up grocery catalog...</p>
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
