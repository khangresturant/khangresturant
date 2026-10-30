"use client";

import { ReactNode } from "react";
import { useShop } from "@/context/ShopContext";

export function MobileVipHeader({
  searchSlot,
  actionsSlot,
}: {
  searchSlot: ReactNode;
  actionsSlot: ReactNode;
}) {
  const { shopName } = useShop();

  return (
    <header className="mobile-compact-header md:hidden shrink-0 z-20 safe-top bg-white border-b border-slate-200/90 shadow-sm">
      <div className="flex items-center gap-2 px-3 h-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/the-accounts-mark.png"
          alt=""
          aria-hidden
          className="h-7 w-7 shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 leading-none">
            The Accounts
          </p>
          <h1 className="text-sm font-bold text-slate-900 truncate leading-tight mt-0.5">
            {shopName || "My Shop"}
          </h1>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 mobile-compact-header-actions">
          {searchSlot}
          {actionsSlot}
        </div>
      </div>
    </header>
  );
}
