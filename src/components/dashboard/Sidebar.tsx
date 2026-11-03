"use client";

import { useEffect, useRef, useState } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SidebarFooter } from "@/components/dashboard/sidebar/SidebarFooter";
import { SidebarNav } from "@/components/dashboard/sidebar/SidebarNav";

const sidebarFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sidebar-modern",
});

const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 190;
const MAX_WIDTH = 500;
const COLLAPSED_WIDTH = 72;

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
  onToggleCollapsed,
}: SidebarProps) {
  const isMobile = useIsMobile();

  // Persistent pin state: when pinned, sidebar stays expanded permanently
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarWidthRef = useRef<number>(DEFAULT_WIDTH);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPin = localStorage.getItem("sidebar_pinned");
      if (savedPin !== null) {
        setIsPinned(savedPin === "true");
      } else {
        const savedCollapsed = localStorage.getItem("sidebar_collapsed") === "true";
        setIsPinned(!savedCollapsed);
      }

      const savedWidth = localStorage.getItem("sidebar_custom_width");
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
          setSidebarWidth(parsed);
          sidebarWidthRef.current = parsed;
        }
      }
    }
  }, []);

  // Sync with prop when changed externally (e.g., Ctrl+B shortcut)
  useEffect(() => {
    if (isCollapsed !== undefined) {
      setIsPinned(!isCollapsed);
    }
  }, [isCollapsed]);

  // Drag to adjust sidebar width freely
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    // When user manually drags to adjust width, auto-pin so their chosen width stays
    if (!isPinned) {
      setIsPinned(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar_pinned", "true");
        localStorage.setItem("sidebar_collapsed", "false");
      }
      if (onToggleCollapsed) {
        onToggleCollapsed();
      }
    }
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH);
      sidebarWidthRef.current = newWidth;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar_custom_width", sidebarWidthRef.current.toString());
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing]);

  const handleTogglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar_pinned", next ? "true" : "false");
        localStorage.setItem("sidebar_collapsed", next ? "false" : "true");
      }
      if (next) {
        setIsHovered(false);
      }
      if (onToggleCollapsed) {
        onToggleCollapsed();
      }
      return next;
    });
  };

  const handleMouseEnter = () => {
    if (!isMobile && !isPinned && !isResizing) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile && !isPinned && !isResizing) {
      setIsHovered(false);
    }
  };

  const isExpanded = isMobile ? true : (isPinned || isHovered);
  const showCollapsed = !isExpanded;

  const currentWidthPx = showCollapsed ? COLLAPSED_WIDTH : sidebarWidth;

  return (
    <>
      {isOpen && isMobile && (
        <div
          className="fixed top-14 inset-x-0 bottom-0 bg-slate-900/60 backdrop-blur-xs z-[210] md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`${sidebarFont.variable} font-sans dashboard-sidebar flex flex-col shrink-0
          bg-white border-r border-slate-200 overflow-hidden select-none
          ${
            isMobile
              ? `fixed top-14 bottom-0 left-0 z-[220] w-[280px] max-w-[85vw] shadow-2xl transition-transform duration-200 ${
                  isOpen ? "translate-x-0" : "-translate-x-full"
                }`
              : "h-full relative z-30"
          }
        `}
        style={{
          width: isMobile ? undefined : `${currentWidthPx}px`,
          transition: isResizing ? "none" : "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          fontFamily: "var(--font-sidebar-modern), var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        {/* Right edge drag-resize handle */}
        {!isMobile && (
          <div
            onMouseDown={startResizing}
            className={`absolute top-0 right-0 w-2.5 h-full cursor-col-resize z-50 group flex items-center justify-center select-none ${
              isResizing ? "bg-sky-500/20" : "hover:bg-slate-200/50"
            }`}
            title="Drag to adjust sidebar width"
          >
            <div
              className={`w-[2px] h-12 rounded-full transition-colors ${
                isResizing ? "bg-sky-600" : "bg-transparent group-hover:bg-slate-400"
              }`}
            />
          </div>
        )}

        {/* Navigation menu list with invisible scrollbar */}
        <SidebarNav showCollapsed={showCollapsed} isMobile={isMobile} onClose={onClose} />

        {/* Footer with user profile, business switcher and Pin toggle button */}
        <SidebarFooter
          showCollapsed={showCollapsed}
          isPinned={isPinned}
          onTogglePin={handleTogglePin}
        />
      </aside>
    </>
  );
}
