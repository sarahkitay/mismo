import type { CompanyResourceCategory } from '@/types';

/** Employee-facing labels for admin-managed company library categories. */
export const EMPLOYEE_RESOURCE_CATEGORIES: { id: CompanyResourceCategory; label: string }[] = [
  { id: 'REQUIRED_MEMO', label: 'Required memos' },
  { id: 'EMPLOYEE_HANDBOOK', label: 'Employee handbook' },
  { id: 'POLICIES_PROCEDURES', label: 'Policies & procedures' },
  { id: 'SAFETY_SECURITY', label: 'Safety & security' },
  { id: 'WELLNESS', label: 'Wellness resources' },
  { id: 'LEGAL_COMPLIANCE', label: 'Legal & compliance' },
  { id: 'SUPPORT_CONTACTS', label: 'Support contacts' },
  { id: 'TRAINING_DEVELOPMENT', label: 'Training & development' },
  { id: 'EMERGENCY_HOTLINE', label: 'Emergency support hotlines' },
];

export function getEmployeeResourceCategoryLabel(category: CompanyResourceCategory | string): string {
  return EMPLOYEE_RESOURCE_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}
