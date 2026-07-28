import type { Investigation, PromptResponse, Report } from '@/types';

/** Open case-register rows (excludes cases already under an open investigation). */
export function openCaseRegisterReports(
  reports: Report[],
  investigations: Investigation[]
): Report[] {
  const openInvIds = new Set(investigations.filter((i) => i.status === 'OPEN').map((i) => i.id));
  return reports.filter((report) => {
    if (['RESOLVED', 'CLOSED'].includes(report.status)) return false;
    if (!report.investigationId) return true;
    return !openInvIds.has(report.investigationId);
  });
}

/**
 * Prompt Responses nav badge: unanswered check-ins + open cases + Yes needing review,
 * without double-counting a Yes that already opened a case-register row.
 */
export function computePromptResponsesNavCount(opts: {
  responses: PromptResponse[];
  reports: Report[];
  investigations: Investigation[];
  unansweredPromptDeliveries: number;
}): number {
  const openCases = openCaseRegisterReports(opts.reports, opts.investigations);
  const coveredResponseIds = new Set(
    openCases
      .map((report) => report.sourcePromptResponseId)
      .filter((id): id is string => Boolean(id))
  );
  const yesWithoutOpenCase = opts.responses.filter(
    (response) =>
      response.answer === 'HAS_ISSUE' &&
      !response.reviewedAt &&
      response.needsReview !== false &&
      !coveredResponseIds.has(response.id)
  ).length;
  return opts.unansweredPromptDeliveries + openCases.length + yesWithoutOpenCase;
}

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
