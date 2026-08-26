import type { DataStore } from '@/hooks/useDataStore';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RelatedRecordsNav } from '@/components/admin/RelatedRecordsNav';
import { OutreachReminderModal } from '@/components/admin/OutreachReminderModal';
import { ManualOutreachModal } from '@/components/admin/ManualOutreachModal';
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
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);

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
  const linkedCase = findReportForPromptResponse(response.id, dataStore.reports, {
    userId: response.userId,
    promptDeliveryId: response.promptDeliveryId,
    promptId: response.promptId,
  });
  const linkedInv = findInvestigationForPromptResponse(response.id, dataStore.reports, dataStore.investigations);
  const isWageHour = Boolean(prompt?.includeFinancialQuestion || prompt?.routeToPayroll || linkedCase?.caseType === 'WAGE_HOUR');
  const relatedLinks = relatedNavForPromptResponse(dataStore, response);
  const employeeName = user ? `${user.firstName} ${user.lastName}` : 'Employee';
  const needsIntake = linkedCase?.needsExtendedIncidentIntake && !linkedCase.incidentIntakeCompletedAt;

  const openEmployee = () => onNavigate('employee-detail', { id: response.userId, tab: 'prompts' });

  const ensureLinkedCase = async () => {
    const delivery = dataStore.deliveries.find((d) => d.id === response.promptDeliveryId);
    if (!delivery) {
      toast.error('Could not find the original check-in delivery for this response.');
      return null;
    }
    setCreatingCase(true);
    try {
      const report = await dataStore.beginIncidentCaseFromPrompt(response.userId, delivery, response);
      if (report?.id) {
        toast.success(linkedCase ? 'Case linked.' : 'Case opened from this Yes response.');
        return report;
      }
      toast.error('No case was returned for this response.');
      return null;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open case.');
      return null;
    } finally {
      setCreatingCase(false);
    }
  };

  const openCase = async () => {
    if (linkedCase) {
      onNavigate('report-detail', { id: linkedCase.id });
      return;
    }
    const report = await ensureLinkedCase();
    if (report) onNavigate('report-detail', { id: report.id });
  };

  const openInvestigation = () => {
    if (!linkedInv) {
      toast.error('No investigation has been opened for this case yet.');
      return;
    }
    onNavigate('investigation-detail', { id: linkedInv.id, tab: 'page-1' });
  };

  const convertToInvestigation = async () => {
    let caseId = linkedCase?.id;
    if (!caseId) {
      const report = await ensureLinkedCase();
      caseId = report?.id;
    }
    if (!caseId) {
      toast.error('Open or create the case first.');
      return;
    }
    if (linkedInv) {
      onNavigate('investigation-detail', { id: linkedInv.id, tab: 'page-1' });
      return;
    }
    const inv = dataStore.createInvestigation(caseId, dataStore.currentUser.id);
    if (inv?.id) {
      toast.success('Investigation opened.');
      onNavigate('investigation-detail', { id: inv.id, tab: 'page-2' });
      return;
    }
    onNavigate('report-detail', { id: caseId });
    toast.message('Opened case. Use Convert to investigation there if needed.');
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
              onClick={openEmployee}
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

          <div className="mt-4 rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-3 space-y-3">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">HR actions</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={openEmployee}>
                Open employee record
              </Button>
              <Button type="button" onClick={() => void openCase()} disabled={creatingCase}>
                {linkedCase ? 'Open case' : creatingCase ? 'Opening case…' : 'Open or create case'}
              </Button>
              {response.answer === 'HAS_ISSUE' && (
                <>
                  {linkedInv ? (
                    <Button type="button" variant="outline" onClick={openInvestigation}>
                      Open investigation
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => void convertToInvestigation()} disabled={creatingCase}>
                      Convert to investigation
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => setOutreachOpen(true)}>
                    {needsIntake ? 'Request incident details…' : 'Contact employee…'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setManualOpen(true)}>
                    Log outreach
                  </Button>
                </>
              )}
            </div>
            {needsIntake && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                This Yes response still needs the employee&apos;s secure incident intake form. Use Contact employee to send instructions, or open the case to manage follow-up there.
              </p>
            )}
          </div>

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
                <Button type="button" onClick={() => void openCase()}>
                  Open case
                </Button>
                {linkedInv ? (
                  <Button type="button" variant="outline" onClick={openInvestigation}>
                    Open investigation
                  </Button>
                ) : response.answer === 'HAS_ISSUE' ? (
                  <Button type="button" variant="outline" onClick={() => void convertToInvestigation()}>
                    Convert to investigation
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          {!linkedCase && response.answer === 'HAS_ISSUE' && (
            <div className="mt-3 rounded-md border border-[var(--color-alert-600)]/30 bg-[var(--color-alert-50)] p-3 space-y-2">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">No linked case yet</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Yes responses normally open a case automatically. If linking failed or this is older data, create the case now to unlock the register, investigation, and employee follow-up workflow.
              </p>
              <Button type="button" onClick={() => void openCase()} disabled={creatingCase}>
                {creatingCase ? 'Creating case…' : 'Create case from this response'}
              </Button>
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
            {linkedCase && isWageHour && !['RESOLVED', 'CLOSED'].includes(linkedCase.status) && (
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => {
                  dataStore.markPromptResponseReviewed(response.id);
                  dataStore.updateReportStatus(linkedCase.id, 'RESOLVED', 'Resolved directly from wage and hour response review.');
                  dataStore.addReportHandlingEntry(linkedCase.id, 'NOTE', 'Wage and hour concern reviewed and resolved without a formal investigation.');
                  toast.success('Wage and hour response reviewed and resolved.');
                }}
              >
                Review &amp; resolve without investigation
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <OutreachReminderModal
        open={outreachOpen}
        onOpenChange={setOutreachOpen}
        orgId={dataStore.currentUser.orgId}
        createdByUserId={dataStore.currentUser.id}
        employeeName={employeeName}
        relatedLabel={prompt?.title ?? 'Incident check-in'}
        reportId={linkedCase?.id}
        defaultSubject={
          needsIntake
            ? 'Action needed: complete your confidential incident form'
            : 'Follow-up on your HR check-in response'
        }
        defaultBody={
          needsIntake
            ? 'Thank you for indicating a concern on the mandatory incident check-in. Please sign in to Mismo and complete the secure incident intake form so HR can review the details confidentially.'
            : 'HR is following up on your recent check-in response. Please sign in to Mismo or reply if you have additional information to share.'
        }
        onSend={(payload) => {
          const fullMessage = payload.internalNote
            ? `${payload.subject}\n\n${payload.body}\n\n[Internal: ${payload.internalNote}]`
            : `${payload.subject}\n\n${payload.body}`;
          payload.channels.forEach((ch) => {
            dataStore.sendNudge(response.userId, ch, fullMessage, {
              type: needsIntake ? 'CASE_REPORT_REMINDER' : 'CASE_REPORT_REMINDER',
              promptId: response.promptId,
              relatedLabel: payload.reason || prompt?.title || 'Check-in follow-up',
              reportId: linkedCase?.id,
            });
          });
          toast.success(`Message logged via ${payload.channels.join(' & ')}.`);
          void dataStore.refreshAppNotifications?.();
        }}
      />

      <ManualOutreachModal
        open={manualOpen}
        onOpenChange={setManualOpen}
        employeeName={employeeName}
        relatedOptions={[
          ...(linkedCase ? [{ id: `report:${linkedCase.id}`, label: formatCaseReference(linkedCase) }] : []),
          { id: `prompt:${response.promptId}`, label: prompt?.title ?? 'Check-in query' },
        ]}
        onSave={(payload) => {
          const channel = payload.contactMethod === 'EMAIL' ? 'EMAIL' : payload.contactMethod === 'SMS' ? 'SMS' : 'MANUAL';
          const message = [payload.notes, payload.outcome && `Outcome: ${payload.outcome}`, payload.followUpDate && `Follow-up: ${payload.followUpDate}`]
            .filter(Boolean)
            .join('\n');
          const context: {
            type: 'MANUAL_OUTREACH';
            relatedLabel?: string;
            reportId?: string;
            promptId?: string;
          } = {
            type: 'MANUAL_OUTREACH',
            relatedLabel: payload.relatedItem ?? 'Manual outreach',
          };
          if (payload.relatedItem?.startsWith('report:')) context.reportId = payload.relatedItem.slice(7);
          if (payload.relatedItem?.startsWith('prompt:')) context.promptId = payload.relatedItem.slice(7);
          dataStore.sendNudge(response.userId, channel, message, context);
          toast.success(channel === 'EMAIL' ? 'Outreach emailed and logged.' : 'Manual outreach logged.');
          void dataStore.refreshAppNotifications?.();
        }}
      />
    </div>
  );
}
