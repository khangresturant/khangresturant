import { createBrowserClient } from "@supabase/ssr";
import { mockSupabase } from "../supabaseMock";
import { isMockSupabaseEnabled, isLocalSqliteEnabled } from "../config";
import { isFlame9Brand } from "../deployment/flame9-brand";

/** Data access: local SQLite mock by default; cloud Supabase only if explicitly configured. */
export function createClient() {
  const cloudUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const cloudKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const useLocal =
    isMockSupabaseEnabled() ||
    isFlame9Brand() ||
    isLocalSqliteEnabled() ||
    !cloudUrl ||
    !cloudKey;

  if (useLocal) {
    return mockSupabase as any;
  }

  return createBrowserClient(cloudUrl, cloudKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: async (input, init) => {
        return fetch(input, {
          ...init,
          cache: "no-store",
          signal: init?.signal || AbortSignal.timeout(15000),
        });
      },
    },
  });
}
