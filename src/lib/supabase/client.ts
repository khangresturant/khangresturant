// =============================================================================
// ONLY NEON POSTGRESQL DATABASE IS ACTIVE. ALL OTHER DATABASES ARE DISABLED.
// =============================================================================
import { mockSupabase } from "../supabaseMock";

export function createClient() {
  // Always return the Neon database client bridge.
  // All other database clients (Supabase, SQLite, etc.) are permanently commented out and closed.
  return mockSupabase as any;
}
