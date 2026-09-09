import type { DataStore } from '@/hooks/useDataStore';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RelatedRecordsNav } from '@/components/admin/RelatedRecordsNav';
import {
  destinationForPromptResponse,
  findReportForPromptResponse,
  relatedNavForDelivery,
  userDisplayName,
} from '@/lib/recordLinks';
import { markHrNavSeen } from '@/lib/hrNavAttention';
import { toast } from 'sonner';

interface AdminPromptResponseDetailProps {
  dataStore: DataStore;
  responseId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

/**
 * Yes (HAS_ISSUE) responses open the linked case directly.
 * This page remains for No responses and unanswered deliveries.
 */
export function AdminPromptResponseDetail({ dataStore, responseId, onNavigate }: AdminPromptResponseDetailProps) {
  const [openingCase, setOpeningCase] = useState(false);
  const response = dataStore.responses.find((r) => r.id === responseId);
  const delivery = !response ? dataStore.deliveries.find((d) => d.id === responseId) : undefined;

  useEffect(() => {
    if (response) {
      markHrNavSeen(dataStore.currentUser.id, 'prompt_response', response.id);
    }
  }, [dataStore.currentUser.id, response]);

  // Yes responses → case page (create case if needed).
  useEffect(() => {
    if (!response || response.answer !== 'HAS_ISSUE') return;

    let cancelled = false;

    const goToCase = async () => {
      const existing = findReportForPromptResponse(response.id, dataStore.reports, {
        userId: response.userId,
        promptDeliveryId: response.promptDeliveryId,
        promptId: response.promptId,
      });
      if (existing) {
        if (!cancelled) onNavigate('report-detail', { id: existing.id, replace: '1' });
        return;
      }

      const promptDelivery = dataStore.deliveries.find((d) => d.id === response.promptDeliveryId);
      if (!promptDelivery) {
        toast.error('Could not find the original check-in delivery for this response.');
        return;
      }

      setOpeningCase(true);
      try {
        const report = await dataStore.beginIncidentCaseFromPrompt(response.userId, promptDelivery, response);
        if (cancelled) return;
        if (report?.id) {
          onNavigate('report-detail', { id: report.id, replace: '1' });
          return;
        }
        toast.error('Could not open a case for this Yes response.');
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Could not open case.');
      } finally {
        if (!cancelled) setOpeningCase(false);
      }
    };

    void goToCase();
    return () => {
      cancelled = true;
    };
  }, [response, dataStore, onNavigate]);

  if (!response && !delivery) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => onNavigate('back', { fallback: 'prompt-responses', view: 'prompts' })}>
          Back
        </Button>
        <p className="text-sm text-[var(--mismo-text-secondary)]">This check-in or response could not be found.</p>
      </div>
    );
  }

  if (response?.answer === 'HAS_ISSUE') {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-sm text-[var(--mismo-text-secondary)]">
          {openingCase ? 'Opening case…' : 'Opening linked case…'}
        </p>
      </div>
    );
  }

  if (delivery) {
    const prompt = dataStore.prompts.find((p) => p.id === delivery.promptId);
    const user = dataStore.users.find((u) => u.id === delivery.userId);
    const relatedLinks = relatedNavForDelivery(dataStore, delivery);

    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => onNavigate('back', { fallback: 'prompt-responses', bucket: 'UNANSWERED', view: 'prompts', rangePreset: 'ALL' })}>
          Back
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

  // No-issue response summary (Yes redirects above).
  const prompt = dataStore.prompts.find((p) => p.id === response.promptId);
  const user = dataStore.users.find((u) => u.id === response.userId);
  const dest = destinationForPromptResponse(response, dataStore.reports);

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        onClick={() =>
          onNavigate('back', {
            fallback: 'prompt-responses',
            view: 'prompts',
            answer: response.answer,
            channel: 'incident',
            rangePreset: 'ALL',
          })
        }
      >
        Back
      </Button>

      <Card className="mismo-card">
        <CardContent className="p-5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{prompt?.title ?? 'Check-in response'}</h1>
            <Badge className="status-chip status-chip--success">No</Badge>
          </div>
          <p className="text-sm text-[var(--mismo-text-secondary)]">
            Employee:{' '}
            <button
              type="button"
              className="text-[var(--mismo-blue)] hover:underline font-medium"
              onClick={() => onNavigate('employee-detail', { id: response.userId, tab: 'prompts' })}
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
          {response.notes && <p className="text-sm border-l-2 border-[var(--color-border-200)] pl-3 mt-2">{response.notes}</p>}
          {dest.page === 'report-detail' && (
            <Button className="mt-3" onClick={() => onNavigate(dest.page, dest.params)}>
              Open linked case
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
