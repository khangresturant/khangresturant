"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useShop } from "@/context/ShopContext";
import {
  fetchSidebarThemePreference,
  saveSidebarThemePreference,
} from "@/lib/dashboard/sidebar-theme-preference";
import {
  DEFAULT_SIDEBAR_THEME_ID,
  SIDEBAR_THEME_STORAGE_KEY,
  SIDEBAR_THEMES,
  getSidebarTheme,
  isSidebarThemeId,
  type SidebarTheme,
  type SidebarThemeId,
} from "@/lib/dashboard/sidebar-themes";
import { getDefaultSidebarThemeId, isFlame9Brand } from "@/lib/deployment/flame9-brand";

export type SidebarThemeSyncStatus = "idle" | "loading" | "synced" | "local_only" | "error";

type SidebarThemeContextValue = {
  themeId: SidebarThemeId;
  theme: SidebarTheme;
  themes: SidebarTheme[];
  setTheme: (id: SidebarThemeId) => void;
  mounted: boolean;
  syncStatus: SidebarThemeSyncStatus;
};

const SidebarThemeContext = createContext<SidebarThemeContextValue | undefined>(
  undefined
);

function readLocalSidebarTheme(): SidebarThemeId | null {
  try {
    const saved = localStorage.getItem(SIDEBAR_THEME_STORAGE_KEY);
    if (saved && isSidebarThemeId(saved)) return saved;
  } catch {
    /* private mode / blocked storage */
  }
  return null;
}

function writeLocalSidebarTheme(id: SidebarThemeId) {
  try {
    localStorage.setItem(SIDEBAR_THEME_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function SidebarThemeProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useShop();
  const initialTheme = getDefaultSidebarThemeId() as SidebarThemeId;
  const [themeId, setThemeId] = useState<SidebarThemeId>(initialTheme);
  const [mounted, setMounted] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SidebarThemeSyncStatus>("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestThemeRef = useRef<SidebarThemeId>(DEFAULT_SIDEBAR_THEME_ID);

  useEffect(() => {
    latestThemeRef.current = themeId;
  }, [themeId]);

  useEffect(() => {
    if (isFlame9Brand()) {
      const localTheme = readLocalSidebarTheme();
      const flameTheme = getDefaultSidebarThemeId() as SidebarThemeId;
      const next = localTheme || flameTheme;
      setThemeId(next);
      latestThemeRef.current = next;
      if (!localTheme) writeLocalSidebarTheme(flameTheme);
    } else {
      const localTheme = readLocalSidebarTheme();
      if (localTheme) {
        setThemeId(localTheme);
        latestThemeRef.current = localTheme;
      }
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !userId) {
      if (mounted && !userId) setSyncStatus("local_only");
      return;
    }

    const activeUserId = userId;
    let cancelled = false;

    async function hydrateFromCloud() {
      setSyncStatus("loading");
      try {
        const cloudTheme = await fetchSidebarThemePreference(activeUserId);

        if (cancelled) return;

        if (cloudTheme) {
          setThemeId(cloudTheme);
          latestThemeRef.current = cloudTheme;
          writeLocalSidebarTheme(cloudTheme);
          setSyncStatus("synced");
          return;
        }

        const localTheme = readLocalSidebarTheme();
        if (localTheme) {
          const saved = await saveSidebarThemePreference(activeUserId, localTheme);
          setSyncStatus(saved ? "synced" : "local_only");
        } else {
          const saved = await saveSidebarThemePreference(activeUserId, DEFAULT_SIDEBAR_THEME_ID);
          setSyncStatus(saved ? "synced" : "local_only");
        }
      } catch {
        if (!cancelled) setSyncStatus("error");
      }
    }

    hydrateFromCloud();

    return () => {
      cancelled = true;
    };
  }, [mounted, userId]);

  const persistTheme = useCallback(
    (id: SidebarThemeId) => {
      writeLocalSidebarTheme(id);

      if (!userId) {
        setSyncStatus("local_only");
        return;
      }

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(async () => {
        const themeToSave = latestThemeRef.current;
        const ok = await saveSidebarThemePreference(userId, themeToSave);
        setSyncStatus(ok ? "synced" : "error");
      }, 400);
    },
    [userId]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const setTheme = useCallback(
    (id: SidebarThemeId) => {
      setThemeId(id);
      latestThemeRef.current = id;
      persistTheme(id);
    },
    [persistTheme]
  );

  const theme = useMemo(() => getSidebarTheme(themeId), [themeId]);
  const cssVars = theme.tokens as React.CSSProperties;

  const value = useMemo<SidebarThemeContextValue>(
    () => ({
      themeId,
      theme,
      themes: SIDEBAR_THEMES,
      setTheme,
      mounted,
      syncStatus,
    }),
    [themeId, theme, setTheme, mounted, syncStatus]
  );

  return (
    <SidebarThemeContext.Provider value={value}>
      <div
        className="dashboard-theme-root contents"
        data-sidebar-theme={themeId}
        data-sidebar-light={theme.isLight ? "true" : "false"}
        style={cssVars}
      >
        {children}
      </div>
    </SidebarThemeContext.Provider>
  );
}

export function useSidebarTheme() {
  const ctx = useContext(SidebarThemeContext);
  if (!ctx) {
    throw new Error("useSidebarTheme must be used within SidebarThemeProvider");
  }
  return ctx;
}
