import { useMemo } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { InvestigationResponseRequestPanel } from '@/components/InvestigationResponseRequestPanel';
import { Icons } from '@/lib/icons';
import { findInvestigationResponseRequest } from '@/lib/investigationWorkflow';
import { formatCaseReference } from '@/lib/caseTypes';
import { toast } from 'sonner';

interface EmployeeInvestigationResponseProps {
  dataStore: DataStore;
  requestId: string;
  onNavigate: (page: string) => void;
}

export function EmployeeInvestigationResponse({ dataStore, requestId, onNavigate }: EmployeeInvestigationResponseProps) {
  const {
    investigations,
    employeeReports,
    users,
    currentUser,
    submitEmployeeInvestigationResponse,
    updateInvestigationResponseRequest,
  } = dataStore;

  const match = useMemo(
    () => findInvestigationResponseRequest(investigations, requestId, currentUser.id),
    [currentUser.id, investigations, requestId]
  );

  const investigator = match
    ? users.find((u) => u.id === match.request.createdByUserId)
    : undefined;

  const linkedReport = match
    ? employeeReports.find((r) => r.investigationId === match.investigation.id)
    : undefined;

  if (!match) {
    return (
      <div className="text-center py-12">
        <Icons.searchX className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[var(--mismo-text)]">Response request not found</h2>
        <p className="text-[var(--mismo-text-secondary)] mt-2">
          This request may have expired or is not assigned to your account.
        </p>
        <button type="button" onClick={() => onNavigate('home')} className="text-[var(--mismo-blue)] mt-4 hover:underline">
          Back to dashboard
        </button>
      </div>
    );
  }

  const { investigation, request } = match;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button type="button" onClick={() => onNavigate('home')} className="text-sm text-[var(--mismo-blue)] hover:underline">
        ← Back to dashboard
      </button>

      <div>
        <h1 className="text-xl font-semibold text-[var(--mismo-text)]">Respond to HR request</h1>
        {linkedReport && (
          <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
            Case {formatCaseReference(linkedReport)}
          </p>
        )}
      </div>

      <InvestigationResponseRequestPanel
        request={request}
        investigatorName={investigator ? `${investigator.firstName} ${investigator.lastName}` : undefined}
        onMarkViewed={() =>
          updateInvestigationResponseRequest(investigation.id, request.id, {
            status: 'VIEWED',
            viewedAt: new Date(),
          })
        }
        onSubmit={(text) => {
          const ok = submitEmployeeInvestigationResponse(investigation.id, request.id, text);
          if (ok) toast.success('Your response has been submitted.');
          else toast.error('Could not submit your response.');
          return ok;
        }}
      />
    </div>
  );
}
