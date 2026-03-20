import { useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { defaultDateRange, inDateRange, type DateRangeState } from '@/lib/dateFilters';
import { formatDate } from '@/lib/utils';

interface AdminPromptResponsesProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialFilters?: Record<string, string>;
}

export function AdminPromptResponses({ dataStore, onNavigate, initialFilters }: AdminPromptResponsesProps) {
  const initialPreset = (initialFilters?.rangePreset as DateRangeState['preset'] | undefined) ?? 'ALL';
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<DateRangeState>({
    ...defaultDateRange,
    preset: initialPreset,
    startDate: initialFilters?.startDate || undefined,
    endDate: initialFilters?.endDate || undefined,
  });
  const [answer, setAnswer] = useState<'ALL' | 'HAS_ISSUE' | 'NO_ISSUE' | 'UNANSWERED'>(
    initialFilters?.answer === 'HAS_ISSUE'
      ? 'HAS_ISSUE'
      : initialFilters?.answer === 'NO_ISSUE'
        ? 'NO_ISSUE'
        : initialFilters?.bucket === 'UNANSWERED'
          ? 'UNANSWERED'
          : 'ALL'
  );

  const unansweredCount = dataStore.deliveries.filter((delivery) => delivery.status === 'PENDING').length;
  const yesCount = dataStore.responses.filter((response) => response.answer === 'HAS_ISSUE').length;
  const noCount = dataStore.responses.filter((response) => response.answer === 'NO_ISSUE').length;

  const rows = useMemo(() => {
    if (answer === 'UNANSWERED') {
      return dataStore.deliveries
        .filter((delivery) => delivery.status === 'PENDING' && inDateRange(delivery.deliveredAt, range))
        .map((delivery) => ({
          id: delivery.id,
          promptTitle: dataStore.prompts.find((prompt) => prompt.id === delivery.promptId)?.title ?? 'Prompt',
          userName: dataStore.users.find((user) => user.id === delivery.userId)?.firstName ?? 'Employee',
          answer: 'UNANSWERED',
          date: delivery.deliveredAt,
        }));
    }
    return dataStore.responses
      .filter((response) => inDateRange(response.createdAt, range))
      .filter((response) => answer === 'ALL' || response.answer === answer)
      .map((response) => ({
        id: response.id,
        promptTitle: dataStore.prompts.find((prompt) => prompt.id === response.promptId)?.title ?? 'Prompt',
        userName: dataStore.users.find((user) => user.id === response.userId)?.firstName ?? 'Employee',
        answer: response.answer,
        date: response.submittedAt,
      }))
      .filter((row) => `${row.promptTitle} ${row.userName}`.toLowerCase().includes(query.toLowerCase()));
  }, [answer, dataStore.deliveries, dataStore.prompts, dataStore.responses, dataStore.users, query, range]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Employee Prompt Responses</h1>
        <p className="text-[var(--mismo-text-secondary)]">Review Yes/No/Unanswered check-ins at scale.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={`interactive-control px-3 py-2 border text-sm ${answer === 'HAS_ISSUE' ? 'bg-[var(--mismo-blue)] text-white' : ''}`} onClick={() => setAnswer('HAS_ISSUE')}>Yes responses ({yesCount})</button>
        <button className={`interactive-control px-3 py-2 border text-sm ${answer === 'NO_ISSUE' ? 'bg-[var(--mismo-blue)] text-white' : ''}`} onClick={() => setAnswer('NO_ISSUE')}>No responses ({noCount})</button>
        <button className={`interactive-control px-3 py-2 border text-sm ${answer === 'UNANSWERED' ? 'bg-[var(--mismo-blue)] text-white' : ''}`} onClick={() => setAnswer('UNANSWERED')}>Unanswered prompts ({unansweredCount})</button>
        <button className={`interactive-control px-3 py-2 border text-sm ${answer === 'ALL' ? 'bg-[var(--mismo-blue)] text-white' : ''}`} onClick={() => setAnswer('ALL')}>All</button>
      </div>
      <Input placeholder="Search prompt responses..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <DateRangeFilter value={range} onChange={setRange} />
      <Card className="mismo-card">
        <CardContent className="p-0">
          {rows.map((row) => (
            <button key={row.id} className="interactive-control w-full border-b px-4 py-3 text-left" onClick={() => onNavigate('prompt-response-detail', { id: row.id, type: row.answer })}>
              <p className="font-medium">{row.promptTitle}</p>
              <p className="text-sm text-[var(--mismo-text-secondary)]">{row.userName} · {row.answer} · {formatDate(row.date)}</p>
            </button>
          ))}
          {rows.length === 0 && <p className="p-6 text-sm text-[var(--mismo-text-secondary)]">No prompt responses found.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
