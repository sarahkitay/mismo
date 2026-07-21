import { getApiBaseUrl } from '@/lib/api/aiServices';

/**
 * Fire-and-forget Yes-response notice emails (employee + admins).
 * Safe when Resend is not configured: the API returns skipped.
 */
export async function notifyIncidentYes(opts: {
  employeeEmail: string;
  orgId: string;
  caseId?: string;
}): Promise<void> {
  const apiBase = getApiBaseUrl();
  if (!apiBase || !opts.employeeEmail || !opts.orgId) return;
  const origin = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim() || window.location.origin;
  try {
    await fetch(`${apiBase.replace(/\/$/, '')}/notifications/incident-yes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeEmail: opts.employeeEmail,
        orgId: opts.orgId,
        dashboardUrl: `${origin.replace(/\/$/, '')}/`,
        caseUrl: opts.caseId ? `${origin.replace(/\/$/, '')}/?report=${opts.caseId}` : `${origin.replace(/\/$/, '')}/`,
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
}): Promise<void> {
  const apiBase = getApiBaseUrl();
  if (!apiBase || !opts.employeeEmail || !opts.orgId) return;
  const origin = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim() || window.location.origin;
  try {
    await fetch(`${apiBase.replace(/\/$/, '')}/notifications/wage-hour-yes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeEmail: opts.employeeEmail,
        orgId: opts.orgId,
        dashboardUrl: `${origin.replace(/\/$/, '')}/`,
        caseUrl: opts.caseId ? `${origin.replace(/\/$/, '')}/?report=${opts.caseId}` : `${origin.replace(/\/$/, '')}/`,
      }),
    });
  } catch {
    // Non-blocking
  }
}
