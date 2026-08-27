import { describe, expect, it } from 'vitest';
import {
  buildInvestigationOutcomeOverview,
  canCloseInvestigation,
  investigationOutcomeSignOffPending,
} from '@/lib/investigationOutcome';
import type { Investigation } from '@/types';

function inv(partial: Partial<Investigation> = {}): Investigation {
  const now = new Date('2026-08-26T12:00:00Z');
  return {
    id: 'inv-1',
    orgId: 'org-1',
    linkedReportIds: ['report-1'],
    status: 'OPEN',
    ownerId: 'hr-1',
    openedAt: now,
    lastUpdateAt: now,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe('investigationOutcome helpers', () => {
  it('detects pending employee sign-off', () => {
    expect(
      investigationOutcomeSignOffPending(
        inv({ outcomeSentAt: now(), outcomeRequiresSignature: true, outcomeEmployeeSignedAt: undefined })
      )
    ).toBe(true);
    expect(
      investigationOutcomeSignOffPending(
        inv({ outcomeSentAt: now(), outcomeRequiresSignature: false, outcomeEmployeeSignedAt: undefined })
      )
    ).toBe(false);
  });

  it('blocks close until employee signs when sign-off required', () => {
    const pending = inv({
      outcomeSentAt: now(),
      outcomeRequiresSignature: true,
      outcomeEmployeeSignedAt: undefined,
    });
    expect(canCloseInvestigation(pending).ok).toBe(false);

    const signed = inv({
      outcomeSentAt: now(),
      outcomeRequiresSignature: true,
      outcomeEmployeeSignedAt: now(),
      outcomeEmployeeAgreed: true,
    });
    expect(canCloseInvestigation(signed).ok).toBe(true);
  });

  it('builds overview from findings and actions', () => {
    const text = buildInvestigationOutcomeOverview(
      inv({
        outcomeClassification: 'COACHING_ISSUED',
        findingsRationale: 'Interview notes support the concern.',
        correctiveActions: [{ id: 'a1', type: 'COACHING', description: 'Manager coaching', assigneeUserId: 'hr-1', status: 'COMPLETE', createdAt: now() }],
      })
    );
    expect(text).toContain('Coaching issued');
    expect(text).toContain('Interview notes support the concern.');
    expect(text).toContain('Manager coaching');
  });
});

function now() {
  return new Date('2026-08-26T12:00:00Z');
}
