"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, Store, Printer, User, Shield, 
  Loader2, Save, RefreshCw, Eye, Check,
  Palette, Type, Sliders, Layout, FileText, Globe, Clock
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { logAudit } from "@/utils/audit";
import { Input } from "@/components/ui/input";
import { 
  ReceiptTemplate, 
  ReceiptSettings, 
  DEFAULT_RECEIPT_SETTINGS, 
  SAMPLE_PREVIEW_INVOICE, 
  RECEIPT_TEMPLATES 
} from "@/components/ReceiptTemplate";
import { printReceiptDirect } from "@/lib/thermalPrinter";
import { SidebarThemeSettingsPanel } from "@/components/dashboard/SidebarThemeSettingsPanel";
import { POPULAR_TIMEZONES, getCurrentTimezonePreview } from "@/lib/timezone";

export default function SettingsPage() {
  const { shopId, userId, userName, shopName, userRole, refreshShopData } = useShop();
  const { t } = useLanguage();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "receipt" | "appearance">("profile");
  const [geminiKeys, setGeminiKeys] = useState("");

  // Shop Details Form State
  const [shopDetails, setShopDetails] = useState({
    id: "",
    name: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    kitchen_printer_name: "",
    customer_printer_name: "",
  });
  const [windowsPrinters, setWindowsPrinters] = useState<string[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  // Industry Type State
  const [industryTypeVal, setIndustryTypeVal] = useState("general");
  const [allowNegativeStockVal, setAllowNegativeStockVal] = useState(false);
  const [hasEmiVal, setHasEmiVal] = useState(false);
  const [hasPayrollVal, setHasPayrollVal] = useState(false);
  const [hasTaxVal, setHasTaxVal] = useState(false);
  const [defaultTaxRateVal, setDefaultTaxRateVal] = useState(0);
  const [defaultTaxTypeVal, setDefaultTaxTypeVal] = useState("percentage");
  const [hasAssetsRecVal, setHasAssetsRecVal] = useState(false);
  const [hasLoyaltyVal, setHasLoyaltyVal] = useState(true);
  const [hasGiftCardsVal, setHasGiftCardsVal] = useState(true);
  const [hasEcommerceVal, setHasEcommerceVal] = useState(false);
  const [storeSlugVal, setStoreSlugVal] = useState("");
  const [storeTaglineVal, setStoreTaglineVal] = useState("");
  const [deliveryChargesVal, setDeliveryChargesVal] = useState(0);

  // Print Settings & Design customizer state
  const [printSettingsId, setPrintSettingsId] = useState("");
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS);

  // FBR Digital Invoicing State
  const [enableFbrVal, setEnableFbrVal] = useState(false);
  const [fbrPosIdVal, setFbrPosIdVal] = useState("");
  const [fbrNtnVal, setFbrNtnVal] = useState("");
  const [fbrTokenVal, setFbrTokenVal] = useState("");
  const [fbrEnvironmentVal, setFbrEnvironmentVal] = useState<"sandbox" | "production">("sandbox");
  const [fbrSalesTaxRateVal, setFbrSalesTaxRateVal] = useState(18);
  const [showFbrQrCodeVal, setShowFbrQrCodeVal] = useState(true);
  const [fbrTestLoading, setFbrTestLoading] = useState(false);
  const [fbrTestResult, setFbrTestResult] = useState<{ status: "idle" | "success" | "error"; message: string } | null>(null);
  
  // Multilingual active settings state
  const [activeLangs, setActiveLangs] = useState<string[]>(["en", "ur"]);
  const [billingLang, setBillingLang] = useState<string>("en");
  const [selectedCurrencyVal, setSelectedCurrencyVal] = useState<string>("PKR");
  const [selectedTimezoneVal, setSelectedTimezoneVal] = useState<string>("auto");
  const [showCostPriceOnPosVal, setShowCostPriceOnPosVal] = useState<boolean>(false);

  // Common accent colors
  const colorPresets = [
    { value: "#000000", name: "Classic Charcoal" },
    { value: "#3b82f6", name: "Sapphire Blue" },
    { value: "#10b981", name: "Emerald Green" },
    { value: "#f59e0b", name: "Amber Gold" },
    { value: "#ef4444", name: "Crimson Red" },
    { value: "#6366f1", name: "Deep Indigo" },
    { value: "#ec4899", name: "Rose Pink" }
  ];

  useEffect(() => {
    if (shopId) {
      fetchSettings();
      if (typeof window !== "undefined") {
        const savedKeys = localStorage.getItem(`user_gemini_api_keys_${shopId}`);
        if (savedKeys) setGeminiKeys(savedKeys);
      }
    }
  }, [shopId]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // Fetch shop details for industry type, negative stock, phone, address and has_emi settings
      const { data: shopRow, error: shopRowError } = await supabase
        .from("shops")
        .select("name, phone, address, industry_type, allow_negative_stock, has_emi, has_payroll, has_tax, default_tax_rate, default_tax_type, has_assets_rec, has_loyalty, has_gift_cards, has_ecommerce, store_slug, store_tagline, delivery_fee, delivery_charges")
        .eq("id", shopId)
        .single();

      // 1. Fetch Company/Shop details
      const { data: company, error: companyError } = await supabase
        .from("company_details")
        .select("id, name, address, phone, email, website, kitchen_printer_name, customer_printer_name, printer_name, logo_path")
        .eq("shop_id", shopId)
        .maybeSingle();

      if (companyError) throw companyError;
      if (company) {
        setShopDetails({
          ...company,
          name: company.name || shopRow?.name || shopName || "",
          phone: company.phone || shopRow?.phone || "",
          address: company.address || shopRow?.address || "",
          kitchen_printer_name:
            (company as { kitchen_printer_name?: string }).kitchen_printer_name ||
            (company as { printer_name?: string }).printer_name ||
            "",
          customer_printer_name:
            (company as { customer_printer_name?: string }).customer_printer_name || "",
        });
      } else {
        setShopDetails(prev => ({
          ...prev,
          name: shopRow?.name || shopName || "",
          phone: shopRow?.phone || "",
          address: shopRow?.address || "",
        }));
      }

      if (!shopRowError && shopRow) {
        setIndustryTypeVal(shopRow.industry_type || "general");
        setAllowNegativeStockVal(!!shopRow.allow_negative_stock);
        setHasEmiVal(!!shopRow.has_emi);
        setHasPayrollVal(!!shopRow.has_payroll);
        setHasTaxVal(!!shopRow.has_tax);
        setDefaultTaxRateVal(Number(shopRow.default_tax_rate || 0));
        setDefaultTaxTypeVal(shopRow.default_tax_type || "percentage");
        setHasAssetsRecVal(!!shopRow.has_assets_rec);
        setHasLoyaltyVal(shopRow.has_loyalty !== false);
        setHasGiftCardsVal(shopRow.has_gift_cards !== false);
        setHasEcommerceVal(!!shopRow.has_ecommerce);
        if (shopRow.store_slug) setStoreSlugVal(shopRow.store_slug);
        if (shopRow.store_tagline) setStoreTaglineVal(shopRow.store_tagline);
        
      }

      // 2. Fetch print settings including new receipt_design_settings JSONB field
      const { data: print, error: printError } = await supabase
        .from("print_settings")
        .select("id, receipt_page_size, receipt_font, receipt_font_size, receipt_design_settings")
        .eq("shop_id", shopId)
        .maybeSingle();

      if (printError) throw printError;
      if (print) {
        setPrintSettingsId(print.id);
        
        // Merge Supabase stored custom settings with defaults
        const storedCustomSettings = (print.receipt_design_settings as any) || {};
        const mergedReceipt = {
          ...DEFAULT_RECEIPT_SETTINGS,
          pageSize: (print.receipt_page_size as any) || DEFAULT_RECEIPT_SETTINGS.pageSize,
          fontFamily: print.receipt_font || DEFAULT_RECEIPT_SETTINGS.fontFamily,
          fontSize: print.receipt_font_size || DEFAULT_RECEIPT_SETTINGS.fontSize,
          ...storedCustomSettings
        };
        setReceiptSettings(mergedReceipt);
        if (
          storedCustomSettings.kitchenPrinterName ||
          storedCustomSettings.customerPrinterName
        ) {
          setShopDetails((prev) => ({
            ...prev,
            kitchen_printer_name:
              prev.kitchen_printer_name ||
              String(storedCustomSettings.kitchenPrinterName || ""),
            customer_printer_name:
              prev.customer_printer_name ||
              String(storedCustomSettings.customerPrinterName || ""),
          }));
        }
        setActiveLangs(storedCustomSettings.activeLanguages || ["en", "ur"]);
        setBillingLang(storedCustomSettings.billingLanguage || "en");
        setSelectedCurrencyVal(storedCustomSettings.selectedCurrency || "PKR");
        setSelectedTimezoneVal(storedCustomSettings.timezone || "auto");

        // Load FBR Settings
        setEnableFbrVal(!!storedCustomSettings.enableFBR);
        setShowCostPriceOnPosVal(
          storedCustomSettings.showCostPriceOnPos === true ||
          (typeof window !== "undefined" && shopId ? localStorage.getItem(`theaccounts_show_cost_price_on_pos_${shopId}`) === "true" : false)
        );
        setFbrPosIdVal(storedCustomSettings.fbrPosId || "");
        setFbrNtnVal(storedCustomSettings.fbrNtnStrn || "");
        setFbrTokenVal(storedCustomSettings.fbrAuthToken || "");
        setFbrEnvironmentVal(storedCustomSettings.fbrEnvironment || "sandbox");
        setFbrSalesTaxRateVal(Number(storedCustomSettings.fbrSalesTaxRate || 18));
        setShowFbrQrCodeVal(storedCustomSettings.showFbrQrCode !== false);
      } else {
        setReceiptSettings(DEFAULT_RECEIPT_SETTINGS);
        setActiveLangs(["en", "ur"]);
        setBillingLang("en");
        setSelectedCurrencyVal("PKR");
        setSelectedTimezoneVal("auto");
        setEnableFbrVal(false);
        setFbrPosIdVal("");
        setFbrNtnVal("");
        setFbrTokenVal("");
        setFbrEnvironmentVal("sandbox");
        setFbrSalesTaxRateVal(18);
        setShowFbrQrCodeVal(true);
      }
    } catch (err: any) {
      toast.error("Failed to load settings: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestFbrConnection = async () => {
    setFbrTestLoading(true);
    setFbrTestResult(null);
    try {
      const res = await fetch("/api/fbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isTestPing: true,
          fbrPosId: fbrPosIdVal || "100001",
          fbrAuthToken: fbrTokenVal,
          fbrEnvironment: fbrEnvironmentVal
        })
      });
      const data = await res.json();
      if (data.success) {
        setFbrTestResult({
          status: "success",
          message: data.data?.message || "FBR connection verified successfully!"
        });
        toast.success(data.data?.message || "FBR connection verified!");
      } else {
        setFbrTestResult({
          status: "error",
          message: data.error?.message || "FBR connection failed."
        });
        toast.error(data.error?.message || "FBR connection failed.");
      }
    } catch (err: any) {
      setFbrTestResult({
        status: "error",
        message: err.message || "Failed to reach FBR gateway."
      });
      toast.error("Failed to connect to FBR: " + err.message);
    } finally {
      setFbrTestLoading(false);
    }
  };

  const handleSaveGeminiKeys = (val: string) => {
    setGeminiKeys(val);
    if (typeof window !== "undefined" && shopId) {
      localStorage.setItem(`user_gemini_api_keys_${shopId}`, val);
    }
  };

  const refreshWindowsPrinters = async () => {
    setLoadingPrinters(true);
    try {
      const res = await fetch("/api/restaurant/thermal-print");
      const data = (await res.json()) as {
        ok?: boolean;
        printers?: string[];
        note?: string;
        error?: string;
      };
      if (data.ok && Array.isArray(data.printers)) {
        setWindowsPrinters(data.printers);
        toast.success(
          data.printers.length
            ? `${data.printers.length} Windows printer(s) loaded`
            : "No printers found - check Windows Printers & scanners"
        );
      } else {
        toast.message(
          data.note ||
            data.error ||
            "List printers from the local Windows POS machine (npm run dev on shop PC)."
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Could not load printers: " + msg);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const handleSaveShopDetails = async () => {
    setIsSubmitting(true);
    try {
      // 1. Update shops table for name, industry type, allow_negative_stock, and has_emi
      const { error: shopUpdateError } = await supabase
        .from("shops")
        .update({ 
          name: shopDetails.name, 
          industry_type: industryTypeVal,
          allow_negative_stock: allowNegativeStockVal,
          has_emi: industryTypeVal === "crockery" ? hasEmiVal : (industryTypeVal === "electronics" ? true : false),
          has_payroll: hasPayrollVal,
          has_tax: hasTaxVal,
          default_tax_rate: Number(defaultTaxRateVal) || 0,
          default_tax_type: defaultTaxTypeVal,
          has_assets_rec: hasAssetsRecVal,
          has_loyalty: hasLoyaltyVal,
          has_gift_cards: hasGiftCardsVal,
          has_ecommerce: hasEcommerceVal,
          store_slug: storeSlugVal ? storeSlugVal.toLowerCase().replace(/[^a-z0-9-]/g, "") : null,
          store_tagline: storeTaglineVal,
          delivery_fee: Number(deliveryChargesVal) || 0,
          delivery_charges: Number(deliveryChargesVal) || 0
        })
        .eq("id", shopId);

      if (shopUpdateError) throw shopUpdateError;

      // 2. Save company details
      const dbPayload = {
        shop_id: shopId,
        name: shopDetails.name,
        address: shopDetails.address || null,
        phone: shopDetails.phone || null,
        email: shopDetails.email || null,
        website: shopDetails.website || null,
        kitchen_printer_name: shopDetails.kitchen_printer_name?.trim() || null,
        customer_printer_name: shopDetails.customer_printer_name?.trim() || null,
        printer_name: shopDetails.kitchen_printer_name?.trim() || null,
      };

      if (shopDetails.id) {
        // Update company_details
        const { error } = await supabase
          .from("company_details")
          .update(dbPayload)
          .eq("id", shopDetails.id);

        if (error) throw error;
      } else {
        // Insert company_details
        const { data, error } = await supabase
          .from("company_details")
          .insert(dbPayload)
          .select()
          .single();

        if (error) throw error;
        setShopDetails(prev => ({ ...prev, id: data.id }));
      }

      // Also sync shops table phone & address
      if (shopId) {
        await supabase
          .from("shops")
          .update({
            name: dbPayload.name,
            phone: dbPayload.phone,
            address: dbPayload.address,
          })
          .eq("id", shopId);
      }

      // 3. Save receipt design settings with FBR parameters
      const updatedReceiptSettings: ReceiptSettings = {
        ...receiptSettings,
        kitchenPrinterName: shopDetails.kitchen_printer_name?.trim() || "",
        customerPrinterName: shopDetails.customer_printer_name?.trim() || "",
        enableFBR: enableFbrVal,
        showCostPriceOnPos: showCostPriceOnPosVal,
        fbrPosId: fbrPosIdVal,
        fbrNtnStrn: fbrNtnVal,
        fbrAuthToken: fbrTokenVal,
        fbrEnvironment: fbrEnvironmentVal,
        fbrSalesTaxRate: fbrSalesTaxRateVal,
        showFbrQrCode: showFbrQrCodeVal
      };
      setReceiptSettings(updatedReceiptSettings);
      if (typeof window !== "undefined" && shopId) {
        localStorage.setItem(`theaccounts_show_cost_price_on_pos_${shopId}`, String(showCostPriceOnPosVal));
      }

      if (printSettingsId) {
        await supabase
          .from("print_settings")
          .update({
            receipt_design_settings: updatedReceiptSettings
          })
          .eq("id", printSettingsId);
      }
      await supabase
        .from("shops")
        .update({
          receipt_design_settings: updatedReceiptSettings
        })
        .eq("id", shopId);

      logAudit(
        shopId!,
        userId,
        "SHOP_SETTINGS_UPDATED",
        "company_details",
        shopDetails.id || "new",
        {
          name: shopDetails.name,
          phone: shopDetails.phone,
          address: shopDetails.address,
          fbr_enabled: enableFbrVal
        }
      );

      toast.success("Shop, FBR and Pharmacy settings updated successfully!");
      await refreshShopData();
    } catch (err: any) {
      toast.error("Error saving shop details: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      toast.error("Logo image file size must be less than 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setReceiptSettings(prev => ({
        ...prev,
        logoUrl: base64String
      }));
      toast.success("Logo file loaded successfully!");
    };
    reader.onerror = () => {
      toast.error("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveReceiptSettings = async () => {
    setIsSubmitting(true);
    try {
      const dbPayload = {
        shop_id: shopId,
        receipt_page_size: receiptSettings.pageSize,
        receipt_font: receiptSettings.fontFamily,
        receipt_font_size: Number(receiptSettings.fontSize),
        receipt_design_settings: receiptSettings // Save the whole JSON object
      };

      if (printSettingsId) {
        // Update print_settings
        const { error } = await supabase
          .from("print_settings")
          .update(dbPayload)
          .eq("id", printSettingsId);

        if (error) throw error;
      } else {
        // Insert print_settings
        const { data, error } = await supabase
          .from("print_settings")
          .insert(dbPayload)
          .select()
          .single();

        if (error) throw error;
        setPrintSettingsId(data.id);
      }

      logAudit(
        shopId!,
        userId,
        "RECEIPT_SETTINGS_UPDATED",
        "company_details",
        shopDetails.id || "settings",
        {
          receipt_settings: receiptSettings
        }
      );

      toast.success("Receipt design configurations saved successfully!");
    } catch (err: any) {
      toast.error("Error saving receipt settings: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActiveLang = (langKey: string) => {
    if (activeLangs.includes(langKey)) {
      setActiveLangs(activeLangs.filter(l => l !== langKey));
    } else {
      setActiveLangs([...activeLangs, langKey]);
    }
  };

  const handleSaveLanguageSettings = async () => {
    setIsSubmitting(true);
    const toastId = toast.loading("Saving language settings...");
    try {
      const updatedDesignSettings = {
        ...receiptSettings,
        activeLanguages: activeLangs,
        billingLanguage: billingLang,
        selectedCurrency: selectedCurrencyVal,
        timezone: selectedTimezoneVal
      };

      const dbPayload = {
        shop_id: shopId,
        receipt_page_size: receiptSettings.pageSize,
        receipt_font: receiptSettings.fontFamily,
        receipt_font_size: Number(receiptSettings.fontSize),
        receipt_design_settings: updatedDesignSettings
      };

      if (printSettingsId) {
        await supabase
          .from("print_settings")
          .update(dbPayload)
          .eq("id", printSettingsId);
      } else {
        const { data, error } = await supabase
          .from("print_settings")
          .insert(dbPayload)
          .select()
          .single();
        if (error) throw error;
        if (data) setPrintSettingsId(data.id);
      }

      setReceiptSettings(updatedDesignSettings);
      
      // Refresh context cache
      if (refreshShopData) {
        await refreshShopData();
      }

      logAudit(
        shopId!,
        userId,
        "LANGUAGE_SETTINGS_UPDATED",
        "company_details",
        shopDetails.id || "settings",
        {
          active_languages: activeLangs,
          billing_language: billingLang,
          selected_currency: selectedCurrencyVal,
          timezone: selectedTimezoneVal
        }
      );

      toast.success("Language configurations saved successfully!", { id: toastId });
    } catch (err: any) {
      toast.error("Failed to save: " + err.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger direct thermal print for the preview sample
  const handlePrintSample = () => {
    const printContent = document.getElementById("receipt-preview-container")?.innerHTML;
    if (!printContent) return;

    printReceiptDirect({
      receiptHtml: printContent,
      settings: receiptSettings,
      title: "Sample Receipt Print - The Accounts",
      onSuccess: () => {
        toast.success("Printing sample receipt on default printer...");
      },
      onError: (err) => {
        toast.error("Printing failed: " + ((err as any)?.message || "Check printer connection"));
      }
    });
  };

  if (loading) {
    return (
      <div className="h-[50vh] flex flex-col justify-center items-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mb-2 text-blue-500" />
        <p>Loading configuration settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans pb-16">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 border-b border-slate-200 pb-5">
        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 max-w-fit flex-wrap">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "profile" 
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Store size={14} /> {t("shop_profile")}
          </button>
          <button
            onClick={() => setActiveTab("receipt")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "receipt" 
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Printer size={14} /> {t("receipt_designer")}
          </button>
          <button
            onClick={() => setActiveTab("appearance")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "appearance"
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/50"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Palette size={14} /> {t("appearance")}
          </button>
        </div>
      </div>

      {/* Period Closing Quick Access Banner */}
      <a
        href="/dashboard/settings/closing"
        className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/70 rounded-2xl px-5 py-4 hover:from-indigo-100 hover:to-purple-100 transition-all group cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-indigo-900">{t("period_closing_banner")}</p>
            <p className="text-xs text-indigo-600 font-medium mt-0.5">{t("period_closing_desc")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-indigo-600 text-xs font-bold group-hover:translate-x-1 transition-transform">
          {t("open_wizard")} <div className="text-lg leading-none">→</div>
        </div>
      </a>

      <AnimatePresence mode="wait">
        {activeTab === "profile" ? (
          <motion.div
            key="profile-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 xl:grid-cols-2 gap-6"
          >
            {/* Card 1: Shop/Company Details */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Store className="text-blue-500" size={18} /> {t("shop_profile_settings")}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{t("business_shop_name")}</label>
                  <Input 
                    value={shopDetails.name} 
                    onChange={(e) => setShopDetails({ ...shopDetails, name: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{t("business_industry_type")}</label>
                  <select
                    value={industryTypeVal}
                    onChange={(e) => setIndustryTypeVal(e.target.value)}
                    className="w-full bg-white border border-slate-200 h-10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
                  >
                    <option value="karyana">Grocery / Karyana Store</option>
                    <option value="tailor">Tailors & Stitching Shop</option>
                    <option value="fuel">Petrol Pump / Fuel station</option>
                    <option value="pharmacy">Pharmacy & Medical Store</option>
                    <option value="showroom">Car Showroom & Vehicle Fleet</option>
                    <option value="fertilizer">Fertilizers, Seeds & Pesticides</option>
                    <option value="hardware">Hardware & Sanitary Store</option>
                    <option value="restaurant">Restaurant & Cafe</option>
                    <option value="electronics">Electronics & Mobile Repair/EMI</option>
                    <option value="crockery">Crockery Store</option>
                    <option value="garments">Garments Boutique & Apparel</option>
                    <option value="general">General Retail & Other Shops</option>
                  </select>
                </div>

                <div className="flex items-center gap-2.5 py-2.5 px-3 bg-slate-50 border border-slate-200/50 rounded-xl">
                  <input
                    type="checkbox"
                    id="allow_negative_stock"
                    checked={allowNegativeStockVal}
                    onChange={(e) => setAllowNegativeStockVal(e.target.checked)}
                    className="w-4.5 h-4.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="allow_negative_stock" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                    {t("allow_negative_stock_billing")}
                  </label>
                </div>

                <div className="flex items-center justify-between py-3 px-3.5 bg-gradient-to-r from-amber-50/70 to-slate-50 border border-amber-200/60 rounded-2xl hover:border-amber-300 transition-all shadow-2xs">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="show_cost_price_on_pos_toggle"
                      checked={showCostPriceOnPosVal}
                      onChange={(e) => setShowCostPriceOnPosVal(e.target.checked)}
                      className="w-4.5 h-4.5 text-amber-600 border-slate-300 rounded focus:ring-amber-500 cursor-pointer mt-0.5 accent-amber-600"
                    />
                    <div>
                      <label htmlFor="show_cost_price_on_pos_toggle" className="text-xs font-black text-slate-850 cursor-pointer select-none flex items-center gap-1.5 flex-wrap">
                        <div>💰 Show Purchase / Cost Price on POS</div>
                      </label>
                      <p className="text-[10.5px] text-slate-500 mt-0.5 leading-relaxed">
                        Displays wholesale purchase price & profit margin badges on POS product cards and cart line items so cashiers know exact margins when giving discounts.
                      </p>
                    </div>
                  </div>
                  <div className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 border ${showCostPriceOnPosVal ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-slate-200 text-slate-600 border-slate-300"}`}>
                    {showCostPriceOnPosVal ? "Enabled" : "Off"}
                  </div>
                </div>

                {industryTypeVal === "crockery" && (
                  <div className="flex items-center gap-2.5 py-2.5 px-3 bg-blue-50/50 border border-blue-200/50 rounded-xl">
                    <input
                      type="checkbox"
                      id="has_emi_toggle"
                      checked={hasEmiVal}
                      onChange={(e) => setHasEmiVal(e.target.checked)}
                      className="w-4.5 h-4.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="has_emi_toggle" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      {t("enable_emi_module")}
                    </label>
                  </div>
                )}

                {industryTypeVal === "restaurant" && (
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200/80 p-4 rounded-2xl space-y-3 mt-2">
                    <div className="flex items-center justify-between gap-2 border-b border-orange-200/70 pb-2">
                      <div>
                        <h4 className="text-sm font-black text-orange-950 flex items-center gap-2">
                          🍽️ Restaurant thermal printers (POSRESTURANT style)
                        </h4>
                        <p className="text-[11px] text-orange-900/90 font-medium leading-relaxed mt-0.5">
                          KOT → kitchen printer. Guest bill & payment slip → customer printer (blank = Windows default).
                          Receipt header uses company name / phone / address below.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={refreshWindowsPrinters}
                        disabled={loadingPrinters}
                        className="text-[10px] font-black uppercase tracking-wide px-3 py-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60"
                      >
                        {loadingPrinters ? "…" : "Load printers"}
                      </button>
                    </div>
                    <datalist id="windows-printer-list">
                      {windowsPrinters.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                    <div>
                      <label className="block text-xs font-semibold text-orange-900 uppercase mb-1.5">
                        Kitchen / KOT printer name
                      </label>
                      <Input
                        list="windows-printer-list"
                        value={shopDetails.kitchen_printer_name}
                        onChange={(e) =>
                          setShopDetails({
                            ...shopDetails,
                            kitchen_printer_name: e.target.value,
                          })
                        }
                        placeholder="e.g. Kitchen 80mm - same as POSRESTURANT Business Details → Printer"
                        className="h-10 rounded-xl font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-orange-900 uppercase mb-1.5">
                        Customer slip printer (guest bill + paid receipt)
                      </label>
                      <Input
                        list="windows-printer-list"
                        value={shopDetails.customer_printer_name}
                        onChange={(e) =>
                          setShopDetails({
                            ...shopDetails,
                            customer_printer_name: e.target.value,
                          })
                        }
                        placeholder="Leave empty for Windows default printer"
                        className="h-10 rounded-xl font-mono text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Pharmacy / Medical Store Special POS & Receipt Settings */}
                {(industryTypeVal === "pharmacy" || industryTypeVal === "medical" || industryTypeVal === "health") && (
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300/80 p-4.5 rounded-2xl space-y-3.5 mt-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="text-xl">🏥</div>
                        <div>
                          <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                            Medical Store & Pharmacy Settings
                          </h4>
                          <p className="text-[11px] text-emerald-800 font-medium">Configure FEFO batch printing, expiry dates, and shelf locations on receipts.</p>
                        </div>
                      </div>
                      <div className="text-[10px] font-extrabold bg-emerald-200/90 text-emerald-900 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Pharmacy POS
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2.5">
                      <label className="flex items-center gap-3 p-3 bg-white border border-emerald-200 rounded-xl cursor-pointer shadow-2xs hover:bg-emerald-50/60 transition-all group">
                        <input 
                          type="checkbox"
                          checked={receiptSettings.showBatchNumber !== false}
                          onChange={(e) => setReceiptSettings(prev => ({ ...prev, showBatchNumber: e.target.checked }))}
                          className="w-4.5 h-4.5 text-emerald-600 rounded cursor-pointer accent-emerald-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-900 group-hover:text-emerald-900">Show Batch Number on Receipt</p>
                          </div>
                          <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">Prints Batch: [BatchNo] under each medicine line for batch tracing.</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 bg-white border border-emerald-200 rounded-xl cursor-pointer shadow-2xs hover:bg-emerald-50/60 transition-all group">
                        <input 
                          type="checkbox"
                          checked={receiptSettings.showExpiryDate !== false}
                          onChange={(e) => setReceiptSettings(prev => ({ ...prev, showExpiryDate: e.target.checked }))}
                          className="w-4.5 h-4.5 text-emerald-600 rounded cursor-pointer accent-emerald-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-900 group-hover:text-emerald-900">Show Expiry Date on Receipt</p>
                          </div>
                          <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">Prints Exp: [MM/YYYY] on customer bills for patient safety & DLD compliance.</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 bg-white border border-amber-200 rounded-xl cursor-pointer shadow-2xs hover:bg-amber-50/60 transition-all group">
                        <input 
                          type="checkbox"
                          checked={!!receiptSettings.showShelfLocation}
                          onChange={(e) => setReceiptSettings(prev => ({ ...prev, showShelfLocation: e.target.checked }))}
                          className="w-4.5 h-4.5 text-amber-600 rounded cursor-pointer accent-amber-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-900 group-hover:text-amber-950">Show Shelf / Rack Location on Receipt</p>
                          </div>
                          <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">Prints Shelf: [Rack/Shelf] to help pharmacy staff pick packs quickly.</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 bg-white border border-red-200 rounded-xl cursor-pointer shadow-2xs hover:bg-red-50/60 transition-all group">
                        <input 
                          type="checkbox"
                          checked={receiptSettings.mandatoryControlledDrugForm !== false}
                          onChange={(e) => setReceiptSettings(prev => ({ ...prev, mandatoryControlledDrugForm: e.target.checked }))}
                          className="w-4.5 h-4.5 text-red-600 rounded cursor-pointer accent-red-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-900 group-hover:text-red-950">Auto-Prompt Schedule G / Controlled Drug Form on Sale</p>
                          </div>
                          <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">When selling sleeping pills, sedatives or controlled drugs in POS, prompts prescription & patient CNIC form before finalizing the bill.</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* 🇵🇰 FBR Tier-1 POS Digital Invoicing Integration Card */}
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-400 p-5 rounded-2xl space-y-4 mt-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">🇵🇰</div>
                      <div>
                        <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                          FBR Digital Invoicing &amp; Tax Compliance
                        </h4>
                        <p className="text-[11px] text-emerald-800 font-medium">
                          Federal Board of Revenue (FBR) Pakistan Tier-1 POS compliance with live QR barcodes &amp; USIN verification.
                        </p>
                      </div>
                    </div>
                    <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                      enableFbrVal ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-200 text-slate-600"
                    }`}>
                      {enableFbrVal ? "FBR Active" : "Disabled"}
                    </div>
                  </div>

                  {/* Main FBR Switch Checkbox */}
                  <label className="flex items-center gap-3 p-3.5 bg-white border-2 border-emerald-300/80 rounded-xl cursor-pointer shadow-xs hover:bg-emerald-50/50 transition-all">
                    <input 
                      type="checkbox"
                      id="enable_fbr_toggle"
                      checked={enableFbrVal}
                      onChange={(e) => {
                        setEnableFbrVal(e.target.checked);
                        setReceiptSettings(prev => ({ ...prev, enableFBR: e.target.checked }));
                      }}
                      className="w-5 h-5 text-emerald-600 rounded cursor-pointer accent-emerald-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-900">
                          Enable FBR Digital Invoicing on all POS Terminals &amp; Receipts
                        </p>
                      </div>
                      <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">
                        Automatically generates FBR compliant USIN numbers, Sales Tax calculations, and Tax Asaan verification QR codes.
                      </p>
                    </div>
                  </label>

                  {/* Expanded FBR Configuration Settings */}
                  {enableFbrVal && (
                    <div className="space-y-3.5 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {/* POS ID */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            FBR POS ID <div className="text-rose-500">*</div>
                          </label>
                          <Input 
                            placeholder="e.g. 104523"
                            value={fbrPosIdVal}
                            onChange={(e) => {
                              setFbrPosIdVal(e.target.value);
                              setReceiptSettings(prev => ({ ...prev, fbrPosId: e.target.value }));
                            }}
                            className="h-9 rounded-xl font-mono font-bold bg-white text-xs"
                          />
                          <p className="text-[10px] text-slate-400 mt-0.5">Assigned by FBR during POS registration.</p>
                        </div>

                        {/* Business NTN / STRN */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Business NTN / STRN
                          </label>
                          <Input 
                            placeholder="e.g. 1234567-8"
                            value={fbrNtnVal}
                            onChange={(e) => {
                              setFbrNtnVal(e.target.value);
                              setReceiptSettings(prev => ({ ...prev, fbrNtnStrn: e.target.value }));
                            }}
                            className="h-9 rounded-xl font-mono font-bold bg-white text-xs"
                          />
                          <p className="text-[10px] text-slate-400 mt-0.5">National Tax Number / Sales Tax Registration.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {/* FBR Auth Token */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            FBR Bearer Auth Token
                          </label>
                          <Input 
                            type="password"
                            placeholder="e.g. 7f3b89a1-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            value={fbrTokenVal}
                            onChange={(e) => {
                              setFbrTokenVal(e.target.value);
                              setReceiptSettings(prev => ({ ...prev, fbrAuthToken: e.target.value }));
                            }}
                            className="h-9 rounded-xl font-mono text-xs bg-white"
                          />
                          <p className="text-[10px] text-slate-400 mt-0.5">Leave blank for Sandbox / Simulated mode.</p>
                        </div>

                        {/* Integration Environment Mode */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Integration Server Mode
                          </label>
                          <select
                            value={fbrEnvironmentVal}
                            onChange={(e: any) => {
                              setFbrEnvironmentVal(e.target.value);
                              setReceiptSettings(prev => ({ ...prev, fbrEnvironment: e.target.value }));
                            }}
                            className="w-full bg-white border border-slate-200 h-9 rounded-xl px-3 text-xs font-bold text-slate-800 focus:outline-none"
                          >
                            <option value="sandbox">🟢 Sandbox / Mock Testing</option>
                            <option value="production">🔴 Live Production Server (gst.fbr.gov.pk)</option>
                          </select>
                          <p className="text-[10px] text-slate-400 mt-0.5">Sandbox lets you test without transmitting real data to FBR.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                        {/* Default Sales Tax Rate */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Standard Sales Tax (GST) Rate %
                          </label>
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number"
                              min="0"
                              max="100"
                              value={fbrSalesTaxRateVal}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setFbrSalesTaxRateVal(val);
                                setReceiptSettings(prev => ({ ...prev, fbrSalesTaxRate: val }));
                              }}
                              className="h-9 rounded-xl font-bold bg-white text-xs w-28"
                            />
                            <div className="text-xs font-bold text-slate-600">% GST</div>
                          </div>
                        </div>

                        {/* QR Code toggle */}
                        <div className="flex items-center">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input 
                              type="checkbox"
                              checked={showFbrQrCodeVal}
                              onChange={(e) => {
                                setShowFbrQrCodeVal(e.target.checked);
                                setReceiptSettings(prev => ({ ...prev, showFbrQrCode: e.target.checked }));
                              }}
                              className="w-4.5 h-4.5 text-emerald-600 rounded cursor-pointer accent-emerald-600"
                            />
                            <div className="text-xs font-bold text-slate-800">
                              Print Official FBR QR Code on Customer Receipts
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Diagnostics / Test Connection */}
                      <div className="flex items-center justify-between gap-3 p-3 bg-white border border-emerald-200/90 rounded-xl mt-2">
                        <div>
                          <p className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                            <div>⚡</div> FBR Connection Diagnostic Tool
                          </p>
                          <p className="text-[10.5px] text-slate-500">
                            Verify whether POS ID and gateway endpoints respond correctly.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={handleTestFbrConnection}
                          disabled={fbrTestLoading}
                          variant="outline"
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-xs h-8 px-3 rounded-xl cursor-pointer"
                        >
                          {fbrTestLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Test FBR Connection
                        </Button>
                      </div>

                      {/* Test Result Banner */}
                      {fbrTestResult && (
                        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                          fbrTestResult.status === "success" 
                            ? "bg-emerald-100/90 text-emerald-900 border-emerald-300" 
                            : "bg-rose-100 text-rose-900 border-rose-300"
                        }`}>
                          <div>{fbrTestResult.status === "success" ? "✅" : "⚠️"}</div>
                          <div>{fbrTestResult.message}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <h4 className="text-sm font-black text-slate-800 mt-4 mb-2">{t("advanced_enterprise_features")}</h4>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2.5 py-2.5 px-3 bg-purple-50/50 border border-purple-200/50 rounded-xl">
                    <input
                      type="checkbox"
                      id="has_payroll_toggle"
                      checked={hasPayrollVal}
                      onChange={(e) => setHasPayrollVal(e.target.checked)}
                      className="w-4.5 h-4.5 text-purple-600 border-slate-300 rounded focus:ring-purple-500 cursor-pointer"
                    />
                    <label htmlFor="has_payroll_toggle" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      {t("enable_payroll_module")}
                    </label>
                  </div>

                  <div className="flex flex-col gap-2.5 py-2.5 px-3 bg-emerald-50/50 border border-emerald-200/50 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id="has_tax_toggle"
                        checked={hasTaxVal}
                        onChange={(e) => setHasTaxVal(e.target.checked)}
                        className="w-4.5 h-4.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="has_tax_toggle" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                        {t("enable_tax_system")}
                      </label>
                    </div>
                    {hasTaxVal && (
                      <div className="flex items-center gap-3 pl-7 animate-in fade-in slide-in-from-top-1 duration-200">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                          Default Tax Rate:
                        </label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0.00"
                            value={defaultTaxRateVal || ""}
                            onChange={(e) => setDefaultTaxRateVal(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="h-8 py-1 px-2.5 text-xs font-bold rounded-lg border-slate-200 bg-white text-right w-20"
                          />
                          <select
                            value={defaultTaxTypeVal}
                            onChange={(e) => setDefaultTaxTypeVal(e.target.value)}
                            className="h-8 bg-white border border-slate-200 rounded-lg text-xs font-bold px-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="percentage">%</option>
                            <option value="flat">Rs</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 py-2.5 px-3 bg-indigo-50/50 border border-indigo-200/50 rounded-xl">
                    <input
                      type="checkbox"
                      id="has_assets_rec_toggle"
                      checked={hasAssetsRecVal}
                      onChange={(e) => setHasAssetsRecVal(e.target.checked)}
                      className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="has_assets_rec_toggle" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      {t("enable_assets_module")}
                    </label>
                  </div>

                  <div className="flex items-center gap-2.5 py-2.5 px-3 bg-violet-50/50 border border-violet-200/50 rounded-xl">
                    <input
                      type="checkbox"
                      id="has_loyalty_toggle"
                      checked={hasLoyaltyVal}
                      onChange={(e) => setHasLoyaltyVal(e.target.checked)}
                      className="w-4.5 h-4.5 text-violet-600 border-slate-300 rounded focus:ring-violet-500 cursor-pointer"
                    />
                    <label htmlFor="has_loyalty_toggle" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      Enable Customer Loyalty Rewards System
                    </label>
                  </div>

                  <div className="flex items-center gap-2.5 py-2.5 px-3 bg-amber-50/50 border border-amber-200/50 rounded-xl">
                    <input
                      type="checkbox"
                      id="has_gift_cards_toggle"
                      checked={hasGiftCardsVal}
                      onChange={(e) => setHasGiftCardsVal(e.target.checked)}
                      className="w-4.5 h-4.5 text-amber-600 border-slate-300 rounded focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="has_gift_cards_toggle" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      Enable Coupon & Gift Card System (کوپن کوڈ / گفٹ کارڈ سسٹم)
                    </label>
                  </div>

                  {/* VIP E-Commerce Storefront Toggle */}
                  <div className="flex flex-col gap-2 p-3 bg-emerald-50/50 border border-emerald-200/60 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id="has_ecommerce_toggle"
                        checked={hasEcommerceVal}
                        onChange={(e) => setHasEcommerceVal(e.target.checked)}
                        className="w-4.5 h-4.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="has_ecommerce_toggle" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                        Enable VIP E-Commerce Web Store (آن لائن ای-کامرس اسٹور)
                      </label>
                    </div>

                    {hasEcommerceVal && (
                      <div className="space-y-3 pt-2.5 mt-1 border-t border-emerald-200/50">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Store URL Slug (e.g. usman-pharmacy)</label>
                          <Input
                            placeholder="my-shop-name"
                            value={storeSlugVal}
                            onChange={(e) => setStoreSlugVal(e.target.value)}
                            className="rounded-xl h-8 text-xs font-bold text-slate-800"
                          />
                          {storeSlugVal && (
                            <p className="text-[11px] text-emerald-600 font-bold mt-1">
                              Live Link: <a href={`/store/${storeSlugVal}`} target="_blank" rel="noreferrer" className="underline">theaccounts.cloud/store/{storeSlugVal}</a>
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Store Tagline / Bio</label>
                          <Input
                            placeholder="e.g. Authentic medicines & surgical supplies delivered fast"
                            value={storeTaglineVal}
                            onChange={(e) => setStoreTaglineVal(e.target.value)}
                            className="rounded-xl h-8 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Home Delivery Charges (Rs)</label>
                          <Input
                            type="number"
                            placeholder="100"
                            value={deliveryChargesVal}
                            onChange={(e) => setDeliveryChargesVal(Number(e.target.value))}
                            className="rounded-xl h-8 text-xs font-bold"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Phone Number</label>
                    <Input 
                      placeholder="e.g. 042-3512345" 
                      value={shopDetails.phone || ""} 
                      onChange={(e) => setShopDetails({ ...shopDetails, phone: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Email Address</label>
                    <Input 
                      type="email"
                      placeholder="info@myshop.com" 
                      value={shopDetails.email || ""} 
                      onChange={(e) => setShopDetails({ ...shopDetails, email: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Physical Address (Receipt Footer)</label>
                  <Input 
                    placeholder="Shop #12, Ground Floor, Plaza Name, City" 
                    value={shopDetails.address || ""} 
                    onChange={(e) => setShopDetails({ ...shopDetails, address: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Website URL</label>
                  <Input 
                    placeholder="https://www.myshop.com" 
                    value={shopDetails.website || ""} 
                    onChange={(e) => setShopDetails({ ...shopDetails, website: e.target.value })}
                    className="rounded-xl"
                  />
                </div>                <Button 
                  onClick={handleSaveShopDetails} 
                  disabled={isSubmitting} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl shadow-md shadow-blue-200 mt-2"
                >
                  <Save size={16} className="mr-2" /> {t("save")}
                </Button>
              </div>
            </div>

            {/* Card 2: Security & Profile Info */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <User className="text-blue-500" size={18} /> {t("session_security_profile")}
                </h3>

                <div className="space-y-4 text-xs mt-3">
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                    <div className="text-slate-500">{t("active_operator_name")}:</div>
                    <div className="font-extrabold text-slate-800">{userName || "Operator Admin"}</div>
                  </div>
                  
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                    <div className="text-slate-500">{t("role_level_permission")}:</div>
                    <div className="bg-blue-50 text-blue-800 text-[10px] px-2.5 py-0.5 rounded font-black uppercase">
                      {userRole || "Superadmin"}
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                    <div className="text-slate-500">{t("active_store_branch_id")}:</div>
                    <div className="font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">{shopId}</div>
                  </div>

                  <div className="flex justify-between items-center py-2.5">
                    <div className="text-slate-500">{t("cloud_sync_server")}:</div>
                    <div className="text-emerald-600 font-bold flex items-center gap-1">
                      <Shield size={12} /> Supabase Secure Cloud (Active)
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl flex items-center gap-3">
                <Globe className="text-blue-500" size={24} />
                <div>
                  <h4 className="font-black text-slate-800 text-xs">The Accounts Multi-Branch Network</h4>
                  <p className="text-[10px] text-slate-500 leading-snug">This store profile is linked to cloud replication. Changes reflect across all terminals instantly.</p>
                </div>
              </div>
            </div>



            {/* Card 3: Internationalization & Language Switcher Toggles */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5 xl:col-span-2">
              <h3 className="text-base font-black text-slate-850 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Globe className="text-blue-500" size={18} /> {t("lang_settings")}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Checkbox list of Active Languages */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-450 uppercase tracking-widest">{t("active_system_languages")}</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mb-2">{t("lang_nav_toggle_desc")}</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { key: "en", label: "English", native: "English" },
                      { key: "ur", label: "Urdu", native: "اردو" },
                      { key: "ar", label: "Arabic", native: "العربية" },
                      { key: "fa", label: "Persian", native: "فارسی" },
                      { key: "ps", label: "Pashto", native: "پښتو" },
                      { key: "sd", label: "Sindhi", native: "سنڌي" },
                      { key: "hi", label: "Hindi", native: "हिन्दी" },
                      { key: "bn", label: "Bengali", native: "বাংলা" },
                      { key: "ta", label: "Tamil", native: "தமிழ்" },
                      { key: "te", label: "Telugu", native: "తెలుగు" }
                    ].map((lang) => {
                      const isEnglish = lang.key === "en";
                      const isActive = activeLangs.includes(lang.key);
                      return (
                        <button
                          key={lang.key}
                          type="button"
                          disabled={isEnglish} // English is always active
                          onClick={() => toggleActiveLang(lang.key)}
                          className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                            isActive
                              ? "bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/10 text-blue-900 font-bold"
                              : "bg-white border-slate-200 hover:border-slate-350 text-slate-500"
                          } ${isEnglish ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <div className="text-xs font-black block">{lang.native}</div>
                          <div className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5">{lang.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dropdown for Invoice Print/Bill translation language */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-455 uppercase tracking-widest">{t("billing_receipt_lang")}</h4>
                  <p className="text-[10px] text-slate-400 font-semibold">{t("receipt_pdf_lang_desc")}</p>
                  
                  <div>
                    <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1.5">{t("print_language")}</label>
                    <select
                      value={billingLang}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBillingLang(val);
                        setReceiptSettings(prev => ({ ...prev, billingLanguage: val }));
                      }}
                      className="w-full bg-white border border-slate-200 h-10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700"
                    >
                      <option value="en">Default English / Active Input</option>
                      <option value="ur">اردو (Urdu Nastaleeq - Jameel Noori Font)</option>
                      <option value="ar">العربية (Arabic)</option>
                      <option value="fa">فارسی (Persian)</option>
                      <option value="ps">پښتو (Pashto)</option>
                      <option value="sd">سنڌي (Sindhi)</option>
                      <option value="hi">हिन्दी (Hindi)</option>
                      <option value="bn">বাংলা (Bengali)</option>
                      <option value="ta">தமிழ் (Tamil)</option>
                      <option value="te">తెలుగు (Telugu)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1.5">System & Receipt Currency (کرنسی سیٹنگ)</label>
                    <select
                      value={selectedCurrencyVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedCurrencyVal(val);
                        setReceiptSettings(prev => ({ ...prev, selectedCurrency: val }));
                      }}
                      className="w-full bg-white border border-slate-200 h-10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700"
                    >
                      <option value="PKR">PKR (Rs) - Pakistan</option>
                      <option value="INR">INR (₹) - India</option>
                      <option value="BDT">BDT (৳) - Bangladesh</option>
                      <option value="AED">AED (د.إ) - United Arab Emirates</option>
                      <option value="SAR">SAR (ر.س) - Saudi Arabia</option>
                      <option value="OMR">OMR (ر.ع.) - Oman</option>
                      <option value="QAR">QAR (ر.ق) - Qatar</option>
                      <option value="KWD">KWD (د.ك) - Kuwait</option>
                      <option value="BHD">BHD (د.ب) - Bahrain</option>
                      <option value="USD">USD ($) - United States Dollar</option>
                      <option value="GBP">GBP (£) - British Pound</option>
                      <option value="EUR">EUR (€) - Euro Zone</option>
                    </select>
                  </div>

                  {/* Business Timezone Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[9px] font-bold text-slate-450 uppercase">
                        Business & POS Timezone (ٹائم زون سیٹنگ)
                      </label>
                      <div className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Clock size={11} /> {getCurrentTimezonePreview(selectedTimezoneVal).time}
                      </div>
                    </div>
                    <select
                      value={selectedTimezoneVal}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedTimezoneVal(val);
                        setReceiptSettings(prev => ({ ...prev, timezone: val }));
                      }}
                      className="w-full bg-white border border-slate-200 h-10 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-700"
                    >
                      {POPULAR_TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.flag} {tz.label} ({tz.offset})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      Active Zone: <div className="font-bold text-slate-600">{getCurrentTimezonePreview(selectedTimezoneVal).resolvedTimezone}</div> - {getCurrentTimezonePreview(selectedTimezoneVal).date}
                    </p>
                  </div>

                  <div className="bg-blue-50 p-4.5 rounded-2xl border border-blue-100 flex items-start gap-3">
                    <Globe className="text-blue-600 shrink-0 mt-0.5" size={16} />
                    <div className="text-[11px] text-blue-800 font-medium leading-relaxed">
                      If **Urdu** is selected, product names on the PDF bills will be printed using the beautiful **Jameel Noori Nastaleeq** font for premium professional branding. All transaction timestamps automatically adapt to your selected timezone.
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-end">
                <Button 
                  onClick={handleSaveLanguageSettings} 
                  disabled={isSubmitting} 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 px-6 rounded-xl shadow-md shadow-blue-200"
                >
                  {isSubmitting && <Loader2 className="animate-spin mr-1.5" size={14} />}
                  Save Language Settings
                </Button>
              </div>
            </div>
          </motion.div>
        ) : activeTab === "receipt" ? (
          <motion.div
            key="receipt-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col lg:flex-row gap-6 items-start"
          >
            {/* Left Column: Configuration Forms */}
            <div className="w-full lg:w-[60%] space-y-6">
              
              {/* Card 1: 15 Receipt Layout Templates Grid */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Layout className="text-blue-500" size={16} /> Choose Receipt Template Presets (15 Layouts)
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1.5 custom-scrollbar">
                  {RECEIPT_TEMPLATES.map((tmpl) => {
                    const isSelected = receiptSettings.templateId === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        onClick={() => setReceiptSettings(prev => ({ ...prev, templateId: tmpl.id }))}
                        className={`text-left p-3 rounded-2xl border transition-all relative flex flex-col justify-between h-[100px] hover:shadow-sm ${
                          isSelected 
                            ? "bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/10 shadow-sm" 
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100/50"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-0.5">
                            <Check size={10} className="stroke-[4]" />
                          </div>
                        )}
                        <div>
                          <h4 className={`text-xs font-black leading-tight ${isSelected ? "text-blue-900" : "text-slate-850"}`}>
                            {tmpl.name}
                          </h4>
                          <p className="text-[9px] text-slate-400 mt-1 leading-snug line-clamp-3">
                            {tmpl.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 2: Print Metrics: Page size, Typography, Color */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Sliders className="text-blue-500" size={16} /> Dimension & Aesthetic Controls
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Page Size */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Page Size / Dimensions</label>
                    <select
                      value={receiptSettings.pageSize}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, pageSize: e.target.value as any }))}
                      className="w-full bg-white border border-slate-200 h-10 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="MM80">80mm Thermal (Standard Retail)</option>
                      <option value="MM58">58mm Thermal (Mobile / Small POS)</option>
                      <option value="A4">A4 Invoicing Sheet (A4 size)</option>
                      <option value="A5">A5 Medium Sheet (A5 size)</option>
                    </select>
                  </div>

                  {/* Typography Font */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Font Style Typography</label>
                    <select
                      value={receiptSettings.fontFamily}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, fontFamily: e.target.value }))}
                      className="w-full bg-white border border-slate-200 h-10 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="monospace">Courier Monospace (Traditional)</option>
                      <option value="sans-serif">Inter Sans-Serif (Modern)</option>
                      <option value="serif">Playfair Serif (Premium Luxury)</option>
                      <option value="urdu">Jameel Noori / Nastaliq (Urdu Friendly)</option>
                    </select>
                  </div>

                  {/* Font Size Adjuster */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5 flex justify-between">
                      <div>Base Font Size</div>
                      <div className="font-bold text-slate-700">{receiptSettings.fontSize}px</div>
                    </label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range"
                        min="8"
                        max="20"
                        value={receiptSettings.fontSize}
                        onChange={(e) => setReceiptSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>

                  {/* Divider Border Styles */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Divider Border Styles</label>
                    <select
                      value={receiptSettings.borderStyle}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, borderStyle: e.target.value as any }))}
                      className="w-full bg-white border border-slate-200 h-10 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="dashed">Dashed Lines (-----)</option>
                      <option value="solid">Thin Solid Line (_____)</option>
                      <option value="double">Double Accent Line (=====)</option>
                      <option value="stars">Star Divider (*****)</option>
                      <option value="none">No Dividers (Clean Space)</option>
                    </select>
                  </div>
                </div>

                {/* Primary Accent Color Picker */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Primary Accent Theme Color</label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {colorPresets.map((clr) => (
                      <button
                        key={clr.value}
                        onClick={() => setReceiptSettings(prev => ({ ...prev, primaryColor: clr.value }))}
                        className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center relative transition-transform hover:scale-110 shadow-sm"
                        style={{ backgroundColor: clr.value }}
                        title={clr.name}
                      >
                        {receiptSettings.primaryColor === clr.value && (
                          <div className="w-2.5 h-2.5 bg-white rounded-full mix-blend-difference"></div>
                        )}
                      </button>
                    ))}
                    
                    {/* Custom Hex Color */}
                    <div className="flex items-center gap-2 ml-2 border border-slate-200 pl-2 pr-1 h-9 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Custom:</div>
                      <input 
                        type="color"
                        value={receiptSettings.primaryColor}
                        onChange={(e) => setReceiptSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-6 h-6 border-0 bg-transparent cursor-pointer rounded-md outline-none"
                      />
                      <input
                        type="text"
                        value={receiptSettings.primaryColor}
                        onChange={(e) => setReceiptSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-14 text-center font-mono text-[10px] outline-none border-0 font-bold uppercase h-6"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2.5: Custom Thermal Print Margins & Alignment (Printer Head & Paper Cutter Calibration) */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Sliders className="text-indigo-600" size={16} /> Thermal Print Margins & Paper Calibration (پرنٹ مارجن سیٹنگز)
                  </h3>
                  <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                    Zero-Cut Protection
                  </div>
                </div>

                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  اگر آپ کے تھرمل پرنٹر پر بل کے الفاظ بائیں (Left) یا دائیں (Right) جانب سے کٹ رہے ہوں تو یہاں سے ملی میٹر (mm) میں فاصلہ ایڈجسٹ کریں۔
                </p>

                {/* Quick Calibration Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Quick Presets:</div>
                  <button
                    type="button"
                    onClick={() => setReceiptSettings(prev => ({ ...prev, marginLeft: 0, marginRight: 0, marginTop: 0, marginBottom: 0 }))}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    🎯 Default (0mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptSettings(prev => ({ ...prev, marginLeft: 3, marginRight: 0 }))}
                    className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-colors"
                  >
                    ➡️ Shift Right (+3mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptSettings(prev => ({ ...prev, marginLeft: 0, marginRight: 3 }))}
                    className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-colors"
                  >
                    ⬅️ Shift Left (+3mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptSettings(prev => ({ ...prev, marginLeft: 4, marginRight: 4, marginTop: 2, marginBottom: 4 }))}
                    className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-colors"
                  >
                    🛡️ Safe Border (4mm All-Sides)
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                  {/* Left Margin */}
                  <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Left Margin (بایاں مارجن)
                      </label>
                      <div className="flex items-center gap-1 font-mono font-black text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-xs shadow-xs">
                        <div>{receiptSettings.marginLeft || 0}</div>
                        <div className="text-[10px] text-slate-400">mm</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range"
                        min="0"
                        max="25"
                        step="0.5"
                        value={receiptSettings.marginLeft || 0}
                        onChange={(e) => setReceiptSettings(prev => ({ ...prev, marginLeft: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">بائیں طرف خالی جگہ بڑھانے کے لیے</p>
                  </div>

                  {/* Right Margin */}
                  <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Right Margin (دایاں مارجن)
                      </label>
                      <div className="flex items-center gap-1 font-mono font-black text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-xs shadow-xs">
                        <div>{receiptSettings.marginRight || 0}</div>
                        <div className="text-[10px] text-slate-400">mm</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range"
                        min="0"
                        max="25"
                        step="0.5"
                        value={receiptSettings.marginRight || 0}
                        onChange={(e) => setReceiptSettings(prev => ({ ...prev, marginRight: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">دائیں طرف خالی جگہ بڑھانے کے لیے</p>
                  </div>

                  {/* Top Margin */}
                  <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Top Margin (اوپری مارجن)
                      </label>
                      <div className="flex items-center gap-1 font-mono font-black text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-xs shadow-xs">
                        <div>{receiptSettings.marginTop || 0}</div>
                        <div className="text-[10px] text-slate-400">mm</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range"
                        min="0"
                        max="20"
                        step="0.5"
                        value={receiptSettings.marginTop || 0}
                        onChange={(e) => setReceiptSettings(prev => ({ ...prev, marginTop: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">بل کے شروع میں فاصلہ</p>
                  </div>

                  {/* Bottom Feed Distance (Cutter Gap) */}
                  <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Bottom Paper Feed (نیچلا فیڈ کٹر فاصلہ)
                      </label>
                      <div className="flex items-center gap-1 font-mono font-black text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-xs shadow-xs">
                        <div>{receiptSettings.marginBottom || 0}</div>
                        <div className="text-[10px] text-slate-400">mm</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range"
                        min="0"
                        max="30"
                        step="1"
                        value={receiptSettings.marginBottom || 0}
                        onChange={(e) => setReceiptSettings(prev => ({ ...prev, marginBottom: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">پیپر کٹر کو بل کی آخری لائن سے دور رکھنے کے لیے</p>
                  </div>
                </div>
              </div>

              {/* Card 3: Header and Footer configuration texts */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Type className="text-blue-500" size={16} /> Typography & Content Details
                </h3>

                <div className="space-y-4">
                  {/* Shop tagline */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Header Tagline (Slogan)</label>
                      <Input
                        placeholder="e.g. Your One Stop Retail Shop"
                        value={receiptSettings.headerTagline}
                        onChange={(e) => setReceiptSettings(prev => ({ ...prev, headerTagline: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Thank You Note</label>
                      <Input
                        placeholder="e.g. Thank you for shopping with us!"
                        value={receiptSettings.thankYouMessage}
                        onChange={(e) => setReceiptSettings(prev => ({ ...prev, thankYouMessage: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Footer Attribution Message</label>
                      <Input
                        placeholder="e.g. Terms: Goods once sold are not refundable"
                        value={receiptSettings.footerText}
                        onChange={(e) => setReceiptSettings(prev => ({ ...prev, footerText: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    {/* Urdu Footer Note */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Custom Urdu Footer Note (منفی پیغام/نوٹ)</label>
                      <Input
                        placeholder="مثال: خریدا ہوا سامان واپس یا تبدیل نہیں ہوگا"
                        value={receiptSettings.customUrduNote}
                        onChange={(e) => setReceiptSettings(prev => ({ ...prev, customUrduNote: e.target.value }))}
                        className="rounded-xl font-semibold"
                        style={{ direction: "rtl" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 4: Visibility & Show/Hide switches */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Eye className="text-blue-500" size={16} /> Visibility & Column Selectors
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {/* Shop Info details */}
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showPhone}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showPhone: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div className="text-xs font-bold text-slate-700">Show Phone</div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showAddress}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showAddress: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div className="text-xs font-bold text-slate-700">Show Address</div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showEmail}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showEmail: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div className="text-xs font-bold text-slate-700">Show Email</div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showWebsite}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showWebsite: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div className="text-xs font-bold text-slate-700">Show Website</div>
                  </label>

                  {/* Logo Options */}
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showLogo}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showLogo: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div className="text-xs font-bold text-slate-700">Show Logo Image</div>
                  </label>

                  {/* Invoice / Meta info */}
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showCustomerInfo}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showCustomerInfo: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div className="text-xs font-bold text-slate-700">Customer Details</div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showPaymentMode}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showPaymentMode: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div className="text-xs font-bold text-slate-700">Payment Methods</div>
                  </label>

                  {/* Items columns */}
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showItemCode}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showItemCode: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div className="text-xs font-bold text-slate-700">Product Codes</div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showDiscount}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showDiscount: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div className="text-xs font-bold text-slate-700">Tax & Discounts</div>
                  </label>

                  {/* Medical Store / Pharmacy Dedicated Toggles */}
                  {(industryTypeVal === "pharmacy" || industryTypeVal === "medical" || industryTypeVal === "health") && (
                    <>
                      <label className="flex items-center gap-2 cursor-pointer bg-emerald-50/60 hover:bg-emerald-100/60 p-2 rounded-xl border border-emerald-200 select-none">
                        <input 
                          type="checkbox"
                          checked={receiptSettings.showBatchNumber !== false}
                          onChange={(e) => setReceiptSettings(prev => ({ ...prev, showBatchNumber: e.target.checked }))}
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        />
                        <div className="text-xs font-bold text-emerald-950">Show Batch No</div>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer bg-emerald-50/60 hover:bg-emerald-100/60 p-2 rounded-xl border border-emerald-200 select-none">
                        <input 
                          type="checkbox"
                          checked={receiptSettings.showExpiryDate !== false}
                          onChange={(e) => setReceiptSettings(prev => ({ ...prev, showExpiryDate: e.target.checked }))}
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        />
                        <div className="text-xs font-bold text-emerald-950">Show Expiry Date</div>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer bg-amber-50/60 hover:bg-amber-100/60 p-2 rounded-xl border border-amber-200 select-none">
                        <input 
                          type="checkbox"
                          checked={!!receiptSettings.showShelfLocation}
                          onChange={(e) => setReceiptSettings(prev => ({ ...prev, showShelfLocation: e.target.checked }))}
                          className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                        />
                        <div className="text-xs font-bold text-amber-950">Show Shelf / Rack</div>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer bg-red-50/60 hover:bg-red-100/60 p-2 rounded-xl border border-red-200 select-none">
                        <input 
                          type="checkbox"
                          checked={receiptSettings.mandatoryControlledDrugForm !== false}
                          onChange={(e) => setReceiptSettings(prev => ({ ...prev, mandatoryControlledDrugForm: e.target.checked }))}
                          className="w-4 h-4 text-red-600 rounded cursor-pointer"
                        />
                        <div className="text-xs font-bold text-red-950">Controlled Drug Rx Form (Schedule G)</div>
                      </label>
                    </>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer bg-emerald-50 hover:bg-emerald-100/70 p-2 rounded-xl border border-emerald-300 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.enableFBR || false}
                      onChange={(e) => {
                        setReceiptSettings(prev => ({ ...prev, enableFBR: e.target.checked }));
                        setEnableFbrVal(e.target.checked);
                      }}
                      className="w-4 h-4 text-emerald-600 rounded cursor-pointer accent-emerald-600"
                    />
                    <div className="text-xs font-bold text-emerald-950">🇵🇰 FBR Tax Badge &amp; QR</div>
                  </label>
                </div>

                {receiptSettings.showLogo && (
                  <div className="pt-2.5 animate-in fade-in duration-200 space-y-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase">Upload Shop Logo</label>
                    <div className="flex flex-col sm:flex-row gap-3 items-center bg-slate-50 border border-dashed border-slate-200 p-3 rounded-2xl">
                      {receiptSettings.logoUrl ? (
                        <div className="relative w-16 h-16 bg-white border border-slate-200 p-1 rounded-xl overflow-hidden shrink-0 flex items-center justify-center group">
                          <img src={receiptSettings.logoUrl} alt="Store Logo Thumbnail" className="w-full h-full object-contain" />
                          <button
                            type="button"
                            onClick={() => setReceiptSettings(prev => ({ ...prev, logoUrl: "" }))}
                            className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold text-[10px] rounded-lg"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                          <Store size={22} />
                        </div>
                      )}
                      <div className="flex-1 space-y-1 w-full">
                        <label className="block bg-white hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors border border-slate-200 px-4 py-2 text-center rounded-xl cursor-pointer text-xs font-bold text-slate-700 transition-all select-none">
                          Choose Image File
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                        </label>
                        <p className="text-[9px] text-slate-400 leading-normal text-center sm:text-left">Supports PNG, JPG, JPEG. Max size 1.5MB.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button for Receipt Customizer */}
              <Button 
                onClick={handleSaveReceiptSettings} 
                disabled={isSubmitting} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-500/15"
              >
                <Save size={18} className="mr-2" /> Save Designer Configurations
              </Button>
            </div>

            {/* Right Column: Sticky Live Preview Panel */}
            <div className="w-full lg:w-[40%] lg:sticky lg:top-6 space-y-4">
              <div className="bg-slate-100 p-4 rounded-3xl border border-slate-200/80 flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-500" /> Interactive Print Sheet
                  </h3>
                  <p className="text-[10px] text-slate-400">Updates live as configurations are tweaked.</p>
                </div>
                <Button 
                  onClick={handlePrintSample}
                  variant="outline" 
                  className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors font-bold h-8 rounded-lg text-[10px] px-3.5 shadow-sm"
                >
                  <Printer size={12} className="mr-1.5" /> Print Sample
                </Button>
              </div>

              {/* Scrollable Receipt Preview wrapper */}
              <div className="bg-slate-200/50 border border-slate-200 p-4 rounded-3xl shadow-inner max-h-[640px] overflow-y-auto flex items-start justify-center custom-scrollbar">
                <div id="receipt-preview-container" className="bg-white shadow-xl rounded-md transition-all duration-300">
                  <ReceiptTemplate 
                    settings={receiptSettings} 
                    invoice={SAMPLE_PREVIEW_INVOICE} 
                    shopDetails={{
                      name: shopDetails.name,
                      phone: shopDetails.phone,
                      address: shopDetails.address,
                      email: shopDetails.email,
                      website: shopDetails.website
                    }} 
                  />
                </div>
              </div>

              {/* Direct Silent Thermal Printing Guide Card */}
              <div className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white p-4 rounded-3xl border border-indigo-800/40 shadow-lg space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="text-base">⚡</div>
                  <div>
                    <h4 className="text-xs font-black text-white">Direct Silent Printing (Zero-Dialog)</h4>
                    <p className="text-[10px] text-indigo-300">براؤزر کا پرنٹ ڈائیلاگ کھولے بغیر ڈائریکٹ پرنٹر سے پرچی نکالیں</p>
                  </div>
                </div>
                <div className="text-[10.5px] text-slate-300 space-y-1.5 bg-black/30 p-3 rounded-2xl border border-white/10 font-sans leading-relaxed">
                  <p className="text-amber-300 font-bold">💡 1-کلک میں پرنٹ نکالنے کا طریقہ (Windows Kiosk Mode):</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-200">
                    <li>اپنے <strong>Google Chrome</strong> کے شارٹ کٹ پر رائٹ کلک کر کے <strong>Properties</strong> کھولیں۔</li>
                    <li><strong>Target</strong> فیلڈ کے آخر میں سپیس دے کر لکھیں: <code className="bg-indigo-900/80 px-1.5 py-0.5 rounded text-amber-200 font-mono text-[10px]">--kiosk-printing</code></li>
                    <li><strong>Apply</strong> کریں اور کروم کھولیں۔ اب POS پر بٹن دباتے ہی پرچی بغیر کسی تصدیقی ونڈو کے براہِ راست پرنٹر سے نکلے گی!</li>
                  </ol>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="appearance-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            <SidebarThemeSettingsPanel />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
