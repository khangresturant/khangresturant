"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  X, Upload, Sparkles, AlertCircle, Eye, EyeOff, Check, Loader2, RefreshCw, Search, Plus, ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import type { DBProduct } from "./types";
import { getPlatformShopId } from "@/lib/config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AIInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: DBProduct[];
  onImport: (parsedData: {
    supplierName?: string;
    invoiceNumber?: string;
    items: Array<{
      productId: string;
      variantId?: string;
      name: string;
      packingName?: string;
      purchasePrice: number;
      salePrice: number;
      quantity: number;
      stock: number;
      batchNumber?: string;
      expiryDate?: string;
      bonusQty?: number;
      discount?: number;
    }>;
    taxRate?: number;
    discount?: number;
  }) => void;
  shopId: string;
  industryType?: string;
  onRefreshProducts?: () => void;
}

export function AIInvoiceModal({ isOpen, onClose, products, onImport, shopId, industryType, onRefreshProducts }: AIInvoiceModalProps) {
  const isPharmacyOrAgri = industryType === "pharmacy" || industryType === "fertilizer";
  const supabase = createClient();
  const [apiKeysList, setApiKeysList] = useState<string[]>([]);
  const [tempApiKey, setTempApiKey] = useState("");
  const [isKeyConfigOpen, setIsKeyConfigOpen] = useState(false);
  
  // Custom dropdown states for searchable select
  const [activeSelectIdx, setActiveSelectIdx] = useState<number | null>(null);
  const [selectSearchQuery, setSelectSearchQuery] = useState("");
  const [isCreatingProduct, setIsCreatingProduct] = useState<number | null>(null);
  const [pricingMargin, setPricingMargin] = useState(15);
  
  // Local synchronized copy of catalog products for instant dropdown updates
  const [localProductsList, setLocalProductsList] = useState<DBProduct[]>([]);

  useEffect(() => {
    setLocalProductsList(products);
  }, [products]);

  // Advanced pharmacy product matching algorithm (Fuzzy match + brand core + strength/dosage matching)
  const findBestProductMatch = (extractedName: string, itemsList: any[]): string => {
    const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
    const rawExtractedClean = cleanStr(extractedName);
    if (!rawExtractedClean) return "";

    const stopWords = new Set(["tab", "tabs", "tablet", "tablets", "cap", "caps", "capsule", "capsules", "syr", "syrup", "inj", "injection", "mg", "g", "ml", "mcg", "iu", "pack", "box", "strip", "pcs", "softgel", "susp", "suspension", "gel", "cream", "ointment", "drops", "infusion", "ampoule", "vial"]);
    const extractedTokens = rawExtractedClean.split(/\s+/).filter(t => t.length > 0 && !stopWords.has(t));
    if (extractedTokens.length === 0) return "";

    const extractedBrandCore = extractedTokens[0];
    const isPureNum = (s: string) => /^\d+$/.test(s);
    const extractNumbers = (tokens: string[]) => tokens.filter(t => isPureNum(t));

    const extractedNums = extractNumbers(extractedTokens);

    let bestMatchId = "";
    let highestScore = 0;

    for (const item of itemsList) {
      if (!item.name) continue;
      const dbClean = cleanStr(item.name);
      const dbTokens = dbClean.split(/\s+/).filter(t => t.length > 0 && !stopWords.has(t));
      if (dbTokens.length === 0) continue;

      const dbBrandCore = dbTokens[0];

      const brandMatched = (
        dbBrandCore === extractedBrandCore ||
        (dbBrandCore.length >= 4 && extractedBrandCore.length >= 4 && (dbBrandCore.startsWith(extractedBrandCore) || extractedBrandCore.startsWith(dbBrandCore)))
      );

      if (!brandMatched) continue;

      let score = 50;

      const dbNums = extractNumbers(dbTokens);
      if (extractedNums.length > 0 && dbNums.length > 0) {
        const numMatch = extractedNums.some(num => dbNums.includes(num));
        if (numMatch) {
          score += 30;
        } else {
          score -= 40;
        }
      }

      let commonTokenCount = 0;
      for (const token of extractedTokens) {
        if (dbTokens.includes(token)) commonTokenCount++;
      }

      score += Math.min(20, commonTokenCount * 5);

      if (score > highestScore && score >= 40) {
        highestScore = score;
        bestMatchId = item.id;
      }
    }

    return bestMatchId;
  };

  const parsePackSize = (cleanedName: string): number => {
    const crossMatch = cleanedName.match(/\b(\d+)\s*[xX\*]\s*(\d+)\b/);
    if (crossMatch) {
      return parseInt(crossMatch[1], 10) * parseInt(crossMatch[2], 10);
    }
    const sMatch = cleanedName.match(/\b(\d+)\s*(?:'s|s|S|tabs|caps|pcs|tablets|capsules|units)\b/);
    if (sMatch) {
      return parseInt(sMatch[1], 10);
    }
    const packOfMatch = cleanedName.match(/\b(?:pack|box|tablets|capsules)\s+of\s+(\d+)\b/i);
    if (packOfMatch) {
      return parseInt(packOfMatch[1], 10);
    }
    const generalMatch = cleanedName.match(/\b(\d+)\b/g);
    if (generalMatch) {
      for (let i = generalMatch.length - 1; i >= 0; i--) {
        const num = parseInt(generalMatch[i], 10);
        if (num > 1 && num < 150) {
          return num;
        }
      }
    }
    return 1;
  };
  const [isUsingGlobalKeys, setIsUsingGlobalKeys] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini-3.5-flash-lite");
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");
  
  // Parsed AI data
  const [parsedData, setParsedData] = useState<{
    supplierName?: string;
    invoiceNumber?: string;
    taxRate?: number;
    discount?: number;
    items: Array<{
      name: string;
      quantity: number;
      rate: number;
      total: number;
      matchedProductId?: string;
      matchedVariantId?: string;
      batchNumber?: string;
      expiryDate?: string;
      salePrice?: number;
      bonusQty?: number;
      discount?: number;
      taxPercent?: number;
      isPackRate?: boolean;
      unitType?: string;
    }>;
  } | null>(null);

  // Load saved API Key list from localStorage & fallback to global SaaS keys, env keys, and model version
  const loadKeys = async () => {
    if (typeof window === "undefined" || !shopId) return;
    let isGlobal = false;
    let model = "gemini-3.5-flash-lite"; // Default fallback to modern 3.5 Flash Lite (High limit)
    
    // 1. Try local keys first
    const saved = localStorage.getItem("user_gemini_api_keys_" + shopId) || "";
    let keys = saved.split("\n").map(k => k.trim()).filter(Boolean);

    // 2. Try env key fallback (NEXT_PUBLIC_GEMINI_API_KEY)
    if (keys.length === 0 && process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      keys = process.env.NEXT_PUBLIC_GEMINI_API_KEY.split("\n").map(k => k.trim()).filter(Boolean);
    }

    // 3. Load SaaS Global Keys & global model version from Super Admin
    try {
      const { data } = await supabase
        .from("company_details")
        .select("website")
        .eq("shop_id", getPlatformShopId())
        .maybeSingle();

      if (data && data.website && data.website.startsWith("{")) {
        const parsed = JSON.parse(data.website);
        
        // Set global model
        if (parsed.global_gemini_model && parsed.global_gemini_model !== "gemini-1.5-flash") {
          model = parsed.global_gemini_model;
        }
        
        // If local keys are empty, load global keys
        if (keys.length === 0 && parsed.global_gemini_api_keys) {
          keys = parsed.global_gemini_api_keys.split("\n").map((k: string) => k.trim()).filter(Boolean);
          isGlobal = true;
        }
      }
    } catch (e) {
      console.error("Failed to load SaaS global keys or model:", e);
    }

    setApiKeysList(keys);
    setIsUsingGlobalKeys(isGlobal);
    setSelectedModel(model);
  };

  useEffect(() => {
    if (isOpen && shopId) {
      loadKeys();
    }
  }, [isOpen, shopId]);

  const handleSaveQuickKey = () => {
    const cleanKey = tempApiKey.trim();
    if (!cleanKey) {
      toast.error("Please enter a valid Gemini API Key.");
      return;
    }
    if (typeof window !== "undefined" && shopId) {
      localStorage.setItem("user_gemini_api_keys_" + shopId, cleanKey);
      setApiKeysList([cleanKey]);
      setIsKeyConfigOpen(false);
      setTempApiKey("");
      toast.success("Gemini API Key successfully saved and activated!");
    }
  };

  if (!isOpen) return null;





  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("صرف امیج (Image) یا پی ڈی ایف (PDF) اپلوڈ کریں!");
      return;
    }

    setSelectedFile(file);
    
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null); // PDF preview fallback
    }
  };

  // Convert file to base64 for API upload
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64Str = (reader.result as string).split(",")[1];
        resolve(base64Str);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyzeBill = async () => {
    if (apiKeysList.length === 0) {
      toast.error("AI service is not active. Please contact administrator or support.");
      return;
    }
    if (!selectedFile) {
      toast.error("براہ کرم پہلے رسید کی فائل منتخب کریں!");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStatus("رسید فائل پروسیس ہو رہی ہے...");

    try {
      const base64Data = await fileToBase64(selectedFile);
      
      const promptText = `
        Analyze the uploaded purchase invoice/bill carefully.
        Extract all header details and line items. Intelligently determine if unit rate is for a full Pack/Box or single Tablet/Piece.
        Return details strictly in the following JSON format:
        {
          "supplierName": "String (extracted supplier/company/merchant name or null)",
          "invoiceNumber": "String (bill/invoice number or null)",
          "taxRate": 0.0 (GST or Sales tax percentage if found, e.g. 17),
          "discount": 0.0 (overall invoice discount amount in Rs if found),
          "items": [
            {
              "name": "String (item or product name)",
              "quantity": 0.0 (billed quantity of packs or units),
              "rate": 0.0 (purchase rate per unit or pack),
              "total": 0.0 (total price of the line item),
              "batchNumber": "String (batch number or null if not found)",
              "expiryDate": "String (expiry date in format YYYY-MM-DD, e.g., '2028-12-31', or null if not found)",
              "bonusQty": 0.0 (free scheme stock / bonus quantity if found e.g. 10+1 -> bonusQty is 1, or 0 if none),
              "discount": 0.0 (extra line item trade discount amount in Rs if found, or 0),
              "isPackRate": true (true if extracted rate is for a full Box/Pack/Carton/10s/30s, false if for single piece/tablet),
              "unitType": "String (e.g. 'Pack', 'Box', 'Carton', 'Pcs', 'Tabs')"
            }
          ]
        }
        Ensure all quantities and rates are numbers. Return raw JSON without markdown syntax blocks.
      `;

      let keyIndex = parseInt(localStorage.getItem("gemini_key_index_" + shopId) || "0", 10);
      let parsedJson = null;
      let success = false;
      let lastError = "";

      const candidateModels = [
        selectedModel && selectedModel !== "gemini-1.5-flash" ? selectedModel : "gemini-3.5-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
      ].filter((m, i, arr) => m && arr.indexOf(m) === i);

      const attemptsToTry = Math.min(5, apiKeysList.length);

      for (let attempt = 0; attempt < attemptsToTry; attempt++) {
        const activeIndex = (keyIndex + attempt) % apiKeysList.length;
        const currentKey = apiKeysList[activeIndex];
        
        setAnalysisStatus("تجزیہ ہو رہا ہے...");
        
        for (const modelToTry of candidateModels) {
          try {
            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${currentKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        { text: promptText },
                        {
                          inlineData: {
                            mimeType: selectedFile.type,
                            data: base64Data,
                          },
                        },
                      ],
                    },
                  ],
                  generationConfig: {
                    responseMimeType: "application/json",
                  },
                }),
              }
            );

            if (response.status === 429) {
              console.warn(`Key ${activeIndex + 1} limit exceeded (429). Trying next key...`);
              lastError = "Rate limit exceeded (429)";
              break; // rotate to next key
            }

            if (!response.ok) {
              const errJson = await response.json().catch(() => ({}));
              lastError = errJson?.error?.message || `HTTP ${response.status} (${modelToTry})`;
              continue; // try next candidate model
            }

            const result = await response.json();
            const parsedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!parsedText) throw new Error("AI returned empty content.");

            parsedJson = JSON.parse(parsedText);
            success = true;
            setSelectedModel(modelToTry);
            
            // Store next index
            localStorage.setItem("gemini_key_index_" + shopId, String((activeIndex + 1) % apiKeysList.length));
            break;
          } catch (err: any) {
            console.error(`Key ${activeIndex + 1} with model ${modelToTry} failed:`, err);
            lastError = err.message || "Unknown error";
          }
        }
        if (success) break;
      }

      if (!success) {
        throw new Error(`تمام کیز ناکام ہو گئیں۔ آخری خرابی: ${lastError}`);
      }

      setAnalysisStatus("ڈیٹا کا تجزیہ کیا جا رہا ہے...");
      
      // Auto-match products based on advanced fuzzy algorithm & detect Pack vs Piece rate
      const enrichedItems = (parsedJson.items || []).map((item: any) => {
        const matchId = findBestProductMatch(item.name, products);
        
        // Auto-match variants if matching product is found
        let matchedVariantId = "";
        const matchedProd = products.find(p => p.id === matchId);
        if (matchedProd && matchedProd.product_variants && matchedProd.product_variants.length > 0) {
          const size = parsePackSize(item.name);
          const isPackDetected = item.isPackRate || (item.unitType && (item.unitType.toLowerCase().includes("pack") || item.unitType.toLowerCase().includes("box"))) || size > 1;
          
          if (isPackDetected) {
            const vMatch = matchedProd.product_variants.find(v => (size > 1 && v.pack_size === size) || v.is_packing || v.packing_name.toLowerCase().includes("pack"));
            matchedVariantId = vMatch ? vMatch.id : matchedProd.product_variants[0].id;
          }
        }
        
        return {
          ...item,
          matchedProductId: matchId,
          matchedVariantId: matchedVariantId,
          batchNumber: item.batchNumber || "",
          expiryDate: item.expiryDate || "",
          bonusQty: item.bonusQty || 0,
          discount: item.discount || 0,
          salePrice: Math.round(item.rate * (1 + 15 / 100))
        };
      });

      setParsedData({
        ...parsedJson,
        items: enrichedItems
      });

      toast.success("رسید کامیابی سے پارس ہو گئی ہے!");
    } catch (err: any) {
      console.error(err);
      toast.error(`تحلیل میں خرابی: ${err.message || "Unknown error"}`);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStatus("");
    }
  };

  const handleImportToCart = () => {
    if (!parsedData || parsedData.items.length === 0) return;

    // Check if any items are not matched to a catalog product
    const unmatched = parsedData.items.filter(item => !item.matchedProductId);
    if (unmatched.length > 0) {
      toast.warning("براہ کرم تمام مصنوعات کو کیٹلاگ سے مربوط کریں!");
      return;
    }

    const cartItems = parsedData.items.map(item => {
      const dbProd = localProductsList.find(p => p.id === item.matchedProductId)!;
      let purchasePrice = item.rate; // Always use the new parsed invoice rate
      let salePrice = item.salePrice || dbProd.sale_price_single || Math.round(item.rate * (1 + pricingMargin / 100));
      let packingName = "";
      
      if (item.matchedVariantId) {
        const variant = dbProd.product_variants?.find(v => v.id === item.matchedVariantId);
        if (variant) {
          purchasePrice = item.rate; // Use the new parsed pack rate
          salePrice = item.salePrice || variant.sale_price || Math.round(item.rate * (1 + pricingMargin / 100));
          packingName = variant.packing_name;
        }
      }

      return {
        productId: dbProd.id,
        variantId: item.matchedVariantId || undefined,
        name: dbProd.name,
        packingName: packingName || undefined,
        purchasePrice,
        salePrice,
        quantity: item.quantity,
        stock: dbProd.current_stock,
        batchNumber: item.batchNumber || "",
        expiryDate: item.expiryDate || "",
        bonusQty: item.bonusQty || 0,
        discount: item.discount || 0,
        taxPercent: item.taxPercent || 0
      };
    });

    onImport({
      supplierName: parsedData.supplierName,
      invoiceNumber: parsedData.invoiceNumber,
      items: cartItems,
      taxRate: parsedData.taxRate,
      discount: parsedData.discount
    });

    toast.success("پارس شدہ اشیاء/ریٹ کامیابی سے کارٹ میں امپورٹ کر دی گئی ہیں!");
    handleClose();
  };

  const handleAddAllMissingProducts = async () => {
    if (!parsedData || isBulkAdding) return;
    const missingItems = parsedData.items.filter(item => !item.matchedProductId);
    if (missingItems.length === 0) return;

    setIsBulkAdding(true);
    toast.info(`Adding ${missingItems.length} missing products...`);

    try {
      // Get or create Medicines category
      let categoryId = null;
      const { data: existingCat } = await supabase
        .from("categories")
        .select("id")
        .eq("shop_id", shopId)
        .eq("name", "Medicines")
        .maybeSingle();

      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const { data: newCat } = await supabase
          .from("categories")
          .insert({ name: "Medicines", shop_id: shopId })
          .select()
          .single();
        if (newCat) categoryId = newCat.id;
      }

      const createdProds: any[] = [];
      const updatedItems = [...parsedData.items];

      for (let i = 0; i < updatedItems.length; i++) {
        const item = updatedItems[i];
        if (item.matchedProductId) continue; // Skip already matched

        const rate = item.rate;
        const packSize = parsePackSize(item.name);
        
        // Calculate single item cost/retail rates
        const purchasePriceSingle = packSize > 1 ? Number((rate / packSize).toFixed(2)) : rate;
        const salePriceSingle = item.salePrice 
          ? (packSize > 1 ? Number((item.salePrice / packSize).toFixed(2)) : item.salePrice)
          : (packSize > 1 ? Number(((rate * (1 + pricingMargin / 100)) / packSize).toFixed(2)) : Math.round(rate * (1 + pricingMargin / 100)));

        const { data: newProd, error: prodErr } = await supabase
          .from("products")
          .insert({
            shop_id: shopId,
            name: item.name,
            unit: "pcs",
            purchase_price_single: purchasePriceSingle,
            sale_price_single: salePriceSingle,
            current_stock: 0,
            min_stock_level: 10,
            category_id: categoryId,
            measurement_type: "standard",
            pack_size: packSize > 1 ? packSize : null,
            purchase_price_pack: packSize > 1 ? rate : null,
            sale_price_pack: packSize > 1 ? Math.round(rate * (1 + pricingMargin / 100)) : null
          })
          .select()
          .single();

        if (prodErr) {
          console.error(`Failed to insert product ${item.name}:`, prodErr);
          continue;
        }

        // Create variation if pack size > 1
        let matchedVariantId = undefined;
        if (packSize > 1 && newProd) {
          const packingName = `Pack (${packSize} pcs)`;
          const { data: newVar, error: varErr } = await supabase
            .from("product_variants")
            .insert({
              product_id: newProd.id,
              shop_id: shopId,
              packing_name: packingName,
              purchase_price: rate,
              sale_price: Math.round(rate * (1 + pricingMargin / 100)),
              stock_quantity: 0,
              is_packing: true,
              pack_size: packSize
            })
            .select()
            .single();

          if (varErr) {
            console.error("Error inserting variation:", varErr);
          } else if (newVar) {
            matchedVariantId = newVar.id;
          }
        }

        if (newProd) {
          updatedItems[i].matchedProductId = newProd.id;
          if (matchedVariantId) {
            updatedItems[i].matchedVariantId = matchedVariantId;
          }
          createdProds.push(newProd);
        }
      }

      setParsedData({ ...parsedData, items: updatedItems });

      if (createdProds.length > 0) {
        setLocalProductsList(prev => [...prev, ...createdProds]);
      }

      toast.success(`Successfully added and mapped ${createdProds.length} products!`);
      onRefreshProducts?.();

    } catch (err: any) {
      console.error(err);
      toast.error("Bulk add failed: " + err.message);
    } finally {
      setIsBulkAdding(false);
    }
  };

  const handleCreateProductInline = async (extractedName: string, rate: number, idx: number) => {
    setIsCreatingProduct(idx);
    try {
      const finalName = (extractedName || "").trim();
      if (!finalName) {
        toast.error("Product name cannot be empty");
        return;
      }

      // 1. Get or create category
      let categoryId = null;
      const { data: existingCat } = await supabase
        .from("categories")
        .select("id")
        .eq("shop_id", shopId)
        .limit(1)
        .maybeSingle();

      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const { data: newCat } = await supabase
          .from("categories")
          .insert({ name: "General", shop_id: shopId })
          .select()
          .single();
        if (newCat) categoryId = newCat.id;
      }

      // 2. Parse pack size
      const packSize = parsePackSize(finalName);
      const marginMultiplier = 1 + (pricingMargin || 15) / 100;
      
      // Calculate single item cost/retail rates
      const purchasePriceSingle = packSize > 1 ? Number((rate / packSize).toFixed(2)) : rate;
      const salePriceSingle = packSize > 1 ? Number(((rate * marginMultiplier) / packSize).toFixed(2)) : Math.round(rate * marginMultiplier);
      const purchasePricePack = packSize > 1 ? rate : null;
      const salePricePack = packSize > 1 ? Math.round(rate * marginMultiplier) : null;

      // 3. Create Product
      const { data: newProd, error: prodErr } = await supabase
        .from("products")
        .insert({
          shop_id: shopId,
          name: finalName,
          unit: "pcs",
          purchase_price_single: purchasePriceSingle,
          sale_price_single: salePriceSingle,
          current_stock: 0,
          min_stock_level: 5,
          category_id: categoryId,
          measurement_type: "standard",
          pack_size: packSize > 1 ? packSize : null,
          purchase_price_pack: purchasePricePack,
          sale_price_pack: salePricePack
        })
        .select()
        .single();

      if (prodErr) throw prodErr;

      // 4. Create packing variant if pack size > 1
      let createdVariantId = "";
      if (packSize > 1 && newProd) {
        const { data: newVar } = await supabase
          .from("product_variants")
          .insert({
            product_id: newProd.id,
            shop_id: shopId,
            packing_name: "Pack (" + packSize + " pcs)",
            purchase_price: rate,
            sale_price: salePricePack,
            stock_quantity: 0,
            is_packing: true,
            pack_size: packSize
          })
          .select()
          .single();
        if (newVar) createdVariantId = newVar.id;
      }

      toast.success('"' + finalName + '" created & added to inventory!');
      
      if (onRefreshProducts) onRefreshProducts();

      // Instantly append newly created product to local dropdown list to auto-select it
      const newLocalProduct: DBProduct = {
        id: newProd.id,
        name: newProd.name,
        code: newProd.code || "",
        unit: newProd.unit || "pcs",
        purchase_price_single: newProd.purchase_price_single,
        sale_price_single: newProd.sale_price_single,
        current_stock: newProd.current_stock || 0,
        category_id: newProd.category_id || "",
        pack_size: newProd.pack_size || null,
        measurement_type: newProd.measurement_type || "standard",
        has_imei: newProd.has_imei || false,
        product_variants: createdVariantId ? [{
          id: createdVariantId,
          packing_name: "Pack (" + packSize + " pcs)",
          purchase_price: rate,
          sale_price: salePricePack || Math.round(rate * marginMultiplier),
          stock_quantity: 0,
          is_packing: true,
          pack_size: packSize
        }] : []
      };
      
      setLocalProductsList(prev => [newLocalProduct, ...prev]);

      // Dynamic match update in overlay UI
      if (parsedData && newProd) {
        const updatedItems = [...parsedData.items];
        updatedItems[idx].matchedProductId = newProd.id;
        updatedItems[idx].matchedVariantId = createdVariantId;
        setParsedData({ ...parsedData, items: updatedItems });
      }
      setActiveSelectIdx(null); // Close active select panel
    } catch (e: any) {
      console.error(e);
      toast.error("Product creation failed: " + e.message);
    } finally {
      setIsCreatingProduct(null);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setParsedData(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
              <Sparkles size={18} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-800">AI Bill / Invoice Scanner</h2>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                  AI Ready
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold">Upload supplier purchase bills to instantly load items into stock.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleClose}
              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">

          {!parsedData ? (
            /* Upload File screen */
            <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:border-indigo-400 transition-colors bg-slate-50/20">
              <input
                id="ai-file-uploader"
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              
              {selectedFile ? (
                <div className="space-y-4">
                  {filePreview ? (
                    <div className="mx-auto w-32 h-32 border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white p-1">
                      <img src={filePreview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                    </div>
                  ) : (
                    <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
                      <span className="text-xs font-black">PDF</span>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-black text-slate-800">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>

                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-650 cursor-pointer"
                    >
                      Clear
                    </button>
                    
                    <button
                      onClick={handleAnalyzeBill}
                      disabled={isAnalyzing}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-500/10 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>{analysisStatus}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} />
                          <span>Analyze with AI</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <label htmlFor="ai-file-uploader" className="cursor-pointer space-y-4 block">
                  <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-650 rounded-2xl flex items-center justify-center">
                    <Upload size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">رسید اپلوڈ کریں (Drag & Drop or Click)</p>
                    <p className="text-[10px] text-slate-400">PNG, JPG, JPEG, or PDF files are supported</p>
                  </div>
                </label>
              )}
            </div>
          ) : (
            /* Review & Map parsed items */
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-800">Extract Summary & Product Mapping</h3>
                <button
                  onClick={() => setParsedData(null)}
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                >
                  <RefreshCw size={12} /> Re-upload Bill
                </button>
              </div>

              {/* Bill Meta Card */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs font-bold">
                <div>
                  <span className="block text-[8.5px] font-bold text-slate-400 uppercase tracking-wide">Supplier (AI Extracted)</span>
                  <span className="text-slate-800">{parsedData.supplierName || "Not Found"}</span>
                </div>
                <div>
                  <span className="block text-[8.5px] font-bold text-slate-400 uppercase tracking-wide">Bill / Invoice Number</span>
                  <span className="text-slate-800">{parsedData.invoiceNumber || "Not Found"}</span>
                </div>
                <div>
                  <span className="block text-[8.5px] font-bold text-slate-400 uppercase tracking-wide">Extracted Discount</span>
                  <span className="text-slate-850">Rs {parsedData.discount || 0}</span>
                </div>
                <div>
                  <span className="block text-[8.5px] font-bold text-slate-400 uppercase tracking-wide">Extracted Tax</span>
                  <span className="text-slate-850">{parsedData.taxRate || 0}%</span>
                </div>
                <div className="bg-indigo-50/40 p-1.5 rounded-xl border border-indigo-150 flex flex-col justify-center">
                  <span className="block text-[8.5px] font-black text-indigo-750 uppercase tracking-wider">Pricing Margin</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <input
                      type="number"
                      value={pricingMargin}
                      onChange={(e) => {
                        const newMargin = Math.max(0, parseFloat(e.target.value) || 0);
                        setPricingMargin(newMargin);
                        if (parsedData) {
                          const updatedItems = parsedData.items.map(item => ({
                            ...item,
                            salePrice: Math.round(item.rate * (1 + newMargin / 100))
                          }));
                          setParsedData({ ...parsedData, items: updatedItems });
                        }
                      }}
                      className="w-12 h-6 px-1.5 bg-white border border-indigo-200 rounded-lg text-center text-xs font-black text-indigo-750 focus:outline-none"
                    />
                    <span className="text-indigo-650 font-black">%</span>
                  </div>
                </div>
              </div>

              {/* Add All Missing Section */}
              {parsedData.items.some(item => !item.matchedProductId) && (
                <div className="flex justify-between items-center bg-indigo-50/60 border border-indigo-100/80 rounded-2xl p-4">
                  <div>
                    <h4 className="text-xs font-black text-indigo-950">Add Missing Products in Bulk (غیر موجود دوائیاں شامل کریں)</h4>
                    <p className="text-[10px] text-indigo-700/80 font-bold mt-0.5">
                      System will automatically extract pack sizes and create all unmatched products in bulk.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAllMissingProducts}
                    disabled={isBulkAdding}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-500/10 cursor-pointer flex items-center gap-1.5"
                  >
                    {isBulkAdding ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <span>Add All Missing ({parsedData.items.filter(item => !item.matchedProductId).length})</span>
                    )}
                  </button>
                </div>
              )}

              {/* Items Mapping Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                      <th className="py-3 px-3">Extracted Name</th>
                      <th className="py-3 px-3">Mapping (Match Product)</th>
                      {isPharmacyOrAgri && <th className="py-3 px-2 text-center">Batch No</th>}
                      {isPharmacyOrAgri && <th className="py-3 px-2 text-center">Expiry</th>}
                      <th className="py-3 px-2 text-center">Qty</th>
                      {isPharmacyOrAgri && <th className="py-3 px-2 text-center text-purple-700">🎁 Bonus</th>}
                      <th className="py-3 px-2 text-right">Cost (Rs)</th>
                      <th className="py-3 px-2 text-right text-emerald-700">🏷️ Extra Disc</th>
                      <th className="py-3 px-2 text-center text-blue-700">Tax %</th>
                      <th className="py-3 px-2 text-right">Retail (Rs)</th>
                      <th className="py-3 px-2 text-center text-purple-700">Profit %</th>
                      <th className="py-3 px-3 text-right">Net Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedData.items.map((item, idx) => {
                      const matchedProduct = localProductsList.find(p => p.id === item.matchedProductId);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          {/* Extracted item name */}
                          <td className="py-3 px-4 font-extrabold text-slate-800 max-w-[180px] truncate">
                            {item.name}
                          </td>
                          
                          {/* Map to product searchable select with inline create */}
                          <td className="py-3 px-4 relative">
                            <div className="flex gap-1.5 items-center">
                              {/* Trigger Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeSelectIdx === idx) {
                                    setActiveSelectIdx(null);
                                  } else {
                                    setActiveSelectIdx(idx);
                                    setSelectSearchQuery("");
                                  }
                                }}
                                className={"flex-1 h-8 px-2.5 rounded-xl border flex items-center justify-between text-[11px] font-black cursor-pointer text-left focus:outline-none transition " + (
                                  matchedProduct
                                    ? "bg-slate-50 border-slate-200 text-slate-800"
                                    : "bg-red-50/30 border-red-200 text-red-655 hover:bg-red-50/50"
                                )}
                              >
                                <span className="truncate max-w-[140px]">
                                  {matchedProduct ? matchedProduct.name : "-- select product to match --"}
                                </span>
                                <ChevronDown size={11} className="text-slate-400 shrink-0" />
                              </button>

                              {/* Quick Create Button - ALWAYS available to create new item */}
                              <button
                                type="button"
                                onClick={() => handleCreateProductInline(item.name, item.rate, idx)}
                                disabled={isCreatingProduct === idx}
                                className={"h-8 px-2.5 rounded-xl text-[10px] font-black flex items-center gap-1 shadow-sm shrink-0 cursor-pointer disabled:opacity-50 transition " + (
                                  matchedProduct
                                    ? "bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                )}
                                title={matchedProduct ? "Create as a brand new separate product in inventory" : "Add as a new product in inventory"}
                              >
                                {isCreatingProduct === idx ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Plus size={11} />
                                )}
                                <span>{matchedProduct ? "New" : "Create"}</span>
                              </button>
                            </div>

                            {/* Dropdown Overlay panel */}
                            {activeSelectIdx === idx && (
                              <div className="absolute left-4 right-4 mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150 min-w-[280px]">
                                {/* Search filter */}
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                  <input
                                    type="text"
                                    placeholder="Search products or type new name..."
                                    value={selectSearchQuery}
                                    onChange={(e) => setSelectSearchQuery(e.target.value)}
                                    className="w-full h-8 pl-8 pr-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    autoFocus
                                  />
                                </div>

                                {/* Button to Create New Product directly with search query or extracted name */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nameToUse = selectSearchQuery.trim() || item.name;
                                    handleCreateProductInline(nameToUse, item.rate, idx);
                                  }}
                                  disabled={isCreatingProduct === idx}
                                  className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-[11px] font-black flex items-center justify-between transition cursor-pointer"
                                >
                                  <span className="flex items-center gap-1.5 truncate">
                                    <Plus size={13} className="text-emerald-600 shrink-0" />
                                    <span className="truncate">
                                      Add &quot;{selectSearchQuery.trim() || item.name}&quot; as New Item
                                    </span>
                                  </span>
                                  <span className="text-[9px] bg-emerald-200/60 text-emerald-900 px-1.5 py-0.5 rounded font-extrabold shrink-0">
                                    + Create
                                  </span>
                                </button>

                                {/* Matching Options List */}
                                <div className="max-h-40 overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
                                  {localProductsList
                                    .filter(p => p.name.toLowerCase().includes(selectSearchQuery.toLowerCase()))
                                    .slice(0, 20) // Limit choices list length
                                    .map(p => (
                                      <button
                                        type="button"
                                        key={p.id}
                                        onClick={() => {
                                          const newItems = [...parsedData.items];
                                          newItems[idx].matchedProductId = p.id;
                                          newItems[idx].matchedVariantId = ""; // Reset variant
                                          setParsedData({ ...parsedData, items: newItems });
                                          setActiveSelectIdx(null);
                                        }}
                                        className={"w-full text-left px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold flex justify-between items-center transition cursor-pointer " + (
                                          item.matchedProductId === p.id 
                                            ? "bg-indigo-50 text-indigo-700 font-black" 
                                            : "text-slate-700 hover:bg-slate-50"
                                        )}
                                      >
                                        <span className="truncate pr-2">{p.name}</span>
                                        {item.matchedProductId === p.id && <Check size={12} className="text-indigo-600 shrink-0" />}
                                      </button>
                                    ))}
                                  {localProductsList.filter(p => p.name.toLowerCase().includes(selectSearchQuery.toLowerCase())).length === 0 && (
                                    <p className="text-[10px] text-center text-slate-400 py-2 font-medium">
                                      No existing products matching &quot;{selectSearchQuery}&quot;. Use button above to create it!
                                    </p>
                                  )}
                                </div>

                                {/* Option to Unmatch / Clear Selection if currently mapped */}
                                {item.matchedProductId && (
                                  <div className="pt-1 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newItems = [...parsedData.items];
                                        newItems[idx].matchedProductId = "";
                                        newItems[idx].matchedVariantId = "";
                                        setParsedData({ ...parsedData, items: newItems });
                                        setActiveSelectIdx(null);
                                      }}
                                      className="w-full text-center py-1 text-[10px] font-black text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                                    >
                                      Clear / Unmatch Item (سلیکشن ختم کریں)
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Show current database system rate for quick verification */}
                            {matchedProduct && (
                              <div className="text-[9.5px] text-slate-450 font-black mt-0.5 pl-0.5">
                                {(() => {
                                  const variant = item.matchedVariantId 
                                    ? matchedProduct.product_variants?.find(v => v.id === item.matchedVariantId) 
                                    : null;
                                  const cost = variant ? (variant.purchase_price || 0) : matchedProduct.purchase_price_single;
                                  const retail = variant ? (variant.sale_price || 0) : matchedProduct.sale_price_single;
                                  return "System Rate: Cost Rs " + cost + " | Retail Rs " + retail;
                                })()}
                              </div>
                            )}

                            {/* If matched, show variant choice if variants exist */}
                            {matchedProduct && matchedProduct.product_variants && matchedProduct.product_variants.length > 0 && (
                              <div className="mt-1 flex items-center gap-1.5 pl-0.5">
                                <span className="text-[8.5px] text-slate-400 font-black uppercase">Variant:</span>
                                <select
                                  value={item.matchedVariantId || ""}
                                  onChange={(e) => {
                                    const newItems = [...parsedData.items];
                                    newItems[idx].matchedVariantId = e.target.value;
                                    setParsedData({ ...parsedData, items: newItems });
                                  }}
                                  className="h-5 px-1 bg-indigo-50/50 border border-indigo-100 rounded text-[9.5px] font-black text-indigo-750 cursor-pointer focus:outline-none"
                                >
                                  <option value="">Base Unit ({matchedProduct.unit || "unit"})</option>
                                  {matchedProduct.product_variants.map(v => (
                                    <option key={v.id} value={v.id}>{v.packing_name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </td>
                          
                          {/* Batch Number */}
                          {isPharmacyOrAgri && (
                            <td className="py-3 px-4 text-center">
                              <input
                                type="text"
                                placeholder="e.g. B101"
                                value={item.batchNumber || ""}
                                onChange={(e) => {
                                  const newItems = [...parsedData.items];
                                  newItems[idx].batchNumber = e.target.value;
                                  setParsedData({ ...parsedData, items: newItems });
                                }}
                                className="w-20 h-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-bold text-slate-800 focus:outline-none"
                              />
                            </td>
                          )}

                          {/* Expiry Date */}
                          {isPharmacyOrAgri && (
                            <td className="py-3 px-4 text-center">
                              <input
                                type="date"
                                value={item.expiryDate || ""}
                                onChange={(e) => {
                                  const newItems = [...parsedData.items];
                                  newItems[idx].expiryDate = e.target.value;
                                  setParsedData({ ...parsedData, items: newItems });
                                }}
                                className="w-32 h-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-[10px] font-bold text-slate-800 focus:outline-none"
                              />
                            </td>
                          )}

                          {/* Editable parsed qty */}
                          <td className="py-3 px-2 text-center">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const newItems = [...parsedData.items];
                                newItems[idx].quantity = Math.max(0, parseFloat(e.target.value) || 0);
                                newItems[idx].total = Math.max(0, (newItems[idx].quantity * newItems[idx].rate) - (newItems[idx].discount || 0));
                                setParsedData({ ...parsedData, items: newItems });
                              }}
                              className="w-11 h-7 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs font-bold text-slate-800"
                            />
                          </td>

                          {/* Bonus Qty (Free) */}
                          {isPharmacyOrAgri && (
                            <td className="py-3 px-2 text-center">
                              <input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={item.bonusQty || ""}
                                onChange={(e) => {
                                  const newItems = [...parsedData.items];
                                  newItems[idx].bonusQty = Math.max(0, parseInt(e.target.value, 10) || 0);
                                  setParsedData({ ...parsedData, items: newItems });
                                }}
                                className="w-10 h-7 bg-purple-50/70 border border-purple-200 text-purple-900 font-bold rounded-lg text-center text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
                              />
                            </td>
                          )}
                          
                          {/* Cost (Purchase unit price) */}
                          <td className="py-3 px-2 text-right">
                            <input
                              type="number"
                              value={Math.round(item.rate)}
                              onChange={(e) => {
                                const newItems = [...parsedData.items];
                                const rateVal = Math.max(0, parseFloat(e.target.value) || 0);
                                newItems[idx].rate = rateVal;
                                newItems[idx].total = Math.max(0, (newItems[idx].quantity * rateVal) - (newItems[idx].discount || 0));
                                newItems[idx].salePrice = Math.round(rateVal * (1 + pricingMargin / 100));
                                setParsedData({ ...parsedData, items: newItems });
                              }}
                              className="w-14 h-8 bg-slate-50 border border-slate-200 rounded-xl text-right px-1.5 text-xs font-bold text-slate-800 focus:outline-none"
                            />
                          </td>

                          {/* Extra Line Discount (Rs) */}
                          <td className="py-3 px-2 text-right">
                            <input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={item.discount || ""}
                              onChange={(e) => {
                                const newItems = [...parsedData.items];
                                const discVal = Math.max(0, parseFloat(e.target.value) || 0);
                                newItems[idx].discount = discVal;
                                newItems[idx].total = Math.max(0, (newItems[idx].quantity * newItems[idx].rate) - discVal);
                                setParsedData({ ...parsedData, items: newItems });
                              }}
                              className="w-14 h-8 bg-emerald-50/70 border border-emerald-200 text-emerald-950 font-bold rounded-xl text-right px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                            />
                          </td>

                          {/* Tax % Input */}
                          <td className="py-3 px-2 text-center">
                            <input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={item.taxPercent || ""}
                              onChange={(e) => {
                                const newItems = [...parsedData.items];
                                newItems[idx].taxPercent = Math.max(0, parseFloat(e.target.value) || 0);
                                setParsedData({ ...parsedData, items: newItems });
                              }}
                              className="w-10 h-7 bg-blue-50/70 border border-blue-200 text-blue-900 font-bold rounded-lg text-center text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </td>

                          {/* Retail (Sale Price) */}
                          <td className="py-3 px-2 text-right">
                            <input
                              type="number"
                              value={Math.round(item.salePrice || item.rate * (1 + pricingMargin / 100))}
                              onChange={(e) => {
                                const newItems = [...parsedData.items];
                                newItems[idx].salePrice = Math.max(0, parseFloat(e.target.value) || 0);
                                setParsedData({ ...parsedData, items: newItems });
                              }}
                              className="w-14 h-8 bg-slate-50 border border-slate-200 rounded-xl text-right px-1.5 text-xs font-bold text-slate-800 focus:outline-none"
                            />
                          </td>

                          {/* Profit % Editable Input */}
                          <td className="py-3 px-2 text-center">
                            {(() => {
                              const effCost = item.rate;
                              const currentSale = item.salePrice || item.rate * (1 + pricingMargin / 100);
                              const marginPct = effCost > 0 ? Math.round(((currentSale - effCost) / effCost) * 100) : 0;
                              return (
                                <input
                                  type="number"
                                  value={marginPct}
                                  onChange={(e) => {
                                    const newMargin = parseFloat(e.target.value) || 0;
                                    const newSalePrice = Math.round(effCost * (1 + newMargin / 100));
                                    const newItems = [...parsedData.items];
                                    newItems[idx].salePrice = newSalePrice;
                                    setParsedData({ ...parsedData, items: newItems });
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  className="w-10 h-7 bg-purple-50/70 border border-purple-200 text-purple-900 font-bold rounded-lg text-center text-xs focus:outline-none focus:ring-1 focus:ring-purple-400"
                                />
                              );
                            })()}
                          </td>
                          
                          {/* Line total */}
                          <td className="py-3 px-3 text-right font-black text-slate-850 font-mono">
                            Rs {Math.round(item.total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-black text-slate-650 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportToCart}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-500/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} /> Import to Purchase Cart
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
