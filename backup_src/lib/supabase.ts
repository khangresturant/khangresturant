import { createClient } from '@supabase/supabase-js'
import { mockSupabase } from './supabaseMock';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bzlryfostkzotfgeozjr.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Q3zXiZcGjMtUawvI-GxXjA_KZjQ9dYx';

const useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export const supabase = useMock 
  ? (mockSupabase as any) 
  : createClient(supabaseUrl, supabaseAnonKey);
