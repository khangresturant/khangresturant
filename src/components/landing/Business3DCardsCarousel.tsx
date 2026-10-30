"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles, CheckCircle2, Grid } from "lucide-react";
import { industries, type IndustryPack } from "@/components/landing/industries-data";

interface Props {
  isUrdu?: boolean;
}

// Custom Gradient Config for each business vertical
const bannerGradients: Record<string, { bg: string; badgeBg: string; textAccent: string }> = {
  pharmacy: { bg: "from-emerald-600 via-teal-700 to-slate-950", badgeBg: "bg-emerald-500/30 text-emerald-200 border-emerald-400/40", textAccent: "text-emerald-300" },
  restaurant: { bg: "from-rose-600 via-red-700 to-slate-950", badgeBg: "bg-rose-500/30 text-rose-200 border-rose-400/40", textAccent: "text-rose-300" },
  garments: { bg: "from-purple-600 via-indigo-700 to-slate-950", badgeBg: "bg-purple-500/30 text-purple-200 border-purple-400/40", textAccent: "text-purple-300" },
  electronics: { bg: "from-blue-600 via-indigo-800 to-slate-950", badgeBg: "bg-blue-500/30 text-blue-200 border-blue-400/40", textAccent: "text-blue-300" },
  tailor: { bg: "from-amber-600 via-orange-700 to-slate-950", badgeBg: "bg-amber-500/30 text-amber-200 border-amber-400/40", textAccent: "text-amber-300" },
  fertilizer: { bg: "from-green-600 via-emerald-800 to-slate-950", badgeBg: "bg-green-500/30 text-green-200 border-green-400/40", textAccent: "text-green-300" },
  supermarket: { bg: "from-cyan-600 via-teal-800 to-slate-950", badgeBg: "bg-cyan-500/30 text-cyan-200 border-cyan-400/40", textAccent: "text-cyan-300" },
  showroom: { bg: "from-red-600 via-rose-800 to-slate-950", badgeBg: "bg-red-500/30 text-red-200 border-red-400/40", textAccent: "text-red-300" },
  fuel: { bg: "from-orange-600 via-amber-700 to-slate-950", badgeBg: "bg-orange-500/30 text-orange-200 border-orange-400/40", textAccent: "text-orange-300" },
  hardware: { bg: "from-indigo-600 via-blue-800 to-slate-950", badgeBg: "bg-indigo-500/30 text-indigo-200 border-indigo-400/40", textAccent: "text-indigo-300" },
  cosmetics: { bg: "from-pink-500 via-rose-600 to-slate-950", badgeBg: "bg-pink-500/30 text-pink-200 border-pink-400/40", textAccent: "text-pink-300" },
  jewelry: { bg: "from-amber-500 via-yellow-600 to-slate-950", badgeBg: "bg-amber-500/30 text-amber-200 border-amber-400/40", textAccent: "text-amber-300" },
  bakery: { bg: "from-amber-700 via-orange-800 to-slate-950", badgeBg: "bg-amber-500/30 text-amber-200 border-amber-400/40", textAccent: "text-amber-300" },
  bookshop: { bg: "from-sky-600 via-blue-700 to-slate-950", badgeBg: "bg-sky-500/30 text-sky-200 border-sky-400/40", textAccent: "text-sky-300" },
  optical: { bg: "from-teal-600 via-cyan-800 to-slate-950", badgeBg: "bg-teal-500/30 text-teal-200 border-teal-400/40", textAccent: "text-teal-300" },
  footwear: { bg: "from-violet-600 via-purple-800 to-slate-950", badgeBg: "bg-violet-500/30 text-violet-200 border-violet-400/40", textAccent: "text-violet-300" },
  marquee: { bg: "from-purple-700 via-fuchsia-900 to-slate-950", badgeBg: "bg-purple-500/30 text-purple-200 border-purple-400/40", textAccent: "text-purple-300" },
  matchmaking: { bg: "from-rose-600 via-pink-700 to-slate-950", badgeBg: "bg-rose-500/30 text-rose-200 border-rose-400/40", textAccent: "text-rose-300" },
  realestate: { bg: "from-emerald-700 via-teal-900 to-slate-950", badgeBg: "bg-emerald-500/30 text-emerald-200 border-emerald-400/40", textAccent: "text-emerald-300" },
  wholesale: { bg: "from-blue-700 via-indigo-900 to-slate-950", badgeBg: "bg-blue-500/30 text-blue-200 border-blue-400/40", textAccent: "text-blue-300" },
};

export default function Business3DCardsCarousel({ isUrdu = false }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [showAllGrid, setShowAllGrid] = useState(false);

  const total = industries.length;

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  useEffect(() => {
    if (!isAutoPlay) return;
    const interval = setInterval(nextSlide, 4500);
    return () => clearInterval(interval);
  }, [isAutoPlay, currentIndex]);

  const activeItem = industries[currentIndex];

  const getIndex = (offset: number) => {
    return (currentIndex + offset + total) % total;
  };

  const leftItem = industries[getIndex(-1)];
  const rightItem = industries[getIndex(1)];
  const farLeftItem = industries[getIndex(-2)];
  const farRightItem = industries[getIndex(2)];

  return (
    <section className="py-20 bg-gradient-to-b from-amber-50/20 via-slate-50 to-indigo-50/30 relative overflow-hidden border-y border-slate-200">
      
      {/* Decorative background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-100/70 border border-indigo-200 text-indigo-700 text-xs font-bold shadow-xs">
            <Sparkles size={14} className="text-indigo-600 animate-pulse" />
            <span>{isUrdu ? "20 Specialized Business Verticals" : "20 Business Verticals Ready To Register"}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            {isUrdu ? (
              <>Tamam 20 Karobar Ke Liye <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">Alag Branded Modules</span></>
            ) : (
              <>Select & Register Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">Exact Business Module</span></>
            )}
          </h2>
          <p className="text-base text-slate-600 font-medium">
            {isUrdu
              ? "Pharmacy, Restaurant, Garments, Mobile shop, Tailor, Fertilizer se le kar Rishta Portal tak — Har business ka apna specialized branded pack."
              : "Every business module comes pre-configured with customized billing receipts, stock rules, and report formats."}
          </p>

          {/* Toggle View Mode */}
          <div className="pt-2 flex justify-center items-center gap-3">
            <button
              onClick={() => setShowAllGrid(!showAllGrid)}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Grid size={14} className="text-indigo-600" />
              <span>{showAllGrid ? (isUrdu ? "3D Showcase Dekhein" : "View 3D Carousel") : (isUrdu ? "Tamam 20 Business Cards Dekhein" : "View All 20 Businesses Grid")}</span>
            </button>
          </div>
        </div>

        {/* IF GRID VIEW ENABLED */}
        {showAllGrid ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {industries.map((ind, idx) => (
              <div
                key={ind.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  <BusinessCardBanner item={ind} index={idx} />

                  <div className="p-6">
                    <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">{ind.desc}</p>
                    <div className="space-y-1.5 mb-2">
                      {ind.features.slice(0, 3).map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0">
                  <Link
                    href={"/register?business=" + ind.id}
                    className="w-full py-2.5 bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>{isUrdu ? "Is Karobar Me Register Karein" : "Register This Business"}</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 3D COVERFLOW PERSPECTIVE CAROUSEL */
          <div className="relative pt-6 pb-12">
            <div className="flex items-center justify-center min-h-[460px] relative perspective-1000">
              
              {/* Far Left Card */}
              <div
                onClick={() => setCurrentIndex(getIndex(-2))}
                className="hidden xl:block absolute left-4 transform -rotate-y-24 scale-75 opacity-40 blur-xs transition-all duration-500 cursor-pointer z-0 max-w-xs"
              >
                <CardItem item={farLeftItem} isUrdu={isUrdu} index={getIndex(-2)} isPreview />
              </div>

              {/* Left Card */}
              <div
                onClick={prevSlide}
                className="hidden md:block absolute left-12 lg:left-24 transform -rotate-y-12 scale-85 opacity-70 hover:opacity-90 transition-all duration-500 cursor-pointer z-10 max-w-sm"
              >
                <CardItem item={leftItem} isUrdu={isUrdu} index={getIndex(-1)} isPreview />
              </div>

              {/* CENTER ACTIVE CARD */}
              <div className="relative z-30 transform scale-100 sm:scale-105 transition-all duration-500 max-w-md w-full mx-auto">
                <CardItem item={activeItem} isUrdu={isUrdu} index={currentIndex} isActive />
              </div>

              {/* Right Card */}
              <div
                onClick={nextSlide}
                className="hidden md:block absolute right-12 lg:right-24 transform rotate-y-12 scale-85 opacity-70 hover:opacity-90 transition-all duration-500 cursor-pointer z-10 max-w-sm"
              >
                <CardItem item={rightItem} isUrdu={isUrdu} index={getIndex(1)} isPreview />
              </div>

              {/* Far Right Card */}
              <div
                onClick={() => setCurrentIndex(getIndex(2))}
                className="hidden xl:block absolute right-4 transform rotate-y-24 scale-75 opacity-40 blur-xs transition-all duration-500 cursor-pointer z-0 max-w-xs"
              >
                <CardItem item={farRightItem} isUrdu={isUrdu} index={getIndex(2)} isPreview />
              </div>

            </div>

            {/* Navigation & Controls */}
            <div className="mt-8 flex items-center justify-between max-w-md mx-auto px-4">
              <button
                onClick={prevSlide}
                className="h-12 w-12 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-md flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95"
                title="Previous Business"
              >
                <ChevronLeft size={22} />
              </button>

              <div className="flex flex-col items-center gap-1.5">
                <span className="text-xs font-black text-slate-900 font-mono">
                  {currentIndex + 1} / {total}
                </span>
                <div className="flex items-center gap-1">
                  {industries.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={"h-1.5 rounded-full transition-all cursor-pointer " + (i === currentIndex ? "w-6 bg-indigo-600" : "w-1.5 bg-slate-300 hover:bg-slate-400")}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={nextSlide}
                className="h-12 w-12 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-md flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95"
                title="Next Business"
              >
                <ChevronRight size={22} />
              </button>
            </div>

          </div>
        )}

      </div>
    </section>
  );
}

// 🎨 Custom Branded Banner Header for Card (No Dashboard Screenshots!)
function BusinessCardBanner({ item, index }: { item: IndustryPack; index: number }) {
  const IconComp = item.icon;
  const styleConfig = bannerGradients[item.id] || {
    bg: "from-indigo-600 via-blue-700 to-slate-950",
    badgeBg: "bg-indigo-500/30 text-indigo-200 border-indigo-400/40",
    textAccent: "text-indigo-300"
  };

  return (
    <div className={"relative h-44 p-5 bg-gradient-to-br " + styleConfig.bg + " text-white flex flex-col justify-between overflow-hidden shadow-inner group"}>
      {/* Background Decorative Radial Blobs */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-700" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/20 rounded-full blur-xl pointer-events-none" />

      {/* Top Bar: Badge & Icon */}
      <div className="flex justify-between items-center relative z-10">
        <span className={"px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border backdrop-blur-md " + styleConfig.badgeBg}>
          Module #{index + 1}
        </span>
        <div className="h-10 w-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
          <IconComp size={22} className="text-white" />
        </div>
      </div>

      {/* Center Branded Title Text */}
      <div className="relative z-10 space-y-1">
        <p className={"text-[10px] font-bold uppercase tracking-widest font-mono " + styleConfig.textAccent}>
          The Accounts ERP Pack
        </p>
        <h3 className="text-lg sm:text-xl font-black tracking-tight text-white leading-tight drop-shadow-sm">
          {item.title}
        </h3>
      </div>
    </div>
  );
}

// Single Card Item Container
function CardItem({ item, isUrdu, index, isActive = false, isPreview = false }: { item: IndustryPack; isUrdu: boolean; index: number; isActive?: boolean; isPreview?: boolean }) {
  return (
    <div
      className={"bg-white rounded-3xl border transition-all duration-500 overflow-hidden flex flex-col justify-between " + (
        isActive
          ? "border-2 border-indigo-500 shadow-2xl shadow-indigo-500/20 bg-gradient-to-b from-white via-white to-slate-50"
          : "border-slate-200 shadow-lg bg-white/95 hover:border-slate-300"
      )}
    >
      <div>
        {/* Custom Branded Gradient Banner Header */}
        <BusinessCardBanner item={item} index={index} />

        <div className="p-6">
          {/* Subtitle description */}
          <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4 min-h-[36px]">
            {item.desc}
          </p>

          {/* Key Feature Chips */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {item.features.map((feat, idx) => (
              <div key={idx} className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-700">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span className="truncate">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="p-6 pt-0">
        <Link
          href={"/register?business=" + item.id}
          className={"w-full py-3.5 rounded-2xl font-black text-xs text-center transition-all flex items-center justify-center gap-2 " + (
            isActive
              ? "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-600/25"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          )}
        >
          <span>{isUrdu ? "Is Karobar Me Register Karein" : "Register This Business"}</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
