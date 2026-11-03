"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Lock, Search, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useShop } from "@/context/ShopContext";
import { buildSidebarSections } from "@/lib/dashboard/sidebar-sections";
import type { SidebarLink, SidebarSection } from "@/lib/dashboard/sidebar-types";

type SidebarNavProps = {
  showCollapsed: boolean;
  isMobile: boolean;
  onClose: () => void;
};

function SidebarNavLink({
  link,
  showCollapsed,
  isMobile,
  onClose,
  active,
  locked,
  label,
  onSelect,
  isNavigating,
}: {
  link: SidebarLink;
  showCollapsed: boolean;
  isMobile: boolean;
  onClose: () => void;
  active: boolean;
  locked: boolean;
  label: string;
  onSelect: (path: string) => void;
  isNavigating: boolean;
}) {
  const Icon = link.icon;

  const handleClick = () => {
    onSelect(link.path);
    if (isMobile) {
      onClose();
    }
  };

  return (
    <Link
      href={link.path}
      title={showCollapsed ? label : undefined}
      onClick={handleClick}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center rounded-xl transition-all duration-150 select-none ${
        showCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
      } ${
        active
          ? "bg-slate-900 text-white font-bold shadow-xs shadow-slate-900/10"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 active:scale-[0.99] font-medium"
      }`}
    >
      <Icon
        size={17}
        className={`shrink-0 transition-transform duration-150 ${
          active
            ? "text-white"
            : "text-slate-500 group-hover:text-slate-900 group-hover:scale-105"
        }`}
      />
      {!showCollapsed && (
        <div
          className={`text-xs tracking-tight truncate flex-1 leading-tight ${
            active ? "text-white font-bold" : "text-slate-700 group-hover:text-slate-900 font-semibold"
          }`}
        >
          {label}
        </div>
      )}
      {!showCollapsed && isNavigating && (
        <div className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-ping ml-auto shrink-0" />
      )}
      {!showCollapsed && !isNavigating && locked && (
        <Lock size={12} className="text-slate-400 group-hover:text-slate-600 ml-auto transition-colors shrink-0" />
      )}
      {showCollapsed && (
        <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-[11px] font-bold rounded-xl shadow-xl border border-slate-800 opacity-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap pointer-events-none z-[999999] flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          {label}
        </div>
      )}
    </Link>
  );
}

{/* Fiscal Period component definition preserved for future toggle */}
function SidebarFiscalStrip({ showCollapsed }: { showCollapsed: boolean }) {
  const { t } = useLanguage();
  const { loading, activeClosingBook, closingBooks, switchClosingBook } = useShop();
  const [isBookDropdownOpen, setIsBookDropdownOpen] = useState(false);

  if (showCollapsed || loading) return null;

  return (
    <div className="sb-fiscal-strip px-3 py-2 shrink-0">
      <div className="relative">
        <p className="sb-label text-[8.5px] font-black uppercase tracking-[0.18em] block mb-1">
          {t("fiscal_period")}
        </p>
        <button
          onClick={() => setIsBookDropdownOpen((open) => !open)}
          className={`sb-fiscal-btn w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
            activeClosingBook ? "is-closed" : "is-open"
          }`}
        >
          <div className="truncate flex items-center gap-1.5">
            <div
              className={`sb-fiscal-dot h-1.5 w-1.5 rounded-full ${activeClosingBook ? "is-closed" : "is-open"}`}
            />
            {activeClosingBook ? activeClosingBook.name : t("active_period")}
          </div>
          <ChevronDown
            size={11}
            className="sb-meta shrink-0"
            style={{ transform: isBookDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
          />
        </button>

        {isBookDropdownOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsBookDropdownOpen(false)} />
            <div className="sb-panel absolute left-0 right-0 mt-1.5 rounded-xl border shadow-2xl p-1 z-40 max-h-48 overflow-y-auto custom-scrollbar">
              <button
                onClick={() => {
                  switchClosingBook(null);
                  setIsBookDropdownOpen(false);
                }}
                className={`sb-menu-item w-full text-left px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-colors flex items-center justify-between cursor-pointer ${
                  !activeClosingBook ? "is-fiscal-open" : ""
                }`}
              >
                <div className="flex items-center gap-1.5">Active Book (Current)</div>
                {!activeClosingBook && <Check size={10} className="stroke-[3]" />}
              </button>
              {closingBooks.map((book) => {
                const isSelected = activeClosingBook?.id === book.id;
                return (
                  <button
                    key={book.id}
                    onClick={() => {
                      switchClosingBook(book);
                      setIsBookDropdownOpen(false);
                    }}
                    className={`sb-menu-item w-full text-left px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected ? "is-fiscal-closed" : ""
                    }`}
                  >
                    <div className="truncate pr-1">{book.name}</div>
                    {isSelected && <Check size={10} className="stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

{/* Menu searchbar component definition preserved for future toggle */}
function SidebarNavSearch({
  query,
  onChange,
  onClear,
  placeholder,
}: {
  query: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="px-2.5 pt-1 pb-1 shrink-0">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          title={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          suppressHydrationWarning
          className="sb-nav-search w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs font-semibold outline-none transition-all focus:bg-white focus:border-slate-400"
        />
        {query ? (
          <button
            type="button"
            onClick={onClear}
            className="sb-icon-btn absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X size={11} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SidebarNavSections({
  sections,
  showCollapsed,
  isMobile,
  onClose,
  hasPermission,
  isLinkActive,
  isLinkAuthorized,
  onSelect,
  navigatingPath,
  t,
  emptyLabel,
}: {
  sections: SidebarSection[];
  showCollapsed: boolean;
  isMobile: boolean;
  onClose: () => void;
  hasPermission: (key?: string) => boolean;
  isLinkActive: (path: string) => boolean;
  isLinkAuthorized: (path: string) => boolean;
  onSelect: (path: string) => void;
  navigatingPath: string | null;
  t: (key: string) => string;
  emptyLabel?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(true);
  const [scrollBottom, setScrollBottom] = useState(true);

  const updateScrollState = () => {
    const node = scrollRef.current;
    if (!node) return;
    const atTop = node.scrollTop <= 4;
    const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 4;
    setScrollTop(atTop);
    setScrollBottom(atBottom);
  };

  useEffect(() => {
    updateScrollState();
  }, [sections, showCollapsed]);

  const visibleSections = sections
    .map((section) => ({
      ...section,
      links: section.links.filter((link) => hasPermission(link.permissionKey)),
    }))
    .filter((section) => section.links.length > 0);

  return (
    <div
      className={`sb-nav-scroll-wrap flex-1 min-h-0 h-full flex flex-col ${showCollapsed ? "overflow-visible" : "overflow-hidden"}`}
      data-scroll-top={scrollTop ? "true" : "false"}
      data-scroll-bottom={scrollBottom ? "true" : "false"}
    >
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className={`flex-1 min-h-0 h-full py-3 px-2.5 space-y-3 touch-pan-y overscroll-contain no-scrollbar ${
          showCollapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"
        }`}
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {visibleSections.length === 0 && emptyLabel ? (
          <p className="px-2 text-center text-[11px] font-semibold text-slate-400">{emptyLabel}</p>
        ) : (
          visibleSections.map((section) => (
            <div key={section.titleKey} className="space-y-0.5">
              {showCollapsed ? (
                <div className="border-t border-slate-200/80 my-1.5 mx-1" />
              ) : (
                <div className="flex items-center gap-1.5 px-2 mb-1.5 mt-2">
                  <div className="h-1 w-1 rounded-full bg-slate-300" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t(section.titleKey)}
                  </p>
                </div>
              )}
              <div className="space-y-0.5">
                {section.links.map((link) => {
                  const active = isLinkActive(link.path);
                  const isNavigating = navigatingPath === link.path;

                  return (
                    <SidebarNavLink
                      key={link.path}
                      link={link}
                      showCollapsed={showCollapsed}
                      isMobile={isMobile}
                      onClose={onClose}
                      active={active}
                      locked={!isLinkAuthorized(link.path)}
                      label={t(link.nameKey)}
                      onSelect={onSelect}
                      isNavigating={isNavigating}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function SidebarNav({ showCollapsed, isMobile, onClose }: SidebarNavProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const {
    industryType,
    userRole,
    loading,
    permissions,
    hasEmi,
    hasPayroll,
    hasTax,
    hasAssetsRec,
    hasGiftCards,
    hasEcommerce,
    subscriptionTier,
    subscriptionExpiresAt,
    saasPlans,
    canAccessDashboardPath,
  } = useShop();

  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const [navigatingPath, setNavigatingPath] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When pathname changes, sync and reset optimistic state
  useEffect(() => {
    setOptimisticPath(null);
    setNavigatingPath(null);
  }, [pathname]);

  const handleSelectLink = (path: string) => {
    setOptimisticPath(path);
    setNavigatingPath(path);

    // Timeout safety fallback
    setTimeout(() => {
      setNavigatingPath(null);
    }, 2500);
  };

  const sections = useMemo(
    () =>
      buildSidebarSections({
        industryType,
        hasEmi,
        hasPayroll,
        hasTax,
        hasAssetsRec,
        hasGiftCards,
        hasEcommerce,
        subscriptionTier,
        subscriptionExpiresAt,
        remotePlans: saasPlans,
      }),
    [industryType, hasEmi, hasPayroll, hasTax, hasAssetsRec, hasGiftCards, hasEcommerce, subscriptionTier, subscriptionExpiresAt, saasPlans]
  );

  const filteredSections = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return sections;

    return sections
      .map((section) => ({
        ...section,
        links: section.links.filter((link) => {
          const label = t(link.nameKey).toLowerCase();
          return label.includes(normalized) || link.path.toLowerCase().includes(normalized);
        }),
      }))
      .filter((section) => section.links.length > 0);
  }, [sections, searchQuery, t]);

  // Collect all known link paths across sections to determine unique best match
  const allLinkPaths = useMemo(() => {
    const paths: string[] = [];
    sections.forEach((sec) => {
      sec.links.forEach((l) => {
        if (!paths.includes(l.path)) {
          paths.push(l.path);
        }
      });
    });
    return paths;
  }, [sections]);

  // Robust, single-winner active check
  const isLinkActive = (linkPath: string) => {
    let currentUrl = optimisticPath;
    if (!currentUrl) {
      if (mounted && typeof window !== "undefined") {
        currentUrl = pathname + window.location.search;
      } else {
        currentUrl = pathname;
      }
    }

    const [currentPathname, currentSearch = ""] = currentUrl.split("?");
    const [targetPathname, targetSearch = ""] = linkPath.split("?");

    const currentParams = new URLSearchParams(currentSearch);
    const targetParams = new URLSearchParams(targetSearch);

    // 1. Target has query parameters (e.g. ?tab=categories, ?tab=payroll, ?tab=assets)
    if (targetSearch) {
      if (currentPathname !== targetPathname) return false;
      for (const [key, val] of targetParams.entries()) {
        if (currentParams.get(key) !== val) return false;
      }
      return true;
    }

    // 2. Target has NO query parameters:
    const currentTab = currentParams.get("tab");
    if (currentTab) {
      const isHandledByAnotherLink = allLinkPaths.some((p) => {
        const [pName, pSearch] = p.split("?");
        if (pName === targetPathname && pSearch) {
          const pParams = new URLSearchParams(pSearch);
          return pParams.get("tab") === currentTab;
        }
        return false;
      });
      if (isHandledByAnotherLink) {
        return false;
      }
    }

    // 3. Exact pathname match
    if (currentPathname === targetPathname) {
      return true;
    }

    // 4. Subroute matching (e.g. /dashboard/products/something)
    if (targetPathname !== "/dashboard" && currentPathname.startsWith(targetPathname + "/")) {
      const hasMoreSpecificLink = allLinkPaths.some((p) => {
        const [pName] = p.split("?");
        return pName !== targetPathname && currentPathname.startsWith(pName);
      });
      return !hasMoreSpecificLink;
    }

    return false;
  };

  const hasPermission = (key?: string) => {
    if (!key) return true;
    if (
      !userRole ||
      userRole === "owner" ||
      userRole === "superadmin" ||
      userRole === "saasadmin" ||
      userRole === "admin" ||
      userRole === "manager"
    ) {
      return true;
    }
    if (loading || !permissions) return true;
    return permissions.panels?.[key] === true;
  };

  const isLinkAuthorized = (path: string) =>
    typeof canAccessDashboardPath === "function" ? canAccessDashboardPath(path) : true;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
      {/* Fiscal Period commented out as requested by user */}
      {/* <SidebarFiscalStrip showCollapsed={showCollapsed} /> */}

      {/* Menu searchbar commented out as requested by user */}
      {/* {!showCollapsed ? (
        <SidebarNavSearch
          query={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery("")}
          placeholder={t("sidebar_nav_search")}
        />
      ) : null} */}

      <SidebarNavSections
        sections={filteredSections}
        showCollapsed={showCollapsed}
        isMobile={isMobile}
        onClose={onClose}
        hasPermission={hasPermission}
        isLinkActive={isLinkActive}
        isLinkAuthorized={isLinkAuthorized}
        onSelect={handleSelectLink}
        navigatingPath={navigatingPath}
        t={t}
        emptyLabel={searchQuery.trim() ? t("sidebar_nav_no_results") : undefined}
      />
    </div>
  );
}
