"use client";

import { Menu, ShieldCheck } from "lucide-react";
import { getAdminPageTitle } from "@/lib/admin/admin-nav";

type AdminTopBarProps = {
  pathname: string;
  onOpenSidebar: () => void;
};

export function AdminTopBar({ pathname, onOpenSidebar }: AdminTopBarProps) {
  const pageTitle = getAdminPageTitle(pathname);

  return (
    <header className="admin-topbar h-[68px] shrink-0 flex items-center justify-between gap-4 px-4 md:px-6 border-b">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="admin-topbar-menu md:hidden p-2 rounded-xl border transition-colors"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-amber-500 shrink-0 hidden sm:block" />
            <h1 className="text-base md:text-lg font-black text-slate-800 truncate tracking-tight">
              {pageTitle}
            </h1>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 hidden sm:block">
            SaaS Super Admin • The Accounts Platform
          </p>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
          System Online
        </span>
      </div>
    </header>
  );
}
