import type { HrLawRecord } from '@/types/aiServices';

/** Known stale summaries that must not be published into employee-facing memos. */
const STALE_LAW_PATTERNS: Array<{ id: string; test: (law: HrLawRecord) => boolean; fixHint: string }> = [
  {
    id: 'ca-paid-sick-leave-24h',
    test: (law) => {
      const hay = `${law.title} ${law.summary}`.toLowerCase();
      if (!hay.includes('paid sick') && !hay.includes('sick leave')) return false;
      // Pre-2024 statewide floor (SB 616 raised this to 40 hours / 5 days).
      return /\b24\s*hours?\b/.test(hay) || /\bthree\s+days?\b/.test(hay) || /\b3\s+days?\b/.test(hay);
    },
    fixHint:
      'California Paid Sick Leave must state at least 40 hours or 5 days (Labor Code § 246, effective Jan 1, 2024).',
  },
];

export type LawCorpusFreshnessIssue = {
  lawId: string;
  title: string;
  reason: string;
};

/** Returns blocking issues that should prevent “Publish signable memo”. */
export function validateLawCorpusForPublish(laws: HrLawRecord[]): LawCorpusFreshnessIssue[] {
  const issues: LawCorpusFreshnessIssue[] = [];
  for (const law of laws) {
    for (const pattern of STALE_LAW_PATTERNS) {
      if (pattern.test(law)) {
        issues.push({ lawId: law.id, title: law.title, reason: pattern.fixHint });
      }
    }
  }
  return issues;
}

export const CA_PAID_SICK_LEAVE_SUMMARY_2024 =
  'Effective January 1, 2024 (SB 616), California employers must generally provide and allow employees to use at least 40 hours or five days of paid sick leave per year (Labor Code § 246). Sick leave may be used for the employee’s or a family member’s health needs. Accrual or front-loading rules apply depending on employer policy; local ordinances that require more leave still control when more generous.';
