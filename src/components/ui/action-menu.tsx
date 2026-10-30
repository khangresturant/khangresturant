"use client";

import React, { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
  variant?: "default" | "danger" | "warning" | "success";
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  align?: "left" | "right";
}

export function ActionMenu({ items, align = "right" }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
        aria-label="Actions"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-1 w-44 rounded-2xl bg-white border border-slate-200/80 shadow-xl shadow-slate-900/10 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100`}
        >
          {items.map((item, idx) => {
            const Icon = item.icon;
            let textClass = "text-slate-700 hover:bg-slate-50";
            if (item.variant === "danger") {
              textClass = "text-rose-600 hover:bg-rose-50";
            } else if (item.variant === "warning") {
              textClass = "text-amber-600 hover:bg-amber-50";
            } else if (item.variant === "success") {
              textClass = "text-emerald-600 hover:bg-emerald-50";
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-left transition-colors cursor-pointer ${textClass} ${
                  item.disabled ? "opacity-40 cursor-not-allowed" : ""
                }`}
              >
                {Icon && <Icon size={14} className="shrink-0" />}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
