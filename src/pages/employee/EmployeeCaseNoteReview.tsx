import { useMemo } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { CaseNoteAcknowledgementPanel } from '@/components/CaseNoteAcknowledgementPanel';
import { Icons } from '@/lib/icons';
import { caseNoteAckStatusLabel } from '@/lib/caseNoteAcknowledgement';
import { formatCaseReference } from '@/lib/caseTypes';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

interface EmployeeCaseNoteReviewProps {
  dataStore: DataStore;
  ackId: string;
  onNavigate: (page: string) => void;
}

export function EmployeeCaseNoteReview({ dataStore, ackId, onNavigate }: EmployeeCaseNoteReviewProps) {
  const { caseNoteAcknowledgements, currentUser, respondToCaseNoteAcknowledgement, employeeReports } = dataStore;

  const ack = useMemo(
    () => caseNoteAcknowledgements.find((item) => item.id === ackId && item.userId === currentUser.id),
    [ackId, caseNoteAcknowledgements, currentUser.id]
  );

  const report = ack ? employeeReports.find((r) => r.id === ack.reportId) : undefined;

  if (!ack) {
    return (
      <div className="text-center py-12">
        <Icons.searchX className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[var(--mismo-text)]">Review link not found</h2>
        <p className="text-[var(--mismo-text-secondary)] mt-2">
          This case note review may have expired or is not assigned to your account.
        </p>
        <button type="button" onClick={() => onNavigate('home')} className="text-[var(--mismo-blue)] mt-4 hover:underline">
          Back to dashboard
        </button>
      </div>
    );
  }

  const handleConfirm = (signatureDataUrl: string) => {
    respondToCaseNoteAcknowledgement(ack.id, { outcome: 'CONFIRMED', signatureDataUrl });
    toast.success('Thank you. Your sign-off has been recorded.');
  };

  const handleRevision = (note: string) => {
    respondToCaseNoteAcknowledgement(ack.id, { outcome: 'REVISION_REQUESTED', revisionNote: note });
    toast.success('Revision request sent to HR.');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button
        type="button"
        onClick={() => onNavigate(`report-detail/${ack.reportId}`)}
        className="text-sm text-[var(--mismo-blue)] hover:underline"
      >
        ← Back to case
      </button>

      <div>
        <h1 className="text-xl font-semibold text-[var(--mismo-text)]">
          {ack.kind === 'INITIAL_CONTACT' ? 'Review initial contact notes' : 'Review HR case note'}
        </h1>
        {report && (
          <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
            Case {report ? formatCaseReference(report) : ack.reportId}
          </p>
        )}
      </div>

      {ack.status === 'PENDING' ? (
        <CaseNoteAcknowledgementPanel
          subject={ack.subject}
          body={ack.body}
          variant={ack.kind === 'INITIAL_CONTACT' ? 'initial_contact' : 'case_note'}
          attachments={ack.attachments}
          onConfirm={handleConfirm}
          onRequestRevision={handleRevision}
        />
      ) : (
        <div className="rounded-lg border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-4 space-y-3">
          <p className="text-sm font-medium text-[var(--mismo-text)]">{caseNoteAckStatusLabel(ack.status)}</p>
          <p className="text-sm text-[var(--mismo-text-secondary)] whitespace-pre-wrap">{ack.body}</p>
          {ack.status === 'REVISION_REQUESTED' && ack.revisionNote && (
            <div className="border border-amber-200 bg-amber-50 rounded-md p-3 text-sm text-amber-950">
              <p className="font-medium">Your revision request</p>
              <p className="mt-1 whitespace-pre-wrap">{ack.revisionNote}</p>
            </div>
          )}
          {ack.status === 'CONFIRMED' && ack.signatureDataUrl && (
            <div>
              <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Your signature</p>
              <img src={ack.signatureDataUrl} alt="Your signature" className="max-h-24 border border-[var(--color-border-200)] bg-white rounded" />
            </div>
          )}
          {ack.respondedAt && (
            <p className="text-xs text-[var(--color-text-muted)]">Responded {formatDate(ack.respondedAt)}</p>
          )}
        </div>
      )}
    </div>
  );
}
