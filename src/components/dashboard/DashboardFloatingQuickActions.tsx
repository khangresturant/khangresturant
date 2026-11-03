"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Zap,
  Package,
  ArrowRightLeft,
  FileText,
  Plus,
  X,
  CreditCard,
  ShoppingBag,
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";

export function DashboardFloatingQuickActions() {
  const { t } = useLanguage();
  const { industryType } = useShop();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const norm = (industryType || "general").toLowerCase().trim();
  const isRestaurant = norm === "restaurant" || norm === "cafe" || norm === "bakery" || norm === "food";
  const isShowroom = norm === "showroom" || norm === "vehicles";

  // Dynamic links and titles according to active business
  const actions = isShowroom
    ? [
        {
          name: "Vehicle Sales Desk",
          desc: "نقد و بیع نامہ فروخت",
          href: "/dashboard/showroom/sales",
          icon: ShoppingBag,
          color: "from-emerald-600 to-teal-600",
          shadow: "shadow-emerald-500/25",
        },
        {
          name: "Installments & EMI",
          desc: "اقساط و معاہدات پلان",
          href: "/dashboard/showroom/installments",
          icon: CreditCard,
          color: "from-purple-600 to-indigo-600",
          shadow: "shadow-purple-500/25",
        },
        {
          name: "Vehicle Inventory",
          desc: "گاڑی و موٹر سائیکل اسٹاک",
          href: "/dashboard/showroom/vehicles",
          icon: Package,
          color: "from-indigo-600 to-blue-600",
          shadow: "shadow-indigo-500/25",
        },
        {
          name: "Showroom Reports",
          desc: "مالیت، سیلز و نفع/نقصان",
          href: "/dashboard/showroom/reports",
          icon: FileText,
          color: "from-blue-600 to-sky-600",
          shadow: "shadow-blue-500/25",
        },
      ]
    : [
        {
          name: isRestaurant ? "Restaurant POS Desk" : t("pos_billing"),
          desc: isRestaurant ? "Live Dining & Billing Desk" : t("launch_register_terminal"),
          href: isRestaurant ? "/dashboard/restaurant/pos" : "/dashboard/pos",
          icon: Zap,
          color: "from-blue-600 to-indigo-600",
          shadow: "shadow-blue-500/25",
        },
        {
          name: isRestaurant ? "Menu & Recipes" : t("add_inventory"),
          desc: isRestaurant ? "Food Catalog & Recipes" : t("manage_catalog_stocks"),
          href: "/dashboard/products",
          icon: Package,
          color: "from-indigo-600 to-violet-600",
          shadow: "shadow-indigo-500/25",
        },
        {
          name: t("log_expense"),
          desc: t("record_operations_outflow"),
          href: "/dashboard/expenses",
          icon: ArrowRightLeft,
          color: "from-amber-500 to-orange-600",
          shadow: "shadow-amber-500/25",
        },
        {
          name: isRestaurant ? "Restaurant Reports" : t("reports_center"),
          desc: isRestaurant ? "Daily Kitchen & Sales Analytics" : t("print_pdf_statements"),
          href: isRestaurant ? "/dashboard/restaurant/reports" : "/dashboard/reports",
          icon: FileText,
          color: "from-emerald-600 to-teal-600",
          shadow: "shadow-emerald-500/25",
        },
      ];

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="fixed right-4 bottom-20 md:right-6 md:bottom-6 z-50 select-none">
      {/* Backdrop overlay when speed dial is open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-950/25 backdrop-blur-[2px] z-40"
          />
        )}
      </AnimatePresence>

      <div className="relative z-50 flex flex-col items-end">
        {/* Animated Quick Action Items (emerging upwards) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial="closed"
              animate="open"
              exit="closed"
              variants={{
                open: {
                  transition: { staggerChildren: 0.05, delayChildren: 0.02 },
                },
                closed: {
                  transition: { staggerChildren: 0.03, staggerDirection: -1 },
                },
              }}
              className="flex flex-col items-end gap-2.5 mb-3"
            >
              {actions.map((act, idx) => {
                const Icon = act.icon;
                return (
                  <motion.div
                    key={idx}
                    variants={{
                      open: { opacity: 1, y: 0, scale: 1 },
                      closed: { opacity: 0, y: 15, scale: 0.85 },
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <Link
                      href={act.href}
                      onClick={() => setIsOpen(false)}
                      className="group flex items-center gap-3 pr-1 py-0.5 transition-transform active:scale-95 cursor-pointer"
                    >
                      {/* Label pill on the left */}
                      <div className="bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl shadow-xl border border-slate-700/60 group-hover:bg-slate-900 group-hover:border-slate-500 transition-all text-right">
                        <p className="text-xs font-bold leading-tight text-white whitespace-nowrap">
                          {act.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                          {act.desc}
                        </p>
                      </div>

                      {/* Circular Action Icon */}
                      <div
                        className={`h-12 w-12 rounded-full bg-gradient-to-tr ${act.color} text-white flex items-center justify-center shadow-lg ${act.shadow} group-hover:scale-110 transition-transform shrink-0 ring-2 ring-white/80`}
                      >
                        <Icon size={20} className="drop-shadow-xs" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Master Floating Circular Action Button */}
        <div className="relative group">
          <motion.button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            className={`h-14 w-14 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer relative ${
              isOpen
                ? "bg-slate-900 text-white shadow-slate-900/40 ring-4 ring-slate-900/20"
                : "bg-slate-900 text-white shadow-slate-900/35 ring-4 ring-slate-900/10 hover:ring-sky-500/25 hover:shadow-sky-500/20"
            }`}
            aria-label="Toggle Quick Actions Speed Dial"
            title={isOpen ? "Close Quick Actions" : "Open Quick Actions"}
          >
            {/* Subtle pulsing background glow when idle */}
            {!isOpen && (
              <div className="absolute inset-0 rounded-full bg-sky-500/20 animate-ping pointer-events-none" />
            )}

            <motion.div
              animate={{ rotate: isOpen ? 135 : 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
              className="relative z-10 flex items-center justify-center"
            >
              <Plus size={26} strokeWidth={2.5} />
            </motion.div>
          </motion.button>

          {/* Tooltip when idle (desktop only) */}
          {!isOpen && (
            <div className="hidden md:group-hover:flex absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2 items-center pointer-events-none transition-all duration-150">
              <div className="bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap border border-slate-700/50 flex items-center gap-1.5">
                <Zap size={12} className="text-amber-400" />
                Quick Actions
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

