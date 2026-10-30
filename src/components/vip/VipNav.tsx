"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Sparkles, ShieldCheck, ArrowRight, Smartphone, Globe, 
  Menu, X, CheckCircle2, ChevronRight, MessageCircle 
} from "lucide-react";

interface VipNavProps {
  theme?: "dark" | "gold" | "light";
  activeConcept?: "titanium" | "royal" | "bento";
}

export function VipNav({ theme = "dark", activeConcept }: VipNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLight = theme === "light";
  const isGold = theme === "gold";

  const navBg = isLight 
    ? "bg-white/80 border-slate-200/80 text-slate-900"
    : isGold 
    ? "bg-[#090D14]/85 border-amber-500/20 text-white" 
    : "bg-[#070A10]/85 border-emerald-500/20 text-white";

  const badgeBg = isLight
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : isGold
    ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";

  const primaryBtn = isLight
    ? "bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/10"
    : isGold
    ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20"
    : "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black shadow-lg shadow-emerald-500/20";

  return (
    <>
      {/* Top VIP Concept Switcher Strip (For Review & Comparison) */}
      <div className="bg-slate-950 border-b border-slate-800 text-slate-300 py-1.5 px-4 text-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">VIP Homepage Studio</span>
            <span className="text-slate-500">|</span>
            <span className="hidden sm:inline text-slate-400">Select & Compare Concepts:</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <Link 
              href="/preview/vip/titanium"
              className={`px-2.5 py-0.5 rounded-full transition-all text-[11px] ${
                activeConcept === "titanium" 
                  ? "bg-emerald-500 text-slate-950 font-bold" 
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              1. Titanium Cyber (Fintech)
            </Link>
            <Link 
              href="/preview/vip/royal"
              className={`px-2.5 py-0.5 rounded-full transition-all text-[11px] ${
                activeConcept === "royal" 
                  ? "bg-amber-400 text-slate-950 font-bold" 
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              2. Royal Gold (Executive)
            </Link>
            <Link 
              href="/preview/vip/bento"
              className={`px-2.5 py-0.5 rounded-full transition-all text-[11px] ${
                activeConcept === "bento" 
                  ? "bg-cyan-400 text-slate-950 font-bold" 
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              3. Neo-Bento (Clean Pro)
            </Link>
            <Link 
              href="/preview/vip"
              className="ml-2 text-slate-400 hover:text-white underline text-[11px]"
            >
              Compare All
            </Link>
          </div>
        </div>
      </div>

      {/* Main Glass Floating Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors duration-300 ${navBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-0.5 shadow-xl shadow-emerald-500/10 group-hover:scale-105 transition-transform duration-300">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <span className="text-xl font-black bg-gradient-to-br from-white to-slate-300 bg-clip-text text-transparent">
                  A
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight tracking-wide font-sans">
                  THE ACCOUNTS
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full border ${badgeBg}`}>
                  Cloud OS
                </span>
              </div>
              <p className="text-[10px] text-slate-400 tracking-wider font-medium">
                Multi-Industry Business Operating System
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold">
            <a href="#solutions" className="hover:text-emerald-400 transition-colors">
              Industries & Showrooms
            </a>
            <a href="#pos-engine" className="hover:text-emerald-400 transition-colors">
              Hybrid Offline POS
            </a>
            <a href="#features" className="hover:text-emerald-400 transition-colors">
              Khata Ledger & Reports
            </a>
            <a href="#pricing" className="hover:text-emerald-400 transition-colors">
              Pricing & Plans
            </a>
            <a href="#trust" className="hover:text-emerald-400 transition-colors">
              Trust & Security
            </a>
          </nav>

          {/* Desktop Right CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link 
              href="/login" 
              className="text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700/60 hover:bg-slate-800/50 transition-colors"
            >
              Sign In
            </Link>

            <a
              href="https://wa.me/923241974677?text=Assalam-o-Alaikum%20The%20Accounts%20Cloud%20ka%20VIP%20Demo%20chahiye"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02]"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Demo</span>
            </a>

            <Link 
              href="/register" 
              className={`flex items-center gap-2 text-xs px-5 py-2.5 rounded-xl transition-all hover:scale-[1.02] ${primaryBtn}`}
            >
              <span>Start 14-Day Free</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 p-6 space-y-4 bg-slate-950/95 backdrop-blur-2xl">
            <div className="flex flex-col space-y-3 font-semibold text-sm">
              <a href="#solutions" onClick={() => setMobileMenuOpen(false)}>Industries & Showrooms</a>
              <a href="#pos-engine" onClick={() => setMobileMenuOpen(false)}>Hybrid Offline POS</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)}>Khata Ledger & Reports</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing & Plans</a>
            </div>
            <div className="pt-4 border-t border-slate-800 flex flex-col gap-2.5">
              <Link 
                href="/login" 
                className="w-full text-center py-2.5 rounded-xl border border-slate-700 text-xs font-bold"
              >
                Sign In
              </Link>
              <Link 
                href="/register" 
                className={`w-full text-center py-2.5 rounded-xl text-xs ${primaryBtn}`}
              >
                Start 14-Day Free Trial
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
