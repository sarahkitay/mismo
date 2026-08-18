import { describe, expect, it } from 'vitest';
import {
  assertTokenPresent,
  canDeleteReport,
  canInsertReport,
  canSelectReport,
  canUpdateReport,
  isPrivilegedRole,
  mapAuthFailure,
  parseBearerToken,
} from '@/lib/authz/policy';

const hr = { userId: 'u-hr', orgId: 'org-a', role: 'HR' };
const emp = { userId: 'u-emp', orgId: 'org-a', role: 'EMPLOYEE' };
const otherOrg = { userId: 'u-hr-b', orgId: 'org-b', role: 'HR' };

const ownReport = { orgId: 'org-a', createdByUserId: 'u-emp', isAnonymous: false };
const anonReport = { orgId: 'org-a', createdByUserId: null, isAnonymous: true };
const foreignReport = { orgId: 'org-b', createdByUserId: 'u-x', isAnonymous: false };

describe('RBAC helpers', () => {
  it('treats HR/Admin/Manager as privileged and employees as not', () => {
    expect(isPrivilegedRole('HR')).toBe(true);
    expect(isPrivilegedRole('ADMIN')).toBe(true);
    expect(isPrivilegedRole('MANAGER')).toBe(true);
    expect(isPrivilegedRole('EMPLOYEE')).toBe(false);
    expect(isPrivilegedRole('CLIENT')).toBe(false);
  });

  it('parses Bearer tokens and rejects empty headers', () => {
    expect(parseBearerToken('Bearer abc')).toBe('abc');
    expect(parseBearerToken(null)).toBeNull();
    expect(() => assertTokenPresent(null)).toThrow('AUTH_REQUIRED');
    expect(mapAuthFailure('FORBIDDEN')?.status).toBe(403);
  });
});

describe('reports RLS (TypeScript model of SQL)', () => {
  it('lets employees read only their own cases in the same org', () => {
    expect(canSelectReport(emp, ownReport)).toBe(true);
    expect(canSelectReport(emp, anonReport)).toBe(false);
    expect(canSelectReport(hr, ownReport)).toBe(true);
    expect(canSelectReport(hr, anonReport)).toBe(true);
    expect(canSelectReport(emp, foreignReport)).toBe(false);
    expect(canSelectReport(otherOrg, ownReport)).toBe(false);
  });

  it('lets employees insert own or anonymous rows, never another org', () => {
    expect(canInsertReport(emp, ownReport)).toBe(true);
    expect(canInsertReport(emp, anonReport)).toBe(true);
    expect(canInsertReport(emp, { orgId: 'org-a', createdByUserId: 'someone-else' })).toBe(false);
    expect(canInsertReport(emp, foreignReport)).toBe(false);
    expect(canInsertReport(hr, foreignReport)).toBe(false);
    expect(canInsertReport(hr, ownReport)).toBe(true);
  });

  it('restricts updates to creator or privileged same-org users', () => {
    expect(canUpdateReport(emp, ownReport)).toBe(true);
    expect(canUpdateReport(emp, { orgId: 'org-a', createdByUserId: 'other' })).toBe(false);
    expect(canUpdateReport(hr, ownReport)).toBe(true);
    expect(canUpdateReport(otherOrg, ownReport)).toBe(false);
  });

  it('allows deletes only for privileged users in the same org', () => {
    expect(canDeleteReport(emp, ownReport)).toBe(false);
    expect(canDeleteReport(hr, ownReport)).toBe(true);
    expect(canDeleteReport(otherOrg, ownReport)).toBe(false);
  });
});
