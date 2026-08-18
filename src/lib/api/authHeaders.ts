import { getSupabaseClient } from '@/lib/supabaseClient';
import { isSupabaseAppConfigured } from '@/data/orgDefaults';

/**
 * Attach a JWT so Edge Functions with verify_jwt = true accept the request.
 * Prefer the signed-in user token; fall back to the anon key JWT for public
 * corpus / health calls. In-function authorizeCaller still rejects anon tokens
 * that are not linked to a public.users row.
 */
export async function apiAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  let token: string | undefined;
  if (isSupabaseAppConfigured()) {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch {
      // ignore
    }
  }
  token = token || anon;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
