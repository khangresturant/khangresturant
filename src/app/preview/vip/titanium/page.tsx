"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, ShieldCheck, ArrowRight, Zap, CheckCircle2, 
  WifiOff, RefreshCw, BarChart3, TrendingUp, Smartphone, 
  Printer, ScanLine, Layers, Star, MessageCircle, Play, 
  Car, Pill, Store, Utensils, Scissors, Check, HelpCircle
} from "lucide-react";
import { VipNav } from "@/components/vip/VipNav";

const INDUSTRIES = [
  {
    id: "showroom",
    name: "Automobile & Showrooms",
    urdu: "گاڑیوں و موٹر شو رومز",
    icon: Car,
    tagline: "قسط وار گاڑیوں کی فروخت اور مکمل اقرار نامہ قانونی دستاویزات",
    features: [
      "Auto-generated A4 Legal Deed with Urdu Terms & Guarantor details",
      "Monthly Qist installment tracker with late-fee penalty & automated receipts",
      "Investor profit share calculation with chassis & engine number verification"
    ],
    stat: "100% Legal Deed Ready"
  },
  {
    id: "mobile",
    name: "Mobile & Electronics",
    urdu: "موبائل فونز و الیکٹرانکس",
    icon: Smartphone,
    tagline: "مکمل IMEI وارنٹی اور ریورس لیجر مینجمنٹ",
    features: [
      "15-digit IMEI tracking per phone unit with warranty claim history",
      "Buyback old phone calculation with cash/credit party adjustments",
      "Mobile accessories barcode scanning with pack-to-piece conversions"
    ],
    stat: "Zero IMEI Duplication"
  },
  {
    id: "pharmacy",
    name: "Pharmacy & Healthcare",
    urdu: "فارمیسی و میڈیکل اسٹورز",
    icon: Pill,
    tagline: "34,000+ آفیشل ڈریپ (DRAP) ادویات کی کیٹلاگ",
    features: [
      "Official 2026 DRAP drug database pre-loaded with generic formula names",
      "Batch-wise expiry alert system with automatic returns to pharmaceutical distributors",
      "Controlled medicine register & temperature tracking compliant with Drug Act"
    ],
    stat: "34,000 DRAP Catalog"
  },
  {
    id: "grocery",
    name: "Grocery & Marts",
    urdu: "کریا نہ و سپر مارٹس",
    icon: Store,
    tagline: "ہائی اسپیڈ بارکوڈ اسکیننگ اور کسٹم وزن کا ترازو",
    features: [
      "Sub-second barcode scan with thermal 80mm & 58mm printer instant cut",
      "Digital barcode weighing scale barcode integration for loose items",
      "Multi-counter sync with cash drawer opening pulse on checkout"
    ],
    stat: "0.2s Checkout Speed"
  },
  {
    id: "restaurant",
    name: "Cafes & Restaurants",
    urdu: "ریسٹورنٹس و فاسٹ فوڈ",
    icon: Utensils,
    tagline: "کچن آرڈر ٹکٹ (KOT) اور لائیو ٹیبل ریزرویشن",
    features: [
      "Real-time Kitchen Display System (KDS) & multi-station thermal KOT print",
      "Floor plan table management with waiter mobile order booking app",
      "Recipe & raw ingredient inventory depletion with modifier add-ons"
    ],
    stat: "Instant KOT Routing"
  }
];

export default function TitaniumCyberVipPage() {
  const [activeIndustry, setActiveIndustry] = useState(INDUSTRIES[0]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [calcBranches, setCalcBranches] = useState<number>(2);
  const [calcDailyBills, setCalcDailyBills] = useState<number>(150);

  // Estimated Savings calculation
  const monthlyHoursSaved = Math.round(calcBranches * (calcDailyBills * 0.05 * 30));
  const monthlyMoneySaved = (calcBranches * 45000).toLocaleString();

  return (
    <div className="min-h-screen bg-[#070A10] text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950 overflow-x-hidden">
      <VipNav theme="dark" activeConcept="titanium" />

      {/* Hero Section */}
      <section className="relative pt-12 pb-24 px-4 sm:px-6 lg:px-8">
        {/* Luminous Neon Backdrop */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-cyan-500/15 blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto mb-12">
            {/* Live Operational Status Pill */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-6 shadow-xl shadow-emerald-950/40 backdrop-blur-md"
            >
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Next-Gen Cloud ERP & Hybrid Offline POS</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300 font-mono">v6.4 Enterprise Engine</span>
            </motion.div>

            {/* High-Impact Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08] mb-6">
              The Operating System for <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-400 bg-clip-text text-transparent">
                High-Growth Businesses
              </span>
            </h1>

            <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8 font-normal">
              شوروم، فارمیسی، موبائل شاپ اور ریٹیل کا واحد کلاؤڈ سسٹم جو انٹرنیٹ بند ہونے پر بھی رکے بغیر چلتا ہے۔
              اکاؤنٹنگ، انوینٹری، اور لیجر کا 100% شفاف حساب۔
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm tracking-wide shadow-2xl shadow-emerald-500/25 transition-all hover:scale-105 flex items-center gap-2 group"
              >
                <span>Start 14-Day Free Trial</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              <a
                href="https://wa.me/923004074760?text=Assalam-o-Alaikum%20Mujhe%20The%20Accounts%20Cloud%20ka%20VIP%20demo%20dekhna%20hai"
                target="_blank"
                rel="noreferrer"
                className="px-7 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 font-bold text-sm transition-all hover:scale-105 flex items-center gap-2.5 backdrop-blur-xl"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>Book Live WhatsApp Demo</span>
              </a>
            </div>

            {/* Live Trust Metrics Bar */}
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto pt-6 border-t border-slate-800/80 text-center">
              <div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">Rs 2.4B+</p>
                <p className="text-[11px] text-slate-400 font-medium">Transactions Processed</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">1,200+</p>
                <p className="text-[11px] text-slate-400 font-medium">Businesses Live</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-cyan-400 font-mono">99.99%</p>
                <p className="text-[11px] text-slate-400 font-medium">Cloud Uptime SLA</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-teal-300 font-mono">0 Data Loss</p>
                <p className="text-[11px] text-slate-400 font-medium">Hybrid Offline Queue</p>
              </div>
            </div>
          </div>

          {/* 3D Floating Dashboard Hologram Graphic */}
          <div className="relative max-w-5xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.15)] bg-slate-950 group">
              <Image
                src="/images/vip_hero_dashboard.jpg"
                alt="The Accounts Cloud VIP Dashboard Cockpit"
                width={1920}
                height={1080}
                className="w-full h-auto object-cover transform group-hover:scale-[1.01] transition-transform duration-700"
                priority
              />

              {/* Holographic Glowing Glass Edge Badge */}
              <div className="absolute top-6 left-6 p-4 rounded-2xl bg-slate-950/80 backdrop-blur-xl border border-emerald-500/30 shadow-2xl flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <BarChart3 className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Live Stream</span>
                  <span className="text-sm font-black text-white font-mono">Daily Profit: +Rs 184,250</span>
                </div>
              </div>

              {/* Bottom Offline Proof Ticker */}
              <div className="absolute bottom-6 right-6 hidden sm:flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-cyan-500/30 shadow-2xl">
                <WifiOff className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Offline Auto-Sync: <strong className="text-emerald-400 font-mono">100% Guaranteed</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Industry Interactive Bento Switcher */}
      <section id="solutions" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80 bg-slate-950/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 mb-2 block">
              Tailored Architecture
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white">
              Built Specifically for Your Industry
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-3">
              ایک ہی سافٹ ویئر ہر کاروبار پر زبردستی فٹ نہیں کیا گیا۔ ہر شعبے کا اپنا کسٹم ماڈیول اور رپورٹنگ ہے۔
            </p>
          </div>

          {/* Industry Tab Buttons */}
          <div className="flex items-center justify-center gap-2 flex-wrap mb-10">
            {INDUSTRIES.map((ind) => {
              const Icon = ind.icon;
              const isActive = activeIndustry.id === ind.id;
              return (
                <button
                  key={ind.id}
                  onClick={() => setActiveIndustry(ind)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 scale-105"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{ind.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Industry Showcase Card */}
          <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-8 sm:p-12 relative overflow-hidden backdrop-blur-xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest block mb-2">
                  {activeIndustry.stat}
                </span>
                <h3 className="text-2xl sm:text-4xl font-black text-white mb-2">
                  {activeIndustry.name}
                </h3>
                <p className="text-base font-semibold text-emerald-300 mb-6 font-urdu">
                  {activeIndustry.urdu} — {activeIndustry.tagline}
                </p>

                <div className="space-y-4 mb-8">
                  {activeIndustry.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 text-emerald-400">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{feat}</p>
                    </div>
                  ))}
                </div>

                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-colors"
                >
                  <span>Explore {activeIndustry.name} Module</span>
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                </Link>
              </div>

              {/* Visual Showcase Box */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 shadow-2xl relative">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    <span className="text-xs font-mono text-slate-400 ml-2">live_terminal_session.json</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                    Live Verified
                  </span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400">Ledger Auto-Reconciliation</span>
                    <span className="text-emerald-400 font-bold">100% Matched</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400">Thermal Printer Integration</span>
                    <span className="text-cyan-400 font-bold">ESC/POS (USB & Network)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400">WhatsApp Ledger Recovery Bot</span>
                    <span className="text-emerald-400 font-bold">Automated 1-Click Send</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400">FBR POS Tier-1 Digital Invoice</span>
                    <span className="text-amber-400 font-bold">QR Verified Compliant</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Business ROI Calculator */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 rounded-3xl border border-emerald-500/20 p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest block mb-2">
                Business ROI Simulator
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white mb-4">
                Calculate How Much Time & Money You Save
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">
                دستی پرچیوں، کھاتوں میں گھپلے اور انوینٹری چوری کو ختم کر کے اپنے کاروبار کی ماہانہ بچت کا تخمینہ لگائیں۔
              </p>

              <div className="space-y-6">
                {/* Branches Slider */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-slate-400">Number of Branches / Shops:</span>
                    <span className="text-emerald-400 font-mono text-sm">{calcBranches} Shops</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={calcBranches}
                    onChange={(e) => setCalcBranches(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Daily Invoices Slider */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-slate-400">Daily Sales Invoices per Shop:</span>
                    <span className="text-cyan-400 font-mono text-sm">{calcDailyBills} Invoices/day</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="800"
                    step="10"
                    value={calcDailyBills}
                    onChange={(e) => setCalcDailyBills(Number(e.target.value))}
                    className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Calculated Output Card */}
            <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-6 shadow-xl">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Estimated Monthly Financial Recovery
                </p>
                <p className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent font-mono">
                  Rs {monthlyMoneySaved}+
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Saved from billing leaks & stock shrinkage</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-800 text-left">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Accountant Hours Saved</p>
                  <p className="text-xl font-bold text-white font-mono">{monthlyHoursSaved} Hours/mo</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Audit Reconciliation</p>
                  <p className="text-xl font-bold text-emerald-400 font-mono">Instant 1-Click</p>
                </div>
              </div>

              <Link
                href="/register"
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs block transition-all shadow-lg shadow-emerald-500/20"
              >
                Claim This ROI — Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 mb-2 block">
            Fair & Transparent Pricing
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white">
            Simple Investment, Exponential Returns
          </h2>
          <p className="text-slate-400 text-sm mt-3">
            کوئی خفیہ چارجز نہیں ہیں۔ 14 دن کا مکمل فری ٹرائل، بغیر کریڈٹ کارڈ کے۔
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-2 p-1.5 rounded-full bg-slate-900 border border-slate-800 mt-6">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                billingCycle === "monthly" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                billingCycle === "yearly" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Yearly (Save 20%)</span>
              <span className="text-[10px] bg-emerald-400/20 text-emerald-950 px-1.5 rounded font-black">20% OFF</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Starter Plan */}
          <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-black text-white mb-1">Starter Retail</h3>
              <p className="text-xs text-slate-400 mb-6">چھوٹی دکان یا سنگل شاپ رجسٹر کے لیے</p>
              <div className="mb-6">
                <span className="text-3xl font-black text-white font-mono">
                  {billingCycle === "yearly" ? "Rs 2,400" : "Rs 3,000"}
                </span>
                <span className="text-xs text-slate-400"> / month</span>
              </div>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 1 Shop Register & POS</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Offline Sync Engine</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Customer / Supplier Khata</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Thermal 80mm & 58mm Print</li>
              </ul>
            </div>
            <Link href="/register" className="mt-8 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs text-center block">
              Start Free Trial
            </Link>
          </div>

          {/* Business Pro Plan (Featured) */}
          <div className="p-8 rounded-3xl bg-slate-900/90 border-2 border-emerald-500 flex flex-col justify-between relative shadow-2xl shadow-emerald-500/10 scale-105">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase px-4 py-1 rounded-full shadow-md">
              Most Popular Business Choice
            </div>
            <div>
              <h3 className="text-xl font-black text-white mb-1">Business Pro</h3>
              <p className="text-xs text-slate-400 mb-6">کامیاب دکانوں، شو رومز اور فارمیسی کے لیے</p>
              <div className="mb-6">
                <span className="text-4xl font-black text-emerald-400 font-mono">
                  {billingCycle === "yearly" ? "Rs 4,800" : "Rs 6,000"}
                </span>
                <span className="text-xs text-slate-400"> / month</span>
              </div>
              <ul className="space-y-3 text-xs text-slate-200">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 3 Registers / Multi-Device</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Showroom Legal Deeds & Installments</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> WhatsApp Automated Khata Reminders</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 34,000 DRAP Medicine Database</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> FBR POS Digital Invoicing</li>
              </ul>
            </div>
            <Link href="/register" className="mt-8 w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs text-center block shadow-lg shadow-emerald-500/20">
              Get Started with Pro
            </Link>
          </div>

          {/* Enterprise Multi-Branch */}
          <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-black text-white mb-1">Enterprise Multi-Branch</h3>
              <p className="text-xs text-slate-400 mb-6">متعدد برانچز اور ہول سیل ڈسٹری بیوٹرز کے لیے</p>
              <div className="mb-6">
                <span className="text-3xl font-black text-white font-mono">
                  {billingCycle === "yearly" ? "Rs 9,600" : "Rs 12,000"}
                </span>
                <span className="text-xs text-slate-400"> / month</span>
              </div>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Unlimited Branches & Warehouses</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Inter-Branch Stock Transfers</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Dedicated Account Manager</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Custom API & ERP Integrations</li>
              </ul>
            </div>
            <Link href="/register" className="mt-8 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs text-center block">
              Contact Enterprise
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-900 text-center text-xs text-slate-500">
        <p>© 2026 The Accounts Cloud. All rights reserved. Registered with SECP & FBR Compliant.</p>
        <p className="mt-2 text-slate-600">Concept 1: Titanium Cyber-Fintech VIP Mockup</p>
      </footer>
    </div>
  );
}
