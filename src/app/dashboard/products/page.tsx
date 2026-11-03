"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Search, Edit2, Trash2, Package, Tag, TrendingUp, 
  Layers, AlertTriangle, ArrowRight, ArrowLeft, Loader2, Save, X, PlusCircle,
  Building, MapPin, AlignLeft, Info, Globe, Image, FileUp,
  FileText, Download, Printer, Filter, SlidersHorizontal, ArrowUpDown,
  Columns3, Check, CheckSquare, RotateCcw, Pill, MoreVertical, ChevronDown, ChevronUp, BarChart3
} from "lucide-react";
import Link from "next/link";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/utils/audit";
import dynamic from "next/dynamic";
import { MobileCardList, MobileDataCard } from "@/components/mobile/MobileDataCard";
import { matchProductTokens, scoreProductMatch } from "@/utils/productSearch";

const DrugRegistryTab = dynamic(
  () => import("./components/DrugRegistryTab").then((mod) => mod.DrugRegistryTab),
  { ssr: false, loading: () => <div className="p-12 text-center flex flex-col items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" /><p className="text-sm text-slate-500 font-medium">Loading DRAP Drug Registry Database...</p></div> }
);
const KaryanaRegistryTab = dynamic(
  () => import("./components/KaryanaRegistryTab").then((mod) => mod.KaryanaRegistryTab),
  { ssr: false, loading: () => <div className="p-12 text-center flex flex-col items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" /><p className="text-sm text-slate-500 font-medium">Loading Karyana Registry...</p></div> }
);
const GeneralRegistryTab = dynamic(
  () => import("./components/GeneralRegistryTab").then((mod) => mod.GeneralRegistryTab),
  { ssr: false, loading: () => <div className="p-12 text-center flex flex-col items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" /><p className="text-sm text-slate-500 font-medium">Loading General Registry...</p></div> }
);
const ElectronicsRegistryTab = dynamic(
  () => import("./components/ElectronicsRegistryTab").then((mod) => mod.ElectronicsRegistryTab),
  { ssr: false, loading: () => <div className="p-12 text-center flex flex-col items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" /><p className="text-sm text-slate-500 font-medium">Loading Electronics Registry...</p></div> }
);
const ProductExportReportModal = dynamic(
  () => import("./components/ProductExportReportModal").then((mod) => mod.ProductExportReportModal),
  { ssr: false }
);
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { withOfflineRead, isBrowserOffline } from "@/lib/sync/offlineData";
import { pushToSyncQueue } from "@/utils/syncQueue";
import { isControlledDrug } from "@/lib/pharmacy/controlledDrugs";

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
  measurement_type?: string | null;
  warranty?: string | null;
  translated_names?: any;
  has_imei?: boolean | null;
  formulation_id?: string | null;
  formulations?: any;
  is_ingredient?: boolean | null;
};

type Category = {
  id: string;
  name: string;
};

type Brand = {
  id: string;
  name: string;
};

type Formulation = {
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
  is_packing: boolean;
  pack_size: number;
};

function ProductsPageContent() {
  const { shopId, userId, industryType, activeLanguages, shopName, selectedCurrency } = useShop();
  const supabase = createClient();

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [formulations, setFormulations] = useState<Formulation[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"products" | "categories" | "brands" | "master-drugs" | "master-karyana" | "master-general" | "master-electronics">("products");
  const [productsPage, setProductsPage] = useState(1);
  const productsPerPage = 25;
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [formTranslations, setFormTranslations] = useState<Record<string, string>>({});

  // Export & Report Modal State
  const [isExportReportModalOpen, setIsExportReportModalOpen] = useState(false);

  // Advanced Table Filters & Column State
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterStockStatus, setFilterStockStatus] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "stock_desc" | "stock_asc" | "price_desc" | "cost_desc">("name_asc");
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  
  // Mobile Responsive States
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileStats, setShowMobileStats] = useState(true);
  const [showMobileToolsMenu, setShowMobileToolsMenu] = useState(false);

  // UI Table Column Visibility
  const [visibleColumns, setVisibleColumns] = useState({
    code: true,
    category: true,
    brand: true,
    purchasePrice: true,
    salePrice: true,
    stock: true,
    shelfLocation: false,
    actions: true,
  });

  // CSV Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  useEffect(() => {
    if (
      tabParam === "categories" ||
      tabParam === "brands" ||
      tabParam === "products" ||
      tabParam === "master-drugs" ||
      tabParam === "master-karyana" ||
      tabParam === "master-general" ||
      tabParam === "master-electronics"
    ) {
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

  // Formulation Modals & Forms State
  const [isFormulationModalOpen, setIsFormulationModalOpen] = useState(false);
  const [editingFormulation, setEditingFormulation] = useState<Formulation | null>(null);
  const [formulationName, setFormulationName] = useState("");
  const [isSubmittingFormulation, setIsSubmittingFormulation] = useState(false);

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
    measurement_type: "standard",
    warranty: "",
    has_imei: false,
    formulation_id: "",
    image_url: ""
  });

  // IMEI Management State
  const [isImeiModalOpen, setIsImeiModalOpen] = useState(false);
  const [productImeis, setProductImeis] = useState<any[]>([]);
  const [newImei1, setNewImei1] = useState("");
  const [newImei2, setNewImei2] = useState("");

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

  // Garments Sizing-Color Grid Matrix Builder States
  const [matrixSizes, setMatrixSizes] = useState("S, M, L, XL");
  const [matrixColors, setMatrixColors] = useState("Black, Blue, White");
  const [matrixPurchasePrice, setMatrixPurchasePrice] = useState(0);
  const [matrixSalePrice, setMatrixSalePrice] = useState(0);
  const [matrixStock, setMatrixStock] = useState(0);

  const handleGenerateGarmentsMatrix = () => {
    const sizes = matrixSizes.split(",").map(s => s.trim()).filter(Boolean);
    const colors = matrixColors.split(",").map(c => c.trim()).filter(Boolean);

    if (sizes.length === 0 || colors.length === 0) {
      toast.error("Please enter sizes and colors to generate.");
      return;
    }

    const newVars: VariationState[] = [];
    sizes.forEach(size => {
      colors.forEach(color => {
        newVars.push({
          packing_name: `${size} - ${color}`,
          purchase_price: matrixPurchasePrice || formData.purchase_price_single || 0,
          sale_price: matrixSalePrice || formData.sale_price_single || 0,
          stock_quantity: matrixStock || 0,
          barcode: "",
          is_packing: false,
          pack_size: 1
        });
      });
    });

    setVariations(prev => [...prev, ...newVars]);
    toast.success(`Successfully generated and added ${newVars.length} size-color matrix variants! ⚡`);
  };

  // Bulk Packing Helper State (Gatta / Bori / Box)
  const [hasBoxPacking, setHasBoxPacking] = useState(false);
  const [boxPackingName, setBoxPackingName] = useState(industryType === "pharmacy" ? "Box" : (industryType === "tailor" ? "Roll" : "Carton"));
  const [boxPackSize, setBoxPackSize] = useState(50);
  const [boxPurchasePrice, setBoxPurchasePrice] = useState(0);
  const [boxSalePrice, setBoxSalePrice] = useState(0);
  const [boxBarcode, setBoxBarcode] = useState("");

  // Quick Add State
  const [showCategoryQuickAdd, setShowCategoryQuickAdd] = useState(false);
  const [showBrandQuickAdd, setShowBrandQuickAdd] = useState(false);
  const [showFormulationQuickAdd, setShowFormulationQuickAdd] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [quickBrandName, setQuickBrandName] = useState("");
  const [quickFormulationName, setQuickFormulationName] = useState("");
  const [isSavingQuick, setIsSavingQuick] = useState(false);

  // Restaurant-specific: dynamic pricing flag
  const [isDynamicPricing, setIsDynamicPricing] = useState(false);
  // Restaurant-specific: inventory tracking flag
  const [isInventoryManaged, setIsInventoryManaged] = useState(false);
  // Restaurant-specific: raw ingredient flag
  const [isIngredient, setIsIngredient] = useState(false);

  useEffect(() => {
    const loadAllData = async () => {
      if (!shopId) return;
      setLoading(true);
      try {
        await Promise.all([
          fetchProducts(),
          fetchCategories(),
          fetchBrands(),
          fetchUnits(),
          industryType === "pharmacy" ? fetchFormulations() : Promise.resolve()
        ]);
      } catch (err) {
        console.error("Error fetching products screen dependencies:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, [shopId]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await withOfflineRead({
        shopId: shopId!,
        online: async () => {
          let allData: any[] = [];
          let page = 0;
          const pageSize = 1000;

          while (true) {
            let { data, error } = await supabase
              .from("products")
              .select(`
                id, name, code, unit, sale_price_single, purchase_price_single, current_stock, min_stock_level, category_id, brand_id, shelf_location, note, image_url, pack_size, purchase_price_pack, sale_price_pack, measurement_type, warranty, has_imei, is_ingredient, translated_names,
                categories ( name ),
                brands ( name ),
                formulations ( name )
              `)
              .eq("shop_id", shopId)
              .order("created_at", { ascending: false })
              .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
              if (error.message.includes("is_ingredient") || error.hint?.includes("is_ingredient")) {
                let fallbackData: any[] = [];
                let fallbackPage = 0;
                while (true) {
                  const fallback = await supabase
                    .from("products")
                    .select(`
                      id, name, code, unit, sale_price_single, purchase_price_single, current_stock, min_stock_level, category_id, brand_id, shelf_location, note, image_url, pack_size, purchase_price_pack, sale_price_pack, measurement_type, warranty, has_imei, translated_names,
                      categories ( name ),
                      brands ( name ),
                      formulations ( name )
                    `)
                    .eq("shop_id", shopId)
                    .order("created_at", { ascending: false })
                    .range(fallbackPage * pageSize, (fallbackPage + 1) * pageSize - 1);

                  if (fallback.error) throw fallback.error;
                  fallbackData.push(...(fallback.data || []));
                  if ((fallback.data || []).length < pageSize) break;
                  fallbackPage++;
                }
                return fallbackData.map((p: any) => ({ ...p, is_ingredient: false }));
              }
              throw error;
            }

            allData.push(...(data || []));
            if ((data || []).length < pageSize) break;
            page++;
          }
          return allData;
        },
        offline: (snap) => snap.products,
        onOfflineUsed: (savedAt) => {
          toast.message("Offline mode - showing cached products", {
            description: savedAt ? `Last synced ${new Date(savedAt).toLocaleString()}` : undefined,
          });
        },
      });

      setProducts(data);
    } catch (err: any) {
      toast.error("Failed to load products: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await withOfflineRead({
        shopId: shopId!,
        online: async () => {
          const { data, error } = await supabase
            .from("categories")
            .select("id, name")
            .eq("shop_id", shopId)
            .order("name", { ascending: true });
          if (error) throw error;
          return data || [];
        },
        offline: (snap) => snap.categories,
      });
      setCategories(data);
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

  const fetchFormulations = async () => {
    try {
      const { data, error } = await supabase
        .from("formulations")
        .select("id, name")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (error) throw error;
      setFormulations(data || []);
    } catch (err: any) {
      console.error("Failed to load formulations: ", err.message);
    }
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

  const handleAddDemoData = async () => {
    const toastId = toast.loading("Creating restaurant demo data...");
    try {
      // 1. Categories
      const { data: catData, error: catErr } = await supabase
        .from("categories")
        .insert([
          { shop_id: shopId, name: "Main Course" },
          { shop_id: shopId, name: "Fast Food" },
          { shop_id: shopId, name: "Beverages" },
          { shop_id: shopId, name: "Desserts" },
          { shop_id: shopId, name: "Raw Materials" }
        ])
        .select();

      if (catErr) throw catErr;

      const mainCourse = catData?.find((c: any) => c.name.startsWith("Main"));
      const fastFood = catData?.find((c: any) => c.name.startsWith("Fast"));
      const beverages = catData?.find((c: any) => c.name.startsWith("Bev"));
      const desserts = catData?.find((c: any) => c.name.startsWith("Dess"));
      const rawMaterials = catData?.find((c: any) => c.name.startsWith("Raw"));

      // 2. Products
      const productsToInsert = [
        { shop_id: shopId, name: "Chicken Biryani (Plate)", sale_price_single: 280, purchase_price_single: 120, category_id: mainCourse?.id, is_ingredient: false, unit: null },
        { shop_id: shopId, name: "Chicken Karahi (KG)", sale_price_single: 1400, purchase_price_single: 700, category_id: mainCourse?.id, is_ingredient: false, unit: null },
        { shop_id: shopId, name: "Roti (Nan)", sale_price_single: 15, purchase_price_single: 6, category_id: mainCourse?.id, is_ingredient: false, unit: null },
        { shop_id: shopId, name: "Daal Fry (Plate)", sale_price_single: 0, purchase_price_single: 60, category_id: mainCourse?.id, note: "DYNAMIC_PRICE", is_ingredient: false, unit: null },
        { shop_id: shopId, name: "Mineral Water (1.5L)", sale_price_single: 90, purchase_price_single: 65, current_stock: 48, min_stock_level: 10, category_id: beverages?.id, is_ingredient: false, unit: "btl" },
        { shop_id: shopId, name: "Coca-Cola (Can)", sale_price_single: 120, purchase_price_single: 90, current_stock: 72, min_stock_level: 15, category_id: beverages?.id, is_ingredient: false, unit: "can" },
        // Raw Materials
        { shop_id: shopId, name: "Chicken Meat (Raw)", sale_price_single: 0, purchase_price_single: 680, current_stock: 25, min_stock_level: 5, category_id: rawMaterials?.id, is_ingredient: true, unit: "kg", note: "RAW_INGREDIENT" },
        { shop_id: shopId, name: "Wheat Flour (Atta)", sale_price_single: 0, purchase_price_single: 130, current_stock: 150, min_stock_level: 20, category_id: rawMaterials?.id, is_ingredient: true, unit: "kg", note: "RAW_INGREDIENT" },
        { shop_id: shopId, name: "Cooking Oil (Sufi)", sale_price_single: 0, purchase_price_single: 420, current_stock: 80, min_stock_level: 10, category_id: rawMaterials?.id, is_ingredient: true, unit: "ltr", note: "RAW_INGREDIENT" },
        { shop_id: shopId, name: "Basmati Rice", sale_price_single: 0, purchase_price_single: 310, current_stock: 100, min_stock_level: 25, category_id: rawMaterials?.id, is_ingredient: true, unit: "kg", note: "RAW_INGREDIENT" }
      ];

      const { error: prodErr } = await supabase.from("products").insert(productsToInsert);
      
      if (prodErr) {
        if (prodErr.message.includes("is_ingredient") || prodErr.hint?.includes("is_ingredient")) {
          const cleanMenuProducts = productsToInsert
            .filter(p => !p.is_ingredient)
            .map(p => {
              const { is_ingredient, ...rest } = p;
              return rest;
            });
          
          const { error: retryErr } = await supabase.from("products").insert(cleanMenuProducts);
          if (retryErr) throw retryErr;
        } else {
          throw prodErr;
        }
      }

      // 3. Restaurant Tables
      const tablesToInsert = [
        { shop_id: shopId, name: "Table 1", capacity: 4, status: "available" },
        { shop_id: shopId, name: "Table 2", capacity: 2, status: "available" },
        { shop_id: shopId, name: "Table 3", capacity: 4, status: "available" },
        { shop_id: shopId, name: "Table 4", capacity: 6, status: "available" },
        { shop_id: shopId, name: "VIP Room 1", capacity: 8, status: "available" }
      ];
      await supabase.from("restaurant_tables").insert(tablesToInsert);

      // 4. Suppliers
      const suppliersToInsert = [
        { shop_id: shopId, name: "Sufi Poultry Supplier", phone: "03001234567", type: "supplier", current_balance: 0 },
        { shop_id: shopId, name: "Metro Cash & Carry", phone: "03117654321", type: "supplier", current_balance: 0 },
        { shop_id: shopId, name: "Karyana Wholesale Bazar", phone: "03229876543", type: "supplier", current_balance: 0 }
      ];
      await supabase.from("parties").insert(suppliersToInsert);

      toast.dismiss(toastId);
      toast.success("Restaurant demo data added successfully!");
      fetchProducts();
      fetchCategories();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error("Failed to add demo data: " + err.message);
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
      measurement_type: "standard",
      warranty: "",
      has_imei: false,
      formulation_id: "",
      image_url: ""
    });
    setProductImeis([]);
    setVariations([]);
    setNewVar({ packing_name: "", purchase_price: 0, sale_price: 0, stock_quantity: 0, barcode: "", is_packing: false, pack_size: 10 });
    setHasBoxPacking(false);
    setBoxPackingName(industryType === "pharmacy" ? "Box" : (industryType === "tailor" ? "Roll" : "Carton"));
    setBoxPackSize(50);
    setBoxPurchasePrice(0);
    setBoxSalePrice(0);
    setBoxBarcode("");
    setFormTranslations({});
    // Reset restaurant-specific flags
    setIsDynamicPricing(false);
    setIsInventoryManaged(false);
    setIsIngredient(false);
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
      min_stock_level: product.min_stock_level || 0,
      category_id: product.category_id || "",
      brand_id: product.brand_id || "",
      shelf_location: product.shelf_location || "",
      note: decodedNote,
      measurement_type: product.measurement_type || "standard",
      warranty: product.warranty || "",
      has_imei: product.has_imei || false,
      formulation_id: product.formulation_id || "",
      image_url: product.image_url || ""
    });
    
    // Fetch product IMEIs if editing
    try {
      const { data: imeiData, error: imeiError } = await supabase
        .from("product_imeis")
        .select("*")
        .eq("product_id", product.id);
      if (imeiError) throw imeiError;
      setProductImeis(imeiData || []);
    } catch (err: any) {
      console.error("Failed to load product IMEIs: ", err.message);
      setProductImeis([]);
    }
    setHasBoxPacking(hasPack);
    setBoxPackSize(product.pack_size || 50);
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
        setVariations(mapped.filter(v => !(v.is_packing && hasPack)));

        // Load box packing name from variants
        const boxVar = mapped.find(v => v.is_packing && hasPack);
        if (boxVar) {
          setBoxBarcode(""); // barcode from variant
          const match = boxVar.packing_name.match(/^([^(]+)/);
          setBoxPackingName(match ? match[1].trim() : (industryType === "pharmacy" ? "Box" : (industryType === "tailor" ? "Roll" : "Carton")));
        } else {
          setBoxPackingName(industryType === "pharmacy" ? "Box" : (industryType === "tailor" ? "Roll" : "Carton"));
          setBoxBarcode("");
        }
      } else {
        setVariations([]);
        setBoxPackingName(industryType === "pharmacy" ? "Box" : (industryType === "tailor" ? "Roll" : "Carton"));
        setBoxBarcode("");
      }
    } catch (err: any) {
      console.error("Failed to load variations: ", err.message);
      setVariations([]);
      setBoxPackingName(industryType === "pharmacy" ? "Box" : (industryType === "tailor" ? "Roll" : "Carton"));
      setBoxBarcode("");
    }

    // Restore restaurant-specific flags from product data
    if (industryType === "restaurant") {
      const isDynamic = product.note === "DYNAMIC_PRICE";
      setIsDynamicPricing(isDynamic);
      // If product has unit or positive stock - it was inventory managed
      const hasInventory = !!(product.unit && product.unit !== "") || (product.current_stock > 0);
      setIsInventoryManaged(hasInventory);
      setIsIngredient(!!product.is_ingredient);
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
      ? `${newVar.packing_name} (${newVar.pack_size} ${formData.unit || 'pcs'})`
      : newVar.packing_name;
    setVariations([
      ...variations,
      { ...newVar, stock_quantity: finalStock, packing_name: formattedName }
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
      let noteVal = (industryType === "restaurant" && isIngredient) 
        ? "RAW_INGREDIENT" 
        : (industryType === "restaurant" && isDynamicPricing ? "DYNAMIC_PRICE" : formData.note || null);

      const stockToSave = formData.has_imei
        ? productImeis.filter((i: any) => i.status !== "sold").length
        : formData.current_stock;

      const dbPayload = {
        shop_id: shopId,
        name: formData.name,
        code: formData.code || null,
        unit: (industryType === "restaurant" && !isInventoryManaged) ? null : (formData.unit || null),
        purchase_price_single: formData.purchase_price_single,
        sale_price_single: (industryType === "restaurant" && isIngredient) ? 0 : formData.sale_price_single,
        current_stock: stockToSave,
        min_stock_level: formData.min_stock_level,
        category_id: formData.category_id || null,
        brand_id: formData.brand_id || null,
        shelf_location: formData.shelf_location || null,
        note: noteVal,
        image_url: formData.image_url || null,
        translated_names: formTranslations,
        pack_size: hasBoxPacking ? boxPackSize : null,
        purchase_price_pack: hasBoxPacking ? boxPurchasePrice : null,
        sale_price_pack: hasBoxPacking ? boxSalePrice : null,
        measurement_type: formData.measurement_type,
        warranty: formData.warranty || null,
        has_imei: formData.has_imei || false,
        formulation_id: formData.formulation_id || null,
        is_ingredient: industryType === "restaurant" ? isIngredient : false
      };

      let productId = "";

      if (isBrowserOffline()) {
        productId = editingProduct?.id || crypto.randomUUID();
        await pushToSyncQueue(
          editingProduct ? "UPDATE" : "INSERT",
          "products",
          { ...dbPayload, id: productId },
          shopId!,
          `${editingProduct ? "Update" : "New"} product: ${formData.name}`
        );
        toast.success("Product saved offline - will sync when online");
        setIsModalOpen(false);
        fetchProducts();
        setIsSubmitting(false);
        return;
      }

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(dbPayload)
          .eq("id", editingProduct.id);
        if (error) throw error;
        productId = editingProduct.id;
        toast.success("Product updated successfully!");
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert(dbPayload)
          .select()
          .single();
        if (error) throw error;
        productId = data.id;
        toast.success("Product added successfully!");
      }

      // Sync IMEI records
      if (formData.has_imei) {
        const { data: dbImeis } = await supabase
          .from("product_imeis")
          .select("id, imei1, imei2, status")
          .eq("product_id", productId);

        const dbImeiIds = (dbImeis || []).map((i: any) => i.id);
        const localImeiIds = productImeis.filter((i: any) => i.id).map((i: any) => i.id);

        // IMEIs in DB but missing in local state: delete (only if 'available')
        const toDeleteIds = (dbImeis || [])
          .filter((i: any) => i.status === "available" && !localImeiIds.includes(i.id))
          .map((i: any) => i.id);

        if (toDeleteIds.length > 0) {
          await supabase.from("product_imeis").delete().in("id", toDeleteIds);
        }

        // New IMEIs to insert (no id)
        const toInsert = productImeis
          .filter((i: any) => !i.id)
          .map((i: any) => ({
            product_id: productId,
            shop_id: shopId,
            imei1: i.imei1,
            imei2: i.imei2 || null,
            status: "available"
          }));

        if (toInsert.length > 0) {
          const { error: insertImeiError } = await supabase
            .from("product_imeis")
            .insert(toInsert);
          if (insertImeiError) throw insertImeiError;
        }
      } else {
        // Delete all available IMEIs for this product if disabled
        await supabase
          .from("product_imeis")
          .delete()
          .eq("product_id", productId)
          .eq("status", "available");
      }

      // Delete existing variations before re-inserting
      if (editingProduct) {
        await supabase.from("product_variants").delete().eq("product_id", productId);
      }

      // Build final variations list - inject box packing if checked
      let finalVariations = [...variations];
      if (hasBoxPacking && boxPackSize > 0) {
        const boxVarName = `${boxPackingName} (${boxPackSize} ${formData.unit || 'pcs'})`;
        const boxStock = Math.floor(formData.current_stock / boxPackSize);
        finalVariations.push({
          packing_name: boxVarName,
          purchase_price: boxPurchasePrice,
          sale_price: boxSalePrice,
          stock_quantity: boxStock,
          barcode: boxBarcode,
          is_packing: true,
          pack_size: boxPackSize
        });
      }

      // Insert all variations
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

        if (variant.barcode && insertedVar) {
          await supabase.from("product_barcodes").insert({
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

  const handleQuickAddFormulation = async () => {
    if (!quickFormulationName) return;
    setIsSavingQuick(true);
    try {
      const { data, error } = await supabase
        .from("formulations")
        .insert({ shop_id: shopId, name: quickFormulationName })
        .select()
        .single();
      if (error) throw error;
      toast.success("Formulation added!");
      setFormulations([...formulations, data]);
      setFormData(prev => ({ ...prev, formulation_id: data.id }));
      setQuickFormulationName("");
      setShowFormulationQuickAdd(false);
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

  const filteredProducts = products.filter(p => {
    // 1. Multi-token Search Query Filter (Name, Barcode/SKU, Shelf Location, Category, Brand, Variants, IMEIs)
    if (searchQuery.trim()) {
      if (!matchProductTokens(p, searchQuery)) {
        return false;
      }
    }

    // 2. Category Filter
    if (filterCategory !== "all") {
      if (p.category_id !== filterCategory) return false;
    }

    // 3. Brand Filter
    if (filterBrand !== "all") {
      if (p.brand_id !== filterBrand) return false;
    }

    // 4. Stock Status Filter
    const stock = Number(p.current_stock) || 0;
    const minStock = Number(p.min_stock_level) || 0;
    if (filterStockStatus === "in_stock" && stock <= 0) return false;
    if (filterStockStatus === "out_of_stock" && stock > 0) return false;
    if (filterStockStatus === "low_stock" && (stock > minStock || stock <= 0)) return false;

    return true;
  }).sort((a, b) => {
    if (searchQuery.trim() && sortBy === "name_asc") {
      return scoreProductMatch(b, searchQuery) - scoreProductMatch(a, searchQuery);
    }
    if (sortBy === "name_asc") return a.name.localeCompare(b.name);
    if (sortBy === "name_desc") return b.name.localeCompare(a.name);
    if (sortBy === "stock_desc") return (b.current_stock || 0) - (a.current_stock || 0);
    if (sortBy === "stock_asc") return (a.current_stock || 0) - (b.current_stock || 0);
    if (sortBy === "price_desc") return (b.sale_price_single || 0) - (a.sale_price_single || 0);
    if (sortBy === "cost_desc") return (b.purchase_price_single || 0) - (a.purchase_price_single || 0);
    return 0;
  });

  const paginatedProducts = filteredProducts.slice(
    (productsPage - 1) * productsPerPage,
    productsPage * productsPerPage
  );
  const totalProductsPages = Math.ceil(filteredProducts.length / productsPerPage);

  // Statistics
  const totalItems = products.length;
  const outOfStockItems = products.filter(p => p.current_stock <= 0).length;
  const totalStockQuantity = products.reduce((acc, p) => acc + (Number(p.current_stock) || 0), 0);
  const lowStockItems = products.filter(p => p.current_stock > 0 && p.current_stock <= p.min_stock_level).length;
  const inventoryValue = products.reduce((acc, p) => acc + ((p.purchase_price_single || (p as any).base_price || 0) * p.current_stock), 0);
  const estimatedSaleValue = products.reduce((acc, p) => acc + ((p.sale_price_single || 0) * p.current_stock), 0);

  return (
    <div className="space-y-3 font-sans pb-28 sm:pb-12">
      {/* Showroom Industry Quick Switch Banner */}
      {industryType === "showroom" && (
        <div className="mb-2 p-4 rounded-2xl bg-gradient-to-r from-violet-950 via-slate-900 to-indigo-950 border border-violet-700/50 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-600/30 text-violet-300 border border-violet-500/30">
              <Package size={20} />
            </div>
            <div>
              <p className="text-sm font-bold">Automotive Showroom Inventory Mode Active (گاڑیوں کا اسٹاک)</p>
              <p className="text-xs text-slate-300">
                To manage cars, motorcycles, chassis numbers, engine numbers, photos, and legal documents, use the dedicated Showroom Vehicles Master.
              </p>
            </div>
          </div>
          <Link href="/dashboard/showroom/vehicles">
            <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shrink-0 rounded-xl cursor-pointer">
              Go to Showroom Vehicles Stock →
            </Button>
          </Link>
        </div>
      )}
      
      {/* Header & Main Toolbar */}
      <div className="flex flex-col gap-2.5 border-b border-slate-200/80 pb-2.5">
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {activeTab === "products" && (
              <>
                {/* Desktop Action Buttons */}
                <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                  {(industryType === "pharmacy" || industryType === "medical" || industryType === "health") && (
                    <Button 
                      onClick={() => setActiveTab("master-drugs")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs px-2.5 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1.5"
                      title="Search & Import from DRAP Master Medicines Database"
                    >
                      <Pill className="mr-1 h-3.5 w-3.5" /> Drug Directory
                    </Button>
                  )}

                  <Button 
                    onClick={() => setIsExportReportModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 text-xs px-2.5 rounded-lg shadow-2xs cursor-pointer"
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5" /> PDF / Report
                  </Button>

                  <Link href="/dashboard/settings/migration">
                    <Button 
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold h-8 text-xs px-2.5 rounded-lg shadow-2xs cursor-pointer"
                    >
                      <FileUp className="mr-1.5 h-3.5 w-3.5" /> Data Migration
                    </Button>
                  </Link>

                  <Button 
                    onClick={handleTranslateAllProducts} 
                    disabled={isTranslatingAll}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold h-8 text-xs px-2.5 rounded-lg shadow-2xs cursor-pointer"
                  >
                    {isTranslatingAll ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Globe className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    AI Translate
                  </Button>

                  <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-xs px-2.5 rounded-lg shadow-2xs cursor-pointer">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> {industryType === "restaurant" ? "Add Item" : (industryType === "tailor" ? "Add Material" : "Add Product")}
                  </Button>
                </div>

                {/* Mobile Quick Action Dropdown + Add Button */}
                <div className="flex sm:hidden items-center gap-1.5">
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMobileToolsMenu(!showMobileToolsMenu)}
                      className="h-8 w-8 p-0 text-slate-600 border-slate-200 rounded-lg cursor-pointer"
                      title="More actions"
                    >
                      <MoreVertical size={16} />
                    </Button>
                    {showMobileToolsMenu && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-40 space-y-1">
                        {(industryType === "pharmacy" || industryType === "medical" || industryType === "health") && (
                          <button
                            onClick={() => { setActiveTab("master-drugs"); setShowMobileToolsMenu(false); }}
                            className="w-full text-left px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 rounded-lg flex items-center gap-2 cursor-pointer"
                          >
                            <Pill size={14} className="text-emerald-600" /> Drug Directory
                          </button>
                        )}
                        <button
                          onClick={() => { setIsExportReportModalOpen(true); setShowMobileToolsMenu(false); }}
                          className="w-full text-left px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 rounded-lg flex items-center gap-2 cursor-pointer"
                        >
                          <FileText size={14} className="text-indigo-600" /> PDF / Report
                        </button>
                        <Link href="/dashboard/settings/migration" onClick={() => setShowMobileToolsMenu(false)} className="block">
                          <button className="w-full text-left px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-purple-50 rounded-lg flex items-center gap-2 cursor-pointer">
                            <FileUp size={14} className="text-purple-600" /> Data Migration
                          </button>
                        </Link>
                        <button
                          onClick={() => { handleTranslateAllProducts(); setShowMobileToolsMenu(false); }}
                          disabled={isTranslatingAll}
                          className="w-full text-left px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-teal-50 rounded-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          <Globe size={14} className="text-teal-600" /> AI Translate
                        </button>
                      </div>
                    )}
                  </div>

                  <Button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold h-8 text-xs px-3 rounded-lg shadow-sm cursor-pointer flex items-center gap-1">
                    <Plus size={15} /> Add
                  </Button>
                </div>
              </>
            )}

            {activeTab.startsWith("master-") && (
              <Button 
                onClick={() => setActiveTab("products")} 
                variant="outline"
                className="bg-white hover:bg-slate-50 border-slate-200 text-slate-800 font-bold h-8 text-xs px-3 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
              </Button>
            )}

            {activeTab === "categories" && (
              <Button onClick={() => { setEditingCategory(null); setCategoryName(""); setIsCategoryModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-xs px-3 rounded-lg shadow-2xs cursor-pointer">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Category
              </Button>
            )}

            {activeTab === "brands" && (
              <Button onClick={() => { setEditingBrand(null); setBrandName(""); setIsBrandModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-xs px-3 rounded-lg shadow-2xs cursor-pointer">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Brand
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar & Mobile Filter Toggles */}
        {activeTab === "products" && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input 
                placeholder={
                  industryType === "tailor" ? "Search materials, code..." : "Search products, barcode, brand..."
                } 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-8 h-8.5 w-full text-xs bg-white border-slate-200 rounded-xl shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Mobile Filter Button */}
            <button
              type="button"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`sm:hidden flex items-center gap-1 px-2.5 h-8.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                filterCategory !== "all" || filterBrand !== "all" || filterStockStatus !== "all"
                  ? "bg-blue-50 border-blue-300 text-blue-700 shadow-xs"
                  : "bg-white border-slate-200 text-slate-700"
              }`}
            >
              <Filter size={13} />
              <div>Filters</div>
              {(filterCategory !== "all" || filterBrand !== "all" || filterStockStatus !== "all") && (
                <div className="w-2 h-2 rounded-full bg-blue-600 ml-0.5 animate-pulse" />
              )}
            </button>

            {/* Stats Toggle Button (Mobile) */}
            <button
              type="button"
              onClick={() => setShowMobileStats(!showMobileStats)}
              className={`sm:hidden flex items-center justify-center h-8.5 w-8.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showMobileStats ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-white border-slate-200 text-slate-400"
              }`}
              title="Toggle Stats Banner"
            >
              <BarChart3 size={14} />
            </button>
          </div>
        )}

        {activeTab === "categories" && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input 
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8.5 w-full sm:w-[260px] text-xs bg-white border-slate-200 rounded-xl shadow-2xs"
            />
          </div>
        )}

        {activeTab === "brands" && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input 
              placeholder="Search brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8.5 w-full sm:w-[260px] text-xs bg-white border-slate-200 rounded-xl shadow-2xs"
            />
          </div>
        )}
      </div>

      {/* Tab Panel: Drug Registry */}
      {activeTab === "master-drugs" && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6">
          <DrugRegistryTab
            shopId={shopId || ""}
            categories={categories}
            onRefresh={fetchProducts}
          />
        </div>
      )}

      {/* Tab Panel: Karyana Registry */}
      {activeTab === "master-karyana" && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6">
          <KaryanaRegistryTab
            shopId={shopId || ""}
            categories={categories}
            onRefresh={fetchProducts}
          />
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

      {/* Tab Panel: Electronics Registry */}
      {activeTab === "master-electronics" && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6">
          <ElectronicsRegistryTab
            shopId={shopId || ""}
            categories={categories}
            onRefresh={fetchProducts}
          />
        </div>
      )}

      {/* Tab Panel: Products */}
      {activeTab === "products" && (
        <>
          {/* Quick Stats Ribbon: Swipeable on mobile, Grid on desktop */}
          {showMobileStats && (
            <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-2 overflow-x-auto no-scrollbar snap-x pb-1 -mx-1 px-1 sm:mx-0 sm:px-0">
              <div className="snap-start shrink-0 w-[140px] sm:w-auto bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3">
                <div className="h-8 w-8 sm:h-9 sm:w-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 shrink-0">
                  <Package size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[9.5px] font-bold text-slate-400 uppercase truncate">Total Items</p>
                  <p className="text-sm sm:text-base font-black text-slate-900 leading-tight">{totalItems}</p>
                  <p className="text-[8.5px] sm:text-[9px] font-bold text-blue-600 truncate">{totalStockQuantity.toLocaleString()} Units</p>
                </div>
              </div>

              <div className="snap-start shrink-0 w-[140px] sm:w-auto bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3">
                <div className="h-8 w-8 sm:h-9 sm:w-9 bg-red-50 text-red-600 rounded-xl flex items-center justify-center border border-red-100 shrink-0">
                  <AlertTriangle size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[9.5px] font-bold text-slate-400 uppercase truncate">Out of Stock</p>
                  <p className="text-sm sm:text-base font-black text-slate-900 leading-tight">{outOfStockItems}</p>
                  <p className="text-[8.5px] sm:text-[9px] font-bold text-red-500">Zero Qty</p>
                </div>
              </div>

              <div className="snap-start shrink-0 w-[140px] sm:w-auto bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3">
                <div className="h-8 w-8 sm:h-9 sm:w-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100 shrink-0">
                  <AlertTriangle size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[9.5px] font-bold text-slate-400 uppercase truncate">Low Stock</p>
                  <p className="text-sm sm:text-base font-black text-slate-900 leading-tight">{lowStockItems}</p>
                  <p className="text-[8.5px] sm:text-[9px] font-bold text-amber-600">Reorder Soon</p>
                </div>
              </div>

              <div className="snap-start shrink-0 w-[150px] sm:w-auto bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3">
                <div className="h-8 w-8 sm:h-9 sm:w-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100 shrink-0">
                  <Tag size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[9.5px] font-bold text-slate-400 uppercase truncate">Cost Value</p>
                  <p className="text-sm sm:text-base font-black text-slate-900 leading-tight truncate">Rs {Math.round(inventoryValue).toLocaleString()}</p>
                  <p className="text-[8.5px] sm:text-[9px] font-bold text-slate-400">Total Purchase</p>
                </div>
              </div>

              <div className="snap-start shrink-0 w-[150px] sm:w-auto bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5 sm:gap-3">
                <div className="h-8 w-8 sm:h-9 sm:w-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 shrink-0">
                  <TrendingUp size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[9.5px] font-bold text-slate-400 uppercase truncate">Sale Value</p>
                  <p className="text-sm sm:text-base font-black text-indigo-700 leading-tight truncate">Rs {Math.round(estimatedSaleValue).toLocaleString()}</p>
                  <p className="text-[8.5px] sm:text-[9px] font-bold text-emerald-600">Retail Potential</p>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Collapsible Filter Drawer */}
          {showMobileFilters && (
            <div className="sm:hidden bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <Filter size={13} className="text-blue-600" /> Filter & Sort
                </div>
                {(filterCategory !== "all" || filterBrand !== "all" || filterStockStatus !== "all" || searchQuery.trim() !== "") && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterCategory("all");
                      setFilterBrand("all");
                      setFilterStockStatus("all");
                      setSearchQuery("");
                      setProductsPage(1);
                    }}
                    className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={10} /> Reset All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => { setFilterCategory(e.target.value); setProductsPage(1); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 text-xs focus:outline-none"
                  >
                    <option value="all">All Categories ({categories.length})</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {industryType !== "restaurant" && (
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Brand</label>
                    <select
                      value={filterBrand}
                      onChange={(e) => { setFilterBrand(e.target.value); setProductsPage(1); }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 text-xs focus:outline-none"
                    >
                      <option value="all">All Brands ({brands.length})</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Stock Status</label>
                  <select
                    value={filterStockStatus}
                    onChange={(e) => { setFilterStockStatus(e.target.value as any); setProductsPage(1); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 text-xs focus:outline-none"
                  >
                    <option value="all">All Stock Status</option>
                    <option value="in_stock">In Stock (&gt;0)</option>
                    <option value="low_stock">Low Stock (≤ Reorder)</option>
                    <option value="out_of_stock">Out of Stock (0 Qty)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 text-xs focus:outline-none"
                  >
                    <option value="name_asc">Name (A-Z)</option>
                    <option value="name_desc">Name (Z-A)</option>
                    <option value="stock_desc">Highest Stock</option>
                    <option value="stock_asc">Lowest Stock</option>
                    <option value="price_desc">Highest Price</option>
                    <option value="cost_desc">Highest Cost</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Filter Strip & Column Customizer */}
          <div className="hidden sm:flex bg-white p-3 rounded-2xl border border-slate-200 shadow-xs mb-3 flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                <Layers size={13} className="text-slate-400" />
                <div className="text-[10px] font-bold text-slate-400 uppercase">Category:</div>
                <select
                  value={filterCategory}
                  onChange={(e) => { setFilterCategory(e.target.value); setProductsPage(1); }}
                  className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="all">All Categories ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Brand Filter */}
              {industryType !== "restaurant" && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                  <Building size={13} className="text-slate-400" />
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Brand:</div>
                  <select
                    value={filterBrand}
                    onChange={(e) => { setFilterBrand(e.target.value); setProductsPage(1); }}
                    className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="all">All Brands ({brands.length})</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Stock Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                <AlertTriangle size={13} className="text-slate-400" />
                <div className="text-[10px] font-bold text-slate-400 uppercase">Stock:</div>
                <select
                  value={filterStockStatus}
                  onChange={(e) => { setFilterStockStatus(e.target.value as any); setProductsPage(1); }}
                  className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="all">All Stock Status</option>
                  <option value="in_stock">In Stock (&gt;0)</option>
                  <option value="low_stock">Low Stock Alerts (≤ Reorder)</option>
                  <option value="out_of_stock">Out of Stock (0 Qty)</option>
                </select>
              </div>

              {/* Sort Order */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                <ArrowUpDown size={13} className="text-slate-400" />
                <div className="text-[10px] font-bold text-slate-400 uppercase">Sort:</div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="name_asc">Name (A-Z)</option>
                  <option value="name_desc">Name (Z-A)</option>
                  <option value="stock_desc">Highest Stock</option>
                  <option value="stock_asc">Lowest Stock</option>
                  <option value="price_desc">Highest Sale Price</option>
                  <option value="cost_desc">Highest Purchase Cost</option>
                </select>
              </div>

              {/* Reset Filters */}
              {(filterCategory !== "all" || filterBrand !== "all" || filterStockStatus !== "all" || searchQuery.trim() !== "") && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterCategory("all");
                    setFilterBrand("all");
                    setFilterStockStatus("all");
                    setSearchQuery("");
                    setProductsPage(1);
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-700 px-2 py-1 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw size={11} /> Reset
                </button>
              )}
            </div>

            {/* Right side: Column Visibility Toggle & Export Trigger */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  <Columns3 size={13} />
                  <div>Columns ({Object.values(visibleColumns).filter(Boolean).length})</div>
                </button>

                {isColumnPickerOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-30 space-y-1.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 px-1 mb-1">Toggle Table Columns</p>
                    {[
                      { key: "code", label: "Barcode / SKU" },
                      { key: "category", label: "Category" },
                      { key: "brand", label: "Brand / Company" },
                      { key: "purchasePrice", label: "Purchase Cost" },
                      { key: "salePrice", label: "Sale Price" },
                      { key: "stock", label: "Stock Quantity" },
                      { key: "shelfLocation", label: "Shelf Location" },
                    ].map(({ key, label }) => {
                      const isChecked = !!(visibleColumns as any)[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setVisibleColumns(prev => ({ ...prev, [key]: !isChecked }))}
                          className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 text-left font-bold text-slate-700 cursor-pointer"
                        >
                          <div>{label}</div>
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] ${
                            isChecked ? "bg-blue-600 text-white" : "border border-slate-300"
                          }`}>
                            {isChecked ? "✓" : ""}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => setIsExportReportModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs h-8 px-3 shadow-sm cursor-pointer"
              >
                <Download size={13} className="mr-1.5" />
                Export / PDF
              </Button>
            </div>
          </div>

          {/* Products Data Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Mobile Product Card Feed */}
            {!loading && filteredProducts.length > 0 && (
              <div className="md:hidden divide-y divide-slate-100">
                {paginatedProducts.map((product) => {
                  const isLow = product.current_stock <= product.min_stock_level;
                  const isOut = product.current_stock <= 0;
                  const catName = getCategoryName(product.categories);
                  const brandName = getBrandName(product.brands);

                  return (
                    <div
                      key={product.id}
                      className="p-3.5 hover:bg-slate-50 transition-colors flex flex-col gap-2.5"
                    >
                      {/* Top row: Title + Stock Status Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0" onClick={() => handleOpenEditModal(product)}>
                          <p className="font-extrabold text-slate-900 text-sm leading-snug cursor-pointer hover:text-blue-600 transition-colors">
                            {product.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {product.code && (
                              <div className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                #{product.code}
                              </div>
                            )}
                            {catName !== "Uncategorized" && (
                              <div className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                {catName}
                              </div>
                            )}
                            {brandName !== "No Brand" && (
                              <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                {brandName}
                              </div>
                            )}
                            {product.shelf_location && (
                              <div className="text-[10px] font-medium text-slate-400 flex items-center gap-0.5">
                                <MapPin size={9} /> {product.shelf_location}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Stock status badge */}
                        <div className="shrink-0 text-right">
                          <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isOut
                              ? "bg-red-100 text-red-700"
                              : isLow
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {isOut ? "Out of Stock" : `${product.current_stock} ${product.unit || "pcs"}`}
                          </div>
                        </div>
                      </div>

                      {/* Bottom row: Pricing & Quick Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <div className="flex items-baseline gap-2">
                          <div className="text-base font-black text-slate-900">
                            Rs {product.sale_price_single?.toLocaleString()}
                          </div>
                          {product.purchase_price_single && product.purchase_price_single > 0 && (
                            <div className="text-[11px] font-medium text-slate-400">
                              Cost: Rs {product.purchase_price_single.toLocaleString()}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(product)}
                            className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Delete product"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && filteredProducts.length === 0 && (
              <div className="md:hidden py-12 text-center text-slate-400 px-4">
                <Package className="h-10 w-10 text-slate-300 mb-2 mx-auto" />
                <p className="text-sm">No products match your search or filters.</p>
              </div>
            )}

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200 uppercase tracking-wider text-[10px] select-none">
                  <tr>
                    <th className="px-3.5 py-2.5">{industryType === "restaurant" ? "Item Name" : (industryType === "tailor" ? "Material Name" : "Product Name")}</th>
                    {visibleColumns.code && <th className="px-3 py-2.5">Code / SKU</th>}
                    {visibleColumns.category && <th className="px-3 py-2.5">{industryType === "restaurant" ? "Category" : "Category"}</th>}
                    {visibleColumns.brand && industryType !== "restaurant" && <th className="px-3 py-2.5">Brand</th>}
                    {visibleColumns.purchasePrice && <th className="px-3 py-2.5 text-right">Cost Price</th>}
                    {visibleColumns.salePrice && <th className="px-3 py-2.5 text-right">Sale Price</th>}
                    {visibleColumns.stock && <th className="px-3 py-2.5 text-center">Stock</th>}
                    {visibleColumns.shelfLocation && <th className="px-3 py-2.5">Rack</th>}
                    {visibleColumns.actions && <th className="px-3 py-2.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-10 text-center text-slate-400">Loading catalog...</td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-10 text-center text-slate-400 flex flex-col items-center">
                        <Package className="h-10 w-10 text-slate-300 mb-2" />
                        <p>No products found matching the active filters.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedProducts.map((product) => {
                      const isLow = product.current_stock <= product.min_stock_level;
                      const isOut = product.current_stock <= 0;

                      return (
                        <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-2 font-bold text-slate-800 text-xs">
                            <div>
                              <p>{product.name}</p>
                              {product.translated_names && typeof product.translated_names === "object" && Object.entries(product.translated_names).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {Object.entries(product.translated_names).map(([lang, val]) => (
                                    <div key={lang} className="text-[9px] font-sans font-black bg-indigo-50 text-indigo-800 border border-indigo-100 px-1.5 py-0.2 rounded uppercase shadow-2xs">
                                      {lang}: {String(val)}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex gap-1.5 flex-wrap mt-1">
                                {product.shelf_location && !visibleColumns.shelfLocation && (
                                  <div className="text-[9.5px] text-slate-400 font-normal flex items-center gap-0.5">
                                    <MapPin size={9} /> {product.shelf_location}
                                  </div>
                                )}
                                {industryType === "hardware" && (product as any).measurement_type && (product as any).measurement_type !== "standard" && (
                                  <div className={`text-[9.5px] px-1.5 py-0.2 rounded font-semibold border ${
                                    (product as any).measurement_type === "dimension"
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : "bg-blue-50 text-blue-700 border-blue-200"
                                  }`}>
                                    {(product as any).measurement_type === "dimension" ? "📐 Dimension" : "📏 Length"}
                                  </div>
                                )}
                                {product.pack_size && product.pack_size > 0 && (
                                  <div className="text-[9.5px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-semibold">
                                    📦 {product.pack_size} {product.unit || 'pcs'}/pack
                                  </div>
                                )}
                                {industryType === "pharmacy" && isControlledDrug(product) && (
                                  <div className="text-[9.5px] bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.2 rounded font-black flex items-center gap-1 shadow-2xs">
                                    🚨 Controlled (Schedule G)
                                  </div>
                                )}
                                {industryType === "restaurant" && product.is_ingredient && (
                                  <div className="text-[9.5px] bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.2 rounded font-semibold">
                                    🥕 Raw
                                  </div>
                                )}
                                {industryType === "restaurant" && !product.is_ingredient && product.note === "DYNAMIC_PRICE" && (
                                  <div className="text-[9.5px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-semibold">
                                    💬 Dynamic
                                  </div>
                                )}
                                {industryType === "restaurant" && !product.is_ingredient && product.note !== "DYNAMIC_PRICE" && (
                                  <div className="text-[9.5px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-semibold">
                                    🏷️ Fixed
                                  </div>
                                )}
                                {industryType === "restaurant" && (product.is_ingredient || product.unit) && (
                                  <div className="text-[9.5px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold">
                                    📦 Tracked
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {visibleColumns.code && (
                            <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">
                              {product.code || "-"}
                            </td>
                          )}
                          {visibleColumns.category && (
                            <td className="px-3 py-2">
                              <div className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                                {getCategoryName(product.categories)}
                              </div>
                            </td>
                          )}
                          {visibleColumns.brand && industryType !== "restaurant" && (
                            <td className="px-3 py-2 text-slate-500 text-xs">
                              {getBrandName(product.brands)}
                            </td>
                          )}
                          {visibleColumns.purchasePrice && (
                            <td className="px-3 py-2 text-right font-semibold text-slate-600 text-xs">
                              {industryType === "restaurant" && product.purchase_price_single === 0 ? "-" : `Rs ${product.purchase_price_single?.toLocaleString()}`}
                            </td>
                          )}
                          {visibleColumns.salePrice && (
                            <td className="px-3 py-2 text-right font-black text-indigo-600 text-xs">
                              {industryType === "restaurant" && product.is_ingredient
                                ? <div className="text-slate-400 font-normal text-[11px]">- (Raw)</div>
                                : industryType === "restaurant" && product.note === "DYNAMIC_PRICE"
                                  ? <div className="text-amber-600 font-bold text-[11px]">Ask</div>
                                  : `Rs ${product.sale_price_single?.toLocaleString()}`
                              }
                            </td>
                          )}
                          {visibleColumns.stock && (
                            <td className="px-3 py-2 text-center">
                              <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isOut 
                                   ? "bg-red-100 text-red-700" 
                                   : isLow 
                                     ? "bg-amber-100 text-amber-700" 
                                     : "bg-emerald-100 text-emerald-700"
                              }`}>
                                {product.current_stock} {product.unit || "pcs"}
                              </div>
                            </td>
                          )}
                          {visibleColumns.shelfLocation && (
                            <td className="px-3 py-2 text-slate-500 font-medium text-[11px]">
                              {product.shelf_location || "-"}
                            </td>
                          )}
                          {visibleColumns.actions && (
                            <td className="px-3 py-2 text-right space-x-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleOpenEditModal(product)}
                                className="h-7 w-7 p-0 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeleteProduct(product.id)}
                                className="h-7 w-7 p-0 text-slate-600 hover:text-red-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Catalog Pagination Controls */}
            {totalProductsPages > 1 && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2 bg-slate-50 border-t border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-600">
                <div className="text-[11px] sm:text-xs text-slate-500">
                  Showing {((productsPage - 1) * productsPerPage) + 1} to {Math.min(productsPage * productsPerPage, filteredProducts.length)} of {filteredProducts.length} items
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setProductsPage(prev => Math.max(1, prev - 1))}
                    disabled={productsPage === 1}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    Previous
                  </button>
                  <div className="text-slate-800 font-extrabold text-xs px-1">
                    Page {productsPage} / {totalProductsPages}
                  </div>
                  <button
                    onClick={() => setProductsPage(prev => Math.min(totalProductsPages, prev + 1))}
                    disabled={productsPage === totalProductsPages}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold disabled:opacity-40 cursor-pointer shadow-2xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab Panel: Categories */}
      {activeTab === "categories" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Mobile Categories View */}
          <div className="md:hidden divide-y divide-slate-100">
            {categories.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <Layers className="h-10 w-10 text-slate-300 mb-2 mx-auto" />
                <p>No categories configured yet.</p>
              </div>
            ) : categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <p>No categories match your search.</p>
              </div>
            ) : (
              categories
                .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((cat) => (
                  <div key={cat.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{cat.name}</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{getCategoryProductCount(cat.id)} products linked</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setEditingCategory(cat); setCategoryName(cat.name); setIsCategoryModalOpen(true); }}
                        className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 bg-slate-50 rounded-lg cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="h-8 w-8 p-0 text-slate-600 hover:text-red-600 bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Desktop Categories Table */}
          <div className="hidden md:block overflow-x-auto">
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
                      <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 text-sm">{cat.name}</td>
                        <td className="px-6 py-4 text-slate-500 font-semibold">{getCategoryProductCount(cat.id)} products</td>
                        <td className="px-6 py-4 text-right space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { setEditingCategory(cat); setCategoryName(cat.name); setIsCategoryModalOpen(true); }}
                            className="text-slate-600 hover:text-blue-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-slate-600 hover:text-red-600 hover:bg-slate-100 cursor-pointer"
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
          {/* Mobile Brands View */}
          <div className="md:hidden divide-y divide-slate-100">
            {brands.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <Building className="h-10 w-10 text-slate-300 mb-2 mx-auto" />
                <p>No brands configured yet.</p>
              </div>
            ) : brands.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <p>No brands match your search.</p>
              </div>
            ) : (
              brands
                .filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((br) => (
                  <div key={br.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{br.name}</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{getBrandProductCount(br.id)} products linked</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setEditingBrand(br); setBrandName(br.name); setIsBrandModalOpen(true); }}
                        className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 bg-slate-50 rounded-lg cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteBrand(br.id)}
                        className="h-8 w-8 p-0 text-slate-600 hover:text-red-600 bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Desktop Brands Table */}
          <div className="hidden md:block overflow-x-auto">
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
                      <tr key={br.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 text-sm">{br.name}</td>
                        <td className="px-6 py-4 text-slate-500 font-semibold">{getBrandProductCount(br.id)} products</td>
                        <td className="px-6 py-4 text-right space-x-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { setEditingBrand(br); setBrandName(br.name); setIsBrandModalOpen(true); }}
                            className="text-slate-600 hover:text-blue-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteBrand(br.id)}
                            className="text-slate-600 hover:text-red-600 hover:bg-slate-100 cursor-pointer"
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
                  {editingProduct 
                    ? (industryType === "restaurant" ? "Edit Menu Item" : (industryType === "tailor" ? "Edit Material / Fabric" : "Edit Product"))
                    : (industryType === "restaurant" ? "Add New Menu Item" : (industryType === "tailor" ? "Add New Material / Fabric" : "Add New Product"))
                  }
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-3.5 sm:p-4 md:p-5 space-y-4 max-w-[1600px] mx-auto max-h-[75vh] overflow-y-auto custom-scrollbar">
                
                {/* RESTAURANT: Simplified Menu Item Form */}
                {industryType === "restaurant" ? (
                  <div className="space-y-5">
                    {/* Item Type Switch (Menu Item vs Raw Ingredient) */}
                    <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setIsIngredient(false);
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                          !isIngredient
                            ? "bg-white text-blue-600 shadow-sm border border-blue-100"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        🍽️ Menu Item / Dish
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsIngredient(true);
                          setIsInventoryManaged(true);
                          setIsDynamicPricing(false);
                          setFormData(prev => ({ ...prev, unit: prev.unit || "kg" }));
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                          isIngredient
                            ? "bg-white text-orange-600 shadow-sm border border-orange-100"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        🥕 Raw Ingredient / Material
                      </button>
                    </div>

                    {/* Item Name */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                          {isIngredient ? "🥕 Raw Ingredient Name *" : "🍽️ Menu Item Name *"}
                        </label>
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
                        placeholder={isIngredient ? "e.g. Chicken, Wheat Flour, Cooking Oil, Rice, Spices..." : "e.g. Daal Chawal, Chicken Karahi, Cold Coffee..."}
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="h-11 text-sm font-semibold border-slate-200"
                        autoFocus
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

                    {/* Pricing Type Toggle (Hide for raw ingredients) */}
                    {!isIngredient ? (
                      <div className="border-2 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">💰 Pricing Type</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Fixed = price always same. Dynamic = waiter will enter price at time of order.</p>
                        </div>
                        <div className="grid grid-cols-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsDynamicPricing(false);
                              setFormData({...formData, note: ""});
                            }}
                            className={`p-4 text-left transition-all ${
                              !isDynamicPricing
                                ? "bg-blue-600 text-white"
                                : "bg-white text-slate-600 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                            }`}
                          >
                            <div className="text-lg mb-1">🏷️</div>
                            <p className="font-bold text-sm">Fixed Price</p>
                            <p className={`text-[11px] mt-0.5 ${!isDynamicPricing ? "text-blue-100" : "text-slate-400"}`}>
                              Set a fixed selling price
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsDynamicPricing(true);
                              setFormData({...formData, note: "DYNAMIC_PRICE", sale_price_single: 0});
                            }}
                            className={`p-4 text-left border-l transition-all ${
                              isDynamicPricing
                                ? "bg-amber-500 text-white"
                                : "bg-white text-slate-600 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                            }`}
                          >
                            <div className="text-lg mb-1">💬</div>
                            <p className="font-bold text-sm">Dynamic Price</p>
                            <p className={`text-[11px] mt-0.5 ${isDynamicPricing ? "text-amber-100" : "text-slate-400"}`}>
                              Ask price at order time
                            </p>
                          </button>
                        </div>

                        {/* Fixed Price Input */}
                        {!isDynamicPricing && (
                          <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Cost Price (Optional, Rs)</label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={formData.purchase_price_single || ""}
                                onChange={(e) => setFormData({...formData, purchase_price_single: Math.max(0, parseFloat(e.target.value) || 0)})}
                                className="h-9"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Selling Price (Rs) *</label>
                              <Input
                                type="number"
                                placeholder="e.g. 350"
                                value={formData.sale_price_single || ""}
                                onChange={(e) => setFormData({...formData, sale_price_single: Math.max(0, parseFloat(e.target.value) || 0)})}
                                className="h-9 border-blue-300 focus-visible:ring-blue-500"
                              />
                            </div>
                          </div>
                        )}

                        {/* Dynamic Price Info */}
                        {isDynamicPricing && (
                          <div className="p-4 border-t border-amber-200 bg-amber-50">
                            <div className="flex items-start gap-2.5">
                              <div className="text-lg">💬</div>
                              <div>
                                <p className="text-xs font-bold text-amber-800">Price will be asked at order time</p>
                                <p className="text-[11px] text-amber-600 mt-0.5">When waiter adds this item in POS, a popup will appear asking for the price. Example: "50 ki daal dena"</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Cost Price Input for Raw Ingredients */
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cost Price / Purchase Rate (Rs) *</label>
                          <Input
                            type="number"
                            placeholder="e.g. 280 (Cost per kg/liter/unit)"
                            value={formData.purchase_price_single || ""}
                            onChange={(e) => setFormData({...formData, purchase_price_single: Math.max(0, parseFloat(e.target.value) || 0)})}
                            className="h-10 border-slate-200 bg-white"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Average supplier cost for purchase orders and expense reports.</p>
                        </div>
                        <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3.5 flex items-start gap-2">
                          <div className="text-base mt-0.5">💡</div>
                          <div className="text-left">
                            <p className="text-xs font-bold text-orange-950">Raw Material Mode</p>
                            <p className="text-[10px] text-orange-700/80 font-semibold mt-0.5">This item is set as a raw material/ingredient. It will only be visible in the stock purchases, not in the POS menu.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Menu/Ingredient Category */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          {isIngredient ? "📂 Ingredient Category (Optional)" : "📂 Menu Category (Optional)"}
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowCategoryQuickAdd(!showCategoryQuickAdd)}
                          className="text-xs text-blue-600 hover:underline font-bold"
                        >
                          {showCategoryQuickAdd ? "Cancel" : "➕ New Category"}
                        </button>
                      </div>
                      {showCategoryQuickAdd && (
                        <div className="flex gap-2 mb-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <Input
                            placeholder={isIngredient ? "e.g. Meat, Vegetables, Groceries..." : "e.g. Starters, Main Course, Drinks..."}
                            value={quickCategoryName}
                            onChange={(e) => setQuickCategoryName(e.target.value)}
                            className="h-9 bg-white"
                          />
                          <Button
                            type="button"
                            disabled={isSavingQuick}
                            onClick={handleQuickAddCategory}
                            className="bg-blue-600 hover:bg-blue-700 h-9 px-4 text-white text-xs shrink-0"
                          >
                            Save
                          </Button>
                        </div>
                      )}
                      <SearchableSelect
                        value={formData.category_id}
                        onChange={handleCategoryChange}
                        options={categories.map(c => ({ value: c.id, label: c.name }))}
                        placeholder={isIngredient ? "Select Category" : "Select Menu Category"}
                      />
                    </div>

                    {/* Description (Only for non-ingredients) */}
                    {!isIngredient && (
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">📝 Description / Notes (Optional)</label>
                        <textarea
                          placeholder="e.g. Contains dairy, spicy level, special instructions..."
                          value={isDynamicPricing ? "" : (formData.note === "DYNAMIC_PRICE" ? "" : formData.note || "")}
                          onChange={(e) => setFormData({...formData, note: isDynamicPricing ? "DYNAMIC_PRICE" : e.target.value})}
                          disabled={isDynamicPricing}
                          rows={2}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </div>
                    )}

                    {/* Pharmacy Controlled Drug Toggle */}
                    {(industryType as string) === "pharmacy" && (
                      <div className="flex items-center gap-2.5 p-3.5 bg-rose-50/50 border border-rose-150 rounded-2xl mt-1">
                        <input
                          type="checkbox"
                          id="requires_prescription_cnic"
                          checked={formData.note?.includes("[CONTROLLED_DRUG]") || false}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            let currentNote = formData.note || "";
                            if (isChecked) {
                              if (!currentNote.includes("[CONTROLLED_DRUG]")) {
                                currentNote = `${currentNote} [CONTROLLED_DRUG]`.trim();
                              }
                            } else {
                              currentNote = currentNote.replace("[CONTROLLED_DRUG]", "").trim();
                            }
                            setFormData({...formData, note: currentNote});
                          }}
                          className="w-4 h-4 text-rose-600 border-slate-300 focus:ring-rose-500 rounded cursor-pointer"
                        />
                        <label htmlFor="requires_prescription_cnic" className="text-xs font-black text-rose-900 cursor-pointer select-none">
                          🚨 Requires Prescription & CNIC (Controlled Substance)
                          <div className="block text-[10px] font-semibold text-slate-500 mt-0.5">
                            Legally forces prompt for Customer CNIC and prescription verification during POS checkout.
                          </div>
                        </label>
                      </div>
                    )}

                    {/* Track Inventory Option (Force show fields if isIngredient) */}
                    {isIngredient ? (
                      <div className="border-2 border-emerald-400 rounded-2xl overflow-hidden bg-emerald-50/10">
                        <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200">
                          <p className="font-bold text-sm text-emerald-800 flex items-center gap-1.5">
                            <div>📦</div> Raw Material Stock & Inventory Management
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Set measurement units, initial stock, and low stock warnings for purchase tracking.
                          </p>
                        </div>
                        <div className="p-4 bg-emerald-50/30 grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Unit</label>
                            <select
                              value={formData.unit}
                              onChange={(e) => setFormData({...formData, unit: e.target.value})}
                              className="w-full bg-white border border-slate-200 h-9 rounded-lg px-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                            >
                              <option value="kg">Kilograms (kg)</option>
                              <option value="pcs">Pieces (pcs)</option>
                              <option value="btl">Bottles (btl)</option>
                              <option value="can">Cans</option>
                              <option value="gm">Grams (gm)</option>
                              <option value="ltr">Liters (ltr)</option>
                              <option value="ml">Milliliter (ml)</option>
                              <option value="box">Box</option>
                              <option value="pkt">Packet (pkt)</option>
                              {units.map(u => (
                                <option key={u.id} value={u.code}>{u.name} ({u.code})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Current Stock</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={formData.current_stock || ""}
                              onChange={(e) => setFormData({...formData, current_stock: Math.max(0, parseFloat(e.target.value) || 0)})}
                              className="w-full border border-slate-200 h-9 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Low Stock Alert</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="5"
                              value={formData.min_stock_level || ""}
                              onChange={(e) => setFormData({...formData, min_stock_level: Math.max(0, parseFloat(e.target.value) || 0)})}
                              className="w-full border border-slate-200 h-9 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                            />
                          </div>
                          <div className="col-span-3 bg-emerald-100/60 rounded-lg p-2.5 text-[11px] text-emerald-900 font-semibold flex items-center gap-2">
                            <div>📋</div>
                            <div>This raw material will be restocked via <strong>Ingredient Purchases</strong>.</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={`border-2 rounded-2xl overflow-hidden transition-all ${isInventoryManaged ? "border-emerald-400" : "border-slate-200"}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsInventoryManaged(!isInventoryManaged);
                            if (!isInventoryManaged) {
                              setFormData({...formData, current_stock: 0, min_stock_level: 5, unit: "pcs"});
                            }
                          }}
                          className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-all ${
                            isInventoryManaged ? "bg-emerald-50" : "bg-white hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                            isInventoryManaged ? "bg-emerald-500 border-emerald-500" : "border-slate-300"
                          }`}>
                            {isInventoryManaged && <div className="text-white text-xs font-black">✓</div>}
                          </div>
                          <div>
                            <p className={`font-bold text-sm ${isInventoryManaged ? "text-emerald-700" : "text-slate-700"}`}>
                              📦 Track Inventory / Stock
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Enable for bottles, drinks, disposables - items that run out. Can be restocked via Purchase Orders.
                            </p>
                          </div>
                        </button>

                        {isInventoryManaged && (
                          <div className="p-4 border-t border-emerald-200 bg-emerald-50/30 grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Unit</label>
                              <select
                                value={formData.unit}
                                onChange={(e) => setFormData({...formData, unit: e.target.value})}
                                className="w-full bg-white border border-slate-200 h-9 rounded-lg px-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
                              >
                                <option value="pcs">Pieces (pcs)</option>
                                <option value="btl">Bottles (btl)</option>
                                <option value="can">Cans</option>
                                <option value="kg">Kilograms (kg)</option>
                                <option value="gm">Grams (gm)</option>
                                <option value="ltr">Liters (ltr)</option>
                                <option value="ml">Milliliter (ml)</option>
                                <option value="box">Box</option>
                                <option value="pkt">Packet (pkt)</option>
                                {units.map(u => (
                                  <option key={u.id} value={u.code}>{u.name} ({u.code})</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Current Stock</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={formData.current_stock || ""}
                                onChange={(e) => setFormData({...formData, current_stock: Math.max(0, parseFloat(e.target.value) || 0)})}
                                className="w-full border border-slate-200 h-9 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Low Stock Alert</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="5"
                                value={formData.min_stock_level || ""}
                                onChange={(e) => setFormData({...formData, min_stock_level: Math.max(0, parseFloat(e.target.value) || 0)})}
                                className="w-full border border-slate-200 h-9 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                              />
                            </div>
                            <div className="col-span-3 bg-emerald-100 rounded-lg p-2.5 text-[11px] text-emerald-800 font-medium flex items-center gap-2">
                              <div>📋</div>
                              <div>This item can be restocked via <strong>Purchase Orders</strong>. Stock will reduce automatically on each sale.</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Column 1: Basic Information */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-blue-50 pb-2 flex items-center gap-1.5">
                      <Package size={14} /> {industryType === "tailor" ? "Material Details" : "Basic Information"}
                    </h4>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase">{industryType === "tailor" ? "Material Name" : "Product Name"}</label>
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
                        placeholder={industryType === "tailor" ? "e.g. Wash & Wear White (Grace)" : "e.g. Wheat Flour 10kg"} 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>

                    {/* Secondary Languages Inputs */}
                    {activeLanguages?.filter((l: string) => l !== "en").map((lang: string) => {
                      const nativeNameMap = {
                        ur: "Urdu",
                        ar: "Arabic",
                        fa: "Persian",
                        ps: "Pashto",
                        sd: "Sindhi",
                        hi: "Hindi",
                        bn: "Bengali",
                        ta: "Tamil",
                        te: "Telugu"
                      };
                      return (
                        <div key={lang} className="pl-4 border-l-2 border-indigo-200/50 space-y-1 mt-2.5">
                          <div className="flex justify-between items-center">
                            <label className="block text-[10px] font-bold text-slate-450 uppercase">
                              {nativeNameMap[lang as keyof typeof nativeNameMap] || lang} Translation
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



                    {industryType === "hardware" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Measurement Type</label>
                        <select
                          value={formData.measurement_type}
                          onChange={(e) => setFormData({...formData, measurement_type: e.target.value})}
                          className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
                        >
                          <option value="standard">Standard (Pieces/Units)</option>
                          <option value="dimension">Dimension-based (Area/Sqft)</option>
                          <option value="length">Length-based (Running Length)</option>
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Barcode / Code</label>
                        <Input 
                          placeholder="e.g. 7483920" 
                          value={formData.code}
                          onChange={(e) => setFormData({...formData, code: e.target.value})}
                        />
                      </div>
                      {industryType !== "pharmacy" && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Base Unit</label>
                          <select
                            value={formData.unit}
                            onChange={(e) => setFormData({...formData, unit: e.target.value})}
                            className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
                          >
                            <option value="">Select Unit</option>
                            {units.map(u => (
                              <option key={u.id} value={u.code}>{u.name} ({u.code})</option>
                            ))}
                          </select>
                          <div className="text-[10px] text-slate-400 mt-1 block">Only custom Base Units are listed.</div>
                        </div>
                      )}
                    </div>

                    {/* Bulk/Carton Packing Helper */}
                    <div className="border border-amber-200 p-4 bg-amber-50/30 rounded-2xl space-y-3.5 mt-1">
                      <label className="flex items-center gap-2.5 font-bold text-xs text-slate-700 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={hasBoxPacking} 
                          onChange={(e) => setHasBoxPacking(e.target.checked)}
                          className="rounded text-amber-500 focus:ring-amber-500/20 w-4 h-4"
                        />
                        <div>📦 {industryType === "pharmacy" ? "Has Box/Carton Packing?" : (industryType === "tailor" ? "Has Bulk Packing? (e.g. Roll, Box, Pack)" : "Has Bulk Packing? (e.g. Carton, Sack, Box, Drum)")}</div>
                      </label>

                      {hasBoxPacking && (
                        <div className="grid grid-cols-2 gap-3.5 pt-3.5 border-t border-amber-200/60">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Packing Name</label>
                            <Input 
                              placeholder={industryType === "pharmacy" ? "e.g. Box, Carton" : (industryType === "tailor" ? "e.g. Roll, Pack, Box" : "e.g. Carton, Sack, Box")} 
                              value={boxPackingName}
                              onChange={(e) => setBoxPackingName(e.target.value)}
                              className="h-9 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{formData.unit ? `${formData.unit.toUpperCase()} per Packing` : 'Units per Packing'}</label>
                            <Input 
                              type="number" 
                              placeholder="50" 
                              value={boxPackSize || ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setBoxPackSize(val);
                                if (val > 0) {
                                  setFormData(prev => ({
                                    ...prev,
                                    purchase_price_single: parseFloat((boxPurchasePrice / val).toFixed(4)) || 0,
                                    sale_price_single: parseFloat((boxSalePrice / val).toFixed(4)) || 0
                                  }));
                                }
                              }}
                              className="h-9 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Packing Purchase Price (Rs)</label>
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
                                    purchase_price_single: parseFloat((val / boxPackSize).toFixed(4)) || 0
                                  }));
                                }
                              }}
                              className="h-9 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Packing Sale Price (Rs)</label>
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
                                    sale_price_single: parseFloat((val / boxPackSize).toFixed(4)) || 0
                                  }));
                                }
                              }}
                              className="h-9 bg-white"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Packing Barcode (Optional)</label>
                            <Input 
                              placeholder="e.g. 7483921" 
                              value={boxBarcode}
                              onChange={(e) => setBoxBarcode(e.target.value)}
                              className="h-9 bg-white"
                            />
                          </div>
                          <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800 font-medium">
                            💡 Prices per base unit ({formData.unit || 'unit'}) will be auto-calculated below: Purchase = {boxPackSize > 0 ? `Rs ${(boxPurchasePrice / boxPackSize).toFixed(2)}` : '-'} / {formData.unit || 'unit'}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">
                          Purchase Price / {formData.measurement_type === "dimension" ? `sq ${formData.unit || 'unit'}` : formData.measurement_type === "length" ? `running ${formData.unit || 'unit'}` : (formData.unit || 'unit')} (Rs)
                        </label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={formData.purchase_price_single || ""}
                          onChange={(e) => setFormData({...formData, purchase_price_single: Math.max(0, parseFloat(e.target.value) || 0)})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">
                          Sale Price / {formData.measurement_type === "dimension" ? `sq ${formData.unit || 'unit'}` : formData.measurement_type === "length" ? `running ${formData.unit || 'unit'}` : (formData.unit || 'unit')} (Rs)
                        </label>
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
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">
                          Opening Stock (in {formData.unit ? formData.unit.toUpperCase() : 'base unit'})
                        </label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          value={formData.has_imei ? productImeis.filter((i: any) => i.status !== "sold").length : (formData.current_stock || "")}
                          onChange={(e) => setFormData({...formData, current_stock: Math.max(0, parseFloat(e.target.value) || 0)})}
                          disabled={formData.has_imei}
                          className={formData.has_imei ? "bg-slate-100 cursor-not-allowed font-bold" : ""}
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
                      {formData.has_imei && (
                        <div className="col-span-2 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-indigo-950">IMEI Tracking Active</p>
                            <p className="text-[10px] text-indigo-500 font-semibold">Stock is managed via individual device IMEIs ({productImeis.filter((i: any) => i.status !== 'sold').length} available).</p>
                          </div>
                          <Button
                            type="button"
                            onClick={() => setIsImeiModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs h-8 px-3 rounded-lg shadow-sm"
                          >
                            Manage IMEIs
                          </Button>
                        </div>
                      )}
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
                        <label className="block text-xs font-semibold text-slate-500 uppercase">{industryType === "tailor" ? "Material Category (Optional)" : "Category (Optional)"}</label>
                        <button 
                          type="button" 
                          onClick={() => setShowCategoryQuickAdd(!showCategoryQuickAdd)}
                          className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-0.5"
                        >
                          {showCategoryQuickAdd ? "Cancel" : "➕ Quick Add"}
                        </button>
                      </div>
                      {showCategoryQuickAdd ? (
                        <div className="flex gap-2 mb-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <Input 
                            placeholder={industryType === "tailor" ? "Category name (e.g. Fabrics)" : "Category name"}
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
                      <SearchableSelect
                        value={formData.category_id}
                        onChange={handleCategoryChange}
                        options={categories.map(c => ({ value: c.id, label: c.name }))}
                        placeholder={industryType === "tailor" ? "Select Material Category" : "Select Category"}
                      />
                    </div>

                    {/* Brand with inline Quick Add */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase">{industryType === "tailor" ? "Brand / Supplier (Optional)" : "Company / Brand (Optional)"}</label>
                        <button 
                          type="button" 
                          onClick={() => setShowBrandQuickAdd(!showBrandQuickAdd)}
                          className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-0.5"
                        >
                          {showBrandQuickAdd ? "Cancel" : "➕ Quick Add"}
                        </button>
                      </div>
                      {showBrandQuickAdd ? (
                        <div className="flex gap-2 mb-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <Input 
                            placeholder={industryType === "tailor" ? "Brand/Supplier name" : "Brand/Company name"}
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
                      <SearchableSelect
                        value={formData.brand_id}
                        onChange={handleBrandChange}
                        options={brands.map(b => ({ value: b.id, label: b.name }))}
                        placeholder={industryType === "tailor" ? "Select Brand / Supplier" : "Select Brand"}
                      />
                    </div>

                    {/* Formulation with inline Quick Add (Pharmacy Only) */}
                    {industryType === "pharmacy" && (
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-xs font-semibold text-slate-500 uppercase">Formulation (Formula/Salt)</label>
                          <button 
                            type="button" 
                            onClick={() => setShowFormulationQuickAdd(!showFormulationQuickAdd)}
                            className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-0.5"
                          >
                            {showFormulationQuickAdd ? "Cancel" : "➕ Quick Add"}
                          </button>
                        </div>
                        {showFormulationQuickAdd ? (
                          <div className="flex gap-2 mb-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <Input 
                              placeholder="Formula name"
                              value={quickFormulationName}
                              onChange={(e) => setQuickFormulationName(e.target.value)}
                              className="h-9 bg-white"
                            />
                            <Button 
                              type="button" 
                              disabled={isSavingQuick} 
                              onClick={handleQuickAddFormulation}
                              className="bg-blue-600 hover:bg-blue-700 h-9 px-4 text-white text-xs"
                            >
                              Save
                            </Button>
                          </div>
                        ) : null}
                        <SearchableSelect
                          value={formData.formulation_id}
                          onChange={(val) => setFormData({...formData, formulation_id: val})}
                          options={formulations.map(f => ({ value: f.id, label: f.name }))}
                          placeholder="Select Formulation"
                        />
                      </div>
                    )}

                    {industryType === "pharmacy" && (
                      <div className="bg-rose-50/70 border border-rose-200 p-3 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-rose-100 text-rose-700 rounded-xl text-sm">🚨</div>
                          <div>
                            <p className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                              Controlled / Schedule G Drug
                            </p>
                            <p className="text-[10.5px] text-slate-500 font-medium">
                              Mandatory prescription, doctor PMDC & patient CNIC will be prompted in POS.
                            </p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!formData.note?.includes("[CONTROLLED_DRUG]")}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              let currentNote = formData.note || "";
                              if (isChecked) {
                                if (!currentNote.includes("[CONTROLLED_DRUG]")) {
                                  currentNote = currentNote ? `${currentNote} [CONTROLLED_DRUG]` : "[CONTROLLED_DRUG]";
                                }
                              } else {
                                currentNote = currentNote.replace(/\[CONTROLLED_DRUG\]/g, "").trim();
                              }
                              setFormData({ ...formData, note: currentNote });
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-rose-600"></div>
                        </label>
                      </div>
                    )}

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
                        <Image size={12} /> Product Image
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept="image/*"
                          id="product-image-file"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="product-image-file"
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

                    {industryType === "electronics" && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                            <Info size={12} /> Default Product Warranty / Guarantee
                          </label>
                          <Input 
                            placeholder="e.g. 1 Year Parts & Compressor Warranty" 
                            value={formData.warranty}
                            onChange={(e) => setFormData({...formData, warranty: e.target.value})}
                          />
                        </div>
                        <div className="flex items-center gap-2 bg-indigo-50/20 p-3 rounded-xl border border-slate-200">
                          <input 
                            type="checkbox"
                            id="has_imei_checkbox"
                            checked={formData.has_imei || false}
                            onChange={(e) => setFormData({...formData, has_imei: e.target.checked})}
                            className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <label htmlFor="has_imei_checkbox" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                            Have IMEI Numbers (Serial / IMEI Tracking)
                          </label>
                        </div>
                      </div>
                    )}

                  </div>

                </div>

                {/* Bottom Section: Packing Variations */}
                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Tag size={16} className="text-blue-550" /> {industryType === "garments" ? "Garment Size-Color Variations Matrix" : "Packing Variations & Multi-pack Barcodes"}
                      </h4>
                      
                    </div>
                  </div>

                  {industryType === "garments" && (
                    <div className="bg-indigo-50/40 p-4 border border-indigo-150 rounded-2xl space-y-3.5">
                      <div className="text-[10px] font-black text-indigo-650 uppercase tracking-widest block">⚡ Auto-Generate Sizing-Coloring Matrix</div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="col-span-2 md:col-span-1">
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Sizes (comma separated)</label>
                          <Input 
                            value={matrixSizes}
                            onChange={e => setMatrixSizes(e.target.value)}
                            placeholder="e.g. S, M, L, XL"
                            className="bg-white text-xs h-9 font-semibold"
                          />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Colors (comma separated)</label>
                          <Input 
                            value={matrixColors}
                            onChange={e => setMatrixColors(e.target.value)}
                            placeholder="e.g. Red, Blue, Black"
                            className="bg-white text-xs h-9 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Purch. Price</label>
                          <Input 
                            type="number"
                            value={matrixPurchasePrice || ""}
                            onChange={e => setMatrixPurchasePrice(parseFloat(e.target.value) || 0)}
                            placeholder="Rs 0"
                            className="bg-white text-xs h-9 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Sale Price</label>
                          <Input 
                            type="number"
                            value={matrixSalePrice || ""}
                            onChange={e => setMatrixSalePrice(parseFloat(e.target.value) || 0)}
                            placeholder="Rs 0"
                            className="bg-white text-xs h-9 font-semibold"
                          />
                        </div>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Stock</label>
                            <Input 
                              type="number"
                              value={matrixStock || ""}
                              onChange={e => setMatrixStock(parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="bg-white text-xs h-9 font-semibold"
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={handleGenerateGarmentsMatrix}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold h-9 px-3 shrink-0 rounded-lg text-xs"
                          >
                            Generate
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Add Variation Form Card */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
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
                        value={newVar.stock_quantity || ""}
                        onChange={(e) => setNewVar({...newVar, stock_quantity: parseFloat(e.target.value) || 0})}
                        className="h-9 bg-white"
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1 flex gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Barcode / Code</label>
                        <Input 
                          placeholder="e.g. 7483921" 
                          value={newVar.barcode}
                          onChange={(e) => setNewVar({...newVar, barcode: e.target.value})}
                          className="h-9 bg-white"
                        />
                      </div>
                      <Button 
                        type="button" 
                        onClick={handleAddVariation}
                        className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-3 shrink-0"
                      >
                        Add
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
                              <td className="px-4 py-2.5 font-bold text-slate-800">{v.packing_name}</td>
                              <td className="px-4 py-2.5 font-mono text-slate-500">{v.barcode || "-"}</td>
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
              </>
            )}

              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveProduct} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {industryType === "restaurant" ? "Save Menu Item" : (industryType === "tailor" ? "Save Material" : "Save Product")}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Manage IMEI Numbers */}
      <AnimatePresence>
        {isImeiModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => setIsImeiModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg relative z-10 border border-slate-150 flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Manage IMEI Numbers</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Add or remove individual phone IMEI numbers</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsImeiModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Add IMEI Form */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 mb-4 grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">IMEI 1 (Required)</label>
                  <Input 
                    placeholder="e.g. 863920193029103" 
                    value={newImei1}
                    onChange={(e) => setNewImei1(e.target.value.replace(/\D/g, ""))}
                    className="h-9 text-xs rounded-lg border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">IMEI 2 (Optional)</label>
                  <Input 
                    placeholder="e.g. 863920193029104" 
                    value={newImei2}
                    onChange={(e) => setNewImei2(e.target.value.replace(/\D/g, ""))}
                    className="h-9 text-xs rounded-lg border-slate-200 bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <Button 
                    type="button"
                    onClick={() => {
                      if (!newImei1.trim()) {
                        toast.error("IMEI 1 is required");
                        return;
                      }
                      if (productImeis.some(i => i.imei1 === newImei1 || (i.imei2 && i.imei2 === newImei1) || (newImei2 && (i.imei1 === newImei2 || (i.imei2 && i.imei2 === newImei2))))) {
                        toast.error("This IMEI number is already in the list");
                        return;
                      }
                      setProductImeis([...productImeis, { imei1: newImei1.trim(), imei2: newImei2.trim() || null, status: "available" }]);
                      setNewImei1("");
                      setNewImei2("");
                      toast.success("IMEI device added to list");
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs h-9 rounded-lg shadow animate-pulse"
                  >
                    Add Device
                  </Button>
                </div>
              </div>

              {/* IMEI List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0">
                {productImeis.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No IMEI numbers registered. Add some above.
                  </div>
                ) : (
                  productImeis.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white border border-slate-200/80 rounded-xl p-2.5 px-3.5 shadow-sm">
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <div className="font-mono text-xs font-semibold text-slate-800">IMEI 1: {item.imei1}</div>
                          {item.imei2 && <div className="text-slate-300 font-mono text-xs">|</div>}
                          {item.imei2 && <div className="font-mono text-xs font-semibold text-slate-800">IMEI 2: {item.imei2}</div>}
                        </div>
                        <div className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mt-1.5 inline-block ${
                          item.status === 'sold' ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-emerald-50 text-emerald-500 border border-emerald-100'
                        }`}>
                          {item.status || 'available'}
                        </div>
                      </div>
                      {item.status !== 'sold' && (
                        <button
                          type="button"
                          onClick={() => {
                            setProductImeis(productImeis.filter((_, i) => i !== idx));
                            toast.info("IMEI device removed");
                          }}
                          className="p-1 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-lg transition-colors"
                          title="Remove IMEI"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                <Button 
                  type="button"
                  onClick={() => setIsImeiModalOpen(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs h-9.5 px-4 rounded-xl"
                >
                  Done
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
                    <div>Parsing and uploading products...</div>
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

      {/* Advanced Customized PDF / Report Export Modal */}
      {isExportReportModalOpen && (
        <ProductExportReportModal
          isOpen={isExportReportModalOpen}
          onClose={() => setIsExportReportModalOpen(false)}
          products={products}
          categories={categories}
          brands={brands}
          shopName={shopName || "My Shop"}
          selectedCurrency={selectedCurrency || "PKR"}
          industryType={industryType}
        />
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Products...</div>}>
      <ProductsPageContent />
    </React.Suspense>
  );
}
