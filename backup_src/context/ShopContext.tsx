"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ShopContextType = {
  userId: string | null;
  shopId: string | null;
  industryType: string | null;
  shopName: string | null;
  userRole: string | null;
  userName: string | null;
  permissions: any | null;
  loading: boolean;
  allowNegativeStock: boolean;
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

const ShopContext = createContext<ShopContextType>({
  userId: null,
  shopId: null,
  industryType: null,
  shopName: null,
  userRole: null,
  userName: null,
  permissions: null,
  loading: true,
  allowNegativeStock: false,
});

export const useShop = () => useContext(ShopContext);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ShopContextType>({
    userId: null,
    shopId: null,
    industryType: null,
    shopName: null,
    userRole: null,
    userName: null,
    permissions: null,
    loading: true,
    allowNegativeStock: false,
  });

  const [supabase] = useState(() => createClient());

  useEffect(() => {
    async function loadShopData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setState(prev => ({ ...prev, loading: false }));
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          return;
        }

        // Fetch User Profile
        const { data: profile, error: profileErr } = await supabase
          .from("user_profiles")
          .select("shop_id, role, name, permissions")
          .eq("id", user.id)
          .single();

        if (profile?.shop_id) {
          // Fetch Shop Details
          const { data: shop } = await supabase
            .from("shops")
            .select("name, industry_type, allow_negative_stock")
            .eq("id", profile.shop_id)
            .single();

          // Settle permissions
          const isSuperAdmin = profile?.role === "superadmin";
          const userPerms = isSuperAdmin 
            ? {
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
                  staff: true,
                  backup: true
                },
                actions: {
                  edit_bill: true,
                  delete_bill: true,
                  edit_account: true,
                  delete_account: true
                }
              }
            : {
                panels: {
                  ...defaultPermissions.panels,
                  ...(profile?.permissions?.panels || {})
                },
                actions: {
                  ...defaultPermissions.actions,
                  ...(profile?.permissions?.actions || {})
                }
              };

          setState({
            userId: user.id,
            shopId: profile.shop_id,
            industryType: shop?.industry_type || "general",
            shopName: shop?.name || "My Shop",
            userRole: profile.role || "staff",
            userName: profile.name || "User",
            permissions: userPerms,
            loading: false,
            allowNegativeStock: !!shop?.allow_negative_stock,
          });
        } else {
          setState(prev => ({ ...prev, loading: false }));
          if (typeof window !== "undefined") {
            window.location.href = "/login";
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
    <ShopContext.Provider value={state}>
      {children}
    </ShopContext.Provider>
  );
}
