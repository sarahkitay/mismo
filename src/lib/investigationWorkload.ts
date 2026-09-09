import type { Investigation, PromptResponse, Report } from '@/types';
import { findInvestigationForPromptResponse, findReportForPromptResponse } from '@/lib/recordLinks';

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
 * Yes still waiting on HR triage:
 * - not marked opened/reviewed by anyone
 * - not linked to an investigation (open or closed — those live under Yes history)
 */
export function promptResponseNeedsHrReview(
  response: PromptResponse,
  reports: Report[],
  investigations: Investigation[],
  _opts?: { seenIds?: Set<string> }
): boolean {
  if (response.answer !== 'HAS_ISSUE') return false;
  if (response.reviewedAt || response.needsReview === false) return false;

  const linkedInv = findInvestigationForPromptResponse(response.id, reports, investigations);
  if (linkedInv) return false;

  const linkedReport = findReportForPromptResponse(response.id, reports, {
    userId: response.userId,
    promptDeliveryId: response.promptDeliveryId,
    promptId: response.promptId,
  });
  if (linkedReport?.investigationId) {
    const byId = investigations.find((i) => i.id === linkedReport.investigationId);
    if (byId) return false;
  }
  return true;
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
  seenYesIds?: Set<string>;
}): number {
  const openCases = openCaseRegisterReports(opts.reports, opts.investigations);
  const coveredResponseIds = new Set(
    openCases
      .map((report) => report.sourcePromptResponseId)
      .filter((id): id is string => Boolean(id))
  );
  const yesWithoutOpenCase = opts.responses.filter(
    (response) =>
      promptResponseNeedsHrReview(response, opts.reports, opts.investigations, {
        seenIds: opts.seenYesIds,
      }) && !coveredResponseIds.has(response.id)
  ).length;
  return opts.unansweredPromptDeliveries + openCases.length + yesWithoutOpenCase;
}

/** Yes check-ins still in HR triage (not yet absorbed into an investigation file). */
export function yesResponsesUnderReview(
  responses: PromptResponse[],
  reports: Report[],
  investigations: Investigation[],
  opts?: { seenIds?: Set<string> }
): PromptResponse[] {
  return responses.filter((response) =>
    promptResponseNeedsHrReview(response, reports, investigations, opts)
  );
}

export function computeOpenInvestigationWorkload(
  investigations: Investigation[],
  responses: PromptResponse[],
  reports: Report[],
  opts?: { seenIds?: Set<string> }
): { formalCount: number; yesUnderReviewCount: number; totalCount: number } {
  const formalCount = investigations.filter((investigation) => investigation.status === 'OPEN').length;
  const yesUnderReviewCount = yesResponsesUnderReview(responses, reports, investigations, opts).length;
  return {
    formalCount,
    yesUnderReviewCount,
    totalCount: formalCount + yesUnderReviewCount,
  };
}
