"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShopProvider, useShop } from "@/context/ShopContext";
import { SidebarThemeProvider } from "@/context/SidebarThemeContext";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Menu, Bell, Search, Sparkles, CreditCard, Megaphone, Lock, Loader2, FileText, Package, User, Layers, ArrowRight, AlertTriangle, Coffee, ChefHat, Car, Scissors, Pill, Tag, X, ChevronRight, CornerDownLeft, UtensilsCrossed, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import Link from "next/link";
import { OfflineStatusBar } from "@/components/sync/OfflineStatusBar";
import { useOfflineCatalog } from "@/hooks/useOfflineCatalog";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { MobileMoreMenu } from "@/components/dashboard/MobileMoreMenu";
import { MobileLanguagePicker } from "@/components/dashboard/MobileLanguagePicker";
import { MobileVipHeader } from "@/components/dashboard/MobileVipHeader";
import { useIsMobile } from "@/hooks/useIsMobile";
import { supabase } from "@/lib/supabase";
import { getSuggestedUpgradePlanName } from "@/lib/planMatrix";
import { isPathAllowedWhenLocked } from "@/lib/subscription/grace-period";


import { cn } from "@/lib/utils";
import { UserProfileModal } from "@/components/dashboard/UserProfileModal";
import { ImpersonationBanner } from "@/components/dashboard/ImpersonationBanner";;

function HeaderUserProfileButton({ onDark = false }: { onDark?: boolean }) {
  const { userName, userRole } = useShop();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const initial = (userName || 'U').charAt(0).toUpperCase();

  return (
    <>
      <button 
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center gap-2.5 p-1 rounded-full transition-all cursor-pointer group ${
          onDark
            ? "pr-1 bg-white/15 hover:bg-white/25 border border-white/20"
            : "pr-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-sm"
        }`}
        title="View Advanced User Profile"
      >
        <div className={`h-8 w-8 rounded-full p-0.5 shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center text-white font-black text-xs ${
          onDark
            ? "bg-gradient-to-tr from-white/30 to-white/10"
            : "bg-gradient-to-tr from-blue-600 to-indigo-600"
        }`}>
          <div className={`h-full w-full rounded-full flex items-center justify-center ${
            onDark ? "bg-indigo-950/40" : "bg-slate-900"
          }`}>
            {initial}
          </div>
        </div>
        <div className={`text-left hidden sm:block ${onDark ? "hidden" : ""}`}>
          <p className="text-xs font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">{userName || "User Profile"}</p>
          <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">{userRole || "Superadmin"}</p>
        </div>
      </button>

      <UserProfileModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

// ── Dynamic Business-Aware Search System ──────────────────────────────────
type SearchPageItem = {
  name: string;
  path: string;
  ur: string;
  keywords: string;
  industries: string[];
  category: string;
  badge?: string;
  iconType?: string;
};

const PAGES_LIST: SearchPageItem[] = [
  // Core Operations
  { name: "Dashboard Overview", path: "/dashboard", ur: "ڈیش بورڈ جائزہ", keywords: "home main command center overview analytics", industries: ["all"], category: "General", iconType: "reports" },
  { name: "Restaurant POS Desk", path: "/dashboard/restaurant/pos", ur: "ریستوران بلنگ پوائنٹ آف سیل", keywords: "restaurant pos billing dine in takeaway delivery fast food order food counter desk kitchen table kot cashier", industries: ["restaurant"], category: "Restaurant", badge: "POS", iconType: "pos" },
  { name: "Retail POS Counter", path: "/dashboard/pos", ur: "ریٹیل پی او ایس بلنگ", keywords: "pos billing retail sell invoice cash counter barcode scan barcode billing cashier", industries: ["retail", "general", "pharmacy", "electronics", "fuel", "fertilizer"], category: "Sales", badge: "POS", iconType: "pos" },
  { name: "Sales Register & Invoices", path: "/dashboard/sales", ur: "سیلز رجسٹر انوائس", keywords: "sales invoices register sell receipts tax invoices history returns receipts history", industries: ["all"], category: "Sales", iconType: "sales" },
  { name: "Customer & Supplier Khata Book", path: "/dashboard/khata", ur: "کھاتہ بک گاہک سپلائر بقایا", keywords: "khata customers suppliers credit ledger outstanding balance parties debt receivable payable udhaar", industries: ["all"], category: "Khata", iconType: "khata" },
  { name: "Cash Registers & Shifts", path: "/dashboard/registers", ur: "رجسٹر سیشن شفٹ کیش", keywords: "registers sessions shifts open close cash float daily drawer counter reconciliation cash in hand", industries: ["all"], category: "Finance", iconType: "finance" },
  { name: "Gift Cards & Loyalty Vouchers", path: "/dashboard/general/cards", ur: "گفٹ کارڈ واؤچر", keywords: "gift cards vouchers coupons discount loyalty points rewards customer retention", industries: ["retail", "general"], category: "Marketing", iconType: "marketing" },

  // Restaurant Operations
  { name: "Dining Tables & Floor Plan", path: "/dashboard/restaurant/tables", ur: "ریستوران میزیں فلور پلان", keywords: "tables dine in seating layout floor plan hall family section occupancy vacant guests table booking", industries: ["restaurant"], category: "Restaurant", iconType: "table" },
  { name: "Kitchen Display System (KDS)", path: "/dashboard/restaurant/kds", ur: "کچن ڈسپلے اسکرین", keywords: "kds kitchen chef cooking screen live tickets preparation food order live queue dispatch chef station timer", industries: ["restaurant"], category: "Restaurant", iconType: "kds" },
  { name: "Kitchen Order Tickets (KOT)", path: "/dashboard/restaurant/kot", ur: "کچن آرڈر ٹکٹ", keywords: "kot kitchen order ticket print slip chef food cooking orders kot live status", industries: ["restaurant"], category: "Restaurant", iconType: "kot" },
  { name: "Restaurant Orders Management", path: "/dashboard/restaurant/orders", ur: "ریستوران آرڈرز لسٹ", keywords: "restaurant orders food status dispatch delivery takeaway dinein pending delivered cancelled", industries: ["restaurant"], category: "Restaurant", iconType: "sales" },
  { name: "Waiter Mobile Ordering Desk", path: "/dashboard/restaurant/waiter", ur: "ویٹر آرڈرنگ ڈیسک", keywords: "waiter steward captain mobile tablet order table service captain app", industries: ["restaurant"], category: "Restaurant", iconType: "pos" },
  { name: "Active Dining Bills & Tables", path: "/dashboard/restaurant/active-bills", ur: "ایکٹو بلز اور میزیں", keywords: "active bills pending unpaid open tables checkout settle bill print receipt split bill payment", industries: ["restaurant"], category: "Restaurant", iconType: "sales" },
  { name: "Digital QR Code Menu", path: "/dashboard/restaurant/qr", ur: "ڈیجیٹل کیو آر مینو", keywords: "qr code digital menu contactless table scan phone ordering customer self order", industries: ["restaurant"], category: "Restaurant", iconType: "marketing" },
  { name: "Food Deals & Combos", path: "/dashboard/restaurant/deals", ur: "کھانے کی ڈیلز اور کومبو", keywords: "deals combos meal special bundle discount package family deal burger deal pizza combo", industries: ["restaurant"], category: "Restaurant", iconType: "marketing" },
  { name: "Dish Modifiers & Add-ons", path: "/dashboard/restaurant/modifiers", ur: "موڈیفائرز اور اضافی آئٹمز", keywords: "modifiers addons toppings spice level extra cheese sauce beverage size sides crust cold drink", industries: ["restaurant"], category: "Restaurant", iconType: "inventory" },
  { name: "Kitchen Stations Master", path: "/dashboard/restaurant/stations", ur: "کچن اسٹیشنز ماسٹر", keywords: "stations hot kitchen grill bar drinks beverage tandoor dessert fry preparation printer", industries: ["restaurant"], category: "Restaurant", iconType: "settings" },
  { name: "Recipes & Food Costing", path: "/dashboard/restaurant/recipes", ur: "ترکیبیں اور لاگت لاگ", keywords: "recipes bom ingredients food cost yield raw material portions dish preparation chicken flour oil", industries: ["restaurant"], category: "Restaurant", iconType: "inventory" },
  { name: "Restaurant Sales & Kitchen Reports", path: "/dashboard/restaurant/reports", ur: "ریستوران رپورٹس و تجزیہ", keywords: "restaurant reports daily sales top dishes covers food cost kot summary waiter performance table turnover", industries: ["restaurant"], category: "Reports", iconType: "reports" },

  // Showroom & Vehicles
  { name: "Showroom Vehicles Stock", path: "/dashboard/showroom/vehicles", ur: "گاڑیوں کا اسٹاک", keywords: "showroom vehicles cars bikes stock inventory chassis engine model year make register color mileage", industries: ["showroom"], category: "Showroom", iconType: "showroom" },
  { name: "Showroom Vehicle Sales / Contracts", path: "/dashboard/showroom/sales", ur: "گاڑیوں کی فروخت بلنگ", keywords: "showroom sales sell vehicle car bike contract bayana invoice customer transfer biometric sale agreement", industries: ["showroom"], category: "Showroom", badge: "POS", iconType: "sales" },
  { name: "Showroom Installments & EMI (Qist)", path: "/dashboard/showroom/installments", ur: "گاڑیوں کی اقساط", keywords: "showroom installments emi qist schedule due ledger recovery penalty monthly plan downpayment recovery slip", industries: ["showroom"], category: "Showroom", iconType: "finance" },
  { name: "Showroom Parties & Dealers", path: "/dashboard/showroom/parties", ur: "خریدار و ڈیلرز پارٹیاں", keywords: "showroom parties dealers buyers sellers guarantors showroom ledger dealer commision broker", industries: ["showroom"], category: "Showroom", iconType: "khata" },
  { name: "Showroom Investors & Capital", path: "/dashboard/showroom/investors", ur: "انویسٹرز و شراکت دار", keywords: "showroom investors partners capital profit share sharakat equity investment car investor profit distribution", industries: ["showroom"], category: "Showroom", iconType: "finance" },
  { name: "Showroom Rent-a-Car / Bike", path: "/dashboard/showroom/rentals", ur: "رینٹ اے کار موٹرسائیکل", keywords: "showroom rentals rent car bike booking return daily rental security deposit meter reading vehicle rent", industries: ["showroom"], category: "Showroom", iconType: "showroom" },
  { name: "Showroom Reports & Analytics", path: "/dashboard/showroom/reports", ur: "شوروم رپورٹس و تجزیہ", keywords: "showroom reports sales profit vehicle investors analytics stock value emi collection profit loss", industries: ["showroom"], category: "Reports", iconType: "reports" },

  // Tailor & Stitching
  { name: "Tailor Customer Measurements", path: "/dashboard/tailor/measurements", ur: "کسٹمر ناپ اور پیمائش", keywords: "tailor measurements customer size suit kameez shalwar pant shirt fitting arm length collar waist cuff", industries: ["tailor"], category: "Tailor", iconType: "tailor" },
  { name: "Tailor Stitching Orders", path: "/dashboard/tailor/orders", ur: "سلائی آرڈرز رجسٹر", keywords: "tailor orders stitching delivery date suit dress urgent advance cloth fabric unstitched suit slip", industries: ["tailor"], category: "Tailor", iconType: "pos" },
  { name: "Tailor Karigar & Workers", path: "/dashboard/tailor/karigar", ur: "کاریگر اور مزدور", keywords: "tailor karigar workers wages piece rate stitcher cutter master commission karigar ledger wages payment", industries: ["tailor"], category: "Tailor", iconType: "staff" },
  { name: "Tailor Production Reports", path: "/dashboard/tailor/reports", ur: "سلائی رپورٹس", keywords: "tailor reports delivery pending suits revenue completed suits karigar summary delivery date tracker", industries: ["tailor"], category: "Reports", iconType: "reports" },

  // Pharmacy
  { name: "Batches & Expiry Tracker", path: "/dashboard/pharmacy/expiry", ur: "بیچ اور ایکسپائری ٹریکر", keywords: "pharmacy expiry batches fefo near expiry expired medicine dates alert batch number shelf life", industries: ["pharmacy"], category: "Pharmacy", iconType: "pharmacy" },
  { name: "Controlled / Narcotics Register", path: "/dashboard/pharmacy/controlled", ur: "شیڈول G اور نشہ آور ادویات رجسٹر", keywords: "pharmacy controlled narcotics schedule g sleeping pills sedatives drap doctor register prescription check", industries: ["pharmacy"], category: "Pharmacy", iconType: "pharmacy" },
  { name: "Cold Chain & Temperature Log", path: "/dashboard/pharmacy/temperature", ur: "فریج درجہ حرارت لاگ", keywords: "pharmacy temperature fridge cold chain vaccines insulin biologics daily log thermometer monitor", industries: ["pharmacy"], category: "Pharmacy", iconType: "pharmacy" },
  { name: "Short Book / Demand Register", path: "/dashboard/pharmacy/short-book", ur: "شارٹ بک کسٹمر ڈیمانڈ", keywords: "pharmacy short book customer demand missing medicine out of stock urgent supply customer request", industries: ["pharmacy"], category: "Pharmacy", iconType: "pharmacy" },
  { name: "Doctor Incentive & Referral Ledger", path: "/dashboard/pharmacy/doctors", ur: "ڈاکٹرز کمیشن و ریفرل", keywords: "pharmacy doctors commission incentives referrals clinics prescriptions dr consultant ledger", industries: ["pharmacy"], category: "Pharmacy", iconType: "khata" },
  { name: "Medicine Formulas (Generics)", path: "/dashboard/pharmacy/formulas", ur: "فارمولیشنز متبادل ادویات", keywords: "pharmacy formulations generics salts alternates substitute brand lookup panadol paracetamol salt", industries: ["pharmacy"], category: "Pharmacy", iconType: "pharmacy" },
  { name: "Distributor Expiry Claims", path: "/dashboard/pharmacy/claims", ur: "ایکسپائری کلیمز ڈسٹری بیوٹر", keywords: "pharmacy claims expiry supplier credit notes return replacement distributor claim debit note", industries: ["pharmacy"], category: "Pharmacy", iconType: "finance" },
  { name: "Low Stock & Reorder Alerts", path: "/dashboard/inventory/low-stock", ur: "کم اسٹاک الرٹس", keywords: "low stock alert reorder point minimum level out of stock items medicine shortage reorder", industries: ["pharmacy", "retail"], category: "Inventory", iconType: "inventory" },

  // Electronics & Mobile
  { name: "Installments & EMI Master", path: "/dashboard/electronics/emi", ur: "اقساط اور ای ایم آئی", keywords: "electronics emi installments monthly mobile appliance qist down payment schedule guarantor", industries: ["electronics"], category: "Electronics", iconType: "finance" },
  { name: "Device Repair & Service Tracker", path: "/dashboard/electronics/repair", ur: "مرمت اور سروس ٹریکر", keywords: "electronics repair service phone laptop job card technician status delivered warranty fixing screen", industries: ["electronics"], category: "Electronics", iconType: "settings" },
  { name: "Used Phone Trade-in / Buyback", path: "/dashboard/electronics/buyback", ur: "استعمال شدہ موبائل خرید و فروخت", keywords: "electronics buyback tradein used phone exchange purchase second hand old mobile", industries: ["electronics"], category: "Electronics", iconType: "sales" },
  { name: "IMEI & Serial Number Tracker", path: "/dashboard/electronics/imei-tracker", ur: "آئی ایم ای آئی اور سیریل ٹریکر", keywords: "electronics imei serial number device warranty search find phone mobile imei lookup", industries: ["electronics"], category: "Electronics", iconType: "inventory" },

  // Fuel Station
  { name: "Fuel Tanks & Dipping Log", path: "/dashboard/fuel/tanks", ur: "فیول ٹینکس اور پیمائش لاگ", keywords: "fuel tanks dipping underground petrol diesel cng volume capacity stock dip rod reading", industries: ["fuel"], category: "Fuel", iconType: "inventory" },
  { name: "Nozzle & Meter Readings", path: "/dashboard/fuel/readings", ur: "نوزل اور میٹر ریڈنگز", keywords: "fuel readings nozzles pumps meter sales liters dispenser daily shift sales counter", industries: ["fuel"], category: "Fuel", iconType: "sales" },

  // Fertilizer & Agro
  { name: "Fertilizer Batches & Lots", path: "/dashboard/fertilizer/batches", ur: "کھاد بیچز اور لاٹس", keywords: "fertilizer batches lots expiry seeds pesticide agriculture urea dap npk chemical spray", industries: ["fertilizer"], category: "Fertilizer", iconType: "inventory" },
  { name: "Farmer Khata & Subsidy Ledger", path: "/dashboard/fertilizer/khata", ur: "کسان کھاتہ اور سبسڈی", keywords: "fertilizer farmer khata subsidy kisaan card credit agriculture ledger subsidy claim", industries: ["fertilizer"], category: "Khata", iconType: "khata" },

  // Inventory, Purchases & Expenses (Core)
  { name: "Product Catalog / Inventory Master", path: "/dashboard/products", ur: "پروڈکٹس کیٹالاگ انوینٹری", keywords: "products catalog inventory items stock list dishes medicines goods sku barcode price cost stock level", industries: ["all"], category: "Inventory", iconType: "inventory" },
  { name: "Purchase Orders & Stock In", path: "/dashboard/purchase", ur: "پرچیز آرڈرز اسٹاک ان", keywords: "purchase orders stock in supplier receiving inventory goods receiving note grn bills vendor supplier bill", industries: ["all"], category: "Purchases", iconType: "inventory" },
  { name: "Stock Adjustments & Damage Loss", path: "/dashboard/returns", ur: "اسٹاک ایڈجسٹمنٹ نقصان واپسی", keywords: "returns stock adjustments damage loss wastage expiry write-off audit count damage entry return stock", industries: ["all"], category: "Inventory", iconType: "inventory" },
  { name: "Expense Tracker & Operational Costs", path: "/dashboard/expenses", ur: "اخراجات خرچے یوٹیلٹی", keywords: "expenses bills costs utilities operational outflow spending daily petty cash rent salary electricity generator", industries: ["all"], category: "Finance", iconType: "finance" },
  { name: "Barcode Label Designer & Printing", path: "/dashboard/barcode", ur: "بارکوڈ لیبل پرنٹنگ", keywords: "barcode labels sticker printing thermal printer generator sku code label print sticker tag", industries: ["retail", "general", "pharmacy", "electronics"], category: "Tools", iconType: "settings" },

  // HR & Staff
  { name: "HR & Staff Management / Payroll", path: "/dashboard/staff", ur: "اسٹاف ملازمین تنخواہ پی رول", keywords: "hr staff employees salary payroll attendance wages workers attendance waiters commission salary advance", industries: ["all"], category: "HR", iconType: "staff" },

  // Accounts & Finance
  { name: "General Ledger & Journal Vouchers (JV)", path: "/dashboard/accounts", ur: "جنرل لیجر جرنل واؤچر", keywords: "general ledger accounts journal vouchers jv gl double entry debit credit accounting chart of accounts balance sheet trial balance", industries: ["all"], category: "Accounting", iconType: "finance" },
  { name: "Profit & Loss Statement (P&L)", path: "/dashboard/reports/gl", ur: "منافع نقصان رپورٹ پی اینڈ ایل", keywords: "profit loss p&l income statement revenue expenses pl net profit financial summary gross profit margin", industries: ["all"], category: "Accounting", iconType: "reports" },
  { name: "Balance Sheet & Financial Position", path: "/dashboard/accounts", ur: "بیلنس شیٹ اثاثے واجبات", keywords: "balance sheet assets liabilities equity net worth financial position statement capital accounting", industries: ["all"], category: "Accounting", iconType: "finance" },

  // Reports & Analytics
  { name: "Analytics & Executive Reports", path: "/dashboard/reports", ur: "رپورٹس سینٹر تجزیہ", keywords: "analytics reports charts graphs statistics metrics performance summary daily weekly monthly sales analysis pdf export print", industries: ["all"], category: "Reports", iconType: "reports" },

  // Settings & System
  { name: "Settings & System Preferences", path: "/dashboard/settings", ur: "سیٹنگز ترتیبات بزنس پروفائل", keywords: "settings config configuration shop profile preferences tax gst thermal printer invoice format business info phone address", industries: ["all"], category: "Settings", iconType: "settings" },
  { name: "Fiscal Closings & Period Finalization", path: "/dashboard/settings/closing", ur: "کتابیں بند کریں مالی سال فائنل", keywords: "closing books period fiscal year end lock finalize accounts audit lock annual closing month end", industries: ["all"], category: "Settings", iconType: "settings" },
  { name: "System Backups & Data Export", path: "/dashboard/backup", ur: "بیک اپ ڈیٹا ڈاؤن لوڈ", keywords: "backup data export restore gdrive google drive zip download csv excel database auto backup", industries: ["all"], category: "Settings", iconType: "settings" },
  { name: "Subscription & Plan Management", path: "/dashboard/billing", ur: "بلنگ سبسکرپشن پلانز", keywords: "billing subscription plans upgrade pricing premium features renew license saas tier expiry", industries: ["all"], category: "Settings", iconType: "settings" },
  { name: "My Businesses & Multi-Branch", path: "/dashboard/my-businesses", ur: "میرے کاروبار برانچز", keywords: "my businesses branches multi-store switch shop company outlets branch store switch", industries: ["all"], category: "Settings", iconType: "settings" },
];

function filterPagesByIndustry(industryType: string | null | undefined): SearchPageItem[] {
  const norm = (industryType || "general").toLowerCase().trim();
  return PAGES_LIST.filter((page) => {
    if (page.industries.includes("all")) return true;

    if (norm === "restaurant" || norm === "cafe" || norm === "bakery" || norm === "food") {
      return page.industries.includes("restaurant");
    }
    if (norm === "showroom" || norm === "vehicles" || norm === "motors") {
      return page.industries.includes("showroom");
    }
    if (norm === "tailor" || norm === "boutique") {
      return page.industries.includes("tailor");
    }
    if (norm === "pharmacy" || norm === "medical") {
      return page.industries.includes("pharmacy") || page.industries.includes("retail");
    }
    if (norm === "electronics" || norm === "mobile") {
      return page.industries.includes("electronics") || page.industries.includes("retail");
    }
    if (norm === "fuel") {
      return page.industries.includes("fuel") || page.industries.includes("retail");
    }
    if (norm === "fertilizer") {
      return page.industries.includes("fertilizer") || page.industries.includes("retail");
    }
    return page.industries.includes("retail") || page.industries.includes("general");
  });
}

function getIndustryBadgeLabel(industryType: string | null | undefined): string {
  const norm = (industryType || "general").toLowerCase().trim();
  switch (norm) {
    case "restaurant":
    case "cafe":
    case "bakery":
    case "food":
      return "Restaurant";
    case "showroom":
    case "vehicles":
      return "Showroom";
    case "tailor":
      return "Tailor";
    case "pharmacy":
    case "medical":
      return "Pharmacy";
    case "electronics":
    case "mobile":
      return "Electronics";
    case "fuel":
      return "Fuel";
    case "fertilizer":
      return "Fertilizer";
    default:
      return "Retail";
  }
}

function getSearchPlaceholder(industryType: string | null | undefined): string {
  const norm = (industryType || "general").toLowerCase().trim();
  if (norm === "restaurant" || norm === "cafe" || norm === "bakery" || norm === "food") {
    return "Search menu, tables, KDS, orders, invoices... (Ctrl+K)";
  }
  if (norm === "showroom" || norm === "vehicles") {
    return "Search vehicles, chassis, EMI, invoices... (Ctrl+K)";
  }
  if (norm === "tailor") {
    return "Search measurements, orders, karigars, khata... (Ctrl+K)";
  }
  if (norm === "pharmacy") {
    return "Search medicines, batches, formulas, customers... (Ctrl+K)";
  }
  return "Search products, barcodes, invoices, customers... (Ctrl+K)";
}

function getQuickShortcuts(industryType: string | null | undefined) {
  const norm = (industryType || "general").toLowerCase().trim();
  if (norm === "restaurant" || norm === "cafe" || norm === "bakery" || norm === "food") {
    return [
      { name: "Restaurant POS Desk", path: "/dashboard/restaurant/pos", iconType: "pos", desc: "Live dining & takeaway billing" },
      { name: "Dining Tables & Floor", path: "/dashboard/restaurant/tables", iconType: "table", desc: "Floor plan & table occupancy" },
      { name: "Kitchen Display (KDS)", path: "/dashboard/restaurant/kds", iconType: "kds", desc: "Live kitchen cooking queue" },
      { name: "Dishes & Menu Master", path: "/dashboard/products", iconType: "inventory", desc: "Food items, prices & recipes" },
      { name: "Customer Khata Book", path: "/dashboard/khata", iconType: "khata", desc: "Ledgers & credit balances" },
      { name: "Sales Invoices", path: "/dashboard/sales", iconType: "sales", desc: "Daily sale receipts & register" },
    ];
  }
  if (norm === "showroom" || norm === "vehicles") {
    return [
      { name: "Showroom Vehicle Sales", path: "/dashboard/showroom/sales", iconType: "sales", desc: "Vehicle contracts & deals" },
      { name: "Vehicles Stock & Chassis", path: "/dashboard/showroom/vehicles", iconType: "showroom", desc: "Car & bike inventory" },
      { name: "Installments & EMI (Qist)", path: "/dashboard/showroom/installments", iconType: "finance", desc: "Monthly payment schedules" },
      { name: "Dealers & Parties", path: "/dashboard/showroom/parties", iconType: "khata", desc: "Dealer & customer ledgers" },
      { name: "Analytics & Reports", path: "/dashboard/reports", iconType: "reports", desc: "Profit & vehicle sales analysis" },
    ];
  }
  if (norm === "tailor") {
    return [
      { name: "Customer Measurements", path: "/dashboard/tailor/measurements", iconType: "tailor", desc: "Suits & dress measurements" },
      { name: "Stitching Orders", path: "/dashboard/tailor/orders", iconType: "pos", desc: "Active & pending stitching orders" },
      { name: "Karigar & Workers", path: "/dashboard/tailor/karigar", iconType: "staff", desc: "Staff wages & job cards" },
      { name: "Customer Khata", path: "/dashboard/khata", iconType: "khata", desc: "Customer balance & credit" },
    ];
  }
  if (norm === "pharmacy") {
    return [
      { name: "Retail POS Counter", path: "/dashboard/pos", iconType: "pos", desc: "Quick medicine counter billing" },
      { name: "Expiry & Batches Tracker", path: "/dashboard/pharmacy/expiry", iconType: "pharmacy", desc: "FEFO batch & near-expiry alerts" },
      { name: "Controlled Drugs (Schedule G)", path: "/dashboard/pharmacy/controlled", iconType: "pharmacy", desc: "Narcotics & restricted log" },
      { name: "Medicine Inventory", path: "/dashboard/products", iconType: "inventory", desc: "Stock levels & salt formulas" },
    ];
  }
  return [
    { name: "Retail POS Counter", path: "/dashboard/pos", iconType: "pos", desc: "Point of sale barcode billing" },
    { name: "Products & Inventory", path: "/dashboard/products", iconType: "inventory", desc: "Catalog, barcodes & stock" },
    { name: "Sales Register & Invoices", path: "/dashboard/sales", iconType: "sales", desc: "Invoices & return receipts" },
    { name: "Party Khata Book", path: "/dashboard/khata", iconType: "khata", desc: "Customer & supplier ledgers" },
    { name: "Purchase Orders / Stock In", path: "/dashboard/purchase", iconType: "inventory", desc: "Supplier deliveries & stock-in" },
    { name: "Expense Tracker", path: "/dashboard/expenses", iconType: "finance", desc: "Daily expenses & outflows" },
  ];
}

function renderItemIcon(type?: string) {
  switch (type) {
    case "pos":
      return <Zap size={14} className="text-amber-500" />;
    case "table":
      return <Coffee size={14} className="text-sky-500" />;
    case "kds":
    case "kot":
      return <ChefHat size={14} className="text-rose-500" />;
    case "showroom":
      return <Car size={14} className="text-violet-500" />;
    case "tailor":
      return <Scissors size={14} className="text-teal-500" />;
    case "pharmacy":
      return <Pill size={14} className="text-pink-500" />;
    case "inventory":
      return <Package size={14} className="text-emerald-500" />;
    case "sales":
      return <FileText size={14} className="text-blue-500" />;
    case "khata":
    case "staff":
      return <User size={14} className="text-indigo-500" />;
    case "finance":
      return <CreditCard size={14} className="text-emerald-600" />;
    case "reports":
      return <Layers size={14} className="text-purple-500" />;
    default:
      return <FileText size={14} className="text-slate-500" />;
  }
}

function HeaderSearch({ forceInline = false }: { forceInline?: boolean }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { shopId, subscriptionLocked, industryType } = useShop();
  const isMobile = useIsMobile();
  const useMobileSheet = isMobile && !forceInline;
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [results, setResults] = useState<{
    pages: SearchPageItem[];
    products: any[];
    invoices: any[];
    parties: any[];
    tables: any[];
  }>({ pages: [], products: [], invoices: [], parties: [], tables: [] });
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const industryBadge = getIndustryBadgeLabel(industryType);
  const searchPlaceholderText = getSearchPlaceholder(industryType);
  const quickShortcuts = getQuickShortcuts(industryType);

  // Global keyboard shortcut Ctrl+K / Cmd+K to focus searchbar anywhere
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "TEXTAREA" ||
            (target.tagName === "INPUT" && target !== inputRef.current))
        ) {
          return;
        }
        e.preventDefault();
        if (useMobileSheet) {
          setMobileSheetOpen(true);
        } else {
          inputRef.current?.focus();
          setIsOpen(true);
        }
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setMobileSheetOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [useMobileSheet]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchSeqRef = useRef(0);
  const searchCacheRef = useRef<Map<string, { products: any[]; invoices: any[]; parties: any[]; tables: any[] }>>(new Map());

  // Filtered pages strictly by industry
  const relevantPages = filterPagesByIndustry(industryType);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || !shopId) {
      setResults({ pages: [], products: [], invoices: [], parties: [], tables: [] });
      setLoading(false);
      return;
    }

    const searchTerms = trimmed.toLowerCase();

    // 1. Instantly filter in-memory pages with 0ms latency
    const matchedPages = relevantPages.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerms) ||
        p.ur.includes(searchTerms) ||
        (p.keywords && p.keywords.toLowerCase().includes(searchTerms))
    );

    // Immediately display matched pages without waiting for the database!
    setResults((prev) => ({
      ...prev,
      pages: matchedPages,
    }));

    const cacheKey = `${shopId}_${industryType || "general"}_${searchTerms}`;
    if (searchCacheRef.current.has(cacheKey)) {
      const cached = searchCacheRef.current.get(cacheKey)!;
      setResults({
        pages: matchedPages,
        products: cached.products,
        invoices: cached.invoices,
        parties: cached.parties,
        tables: cached.tables,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    const seq = ++searchSeqRef.current;

    // Fast 100ms debounce
    const delayDebounce = setTimeout(async () => {
      try {
        const norm = (industryType || "general").toLowerCase().trim();
        const isRestaurant = norm === "restaurant" || norm === "cafe" || norm === "food";

        // Execute all 4 database queries simultaneously in parallel!
        const [prodRes, invRes, partyRes, tableRes] = await Promise.allSettled([
          // Products / dishes query
          supabase
            .from("products")
            .select("id, name, code, sale_price_single, current_stock")
            .eq("shop_id", shopId)
            .or(`name.ilike.%${trimmed}%,code.ilike.%${trimmed}%`)
            .limit(5),

          // Invoices query
          trimmed.length >= 2
            ? supabase
                .from("invoices")
                .select("id, total_amount, created_at, customer_name")
                .eq("shop_id", shopId)
                .or(`id::text.ilike.%${trimmed}%,customer_name.ilike.%${trimmed}%`)
                .limit(4)
            : Promise.resolve({ data: [] }),

          // Parties (customers/suppliers) query
          supabase
            .from("parties")
            .select("id, name, type, phone, current_balance")
            .eq("shop_id", shopId)
            .or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
            .limit(4),

          // Tables query (if restaurant)
          isRestaurant
            ? supabase
                .from("restaurant_tables")
                .select("id, name, table_number, capacity, status")
                .eq("shop_id", shopId)
                .ilike("name", `%${trimmed}%`)
                .limit(3)
            : Promise.resolve({ data: [] }),
        ]);

        // If another newer keystroke happened, ignore these results
        if (seq !== searchSeqRef.current) return;

        const prodData =
          prodRes.status === "fulfilled" && (prodRes.value as any)?.data
            ? (prodRes.value as any).data
            : [];
        const invData =
          invRes.status === "fulfilled" && (invRes.value as any)?.data
            ? (invRes.value as any).data
            : [];
        const partyData =
          partyRes.status === "fulfilled" && (partyRes.value as any)?.data
            ? (partyRes.value as any).data
            : [];
        const tableData =
          tableRes.status === "fulfilled" && (tableRes.value as any)?.data
            ? (tableRes.value as any).data
            : [];

        // Save to cache
        searchCacheRef.current.set(cacheKey, {
          products: prodData,
          invoices: invData,
          parties: partyData,
          tables: tableData,
        });
        if (searchCacheRef.current.size > 60) {
          const first = searchCacheRef.current.keys().next().value;
          if (first) searchCacheRef.current.delete(first);
        }

        setResults({
          pages: matchedPages,
          products: prodData,
          invoices: invData,
          parties: partyData,
          tables: tableData,
        });
      } catch (err) {
        console.error("Fast global search error:", err);
      } finally {
        if (seq === searchSeqRef.current) {
          setLoading(false);
        }
      }
    }, 100);

    return () => clearTimeout(delayDebounce);
  }, [query, shopId, industryType]);

  const hasResults =
    results.pages.length > 0 ||
    results.products.length > 0 ||
    results.invoices.length > 0 ||
    results.parties.length > 0 ||
    results.tables.length > 0;

  const handleSelect = (path: string) => {
    router.push(path);
    setIsOpen(false);
    setMobileSheetOpen(false);
    setQuery("");
  };

  const searchResultsPanel = (isMobileSheet = false) => {
    // When input is empty, show instant Quick Shortcuts relevant to this business!
    if (!query.trim()) {
      return (
        <div className="flex flex-col gap-3 py-1">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <Zap size={13} className="text-amber-500" />
              <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                Quick {industryBadge} Shortcuts
              </p>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500">
              {industryBadge} Mode
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {quickShortcuts.map((sc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(sc.path)}
                className={`flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-sky-50/60 hover:border-sky-200 transition-all text-left group cursor-pointer ${
                  isMobileSheet ? "min-h-[48px]" : ""
                }`}
              >
                <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  {renderItemIcon(sc.iconType)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-sky-700 transition-colors truncate">
                    {sc.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{sc.desc}</p>
                </div>
                <ArrowRight size={13} className="text-slate-300 group-hover:text-sky-600 transition-colors shrink-0" />
              </button>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-2 px-1 flex items-center justify-between text-[11px] text-slate-400">
            <p>Type to search dishes, customers, invoices, or tables...</p>
            <p className="font-bold text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 hidden sm:block">
              ESC to close
            </p>
          </div>
        </div>
      );
    }

    return (
      <>
        {loading && (
          <div className="flex items-center justify-center py-6 text-slate-500 gap-2.5 text-xs font-medium">
            <Loader2 className="animate-spin h-4 w-4 text-sky-600" />
            Searching {industryBadge} records & database...
          </div>
        )}

        {!loading && !hasResults && (
          <div className="text-center py-8 text-slate-400 text-xs flex flex-col items-center gap-2">
            <Search className="h-8 w-8 opacity-30" />
            <p className="font-bold text-slate-700">No matching records found in {industryBadge}</p>
            <p className="text-[11px] text-slate-400">Try another keyword, product code, invoice number, or customer name.</p>
          </div>
        )}

        {/* 1. Dining Tables (Restaurant only) */}
        {!loading && results.tables.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <div className="flex items-center gap-1.5">
                <Coffee size={12} className="text-sky-600" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Dining Tables & Floor
                </p>
              </div>
              <div className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                {results.tables.length} found
              </div>
            </div>
            <div className="space-y-1">
              {results.tables.map((tbl) => (
                <button
                  key={tbl.id}
                  type="button"
                  onClick={() => handleSelect("/dashboard/restaurant/pos")}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-sky-50/70 border border-transparent hover:border-sky-200 transition-all text-left group cursor-pointer ${
                    isMobileSheet ? "min-h-[46px]" : ""
                  }`}
                >
                  <div className="h-8 w-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700 shrink-0 font-bold text-xs">
                    <Coffee size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{tbl.name || `Table ${tbl.table_number}`}</p>
                    <p className="text-[10px] text-slate-400">Capacity: {tbl.capacity || 4} guests</p>
                  </div>
                  <div className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border shrink-0 ${
                    tbl.status === "occupied"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}>
                    {tbl.status === "occupied" ? "Occupied" : "Available"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2. Business Pages & Modules (strictly filtered by industry) */}
        {!loading && results.pages.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <div className="flex items-center gap-1.5">
                <Layers size={12} className="text-indigo-600" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {industryBadge} Pages & Features
                </p>
              </div>
              <div className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                {results.pages.length} pages
              </div>
            </div>
            <div className="space-y-1">
              {results.pages.map((page, idx) => (
                <button
                  key={`page-${idx}`}
                  type="button"
                  onClick={() => handleSelect(page.path)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50/70 border border-transparent hover:border-indigo-200 transition-all text-left group cursor-pointer ${
                    isMobileSheet ? "min-h-[46px]" : ""
                  }`}
                >
                  <div className="h-8 w-8 rounded-lg bg-indigo-100/80 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                    {renderItemIcon(page.iconType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-900 transition-colors truncate">
                        {page.name}
                      </p>
                      {page.badge && (
                        <div className="text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-300 shrink-0">
                          {page.badge}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{page.path}</p>
                  </div>
                  <ArrowRight size={14} className="ml-auto text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Products & Dishes */}
        {!loading && results.products.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <div className="flex items-center gap-1.5">
                <Package size={12} className="text-emerald-600" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Products & Dishes ({results.products.length})
                </p>
              </div>
            </div>
            <div className="space-y-1">
              {results.products.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => handleSelect("/dashboard/products")}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200 transition-all text-left group cursor-pointer ${
                    isMobileSheet ? "min-h-[46px]" : ""
                  }`}
                >
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <Package size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{prod.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      {prod.code && <p className="font-mono">SKU: {prod.code}</p>}
                      <p className="font-bold text-emerald-700">Rs {Number(prod.sale_price_single || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="ml-auto text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. Invoices & Receipts */}
        {!loading && results.invoices.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <div className="flex items-center gap-1.5">
                <FileText size={12} className="text-blue-600" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Invoices & Receipts ({results.invoices.length})
                </p>
              </div>
            </div>
            <div className="space-y-1">
              {results.invoices.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => handleSelect("/dashboard/sales")}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50/70 border border-transparent hover:border-blue-200 transition-all text-left group cursor-pointer ${
                    isMobileSheet ? "min-h-[46px]" : ""
                  }`}
                >
                  <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      Invoice #{inv.id.slice(0, 8).toUpperCase()} {inv.customer_name ? `(${inv.customer_name})` : ""}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold text-blue-700">
                      Rs {Number(inv.total_amount || 0).toLocaleString()}
                    </p>
                  </div>
                  <ArrowRight size={14} className="ml-auto text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5. Customers & Suppliers */}
        {!loading && results.parties.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <div className="flex items-center gap-1.5">
                <User size={12} className="text-violet-600" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Customers & Parties ({results.parties.length})
                </p>
              </div>
            </div>
            <div className="space-y-1">
              {results.parties.map((party) => (
                <button
                  key={party.id}
                  type="button"
                  onClick={() => handleSelect("/dashboard/khata")}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-violet-50/70 border border-transparent hover:border-violet-200 transition-all text-left group cursor-pointer ${
                    isMobileSheet ? "min-h-[46px]" : ""
                  }`}
                >
                  <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 shrink-0">
                    <User size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{party.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <p className="capitalize font-semibold">{party.type || "Customer"}</p>
                      {party.phone && <p>{party.phone}</p>}
                    </div>
                  </div>
                  <ArrowRight size={14} className="ml-auto text-slate-300 group-hover:text-violet-500 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  if (subscriptionLocked) {
    return (
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300" />
        <Input
          type="search"
          disabled
          placeholder="Search disabled - renew subscription to continue"
          className="w-full bg-slate-100 pl-10 pr-4 border-slate-200 h-10 rounded-full text-sm text-slate-400 cursor-not-allowed"
        />
      </div>
    );
  }

  if (useMobileSheet) {
    return (
      <>
        <button
          type="button"
          onClick={() => setMobileSheetOpen(true)}
          className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-600 active:scale-95 transition-transform shrink-0 cursor-pointer"
          aria-label="Search"
        >
          <Search className="h-4.5 w-4.5" />
        </button>

        {mobileSheetOpen && (
          <div className="fixed inset-0 z-[100] bg-white flex flex-col safe-top safe-bottom md:hidden">
            <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-100 shrink-0">
              <div ref={containerRef} className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  ref={inputRef}
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                  }}
                  placeholder={searchPlaceholderText}
                  className="w-full bg-slate-50 pl-10 pr-9 border-slate-200 h-11 rounded-xl text-sm"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                className="shrink-0 font-bold text-slate-600 h-11 px-3"
                onClick={() => {
                  setMobileSheetOpen(false);
                  setIsOpen(false);
                  setQuery("");
                }}
              >
                Cancel
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {searchResultsPanel(true)}
            </div>
          </div>
        )}
      </>
    );
  }

  if (isMobile && forceInline) {
    return (
      <>
        <button
          type="button"
          onClick={() => setMobileSheetOpen(true)}
          className="relative w-full flex items-center gap-2 text-left min-h-[40px] cursor-pointer"
        >
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <p className="text-sm text-slate-400 truncate flex-1">
            {query || searchPlaceholderText}
          </p>
        </button>

        {mobileSheetOpen && (
          <div className="fixed inset-0 z-[100] bg-white flex flex-col safe-top safe-bottom">
            <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-100 shrink-0">
              <div ref={containerRef} className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                  }}
                  placeholder={searchPlaceholderText}
                  className="w-full bg-slate-50 pl-10 pr-9 border-slate-200 h-11 rounded-xl text-sm"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                className="shrink-0 font-bold text-slate-600 h-11 px-3"
                onClick={() => {
                  setMobileSheetOpen(false);
                  setIsOpen(false);
                  setQuery("");
                }}
              >
                Cancel
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {searchResultsPanel(true)}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative w-full flex items-center">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={searchPlaceholderText}
          className="w-full bg-slate-100/80 hover:bg-slate-100 focus:bg-white pl-10 pr-20 border-slate-200/90 focus-visible:ring-sky-600 h-10 rounded-full text-xs font-medium text-slate-800 placeholder:text-slate-400 transition-all shadow-2xs"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 pointer-events-auto cursor-pointer"
              title="Clear search"
            >
              <X size={13} />
            </button>
          ) : (
            <div className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200/70 border border-slate-300/60 text-[9.5px] font-bold text-slate-500">
              Ctrl K
            </div>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-12 left-0 w-full md:min-w-[440px] lg:min-w-[500px] max-h-[460px] overflow-y-auto no-scrollbar bg-white/98 backdrop-blur-md border border-slate-200/90 shadow-2xl rounded-2xl p-4 z-[9999] transition-all flex flex-col gap-3.5 animate-in fade-in-50 zoom-in-95 duration-150">
          {searchResultsPanel(false)}
        </div>
      )}
    </div>
  );
}


function HeaderNotifications({ onDark = false }: { onDark?: boolean }) {
  const { shopId } = useShop();
  const [isOpen, setIsOpen] = useState(false);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!shopId) return;
    
    async function fetchLowStock() {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, current_stock, min_stock_level")
          .eq("shop_id", shopId);

        if (error) throw error;

        const lowItems = (data || []).filter(
          (p: { current_stock?: number | null; min_stock_level?: number | null }) =>
            Number(p.current_stock ?? 0) <= Number(p.min_stock_level ?? 0)
        );
        setLowStockItems(lowItems);
      } catch (err) {
        console.error("Error fetching low stock alerts:", err);
      }
    }

    fetchLowStock();
    
    const interval = setInterval(fetchLowStock, 30000);
    return () => clearInterval(interval);
  }, [shopId]);

  return (
    <div ref={containerRef} className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-all cursor-pointer ${
          onDark
            ? "bg-white/15 hover:bg-white/25 border border-white/20 text-white"
            : "hover:bg-slate-100 border border-slate-200"
        }`}
        title="View Notifications & Stock Alerts"
      >
        <Bell size={20} className={onDark ? "text-white" : "text-slate-655"} />
        {lowStockItems.length > 0 && (
          <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border border-white animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xl rounded-2xl p-4 z-50 transition-all flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <p className="text-xs font-black text-slate-800">System Notifications</p>
            {lowStockItems.length > 0 && (
              <div className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                {lowStockItems.length} alerts
              </div>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
            {lowStockItems.length === 0 ? (
              <div className="text-center py-8 text-slate-450 text-xs flex flex-col items-center gap-2">
                🎉
                <p className="text-xs text-slate-400 py-3 text-center font-medium">All caught up! No active stock alerts.</p>
              </div>
            ) : (
              lowStockItems.map((item, idx) => (
                <div key={idx} className="flex gap-2.5 p-2.5 rounded-xl bg-red-50/50 border border-red-100/50 text-xs text-left">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex flex-col leading-tight">
                    <p className="font-bold text-slate-800">Low Stock Alert</p>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      <strong>{item.name}</strong> stock is low. Current: <strong>{parseFloat(item.current_stock || '0').toFixed(0)}</strong> (Minimum alert level: {parseFloat(item.min_stock_level || '0').toFixed(0)}).
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SystemAnnouncementBanner() {
  const { systemAnnouncement, loading } = useShop();

  if (loading || !systemAnnouncement || !systemAnnouncement.active || !systemAnnouncement.message) return null;

  const type = systemAnnouncement.type || "warning";
  const bgClass = 
    type === "danger" 
      ? "bg-red-600 border-red-700 text-white" 
      : type === "success" 
        ? "bg-emerald-600 border-emerald-705 text-white" 
        : type === "info"
          ? "bg-blue-600 border-blue-700 text-white"
          : "bg-amber-500 border-amber-600 text-slate-900";

  const iconClass = type === "danger" || type === "warning" || type === "info" || type === "success" ? "text-white" : "text-slate-800";

  return (
    <div className={`px-6 py-2 text-center text-xs font-bold border-b flex items-center justify-center gap-2 ${bgClass}`}>
      <Megaphone size={14} className={`${iconClass} shrink-0 animate-bounce`} />
      <p>{systemAnnouncement.message}</p>
    </div>
  );
}

function SubscriptionExpiredBanner() {
  const { subscriptionLocked, loading } = useShop();
  const pathname = usePathname();

  if (loading || !subscriptionLocked || !pathname.startsWith("/dashboard/billing")) return null;

  return (
    <div className="px-6 py-2.5 border-b text-xs font-bold flex flex-col sm:flex-row justify-between items-center gap-3 bg-red-50 border-red-200 text-red-900">
      <div className="flex items-center gap-2">
        <Lock size={14} className="text-red-600 shrink-0" />
        <p>
          <strong className="text-red-700 uppercase tracking-wide mr-1.5">[System Locked]</strong>
          Your subscription expired and the grace period has ended. Renew below to unlock the full system.
        </p>
      </div>
    </div>
  );
}

function TrialBanner() {
  const {
    subscriptionExpiresAt,
    subscriptionTier,
    subscriptionLifecycle,
    graceDaysRemaining,
    loading,
  } = useShop();

  if (loading || !subscriptionExpiresAt) return null;

  const expiry = new Date(subscriptionExpiresAt);
  const today = new Date();
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (subscriptionLifecycle === "grace") {
    const daysLabel = graceDaysRemaining === 1 ? "day" : "days";
    return (
      <div className="px-6 py-2.5 border-b text-xs font-bold flex flex-col sm:flex-row justify-between items-center gap-3 bg-amber-50 border-amber-200 text-amber-950">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 animate-pulse" />
          <div>
            <strong className="text-amber-800 uppercase tracking-wide mr-1.5">[Grace Period]</strong>
            Your subscription expired. You have{" "}
            <strong className="underline text-amber-900">
              {graceDaysRemaining} {daysLabel}
            </strong>{" "}
            left before the system is fully locked. Renew now to avoid interruption.
            <div className="block sm:inline sm:ml-2 text-amber-800/90 font-semibold">
              / سبسکرپشن ختم - {graceDaysRemaining} دن میں سسٹم لاک ہو جائے گا۔
            </div>
          </div>
        </div>
        <Link href="/dashboard/billing">
          <button className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-1.5 cursor-pointer bg-amber-600 hover:bg-amber-700 text-white shadow-amber-100">
            <CreditCard size={12} />
            Renew Subscription
          </button>
        </Link>
      </div>
    );
  }

  if (subscriptionLifecycle === "locked") return null;

  const isExpiringSoon = diffDays > 0 && diffDays <= 10;
  if (!isExpiringSoon) return null;

  return (
    <div className="px-6 py-2.5 border-b text-xs font-bold flex flex-col sm:flex-row justify-between items-center gap-3 transition-all bg-rose-50/90 border-rose-150 text-rose-950">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-rose-600 shrink-0 animate-pulse" />
        <p>
          <strong className="text-rose-700 uppercase tracking-wide mr-1.5">[Expiring Soon]</strong>
          Only{" "}
          <strong className="underline text-rose-800">
            {diffDays} {diffDays === 1 ? "day" : "days"}
          </strong>{" "}
          remaining on your subscription ({subscriptionTier || "plan"}). Renew today to keep access.
        </p>
      </div>
      <Link href="/dashboard/billing">
        <button className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-1.5 cursor-pointer bg-rose-600 hover:bg-rose-700 text-white shadow-rose-100">
          <CreditCard size={12} />
          Renew Subscription
        </button>
      </Link>
    </div>
  );
}

// OfflineWarningBanner replaced by OfflineStatusBar (includes queue counts + dead-letter UI)

function OfflineCatalogSync() {
  useOfflineCatalog();
  return null;
}


function HeaderLanguageSwitcher() {
  return <MobileLanguagePicker />;
}

function getActivePageName(pathname: string): string {
  const routes: Record<string, string> = {
    "/dashboard": "Dashboard Overview",
    "/dashboard/restaurant/pos": "Restaurant POS",
    "/dashboard/restaurant/tables": "Table Management",
    "/dashboard/restaurant/orders": "Order History & Management",
    "/dashboard/restaurant/deals": "Deals & Menu Sizes",
    "/dashboard/restaurant/kds": "Kitchen Display Monitor (KDS)",
    "/dashboard/restaurant/kot": "Kitchen Display (KOT)",
    "/dashboard/restaurant/modifiers": "Menu Add-ons / Modifiers",
    "/dashboard/restaurant/qr": "QR Table Ordering",
    "/dashboard/restaurant/reservations": "Reservations",
    "/dashboard/restaurant/stations": "Kitchen Stations",
    "/dashboard/restaurant/waiter": "Waiter Desk",
    "/dashboard/restaurant/active-bills": "Active Table Bills",
    "/dashboard/restaurant/menu": "Menu & Recipe Master",
    "/dashboard/pos": "Point of Sale (POS)",
    "/dashboard/sales": "Sales Ledger & Invoices",
    "/dashboard/khata": "Customer Khata Book",
    "/dashboard/products": "Inventory & Products Catalog",
    "/dashboard/purchase": "Purchase / Stock-In",
    "/dashboard/expenses": "Enterprise Expense Tracker",
    "/dashboard/returns": "Returns & Stock Adjustments",
    "/dashboard/reports": "Auditing & Reports Center",
    "/dashboard/registers": "Daily Register (Daybook)",
    "/dashboard/staff": "Staff & Attendance Management",
    "/dashboard/settings/closing": "Fiscal Period Closings",
    "/dashboard/settings": "System Settings",
    "/dashboard/backup": "Database Backups",
    "/dashboard/billing": "Subscription & Billing",
    "/dashboard/my-businesses": "My Businesses",
    "/dashboard/ecommerce": "Online Orders Desk",
    "/dashboard/accounts": "Wallets & Accounts Ledger",
    "/dashboard/units": "Units & Packings",
  };

  if (routes[pathname]) return routes[pathname];

  for (const [route, title] of Object.entries(routes)) {
    if (route !== "/dashboard" && pathname.startsWith(route)) {
      return title;
    }
  }

  const segment = pathname.split("/").filter(Boolean).pop() || "Dashboard";
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function FullWidthDashboardHeader() {
  const pathname = usePathname();
  const { shopName, shopLogo } = useShop();
  const pageTitle = getActivePageName(pathname);

  return (
    <header className="w-full h-14 sm:h-[60px] bg-white border-b border-slate-200 px-3 sm:px-5 flex items-center justify-between shrink-0 z-40 shadow-2xs">
      {/* Left section: 1. Business Logo, 2. Business Name, 3. Page Name */}
      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-sidebar"))}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 md:hidden shrink-0 cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>

        {/* 1. Business Logo (jo db ma save ha) */}
        <Link href="/dashboard" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
          {shopLogo ? (
            <div className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs overflow-hidden flex items-center justify-center shrink-0">
              <img
                src={shopLogo}
                alt={shopName || "Business Logo"}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-slate-900 text-white font-extrabold shadow-2xs flex items-center justify-center shrink-0">
              <p className="leading-none text-xs sm:text-sm font-bold">
                {shopName ? shopName.charAt(0).toUpperCase() : "FS"}
              </p>
            </div>
          )}

          {/* 2. Business Name (jo db ma save ha) */}
          <div className="flex flex-col min-w-0">
            <p className="font-extrabold text-xs sm:text-sm md:text-base text-slate-900 tracking-tight leading-tight truncate max-w-[100px] sm:max-w-[160px] md:max-w-[200px]">
              {shopName || "Falcon Swift"}
            </p>
            <p className="text-[10px] font-bold text-sky-700 tracking-tight truncate sm:hidden">
              {pageTitle}
            </p>
          </div>
        </Link>

        {/* 3. Page Name (Jo sidebar sa open kiya howa ha wo wla) - Desktop pill */}
        <div className="hidden sm:flex items-center gap-2.5 shrink-0 pl-1">
          <div className="h-4 w-[1px] bg-slate-200 shrink-0" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100/90 border border-slate-200/80 shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse shrink-0" />
            <p className="text-xs font-bold text-slate-800 tracking-tight whitespace-nowrap">
              {pageTitle}
            </p>
          </div>
        </div>
      </div>

      {/* Center section: 4. Searchbar */}
      <div className="flex-1 max-w-xs md:max-w-sm lg:max-w-md mx-2 sm:mx-4 min-w-0">
        <HeaderSearch />
      </div>

      {/* Right section: 5. Language toggle, 6. Notification, 7. Admin Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <HeaderLanguageSwitcher />
        <HeaderNotifications />
        <HeaderUserProfileButton />
      </div>
    </header>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const isPosRoute =
    pathname === "/dashboard/pos" || pathname === "/dashboard/restaurant/pos";
  const showMobileChrome = isMobile && !isPosRoute;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === "true") {
      setSidebarCollapsed(true);
    }

    const handleOpenSidebar = () => setSidebarOpen(true);
    window.addEventListener("open-sidebar", handleOpenSidebar);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "b") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setSidebarCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem("sidebar_collapsed", String(next));
        return next;
      });
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("open-sidebar", handleOpenSidebar);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleCollapsed = () => {
    setSidebarCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem("sidebar_collapsed", String(newVal));
      return newVal;
    });
  };

  return (
    <ShopProvider>
      <SidebarThemeProvider>
        <OfflineCatalogSync />
        <div className={cn("flex flex-col h-[100dvh] w-full overflow-hidden font-sans", isMobile && "dashboard-mobile-shell", "bg-slate-50")}>
          {/* Top Impersonation Banner (if active) */}
          <ImpersonationBanner />

          {/* 1. Full-width Top Header across ALL dashboards */}
          <FullWidthDashboardHeader />

          {/* 2. Body Container: Sidebar + Main Content (below the full-width header) */}
          <div className="flex flex-1 min-h-0 w-full overflow-hidden relative">
            {/* Desktop sidebar */}
            {!isMobile && (
              <Sidebar
                isOpen={sidebarOpen}
                isCollapsed={sidebarCollapsed}
                onClose={() => setSidebarOpen(false)}
                onToggleCollapsed={toggleCollapsed}
              />
            )}

            {/* Mobile sidebar drawer if opened */}
            {isMobile && sidebarOpen && (
              <Sidebar
                isOpen={sidebarOpen}
                isCollapsed={false}
                onClose={() => setSidebarOpen(false)}
              />
            )}

            <MobileMoreMenu open={isMobile && sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50">
              <OfflineStatusBar />

              <SystemAnnouncementBanner />
              <SubscriptionExpiredBanner />
              <TrialBanner />

              {/* Page Content */}
              <div
                className={cn(
                  "flex-1 overflow-auto overscroll-contain",
                  isPosRoute
                    ? isMobile
                      ? "p-0 pb-[calc(3.65rem+env(safe-area-inset-bottom,0px))] flex flex-col min-h-0 overflow-hidden"
                      : "p-0 flex flex-col min-h-0 overflow-hidden"
                    : showMobileChrome
                      ? "p-2.5 pb-[calc(3.65rem+env(safe-area-inset-bottom,0px))] md:p-4 lg:p-5"
                      : "p-3.5 md:p-4 lg:p-5"
                )}
              >
                <DashboardContentWrapper>
                  {children}
                </DashboardContentWrapper>
              </div>
            </main>
          </div>

          {isMobile && <MobileBottomNav />}
        </div>
      </SidebarThemeProvider>
    </ShopProvider>
  );
}

function PremiumLockScreen({
  requiredPlan,
  currentPlan,
}: {
  requiredPlan: string;
  currentPlan?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white border border-slate-200/80 rounded-3xl p-8 text-center max-w-lg mx-auto space-y-6 shadow-md mt-6">
      <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
        <Lock size={28} className="animate-bounce" />
      </div>
      <div>
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Plan Upgrade Required / اپگریڈ لازمی ہے</h3>
        {currentPlan ? (
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Current plan: <strong className="text-slate-700">{currentPlan}</strong>
          </p>
        ) : null}
        <p className="text-xs text-slate-400 font-semibold mt-1">
          Upgrade to <strong className="text-indigo-600 font-bold">{requiredPlan}</strong> to unlock this feature.
        </p>
        <p className="text-sm font-medium text-slate-600 mt-4 leading-relaxed">
          یہ فیچر آپ کے موجودہ پلان میں شامل نہیں ہے۔ براہ کرم admin panel میں مقرر کردہ پلان کے مطابق اپنا سبسکرپشن اپگریڈ کریں۔
        </p>
      </div>
      <div className="w-full border-t border-dashed border-slate-200 pt-6 flex flex-col gap-2.5">
        <Link href="/dashboard/billing" className="w-full">
          <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black h-11 rounded-2xl shadow-lg shadow-blue-500/15">
            Upgrade Plan / ابھی پلان اپگریڈ کریں
          </Button>
        </Link>
        <Link href="/dashboard" className="w-full">
          <Button variant="ghost" className="w-full text-slate-500 hover:bg-slate-100 font-bold h-10 rounded-2xl text-xs">
            Back to Dashboard / ڈیش بورڈ پر واپس جائیں
          </Button>
        </Link>
      </div>
    </div>
  );
}

function DashboardContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, planName, saasPlans, canAccessDashboardPath, subscriptionLocked } = useShop();

  useEffect(() => {
    if (loading || !subscriptionLocked) return;
    if (!isPathAllowedWhenLocked(pathname)) {
      router.replace("/dashboard/billing");
    }
  }, [loading, subscriptionLocked, pathname, router]);

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col justify-center items-center text-slate-400 p-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650 mb-2" />
        <p className="text-xs font-semibold">Validating session permissions...</p>
      </div>
    );
  }

  if (subscriptionLocked && !isPathAllowedWhenLocked(pathname)) {
    return (
      <div className="h-full w-full flex flex-col justify-center items-center text-slate-400 p-12">
        <Loader2 className="h-8 w-8 animate-spin text-red-600 mb-2" />
        <p className="text-xs font-semibold">Redirecting to billing…</p>
      </div>
    );
  }

  const authorized = typeof canAccessDashboardPath === "function" ? canAccessDashboardPath(pathname) : true;

  if (!authorized) {
    const suggestedPlan = getSuggestedUpgradePlanName(pathname, saasPlans);
    return (
      <PremiumLockScreen
        requiredPlan={suggestedPlan}
        currentPlan={planName}
      />
    );
  }

  return <>{children}</>;
}

