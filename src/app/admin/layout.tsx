"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSuperAdmin } from "@/lib/auth/roles";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const pathname = usePathname();
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    async function verifyAdminAuth() {
      setAuthLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setIsAuthorized(false);
          return;
        }

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        setIsAuthorized(isSuperAdmin({ role: profile?.role, email: user.email }));
      } catch {
        setIsAuthorized(false);
      } finally {
        setAuthLoading(false);
      }
    }
    verifyAdminAuth();
  }, [supabase]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (authLoading) {
    return (
      <div className="h-screen bg-[#0b1220] flex flex-col justify-center items-center text-slate-400">
        <Loader2 className="h-10 w-10 animate-spin text-amber-400 mb-3" />
        <p className="font-semibold text-sm">Verifying system administration credentials...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center p-6 bg-slate-50 select-none">
        <ShieldCheck size={60} className="text-red-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wider">Access Denied</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          This workspace is reserved for SaaS System Super Administrators. You do not have permissions
          to access this control center.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-xl bg-slate-900 text-white px-5 py-2.5 text-sm font-bold hover:bg-slate-800"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 select-none">
      <AdminSidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
      />

      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <AdminTopBar pathname={pathname} onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="admin-shell-content flex-1 overflow-y-auto custom-scrollbar min-h-0">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
