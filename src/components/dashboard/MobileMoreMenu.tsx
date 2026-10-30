"use client";

import Link from "next/link";
import { useMemo } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useShop } from "@/context/ShopContext";
import { buildSidebarSections } from "@/lib/dashboard/sidebar-sections";

type MobileMoreMenuProps = {
  open: boolean;
  onClose: () => void;
};

export function MobileMoreMenu({ open, onClose }: MobileMoreMenuProps) {
  const { t } = useLanguage();
  const {
    industryType,
    hasEmi,
    hasPayroll,
    hasTax,
    hasAssetsRec,
    subscriptionTier,
    subscriptionExpiresAt,
    saasPlans,
    canAccessDashboardPath,
    userRole,
    permissions,
    loading,
  } = useShop();

  const sections = useMemo(
    () =>
      buildSidebarSections({
        industryType,
        hasEmi,
        hasPayroll,
        hasTax,
        hasAssetsRec,
        subscriptionTier,
        subscriptionExpiresAt,
        remotePlans: saasPlans,
      }),
    [
      industryType,
      hasEmi,
      hasPayroll,
      hasTax,
      hasAssetsRec,
      subscriptionTier,
      subscriptionExpiresAt,
      saasPlans,
    ]
  );

  const hasPermission = (key?: string) => {
    if (!key) return true;
    if (
      !userRole ||
      userRole === "owner" ||
      userRole === "superadmin" ||
      userRole === "saasadmin" ||
      userRole === "admin" ||
      userRole === "manager"
    ) {
      return true;
    }
    if (loading || !permissions) return true;
    return permissions.panels?.[key] === true;
  };

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-[220]">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[78dvh] rounded-t-3xl bg-white shadow-2xl safe-bottom flex flex-col animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-sm font-black text-slate-900">More</p>
            <p className="text-[11px] text-slate-500">Reports, settings & modules</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4">
          {sections.map((section) => {
            const links = section.links.filter(
              (link) =>
                hasPermission(link.permissionKey) && canAccessDashboardPath(link.path)
            );
            if (links.length === 0) return null;

            return (
              <div key={section.titleKey}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-0.5">
                  {t(section.titleKey)}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {links.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.path}
                        href={link.path}
                        onClick={onClose}
                        className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/80 p-2.5 active:scale-95 transition-transform min-h-[72px] justify-center"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-100 text-indigo-600 shadow-sm">
                          <Icon size={17} />
                        </span>
                        <span className="text-[9px] font-bold text-slate-700 text-center leading-tight line-clamp-2">
                          {t(link.nameKey)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
