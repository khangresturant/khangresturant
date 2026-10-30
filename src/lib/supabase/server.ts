import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * Supabase client for Server Components / Route Handlers (cookie session).
 * Uses the anon key; RLS applies as the signed-in user.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

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
          // Called from a Server Component that cannot set cookies — ignore.
        }
      },
    },
  });
}

/**
 * Service-role client (bypasses RLS). Server-only. Never import in client code.
 * Uses SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY with graceful fallback.
 */
export function createServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  )?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

  const effectiveKey = serviceKey || anonKey;

  if (!effectiveKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required."
    );
  }

  if (!serviceKey) {
    console.warn(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY missing — using anon key for server client."
    );
  }

  return createServiceClient(url, effectiveKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
