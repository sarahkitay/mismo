import type { Prompt, PromptResponse, Report } from '@/types';

/** True when this check-in answer is really a wage & hour / payroll path, not a workplace incident. */
export function isWageHourOrientedResponse(
  response: Pick<PromptResponse, 'notes' | 'answer'>,
  linkedReport?: Pick<Report, 'caseType'> | null
): boolean {
  if (linkedReport?.caseType === 'WAGE_HOUR') return true;
  const notes = (response.notes ?? '').toLowerCase();
  if (!notes) return false;
  if (notes.includes('payroll memo') || notes.includes('expedited payroll')) return true;
  if (notes.includes('full wage & hour') || notes.includes('wage & hour report sheet')) return true;
  // Pay-only path kept on the incident delivery after a workplace No.
  if (
    response.answer === 'NO_ISSUE' &&
    notes.includes('financial follow-up') &&
    (notes.includes('indicated a pay') ||
      notes.includes('chose to complete') ||
      notes.includes('payroll issue') ||
      notes.includes('no workplace incident'))
  ) {
    return true;
  }
  return false;
}

export function checkInResponseDisplayLabel(
  prompt: Pick<Prompt, 'title' | 'type'> | undefined,
  response: Pick<PromptResponse, 'notes' | 'answer'>,
  linkedReport?: Pick<Report, 'caseType'> | null
): { title: string; type: string } {
  if (isWageHourOrientedResponse(response, linkedReport)) {
    return { title: 'Wage & Hour Query', type: 'WAGE_HOUR' };
  }
  return {
    title: prompt?.title ?? 'Prompt',
    type: prompt?.type ?? 'GENERAL',
  };
}

/** True when notes are only the bundled Q2 pay/financial screening line. */
export function isFinancialFollowUpNote(notes: string | null | undefined): boolean {
  const n = (notes ?? '').trim().toLowerCase();
  return n.startsWith('financial follow-up:');
}

/** Notes to show on a workplace incident case (omit pay-screening boilerplate). */
export function incidentFacingCheckInNotes(notes: string | null | undefined): string | undefined {
  const trimmed = (notes ?? '').trim();
  if (!trimmed || isFinancialFollowUpNote(trimmed)) return undefined;
  return trimmed;
}
