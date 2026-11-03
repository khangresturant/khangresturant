"use client";

import React, { useEffect, useState } from "react";
import { LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [shopName, setShopName] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const active = localStorage.getItem("is_impersonating") === "true";
      const sName = localStorage.getItem("impersonated_shop_name");
      const uName = localStorage.getItem("impersonated_user_name");

      // Only real superadmin impersonations originating from /admin/shops have impersonated_shop_name
      if (active && sName) {
        setIsImpersonating(true);
        setShopName(sName);
        setUserName(uName || "Customer User");
      } else {
        // Clear rogue or stale impersonation state from previous sessions
        if (active && !sName) {
          localStorage.removeItem("is_impersonating");
          localStorage.removeItem("impersonated_shop_id");
          localStorage.removeItem("impersonated_shop_name");
          localStorage.removeItem("impersonated_user_name");
        }
        setIsImpersonating(false);
      }
    }
  }, []);

  const handleExit = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("impersonated_shop_id");
      localStorage.removeItem("impersonated_shop_name");
      localStorage.removeItem("impersonated_user_name");
      localStorage.removeItem("is_impersonating");
      localStorage.removeItem("hisabx_shop_context");
      localStorage.removeItem("The Accounts_shop_context");
      window.location.href = "/admin/shops";
    }
  };

  if (!isImpersonating) return null;

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-black flex items-center justify-between shadow-md z-[200] relative">
      <div className="flex items-center gap-2">
        <ShieldAlert size={16} className="animate-pulse text-slate-950 shrink-0" />
        <p className="font-bold">
          ⚠️ SAAS ADMIN IMPERSONATION MODE: Currently viewing and managing <u>{shopName}</u> ({userName}). All changes reflect live!
        </p>
      </div>

      <Button
        size="sm"
        onClick={handleExit}
        className="bg-slate-950 hover:bg-slate-900 text-amber-400 font-black text-[11px] h-7 px-3 rounded-lg flex items-center gap-1 cursor-pointer shadow shrink-0"
      >
        <LogOut size={12} /> Exit Impersonation Mode (ایگزٹ کریں)
      </Button>
    </div>
  );
}
