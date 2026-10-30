"use client";

import React from "react";
import { formatDateTime } from "@/lib/timezone";

// Centralized branding constant
export const SOFTWARE_BRANDING = "The Accounts";

// 1. Define the settings type
export type ReceiptSettings = {
  templateId: string;
  pageSize: "MM80" | "MM58" | "A4" | "A5";
  fontFamily: string;
  fontSize: number;
  primaryColor: string;
  showLogo: boolean;
  logoUrl: string;
  showPhone: boolean;
  showAddress: boolean;
  showEmail: boolean;
  showWebsite: boolean;
  showHeaderTagline: boolean;
  headerTagline: string;
  footerText: string;
  showItemCode: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showCustomerInfo: boolean;
  showPaymentMode: boolean;
  showBatchNumber?: boolean;
  showShelfLocation?: boolean;
  showExpiryDate?: boolean;
  mandatoryControlledDrugForm?: boolean;
  enableFBR?: boolean;
  showCostPriceOnPos?: boolean;
  fbrPosId?: string;
  fbrNtnStrn?: string;
  fbrAuthToken?: string;
  fbrEnvironment?: "sandbox" | "production";
  fbrSalesTaxRate?: number;
  showFbrQrCode?: boolean;
  thankYouMessage: string;
  borderStyle: "dashed" | "solid" | "double" | "none" | "stars";
  customUrduNote: string;
  billingLanguage?: string;
  selectedCurrency?: string;
  timezone?: string;
  marginLeft?: number; // In mm (0 to 30) for thermal alignment
  marginRight?: number; // In mm (0 to 30) for thermal alignment
  marginTop?: number; // In mm (0 to 30)
  marginBottom?: number; // In mm (0 to 40)
};

// Default Settings
export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  templateId: "classic-thermal",
  pageSize: "MM80",
  fontFamily: "monospace",
  fontSize: 11,
  primaryColor: "#3b82f6", // blue-500
  showLogo: false,
  logoUrl: "",
  showPhone: true,
  showAddress: true,
  showEmail: false,
  showWebsite: false,
  showHeaderTagline: true,
  headerTagline: "Global ERP POS System",
  footerText: "Exchange is possible within 3 days with invoice.",
  showItemCode: false,
  showDiscount: true,
  showTax: true,
  showCustomerInfo: true,
  mandatoryControlledDrugForm: true,
  enableFBR: false,
  fbrPosId: "",
  fbrNtnStrn: "",
  fbrAuthToken: "",
  fbrEnvironment: "sandbox",
  fbrSalesTaxRate: 18,
  showFbrQrCode: true,
  showPaymentMode: true,
  showBatchNumber: true,
  showShelfLocation: false,
  showExpiryDate: true,
  thankYouMessage: "Thank you for shopping with us!",
  borderStyle: "dashed",
  customUrduNote: "خریدہ ہوا مال واپس یا تبدیل نہیں ہوگا",
  billingLanguage: "en",
  selectedCurrency: "Rs",
  timezone: "auto",
  marginLeft: 0,
  marginRight: 0,
  marginTop: 0,
  marginBottom: 0,
};

// 15 Template Definitions
export const RECEIPT_TEMPLATES = [
  { id: "classic-thermal", name: "Classic Thermal", desc: "Standard monospace layout with dashed borders" },
  { id: "modern-carbon", name: "Modern Carbon", desc: "Sleek sans-serif, deep solid charcoal line breaks" },
  { id: "boutique-serif", name: "Boutique Serif", desc: "Elegant Playfair serif typography, double border accents" },
  { id: "minimalist-air", name: "Minimalist Air", desc: "Spacious margin, zero borders, premium clean alignment" },
  { id: "bold-stripe", name: "Bold Stripe", desc: "Thick colored banner bands framing the shop name header" },
  { id: "retro-double", name: "Retro Double-Line", desc: "Vintage terminal style using heavy double-equal symbols" },
  { id: "two-column-compact", name: "Two-Column Compact", desc: "Side-by-side key summary blocks to save receipt height" },
  { id: "qr-tech", name: "QR Tech", desc: "Modern technical style including QR code scan layout at bottom" },
  { id: "qr-tech-dual", name: "QR Tech (Dual QR)", desc: "Dual QR codes: Scan Digital Invoice + Scan to Visit VIP E-Commerce Store" },
  { id: "islamic-grace", name: "Islamic Grace", desc: "Traditional Bismillah Calligraphy header & Urdu friendly framing" },
  { id: "retail-grid", name: "Retail Grid", desc: "Clean borders surrounding every row and column cell" },
  { id: "paper-saver", name: "Paper Saver Extra", desc: "Micro font and zero paddings optimized to reduce paper waste" },
  { id: "corp-invoice", name: "Corporate Invoice", desc: "Structured business style with formal metadata & signature lines" },
  { id: "midnight-shaded", name: "Midnight Shaded", desc: "Solid charcoal banner headings with soft shaded sub-blocks" },
  { id: "artistic-corner", name: "Artistic Corner", desc: "Stylish borders only enclosing the corner sections" },
  { id: "accent-gradient", name: "Accent Gradient", desc: "Modern gradient line bar at the top edge with colored highlights" }
];

// Sample Invoice Data for Preview
export const SAMPLE_PREVIEW_INVOICE = {
  id: "INV-2026-9875",
  created_at: new Date().toISOString(),
  customer_name: "Muhammad Ali (Walk-in)",
  customer_phone: "0300-1234567",
  payment_mode: "cash",
  received_amount: 1500,
  tax_amount: 45.50,
  discount: 50.00,
  total_amount: 1445.50,
  items: [
    { 
      name: "Super Habib Cooking Oil 1L", 
      quantity: 2, 
      price: 520, 
      packingName: "Pack of 1", 
      code: "OIL-SH-01",
      note: JSON.stringify({ translations: { ur: "سپر حبیب کوکنگ آئل 1 لیٹر", ar: "سوبر حبيب زيت الطبخ", fa: "روغن سرخ‌کردنی حبیب", ps: "حبيب د پخلي غوړي", sd: "سپرب حبيب ڪوڪنگ آئل" } })
    },
    { 
      name: "Sufi Banaspati Ghee 500g", 
      quantity: 1, 
      price: 290, 
      packingName: "Box-Mini", 
      code: "GHEE-S-02",
      note: JSON.stringify({ translations: { ur: "صوفی بنسپتی گھی 500 گرام", ar: "سوفي سمن نباتي", fa: "روغن جامد صوفی", ps: "صوفي نباتي غوړي", sd: "صوفي بناسپتي گيهه" } })
    },
    { 
      name: "National Chilli Garlic Sauce 300g", 
      quantity: 3, 
      price: 70, 
      packingName: "Bottle", 
      code: "SAUCE-NAT-05",
      note: JSON.stringify({ translations: { ur: "نیشنل چلی گارلک سوس 300 گرام", ar: "ناشيونال صلصة الثوم الحار", fa: "سس سیر و چیلی نشنال", ps: "نیشنل د هوږې مرچ ساس", sd: "نيشنل چلي گارلڪ ساس" } })
    }
  ]
};

interface ReceiptTemplateProps {
  settings: ReceiptSettings;
  invoice: any;
  shopDetails: {
    name: string;
    phone?: string;
    address?: string;
    email?: string;
    website?: string;
  };
}

export function ReceiptTemplate({ settings, invoice, shopDetails }: ReceiptTemplateProps) {
  const mergedSettings = { ...DEFAULT_RECEIPT_SETTINGS, ...settings };
  const {
    templateId,
    pageSize,
    fontFamily,
    fontSize,
    primaryColor,
    showLogo,
    logoUrl,
    showPhone,
    showAddress,
    showEmail,
    showWebsite,
    showHeaderTagline,
    headerTagline,
    footerText,
    showItemCode,
    showDiscount,
    showTax,
    showCustomerInfo,
    showPaymentMode,
    showBatchNumber = true,
    showShelfLocation = false,
    showExpiryDate = true,
    mandatoryControlledDrugForm,
    enableFBR,
    fbrPosId,
    fbrNtnStrn,
    fbrAuthToken,
    fbrEnvironment,
    fbrSalesTaxRate,
    showFbrQrCode = true,
    thankYouMessage,
    borderStyle,
    customUrduNote,
    billingLanguage,
    selectedCurrency
  } = mergedSettings;

  const currencySymbol = selectedCurrency || "Rs";

  // Determine width based on Page Size setting
  let containerWidth = "w-full max-w-[320px]"; // Default 80mm
  if (pageSize === "MM58") {
    containerWidth = "w-full max-w-[240px]"; // 58mm
  } else if (pageSize === "A4") {
    containerWidth = "w-full max-w-[800px] p-8";
  } else if (pageSize === "A5") {
    containerWidth = "w-full max-w-[560px] p-6";
  }

  // Determine Font Family Class based on template or explicit setting
  let fontStyleClass = "font-mono";
  if (fontFamily === "sans-serif" || ["modern-carbon", "minimalist-air", "bold-stripe", "two-column-compact", "qr-tech-dual", "paper-saver", "midnight-shaded", "accent-gradient", "corp-invoice"].includes(templateId)) {
    fontStyleClass = "font-sans tracking-tight";
  }
  if (fontFamily === "serif" || templateId === "boutique-serif") {
    fontStyleClass = "font-serif";
  }
  if (fontFamily === "urdu" || templateId === "islamic-grace") {
    fontStyleClass = "font-sans";
  }

  // Helper to render dividers tailored to each template
  const renderDivider = () => {
    if (borderStyle === "none" || templateId === "minimalist-air") {
      return <div className="my-1.5 border-b border-transparent"></div>;
    }
    
    if (borderStyle === "stars" || templateId === "retro-double") {
      return (
        <div className="text-center text-black font-bold tracking-widest select-none overflow-hidden h-3 leading-none my-1 font-mono text-[9px]">
          ========================================
        </div>
      );
    }

    if (templateId === "boutique-serif" || borderStyle === "double") {
      return <div className="my-1.5 border-t-2 border-b border-double border-black"></div>;
    }

    if (templateId === "modern-carbon" || borderStyle === "solid") {
      return <div className="my-1.5 border-t border-black"></div>;
    }

    if (templateId === "bold-stripe") {
      return <div className="my-1.5 border-t-2 border-black"></div>;
    }

    if (templateId === "islamic-grace") {
      return (
        <div className="flex items-center justify-center gap-1.5 my-1 text-black font-bold text-[8.5px]">
          <span className="flex-1 border-t border-black/40"></span>
          <span>۞</span>
          <span className="flex-1 border-t border-black/40"></span>
        </div>
      );
    }

    let borderClass = "border-dashed";
    return (
      <div 
        className={`my-1.5 border-t ${borderClass}`} 
        style={{ borderColor: "#000000" }}
      ></div>
    );
  };

  // Calculate invoice subtotal (before discount and tax)
  const itemsList = invoice?.items || [];
  const grossSubtotal = itemsList.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
  const totalItemDiscount = itemsList.reduce((sum: number, item: any) => {
    const gross = (item.price || 0) * (item.quantity || 0);
    const net = item.subtotal !== undefined ? item.subtotal : gross;
    return sum + Math.max(0, gross - net);
  }, 0);
  const subtotal = Math.max(0, grossSubtotal - totalItemDiscount);

  const getItemDisplayName = (item: any, lang?: string) => {
    const defaultName = item.name || item.products?.name || "Item";
    if (!lang || lang === "en") return defaultName;
    
    const tNames = item.translated_names || item.translatedNames || item.products?.translated_names || item.products?.translatedNames;
    if (tNames) {
      if (typeof tNames === "object" && tNames[lang]) {
        return tNames[lang];
      }
      if (typeof tNames === "string" && tNames.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(tNames);
          if (parsed[lang]) return parsed[lang];
        } catch (e) {}
      }
    }

    const noteStr = item.note || item.products?.note;
    if (noteStr) {
      if (typeof noteStr === "string" && noteStr.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(noteStr);
          if (parsed.translations && parsed.translations[lang]) {
            return parsed.translations[lang];
          }
        } catch (e) {}
      } else if (typeof noteStr === "object" && noteStr !== null) {
        if (noteStr.translations && noteStr.translations[lang]) {
          return noteStr.translations[lang];
        }
      }
    }
    return defaultName;
  };

  const leftMm = Number(mergedSettings.marginLeft || 0);
  const rightMm = Number(mergedSettings.marginRight || 0);
  const topMm = Number(mergedSettings.marginTop || 0);
  const bottomMm = Number(mergedSettings.marginBottom || 0);

  return (
    <div 
      className={`mx-auto bg-white text-black select-none ${containerWidth} ${fontStyleClass} thermal-receipt-view transition-all`}
      style={{ 
        fontSize: `${templateId === "paper-saver" ? Math.min(fontSize, 9.5) : fontSize}px`, 
        lineHeight: templateId === "paper-saver" ? "1.2" : "1.35",
        color: "#000000",
        paddingLeft: `${Math.max(2, 10 + leftMm * 3.78)}px`,
        paddingRight: `${Math.max(2, 10 + rightMm * 3.78)}px`,
        paddingTop: `${Math.max(2, 10 + topMm * 3.78)}px`,
        paddingBottom: `${Math.max(2, 10 + bottomMm * 3.78)}px`,
      }}
    >
      {/* 1. Gradient & Accent Edge Decoration */}
      {templateId === "accent-gradient" && (
        <div className="h-1.5 -mx-2 -mt-2 mb-2 bg-black rounded-t-sm"></div>
      )}

      {templateId === "corp-invoice" && (
        <div className="text-center pb-1 mb-1 border-b-2 border-black">
          <span className="text-[10px] font-black uppercase tracking-widest bg-black text-white px-3 py-0.5 rounded-xs">
            Commercial Tax Invoice
          </span>
        </div>
      )}

      {/* 2. Distinctive Header Section Per Template */}
      <div className="text-center space-y-0.5 mb-2">
        {/* Islamic grace header */}
        {templateId === "islamic-grace" && (
          <div className="text-[12px] font-bold text-center text-black mb-1 font-serif leading-tight">
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </div>
        )}

        {/* Logo */}
        {showLogo && logoUrl && (
          <div className="flex justify-center mb-1.5">
            <img src={logoUrl} alt="Store Logo" className="h-9 w-auto object-contain filter grayscale contrast-200" />
          </div>
        )}

        {/* Shop Name Layouts */}
        {templateId === "bold-stripe" ? (
          <div className="bg-black text-white py-1.5 px-2 my-1 rounded-sm text-center">
            <h2 className="text-sm font-black uppercase tracking-wider text-white">{shopDetails.name || "The Accounts Store"}</h2>
            {showHeaderTagline && headerTagline && (
              <p className="text-[8px] text-zinc-300 font-normal mt-0.5 tracking-wide">{headerTagline}</p>
            )}
          </div>
        ) : templateId === "midnight-shaded" ? (
          <div className="bg-black text-white py-1 px-3 rounded-full inline-block my-1 text-center">
            <h2 className="text-xs font-black tracking-widest text-white uppercase">{shopDetails.name || "The Accounts Store"}</h2>
          </div>
        ) : templateId === "boutique-serif" ? (
          <div className="my-1 text-center">
            <h2 className="text-base font-bold tracking-widest uppercase font-serif text-black">{shopDetails.name || "The Accounts Store"}</h2>
            <p className="text-[8px] font-serif italic text-zinc-600 mt-0.5">~ Luxury Boutique POS ~</p>
          </div>
        ) : templateId === "retro-double" ? (
          <div className="my-0.5 text-center font-mono">
            <p className="text-[8px] tracking-widest">*** OFFICIAL SALE RECEIPT ***</p>
            <h2 className="text-sm font-black uppercase tracking-tight text-black">{shopDetails.name || "The Accounts Store"}</h2>
          </div>
        ) : (
          <h2 className="text-sm font-black uppercase tracking-wide leading-tight text-black">{shopDetails.name || "The Accounts Store"}</h2>
        )}

        {/* Tagline (Standard templates) */}
        {templateId !== "bold-stripe" && showHeaderTagline && headerTagline && (
          <p className="text-[9px] text-zinc-700 font-medium leading-none">{headerTagline}</p>
        )}

        {/* Contact details */}
        {(showAddress || showPhone || showEmail || showWebsite) && (
          <div className="text-[9px] text-zinc-800 font-medium space-y-0.5 pt-0.5">
            {showAddress && shopDetails.address && <p>{shopDetails.address}</p>}
            <div className="flex justify-center gap-2 flex-wrap">
              {showPhone && shopDetails.phone && <span>Ph: {shopDetails.phone}</span>}
              {showEmail && shopDetails.email && <span>Email: {shopDetails.email}</span>}
            </div>
            {showWebsite && shopDetails.website && <p className="font-bold underline">{shopDetails.website}</p>}
          </div>
        )}

        {/* FBR Tier-1 POS Header Strip */}
        {enableFBR && (
          <div className="my-1.5 p-1 border border-black rounded text-center space-y-0.5 font-mono text-black">
            <div className="flex items-center justify-center gap-1 font-black text-[9.5px] text-black">
              <span>🇵🇰</span>
              <span>FBR INVOICE (Tier-1 POS)</span>
            </div>
            <div className="flex justify-between items-center text-[8.5px] text-black font-bold px-1">
              <span>POS ID: {fbrPosId || "100001"}</span>
              <span>NTN: {fbrNtnStrn || "0000000-0"}</span>
            </div>
            <div className="text-[8px] font-black text-black truncate border-t border-black/30 pt-0.5 mt-0.5">
              FBR USIN: {invoice?.fbr_usin || `${fbrPosId || '100001'}-${(invoice?.id || 'PREVIEW').slice(0, 8).toUpperCase()}`}
            </div>
          </div>
        )}
      </div>

      {renderDivider()}

      {/* 3. Metadata & Customer Info (Theme Specific Layouts) */}
      {templateId === "two-column-compact" ? (
        <div className="grid grid-cols-2 gap-1.5 text-[8.5px] font-bold text-black my-1 border border-black/30 p-1.5 rounded-sm">
          <div>
            <span className="text-zinc-500 font-normal">Date: </span>
            <span>{formatDateTime(invoice?.created_at || new Date(), settings.timezone)}</span>
          </div>
          <div className="text-right">
            <span className="text-zinc-500 font-normal">Inv#: </span>
            <span className="font-black font-mono">#{invoice?.id ? invoice.id.slice(0, 8).toUpperCase() : "PREVIEW"}</span>
          </div>
          {showCustomerInfo && invoice?.customer_name && (
            <div className="col-span-2 border-t border-dashed border-black/30 pt-1 flex justify-between">
              <span>Cust: <span className="font-black">{invoice.customer_name}</span></span>
              {invoice.customer_phone && <span className="font-mono">{invoice.customer_phone}</span>}
            </div>
          )}
        </div>
      ) : templateId === "corp-invoice" ? (
        <div className="border border-black p-1.5 rounded-xs text-[8.5px] space-y-0.5 my-1.5 font-sans">
          <div className="flex justify-between font-bold">
            <span>Invoice No: <span className="font-black font-mono">#{invoice?.id ? invoice.id.slice(0, 8).toUpperCase() : "PREVIEW"}</span></span>
            <span>Date: {formatDateTime(invoice?.created_at || new Date(), settings.timezone)}</span>
          </div>
          {showCustomerInfo && invoice?.customer_name && (
            <div className="border-t border-black/30 pt-1 mt-1 flex justify-between font-medium">
              <span>Bill To (Buyer): <strong className="text-black">{invoice.customer_name}</strong></span>
              {invoice.customer_phone && <span>Ph: {invoice.customer_phone}</span>}
            </div>
          )}
        </div>
      ) : templateId === "retro-double" ? (
        <div className="font-mono text-[8.5px] text-black font-bold space-y-0.5 my-1">
          <div className="flex justify-between border-b border-dotted border-black pb-0.5">
            <span>DATE: {new Date(invoice?.created_at || Date.now()).toLocaleDateString()}</span>
            <span>TIME: {new Date(invoice?.created_at || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
          <div className="flex justify-between pt-0.5">
            <span>RECEIPT: #{invoice?.id ? invoice.id.slice(0, 8).toUpperCase() : "PREVIEW"}</span>
            {showCustomerInfo && invoice?.customer_name && <span>CL: {invoice.customer_name}</span>}
          </div>
        </div>
      ) : (
        <div className="text-[9px] text-black space-y-0.5 my-1.5">
          <div className="flex justify-between items-center font-bold">
            <span>Date: {formatDateTime(invoice?.created_at || new Date(), settings.timezone)}</span>
            <span className="font-black">
              {invoice?.status === "quotation" || invoice?.payment_mode === "quotation"
                ? `Quot: #${invoice?.id ? invoice.id.slice(0, 8).toUpperCase() : "PREVIEW"}`
                : `Inv: #${invoice?.id ? invoice.id.slice(0, 8).toUpperCase() : "PREVIEW"}`
              }
            </span>
          </div>

          {showCustomerInfo && (invoice?.customer_name) && (
            <div className="pt-0.5 font-bold flex flex-wrap gap-x-2 gap-y-0.5">
              <span>Customer: <span className="font-black">{invoice.customer_name}</span></span>
              {invoice.customer_phone && <span>· Ph: {invoice.customer_phone}</span>}
              {invoice.customer_cnic && <span>· CNIC: {invoice.customer_cnic}</span>}
              {invoice.customer_father_name && <span>· S/O: {invoice.customer_father_name}</span>}
              {invoice.crop_season && <span>· Season: {invoice.crop_season}</span>}
            </div>
          )}

          {(invoice?.status === "quotation" || invoice?.payment_mode === "quotation") && (
            <div className="border border-black text-black text-center font-black py-0.5 text-[9px] rounded uppercase mt-1">
              {billingLanguage === "ur" ? "Quotation / Estimate (تخمینہ)" : "Quotation / Estimate"}
            </div>
          )}
        </div>
      )}

      {renderDivider()}

      {/* 4. Table Layouts based on template settings */}
      <table className="w-full text-left my-1.5 border-collapse">
        <thead>
          {templateId === "bold-stripe" ? (
            <tr className="bg-black text-white text-[8.5px] font-black uppercase">
              <th className="py-1 px-1.5">Item Description</th>
              <th className="text-center py-1 px-1 w-8">Qty</th>
              <th className="text-right py-1 px-1 w-12">Price</th>
              <th className="text-right py-1 px-1.5 w-14">Amount</th>
            </tr>
          ) : templateId === "retail-grid" ? (
            <tr className="border border-black text-[8.5px] font-black text-black bg-slate-50 uppercase">
              <th className="p-1 border-r border-black">Item</th>
              <th className="text-center p-1 border-r border-black w-8">Qty</th>
              <th className="text-right p-1 border-r border-black w-12">Price</th>
              <th className="text-right p-1 w-14">Amt</th>
            </tr>
          ) : templateId === "boutique-serif" ? (
            <tr className="border-b-2 border-black font-serif italic text-[9px] font-bold text-black">
              <th className="pb-1 pr-1">Article / Description</th>
              <th className="text-center pb-1 w-8">Qty</th>
              <th className="text-right pb-1 w-12">Rate</th>
              <th className="text-right pb-1 w-14">Total</th>
            </tr>
          ) : (
            <tr className={`border-b border-black text-[9px] font-black text-black ${templateId === "minimalist-air" ? "border-b-0 pb-2" : ""}`}>
              <th className="pb-1 pr-1">Item</th>
              <th className="text-center pb-1 w-8">Qty</th>
              <th className="text-right pb-1 w-12">Price</th>
              <th className="text-right pb-1 w-14">Amt</th>
            </tr>
          )}
        </thead>
        <tbody className={`text-[9.5px] text-black ${templateId === "retail-grid" ? "border border-black" : ""}`}>
          {itemsList.map((item: any, idx: number) => {
            const unitPrice = Number(item.price !== undefined ? item.price : (item.sale_price !== undefined ? item.sale_price : (item.unit_price || 0)));
            const lineTotal = Number(item.subtotal !== undefined ? item.subtotal : (unitPrice * (item.quantity || 1)));
            return (
              <tr key={idx} className={templateId === "paper-saver" ? "py-0.5 leading-tight" : "py-1"}>
                {/* Product Name & details */}
                <td className={`py-1 pr-1.5 ${templateId === "retail-grid" ? "p-1 border-r border-b border-black" : templateId === "modern-carbon" ? "border-b border-black/10 py-1.5" : ""}`}>
                  <div>
                    <p className={`font-black leading-tight text-black ${billingLanguage === "ur" ? "font-nastaleeq text-right text-[10.5px]" : ""}`}>
                      {getItemDisplayName(item, billingLanguage)}
                    </p>
                    <div className="flex gap-1.5 flex-wrap text-[8px] font-medium text-zinc-700 mt-0.5">
                      {showItemCode && (item.code || item.products?.code) && (
                        <span className="font-mono border border-black/40 px-0.5 rounded-xs">{item.code || item.products?.code}</span>
                      )}
                      {item.packingName && <span>({item.packingName})</span>}
                      {item.warranty && <span className="border border-black/40 px-0.5 rounded-xs">Warr: {item.warranty}</span>}
                      {showShelfLocation && (item.shelf_location || item.shelfLocation || item.products?.shelf_location) && (
                        <span className="border border-black/40 px-0.5 rounded-xs">
                          Shelf: {item.shelf_location || item.shelfLocation || item.products?.shelf_location}
                        </span>
                      )}
                      {showBatchNumber && (item.batch_number || item.batchNumber) && (
                        <span className="border border-black/40 px-0.5 rounded-xs font-mono">
                          Batch: {item.batch_number || item.batchNumber}
                          {showExpiryDate && (item.expiry_date || item.expiryDate) && ` · Exp: ${item.expiry_date || item.expiryDate}`}
                        </span>
                      )}
                    </div>
                    {item.sold_imeis && (
                      <p className="font-mono text-[7.5px] font-bold text-black mt-0.5 leading-tight break-all">
                        IMEIs: {item.sold_imeis}
                      </p>
                    )}
                  </div>
                </td>
                {/* Quantity */}
                <td className={`text-center py-1 font-mono font-bold text-black ${templateId === "retail-grid" ? "p-1 border-r border-b border-black" : templateId === "modern-carbon" ? "border-b border-black/10" : ""}`}>
                  {item.quantity}
                </td>
                {/* Unit Price */}
                <td className={`text-right py-1 font-mono font-bold text-black whitespace-nowrap ${templateId === "retail-grid" ? "p-1 border-r border-b border-black" : templateId === "modern-carbon" ? "border-b border-black/10" : ""}`}>
                  {unitPrice.toLocaleString(undefined, { minimumFractionDigits: unitPrice % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}
                </td>
                {/* Total Line Amount */}
                <td className={`text-right py-1 font-mono font-bold text-black whitespace-nowrap ${templateId === "retail-grid" ? "p-1 border-b border-black" : templateId === "modern-carbon" ? "border-b border-black/10" : ""}`}>
                  {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {renderDivider()}

      {/* 5. Summary and Totals Section (Theme Specific) */}
      <div className="space-y-1 my-1.5 text-black font-bold text-[9px]">
        {/* Gross Subtotal */}
        {totalItemDiscount > 0 && (
          <div className="flex justify-between items-center">
            <span>Gross Total:</span>
            <span className="font-mono font-black">{currencySymbol} {grossSubtotal.toFixed(2)}</span>
          </div>
        )}

        {/* Item Discount */}
        {totalItemDiscount > 0 && (
          <div className="flex justify-between items-center">
            <span>Item Discounts:</span>
            <span className="font-mono font-black">-{currencySymbol} {totalItemDiscount.toFixed(2)}</span>
          </div>
        )}

        {/* Subtotal */}
        <div className="flex justify-between items-center">
          <span>Subtotal:</span>
          <span className="font-mono font-black">{currencySymbol} {subtotal.toFixed(2)}</span>
        </div>

        {/* Tax */}
        {showTax && (invoice?.tax_amount > 0) && (
          <div className="flex justify-between items-center">
            <span>Tax ({invoice.tax_rate ? `${invoice.tax_rate}%` : ""}):</span>
            <span className="font-mono font-black">{currencySymbol} {Number(invoice.tax_amount).toFixed(2)}</span>
          </div>
        )}

        {/* Discount */}
        {showDiscount && (invoice?.discount > 0) && (
          <div className="flex justify-between items-center">
            <span>Discount:</span>
            <span className="font-mono font-black">-{currencySymbol} {Number(invoice.discount).toFixed(2)}</span>
          </div>
        )}

        {/* Govt Fertilizer Subsidy */}
        {invoice?.subsidy_amount > 0 && (
          <>
            <div className="flex justify-between items-center border border-black/40 px-1 rounded">
              <span>Govt Subsidy:</span>
              <span className="font-mono font-black">-{currencySymbol} {Number(invoice.subsidy_amount).toFixed(2)}</span>
            </div>
            {invoice.subsidy_voucher && (
              <div className="text-[8px] font-bold text-right">
                Voucher Code: {invoice.subsidy_voucher}
              </div>
            )}
          </>
        )}

        {/* Grand Total Styles per Template */}
        {templateId === "midnight-shaded" || templateId === "bold-stripe" ? (
          <div className="flex justify-between items-center p-1.5 rounded-xs text-white font-black bg-black my-1">
            <span className="tracking-wide">TOTAL RECEIVABLE:</span>
            <span className="font-mono text-sm">{currencySymbol} {Number(invoice?.total_amount || 0).toFixed(2)}</span>
          </div>
        ) : templateId === "modern-carbon" ? (
          <div className="border-2 border-black p-1.5 rounded-md flex justify-between items-center my-1.5 bg-slate-50">
            <span className="font-black text-[10px] uppercase tracking-wider">Net Amount:</span>
            <span className="font-mono text-sm font-black">{currencySymbol} {Number(invoice?.total_amount || 0).toFixed(2)}</span>
          </div>
        ) : templateId === "boutique-serif" ? (
          <div className="flex justify-between items-center py-1 border-y-2 border-double border-black font-serif font-black text-black my-1">
            <span className="tracking-widest uppercase">Amount Payable:</span>
            <span className="font-mono text-sm">{currencySymbol} {Number(invoice?.total_amount || 0).toFixed(2)}</span>
          </div>
        ) : templateId === "retro-double" ? (
          <div className="font-mono text-center my-1 border-y-2 border-black py-1">
            <div className="flex justify-between font-black text-sm">
              <span>*** TOTAL:</span>
              <span>{currencySymbol} {Number(invoice?.total_amount || 0).toFixed(2)} ***</span>
            </div>
          </div>
        ) : templateId === "minimalist-air" ? (
          <div className="flex justify-between items-center pt-2 text-black font-black text-sm">
            <span>Total:</span>
            <span className="font-mono font-extrabold">{currencySymbol} {Number(invoice?.total_amount || 0).toFixed(2)}</span>
          </div>
        ) : (
          <div className="flex justify-between items-center py-1 border-y border-black text-black font-black my-1">
            <span>Total Receivable:</span>
            <span className="font-mono text-sm font-black">
              {currencySymbol} {Number(invoice?.total_amount || 0).toFixed(2)}
            </span>
          </div>
        )}

        {/* Payment mode & breakdown */}
        {showPaymentMode && invoice?.payment_mode && (
          <div className="pt-0.5 space-y-0.5">
            <div className="flex justify-between">
              <span>Payment Mode:</span>
              <span className="font-black uppercase">
                {invoice.payment_mode === "quotation" 
                  ? "Quotation / Estimate" 
                  : invoice.payment_mode === "emi" 
                    ? "Installments (EMI)" 
                    : invoice.payment_mode}
              </span>
            </div>
            
            {((invoice.payment_mode === "credit" || invoice.payment_mode === "emi" || invoice.payment_mode === "partial") ||
              (Number(invoice.received_amount ?? invoice.paid_amount ?? 0) > 0 && Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.received_amount ?? invoice.paid_amount ?? 0)) > 0)) && (
              <>
                <div className="flex justify-between font-bold">
                  <span>{invoice.payment_mode === "emi" ? "Down Payment:" : (billingLanguage === "ur" ? "نقد وصولی (Cash Paid):" : "Cash Paid:")}</span>
                  <span className="font-mono font-black">{currencySymbol} {Number(invoice.received_amount !== undefined && invoice.received_amount !== null ? invoice.received_amount : (invoice.paid_amount || 0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black border-t border-dashed border-black/40 pt-0.5">
                  <span>{invoice.payment_mode === "emi" ? "EMI Debt Balance:" : (billingLanguage === "ur" ? "Udhaar Balance (کھاتا):" : "Balance Due:")}</span>
                  <span className="font-mono">{currencySymbol} {Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.received_amount !== undefined && invoice.received_amount !== null ? invoice.received_amount : (invoice.paid_amount || 0))).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Installment Plan Schedule Display */}
        {invoice?.payment_mode === "emi" && invoice?.emiSchedules && invoice.emiSchedules.length > 0 && (
          <div className="mt-2 border-t border-black pt-1.5 space-y-1 text-left">
            <div className="flex justify-between items-center text-[8.5px] font-black text-black border-b border-black pb-0.5">
              <span>📅 {billingLanguage === "ur" ? "Installment Plan (اقساط کا شیڈول):" : "Installment Schedule:"}</span>
              <span className="text-[7.5px] font-mono border border-black px-1">
                {invoice.emiSchedules.length} Payments
              </span>
            </div>
            
            <div className="space-y-0.5 font-mono text-[8px] font-bold text-black">
              {invoice.emiSchedules.map((s: any) => (
                <div key={s.installmentNum} className="flex justify-between border-b border-dotted border-black/40 pb-0.5 last:border-b-0">
                  <span>Inst #{s.installmentNum}: {new Date(s.dueDate).toLocaleDateString()}</span>
                  <span className="font-black">
                    {currencySymbol} {Number(s.amount).toFixed(2)} {s.status === 'paid' && '✓'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Customer Outstanding / Kul Baqaya ── */}
        {/* Only shown when a real customer is selected AND has a non-zero balance */}
        {invoice?.customer_balance !== undefined &&
          invoice?.customer_balance !== null &&
          Math.abs(Number(invoice.customer_balance)) > 0.009 && (
          <div className="mt-2 border-t-2 border-black pt-1.5 space-y-0.5">
            {/* Previous (pre-this-bill) balance */}
            <div className="flex justify-between items-center text-[8.5px] font-black text-black">
              <span>
                {billingLanguage === "ur" ? "پچھلا بقایا / Prev Balance:" : "Previous Balance:"}
              </span>
              <span className="font-mono">
                {currencySymbol}{" "}
                {(Number(invoice.customer_balance) - (
                  (invoice.payment_mode === "credit" || invoice.payment_mode === "partial")
                    ? Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.received_amount ?? invoice.paid_amount ?? 0))
                    : 0
                )).toFixed(2)}
              </span>
            </div>
            {/* This bill's added credit (if credit/partial) */}
            {(invoice.payment_mode === "credit" || invoice.payment_mode === "partial") &&
              Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.received_amount ?? invoice.paid_amount ?? 0)) > 0.009 && (
              <div className="flex justify-between items-center text-[8.5px] font-bold text-black">
                <span>{billingLanguage === "ur" ? "+ اس بل کا بقایا:" : "+ This Bill Due:"}</span>
                <span className="font-mono">
                  {currencySymbol}{" "}
                  {Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.received_amount ?? invoice.paid_amount ?? 0)).toFixed(2)}
                </span>
              </div>
            )}
            {/* Grand total outstanding — bold black strip */}
            <div className="flex justify-between items-center py-1 px-1.5 rounded font-black text-[9px] text-white bg-black mt-0.5">
              <span>
                {billingLanguage === "ur" ? "کُل بقایا / Total Due:" : "Total Outstanding:"}
              </span>
              <span className="font-mono">
                {currencySymbol} {Math.abs(Number(invoice.customer_balance)).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>


      {renderDivider()}

      {/* 6. Footer section (Theme Specific) */}
      <div className="text-center text-[8.5px] text-zinc-800 font-bold space-y-1 pt-0.5">
        {invoice?.status === "quotation" || invoice?.payment_mode === "quotation" ? (
          <>
            <p className="font-black text-black">{billingLanguage === "ur" ? "Estimate Only / صرف تخمینہ" : "Estimate Only"}</p>
            <p className="italic text-[8px] text-zinc-600">This is a price estimate. Prices valid for 7 days.</p>
          </>
        ) : (
          <>
            {thankYouMessage && <p className="font-black text-black">{thankYouMessage}</p>}
            {footerText && <p className="font-medium text-zinc-600 text-[8px]">{footerText}</p>}
          </>
        )}

        {/* QR Code Layout (Single QR Tech) */}
        {templateId === "qr-tech" && (
          <div className="flex flex-col items-center justify-center py-2 my-1 border border-black/30 bg-slate-50 p-2 rounded-lg space-y-1">
            <span className="text-[7.5px] font-black uppercase tracking-wider bg-black text-white px-2 py-0.5 rounded-full">
              ⚡ Digital Receipt Verified
            </span>
            <div className="w-16 h-16 bg-white border border-black p-0.5 flex items-center justify-center rounded overflow-hidden shadow-xs">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(
                  typeof window !== "undefined" && invoice?.id && invoice.id !== "PREVIEW"
                    ? `${window.location.origin}/public/receipt/${invoice.id}` 
                    : "https://theaccounts.cloud"
                )}`} 
                alt="Digital Receipt QR" 
                className="w-full h-full object-contain filter grayscale contrast-200"
              />
            </div>
            <span className="text-[7px] text-zinc-500 font-mono">Scan on mobile to view & download PDF</span>
          </div>
        )}

        {/* QR Code Layout (Dual QR Support) */}
        {templateId === "qr-tech-dual" && (
          <div className="flex items-center justify-center gap-3 py-1.5 my-1 border-y border-dashed border-black">
            {/* QR 1: Digital Bill */}
            <div className="flex flex-col items-center space-y-0.5 border border-black/20 p-1.5 rounded bg-slate-50">
              <div className="w-12 h-12 bg-white border border-black p-0.5 flex items-center justify-center rounded overflow-hidden">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(
                    typeof window !== "undefined" && invoice?.id && invoice.id !== "PREVIEW"
                      ? `${window.location.origin}/public/receipt/${invoice.id}` 
                      : "https://theaccounts.cloud"
                  )}`} 
                  alt="Digital Receipt QR" 
                  className="w-full h-full object-contain filter grayscale contrast-200"
                />
              </div>
              <span className="text-[7px] font-black text-black">Digital Bill</span>
            </div>

            {/* QR 2: E-Commerce Store */}
            <div className="flex flex-col items-center space-y-0.5 border border-black/20 p-1.5 rounded bg-slate-50">
              <div className="w-12 h-12 bg-white border border-black p-0.5 flex items-center justify-center rounded overflow-hidden">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(
                    typeof window !== "undefined"
                      ? `${window.location.origin}/store/faizan-mobile-shop` 
                      : "https://theaccounts.cloud"
                  )}`} 
                  alt="Online Web Store QR" 
                  className="w-full h-full object-contain filter grayscale contrast-200"
                />
              </div>
              <span className="text-[7px] font-black text-black">Online Store</span>
            </div>
          </div>
        )}

        {/* Corporate Signature Block */}
        {templateId === "corp-invoice" && (
          <div className="pt-4 pb-1 text-left">
            <div className="flex justify-between items-end border-t border-black/40 pt-4">
              <div className="text-[7.5px] text-zinc-500">
                <p>E. &amp; O.E.</p>
                <p>Goods once sold are subject to terms.</p>
              </div>
              <div className="text-center">
                <div className="w-24 border-b border-black mb-1"></div>
                <span className="text-[7.5px] font-bold uppercase">Authorized Signature</span>
              </div>
            </div>
          </div>
        )}

        {/* Official FBR Verification QR Code */}
        {enableFBR && showFbrQrCode !== false && (
          <div className="flex flex-col items-center justify-center py-1.5 my-1.5 border-y border-black space-y-0.5 text-center">
            <div className="w-16 h-16 bg-white border border-black p-0.5 flex items-center justify-center rounded overflow-hidden">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${encodeURIComponent(
                  invoice?.fbr_qr_code || `https://gst.fbr.gov.pk/qrcode?invoice=${invoice?.id || 'DEMO'}&posid=${fbrPosId || '100001'}&usin=${fbrPosId || '100001'}-${(invoice?.id || 'PREVIEW').slice(0, 8).toUpperCase()}`
                )}`} 
                alt="FBR Tax Asaan QR" 
                className="w-full h-full object-contain filter grayscale contrast-200"
              />
            </div>
            <div className="space-y-0.5">
              <p className="text-[8px] font-black text-black flex items-center justify-center gap-1">
                🇵🇰 FBR Tax Asaan Verified
              </p>
              <p className="text-[7px] font-medium text-zinc-700">Scan via FBR Asaan Tax App</p>
            </div>
          </div>
        )}

        {invoice?.status === "quotation" || invoice?.payment_mode === "quotation" ? (
          <p 
            className="text-black font-black mt-1.5 text-center" 
            style={billingLanguage === "ur" ? { 
              fontFamily: "Nastaliq, 'Noto Nastaliq Urdu', system-ui", 
              fontSize: `${fontSize + 2}px`, 
              direction: "rtl" 
            } : {}}
          >
            {billingLanguage === "ur" ? "یہ بل نہیں ہے، صرف نرخوں کا تخمینہ ہے" : "This is a price estimate, not a bill."}
          </p>
        ) : (
          billingLanguage === "ur" && customUrduNote && (
            <p 
              className="text-black font-black mt-1.5 text-center" 
              style={{ 
                fontFamily: "Nastaliq, 'Noto Nastaliq Urdu', system-ui", 
                fontSize: `${fontSize + 2}px`, 
                direction: "rtl" 
              }}
            >
              {customUrduNote}
            </p>
          )
        )}

        {/* Brand attribution */}
        <p className="text-[7.5px] font-medium text-zinc-500 pt-1 tracking-tight">
          Powered by {SOFTWARE_BRANDING} POS
        </p>
      </div>
    </div>
  );
}
