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
  if (!response) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => onNavigate('prompt-responses')}>Back</Button>
        <p className="text-sm text-[var(--mismo-text-secondary)]">Prompt response not found.</p>
      </div>
    );
  }

  const prompt = dataStore.prompts.find((p) => p.id === response.promptId);
  const user = dataStore.users.find((u) => u.id === response.userId);

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => onNavigate('prompt-responses')}>Back to case register & check-ins</Button>
      <Card className="mismo-card">
        <CardContent className="p-5 space-y-2">
          <h1 className="text-xl font-semibold">{prompt?.title ?? 'Prompt'}</h1>
          <p className="text-sm text-[var(--mismo-text-secondary)]">Employee: {user?.firstName} {user?.lastName}</p>
          <p className="text-sm text-[var(--mismo-text-secondary)]">Answer: {response.answer}</p>
          <p className="text-sm text-[var(--mismo-text-secondary)]">Submitted: {response.submittedAt.toLocaleString()}</p>
          {response.notes && <p className="text-sm">Notes: {response.notes}</p>}
          {prompt?.routeToPayroll && (
            <Button
              className="mt-3"
              onClick={() => toast.success('Response sent to payroll team for handling.')}
            >
              Send to payroll team
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
