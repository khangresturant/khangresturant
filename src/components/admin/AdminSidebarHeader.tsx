"use client";

import Image from "next/image";
import { ShieldCheck, X } from "lucide-react";
import { FLAME9, isFlame9Brand } from "@/lib/deployment/flame9-brand";

type AdminSidebarHeaderProps = {
  showCollapsed: boolean;
  onClose: () => void;
};

export function AdminSidebarHeader({ showCollapsed, onClose }: AdminSidebarHeaderProps) {
  return (
    <div
      className={`admin-sb-header h-[68px] flex items-center shrink-0 transition-all duration-300 ${
        showCollapsed ? "justify-center px-2" : "px-4 justify-between gap-2"
      }`}
    >
      <div className={`flex items-center min-w-0 ${showCollapsed ? "flex-col" : "gap-3 flex-1"}`}>
        {isFlame9Brand() ? (
          <Image
            src={FLAME9.logoPath}
            alt=""
            width={36}
            height={36}
            className="admin-sb-logo-badge h-9 w-9 rounded-xl object-contain p-0.5 ring-1 ring-[#FF4D00]/40"
          />
        ) : (
          <div className="admin-sb-logo-badge h-9 w-9 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={18} className="text-amber-300" />
          </div>
        )}
        {!showCollapsed && (
          <div className="flex flex-col min-w-0 flex-1">
            <span className="admin-sb-brand-title font-extrabold text-[15px] tracking-tight leading-none truncate">
              {isFlame9Brand() ? FLAME9.name : "SaaS Control"}
            </span>
            <span className="admin-sb-brand-sub text-[10px] font-black uppercase tracking-[0.14em] mt-1 truncate">
              {isFlame9Brand() ? "Super Admin · Flame 9" : "Super Admin Portal"}
            </span>
          </div>
        )}
      </div>
      {!showCollapsed && (
        <button
          type="button"
          onClick={onClose}
          className="admin-sb-icon-btn md:hidden p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
          aria-label="Close sidebar"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
