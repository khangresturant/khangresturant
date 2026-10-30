"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Check, ChevronDown, LogOut, Plus } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useShop } from "@/context/ShopContext";
import { UserProfileModal } from "@/components/dashboard/UserProfileModal";
import { createClient } from "@/lib/supabase/client";
import { flame9LogoutCleanup } from "@/lib/deployment/flame9-session";
import { isFlame9Brand } from "@/lib/deployment/flame9-brand";

type SidebarFooterProps = {
  showCollapsed: boolean;
};

type UserShop = {
  id: string;
  name: string;
  industryType: string;
};

export function SidebarFooter({ showCollapsed }: SidebarFooterProps) {
  const { t } = useLanguage();
  const { shopId, userName, shopName, userRole, loading } = useShop();
  const supabase = createClient();

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [myShops, setMyShops] = useState<UserShop[]>([]);

  useEffect(() => {
    async function loadUserShops() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_shops")
        .select(`
          shop_id,
          shops (id, name, industry_type)
        `)
        .eq("user_id", user.id);

      if (!error && data) {
        const formatted = data
          .filter((item: { shops: { id: string; name: string; industry_type: string } | null }) => item.shops !== null)
          .map((item: { shops: { id: string; name: string; industry_type: string } }) => ({
            id: item.shops.id,
            name: item.shops.name,
            industryType: item.shops.industry_type,
          }));
        setMyShops(formatted);
      }
    }

    loadUserShops();
  }, [supabase, shopId, userRole]);

  const handleLogout = async () => {
    const confirmLogout = window.confirm(t("logout_confirm"));
    if (!confirmLogout) return;
    if (typeof window !== "undefined") {
      localStorage.removeItem("hisabx_shop_context");
      localStorage.removeItem("The Accounts_shop_context");
      localStorage.removeItem("is_impersonating");
      localStorage.removeItem("impersonated_shop_id");
      localStorage.removeItem("impersonated_shop_name");
      localStorage.removeItem("impersonated_user_name");
    }
    if (isFlame9Brand()) {
      flame9LogoutCleanup();
    }
    await supabase.auth.signOut();
    window.location.replace("/login");
  };

  const handleSwitchShop = async (targetShopId: string) => {
    if (targetShopId === shopId) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (typeof window !== "undefined") {
        localStorage.removeItem("hisabx_shop_context");
        localStorage.removeItem("The Accounts_shop_context");
        localStorage.removeItem("is_impersonating");
        localStorage.removeItem("impersonated_shop_id");
        localStorage.removeItem("impersonated_shop_name");
        localStorage.removeItem("impersonated_user_name");
      }
      const { error } = await supabase
        .from("user_profiles")
        .update({ shop_id: targetShopId })
        .eq("id", user.id);

      if (error) throw error;
      window.location.href = "/dashboard";
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      alert("Failed to switch business: " + message);
    }
  };

  return (
    <>
      <div className={`sb-footer p-3.5 shrink-0 ${showCollapsed ? "flex justify-center" : ""}`}>
        <div className={`flex items-center justify-between gap-3 ${showCollapsed ? "flex-col py-1" : ""}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              onClick={() => setIsProfileModalOpen(true)}
              className="sb-avatar h-9 w-9 rounded-full flex items-center justify-center border-2 shrink-0 cursor-pointer hover:scale-105 transition-transform"
              title="View Executive Profile"
            >
              <span className="text-white font-bold text-sm">{userName?.charAt(0)?.toUpperCase() || "U"}</span>
            </div>
            {!showCollapsed && (
              <div className="flex-1 min-w-0">
                {loading ? (
                  <div className="space-y-1.5">
                    <div className="h-3 w-16 sb-skeleton rounded animate-pulse" />
                    <div className="h-2 w-20 sb-skeleton rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <button
                        onClick={() => setIsSwitcherOpen((open) => !open)}
                        className="sb-shop-name flex items-center gap-1 text-[13px] font-bold transition-colors w-full text-left truncate justify-between group cursor-pointer"
                      >
                        <span className="truncate">{shopName || "My Shop"}</span>
                        <ChevronDown
                          size={11}
                          className="sb-meta shrink-0 transition-transform duration-200"
                          style={{ transform: isSwitcherOpen ? "rotate(180deg)" : "none" }}
                        />
                      </button>

                      {isSwitcherOpen && (
                        <div className="sb-panel absolute bottom-full left-0 mb-3 w-56 rounded-2xl shadow-2xl p-1.5 space-y-1 z-[9999] border">
                          <p className="sb-menu-heading text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 select-none border-b">
                            Switch Business
                          </p>
                          <div className="max-h-40 overflow-y-auto custom-scrollbar p-0.5 space-y-0.5">
                            {myShops.map((shop) => {
                              const isCurrent = shop.id === shopId;
                              return (
                                <button
                                  key={shop.id}
                                  onClick={() => {
                                    handleSwitchShop(shop.id);
                                    setIsSwitcherOpen(false);
                                  }}
                                  disabled={isCurrent}
                                  className={`sb-menu-item w-full text-left px-2.5 py-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                    isCurrent ? "is-current-shop" : ""
                                  }`}
                                >
                                  <div className="truncate pr-2">
                                    <p className="truncate font-extrabold leading-tight">{shop.name}</p>
                                    <p
                                      className={`text-[8px] uppercase tracking-wider font-semibold mt-0.5 ${
                                        isCurrent ? "text-white/80" : "sb-meta"
                                      }`}
                                    >
                                      {shop.industryType}
                                    </p>
                                  </div>
                                  {isCurrent && <Check size={11} className="stroke-[3]" />}
                                </button>
                              );
                            })}
                          </div>
                          <div className="sb-divider border-t my-1" />
                          <Link
                            href="/register?new=true"
                            onClick={() => setIsSwitcherOpen(false)}
                            className="sb-accent-link flex items-center gap-1.5 w-full text-left px-2.5 py-2 rounded-xl text-[10px] font-black transition-colors uppercase tracking-wider"
                          >
                            <Plus size={12} className="stroke-[3]" /> Register New Business
                          </Link>
                          {myShops.length > 1 && (
                            <Link
                              href="/dashboard/my-businesses"
                              onClick={() => setIsSwitcherOpen(false)}
                              className="sb-accent-link flex items-center justify-between w-full px-2.5 py-2 rounded-xl text-[10px] font-black transition-colors uppercase tracking-wider"
                            >
                              <div className="flex items-center gap-1.5">
                                <Building2 size={12} className="stroke-[3]" /> My Businesses
                              </div>
                              <span className="sb-badge px-1.5 py-0.5 rounded-full text-[8px] font-black border">
                                {myShops.length}
                              </span>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setIsProfileModalOpen(true)}
                      className="sb-meta text-[10px] truncate capitalize leading-tight mt-0.5 text-left w-full cursor-pointer transition-colors"
                    >
                      {userRole} • {userName}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {!showCollapsed && !loading && (
            <button
              onClick={handleLogout}
              className="sb-icon-btn p-1.5 rounded-lg transition-all duration-200 shrink-0 cursor-pointer"
              title={t("logout")}
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>

      <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
    </>
  );
}
