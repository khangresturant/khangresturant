"use client";

import { useMemo } from "react";
import { Check, Cloud, CloudOff, Loader2, Monitor, Moon, Palette, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useSidebarTheme } from "@/context/SidebarThemeContext";
import {
  DEFAULT_SIDEBAR_THEME_ID,
  SIDEBAR_THEMES,
  type SidebarTheme,
  type SidebarThemeId,
} from "@/lib/dashboard/sidebar-themes";

function SidebarThemePreview({ theme }: { theme: SidebarTheme }) {
  return (
    <div
      className="dashboard-sidebar rounded-2xl overflow-hidden border shadow-xl w-full max-w-[220px] flex flex-col shrink-0"
      style={theme.tokens as React.CSSProperties}
    >
      <div className="sb-header h-11 px-3 flex items-center gap-2 shrink-0">
        <div className="h-6 w-6 rounded-md bg-white/15 shrink-0" />
        <div className="space-y-1 min-w-0 flex-1">
          <div className="h-2 w-14 rounded sb-skeleton" />
          <div className="h-1.5 w-10 rounded sb-skeleton opacity-70" />
        </div>
      </div>
      <div className="flex-1 p-2.5 space-y-1.5">
        <div className="sb-nav-link is-active rounded-lg px-2.5 py-2 text-[10px] font-bold">Dashboard</div>
        <div className="sb-nav-link rounded-lg px-2.5 py-2 text-[10px] font-semibold">Sales & POS</div>
        <div className="sb-nav-link rounded-lg px-2.5 py-2 text-[10px] font-semibold">Inventory</div>
        <div className="sb-nav-link rounded-lg px-2.5 py-2 text-[10px] font-semibold">Reports</div>
      </div>
      <div className="sb-footer h-10 px-3 flex items-center gap-2 shrink-0">
        <div className="sb-avatar h-6 w-6 rounded-full border shrink-0" />
        <div className="h-2 w-12 rounded sb-skeleton flex-1" />
      </div>
    </div>
  );
}

export function SidebarThemeSettingsPanel() {
  const { language, t } = useLanguage();
  const { themeId, theme, setTheme, mounted, syncStatus } = useSidebarTheme();

  const sortedThemes = useMemo(() => SIDEBAR_THEMES, []);

  const syncMessage = (() => {
    switch (syncStatus) {
      case "loading":
        return t("sidebar_theme_syncing");
      case "synced":
        return t("sidebar_theme_synced");
      case "local_only":
        return t("sidebar_theme_local_only");
      case "error":
        return t("sidebar_theme_sync_error");
      default:
        return null;
    }
  })();

  if (!mounted) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center text-slate-400 text-sm">
        Loading appearance settings...
      </div>
    );
  }

  const currentLabel = language === "ur" ? theme.nameUr : theme.name;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
            <Palette className="text-blue-500" size={18} />
            {t("sidebar_theme_settings")}
          </h3>
          <p className="text-sm text-slate-500 mt-1.5">{t("sidebar_theme_settings_desc")}</p>
          {syncMessage ? (
            <p
              className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${
                syncStatus === "synced"
                  ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                  : syncStatus === "error"
                    ? "text-amber-700 bg-amber-50 border border-amber-200"
                    : syncStatus === "loading"
                      ? "text-blue-700 bg-blue-50 border border-blue-200"
                      : "text-slate-600 bg-slate-100 border border-slate-200"
              }`}
            >
              {syncStatus === "loading" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : syncStatus === "synced" ? (
                <Cloud size={12} />
              ) : (
                <CloudOff size={12} />
              )}
              {syncMessage}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedThemes.map((item) => {
            const selected = item.id === themeId;
            const label = language === "ur" ? item.nameUr : item.name;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id as SidebarThemeId)}
                className={`group text-left rounded-2xl border p-4 transition-all cursor-pointer ${
                  selected
                    ? "border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/15 shadow-sm"
                    : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white hover:shadow-sm"
                }`}
                aria-pressed={selected}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="h-11 w-11 shrink-0 rounded-xl border border-slate-200/80 shadow-inner"
                      style={{
                        background: `linear-gradient(135deg, ${item.preview[0]}, ${item.preview[1]})`,
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>
                    </div>
                  </div>
                  {selected ? (
                    <span className="shrink-0 h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center">
                      <Check size={13} strokeWidth={3} />
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                  {item.isLight ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      <Monitor size={10} /> {t("sidebar_theme_light_hint")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                      <Moon size={10} /> {t("sidebar_theme_dark_hint")}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            {t("sidebar_theme_active")}: <strong className="text-slate-800">{currentLabel}</strong>
          </p>
          {themeId !== DEFAULT_SIDEBAR_THEME_ID ? (
            <button
              type="button"
              onClick={() => setTheme(DEFAULT_SIDEBAR_THEME_ID)}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Reset to default
            </button>
          ) : null}
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 xl:sticky xl:top-6 h-fit">
        <div>
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Sparkles className="text-violet-500" size={16} />
            {t("sidebar_theme_preview")}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Changes apply instantly to your dashboard sidebar.
          </p>
        </div>
        <div className="flex justify-center xl:justify-start">
          <SidebarThemePreview theme={theme} />
        </div>
      </div>
    </div>
  );
}
