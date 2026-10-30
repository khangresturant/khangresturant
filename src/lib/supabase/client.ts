import { createBrowserClient } from "@supabase/ssr";
import { mockSupabase } from "../supabaseMock";
import { isMockSupabaseEnabled, isLocalSqliteEnabled } from "../config";
import { isFlame9Brand } from "../deployment/flame9-brand";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserClient | null = null;

export function createClient() {
  const useMock =
    isMockSupabaseEnabled() || isFlame9Brand() || isLocalSqliteEnabled();

  if (useMock) {
    return mockSupabase as any;
  }

  if (browserClient) {
    return browserClient;
  }

  if (typeof window !== "undefined" && (window as any).__supabaseClient) {
    browserClient = (window as any).__supabaseClient;
    return browserClient!;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error(
      "[The Accounts] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.example to .env.local and set credentials."
    );
  }

  browserClient = createBrowserClient(url || "", anonKey || "", {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: async (input, init) => {
        try {
          return await fetch(input, {
            ...init,
            cache: "no-store",
            signal: init?.signal || AbortSignal.timeout(15000),
          });
        } catch (err: any) {
          // If the request was aborted by navigation/unmount, do not log network error
          if (err?.name !== "AbortError" && typeof window !== "undefined") {
            console.warn("[The Accounts] Supabase network connection failed (offline or server unreachable).");
          }
          throw err;
        }
      },
    },
  });
  if (typeof window !== "undefined") {
    (window as any).__supabaseClient = browserClient;
  }
  return browserClient;
}

