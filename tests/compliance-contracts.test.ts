import { describe, expect, it } from 'vitest';
import { allocateCaseReferenceNumber, getUnifiedCaseId } from '@/lib/caseReference';
import { formatCaseReference } from '@/lib/caseTypes';
import { validateLawCorpusForPublish } from '@/lib/lawCorpusFreshness';
import {
  computeOpenInvestigationWorkload,
  computePromptResponsesNavCount,
  openCaseRegisterReports,
} from '@/lib/investigationWorkload';
import type { Investigation, PromptResponse, Report } from '@/types';

describe('canonical case reference', () => {
  it('allocates the next sequence from max, not row count', () => {
    const year = new Date().getFullYear();
    const next = allocateCaseReferenceNumber(
      [
        { orgId: 'org-1', referenceNumber: `WH-${year}-0001` },
        { orgId: 'org-1', referenceNumber: `WH-${year}-0003` },
      ],
      'org-1',
      'WAGE_HOUR'
    );
    expect(next).toBe(`WH-${year}-0004`);
    const report = { id: 'report-1', referenceNumber: next, caseType: 'WAGE_HOUR' as const };
    expect(formatCaseReference(report)).toBe(next);
    expect(getUnifiedCaseId(report)).toBe(next);
  });
});

describe('law corpus publish gate', () => {
  it('blocks the pre-2024 California sick leave floor', () => {
    const stale = validateLawCorpusForPublish([
      {
        id: 'law-1',
        title: 'California Paid Sick Leave Law',
        summary: 'Employers must provide at least 24 hours or three days of paid sick leave.',
      } as never,
    ]);
    expect(stale).toHaveLength(1);
  });

  it('allows the SB 616 40 hour / 5 day floor', () => {
    const fresh = validateLawCorpusForPublish([
      {
        id: 'law-2',
        title: 'California Paid Sick Leave Law',
        summary: 'Employers must provide at least 40 hours or five days of paid sick leave.',
      } as never,
    ]);
    expect(fresh).toHaveLength(0);
  });
});

describe('case register vs dashboard counts', () => {
  const reports = [
    { id: 'r1', status: 'NEW', investigationId: undefined, sourcePromptResponseId: 'yes-1' },
    { id: 'r2', status: 'NEW', investigationId: 'inv-open', sourcePromptResponseId: 'yes-2' },
    { id: 'r3', status: 'CLOSED', investigationId: undefined },
  ] as Report[];
  const investigations = [{ id: 'inv-open', status: 'OPEN' }] as Investigation[];

  it('hides cases already under an open investigation from the register', () => {
    const open = openCaseRegisterReports(reports, investigations);
    expect(open.map((r) => r.id)).toEqual(['r1']);
  });

  it('does not double-count a Yes that already opened a register row', () => {
    const responses = [
      { id: 'yes-1', answer: 'HAS_ISSUE', reviewedAt: undefined, needsReview: true },
      { id: 'yes-orphan', answer: 'HAS_ISSUE', reviewedAt: undefined, needsReview: true },
    ] as PromptResponse[];
    const count = computePromptResponsesNavCount({
      responses,
      reports,
      investigations,
      unansweredPromptDeliveries: 2,
    });
    expect(count).toBe(2 + 1 + 1);
    const workload = computeOpenInvestigationWorkload(investigations, responses, reports);
    expect(workload.formalCount).toBe(1);
    expect(workload.totalCount).toBe(workload.formalCount + workload.yesUnderReviewCount);
  });
});
