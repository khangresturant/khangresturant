"use client";

import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";

type AdminSidebarFooterProps = {
  showCollapsed: boolean;
};

export function AdminSidebarFooter({ showCollapsed }: AdminSidebarFooterProps) {
  return (
    <div className={`admin-sb-footer shrink-0 p-3 ${showCollapsed ? "flex justify-center" : ""}`}>
      <Link
        href="/dashboard"
        className={`admin-sb-exit-btn flex items-center rounded-xl font-bold transition-all duration-200 ${
          showCollapsed ? "justify-center p-3" : "gap-2.5 px-3.5 py-2.5 w-full"
        }`}
        title="Exit to Shop Dashboard"
      >
        <LayoutDashboard size={17} className="shrink-0" />
        {!showCollapsed && (
          <>
            <span className="text-[12px] flex-1 truncate">Shop Dashboard</span>
            <ArrowRight size={14} className="shrink-0 opacity-70" />
          </>
        )}
      </Link>
    </div>
  );
}
