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

// =============================================================================
// ONLY NEON POSTGRESQL DATABASE IS ACTIVE. ALL OTHER DATABASES ARE DISABLED.
// =============================================================================
export function isNeonDatabaseOnly(): boolean {
  return true;
}

export function isMockSupabaseEnabled(): boolean {
  return false;
}

/** Local file DB via better-sqlite3 + /api/local-sqlite (Permanently DISABLED). */
export function isLocalSqliteEnabled(): boolean {
  return false;
}

/** Browser app uses mock Supabase + SQLite file (Permanently DISABLED). */
export function usesLocalDatabase(): boolean {
  return false;
}
