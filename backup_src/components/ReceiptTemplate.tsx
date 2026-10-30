"use client";

import React from "react";

// Centralized branding constant
export const SOFTWARE_BRANDING = "Hisab X";

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
  thankYouMessage: string;
  borderStyle: "dashed" | "solid" | "double" | "none" | "stars";
  customUrduNote: string;
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
  showPaymentMode: true,
  thankYouMessage: "Thank you for shopping with us!",
  borderStyle: "dashed",
  customUrduNote: "خریدہ ہوا مال واپس یا تبدیل نہیں ہوگا"
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
    { name: "Super Habib Cooking Oil 1L", quantity: 2, price: 520, packingName: "Pack of 1", code: "OIL-SH-01" },
    { name: "Sufi Banaspati Ghee 500g", quantity: 1, price: 290, packingName: "Box-Mini", code: "GHEE-S-02" },
    { name: "National Chilli Garlic Sauce 300g", quantity: 3, price: 70, packingName: "Bottle", code: "SAUCE-NAT-05" }
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
    thankYouMessage,
    borderStyle,
    customUrduNote
  } = mergedSettings;

  // Determine width based on Page Size setting
  let containerWidth = "w-full max-w-[320px]"; // Default 80mm
  if (pageSize === "MM58") {
    containerWidth = "w-full max-w-[240px]"; // 58mm
  } else if (pageSize === "A4") {
    containerWidth = "w-full max-w-[800px] p-8";
  } else if (pageSize === "A5") {
    containerWidth = "w-full max-w-[560px] p-6";
  }

  // Determine Font Family Class
  let fontStyleClass = "font-mono";
  if (fontFamily === "sans-serif") fontStyleClass = "font-sans tracking-tight";
  if (fontFamily === "serif") fontStyleClass = "font-serif";
  if (fontFamily === "urdu") fontStyleClass = "font-sans"; // We'll add inline Urdu font loading if required

  // Helper to render dividers
  const renderDivider = () => {
    if (borderStyle === "none") return <div className="my-2 border-b border-transparent"></div>;
    
    if (borderStyle === "stars") {
      return <div className="text-center text-slate-400 select-none overflow-hidden h-3 leading-none my-1">***************************************************</div>;
    }
    
    let borderClass = "border-dashed";
    if (borderStyle === "solid") borderClass = "border-solid";
    if (borderStyle === "double") borderClass = "border-double border-b-4";

    return (
      <div 
        className={`my-2 border-t ${borderClass}`} 
        style={{ borderColor: templateId === "accent-gradient" || templateId === "modern-carbon" ? primaryColor + "30" : "#d1d5db" }}
      ></div>
    );
  };

  // Inline color helpers
  const coloredText = { color: primaryColor };
  const coloredBg = { backgroundColor: primaryColor };
  const coloredBorder = { borderColor: primaryColor };

  // Calculate invoice subtotal (before discount and tax)
  const itemsList = invoice?.items || [];
  const subtotal = itemsList.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

  return (
    <div 
      className={`mx-auto bg-white text-slate-800 p-4 border border-zinc-200 select-none ${containerWidth} ${fontStyleClass}`}
      style={{ 
        fontSize: `${fontSize}px`, 
        lineHeight: "1.35",
        boxShadow: "inset 0 0 10px rgba(0,0,0,0.02)"
      }}
    >
      {/* 1. Gradient edge decoration */}
      {templateId === "accent-gradient" && (
        <div className="h-1.5 -mx-4 -mt-4 mb-4" style={{ background: `linear-gradient(90deg, ${primaryColor}, #818cf8)` }}></div>
      )}

      {/* 2. Header Section */}
      <div className="text-center space-y-1 mb-3">
        {/* Islamic grace header */}
        {templateId === "islamic-grace" && (
          <div className="text-[12px] font-bold text-center text-zinc-650 my-1 font-serif">
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </div>
        )}

        {/* Logo */}
        {showLogo && logoUrl && (
          <div className="flex justify-center mb-2">
            <img src={logoUrl} alt="Store Logo" className="h-10 w-auto object-contain" />
          </div>
        )}

        {/* Shop Name */}
        {templateId === "bold-stripe" ? (
          <div className="py-1.5 border-y-2 border-slate-900 my-1.5" style={{ borderColor: primaryColor }}>
            <h2 className="text-base font-black uppercase tracking-widest" style={coloredText}>{shopDetails.name || "Hisab X Store"}</h2>
          </div>
        ) : templateId === "midnight-shaded" ? (
          <div className="py-2 text-white font-black uppercase rounded-lg mb-1" style={coloredBg}>
            <h2 className="text-sm tracking-wider">{shopDetails.name || "Hisab X Store"}</h2>
          </div>
        ) : (
          <h2 className="text-sm font-black uppercase tracking-wide leading-tight">{shopDetails.name || "Hisab X Store"}</h2>
        )}

        {/* Tagline */}
        {showHeaderTagline && headerTagline && (
          <p className="text-[9px] text-slate-500 italic leading-none">{headerTagline}</p>
        )}

        {/* Contact details */}
        <div className="text-[9px] text-slate-450 space-y-0.5 pt-1">
          {showAddress && shopDetails.address && <p>{shopDetails.address}</p>}
          <div className="flex justify-center gap-2 flex-wrap">
            {showPhone && shopDetails.phone && <span>Ph: {shopDetails.phone}</span>}
            {showEmail && shopDetails.email && <span>Email: {shopDetails.email}</span>}
          </div>
          {showWebsite && shopDetails.website && <p className="font-semibold underline text-zinc-600">{shopDetails.website}</p>}
        </div>

        {/* Date and Invoice ID */}
        <div className="text-[9px] text-slate-400 pt-1 flex justify-between gap-1 flex-wrap border-t border-dashed border-slate-200 mt-2">
          <span>Date: {invoice?.created_at ? new Date(invoice.created_at).toLocaleString() : new Date().toLocaleString()}</span>
          <span className="font-bold">Inv: #{invoice?.id ? invoice.id.slice(0, 8).toUpperCase() : "PREVIEW"}</span>
        </div>
      </div>

      {renderDivider()}

      {/* 3. Customer Info */}
      {showCustomerInfo && (invoice?.customer_name) && (
        <div className="text-[9px] text-slate-700 space-y-0.5 mb-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
          <p className="font-bold">Bill To: <span className="text-slate-900">{invoice.customer_name}</span></p>
          {invoice.customer_phone && <p className="text-slate-500">Phone: {invoice.customer_phone}</p>}
        </div>
      )}

      {/* 4. Table Layouts based on template settings */}
      <table className="w-full text-left my-2 border-collapse">
        <thead>
          <tr className={`border-b text-[9px] font-bold text-slate-800 ${templateId === "retail-grid" ? "bg-slate-50 border-t border-x" : "border-slate-200"}`}>
            <th className={`pb-1 ${templateId === "retail-grid" ? "p-1 border-r border-slate-200" : "pr-2"}`}>Item</th>
            <th className={`text-center pb-1 ${templateId === "retail-grid" ? "p-1 border-r border-slate-200" : "w-10"}`}>Qty</th>
            <th className={`text-right pb-1 ${templateId === "retail-grid" ? "p-1" : "w-16"}`}>Amt</th>
          </tr>
        </thead>
        <tbody className={`text-[10px] ${templateId === "retail-grid" ? "border-b border-x border-slate-200" : "divide-y divide-slate-100"}`}>
          {itemsList.map((item: any, idx: number) => (
            <tr key={idx} className={templateId === "paper-saver" ? "py-0.5" : "py-1.5"}>
              {/* Product Name & details */}
              <td className={`py-1 pr-2 ${templateId === "retail-grid" ? "p-1 border-r border-b border-slate-150" : ""}`}>
                <div>
                  <p className="font-bold leading-tight text-slate-900">{item.name}</p>
                  <div className="flex gap-2 flex-wrap text-[8px] text-slate-450 mt-0.5">
                    {showItemCode && item.code && <span className="font-mono bg-slate-100 px-1 rounded">{item.code}</span>}
                    {item.packingName && <span className="text-indigo-650">({item.packingName})</span>}
                  </div>
                </div>
              </td>
              {/* Quantity */}
              <td className={`text-center py-1 font-mono ${templateId === "retail-grid" ? "p-1 border-r border-b border-slate-150" : ""}`}>
                {item.quantity}
              </td>
              {/* Price Row total */}
              <td className={`text-right py-1 font-mono text-slate-900 ${templateId === "retail-grid" ? "p-1 border-b border-slate-150" : ""}`}>
                Rs {Math.round(item.price * item.quantity * 100) / 100}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {renderDivider()}

      {/* 5. Summary and Totals Section */}
      <div className="space-y-1 mt-2">
        {/* Subtotal */}
        <div className="flex justify-between items-center text-[9px] text-slate-500">
          <span>Subtotal:</span>
          <span className="font-mono">Rs {subtotal.toFixed(2)}</span>
        </div>

        {/* Tax */}
        {showTax && (invoice?.tax_amount > 0) && (
          <div className="flex justify-between items-center text-[9px] text-slate-500">
            <span>Tax:</span>
            <span className="font-mono">Rs {Number(invoice.tax_amount).toFixed(2)}</span>
          </div>
        )}

        {/* Discount */}
        {showDiscount && (invoice?.discount > 0) && (
          <div className="flex justify-between items-center text-[9px] text-red-500">
            <span>Discount:</span>
            <span className="font-mono">-Rs {Number(invoice.discount).toFixed(2)}</span>
          </div>
        )}

        {/* Grand Total */}
        {templateId === "midnight-shaded" ? (
          <div className="flex justify-between items-center p-1.5 rounded text-slate-900 font-black border-y border-dashed border-slate-400 bg-slate-100 mt-1">
            <span>TOTAL:</span>
            <span className="font-mono text-xs">Rs {Number(invoice?.total_amount || 0).toFixed(2)}</span>
          </div>
        ) : templateId === "boutique-serif" ? (
          <div className="flex justify-between items-center py-1.5 border-double border-y-4 border-slate-800 font-serif font-bold text-slate-950 mt-1">
            <span>Amount Due:</span>
            <span className="font-mono text-xs">Rs {Number(invoice?.total_amount || 0).toFixed(2)}</span>
          </div>
        ) : (
          <div className="flex justify-between items-center py-1.5 border-t border-slate-200 text-slate-900 font-black mt-1">
            <span>Total Receivable:</span>
            <span className="font-mono text-xs" style={templateId === "accent-gradient" ? coloredText : {}}>
              Rs {Number(invoice?.total_amount || 0).toFixed(2)}
            </span>
          </div>
        )}

        {/* Payment mode & breakdown */}
        {showPaymentMode && invoice?.payment_mode && (
          <div className="pt-1.5 text-[9px] text-slate-500 space-y-0.5 border-t border-slate-100">
            <div className="flex justify-between">
              <span>Payment Mode:</span>
              <span className="font-bold uppercase text-slate-700">{invoice.payment_mode}</span>
            </div>
            
            {invoice.payment_mode === "credit" && (
              <>
                <div className="flex justify-between text-emerald-650">
                  <span>Cash Paid:</span>
                  <span className="font-mono">Rs {Number(invoice.received_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-red-650 border-t border-dotted border-slate-200 pt-0.5">
                  <span>Udhaar Balance:</span>
                  <span className="font-mono">Rs {Math.max(0, invoice.total_amount - (invoice.received_amount || 0)).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {renderDivider()}

      {/* 6. Footer section */}
      <div className="text-center text-[9px] text-slate-400 space-y-1.5 pt-2">
        {thankYouMessage && <p className="font-semibold text-slate-600">{thankYouMessage}</p>}
        {footerText && <p className="italic text-[8px]">{footerText}</p>}

        {/* QR Code Layout */}
        {templateId === "qr-tech" && (
          <div className="flex flex-col items-center py-2 space-y-1">
            <div className="w-16 h-16 bg-white border border-slate-200 p-0.5 flex items-center justify-center rounded overflow-hidden">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=0&data=${encodeURIComponent(
                  typeof window !== "undefined" && invoice?.id && invoice.id !== "PREVIEW"
                    ? `${window.location.origin}/public/receipt/${invoice.id}` 
                    : "https://github.com/usmandevcore/hisabultimate"
                )}`} 
                alt="Digital Receipt QR" 
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-[7px] text-slate-400">Scan for digital invoice</span>
          </div>
        )}

        {/* Custom Urdu footer note */}
        {customUrduNote && (
          <p 
            className="text-slate-600 font-semibold mt-2 text-center" 
            style={{ 
              fontFamily: "Nastaliq, 'Noto Nastaliq Urdu', system-ui", 
              fontSize: `${fontSize + 2}px`, 
              direction: "rtl" 
            }}
          >
            {customUrduNote}
          </p>
        )}

        {/* Brand attribution */}
        <p className="text-[8px] text-slate-300 font-light border-t border-slate-100 pt-1 mt-1.5">
          Powered by {SOFTWARE_BRANDING} POS
        </p>
      </div>
    </div>
  );
}
