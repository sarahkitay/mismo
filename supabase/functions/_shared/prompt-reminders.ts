/**
 * 3pm unanswered-prompt reminder emails.
 * Idempotent per delivery per calendar day (tracked via app_notifications).
 */

import { getSupabaseAdmin } from './supabase.ts';
import { authorizeCaller } from './auth.ts';
import { sendEmailAndNotify } from './app-notifications.ts';
import { isResendConfigured } from './resend.ts';

const REMINDER_HOUR = 15; // 3:00 PM local

function localParts(timeZone: string, now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour === '24' ? '0' : parts.hour);
  const dayKey = `${parts.year}-${parts.month}-${parts.day}`;
  return { hour, dayKey };
}

function resolveOrgTimeZone(settings: unknown): string {
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    const tz = (settings as Record<string, unknown>).timeZone ?? (settings as Record<string, unknown>).timezone;
    if (typeof tz === 'string' && tz.trim()) return tz.trim();
  }
  return Deno.env.get('DEFAULT_ORG_TIMEZONE')?.trim() || 'America/Los_Angeles';
}

export type PromptReminderRunResult = {
  ok: boolean;
  scanned: number;
  sent: number;
  skipped: number;
  errors: string[];
  resendConfigured: boolean;
  ranBecause?: string;
};

/**
 * Email employees whose active prompt deliveries are still PENDING after 3pm local.
 * Auth: CRON_SECRET header, or privileged HR/Admin JWT.
 */
export async function runPromptReminders(input: {
  authHeader: string | null;
  cronSecret?: string | null;
  /** Force run even before 3pm (manual/test). */
  force?: boolean;
  orgId?: string;
  redirectTo?: string;
}): Promise<PromptReminderRunResult> {
  const cronSecret = Deno.env.get('CRON_SECRET')?.trim();
  const provided = input.cronSecret?.trim() || '';
  const cronOk = Boolean(cronSecret && provided && provided === cronSecret);

  let callerOrgId: string | undefined;
  if (!cronOk) {
    const caller = await authorizeCaller(input.authHeader, { privilegedOnly: true });
    callerOrgId = caller.orgId;
  }

  const admin = getSupabaseAdmin();
  const origin =
    input.redirectTo?.trim().replace(/\/$/, '') ||
    Deno.env.get('SITE_URL')?.trim().replace(/\/$/, '') ||
    '';

  let orgQuery = admin.from('organizations').select('id, name, settings');
  if (input.orgId) orgQuery = orgQuery.eq('id', input.orgId);
  else if (callerOrgId) orgQuery = orgQuery.eq('id', callerOrgId);

  const { data: orgs, error: orgErr } = await orgQuery;
  if (orgErr) throw new Error(orgErr.message);

  let scanned = 0;
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  let ranBecause = '';

  for (const org of orgs ?? []) {
    const orgId = String(org.id);
    const orgName = String(org.name ?? 'your organization');
    const timeZone = resolveOrgTimeZone(org.settings);
    const { hour, dayKey } = localParts(timeZone);

    if (!input.force && hour < REMINDER_HOUR) {
      skipped += 1;
      ranBecause = `before_${REMINDER_HOUR}:00_${timeZone}`;
      continue;
    }
    ranBecause = input.force ? 'forced' : `after_${REMINDER_HOUR}:00_${timeZone}`;

    const { data: deliveries, error: delErr } = await admin
      .from('prompt_deliveries')
      .select('id, user_id, prompt_id, status, delivered_at, due_at')
      .eq('org_id', orgId)
      .eq('status', 'PENDING');
    if (delErr) {
      errors.push(`${orgId}: ${delErr.message}`);
      continue;
    }

    for (const d of deliveries ?? []) {
      scanned += 1;
      const userId = String(d.user_id);
      const promptId = String(d.prompt_id);
      const deliveryId = String(d.id);

      const { data: user } = await admin
        .from('users')
        .select('id, email, first_name, last_name, role, status')
        .eq('id', userId)
        .maybeSingle();
      if (!user || user.role !== 'EMPLOYEE' || user.status !== 'active' || !user.email) {
        skipped += 1;
        continue;
      }

      const { data: prompt } = await admin
        .from('prompts')
        .select('id, title, description, status')
        .eq('id', promptId)
        .maybeSingle();
      if (!prompt || String(prompt.status) !== 'ACTIVE') {
        skipped += 1;
        continue;
      }

      // Only remind for deliveries from today (local calendar day) or overdue dues.
      const deliveredAt = d.delivered_at ? new Date(String(d.delivered_at)) : null;
      const dueAt = d.due_at ? new Date(String(d.due_at)) : null;
      const deliveredDay = deliveredAt
        ? localParts(timeZone, deliveredAt).dayKey
        : null;
      const dueDay = dueAt ? localParts(timeZone, dueAt).dayKey : null;
      const isTodayDelivery = deliveredDay === dayKey || dueDay === dayKey;
      const isOverdue = dueAt ? dueAt.getTime() < Date.now() : false;
      if (!isTodayDelivery && !isOverdue) {
        skipped += 1;
        continue;
      }

      // Idempotency: one reminder notification per delivery per local day.
      const dedupeTitle = `Prompt reminder ${dayKey}`;
      const { data: existing } = await admin
        .from('app_notifications')
        .select('id')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .eq('kind', 'PROMPT')
        .eq('title', dedupeTitle)
        .contains('action_params', { deliveryId })
        .limit(1);
      if (existing && existing.length > 0) {
        skipped += 1;
        continue;
      }

      const userName =
        `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || String(user.email);
      const promptText = String(prompt.description || prompt.title || 'Please complete your check-in.');
      const actionUrl = origin ? `${origin}/employee/dashboard` : '';

      try {
        const { email } = await sendEmailAndNotify({
          orgId,
          userId,
          toEmail: String(user.email),
          kind: 'PROMPT',
          title: dedupeTitle,
          body: `Reminder to answer: ${String(prompt.title ?? 'check-in')}`,
          templateId: 'prompt_reminder',
          vars: { userName, orgName, promptText, actionUrl },
          actionPage: 'home',
          actionParams: { deliveryId, promptId },
          force: true,
        });
        if (email.ok && email.status === 'sent') sent += 1;
        else skipped += 1;
      } catch (err) {
        errors.push(`${deliveryId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    scanned,
    sent,
    skipped,
    errors,
    resendConfigured: isResendConfigured(),
    ranBecause,
  };
}
