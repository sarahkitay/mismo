import type { UserRole } from '@/types';

/** Display labels - "Management" maps to MANAGER in the database. */
export const ROLE_LABELS: Record<UserRole, string> = {
 EMPLOYEE: 'Employee',
 HR: 'Human Resources',
 MANAGER: 'Management',
 ADMIN: 'Admin',
 SUPER_ADMIN: 'Super Admin',
 CLIENT: 'Client',
};

export const ASSIGNABLE_ROLES: UserRole[] = [
 'EMPLOYEE',
 'MANAGER',
 'HR',
 'ADMIN',
 'SUPER_ADMIN',
 'CLIENT',
];

export function roleLabel(role: UserRole | string): string {
 return ROLE_LABELS[role as UserRole] ?? role.replace(/_/g, ' ');
}
