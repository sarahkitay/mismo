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
 subject: string;
 body: string;
 stateCode?: string;
 caseCategory?: string;
 caseType?: string;
 createdBy?: string;
 onApplySuggestion: (subject: string, body: string) => void;
}

export function OutreachToneCoach({
 orgId,
 reportId,
 investigationId,
 subject,
 body,
 stateCode,
 caseCategory,
 caseType,
 createdBy = 'system',
 onApplySuggestion,
}: OutreachToneCoachProps) {
 const [loading, setLoading] = useState(false);
 const [toneTarget, setToneTarget] = useState<number | undefined>(undefined);
 const [result, setResult] = useState<OutreachCoachResponse | null>(null);
 const [expanded, setExpanded] = useState(false);

 if (!isAiFeaturesEnabled()) return null;

 const runCoach = async () => {
 if (!body.trim()) {
 toast.error('Enter a message body before running the tone coach.');
 return;
 }
 setLoading(true);
 try {
 const res = await coachOutreachDraft({
 orgId,
 reportId,
 investigationId,
 subject,
 body,
 stateCode,
 caseCategory,
 caseType,
 toneTarget,
 createdBy,
 });
 setResult(res);
 setExpanded(true);
 } catch (e) {
 toast.error(sanitizeInfraError(e instanceof Error ? e.message : 'Tone coach unavailable'));
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="rounded-lg border border-[var(--color-border-200)] bg-[var(--color-surface-200)]/50 p-4 space-y-3">
 <div className="flex items-start justify-between gap-3">
 <div>
 <p className="text-sm font-semibold text-[var(--color-primary-900)] flex items-center gap-2">
 <Icons.zap className="h-4 w-4" />
 AI outreach tone coach
 </p>
 <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
 Rates wording from empathetic (1) to harsh (6). Suggests safer drafts for case outreach.
 </p>
 </div>
 <Button type="button" variant="outline" size="sm" disabled={loading} onClick={runCoach}>
 {loading ? 'Analyzing…' : 'Analyze tone'}
 </Button>
 </div>

 <div className="space-y-2">
 <Label className="text-xs">Target tone (optional)</Label>
 <div className="flex flex-wrap gap-1.5">
 {OUTREACH_TONE_SCALE.map((t) => (
 <button
 key={t.score}
 type="button"
 title={t.description}
 className={`text-xs px-2 py-1 rounded border transition-colors ${
 toneTarget === t.score
 ? 'bg-[var(--color-primary-900)] text-white border-[var(--color-primary-900)]'
 : 'bg-white border-[var(--color-border-200)] hover:border-[var(--color-primary-700)]'
 }`}
 onClick={() => setToneTarget(toneTarget === t.score ? undefined : t.score)}
 >
 {t.score}. {t.label}
 </button>
 ))}
 </div>
 </div>

 {result && expanded && (
 <div className="space-y-3 pt-2 border-t border-[var(--color-border-200)]">
 <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border text-sm font-medium ${toneColorClass(result.tone_score)}`}>
 Tone: {toneLabelForScore(result.tone_score)} ({result.tone_score}/6)
 {result.tone_score >= 5 && (
 <span className="text-xs font-normal"> - review carefully</span>
 )}
 </div>

 <p className="text-sm text-[var(--color-text-secondary)]">{result.rationale}</p>

 {result.risk_flags.length > 0 && (
 <ul className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded p-3 space-y-1 list-disc pl-5">
 {result.risk_flags.map((flag) => (
 <li key={flag}>{flag}</li>
 ))}
 </ul>
 )}

 {result.applicable_laws.length > 0 && (
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
 <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Suggested revision</p>
 <p className="text-sm font-medium">{result.suggested_subject}</p>
 <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{result.suggested_body}</p>
 <Button
 type="button"
 size="sm"
 variant="outline"
 onClick={() => {
 onApplySuggestion(result.suggested_subject, result.suggested_body);
 toast.success('Suggested wording applied - review before sending.');
 }}
 >
 Use suggested wording
 </Button>
 </div>

 <p className="text-[10px] text-[var(--color-text-muted)]">{result.disclaimer}</p>
 </div>
 )}
 </div>
 );
}
