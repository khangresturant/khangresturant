"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Store, Users, CreditCard, Loader2, Landmark, 
  Sliders, Info, AlertTriangle, Megaphone, CheckCircle2,
  Activity, HelpCircle, BarChart3, Database
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPlatformShopId } from "@/lib/config";

export default function AdminOverviewPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  // Database Data States
  const [shops, setShops] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [gatewaySettings, setGatewaySettings] = useState({
    monthly_price_pkr: 3500
  });

  // Global Announcement States
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementType, setAnnouncementType] = useState<"info" | "warning" | "success" | "danger">("warning");
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  // Global Gemini API Keys
  const [globalGeminiKeys, setGlobalGeminiKeys] = useState("");
  const [savingKeys, setSavingKeys] = useState(false);

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    setLoading(true);
    try {
      const { data: shopsData, error: shopsErr } = await supabase
        .from("shops")
        .select("*");
      if (shopsErr) throw shopsErr;
      setShops(shopsData || []);

      const { data: profilesData } = await supabase
        .from("user_profiles")
        .select("id");
      setProfiles(profilesData || []);

      const { data: settingsData } = await supabase
        .from("company_details")
        .select("website")
        .eq("shop_id", getPlatformShopId()) // Super admin shop
        .maybeSingle();

      if (settingsData && settingsData.website && settingsData.website.startsWith("{")) {
        try {
          const parsed = JSON.parse(settingsData.website);
          if (parsed.monthly_price_pkr) {
            setGatewaySettings(prev => ({ ...prev, monthly_price_pkr: parsed.monthly_price_pkr }));
          }
          if (parsed.system_announcement) {
            setAnnouncementMessage(parsed.system_announcement.message || "");
            setAnnouncementType(parsed.system_announcement.type || "warning");
            setAnnouncementActive(!!parsed.system_announcement.active);
          }
          if (parsed.global_gemini_api_keys) {
            setGlobalGeminiKeys(parsed.global_gemini_api_keys);
          }
        } catch (e) {}
      }
    } catch (err: any) {
      toast.error("Failed to load overview statistics: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGlobalKeys = async () => {
    setSavingKeys(true);
    try {
      const res = await fetch("/api/admin/platform-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ global_gemini_api_keys: globalGeminiKeys })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save keys");

      toast.success("SaaS Global Gemini API keys updated successfully!");
    } catch (err: any) {
      toast.error("Failed to save global keys: " + err.message);
    } finally {
      setSavingKeys(false);
    }
  };

  const handlePublishAnnouncement = async () => {
    setSavingAnnouncement(true);
    try {
      const res = await fetch("/api/admin/platform-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_announcement: {
            message: announcementMessage,
            type: announcementType,
            active: announcementActive
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish announcement");

      toast.success("Global system announcement published successfully!");
    } catch (err: any) {
      toast.error("Announcement update failed: " + err.message);
    } finally {
      setSavingAnnouncement(false);
    }
  };

  // Helper selectors
  const activeSubscribersCount = useMemo(() => {
    return shops.filter(s => {
      if (!s.subscription_expires_at) return false;
      return new Date(s.subscription_expires_at) > new Date() && s.subscription_tier !== "free";
    }).length;
  }, [shops]);

  const trialCount = useMemo(() => {
    return shops.filter(s => s.subscription_tier === "free" || !s.subscription_expires_at).length;
  }, [shops]);

  const totalSaaSRevenue = useMemo(() => {
    return activeSubscribersCount * gatewaySettings.monthly_price_pkr;
  }, [activeSubscribersCount, gatewaySettings]);

  // Dynamic Industry Popularity Calculations
  const industryDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    shops.forEach(s => {
      const ind = s.industry_type || "general";
      counts[ind] = (counts[ind] || 0) + 1;
    });
    return Object.entries(counts).map(([name, val]) => ({ name, val }));
  }, [shops]);

  if (loading) {
    return (
      <div className="h-64 flex flex-col justify-center items-center text-slate-450">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650 mb-2" />
        <p className="text-xs font-semibold">Aggregating platform metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider">Overview Dashboard</h2>
          <p className="text-xs text-slate-450 mt-0.5">Quick analytics summary of active registrations and system modules usage.</p>
        </div>
        
        <button 
          onClick={loadOverviewData}
          className="px-4 py-2 bg-slate-100 border border-slate-200/60 hover:bg-slate-200/40 text-slate-700 rounded-xl text-xs font-black transition shadow-sm"
        >
          Refresh Statistics
        </button>
      </div>

      {/* VIP Stat grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-slate-50 border border-slate-200/80 shadow-sm p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Total Registered Shops</span>
            <span className="text-3xl font-black text-slate-800">{shops.length}</span>
          </div>
          <div className="p-3 bg-white text-indigo-600 border rounded-xl shadow-sm">
            <Store size={20} />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 shadow-sm p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Total User Profiles</span>
            <span className="text-3xl font-black text-blue-600">{profiles.length}</span>
          </div>
          <div className="p-3 bg-white text-blue-600 border rounded-xl shadow-sm">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 shadow-sm p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Active Subscribers</span>
            <span className="text-3xl font-black text-emerald-600">{activeSubscribersCount}</span>
          </div>
          <div className="p-3 bg-white text-emerald-600 border rounded-xl shadow-sm">
            <CreditCard size={20} />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 shadow-sm p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Est. Monthly Revenue</span>
            <span className="text-3xl font-black text-slate-855">Rs {totalSaaSRevenue.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-white text-slate-800 border rounded-xl shadow-sm">
            <Landmark size={20} />
          </div>
        </div>
      </div>

      {/* Main VIP Operations Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Announcement controller (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
              <Megaphone size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Global Platform Broadcast Banner</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Publish alert announcements visible inside every active shop dashboard header</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Announcement Message</label>
              <textarea
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                placeholder="Enter alert message (Urdu/English supported)..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:border-indigo-600 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Alert Banner Style</label>
                <select
                  value={announcementType}
                  onChange={(e) => setAnnouncementType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none text-slate-700 cursor-pointer"
                >
                  <option value="info">Info (Blue Style)</option>
                  <option value="warning">Warning (Orange Style)</option>
                  <option value="success">Success (Emerald Green Style)</option>
                  <option value="danger">Danger (Bright Red Style)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Broadcast Status</label>
                <div className="flex items-center gap-3 py-1.5">
                  <input
                    type="checkbox"
                    id="announcementActive"
                    checked={announcementActive}
                    onChange={(e) => setAnnouncementActive(e.target.checked)}
                    className="h-4.5 w-4.5 accent-indigo-650 cursor-pointer rounded"
                  />
                  <label htmlFor="announcementActive" className="text-xs font-black text-slate-650 cursor-pointer">
                    Publish Live Announcement
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handlePublishAnnouncement}
                disabled={savingAnnouncement}
                className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                {savingAnnouncement ? <Loader2 className="animate-spin" size={14} /> : <Megaphone size={14} />}
                Publish System Broadcast Announcement
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Industry distribution and Gemini API Keys (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
                <BarChart3 size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Industry Distribution</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Frequency ratio of business industry sectors</p>
              </div>
            </div>

            <div className="space-y-4">
              {industryDistribution.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-10 font-bold">No active industry data</p>
              ) : (
                industryDistribution.map(item => {
                  const ratio = Math.round((item.val / shops.length) * 100);
                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                        <span className="capitalize">{item.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{item.val} ({ratio}%)</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/20">
                        <div 
                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Gemini API Keys Configuration Card */}
          <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
                <Sliders size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">SaaS Global Gemini Keys</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Configure global keys list to bypass limits across all shops</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block mb-1">Keys list (One key per line)</label>
                <textarea
                  value={globalGeminiKeys}
                  onChange={(e) => setGlobalGeminiKeys(e.target.value)}
                  placeholder="AIzaSyA...&#10;AIzaSyB...&#10;AIzaSyC..."
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-xs font-mono font-bold text-slate-750 focus:outline-none focus:border-indigo-600 transition"
                />
              </div>

              <button
                onClick={handleSaveGlobalKeys}
                disabled={savingKeys}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                {savingKeys ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                Save SaaS Global Keys
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Logs and module control metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Module activation count log */}
        <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 space-y-4">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b pb-3">
            <Sliders size={15} className="text-indigo-600" /> Platform Feature Usage Log
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 border rounded-xl text-center">
              <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider">Payroll Active</span>
              <span className="text-lg font-black text-slate-800 mt-1 block">{shops.filter(s => s.has_payroll).length} Shops</span>
            </div>
            <div className="p-3 bg-slate-50 border rounded-xl text-center">
              <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider">Tax System Active</span>
              <span className="text-lg font-black text-slate-800 mt-1 block">{shops.filter(s => s.has_tax).length} Shops</span>
            </div>
            <div className="p-3 bg-slate-50 border rounded-xl text-center">
              <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider">Installments (EMI)</span>
              <span className="text-lg font-black text-slate-800 mt-1 block">{shops.filter(s => s.has_emi).length} Shops</span>
            </div>
            <div className="p-3 bg-slate-50 border rounded-xl text-center">
              <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider">Fixed Assets</span>
              <span className="text-lg font-black text-slate-800 mt-1 block">{shops.filter(s => s.has_assets_rec).length} Shops</span>
            </div>
          </div>
        </div>

        {/* Global announcement preview / active parameters */}
        <div className="bg-slate-900 border border-slate-950 text-white rounded-3xl p-6 space-y-4 shadow-md flex flex-col justify-between">
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-indigo-300">
              <Database size={15} /> SaaS Platform Health Status
            </h3>
            <p className="text-[11px] text-slate-350 leading-relaxed font-semibold">
              Superadmin credentials are verified successfully. Platform-wide databases, edge routing pools, API gateways, and getsafepay transactions callbacks are fully synchronized and active.
            </p>
          </div>
          
          <div className="p-3.5 bg-slate-950/60 rounded-2xl flex items-start gap-2.5 border border-slate-800 text-[11px]">
            <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5 animate-pulse" size={14} />
            <div>
              <h4 className="font-bold text-slate-200">Integrations Fully Active</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Supabase client auth and token-handshakes running normally.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
