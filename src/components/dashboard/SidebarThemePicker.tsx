"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/context/LanguageContext";
import { useSidebarTheme } from "@/context/SidebarThemeContext";
import type { SidebarThemeId } from "@/lib/dashboard/sidebar-themes";
import { Check, Palette, X } from "lucide-react";

type SidebarThemePickerProps = {
  collapsed?: boolean;
  variant?: "header" | "default";
};

function useIsMobileSheet() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export function SidebarThemePicker({
  collapsed = false,
  variant = "default",
}: SidebarThemePickerProps) {
  const { themeId, themes, setTheme, mounted, theme } = useSidebarTheme();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isMobileSheet = useIsMobileSheet();

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !isMobileSheet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, isMobileSheet]);

  if (!mounted) return null;

  const currentLabel = language === "ur" ? theme.nameUr : theme.name;
  const heading = language === "ur" ? "سائیڈبار تھیم" : "Sidebar theme";

  const handleSelect = (id: SidebarThemeId) => {
    setTheme(id);
    setOpen(false);
  };

  const themeList = (
    <div className="max-h-[50vh] sm:max-h-52 overflow-y-auto custom-scrollbar p-0.5 space-y-0.5">
      {themes.map((item) => {
        const selected = item.id === themeId;
        const itemLabel = language === "ur" ? item.nameUr : item.name;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelect(item.id)}
            className={`sb-menu-item w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
              selected ? "is-selected" : ""
            }`}
            aria-pressed={selected}
          >
            <span
              className="h-5 w-5 shrink-0 rounded-md border border-[var(--sb-border-subtle)]"
              style={{
                background: `linear-gradient(135deg, ${item.preview[0]}, ${item.preview[1]})`,
              }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-bold">{itemLabel}</span>
              <span className="block truncate text-[9px] sb-meta">{item.description}</span>
            </span>
            {selected ? <Check size={12} className="shrink-0 stroke-[3]" /> : null}
          </button>
        );
      })}
    </div>
  );

  const mobileSheet =
    open && isMobileSheet && portalReady
      ? createPortal(
          <div className="fixed inset-0 z-[10000] md:hidden">
            <button
              type="button"
              className="sb-theme-sheet-backdrop absolute inset-0"
              aria-label="Close theme picker"
              onClick={() => setOpen(false)}
            />
            <div
              className="dashboard-sidebar sb-theme-sheet-panel absolute inset-x-0 bottom-0 rounded-t-3xl border shadow-2xl p-4 pb-6 animate-in slide-in-from-bottom duration-200"
              style={theme.tokens as React.CSSProperties}
              data-sidebar-light={theme.isLight ? "true" : "false"}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--sb-border-subtle)]" />
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black text-[var(--sb-text)]">{heading}</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="sb-icon-btn p-1.5 rounded-lg"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
              {themeList}
            </div>
          </div>,
          document.body
        )
      : null;

  const dropdownPanel =
    open && !isMobileSheet ? (
      <div
        className={`sb-panel absolute rounded-2xl border shadow-2xl p-1.5 z-[9999] w-56 ${
          variant === "header"
            ? collapsed
              ? "left-full top-0 ml-2"
              : "left-0 top-full mt-1.5"
            : collapsed
              ? "left-full bottom-0 ml-3"
              : "bottom-full left-0 right-0 mb-1.5"
        }`}
      >
        <p className="sb-menu-heading text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 select-none border-b">
          {heading}
        </p>
        {themeList}
      </div>
    ) : null;

  if (variant === "header" || collapsed) {
    return (
      <>
        <div ref={rootRef} className="relative shrink-0">
          <button
            type="button"
            className="sb-toggle relative flex h-8 w-8 items-center justify-center rounded-lg border overflow-hidden text-[var(--sb-text-muted)] transition-all hover:text-[var(--sb-hover-text)] hover:scale-105"
            title={`${heading}: ${currentLabel}`}
            aria-label={heading}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span
              className="absolute inset-0 opacity-35"
              style={{
                background: `linear-gradient(135deg, ${theme.preview[0]}, ${theme.preview[1]})`,
              }}
            />
            <Palette size={14} className="relative z-10" />
          </button>
          {dropdownPanel}
        </div>
        {mobileSheet}
      </>
    );
  }

  return (
    <>
      <div ref={rootRef} className="relative mt-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="sb-menu-item w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border border-[var(--sb-border-subtle)] transition-colors cursor-pointer"
        >
          <Palette size={13} className="shrink-0 text-[var(--sb-text-muted)]" />
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-[var(--sb-text-muted)]">
              {heading}
            </span>
            <span className="block truncate text-[11px] font-bold text-[var(--sb-text)]">{currentLabel}</span>
          </span>
          <span
            className="h-4 w-4 shrink-0 rounded-md border border-[var(--sb-border-subtle)]"
            style={{
              background: `linear-gradient(135deg, ${theme.preview[0]}, ${theme.preview[1]})`,
            }}
          />
        </button>
        {dropdownPanel}
      </div>
      {mobileSheet}
    </>
  );
}
