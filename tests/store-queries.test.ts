import { describe, expect, it } from 'vitest';
import {
  computeAtRiskEmployees,
  computeEmployeeEngagement,
  filterEmployees,
  filterInvestigations,
  filterReports,
} from '@/lib/storeQueries';
import type { PromptDelivery, PromptResponse, Report, User } from '@/types';

const now = new Date('2026-08-01T12:00:00.000Z');

function report(partial: Partial<Report> & Pick<Report, 'id' | 'status'>): Report {
  return {
    orgId: 'org-a',
    createdByUserId: 'u1',
    isAnonymous: false,
    category: 'OTHER',
    severity: 'LOW',
    summary: 'summary',
    description: 'description',
    assignedTo: null,
    messages: [],
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...partial,
  } as Report;
}

describe('storeQueries', () => {
  it('filters reports by status, assignee, and search', () => {
    const rows = [
      report({ id: 'r1', status: 'NEW', summary: 'harassment', assignedTo: null }),
      report({ id: 'r2', status: 'ASSIGNED', summary: 'payroll', assignedTo: 'hr1' }),
    ];
    expect(filterReports(rows, { status: ['NEW'] }).map((r) => r.id)).toEqual(['r1']);
    expect(filterReports(rows, { assignedTo: null }).map((r) => r.id)).toEqual(['r1']);
    expect(filterReports(rows, { search: 'PAY' }).map((r) => r.id)).toEqual(['r2']);
  });

  it('filters investigations by owner', () => {
    const rows = [
      { id: 'i1', status: 'OPEN' as const, ownerId: 'hr1', openedAt: new Date('2026-07-02') },
      { id: 'i2', status: 'CLOSED' as const, ownerId: 'hr2', openedAt: new Date('2026-07-01') },
    ];
    expect(filterInvestigations(rows as never, { ownerId: 'hr1' }).map((i) => i.id)).toEqual(['i1']);
  });

  it('marks employees at risk when they have never responded', () => {
    const users = [
      { id: 'e1', role: 'EMPLOYEE', status: 'active' },
      { id: 'hr', role: 'HR', status: 'active' },
    ] as User[];
    const responses: PromptResponse[] = [];
    const deliveries: PromptDelivery[] = [];
    const thresholds = { atRiskNoResponseDays: 14, atRiskMinResponseRate: 0.5 };
    const atRisk = computeAtRiskEmployees(users, { responses, deliveries, thresholds, now });
    expect(atRisk.map((e) => e.userId)).toEqual(['e1']);
    expect(filterEmployees(users, { atRiskOnly: true }, { responses, deliveries, thresholds }).map((u) => u.id)).toEqual([
      'e1',
    ]);
    expect(computeEmployeeEngagement('e1', { responses, deliveries, thresholds, now }).isAtRisk).toBe(true);
  });
});
