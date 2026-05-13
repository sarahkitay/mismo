import type { DataStore } from '@/hooks/useDataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
        <Button variant="ghost" onClick={() => onNavigate('prompt-responses')}>
          Back
        </Button>
        <p className="text-sm text-[var(--mismo-text-secondary)]">This check-in or response could not be found.</p>
      </div>
    );
  }

  if (delivery) {
    const prompt = dataStore.prompts.find((p) => p.id === delivery.promptId);
    const user = dataStore.users.find((u) => u.id === delivery.userId);
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => onNavigate('prompt-responses', { bucket: 'UNANSWERED', rangePreset: 'ALL' })}>
          Back to prompt responses
        </Button>
        <Card className="mismo-card">
          <CardContent className="p-5 space-y-3">
            <h1 className="text-xl font-semibold">{prompt?.title ?? 'Prompt'}</h1>
            <p className="text-sm text-[var(--mismo-text-secondary)]">
              Employee: {user?.firstName} {user?.lastName}
            </p>
            <p className="text-sm text-[var(--mismo-text-secondary)]">Status: Unanswered (pending)</p>
            <p className="text-sm text-[var(--mismo-text-secondary)]">Sent: {delivery.deliveredAt.toLocaleString()}</p>
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

  if (!response) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => onNavigate('prompt-responses')}>
          Back
        </Button>
        <p className="text-sm text-[var(--mismo-text-secondary)]">This check-in or response could not be found.</p>
      </div>
    );
  }

  const prompt = dataStore.prompts.find((p) => p.id === response.promptId);
  const user = dataStore.users.find((u) => u.id === response.userId);
  const needsReview = response.answer === 'HAS_ISSUE' && !response.reviewedAt && response.needsReview !== false;
  const reviewer = response.reviewedByUserId ? dataStore.users.find((u) => u.id === response.reviewedByUserId) : null;

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => onNavigate('prompt-responses', { answer: 'HAS_ISSUE', rangePreset: 'ALL' })}>
        Back to prompt responses
      </Button>
      <Card className="mismo-card">
        <CardContent className="p-5 space-y-2">
          <h1 className="text-xl font-semibold">{prompt?.title ?? 'Prompt'}</h1>
          <p className="text-sm text-[var(--mismo-text-secondary)]">
            Employee: {user?.firstName} {user?.lastName}
          </p>
          <p className="text-sm text-[var(--mismo-text-secondary)]">Answer: {response.answer}</p>
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
          {response.notes && <p className="text-sm">Notes: {response.notes}</p>}
          {needsReview && (
            <Button
              className="mt-2 bg-[var(--color-primary-900)] text-white"
              onClick={() => {
                dataStore.markPromptResponseReviewed(response.id);
                toast.success('Marked as reviewed.');
              }}
            >
              Mark reviewed
            </Button>
          )}
          {prompt?.routeToPayroll && (
            <Button className="mt-3" onClick={() => toast.success('Response sent to payroll team for handling.')}>
              Send to payroll team
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
