import { getApiBaseUrl } from '@/lib/api/aiServices';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { isSupabaseAppConfigured } from '@/data/orgDefaults';
import { API_NOT_CONFIGURED, sanitizeInfraError } from '@/lib/infraMessaging';

export type InviteEmployeeResult = {
  ok: boolean;
  status: 'invited' | 'already_registered';
  message: string;
  /** Shareable link the admin can hand to the employee instead of email. */
  actionLink?: string;
};

/**
 * Ask the API to email an employee an invite to create their Mismo login.
 * Sends the current user's access token so the server can authorize the caller
 * as HR/Admin. Returns a result the caller can surface as a toast.
 */
export async function inviteEmployeeToMismo(email: string): Promise<InviteEmployeeResult> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) throw new Error(API_NOT_CONFIGURED);
  if (!isSupabaseAppConfigured()) throw new Error(API_NOT_CONFIGURED);

  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in again to send invites.');

  // Prefer an explicit public app URL so shared links never point at a local
  // dev origin. Falls back to the current origin when not configured.
  const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  const redirectTo = publicAppUrl ? publicAppUrl.replace(/\/$/, '') : window.location.origin;

  const res = await fetch(`${apiBase.replace(/\/$/, '')}/employees/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email, redirectTo }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(sanitizeInfraError(err.error ?? `Invite failed (${res.status})`));
  }

  return res.json() as Promise<InviteEmployeeResult>;
}
