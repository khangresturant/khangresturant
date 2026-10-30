"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  BookOpen,
  Package,
  Grid3X3,
  Car,
  Calendar,
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";

type NavTab = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  path?: string;
  action?: "sidebar";
  isActive: (pathname: string) => boolean;
  permissionPath?: string;
  featured?: boolean;
};

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { industryType, canAccessDashboardPath } = useShop();
  const { t } = useLanguage();

  const isShowroom = industryType === "showroom";

  const posPath =
    industryType === "restaurant"
      ? "/dashboard/restaurant/pos"
      : industryType === "showroom"
      ? "/dashboard/showroom/sales"
      : "/dashboard/pos";

  const tabs: NavTab[] = isShowroom
    ? [
        {
          id: "home",
          label: t("overview")?.split(" ")[0] || "Home",
          icon: LayoutDashboard,
          path: "/dashboard",
          isActive: (p) => p === "/dashboard",
          permissionPath: "/dashboard",
        },
        {
          id: "vehicles",
          label: "گاڑیاں",
          icon: Car,
          path: "/dashboard/showroom/vehicles",
          isActive: (p) => p.startsWith("/dashboard/showroom/vehicles"),
          permissionPath: "/dashboard/showroom/vehicles",
        },
        {
          id: "pos",
          label: "فروخت",
          icon: ShoppingCart,
          path: "/dashboard/showroom/sales",
          isActive: (p) => p.startsWith("/dashboard/showroom/sales"),
          permissionPath: "/dashboard/showroom/sales",
          featured: true,
        },
        {
          id: "installments",
          label: "اقساط",
          icon: Calendar,
          path: "/dashboard/showroom/installments",
          isActive: (p) => p.startsWith("/dashboard/showroom/installments"),
          permissionPath: "/dashboard/showroom/installments",
        },
        {
          id: "more",
          label: t("more") || "More",
          icon: Grid3X3,
          action: "sidebar",
          isActive: () => false,
        },
      ]
    : [
        {
          id: "home",
          label: t("overview")?.split(" ")[0] || "Home",
          icon: LayoutDashboard,
          path: "/dashboard",
          isActive: (p) => p === "/dashboard",
          permissionPath: "/dashboard",
        },
        {
          id: "khata",
          label: "Khata",
          icon: BookOpen,
          path: "/dashboard/khata",
          isActive: (p) => p.startsWith("/dashboard/khata"),
          permissionPath: "/dashboard/khata",
        },
        {
          id: "pos",
          label: "POS",
          icon: ShoppingCart,
          path: posPath,
          isActive: (p) => p.includes("/pos") || (industryType === "restaurant" && p.includes("/restaurant/pos")),
          permissionPath: posPath,
          featured: true,
        },
        {
          id: "products",
          label: "Stock",
          icon: Package,
          path: "/dashboard/products",
          isActive: (p) =>
            p.startsWith("/dashboard/products") ||
            p.startsWith("/dashboard/purchase"),
          permissionPath: "/dashboard/products",
        },
        {
          id: "more",
          label: t("more") || "More",
          icon: Grid3X3,
          action: "sidebar",
          isActive: () => false,
        },
      ];

  const visibleTabs = tabs.filter((tab) => {
    if (tab.action === "sidebar") return true;
    if (!tab.permissionPath) return true;
    return canAccessDashboardPath(tab.permissionPath);
  });

  const openSidebar = () => {
    window.dispatchEvent(new CustomEvent("open-sidebar"));
  };

  const navigate = (path: string) => {
    router.push(path);
  };

  return (
    <div
      className="mobile-vip-dock md:hidden fixed inset-x-0 bottom-0 z-40 safe-bottom px-2.5 pb-1 pt-0 pointer-events-none"
      role="navigation"
      aria-label="Main navigation"
    >
      <nav className="mobile-bottom-nav pointer-events-auto relative mx-auto max-w-sm rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-lg shadow-slate-900/10">
        <div className="flex items-center justify-around h-12 px-1 relative">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.isActive(pathname);

            if (tab.featured && tab.path) {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigate(tab.path!)}
                  className="mobile-nav-tab-featured relative -top-2 z-10 flex flex-col items-center justify-center flex-1 min-w-0 touch-manipulation cursor-pointer"
                  aria-label={tab.label}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    className={`flex h-9.5 w-9.5 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-white dark:ring-slate-900 active:scale-95 transition-transform ${
                      active ? "scale-105" : ""
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5 pointer-events-none" strokeWidth={2.5} />
                  </span>
                  <span
                    className={`text-[9px] font-black mt-0.5 tracking-tight pointer-events-none ${
                      active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            }

            if (tab.action === "sidebar") {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={openSidebar}
                  className="mobile-nav-tab flex flex-col items-center justify-center flex-1 min-w-0 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 touch-manipulation cursor-pointer active:scale-95 transition-transform"
                  aria-label={tab.label}
                >
                  <span className="flex h-6 w-7 items-center justify-center rounded-lg pointer-events-none">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="text-[9px] font-bold truncate max-w-full px-0.5 tracking-tight pointer-events-none">
                    {tab.label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={tab.id}
                href={tab.path!}
                prefetch
                onClick={(e) => {
                  e.preventDefault();
                  navigate(tab.path!);
                }}
                className={`mobile-nav-tab flex flex-col items-center justify-center flex-1 min-w-0 py-1 touch-manipulation cursor-pointer active:scale-95 transition-all ${
                  active ? "text-indigo-600 dark:text-indigo-400 font-black" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={`flex h-6 w-7 items-center justify-center rounded-lg transition-all pointer-events-none ${
                    active ? "bg-indigo-50 dark:bg-indigo-950/60 shadow-xs" : ""
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
                </span>
                <span
                  className={`text-[9px] font-bold truncate max-w-full px-0.5 tracking-tight pointer-events-none ${
                    active ? "text-indigo-600 dark:text-indigo-400" : ""
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
