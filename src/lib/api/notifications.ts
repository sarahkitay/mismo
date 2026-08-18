import { getApiBaseUrl } from '@/lib/api/aiServices';
import { apiAuthHeaders } from '@/lib/api/authHeaders';

async function authHeaders(): Promise<Record<string, string>> {
  return apiAuthHeaders();
}

function appOrigin(): string {
  const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  return (publicAppUrl || window.location.origin).replace(/\/$/, '');
}

/**
 * Fire-and-forget Yes-response notice emails (employee + admins).
 * Safe when Resend is not configured: the API returns skipped.
 */
export async function notifyIncidentYes(opts: {
  employeeEmail: string;
  orgId: string;
  caseId?: string;
  employeeUserId?: string;
  intakeUrl?: string;
}): Promise<void> {
  const apiBase = getApiBaseUrl();
  if (!apiBase || !opts.employeeEmail || !opts.orgId) return;
  const origin = appOrigin();
  const intakeUrl =
    opts.intakeUrl ||
    (opts.caseId ? `${origin}/employee/my-reports/${opts.caseId}/intake` : `${origin}/employee/dashboard`);
  try {
    await fetch(`${apiBase.replace(/\/$/, '')}/notifications/incident-yes`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        employeeEmail: opts.employeeEmail,
        orgId: opts.orgId,
        employeeUserId: opts.employeeUserId,
        caseId: opts.caseId,
        dashboardUrl: `${origin}/`,
        caseUrl: opts.caseId ? `${origin}/admin/all-reports/${opts.caseId}` : `${origin}/`,
        intakeUrl,
      }),
    });
  } catch {
    // Non-blocking: case still opens even if mail fails.
  }
}

export async function notifyWageHourYes(opts: {
  employeeEmail: string;
  orgId: string;
  caseId?: string;
  referenceNumber?: string;
  employeeUserId?: string;
  intakeUrl?: string;
}): Promise<void> {
  const apiBase = getApiBaseUrl();
  if (!apiBase || !opts.employeeEmail || !opts.orgId) return;
  const origin = appOrigin();
  const intakeUrl =
    opts.intakeUrl ||
    (opts.caseId
      ? `${origin}/employee/my-reports/${opts.caseId}/wage-hour`
      : `${origin}/employee/report/wage-hour`);
  try {
    await fetch(`${apiBase.replace(/\/$/, '')}/notifications/wage-hour-yes`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        employeeEmail: opts.employeeEmail,
        orgId: opts.orgId,
        employeeUserId: opts.employeeUserId,
        referenceNumber: opts.referenceNumber,
        dashboardUrl: `${origin}/`,
        caseUrl: opts.caseId
          ? `${origin}/admin/all-reports/${opts.caseId}`
          : `${origin}/`,
        caseId: opts.caseId,
        intakeUrl,
      }),
    });
  } catch {
    // Non-blocking
  }
}

/** HR/cron: send 3pm unanswered-prompt reminder emails (idempotent). */
export async function runPromptReminders(opts?: { force?: boolean }): Promise<{
  ok: boolean;
  sent?: number;
  scanned?: number;
  skipped?: number;
  message?: string;
}> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return { ok: false, message: 'API not configured' };
  try {
    const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
    const redirectTo = (publicAppUrl || window.location.origin).replace(/\/$/, '');
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/cron/prompt-reminders`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ force: opts?.force === true, redirectTo }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, message: err.error ?? `Reminders failed (${res.status})` };
    }
    return (await res.json()) as { ok: boolean; sent?: number; scanned?: number; skipped?: number };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export type SendNotificationEmailResult = {
  ok: boolean;
  message: string;
  emailStatus?: string;
  notificationId?: string | null;
  resendConfigured?: boolean;
};

/** Send a message/update email (+ in-app notification) to another org user. */
export async function sendNotificationEmail(opts: {
  recipientUserId: string;
  subject: string;
  body: string;
  kind?: 'MESSAGE' | 'MEMO' | 'PROMPT' | 'CASE_UPDATE' | 'SYSTEM';
  actionPage?: string;
  actionParams?: Record<string, string>;
  templateId?: 'new_message' | 'new_memo' | 'prompt_notice';
}): Promise<SendNotificationEmailResult | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase || !opts.recipientUserId) return null;
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/notifications/send`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        ...opts,
        redirectTo: appOrigin(),
      }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, message: err.error ?? `Send failed (${res.status})` };
    }
    return (await res.json()) as SendNotificationEmailResult;
  } catch {
    return null;
  }
}

export type PasswordResetEmailResult = {
  ok: boolean;
  message: string;
  emailStatus?: string;
  actionLink?: string;
  resendConfigured?: boolean;
};

/** HR/Admin: email a password-reset link to an employee. */
export async function sendEmployeePasswordReset(opts: {
  targetUserId?: string;
  email?: string;
}): Promise<PasswordResetEmailResult> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) throw new Error('API is not configured.');
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/employees/password-reset`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ ...opts, redirectTo: appOrigin() }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Password reset failed (${res.status})`);
  }
  return (await res.json()) as PasswordResetEmailResult;
}

/** Signed-in user: email themselves a password-reset link. */
export async function sendSelfPasswordResetEmail(): Promise<PasswordResetEmailResult> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) throw new Error('API is not configured.');
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/employees/password-reset`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ self: true, redirectTo: appOrigin() }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Password reset failed (${res.status})`);
  }
  return (await res.json()) as PasswordResetEmailResult;
}
