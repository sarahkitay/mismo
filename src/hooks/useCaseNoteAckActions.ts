import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { ActivityEvent, CaseNoteAcknowledgement, Report, User } from '@/types';

export type CaseNoteAckDeps = {
  effectiveOrgId: string;
  currentUser: User;
  caseNoteAcknowledgements: CaseNoteAcknowledgement[];
  setCaseNoteAcknowledgements: Dispatch<SetStateAction<CaseNoteAcknowledgement[]>>;
  setReports: Dispatch<SetStateAction<Report[]>>;
  setActivities: Dispatch<SetStateAction<ActivityEvent[]>>;
  addReportHandlingEntry: (reportId: string, type: 'PLAN' | 'ACTION_TAKEN' | 'EMPLOYEE_RESPONSE' | 'NOTE' | 'FILE', text: string) => void;
};

export function useCaseNoteAckActions(deps: CaseNoteAckDeps) {
  const {
    effectiveOrgId,
    currentUser,
    caseNoteAcknowledgements,
    setCaseNoteAcknowledgements,
    setReports,
    setActivities,
    addReportHandlingEntry,
  } = deps;

  const createCaseNoteAcknowledgement = useCallback(
    (input: {
      reportId: string;
      userId: string;
      subject: string;
      body: string;
      kind?: CaseNoteAcknowledgement['kind'];
      investigationId?: string;
      attachments?: CaseNoteAcknowledgement['attachments'];
    }): CaseNoteAcknowledgement => {
      const now = new Date();
      const ack: CaseNoteAcknowledgement = {
        id: `case-note-ack-${now.getTime()}`,
        orgId: effectiveOrgId,
        reportId: input.reportId,
        userId: input.userId,
        subject: input.subject,
        body: input.body,
        kind: input.kind ?? 'CASE_NOTE',
        investigationId: input.investigationId,
        attachments: input.attachments,
        status: 'PENDING',
        sentByUserId: currentUser.id,
        sentAt: now,
        createdAt: now,
        updatedAt: now,
      };
      setCaseNoteAcknowledgements((prev) => [...prev, ack]);
      return ack;
    },
    [currentUser.id, effectiveOrgId, setCaseNoteAcknowledgements]
  );

  const respondToCaseNoteAcknowledgement = useCallback(
    (
      ackId: string,
      response: {
        outcome: 'CONFIRMED' | 'REVISION_REQUESTED';
        signatureDataUrl?: string;
        revisionNote?: string;
      }
    ): CaseNoteAcknowledgement | null => {
      const existing = caseNoteAcknowledgements.find((ack) => ack.id === ackId);
      if (!existing) return null;

      const now = new Date();
      const next: CaseNoteAcknowledgement = {
        ...existing,
        status: response.outcome,
        respondedAt: now,
        updatedAt: now,
        signatureDataUrl: response.signatureDataUrl ?? existing.signatureDataUrl,
        revisionNote: response.revisionNote?.trim() || existing.revisionNote,
      };

      setCaseNoteAcknowledgements((prev) => prev.map((ack) => (ack.id === ackId ? next : ack)));

      const outcomeText =
        response.outcome === 'CONFIRMED'
          ? next.kind === 'INITIAL_CONTACT'
            ? 'Employee confirmed the initial contact summary is accurate and signed off digitally.'
            : 'Employee confirmed the case note is accurate and signed off digitally.'
          : next.kind === 'INITIAL_CONTACT'
            ? `Employee requested revisions to the initial contact summary:\n${response.revisionNote?.trim() ?? '(no details provided)'}`
            : `Employee requested revisions:\n${response.revisionNote?.trim() ?? '(no details provided)'}`;

      addReportHandlingEntry(next.reportId, 'EMPLOYEE_RESPONSE', outcomeText);

      if (response.outcome === 'CONFIRMED') {
        setReports((prev) =>
          prev.map((report) =>
            report.id === next.reportId
              ? {
                  ...report,
                  employeeResponseOutcome: `Employee confirmed case note on ${now.toLocaleDateString()}.`,
                  updatedAt: now,
                }
              : report
          )
        );
      } else {
        setReports((prev) =>
          prev.map((report) =>
            report.id === next.reportId
              ? {
                  ...report,
                  employeeResponseOutcome: `Employee requested revision on ${now.toLocaleDateString()}: ${response.revisionNote?.trim() ?? ''}`,
                  updatedAt: now,
                }
              : report
          )
        );
      }

      setActivities((prev) => [
        {
          id: `activity-${now.getTime()}`,
          orgId: effectiveOrgId,
          type: 'PROMPT_RESPONSE',
          actorUserId: currentUser.id,
          metadata: {
            caseNoteAckId: ackId,
            reportId: next.reportId,
            outcome: response.outcome,
          },
          createdAt: now,
        },
        ...prev,
      ]);

      return next;
    },
    [addReportHandlingEntry, caseNoteAcknowledgements, currentUser.id, effectiveOrgId, setActivities, setCaseNoteAcknowledgements, setReports]
  );

  return {
    createCaseNoteAcknowledgement,
    respondToCaseNoteAcknowledgement,
  };
}
