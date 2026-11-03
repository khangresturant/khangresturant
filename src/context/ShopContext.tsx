"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getPlatformShopId } from "@/lib/config";
import { resolveAccess, canAccessPath } from "@/lib/auth/resolveAccess";
import { isSuperAdmin } from "@/lib/auth/roles";
import { resolvePlan, getEffectiveTierId } from "@/lib/planMatrix";
import {
  getGraceDaysRemaining,
  getSubscriptionLifecycle,
  isSubscriptionLocked,
} from "@/lib/subscription/grace-period";
import {
  isPermanentRestaurantLicense,
  shouldHideBillingAndPlans,
  PERMANENT_PLAN_LABEL,
  isFlame9Brand,
  shouldDisableBackupRestore,
  shouldHideSupportTickets,
} from "@/lib/deployment/flame9-brand";
import { isLocalSqliteEnabled } from "@/lib/config";
import { FLAME9_LOCAL_SHOP_ID } from "@/lib/local-sqlite/seed-data";

type ShopContextType = {
  isImpersonating?: boolean;
  saasPlans?: any;
  planName?: string;
  effectiveTier?: string;
  subscriptionLocked?: boolean;
  subscriptionLifecycle?: string;
  graceDaysRemaining?: number;
  canAccessDashboardPath: (path: string) => boolean;
  hasGiftCards?: boolean;
  hasEcommerce?: boolean;
  userId: string | null;
  shopId: string | null;
  industryType: string | null;
  shopName: string | null;
  shopPhone: string | null;
  shopAddress: string | null;
  shopEmail: string | null;
  shopLogo: string | null;
  userRole: string | null;
  userName: string | null;
  permissions: any | null;
  loading: boolean;
  allowNegativeStock: boolean;
  hasLoyalty: boolean;
  hasEmi: boolean;
  hasPayroll: boolean;
  hasTax: boolean;
  defaultTaxRate: number;
  defaultTaxType: "percentage" | "flat" | string;
  hasAssetsRec: boolean;
  subscriptionTier: string | null;
  subscriptionExpiresAt: string | null;
  allowAccounts: boolean;
  allowReports: boolean;
  allowExpenses: boolean;
  allowIndustrialAccounts: boolean;
  allowSimpleAccounts: boolean;
  allowBackup: boolean;
  allowBarcode: boolean;
  allowMultiShop: boolean;
  allowUniversalImport: boolean;
  allowAiProductAdd: boolean;
  allowAiPurchaseOrder: boolean;
  allowWhatsapp: boolean;
  maxDevices: string;
  systemAnnouncement: { message: string; type: string; active: boolean } | null;
  selectedCurrency: string;
  branchId: string | null;

  // Closing Book support:
  activeClosingBook: { id: string; name: string; type: string; closed_at: string } | null;
  closingBooks: any[];
  switchClosingBook: (book: any | null) => void;
  fetchClosingBooks: (sId?: string) => Promise<void>;
  activeLanguages: string[];
  billingLanguage: string;
  timezone: string;
  showCostPriceOnPos: boolean;
  setShowCostPriceOnPos?: (val: boolean) => void;
  refreshShopData: () => Promise<void>;
};

const defaultPermissions = {
  panels: {
    dashboard: true,
    pos: true,
    sales: true,
    registers: true,
    purchase: true,
    products: true,
    categories: true,
    brands: true,
    units: true,
    khata: true,
    returns: true,
    expenses: true,
    accounts: true,
    reports: true,
    staff: false,
    backup: false
  },
  actions: {
    edit_bill: false,
    delete_bill: false,
    edit_account: false,
    delete_account: false
  }
};

const INITIAL_SHOP_STATE: Omit<ShopContextType, "activeClosingBook" | "closingBooks" | "switchClosingBook" | "fetchClosingBooks"> = {
  isImpersonating: false,
  userId: null,
  shopId: null,
  industryType: null,
  shopName: null,
  shopPhone: null,
  shopAddress: null,
  shopEmail: null,
  shopLogo: null,
  userRole: null,
  userName: null,
  permissions: null,
  loading: true,
  allowNegativeStock: false,
  hasLoyalty: true,
  hasGiftCards: true,
  hasEcommerce: false,
  hasEmi: false,
  hasPayroll: false,
  hasTax: false,
  defaultTaxRate: 0,
  defaultTaxType: "percentage",
  hasAssetsRec: false,
  subscriptionTier: null,
  subscriptionExpiresAt: null,
  allowAccounts: false,
  allowReports: false,
  allowExpenses: false,
  allowIndustrialAccounts: false,
  allowSimpleAccounts: true,
  allowBackup: false,
  allowBarcode: false,
  allowMultiShop: false,
  allowUniversalImport: false,
  allowAiProductAdd: false,
  allowAiPurchaseOrder: false,
  allowWhatsapp: false,
  maxDevices: "1",
  systemAnnouncement: null,
  selectedCurrency: "PKR",
  branchId: null,
  activeLanguages: ["en", "ur"],
  billingLanguage: "en",
  timezone: "auto",
  showCostPriceOnPos: false,
  setShowCostPriceOnPos: () => {},
  canAccessDashboardPath: () => true,
  refreshShopData: async () => {},
};

const ShopContext = createContext<ShopContextType>({
  ...INITIAL_SHOP_STATE,
  canAccessDashboardPath: () => true,
  activeClosingBook: null,
  closingBooks: [],
  switchClosingBook: () => {},
  fetchClosingBooks: async () => {},
});

export const useShop = () => useContext(ShopContext);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [state, setState] = useState(INITIAL_SHOP_STATE);

  const [activeClosingBook, setActiveClosingBook] = useState<{ id: string; name: string; type: string; closed_at: string } | null>(null);
  const [closingBooks, setClosingBooks] = useState<any[]>([]);

  const fetchClosingBooks = async (sId?: string) => {
    const targetShopId = sId || state.shopId;
    if (!targetShopId) return;
    try {
      const { data, error } = await supabase
        .from("closing_books")
        .select("*")
        .eq("shop_id", targetShopId)
        .order("closed_at", { ascending: false });
      if (!error && data) {
        setClosingBooks(data);
      }
    } catch (e) {
      console.error("Error fetching closing books:", e);
    }
  };

  const switchClosingBook = (book: any | null) => {
    setActiveClosingBook(book);
  };

  useEffect(() => {
    const skipCacheOuter = isFlame9Brand() || isLocalSqliteEnabled();
    if (typeof window !== "undefined" && !skipCacheOuter) {
      try {
        const isImpersonating = localStorage.getItem("is_impersonating") === "true" && Boolean(localStorage.getItem("impersonated_shop_name"));
        const impersonatedShopId = localStorage.getItem("impersonated_shop_id");
        const cached = localStorage.getItem("hisabx_shop_context");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!isImpersonating || parsed.shopId === impersonatedShopId) {
            setState(prev => ({
              ...prev,
              ...parsed,
              loading: false,
            }));
          }
        }
      } catch (e) {
        console.warn("Failed to load cached shop context from localStorage", e);
      }
    }

    // 2. Fetch fresh data from Supabase Auth & Shop
    async function loadShopData() {
      const skipCache = isFlame9Brand() || isLocalSqliteEnabled();
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (typeof window !== "undefined") {
            if (!skipCache) {
              localStorage.removeItem("hisabx_shop_context");
              localStorage.removeItem("The Accounts_shop_context");
            }
            const path = window.location.pathname;
            if (!path.startsWith("/login") && !path.startsWith("/register")) {
              window.location.replace("/login");
            }
          }
          setState(prev => ({ ...prev, loading: false }));
          return;
        }

        // Fetch User Profile
        const { data: profileRow } = await supabase
          .from("user_profiles")
          .select("shop_id, role, name, permissions")
          .eq("id", user.id)
          .maybeSingle();

        let profile = profileRow;

        if (!profile?.shop_id && skipCache) {
          profile = {
            shop_id: FLAME9_LOCAL_SHOP_ID,
            role: user.id === "flame9-staff-local" ? "staff" : "superadmin",
            name: user.email?.includes("staff") ? "POS Staff" : "Flame 9 Admin",
            permissions: profileRow?.permissions ?? null,
          };
        }

        const isUserSuperAdmin = isSuperAdmin({ role: profile?.role, email: user.email });
        const isImpersonating = typeof window !== "undefined" && localStorage.getItem("is_impersonating") === "true" && Boolean(localStorage.getItem("impersonated_shop_name"));
        const impersonatedShopId = typeof window !== "undefined" ? localStorage.getItem("impersonated_shop_id") : null;
        const impersonatedShopName = typeof window !== "undefined" ? localStorage.getItem("impersonated_shop_name") : null;
        const activeShopPref = typeof window !== "undefined" ? (localStorage.getItem("current_shop_id") || localStorage.getItem("active_shop_id")) : null;

        let effectiveShopId = (isUserSuperAdmin && isImpersonating && impersonatedShopId)
          ? impersonatedShopId
          : isFlame9Brand() || isLocalSqliteEnabled()
            ? FLAME9_LOCAL_SHOP_ID
            : profile?.shop_id || activeShopPref || impersonatedShopId;

        if (!effectiveShopId) {
          const { data: uShop } = await supabase
            .from('user_shops')
            .select('shop_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

          if (uShop?.shop_id) {
            effectiveShopId = uShop.shop_id;
          } else {
            const { data: ownedShop } = await supabase
              .from('shops')
              .select('id')
              .eq('owner_id', user.id)
              .limit(1)
              .maybeSingle();

            if (ownedShop?.id) {
              effectiveShopId = ownedShop.id;
            } else if (isUserSuperAdmin) {
              const { data: restShop } = await supabase
                .from('shops')
                .select('id')
                .eq('industry_type', 'restaurant')
                .limit(1)
                .maybeSingle();

              effectiveShopId = restShop?.id;
              if (!effectiveShopId) {
                const { data: anyShop } = await supabase
                  .from('shops')
                  .select('id')
                  .limit(1)
                  .maybeSingle();
                effectiveShopId = anyShop?.id;
              }
            }
          }
        }

        if (effectiveShopId) {
          // Fetch Shop Details, Print Settings, and SaaS configurations in parallel to optimize latency (AUTH-03)
          const platformShopId = getPlatformShopId();
          const [shopRes, printRowRes, currentCompanyRes, platformConfigRes] = await Promise.all([
            supabase
              .from("shops")
              .select("name, phone, address, industry_type, allow_negative_stock, has_emi, has_payroll, has_tax, default_tax_rate, default_tax_type, has_assets_rec, has_loyalty, has_gift_cards, has_ecommerce, subscription_tier, subscription_expires_at")
              .eq("id", effectiveShopId)
              .single(),
            supabase
              .from("print_settings")
              .select("receipt_design_settings")
              .eq("shop_id", effectiveShopId)
              .maybeSingle(),
            supabase
              .from("company_details")
              .select("name, address, phone, email, logo_path, website")
              .eq("shop_id", effectiveShopId)
              .maybeSingle(),
            platformShopId
              ? supabase
                  .from("company_details")
                  .select("website")
                  .eq("shop_id", platformShopId)
                  .limit(1)
              : Promise.resolve({ data: null })
          ]);

          const shop = shopRes.data;
          const printRow = printRowRes.data;
          const companyDetails = currentCompanyRes?.data;
          const configRows = platformConfigRes?.data;

          const rawPhone1 = (companyDetails?.phone || "").trim();
          const rawPhone2 = (shop?.phone || "").trim();
          let resolvedShopPhone: string | null = null;
          if (rawPhone1 && rawPhone2 && rawPhone1 !== rawPhone2) {
            resolvedShopPhone = `${rawPhone1}, ${rawPhone2}`;
          } else {
            resolvedShopPhone = rawPhone1 || rawPhone2 || null;
          }

          const resolvedShopAddress = (companyDetails?.address || "").trim() || (shop?.address || "").trim() || null;
          const resolvedShopEmail = (companyDetails?.email || "").trim() || null;
          const resolvedShopLogo = companyDetails?.logo_path || null;

          const printSettings = printRow?.receipt_design_settings || {};
          const activeLanguages = (printSettings as any)?.activeLanguages || ["en", "ur"];
          const billingLanguage = (printSettings as any)?.billingLanguage || "en";
          const timezone = (printSettings as any)?.timezone || "auto";
          const selectedCurrency = (printSettings as any)?.selectedCurrency || "PKR";

          let saasPlans: any[] = [];
          let systemAnnouncement = null;
          if (platformShopId && configRows) {
            const config = configRows?.[0];
            if (config?.website && config.website.startsWith("{")) {
              try {
                const parsed = JSON.parse(config.website);
                if (parsed.saas_plans && Array.isArray(parsed.saas_plans)) {
                  saasPlans = parsed.saas_plans;
                }
                if (parsed.system_announcement) {
                  systemAnnouncement = parsed.system_announcement;
                }
              } catch (e) {}
            }
          }

          const subscriptionTier = shop?.subscription_tier || "free";
          const subscriptionExpiresAt = shop?.subscription_expires_at || null;
          const permanentLicense = isPermanentRestaurantLicense();
          const hideBilling = shouldHideBillingAndPlans();

          // Single access resolver: plan × shop toggles × staff permissions
          const access = resolveAccess({
            role: profile?.role,
            email: user.email,
            subscriptionTier,
            subscriptionExpiresAt,
            remotePlans: saasPlans,
            permissions: profile?.permissions || null,
            shopToggles: {
              has_emi: shop?.has_emi,
              has_payroll: shop?.has_payroll,
              has_tax: shop?.has_tax,
              has_assets_rec: shop?.has_assets_rec,
              has_loyalty: shop?.has_loyalty,
              has_gift_cards: shop?.has_gift_cards,
              has_ecommerce: shop?.has_ecommerce,
              allow_negative_stock: shop?.allow_negative_stock,
            },
          });

          const userPerms = {
            panels: access.panels,
            actions: access.actions,
            max_discount_percentage: access.maxDiscountPercentage,
          };

          const effectiveTier = getEffectiveTierId(subscriptionTier, subscriptionExpiresAt);
          const plan = resolvePlan(effectiveTier, saasPlans);
          const subscriptionLifecycle = getSubscriptionLifecycle(subscriptionTier, subscriptionExpiresAt);
          let subscriptionLocked = isSubscriptionLocked(subscriptionTier, subscriptionExpiresAt);
          if (permanentLicense) {
            subscriptionLocked = false;
          }
          const graceDaysRemaining = getGraceDaysRemaining(subscriptionExpiresAt);
          const planName = permanentLicense ? PERMANENT_PLAN_LABEL : plan.name;

          const canAccessDashboardPath = (p: string) => {
            if (hideBilling && p.startsWith("/dashboard/billing")) return false;
            if (shouldDisableBackupRestore() && p.startsWith("/dashboard/backup")) return false;
            if (shouldHideSupportTickets() && p.startsWith("/dashboard/support")) return false;
            return canAccessPath(access, p);
          };

          const updatedState = {
            userId: user.id,
            shopId: effectiveShopId,
            industryType: shop?.industry_type || "general",
            shopName: shop?.name || impersonatedShopName || "My Shop",
            shopPhone: resolvedShopPhone,
            shopAddress: resolvedShopAddress,
            shopEmail: resolvedShopEmail,
            shopLogo: resolvedShopLogo,
            userRole: profile?.role || "staff",
            userName: profile?.name || "User",
            permissions: userPerms,
            loading: false,
            allowNegativeStock: access.allowNegativeStock,
            hasLoyalty: access.hasLoyalty,
            hasGiftCards: access.hasGiftCards,
            hasEcommerce: access.hasEcommerce,
            hasEmi: access.hasEmi,
            hasPayroll: access.hasPayroll,
            hasTax: access.hasTax,
            defaultTaxRate: Number(shop?.default_tax_rate || 0),
            defaultTaxType: shop?.default_tax_type || "percentage",
            hasAssetsRec: access.hasAssetsRec,
            subscriptionTier: subscriptionTier,
            subscriptionExpiresAt: subscriptionExpiresAt,
            allowAccounts: access.allowAccounts,
            allowReports: access.allowReports,
            allowExpenses: access.allowExpenses,
            allowIndustrialAccounts: access.allowIndustrialAccounts,
            allowSimpleAccounts: true,
            allowBackup: access.allowBackup,
            allowBarcode: access.allowBarcode,
            allowMultiShop: access.allowMultiShop,
            allowUniversalImport: access.allowUniversalImport,
            allowAiProductAdd: access.allowAiProductAdd,
            allowAiPurchaseOrder: access.allowAiPurchaseOrder,
            allowWhatsapp: isFlame9Brand() ? false : access.allowWhatsapp,
            maxDevices: access.maxDevices,
            systemAnnouncement,
            selectedCurrency,
            branchId: effectiveShopId,
            activeLanguages,
            billingLanguage,
            timezone,
            showCostPriceOnPos: Boolean(
              (printSettings as any)?.showCostPriceOnPos ??
              (typeof window !== "undefined" ? localStorage.getItem(`theaccounts_show_cost_price_on_pos_${effectiveShopId}`) === "true" : false)
            ),
            canAccessDashboardPath,
            isImpersonating: Boolean(isUserSuperAdmin && isImpersonating && impersonatedShopId && impersonatedShopName),
            saasPlans,
            planName,
            effectiveTier,
            subscriptionLocked,
            subscriptionLifecycle,
            graceDaysRemaining,
          };

          if (typeof window !== "undefined" && !skipCache) {
            try {
              localStorage.setItem("hisabx_shop_context", JSON.stringify(updatedState));
            } catch (e) {}
          }

          setState({
            ...updatedState,
            setShowCostPriceOnPos: (val: boolean) => {
              setState(prev => ({ ...prev, showCostPriceOnPos: val }));
              if (typeof window !== "undefined" && effectiveShopId) {
                localStorage.setItem(`theaccounts_show_cost_price_on_pos_${effectiveShopId}`, val ? "true" : "false");
              }
            },
            refreshShopData: loadShopData
          });

          await fetchClosingBooks(effectiveShopId);
        } else {
          setState(prev => ({ ...prev, loading: false }));
          if (typeof window !== "undefined") {
            window.location.href = "/register";
          }
        }
      } catch (error) {
        console.error("Error loading shop data:", error);
        setState(prev => ({ ...prev, loading: false }));
      }
    }

    loadShopData();
  }, [supabase]);

  return (
    <ShopContext.Provider value={{ ...state, activeClosingBook, closingBooks, switchClosingBook, fetchClosingBooks }}>
      {children}
    </ShopContext.Provider>
  );
}
