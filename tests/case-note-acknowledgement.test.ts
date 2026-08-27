import { describe, expect, it } from 'vitest';
import {
  buildCaseNoteReviewEmailBody,
  caseNoteAcksForEmployee,
  caseNoteAckStatusLabel,
  pendingCaseNoteAcksForReport,
} from '@/lib/caseNoteAcknowledgement';
import type { CaseNoteAcknowledgement } from '@/types';

function ack(partial: Partial<CaseNoteAcknowledgement> & Pick<CaseNoteAcknowledgement, 'id' | 'reportId' | 'userId'>): CaseNoteAcknowledgement {
  const now = new Date('2026-08-26T12:00:00Z');
  return {
    orgId: 'org-1',
    subject: 'Phone call summary',
    body: 'We discussed your concern.',
    status: 'PENDING',
    sentByUserId: 'hr-1',
    sentAt: now,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe('caseNoteAcknowledgement helpers', () => {
  it('labels statuses for HR UI', () => {
    expect(caseNoteAckStatusLabel('PENDING')).toBe('Awaiting employee sign-off');
    expect(caseNoteAckStatusLabel('CONFIRMED')).toBe('Confirmed by employee');
    expect(caseNoteAckStatusLabel('REVISION_REQUESTED')).toBe('Revision requested');
  });

  it('finds pending acks scoped to report and employee', () => {
    const list = [
      ack({ id: 'a1', reportId: 'r1', userId: 'u1' }),
      ack({ id: 'a2', reportId: 'r1', userId: 'u2' }),
      ack({ id: 'a3', reportId: 'r2', userId: 'u1', status: 'CONFIRMED' }),
    ];
    expect(pendingCaseNoteAcksForReport(list, 'r1', 'u1').map((a) => a.id)).toEqual(['a1']);
    expect(pendingCaseNoteAcksForReport(list, 'r1').map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('sorts employee file acks newest first', () => {
    const older = ack({ id: 'old', reportId: 'r1', userId: 'u1', sentAt: new Date('2026-08-20T12:00:00Z') });
    const newer = ack({ id: 'new', reportId: 'r2', userId: 'u1', sentAt: new Date('2026-08-25T12:00:00Z') });
    expect(caseNoteAcksForEmployee([older, newer], 'u1').map((a) => a.id)).toEqual(['new', 'old']);
  });

  it('builds review email copy with instructions', () => {
    const body = buildCaseNoteReviewEmailBody('Summary text');
    expect(body).toContain('sign off in Mismo');
    expect(body).toContain('Summary text');
  });
});
