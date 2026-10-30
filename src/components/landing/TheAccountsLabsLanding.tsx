"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, ChevronDown, Globe, Layers, MessageCircle, Printer,
  ScanLine, Smartphone, Sparkles, TrendingUp, WifiOff, X, Zap, ShieldCheck,
  Scale, Building2, HelpCircle, Send, Star, Award, CheckCircle2, XCircle,
  ShoppingBag, Pill, ChefHat, Scissors, Leaf, Boxes, Car, Fuel, Wrench, Store, RefreshCcw,
  FileText, DollarSign, Cpu, Database, CreditCard, Receipt, Activity, Shield,
  Menu, LogIn, Lock, User
} from "lucide-react";
import { industries } from "@/components/landing/industries-data";
import Business3DCardsCarousel from "@/components/landing/Business3DCardsCarousel";
import VipHeroSection from "@/components/landing/VipHeroSection";
import { createClient } from "@/lib/supabase/client";
import { BILLING_DEFAULT_PLANS, mergeRemotePlansWithDefaults, type AdminSaasPlan } from "@/lib/billing/plan-display";

type Language = "en" | "ur";

export default function TheAccountsLabsLanding() {
  const [lang, setLang] = useState<Language>("en");
  // Default billing cycle set to MONTHLY as requested
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [currency, setCurrency] = useState<"PKR" | "USD">("PKR");
  const [activeIndustryTab, setActiveIndustryTab] = useState<string>("pharmacy");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [activeFeatureCategory, setActiveFeatureCategory] = useState<string>("pos");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // REAL ADMIN PLANS FROM DATABASE / SUPABASE
  const [adminPlans, setAdminPlans] = useState<AdminSaasPlan[]>(() => BILLING_DEFAULT_PLANS);

  useEffect(() => {
    const fetchRealPlans = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("company_details")
          .select("website")
          .limit(5);

        if (data && data.length > 0) {
          for (const row of data) {
            if (row.website && row.website.startsWith("{")) {
              try {
                const parsed = JSON.parse(row.website);
                if (parsed.saas_plans && Array.isArray(parsed.saas_plans) && parsed.saas_plans.length > 0) {
                  setAdminPlans(parsed.saas_plans);
                  return;
                }
              } catch (e) {}
            }
          }
        }
      } catch (err) {
        console.warn("Using default billing plans:", err);
      }
    };
    fetchRealPlans();
  }, []);

  const isUrdu = lang === "ur";
  const toggleLanguage = () => setLang(prev => (prev === "en" ? "ur" : "en"));

  // Comprehensive Feature Groups
  const allFeatureGroups = [
    {
      id: "pos",
      categoryName: isUrdu ? "POS Counter & Billing" : "POS Counter & Checkout",
      icon: Printer,
      features: [
        { title: isUrdu ? "100% Offline POS Billing" : "100% Offline Billing", desc: isUrdu ? "Internet band hone par bhi continuous sale. Auto cloud sync jab net wapas aaye." : "Keep billing when internet drops. Auto background sync when online." },
        { title: isUrdu ? "Universal Thermal Printers" : "Thermal Printer Engine", desc: isUrdu ? "80mm / 58mm ESC/POS, Bluetooth, USB, A4/A5 printer direct support." : "Supports 80mm, 58mm, Bluetooth, USB thermal slips and A4/A5 invoices." },
        { title: isUrdu ? "WhatsApp PDF Invoices" : "Instant WhatsApp Receipts", desc: isUrdu ? "1-Click se customer ke WhatsApp par official PDF receipt bhejein." : "Send 1-click digital PDF invoices directly to customer WhatsApp numbers." },
        { title: isUrdu ? "Weight Scale & Barcode Scanner" : "Scale & Barcode Native Sync", desc: isUrdu ? "USB/Serial Weighing scale aur Barcode scanners se fast instant checkout." : "Direct integration with RS232 weighing scales and 1D/2D barcode scanners." },
        { title: isUrdu ? "Hold/Draft Sales Cart" : "Hold Sales & Multi-Cart", desc: isUrdu ? "Ek se zyada customer ka bill aik waqt me hold aur resume karein." : "Park customer carts on hold and resume transactions without losing items." },
        { title: isUrdu ? "Multi-Payment Support" : "Split Payment Modes", desc: isUrdu ? "Cash, Card, EasyPaisa, JazzCash, Bank Transfer & Udhaar split payment." : "Accept split payments via Cash, Card, EasyPaisa, JazzCash, Bank, or Udhaar." },
      ]
    },
    {
      id: "inventory",
      categoryName: isUrdu ? "Stock & Inventory Control" : "Stock & Inventory Control",
      icon: Boxes,
      features: [
        { title: isUrdu ? "Multi-Branch Stock Transfer" : "Multi-Branch Inter-Transfer", desc: isUrdu ? "Aapni tamam dukanon aur warehouses ke darmian stock transfer record." : "Transfer stock seamlessly between multiple stores and central warehouses." },
        { title: isUrdu ? "Batch & Expiry Management" : "Batch & Expiry Auto Alerts", desc: isUrdu ? "Medicine aur food items ki expiry tareekh aur batch tracking." : "Track batch numbers, manufacturing dates, and near-expiry color alerts." },
        { title: isUrdu ? "Box to Strip / Tablet Math" : "Unit Conversion Matrix", desc: isUrdu ? "Poore dabba se khula pta (strip) ya single pill sell karne ki auto math." : "Automatic unit conversion from master cartoon/box to single pills or strips." },
        { title: isUrdu ? "Barcode Printing Generator" : "Custom Barcode Generator", desc: isUrdu ? "Custom thermal barcode stickers aur price tags print karein." : "Generate and print custom 1D barcode labels for non-barcoded items." },
        { title: isUrdu ? "AI Dead-Stock Warnings" : "AI Stock & Expiry Alerts", desc: isUrdu ? "Kharab ya slow chalnay wale stock ki auto AI alert report." : "Smart automated alerts for overstocked, non-moving, or expiring inventory." },
        { title: isUrdu ? "Supplier Purchase Management" : "Vendor Purchase Orders", desc: isUrdu ? "Suppliers ke purchase bills, GRN, return aur payables ka hisab." : "Manage vendor GRNs, purchase invoices, purchase returns, and supplier ledgers." },
      ]
    },
    {
      id: "udhaar",
      categoryName: isUrdu ? "Udhaar & Customer Ledger" : "Udhaar & Customer Ledgers",
      icon: FileText,
      features: [
        { title: isUrdu ? "Digital Khata & Ledger Book" : "Digital Customer Ledgers", desc: isUrdu ? "Har customer ka mukammal Udhaar aur jama hisab real-time." : "Complete customer debit/credit running ledger with instant transaction history." },
        { title: isUrdu ? "WhatsApp Recovery Reminders" : "WhatsApp Auto Reminders", desc: isUrdu ? "1-Click WhatsApp reminder payment PDF link ke sath bhejein." : "Send scheduled payment reminders with account balance PDF via WhatsApp." },
        { title: isUrdu ? "Customer Credit Limits" : "Credit Limit Enforcement", desc: isUrdu ? "Limit se zyada Udhaar par system automatically warning alert de ga." : "Set maximum Udhaar caps per customer to block risky over-crediting." },
        { title: isUrdu ? "Partial Recovery Record" : "Partial Payment Settlements", desc: isUrdu ? "Thori thori kar ke aane wali Udhaar recovery ka auto hisab." : "Record partial payments, advance deposits, and customer ledger adjustments." },
      ]
    },
    {
      id: "finance",
      categoryName: isUrdu ? "Accounting & Profit Reports" : "Accounting & P&L Reports",
      icon: TrendingUp,
      features: [
        { title: isUrdu ? "1-Click Daily Profit & Loss" : "1-Click P&L Financial Book", desc: isUrdu ? "Rozana ka khalis munafa, sale aur kharchay 1-Click me dekhein." : "Instant Net Profit, Gross Margin, and operating expense closing report." },
        { title: isUrdu ? "Double-Entry General Ledger" : "Double-Entry Accounting", desc: isUrdu ? "Chart of Accounts (COA), Journal Vouchers aur Trial Balance." : "Full double-entry bookkeeping with custom Chart of Accounts and General Ledger." },
        { title: isUrdu ? "Expense Categorization" : "Expense & Overhead Tracker", desc: isUrdu ? "Rent, Bijli bill, Salary aur Chaye pani ke kharchon ka hisab." : "Track daily store expenses, staff salaries, utility bills, and petty cash." },
        { title: isUrdu ? "Daily Cash Register Closing" : "Daily Cash Drawer Closing", desc: isUrdu ? "Cash counter draw, opening float aur closing physical count tally." : "Reconcile physical cash drawer with system register totals at end of shift." },
      ]
    },
    {
      id: "verticals",
      categoryName: isUrdu ? "15 Specialized Industry Packs" : "15 Specialized Verticals",
      icon: Layers,
      features: [
        { title: isUrdu ? "Pharmacy Narcotics Register" : "Pharmacy Narcotics Register", desc: isUrdu ? "Formulas, Patient/Doctor register aur Expiry color codes." : "Controlled drug tracking, doctor prescriptions, formula search & expiry codes." },
        { title: isUrdu ? "Restaurant KDS, KOT & Floor Map" : "Restaurant KDS, KOT & Floor Map", desc: isUrdu ? "Kitchen display, KOT print, Table map, Waiter app & Deals." : "Kitchen display monitors, KOT printing, floor maps, QR order & combos." },
        { title: isUrdu ? "Garments Matrix (Size/Color)" : "Apparel Size/Color Matrix", desc: isUrdu ? "Kapray ke size, color aur design variations ka matrix POS." : "Manage clothes matrix by Size, Color, Fit, Material, and Season tags." },
        { title: isUrdu ? "Mobile IMEI & Repairing" : "Mobile IMEI & Repairing Module", desc: isUrdu ? "IMEI tracking, Repair job card, Warranty receipts." : "Track mobile phones by IMEI/Serial, generate repair job sheets & warranties." },
        { title: isUrdu ? "Tailor Measurement Sketches" : "Tailor Measurement Sketches", desc: isUrdu ? "Customer Naap, Canvas sketches, Karigar mazdoori." : "Save customer body measurements, draw collar sketches & assign karigar wages." },
        { title: isUrdu ? "Fertilizer CNIC & Subsidy" : "Fertilizer CNIC & Subsidy Record", desc: isUrdu ? "Kisan CNIC, Govt Subsidy bill aur Pesticide batch license." : "Record farmer CNIC, Government subsidy compliance & pesticide licenses." },
      ]
    },
    {
      id: "security",
      categoryName: isUrdu ? "Security & Multi-User" : "Security & Staff Control",
      icon: ShieldCheck,
      features: [
        { title: isUrdu ? "Staff Roles & Permissions" : "Granular Staff Roles", desc: isUrdu ? "Admin, Manager, Cashier, Accountant ke zimmay alag alag rights." : "Restrict staff access by role (Cashier cannot edit price or void bill)." },
        { title: isUrdu ? "Audit Log Tracking" : "Tamper-Proof Audit Trail", desc: isUrdu ? "Har void bill, discount aur price badalnay ka timestamp record." : "Every price change, discount, and deleted bill is recorded with user ID." },
        { title: isUrdu ? "Encrypted Cloud Backups" : "Supabase Cloud & Drive Backup", desc: isUrdu ? "Aap ka data 24/7 cloud par secure backup hota rehta hai." : "Continuous 24/7 encrypted cloud backups with Google Drive export." },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white antialiased">
      {/* TOP ANNOUNCEMENT BAR — Titanium & Cyan Theme */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white text-xs py-2 px-4 text-center font-medium shadow-sm flex items-center justify-center gap-2 flex-wrap border-b border-cyan-500/20">
        <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          {isUrdu ? "Naya Update" : "New Release"}
        </span>
        <span className="text-slate-200">
          {isUrdu 
            ? "🎉 The Accounts v4.5 Live — Internet ke baghair 100% chalnay wala Smart POS System!" 
            : "🎉 The Accounts v4.5 Live — 100% Offline-First Smart POS & Udhaar Manager!"}
        </span>
        <a href="#demo" className="text-cyan-400 hover:text-cyan-300 underline font-bold transition-colors ml-1">
          {isUrdu ? "Demo Dekhein →" : "Try Demo →"}
        </a>
      </div>

      {/* HEADER / NAVIGATION */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
            <img
              src="/the-accounts-official-logo.png"
              alt="The Accounts Official Logo"
              className="h-9 w-9 sm:h-12 sm:w-12 object-contain filter drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
            />
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-tight group-hover:text-cyan-600 transition-colors">
                The Accounts
              </span>
              <span className="text-[9px] sm:text-[10px] font-semibold text-cyan-600 uppercase tracking-widest">
                Global ERP POS
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-semibold text-slate-600">
            <a href="#business-carousel" className="hover:text-cyan-600 transition-colors">{isUrdu ? "20 Business Verticals" : "20 Businesses"}</a>
            <a href="#all-features" className="hover:text-cyan-600 transition-colors">{isUrdu ? "Tamam Features" : "All Features"}</a>
            <a href="#why-us" className="hover:text-cyan-600 transition-colors">{isUrdu ? "Kyun Chunain?" : "Why Choose Us"}</a>
            <a href="#comparison" className="hover:text-cyan-600 transition-colors">{isUrdu ? "Comparison" : "Comparison"}</a>
            <a href="#pricing" className="hover:text-cyan-600 transition-colors">{isUrdu ? "Qeemat" : "Pricing"}</a>
            <a href="#faqs" className="hover:text-cyan-600 transition-colors">{isUrdu ? "Sawal o Jawab" : "FAQs"}</a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] sm:text-xs transition-colors border border-slate-200 cursor-pointer"
              title="Toggle Language"
            >
              <Globe size={13} className="text-cyan-600" />
              <span className="hidden xs:inline">{isUrdu ? "English" : "اردو"}</span>
            </button>

            {/* Mobile-Friendly Login Button (Always Visible!) */}
            <Link
              href="/login"
              className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-slate-100 sm:bg-transparent hover:bg-cyan-50 text-slate-700 hover:text-cyan-600 font-extrabold text-xs rounded-xl sm:rounded-none border border-slate-200 sm:border-0 transition-all flex items-center gap-1"
            >
              <LogIn size={14} className="text-cyan-600 sm:hidden" />
              <span>{isUrdu ? "لاگ ان" : "Sign In"}</span>
            </Link>

            {/* Free Trial Button */}
            <Link
              href="/register"
              className="px-3 py-1.5 sm:px-4 sm:py-2.5 bg-gradient-to-r from-slate-950 via-teal-800 to-cyan-600 hover:from-slate-900 hover:to-cyan-700 text-white font-bold rounded-xl text-xs shadow-md shadow-cyan-950/20 hover:shadow-lg transition-all flex items-center gap-1 sm:gap-1.5"
            >
              <span className="hidden xs:inline">{isUrdu ? "Free Start Karein" : "Start Free"}</span>
              <span className="xs:hidden">{isUrdu ? "رجسٹر" : "Trial"}</span>
              <ArrowRight size={13} />
            </Link>

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 transition-colors ml-0.5"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* MOBILE NAVIGATION DRAWER */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="lg:hidden bg-white border-b border-slate-200 shadow-xl overflow-hidden"
            >
              <div className="px-4 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Mobile Auth Actions Box */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                    >
                      <LogIn size={15} className="text-indigo-600" />
                      <span>{isUrdu ? "Login (لاگ ان)" : "Sign In / Login"}</span>
                    </Link>

                    <Link
                      href="/register"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-colors"
                    >
                      <Zap size={14} className="text-amber-300 fill-amber-300" />
                      <span>{isUrdu ? "Free Trial (رجسٹر)" : "Start Free Trial"}</span>
                    </Link>
                  </div>

                  <button
                    onClick={() => {
                      toggleLanguage();
                    }}
                    className="w-full py-2 bg-slate-200/70 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Globe size={14} className="text-indigo-600" />
                    <span>{isUrdu ? "Switch to English Language" : "اردو زبان میں تبدیل کریں"}</span>
                  </button>
                </div>

                {/* Navigation Links */}
                <div className="space-y-1 text-sm font-bold text-slate-700">
                  <a
                    href="#business-carousel"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Layers size={16} className="text-indigo-600" />
                      <span>{isUrdu ? "20 کاروباری ماڈیولز (20 Verticals)" : "20 Business Modules"}</span>
                    </span>
                    <ArrowRight size={14} className="text-slate-400" />
                  </a>

                  <a
                    href="#all-features"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Sparkles size={16} className="text-indigo-600" />
                      <span>{isUrdu ? "تمام پاورفل فیچرز (All Features)" : "All System Features"}</span>
                    </span>
                    <ArrowRight size={14} className="text-slate-400" />
                  </a>

                  <a
                    href="#why-us"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <ShieldCheck size={16} className="text-indigo-600" />
                      <span>{isUrdu ? "ہمیں کیوں منتخب کریں؟ (Why Us)" : "Why Choose Us"}</span>
                    </span>
                    <ArrowRight size={14} className="text-slate-400" />
                  </a>

                  <a
                    href="#comparison"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Scale size={16} className="text-indigo-600" />
                      <span>{isUrdu ? "پرانے سافٹ ویئر سے موازنہ (Comparison)" : "System Comparison"}</span>
                    </span>
                    <ArrowRight size={14} className="text-slate-400" />
                  </a>

                  <a
                    href="#pricing"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <CreditCard size={16} className="text-indigo-600" />
                      <span>{isUrdu ? "قیمت اور پیکجز (Pricing & Plans)" : "Subscription Pricing"}</span>
                    </span>
                    <ArrowRight size={14} className="text-slate-400" />
                  </a>

                  <a
                    href="#faqs"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <HelpCircle size={16} className="text-indigo-600" />
                      <span>{isUrdu ? "عام سوال و جواب (FAQs)" : "Help & FAQs"}</span>
                    </span>
                    <ArrowRight size={14} className="text-slate-400" />
                  </a>
                </div>

                {/* WhatsApp Direct Sales Support */}
                <div className="pt-2 border-t border-slate-100">
                  <a
                    href="https://wa.me/923241974677?text=Assalam-o-Alaikum!%20Mujhe%20The%20Accounts%20POS%20ka%20demo%20chahiye."
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageCircle size={16} className="text-emerald-600" />
                    <span>WhatsApp Demo Support (+92 324 1974677)</span>
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* VIP HERO SECTION WITH LIVE MULTI-COLOR THEME OPTIONS */}
      <VipHeroSection isUrdu={isUrdu} />

      {/* 🚀 20 BUSINESS VERTICALS 3D PERSPECTIVE CAROUSEL */}
      <div id="business-carousel">
        <Business3DCardsCarousel isUrdu={isUrdu} />
      </div>

      {/* ALL FEATURES COMPREHENSIVE SECTION */}
      <section id="all-features" className="py-14 sm:py-20 bg-slate-100/70 relative border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full border border-indigo-200">
              {isUrdu ? "Har Ek Single Feature Ki List" : "Comprehensive Feature Directory"}
            </h2>
            <p className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {isUrdu ? "The Accounts Ke Tamam Powerful Features" : "Complete List Of All System Features"}
            </p>
            <p className="text-sm sm:text-base text-slate-600 font-medium">
              {isUrdu 
                ? "Aap ki dukaan aur karobar ki har zaroorat ko poora karne ke liye 30+ se zyada smart modules." 
                : "Explore all 30+ capabilities engineered for Pakistan's modern retail and enterprise businesses."}
            </p>
          </div>

          {/* Category Selector Tabs */}
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-3 custom-scrollbar mb-8 sm:mb-10 px-1">
            {allFeatureGroups.map(grp => (
              <button
                key={grp.id}
                onClick={() => setActiveFeatureCategory(grp.id)}
                className={"px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer " + (activeFeatureCategory === grp.id ? "bg-indigo-600 text-white shadow-md scale-105" : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200")}
              >
                <grp.icon size={15} />
                <span>{grp.categoryName}</span>
              </button>
            ))}
          </div>

          {/* Active Category Features Display Grid */}
          {(() => {
            const activeGrp = allFeatureGroups.find(g => g.id === activeFeatureCategory) || allFeatureGroups[0];
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {activeGrp.features.map((feat, idx) => (
                  <div key={idx} className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 space-y-2.5 sm:space-y-3">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      <CheckCircle2 size={18} className="text-indigo-600" />
                    </div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900">{feat.title}</h3>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{feat.desc}</p>
                  </div>
                ))}
              </div>
            );
          })()}

        </div>
      </section>

      {/* WHY CHOOSE US SECTION */}
      <section id="why-us" className="py-14 sm:py-20 bg-white relative border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-3 sm:space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 inline-block px-3 py-1 rounded-full border border-indigo-100">{isUrdu ? "Kyun Chunain The Accounts?" : "Why Choose The Accounts?"}</h2>
            <p className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">{isUrdu ? "Purane Mushkil Systems Se Aazadi — Modern Smart Features!" : "Built Specifically For Retail, Wholesale & Modern Stores"}</p>
            <p className="text-sm sm:text-base text-slate-600 font-medium">{isUrdu ? "Humari har feature dukaandar ki rozmarrah ki zarooriyat ko samne rakh kar design ki gayi hai." : "Every capability is engineered to save time, eliminate ledger errors, and increase store sales."}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
            {[
              { icon: WifiOff, title: isUrdu ? "100% Offline POS Technology" : "100% Offline-First Billing", desc: isUrdu ? "Internet band hone par bhi dukaan ki sale aur billing 1-second ke liye nahi rukay gi. Internet aatay hi auto cloud sync!" : "Keep selling when internet drops. Sales queue locally on device and automatically sync to cloud when reconnected.", accent: "from-blue-600 to-indigo-600" },
              { icon: MessageCircle, title: isUrdu ? "WhatsApp Receipts & Udhaar Alerts" : "WhatsApp Invoices & Ledgers", desc: isUrdu ? "Paper waste khatam! 1-Click se customer ke WhatsApp par digital receipt aur Udhaar payment link bhejein." : "Send instant PDF receipts and payment reminders directly to customer WhatsApp numbers without extra SMS cost.", accent: "from-emerald-600 to-teal-600" },
              { icon: Printer, title: isUrdu ? "Universal Thermal Printer & Scale" : "Hardware & Weighing Scale Support", desc: isUrdu ? "Tamam 80mm / 58mm thermal printers, USB/Wireless Barcode scanners aur Weight scale ke sath 100% plug & play compatibility." : "Direct native integration with 80mm/58mm printers, barcode scanners, and serial port weighing scale machines.", accent: "from-violet-600 to-purple-600" },
              { icon: Globe, title: isUrdu ? "Urdu + English Dual Interface" : "Urdu & English Billing", desc: isUrdu ? "Counter operator aur shop owner dono ke liye aasan zaban. Har bill par Urdu note aur Urdu item names ki sahulat." : "User-friendly bilingual interface designed for non-technical counter operators and business owners alike.", accent: "from-amber-500 to-orange-500" },
              { icon: Layers, title: isUrdu ? "15 Specialized Business Modules" : "15 Specialized Industry Packs", desc: isUrdu ? "Pharmacy, Restaurant (KDS/KOT), Garments, Electronics (IMEI), Tailor, Fertilizer, Showroom aur Karyana modules." : "Tailor-made workflows for Pharmacy, Restaurants, Mobile/IMEI, Apparel matrix, Tailoring sketches, and Fertilizer.", accent: "from-pink-600 to-rose-600" },
              { icon: TrendingUp, title: isUrdu ? "Auto Daily Profit & Loss Closing" : "Real-Time Profit & Loss Reports", desc: isUrdu ? "Rozana ki kul sale, munafa aur kharchon ka 1-Click closing book report. Phir kabhi hisab me ghalti nahi ho gi!" : "Instant closing books, gross margin analysis, net profit/loss statements, and inventory valuation reports.", accent: "from-cyan-600 to-blue-600" },
            ].map((card, idx) => (
              <motion.div key={idx} whileHover={{ y: -6 }} className="bg-slate-50 rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
                <div className="space-y-3 sm:space-y-4">
                  <div className={"h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-br " + card.accent + " text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform"}>
                    <card.icon size={20} />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{card.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">{card.desc}</p>
                </div>
                <div className="pt-4 sm:pt-6 flex items-center text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                  <span>{isUrdu ? "Mazeed Maloomat →" : "Learn More →"}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON SECTION */}
      <section id="comparison" className="py-14 sm:py-20 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 inline-block px-3 py-1 rounded-full border border-indigo-100">{isUrdu ? "Muqabla (Comparison)" : "Why Switch To The Accounts"}</h2>
            <p className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">{isUrdu ? "Aam Purana POS System vs The Accounts" : "Traditional POS Systems vs The Accounts"}</p>
            <p className="text-sm sm:text-base text-slate-600 font-medium">{isUrdu ? "Dekhein kyun hazaron dukaandar purane software chor kar The Accounts par shift ho rahe hain." : "Compare key features and see why modern businesses choose our solution."}</p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-xl bg-white">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[550px]">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs sm:text-sm font-bold uppercase tracking-wider">
                    <th className="p-3.5 sm:p-5 w-1/3">{isUrdu ? "Khasosiyat (Feature)" : "Feature / Capability"}</th>
                    <th className="p-3.5 sm:p-5 w-1/3 bg-slate-800 text-red-300">
                      <div className="flex items-center gap-1.5"><XCircle size={15} /><span>{isUrdu ? "Aam Purana POS" : "Ordinary Traditional POS"}</span></div>
                    </th>
                    <th className="p-3.5 sm:p-5 w-1/3 bg-indigo-600 text-white">
                      <div className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-amber-300" /><span>The Accounts POS ✅</span></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-medium text-slate-700">
                  {[
                    { feature: isUrdu ? "Internet Ke Baghair Billing" : "Offline POS Operations", ordinary: isUrdu ? "❌ Internet band par sale ruk jati hai" : "❌ Freezes when internet drops", theAccounts: isUrdu ? "✅ 100% Offline chalay ga & Auto sync" : "✅ Continuous offline sale & auto sync" },
                    { feature: isUrdu ? "WhatsApp Receipts & Reminders" : "WhatsApp PDF & Recovery Alerts", ordinary: isUrdu ? "❌ Paper slips / Mehnge SMS charge" : "❌ Paper receipts or expensive SMS", theAccounts: isUrdu ? "✅ 1-Click WhatsApp PDF & Payment link" : "✅ Instant 1-Click WhatsApp PDF invoice" },
                    { feature: isUrdu ? "Interface & Zaban" : "User Interface & Language", ordinary: isUrdu ? "❌ Pechida English technical menus" : "❌ Complex technical English menus", theAccounts: isUrdu ? "✅ Asan Urdu / English billing interface" : "✅ Simple Urdu/English interface" },
                    { feature: isUrdu ? "Hardware Compatibility" : "Hardware & Thermal Support", ordinary: isUrdu ? "❌ Sirf unki apni mehangi machine par" : "❌ Requires proprietary expensive hardware", theAccounts: isUrdu ? "✅ Mobile, Laptop, Tablet, Thermal printer" : "✅ Works on any phone, PC, 80mm/58mm printer" },
                    { feature: isUrdu ? "Industry Specialization" : "Industry Specific Modules", ordinary: isUrdu ? "❌ Sirf aam retail counter" : "❌ Basic general retail counter only", theAccounts: isUrdu ? "✅ 15 Specialized Packs (Pharmacy, KDS, IMEI)" : "✅ 15 vertical packs (Pharmacy, KDS, IMEI)" },
                    { feature: isUrdu ? "Daily Profit & Loss Closing" : "Daily Closing & P&L Statement", ordinary: isUrdu ? "❌ Manual calculator se hisab" : "❌ Manual calculation required", theAccounts: isUrdu ? "✅ 1-Click Instant Daily P&L & Book Closing" : "✅ Automatic 1-Click P&L financial reports" },
                  ].map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                      <td className="p-3.5 sm:p-5 font-black text-slate-900">{row.feature}</td>
                      <td className="p-3.5 sm:p-5 text-red-600 bg-red-50/20 font-semibold">{row.ordinary}</td>
                      <td className="p-3.5 sm:p-5 text-indigo-900 bg-indigo-50/40 font-extrabold">{row.theAccounts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 💰 PRICING SECTION (REAL ADMIN PLANS & PRICES) */}
      <section id="pricing" className="py-14 sm:py-20 bg-slate-50 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 space-y-3 sm:space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-100/60 inline-block px-3 py-1 rounded-full border border-indigo-200">
              {isUrdu ? "Asli System Plans & Pricing" : "Official System Subscription Plans"}
            </h2>
            <p className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {isUrdu ? "Bina Kisi Chupi Hui Fee Ke Asli Qeemat" : "Official Plans Configured In Admin Panel"}
            </p>
            
            {/* Billing Cycle & Currency Toggles */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 pt-2">
              <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1">
                <button onClick={() => setBillingCycle("monthly")} className={"px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer " + (billingCycle === "monthly" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900")}>
                  {isUrdu ? "Mahana (Monthly)" : "Monthly Billing"}
                </button>
                <button onClick={() => setBillingCycle("yearly")} className={"px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer " + (billingCycle === "yearly" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:text-slate-900")}>
                  <span>{isUrdu ? "Salanah" : "Yearly"}</span>
                  <span className="bg-amber-400 text-slate-950 font-extrabold px-1.5 py-0.5 rounded-full text-[9px]">Save Big</span>
                </button>
              </div>
              <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1">
                <button onClick={() => setCurrency("PKR")} className={"px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer " + (currency === "PKR" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900")}>PKR (Rs)</button>
                <button onClick={() => setCurrency("USD")} className={"px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer " + (currency === "USD" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900")}>USD ($)</button>
              </div>
            </div>
          </div>

          {/* REAL DYNAMIC ADMIN PLANS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch pt-4">
            {adminPlans.map((plan) => {
              const isYearly = billingCycle === "yearly";
              const isPKR = currency === "PKR";
              const price = isPKR
                ? (isYearly ? plan.yearly_price : plan.monthly_price)
                : (isYearly ? (plan.yearly_price_usd || 19.99) : (plan.monthly_price_usd || 1.99));
              const formattedPrice = isPKR ? "Rs " + (price || 0).toLocaleString() : "$" + (price || 0);
              const isPopular = plan.id === "premium";

              return (
                <div
                  key={plan.id}
                  className={"bg-white rounded-3xl p-8 border flex flex-col justify-between relative transition-all duration-300 hover:shadow-2xl " + (
                    isPopular ? "border-2 border-indigo-600 shadow-xl shadow-indigo-600/10 scale-105 z-10" : "border-slate-200/80 shadow-sm"
                  )}
                >
                  {isPopular && (
                    <div className="w-full flex justify-center mb-4">
                      <div className="inline-flex items-center gap-1 bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md">
                        <Star size={12} className="fill-amber-300 text-amber-300" />
                        <span>Most Popular Choice</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1 mb-6 uppercase tracking-wider">
                      {plan.max_devices === "unlimited" ? "Unlimited Devices Counter" : plan.max_devices + " Counter Device(s)"}
                    </p>
                    
                    <div className="mb-6 pb-6 border-b border-slate-100 flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">
                        {formattedPrice}
                      </span>
                      <span className="text-xs text-slate-500 font-bold">/ {isYearly ? "year" : "month"}</span>
                    </div>

                    {/* Real Plan Features List */}
                    <ul className="space-y-3 mb-8">
                      <li className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        <span>{plan.max_devices === "unlimited" ? "Unlimited Counter Terminals" : plan.max_devices + " Counter Terminal(s)"}</span>
                      </li>
                      <li className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        <span>100% Offline POS & Billing</span>
                      </li>
                      {plan.allow_sales_purchases && (
                        <li className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          <span>Sales & Purchase Matrix</span>
                        </li>
                      )}
                      {plan.allow_user_roles && (
                        <li className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          <span>Staff Roles & Granular Control</span>
                        </li>
                      )}
                      {plan.allow_whatsapp && (
                        <li className="flex items-center gap-2.5 text-xs font-bold text-indigo-600 font-extrabold">
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          <span>1-Click WhatsApp PDF Invoices</span>
                        </li>
                      )}
                      {plan.allow_industrial_accounts && (
                        <li className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          <span>Industrial Double-Entry Ledger</span>
                        </li>
                      )}
                      {plan.allow_multi_shop && (
                        <li className="flex items-center gap-2.5 text-xs font-bold text-indigo-600 font-extrabold">
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          <span>Multi-Shop & Warehouse Manager</span>
                        </li>
                      )}
                      {plan.allow_ai_product_add && (
                        <li className="flex items-center gap-2.5 text-xs font-bold text-indigo-600 font-extrabold">
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          <span>AI Product Scanner & Auto Purchase</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  <Link
                    href={"/register?plan=" + plan.id}
                    className={"w-full py-3.5 rounded-2xl font-black text-xs text-center transition-all flex items-center justify-center gap-2 " + (
                      isPopular
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                    )}
                  >
                    <span>{isUrdu ? "Free Trial Shuru Karein" : "Start 14-Day Free Trial"}</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faqs" className="py-20 bg-white border-t border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 inline-block px-3 py-1 rounded-full border border-indigo-100">{isUrdu ? "Aam Sawalat (FAQs)" : "Frequently Asked Questions"}</h2>
            <p className="text-3xl font-black text-slate-900 tracking-tight">{isUrdu ? "Dukaandaron Ke Aam Sawalat Ke Jawab" : "Everything You Need To Know"}</p>
          </div>
          <div className="space-y-4">
            {[
              { q: isUrdu ? "Kya Internet band hone par dukaan ki billing ruk jaye gi?" : "Does the POS work without internet connection?", a: isUrdu ? "Bilkul nahi! The Accounts 100% Offline-First technology par kaam karta hai. Internet na hone par bhi aap ki sale aur receipts chalnay rahein gi. Internet aatay hi tamam data auto cloud par sync ho jaye ga." : "Not at all! The Accounts is built with 100% Offline-First architecture. Checkout and thermal receipts run seamlessly offline, and automatically sync to cloud servers once reconnected." },
              { q: isUrdu ? "Kya mera purana thermal printer aur barcode scanner connect ho jaye ga?" : "Is it compatible with my existing thermal printer and barcode scanner?", a: isUrdu ? "Jee haan! Tamam 80mm aur 58mm thermal printers (Xprinter, Sunmi, Bluetooth/USB), barcode scanners aur weighing scales 100% plug & play support kartay hain." : "Yes! We support all standard 80mm/58mm thermal printers, USB/Wireless barcode scanners, and RS232 weighing scale machines out of the box." },
              { q: isUrdu ? "WhatsApp Receipts aur Udhaar Reminders kaise kaam karte hain?" : "How do WhatsApp Receipts & Udhaar reminders work?", a: isUrdu ? "Bill bante hi aap 1-Click se customer ke WhatsApp par digital PDF invoice aur Udhaar ledger ka reminder bhej saktay hain bina kisi extra SMS cost ke." : "Upon checkout, you can send an official digital PDF receipt and payment link directly to customer WhatsApp numbers with 1-click." },
              { q: isUrdu ? "Kya mera data safe aur secure rahay ga?" : "How secure is my business data?", a: isUrdu ? "Aap ka tamam data enterprise-grade Supabase cloud databases par encrypted backup ke sath 24/7 safe rehta hai." : "Your business records are protected with bank-grade Supabase RLS encryption and automatic continuous backups." },
              { q: isUrdu ? "System seekhna kitna aasan hai?" : "How easy is it to train my cashiers and staff?", a: isUrdu ? "System ko khas taur par non-technical dukaandaron ke liye design kiya gaya hai. Koi bhi staff 10 minute me POS counter chalana seekh sakta hai." : "Designed specifically for non-technical counter operators. Staff can master billing and checkout in under 10 minutes." },
            ].map((faq, idx) => (
              <div key={idx} className="bg-slate-50 rounded-2xl border border-slate-200/80 overflow-hidden transition-all">
                <button onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)} className="w-full p-5 text-left font-black text-slate-900 text-sm flex justify-between items-center gap-4 cursor-pointer hover:text-indigo-600 transition-colors">
                  <span>{faq.q}</span>
                  <ChevronDown size={18} className={"transition-transform text-slate-400 " + (openFaqIndex === idx ? "rotate-180 text-indigo-600" : "")} />
                </button>
                {openFaqIndex === idx && (
                  <div className="px-5 pb-5 text-xs text-slate-600 font-medium leading-relaxed border-t border-slate-200/50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER CTA BANNER */}
      <section className="py-16 bg-gradient-to-r from-indigo-900 via-blue-950 to-slate-900 text-white text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 relative z-10 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">{isUrdu ? "Aaj Hi Apne Karobar Ko Smart Banayein!" : "Transform Your Business Today"}</h2>
          <p className="text-sm text-indigo-200 font-medium max-w-xl mx-auto">{isUrdu ? "14 din ka free trial shuru karein bina kisi credit card ke. Dukan ki sale aur hisab ko 1-Click se control karein." : "Start your 14-day free trial now with zero credit card required. Experience fast billing and automatic profit tracking."}</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
            <Link href="/register" className="px-8 py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 text-slate-950 font-black rounded-2xl text-sm shadow-xl flex items-center justify-center gap-2">
              <span>{isUrdu ? "Free Trial Shuru Karein" : "Start Free 14-Day Trial"}</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* FLOATING WHATSAPP BUTTON */}
      <a href="https://wa.me/923241974677?text=Assalam-o-Alaikum!%20Mujhe%20The%20Accounts%20POS%20ka%20demo%20chahiye." target="_blank" rel="noreferrer" className="fixed bottom-6 right-6 z-50 bg-emerald-500 hover:bg-emerald-600 text-white p-3.5 rounded-full shadow-2xl hover:scale-110 transition-all flex items-center justify-center group" title="WhatsApp Support">
        <MessageCircle size={28} />
        <span className="absolute right-full mr-3 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">WhatsApp Sales Demo (+92 324 1974677)</span>
      </a>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 text-xs py-8 border-t border-slate-900 text-center">
        <p>© 2026 The Accounts Global ERP POS System. All rights reserved.</p>
      </footer>
    </div>
  );
}