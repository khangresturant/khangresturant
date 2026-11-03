"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Check, ChevronDown, LogOut, Pin, Plus } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useShop } from "@/context/ShopContext";
import { UserProfileModal } from "@/components/dashboard/UserProfileModal";
import { createClient } from "@/lib/supabase/client";
import { flame9LogoutCleanup } from "@/lib/deployment/flame9-session";
import { isFlame9Brand } from "@/lib/deployment/flame9-brand";

type SidebarFooterProps = {
  showCollapsed: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
};

type UserShop = {
  id: string;
  name: string;
  industryType: string;
};

export function SidebarFooter({ showCollapsed, isPinned, onTogglePin }: SidebarFooterProps) {
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
      <div className={`sb-footer p-3 shrink-0 border-t border-slate-200/80 bg-slate-50/70 ${showCollapsed ? "flex flex-col items-center gap-2" : ""}`}>
        <div className={`flex items-center justify-between gap-2.5 ${showCollapsed ? "flex-col py-1" : ""}`}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              onClick={() => setIsProfileModalOpen(true)}
              className="h-8 w-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0 cursor-pointer hover:bg-slate-800 transition-colors shadow-2xs"
              title="View Executive Profile"
            >
              <p className="font-extrabold text-xs">{userName?.charAt(0)?.toUpperCase() || "U"}</p>
            </div>
            {!showCollapsed && (
              <div className="flex-1 min-w-0">
                {loading ? (
                  <div className="space-y-1.5">
                    <div className="h-3 w-16 bg-slate-200/70 rounded animate-pulse" />
                    <div className="h-2 w-20 bg-slate-200/50 rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <button
                        onClick={() => setIsSwitcherOpen((open) => !open)}
                        className="flex items-center gap-1 text-[13px] font-bold text-slate-800 hover:text-slate-900 transition-colors w-full text-left truncate justify-between group cursor-pointer"
                      >
                        <p className="truncate font-bold text-xs text-slate-900">{shopName || "My Store"}</p>
                        <ChevronDown
                          size={12}
                          className="text-slate-400 shrink-0 transition-transform duration-200 group-hover:text-slate-600"
                          style={{ transform: isSwitcherOpen ? "rotate(180deg)" : "none" }}
                        />
                      </button>

                      {isSwitcherOpen && (
                        <div className="sb-panel absolute bottom-full left-0 mb-3 w-56 rounded-2xl shadow-2xl p-1.5 space-y-1 z-[9999] border bg-white border-slate-200">
                          <p className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 select-none border-b border-slate-100 text-slate-400">
                            Switch Business
                          </p>
                          <div className="max-h-40 overflow-y-auto no-scrollbar p-0.5 space-y-0.5">
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
                                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                    isCurrent ? "bg-slate-900 text-white font-bold" : "hover:bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  <div className="truncate pr-2">
                                    <p className="truncate font-extrabold leading-tight">{shop.name}</p>
                                    <p
                                      className={`text-[8px] uppercase tracking-wider font-semibold mt-0.5 ${
                                        isCurrent ? "text-slate-300" : "text-slate-400"
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
                          <div className="border-t border-slate-100 my-1" />
                          <Link
                            href="/register?new=true"
                            onClick={() => setIsSwitcherOpen(false)}
                            className="flex items-center gap-1.5 w-full text-left px-2.5 py-2 rounded-xl text-[10px] font-black transition-colors uppercase tracking-wider text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Plus size={12} className="stroke-[3]" /> Register New Business
                          </Link>
                          {myShops.length > 1 && (
                            <Link
                              href="/dashboard/my-businesses"
                              onClick={() => setIsSwitcherOpen(false)}
                              className="flex items-center justify-between w-full px-2.5 py-2 rounded-xl text-[10px] font-black transition-colors uppercase tracking-wider text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            >
                              <div className="flex items-center gap-1.5">
                                <Building2 size={12} className="stroke-[3]" /> My Businesses
                              </div>
                              <div className="px-1.5 py-0.5 rounded-full text-[8px] font-black border bg-slate-100 text-slate-700 border-slate-200">
                                {myShops.length}
                              </div>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setIsProfileModalOpen(true)}
                      className="text-[10px] font-medium text-slate-500 truncate capitalize leading-tight mt-0.5 text-left w-full cursor-pointer hover:text-slate-900 transition-colors"
                    >
                      {userRole} • {userName}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {!showCollapsed && !loading && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onTogglePin}
                className={`p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                  isPinned
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                }`}
                title={isPinned ? "Unpin Sidebar (Collapse on leave)" : "Pin Sidebar (Keep expanded)"}
              >
                <Pin
                  size={15}
                  className={`transition-transform duration-150 ${isPinned ? "rotate-45 fill-current" : ""}`}
                />
              </button>

              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                title={t("logout")}
              >
                <LogOut size={15} />
              </button>
            </div>
          )}

          {showCollapsed && (
            <button
              type="button"
              onClick={onTogglePin}
              className={`p-2 rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center ${
                isPinned
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title={isPinned ? "Unpin Sidebar (Collapse on leave)" : "Pin Sidebar (Keep expanded)"}
            >
              <Pin
                size={15}
                className={`transition-transform duration-150 ${isPinned ? "rotate-45 fill-current" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
    </>
  );
}
