"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShopProvider, useShop } from "@/context/ShopContext";
import { SidebarThemeProvider } from "@/context/SidebarThemeContext";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Bell, Search, Sparkles, CreditCard, Megaphone, Lock, Loader2, FileText, Package, User, Layers, ArrowRight, AlertTriangle } from "lucide-react";
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

function HeaderSearch({ forceInline = false }: { forceInline?: boolean }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { shopId, subscriptionLocked } = useShop();
  const isMobile = useIsMobile();
  const useMobileSheet = isMobile && !forceInline;
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [results, setResults] = useState<{
    pages: any[];
    products: any[];
    invoices: any[];
    parties: any[];
  }>({ pages: [], products: [], invoices: [], parties: [] });
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Comprehensive Dashboard pages + search aliases
  const PAGES_LIST = [
    // ── Operations ───────────────────────────────────────────────────────────
    { name: "Dashboard Overview", path: "/dashboard", ur: "ڈیش بورڈ جائزہ", keywords: "home main command center" },
    { name: "Retail POS (Point of Sale)", path: "/dashboard/pos", ur: "ریٹیل پی او ایس بلنگ", keywords: "pos billing retail sell invoice cash counter" },
    { name: "Sales Register / Invoices", path: "/dashboard/sales", ur: "سیلز رجسٹر انوائس", keywords: "sales invoices register sell receipts" },
    { name: "Party Ledger / Khata Book", path: "/dashboard/khata", ur: "کھاتہ بک گاہک سپلائر بقایا", keywords: "khata customers suppliers credit ledger outstanding balance parties" },
    { name: "Gift Cards Management", path: "/dashboard/general/cards", ur: "گفٹ کارڈ", keywords: "gift cards vouchers coupons discount loyalty" },

    // ── Purchases & Stock ─────────────────────────────────────────────────────
    { name: "Product Catalog / Inventory Master", path: "/dashboard/products", ur: "پروڈکٹس کیٹالاگ انوینٹری", keywords: "products catalog inventory items stock list" },
    { name: "Purchase Orders / Stock In", path: "/dashboard/purchase", ur: "پرچیز آرڈرز اسٹاک", keywords: "purchase orders stock in supplier receiving inventory" },
    { name: "Stock Adjustments / Damage", path: "/dashboard/returns", ur: "اسٹاک ایڈجسٹمنٹ واپسی نقصان", keywords: "returns stock adjustments damage loss wastage return" },
    { name: "Expense Tracker / Operational Costs", path: "/dashboard/expenses", ur: "اخراجات خرچے", keywords: "expenses bills costs utilities operational outflow spending" },

    // ── HR & Payroll ──────────────────────────────────────────────────────────
    { name: "HR & Staff Management / Payroll", path: "/dashboard/staff", ur: "اسٹاف ملازمین تنخواہ", keywords: "hr staff employees salary payroll attendance wages workers" },

    // ── Accounts & Finance (ALL) ──────────────────────────────────────────────
    { name: "General Ledger & Journal Vouchers (JV)", path: "/dashboard/accounts", ur: "جنرل لیجر جرنل واؤچر", keywords: "general ledger accounts journal vouchers jv gl double entry debit credit accounting" },
    { name: "Balance Sheet (Assets & Liabilities)", path: "/dashboard/accounts", ur: "بیلنس شیٹ اثاثے واجبات", keywords: "balance sheet assets liabilities equity net worth financial position" },
    { name: "Trial Balance", path: "/dashboard/accounts", ur: "ٹرائل بیلنس", keywords: "trial balance totals debit credit ledger sum verification" },
    { name: "Profit & Loss Statement (P&L)", path: "/dashboard/reports/gl", ur: "منافع نقصان رپورٹ", keywords: "profit loss p&l income statement revenue expenses pl income" },
    { name: "Cash Flow Statement", path: "/dashboard/accounts", ur: "نقدی بہاؤ", keywords: "cash flow statement operating investing financing activities" },
    { name: "Accounts Payable (Suppliers)", path: "/dashboard/accounts", ur: "واجب الادا سپلائر", keywords: "accounts payable suppliers creditors ap outstanding dues" },
    { name: "Accounts Receivable (Customers)", path: "/dashboard/accounts", ur: "قابل وصول گاہک", keywords: "accounts receivable customers debtors ar outstanding credit" },

    // ── Reports ───────────────────────────────────────────────────────────────
    { name: "Analytics & Reports Center", path: "/dashboard/reports", ur: "رپورٹس سینٹر تجزیہ", keywords: "analytics reports charts graphs statistics metrics performance summary" },
    { name: "Sales Reports & Revenue Analysis", path: "/dashboard/reports", ur: "سیلز رپورٹ آمدنی", keywords: "sales revenue report analysis daily weekly monthly income" },
    { name: "Inventory / Stock Reports", path: "/dashboard/reports", ur: "اسٹاک رپورٹ", keywords: "stock inventory report low stock product valuation" },

    // ── Settings & Admin ──────────────────────────────────────────────────────
    { name: "Settings & System Configuration", path: "/dashboard/settings", ur: "سیٹنگز ترتیبات", keywords: "settings config configuration shop profile preferences tax gst" },
    { name: "Closing Books / Fiscal Period", path: "/dashboard/settings/closing", ur: "کتابیں بند کریں مالی سال", keywords: "closing books period fiscal year end lock finalize accounts" },
    { name: "Billing & Subscription Plans", path: "/dashboard/billing", ur: "بلنگ سبسکرپشن پلانز", keywords: "billing subscription plans upgrade pricing premium features" },
    { name: "System Backups / Data Export", path: "/dashboard/backup", ur: "بیک اپ ڈیٹا", keywords: "backup data export restore gdrive google drive zip download" },
    { name: "Register Sessions / Shift Management", path: "/dashboard/registers", ur: "رجسٹر سیشن شفٹ", keywords: "registers sessions shifts open close cash float daily drawer" },

    // ── Units & Categories ────────────────────────────────────────────────────
    { name: "Units of Measure", path: "/dashboard/units", ur: "پیمائش یونٹ", keywords: "units measure kg gram liter piece dozen" },
    { name: "Product Categories", path: "/dashboard/products", ur: "پروڈکٹ کیٹگریز", keywords: "categories product groups classification" },

    // ── Pharmacy Modules ──────────────────────────────────────────────────────
    { name: "Controlled / Narcotics Register (Schedule G)", path: "/dashboard/pharmacy/controlled", ur: "شیڈول G اور نشہ آور ادویات رجسٹر", keywords: "pharmacy controlled narcotics schedule g sleeping pills sedatives drap" },
    { name: "Cold Chain & Fridge Temperature Log", path: "/dashboard/pharmacy/temperature", ur: "فریج اور ویکسین درجہ حرارت لاگ", keywords: "pharmacy temperature fridge cold chain vaccines insulin biologics" },
    { name: "Short Book / Customer Demand Register", path: "/dashboard/pharmacy/short-book", ur: "شارٹ بک کسٹمر ڈیمانڈ رجسٹر", keywords: "pharmacy short book customer demand missing medicine out of stock" },
    { name: "Doctor Incentive & Referral Ledger", path: "/dashboard/pharmacy/doctors", ur: "ڈاکٹرز کمیشن و ریفرل لیجر", keywords: "pharmacy doctors commission incentives referrals clinics prescriptions" },
    { name: "Medicine Formulations (Generics)", path: "/dashboard/pharmacy/formulas", ur: "فارمولیشنز متبادل ادویات", keywords: "pharmacy formulations generics salts alternates substitute" },
    { name: "Distributor Expiry Claims", path: "/dashboard/pharmacy/claims", ur: "ایکسپائری کلیمز ڈسٹری بیوٹر", keywords: "pharmacy claims expiry supplier credit notes" },
    { name: "Batches & Expiry Tracker", path: "/dashboard/pharmacy/expiry", ur: "بیچ اور ایکسپائری ٹریکر", keywords: "pharmacy expiry batches fefo near expiry expired" },

    // ── Restaurant ────────────────────────────────────────────────────────────
    { name: "Restaurant POS / Dine-In", path: "/dashboard/restaurant/pos", ur: "ریستوران بلنگ", keywords: "restaurant dine in food pos table order kitchen" },
    { name: "Restaurant Tables Management", path: "/dashboard/restaurant/tables", ur: "ریستوران میزیں", keywords: "tables dine in seating layout floor plan restaurant" },
    { name: "Restaurant Orders / KOT", path: "/dashboard/restaurant/orders", ur: "آرڈرز کچن", keywords: "orders kot kitchen tickets restaurant food" },
    { name: "Restaurant Deals & Combos", path: "/dashboard/restaurant/deals", ur: "ڈیلز کومبو", keywords: "deals combos bundle offers menu discount" },
    { name: "Restaurant Reports", path: "/dashboard/restaurant/reports", ur: "ریستوران رپورٹ", keywords: "restaurant sales reports daily summary" },

    // ── Showroom & Vehicles ───────────────────────────────────────────────────
    { name: "Showroom Vehicles Stock", path: "/dashboard/showroom/vehicles", ur: "گاڑیوں کا اسٹاک", keywords: "showroom vehicles cars bikes stock inventory chassis engine" },
    { name: "Showroom Vehicle Sales / POS", path: "/dashboard/showroom/sales", ur: "گاڑیوں کی فروخت بلنگ", keywords: "showroom sales sell vehicle car bike contract bayana invoice" },
    { name: "Showroom Installments & EMI (Qist)", path: "/dashboard/showroom/installments", ur: "گاڑیوں کی اقساط", keywords: "showroom installments emi qist schedule due ledger recovery" },
    { name: "Showroom Parties & Dealers", path: "/dashboard/showroom/parties", ur: "خریدار و ڈیلرز پارٹیاں", keywords: "showroom parties dealers buyers sellers guarantors" },
    { name: "Showroom Investors & Capital", path: "/dashboard/showroom/investors", ur: "انویسٹرز و شراکت دار", keywords: "showroom investors partners capital profit share sharakat" },
    { name: "Showroom Rent-a-Car / Bike", path: "/dashboard/showroom/rentals", ur: "رینٹ اے کار موٹرسائیکل", keywords: "showroom rentals rent car bike booking return" },
    { name: "Showroom Reports & Analytics", path: "/dashboard/showroom/reports", ur: "شوروم رپورٹس و تجزیہ", keywords: "showroom reports sales profit vehicle investors analytics" },
    { name: "Showroom DB Setup & Migration", path: "/dashboard/showroom/setup-migration", ur: "ڈیٹا بیس سیٹ اپ", keywords: "showroom migration database setup sql tables" },
  ];

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
    if (!query.trim() || !shopId) {
      setResults({ pages: [], products: [], invoices: [], parties: [] });
      return;
    }

    setLoading(true);
    const searchTerms = query.toLowerCase();

    // 1. Filter local pages — search name + Urdu + keywords aliases
    const matchedPages = PAGES_LIST.filter(p =>
      p.name.toLowerCase().includes(searchTerms) ||
      p.ur.includes(searchTerms) ||
      (p.keywords && p.keywords.toLowerCase().includes(searchTerms))
    );

    const delayDebounce = setTimeout(async () => {
      try {
        // 2. Fetch matching products
        const { data: prodData } = await supabase
          .from("products")
          .select("id, name, code, sale_price_single")
          .eq("shop_id", shopId)
          .ilike("name", `%${query}%`)
          .limit(4);

        // 3. Fetch matching invoices
        let invData: any[] = [];
        if (query.length >= 4) {
          const { data: matchedInvoices } = await supabase
            .from("invoices")
            .select("id, total_amount, created_at")
            .eq("shop_id", shopId)
            .ilike("id::text", `%${query}%`)
            .limit(4);
          invData = matchedInvoices || [];
        }

        // 4. Fetch matching parties
        const { data: partyData } = await supabase
          .from("parties")
          .select("id, name, type, phone")
          .eq("shop_id", shopId)
          .ilike("name", `%${query}%`)
          .limit(4);

        setResults({
          pages: matchedPages,
          products: prodData || [],
          invoices: invData,
          parties: partyData || []
        });
      } catch (err) {
        console.error("Global search error:", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [query, shopId]);

  const hasResults =
    results.pages.length > 0 ||
    results.products.length > 0 ||
    results.invoices.length > 0 ||
    results.parties.length > 0;

  const handleSelect = (path: string) => {
    router.push(path);
    setIsOpen(false);
    setMobileSheetOpen(false);
    setQuery("");
  };

  const searchResultsPanel = (isMobileSheet = false) => (
    <>
      {loading && (
        <div className="flex items-center justify-center py-6 text-slate-400 gap-2 text-xs">
          <Loader2 className="animate-spin h-4 w-4 text-blue-600" />
          Searching across systems...
        </div>
      )}

      {!loading && !hasResults && (
        <div className="text-center py-8 text-slate-400 text-xs">
          No matching records found. Try a different keyword.
        </div>
      )}

      {!loading && results.pages.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Layers size={12} className="text-indigo-500" /> Pages & Modules
          </p>
          <div className="space-y-1">
            {results.pages.map((page, idx) => (
              <button
                key={`page-${idx}`}
                onClick={() => handleSelect(page.path)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-left group ${isMobileSheet ? "min-h-[44px]" : ""}`}
              >
                <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                  <FileText size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{page.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{page.path}</p>
                </div>
                <ArrowRight size={14} className="ml-auto text-slate-300 group-hover:text-indigo-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && results.products.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Package size={12} className="text-emerald-500" /> Products
          </p>
          <div className="space-y-1">
            {results.products.map((prod) => (
              <button
                key={prod.id}
                onClick={() => handleSelect(`/dashboard/products`)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-50 transition-colors text-left ${isMobileSheet ? "min-h-[44px]" : ""}`}
              >
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <Package size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{prod.name}</p>
                  <p className="text-[10px] text-slate-400">Rs {prod.sale_price_single?.toLocaleString()}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && results.invoices.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <FileText size={12} className="text-blue-500" /> Invoices
          </p>
          <div className="space-y-1">
            {results.invoices.map((inv) => (
              <button
                key={inv.id}
                onClick={() => handleSelect(`/dashboard/sales`)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50 transition-colors text-left ${isMobileSheet ? "min-h-[44px]" : ""}`}
              >
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <FileText size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">Invoice #{inv.id.slice(0, 8)}</p>
                  <p className="text-[10px] text-slate-400">Rs {inv.total_amount?.toLocaleString()}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && results.parties.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <User size={12} className="text-violet-500" /> Customers & Suppliers
          </p>
          <div className="space-y-1">
            {results.parties.map((party) => (
              <button
                key={party.id}
                onClick={() => handleSelect(`/dashboard/khata`)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-violet-50 transition-colors text-left ${isMobileSheet ? "min-h-[44px]" : ""}`}
              >
                <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 shrink-0">
                  <User size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{party.name}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{party.type}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  if (subscriptionLocked) {
    return (
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300" />
        <Input
          type="search"
          disabled
          placeholder="Search disabled — renew subscription to continue"
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
          className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-600 active:scale-95 transition-transform shrink-0"
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
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                  }}
                  placeholder={t("search_placeholder")}
                  className="w-full bg-slate-50 pl-10 pr-4 border-slate-200 h-11 rounded-xl text-sm"
                />
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
              {!query.trim() && !loading ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  Search products, customers, invoices, or pages
                </div>
              ) : (
                searchResultsPanel(true)
              )}
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
          className="relative w-full flex items-center gap-2 text-left min-h-[40px]"
        >
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-sm text-slate-400 truncate flex-1">
            {query || t("search_placeholder")}
          </span>
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
                  placeholder={t("search_placeholder")}
                  className="w-full bg-slate-50 pl-10 pr-4 border-slate-200 h-11 rounded-xl text-sm"
                />
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
              {!query.trim() && !loading ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  Search products, customers, invoices, or pages
                </div>
              ) : (
                searchResultsPanel(true)
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
      <Input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={t("search_placeholder")}
        className="w-full bg-slate-50 pl-10 pr-4 border-slate-200 focus-visible:ring-blue-600 h-10 rounded-full text-sm transition-all"
      />

      {isOpen && (query.trim().length > 0 || loading) && (
        <div className="absolute top-12 left-0 w-full max-h-[420px] overflow-y-auto bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xl rounded-2xl p-4 z-50 transition-all flex flex-col gap-4">
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
          <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xl rounded-2xl p-4 z-50 transition-all flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-black text-slate-800">System Notifications</span>
            {lowStockItems.length > 0 && (
              <span className="text-[10px] font-black text-red-655 bg-red-50 px-2 py-0.5 rounded-full">
                {lowStockItems.length} alerts
              </span>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
            {lowStockItems.length === 0 ? (
              <div className="text-center py-8 text-slate-450 text-xs flex flex-col items-center gap-2">
                🎉
                <span>All caught up! No active stock alerts.</span>
              </div>
            ) : (
              lowStockItems.map((item, idx) => (
                <div key={idx} className="flex gap-2.5 p-2.5 rounded-xl bg-red-50/50 border border-red-100/50 text-xs text-left">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex flex-col leading-tight">
                    <span className="font-bold text-slate-800">Low Stock Alert</span>
                    <span className="text-slate-600 mt-1">
                      <strong>{item.name}</strong> stock is low. Current: <strong>{parseFloat(item.current_stock || '0').toFixed(0)}</strong> (Minimum alert level: {parseFloat(item.min_stock_level || '0').toFixed(0)}).
                    </span>
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
      <span>{systemAnnouncement.message}</span>
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
        <span>
          <strong className="text-red-700 uppercase tracking-wide mr-1.5">[System Locked]</strong>
          Your subscription expired and the grace period has ended. Renew below to unlock the full system.
        </span>
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
          <span>
            <strong className="text-amber-800 uppercase tracking-wide mr-1.5">[Grace Period]</strong>
            Your subscription expired. You have{" "}
            <strong className="underline text-amber-900">
              {graceDaysRemaining} {daysLabel}
            </strong>{" "}
            left before the system is fully locked. Renew now to avoid interruption.
            <span className="block sm:inline sm:ml-2 text-amber-800/90 font-semibold">
              / سبسکرپشن ختم — {graceDaysRemaining} دن میں سسٹم لاک ہو جائے گا۔
            </span>
          </span>
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
        <span>
          <strong className="text-rose-700 uppercase tracking-wide mr-1.5">[Expiring Soon]</strong>
          Only{" "}
          <strong className="underline text-rose-800">
            {diffDays} {diffDays === 1 ? "day" : "days"}
          </strong>{" "}
          remaining on your subscription ({subscriptionTier || "plan"}). Renew today to keep access.
        </span>
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
      <div className={cn("flex h-[100dvh] w-full overflow-hidden font-sans", isMobile && "dashboard-mobile-shell", showMobileChrome ? "bg-slate-100" : "bg-zinc-50")}>
        
        {/* Desktop sidebar only — mobile uses bottom nav + More sheet */}
        {!isMobile && (
          <Sidebar
            isOpen={sidebarOpen}
            isCollapsed={sidebarCollapsed}
            onClose={() => setSidebarOpen(false)}
            onToggleCollapsed={toggleCollapsed}
          />
        )}

        <MobileMoreMenu open={isMobile && sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 flex flex-col min-w-0">
          <ImpersonationBanner />
        <OfflineStatusBar />
          
          {/* Top Navbar */}
          {!isPosRoute && showMobileChrome && (
            <MobileVipHeader
              searchSlot={<HeaderSearch />}
              actionsSlot={
                <>
                  <HeaderLanguageSwitcher />
                  <HeaderNotifications />
                  <HeaderUserProfileButton />
                </>
              }
            />
          )}

          {!isPosRoute && (
            <header className="hidden md:flex h-12 bg-white border-b border-zinc-200 items-center justify-between px-4 md:px-5 shrink-0 shadow-2xs z-10">
              <div className="flex items-center gap-3 w-full max-w-sm">
                <HeaderSearch />
              </div>
              <div className="flex items-center gap-2.5">
                <HeaderLanguageSwitcher />
                <HeaderNotifications />
                <HeaderUserProfileButton />
              </div>
            </header>
          )}

          {!isPosRoute && (
            <>
              <SystemAnnouncementBanner />
              <SubscriptionExpiredBanner />
              <TrialBanner />
            </>
          )}

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
            Current plan: <span className="text-slate-700">{currentPlan}</span>
          </p>
        ) : null}
        <p className="text-xs text-slate-400 font-semibold mt-1">
          Upgrade to <span className="text-indigo-600 font-bold">{requiredPlan}</span> to unlock this feature.
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

