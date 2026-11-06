/**
 * Runtime configuration from environment variables.
 * Cafe Master defaults to local SQLite when cloud Supabase is not configured.
 */

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    if (isLocalSqliteEnabled()) return "";
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!key) {
    if (isLocalSqliteEnabled()) return "";
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return key;
}

/** Platform (super-admin) shop used for SaaS plans, gateways, announcements. */
export function getPlatformShopId(): string {
  return process.env.NEXT_PUBLIC_PLATFORM_SHOP_ID || "";
}

export function getServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}

export function getDatabaseUrl(): string | undefined {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || undefined;
}

export function getGoogleOAuthClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
}

export function isMockSupabaseEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK === "true";
}

/** Local file DB via better-sqlite3 + /api/local-sqlite (default when no cloud URL). */
export function isLocalSqliteEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_USE_LOCAL_SQLITE === "false") return false;
  if (process.env.NEXT_PUBLIC_USE_LOCAL_SQLITE === "true") return true;
  return !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
}

/** Browser app uses mock Supabase + SQLite file instead of cloud PostgREST. */
export function usesLocalDatabase(): boolean {
  return (
    isMockSupabaseEnabled() ||
    isLocalSqliteEnabled() ||
    (process.env.NEXT_PUBLIC_BRAND || "").toLowerCase() === "flame9"
  );
}
