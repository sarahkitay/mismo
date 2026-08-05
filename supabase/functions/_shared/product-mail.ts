/**
 * Product email actions: password reset, direct messages, updates.
 */

import { getSupabaseAdmin } from './supabase.ts';
import { authorizeCaller, displayName } from './auth.ts';
import { createAppNotification, sendEmailAndNotify } from './app-notifications.ts';
import { isResendConfigured } from './resend.ts';

function appOrigin(redirectTo?: string): string {
  return (
    redirectTo?.trim().replace(/\/$/, '') ||
    Deno.env.get('SITE_URL')?.trim().replace(/\/$/, '') ||
    ''
  );
}

function brandedRecoveryLink(origin: string, actionLink?: string, hashedToken?: string): string {
  const token =
    hashedToken?.trim() ||
    (() => {
      if (!actionLink) return undefined;
      try {
        const url = new URL(actionLink);
        return url.searchParams.get('token_hash') ?? url.searchParams.get('token') ?? undefined;
      } catch {
        return undefined;
      }
    })();
  if (origin && token) {
    return `${origin}/auth/confirm?${new URLSearchParams({ token_hash: token, type: 'recovery' })}`;
  }
  return actionLink ?? '';
}

export type PasswordResetResult = {
  ok: boolean;
  message: string;
  emailStatus: string;
  actionLink?: string;
  resendConfigured: boolean;
};

/** HR/Admin sends a password-reset email to an employee in their org. */
export async function sendPasswordResetForEmployee(input: {
  authHeader: string | null;
  targetUserId?: string;
  email?: string;
  redirectTo?: string;
}): Promise<PasswordResetResult> {
  const caller = await authorizeCaller(input.authHeader, { privilegedOnly: true });
  const admin = getSupabaseAdmin();
  const origin = appOrigin(input.redirectTo);

  let query = admin.from('users').select('id, email, first_name, last_name, org_id').eq('org_id', caller.orgId);
  if (input.targetUserId) query = query.eq('id', input.targetUserId);
  else if (input.email) query = query.ilike('email', input.email.trim());
  else throw new Error('targetUserId or email is required');

  const { data: target, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!target?.email) throw new Error('Employee not found in your organization.');

  const recovery = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: String(target.email),
    options: { redirectTo: origin || undefined },
  });
  if (recovery.error) throw new Error(recovery.error.message);

  const props = recovery.data?.properties as
    | { action_link?: string; hashed_token?: string }
    | undefined;
  const resetUrl = brandedRecoveryLink(origin, props?.action_link, props?.hashed_token);
  const userName = `${target.first_name ?? ''} ${target.last_name ?? ''}`.trim() || String(target.email);

  const { email } = await sendEmailAndNotify({
    orgId: caller.orgId,
    userId: String(target.id),
    toEmail: String(target.email),
    kind: 'PASSWORD_RESET',
    title: 'Password reset link sent',
    body: `${displayName(caller)} sent you a link to reset your Mismo password.`,
    templateId: 'password_reset',
    vars: { userName, resetUrl },
    actionPage: 'settings',
    actorUserId: caller.appUserId,
    force: true,
  });

  const emailStatus =
    email.ok && email.status === 'sent'
      ? 'sent'
      : email.ok
        ? `skipped:${email.reason}`
        : `failed:${'error' in email ? email.error : 'unknown'}`;

  return {
    ok: true,
    message:
      email.status === 'sent'
        ? `Password reset email sent to ${target.email}.`
        : email.status === 'skipped'
          ? `Reset link ready. Email skipped (${email.reason}). Share the link if needed.`
          : `Reset link ready, but email failed. Share the link if needed.`,
    emailStatus,
    actionLink: resetUrl || undefined,
    resendConfigured: isResendConfigured(),
  };
}

/** Any signed-in user requests a password reset for themselves. */
export async function sendSelfPasswordReset(input: {
  authHeader: string | null;
  redirectTo?: string;
}): Promise<PasswordResetResult> {
  const caller = await authorizeCaller(input.authHeader);
  const admin = getSupabaseAdmin();
  const origin = appOrigin(input.redirectTo);

  const recovery = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: caller.email,
    options: { redirectTo: origin || undefined },
  });
  if (recovery.error) throw new Error(recovery.error.message);

  const props = recovery.data?.properties as
    | { action_link?: string; hashed_token?: string }
    | undefined;
  const resetUrl = brandedRecoveryLink(origin, props?.action_link, props?.hashed_token);

  const { email } = await sendEmailAndNotify({
    orgId: caller.orgId,
    userId: caller.appUserId,
    toEmail: caller.email,
    kind: 'PASSWORD_RESET',
    title: 'Password reset requested',
    body: 'A password reset link was emailed to you.',
    templateId: 'password_reset',
    vars: { userName: displayName(caller), resetUrl },
    actionPage: 'settings',
    actorUserId: caller.appUserId,
    force: true,
  });

  const emailStatus =
    email.ok && email.status === 'sent'
      ? 'sent'
      : email.ok
        ? `skipped:${email.reason}`
        : `failed:${'error' in email ? email.error : 'unknown'}`;

  return {
    ok: true,
    message:
      email.status === 'sent'
        ? 'Password reset email sent. Check your inbox.'
        : email.status === 'skipped'
          ? `Reset link ready. Email skipped (${email.reason}).`
          : 'Reset link ready, but email failed.',
    emailStatus,
    actionLink: resetUrl || undefined,
    resendConfigured: isResendConfigured(),
  };
}

export type SendMessageResult = {
  ok: boolean;
  message: string;
  emailStatus: string;
  notificationId: string | null;
  resendConfigured: boolean;
};

/** Send a templated message/update email to another user in the same org. */
export async function sendOrgMessage(input: {
  authHeader: string | null;
  recipientUserId: string;
  subject: string;
  body: string;
  kind?: 'MESSAGE' | 'MEMO' | 'PROMPT' | 'CASE_UPDATE' | 'SYSTEM';
  actionPage?: string;
  actionParams?: Record<string, string>;
  redirectTo?: string;
  templateId?: 'new_message' | 'new_memo' | 'prompt_notice';
}): Promise<SendMessageResult> {
  const caller = await authorizeCaller(input.authHeader);
  const admin = getSupabaseAdmin();
  const origin = appOrigin(input.redirectTo);

  const { data: recipient, error } = await admin
    .from('users')
    .select('id, email, first_name, last_name, org_id')
    .eq('org_id', caller.orgId)
    .eq('id', input.recipientUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!recipient?.email) throw new Error('Recipient not found in your organization.');

  const subject = input.subject.trim() || 'New message on Mismo';
  const messageBody = input.body.trim();
  if (!messageBody) throw new Error('Message body is required.');

  const userName = `${recipient.first_name ?? ''} ${recipient.last_name ?? ''}`.trim() || String(recipient.email);
  const senderName = displayName(caller);
  const actionPage = input.actionPage ?? 'dashboard';
  const qs = input.actionParams
    ? `?${new URLSearchParams(input.actionParams).toString()}`
    : '';
  const actionUrl = origin ? `${origin}/${actionPage === 'dashboard' ? '' : actionPage}${qs}` : '';

  const templateId = input.templateId ?? 'new_message';
  const kind = input.kind ?? 'MESSAGE';

  const vars: Record<string, string> =
    templateId === 'new_memo'
      ? {
          userName,
          orgName: 'your organization',
          memoTitle: subject,
          memoUrl: actionUrl,
        }
      : templateId === 'prompt_notice'
        ? {
            userName,
            orgName: 'your organization',
            promptText: messageBody,
            noIssueUrl: actionUrl,
            hasIssueUrl: actionUrl,
          }
        : {
            userName,
            senderName,
            messageBody,
            actionUrl,
            subject,
          };

  const { email, notificationId } = await sendEmailAndNotify({
    orgId: caller.orgId,
    userId: String(recipient.id),
    toEmail: String(recipient.email),
    kind,
    title: subject,
    body: messageBody.slice(0, 500),
    templateId,
    vars,
    actionPage,
    actionParams: input.actionParams,
    actorUserId: caller.appUserId,
    force: true,
  });

  await createAppNotification({
    orgId: caller.orgId,
    userId: caller.appUserId,
    kind: 'SYSTEM',
    title: `Sent: ${subject}`,
    body: `Message to ${userName}: ${messageBody.slice(0, 200)}`,
    actionPage,
    actionParams: input.actionParams,
    relatedEmail: String(recipient.email),
    emailStatus:
      email.ok && email.status === 'sent'
        ? 'sent'
        : email.ok
          ? `skipped:${email.reason}`
          : `failed:${'error' in email ? email.error : 'unknown'}`,
    actorUserId: caller.appUserId,
  });

  const emailStatus =
    email.ok && email.status === 'sent'
      ? 'sent'
      : email.ok
        ? `skipped:${email.reason}`
        : `failed:${'error' in email ? email.error : 'unknown'}`;

  return {
    ok: true,
    message:
      email.status === 'sent'
        ? `Email sent to ${recipient.email}.`
        : email.status === 'skipped'
          ? `In-app notification created. Email skipped (${email.reason}).`
          : `In-app notification created. Email failed.`,
    emailStatus,
    notificationId,
    resendConfigured: isResendConfigured(),
  };
}
