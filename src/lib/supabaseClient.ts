import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseAppConfigured } from '@/data/orgDefaults';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseAppConfigured()) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      { auth: { persistSession: true, autoRefreshToken: true } }
    );
  }
  return client;
}
