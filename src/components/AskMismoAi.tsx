import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/lib/icons';
import { askMismoHelp, isAiFeaturesEnabled, type HelpAssistantAskResponse } from '@/lib/api/aiServices';
import {
  isAllowedHelpPage,
  localHelpAssistantAnswer,
  type HelpNavTarget,
} from '@/lib/helpAssistantCatalog';
import { sanitizeInfraError } from '@/lib/infraMessaging';
import { toast } from 'sonner';

interface AskMismoAiProps {
  role: string;
  orgId?: string;
  stateCode?: string;
  onNavigate?: (page: string, params?: Record<string, string>) => void;
}

const SUGGESTIONS_BY_ROLE: Record<string, string[]> = {
  EMPLOYEE: [
    'How do I submit a confidential report?',
    'Where do I sign company memos?',
    'How do I complete my daily check-in?',
    'Where do I update my contact info?',
  ],
  DEFAULT: [
    'Where do I review Yes check-in answers?',
    'How do I publish state laws as a signable memo?',
    'How do I invite an employee?',
    'Where do I open an investigation?',
  ],
};

function suggestionsFor(role: string): string[] {
  return role.toUpperCase() === 'EMPLOYEE' ? SUGGESTIONS_BY_ROLE.EMPLOYEE : SUGGESTIONS_BY_ROLE.DEFAULT;
}

export function AskMismoAi({ role, orgId, stateCode, onNavigate }: AskMismoAiProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HelpAssistantAskResponse | null>(null);

  const go = (target: HelpNavTarget) => {
    if (!onNavigate) return;
    if (!isAllowedHelpPage(role, target.page)) {
      toast.error('That page is not available for your role.');
      return;
    }
    onNavigate(target.page, target.params);
  };

  const ask = async (text?: string) => {
    const q = (text ?? question).trim();
    if (!q) {
      toast.error('Type a question first.');
      return;
    }
    setQuestion(q);
    setLoading(true);
    setResult(null);
    try {
      if (isAiFeaturesEnabled()) {
        const res = await askMismoHelp({
          question: q,
          role,
          orgId,
          stateCode,
        });
        setResult(res);
      } else {
        const local = localHelpAssistantAnswer(q, role);
        setResult({ ...local, source: 'fallback' });
      }
    } catch (err) {
      const local = localHelpAssistantAnswer(q, role);
      setResult({ ...local, source: 'fallback' });
      toast.message(sanitizeInfraError(err instanceof Error ? err.message : 'Using offline guidance'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mismo-card border border-[var(--mismo-blue)]/25">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Icons.message className="h-5 w-5 text-[var(--mismo-blue)]" />
          Ask Mismo AI
        </CardTitle>
        <p className="text-sm text-[var(--mismo-text-secondary)] font-normal">
          Ask anything about using Mismo or high-level workplace law topics. Get steps and a button to the right
          page. Not legal advice.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {suggestionsFor(role).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="text-left text-xs px-2.5 py-1.5 rounded-md border border-[var(--color-border-200)] hover:border-[var(--mismo-blue)] hover:text-[var(--mismo-blue)] transition-colors"
              onClick={() => void ask(suggestion)}
              disabled={loading}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. How do I acknowledge updated California laws?"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void ask();
            }
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void ask()} disabled={loading}>
            {loading ? 'Thinking…' : 'Ask'}
          </Button>
          {result && (
            <Button type="button" variant="ghost" onClick={() => setResult(null)} disabled={loading}>
              Clear answer
            </Button>
          )}
        </div>

        {result && (
          <div className="rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-4 space-y-3">
            <p className="text-sm text-[var(--mismo-text)] whitespace-pre-wrap">{result.answer}</p>
            {result.steps.length > 0 && (
              <ol className="list-decimal pl-5 space-y-1 text-sm text-[var(--mismo-text-secondary)]">
                {result.steps.map((step, i) => (
                  <li key={`${i}-${step.slice(0, 24)}`}>{step}</li>
                ))}
              </ol>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {result.navigate && onNavigate && isAllowedHelpPage(role, result.navigate.page) && (
                <Button type="button" onClick={() => go(result.navigate!)}>
                  {result.navigate.label}
                </Button>
              )}
              {result.related
                .filter((item) => isAllowedHelpPage(role, item.page))
                .map((item) => (
                  <Button key={`${item.page}-${item.label}`} type="button" variant="outline" onClick={() => go(item)}>
                    {item.label}
                  </Button>
                ))}
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {result.source === 'openai' ? 'Answered with Mismo AI' : 'Guided from in-app help map'}
              {result.model ? ` · ${result.model}` : ''}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
