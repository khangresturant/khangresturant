"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Pill, Utensils, ShoppingBag, Smartphone, Tractor, 
  Shirt, Scissors, Wrench, Car, Cake, Download, ShieldCheck, 
  CheckCircle2, Sparkles, Monitor, Key, Zap, ArrowRight, Filter
} from 'lucide-react';
import { SOFTWARE_PRODUCTS, SoftwareProduct } from '@/lib/software-catalog';

const ICON_MAP: Record<string, React.ReactNode> = {
  Pill: <Pill className="w-6 h-6 text-emerald-400" />,
  Utensils: <Utensils className="w-6 h-6 text-amber-400" />,
  ShoppingBag: <ShoppingBag className="w-6 h-6 text-blue-400" />,
  Smartphone: <Smartphone className="w-6 h-6 text-purple-400" />,
  Tractor: <Tractor className="w-6 h-6 text-green-400" />,
  Shirt: <Shirt className="w-6 h-6 text-pink-400" />,
  Scissors: <Scissors className="w-6 h-6 text-indigo-400" />,
  Wrench: <Wrench className="w-6 h-6 text-yellow-400" />,
  Car: <Car className="w-6 h-6 text-red-400" />,
  Cake: <Cake className="w-6 h-6 text-rose-400" />,
};

export default function SoftwareMarketplacePage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSoftware, setSelectedSoftware] = useState<SoftwareProduct | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);

  const categories = ['All', 'Pharmacy', 'Restaurant', 'Retail & POS', 'Specialized ERP', 'Services'];

  const filteredProducts = selectedCategory === 'All' 
    ? SOFTWARE_PRODUCTS 
    : SOFTWARE_PRODUCTS.filter(p => p.category === selectedCategory);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Background Decorative Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-12">
        
        {/* Header Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            <span>Lifetime One-Time Purchase Desktop Softwares</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            The Accounts Desktop Software Suite
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl">
            Download full-fledged desktop ERP & POS applications. Pay once, use forever with zero monthly subscription fees!
          </p>
        </div>

        {/* Highlights Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {[
            { icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />, title: '100% Lifetime License', desc: 'No Recurring Monthly Fees' },
            { icon: <Key className="w-5 h-5 text-blue-400" />, title: 'Instant License Key', desc: 'Hardware Locked & Secure' },
            { icon: <Monitor className="w-5 h-5 text-purple-400" />, title: 'Offline Desktop ERP', desc: 'Works Without Internet' },
            { icon: <Zap className="w-5 h-5 text-amber-400" />, title: 'Free 15-Day Trial', desc: 'Download & Test Instantly' },
          ].map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm flex flex-col items-center text-center space-y-1">
              <div className="p-2 rounded-lg bg-slate-800/80 mb-1">{item.icon}</div>
              <span className="text-sm font-semibold text-slate-200">{item.title}</span>
              <span className="text-xs text-slate-400">{item.desc}</span>
            </div>
          ))}
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Software Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => (
            <div 
              key={product.id}
              className="group relative rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-emerald-500/40 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 flex flex-col justify-between overflow-hidden backdrop-blur-sm"
            >
              {/* Badge */}
              {product.badge && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {product.badge}
                  </span>
                </div>
              )}

              <div className="p-6 space-y-5">
                {/* Header Icon + Title */}
                <div className="flex items-start gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/60 group-hover:scale-110 transition-transform duration-300">
                    {ICON_MAP[product.iconName] || <ShoppingBag className="w-6 h-6 text-emerald-400" />}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">{product.category}</span>
                    <h3 className="text-xl font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{product.version} � {product.fileSize}</p>
                  </div>
                </div>

                <p className="text-sm text-slate-300 line-clamp-2 leading-relaxed">
                  {product.tagline}
                </p>

                {/* Features List (First 4) */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  {product.features.slice(0, 4).map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer: Pricing & Action Buttons */}
              <div className="p-6 pt-4 bg-slate-900/90 border-t border-slate-800/60 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-slate-100">
                      Rs. {product.pricePKR.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-xs text-emerald-400 font-medium">One-Time Lifetime</span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={product.downloadUrl}
                    download
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Download Free Trial Setup"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => {
                      setSelectedSoftware(product);
                      setShowCheckoutModal(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all duration-200 flex items-center gap-1.5"
                  >
                    <span>Buy License</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Purchase Modal */}
      {showCheckoutModal && selectedSoftware && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-emerald-400 font-semibold uppercase">{selectedSoftware.category}</span>
                <h3 className="text-xl font-bold text-slate-100">{selectedSoftware.name}</h3>
                <p className="text-xs text-slate-400">One-Time Lifetime License Purchase</p>
              </div>
              <button 
                onClick={() => setShowCheckoutModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
              >
                ?
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Software Price:</span>
                <span className="font-bold text-slate-100">Rs. {selectedSoftware.pricePKR.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">License Validity:</span>
                <span className="text-emerald-400 font-semibold">Lifetime (Unlimited Use)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Updates & Support:</span>
                <span className="text-slate-200">1 Year Free Updates</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300">Select Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href={`/checkout?software=${selectedSoftware.slug}&method=bank`}
                  className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-center text-xs font-bold text-slate-200 transition-colors"
                >
                  Bank Transfer / EasyPaisa
                </Link>
                <Link
                  href={`/checkout?software=${selectedSoftware.slug}&method=card`}
                  className="p-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-center text-xs font-bold text-emerald-300 transition-colors"
                >
                  Instant Online Payment
                </Link>
              </div>
            </div>

            <div className="text-center pt-2">
              <a
                href={selectedSoftware.downloadUrl}
                download
                className="text-xs text-slate-400 hover:text-emerald-400 underline"
              >
                Download Free Trial Setup (.exe) First
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
