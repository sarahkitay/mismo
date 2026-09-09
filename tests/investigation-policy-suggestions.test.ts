import { describe, expect, it } from 'vitest';
import type { Investigation, Policy, Report } from '@/types';
import {
  autoLinkPolicyIds,
  buildSuggestedPolicyAnalysisNotes,
  suggestPoliciesForInvestigation,
} from '@/lib/investigationPolicySuggestions';

function baseInv(overrides: Partial<Investigation> = {}): Investigation {
  const now = new Date();
  return {
    id: 'inv-1',
    orgId: 'org-1',
    status: 'OPEN',
    ownerId: 'u-hr',
    linkedReportIds: ['r-1'],
    category: 'HARASSMENT',
    openedAt: now,
    lastUpdateAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function policy(partial: Partial<Policy> & Pick<Policy, 'id' | 'title' | 'content'>): Policy {
  const now = new Date();
  return {
    orgId: 'org-1',
    type: 'CONDUCT',
    effectiveDate: now,
    acknowledgmentRequired: true,
    tags: [],
    status: 'PUBLISHED',
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe('investigationPolicySuggestions', () => {
  it('ranks harassment policies highly for harassment cases', () => {
    const policies = [
      policy({
        id: 'p-harass',
        title: 'Anti-Harassment Policy',
        content: 'Unwelcome sexual harassment and hostile workplace conduct are prohibited. Section 4.2.',
        memoCategory: 'HR',
      }),
      policy({
        id: 'p-safety',
        title: 'Workplace Safety Manual',
        content: 'PPE and OSHA reporting requirements for workplace injury.',
        type: 'SAFETY',
        memoCategory: 'Safety',
      }),
    ];
    const report = {
      id: 'r-1',
      orgId: 'org-1',
      category: 'HARASSMENT',
      severity: 'HIGH',
      status: 'IN_REVIEW',
      summary: 'Employee reported harassment by a coworker',
      description: 'Hostile comments and unwelcome conduct in the office',
      isAnonymous: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    } as Report;

    const suggestions = suggestPoliciesForInvestigation(baseInv(), policies, report);
    expect(suggestions[0]?.policyId).toBe('p-harass');
    expect(suggestions[0]?.confidence).toMatch(/high|medium/);
    expect(suggestions[0]?.excerpt).toBeTruthy();

    const linked = autoLinkPolicyIds(suggestions, []);
    expect(linked).toContain('p-harass');

    const notes = buildSuggestedPolicyAnalysisNotes(suggestions, 'HARASSMENT');
    expect(notes).toContain('Anti-Harassment Policy');
  });
});
