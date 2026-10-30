"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminSidebarFooter } from "@/components/admin/AdminSidebarFooter";
import { AdminSidebarHeader } from "@/components/admin/AdminSidebarHeader";
import { AdminSidebarNav } from "@/components/admin/AdminSidebarNav";

type AdminSidebarProps = {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
};

export function AdminSidebar({
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapsed,
}: AdminSidebarProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const showCollapsed = isCollapsed && !isMobile;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`admin-sidebar flex flex-col flex-shrink-0 transition-all duration-300 z-40
          fixed inset-y-0 left-0 md:relative md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${showCollapsed ? "w-[72px]" : "w-[280px]"}
        `}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="admin-sb-toggle hidden md:flex absolute top-5 -right-3.5 h-7 w-7 rounded-full border items-center justify-center cursor-pointer shadow-xl transition-all duration-200 hover:scale-110 z-50"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        <AdminSidebarHeader showCollapsed={showCollapsed} onClose={onClose} />
        <AdminSidebarNav showCollapsed={showCollapsed} isMobile={isMobile} onClose={onClose} />
        <AdminSidebarFooter showCollapsed={showCollapsed} />
      </aside>
    </>
  );
}
