"use client";

import { Pin, X, Menu } from "lucide-react";
import { SidebarThemePicker } from "@/components/dashboard/SidebarThemePicker";

type SidebarHeaderProps = {
  showCollapsed: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
};

export function SidebarHeader({
  showCollapsed,
  isPinned,
  onTogglePin,
  onClose,
}: SidebarHeaderProps) {
  return (
    <div
      className={`sb-header h-[68px] flex items-center shrink-0 transition-all duration-200 border-b border-slate-200/80 ${
        showCollapsed ? "justify-center px-2" : "px-4 justify-between"
      } gap-2`}
    >
      {showCollapsed ? (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onTogglePin}
            title={isPinned ? "Unpin sidebar (collapse on leave)" : "Pin sidebar (keep expanded)"}
            className={`p-2 rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center ${
              isPinned
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Pin
              size={16}
              className={`transition-transform duration-150 ${isPinned ? "rotate-45 fill-current" : ""}`}
            />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <Menu size={16} />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="font-extrabold text-sm tracking-tight text-slate-900 leading-tight truncate">
                Navigation
              </p>
              <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5">
                {isPinned ? "Pinned Open" : "Auto-Collapsing"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <SidebarThemePicker collapsed={showCollapsed} variant="header" />

            <button
              type="button"
              onClick={onTogglePin}
              title={isPinned ? "Unpin sidebar (collapse on leave)" : "Pin sidebar (keep expanded)"}
              className={`p-2 rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center ${
                isPinned
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Pin
                size={16}
                className={`transition-transform duration-150 ${isPinned ? "rotate-45 fill-current" : ""}`}
              />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="sb-icon-btn md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              aria-label="Close Sidebar"
            >
              <X size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
