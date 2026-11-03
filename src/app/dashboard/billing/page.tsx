"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useShop } from "@/context/ShopContext";
import { shouldHideBillingAndPlans, PERMANENT_PLAN_LABEL } from "@/lib/deployment/flame9-brand";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getPlatformShopId } from "@/lib/config";
import { mapPlansForBilling, type AdminSaasPlan } from "@/lib/billing/plan-display";
import {
  CreditCard, Loader2, CheckCircle2, AlertTriangle,
  Calendar, Sparkles, Zap, ShieldCheck, X, Upload,
  Smartphone, Building2, Landmark, Clock, CheckCircle, Users
} from "lucide-react";

interface GatewayConfig {
  jazzcash_active: boolean;
  jazzcash_till: string;
  jazzcash_account_title: string;
  jazzcash_qr_url: string;
  easypaisa_active: boolean;
  easypaisa_wallet: string;
  easypaisa_account_title: string;
  easypaisa_qr_url: string;
  bank_active: boolean;
  bank_name: string;
  bank_account_num: string;
  bank_account_title: string;
  bank_iban: string;
  bank_qr_url: string;
  safepay_active: boolean;
  safepay_sandbox: boolean;
  stripe_active?: boolean;
  stripe_publishable_key?: string;
  paypal_active?: boolean;
  paypal_client_id?: string;
  pk_gateways?: string[];
  global_gateways?: string[];
}

interface SelectedPlan {
  id: string;
  name: string;
  price: number;
  period: "monthly" | "yearly";
}

export default function BillingPage() {
  const router = useRouter();
  const { shopId, shopName, saasPlans, planName, effectiveTier, loading: shopLoading } = useShop();
  const supabase = createClient();

  useEffect(() => {
    if (shouldHideBillingAndPlans()) {
      router.replace("/dashboard/restaurant/pos");
    }
  }, [router]);

  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [shopDetails, setShopDetails] = useState<any>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig | null>(null);

  // ── Country Detection ────────────────────────────────────────────────────
  const [country, setCountry] = useState<"pk" | "global">("pk"); // default Pakistan
  const [countryDetecting, setCountryDetecting] = useState(true);

  useEffect(() => {
    // Auto-detect country via IP API
    const detectCountry = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data = await res.json();
          const code = (data.country_code || "").toLowerCase();
          setCountry(code === "pk" ? "pk" : "global");
        }
      } catch {
        // Silently default to Pakistan on failure
      } finally {
        setCountryDetecting(false);
      }
    };
    detectCountry();
  }, []);

  const isPakistan = country === "pk";
  const currencySymbol = isPakistan ? "Rs" : "$";
  const currencyLabel = isPakistan ? "PKR" : "USD";

  // Gateway selection modal
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
  const [transactionRef, setTransactionRef] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [referredShops, setReferredShops] = useState<any[]>([]);
  const [referralTx, setReferralTx] = useState<any[]>([]);
  const [useCreditsDiscount, setUseCreditsDiscount] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shopId) loadBillingDetails();
  }, [shopId]);

  const loadBillingDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shops")
        .select("id, name, subscription_tier, subscription_expires_at, referral_credits")
        .eq("id", shopId)
        .single();
      if (error) throw error;
      setShopDetails(data);

      const platformId = getPlatformShopId();
      if (platformId) {
        const { data: configRows } = await supabase
          .from("company_details")
          .select("website")
          .eq("shop_id", platformId)
          .limit(1);

        const config = configRows?.[0];
        if (config?.website?.startsWith("{")) {
          try {
            const parsed = JSON.parse(config.website);
            setGatewayConfig({
              jazzcash_active: parsed.jazzcash_active || false,
              jazzcash_till: parsed.jazzcash_till || "",
              jazzcash_account_title: parsed.jazzcash_account_title || "",
              jazzcash_qr_url: parsed.jazzcash_qr_url || "",
              easypaisa_active: parsed.easypaisa_active || false,
              easypaisa_wallet: parsed.easypaisa_wallet || "",
              easypaisa_account_title: parsed.easypaisa_account_title || "",
              easypaisa_qr_url: parsed.easypaisa_qr_url || "",
              bank_active: parsed.bank_active || false,
              bank_name: parsed.bank_name || "",
              bank_account_num: parsed.bank_account_num || "",
              bank_account_title: parsed.bank_account_title || "",
              bank_iban: parsed.bank_iban || "",
              bank_qr_url: parsed.bank_qr_url || "",
              safepay_active: parsed.safepay_active || false,
              safepay_sandbox: parsed.safepay_sandbox ?? true,
              stripe_active: parsed.stripe_active || false,
              stripe_publishable_key: parsed.stripe_publishable_key || "",
              paypal_active: parsed.paypal_active || false,
              paypal_client_id: parsed.paypal_client_id || "",
              pk_gateways: parsed.pk_gateways || ["jazzcash", "easypaisa", "bank"],
              global_gateways: parsed.global_gateways || ["stripe"],
            });
          } catch (e) {}
        }
      }

      // Load user's past submissions
      const res = await fetch(`/api/payment-submit?shopId=${shopId}`);
      if (res.ok) {
        const d = await res.json();
        setMySubmissions(d.submissions || []);
      }

      // Fetch referred shops list
      const { data: referredList } = await supabase
        .from("shops")
        .select("id, name, subscription_tier, subscription_expires_at, created_at")
        .eq("referred_by_shop_id", shopId)
        .order("created_at", { ascending: false });
      setReferredShops(referredList || []);

      // Fetch referral transactions list
      const { data: refTx } = await supabase
        .from("referral_transactions")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });
      setReferralTx(refTx || []);
    } catch (err: any) {
      toast.error("Failed to load billing: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openGatewayModal = (plan: any, price: number) => {
    setSelectedPlan({ id: plan.id, name: plan.name, price, period: billingPeriod });
    setSelectedGateway(null);
    setTransactionRef("");
    setScreenshot(null);
    setScreenshotPreview(null);
    setUseCreditsDiscount(false);
    setShowGatewayModal(true);
  };

  const handleSafepayCheckout = async (tier: string, price: number) => {
    if (!shopDetails) return;
    setCheckingOut(tier);
    try {
      const response = await fetch("/api/pay/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: shopDetails.id, tier, price }),
      });
      const result = await response.json();
      if (!response.ok || !result.token) throw new Error(result.error || "Payment init failed");
      const host = result.sandbox ? "sandbox.api.getsafepay.com" : "api.getsafepay.com";
      const origin = window.location.origin;
      const checkoutUrl = `https://${host}/checkout/pay?beacon=${result.token}&client=${result.client}&order_id=${shopDetails.id}&source=custom&env=${result.sandbox ? "sandbox" : "production"}&redirect_url=${origin}/api/pay/callback?shop_id=${shopDetails.id}%26tier=${tier}%26billing=${billingPeriod}`;
      window.location.href = checkoutUrl;
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
      setCheckingOut(null);
    }
  };

  const handleStripeCheckout = async (tier: string, price: number) => {
    if (!shopDetails) return;
    setCheckingOut(tier);
    try {
      const response = await fetch("/api/pay/init-international", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: shopDetails.id, tier, price, billing: billingPeriod, gateway: "stripe" }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Payment session init failed");
      window.location.href = result.url;
    } catch (err: any) {
      toast.error(err.message || "Stripe checkout failed");
      setCheckingOut(null);
    }
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshot(file);
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleManualPaymentSubmit = async () => {
    if (!selectedGateway || !selectedPlan || !shopId) return;
    if (!screenshot) { toast.error("Please upload a payment screenshot"); return; }
    if (!transactionRef.trim()) { toast.error("Please enter the transaction reference number"); return; }

    setSubmitting(true);
    try {
      const creditsToApply = useCreditsDiscount ? Math.min(Number(shopDetails?.referral_credits || 0), selectedPlan.price) : 0;
      const finalAmount = Math.max(0, selectedPlan.price - creditsToApply);

      const fd = new FormData();
      fd.append("shopId", shopId);
      fd.append("planId", selectedPlan.id);
      fd.append("billingPeriod", selectedPlan.period);
      fd.append("amount", String(finalAmount));
      fd.append("creditsApplied", String(creditsToApply));
      fd.append("gateway", selectedGateway);
      fd.append("transactionRef", transactionRef);
      fd.append("screenshot", screenshot);

      const res = await fetch("/api/payment-submit", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Submission failed");

      toast.success("✅ Payment submitted! Our team will verify and activate your plan within a few hours.");
      setShowGatewayModal(false);
      // Refresh submissions
      const sr = await fetch(`/api/payment-submit?shopId=${shopId}`);
      if (sr.ok) { const sd = await sr.json(); setMySubmissions(sd.submissions || []); }
    } catch (err: any) {
      toast.error("Failed to submit: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const planOptions = useMemo(
    () => mapPlansForBilling(saasPlans, { isPakistan, billingPeriod }),
    [saasPlans, isPakistan, billingPeriod]
  );

  const planGridClass = "grid grid-cols-1 gap-6 lg:grid-cols-3 max-w-6xl mx-auto items-stretch";

  if (shouldHideBillingAndPlans()) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-slate-500">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
        <p className="text-sm font-bold text-slate-800">{PERMANENT_PLAN_LABEL}</p>
        <p className="text-xs font-medium mt-1">No payment plans - redirecting to Restaurant POS…</p>
      </div>
    );
  }

  if (loading || shopLoading) {
    return (
      <div className="h-96 flex flex-col justify-center items-center text-slate-450">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650 mb-2" />
        <p className="text-xs font-semibold">Loading billing and plans setup...</p>
      </div>
    );
  }

  const currentTier = shopDetails?.subscription_tier || effectiveTier || "free";
  const expiryDate = shopDetails?.subscription_expires_at ? new Date(shopDetails.subscription_expires_at) : null;
  const isExpired = expiryDate ? expiryDate < new Date() : true;

  // Country-aware active gateways
  const allowedGateways = isPakistan
    ? (gatewayConfig?.pk_gateways || ["jazzcash", "easypaisa", "bank"])
    : (gatewayConfig?.global_gateways || ["stripe"]);

  const activeGateways = gatewayConfig ? [
    allowedGateways.includes("jazzcash") && gatewayConfig.jazzcash_active && { id: "jazzcash", label: "JazzCash", subtitle: `Till: ${gatewayConfig.jazzcash_till}`, icon: "📱", color: "bg-red-50 border-red-200 text-red-700" },
    allowedGateways.includes("easypaisa") && gatewayConfig.easypaisa_active && { id: "easypaisa", label: "EasyPaisa", subtitle: `Wallet: ${gatewayConfig.easypaisa_wallet}`, icon: "💚", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    allowedGateways.includes("bank") && gatewayConfig.bank_active && { id: "bank", label: "Bank Transfer", subtitle: `${gatewayConfig.bank_name} • ${gatewayConfig.bank_account_num}`, icon: "🏦", color: "bg-blue-50 border-blue-200 text-blue-700" },
    allowedGateways.includes("safepay") && gatewayConfig.safepay_active && { id: "safepay", label: "Card / Safepay", subtitle: "Visa, Mastercard, JazzCash, EasyPaisa", icon: "💳", color: "bg-indigo-50 border-indigo-200 text-indigo-700" },
    allowedGateways.includes("stripe") && gatewayConfig.stripe_active && { id: "stripe", label: "Stripe (Card)", subtitle: "Visa, Mastercard, Amex - International", icon: "💳", color: "bg-violet-50 border-violet-200 text-violet-700" },
    allowedGateways.includes("paypal") && gatewayConfig.paypal_active && { id: "paypal", label: "PayPal", subtitle: "Pay via PayPal wallet or card", icon: "🅿️", color: "bg-blue-50 border-blue-200 text-blue-700" },
  ].filter(Boolean) as Array<{ id: string; label: string; subtitle: string; icon: string; color: string }> : [];

  const getGatewayDetails = () => {
    if (!gatewayConfig || !selectedGateway) return null;
    switch (selectedGateway) {
      case "jazzcash": return {
        title: "JazzCash",
        accountTitle: gatewayConfig.jazzcash_account_title,
        account: gatewayConfig.jazzcash_till,
        label: "JazzCash Account Number / Till ID",
        qrUrl: gatewayConfig.jazzcash_qr_url,
      };
      case "easypaisa": return {
        title: "EasyPaisa",
        accountTitle: gatewayConfig.easypaisa_account_title,
        account: gatewayConfig.easypaisa_wallet,
        label: "EasyPaisa Wallet / Mobile Number",
        qrUrl: gatewayConfig.easypaisa_qr_url,
      };
      case "bank": return {
        title: gatewayConfig.bank_name,
        accountTitle: gatewayConfig.bank_account_title,
        account: `${gatewayConfig.bank_account_num}${gatewayConfig.bank_iban ? ` (IBAN: ${gatewayConfig.bank_iban})` : ""}`,
        label: "Bank Account Details",
        qrUrl: gatewayConfig.bank_qr_url,
      };
      default: return null;
    }
  };

  // Calculate proration warning if switching plans
  const prorationWarning = (() => {
    if (!selectedPlan || currentTier === selectedPlan.id || isExpired || !expiryDate) return null;
    
    const planPrices: Record<string, number> = {};
    planOptions.forEach((p) => {
      planPrices[p.id] = isPakistan ? p.monthly_price : p.monthly_price_usd;
    });

    const oldPrice = selectedPlan.period === "yearly" ? (planPrices[currentTier] * 10) : planPrices[currentTier];
    const newPrice = selectedPlan.price;
    
    const remainingMs = expiryDate.getTime() - Date.now();
    const remainingDays = Math.max(0, Math.round(remainingMs / (1000 * 60 * 60 * 24)));
    
    const oldDailyRate = oldPrice / 30;
    const newDailyRate = newPrice / 30;
    
    const remainingCredit = remainingDays * oldDailyRate;
    const creditDaysOnNewPlan = newDailyRate > 0 ? remainingCredit / newDailyRate : 0;
    
    const paidDays = (selectedPlan.period === "yearly" ? 12 : 1) * 30;
    const totalDays = Math.round(creditDaysOnNewPlan) + paidDays;
    
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + totalDays);
    
    return {
      oldTier: currentTier,
      newTier: selectedPlan.id,
      remainingDays,
      creditDays: Math.round(creditDaysOnNewPlan),
      totalDays,
      newExpiry,
      remainingCredit: Math.round(remainingCredit)
    };
  })();

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Title + Country Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
        {/* Country Toggle */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            onClick={() => setCountry("pk")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              isPakistan ? "bg-white shadow text-green-700 border border-green-200" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            🇵🇰 Pakistan (PKR)
          </button>
          <button
            onClick={() => setCountry("global")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              !isPakistan ? "bg-white shadow text-blue-700 border border-blue-200" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            🌍 International (USD)
          </button>
        </div>
      </div>

      {/* Subscription Status Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Current Business Active Plan</div>
            <div className={`px-3 py-0.5 rounded-full text-[9px] font-sans font-black uppercase tracking-wider ${isExpired && currentTier !== "free" ? "bg-red-50 text-red-600 border border-red-150" : "bg-indigo-50 text-indigo-700 border border-indigo-150"}`}>
              {planName || currentTier}
            </div>
          </div>
          <h3 className="text-2xl font-black text-[#1e3a5f] capitalize">{shopName}</h3>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Calendar size={14} className="text-indigo-550" />
            {expiryDate ? (
              <div>Plan {isExpired ? "expired on" : "expires on"} <strong className="text-slate-700">{expiryDate.toLocaleDateString()}</strong></div>
            ) : (
              <div>No active expiration (Unlimited Trial Mode)</div>
            )}
          </div>
        </div>
        {isExpired && currentTier !== "free" && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-xs flex items-center gap-2 max-w-sm">
            <AlertTriangle className="text-rose-600 shrink-0" size={16} />
            <div>Subscription expired! Please choose a plan below to resume all actions.</div>
          </div>
        )}
      </div>

      {/* My Payment Submissions */}
      {mySubmissions.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock size={16} className="text-indigo-600" /> My Payment Submissions
          </h3>
          <div className="space-y-2">
            {mySubmissions.map((sub: any) => (
              <div key={sub.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-800">{sub.plan_id} • {sub.billing_period} • Rs {sub.amount?.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{sub.gateway} • {new Date(sub.submitted_at).toLocaleString()}</p>
                  {sub.admin_note && <p className="text-[10px] text-amber-600 mt-0.5">Note: {sub.admin_note}</p>}
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  sub.status === "approved" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                  sub.status === "rejected" ? "bg-red-50 text-red-700 border border-red-200" :
                  "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {sub.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share & Earn (MLM Referral Program) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Referral Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4 lg:col-span-1 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600" /> Share & Earn Program
            </h3>
            <p className="text-[11px] text-slate-455 leading-relaxed font-semibold">
              Invite businesses to join The Accounts. When they register using your link and purchase any paid plan, you earn instant credits!
            </p>
            <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-2xl space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                <div>Starter Plan Payout</div>
                <div className="text-emerald-700 font-black">Rs 50</div>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                <div>Premium Plan Payout</div>
                <div className="text-emerald-700 font-black">Rs 80</div>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-4 border-t">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Your Referral Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : "https://theaccounts.cloud"}/register?ref=${shopId}`}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-mono text-slate-700 outline-none select-all"
                />
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/register?ref=${shopId}`;
                    navigator.clipboard.writeText(link);
                    toast.success("Referral link copied to clipboard!");
                  }}
                  className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] rounded-xl transition"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Available Balance</p>
                <p className="text-lg font-black text-emerald-700">Rs {Number(shopDetails?.referral_credits || 0).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Referred</p>
                <p className="text-lg font-black text-slate-800">{referredShops.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Referred Businesses List */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm lg:col-span-1 flex flex-col justify-between max-h-[320px] overflow-hidden">
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Referred Businesses</h3>
            {referredShops.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-8">
                <Users size={24} className="mb-1 text-slate-300" />
                <p className="text-[11px] font-bold">No referrals yet</p>
                <p className="text-[9px]">Share your link to start earning.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0">
                {referredShops.map((refShop: any) => {
                  const subExpiry = refShop.subscription_expires_at ? new Date(refShop.subscription_expires_at) : null;
                  const isRefExpired = subExpiry ? subExpiry < new Date() : true;
                  return (
                    <div key={refShop.id} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <div>
                        <p className="text-[11px] font-bold text-slate-800 truncate max-w-[130px]">{refShop.name}</p>
                        <p className="text-[9px] text-slate-400">Joined: {new Date(refShop.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                        isRefExpired || refShop.subscription_tier === "free"
                          ? "bg-slate-200 text-slate-650"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-150"
                      }`}>
                        {refShop.subscription_tier}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Credits Transaction Log */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm lg:col-span-1 flex flex-col justify-between max-h-[320px] overflow-hidden">
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Credits History</h3>
            {referralTx.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-8">
                <Clock size={24} className="mb-1 text-slate-300" />
                <p className="text-[11px] font-bold">No transaction history</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0">
                {referralTx.map((tx: any) => (
                  <div key={tx.id} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-[10px] text-slate-700 font-semibold truncate leading-tight">{tx.description}</p>
                      <p className="text-[8px] text-slate-400 mt-0.5">{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                    <div className={`font-black text-[11px] shrink-0 ${tx.type === "reward" ? "text-emerald-600" : "text-rose-600"}`}>
                      {tx.type === "reward" ? "+" : "-"}Rs {tx.amount}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Options - synced with admin panel + landing page */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between max-w-6xl mx-auto">
          <div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Upgrade Your Plan</h3>
            
          </div>
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 self-start sm:self-auto">
            {(["monthly", "yearly"] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setBillingPeriod(period)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold capitalize transition-colors ${
                  billingPeriod === period
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {period === "monthly" ? "Pay Monthly" : "Pay Yearly"}
                {period === "yearly" ? (
                  <div
                    className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                      billingPeriod === "yearly"
                        ? "bg-emerald-400 text-slate-900"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    Save big
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className={planGridClass}>
          {planOptions.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-450">
              
              
            </div>
          ) : (
            planOptions.map((plan) => {
              const isActivePlan = effectiveTier === plan.id && !isExpired;
              const price =
                billingPeriod === "yearly"
                  ? isPakistan
                    ? plan.yearly_price
                    : plan.yearly_price_usd
                  : isPakistan
                    ? plan.monthly_price
                    : plan.monthly_price_usd;
              const featured = plan.featured;

              return (
                <div
                  key={plan.id}
                  className={`flex flex-col rounded-[1.25rem] border p-6 sm:p-7 shadow-md transition-all duration-300 ${
                    featured
                      ? "border-slate-900 bg-slate-900 text-white lg:scale-[1.02]"
                      : isActivePlan
                        ? "border-emerald-500 bg-white ring-2 ring-emerald-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`text-sm font-black uppercase tracking-wide ${
                        featured ? "text-white/80" : "text-slate-500"
                      }`}
                    >
                      {plan.name}
                    </div>
                    {billingPeriod === "yearly" && plan.yearlySavePercent > 0 ? (
                      <div
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${
                          featured
                            ? "bg-emerald-400 text-slate-900"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        Save {plan.yearlySavePercent}%
                      </div>
                    ) : featured ? (
                      <div className="shrink-0 rounded-full bg-indigo-500 px-2.5 py-1 text-[9px] font-black uppercase text-white">
                        Popular
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 pb-5 border-b border-dashed border-inherit">
                    <div className="flex items-baseline gap-1">
                      {plan.isZeroCost ? (
                        <div className={`text-3xl font-black ${featured ? "text-white" : "text-emerald-700"}`}>
                          Free
                        </div>
                      ) : (
                        <div className="text-3xl font-black tracking-tight">
                          {currencySymbol} {price.toLocaleString()}
                          {!isPakistan ? " USD" : ""}
                        </div>
                      )}
                      <div
                        className={`text-xs font-bold ${
                          featured ? "text-white/60" : "text-slate-400"
                        }`}
                      >
                        /{billingPeriod === "monthly" ? "mo" : "yr"}
                      </div>
                    </div>
                    <p className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${featured ? "text-white/50" : "text-slate-400"}`}>
                      {plan.max_devices === "unlimited"
                        ? "Unlimited devices"
                        : `Up to ${plan.max_devices} device(s)`}
                    </p>
                  </div>

                  <div className="mt-5 flex-1 space-y-0">
                    {plan.featureMatrix.map((row) => (
                      <div
                        key={row.label}
                        className={`flex items-center justify-between gap-2 border-b py-2.5 text-[11px] font-semibold ${
                          featured ? "border-white/10" : "border-slate-100"
                        }`}
                      >
                        <div className={featured ? "text-white/85" : "text-slate-700"}>{row.label}</div>
                        <div
                          className={`shrink-0 text-[10px] font-black uppercase tracking-wide ${
                            row.active
                              ? featured
                                ? "text-emerald-300"
                                : "text-emerald-600"
                              : featured
                                ? "text-rose-300"
                                : "text-rose-500"
                          }`}
                        >
                          {row.active ? "✓ Active" : "✕ Blocked"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 space-y-2">
                    {isActivePlan && (
                      <div
                        className={`w-full h-10 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 ${
                          featured
                            ? "bg-emerald-400/20 text-emerald-200 border border-emerald-400/30"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        <CheckCircle2 size={14} /> Active Subscription
                      </div>
                    )}
                    {!plan.isZeroCost && (
                      <>
                        <button
                          type="button"
                          onClick={() => openGatewayModal(plan, price)}
                          disabled={checkingOut !== null}
                          className={`w-full h-12 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-[0.98] disabled:opacity-60 ${
                            featured
                              ? "bg-white text-slate-900 hover:bg-slate-100"
                              : "bg-slate-900 hover:bg-slate-800 text-white"
                          }`}
                        >
                          {checkingOut === plan.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap size={14} />
                          )}
                          {isActivePlan ? "Renew / Extend" : `Choose ${plan.name}`}
                        </button>
                        <p
                          className={`text-[9px] text-center font-bold uppercase tracking-wider ${
                            featured ? "text-white/40" : "text-slate-400"
                          }`}
                        >
                          JazzCash • EasyPaisa • Bank • Card
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Gateway Selection Modal */}
      {showGatewayModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowGatewayModal(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10 rounded-t-3xl">
              <div className="flex items-center gap-3">
                {selectedGateway && (
                  <button onClick={() => setSelectedGateway(null)} className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition text-slate-600 text-sm font-black">
                    ←
                  </button>
                )}
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {selectedGateway ? "Payment Details" : "Choose Payment Method"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedPlan.name} • {currencySymbol} {(useCreditsDiscount ? Math.max(0, selectedPlan.price - Number(shopDetails?.referral_credits || 0)) : selectedPlan.price).toLocaleString()} / {selectedPlan.period}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowGatewayModal(false)} className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Apply Referral Credits Balance */}
              {Number(shopDetails?.referral_credits || 0) > 0 && (
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Referral Balance Available</p>
                    <p className="text-xs font-semibold text-slate-600">
                      Apply {currencySymbol} {Math.min(Number(shopDetails?.referral_credits || 0), selectedPlan.price).toLocaleString()} discount
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseCreditsDiscount(!useCreditsDiscount)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      useCreditsDiscount 
                        ? "bg-emerald-600 text-white shadow-sm" 
                        : "bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50"
                    }`}
                  >
                    {useCreditsDiscount ? "Applied ✓" : "Apply Balance"}
                  </button>
                </div>
              )}

              {/* Proration Warning Alert Box */}
              {prorationWarning && (
                <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-indigo-700 text-xs font-black uppercase tracking-wider">
                    <Sparkles size={14} className="animate-pulse" /> Fair Plan Upgrade/Downgrade
                  </div>
                  <p className="text-[11px] text-slate-650 leading-relaxed font-medium">
                    You currently have <strong className="text-slate-800">{prorationWarning.remainingDays} days</strong> remaining on your <strong className="text-slate-800 uppercase">{prorationWarning.oldTier} Plan</strong> (approx. value <strong className="text-indigo-700">{currencySymbol} {prorationWarning.remainingCredit}</strong>).
                  </p>
                  <p className="text-[11px] text-slate-650 leading-relaxed font-medium">
                    When this payment is approved, this remaining credit will be converted into <strong className="text-emerald-700">{prorationWarning.creditDays} days</strong> on your new plan, stacking on top of your new payment for a total of <strong className="text-slate-800">{prorationWarning.totalDays} active days</strong>.
                  </p>
                  <div className="pt-1.5 border-t border-indigo-150 flex items-center justify-between text-[11px]">
                    <div className="font-bold text-slate-500">Estimated New Expiry:</div>
                    <strong className="text-indigo-700 font-extrabold">{prorationWarning.newExpiry.toLocaleDateString()}</strong>
                  </div>
                </div>
              )}

              {/* STEP 1: Gateway options */}
              {!selectedGateway && (
                <div className="space-y-2">
                  {activeGateways.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs font-semibold">No payment methods configured. Please contact support.</div>
                  ) : (
                    <>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">Select a payment method:</p>
                      {activeGateways.map(gw => (
                        <button
                          key={gw.id}
                          onClick={() => {
                            if (gw.id === "safepay") {
                              setShowGatewayModal(false);
                              handleSafepayCheckout(selectedPlan.id, selectedPlan.price);
                            } else if (gw.id === "stripe") {
                              setShowGatewayModal(false);
                              handleStripeCheckout(selectedPlan.id, selectedPlan.price);
                            } else {
                              setSelectedGateway(gw.id);
                            }
                          }}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 bg-white text-left transition-all group"
                        >
                          <div className="text-2xl">{gw.icon}</div>
                          <div className="flex-1">
                            <p className="text-sm font-black text-slate-800">{gw.label}</p>
                            <p className="text-[10px] text-slate-500">{gw.subtitle}</p>
                          </div>
                          <div className="text-slate-300 group-hover:text-indigo-500 font-black text-lg transition">→</div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* STEP 2: Payment details for selected gateway */}
              {selectedGateway && selectedGateway !== "safepay" && (() => {
                const details = getGatewayDetails();
                if (!details) return null;
                return (
                  <div className="space-y-4">
                    {/* Account Info Box */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Send Payment To:</p>
                      {details.accountTitle && (
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-500">Account Title</div>
                          <div className="text-sm font-black text-slate-900">{details.accountTitle}</div>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-600">{details.label}</div>
                        <div className="text-sm font-black text-slate-900 font-mono">{details.account}</div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t mt-1">
                        <div className="text-xs font-semibold text-slate-600">Amount to Send:</div>
                        <div className="text-base font-black text-emerald-700">
                          {currencySymbol} {(useCreditsDiscount ? Math.max(0, selectedPlan.price - Number(shopDetails?.referral_credits || 0)) : selectedPlan.price).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* QR Code */}
                    {details.qrUrl && (
                      <div className="text-center">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Scan QR Code to Pay:</p>
                        <img src={details.qrUrl} alt="QR Code" className="mx-auto w-40 h-40 object-contain border border-slate-200 rounded-2xl p-2 bg-white shadow-sm" />
                      </div>
                    )}

                    {/* Transaction Ref */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Transaction Reference / TID</label>
                      <input
                        type="text"
                        value={transactionRef}
                        onChange={e => setTransactionRef(e.target.value)}
                        placeholder="Enter transaction ID from your payment app"
                        className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-400"
                      />
                    </div>

                    {/* Screenshot Upload */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Payment Screenshot</label>
                      {screenshotPreview ? (
                        <div className="relative">
                          <img src={screenshotPreview} alt="Screenshot" className="w-full rounded-xl max-h-48 object-cover border border-slate-200" />
                          <button
                            onClick={() => { setScreenshot(null); setScreenshotPreview(null); }}
                            className="absolute top-2 right-2 h-6 w-6 rounded-full bg-rose-500 text-white flex items-center justify-center"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 flex flex-col items-center gap-2 text-slate-400 hover:text-indigo-500 transition"
                        >
                          <Upload size={20} />
                          <div className="text-xs font-bold">Click to upload screenshot</div>
                          <div className="text-[10px]">JPG, PNG, WEBP up to 5MB</div>
                        </button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotChange}
                        className="hidden"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      onClick={handleManualPaymentSubmit}
                      disabled={submitting || !screenshot || !transactionRef.trim()}
                      className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                      {submitting ? "Submitting..." : "Submit Payment for Review"}
                    </button>
                    <p className="text-[10px] text-center text-slate-400">Your plan will be activated within a few hours after admin review.</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
