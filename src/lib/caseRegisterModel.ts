import type { Report, ReportStatus } from '@/types';

export const OPEN_STATUSES: ReportStatus[] = [
  'NEW',
  'TRIAGED',
  'ASSIGNED',
  'IN_REVIEW',
  'NEEDS_INFO',
  'PENDING_WAGE_HOUR_REVIEW',
  'PAYROLL_EXPEDITED',
];
export const SLA_DAYS = 14;

export type CaseRegisterBucket =
  | 'PROMPT_ALL'
  | 'PROMPT_YES'
  | 'PROMPT_NO'
  | 'PROMPT_UNANSWERED'
  | 'CASE_REGISTER'
  | 'NEW_CRITICAL'
  | 'NEEDS_RESPONSE';

export function isOpenReport(r: Report): boolean {
  return OPEN_STATUSES.includes(r.status);
}

export function isOverSla(r: Report, now = Date.now()): boolean {
  if (['RESOLVED', 'CLOSED'].includes(r.status)) return false;
  const updated =
    (r.updatedAt ?? r.createdAt) instanceof Date
      ? (r.updatedAt ?? r.createdAt).getTime()
      : new Date(String(r.updatedAt ?? r.createdAt)).getTime();
  return now - updated > SLA_DAYS * 24 * 60 * 60 * 1000;
}

export function isUnderOpenInvestigation(
  report: Report,
  investigations: { id: string; status: string }[]
): boolean {
  if (!report.investigationId) return false;
  const inv = investigations.find((i) => i.id === report.investigationId);
  return inv?.status === 'OPEN';
}

export function deriveBucket(
  filters: Record<string, string>,
  hubPage: 'prompt-responses' | 'case-register'
): CaseRegisterBucket {
  if (filters.channel === 'register' || filters.channel === 'wage_hour') {
    if (filters.critical === '1') return 'NEW_CRITICAL';
    if (filters.needs_info === '1') return 'NEEDS_RESPONSE';
    return 'CASE_REGISTER';
  }
  if (filters.critical === '1') return 'NEW_CRITICAL';
  if (filters.needs_info === '1') return 'NEEDS_RESPONSE';
  if (filters.answer === 'HAS_ISSUE') return 'PROMPT_YES';
  if (filters.answer === 'NO_ISSUE') return 'PROMPT_NO';
  if (filters.bucket === 'UNANSWERED') return 'PROMPT_UNANSWERED';
  if (
    filters.register === '1' ||
    filters.view === 'register' ||
    filters.status ||
    filters.open === '1' ||
    filters.unassigned === '1' ||
    filters.new24h === '1' ||
    filters.new7d === '1' ||
    filters.over_sla === '1' ||
    hubPage === 'case-register'
  ) {
    return 'CASE_REGISTER';
  }
  if (filters.view === 'prompts') return 'PROMPT_ALL';
  return 'PROMPT_ALL';
}
