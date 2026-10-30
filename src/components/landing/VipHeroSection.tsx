"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, ChevronRight, Globe, Layers, MessageCircle, Printer,
  ScanLine, Smartphone, Sparkles, TrendingUp, WifiOff, Zap, ShieldCheck,
  Scale, Building2, Star, Award, CheckCircle2, DollarSign, Cpu, Database,
  Activity, Shield, Play, Receipt, ShoppingCart, Plus, Minus, Car, Pill,
  Utensils, Store, Boxes, UserCheck, Flame, Radio, Clock, ShieldAlert,
  ArrowUpRight, BarChart3, ChevronDown, CheckCircle, Palette
} from "lucide-react";

export type ColorThemeKey = "cobalt" | "forest_gold" | "obsidian_cyan" | "royal_indigo";

interface ColorThemeConfig {
  name: string;
  dotColor: string;
  gradientTitle: string;
  primaryBtn: string;
  glowAura: string;
  badgeBg: string;
  statNumber: string;
  accentBorder: string;
  activePill: string;
}

const COLOR_PALETTES: Record<ColorThemeKey, ColorThemeConfig> = {
  cobalt: {
    name: "1. Cobalt Blue & Mint",
    dotColor: "#2563EB",
    gradientTitle: "from-blue-600 via-indigo-600 to-emerald-600",
    primaryBtn: "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-blue-600/30",
    glowAura: "from-blue-400/20 via-indigo-400/10 to-transparent",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
    statNumber: "text-blue-600",
    accentBorder: "border-blue-200",
    activePill: "bg-blue-600 text-white",
  },
  forest_gold: {
    name: "2. Forest Green & Gold",
    dotColor: "#059669",
    gradientTitle: "from-emerald-700 via-teal-700 to-amber-500",
    primaryBtn: "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-emerald-600/30",
    glowAura: "from-emerald-400/20 via-amber-400/15 to-transparent",
    badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
    statNumber: "text-emerald-700",
    accentBorder: "border-emerald-200",
    activePill: "bg-emerald-600 text-white",
  },
  obsidian_cyan: {
    name: "3. Titanium & Cyan",
    dotColor: "#06B6D4",
    gradientTitle: "from-slate-900 via-teal-600 to-cyan-500",
    primaryBtn: "bg-gradient-to-r from-slate-950 via-teal-700 to-cyan-600 hover:from-slate-900 hover:to-cyan-700 text-white shadow-teal-600/30",
    glowAura: "from-cyan-400/20 via-teal-400/10 to-transparent",
    badgeBg: "bg-cyan-50 text-cyan-800 border-cyan-200",
    statNumber: "text-cyan-700",
    accentBorder: "border-cyan-200",
    activePill: "bg-cyan-600 text-white",
  },
  royal_indigo: {
    name: "4. Royal Indigo & Violet",
    dotColor: "#4F46E5",
    gradientTitle: "from-indigo-600 via-purple-600 to-pink-600",
    primaryBtn: "bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-indigo-600/30",
    glowAura: "from-indigo-400/20 via-purple-400/15 to-transparent",
    badgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
    statNumber: "text-indigo-600",
    accentBorder: "border-indigo-200",
    activePill: "bg-indigo-600 text-white",
  },
};

interface VipHeroSectionProps {
  isUrdu?: boolean;
}

export default function VipHeroSection({ isUrdu = false }: VipHeroSectionProps = {}) {
  // Locked in Titanium & Cyan as permanent theme
  const [activeThemeKey, setActiveThemeKey] = useState<ColorThemeKey>("obsidian_cyan");
  const theme = COLOR_PALETTES[activeThemeKey];

  // Live Active Vertical state
  const [selectedVertical, setSelectedVertical] = useState<"retail" | "showroom" | "wholesale" | "pharma">("retail");
  
  // Interactive Live Sale Simulation
  const [liveSales, setLiveSales] = useState([
    { id: 1, text: "Toyota Corolla GLI Token Booking", amount: "Rs. 250,000", tag: "Showroom", time: "Just now" },
    { id: 2, text: "Mobil 1 Synthetic Oil (12x Cans)", amount: "Rs. 33,600", tag: "Wholesale", time: "1m ago" },
    { id: 3, text: "Samsung S24 Ultra + Acc. Bundle", amount: "Rs. 385,000", tag: "Retail POS", time: "2m ago" },
  ]);

  // Offline Simulation State
  const [isOfflineSimulated, setIsOfflineSimulated] = useState(false);

  // Live Barcode Scan Counter animation
  const [scanCount, setScanCount] = useState(14820);
  useEffect(() => {
    const timer = setInterval(() => {
      setScanCount(prev => prev + 1);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const verticalDetails = {
    retail: {
      title: "Supermarket & Multi-Store Retail",
      badge: "0.04s Barcode Speed & Universal 80mm Print",
      description: "Sub-second barcode scanning, RS232 weighing scale sync, multi-cart hold, and 1-click WhatsApp customer receipts.",
      stat1: "0.04s",
      stat1Label: "Barcode Latency",
      stat2: "100%",
      stat2Label: "Offline Resilience",
      stat3: "Rs. 0",
      stat3Label: "Paper Receipt Waste",
      features: ["Weighing Scale Sync", "Thermal 80mm/58mm", "Hold Cart Parking", "Dual-Screen POS"],
    },
    showroom: {
      title: "Automobile Showroom & Installments",
      badge: "Installment Schedules & Legal Stamp Agreements",
      description: "Complete vehicle stock by engine/chassis number, investor profit-sharing percentages, biometric records, and automated SMS/WhatsApp installment reminders.",
      stat1: "100%",
      stat1Label: "Chassis & Engine Audit",
      stat2: "Zero",
      stat2Label: "Missed Due Dates",
      stat3: "Auto",
      stat3Label: "Investor Profit Split",
      features: ["Biometric Verification", "Legal Stamp Printing", "Monthly Due Alerts", "Chassis Tracking"],
    },
    wholesale: {
      title: "Wholesale Distribution & Party Khata",
      badge: "Party Credit Limits & Automated Ledger Statements",
      description: "Strict credit-limit enforcement, salesman order booking, carton/pack-to-loose conversion, and 1-click WhatsApp PDF account recovery balances.",
      stat1: "Rs. 100M+",
      stat1Label: "Credit Ledger Capped",
      stat2: "1-Click",
      stat2Label: "WhatsApp Statement",
      stat3: "Auto",
      stat3Label: "Pound/Carton Conversion",
      features: ["Credit Limit Locking", "Salesman Booking App", "Supplier Purchase GRN", "Double-Entry General Ledger"],
    },
    pharma: {
      title: "Pharmacy & Healthcare Stores",
      badge: "Batch Numbers, Expiry Warnings & Generic Search",
      description: "60-day expiry warning radar, batch-wise margins, box-to-strip tablet unit conversion math, and regulated controlled substance auditing.",
      stat1: "60 Days",
      stat1Label: "Early Expiry Alert",
      stat2: "100%",
      stat2Label: "Batch Traceability",
      stat3: "Auto",
      stat3Label: "Strip/Pill Breakdown",
      features: ["Near-Expiry Radar", "Generic Formula Search", "Narcotics Register", "Distributor Bonus Scheme"],
    },
  };

  const current = verticalDetails[selectedVertical];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#FAFBFD] via-[#F4F7FC] to-[#EDF2F9] pt-8 pb-20 lg:pt-14 lg:pb-32 border-b border-slate-200/90 font-sans">
      


      {/* 🔮 Dynamic Aurora Ambient Mesh Lighting that shifts with active theme */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b ${theme.glowAura} blur-[140px] pointer-events-none transition-all duration-700`} />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-emerald-400/10 blur-[130px] pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-purple-400/10 blur-[130px] pointer-events-none" />

      {/* Modern High-Precision Micro-Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148, 163, 184, 0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.25) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-2 lg:pt-4">
        {/* 🏛️ Massive Editorial Headline Section */}
        <div className="text-center max-w-5xl mx-auto space-y-6 mb-12">
          <h1 className="text-4xl sm:text-6xl lg:text-[4.25rem] font-black text-slate-950 tracking-[-0.035em] leading-[1.04]">
            The Counter That Never Stops. <br />
            <span className={`bg-gradient-to-r ${theme.gradientTitle} bg-clip-text text-transparent transition-all duration-500`}>
              The Ledger That Never Lies.
            </span>
          </h1>

          <p className="text-lg sm:text-xl lg:text-[1.3rem] text-slate-600 font-normal leading-relaxed max-w-3xl mx-auto">
            Sub-second barcode checkout, uninterrupted 100% offline billing, automated customer khata ledgers, 
            and 1-click WhatsApp PDF statements. Purpose-built for Pakistan & the Gulf&apos;s leading businesses.
          </p>

          {/* Action CTAs & Quick Assurance */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
            <Link
              href="/register"
              className={`px-9 py-4 rounded-2xl ${theme.primaryBtn} font-black text-sm tracking-wide transition-all hover:scale-105 flex items-center gap-2.5 group cursor-pointer`}
            >
              <Zap size={18} className="text-amber-300 fill-amber-300" />
              <span>Start 14-Day Free Trial</span>
              <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
            </Link>

            <a
              href="https://wa.me/923241974677?text=Assalam-o-Alaikum%20The%20Accounts%20Cloud%20Live%20Demo%20chahiye"
              target="_blank"
              rel="noreferrer"
              className="px-8 py-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm border border-slate-300/90 shadow-sm hover:shadow-md transition-all hover:scale-105 flex items-center gap-2.5 cursor-pointer"
            >
              <MessageCircle size={18} className="text-emerald-600" />
              <span>Book WhatsApp Live Demo</span>
            </a>
          </div>
        </div>

        {/* 🚀 THE MASTERPIECE: Interactive 3D Live Cockpit Showcase */}
        <div className="relative max-w-6xl mx-auto">
          {/* Framed Glass Console Container */}
          <div className="rounded-[32px] bg-white/80 backdrop-blur-2xl border border-slate-200/90 shadow-[0_30px_90px_rgba(15,23,42,0.12)] p-4 sm:p-7 relative overflow-hidden">
            
            {/* Top Cockpit Header Bar */}
            <div className="flex items-center justify-between pb-5 mb-5 border-b border-slate-200/80 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <h3 className="text-sm font-black text-slate-950 tracking-tight flex items-center gap-2">
                    <span>{current.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${theme.badgeBg} border`}>
                      Live Terminal v4.5
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {current.badge}
                  </p>
                </div>
              </div>

              {/* Interactive Offline Simulation Toggle Switch (Proves Zero-Downtime Live!) */}
              <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 pl-2">
                  Simulate Internet:
                </span>
                <button
                  onClick={() => setIsOfflineSimulated(!isOfflineSimulated)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    isOfflineSimulated
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "bg-emerald-600 text-white shadow-sm"
                  }`}
                >
                  {isOfflineSimulated ? (
                    <>
                      <WifiOff size={13} />
                      <span>OFFLINE MODE (IndexedDB Active)</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} />
                      <span>ONLINE (Cloud Auto-Sync)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Main Stage Grid: Left Interactive Terminal / Right Realtime Live Stream */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Left Column: Photorealistic High-Definition POS & ERP Hardware Visual (7 Cols) */}
              <div className="lg:col-span-7 relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl group">
                <img
                  src="/images/vip_hero_dashboard.jpg"
                  alt="The Accounts Cloud ERP Cockpit"
                  className="w-full h-full object-cover min-h-[380px] max-h-[460px] select-none group-hover:scale-102 transition-transform duration-700"
                />

                {/* Floating Real-time Barcode Scanner Beam Indicator */}
                <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white p-3 rounded-2xl shadow-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                    <ScanLine size={16} />
                  </div>
                  <div className="text-left leading-tight">
                    <span className="text-xs font-black text-white block">
                      {scanCount.toLocaleString()} Scans Today
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      Average Speed: 0.038s
                    </span>
                  </div>
                </div>

                {/* Floating Interactive Offline Status Pill */}
                <div className="absolute bottom-4 left-4 right-4 bg-slate-950/90 backdrop-blur-xl border border-slate-800 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <div>
                      <span className="font-black text-white block">
                        {isOfflineSimulated ? "Local Vault Active (IndexedDB)" : "Zero-Downtime Guarantee"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {isOfflineSimulated 
                          ? "Internet is OFF. System continues billing locally without losing a single rupee!"
                          : "Sales queue locally on your PC/tablet & sync to the cloud instantly."}
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    100% RELIABLE
                  </span>
                </div>
              </div>

              {/* Right Column: Live Enterprise Ledger & Activity Stream (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200">
                
                {/* 3 Metric Tiles for Selected Vertical */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <div className={`text-lg font-black ${theme.statNumber}`}>{current.stat1}</div>
                    <div className="text-[10px] text-slate-500 font-bold mt-0.5">{current.stat1Label}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <div className="text-lg font-black text-emerald-600">{current.stat2}</div>
                    <div className="text-[10px] text-slate-500 font-bold mt-0.5">{current.stat2Label}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <div className="text-lg font-black text-slate-900">{current.stat3}</div>
                    <div className="text-[10px] text-slate-500 font-bold mt-0.5">{current.stat3Label}</div>
                  </div>
                </div>

                {/* Feature Chips */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Tailored Capabilities:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {current.features.map((feat, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-bold shadow-xs flex items-center gap-1.5"
                      >
                        <Check size={12} className="text-emerald-600" />
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Live Real-Time Simulated Transaction Stream */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between text-[11px] font-black text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Radio size={13} className="text-emerald-600 animate-pulse" />
                      Live Transaction Stream
                    </span>
                    <span className="text-slate-400 font-normal">Real-Time Ledger</span>
                  </div>

                  <div className="space-y-1.5">
                    {liveSales.map((sale) => (
                      <div
                        key={sale.id}
                        className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between text-xs"
                      >
                        <div className="truncate pr-2">
                          <div className="font-black text-slate-900 truncate">{sale.text}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2">
                            <span>{sale.tag}</span>
                            <span>•</span>
                            <span>{sale.time}</span>
                          </div>
                        </div>
                        <span className="font-black text-emerald-600 font-mono shrink-0">
                          +{sale.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* WhatsApp & Instant Print Action */}
                <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                  <a
                    href="https://wa.me/923241974677?text=Assalam-o-Alaikum%20The%20Accounts%20Cloud%20ka%20Live%20Demo%20chahiye"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs text-center flex items-center justify-center gap-2 shadow-md transition-all hover:scale-102"
                  >
                    <MessageCircle size={15} className="text-emerald-400" />
                    <span>Send Test Invoice to Customer WhatsApp</span>
                  </a>
                </div>

              </div>

            </div>

          </div>

          {/* 4 Bottom Highlight Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm text-center">
              <div className={`text-2xl sm:text-3xl font-black ${theme.statNumber}`}>0.04s</div>
              <div className="text-xs text-slate-500 font-bold mt-1">Barcode & POS Checkout</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm text-center">
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">Zero Loss</div>
              <div className="text-xs text-slate-500 font-bold mt-1">100% Offline Resilience</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm text-center">
              <div className="text-2xl sm:text-3xl font-black text-slate-900">20+ Verticals</div>
              <div className="text-xs text-slate-500 font-bold mt-1">Showrooms, Retail, Wholesale</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm text-center">
              <div className={`text-2xl sm:text-3xl font-black ${theme.statNumber}`}>99.99%</div>
              <div className="text-xs text-slate-500 font-bold mt-1">Cloud Uptime & Auto Backup</div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
