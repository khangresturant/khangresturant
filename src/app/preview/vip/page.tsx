"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Sparkles, ArrowRight, ShieldCheck, Zap, Layers, 
  Smartphone, Award, CheckCircle2, TrendingUp, Monitor,
  Star, ExternalLink, RefreshCw, Cpu, Store, DollarSign
} from "lucide-react";
import { VipNav } from "@/components/vip/VipNav";

const CONCEPTS = [
  {
    id: "titanium",
    number: "01",
    title: "Concept 1 — Titanium Cyber-Fintech VIP",
    tagline: "Stripe & Linear Aesthetic — Futuristic Dark Glassmorphism",
    description: "Deep obsidian backdrop with neon aurora emerald and electric cyan lighting. Floating 3D holographic live dashboard, real-time sales stream ticker, micro-animations, and cutting-edge silicon-valley ERP aesthetic.",
    badge: "Recommended for Tech-Forward Businesses & Scaling Enterprises",
    image: "/images/vip_hero_dashboard.jpg",
    accent: "from-emerald-500 via-teal-500 to-cyan-500",
    borderAccent: "border-emerald-500/40",
    buttonBg: "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950",
    tags: ["Dark Mode Glass", "Holographic 3D HUD", "Real-Time Profit Stream", "Fintech Neon"],
    href: "/preview/vip/titanium"
  },
  {
    id: "royal",
    number: "02",
    title: "Concept 2 — Royal Gold Executive VIP",
    tagline: "High-Net-Worth Luxury & Executive Authority (Rolex / Gulf Style)",
    description: "Deep imperial velvet navy paired with burnished gold & champagne accents. Geared towards high-growth showroom owners, wholesale tycoons, and multi-branch retail empires in Pakistan and the Gulf.",
    badge: "Maximum Prestige, Trust & High-Ticket Commercial Authority",
    image: "/images/vip_retail_pos.jpg",
    accent: "from-amber-400 via-amber-500 to-yellow-600",
    borderAccent: "border-amber-500/40",
    buttonBg: "bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950",
    tags: ["Imperial Gold Palette", "Luxury Retail Counter", "Bilingual Urdu First", "Showroom Authority"],
    href: "/preview/vip/royal"
  },
  {
    id: "bento",
    number: "03",
    title: "Concept 3 — Neo-Minimalist Bento Pro VIP",
    tagline: "Apple Pro & Arc Browser Aesthetic — Ultra-Clean Interactive Bento",
    description: "Pristine white-smoke and frosted acrylic with crisp high-contrast obsidian typography. Features an interactive live POS counter simulator where visitors can ring up mock sales and print digital thermal receipts!",
    badge: "Ultra-Clean, Instant-Loading & 100% Interactive Experience",
    image: "/images/pos_terminal_3d.png",
    accent: "from-cyan-500 via-blue-500 to-indigo-500",
    borderAccent: "border-cyan-500/40",
    buttonBg: "bg-slate-900 hover:bg-slate-800 text-white",
    tags: ["Interactive POS Widget", "Apple Pro Crisp Light", "Bento Grid Layout", "Live Receipt Printer"],
    href: "/preview/vip/bento"
  }
];

export default function VipShowcaseHub() {
  return (
    <div className="min-h-screen bg-[#070A10] text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      <VipNav theme="dark" />

      {/* Hero Presentation */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-emerald-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-6">
            <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Senior Frontend Design Studio • Next-Gen Concepts</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight mb-6">
            The Accounts Cloud <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              VIP Homepage Concepts
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-8">
            ہم نے عام اور پرانے ہوم پیج کے مقابلے میں **3 عالمی معیار کے VIP ڈیزائن** تیار کیے ہیں۔ 
            ہر ڈیزائن کو مکمل اوپن کر کے دیکھیں، اینیمیشنز اور فیچرز کا جائزہ لیں، اور جو ڈیزائن آپ کو سب سے بہترین لگے وہ منتخب کریں۔
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 100% Offline Preview
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> High-Performance Mobile Responsive
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Bilingual Urdu & English Support
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Interactive POS & Ledger Demonstrations
            </span>
          </div>
        </div>
      </section>

      {/* Cards Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {CONCEPTS.map((concept) => (
            <article 
              key={concept.id}
              className={`bg-slate-900/60 rounded-3xl border border-slate-800 hover:${concept.borderAccent} transition-all duration-300 flex flex-col overflow-hidden shadow-2xl group hover:-translate-y-1.5`}
            >
              {/* Image Preview Header */}
              <div className="relative h-60 w-full bg-slate-950 overflow-hidden">
                <Image
                  src={concept.image}
                  alt={concept.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent" />
                
                {/* Number Badge */}
                <div className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-700/60 flex items-center justify-center font-black text-sm text-white">
                  {concept.number}
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest block mb-0.5">
                    {concept.tagline}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                <div>
                  <h2 className="text-xl font-black text-white mb-2 group-hover:text-emerald-300 transition-colors">
                    {concept.title}
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {concept.description}
                  </p>

                  <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-[11px] text-slate-400 font-medium mb-4">
                    <strong className="text-emerald-400 block mb-0.5">بنیادی خاصیت:</strong>
                    {concept.badge}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {concept.tags.map((tag, i) => (
                      <span 
                        key={i}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-slate-800/60 text-slate-300 border border-slate-700/40"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Launch Action */}
                <Link
                  href={concept.href}
                  className={`w-full py-3.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${concept.buttonBg}`}
                >
                  <span>مکمل VIP پیج اوپن کریں</span>
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* Feature Comparison Table */}
        <div className="mt-20 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h3 className="text-2xl font-black text-white mb-2">
              تینوں ڈیزائنز کا تکنیکی موازنہ (Comparison Matrix)
            </h3>
            <p className="text-xs text-slate-400">
              ہر ڈیزائن ایک مخصوص بزنس مائنڈسیٹ اور ٹارگٹ آڈینس کے لیے تیار کیا گیا ہے۔
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-4 px-4">پیمانہ / پہلو (Metric)</th>
                  <th className="py-4 px-4 text-emerald-400">Concept 1: Titanium Cyber</th>
                  <th className="py-4 px-4 text-amber-400">Concept 2: Royal Executive</th>
                  <th className="py-4 px-4 text-cyan-400">Concept 3: Neo-Bento Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr>
                  <td className="py-3.5 px-4 font-bold text-white">Visual Vibe & Aesthetic</td>
                  <td className="py-3.5 px-4">Stripe / Linear Cyber-Fintech</td>
                  <td className="py-3.5 px-4">Rolex / High-Net-Worth Prestige</td>
                  <td className="py-3.5 px-4">Apple Pro Clean Minimalist</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-white">Hero Component</td>
                  <td className="py-3.5 px-4">3D Curved Glass Floating Cockpit</td>
                  <td className="py-3.5 px-4">Luxury Retail POS & Showroom Scene</td>
                  <td className="py-3.5 px-4">Live Interactive POS Simulator (Click to Ring Up Bill)</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-white">Target Psychology</td>
                  <td className="py-3.5 px-4">Tech-savvy, Next-Gen SaaS, AI-driven</td>
                  <td className="py-3.5 px-4">Traditional Tycoons, Showrooms, Wholesale</td>
                  <td className="py-3.5 px-4">Speed-focused retail, Modern Dukaandar, Global</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-white">Theme Background</td>
                  <td className="py-3.5 px-4">Obsidian Carbon Black + Emerald Glow</td>
                  <td className="py-3.5 px-4">Midnight Navy + Burnished Gold Glow</td>
                  <td className="py-3.5 px-4">Pure Snow & Frosted Acrylic Glass</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-bold text-white">Bilingual Adaptability</td>
                  <td className="py-3.5 px-4">English First with Urdu Microcopy</td>
                  <td className="py-3.5 px-4">Bilingual Side-by-Side (اردو + English)</td>
                  <td className="py-3.5 px-4">Instant 1-Click Language Switcher</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
