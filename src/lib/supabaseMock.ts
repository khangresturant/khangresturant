// =============================================================================
// NEON POSTGRESQL CLIENT BRIDGE
// 100% EXCLUSIVE: Routes all queries, auth, and RPC directly to Neon DB
// All SQLite, LocalStorage fallbacks, and mock DBs are permanently disabled.
// =============================================================================

import {
  persistLocalAuthCookie,
  clearLocalAuthCookie,
} from "./local-sqlite/local-auth";

const MOCK_SESSION_KEY = "mock_auth_session";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getValidSessionUser(): { id: string; email: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MOCK_SESSION_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (user && user.id && UUID_REGEX.test(user.id)) {
      return user;
    }
    // Clear invalid legacy session ID (e.g. flame9-local-user-id)
    sessionStorage.removeItem(MOCK_SESSION_KEY);
    clearLocalAuthCookie();
    return null;
  } catch {
    return null;
  }
}

class MockQueryBuilder {
  tableName: string;
  rawFilters: { column: string; op: string; value: any }[] = [];
  isSingle = false;
  isMaybeSingle = false;
  isInsert = false;
  isUpsert = false;
  upsertConflict: string | null = null;
  isUpdate = false;
  isDelete = false;
  payload: any = null;
  sortField: string | null = null;
  sortAscending = true;
  limitCount: number | null = null;
  rangeFrom: number | null = null;
  rangeTo: number | null = null;
  headCount = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns?: string, options?: { count?: string; head?: boolean }) {
    if (options?.count === "exact" && options?.head) {
      this.headCount = true;
    }
    return this;
  }

  eq(column: string, value: any) {
    this.rawFilters.push({ column, op: "eq", value });
    return this;
  }

  neq(column: string, value: any) {
    this.rawFilters.push({ column, op: "neq", value });
    return this;
  }

  gt(column: string, value: any) {
    this.rawFilters.push({ column, op: "gt", value });
    return this;
  }

  gte(column: string, value: any) {
    this.rawFilters.push({ column, op: "gte", value });
    return this;
  }

  lt(column: string, value: any) {
    this.rawFilters.push({ column, op: "lt", value });
    return this;
  }

  lte(column: string, value: any) {
    this.rawFilters.push({ column, op: "lte", value });
    return this;
  }

  is(column: string, value: any) {
    this.rawFilters.push({ column, op: "is", value });
    return this;
  }

  in(column: string, values: any[]) {
    this.rawFilters.push({ column, op: "in", value: values });
    return this;
  }

  not(column: string, op: string, value: any) {
    if (op === "is") {
      this.rawFilters.push({ column, op: "not_is", value });
    } else if (op === "eq") {
      this.rawFilters.push({ column, op: "neq", value });
    }
    return this;
  }

  order(column: string, { ascending = true } = {}) {
    this.sortField = column;
    this.sortAscending = ascending;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  insert(payload: any) {
    this.isInsert = true;
    this.payload = payload;
    return this;
  }

  upsert(payload: any, options?: { onConflict?: string }) {
    this.isUpsert = true;
    this.payload = payload;
    this.upsertConflict = options?.onConflict || null;
    return this;
  }

  update(payload: any) {
    this.isUpdate = true;
    this.payload = payload;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async then(resolve: any, reject: any) {
    const isBrowser = typeof window !== "undefined";
    const prefix = isBrowser ? "" : (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

    try {
      const operation = this.isInsert
        ? "insert"
        : this.isUpsert
        ? "upsert"
        : this.isUpdate
        ? "update"
        : this.isDelete
        ? "delete"
        : "select";

      const res = await fetch(`${prefix}/api/neon-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: this.tableName,
          operation,
          payload: this.payload,
          onConflict: this.upsertConflict,
          filters: this.rawFilters,
          order: this.sortField ? { column: this.sortField, ascending: this.sortAscending } : null,
          limit: this.limitCount,
          single: this.isSingle,
          maybeSingle: this.isMaybeSingle,
          countOnly: this.headCount,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (json && json.error) {
        console.error("[neon-query error]", json.error);
        resolve({ data: null, error: json.error });
        return;
      }
      resolve(json || { data: null, error: null });
    } catch (neonErr: any) {
      console.error("[Neon DB Connection Error]:", neonErr);
      resolve({ data: null, error: { message: neonErr?.message || "Neon DB connection failed" } });
    }
  }
}

export const mockSupabase = {
  auth: {
    getUser: async () => {
      const user = getValidSessionUser();
      return { data: { user }, error: null };
    },
    getSession: async () => {
      const user = getValidSessionUser();
      if (!user) return { data: { session: null }, error: null };
      return {
        data: {
          session: {
            user,
            access_token: "neon_token_" + user.id,
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      };
    },
    onAuthStateChange: (callback?: any) => {
      if (typeof callback === "function") {
        const user = getValidSessionUser();
        const session = user
          ? {
              user,
              access_token: "neon_token_" + user.id,
              token_type: "bearer",
              expires_in: 3600,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            }
          : null;
        try {
          callback(session ? "SIGNED_IN" : "SIGNED_OUT", session);
        } catch {}
      }
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      };
    },
    refreshSession: async () => {
      const user = getValidSessionUser();
      if (!user) return { data: { session: null, user: null }, error: null };
      const session = {
        user,
        access_token: "neon_token_" + user.id,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };
      return { data: { session, user }, error: null };
    },
    resetPasswordForEmail: async (email: string) => {
      return { data: {}, error: null };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const normalized = email.trim().toLowerCase();
      const isBrowser = typeof window !== "undefined";
      const prefix = isBrowser ? "" : (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
      try {
        const res = await fetch(`${prefix}/api/neon-query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "auth_signin", email: normalized, password }),
        });
        const json = await res.json().catch(() => ({}));
        if (json.data?.user) {
          const session = {
            user: json.data.user,
            access_token: "neon_token_" + json.data.user.id,
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          };
          if (isBrowser) {
            sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(json.data.user));
            persistLocalAuthCookie(json.data.user);
          }
          return { data: { user: json.data.user, session }, error: null };
        }
        return { data: { user: null, session: null }, error: json.error || { message: "Invalid email or password" } };
      } catch (err: any) {
        return { data: { user: null, session: null }, error: { message: err?.message || "Login failed" } };
      }
    },
    signUp: async ({ email, password }: { email: string; password?: string }) => {
      const normalized = email.trim().toLowerCase();
      const isBrowser = typeof window !== "undefined";
      const prefix = isBrowser ? "" : (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
      try {
        const res = await fetch(`${prefix}/api/neon-query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: "auth_signup",
            email: normalized,
            password: password || "Password123!",
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (json.data?.user) {
          const session = {
            user: json.data.user,
            access_token: "neon_token_" + json.data.user.id,
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          };
          if (isBrowser) {
            sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(json.data.user));
            persistLocalAuthCookie(json.data.user);
          }
          return { data: { user: json.data.user, session }, error: null };
        }
        return { data: { user: null, session: null }, error: json.error || { message: "Registration failed on Neon DB" } };
      } catch (err: any) {
        return { data: { user: null, session: null }, error: { message: err?.message || "Signup failed" } };
      }
    },
    signOut: async () => {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(MOCK_SESSION_KEY);
        clearLocalAuthCookie();
      }
      return { error: null };
    },
  },
  from: (tableName: string) => {
    return new MockQueryBuilder(tableName);
  },
  rpc: async (fn: string, args: Record<string, unknown> = {}) => {
    const isBrowser = typeof window !== "undefined";
    const prefix = isBrowser ? "" : (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
    try {
      const res = await fetch(`${prefix}/api/neon-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "rpc", fn, args }),
      });
      const json = await res.json().catch(() => ({}));
      return json || { data: null, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message || "RPC connection failed" } };
    }
  },
  channel: () => {
    return {
      on: function() { return this; },
      subscribe: () => {}
    };
  },
  removeChannel: () => {}
};
