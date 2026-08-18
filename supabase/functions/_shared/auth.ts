/**
 * Auth helpers for Edge Function routes that require an org-scoped caller.
 *
 * Gateway JWT (verify_jwt = true on mismo-api) only proves the token is valid.
 * This module binds that token to public.users (org, role, app user id) and
 * enforces RBAC. Privileged routes reject EMPLOYEE/CLIENT.
 */

import { getSupabaseAdmin } from './supabase.ts';

const PRIVILEGED_ROLES = new Set(['ADMIN', 'HR', 'SUPER_ADMIN', 'MANAGER']);

export type Caller = {
  authUserId: string;
  appUserId: string;
  role: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
};

export function isPrivilegedRole(role: string | undefined): boolean {
  return Boolean(role && PRIVILEGED_ROLES.has(role));
}

export async function authorizeCaller(
  authHeader: string | null,
  opts?: { privilegedOnly?: boolean }
): Promise<Caller> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('AUTH_REQUIRED');

  const admin = getSupabaseAdmin();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) throw new Error('AUTH_INVALID');

  const authUserId = userData.user.id;
  const { data: row, error: rowErr } = await admin
    .from('users')
    .select('id, role, org_id, first_name, last_name, email')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (rowErr || !row) throw new Error('AUTH_NO_PROFILE');

  const role = String(row.role);
  if (opts?.privilegedOnly && !PRIVILEGED_ROLES.has(role)) {
    throw new Error('FORBIDDEN');
  }

  return {
    authUserId,
    appUserId: String(row.id),
    role,
    orgId: String(row.org_id),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    email: String(row.email ?? ''),
  };
}

export function displayName(caller: { firstName: string; lastName: string; email: string }): string {
  const name = `${caller.firstName} ${caller.lastName}`.trim();
  return name || caller.email || 'Mismo user';
}
