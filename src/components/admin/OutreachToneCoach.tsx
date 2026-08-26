import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { coachOutreachDraft, isAiFeaturesEnabled } from '@/lib/api/aiServices';
import { prepareContextImagesForAi } from '@/lib/prepareContextImages';
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
   * When `employee_outcome`, generate/revise the outcome note from `sourceMaterial`.
   * When `draft_from_screenshots`, draft a follow-up from context screenshots (Planned Response).
   */
  task?: 'soften' | 'employee_outcome' | 'draft_from_screenshots';
  /** Source text for generation (e.g. Actual Response field). */
  sourceMaterial?: string;
  /** Handling-ledger screenshot entries (data URLs). */
  contextAttachments?: Array<{ fileName?: string; text?: string; fileDataUrl?: string }>;
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
  contextAttachments = [],
  employeeEmail,
  employeeName,
  onApplySuggestion,
}: OutreachToneCoachProps) {
  const [loading, setLoading] = useState(false);
  const [toneTarget, setToneTarget] = useState<number>(2);
  const [result, setResult] = useState<OutreachCoachResponse | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (!isAiFeaturesEnabled()) return null;

  const isOutcomeGenerate = task === 'employee_outcome';
  const isScreenshotDraft = task === 'draft_from_screenshots';
  const hasBody = Boolean(body.trim());
  const hasSource = Boolean(sourceMaterial?.trim());
  const imageAttachmentCount = contextAttachments.filter(
    (e) =>
      Boolean(e.fileDataUrl?.startsWith('data:image/')) ||
      /\.(png|jpe?g|gif|webp)$/i.test(e.fileName ?? e.text ?? '')
  ).length;
  const hasImages = imageAttachmentCount > 0;

  const canRun = isScreenshotDraft
    ? hasImages || hasBody
    : isOutcomeGenerate
      ? hasBody || hasSource || hasImages
      : hasBody || hasImages;

  const generateFresh =
    (isOutcomeGenerate && !hasBody && (hasSource || hasImages)) ||
    (isScreenshotDraft && !hasBody && hasImages);

  const heading =
    title ??
    (isScreenshotDraft
      ? 'Draft follow-up from screenshots'
      : isOutcomeGenerate
        ? 'Generate outcome from actual response'
        : bodyOnly
          ? 'AI language assist'
          : 'AI outreach tone coach');
  const blurb =
    description ??
    (isScreenshotDraft
      ? 'AI reads uploaded text/email screenshots and drafts a professional follow-up for Planned Response.'
      : isOutcomeGenerate
        ? 'Uses the Actual Response to draft how the employee responded and next steps, in your chosen tone.'
        : bodyOnly
          ? 'Softens wording, flags risky language, and suggests a clearer professional draft you can apply before saving.'
          : 'Rates wording from empathetic (1) to harsh (6). Suggests safer drafts for case outreach.');

  const runCoach = async () => {
    if (!canRun) {
      toast.error(
        isScreenshotDraft
          ? 'Upload a screenshot under Context attachments first (or enter a draft to revise).'
          : isOutcomeGenerate
            ? 'Save or enter an Actual Response first (or draft an outcome to soften).'
            : bodyOnly
              ? 'Enter text or upload a screenshot before asking AI.'
              : 'Enter a message body before running the tone coach.'
      );
      return;
    }
    setLoading(true);
    try {
      const contextImages = hasImages ? await prepareContextImagesForAi(contextAttachments) : [];
      if (isScreenshotDraft && contextImages.length === 0 && !hasBody) {
        toast.error('Could not read screenshot images. Re-upload a PNG or JPG and try again.');
        return;
      }
      const effectiveTask =
        isScreenshotDraft || (!hasBody && hasImages && !isOutcomeGenerate)
          ? 'draft_from_screenshots'
          : isOutcomeGenerate
            ? 'employee_outcome'
            : 'soften';
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
        task: effectiveTask,
        sourceMaterial: sourceMaterial?.trim() || undefined,
        contextImages: contextImages.length ? contextImages : undefined,
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
      ? isScreenshotDraft
        ? 'Draft from screenshots'
        : 'Generate with AI'
      : hasImages && hasBody
        ? 'Revise with AI + screenshots'
        : bodyOnly
          ? 'Soften with AI'
          : 'Analyze tone';

  return (
    <div className="rounded-lg border border-[var(--color-border-200)] bg-[var(--color-surface-200)]/50 p-3 space-y-3 min-w-0">
      <div className="space-y-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-primary-900)] flex items-center gap-2">
            <Icons.zap className="h-4 w-4 shrink-0" />
            <span>{heading}</span>
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">{blurb}</p>
          {hasImages && (
            <p className="text-xs text-[var(--mismo-blue)] mt-1">
              Using {imageAttachmentCount} screenshot{imageAttachmentCount === 1 ? '' : 's'} as context
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={loading || !canRun}
          onClick={() => void runCoach()}
        >
          {actionLabel}
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">
          {bodyOnly || isOutcomeGenerate || isScreenshotDraft ? 'Preferred tone' : 'Target tone (optional)'}
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {OUTREACH_TONE_SCALE.filter((t) =>
            bodyOnly || isOutcomeGenerate || isScreenshotDraft ? t.score <= 4 : true
          ).map((t) => (
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

      {isScreenshotDraft && !hasImages && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          Upload a text or email screenshot under Context attachments so AI can draft the follow-up.
        </p>
      )}

      {isOutcomeGenerate && !hasSource && !hasImages && (
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
              {generateFresh ? 'Suggested follow-up' : 'Suggested revision'}
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
                    bodyOnly || isOutcomeGenerate || isScreenshotDraft
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
