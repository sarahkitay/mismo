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
  emailStatus?: string;
  resendConfigured?: boolean;
};

export type InviteEmployeeOptions = {
  /** When false, only generate a shareable link (no email). Default true. */
  sendEmail?: boolean;
};

/**
 * Ask the API to generate (and optionally email) an employee invite / sign-in link.
 */
export async function inviteEmployeeToMismo(
  email: string,
  opts: InviteEmployeeOptions = {}
): Promise<InviteEmployeeResult> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) throw new Error(API_NOT_CONFIGURED);
  if (!isSupabaseAppConfigured()) throw new Error(API_NOT_CONFIGURED);

  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in again to send invites.');

  const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  const redirectTo = publicAppUrl ? publicAppUrl.replace(/\/$/, '') : window.location.origin;

  const res = await fetch(`${apiBase.replace(/\/$/, '')}/employees/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      email,
      redirectTo,
      sendEmail: opts.sendEmail !== false,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(sanitizeInfraError(err.error ?? `Invite failed (${res.status})`));
  }

  return res.json() as Promise<InviteEmployeeResult>;
}

export type UpdateEmployeeEmailResult = {
  ok: boolean;
  message: string;
  email?: string;
};

/** HR: correct an employee email and sync their Supabase Auth login when linked. */
export async function updateEmployeeEmail(opts: {
  targetUserId: string;
  email: string;
}): Promise<UpdateEmployeeEmailResult> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) throw new Error(API_NOT_CONFIGURED);
  if (!isSupabaseAppConfigured()) throw new Error(API_NOT_CONFIGURED);

  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in again to update employee emails.');

  const res = await fetch(`${apiBase.replace(/\/$/, '')}/employees/update-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      targetUserId: opts.targetUserId,
      email: opts.email.trim().toLowerCase(),
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(sanitizeInfraError(err.error ?? `Email update failed (${res.status})`));
  }

  return res.json() as Promise<UpdateEmployeeEmailResult>;
}
