import { createClient } from "@/lib/supabase/client";
import { isLocalSqliteEnabled } from "@/lib/config";
import {
  isSidebarThemeId,
  type SidebarThemeId,
} from "@/lib/dashboard/sidebar-themes";

const LOCAL_SIDEBAR_PREF_KEY = "cookswift_sidebar_theme_profile";

function prefersLocalSidebarSync(): boolean {
  if (typeof window !== "undefined" && window.electronAPI?.isDesktop) return true;
  return isLocalSqliteEnabled();
}

function readLocalProfileTheme(userId: string): SidebarThemeId | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_SIDEBAR_PREF_KEY}_${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sidebar_theme?: string };
    return parsed.sidebar_theme && isSidebarThemeId(parsed.sidebar_theme)
      ? parsed.sidebar_theme
      : null;
  } catch {
    return null;
  }
}

function writeLocalProfileTheme(userId: string, themeId: SidebarThemeId): void {
  try {
    localStorage.setItem(
      `${LOCAL_SIDEBAR_PREF_KEY}_${userId}`,
      JSON.stringify({
        sidebar_theme: themeId,
        sidebar_theme_updated_at: new Date().toISOString(),
      })
    );
  } catch {
    /* ignore */
  }
}

export type UiPreferences = {
  sidebar_theme?: SidebarThemeId;
  sidebar_theme_updated_at?: string;
};

function isMissingColumnError(error: { message?: string; hint?: string | null; code?: string } | null) {
  if (!error) return false;
  const msg = `${error.message || ""} ${error.hint || ""}`;
  return (
    error.code === "42703" ||
    msg.includes("ui_preferences") ||
    msg.includes("does not exist")
  );
}

export function readSidebarThemeFromPreferences(
  preferences: unknown
): SidebarThemeId | null {
  if (!preferences || typeof preferences !== "object") return null;
  const theme = (preferences as UiPreferences).sidebar_theme;
  return theme && isSidebarThemeId(theme) ? theme : null;
}

export async function fetchSidebarThemePreference(
  userId: string
): Promise<SidebarThemeId | null> {
  if (prefersLocalSidebarSync()) {
    return readLocalProfileTheme(userId);
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_profiles")
      .select("ui_preferences")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error)) return readLocalProfileTheme(userId);
      return readLocalProfileTheme(userId);
    }
    if (!data) return readLocalProfileTheme(userId);
    return (
      readSidebarThemeFromPreferences(data.ui_preferences) ||
      readLocalProfileTheme(userId)
    );
  } catch {
    return readLocalProfileTheme(userId);
  }
}

export async function saveSidebarThemePreference(
  userId: string,
  themeId: SidebarThemeId
): Promise<boolean> {
  writeLocalProfileTheme(userId, themeId);

  if (prefersLocalSidebarSync()) {
    try {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("user_profiles")
        .select("ui_preferences")
        .eq("id", userId)
        .maybeSingle();

      const current =
        existing?.ui_preferences && typeof existing.ui_preferences === "object"
          ? (existing.ui_preferences as UiPreferences)
          : {};

      const next: UiPreferences = {
        ...current,
        sidebar_theme: themeId,
        sidebar_theme_updated_at: new Date().toISOString(),
      };

      const { error: writeError } = await supabase
        .from("user_profiles")
        .update({ ui_preferences: next })
        .eq("id", userId);

      if (!writeError) return true;
    } catch {
      /* local profile copy is enough on desktop */
    }
    return true;
  }

  try {
    const supabase = createClient();

    const { data: existing, error: readError } = await supabase
      .from("user_profiles")
      .select("ui_preferences")
      .eq("id", userId)
      .maybeSingle();

    if (readError && !isMissingColumnError(readError)) return false;

    const current =
      existing?.ui_preferences && typeof existing.ui_preferences === "object"
        ? (existing.ui_preferences as UiPreferences)
        : {};

    const next: UiPreferences = {
      ...current,
      sidebar_theme: themeId,
      sidebar_theme_updated_at: new Date().toISOString(),
    };

    const { error: writeError } = await supabase
      .from("user_profiles")
      .update({ ui_preferences: next })
      .eq("id", userId);

    if (writeError && isMissingColumnError(writeError)) return false;
    return !writeError;
  } catch {
    return false;
  }
}
