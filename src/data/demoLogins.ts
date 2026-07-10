/** Demo sign-in accounts. Directory users only; no sample cases or prompts. */
export const DEMO_ORG_ID = 'org-mismo-1';

/** Shared demo password (must match Supabase Auth users from scripts/provision-demo-auth.mjs). */
export const DEMO_PASSWORD =
  (import.meta.env.VITE_DEMO_PASSWORD as string | undefined)?.trim() || 'MismoDemo1!';

export const DEMO_EMAIL_ALIASES: Record<string, string> = {
  'admin@mismo.com': 'hr@mismo.com',
};

export const PRIMARY_DEMO_LOGINS = [
  { email: 'hr@mismo.com', label: 'HR' },
  { email: 'employee@mismo.com', label: 'Employee' },
] as const;

const DEMO_EMAILS = new Set<string>([
  ...PRIMARY_DEMO_LOGINS.map((a) => a.email),
  'admin@mismo.com',
  'michael.rodriguez@mismo.com',
  'sarah.kitay@mismo.com',
  'jordan.lee@mismo.com',
  'pat.campbell@clientco.com',
  'sarahkitay@mismo.com',
  'jordan.taylor@mismo.com',
  'casey.williams@mismo.com',
  'riley.johnson@mismo.com',
  'morgan.davis@mismo.com',
  'quinn.brown@mismo.com',
  'avery.wilson@mismo.com',
  'sam.garcia@mismo.com',
]);

export function normalizeDemoEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  return DEMO_EMAIL_ALIASES[trimmed] ?? trimmed;
}

export function isDemoLoginEmail(email: string): boolean {
  return DEMO_EMAILS.has(normalizeDemoEmail(email));
}

export function resolveDemoPassword(email: string, password: string): string {
  const normalized = normalizeDemoEmail(email);
  if (password.trim()) return password;
  if (isDemoLoginEmail(normalized)) return DEMO_PASSWORD;
  return password;
}
