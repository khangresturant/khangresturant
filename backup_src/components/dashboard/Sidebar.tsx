"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { 
  LayoutDashboard, ShoppingCart, Package, Users, Settings, 
  Scissors, Fuel, Pill, Store, Factory, Car, Wrench, Shirt, Coffee, Leaf,
  Smartphone, CreditCard, Layers, Receipt, Tag, Building, Calculator, Truck,
  RotateCcw, TrendingDown, Wallet, ShieldCheck, Database, LogOut, BarChart2,
  ChevronLeft, ChevronRight, Menu, Check, Plus, ChevronDown
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
  onToggleCollapsed?: () => void;
}

export function Sidebar({ 
  isOpen = false, 
  isCollapsed = false, 
  onClose = () => {}, 
  onToggleCollapsed = () => {} 
}: SidebarProps) {
  const pathname = usePathname();
  const { shopId, industryType, userName, shopName, userRole, loading, permissions } = useShop();
  const { t, language } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [myShops, setMyShops] = useState<{ id: string; name: string; industryType: string }[]>([]);
  const supabase = createClient();

  const handleLogout = async () => {
    const confirmLogout = window.confirm(t("logout_confirm"));
    if (!confirmLogout) return;
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const handleSwitchShop = async (targetShopId: string) => {
    if (targetShopId === shopId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
 
      // Update active shop_id in user_profiles
      const { error } = await supabase
        .from("user_profiles")
        .update({ shop_id: targetShopId })
        .eq("id", user.id);
 
      if (error) throw error;
 
      // Reload window to switch context shopId
      window.location.href = "/dashboard";
    } catch (e: any) {
      alert("Failed to switch business: " + e.message);
    }
  };

  useEffect(() => {
    setMounted(true);

    async function loadUserShops() {
      const { data: { user } } = await supabase.auth.getUser();
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
          .filter((item: any) => item.shops !== null)
          .map((item: any) => ({
            id: item.shops.id,
            name: item.shops.name,
            industryType: item.shops.industry_type
          }));
        setMyShops(formatted);
      }
    }

    loadUserShops();
  }, [supabase, shopId]);

  const isActive = (path: string) => {
    if (mounted && typeof window !== "undefined") {
      const currentUrl = pathname + window.location.search;
      if (path.includes("?")) {
        return currentUrl === path;
      }
      if (path.includes("/products")) {
        return currentUrl.includes("/products") && !window.location.search.includes("tab=");
      }
    }
    return pathname === path || (pathname.startsWith(path + "/") && path !== "/dashboard");
  };

  const sidebarSections = [
    {
      titleKey: "core_sales" as const,
      links: [
        { nameKey: "overview" as const, path: "/dashboard", icon: LayoutDashboard, permissionKey: "dashboard" },
        { nameKey: "pos" as const, path: "/dashboard/pos", icon: ShoppingCart, permissionKey: "pos" },
        { nameKey: "sales_ledger" as const, path: "/dashboard/sales", icon: Receipt, permissionKey: "sales" },
        { nameKey: "reports_pdf" as const, path: "/dashboard/reports", icon: BarChart2, permissionKey: "dashboard" },
      ]
    },
    {
      titleKey: "inventory_catalog" as const,
      links: [
        { nameKey: "products_stock" as const, path: industryType === "general" ? "/dashboard/general/products" : "/dashboard/products", icon: Package, permissionKey: "products" },
        { nameKey: "categories" as const, path: industryType === "general" ? "/dashboard/general/products?tab=categories" : "/dashboard/products?tab=categories", icon: Tag, permissionKey: "categories" },
        { nameKey: "brands" as const, path: industryType === "general" ? "/dashboard/general/products?tab=brands" : "/dashboard/products?tab=brands", icon: Building, permissionKey: "brands" },
        ...(industryType !== "general" ? [{ nameKey: "units_packings" as const, path: "/dashboard/units", icon: Layers, permissionKey: "units" }] : []),
      ]
    },
    {
      titleKey: "procurement_expenses" as const,
      links: [
        { nameKey: "purchase_stock_in" as const, path: "/dashboard/purchase", icon: Truck, permissionKey: "purchase" },
        { nameKey: "returns_adjustments" as const, path: "/dashboard/returns", icon: RotateCcw, permissionKey: "returns" },
        { nameKey: "expenses" as const, path: "/dashboard/expenses", icon: TrendingDown, permissionKey: "expenses" },
      ]
    },
    {
      titleKey: "financials_khata" as const,
      links: [
        { nameKey: "khata_ledger" as const, path: "/dashboard/khata", icon: Users, permissionKey: "khata" },
        { nameKey: "register_ledger" as const, path: "/dashboard/registers", icon: Calculator, permissionKey: "registers" },
        { nameKey: "accounts_ledger" as const, path: "/dashboard/accounts", icon: Wallet, permissionKey: "accounts" },
      ]
    }
  ];

  // Map industry types to their specific modules and icons
  const industryModules: Record<string, { titleKey: string; links: { nameKey: string; path: string; icon: any }[] }> = {
    tailor: {
      titleKey: "tailor_title",
      links: [
        { nameKey: "tailor_measurements", path: "/dashboard/tailor/measurements", icon: Scissors },
        { nameKey: "tailor_orders", path: "/dashboard/tailor/orders", icon: Shirt },
        { nameKey: "tailor_karigar", path: "/dashboard/tailor/karigar", icon: Users },
      ]
    },
    fuel: {
      titleKey: "fuel_title",
      links: [
        { nameKey: "fuel_tanks", path: "/dashboard/fuel/tanks", icon: Fuel },
        { nameKey: "fuel_readings", path: "/dashboard/fuel/readings", icon: LayoutDashboard },
      ]
    },
    karyana: {
      titleKey: "karyana_title",
      links: [
        { nameKey: "karyana_variations", path: "/dashboard/karyana/variations", icon: Package },
        { nameKey: "karyana_barcodes", path: "/dashboard/karyana/barcodes", icon: Store },
      ]
    },
    pharmacy: {
      titleKey: "pharmacy_title",
      links: [
        { nameKey: "pharmacy_expiry", path: "/dashboard/pharmacy/expiry", icon: Pill },
        { nameKey: "pharmacy_formulas", path: "/dashboard/pharmacy/formulas", icon: Factory },
      ]
    },
    showroom: {
      titleKey: "showroom_title",
      links: [
        { nameKey: "showroom_vehicles", path: "/dashboard/showroom/vehicles", icon: Car },
        { nameKey: "showroom_rentals", path: "/dashboard/showroom/rentals", icon: LayoutDashboard },
      ]
    },
    fertilizer: {
      titleKey: "fertilizer_title",
      links: [
        { nameKey: "fertilizer_batches", path: "/dashboard/fertilizer/batches", icon: Leaf },
        { nameKey: "fertilizer_khata", path: "/dashboard/fertilizer/khata", icon: Users },
      ]
    },
    hardware: {
      titleKey: "hardware_title",
      links: [
        { nameKey: "hardware_dimensions", path: "/dashboard/hardware/dimensions", icon: Wrench },
      ]
    },
    restaurant: {
      titleKey: "restaurant_title",
      links: [
        { nameKey: "restaurant_tables", path: "/dashboard/restaurant/tables", icon: Coffee },
        { nameKey: "restaurant_kot", path: "/dashboard/restaurant/kot", icon: LayoutDashboard },
      ]
    },
    electronics: {
      titleKey: "electronics_title",
      links: [
        { nameKey: "electronics_emi", path: "/dashboard/electronics/emi", icon: CreditCard },
        { nameKey: "electronics_repair", path: "/dashboard/electronics/repair", icon: Wrench },
      ]
    },
    garments: {
      titleKey: "garments_title",
      links: [
        { nameKey: "garments_variations", path: "/dashboard/garments/variations", icon: Package },
      ]
    },
    general: {
      titleKey: "general_title",
      links: [
        { nameKey: "general_variations", path: "/dashboard/general/variations", icon: Package },
        { nameKey: "general_barcodes", path: "/dashboard/general/barcodes", icon: Store },
        { nameKey: "general_giftcards", path: "/dashboard/general/cards", icon: CreditCard },
      ]
    }
  };

  const currentIndustry = industryType ? industryModules[industryType] : null;

  const hasPermission = (key?: string) => {
    if (!key) return true;
    if (loading || !permissions) return true; // Show while loading
    return permissions.panels?.[key] === true;
  };

  return (
    <>
      {/* Mobile Sidebar Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside 
        className={`bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-300 flex flex-col flex-shrink-0 transition-all duration-300 border-r border-zinc-800/80 z-40 relative
          fixed inset-y-0 left-0 md:relative md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${isCollapsed ? "w-20" : "w-64"}
        `}
      >
        {/* Collapse Toggle Button (Desktop Only) */}
        <button
          onClick={onToggleCollapsed}
          className="hidden md:flex absolute top-5 -right-3 h-6 w-6 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white items-center justify-center cursor-pointer shadow-md hover:bg-zinc-800 transition-transform duration-200 hover:scale-110 z-50"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Sidebar Header / Branding */}
        <div className={`h-16 flex items-center border-b border-zinc-800/60 shrink-0 transition-all duration-300 ${isCollapsed ? "justify-center px-0" : "px-6"}`}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-500/30 shrink-0">
              <span className="text-white font-extrabold text-sm tracking-tighter">HX</span>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm tracking-tight leading-none">Hisab X Global</span>
                {loading ? (
                  <div className="h-3 w-16 bg-zinc-800/50 rounded animate-pulse mt-1.5"></div>
                ) : (
                  <span className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mt-1">{industryType || 'Loading...'}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-6 custom-scrollbar">
          {sidebarSections.map((section) => {
            const filteredLinks = section.links.filter(link => hasPermission(link.permissionKey));
            if (filteredLinks.length === 0) return null;
            return (
              <div key={section.titleKey} className="space-y-1">
                {isCollapsed ? (
                  <div className="border-t border-zinc-800/40 my-3 mx-1.5" />
                ) : (
                  <p className="px-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-normal">
                    {t(section.titleKey)}
                  </p>
                )}
                <div className="space-y-0.5">
                  {filteredLinks.map((link) => {
                    const active = isActive(link.path) && link.path !== '/dashboard' || (pathname === '/dashboard' && link.path === '/dashboard');
                    return (
                      <Link 
                        key={link.path} 
                        href={link.path} 
                        className={`group relative flex items-center rounded-xl transition-all duration-200 text-xs font-semibold ${
                          isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
                        } ${
                          active
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/10' 
                            : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-white'
                        }`}
                      >
                        <link.icon size={16} className={active ? 'text-white' : 'text-zinc-400 group-hover:text-white transition-colors'} /> 
                        {!isCollapsed && <span>{t(link.nameKey)}</span>}
                        
                        {/* Tooltip in Collapsed State */}
                        {isCollapsed && (
                          <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-zinc-900 text-white text-[11px] rounded-lg border border-zinc-800 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 whitespace-nowrap shadow-xl z-50 font-medium">
                            {t(link.nameKey)}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {currentIndustry && (
            <div className="space-y-1">
              {isCollapsed ? (
                <div className="border-t border-zinc-800/40 my-3 mx-1.5" />
              ) : (
                <p className="px-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-normal mb-1 flex items-center justify-between">
                  <span>{t(currentIndustry.titleKey)}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
                </p>
              )}
              <div className="space-y-0.5">
                {currentIndustry.links.map((link) => {
                  const active = isActive(link.path);
                  return (
                    <Link 
                      key={link.path} 
                      href={link.path} 
                      className={`group relative flex items-center rounded-xl transition-all duration-200 text-xs font-semibold ${
                        isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
                      } ${
                        active
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/10' 
                          : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-white'
                      }`}
                    >
                      <link.icon size={16} className={active ? 'text-white' : 'text-zinc-400 group-hover:text-white transition-colors'} /> 
                      {!isCollapsed && <span>{t(link.nameKey)}</span>}
                      
                      {/* Tooltip */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-zinc-900 text-white text-[11px] rounded-lg border border-zinc-800 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 whitespace-nowrap shadow-xl z-50 font-medium">
                          {t(link.nameKey)}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1">
            {isCollapsed ? (
              <div className="border-t border-zinc-800/40 my-3 mx-1.5" />
            ) : (
              <p className="px-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-normal">
                {t("system")}
              </p>
            )}
            <div className="space-y-0.5">
              {hasPermission("staff") && (
                <Link 
                  href="/dashboard/staff" 
                  className={`group relative flex items-center rounded-xl transition-all duration-200 text-xs font-semibold ${
                    isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
                  } ${
                    isActive('/dashboard/staff')
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/10' 
                      : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-white'
                  }`}
                >
                  <ShieldCheck size={16} className={isActive('/dashboard/staff') ? 'text-white' : 'text-zinc-400 group-hover:text-white transition-colors'} /> 
                  {!isCollapsed && <span>{t("staff_management")}</span>}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-zinc-900 text-white text-[11px] rounded-lg border border-zinc-800 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 whitespace-nowrap shadow-xl z-50 font-medium">
                      {t("staff_management")}
                    </div>
                  )}
                </Link>
              )}
              {hasPermission("backup") && (
                <Link 
                  href="/dashboard/backup" 
                  className={`group relative flex items-center rounded-xl transition-all duration-200 text-xs font-semibold ${
                    isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
                  } ${
                    isActive('/dashboard/backup')
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/10' 
                      : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-white'
                  }`}
                >
                  <Database size={16} className={isActive('/dashboard/backup') ? 'text-white' : 'text-zinc-400 group-hover:text-white transition-colors'} /> 
                  {!isCollapsed && <span>{t("database_backups")}</span>}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-zinc-900 text-white text-[11px] rounded-lg border border-zinc-800 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 whitespace-nowrap shadow-xl z-50 font-medium">
                      {t("database_backups")}
                    </div>
                  )}
                </Link>
              )}
              <Link 
                href="/dashboard/settings" 
                className={`group relative flex items-center rounded-xl transition-all duration-200 text-xs font-semibold ${
                  isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
                } ${
                  isActive('/dashboard/settings')
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/10' 
                    : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-white'
                }`}
              >
                <Settings size={16} className={isActive('/dashboard/settings') ? 'text-white' : 'text-zinc-400 group-hover:text-white transition-colors'} /> 
                {!isCollapsed && <span>{t("settings")}</span>}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-zinc-900 text-white text-[11px] rounded-lg border border-zinc-800 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 whitespace-nowrap shadow-xl z-50 font-medium">
                    {t("settings")}
                  </div>
                )}
              </Link>
              <button
                onClick={handleLogout}
                className={`group relative w-full flex items-center rounded-xl transition-all duration-200 text-xs font-semibold text-zinc-400 hover:bg-zinc-900/60 hover:text-white cursor-pointer ${
                  isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2 text-left"
                }`}
              >
                <LogOut size={16} className="text-zinc-400 group-hover:text-white transition-colors" /> 
                {!isCollapsed && <span>{t("logout")}</span>}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-zinc-900 text-white text-[11px] rounded-lg border border-zinc-800 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 whitespace-nowrap shadow-xl z-50 font-medium">
                    {t("logout")}
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* User Profile Section */}
        <div className={`p-4 border-t border-zinc-800/80 bg-zinc-950/40 shrink-0 transition-all duration-300 ${isCollapsed ? "flex justify-center" : ""}`}>
          <div className={`flex items-center justify-between gap-3 ${isCollapsed ? "flex-col py-1" : "px-2 py-2"}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center border-2 border-zinc-800 shadow-lg shadow-blue-500/10 shrink-0">
                <span className="text-white font-bold text-sm">{userName?.charAt(0) || 'U'}</span>
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  {loading ? (
                    <div className="space-y-1.5">
                      <div className="h-3 w-16 bg-zinc-800/50 rounded animate-pulse"></div>
                      <div className="h-2 w-20 bg-zinc-800/50 rounded animate-pulse"></div>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <button
                          onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                          className="flex items-center gap-1 text-xs font-bold text-white hover:text-blue-400 transition-colors w-full text-left truncate justify-between group cursor-pointer"
                        >
                          <span className="truncate">{shopName || 'My Shop'}</span>
                          <ChevronDown size={11} className="text-zinc-500 group-hover:text-blue-400 shrink-0 transition-transform duration-200" style={{ transform: isSwitcherOpen ? "rotate(180deg)" : "none" }} />
                        </button>
                        
                        {/* Switcher Dropdown Popover */}
                        {isSwitcherOpen && (
                          <div className="absolute bottom-full left-0 mb-3 w-52 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-1.5 space-y-1 z-[9999]">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-2.5 py-1.5 select-none border-b border-zinc-800/40">Switch Business</p>
                            
                            <div className="max-h-40 overflow-y-auto custom-scrollbar p-0.5 space-y-0.5">
                              {myShops.map((s) => {
                                const isCurrent = s.id === shopId;
                                return (
                                  <button
                                    key={s.id}
                                    onClick={() => {
                                      handleSwitchShop(s.id);
                                      setIsSwitcherOpen(false);
                                    }}
                                    disabled={isCurrent}
                                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                      isCurrent
                                        ? "bg-blue-600 text-white font-extrabold"
                                        : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                                    }`}
                                  >
                                    <div className="truncate pr-2">
                                      <p className="truncate font-extrabold leading-tight">{s.name}</p>
                                      <p className={`text-[8px] uppercase tracking-wider font-semibold mt-0.5 ${isCurrent ? "text-blue-200" : "text-zinc-500"}`}>{s.industryType}</p>
                                    </div>
                                    {isCurrent && <Check size={11} className="stroke-[3]" />}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="border-t border-zinc-800/60 my-1"></div>
                            
                            <Link
                              href="/register"
                              onClick={() => setIsSwitcherOpen(false)}
                              className="flex items-center gap-1.5 w-full text-left px-2.5 py-2 rounded-xl text-[10px] font-black text-blue-400 hover:bg-zinc-800 hover:text-blue-300 transition-colors uppercase tracking-wider"
                            >
                              <Plus size={12} className="stroke-[3]" /> Register New Business
                            </Link>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 truncate capitalize leading-tight mt-0.5">{userRole} • {userName}</p>
                    </>
                  )}
                </div>
              )}
            </div>
            {!isCollapsed && !loading && (
              <button
                onClick={handleLogout}
                className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors shrink-0 cursor-pointer"
                title={t("logout")}
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

