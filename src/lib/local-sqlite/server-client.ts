import { mockSupabase } from "@/lib/supabaseMock";
import {
  FLAME9_LOCAL_LOGINS,
  FLAME9_LOCAL_USER_ID,
  FLAME9_STAFF_USER_ID,
} from "@/lib/local-sqlite/seed-data";
import type { LocalAuthUser } from "@/lib/local-sqlite/local-auth";

/** Server-side SQLite client (same mock query layer as the browser). */
export function createLocalServerClient(sessionUser: LocalAuthUser | null): any {
  const defaultUser: LocalAuthUser = {
    id: FLAME9_LOCAL_USER_ID,
    email: FLAME9_LOCAL_LOGINS.admin.email,
  };
  const user = sessionUser ?? defaultUser;

  return {
    ...mockSupabase,
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({
        data: { session: user ? { user } : null },
        error: null,
      }),
      signInWithPassword: async ({
        email,
        password,
      }: {
        email: string;
        password: string;
      }) => {
        const normalized = email.trim().toLowerCase();
        const accounts = [FLAME9_LOCAL_LOGINS.admin, FLAME9_LOCAL_LOGINS.staff];
        const match = accounts.find((a) => a.email === normalized && a.password === password);
        if (!match) {
          return { data: { user: null }, error: { message: "Invalid login credentials" } };
        }
        const id = match.role === "superadmin" ? FLAME9_LOCAL_USER_ID : FLAME9_STAFF_USER_ID;
        return { data: { user: { id, email: match.email } }, error: null };
      },
      signUp: async ({ email }: { email: string }) => ({
        data: { user: { id: FLAME9_LOCAL_USER_ID, email } },
        error: null,
      }),
      signOut: async () => ({ error: null }),
    },
    from: (tableName: string) => mockSupabase.from(tableName),
    rpc: mockSupabase.rpc.bind(mockSupabase),
    channel: mockSupabase.channel.bind(mockSupabase),
    removeChannel: mockSupabase.removeChannel.bind(mockSupabase),
  };
}
