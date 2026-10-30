import { createClient } from "@/lib/supabase/client";
import {
  isSidebarThemeId,
  type SidebarThemeId,
} from "@/lib/dashboard/sidebar-themes";

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
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("ui_preferences")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) return null;
    return null;
  }
  if (!data) return null;
  return readSidebarThemeFromPreferences(data.ui_preferences);
}

export async function saveSidebarThemePreference(
  userId: string,
  themeId: SidebarThemeId
): Promise<boolean> {
  const supabase = createClient();

  const { data: existing, error: readError } = await supabase
    .from("user_profiles")
    .select("ui_preferences")
    .eq("id", userId)
    .maybeSingle();

  if (readError) {
    if (isMissingColumnError(readError)) return false;
    return false;
  }

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
}
