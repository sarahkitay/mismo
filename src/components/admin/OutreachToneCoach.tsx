import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { coachOutreachDraft, isAiFeaturesEnabled } from '@/lib/api/aiServices';
import {
  OUTREACH_TONE_SCALE,
  toneColorClass,
  toneLabelForScore,
  type OutreachCoachResponse,
} from '@/types/aiServices';
import { Icons } from '@/lib/icons';
import { sanitizeInfraError } from '@/lib/infraMessaging';
import { toast } from 'sonner';

interface OutreachToneCoachProps {
  orgId: string;
  reportId?: string;
  investigationId?: string;
  /** Optional subject line (ignored when bodyOnly). */
  subject?: string;
  body: string;
  stateCode?: string;
  caseCategory?: string;
  caseType?: string;
  createdBy?: string;
  /** Coach a single case-note field (plan / action / outcome) instead of email outreach. */
  bodyOnly?: boolean;
  title?: string;
  description?: string;
  /**
   * When `employee_outcome`, generate/revise the outcome note from `sourceMaterial`
   * (Actual Response). Body may be empty if source material is present.
   */
  task?: 'soften' | 'employee_outcome';
  /** Source text for generation (e.g. Actual Response field). */
  sourceMaterial?: string;
  /** Employee email for "Email to employee" (opens mailto). */
  employeeEmail?: string;
  employeeName?: string;
  onApplySuggestion: (subject: string, body: string) => void;
}

function buildMailto(email: string, emailSubject: string, emailBody: string): string {
  const params = new URLSearchParams();
  params.set('subject', emailSubject);
  params.set('body', emailBody);
  return `mailto:${email}?${params.toString()}`;
}

export function OutreachToneCoach({
  orgId,
  reportId,
  investigationId,
  subject = '',
  body,
  stateCode,
  caseCategory,
  caseType,
  createdBy = 'system',
  bodyOnly = false,
  title,
  description,
  task = 'soften',
  sourceMaterial,
  employeeEmail,
  employeeName,
  onApplySuggestion,
}: OutreachToneCoachProps) {
  const [loading, setLoading] = useState(false);
  const [toneTarget, setToneTarget] = useState<number>(bodyOnly ? 2 : 2);
  const [result, setResult] = useState<OutreachCoachResponse | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (!isAiFeaturesEnabled()) return null;

  const isOutcomeGenerate = task === 'employee_outcome';
  const hasBody = Boolean(body.trim());
  const hasSource = Boolean(sourceMaterial?.trim());
  const canRun = isOutcomeGenerate ? hasBody || hasSource : hasBody;
  const generateFresh = isOutcomeGenerate && !hasBody && hasSource;

  const heading =
    title ??
    (isOutcomeGenerate
      ? 'Generate outcome from actual response'
      : bodyOnly
        ? 'AI language assist'
        : 'AI outreach tone coach');
  const blurb =
    description ??
    (isOutcomeGenerate
      ? 'Uses the Actual Response to draft how the employee responded and next steps, in your chosen tone.'
      : bodyOnly
        ? 'Softens wording, flags risky language, and suggests a clearer professional draft you can apply before saving.'
        : 'Rates wording from empathetic (1) to harsh (6). Suggests safer drafts for case outreach.');

  const runCoach = async () => {
    if (!canRun) {
      toast.error(
        isOutcomeGenerate
          ? 'Save or enter an Actual Response first (or draft an outcome to soften).'
          : bodyOnly
            ? 'Enter text before asking AI to revise it.'
            : 'Enter a message body before running the tone coach.'
      );
      return;
    }
    setLoading(true);
    try {
      const res = await coachOutreachDraft({
        orgId,
        reportId,
        investigationId,
        subject: subject || (bodyOnly ? heading : 'Case message'),
        body: body.trim() || '',
        stateCode,
        caseCategory,
        caseType,
        toneTarget,
        createdBy,
        task: isOutcomeGenerate ? 'employee_outcome' : 'soften',
        sourceMaterial: sourceMaterial?.trim() || undefined,
      });
      setResult(res);
      setExpanded(true);
    } catch (e) {
      toast.error(sanitizeInfraError(e instanceof Error ? e.message : 'Tone coach unavailable'));
    } finally {
      setLoading(false);
    }
  };

  const copySuggested = async () => {
    if (!result) return;
    const text =
      !bodyOnly && result.suggested_subject?.trim()
        ? `${result.suggested_subject.trim()}\n\n${result.suggested_body}`
        : result.suggested_body;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Suggested wording copied.');
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  const emailSuggested = () => {
    if (!result) return;
    const to = employeeEmail?.trim();
    if (!to) {
      toast.error('No employee email on this case. Copy the wording instead.');
      return;
    }
    const emailSubject =
      result.suggested_subject?.trim() ||
      subject?.trim() ||
      (employeeName ? 'Update regarding your report' : 'Follow-up from HR');
    const href = buildMailto(to, emailSubject, result.suggested_body);
    window.location.href = href;
    toast.message(`Opening email to ${to}`, {
      description: 'Review the draft in your mail client before sending.',
    });
  };

  const actionLabel = loading
    ? generateFresh
      ? 'Generating…'
      : 'Analyzing…'
    : generateFresh
      ? 'Generate with AI'
      : bodyOnly
        ? 'Soften with AI'
        : 'Analyze tone';

  return (
    <div className="rounded-lg border border-[var(--color-border-200)] bg-[var(--color-surface-200)]/50 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-primary-900)] flex items-center gap-2">
            <Icons.zap className="h-4 w-4 shrink-0" />
            {heading}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{blurb}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={loading || !canRun} onClick={runCoach}>
          {actionLabel}
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">{bodyOnly || isOutcomeGenerate ? 'Preferred tone' : 'Target tone (optional)'}</Label>
        <div className="flex flex-wrap gap-1.5">
          {OUTREACH_TONE_SCALE.filter((t) => (bodyOnly || isOutcomeGenerate ? t.score <= 4 : true)).map((t) => (
            <button
              key={t.score}
              type="button"
              title={t.description}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                toneTarget === t.score
                  ? 'bg-[var(--color-primary-900)] text-white border-[var(--color-primary-900)]'
                  : 'bg-white border-[var(--color-border-200)] hover:border-[var(--color-primary-700)]'
              }`}
              onClick={() => setToneTarget(t.score)}
            >
              {t.score}. {t.label}
            </button>
          ))}
        </div>
      </div>

      {isOutcomeGenerate && !hasSource && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          Add text under Actual Response so AI can draft an appropriate outcome.
        </p>
      )}

      {result && expanded && (
        <div className="space-y-3 pt-2 border-t border-[var(--color-border-200)]">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border text-sm font-medium ${toneColorClass(result.tone_score)}`}
          >
            Tone: {toneLabelForScore(result.tone_score)} ({result.tone_score}/6)
            {result.tone_score >= 5 && <span className="text-xs font-normal"> - review carefully</span>}
          </div>

          <p className="text-sm text-[var(--color-text-secondary)]">{result.rationale}</p>

          {result.risk_flags.length > 0 && (
            <ul className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded p-3 space-y-1 list-disc pl-5">
              {result.risk_flags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          )}

          {!bodyOnly && result.applicable_laws.length > 0 && (
            <div className="text-xs space-y-1">
              <p className="font-medium text-[var(--color-text-primary)]">Relevant law context</p>
              {result.applicable_laws.map((law) => (
                <p key={law.citation} className="text-[var(--color-text-secondary)]">
                  <span className="font-medium">{law.citation}</span> - {law.relevance}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              {generateFresh ? 'Suggested outcome' : 'Suggested revision'}
            </p>
            {!bodyOnly && <p className="text-sm font-medium">{result.suggested_subject}</p>}
            <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{result.suggested_body}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onApplySuggestion(result.suggested_subject, result.suggested_body);
                  toast.success(
                    bodyOnly || isOutcomeGenerate
                      ? 'Suggested wording applied. Review before saving.'
                      : 'Suggested wording applied - review before sending.'
                  );
                }}
              >
                Use suggested wording
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void copySuggested()}>
                Copy
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={emailSuggested}
                title={
                  employeeEmail?.trim()
                    ? `Email to ${employeeEmail.trim()}`
                    : 'No employee email on this case'
                }
              >
                <Icons.mail className="h-3.5 w-3.5 mr-1.5" />
                Email to employee
              </Button>
            </div>
          </div>

          <p className="text-[10px] text-[var(--color-text-muted)]">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
