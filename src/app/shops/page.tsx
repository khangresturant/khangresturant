'use client';

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Store, 
  Search, 
  MapPin, 
  Phone, 
  Sparkles, 
  Building2, 
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  ShoppingBag
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ShopItem {
  id: string;
  name: string;
  industry_type: string;
  store_slug?: string | null;
  store_banner_url?: string | null;
  store_tagline?: string | null;
  store_theme_color?: string | null;
  delivery_charges?: number | null;
  phone?: string | null;
  address?: string | null;
}

const INDUSTRY_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  general: { label: "General Store", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  pharmacy: { label: "Pharmacy & Medical", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  garments: { label: "Fashion & Apparel", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  electronics: { label: "Electronics & Mobiles", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  hardware: { label: "Hardware & Tools", bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
  crockery: { label: "Crockery & Home", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  restaurant: { label: "Restaurant & Food", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  tailor: { label: "Boutique & Tailor", bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" },
  fertilizer: { label: "Agri & Fertilizer", bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
};

export default function PublicShopsDirectoryPage() {
  const supabase = createClient();
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("all");

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shops")
        .select("id, name, industry_type, store_slug, store_banner_url, store_tagline, store_theme_color, delivery_charges, phone, address")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setShops(data);
      }
    } catch (err) {
      console.error("Error fetching marketplace shops:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredShops = shops.filter((shop) => {
    const matchesSearch =
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (shop.address && shop.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (shop.store_tagline && shop.store_tagline.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesIndustry = selectedIndustry === "all" || shop.industry_type === selectedIndustry;

    return matchesSearch && matchesIndustry;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-600 selection:text-white">
      {/* Header Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-slate-200/80 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                The Accounts Marketplace
                <span className="text-[10px] uppercase font-extrabold tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Verified Stores
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">Discover & Shop directly from verified local businesses</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2 rounded-xl transition-colors"
            >
              Merchant Login
            </Link>
            <Link
              href="/register"
              className="text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20"
            >
              Create Shop
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner Section */}
      <section className="relative overflow-hidden pt-12 pb-10 px-6 bg-gradient-to-b from-white via-slate-50 to-slate-100 border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-sm">
            <Sparkles size={14} /> Direct Online Shopping Platform
          </div>
          
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Explore <span className="text-emerald-600">Verified Stores</span> Near You
          </h2>
          
          <p className="text-sm text-slate-600 max-w-2xl mx-auto font-medium">
            Order directly from authorized pharmacies, retail outlets, clothing boutiques, electronics centers, and supermarkets powered by The Accounts ERP.
          </p>

          {/* Search & Filter Bar */}
          <div className="pt-4 max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                suppressHydrationWarning
                type="text"
                placeholder="Search shop by name, city, or area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 rounded-2xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm"
              />
            </div>

            <select
              suppressHydrationWarning
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="px-4 py-3 bg-white border border-slate-300 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer shadow-sm"
            >
              <option value="all">All Industries</option>
              <option value="pharmacy">Pharmacy & Medical</option>
              <option value="general">General Stores</option>
              <option value="garments">Fashion & Apparel</option>
              <option value="electronics">Electronics & Mobiles</option>
              <option value="hardware">Hardware & Tools</option>
              <option value="crockery">Crockery & Home</option>
              <option value="restaurant">Restaurants & Food</option>
              <option value="tailor">Tailors & Boutiques</option>
              <option value="fertilizer">Agri & Fertilizers</option>
            </select>
          </div>
        </div>
      </section>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-white rounded-3xl border border-slate-200 animate-pulse p-6 shadow-sm" />
            ))}
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 max-w-md mx-auto shadow-sm">
            <Store size={48} className="mx-auto text-slate-400 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Stores Found</h3>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or industry filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredShops.map((shop) => {
              const badge = INDUSTRY_BADGES[shop.industry_type] || INDUSTRY_BADGES.general;
              const storeUrl = `/store/${shop.store_slug || shop.id}`;

              return (
                <div
                  key={shop.id}
                  className="group relative bg-white border border-slate-200/90 hover:border-emerald-500/50 rounded-3xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    {/* Store Card Header / Banner */}
                    <div className="h-28 bg-gradient-to-r from-slate-100 to-slate-200 relative overflow-hidden flex items-center justify-center border-b border-slate-100">
                      {shop.store_banner_url ? (
                        <img
                          src={shop.store_banner_url}
                          alt={shop.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400 font-extrabold text-sm uppercase tracking-widest">
                          <Store size={22} className="text-slate-400" /> {shop.name}
                        </div>
                      )}
                      
                      <span className={`absolute top-3 left-3 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border shadow-sm ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Store Info */}
                    <div className="p-6 space-y-3">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-600 transition-colors flex items-center gap-1.5">
                          {shop.name}
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        </h3>
                        <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
                          {shop.store_tagline || "Verified merchant on The Accounts ERP platform"}
                        </p>
                      </div>

                      {shop.address && (
                        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                          <MapPin size={14} className="text-slate-400 shrink-0" />
                          <span className="line-clamp-1">{shop.address}</span>
                        </div>
                      )}

                      {shop.phone && (
                        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                          <Phone size={14} className="text-slate-400 shrink-0" />
                          <span>{shop.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer / Visit Action */}
                  <div className="px-6 pb-6 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-[11px] font-bold text-slate-500">
                      Delivery: <span className="text-emerald-600 font-extrabold">{shop.delivery_charges && shop.delivery_charges > 0 ? `Rs ${shop.delivery_charges}` : "Free"}</span>
                    </div>

                    <Link
                      href={storeUrl}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-black transition-all group/btn border border-emerald-200 hover:border-emerald-600 shadow-sm"
                    >
                      Visit Store <ArrowRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
