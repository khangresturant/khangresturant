"use client";

import Link from "next/link";
import {
  ShoppingBag,
  BookOpen,
  Package,
  Truck,
  FileText,
  Wallet,
  RotateCcw,
  BarChart3,
  Car,
  Calendar,
  Landmark,
  Key,
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";

const SHOWROOM_ACTIONS = [
  {
    href: "/dashboard/showroom/sales",
    icon: ShoppingBag,
    labelKey: "showroom_sales",
    fallback: "گاڑی فروخت",
    gradient: "from-blue-600 to-indigo-600",
    permission: "/dashboard/showroom/sales",
  },
  {
    href: "/dashboard/showroom/vehicles",
    icon: Car,
    labelKey: "showroom_vehicles",
    fallback: "اسٹاک گاڑیاں",
    gradient: "from-amber-500 to-orange-600",
    permission: "/dashboard/showroom/vehicles",
  },
  {
    href: "/dashboard/showroom/installments",
    icon: Calendar,
    labelKey: "showroom_installments",
    fallback: "اقساط سسٹم",
    gradient: "from-emerald-500 to-teal-600",
    permission: "/dashboard/showroom/installments",
  },
  {
    href: "/dashboard/showroom/parties",
    icon: BookOpen,
    labelKey: "showroom_parties",
    fallback: "ڈیلرز کھاتہ",
    gradient: "from-rose-500 to-pink-600",
    permission: "/dashboard/showroom/parties",
  },
  {
    href: "/dashboard/showroom/investors",
    icon: Landmark,
    labelKey: "showroom_investors",
    fallback: "انویسٹرز",
    gradient: "from-violet-500 to-purple-600",
    permission: "/dashboard/showroom/investors",
  },
  {
    href: "/dashboard/showroom/rentals",
    icon: Key,
    labelKey: "showroom_rentals",
    fallback: "رینٹ اے کار",
    gradient: "from-sky-500 to-cyan-600",
    permission: "/dashboard/showroom/rentals",
  },
  {
    href: "/dashboard/showroom/reports",
    icon: BarChart3,
    labelKey: "showroom_reports",
    fallback: "رپورٹس",
    gradient: "from-emerald-600 to-teal-700",
    permission: "/dashboard/showroom/reports",
  },
  {
    href: "/dashboard/expenses",
    icon: Wallet,
    labelKey: "expenses",
    fallback: "اخراجات",
    gradient: "from-amber-600 to-yellow-600",
    permission: "/dashboard/expenses",
  },
] as const;

const ACTIONS = [
  {
    href: "/dashboard/pos",
    icon: ShoppingBag,
    labelKey: "pos_billing",
    fallback: "POS",
    gradient: "from-blue-500 to-indigo-600",
    permission: "/dashboard/pos",
  },
  {
    href: "/dashboard/khata",
    icon: BookOpen,
    labelKey: "khata_ledger",
    fallback: "Khata",
    gradient: "from-rose-500 to-pink-600",
    permission: "/dashboard/khata",
  },
  {
    href: "/dashboard/products",
    icon: Package,
    labelKey: "products_stock",
    fallback: "Stock",
    gradient: "from-violet-500 to-purple-600",
    permission: "/dashboard/products",
  },
  {
    href: "/dashboard/purchase",
    icon: Truck,
    labelKey: "purchase_stock_in",
    fallback: "Purchase",
    gradient: "from-orange-500 to-amber-600",
    permission: "/dashboard/purchase",
  },
  {
    href: "/dashboard/sales",
    icon: FileText,
    labelKey: "sales_ledger",
    fallback: "Sales",
    gradient: "from-sky-500 to-cyan-600",
    permission: "/dashboard/sales",
  },
  {
    href: "/dashboard/expenses",
    icon: Wallet,
    labelKey: "expenses",
    fallback: "Expenses",
    gradient: "from-amber-500 to-yellow-600",
    permission: "/dashboard/expenses",
  },
  {
    href: "/dashboard/returns",
    icon: RotateCcw,
    labelKey: "returns_adjustments",
    fallback: "Returns",
    gradient: "from-fuchsia-500 to-violet-600",
    permission: "/dashboard/returns",
  },
  {
    href: "/dashboard/reports",
    icon: BarChart3,
    labelKey: "reports_pdf",
    fallback: "Reports",
    gradient: "from-emerald-500 to-teal-600",
    permission: "/dashboard/reports",
  },
] as const;

export function MobileQuickActionsStrip() {
  const { canAccessDashboardPath, industryType } = useShop();
  const { t } = useLanguage();

  const isShowroom = industryType === "showroom";

  const posHref =
    industryType === "restaurant"
      ? "/dashboard/restaurant/pos"
      : industryType === "showroom"
      ? "/dashboard/showroom/sales"
      : "/dashboard/pos";

  const baseActions = isShowroom ? SHOWROOM_ACTIONS : ACTIONS;

  const items = baseActions.map((a) =>
    a.href === "/dashboard/pos" ? { ...a, href: posHref } : a
  ).filter((a) => typeof canAccessDashboardPath === "function" ? canAccessDashboardPath(a.permission) : true);

  return (
    <div className="md:hidden mobile-vip-quick-actions -mx-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">
        Quick actions
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-hide">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="mobile-vip-quick-chip snap-start shrink-0 flex flex-col items-center gap-1.5 min-w-[4.5rem] active:scale-95 transition-transform"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient} text-white shadow-lg shadow-slate-900/10`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <span className="text-[10px] font-bold text-slate-600 text-center leading-tight max-w-[4.5rem] truncate">
                {t(item.labelKey) || item.fallback}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
