import { describe, expect, it } from 'vitest';
import { findReportForPromptResponse } from '@/lib/recordLinks';
import type { Report } from '@/types';

function report(partial: Partial<Report> & Pick<Report, 'id'>): Report {
  return {
    orgId: 'org-1',
    createdByUserId: 'emp-1',
    isAnonymous: false,
    category: 'OTHER',
    severity: 'HIGH',
    summary: 'Incident query',
    description: 'Needs intake',
    status: 'NEW',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as Report;
}

describe('findReportForPromptResponse', () => {
  it('matches by response id on sourcePromptResponseId', () => {
    const reports = [report({ id: 'case-1', sourcePromptResponseId: 'response-1' })];
    expect(findReportForPromptResponse('response-1', reports)?.id).toBe('case-1');
  });

  it('matches legacy rows that stored the delivery id on the report', () => {
    const reports = [report({ id: 'case-2', sourcePromptResponseId: 'delivery-9' })];
    expect(
      findReportForPromptResponse('response-9', reports, {
        promptDeliveryId: 'delivery-9',
        userId: 'emp-1',
      })?.id
    ).toBe('case-2');
  });

  it('matches deterministic report ids from the Yes flow', () => {
    const reports = [report({ id: 'report-response-3', reportSourceType: 'EMPLOYEE_PROMPT_RESPONSE' })];
    expect(findReportForPromptResponse('response-3', reports)?.id).toBe('report-response-3');
  });
});
