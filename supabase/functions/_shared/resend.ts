/**
 * Resend mailer. No-ops (returns skipped) until RESEND_API_KEY is configured.
 * From-address defaults to RESEND_FROM or onboarding@resend.dev for testing.
 */

import { buildEmail, type EmailTemplateId } from './email-templates.ts';

export type SendEmailResult =
  | { ok: true; status: 'sent'; id?: string }
  | { ok: true; status: 'skipped'; reason: string }
  | { ok: false; error: string };

export function isResendConfigured(): boolean {
  return Boolean(Deno.env.get('RESEND_API_KEY')?.trim());
}

export async function sendTemplatedEmail(opts: {
  templateId: EmailTemplateId;
  to: string | string[];
  vars: Record<string, string>;
  /** Force send even if template.autoSendDefault is false. */
  force?: boolean;
}): Promise<SendEmailResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  if (!apiKey) {
    return { ok: true, status: 'skipped', reason: 'RESEND_API_KEY not configured' };
  }

  const built = buildEmail(opts.templateId, opts.vars);
  if (!built.autoSendDefault && !opts.force) {
    return { ok: true, status: 'skipped', reason: `Template ${opts.templateId} is not auto-send by default` };
  }

  const from = Deno.env.get('RESEND_FROM')?.trim() || 'Mismo <onboarding@resend.dev>';
  const to = Array.isArray(opts.to) ? opts.to : [opts.to];

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: built.subject,
        text: built.text,
        html: built.html,
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      return { ok: false, error: err.message ?? `Resend failed (${res.status})` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, status: 'sent', id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Incident Yes: notify reporting employee + HR/admin/investigators together. */
export async function sendIncidentYesNotices(opts: {
  employeeEmail: string;
  adminEmails: string[];
  dashboardUrl: string;
  caseUrl: string;
}): Promise<{ employee: SendEmailResult; admins: SendEmailResult }> {
  const employee = await sendTemplatedEmail({
    templateId: 'incident_yes_employee',
    to: opts.employeeEmail,
    vars: {},
    force: true,
  });
  const admins =
    opts.adminEmails.length === 0
      ? ({ ok: true, status: 'skipped', reason: 'No admin recipients' } as SendEmailResult)
      : await sendTemplatedEmail({
          templateId: 'incident_yes_admin',
          to: opts.adminEmails,
          vars: { dashboardUrl: opts.dashboardUrl, caseUrl: opts.caseUrl },
          force: true,
        });
  return { employee, admins };
}

/** Wage & hour Yes: notify reporting employee + payroll admins together. */
export async function sendWageHourYesNotices(opts: {
  employeeEmail: string;
  payrollEmails: string[];
  dashboardUrl: string;
  caseUrl: string;
}): Promise<{ employee: SendEmailResult; payroll: SendEmailResult }> {
  const employee = await sendTemplatedEmail({
    templateId: 'wage_hour_yes_employee',
    to: opts.employeeEmail,
    vars: {},
    force: true,
  });
  const payroll =
    opts.payrollEmails.length === 0
      ? ({ ok: true, status: 'skipped', reason: 'No payroll recipients' } as SendEmailResult)
      : await sendTemplatedEmail({
          templateId: 'wage_hour_yes_payroll',
          to: opts.payrollEmails,
          vars: { dashboardUrl: opts.dashboardUrl, caseUrl: opts.caseUrl },
          force: true,
        });
  return { employee, payroll };
}
