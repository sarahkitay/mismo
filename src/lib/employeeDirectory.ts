import { formatDate } from '@/lib/utils';
import { roleLabel } from '@/lib/roleLabels';
import type { User, UserRole } from '@/types';

export const CUSTOM_ROLE_PREFIX = 'custom::';

export function formatArchiveWindow(user: User): string {
  if (user.archiveStartDate || user.archiveEndDate) {
    const a = user.archiveStartDate ? formatDate(user.archiveStartDate) : '-';
    const b = user.archiveEndDate ? formatDate(user.archiveEndDate) : '-';
    return `${a} → ${b}`;
  }
  if (user.status === 'inactive') return 'Inactive (no archive dates)';
  return '-';
}

export function displayEmployeeId(user: User): string {
  return user.employeeId?.trim() || '-';
}

export function roleSelectValue(role: UserRole, jobTitle?: string): string {
  return jobTitle?.trim() ? `${CUSTOM_ROLE_PREFIX}${jobTitle.trim()}` : role;
}

export function parseRoleSelect(value: string): { role: UserRole; jobTitle?: string } {
  if (value.startsWith(CUSTOM_ROLE_PREFIX)) {
    return { role: 'EMPLOYEE', jobTitle: value.slice(CUSTOM_ROLE_PREFIX.length) };
  }
  return { role: value as UserRole };
}

export function displayRole(user: User): string {
  return user.jobTitle?.trim() || roleLabel(user.role);
}

export function toDateInputValue(d: Date | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}
