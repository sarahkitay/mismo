/**
 * Authorization model mirrored from Postgres RLS.
 * Tests lock this file to the SQL in docs/database/04_rls_policies.sql
 * and 10_reports_rls_split.sql so UI and database cannot drift silently.
 */

export const PRIVILEGED_ROLES = ['ADMIN', 'HR', 'SUPER_ADMIN', 'MANAGER'] as const;
export type PrivilegedRole = (typeof PRIVILEGED_ROLES)[number];
export type AppRole = PrivilegedRole | 'EMPLOYEE' | 'CLIENT';

export type AuthPrincipal = {
  userId: string;
  orgId: string;
  role: AppRole | string;
};

export type ReportRow = {
  orgId: string;
  createdByUserId?: string | null;
  isAnonymous?: boolean;
};

export function isPrivilegedRole(role: string | undefined): boolean {
  return Boolean(role && (PRIVILEGED_ROLES as readonly string[]).includes(role));
}

export function parseBearerToken(authHeader: string | null | undefined): string | null {
  const raw = authHeader?.trim() ?? '';
  if (!raw) return null;
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

export function mapAuthFailure(code: string): { status: number; error: string } | null {
  const table: Record<string, { status: number; error: string }> = {
    AUTH_REQUIRED: { status: 401, error: 'Sign in to perform this action.' },
    AUTH_INVALID: { status: 401, error: 'Your session has expired. Sign in again.' },
    AUTH_NO_PROFILE: { status: 403, error: 'No employee profile is linked to your account.' },
    FORBIDDEN: { status: 403, error: 'Only HR and administrators can perform this action.' },
  };
  return table[code] ?? null;
}

/** reports_select */
export function canSelectReport(principal: AuthPrincipal, report: ReportRow): boolean {
  if (principal.orgId !== report.orgId) return false;
  if (isPrivilegedRole(principal.role)) return true;
  return Boolean(report.createdByUserId && report.createdByUserId === principal.userId);
}

/** reports_insert */
export function canInsertReport(principal: AuthPrincipal, report: ReportRow): boolean {
  if (principal.orgId !== report.orgId) return false;
  if (isPrivilegedRole(principal.role)) return true;
  if (report.createdByUserId === principal.userId) return true;
  return Boolean(report.isAnonymous && !report.createdByUserId);
}

/** reports_update */
export function canUpdateReport(principal: AuthPrincipal, report: ReportRow): boolean {
  if (principal.orgId !== report.orgId) return false;
  if (isPrivilegedRole(principal.role)) return true;
  return Boolean(report.createdByUserId && report.createdByUserId === principal.userId);
}

/** reports_delete */
export function canDeleteReport(principal: AuthPrincipal, report: ReportRow): boolean {
  return principal.orgId === report.orgId && isPrivilegedRole(principal.role);
}

export function assertPrivileged(role: string | undefined): void {
  if (!isPrivilegedRole(role)) throw new Error('FORBIDDEN');
}

export function assertTokenPresent(authHeader: string | null | undefined): string {
  const token = parseBearerToken(authHeader);
  if (!token) throw new Error('AUTH_REQUIRED');
  return token;
}
