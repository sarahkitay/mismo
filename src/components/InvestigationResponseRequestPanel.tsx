import { useState } from 'react';
import type { InvestigationResponseRequest } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatRelativeTime } from '@/lib/utils';

const RESPONSE_METHOD_LABELS: Record<InvestigationResponseRequest['method'], string> = {
  IN_APP: 'Respond in Mismo',
  WRITTEN_STATEMENT: 'Upload written statement',
  ATTORNEY_STATEMENT: 'Upload attorney statement',
  EMAIL: 'Email response',
  MEETING: 'Schedule interview / meeting',
};

interface InvestigationResponseRequestPanelProps {
  request: InvestigationResponseRequest;
  investigatorName?: string;
  onSubmit: (text: string) => boolean;
  onMarkViewed?: () => void;
}

export function InvestigationResponseRequestPanel({
  request,
  investigatorName,
  onSubmit,
  onMarkViewed,
}: InvestigationResponseRequestPanelProps) {
  const [draft, setDraft] = useState('');

  return (
    <div className="border border-[var(--color-border-200)] rounded-md p-4 space-y-3 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--mismo-text)]">Response requested</p>
          {investigatorName && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Investigator · {investigatorName}</p>
          )}
        </div>
        <Badge variant="outline">{request.status}</Badge>
      </div>

      {request.message && (
        <p className="text-sm text-[var(--mismo-text)] whitespace-pre-wrap border border-[var(--color-border-200)] rounded-md p-3 bg-[var(--color-surface-100)]">
          {request.message}
        </p>
      )}

      <p className="text-xs text-[var(--color-text-muted)]">
        {RESPONSE_METHOD_LABELS[request.method]}
        {request.sentAt ? ` · Sent ${formatRelativeTime(request.sentAt)}` : ''}
        {request.deadline ? ` · Due ${formatDate(request.deadline)}` : ''}
      </p>

      {request.status === 'SUBMITTED' ? (
        <div className="space-y-2">
          <p className="text-xs text-emerald-800">
            Submitted {request.submittedAt ? formatRelativeTime(request.submittedAt) : ''}. Thank you.
          </p>
          {request.responseText && (
            <p className="text-sm whitespace-pre-wrap text-[var(--mismo-text-secondary)]">{request.responseText}</p>
          )}
        </div>
      ) : (
        <>
          {request.status === 'SENT' && onMarkViewed && (
            <Button type="button" variant="outline" size="sm" onClick={onMarkViewed}>
              Mark as read
            </Button>
          )}
          <Textarea
            rows={4}
            placeholder="Type your response…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button
            type="button"
            className="bg-[var(--mismo-blue)] hover:bg-blue-600"
            onClick={() => {
              if (!draft.trim()) return;
              const ok = onSubmit(draft.trim());
              if (ok) setDraft('');
            }}
          >
            Submit response
          </Button>
        </>
      )}
    </div>
  );
}
