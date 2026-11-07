import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { usesLocalDatabase } from "@/lib/config";
import { parseLocalAuthFromCookies } from "@/lib/local-sqlite/local-auth";
import { createLocalServerClient } from "@/lib/local-sqlite/server-client";

/**
 * Supabase client for Server Components / Route Handlers.
 * Local SQLite mode uses the same mock/JSON store as the dashboard.
 */
export async function createServerSupabaseClient() {
  if (usesLocalDatabase()) {
    const cookieStore = await cookies();
    const user = parseLocalAuthFromCookies(cookieStore.getAll());
    return createLocalServerClient(user);
  }

  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* Server Component - ignore */
        }
      },
    },
  });
}

/**
 * Service-role client (bypasses RLS). Local mode uses SQLite with admin session.
 */
export function createServiceSupabaseClient() {
  if (usesLocalDatabase()) {
    return createLocalServerClient(null);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const serviceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  )?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "placeholder-anon-key";

  const effectiveKey = serviceKey || anonKey;

  return createServiceClient(url, effectiveKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
