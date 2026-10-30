"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Search, Edit2, Trash2, Package, Tag, 
  Layers, AlertTriangle, ArrowRight, Loader2, Save, X, PlusCircle,
  Building, MapPin, AlignLeft, Info, Globe, Image
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/utils/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GeneralRegistryTab, MASTER_GENERAL_ITEMS } from "../../products/components/GeneralRegistryTab";

type Product = {
  id: string;
  name: string;
  code: string | null;
  unit: string | null;
  sale_price_single: number;
  purchase_price_single: number;
  current_stock: number;
  min_stock_level: number;
  category_id?: string;
  categories?: any;
  brand_id?: string | null;
  brands?: any;
  shelf_location?: string | null;
  note?: string | null;
  image_url?: string | null;
  pack_size?: number | null;
  purchase_price_pack?: number | null;
  sale_price_pack?: number | null;
  translated_names?: any;
};

type Category = {
  id: string;
  name: string;
};

type Brand = {
  id: string;
  name: string;
};

type Unit = {
  id: string;
  name: string;
  code: string;
};

type VariationState = {
  id?: string;
  packing_name: string;
  purchase_price: number;
  sale_price: number;
  stock_quantity: number;
  barcode: string;
  is_packing?: boolean;
  pack_size?: number | null;
};

function ProductsPageContent() {
  const { shopId, userId, industryType, activeLanguages } = useShop();
  const supabase = createClient();

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"products" | "categories" | "brands" | "master-general">("products");
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [formTranslations, setFormTranslations] = useState<Record<string, string>>({});

  // CSV Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  useEffect(() => {
    if (tabParam === "categories" || tabParam === "brands" || tabParam === "products" || tabParam === "master-general") {
      setActiveTab(tabParam as any);
    } else {
      setActiveTab("products");
    }
  }, [tabParam]);

  // Category Modals & Forms State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

  // Brand Modals & Forms State
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandName, setBrandName] = useState("");
  const [isSubmittingBrand, setIsSubmittingBrand] = useState(false);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    unit: "",
    purchase_price_single: 0,
    sale_price_single: 0,
    current_stock: 0,
    min_stock_level: 5,
    category_id: "",
    brand_id: "",
    shelf_location: "",
    note: "",
    image_url: ""
  });

  // Packing Variations State
  const [variations, setVariations] = useState<VariationState[]>([]);
  const [newVar, setNewVar] = useState({
    packing_name: "",
    purchase_price: 0,
    sale_price: 0,
    stock_quantity: 0,
    barcode: "",
    is_packing: false,
    pack_size: 10
  });

  // Box Packing Helper State
  const [hasBoxPacking, setHasBoxPacking] = useState(false);
  const [boxPackingName, setBoxPackingName] = useState("Box");
  const [boxPackSize, setBoxPackSize] = useState(10);
  const [boxPurchasePrice, setBoxPurchasePrice] = useState(0);
  const [boxSalePrice, setBoxSalePrice] = useState(0);
  const [boxBarcode, setBoxBarcode] = useState("");


  // Quick Add State
  const [showCategoryQuickAdd, setShowCategoryQuickAdd] = useState(false);
  const [showBrandQuickAdd, setShowBrandQuickAdd] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [quickBrandName, setQuickBrandName] = useState("");
  const [isSavingQuick, setIsSavingQuick] = useState(false);

  useEffect(() => {
    if (shopId) {
      fetchProducts();
      fetchCategories();
      fetchBrands();
      fetchUnits();
    }
  }, [shopId]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id, name, code, unit, sale_price_single, purchase_price_single, current_stock, min_stock_level, category_id, brand_id, shelf_location, note, image_url, pack_size, purchase_price_pack, sale_price_pack, translated_names,
          categories ( name ),
          brands ( name )
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      toast.error("Failed to load products: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      console.error("Failed to load categories: ", err.message);
    }
  };

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (error) throw error;
      setBrands(data || []);
    } catch (err: any) {
      console.error("Failed to load brands: ", err.message);
    }
  };

  const handleDownloadCSVTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Name,Barcode,Unit,Category,Brand,PurchasePrice,SalePrice,Stock,MinStockLevel,ShelfLocation,Note\n"
      + "Premium Rice 1kg,8901234567890,kg,Groceries,National Foods,280,320,50,10,A-3,High quality rice\n"
      + "Colgate Toothpaste 150g,8901111111111,pieces,Personal Care,Colgate,240,270,100,20,B-12,Mint flavor";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "products_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Import Template downloaded! 📥");
  };

  const handleUploadCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      setImportingCsv(true);
      setImportErrors([]);

      try {
        const lines = text.split(/\r?\n/);
        if (lines.length <= 1) {
          throw new Error("CSV file is empty or only contains headers.");
        }

        const recordsToInsert: any[] = [];
        const errors: string[] = [];

        // Fetch categories and brands map for validation
        const categoriesMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
        const brandsMap = new Map(brands.map(b => [b.name.toLowerCase(), b.id]));

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Simple CSV splitter handling quoted values
          const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
          const values = matches.map(v => v.replace(/^"|"$/g, "").trim());

          if (values.length < 5) {
            errors.push(`Row ${i + 1}: Mismatched columns or invalid format.`);
            continue;
          }

          // Map CSV values by header order
          const name = values[0];
          const barcode = values[1] || null;
          const unit = values[2] || "pieces";
          const categoryName = values[3];
          const brandName = values[4];
          const purchasePrice = parseFloat(values[5]) || 0;
          const salePrice = parseFloat(values[6]) || 0;
          const stock = parseFloat(values[7]) || 0;
          const minStock = parseFloat(values[8]) || 0;
          const shelf = values[9] || null;
          const note = values[10] || null;

          if (!name) {
            errors.push(`Row ${i + 1}: Name is required.`);
            continue;
          }
          if (purchasePrice <= 0 || salePrice <= 0) {
            errors.push(`Row ${i + 1}: Prices must be greater than 0.`);
            continue;
          }

          // Match category (auto-create if missing)
          let categoryId = categoryName ? categoriesMap.get(categoryName.toLowerCase()) : undefined;
          if (categoryName && !categoryId) {
            try {
              const { data: newCat, error: catErr } = await supabase
                .from("categories")
                .insert({ shop_id: shopId, name: categoryName })
                .select("id")
                .single();
              if (!catErr && newCat) {
                categoryId = newCat.id;
                categoriesMap.set(categoryName.toLowerCase(), newCat.id);
                setCategories(prev => [...prev, { id: newCat.id, name: categoryName }]);
              }
            } catch (err) {}
          }

          // Match brand (auto-create if missing)
          let brandId = brandName ? brandsMap.get(brandName.toLowerCase()) : undefined;
          if (brandName && !brandId) {
            try {
              const { data: newBrand, error: brandErr } = await supabase
                .from("brands")
                .insert({ shop_id: shopId, name: brandName })
                .select("id")
                .single();
              if (!brandErr && newBrand) {
                brandId = newBrand.id;
                brandsMap.set(brandName.toLowerCase(), newBrand.id);
                setBrands(prev => [...prev, { id: newBrand.id, name: brandName }]);
              }
            } catch (err) {}
          }

          recordsToInsert.push({
            shop_id: shopId,
            name,
            code: barcode,
            unit,
            category_id: categoryId || null,
            brand_id: brandId || null,
            purchase_price_single: purchasePrice,
            sale_price_single: salePrice,
            current_stock: stock,
            min_stock_level: minStock,
            shelf_location: shelf,
            note: note,
            translated_names: {}
          });
        }

        if (errors.length > 0) {
          setImportErrors(errors);
          toast.error(`CSV Validation failed with ${errors.length} errors.`);
          return;
        }

        if (recordsToInsert.length === 0) {
          throw new Error("No valid records found to import.");
        }

        // Batch insert to Supabase
        const { error: insertErr } = await supabase
          .from("products")
          .insert(recordsToInsert);

        if (insertErr) throw insertErr;

        logAudit(
          shopId!,
          userId,
          "PRODUCTS_BULK_IMPORTED",
          "products",
          null,
          { count: recordsToInsert.length }
        );

        toast.success(`Successfully imported ${recordsToInsert.length} products! 🚀`);
        setIsImportModalOpen(false);
        fetchProducts();
      } catch (err: any) {
        console.error(err);
        toast.error("Failed to import products: " + err.message);
      } finally {
        setImportingCsv(false);
      }
    };
    reader.readAsText(file);
  };

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from("units")
        .select("id, name, code")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (error) throw error;
      setUnits(data || []);
    } catch (err: any) {
      console.error("Failed to load units: ", err.message);
    }
  };

  const getLastSelectedCategory = () => {
    if (typeof window === "undefined") return "";
    try {
      const saved = localStorage.getItem(`last_selected_category_${shopId}`) || localStorage.getItem("last_selected_category");
      if (saved && categories.some(c => c.id === saved)) return saved;
    } catch (e) {}
    return "";
  };

  const getLastSelectedBrand = () => {
    if (typeof window === "undefined") return "";
    try {
      const saved = localStorage.getItem(`last_selected_brand_${shopId}`) || localStorage.getItem("last_selected_brand");
      if (saved && brands.some(b => b.id === saved)) return saved;
    } catch (e) {}
    return "";
  };

  const handleCategoryChange = (val: string) => {
    setFormData(prev => ({ ...prev, category_id: val }));
    if (typeof window !== "undefined") {
      try {
        if (val) {
          localStorage.setItem(`last_selected_category_${shopId}`, val);
          localStorage.setItem("last_selected_category", val);
        } else {
          localStorage.removeItem(`last_selected_category_${shopId}`);
          localStorage.removeItem("last_selected_category");
        }
      } catch (e) {}
    }
  };

  const handleBrandChange = (val: string) => {
    setFormData(prev => ({ ...prev, brand_id: val }));
    if (typeof window !== "undefined") {
      try {
        if (val) {
          localStorage.setItem(`last_selected_brand_${shopId}`, val);
          localStorage.setItem("last_selected_brand", val);
        } else {
          localStorage.removeItem(`last_selected_brand_${shopId}`);
          localStorage.removeItem("last_selected_brand");
        }
      } catch (e) {}
    }
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    const lastCat = getLastSelectedCategory();
    const lastBrd = getLastSelectedBrand();
    setFormData({
      name: "",
      code: "",
      unit: units[0]?.code || "",
      purchase_price_single: 0,
      sale_price_single: 0,
      current_stock: 0,
      min_stock_level: 5,
      category_id: lastCat,
      brand_id: lastBrd,
      shelf_location: "",
      note: "",
      image_url: ""
    });
    setVariations([]);
    setNewVar({
      packing_name: "",
      purchase_price: 0,
      sale_price: 0,
      stock_quantity: 0,
      barcode: "",
      is_packing: false,
      pack_size: 10
    });
    setHasBoxPacking(false);
    setBoxPackingName("Box");
    setBoxPackSize(10);
    setBoxPurchasePrice(0);
    setBoxSalePrice(0);
    setBoxBarcode("");
    setFormTranslations({});

    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (product: Product) => {
    setEditingProduct(product);
    const hasPack = !!(product.pack_size && product.pack_size > 0);
    
    let decodedNote = product.note || "";
    if (decodedNote.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(decodedNote);
        decodedNote = parsed.description || "";
      } catch (e) {}
    }

    setFormTranslations(product.translated_names || {});

    setFormData({
      name: product.name,
      code: product.code || "",
      unit: product.unit || "",
      purchase_price_single: product.purchase_price_single || 0,
      sale_price_single: product.sale_price_single || 0,
      current_stock: product.current_stock || 0,
      min_stock_level: product.min_stock_level || 5,
      category_id: product.category_id || "",
      brand_id: product.brand_id || "",
      shelf_location: product.shelf_location || "",
      note: decodedNote,
      image_url: product.image_url || ""
    });
    setHasBoxPacking(hasPack);
    setBoxPackSize(product.pack_size || 10);
    setBoxPurchasePrice(product.purchase_price_pack || 0);
    setBoxSalePrice(product.sale_price_pack || 0);


    // Fetch existing variations and their barcodes
    try {
      const { data: varsData, error } = await supabase
        .from("product_variants")
        .select(`
          id, packing_name, purchase_price, sale_price, stock_quantity, is_packing, pack_size,
          product_barcodes ( barcode )
        `)
        .eq("product_id", product.id);

      if (error) throw error;

      if (varsData) {
        const mapped: VariationState[] = varsData.map((v: any) => ({
          id: v.id,
          packing_name: v.packing_name,
          purchase_price: v.purchase_price || 0,
          sale_price: v.sale_price || 0,
          stock_quantity: v.stock_quantity || 0,
          barcode: v.product_barcodes?.[0]?.barcode || "",
          is_packing: !!v.is_packing,
          pack_size: v.pack_size || 10
        }));
        setVariations(mapped);
        
        const boxVar = mapped.find(v => 
          v.packing_name.toLowerCase().startsWith("box") || 
          v.packing_name.toLowerCase().startsWith("strip") || 
          v.packing_name.toLowerCase().startsWith("pack") || 
          v.packing_name.toLowerCase().includes("pcs")
        );
        if (boxVar) {
          setBoxBarcode(boxVar.barcode || "");
          const match = boxVar.packing_name.match(/^([^\(]+)/);
          if (match) {
            setBoxPackingName(match[1].trim());
          }
        } else {
          setBoxBarcode("");
          setBoxPackingName("Box");
        }
      } else {
        setVariations([]);
        setBoxBarcode("");
        setBoxPackingName("Box");
      }
    } catch (err: any) {
      console.error("Failed to load variations: ", err.message);
      setVariations([]);
      setBoxBarcode("");
      setBoxPackingName("Box");
    }

    setIsModalOpen(true);
  };

  const handleAddVariation = () => {
    if (!newVar.packing_name) {
      toast.error("Packing Name is required.");
      return;
    }
    const finalStock = newVar.is_packing 
      ? Math.floor(formData.current_stock / (newVar.pack_size || 10)) 
      : newVar.stock_quantity;

    const formattedName = newVar.is_packing && !newVar.packing_name.toLowerCase().includes("pcs")
      ? `${newVar.packing_name} (${newVar.pack_size} pcs)`
      : newVar.packing_name;

    setVariations([
      ...variations,
      { 
        ...newVar, 
        stock_quantity: finalStock,
        packing_name: formattedName
      }
    ]);
    setNewVar({
      packing_name: "",
      purchase_price: 0,
      sale_price: 0,
      stock_quantity: 0,
      barcode: "",
      is_packing: false,
      pack_size: 10
    });
  };

  const handleRemoveVariation = (idx: number) => {
    setVariations(variations.filter((_, i) => i !== idx));
  };

  const handleModalTranslateLang = async (lang: string) => {
    if (!formData.name) return;
    const toastId = toast.loading(`Translating to ${lang.toUpperCase()}...`);
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(formData.name)}`);
      if (res.ok) {
        const data = await res.json();
        const transVal = data?.[0]?.[0]?.[0];
        if (transVal) {
          setFormTranslations(prev => ({
            ...prev,
            [lang]: transVal
          }));
          toast.success("Translated successfully!", { id: toastId });
        } else {
          toast.error("Failed to parse translation value.", { id: toastId });
        }
      } else {
        toast.error("Translate API error.", { id: toastId });
      }
    } catch (err: any) {
      toast.error("Translation failed: " + err.message, { id: toastId });
    }
  };

  const handleModalTranslateAll = async () => {
    if (!formData.name) return;
    const toastId = toast.loading("Auto-translating to all active languages...");
    const targetLangs = activeLanguages?.filter((lang: string) => lang !== "en") || [];
    
    let translatedCount = 0;
    const updated = { ...formTranslations };
    for (const lang of targetLangs) {
      try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(formData.name)}`);
        if (res.ok) {
          const data = await res.json();
          const transVal = data?.[0]?.[0]?.[0];
          if (transVal) {
            updated[lang] = transVal;
            translatedCount++;
          }
        }
      } catch (e) {
        console.error(`Error translating to ${lang}:`, e);
      }
    }
    setFormTranslations(updated);
    toast.success(`Translated into ${translatedCount} languages!`, { id: toastId });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const toastId = toast.loading("Uploading product image...");
    try {
      const ext = file.name.split(".").pop();
      const filename = `product_${Date.now()}.${ext}`;
      const res = await fetch("/api/upload-receipt", {
        method: "POST",
        headers: {
          "x-filename": filename
        },
        body: file
      });
      
      const resData = await res.json();
      if (!res.ok || resData.error) throw new Error(resData.error || "Upload failed");
      
      setFormData(prev => ({ ...prev, image_url: resData.url }));
      toast.success("Image uploaded successfully!", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error("Upload failed: " + err.message, { id: toastId });
    }
  };

  const handleSaveProduct = async () => {
    if (!formData.name) {
      toast.error("Product name is required.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const dbPayload = {
        shop_id: shopId,
        name: formData.name,
        code: formData.code || null,
        unit: "Pcs",
        purchase_price_single: formData.purchase_price_single,
        sale_price_single: formData.sale_price_single,
        current_stock: formData.current_stock,
        min_stock_level: formData.min_stock_level,
        category_id: formData.category_id || null,
        brand_id: formData.brand_id || null,
        shelf_location: formData.shelf_location || null,
        note: formData.note || null,
        image_url: formData.image_url || null,
        translated_names: formTranslations,
        pack_size: hasBoxPacking ? boxPackSize : null,
        purchase_price_pack: hasBoxPacking ? boxPurchasePrice : null,
        sale_price_pack: hasBoxPacking ? boxSalePrice : null
      };

      let productId = "";

      if (editingProduct) {
        // Update product
        const { error } = await supabase
          .from("products")
          .update(dbPayload)
          .eq("id", editingProduct.id);

        if (error) throw error;
        productId = editingProduct.id;
        toast.success("Product updated successfully!");
      } else {
        // Create product
        const { data, error } = await supabase
          .from("products")
          .insert(dbPayload)
          .select()
          .single();

        if (error) throw error;
        productId = data.id;
        toast.success("Product added successfully!");
      }

      // Sync/Save packing variations
      // 1. Delete existing variations for this product
      if (editingProduct) {
        await supabase
          .from("product_variants")
          .delete()
          .eq("product_id", productId);
      }

      // Automatically construct box packing variation if checked
      let finalVariations = [...variations];
      if (hasBoxPacking && boxPackSize > 0) {
        const boxVarName = `${boxPackingName} (${boxPackSize} pcs)`;
        const boxStock = Math.floor(formData.current_stock / boxPackSize);
        const existingIdx = finalVariations.findIndex(v => v.packing_name.toLowerCase().startsWith(boxPackingName.toLowerCase()));
        
        const boxPayload = {
          packing_name: boxVarName,
          purchase_price: boxPurchasePrice,
          sale_price: boxSalePrice,
          stock_quantity: boxStock,
          barcode: boxBarcode,
          is_packing: true,
          pack_size: boxPackSize
        };

        if (existingIdx > -1) {
          finalVariations[existingIdx] = {
            ...finalVariations[existingIdx],
            ...boxPayload
          };
        } else {
          finalVariations.push(boxPayload);
        }
      }

      // 2. Insert new variations
      for (const variant of finalVariations) {
        const { data: insertedVar, error: varError } = await supabase
          .from("product_variants")
          .insert({
            product_id: productId,
            shop_id: shopId,
            packing_name: variant.packing_name,
            purchase_price: variant.purchase_price,
            sale_price: variant.sale_price,
            stock_quantity: variant.stock_quantity,
            is_packing: variant.is_packing || false,
            pack_size: variant.is_packing ? (variant.pack_size || 10) : 1
          })
          .select()
          .single();

        if (varError) throw varError;

        // Insert barcode if present
        if (variant.barcode && insertedVar) {
          await supabase
            .from("product_barcodes")
            .insert({
              product_id: productId,
              variant_id: insertedVar.id,
              shop_id: shopId,
              barcode: variant.barcode
            });
        }
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast.error("Error saving product: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTranslateAllProducts = async () => {
    if (products.length === 0) {
      toast.info("No products found to translate.");
      return;
    }
    setIsTranslatingAll(true);
    const toastId = toast.loading("Translating all products in catalog...");
    
    let successCount = 0;
    try {
      const targetLangs = activeLanguages?.filter((lang: string) => lang !== "en") || ["ur"];
      
      for (let i = 0; i < products.length; i++) {
        const prod = products[i];
        // @ts-ignore
        const currentTranslations = prod.translated_names || {};
        
        const needsTranslation = targetLangs.some(lang => !currentTranslations[lang]);
        
        if (needsTranslation) {
          const updatedTranslations = { ...currentTranslations };
          for (const lang of targetLangs) {
            if (!updatedTranslations[lang]) {
              try {
                const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(prod.name)}`);
                if (res.ok) {
                  const data = await res.json();
                  const transVal = data?.[0]?.[0]?.[0];
                  if (transVal) {
                    updatedTranslations[lang] = transVal;
                  }
                }
              } catch (err) {
                console.error(`Error translating ${prod.name} to ${lang}:`, err);
              }
            }
          }
          
          const { error } = await supabase
            .from("products")
            .update({ translated_names: updatedTranslations })
            .eq("id", prod.id);
            
          if (!error) {
            prod.translated_names = updatedTranslations;
            successCount++;
          }
        }
      }
      
      fetchProducts();
      toast.success(`Successfully translated ${successCount} products!`, { id: toastId });
    } catch (err: any) {
      toast.error("Translation run encountered an error: " + err.message, { id: toastId });
    } finally {
      setIsTranslatingAll(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Product deleted successfully!");
      fetchProducts();
    } catch (err: any) {
      toast.error("Failed to delete product: " + err.message);
    }
  };

  const handleQuickAddCategory = async () => {
    if (!quickCategoryName) return;
    setIsSavingQuick(true);
    try {
      const { data, error } = await supabase
        .from("categories")
        .insert({ shop_id: shopId, name: quickCategoryName })
        .select()
        .single();
      if (error) throw error;
      toast.success("Category added!");
      setCategories([...categories, data]);
      handleCategoryChange(data.id);
      setQuickCategoryName("");
      setShowCategoryQuickAdd(false);
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setIsSavingQuick(false);
    }
  };

  const handleQuickAddBrand = async () => {
    if (!quickBrandName) return;
    setIsSavingQuick(true);
    try {
      const { data, error } = await supabase
        .from("brands")
        .insert({ shop_id: shopId, name: quickBrandName })
        .select()
        .single();
      if (error) throw error;
      toast.success("Brand added!");
      setBrands([...brands, data]);
      handleBrandChange(data.id);
      setQuickBrandName("");
      setShowBrandQuickAdd(false);
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setIsSavingQuick(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryName) {
      toast.error("Category name is required.");
      return;
    }
    setIsSubmittingCategory(true);
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("categories")
          .update({ name: categoryName })
          .eq("id", editingCategory.id);
        if (error) throw error;
        toast.success("Category updated successfully!");
      } else {
        const { error } = await supabase
          .from("categories")
          .insert({ shop_id: shopId, name: categoryName });
        if (error) throw error;
        toast.success("Category created successfully!");
      }
      setIsCategoryModalOpen(false);
      setCategoryName("");
      setEditingCategory(null);
      fetchCategories();
      fetchProducts();
    } catch (err: any) {
      toast.error("Error saving category: " + err.message);
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category? Products in this category will become Uncategorized.")) return;
    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Category deleted successfully!");
      fetchCategories();
      fetchProducts();
    } catch (err: any) {
      toast.error("Failed to delete category: " + err.message);
    }
  };

  const handleSaveBrand = async () => {
    if (!brandName) {
      toast.error("Brand name is required.");
      return;
    }
    setIsSubmittingBrand(true);
    try {
      if (editingBrand) {
        const { error } = await supabase
          .from("brands")
          .update({ name: brandName })
          .eq("id", editingBrand.id);
        if (error) throw error;
        toast.success("Brand updated successfully!");
      } else {
        const { error } = await supabase
          .from("brands")
          .insert({ shop_id: shopId, name: brandName });
        if (error) throw error;
        toast.success("Brand created successfully!");
      }
      setIsBrandModalOpen(false);
      setBrandName("");
      setEditingBrand(null);
      fetchBrands();
      fetchProducts();
    } catch (err: any) {
      toast.error("Error saving brand: " + err.message);
    } finally {
      setIsSubmittingBrand(false);
    }
  };

  const handleDeleteBrand = async (id: string) => {
    if (!confirm("Are you sure you want to delete this brand? Products in this brand will become No Brand.")) return;
    try {
      const { error } = await supabase
        .from("brands")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Brand deleted successfully!");
      fetchBrands();
      fetchProducts();
    } catch (err: any) {
      toast.error("Failed to delete brand: " + err.message);
    }
  };

  const getCategoryProductCount = (categoryId: string) => {
    return products.filter(p => p.category_id === categoryId).length;
  };

  const getBrandProductCount = (brandId: string) => {
    return products.filter(p => p.brand_id === brandId).length;
  };

  const getCategoryName = (categories: any) => {
    if (!categories) return "Uncategorized";
    if (Array.isArray(categories)) {
      return categories[0]?.name || "Uncategorized";
    }
    return categories.name || "Uncategorized";
  };

  const getBrandName = (brands: any) => {
    if (!brands) return "No Brand";
    if (Array.isArray(brands)) {
      return brands[0]?.name || "No Brand";
    }
    return brands.name || "No Brand";
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Statistics
  const totalItems = products.length;
  const outOfStockItems = products.filter(p => p.current_stock <= 0).length;
  const lowStockItems = products.filter(p => p.current_stock > 0 && p.current_stock <= p.min_stock_level).length;
  const inventoryValue = products.reduce((acc, p) => acc + (p.purchase_price_single * p.current_stock), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900">
            {activeTab === "products" && "Products Catalog"}
            {activeTab === "categories" && "Product Categories"}
            {activeTab === "brands" && "Brands & Companies"}
          </h2>
          
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={
                activeTab === "products" 
                  ? "Search products..." 
                  : activeTab === "categories" 
                    ? "Search categories..." 
                    : "Search brands..."
              } 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          {activeTab === "products" && (
            <>
              <Button 
                onClick={() => setIsImportModalOpen(true)}
                className="bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200"
              >
                📥 Bulk CSV Import
              </Button>
              <Button 
                onClick={handleTranslateAllProducts} 
                disabled={isTranslatingAll}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200"
              >
                {isTranslatingAll ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="mr-2 h-4 w-4" />
                )}
                Translate Product Names
              </Button>
              <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
                <Plus className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </>
          )}
          {activeTab === "categories" && (
            <Button onClick={() => { setEditingCategory(null); setCategoryName(""); setIsCategoryModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
              <Plus className="mr-2 h-4 w-4" /> Add Category
            </Button>
          )}
          {activeTab === "brands" && (
            <Button onClick={() => { setEditingBrand(null); setBrandName(""); setIsBrandModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200">
              <Plus className="mr-2 h-4 w-4" /> Add Brand
            </Button>
          )}
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex border-b border-slate-200">
        {[
          { id: "products", label: "Products Catalog", count: totalItems },
          { id: "categories", label: "Categories", count: categories.length },
          { id: "brands", label: "Brands & Companies", count: brands.length },
          { id: "master-general", label: "General Registry", count: MASTER_GENERAL_ITEMS.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setSearchQuery(""); }}
            className={`py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            {tab.label}
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
              activeTab === tab.id ? "bg-blue-105 text-blue-800" : "bg-slate-100 text-slate-600"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Panel: Products */}
      {activeTab === "products" && (
        <>
          {/* Quick Stats Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
                <Package size={22} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Total Products</p>
                <p className="text-xl font-bold text-slate-950 mt-0.5">{totalItems}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center border border-red-100">
                <AlertTriangle size={22} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Out of Stock</p>
                <p className="text-xl font-bold text-slate-950 mt-0.5">{outOfStockItems}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100">
                <AlertTriangle size={22} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Low Stock Alert</p>
                <p className="text-xl font-bold text-slate-950 mt-0.5">{lowStockItems}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
                <Tag size={22} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Inventory Value</p>
                <p className="text-xl font-bold text-slate-950 mt-0.5">Rs {inventoryValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              </div>
            </div>
          </div>

          {/* Products Data Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-6 py-4">Product Name</th>
                    <th className="px-6 py-4">Barcode / Code</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Brand / Company</th>
                    <th className="px-6 py-4 text-right">Purchase Price</th>
                    <th className="px-6 py-4 text-right">Sale Price</th>
                    <th className="px-6 py-4 text-center">Stock</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-slate-400">Loading catalog...</td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-slate-400 flex flex-col items-center">
                        <Package className="h-10 w-10 text-slate-300 mb-2" />
                        <p>No products found. Click "Add Product" to create one.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => {
                      const isLow = product.current_stock <= product.min_stock_level;
                      const isOut = product.current_stock <= 0;

                      return (
                        <tr key={product.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800 text-sm">
                            <div>
                              <p>{product.name}</p>
                              {product.translated_names && typeof product.translated_names === "object" && Object.entries(product.translated_names).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {Object.entries(product.translated_names).map(([lang, val]) => (
                                    <span key={lang} className="text-[9.5px] font-sans font-black bg-indigo-50 text-indigo-800 border border-indigo-100 px-2 py-0.5 rounded-lg uppercase shadow-sm">
                                      {lang}: {String(val)}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {product.shelf_location && (
                                <span className="text-[10px] text-slate-400 font-normal flex items-center gap-0.5 mt-1.5">
                                  <MapPin size={10} /> {product.shelf_location}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">{product.code || "ΓÇö"}</td>
                          <td className="px-6 py-4">
                            <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded text-[11px] font-semibold border border-slate-200">
                              {getCategoryName(product.categories)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-medium">{getBrandName(product.brands)}</td>
                          <td className="px-6 py-4 text-right font-semibold text-slate-600">Rs {product.purchase_price_single}</td>
                          <td className="px-6 py-4 text-right font-black text-blue-650">Rs {product.sale_price_single}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              isOut 
                                ? "bg-red-100 text-red-700" 
                                : isLow 
                                  ? "bg-amber-100 text-amber-700" 
                                  : "bg-emerald-100 text-emerald-700"
                            }`}>
                              {product.current_stock} {product.unit || "pcs"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleOpenEditModal(product)}
                              className="text-slate-600 hover:text-blue-605 hover:bg-slate-100"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteProduct(product.id)}
                              className="text-slate-600 hover:text-red-655 hover:bg-slate-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Tab Panel: Categories */}
      {activeTab === "categories" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-4">Category Name</th>
                  <th className="px-6 py-4">Linked Products</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-slate-400 flex flex-col items-center">
                      <Layers className="h-10 w-10 text-slate-300 mb-2" />
                      <p>No categories configured yet.</p>
                    </td>
                  </tr>
                ) : categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-slate-400">
                      No categories match your search.
                    </td>
                  </tr>
                ) : (
                  categories
                    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((cat) => (
                      <tr key={cat.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 text-sm">{cat.name}</td>
                        <td className="px-6 py-4 text-slate-500 font-semibold">{getCategoryProductCount(cat.id)} products</td>
                        <td className="px-6 py-4 text-right space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { setEditingCategory(cat); setCategoryName(cat.name); setIsCategoryModalOpen(true); }}
                            className="text-slate-600 hover:text-blue-600 hover:bg-slate-100"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-slate-600 hover:text-red-600 hover:bg-slate-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Panel: Brands */}
      {activeTab === "brands" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-4">Brand / Company Name</th>
                  <th className="px-6 py-4">Linked Products</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {brands.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-slate-400 flex flex-col items-center">
                      <Building className="h-10 w-10 text-slate-300 mb-2" />
                      <p>No brands configured yet.</p>
                    </td>
                  </tr>
                ) : brands.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-slate-400">
                      No brands match your search.
                    </td>
                  </tr>
                ) : (
                  brands
                    .filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((br) => (
                      <tr key={br.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 text-sm">{br.name}</td>
                        <td className="px-6 py-4 text-slate-500 font-semibold">{getBrandProductCount(br.id)} products</td>
                        <td className="px-6 py-4 text-right space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { setEditingBrand(br); setBrandName(br.name); setIsBrandModalOpen(true); }}
                            className="text-slate-600 hover:text-blue-600 hover:bg-slate-100"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteBrand(br.id)}
                            className="text-slate-600 hover:text-red-600 hover:bg-slate-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Panel: General Registry */}
      {activeTab === "master-general" && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6">
          <GeneralRegistryTab
            shopId={shopId || ""}
            categories={categories}
            onRefresh={fetchProducts}
          />
        </div>
      )}

      {/* Modal: Add/Edit Category */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => setIsCategoryModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10 border border-slate-150"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm">
                  {editingCategory ? "Edit Category" : "Add New Category"}
                </h3>
                <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-605">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category Name</label>
                  <Input 
                    placeholder="e.g. Beverages, Bakery" 
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="rounded-xl h-10 text-xs border-slate-200"
                  />
                </div>
                <Button 
                  onClick={handleSaveCategory} 
                  disabled={isSubmittingCategory}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold h-10 rounded-xl shadow-lg mt-1"
                >
                  {isSubmittingCategory ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Category
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Add/Edit Brand */}
      <AnimatePresence>
        {isBrandModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => setIsBrandModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10 border border-slate-150"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm">
                  {editingBrand ? "Edit Brand" : "Add New Brand"}
                </h3>
                <button onClick={() => setIsBrandModalOpen(false)} className="text-slate-400 hover:text-slate-605">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Brand / Company Name</label>
                  <Input 
                    placeholder="e.g. Nestle, Unilever" 
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="rounded-xl h-10 text-xs border-slate-200"
                  />
                </div>
                <Button 
                  onClick={handleSaveBrand} 
                  disabled={isSubmittingBrand}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold h-10 rounded-xl shadow-lg mt-1"
                >
                  {isSubmittingBrand ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Brand
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Add/Edit Product */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => setIsModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl relative z-10 overflow-hidden my-8"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-805">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-3.5 sm:p-4 md:p-5 space-y-4 max-w-[1600px] mx-auto max-h-[75vh] overflow-y-auto custom-scrollbar">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Column 1: Basic Information */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-blue-50 pb-2 flex items-center gap-1.5">
                      <Package size={14} /> Basic Information
                    </h4>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase">Product Name</label>
                        {activeLanguages?.filter((l: string) => l !== "en").length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={handleModalTranslateAll}
                            disabled={!formData.name}
                            className="text-[10px] font-black h-5 py-0 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded transition-all cursor-pointer"
                          >
                            <Globe size={10} className="mr-1" /> Auto-Translate All
                          </Button>
                        )}
                      </div>
                      <Input 
                        placeholder="e.g. Wheat Flour 10kg" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>

                    {/* Secondary Languages Inputs */}
                    {activeLanguages?.filter((l: string) => l !== "en").map((lang: string) => {
                      const nativeNameMap = {
                        ur: "Urdu (اردو)",
                        ar: "Arabic (العربية)",
                        fa: "Persian (فارسی)",
                        ps: "Pashto (پښتو)",
                        sd: "Sindhi (سنڌي)",
                        hi: "Hindi (हिन्दी)",
                        bn: "Bengali (বাংলা)",
                        ta: "Tamil (தமிழ்)",
                        te: "Telugu (తెలుగు)"
                      };
                      return (
                        <div key={lang} className="pl-4 border-l-2 border-indigo-200/50 space-y-1 mt-2.5">
                          <div className="flex justify-between items-center">
                            <label className="block text-[10px] font-bold text-slate-450 uppercase">
                              {nativeNameMap[lang as keyof typeof nativeNameMap] || lang} Translation (ترجمہ)
                            </label>
                            <button
                              type="button"
                              onClick={() => handleModalTranslateLang(lang)}
                              disabled={!formData.name}
                              className="text-[9px] font-black px-1.5 py-0.5 rounded text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              Translate
                            </button>
                          </div>
                          <Input 
                            placeholder={`Enter name in ${(nativeNameMap[lang as keyof typeof nativeNameMap] || lang).split(" ")[0]}`} 
                            value={formTranslations[lang] || ""}
                            onChange={(e) => setFormTranslations({
                              ...formTranslations,
                              [lang]: e.target.value
                            })}
                            className="h-8 text-xs border-indigo-100 focus-visible:ring-indigo-500/20"
                          />
                        </div>
                      );
                    })}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Barcode / Code</label>
                        <Input 
                          placeholder="e.g. 7483920" 
                          value={formData.code}
                          onChange={(e) => setFormData({...formData, code: e.target.value})}
                        />
                      </div>
                    </div>

                    {/* Box Multi-pack packing helper */}
                    <div className="border border-slate-200 p-4 bg-slate-50/50 rounded-2xl space-y-3.5 mt-2">
                      <label className="flex items-center gap-2.5 font-bold text-xs text-slate-700 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={hasBoxPacking} 
                          onChange={(e) => setHasBoxPacking(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500/20 w-4 h-4"
                        />
                        <span>Has Box / Multi-Pack Packing?</span>
                      </label>
                      
                      {hasBoxPacking && (
                        <div className="grid grid-cols-2 gap-3.5 pt-3.5 border-t border-slate-200/60 animate-fadeIn">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Packing Name</label>
                            <Input 
                              placeholder="e.g. Box, Strip, Pack" 
                              value={boxPackingName}
                              onChange={(e) => setBoxPackingName(e.target.value)}
                              className="h-9 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pieces per Packing</label>
                            <Input 
                              type="number" 
                              placeholder="10" 
                              value={boxPackSize || ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setBoxPackSize(val);
                                if (val > 0) {
                                  setFormData(prev => ({
                                    ...prev,
                                    purchase_price_single: parseFloat((boxPurchasePrice / val).toFixed(2)) || 0,
                                    sale_price_single: parseFloat((boxSalePrice / val).toFixed(2)) || 0
                                  }));
                                }
                              }}
                              className="h-9 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Box Purchase Price (Rs)</label>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              value={boxPurchasePrice || ""}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setBoxPurchasePrice(val);
                                if (boxPackSize > 0) {
                                  setFormData(prev => ({
                                    ...prev,
                                    purchase_price_single: parseFloat((val / boxPackSize).toFixed(2)) || 0
                                  }));
                                }
                              }}
                              className="h-9 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Box Sale Price (Rs)</label>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              value={boxSalePrice || ""}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setBoxSalePrice(val);
                                if (boxPackSize > 0) {
                                  setFormData(prev => ({
                                    ...prev,
                                    sale_price_single: parseFloat((val / boxPackSize).toFixed(2)) || 0
                                  }));
                                }
                              }}
                              className="h-9 bg-white"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Box Barcode (Optional)</label>
                            <Input 
                              placeholder="e.g. 7483921" 
                              value={boxBarcode}
                              onChange={(e) => setBoxBarcode(e.target.value)}
                              className="h-9 bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Purchase Price (Rs)</label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={formData.purchase_price_single || ""}
                          onChange={(e) => setFormData({...formData, purchase_price_single: Math.max(0, parseFloat(e.target.value) || 0)})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Sale Price (Rs)</label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={formData.sale_price_single || ""}
                          onChange={(e) => setFormData({...formData, sale_price_single: Math.max(0, parseFloat(e.target.value) || 0)})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Opening Stock (Single Pieces / Base Unit)</label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={formData.current_stock || ""}
                          onChange={(e) => setFormData({...formData, current_stock: Math.max(0, parseFloat(e.target.value) || 0)})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Low Stock Alert Level</label>
                        <Input 
                          type="number" 
                          placeholder="5" 
                          value={formData.min_stock_level || ""}
                          onChange={(e) => setFormData({...formData, min_stock_level: Math.max(0, parseFloat(e.target.value) || 0)})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Catalog Options */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-blue-50 pb-2 flex items-center gap-1.5">
                      <Layers size={14} /> Catalog Options
                    </h4>

                    {/* Category with inline Quick Add */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase">Category (Optional)</label>
                        <button 
                          type="button" 
                          onClick={() => setShowCategoryQuickAdd(!showCategoryQuickAdd)}
                          className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-0.5"
                        >
                          {showCategoryQuickAdd ? "Cancel" : "Γ₧ò Quick Add"}
                        </button>
                      </div>
                      {showCategoryQuickAdd ? (
                        <div className="flex gap-2 mb-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <Input 
                            placeholder="Category name"
                            value={quickCategoryName}
                            onChange={(e) => setQuickCategoryName(e.target.value)}
                            className="h-9 bg-white"
                          />
                          <Button 
                            type="button" 
                            disabled={isSavingQuick} 
                            onClick={handleQuickAddCategory}
                            className="bg-blue-600 hover:bg-blue-700 h-9 px-4 text-white text-xs"
                          >
                            Save
                          </Button>
                        </div>
                      ) : null}
                      <select
                        value={formData.category_id}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Select Category</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Brand with inline Quick Add */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase">Company / Brand (Optional)</label>
                        <button 
                          type="button" 
                          onClick={() => setShowBrandQuickAdd(!showBrandQuickAdd)}
                          className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-0.5"
                        >
                          {showBrandQuickAdd ? "Cancel" : "Γ₧ò Quick Add"}
                        </button>
                      </div>
                      {showBrandQuickAdd ? (
                        <div className="flex gap-2 mb-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <Input 
                            placeholder="Brand/Company name"
                            value={quickBrandName}
                            onChange={(e) => setQuickBrandName(e.target.value)}
                            className="h-9 bg-white"
                          />
                          <Button 
                            type="button" 
                            disabled={isSavingQuick} 
                            onClick={handleQuickAddBrand}
                            className="bg-blue-600 hover:bg-blue-700 h-9 px-4 text-white text-xs"
                          >
                            Save
                          </Button>
                        </div>
                      ) : null}
                      <select
                        value={formData.brand_id}
                        onChange={(e) => handleBrandChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Select Brand / Company</option>
                        {brands.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                        <MapPin size={12} /> Shelf Location / Physical Address (Optional)
                      </label>
                      <Input 
                        placeholder="e.g. Shelf A, Row 3, Warehouse 1" 
                        value={formData.shelf_location}
                        onChange={(e) => setFormData({...formData, shelf_location: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                        <AlignLeft size={12} /> Product Note / Description (Optional)
                      </label>
                      <textarea
                        placeholder="e.g. Expiry warnings, batch notes, specific remarks" 
                        value={formData.note}
                        onChange={(e) => setFormData({...formData, note: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm h-[88px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                        <Image size={12} /> Product Image (تصویر)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept="image/*"
                          id="general-product-image-file"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="general-product-image-file"
                          className="px-4 py-2 border border-slate-250 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-slate-700 rounded-xl text-xs font-extrabold cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                        >
                          📷 Select Image
                        </label>
                        {formData.image_url && (
                          <div className="flex items-center gap-2">
                            <img
                              src={formData.image_url}
                              alt="Product Preview"
                              className="h-10 w-10 object-cover rounded-lg border border-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, image_url: "" }))}
                              className="text-red-500 hover:text-red-700 text-xs font-bold"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                </div>

                {/* Bottom Section: Packing Variations */}
                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Tag size={16} className="text-blue-550" /> Packing Variations & Multi-pack Barcodes
                      </h4>
                      
                    </div>
                  </div>

                  {/* Add Variation Form Card */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Packing Name</label>
                        <Input 
                          placeholder="e.g. Box, Carton" 
                          value={newVar.packing_name}
                          onChange={(e) => setNewVar({...newVar, packing_name: e.target.value})}
                          className="h-9 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Purchase Price</label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={newVar.purchase_price || ""}
                          onChange={(e) => setNewVar({...newVar, purchase_price: parseFloat(e.target.value) || 0})}
                          className="h-9 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sale Price</label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={newVar.sale_price || ""}
                          onChange={(e) => setNewVar({...newVar, sale_price: parseFloat(e.target.value) || 0})}
                          className="h-9 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Stock Qty</label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={newVar.is_packing ? Math.floor(formData.current_stock / (newVar.pack_size || 10)) : (newVar.stock_quantity || "")}
                          disabled={newVar.is_packing}
                          onChange={(e) => setNewVar({...newVar, stock_quantity: parseFloat(e.target.value) || 0})}
                          className="h-9 bg-white disabled:bg-slate-100 disabled:text-slate-500 font-bold"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Barcode / Code</label>
                        <Input 
                          placeholder="e.g. 7483921" 
                          value={newVar.barcode}
                          onChange={(e) => setNewVar({...newVar, barcode: e.target.value})}
                          className="h-9 bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200/50">
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 font-bold text-xs text-slate-700 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={newVar.is_packing} 
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setNewVar({
                                ...newVar,
                                is_packing: isChecked,
                                stock_quantity: isChecked ? Math.floor(formData.current_stock / (newVar.pack_size || 10)) : 0
                              });
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500/20 w-4 h-4"
                          />
                          <span>Is this a Packing Variation (e.g. Box/Strip)?</span>
                        </label>
                        
                        {newVar.is_packing && (
                          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Pieces per Packing:</label>
                            <Input 
                              type="number" 
                              placeholder="10" 
                              value={newVar.pack_size || ""}
                              onChange={(e) => {
                                const size = parseInt(e.target.value, 10) || 1;
                                setNewVar({
                                  ...newVar,
                                  pack_size: size,
                                  stock_quantity: Math.floor(formData.current_stock / size)
                                });
                              }}
                              className="h-8 w-20 bg-white text-xs text-center"
                            />
                          </div>
                        )}
                      </div>
                      
                      <Button 
                        type="button" 
                        onClick={handleAddVariation}
                        className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-6 font-bold"
                      >
                        Add Variation
                      </Button>
                    </div>
                  </div>

                  {/* Variations List Table */}
                  {variations.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-slate-100 text-xs">
                      No packing variations configured. Add one above.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2.5">Packing Name</th>
                            <th className="px-4 py-2.5">Barcode / Code</th>
                            <th className="px-4 py-2.5 text-right">Purchase Price</th>
                            <th className="px-4 py-2.5 text-right">Sale Price</th>
                            <th className="px-4 py-2.5 text-center">Stock</th>
                            <th className="px-4 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {variations.map((v, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="px-4 py-2.5 font-bold text-slate-800">
                                <div>
                                  <span>{v.packing_name}</span>
                                  {v.is_packing && (
                                    <span className="ml-2 bg-blue-50 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-100 uppercase">
                                      Pack: {v.pack_size} pcs
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-slate-500">{v.barcode || "ΓÇö"}</td>
                              <td className="px-4 py-2.5 text-right text-slate-600">Rs {v.purchase_price}</td>
                              <td className="px-4 py-2.5 text-right text-blue-600 font-bold">Rs {v.sale_price}</td>
                              <td className="px-4 py-2.5 text-center font-bold text-slate-700">{v.stock_quantity}</td>
                              <td className="px-4 py-2.5 text-right">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleRemoveVariation(idx)}
                                  className="text-slate-500 hover:text-red-600 hover:bg-slate-100 p-1 h-7 w-7 rounded-full"
                                >
                                  <Trash2 size={12} />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveProduct} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Product
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CSV Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Package className="text-violet-600 h-5 w-5" /> Bulk CSV Import
                </h3>
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportErrors([]);
                  }}
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 text-xs font-semibold text-slate-600">
                <div className="p-3 bg-violet-50/50 border border-violet-100 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-violet-950 font-bold">Need a starting template?</p>
                    <p className="text-[10px] text-violet-700/80 mt-0.5">Download our pre-formatted CSV template.</p>
                  </div>
                  <button
                    onClick={handleDownloadCSVTemplate}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-750 text-white rounded-lg text-[10px] font-black transition-colors"
                  >
                    📥 Download Template
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-450 uppercase">Select CSV File</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleUploadCSV}
                    disabled={importingCsv}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                </div>

                {importingCsv && (
                  <div className="flex items-center gap-2 text-violet-600 justify-center py-4">
                    <Loader2 className="animate-spin h-5 w-5" />
                    <span>Parsing and uploading products...</span>
                  </div>
                )}

                {importErrors.length > 0 && (
                  <div className="border border-red-100 bg-red-50/30 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                    <p className="text-red-700 font-bold text-[10px] uppercase">Import Failures / Errors:</p>
                    {importErrors.map((err, idx) => (
                      <p key={idx} className="text-red-600 text-[10px] leading-relaxed">• {err}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportErrors([]);
                  }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-150 text-slate-550 text-xs font-bold rounded-xl"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <ProductsPageContent />
    </React.Suspense>
  );
}
