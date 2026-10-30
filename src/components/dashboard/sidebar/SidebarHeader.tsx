"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { SidebarThemePicker } from "@/components/dashboard/SidebarThemePicker";
import { FLAME9, isFlame9Brand } from "@/lib/deployment/flame9-brand";

type SidebarHeaderProps = {
  showCollapsed: boolean;
  loading: boolean;
  industryType?: string | null;
  onClose: () => void;
};

export function SidebarHeader({
  showCollapsed,
  loading,
  industryType,
  onClose,
}: SidebarHeaderProps) {
  return (
    <div
      className={`sb-header h-[68px] flex items-center shrink-0 transition-all duration-300 ${showCollapsed ? "justify-center px-2" : "px-4"} justify-between gap-2`}
    >
      <div className={`flex items-center min-w-0 ${showCollapsed ? "flex-col gap-1.5" : "gap-2.5 flex-1"}`}>
        {isFlame9Brand() ? (
          <Image
            src={FLAME9.logoPath}
            alt={FLAME9.name}
            width={36}
            height={36}
            className="h-9 w-9 object-contain shrink-0 rounded-lg ring-1 ring-[#FF4D00]/35"
          />
        ) : (
          <img src="/the-accounts-mark.png" alt="The Accounts" className="h-9 w-9 object-contain shrink-0" />
        )}
        <SidebarThemePicker collapsed={showCollapsed} variant="header" />
        {!showCollapsed && (
          <div className="flex flex-col min-w-0 flex-1">
            <span className="sb-brand-title font-extrabold text-[15px] tracking-tight leading-none truncate">
              {isFlame9Brand() ? FLAME9.fullName : "The Accounts"}
            </span>
            {loading ? (
              <div className="h-3 w-16 sb-skeleton rounded animate-pulse mt-1.5" />
            ) : (
              <span className="sb-brand-industry text-[10px] font-black uppercase tracking-[0.15em] mt-1 truncate">
                {isFlame9Brand() ? "Pizza House & Café" : industryType || "Loading..."}
              </span>
            )}
          </div>
        )}
      </div>
      {!showCollapsed && (
        <button
          onClick={onClose}
          className="sb-icon-btn md:hidden p-1.5 rounded-lg sb-close-mobile transition-colors cursor-pointer shrink-0"
          aria-label="Close Sidebar"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
