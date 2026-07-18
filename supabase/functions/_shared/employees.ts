import { getSupabaseAdmin } from './supabase.ts';

const PRIVILEGED_ROLES = new Set(['ADMIN', 'HR', 'SUPER_ADMIN']);

type Caller = { authUserId: string; role: string; orgId: string };

/** Validate the bearer token and confirm the caller may invite employees. */
async function authorizeInviter(authHeader: string | null): Promise<Caller> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('AUTH_REQUIRED');

  const admin = getSupabaseAdmin();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) throw new Error('AUTH_INVALID');

  const authUserId = userData.user.id;
  const { data: row, error: rowErr } = await admin
    .from('users')
    .select('role, org_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (rowErr || !row) throw new Error('AUTH_NO_PROFILE');

  const role = String(row.role);
  if (!PRIVILEGED_ROLES.has(role)) throw new Error('FORBIDDEN');

  return { authUserId, role, orgId: String(row.org_id) };
}

export type InviteEmployeeInput = {
  email: string;
  redirectTo?: string;
  authHeader: string | null;
};

export type InviteEmployeeResult = {
  ok: boolean;
  status: 'invited' | 'already_registered';
  message: string;
  /** Shareable link the admin can hand to the employee instead of email. */
  actionLink?: string;
};

type GeneratedLink = {
  actionLink?: string;
  authUserId?: string;
  status: 'invited' | 'already_registered';
};

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

  const invite = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo, data },
  });

  if (!invite.error) {
    return {
      actionLink: invite.data?.properties?.action_link,
      authUserId: invite.data?.user?.id,
      status: 'invited',
    };
  }

  const msg = invite.error.message?.toLowerCase() ?? '';
  const alreadyExists = msg.includes('already') || msg.includes('registered') || msg.includes('exist');
  if (!alreadyExists) throw new Error(invite.error.message);

  const magic = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  });
  if (magic.error) throw new Error(magic.error.message);

  return {
    actionLink: magic.data?.properties?.action_link,
    authUserId: magic.data?.user?.id,
    status: 'already_registered',
  };
}

/**
 * Invite an employee to create their Mismo login. Sends a Supabase Auth invite
 * email (when SMTP is configured), returns a shareable link, and links the auth
 * user to their directory record. Requires an authenticated HR/Admin caller.
 */
export async function inviteEmployee(input: InviteEmployeeInput): Promise<InviteEmployeeResult> {
  const caller = await authorizeInviter(input.authHeader);
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email is required to send an invite.');
  }

  const admin = getSupabaseAdmin();

  // The directory record must exist in the caller's org before inviting.
  const { data: appUser, error: appUserErr } = await admin
    .from('users')
    .select('id, org_id, auth_user_id')
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

  return {
    ok: true,
    status: link.status,
    actionLink: link.actionLink,
    message:
      link.status === 'already_registered'
        ? 'This person already has a login. Share the sign-in link below.'
        : 'Invite email sent. You can also share the link below.',
  };
}
