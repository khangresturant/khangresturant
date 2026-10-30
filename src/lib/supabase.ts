import { createClient } from "./supabase/client";

/** Shared browser Supabase client (same instance as createClient()). */
export const supabase = createClient();
