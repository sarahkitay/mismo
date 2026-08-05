/**
 * Product notification helpers: Resend email + app_notifications rows.
 */

import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.ts';
import { sendTemplatedEmail, type SendEmailResult } from './resend.ts';
import type { EmailTemplateId } from './email-templates.ts';

export type AppNotificationKind =
  | 'INVITE'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'MESSAGE'
  | 'MEMO'
  | 'PROMPT'
  | 'CASE_UPDATE'
  | 'SYSTEM';

export type CreateAppNotificationInput = {
  orgId: string;
  userId: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  actionPage?: string;
  actionParams?: Record<string, string>;
  relatedEmail?: string;
  emailStatus?: string;
  actorUserId?: string;
};

export async function createAppNotification(input: CreateAppNotificationInput): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const admin = getSupabaseAdmin();
    const id = `notif-${crypto.randomUUID()}`;
    const { error } = await admin.from('app_notifications').insert({
      id,
      org_id: input.orgId,
      user_id: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      action_page: input.actionPage ?? null,
      action_params: input.actionParams ?? {},
      related_email: input.relatedEmail ?? null,
      email_status: input.emailStatus ?? null,
      actor_user_id: input.actorUserId ?? null,
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error('createAppNotification failed:', error.message);
      return null;
    }
    return id;
  } catch (err) {
    console.error('createAppNotification error:', err);
    return null;
  }
}

export async function sendEmailAndNotify(opts: {
  orgId: string;
  userId: string;
  toEmail: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  templateId: EmailTemplateId;
  vars: Record<string, string>;
  actionPage?: string;
  actionParams?: Record<string, string>;
  actorUserId?: string;
  force?: boolean;
}): Promise<{ email: SendEmailResult; notificationId: string | null }> {
  const email = await sendTemplatedEmail({
    templateId: opts.templateId,
    to: opts.toEmail,
    vars: opts.vars,
    force: opts.force ?? true,
  });
  const emailStatus =
    email.ok && email.status === 'sent'
      ? 'sent'
      : email.ok && email.status === 'skipped'
        ? `skipped:${email.reason}`
        : `failed:${'error' in email ? email.error : 'unknown'}`;

  const notificationId = await createAppNotification({
    orgId: opts.orgId,
    userId: opts.userId,
    kind: opts.kind,
    title: opts.title,
    body: opts.body,
    actionPage: opts.actionPage,
    actionParams: opts.actionParams,
    relatedEmail: opts.toEmail,
    emailStatus,
    actorUserId: opts.actorUserId,
  });

  return { email, notificationId };
}
