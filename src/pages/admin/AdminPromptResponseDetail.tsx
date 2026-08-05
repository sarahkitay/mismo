import type { DataStore } from '@/hooks/useDataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RelatedRecordsNav } from '@/components/admin/RelatedRecordsNav';
import {
  findInvestigationForPromptResponse,
  findReportForPromptResponse,
  relatedNavForDelivery,
  relatedNavForPromptResponse,
  userDisplayName,
} from '@/lib/recordLinks';
import { formatCaseReference } from '@/lib/caseTypes';
import { getInvestigationDisplayId } from '@/lib/investigationWorkflow';
import { toast } from 'sonner';

interface AdminPromptResponseDetailProps {
  dataStore: DataStore;
  responseId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function AdminPromptResponseDetail({ dataStore, responseId, onNavigate }: AdminPromptResponseDetailProps) {
  const response = dataStore.responses.find((r) => r.id === responseId);
  const delivery = !response ? dataStore.deliveries.find((d) => d.id === responseId) : undefined;

  if (!response && !delivery) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => onNavigate('prompt-responses', { view: 'prompts' })}>
          Back to check-in queries
        </Button>
        <p className="text-sm text-[var(--mismo-text-secondary)]">This check-in or response could not be found.</p>
      </div>
    );
  }

  if (delivery) {
    const prompt = dataStore.prompts.find((p) => p.id === delivery.promptId);
    const user = dataStore.users.find((u) => u.id === delivery.userId);
    const relatedLinks = relatedNavForDelivery(dataStore, delivery);

    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => onNavigate('prompt-responses', { bucket: 'UNANSWERED', view: 'prompts', rangePreset: 'ALL' })}>
          Back to check-in queries
        </Button>

        <RelatedRecordsNav links={relatedLinks} onNavigate={onNavigate} />

        <Card className="mismo-card">
          <CardContent className="p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{prompt?.title ?? 'Check-in query'}</h1>
              <Badge className="status-chip">Unanswered</Badge>
            </div>
            <p className="text-sm text-[var(--mismo-text-secondary)]">
              Employee:{' '}
              <button
                type="button"
                className="text-[var(--mismo-blue)] hover:underline font-medium"
                onClick={() => onNavigate('employee-detail', { id: delivery.userId })}
              >
                {userDisplayName(user)}
              </button>
            </p>
            <p className="text-sm text-[var(--mismo-text-secondary)]">Sent: {delivery.deliveredAt.toLocaleString()}</p>
            {delivery.dueAt && (
              <p className="text-sm text-[var(--mismo-text-secondary)]">Due: {delivery.dueAt.toLocaleString()}</p>
            )}
            <div className="rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-3 text-sm text-[var(--color-text-secondary)]">
              Assistant (preview): suggest a short reminder focused on the due date and confidentiality. Final copy is edited by HR before send.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const msg = window.prompt('Email reminder message to employee:', 'Please complete your pending HR check-in.');
                  if (msg == null) return;
                  dataStore.sendNudge(delivery.userId, 'EMAIL', msg, { type: 'PROMPT_REMINDER', promptId: delivery.promptId, relatedLabel: prompt?.title });
                  toast.success('Email reminder logged for this prompt.');
                }}
              >
                Send email reminder…
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const msg = window.prompt('SMS reminder message to employee:', 'Reminder: please complete your HR check-in.');
                  if (msg == null) return;
                  dataStore.sendNudge(delivery.userId, 'SMS', msg, { type: 'PROMPT_REMINDER', promptId: delivery.promptId, relatedLabel: prompt?.title });
                  toast.success('SMS reminder logged for this prompt.');
                }}
              >
                Send SMS reminder…
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!response) return null;

  const prompt = dataStore.prompts.find((p) => p.id === response.promptId);
  const user = dataStore.users.find((u) => u.id === response.userId);
  const needsReview = response.answer === 'HAS_ISSUE' && !response.reviewedAt && response.needsReview !== false;
  const reviewer = response.reviewedByUserId ? dataStore.users.find((u) => u.id === response.reviewedByUserId) : null;
  const linkedCase = findReportForPromptResponse(response.id, dataStore.reports, response.userId);
  const linkedInv = findInvestigationForPromptResponse(response.id, dataStore.reports, dataStore.investigations);
  const relatedLinks = relatedNavForPromptResponse(dataStore, response);

  const openCase = () => {
    if (!linkedCase) {
      toast.error('No linked case found for this response yet.');
      return;
    }
    onNavigate('report-detail', { id: linkedCase.id });
  };

  const openInvestigation = () => {
    if (!linkedInv) {
      toast.error('No investigation has been opened for this case yet.');
      return;
    }
    onNavigate('investigation-detail', { id: linkedInv.id, tab: 'page-1' });
  };

  const convertToInvestigation = () => {
    if (!linkedCase) {
      toast.error('Open or create the case first.');
      return;
    }
    if (linkedInv) {
      onNavigate('investigation-detail', { id: linkedInv.id, tab: 'page-1' });
      return;
    }
    const inv = dataStore.createInvestigation(linkedCase.id, dataStore.currentUser.id);
    if (inv?.id) {
      toast.success('Investigation opened.');
      onNavigate('investigation-detail', { id: inv.id, tab: 'page-2' });
      return;
    }
    onNavigate('report-detail', { id: linkedCase.id });
    toast.message('Opened case — use Convert to investigation there if needed.');
  };

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        onClick={() =>
          onNavigate('prompt-responses', {
            view: 'prompts',
            answer: response.answer,
            channel: 'incident',
            rangePreset: 'ALL',
          })
        }
      >
        Back to check-in queries
      </Button>

      <RelatedRecordsNav links={relatedLinks} onNavigate={onNavigate} />

      <Card className="mismo-card">
        <CardContent className="p-5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{prompt?.title ?? 'Check-in response'}</h1>
            <Badge className={response.answer === 'HAS_ISSUE' ? 'status-chip status-chip--warn' : 'status-chip status-chip--success'}>
              {response.answer === 'HAS_ISSUE' ? 'Yes' : 'No'}
            </Badge>
          </div>
          <p className="text-sm text-[var(--mismo-text-secondary)]">
            Employee:{' '}
            <button
              type="button"
              className="text-[var(--mismo-blue)] hover:underline font-medium"
              onClick={() => onNavigate('employee-detail', { id: response.userId })}
            >
              {userDisplayName(user)}
            </button>
          </p>
          {prompt && (
            <p className="text-sm text-[var(--mismo-text-secondary)]">
              Prompt type: {prompt.type}
              {prompt.includeFinancialQuestion ? ' · includes pay screening' : ''}
            </p>
          )}
          <p className="text-sm text-[var(--mismo-text-secondary)]">Submitted: {response.submittedAt.toLocaleString()}</p>
          <p className="text-sm text-[var(--mismo-text-secondary)]">
            Needs HR review: {needsReview ? 'Yes' : 'No'}
            {reviewer && response.reviewedAt && (
              <>
                {' '}
                · Reviewed by {reviewer.firstName} {reviewer.lastName} on {response.reviewedAt.toLocaleString()}
              </>
            )}
          </p>
          {response.notes && <p className="text-sm border-l-2 border-[var(--color-border-200)] pl-3 mt-2">{response.notes}</p>}

          {linkedCase && (
            <div className="mt-3 rounded-md border border-[var(--mismo-blue)]/30 bg-[var(--mismo-blue-light)]/20 p-3 space-y-2">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Linked case {formatCaseReference(linkedCase)}
                {linkedInv ? ` · Investigation ${getInvestigationDisplayId(linkedInv)}` : ''}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Open the case for response workflow, ownership, and convert-to-investigation. Related records above also link here.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={openCase}>
                  Open case
                </Button>
                {linkedInv ? (
                  <Button type="button" variant="outline" onClick={openInvestigation}>
                    Open investigation
                  </Button>
                ) : response.answer === 'HAS_ISSUE' ? (
                  <Button type="button" variant="outline" onClick={convertToInvestigation}>
                    Convert to investigation
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-2">
            {needsReview && (
              <Button
                className="bg-[var(--color-primary-900)] text-white"
                onClick={() => {
                  dataStore.markPromptResponseReviewed(response.id);
                  toast.success('Marked as reviewed.');
                }}
              >
                Mark reviewed
              </Button>
            )}
            {prompt?.routeToPayroll && (
              <Button onClick={() => toast.success('Response sent to payroll team for handling.')}>
                Send to payroll team
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
