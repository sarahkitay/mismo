import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseAppConfigured } from '@/data/orgDefaults';
import { INFRA_NOT_CONFIGURED } from '@/lib/infraMessaging';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseAppConfigured()) {
    throw new Error(INFRA_NOT_CONFIGURED);
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
