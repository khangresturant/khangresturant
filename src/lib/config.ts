/**
 * Runtime configuration from environment variables.
 * Never hardcode secrets or connection strings in application code.
 */

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL. Copy .env.example to .env.local and fill values.");
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill values.");
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

/** Persist mock data to `data/flame9.sqlite` via /api/local-sqlite */
export function isLocalSqliteEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_LOCAL_SQLITE === "true";
}
