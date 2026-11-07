// =============================================================================
// ONLY NEON POSTGRESQL DATABASE IS ACTIVE. ALL OTHER DATABASES ARE DISABLED.
// =============================================================================
import { cookies } from "next/headers";
import { parseLocalAuthFromCookies } from "@/lib/local-sqlite/local-auth";
import { createLocalServerClient } from "@/lib/local-sqlite/server-client";

/**
 * Server-side client. Routes 100% of operations to Neon DB.
 * Cloud Supabase and local SQLite are permanently disabled.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const user = parseLocalAuthFromCookies(cookieStore.getAll());
  return createLocalServerClient(user);
}

/**
 * Service-role server client. Routes 100% of operations to Neon DB.
 */
export function createServiceSupabaseClient() {
  return createLocalServerClient(null);
}
