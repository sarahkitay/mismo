import { getSupabaseAdmin } from './supabase.ts';
import { authorizeCaller, displayName } from './auth.ts';
import { sendEmailAndNotify, createAppNotification } from './app-notifications.ts';
import { isResendConfigured } from './resend.ts';

export type InviteEmployeeInput = {
  email: string;
  redirectTo?: string;
  authHeader: string | null;
  /** When false, generate a shareable link without emailing. Default true. */
  sendEmail?: boolean;
};

export type InviteEmployeeResult = {
  ok: boolean;
  status: 'invited' | 'already_registered';
  message: string;
  /** Shareable link the admin can hand to the employee instead of email. */
  actionLink?: string;
  emailStatus?: string;
  resendConfigured?: boolean;
};

type GeneratedLink = {
  actionLink?: string;
  authUserId?: string;
  status: 'invited' | 'already_registered';
};

type LinkType = 'invite' | 'magiclink' | 'recovery';

/**
 * Build a Mismo app URL for invites so shared links never show the vendor auth host.
 * Uses token_hash + type; the app verifies via verifyOtp on /auth/confirm.
 * Prefer `hashed_token` from generateLink — that is what verifyOtp expects.
 */
function toBrandedActionLink(
  appOrigin: string | undefined,
  linkType: LinkType,
  actionLink?: string,
  hashedToken?: string
): string | undefined {
  const origin = appOrigin?.trim().replace(/\/$/, '');
  const token =
    hashedToken?.trim() ||
    (() => {
      if (!actionLink) return undefined;
      try {
        const url = new URL(actionLink);
        return (
          url.searchParams.get('token_hash') ??
          url.searchParams.get('token') ??
          undefined
        );
      } catch {
        return undefined;
      }
    })();

  if (origin && token) {
    const params = new URLSearchParams({
      token_hash: token,
      type: linkType,
    });
    return `${origin}/auth/confirm?${params.toString()}`;
  }
  return actionLink;
}

/**
 * Generate a login link for the employee. For a brand-new account this creates
 * the auth user with an invite link (and sends the invite email when SMTP is
 * configured). For an existing account it falls back to a magic sign-in link so
 * the admin still has something shareable.
 */
async function generateLoginLink(
  email: string,
  redirectTo: string | undefined,
  data: Record<string, unknown>
): Promise<GeneratedLink> {
  const admin = getSupabaseAdmin();
  const appOrigin = redirectTo?.trim() || Deno.env.get('SITE_URL')?.trim() || undefined;

  const invite = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo: appOrigin, data },
  });

  if (!invite.error) {
    const props = invite.data?.properties as
      | { action_link?: string; hashed_token?: string }
      | undefined;
    return {
      actionLink: toBrandedActionLink(appOrigin, 'invite', props?.action_link, props?.hashed_token),
      authUserId: invite.data?.user?.id,
      status: 'invited',
    };
  }

  const msg = invite.error.message?.toLowerCase() ?? '';
  const alreadyExists = msg.includes('already') || msg.includes('registered') || msg.includes('exist');
  if (!alreadyExists) throw new Error(invite.error.message);

  // Prefer recovery so the employee can still set a password on "Create your login".
  // Magic links skip the password form and are a last resort.
  const recovery = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: appOrigin },
  });
  if (!recovery.error) {
    const props = recovery.data?.properties as
      | { action_link?: string; hashed_token?: string }
      | undefined;
    return {
      actionLink: toBrandedActionLink(appOrigin, 'recovery', props?.action_link, props?.hashed_token),
      authUserId: recovery.data?.user?.id,
      status: 'already_registered',
    };
  }

  const magic = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: appOrigin },
  });
  if (magic.error) throw new Error(magic.error.message || recovery.error.message);

  const props = magic.data?.properties as
    | { action_link?: string; hashed_token?: string }
    | undefined;
  return {
    actionLink: toBrandedActionLink(appOrigin, 'magiclink', props?.action_link, props?.hashed_token),
    authUserId: magic.data?.user?.id,
    status: 'already_registered',
  };
}

/**
 * Invite an employee to create their Mismo login. Sends an invite email when
 * SMTP is configured, returns a shareable Mismo app link, and links the auth
 * user to their directory record. Requires an authenticated HR/Admin caller.
 */
export async function inviteEmployee(input: InviteEmployeeInput): Promise<InviteEmployeeResult> {
  const caller = await authorizeCaller(input.authHeader, { privilegedOnly: true });
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email is required to send an invite.');
  }

  const admin = getSupabaseAdmin();

  // The directory record must exist in the caller's org before inviting.
  const { data: appUser, error: appUserErr } = await admin
    .from('users')
    .select('id, org_id, auth_user_id, first_name, last_name')
    .eq('org_id', caller.orgId)
    .ilike('email', email)
    .maybeSingle();
  if (appUserErr) throw new Error(appUserErr.message);
  if (!appUser) throw new Error('No employee record found for that email in your organization.');

  const redirectTo = input.redirectTo?.trim() || Deno.env.get('SITE_URL') || undefined;

  const link = await generateLoginLink(email, redirectTo, {
    app_user_id: appUser.id,
    org_id: appUser.org_id,
  });

  if (link.authUserId && !appUser.auth_user_id) {
    await admin
      .from('users')
      .update({ auth_user_id: link.authUserId, updated_at: new Date().toISOString() })
      .eq('id', appUser.id);
  }

  const { data: org } = await admin.from('organizations').select('name').eq('id', caller.orgId).maybeSingle();
  const orgName = org?.name ? String(org.name) : 'your organization';
  const userName =
    `${appUser.first_name ?? ''} ${appUser.last_name ?? ''}`.trim() || email;
  const inviteUrl = link.actionLink ?? '';
  const shouldEmail = input.sendEmail !== false;

  let emailStatus = 'skipped:not_requested';
  let emailed = false;

  if (shouldEmail) {
    const { email: mail } = await sendEmailAndNotify({
      orgId: caller.orgId,
      userId: String(appUser.id),
      toEmail: email,
      kind: 'INVITE',
      title:
        link.status === 'already_registered'
          ? 'Sign-in link ready'
          : `You've been invited to ${orgName} on Mismo`,
      body: `${displayName(caller)} sent you a link to join ${orgName} on Mismo.`,
      templateId: 'welcome',
      vars: { userName, orgName, inviteUrl },
      actionPage: 'dashboard',
      actorUserId: caller.appUserId,
      force: true,
    });

    emailStatus =
      mail.ok && mail.status === 'sent'
        ? 'sent'
        : mail.ok
          ? `skipped:${mail.reason}`
          : `failed:${'error' in mail ? mail.error : 'unknown'}`;
    emailed = mail.status === 'sent';
  } else {
    await createAppNotification({
      orgId: caller.orgId,
      userId: String(appUser.id),
      kind: 'INVITE',
      title: 'Sign-in link generated',
      body: `${displayName(caller)} generated a sign-in link (not emailed yet).`,
      actionPage: 'dashboard',
      relatedEmail: email,
      emailStatus: 'skipped:link_only',
      actorUserId: caller.appUserId,
    });
  }

  return {
    ok: true,
    status: link.status,
    actionLink: link.actionLink,
    emailStatus,
    resendConfigured: isResendConfigured(),
    message:
      link.status === 'already_registered'
        ? emailed
          ? 'This person already has a login. A sign-in email was sent; you can also share the link below.'
          : shouldEmail
            ? 'This person already has a login. Share the sign-in link below.'
            : 'Sign-in link ready. Email it to the employee or copy the link.'
        : emailed
          ? 'Invite email sent. You can also share the link below.'
          : shouldEmail
            ? `Invite link ready. Email ${emailStatus.startsWith('skipped') ? 'skipped' : 'failed'} — share the link below.`
            : 'Invite link ready. Email it to the employee or copy the link.',
  };
}

export type UpdateEmployeeEmailInput = {
  targetUserId: string;
  email: string;
  authHeader: string | null;
};

export type UpdateEmployeeEmailResult = {
  ok: boolean;
  message: string;
  email?: string;
};

/** HR updates an employee's login email (app profile + Supabase Auth when linked). */
export async function updateEmployeeEmail(input: UpdateEmployeeEmailInput): Promise<UpdateEmployeeEmailResult> {
  const caller = await authorizeCaller(input.authHeader, { privilegedOnly: true });
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email address is required.');
  }

  const admin = getSupabaseAdmin();
  const { data: appUser, error: userErr } = await admin
    .from('users')
    .select('id, email, auth_user_id, first_name, last_name')
    .eq('org_id', caller.orgId)
    .eq('id', input.targetUserId)
    .maybeSingle();
  if (userErr) throw new Error(userErr.message);
  if (!appUser) throw new Error('Employee not found in your organization.');

  const previousEmail = String(appUser.email ?? '').trim().toLowerCase();
  if (previousEmail === email) {
    return { ok: true, message: 'Email unchanged.', email };
  }

  const { data: conflict } = await admin
    .from('users')
    .select('id')
    .eq('org_id', caller.orgId)
    .ilike('email', email)
    .neq('id', input.targetUserId)
    .maybeSingle();
  if (conflict?.id) {
    throw new Error('Another person in your organization already uses that email.');
  }

  const authUserId = appUser.auth_user_id ? String(appUser.auth_user_id) : null;
  if (authUserId) {
    const { error: authErr } = await admin.auth.admin.updateUserById(authUserId, {
      email,
      email_confirm: true,
    });
    if (authErr) throw new Error(authErr.message);
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from('users')
    .update({ email, updated_at: now })
    .eq('org_id', caller.orgId)
    .eq('id', input.targetUserId);
  if (updErr) throw new Error(updErr.message);

  const display =
    `${appUser.first_name ?? ''} ${appUser.last_name ?? ''}`.trim() || previousEmail || 'Employee';

  await createAppNotification({
    orgId: caller.orgId,
    userId: caller.appUserId,
    kind: 'SYSTEM',
    title: `Updated login email for ${display}`,
    body: `${previousEmail || '(none)'} → ${email}`,
    actionPage: 'employee-detail',
    actionParams: { id: input.targetUserId },
    actorUserId: caller.appUserId,
    force: true,
  });

  return {
    ok: true,
    email,
    message: authUserId
      ? 'Email updated. The employee will sign in with the new address.'
      : 'Email updated on the employee record. Their login will use this address once invited.',
  };
}
