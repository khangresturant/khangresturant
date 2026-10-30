"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Loader2, TrendingUp, Users, Sparkles, CreditCard, Clock, Calendar, CheckCircle, ArrowRight, DollarSign, Gift, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function AdminReferralsPage() {
  const supabase = createClient();
  
  // Data States
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [referralTransactions, setReferralTransactions] = useState<any[]>([]);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch shops with referral details
      const { data: shopsData, error: shopsErr } = await supabase
        .from("shops")
        .select("id, name, subscription_tier, subscription_expires_at, created_at, referral_credits, referred_by_shop_id")
        .order("created_at", { ascending: false });
      if (shopsErr) throw shopsErr;
      setShops(shopsData || []);

      // 2. Fetch all payment submissions
      const { data: subsData, error: subsErr } = await supabase
        .from("payment_submissions")
        .select("*, shops(name)")
        .order("submitted_at", { ascending: false });
      if (subsErr) throw subsErr;
      setSubmissions(subsData || []);

      // 3. Fetch referral transactions log
      const { data: refTxData, error: refTxErr } = await supabase
        .from("referral_transactions")
        .select("*, shops:shop_id(name), referred_shops:referred_shop_id(name)")
        .order("created_at", { ascending: false });
      if (refTxErr) throw refTxErr;
      setReferralTransactions(refTxData || []);

    } catch (err: any) {
      toast.error("Failed to load admin referrals data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Calculations for reports ---
  const stats = useMemo(() => {
    const now = new Date();
    const activeShops = shops.filter(s => s.subscription_expires_at && new Date(s.subscription_expires_at) > now);
    
    const countActive = activeShops.length;
    const countStarter = activeShops.filter(s => s.subscription_tier === "starter").length;
    const countPremium = activeShops.filter(s => s.subscription_tier === "premium").length;
    const countFree = shops.length - countActive; // Free trial or expired

    // Platform total earnings (only count approved payments)
    const approvedSubmissions = submissions.filter(s => s.status === "approved");
    const totalEarnings = approvedSubmissions.reduce((sum, s) => sum + Number(s.amount || 0), 0);

    // Sum of credits applied/discounted
    const totalCreditsApplied = approvedSubmissions.reduce((sum, s) => sum + Number(s.credits_applied || 0), 0);

    // Sum of rewarded credits paid out
    const totalCreditsRewarded = referralTransactions
      .filter(tx => tx.type === "reward")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    return {
      countActive,
      countStarter,
      countPremium,
      countFree,
      totalEarnings,
      totalCreditsApplied,
      totalCreditsRewarded,
      totalShops: shops.length
    };
  }, [shops, submissions, referralTransactions]);

  // Map of shop ID -> Name for lookup
  const shopNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    shops.forEach(s => {
      map[s.id] = s.name;
    });
    return map;
  }, [shops]);

  // List of actual referrals for the tree display
  const referralTree = useMemo(() => {
    return shops
      .filter(s => s.referred_by_shop_id)
      .map(s => ({
        id: s.id,
        referredShopName: s.name,
        referredTier: s.subscription_tier,
        referredExpires: s.subscription_expires_at,
        referredCreatedAt: s.created_at,
        referrerShopName: shopNameMap[s.referred_by_shop_id] || "Unknown Shop",
        referrerShopId: s.referred_by_shop_id
      }));
  }, [shops, shopNameMap]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-450">
        <Loader2 className="animate-spin text-indigo-650 h-8 w-8 mb-2" />
        <p className="text-xs font-semibold">Generating SaaS statistics & referral reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Overview stats layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Platform Earnings */}
        <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-sm border border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total SaaS Revenue</span>
            <DollarSign className="text-emerald-400" size={16} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-emerald-400">Rs {stats.totalEarnings.toLocaleString()}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Excludes Rs {stats.totalCreditsApplied.toLocaleString()} applied credits discount</p>
          </div>
        </div>

        {/* Active Subscriptions Counter */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Active Subscriptions</span>
            <TrendingUp className="text-indigo-600" size={16} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#1e3a5f]">{stats.countActive} <span className="text-xs font-semibold text-slate-400">/ {stats.totalShops} shops</span></h3>
            <p className="text-[10px] text-slate-500 mt-1">
              <strong className="text-indigo-600">{stats.countPremium}</strong> Premium • <strong className="text-indigo-600">{stats.countStarter}</strong> Starter
            </p>
          </div>
        </div>

        {/* Free / Expired Tier */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Free / Expired Shops</span>
            <Users className="text-amber-600" size={16} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800">{stats.countFree}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Trial expired or default free tier accounts</p>
          </div>
        </div>

        {/* Total Credits Rewarded */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-455 uppercase tracking-wider block">MLM Referrals Payout</span>
            <Gift className="text-purple-600" size={16} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-purple-700">Rs {stats.totalCreditsRewarded.toLocaleString()}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Credits rewarded to referrers</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Referral Tree & Connections */}
        <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 lg:col-span-2 space-y-4 flex flex-col">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Referrals & Connections Registry</h3>
            <p className="text-xs text-slate-450 mt-0.5 font-semibold">Invite tree mapping referrers to their referred child businesses.</p>
          </div>

          <div className="border border-slate-100 rounded-2xl overflow-hidden flex-1 min-h-[350px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-xs min-w-[500px]">
              <thead className="bg-slate-50 font-bold border-b text-slate-400 uppercase text-[9px] tracking-wider sticky top-0">
                <tr>
                  <th className="py-2.5 px-4">Referrer Business</th>
                  <th className="py-2.5 px-4">Referred Child Business</th>
                  <th className="py-2.5 px-4">Current Plan</th>
                  <th className="py-2.5 px-4">Registration Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                {referralTree.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 font-bold">
                      No referral invites mapped in database.
                    </td>
                  </tr>
                ) : (
                  referralTree.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-black text-indigo-700">{row.referrerShopName}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{row.referredShopName}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                          row.referredTier === "premium" ? "bg-emerald-50 text-emerald-700 border border-emerald-150" :
                          row.referredTier === "starter" ? "bg-indigo-50 text-indigo-700 border border-indigo-150" :
                          "bg-slate-100 text-slate-500"
                        }`}>
                          {row.referredTier || "free"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-450 font-mono text-[10px]">
                        {new Date(row.referredCreatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right side logs & Top Referrers */}
        <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 lg:col-span-1 space-y-5 flex flex-col max-h-[460px] overflow-hidden">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Referrals Credit Ledger</h3>
            <p className="text-xs text-slate-450 mt-0.5 font-semibold">Real-time log of reward distributions & usage credits.</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar min-h-0">
            {referralTransactions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
                <Clock size={24} className="mb-1 text-slate-300" />
                <p className="text-[11px] font-bold">No transaction records</p>
              </div>
            ) : (
              referralTransactions.map(tx => (
                <div key={tx.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-slate-800 truncate max-w-[150px]">{tx.shops?.name || "Deleted Shop"}</span>
                    <span className={`font-black text-[11px] ${tx.type === "reward" ? "text-emerald-600" : "text-rose-600"}`}>
                      {tx.type === "reward" ? "+" : "-"}Rs {tx.amount}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">{tx.description}</p>
                  <p className="text-[9px] text-slate-400 mt-1 font-mono">{new Date(tx.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
