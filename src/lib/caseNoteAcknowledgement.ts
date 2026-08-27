import type { CaseNoteAcknowledgement, CaseNoteAcknowledgementStatus } from '@/types';

export function caseNoteAckStatusLabel(status: CaseNoteAcknowledgementStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Awaiting employee sign-off';
    case 'CONFIRMED':
      return 'Confirmed by employee';
    case 'REVISION_REQUESTED':
      return 'Revision requested';
    default:
      return status;
  }
}

export function pendingCaseNoteAcksForReport(acks: CaseNoteAcknowledgement[], reportId: string, userId?: string) {
  return acks.filter(
    (a) =>
      a.reportId === reportId &&
      a.status === 'PENDING' &&
      (userId == null || a.userId === userId)
  );
}

export function caseNoteAcksForEmployee(acks: CaseNoteAcknowledgement[], userId: string) {
  return [...acks]
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
}

export function buildInitialContactReviewEmailBody(noteBody: string): string {
  return [
    'Please review the summary of HR initial contact below for accuracy.',
    'If it looks correct, open the link to sign off in Mismo.',
    'If something is wrong, you can request revisions and explain what should change.',
    '',
    noteBody,
  ].join('\n');
}

export function caseNoteAckKindLabel(kind: CaseNoteAcknowledgement['kind']): string {
  return kind === 'INITIAL_CONTACT' ? 'Initial contact sign-off' : 'Case note sign-off';
}

export function buildCaseNoteReviewEmailBody(noteBody: string): string {
  return [
    'Please review the case note below for accuracy.',
    'If it looks correct, open the link to sign off in Mismo.',
    'If something is wrong, you can request revisions and explain what should change.',
    '',
    noteBody,
  ].join('\n');
}
