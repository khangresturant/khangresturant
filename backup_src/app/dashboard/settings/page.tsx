"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, Store, Printer, User, Shield, 
  Loader2, Save, RefreshCw, Eye, Check,
  Palette, Type, Sliders, Layout, FileText, Globe
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ReceiptTemplate, 
  ReceiptSettings, 
  DEFAULT_RECEIPT_SETTINGS, 
  SAMPLE_PREVIEW_INVOICE, 
  RECEIPT_TEMPLATES 
} from "@/components/ReceiptTemplate";

export default function SettingsPage() {
  const { shopId, userName, shopName, userRole } = useShop();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "receipt">("profile");

  // Shop Details Form State
  const [shopDetails, setShopDetails] = useState({
    id: "",
    name: "",
    address: "",
    phone: "",
    email: "",
    website: ""
  });

  // Industry Type State
  const [industryTypeVal, setIndustryTypeVal] = useState("general");
  const [allowNegativeStockVal, setAllowNegativeStockVal] = useState(false);

  // Print Settings & Design customizer state
  const [printSettingsId, setPrintSettingsId] = useState("");
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS);

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
    }
  }, [shopId]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // 1. Fetch Company/Shop details
      const { data: company, error: companyError } = await supabase
        .from("company_details")
        .select("id, name, address, phone, email, website")
        .eq("shop_id", shopId)
        .maybeSingle();

      if (companyError) throw companyError;
      if (company) {
        setShopDetails(company);
      } else {
        setShopDetails(prev => ({
          ...prev,
          name: shopName || ""
        }));
      }

      // Fetch shop details for industry type and negative stock setting
      const { data: shopRow, error: shopRowError } = await supabase
        .from("shops")
        .select("industry_type, allow_negative_stock")
        .eq("id", shopId)
        .single();
      if (!shopRowError && shopRow) {
        setIndustryTypeVal(shopRow.industry_type || "general");
        setAllowNegativeStockVal(!!shopRow.allow_negative_stock);
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
        const storedCustomSettings = print.receipt_design_settings || {};
        setReceiptSettings({
          ...DEFAULT_RECEIPT_SETTINGS,
          pageSize: (print.receipt_page_size as any) || DEFAULT_RECEIPT_SETTINGS.pageSize,
          fontFamily: print.receipt_font || DEFAULT_RECEIPT_SETTINGS.fontFamily,
          fontSize: print.receipt_font_size || DEFAULT_RECEIPT_SETTINGS.fontSize,
          ...storedCustomSettings
        });
      } else {
        setReceiptSettings(DEFAULT_RECEIPT_SETTINGS);
      }
    } catch (err: any) {
      toast.error("Failed to load settings: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveShopDetails = async () => {
    setIsSubmitting(true);
    try {
      // 1. Update shops table for name, industry type, and allow_negative_stock
      const { error: shopUpdateError } = await supabase
        .from("shops")
        .update({ 
          name: shopDetails.name, 
          industry_type: industryTypeVal,
          allow_negative_stock: allowNegativeStockVal 
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
        website: shopDetails.website || null
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

      toast.success("Shop information updated!");
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

      toast.success("Receipt design configurations saved successfully!");
    } catch (err: any) {
      toast.error("Error saving receipt settings: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger browser print for the preview sample
  const handlePrintSample = () => {
    const printContent = document.getElementById("receipt-preview-container")?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocker prevented printing. Please allow popups for this site.");
      return;
    }

    // Determine font family style
    let fontFaceStyle = "";
    if (receiptSettings.fontFamily === "urdu") {
      fontFaceStyle = `
        @font-face {
          font-family: 'Nastaliq';
          src: url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
        }
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Sample Receipt Print - Hisab X</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            ${fontFaceStyle}
            body {
              margin: 0;
              padding: 10px;
              background-color: white;
            }
            @media print {
              body {
                padding: 0;
                margin: 0;
              }
              @page {
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="flex justify-center items-start">
            ${printContent}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">System Settings</h2>
          <p className="text-slate-500 mt-1">Configure company profiles, design customized invoices/receipts, and access operator roles.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 max-w-fit">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "profile" 
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Store size={14} /> Shop Profile
          </button>
          <button
            onClick={() => setActiveTab("receipt")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "receipt" 
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Printer size={14} /> Receipt Designer
          </button>
        </div>
      </div>

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
                <Store className="text-blue-500" size={18} /> Shop Profile Settings
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Business / Shop Name</label>
                  <Input 
                    value={shopDetails.name} 
                    onChange={(e) => setShopDetails({ ...shopDetails, name: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Business / Industry Type (Dashboard Modules)</label>
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
                    Allow Negative Stock Billing (منفی اسٹاک میں سیل کی اجازت دیں)
                  </label>
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
                </div>

                <Button 
                  onClick={handleSaveShopDetails} 
                  disabled={isSubmitting} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl shadow-md shadow-blue-200 mt-2"
                >
                  <Save size={16} className="mr-2" /> Save Profile Details
                </Button>
              </div>
            </div>

            {/* Card 2: Security & Profile Info */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <User className="text-blue-500" size={18} /> Session Security Profile
                </h3>

                <div className="space-y-4 text-xs mt-3">
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                    <span className="text-slate-500">Active Operator Name:</span>
                    <span className="font-extrabold text-slate-800">{userName || "Operator Admin"}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                    <span className="text-slate-500">Role level permission:</span>
                    <span className="bg-blue-50 text-blue-800 text-[10px] px-2.5 py-0.5 rounded font-black uppercase">
                      {userRole || "Superadmin"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                    <span className="text-slate-500">Active Store Branch ID:</span>
                    <span className="font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">{shopId}</span>
                  </div>

                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-slate-500">Cloud Sync Server:</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <Shield size={12} /> Supabase Secure Cloud (Active)
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl flex items-center gap-3">
                <Globe className="text-blue-500" size={24} />
                <div>
                  <h4 className="font-black text-slate-800 text-xs">Hisab X Multi-Branch Network</h4>
                  <p className="text-[10px] text-slate-500 leading-snug">This store profile is linked to cloud replication. Changes reflect across all terminals instantly.</p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
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
                      <span>Base Font Size</span>
                      <span className="font-bold text-slate-700">{receiptSettings.fontSize}px</span>
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
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Custom:</span>
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
                    <span className="text-xs font-bold text-slate-700">Show Phone</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showAddress}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showAddress: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700">Show Address</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showEmail}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showEmail: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700">Show Email</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showWebsite}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showWebsite: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700">Show Website</span>
                  </label>

                  {/* Logo Options */}
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showLogo}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showLogo: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700">Show Logo Image</span>
                  </label>

                  {/* Invoice / Meta info */}
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showCustomerInfo}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showCustomerInfo: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700">Customer Details</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showPaymentMode}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showPaymentMode: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700">Payment Methods</span>
                  </label>

                  {/* Items columns */}
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showItemCode}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showItemCode: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700">Product Codes</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/70 p-2 rounded-xl border border-slate-150 select-none">
                    <input 
                      type="checkbox"
                      checked={receiptSettings.showDiscount}
                      onChange={(e) => setReceiptSettings(prev => ({ ...prev, showDiscount: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700">Tax & Discounts</span>
                  </label>
                </div>

                {receiptSettings.showLogo && (
                  <div className="pt-2.5 animate-in fade-in duration-200 space-y-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase">Upload Shop Logo (لوگو اپلوڈ کریں)</label>
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
                        <label className="block bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 text-center rounded-xl cursor-pointer text-xs font-bold text-slate-700 transition-all select-none">
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
                  className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold h-8 rounded-lg text-[10px] px-3.5 shadow-sm"
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
