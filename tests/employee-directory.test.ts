import { describe, expect, it } from 'vitest';
import {
  CUSTOM_ROLE_PREFIX,
  displayEmployeeId,
  displayRole,
  parseRoleSelect,
  roleSelectValue,
} from '@/lib/employeeDirectory';
import type { User } from '@/types';

describe('employeeDirectory', () => {
  it('round-trips custom job titles through the role select', () => {
    expect(roleSelectValue('EMPLOYEE', 'Shift Lead')).toBe(`${CUSTOM_ROLE_PREFIX}Shift Lead`);
    expect(parseRoleSelect(`${CUSTOM_ROLE_PREFIX}Shift Lead`)).toEqual({
      role: 'EMPLOYEE',
      jobTitle: 'Shift Lead',
    });
    expect(parseRoleSelect('HR')).toEqual({ role: 'HR' });
  });

  it('prefers job title for display', () => {
    const user = {
      employeeId: '  ',
      jobTitle: 'Shift Lead',
      role: 'EMPLOYEE',
    } as User;
    expect(displayEmployeeId(user)).toBe('-');
    expect(displayRole(user)).toBe('Shift Lead');
  });
});
