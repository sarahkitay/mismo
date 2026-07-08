import type { Investigation, PromptResponse, Report } from '@/types';

/** Yes check-ins still in HR triage (not yet absorbed into an open investigation file). */
export function yesResponsesUnderReview(
  responses: PromptResponse[],
  reports: Report[],
  investigations: Investigation[]
): PromptResponse[] {
  const openInvIds = new Set(investigations.filter((i) => i.status === 'OPEN').map((i) => i.id));
  return responses.filter((response) => {
    if (response.answer !== 'HAS_ISSUE' || response.reviewedAt || response.needsReview === false) {
      return false;
    }
    const linkedReport = reports.find((report) => report.sourcePromptResponseId === response.id);
    if (linkedReport?.investigationId && openInvIds.has(linkedReport.investigationId)) {
      return false;
    }
    return true;
  });
}

export function computeOpenInvestigationWorkload(
  investigations: Investigation[],
  responses: PromptResponse[],
  reports: Report[]
): { formalCount: number; yesUnderReviewCount: number; totalCount: number } {
  const formalCount = investigations.filter((investigation) => investigation.status === 'OPEN').length;
  const yesUnderReviewCount = yesResponsesUnderReview(responses, reports, investigations).length;
  return {
    formalCount,
    yesUnderReviewCount,
    totalCount: formalCount + yesUnderReviewCount,
  };
}
