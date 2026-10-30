"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2, Key,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Store,
  ToggleLeft,
  ToggleRight,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getPlatformShopId } from "@/lib/config";
import {
  mergeRemotePlansWithDefaults,
  type AdminSaasPlan,
} from "@/lib/billing/plan-display";
import {
  extendSubscriptionExpiry,
  getSubscriptionStatus,
  shopTogglesFromPlan,
} from "@/lib/admin/shop-plan-sync";
import {
  FLAME9,
  isFlame9Brand,
  PERMANENT_PLAN_LABEL,
} from "@/lib/deployment/flame9-brand";

type ShopOwner = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AdminShop = {
  id: string;
  name: string;
  phone: string | null;
  industry_type: string;
  subscription_tier: string | null;
  subscription_expires_at: string | null;
  created_at: string;
  owner_id: string | null;
  allow_negative_stock: boolean;
  has_emi: boolean;
  has_payroll: boolean;
  has_tax: boolean;
  has_assets_rec: boolean;
  has_loyalty: boolean;
  owner: ShopOwner | null;
};

type ShopUpdates = Partial<
  Pick<
    AdminShop,
    | "subscription_tier"
    | "subscription_expires_at"
    | "allow_negative_stock"
    | "has_emi"
    | "has_payroll"
    | "has_tax"
    | "has_assets_rec"
    | "has_loyalty"
    | "industry_type"
  >
>;

const INDUSTRY_LABELS: Record<string, string> = {
  general: "General Retail",
  karyana: "Karyana",
  restaurant: "Restaurant",
  pharmacy: "Pharmacy",
  fertilizer: "Fertilizer",
  garments: "Garments",
  showroom: "Showroom",
  tailor: "Tailor",
  electronics: "Electronics",
};

function StatusBadge({ tier, expiresAt }: { tier: string | null; expiresAt: string | null }) {
  const status = getSubscriptionStatus(tier, expiresAt);
  const styles = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    expired: "bg-rose-50 text-rose-700 border-rose-200",
    trial: "bg-amber-50 text-amber-800 border-amber-200",
    none: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const labels = {
    active: "Active",
    expired: "Expired",
    trial: "Trial / No expiry",
    none: "No expiry set",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${styles[status]}`}
    >
      {status === "active" ? <CheckCircle2 size={10} /> : status === "expired" ? <XCircle size={10} /> : <Clock size={10} />}
      {labels[status]}
    </span>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/70">
      <div className="min-w-0">
        <span className="font-bold text-[10px] text-slate-700 block">{label}</span>
        {hint ? <span className="text-[9px] text-slate-400 font-medium">{hint}</span> : null}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className="text-slate-500 hover:text-indigo-600 disabled:opacity-40 shrink-0"
        aria-pressed={checked}
      >
        {checked ? (
          <ToggleRight className="text-emerald-500 h-6 w-6" />
        ) : (
          <ToggleLeft className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}

export default function AdminShopsPage() {
  const handleImpersonateShop = (shop: AdminShop) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("impersonated_shop_id", shop.id);
      localStorage.setItem("impersonated_shop_name", shop.name);
      localStorage.setItem("impersonated_user_name", shop.owner?.name || "Customer");
      localStorage.setItem("is_impersonating", "true");
      localStorage.removeItem("hisabx_shop_context");
      localStorage.removeItem("The Accounts_shop_context");

      toast.success(`Logging in as SaaS Admin to ${shop.name}...`);
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 500);
    }
  };
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shops, setShops] = useState<AdminShop[]>([]);
  const [saasPlans, setSaasPlans] = useState<AdminSaasPlan[]>([]);
  const [savingShopId, setSavingShopId] = useState<string | null>(null);

  const [shopSearch, setShopSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState(isFlame9Brand() ? "restaurant" : "all");
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "trial">("all");

  const loadPlans = useCallback(async () => {
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
  }, [supabase]);

  const loadShops = useCallback(async () => {
    const res = await fetch("/api/admin/shops");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load shops");
    setShops(data.shops || []);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([loadShops(), loadPlans()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadShops, loadPlans]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const updateShop = async (shopId: string, updates: ShopUpdates) => {
    setSavingShopId(shopId);
    try {
      const res = await fetch("/api/admin/shops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      setShops((prev) =>
        prev.map((s) =>
          s.id === shopId
            ? {
                ...s,
                ...data.shop,
                owner: s.owner,
              }
            : s
        )
      );
      toast.success(
        updates.subscription_tier || updates.subscription_expires_at
          ? "Business updated — customer receipt email sent."
          : "Business updated"
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingShopId(null);
    }
  };

  const handlePlanChange = async (shop: AdminShop, newTier: string) => {
    const updates: ShopUpdates = { subscription_tier: newTier };
    const status = getSubscriptionStatus(shop.subscription_tier, shop.subscription_expires_at);
    if (newTier !== "free" && (status === "expired" || status === "trial" || status === "none")) {
      updates.subscription_expires_at = extendSubscriptionExpiry(shop.subscription_expires_at, 30);
    }
    await updateShop(shop.id, updates);
  };

  const applyPlanDefaults = async (shop: AdminShop) => {
    const tier = shop.subscription_tier || "free";
    const toggles = shopTogglesFromPlan(tier, saasPlans);
    await updateShop(shop.id, toggles);
  };

  /** Flame 9 / Pizza House & Café — permanent premium, restaurant only, no billing expiry. */
  const confirmPermanentRestaurant = async (shop: AdminShop) => {
    const toggles = shopTogglesFromPlan("premium", saasPlans);
    await updateShop(shop.id, {
      industry_type: "restaurant",
      subscription_tier: "premium",
      subscription_expires_at: null,
      ...toggles,
    });
    toast.success(`${shop.name}: ${PERMANENT_PLAN_LABEL} confirmed.`);
  };

  const stats = useMemo(() => {
    const now = new Date();
    let active = 0;
    let expired = 0;
    for (const s of shops) {
      const st = getSubscriptionStatus(s.subscription_tier, s.subscription_expires_at);
      if (st === "active") active++;
      if (st === "expired") expired++;
    }
    return { total: shops.length, active, expired };
  }, [shops]);

  const planOptions = useMemo(
    () =>
      saasPlans.map((p) => ({
        id: p.id,
        name: String(p.name || p.id),
        price: Number(p.monthly_price) || 0,
      })),
    [saasPlans]
  );

  const filteredShops = useMemo(() => {
    return shops.filter((s) => {
      const q = shopSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.owner?.email && s.owner.email.toLowerCase().includes(q)) ||
        (s.owner?.name && s.owner.name.toLowerCase().includes(q));

      const matchesIndustry =
        industryFilter === "all" || s.industry_type === industryFilter;

      const tier = s.subscription_tier || "free";
      const matchesTier = tierFilter === "all" || tier === tierFilter;

      const st = getSubscriptionStatus(s.subscription_tier, s.subscription_expires_at);
      const matchesStatus = statusFilter === "all" || st === statusFilter;

      return matchesSearch && matchesIndustry && matchesTier && matchesStatus;
    });
  }, [shops, shopSearch, industryFilter, tierFilter, statusFilter]);

  if (loading) {
    return (
      <div className="h-64 flex flex-col justify-center items-center text-slate-450">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-2" />
        <p className="text-xs font-semibold">Loading business registry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isFlame9Brand() ? (
        <div className="rounded-2xl border border-[#FF4D00]/30 bg-gradient-to-r from-[#14110F] to-[#2a1810] text-white p-5 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#FF8A3D]">Super Admin — confirmed</p>
              <h3 className="text-lg font-black mt-1">{FLAME9.fullName}</h3>
              <p className="text-xs text-white/75 mt-2 max-w-2xl leading-relaxed">
                Sirf <strong>Pizza House &amp; Café (restaurant)</strong> modules — tables, POS, KDS, deals, café.
                <strong> Permanent license</strong>, koi payment plan / subscription checkout nahi.
              </p>
            </div>
            <ul className="text-[10px] font-bold space-y-1 text-[#FF8A3D]/90 shrink-0">
              <li>✓ Industry: Restaurant</li>
              <li>✓ Tier: Premium (no expiry)</li>
              <li>✓ Billing UI: Hidden</li>
            </ul>
          </div>
        </div>
      ) : null}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Store className="text-amber-500" size={22} />
            Business Directory
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1 max-w-xl">
            Manage every tenant shop — assign SaaS plans from Admin Plans, set expiry, and toggle
            industry modules. Changes apply instantly via secure admin API.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            loadAll();
          }}
          className="rounded-xl font-bold text-xs gap-2 shrink-0"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Businesses", value: stats.total, icon: Building2, color: "text-indigo-600" },
          { label: "Active Subscriptions", value: stats.active, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Expired", value: stats.expired, icon: AlertTriangle, color: "text-rose-600" },
          { label: "Plans Configured", value: planOptions.length, icon: Sparkles, color: "text-amber-600" },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <item.icon size={14} className={item.color} />
              <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
            </div>
            <p className="text-2xl font-black text-slate-800">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search name, phone, owner email..."
            value={shopSearch}
            onChange={(e) => setShopSearch(e.target.value)}
            className="pl-9 bg-slate-50 border-slate-200 h-10 text-xs"
          />
        </div>
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 h-10 rounded-xl px-3 text-xs font-semibold min-w-[140px]"
        >
          <option value="all">All Industries</option>
          {Object.entries(INDUSTRY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 h-10 rounded-xl px-3 text-xs font-semibold min-w-[140px]"
        >
          <option value="all">All Plans</option>
          {planOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="bg-slate-50 border border-slate-200 h-10 rounded-xl px-3 text-xs font-semibold min-w-[140px]"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="trial">Trial / No expiry</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {filteredShops.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-2xl">
            <Users className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-sm font-bold text-slate-500">No businesses match your filters</p>
          </div>
        ) : (
          filteredShops.map((shop) => {
            const tier = shop.subscription_tier || "free";
            const planMeta = planOptions.find((p) => p.id === tier);
            const isSaving = savingShopId === shop.id;
            const expiryInput = shop.subscription_expires_at
              ? shop.subscription_expires_at.split("T")[0]
              : "";

            return (
              <article
                key={shop.id}
                className="bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden"
              >
                {/* Card header */}
                <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-black text-slate-800 text-sm truncate">{shop.name}</h3>
                      <p className="text-[10px] text-indigo-600 font-bold capitalize mt-0.5">
                        {INDUSTRY_LABELS[shop.industry_type] || shop.industry_type}
                        {shop.phone ? ` • ${shop.phone}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge tier={shop.subscription_tier} expiresAt={shop.subscription_expires_at} />
                        <span className="text-[9px] font-bold text-slate-400">
                          Joined {new Date(shop.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end shrink-0">
                      {isFlame9Brand() ? (
                        <>
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-center">
                            {PERMANENT_PLAN_LABEL}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isSaving}
                            onClick={() => confirmPermanentRestaurant(shop)}
                            className="rounded-xl font-black text-[10px] uppercase tracking-wider bg-[#FF4D00] hover:bg-[#C93400] text-white"
                          >
                            Confirm restaurant only
                          </Button>
                        </>
                      ) : (
                        <>
                          <select
                            value={tier}
                            disabled={isSaving}
                            onChange={(e) => handlePlanChange(shop, e.target.value)}
                            className="bg-white border border-slate-200 text-[11px] font-black rounded-xl px-3 py-2 cursor-pointer text-slate-700 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                          >
                            {planOptions.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                                {p.price > 0 ? ` — Rs ${p.price}/mo` : ""}
                              </option>
                            ))}
                          </select>
                          {planMeta ? (
                            <span className="text-[9px] font-bold text-slate-400 text-right">
                              Plan ID: <code className="text-slate-600">{tier}</code>
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Owner */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Owner / Primary User
                    </p>
                    {shop.owner ? (
                      <>
                        <p className="text-xs font-bold text-slate-800">{shop.owner.name}</p>
                        <p className="text-[10px] text-slate-500">{shop.owner.email}</p>
                        <p className="text-[9px] text-slate-400 capitalize mt-0.5">Role: {shop.owner.role}</p>
                      </>
                    ) : (
                      <p className="text-xs font-semibold text-amber-700">No owner linked — check registrations</p>
                    )}
                  </div>
                </div>

                {/* Subscription expiry */}
                <div className="px-5 py-4 border-b border-slate-100 space-y-3">
                  <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleImpersonateShop(shop)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-[10px] shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                        title="Login as SaaS Admin to this Business"
                      >
                        <Key size={11} /> Login as SaaS Admin
                      </button>
                    <Calendar size={14} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Subscription Expiry
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="date"
                      key={`${shop.id}-${expiryInput}`}
                      defaultValue={expiryInput}
                      disabled={isSaving}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const iso = new Date(val + "T23:59:59").toISOString();
                        if (iso !== shop.subscription_expires_at) {
                          updateShop(shop.id, { subscription_expires_at: iso });
                        }
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold flex-1 min-w-[140px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSaving}
                      className="text-[10px] font-bold rounded-xl h-9"
                      onClick={() =>
                        updateShop(shop.id, {
                          subscription_expires_at: extendSubscriptionExpiry(
                            shop.subscription_expires_at,
                            30
                          ),
                        })
                      }
                    >
                      +30 days
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSaving}
                      className="text-[10px] font-bold rounded-xl h-9"
                      onClick={() =>
                        updateShop(shop.id, {
                          subscription_expires_at: extendSubscriptionExpiry(
                            shop.subscription_expires_at,
                            365
                          ),
                        })
                      }
                    >
                      +1 year
                    </Button>
                  </div>
                </div>

                {/* Module toggles */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Shop Module Toggles
                    </p>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => applyPlanDefaults(shop)}
                      className="text-[9px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Sparkles size={11} />
                      Sync from plan
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <ToggleRow
                      label="Negative Stock"
                      hint="Allow selling below zero qty"
                      checked={!!shop.allow_negative_stock}
                      disabled={isSaving}
                      onToggle={() =>
                        updateShop(shop.id, { allow_negative_stock: !shop.allow_negative_stock })
                      }
                    />
                    <ToggleRow
                      label="EMI / Installments"
                      checked={!!shop.has_emi}
                      disabled={isSaving}
                      onToggle={() => updateShop(shop.id, { has_emi: !shop.has_emi })}
                    />
                    <ToggleRow
                      label="Staff Payroll"
                      checked={!!shop.has_payroll}
                      disabled={isSaving}
                      onToggle={() => updateShop(shop.id, { has_payroll: !shop.has_payroll })}
                    />
                    <ToggleRow
                      label="Tax Systems"
                      checked={!!shop.has_tax}
                      disabled={isSaving}
                      onToggle={() => updateShop(shop.id, { has_tax: !shop.has_tax })}
                    />
                    <ToggleRow
                      label="Fixed Assets"
                      checked={!!shop.has_assets_rec}
                      disabled={isSaving}
                      onToggle={() => updateShop(shop.id, { has_assets_rec: !shop.has_assets_rec })}
                    />
                    <ToggleRow
                      label="Loyalty Points"
                      checked={shop.has_loyalty !== false}
                      disabled={isSaving}
                      onToggle={() => updateShop(shop.id, { has_loyalty: !shop.has_loyalty })}
                    />
                  </div>
                </div>

                {isSaving && (
                  <div className="mx-5 mb-5 flex items-center justify-center text-[10px] text-indigo-600 font-bold bg-indigo-50 py-2 rounded-xl border border-indigo-100 animate-pulse">
                    <Loader2 size={12} className="animate-spin mr-1.5" />
                    Saving to database...
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
