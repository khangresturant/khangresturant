"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, Check, Star, Users, Clock, TrendingUp, 
  CreditCard, Package, FileText, Zap, Shield,
  Globe, ScanBarcode, BookOpen, ShieldCheck, Server,
  Smartphone, Printer, Scissors, Utensils, Wrench, HeartPulse, Scale,
  CircleCheck, Sparkles, Menu, CheckCircle2, Cpu,
  Send, RefreshCw, X, Mail, Phone, Award
} from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import { createClient } from "@/lib/supabase/client";
import { getPlatformShopId } from "@/lib/config";
import { toast } from "sonner";

// ==================== SAAS PLANS DATA ====================
const defaultPlans = [
  {
    id: "free",
    name: "Free Trial",
    monthly_price: 0,
    yearly_price: 0,
    allow_simple_accounts: true,
    allow_industrial_accounts: false,
    allow_sales_purchases: true,
    allow_whatsapp: false,
    allow_emi: false,
    allow_credits: true,
    allow_pdf: true,
    allow_backup: false,
    allow_payroll: false,
    allow_tax: false,
    allow_assets: false,
    allow_user_roles: false,
    allow_inventory: true,
    allow_barcode: false,
    allow_multi_shop: false,
    allow_universal_import: false,
    allow_ai_product_add: false,
    allow_ai_purchase_order: false,
    max_devices: "1",
    badge: "14 Days Free",
    cardBg: "bg-white border-2 border-slate-200 shadow-lg",
    badgeBg: "bg-slate-100 text-slate-700 border-slate-300",
    buttonBg: "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-extrabold",
  },
  {
    id: "starter",
    name: "Starter Plan",
    monthly_price: 1500,
    yearly_price: 15000,
    allow_simple_accounts: true,
    allow_industrial_accounts: true,
    allow_sales_purchases: true,
    allow_whatsapp: false,
    allow_emi: true,
    allow_credits: true,
    allow_pdf: true,
    allow_backup: true,
    allow_payroll: false,
    allow_tax: false,
    allow_assets: false,
    allow_user_roles: true,
    allow_inventory: true,
    allow_barcode: true,
    allow_multi_shop: false,
    allow_universal_import: true,
    allow_ai_product_add: false,
    allow_ai_purchase_order: false,
    max_devices: "3",
    badge: "For Growing Stores",
    cardBg: "bg-white border-2 border-indigo-300 shadow-xl",
    badgeBg: "bg-indigo-100 text-indigo-800 border-indigo-300",
    buttonBg: "bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-lg shadow-indigo-200",
  },
  {
    id: "premium",
    name: "Premium POS ERP",
    monthly_price: 3500,
    yearly_price: 35000,
    allow_simple_accounts: true,
    allow_industrial_accounts: true,
    allow_sales_purchases: true,
    allow_whatsapp: true,
    allow_emi: true,
    allow_credits: true,
    allow_pdf: true,
    allow_backup: true,
    allow_payroll: true,
    allow_tax: true,
    allow_assets: true,
    allow_user_roles: true,
    allow_inventory: true,
    allow_barcode: true,
    allow_multi_shop: true,
    allow_universal_import: true,
    allow_ai_product_add: true,
    allow_ai_purchase_order: true,
    max_devices: "Unlimited",
    badge: "All Features Unlocked",
    cardBg: "bg-gradient-to-b from-slate-900 via-indigo-950 to-purple-950 text-white border-2 border-amber-400 shadow-2xl shadow-purple-500/30 transform lg:-translate-y-3",
    badgeBg: "bg-amber-400 text-slate-950 font-black border-amber-300",
    buttonBg: "bg-gradient-to-r from-amber-400 via-purple-500 to-indigo-500 hover:from-amber-500 hover:to-indigo-600 text-white font-black shadow-xl shadow-purple-500/30",
  },
];

// ==================== INDUSTRIES DATA ====================
const industriesData = [
  {
    id: "pharmacy",
    title: "Pharmacies & Healthcare",
    description: "Track generic medicine formulas, batch expiry dates, drug commissions, and run strict regulatory-compliant checkouts.",
    badge: "Expiry & Controlled Batches",
    icon: HeartPulse,
    cardBg: "bg-gradient-to-br from-emerald-50 via-white to-teal-50",
    border: "border-2 border-emerald-300",
    badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold",
    highlights: ["Controlled Substance Auditing", "Batch Expiry Blocker Alerts", "Supplier Formulations Logs", "Commission Management"],
    previewText: "Panadol 500mg [Requires Prescription & CNIC Verification] - Blocked until validated.",
  },
  {
    id: "retail",
    title: "Grocery & Retail Stores",
    description: "Scan barcodes instantly, manage automatic low stock alerts, and print custom multi-size barcode sticky labels.",
    badge: "10x Fast Billing",
    icon: ScanBarcode,
    cardBg: "bg-gradient-to-br from-blue-50 via-white to-cyan-50",
    border: "border-2 border-blue-300",
    badgeColor: "bg-blue-100 text-blue-900 border-blue-300 font-extrabold",
    highlights: ["Low-Stock Reorder Badges", "Thermal POS Receipt Settle", "Cash Drawer Integration", "Multi-Counter Synced Operations"],
    previewText: "Checkout: 4 items - F12 processed. Cash drawer triggered automatically.",
  },
  {
    id: "restaurant",
    title: "Restaurants & Cafes",
    description: "Manage physical table orders, trigger direct KOT to kitchen displays, and process custom split bill calculations.",
    badge: "Table & KOT Synced",
    icon: Utensils,
    cardBg: "bg-gradient-to-br from-rose-50 via-white to-orange-50",
    border: "border-2 border-rose-300",
    badgeColor: "bg-rose-100 text-rose-900 border-rose-300 font-extrabold",
    highlights: ["Kitchen Display System (KDS)", "Split Invoice Checkout", "Table Floor Layouts", "Live Sound Alert Notifications"],
    previewText: "Table 4: 2x Chicken Handi - KOT dispatched to Kitchen Monitor Page.",
  },
  {
    id: "electronics",
    title: "Electronics & Mobile",
    description: "Track individual IMEI serial numbers, log warranty periods, handle repair stages, and run installment schedules.",
    badge: "IMEI & Warranty Trace",
    icon: Smartphone,
    cardBg: "bg-gradient-to-br from-violet-50 via-white to-purple-50",
    border: "border-2 border-violet-300",
    badgeColor: "bg-violet-100 text-violet-900 border-violet-300 font-extrabold",
    highlights: ["IMEI Warranty Scanner", "Automated Surcharges", "Device Repair Stage Logs", "EMI Installment Plans"],
    previewText: "Serial Code: IMEI-92840 - Active Warranty: 12 months remaining.",
  },
  {
    id: "hardware",
    title: "Hardware & Sanitary",
    description: "Auto-compute sizes in Square Feet, running feet, or meters with integrated dimensions calculators.",
    badge: "Dimensions Calculator",
    icon: Wrench,
    cardBg: "bg-gradient-to-br from-amber-50 via-white to-yellow-50",
    border: "border-2 border-amber-300",
    badgeColor: "bg-amber-100 text-amber-900 border-amber-300 font-extrabold",
    highlights: ["Dimensions Wastage Factor", "Contractor Credit Logs", "Multi-Warehouse Transfers", "Unit Variations Calculations"],
    previewText: "Polished Marble: 10ft x 12ft = 120 Sq.Ft + 5% Wastage Applied.",
  },
  {
    id: "tailor",
    title: "Tailors & Stitching",
    description: "Store individual measurement profiles, attach sketch patterns, and manage worker artisan wage ledgers.",
    badge: "Customer Size Book",
    icon: Scissors,
    cardBg: "bg-gradient-to-br from-pink-50 via-white to-rose-50",
    border: "border-2 border-pink-300",
    badgeColor: "bg-pink-100 text-pink-900 border-pink-300 font-extrabold",
    highlights: ["Attached Reference Sketches", "Artisan Piece-rate Wages", "Urdu Status Delivery SMS", "Stitching Progress Tracker"],
    previewText: "Customer Size: Length 40\", Chest 36\" - Base64 Sketch Blueprint attached.",
  },
];

const stats = [
  { value: "11+", label: "Industry Configurations", gradient: "from-indigo-600 via-blue-600 to-cyan-600" },
  { value: "50,000+", label: "Invoices Processed Daily", gradient: "from-purple-600 via-pink-600 to-rose-600" },
  { value: "99.99%", label: "Cloud Uptime Guarantee", gradient: "from-emerald-600 via-teal-600 to-cyan-600" },
  { value: "100%", label: "Real-Time Multi-Branch Sync", gradient: "from-amber-600 via-orange-600 to-rose-600" },
];

const faqs = [
  { q: "How does the AI Product Scanner work?", a: "Simply upload or take a photo of any wholesale invoice. The AI OCR engine extracts product descriptions, rates, quantities, and taxes, loading them directly into your inventory without manual typing." },
  { q: "Can I use The Accounts offline?", a: "Retail POS can queue cash and credit sales offline and auto-sync when your connection returns. Connect at least once so the product catalog is cached on your device." },
  { q: "What is the difference between Simple and Industrial Accounts?", a: "Simple Accounts manages general customer credit ledgers (Khata) and supplier accounts. Industrial Accounts activates full double-entry journals, trial balance sheets, profit-and-loss accounts, and asset tracking." },
  { q: "Do you support thermal receipt printers?", a: "Yes. The Accounts works directly with standard 58mm and 80mm ESC/POS thermal printers via USB, Bluetooth, or LAN networks." },
  { q: "How are subscription payments processed?", a: "Subscriptions are processed securely via local and global payment gateways (such as Safepay and debit/credit cards). Your license activates immediately upon confirmation." },
];

// ==================== MAIN COMPONENT ====================
const TheAccountsLanding3D: React.FC = () => {
  const [plans, setPlans] = useState<any[]>(defaultPlans);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [selectedIndustry, setSelectedIndustry] = useState("pharmacy");
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [installDeviceTab, setInstallDeviceTab] = useState<"ios" | "android" | "desktop">("desktop");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) setInstallDeviceTab("ios");
      else if (/android/.test(ua)) setInstallDeviceTab("android");
      else setInstallDeviceTab("desktop");
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      toast.success("Thank you for installing The Accounts!");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      setIsInstallModalOpen(true);
    }
  };

  useEffect(() => {
    async function loadPlans() {
      try {
        const { data } = await supabase
          .from("company_details")
          .select("website")
          .eq("shop_id", getPlatformShopId())
          .limit(1);
        const configRow = data?.[0];
        if (configRow?.website?.startsWith("{")) {
          const parsed = JSON.parse(configRow.website);
          if (parsed.saas_plans && Array.isArray(parsed.saas_plans)) {
            setPlans(parsed.saas_plans);
          }
        }
      } catch (e) {
        console.error("Failed to load SaaS plans:", e);
      }
    }
    loadPlans();
  }, []);

  const [dailyInvoices, setDailyInvoices] = useState(60);
  const [bookkeepingHours, setBookkeepingHours] = useState(12);

  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scannedItems, setScannedItems] = useState<any[]>([]);

  const startScanSimulation = () => {
    setIsScanning(true);
    setScanStep(1);
    setScannedItems([]);
    setTimeout(() => setScanStep(2), 1000);
    setTimeout(() => {
      setScanStep(3);
      setScannedItems([
        { name: "Panadol CF Tablets (Pack of 100)", qty: 10, price: "Rs 450", total: "Rs 4,500" },
        { name: "Amoxil Capsules 250mg", qty: 25, price: "Rs 380", total: "Rs 9,500" },
        { name: "Surbex-Z High Potency Tablets", qty: 15, price: "Rs 620", total: "Rs 9,300" },
      ]);
    }, 2400);
    setTimeout(() => setScanStep(4), 3600);
  };

  const resetAIScan = () => {
    setIsScanning(false);
    setScanStep(0);
    setScannedItems([]);
  };

  const monthlyTimeSaved = Math.round(((dailyInvoices * 2 * 30) / 60) + bookkeepingHours * 4);
  const monthlyMoneySaved = Math.round(monthlyTimeSaved * 750);
  const activeIndustry = industriesData.find((i) => i.id === selectedIndustry) || industriesData[0];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((f) => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden relative">
      <Script
        id="faq-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      
      {/* VIBRANT LIGHT AURORA MESH BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, #6366f1 1.5px, transparent 1.5px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Indigo-Cyan Light Aurora */}
        <div className="absolute top-[-10%] left-[5%] w-[700px] h-[700px] rounded-full bg-gradient-to-br from-indigo-300/40 via-cyan-200/30 to-transparent blur-[140px]" />
        {/* Royal Violet-Pink Light Aurora */}
        <div className="absolute top-[30%] right-[-10%] w-[750px] h-[750px] rounded-full bg-gradient-to-bl from-purple-300/40 via-pink-200/30 to-transparent blur-[150px]" />
        {/* Emerald Light Aurora */}
        <div className="absolute top-[60%] left-[-10%] w-[650px] h-[650px] rounded-full bg-gradient-to-tr from-emerald-300/30 via-teal-200/20 to-transparent blur-[140px]" />
        {/* Amber Sunset Light Aurora */}
        <div className="absolute bottom-[5%] right-[5%] w-[650px] h-[650px] rounded-full bg-gradient-to-tl from-amber-300/30 via-rose-200/20 to-transparent blur-[140px]" />
      </div>

      {/* VIP LIGHT GLASS HEADER NAVBAR WITH LOGO */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-2xl border-b border-slate-200/80 shadow-md shadow-indigo-100/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            {/* Glowing Brand Emblem Ring */}
            <div className="p-0.5 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-md transition group-hover:scale-105">
              <div className="h-10 w-10 rounded-[14px] overflow-hidden bg-white">
                <img src="/logo.png" alt="The Accounts Enterprise Logo" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="font-black text-2xl tracking-tighter text-slate-900 leading-none">
                The <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">Accounts</span>
              </div>
              <span className="text-[9px] text-indigo-600 font-extrabold uppercase tracking-widest mt-0.5">
                Enterprise Business OS
              </span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-8 text-xs font-extrabold uppercase tracking-wider text-slate-600">
            <a href="#bento" className="hover:text-indigo-600 transition">Platform</a>
            <a href="#industries" className="hover:text-indigo-600 transition">Industries</a>
            <a href="#roi" className="hover:text-indigo-600 transition">ROI Calculator</a>
            <a href="#pricing" className="hover:text-indigo-600 transition">Pricing</a>
            <a href="#faq" className="hover:text-indigo-600 transition">FAQ</a>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={handleInstallApp}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 text-xs font-extrabold uppercase tracking-wider rounded-xl border border-indigo-200 transition flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Smartphone size={14} className="animate-pulse text-indigo-600" /> Download App
            </button>
            <Link href="/login">
              <button className="px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-700 hover:text-indigo-600 rounded-xl transition">
                Sign In
              </button>
            </Link>
            <Link href="/register">
              <motion.button 
                whileHover={{ scale: 1.03 }} 
                whileTap={{ scale: 0.97 }}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/25 cursor-pointer"
              >
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-slate-200 bg-white px-6 py-5 space-y-4 shadow-xl"
            >
              <a href="#bento" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-bold text-slate-700 hover:text-indigo-600">Platform Features</a>
              <a href="#industries" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-bold text-slate-700 hover:text-indigo-600">Supported Industries</a>
              <a href="#roi" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-bold text-slate-700 hover:text-indigo-600">ROI Calculator</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-bold text-slate-700 hover:text-indigo-600">Subscription Plans</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-bold text-slate-700 hover:text-indigo-600">FAQ</a>
              
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200 rounded-xl">
                  Sign In
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="w-full py-3 text-center text-xs font-black uppercase tracking-wider text-white bg-indigo-600 rounded-xl shadow-md">
                  Free Trial
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* HERO SECTION */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-12 lg:pt-16 pb-20 lg:pb-28">
        <div className="text-center max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-2 border-indigo-200 text-indigo-950 text-xs font-extrabold shadow-md backdrop-blur-md">
            <Sparkles size={15} className="text-amber-500 animate-spin" style={{ animationDuration: "5s" }} />
            <span>Next-Gen Enterprise Cloud ERP, POS & Accounting System</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-950 leading-[1.08]">
            Run Your Entire Business<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 via-purple-600 via-pink-600 to-amber-500 drop-shadow-sm">
              Without Paperwork.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-600 max-w-3xl mx-auto font-semibold leading-relaxed">
            <strong>The Accounts (theaccounts.cloud)</strong> is the ultimate cloud operating system for retail, wholesale, and service businesses. Speed up POS billing by 10x, automate WhatsApp receipts, manage customer Khata ledgers, and run dual-entry accounts effortlessly.
          </p>

          {/* VIBRANT GLOWING CHIPS */}
          <div className="flex flex-wrap justify-center gap-2.5 text-xs font-black">
            <span className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 text-blue-900 shadow-sm hover:scale-105 transition cursor-pointer">
              🛒 Grocery & Retail POS
            </span>
            <span className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 text-emerald-900 shadow-sm hover:scale-105 transition cursor-pointer">
              💊 Pharmacy Expiry Batches
            </span>
            <span className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-50 to-orange-50 border-2 border-rose-200 text-rose-900 shadow-sm hover:scale-105 transition cursor-pointer">
              🍔 Restaurant KOT & KDS
            </span>
            <span className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-pink-50 to-purple-50 border-2 border-pink-200 text-pink-900 shadow-sm hover:scale-105 transition cursor-pointer">
              ✂️ Tailor Size Profiles
            </span>
            <span className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 text-amber-900 shadow-sm hover:scale-105 transition cursor-pointer">
              📱 Electronics & IMEI Repair
            </span>
          </div>

          {/* CALL TO ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
            <Link href="/register">
              <button className="w-full sm:w-auto px-10 py-4.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2 transition transform hover:-translate-y-0.5 cursor-pointer">
                Start 14-Day Free Trial <ArrowRight size={16} />
              </button>
            </Link>
            <button
              onClick={handleInstallApp}
              className="w-full sm:w-auto px-8 py-4.5 bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-300 font-black text-sm rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Smartphone size={16} className="animate-bounce text-indigo-600" /> Download Desktop App
            </button>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-6 text-xs font-extrabold text-slate-500 pt-4">
            <span className="flex items-center gap-1.5"><CircleCheck size={16} className="text-emerald-600" /> No Credit Card Required</span>
            <span className="flex items-center gap-1.5"><CircleCheck size={16} className="text-emerald-600" /> 1-Click WhatsApp Receipts</span>
            <span className="flex items-center gap-1.5"><CircleCheck size={16} className="text-emerald-600" /> ESC/POS Thermal Printers Ready</span>
          </div>
        </div>

        {/* 3D POS TERMINAL FRAME WITH GRADIENT RING */}
        <div className="mt-14 relative max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative p-1.5 bg-gradient-to-tr from-indigo-400 via-purple-400 to-pink-400 rounded-3xl shadow-[0_30px_70px_-15px_rgba(99,102,241,0.3)]"
          >
            <div className="rounded-[22px] overflow-hidden bg-white p-2 sm:p-4">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100/90 rounded-2xl mb-2 border border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <div className="text-[11px] font-mono text-indigo-700 font-bold bg-white px-4 py-1 rounded-full border border-slate-200 shadow-sm">
                  https://theaccounts.cloud/dashboard
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest">Live System</span>
                </div>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
                <img
                  src="/images/theaccounts_pos_dashboard_monitor.png"
                  alt="The Accounts Cloud Executive Command Center"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute bottom-4 left-4 bg-white/95 border-2 border-indigo-200 p-4 rounded-2xl backdrop-blur-md hidden sm:flex items-center gap-3.5 shadow-2xl">
                  <div className="p-3 rounded-xl bg-indigo-100 text-indigo-700">
                    <TrendingUp size={22} />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Today's Gross Sales</div>
                    <div className="text-lg font-black text-indigo-700 font-mono">Rs 142,850 ▲</div>
                  </div>
                </div>
                <div className="absolute top-16 right-4 bg-white/95 border-2 border-emerald-200 p-3.5 rounded-2xl backdrop-blur-md hidden md:flex items-center gap-3 shadow-2xl">
                  <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700">
                    <Send size={18} />
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-800 font-extrabold">WhatsApp Receipt Sent</div>
                    <div className="text-[11px] text-slate-600 font-semibold">Inv #1094 to +92 300 1234567</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS METRICS ROW */}
      <section className="relative z-10 bg-white border-y border-slate-200/80 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((st, idx) => (
              <div key={idx} className="bg-slate-50/80 border-2 border-slate-200 rounded-2xl p-6 text-center shadow-md">
                <div className={`text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r ${st.gradient} font-mono`}>
                  {st.value}
                </div>
                <div className="text-xs font-extrabold text-slate-600 mt-2 uppercase tracking-wider">
                  {st.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORE ENGINE BENTO GRID */}
      <section id="bento" className="relative z-10 py-24 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200 px-4 py-1.5 rounded-full inline-block">
            Core Engine Capabilities
          </h2>
          <h3 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">
            Built for Extreme Speed & Enterprise Precision.
          </h3>
          <p className="text-slate-600 font-semibold text-base">
            Everything your store needs to process transactions, eliminate manual errors, and scale seamlessly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: POS Billing */}
          <div className="md:col-span-2 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 border-2 border-indigo-200/90 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden group shadow-xl">
            <div className="space-y-3 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg">
                <Zap size={24} />
              </div>
              <h4 className="text-2xl font-black text-slate-900">10x Fast Thermal POS Billing</h4>
              <p className="text-slate-600 text-sm font-semibold max-w-lg leading-relaxed">
                Lightning-fast checkout with barcode scanner support, hotkey shortcuts (F12 Settle), multi-item search, and instant ESC/POS thermal printing.
              </p>
            </div>
            <div className="mt-8 bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-300 space-y-2">
              <div className="flex justify-between border-b border-slate-800 pb-2 text-indigo-400 font-bold">
                <span>ITEM</span><span>QTY</span><span>TOTAL</span>
              </div>
              <div className="flex justify-between"><span>Panadol 500mg (10x10)</span><span>2</span><span>Rs 900</span></div>
              <div className="flex justify-between"><span>Surbex-Z High Potency</span><span>1</span><span>Rs 620</span></div>
              <div className="flex justify-between font-bold text-white pt-2 border-t border-slate-800">
                <span>TOTAL PAID (CASH)</span><span>F12</span><span className="text-emerald-400">Rs 1,520</span>
              </div>
            </div>
          </div>

          {/* Card 2: WhatsApp Receipts */}
          <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-2 border-emerald-200/90 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden shadow-xl">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-lg">
                <Send size={24} />
              </div>
              <h4 className="text-2xl font-black text-slate-900">WhatsApp Thermal Receipts</h4>
              <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                Automatically send clean digital thermal receipts directly to your customer's WhatsApp with ledger credit status.
              </p>
            </div>
            <div className="mt-6 bg-emerald-100/90 border-2 border-emerald-300 p-4 rounded-2xl text-xs text-emerald-950 font-extrabold shadow-sm">
              ✅ "Invoice #1049 sent to customer. Updated Khata credit balance: Rs 4,200."
            </div>
          </div>

          {/* Card 3: AI Wholesale Invoice Scanner */}
          <div className="md:col-span-2 bg-gradient-to-br from-purple-50 via-white to-pink-50 border-2 border-purple-300 rounded-3xl p-8 relative overflow-hidden shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 border-2 border-purple-300 text-purple-900 text-xs font-black">
                  <Cpu size={14} /> AI OCR Engine
                </div>
                <h4 className="text-2xl font-black text-slate-900">AI Wholesale Invoice OCR Scanner</h4>
                <p className="text-slate-600 text-sm font-semibold">
                  Snap a photo of wholesale bills. Our AI automatically extracts items, rates, quantities & taxes into inventory.
                </p>
              </div>
              <button
                onClick={isScanning ? resetAIScan : startScanSimulation}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center gap-2 shrink-0 cursor-pointer shadow-lg shadow-purple-200"
              >
                {isScanning ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {isScanning ? "Reset Scan" : "Simulate AI Scan"}
              </button>
            </div>

            <div className="bg-slate-950 border border-purple-500/30 rounded-2xl p-4 text-xs font-mono">
              {!isScanning && (
                <div className="text-center py-6 text-slate-400 font-sans font-semibold">
                  Click <strong>"Simulate AI Scan"</strong> to see AI OCR extract wholesale bill details in real-time.
                </div>
              )}
              {isScanning && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-purple-400 font-bold border-b border-slate-800 pb-2">
                    <span>STATUS: STEP {scanStep} OF 4</span>
                    <span>{scanStep === 4 ? "COMPLETE ✅" : "PROCESSING..."}</span>
                  </div>
                  {scanStep === 1 && <div className="text-slate-400 animate-pulse">📷 Uploading wholesale bill image...</div>}
                  {scanStep === 2 && <div className="text-purple-300 animate-pulse">🤖 Running Neural OCR line extraction...</div>}
                  {scanStep >= 3 && (
                    <div className="space-y-1.5">
                      {scannedItems.map((it, i) => (
                        <div key={i} className="flex justify-between bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-white font-bold">{it.name}</span>
                          <span className="text-slate-400">Qty: {it.qty}</span>
                          <span className="text-emerald-400 font-bold">{it.total}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Dual Accounting */}
          <div className="bg-gradient-to-br from-blue-50 via-white to-sky-50 border-2 border-blue-200/90 rounded-3xl p-8 flex flex-col justify-between shadow-xl">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg">
                <BookOpen size={24} />
              </div>
              <h4 className="text-2xl font-black text-slate-900">Dual Accounting System</h4>
              <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                Switch between Simple Khata (Customer Credit) and Industrial Double-Entry Accounting with Trial Balance & Profit-Loss sheets.
              </p>
            </div>
            <div className="mt-6 flex gap-2 text-xs font-extrabold">
              <span className="flex-1 py-2 text-center rounded-xl bg-blue-100 text-blue-900 border border-blue-200">Simple Khata</span>
              <span className="flex-1 py-2 text-center rounded-xl bg-purple-100 text-purple-900 border border-purple-200">Industrial GL</span>
            </div>
          </div>
        </div>
      </section>

      {/* INDUSTRY SHOWCASE */}
      <section id="industries" className="relative z-10 py-24 bg-white border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200 px-4 py-1.5 rounded-full inline-block">
              Vertical Specializations
            </h2>
            <h3 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">Tailored for Your Industry</h3>
            <p className="text-slate-600 font-semibold">Select your store type to explore custom screens and specialized workflows.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5 mb-10">
            {industriesData.map((ind) => {
              const IconComp = ind.icon;
              const isSelected = selectedIndustry === ind.id;
              return (
                <button
                  key={ind.id}
                  onClick={() => setSelectedIndustry(ind.id)}
                  className={`px-5 py-3 rounded-2xl text-xs font-black flex items-center gap-2 transition cursor-pointer border-2 ${
                    isSelected
                      ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white border-indigo-400 shadow-xl shadow-indigo-200"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  <IconComp size={16} /> {ind.title}
                </button>
              );
            })}
          </div>

          <div className={`${activeIndustry.cardBg} ${activeIndustry.border} rounded-3xl p-8 lg:p-12 grid lg:grid-cols-12 gap-8 items-center shadow-2xl`}>
            <div className="lg:col-span-7 space-y-6">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 text-xs ${activeIndustry.badgeColor}`}>
                <activeIndustry.icon size={14} /> {activeIndustry.badge}
              </div>
              <h4 className="text-3xl font-black text-slate-950">{activeIndustry.title}</h4>
              <p className="text-slate-700 text-base font-semibold leading-relaxed">{activeIndustry.description}</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {activeIndustry.highlights.map((hl, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-xs font-black text-slate-800 bg-white/90 p-3.5 rounded-xl border-2 border-slate-200 shadow-sm">
                    <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />
                    <span>{hl}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-950 text-white border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
              <div className="text-xs font-mono text-indigo-400 font-bold uppercase tracking-wider">Screen Workflow Output</div>
              <p className="text-xs text-slate-300 font-mono bg-slate-900/90 p-4 rounded-xl border border-slate-800 leading-relaxed">
                {activeIndustry.previewText}
              </p>
              <Link href="/register">
                <button className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer shadow-lg">
                  Launch {activeIndustry.title} Mode
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ROI CALCULATOR */}
      <section id="roi" className="relative z-10 py-24 max-w-5xl mx-auto px-6">
        <div className="bg-gradient-to-br from-indigo-100/80 via-white to-purple-100/60 border-2 border-indigo-300 rounded-3xl p-8 lg:p-12 space-y-8 shadow-2xl">
          <div className="text-center space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-indigo-700 bg-white border border-indigo-200 px-4 py-1 rounded-full inline-block">
              Interactive Business Calculator
            </h2>
            <h3 className="text-3xl font-black text-slate-950">Calculate Your Monthly Time & Cost Savings</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-black text-slate-800 mb-2">
                  <span>Daily Customer Invoices</span>
                  <span className="text-indigo-700 font-mono text-base">{dailyInvoices} invoices/day</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="300"
                  value={dailyInvoices}
                  onChange={(e) => setDailyInvoices(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-black text-slate-800 mb-2">
                  <span>Monthly Manual Bookkeeping Hours</span>
                  <span className="text-purple-700 font-mono text-base">{bookkeepingHours} hours/month</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="60"
                  value={bookkeepingHours}
                  onChange={(e) => setBookkeepingHours(Number(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="bg-slate-950 text-white rounded-2xl p-6 flex flex-col justify-center space-y-4 text-center shadow-2xl">
              <div>
                <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Estimated Monthly Hours Saved</div>
                <div className="text-4xl font-black text-indigo-400 font-mono mt-1">{monthlyTimeSaved} Hours</div>
              </div>
              <div className="border-t border-slate-800 pt-4">
                <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Estimated Value Saved</div>
                <div className="text-4xl font-black text-emerald-400 font-mono mt-1">Rs {monthlyMoneySaved.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAAS PRICING TABLE */}
      <section id="pricing" className="relative z-10 py-24 bg-white border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200 px-4 py-1.5 rounded-full inline-block">
              Transparent Subscription Plans
            </h2>
            <h3 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">Simple, Predictable SaaS Pricing</h3>
            <p className="text-slate-600 font-semibold">Choose the plan that fits your business scale. No hidden transaction fees.</p>

            <div className="inline-flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 mt-4">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                  billingPeriod === "monthly" ? "bg-indigo-600 text-white shadow-md" : "text-slate-700"
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingPeriod("yearly")}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
                  billingPeriod === "yearly" ? "bg-indigo-600 text-white shadow-md" : "text-slate-700"
                }`}
              >
                Yearly Billing <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-md font-extrabold">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((pl) => {
              const price = billingPeriod === "yearly" ? pl.yearly_price : pl.monthly_price;
              const isPopular = pl.id === "premium";
              return (
                <div
                  key={pl.id}
                  className={`rounded-3xl p-8 flex flex-col justify-between relative transition border-2 ${pl.cardBg}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 via-purple-500 to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-lg">
                      Most Popular
                    </div>
                  )}

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xl font-black">{pl.name}</h4>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-4xl font-black font-mono">Rs {price.toLocaleString()}</span>
                        <span className={`text-xs font-bold ${isPopular ? "text-slate-300" : "text-slate-500"}`}>/{billingPeriod === "yearly" ? "year" : "month"}</span>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs font-semibold pt-6 border-t border-slate-200/40">
                      <div className="flex items-center gap-2"><CheckCircle2 size={16} className={isPopular ? "text-emerald-400" : "text-indigo-600"} /> Allowed Devices: {pl.max_devices}</div>
                      <div className="flex items-center gap-2"><CheckCircle2 size={16} className={isPopular ? "text-emerald-400" : "text-indigo-600"} /> Full POS & Barcode Billing</div>
                      <div className="flex items-center gap-2"><CheckCircle2 size={16} className={isPopular ? "text-emerald-400" : "text-indigo-600"} /> Customer Khata Credit Ledger</div>
                      {pl.allow_whatsapp && <div className="flex items-center gap-2"><CheckCircle2 size={16} className={isPopular ? "text-emerald-400" : "text-indigo-600"} /> Instant WhatsApp Receipts</div>}
                      {pl.allow_industrial_accounts && <div className="flex items-center gap-2"><CheckCircle2 size={16} className={isPopular ? "text-emerald-400" : "text-indigo-600"} /> Double-Entry Industrial Accounting</div>}
                      {pl.allow_ai_product_add && <div className="flex items-center gap-2"><CheckCircle2 size={16} className={isPopular ? "text-emerald-400" : "text-indigo-600"} /> AI Wholesale Invoice Scanner</div>}
                      {pl.allow_multi_shop && <div className="flex items-center gap-2"><CheckCircle2 size={16} className={isPopular ? "text-emerald-400" : "text-indigo-600"} /> Multi-Shop Branch Control</div>}
                    </div>
                  </div>

                  <Link href="/register" className="mt-8">
                    <button
                      className={`w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${pl.buttonBg}`}
                    >
                      {price === 0 ? "Start Free Trial" : "Subscribe Now"}
                    </button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ ACCORDION */}
      <section id="faq" className="relative z-10 py-24 max-w-3xl mx-auto px-6">
        <div className="text-center mb-14 space-y-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600">Got Questions?</h2>
          <h3 className="text-3xl sm:text-4xl font-black text-slate-950">Frequently Asked Questions</h3>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <button
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                className="w-full text-left px-6 py-4 font-bold text-sm text-slate-900 flex justify-between items-center hover:bg-slate-50 transition cursor-pointer"
              >
                <span>{faq.q}</span>
                <span className="text-indigo-600 text-lg font-black shrink-0 ml-4">{faqOpen === i ? "−" : "+"}</span>
              </button>
              <AnimatePresence>
                {faqOpen === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 pb-5 text-xs text-slate-600 font-semibold leading-relaxed border-t border-slate-100 pt-3"
                  >
                    {faq.a}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* BOTTOM BANNER */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-10 lg:p-16 text-center space-y-6 shadow-2xl shadow-indigo-300 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Ready to Modernize Your Business Today?
            </h2>
            <p className="text-indigo-100 text-sm font-semibold leading-relaxed">
              Join thousands of merchants running paperless operations. Start your 14-day free trial — no credit card required.
            </p>
            <Link href="/register">
              <button className="bg-white hover:bg-slate-100 text-indigo-700 font-black px-9 py-4 rounded-2xl text-xs uppercase tracking-wider shadow-xl transition transform hover:-translate-y-0.5 cursor-pointer">
                Create Free Account <ArrowRight className="inline ml-1.5 h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER - CUSTOM LOGO & UPDATED CONTACT */}
      <footer className="relative z-10 border-t border-slate-200 bg-white py-14 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          <div className="flex items-center justify-center gap-3">
            <div className="p-0.5 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-sm">
              <div className="h-8 w-8 rounded-[10px] overflow-hidden bg-white">
                <img src="/logo.png" alt="The Accounts Logo" className="w-full h-full object-cover" />
              </div>
            </div>
            <span className="font-black text-slate-900 text-lg tracking-tight">
              The <span className="text-indigo-600">Accounts</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl mx-auto py-6 border-y border-slate-100 text-center md:text-left">
            <div className="flex flex-col items-center md:items-start gap-1">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest flex items-center gap-1.5">
                <Mail size={12} className="text-indigo-600" /> Email Support
              </span>
              <a href="mailto:contact@theaccounts.cloud" className="text-slate-800 font-bold hover:text-indigo-600 transition text-sm">
                contact@theaccounts.cloud
              </a>
            </div>
            <div className="flex flex-col items-center md:items-start gap-1">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest flex items-center gap-1.5">
                <Phone size={12} className="text-indigo-600" /> Contact Phone
              </span>
              <a href="tel:+923241974677" className="text-slate-800 font-bold hover:text-indigo-600 transition text-sm">
                +92 324 1974677
              </a>
            </div>
          </div>

          <p className="text-slate-400 font-semibold">
            &copy; {new Date().getFullYear()} The Accounts Global. Enterprise Business Operating System. All Rights Reserved.
          </p>

          <div className="flex flex-wrap justify-center gap-6 text-slate-500 font-semibold">
            <Link href="/login" className="hover:text-indigo-600 transition">Sign In</Link>
            <Link href="/register" className="hover:text-indigo-600 transition">Register</Link>
            <Link href="/privacy-policy" className="hover:text-indigo-600 transition">Privacy Policy</Link>
            <Link href="/terms-and-conditions" className="hover:text-indigo-600 transition">Terms & Conditions</Link>
            <Link href="/refund-policy" className="hover:text-indigo-600 transition">Refund Policy</Link>
            <Link href="/shipping-policy" className="hover:text-indigo-600 transition">Shipping Policy</Link>
          </div>
        </div>
      </footer>

      {/* PWA MODAL */}
      <AnimatePresence>
        {isInstallModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsInstallModalOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-slate-200 shadow-2xl rounded-3xl p-6 md:p-8 max-w-lg w-full relative z-10 space-y-6 text-slate-800"
            >
              <button
                onClick={() => setIsInstallModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-100 shadow-inner">
                  <Smartphone size={24} className="animate-pulse" />
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Download The Accounts App
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  (اپنے کمپیوٹر یا موبائل پر ایپ انسٹال کریں)
                </p>
              </div>

              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80">
                <button
                  onClick={() => setInstallDeviceTab("desktop")}
                  className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer ${
                    installDeviceTab === "desktop" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 font-bold"
                  }`}
                >
                  🖥️ PC / Desktop
                </button>
                <button
                  onClick={() => setInstallDeviceTab("ios")}
                  className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer ${
                    installDeviceTab === "ios" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 font-bold"
                  }`}
                >
                  🍏 iPhone
                </button>
                <button
                  onClick={() => setInstallDeviceTab("android")}
                  className={`flex-1 py-2 text-center text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer ${
                    installDeviceTab === "android" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 font-bold"
                  }`}
                >
                  🤖 Android
                </button>
              </div>

              <div className="space-y-4 pt-2 text-xs text-slate-600 font-medium">
                {installDeviceTab === "desktop" && (
                  <div className="space-y-3">
                    <p className="font-bold text-slate-800">To install on Google Chrome or MS Edge (PC/Mac):</p>
                    <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0">1</div>
                      <div>
                        <p className="font-bold text-slate-900">Click URL Bar Install Icon</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Click the monitor icon on the right side of your browser URL bar.</p>
                      </div>
                    </div>
                  </div>
                )}
                {installDeviceTab === "ios" && (
                  <div className="space-y-3">
                    <p className="font-bold text-slate-800">iPhone / iPad par install karne ka tarika:</p>
                    <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0">1</div>
                      <div>
                        <p className="font-bold text-slate-900">Share Menu</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Safari me Share button par tap karein aur **"Add to Home Screen"** select karein.</p>
                      </div>
                    </div>
                  </div>
                )}
                {installDeviceTab === "android" && (
                  <div className="space-y-3">
                    <p className="font-bold text-slate-800">Android par install karne ka tarika:</p>
                    <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center shrink-0">1</div>
                      <div>
                        <p className="font-bold text-slate-900">Three Dots Menu</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Chrome menu par tap karke **"Install App"** select karein.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsInstallModalOpen(false)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-2xl text-xs font-black transition cursor-pointer"
              >
                Close (بند کریں)
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default TheAccountsLanding3D;
