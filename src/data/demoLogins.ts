/** Demo org id used by local seed / provision scripts. */
export const DEMO_ORG_ID = 'org-mismo-1';

export const DEMO_EMAIL_ALIASES: Record<string, string> = {
  'admin@mismo.com': 'hr@mismo.com',
};

export function normalizeDemoEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  return DEMO_EMAIL_ALIASES[trimmed] ?? trimmed;
}
