import { createBrowserClient } from '@supabase/ssr'
import { mockSupabase } from '../supabaseMock';

export function createClient() {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

  if (useMock) {
    return mockSupabase as any;
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
