"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SidebarFooter } from "@/components/dashboard/sidebar/SidebarFooter";
import { SidebarHeader } from "@/components/dashboard/sidebar/SidebarHeader";
import { SidebarNav } from "@/components/dashboard/sidebar/SidebarNav";

interface SidebarProps {
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
  onToggleCollapsed?: () => void;
}

export function Sidebar({
  isOpen = false,
  isCollapsed = false,
  onClose = () => {},
  onToggleCollapsed = () => {},
}: SidebarProps) {
  const { industryType, loading } = useShop();
  const isMobile = useIsMobile();

  const showCollapsed = isCollapsed && !isMobile;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-[210] md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`dashboard-sidebar flex flex-col flex-shrink-0 transition-transform duration-200 ease-out
          fixed inset-y-0 left-0 md:relative md:translate-x-0 md:z-40 h-full max-h-[100dvh] overflow-hidden
          ${isOpen ? "translate-x-0 z-[220]" : "-translate-x-full md:translate-x-0 z-40"}
          ${showCollapsed ? "w-[72px] overflow-visible" : "w-[260px]"}
          max-md:w-[280px] max-md:max-w-[85vw] max-md:shadow-2xl
        `}
      >
        <button
          onClick={onToggleCollapsed}
          className="sb-toggle hidden md:flex absolute top-5 -right-3.5 h-7 w-7 rounded-full border text-[var(--sb-text-muted)] hover:text-[var(--sb-hover-text)] items-center justify-center cursor-pointer shadow-xl transition-all duration-200 hover:scale-110 z-50"
          title={isCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)"}
        >
          {isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        <SidebarHeader
          showCollapsed={showCollapsed}
          loading={loading}
          industryType={industryType}
          onClose={onClose}
        />

        <SidebarNav showCollapsed={showCollapsed} isMobile={isMobile} onClose={onClose} />

        <SidebarFooter showCollapsed={showCollapsed} />
      </aside>
    </>
  );
}
