"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Calendar, Search, Sliders, ToggleLeft, ToggleRight, Sparkles, CreditCard, CheckCircle, XCircle, Eye, Clock, AlertCircle, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getPlatformShopId } from "@/lib/config";
import {
  buildPlanPriceMap,
  getMonthlyPriceFromMap,
} from "@/lib/billing/plan-prices";
import { mergeRemotePlansWithDefaults, type AdminSaasPlan } from "@/lib/billing/plan-display";

export default function AdminSubscriptionsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<any[]>([]);
  const [savingShopId, setSavingShopId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"subscriptions" | "payments">("payments");

  // Subscriptions filters
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Payments approval state
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [statusTabFilter, setStatusTabFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [approving, setApproving] = useState(false);
  const [resendingShopId, setResendingShopId] = useState<string | null>(null);
  const [saasPlans, setSaasPlans] = useState<AdminSaasPlan[]>([]);

  const planPrices = useMemo(() => buildPlanPriceMap(saasPlans), [saasPlans]);

  // Calculate proration preview for the selected submission
  const prorationPreview = (() => {
    if (!selectedSubmission) return null;
    const shopInList = shops.find(s => s.id === selectedSubmission.shop_id);
    if (!shopInList) return null;
    const currentTier = shopInList.subscription_tier || "free";
    const newTier = selectedSubmission.plan_id;
    if (currentTier === newTier || currentTier === "free") return null;
    const currentExpiry = shopInList.subscription_expires_at ? new Date(shopInList.subscription_expires_at) : null;
    if (!currentExpiry || currentExpiry <= new Date()) return null;

    const remainingDays = (currentExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    const oldDailyRate = getMonthlyPriceFromMap(planPrices, currentTier, saasPlans) / 30;
    const newDailyRate = getMonthlyPriceFromMap(planPrices, newTier, saasPlans) / 30;
    const remainingCredit = remainingDays * oldDailyRate;
    const creditDays = newDailyRate > 0 ? remainingCredit / newDailyRate : 0;
    const paidDays = (selectedSubmission.billing_period === "yearly" ? 12 : 1) * 30;
    const totalDays = Math.round(creditDays) + paidDays;
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + totalDays);

    return { currentTier, newTier, remainingDays: Math.round(remainingDays), creditDays: Math.round(creditDays), paidDays, totalDays, newExpiry };
  })();

  useEffect(() => {
    loadSubscriptions();
    loadPaymentSubmissions();
    loadSaasPlans();
  }, []);

  const loadSaasPlans = async () => {
    const platformId = getPlatformShopId();
    if (!platformId) return;
    const { data } = await supabase
      .from("company_details")
      .select("website")
      .eq("shop_id", platformId)
      .limit(1);
    const row = data?.[0];
    if (row?.website?.startsWith("{")) {
      try {
        const parsed = JSON.parse(row.website);
        if (Array.isArray(parsed.saas_plans)) {
          setSaasPlans(mergeRemotePlansWithDefaults(parsed.saas_plans));
        }
      } catch {
        setSaasPlans(mergeRemotePlansWithDefaults([]));
      }
    } else {
      setSaasPlans(mergeRemotePlansWithDefaults([]));
    }
  };

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shops")
        .select("id, name, industry_type, subscription_tier, subscription_expires_at")
        .order("name", { ascending: true });
      if (error) throw error;
      setShops(data || []);
    } catch (err: any) {
      toast.error("Failed to load subscriptions: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentSubmissions = async () => {
    setPaymentsLoading(true);
    try {
      const res = await fetch("/api/payment-submit?admin=1");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err: any) {
      toast.error("Failed to load payment submissions: " + err.message);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleApproveReject = async (action: "approve" | "reject") => {
    if (!selectedSubmission) return;
    setApproving(true);
    try {
      const res = await fetch("/api/payment-submit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: selectedSubmission.id,
          action,
          adminNote: adminNote || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      toast.success(action === "approve" ? "✅ Payment approved! Plan activated." : "❌ Payment rejected.");
      setSelectedSubmission(null);
      setAdminNote("");
      await loadPaymentSubmissions();
      if (action === "approve") await loadSubscriptions();
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setApproving(false);
    }
  };

  const handleUpdateExpiry = async (shopId: string, expiryDate: string) => {
    setSavingShopId(shopId);
    try {
      const res = await fetch("/api/admin/shops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, updates: { subscription_expires_at: expiryDate } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast.success("Expiry date updated! Customer receipt email sent.");
      setShops(prev => prev.map(s => s.id === shopId ? { ...s, subscription_expires_at: expiryDate } : s));
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSavingShopId(null);
    }
  };

  const handleExtend30Days = (shop: any) => {
    const baseDate = shop.subscription_expires_at ? new Date(shop.subscription_expires_at) : new Date();
    const start = baseDate < new Date() ? new Date() : baseDate;
    start.setDate(start.getDate() + 30);
    handleUpdateExpiry(shop.id, start.toISOString());
  };

  const handleChangeSubscriptionTier = async (shopId: string, newTier: string) => {
    setSavingShopId(shopId);
    try {
      const shop = shops.find((s) => s.id === shopId);
      const updates: Record<string, string> = { subscription_tier: newTier };

      if (newTier !== "free" && !shop?.subscription_expires_at) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        updates.subscription_expires_at = expiry.toISOString();
      }

      const res = await fetch("/api/admin/shops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      toast.success(
        newTier !== "free"
          ? "Plan activated! Confirmation email sent to customer."
          : "Plan updated!"
      );
      setShops(prev =>
        prev.map(s =>
          s.id === shopId
            ? {
                ...s,
                subscription_tier: newTier,
                subscription_expires_at:
                  updates.subscription_expires_at || s.subscription_expires_at,
              }
            : s
        )
      );
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSavingShopId(null);
    }
  };

  const handleResendReceipt = async (shopId: string) => {
    setResendingShopId(shopId);
    try {
      const res = await fetch("/api/admin/subscriptions/resend-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      toast.success(`Receipt email sent to ${data.email}`);
    } catch (err: any) {
      toast.error(err.message || "Could not send receipt email");
    } finally {
      setResendingShopId(null);
    }
  };

  const filteredShops = useMemo(() => {
    return shops.filter(shop => {
      const expires = shop.subscription_expires_at ? new Date(shop.subscription_expires_at) : null;
      const isExpired = expires ? expires < new Date() : true;
      const matchesSearch = shop.name.toLowerCase().includes(search.toLowerCase()) || shop.industry_type.toLowerCase().includes(search.toLowerCase());
      const matchesTier = tierFilter === "all" || shop.subscription_tier === tierFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" && !isExpired) || (statusFilter === "expired" && isExpired);
      return matchesSearch && matchesTier && matchesStatus;
    });
  }, [shops, search, tierFilter, statusFilter]);

  const filteredSubmissions = useMemo(() => {
    if (statusTabFilter === "all") return submissions;
    return submissions.filter(s => s.status === statusTabFilter);
  }, [submissions, statusTabFilter]);

  const pendingCount = submissions.filter(s => s.status === "pending").length;

  const gatewayIcon = (gw: string) => ({ jazzcash: "📱", easypaisa: "💚", bank: "🏦", safepay: "💳" }[gw] || "💰");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider">Subscriptions & Payments</h2>
          <p className="text-xs text-slate-450 mt-0.5">Manage billing, review payment submissions, and activate plans.</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all ${activeTab === "payments" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <CreditCard size={14} />
          Payment Approvals
          {pendingCount > 0 && (
            <span className="ml-1 bg-rose-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5">{pendingCount}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("subscriptions")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all ${activeTab === "subscriptions" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <Calendar size={14} />
          Subscription Scheduler
        </button>
      </div>

      {/* ============ PAYMENTS TAB ============ */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          {/* Status filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {(["pending", "approved", "rejected", "all"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusTabFilter(tab)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                  statusTabFilter === tab
                    ? tab === "pending" ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : tab === "approved" ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : tab === "rejected" ? "bg-rose-100 text-rose-800 border border-rose-300"
                      : "bg-indigo-100 text-indigo-800 border border-indigo-300"
                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
                }`}
              >
                {tab} {tab !== "all" && `(${submissions.filter(s => s.status === tab).length})`}
              </button>
            ))}
          </div>

          {paymentsLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="animate-spin mr-2" size={20} /> Loading payment submissions...
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl py-16 text-center">
              <Clock size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-500">No {statusTabFilter === "all" ? "" : statusTabFilter} submissions yet</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl overflow-hidden">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-50 font-bold border-b text-slate-400 uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Business</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Gateway</th>
                    <th className="py-3 px-4">Submitted</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {filteredSubmissions.map(sub => (
                    <tr key={sub.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-5 font-sans font-bold text-slate-800">{sub.shops?.name || sub.shop_id}</td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className="font-black uppercase text-slate-700">{sub.plan_id}</span>
                        <span className="text-slate-400 ml-1">/ {sub.billing_period}</span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-emerald-700 font-sans">Rs {sub.amount?.toLocaleString()}</td>
                      <td className="py-3.5 px-4 font-sans">
                        <span>{gatewayIcon(sub.gateway)} {sub.gateway}</span>
                        {sub.transaction_ref && <span className="block text-[9px] text-slate-400">{sub.transaction_ref}</span>}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-sans">{new Date(sub.submitted_at).toLocaleString()}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          sub.status === "approved" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          sub.status === "rejected" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                          "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => { setSelectedSubmission(sub); setAdminNote(sub.admin_note || ""); }}
                          className="flex items-center gap-1 mx-auto text-indigo-600 hover:text-indigo-800 font-black text-[10px] bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition"
                        >
                          <Eye size={12} /> Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ SUBSCRIPTIONS TAB ============ */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-3 bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input placeholder="Search business by name or industry..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white border-slate-200 h-9 text-xs" />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="bg-white border border-slate-200 h-9 rounded-lg px-3 text-xs font-semibold cursor-pointer w-full md:w-40 text-slate-650 focus:outline-none">
                <option value="all">All Plans</option>
                <option value="free">Free Tier</option>
                <option value="starter">Starter Plan</option>
                <option value="premium">Premium Plan</option>
                <option value="enterprise">Enterprise Plan</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white border border-slate-200 h-9 rounded-lg px-3 text-xs font-semibold cursor-pointer w-full md:w-40 text-slate-650 focus:outline-none">
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="expired">Expired Only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="animate-spin mr-2" size={20} /> Loading...
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 shadow-sm rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-slate-50 font-bold border-b text-slate-400 uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="py-3 px-5">Business Name</th>
                      <th className="py-3 px-4">Industry Type</th>
                      <th className="py-3 px-4">Tier Plan</th>
                      <th className="py-3 px-4">SaaS Status</th>
                      <th className="py-3 px-4">Expires At</th>
                      <th className="py-3 px-4 text-center">Modify Expiry Date</th>
                      <th className="py-3 px-4 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {filteredShops.length === 0 ? (
                      <tr><td colSpan={7} className="py-12 text-center text-slate-400 font-sans font-semibold">No active subscriptions match the filters.</td></tr>
                    ) : filteredShops.map(shop => {
                      const expires = shop.subscription_expires_at ? new Date(shop.subscription_expires_at) : null;
                      const isExpired = expires ? expires < new Date() : true;
                      return (
                        <tr key={shop.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-5 font-sans font-bold text-slate-800">{shop.name}</td>
                          <td className="py-3.5 px-4 capitalize font-sans">{shop.industry_type}</td>
                          <td className="py-2.5 px-4 font-sans">
                            <select
                              value={shop.subscription_tier || "free"}
                              disabled={savingShopId === shop.id}
                              onChange={(e) => handleChangeSubscriptionTier(shop.id, e.target.value)}
                              className={`bg-white border rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wider focus:outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500 ${shop.subscription_tier === "premium" ? "text-purple-750 border-purple-200 bg-purple-50/40" : shop.subscription_tier === "starter" ? "text-blue-650 border-blue-200 bg-blue-50/40" : "text-slate-600 border-slate-200 bg-slate-50/40"}`}
                            >
                              <option value="free">FREE</option>
                              <option value="starter">STARTER</option>
                              <option value="premium">PREMIUM</option>
                              <option value="enterprise">ENTERPRISE</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-sans font-black uppercase ${isExpired ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}>
                              {isExpired ? "Expired" : "Active"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 font-sans font-bold">{expires ? expires.toLocaleDateString() : "No active expiration"}</td>
                          <td className="py-2 px-4 text-center font-sans">
                            <div className="flex items-center justify-center gap-2">
                              <Input
                                key={shop.id + "-" + (shop.subscription_expires_at || "none")}
                                type="date"
                                defaultValue={shop.subscription_expires_at ? shop.subscription_expires_at.split("T")[0] : ""}
                                onChange={(e) => { if (e.target.value) handleUpdateExpiry(shop.id, new Date(e.target.value).toISOString()); }}
                                className="h-8 text-[11px] border-slate-200 bg-white w-36 px-2 focus-visible:ring-1 focus-visible:ring-indigo-500"
                              />
                              <Button size="sm" disabled={savingShopId === shop.id} onClick={() => handleExtend30Days(shop)} className="h-8 bg-indigo-600 hover:bg-indigo-750 text-[10px] font-black text-white px-2.5 shadow-sm rounded-lg flex items-center gap-1 cursor-pointer">
                                <Sparkles size={10} /> +30 Days
                              </Button>
                            </div>
                          </td>
                          <td className="py-2 px-4 text-center font-sans">
                            {shop.subscription_tier && shop.subscription_tier !== "free" && shop.subscription_expires_at ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={resendingShopId === shop.id}
                                onClick={() => handleResendReceipt(shop.id)}
                                className="h-8 text-[10px] font-black px-2.5 rounded-lg flex items-center gap-1 mx-auto"
                              >
                                {resendingShopId === shop.id ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <Mail size={10} />
                                )}
                                Send Receipt
                              </Button>
                            ) : (
                              <span className="text-[10px] text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Screenshot Review Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setSelectedSubmission(null); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="font-black text-slate-900">Payment Review</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedSubmission.shops?.name}</p>
              </div>
              <button onClick={() => setSelectedSubmission(null)} className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                <XCircle size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Details */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Plan</span><span className="font-black text-slate-800 uppercase">{selectedSubmission.plan_id} / {selectedSubmission.billing_period}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Amount</span><span className="font-black text-emerald-700 text-sm">Rs {selectedSubmission.amount?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Gateway</span><span className="font-black">{gatewayIcon(selectedSubmission.gateway)} {selectedSubmission.gateway}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">TID/Ref</span><span className="font-black font-mono">{selectedSubmission.transaction_ref || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-semibold">Submitted</span><span className="font-bold">{new Date(selectedSubmission.submitted_at).toLocaleString()}</span></div>
              </div>

              {/* Proration Preview — only for plan changes */}
              {prorationPreview && selectedSubmission.status === "pending" && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2 text-xs">
                  <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider flex items-center gap-1">⚡ Proration Calculation (Plan Change)</p>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <span className="text-slate-500">Old plan:</span>
                    <span className="font-black uppercase text-slate-700">{prorationPreview.currentTier} (Rs {planPrices[prorationPreview.currentTier] || 300}/mo)</span>
                    <span className="text-slate-500">New plan:</span>
                    <span className="font-black uppercase text-slate-700">{prorationPreview.newTier} (Rs {planPrices[prorationPreview.newTier] || 500}/mo)</span>
                    <span className="text-slate-500">Remaining days:</span>
                    <span className="font-bold text-amber-700">{prorationPreview.remainingDays} days → converted to {prorationPreview.creditDays} days credit</span>
                    <span className="text-slate-500">Paid days:</span>
                    <span className="font-bold text-emerald-700">+{prorationPreview.paidDays} days (new payment)</span>
                    <span className="text-slate-500 font-black">Total days:</span>
                    <span className="font-black text-blue-700">{prorationPreview.totalDays} days → expires {prorationPreview.newExpiry.toLocaleDateString()}</span>
                  </div>
                </div>
              )}

              {/* Screenshot */}
              {selectedSubmission.screenshot_url ? (
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Payment Screenshot:</p>
                  <a href={selectedSubmission.screenshot_url} target="_blank" rel="noopener noreferrer">
                    <img src={selectedSubmission.screenshot_url} alt="Payment screenshot" className="w-full rounded-2xl border border-slate-200 max-h-64 object-contain bg-slate-50 cursor-zoom-in" />
                  </a>
                  <p className="text-[9px] text-slate-400 mt-1 text-center">Click image to open full size</p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center text-xs text-amber-700 flex items-center justify-center gap-2">
                  <AlertCircle size={16} /> No screenshot provided
                </div>
              )}

              {/* Admin note */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Admin Note (optional)</label>
                <textarea
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  placeholder="Add a note for the user..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-indigo-400 resize-none"
                />
              </div>

              {/* Approve / Reject */}
              {selectedSubmission.status === "pending" ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleApproveReject("reject")}
                    disabled={approving}
                    className="flex-1 h-11 border-2 border-rose-200 text-rose-700 hover:bg-rose-50 font-black text-xs rounded-2xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                  <button
                    onClick={() => handleApproveReject("approve")}
                    disabled={approving}
                    className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {approving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                    Approve & Activate Plan
                  </button>
                </div>
              ) : (
                <div className={`p-3 rounded-2xl text-center text-xs font-black ${selectedSubmission.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  This submission has been {selectedSubmission.status}.
                  {selectedSubmission.admin_note && <p className="font-normal mt-1">{selectedSubmission.admin_note}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
